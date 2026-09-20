// NAME: Background Tweaker
// AUTHOR: tony
// DESCRIPTION: Set a custom Spotify background image (URL or local upload) with adjustable opacity & blur. Configure it from the profile menu → "Background Tweaker".

(() => {
  const LAYER_ID = "bgt-layer";
  const STYLE_ID = "bgt-style";
  const K = {
    enabled: "bgt:enabled",
    src: "bgt:src",
    opacity: "bgt:opacity",
    blur: "bgt:blur",
    fontEnabled: "bgt:font:enabled",
    fontFamily: "bgt:font:family",
    fontSize: "bgt:font:size",
  };
  const DEF = {
    opacity: 50,
    blur: 10,
    fontSize: 16,
    maxImgSize: 1920,
    quality: 0.85,
    maxStorageChars: 3_500_000,
    maxFileBytes: 12 * 1024 * 1024,
  };

  // "picture" glyph for the profile-menu entry (Spicetify.SVGIcons has no image icon)
  const ICON =
    '<svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor"><path d="M14 12.667V3.333c0-.733-.6-1.333-1.333-1.333H3.333c-.733 0-1.333.6-1.333 1.333v9.334c0 .733.6 1.333 1.333 1.333h9.334c.733 0 1.333-.6 1.333-1.333zM5.667 9l1.667 2.007L9.667 8l3 4H3.333z"/></svg>';

  const CSS = `
#${LAYER_ID} {
  position: fixed;
  inset: 0;
  z-index: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  opacity: var(--bgt-opacity, .5);
  filter: blur(var(--bgt-blur, 10px));
  transform: scale(1.08); /* hide blurred edge bleed */
  pointer-events: none;
}
body.bgt-active .Root__top-container {
  position: relative;
  z-index: 1;
  background-color: transparent !important;
}
body.bgt-active .Root__top-container > *,
body.bgt-active .Root__main-view,
body.bgt-active .Root__main-view > *,
body.bgt-active .main-view-container,
body.bgt-active .main-view-container__scroll-node,
body.bgt-active .main-view-container__scroll-node-child,
body.bgt-active .Root__globalNav,
body.bgt-active .Root__right-sidebar,
body.bgt-active .Root__right-sidebar > *,
body.bgt-active .Root__now-playing-bar,
body.bgt-active .Root__now-playing-bar > * {
  background-color: transparent !important;
  background-image: none !important;
}
/* while our background is active, suppress theme/snippet background painting:
   pseudo-element layers on top-level containers … */
html.bgt-active::before, html.bgt-active::after,
body.bgt-active::before, body.bgt-active::after,
body.bgt-active #main::before, body.bgt-active #main::after,
body.bgt-active .Root__top-container::before,
body.bgt-active .Root__top-container::after {
  content: none !important;
}
/* … and known dedicated background containers (the generic sweeper below
   handles the rest) */
body.bgt-active .customnight-bg-container {
  display: none !important;
}
/* ---------- custom font ---------- */
html.bgt-font-on {
  font-size: var(--bgt-font-size, 16px) !important;
}
body.bgt-font-on {
  /* encore type classes resolve their font through these custom properties */
  --font-family: var(--bgt-font-stack);
  --encore-font-family: var(--bgt-font-stack);
}
/* universal override — beats the explicit font-family on encore type classes */
body.bgt-font-on,
body.bgt-font-on *:not(svg, svg *):not(style):not(script) {
  font-family: var(--bgt-font-stack) !important;
}
`;

  // ---------- helpers ----------
  const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const get = (k, d) => { try { const v = Spicetify.LocalStorage.get(k); return v == null ? d : v; } catch { return d; } };
  const set = (k, v) => { try { Spicetify.LocalStorage.set(k, String(v)); } catch {} };
  const el = (tag, css, text) => {
    const n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  };
  const notify = msg => { try { Spicetify.showNotification(msg); } catch {} };

  // ---------- priority: sweep third-party full-screen background layers ----------
  // While our background is active, hide any direct child of body/#main that looks
  // like a dedicated background layer (full-viewport + fixed/absolute + doesn't
  // intercept clicks or sits at negative z-index). Restored when ours is disabled.
  const SAFE_PATTERN = /Root__|body-drag-top|context-menu|GenericModal|tooltip|video-player/i;
  const hiddenByUs = new Map();

  function isSafeNode(node) {
    if (!(node instanceof Element)) return true;
    if (node.id === LAYER_ID) return true;
    const cls = typeof node.className === "string" ? node.className : "";
    return SAFE_PATTERN.test(node.id + " " + cls);
  }

  function sweep() {
    if (!document.body.classList.contains("bgt-active")) {
      for (const [node, prev] of hiddenByUs) {
        try { node.style.display = prev; } catch {}
      }
      hiddenByUs.clear();
      return;
    }
    for (const parent of [document.body, document.getElementById("main")]) {
      if (!parent) continue;
      for (const node of parent.children) {
        if (isSafeNode(node)) continue;
        if (hiddenByUs.has(node)) {
          node.style.display = "none"; // re-assert if a theme fought back
          continue;
        }
        let s;
        try { s = getComputedStyle(node); } catch { continue; }
        if (s.position !== "fixed" && s.position !== "absolute") continue;
        const r = node.getBoundingClientRect();
        if (r.width < window.innerWidth * 0.9 || r.height < window.innerHeight * 0.9) continue;
        const z = parseInt(s.zIndex, 10);
        if (s.pointerEvents !== "none" && !(Number.isFinite(z) && z < 1)) continue;
        hiddenByUs.set(node, node.style.display || "");
        node.style.display = "none";
      }
    }
    for (const node of [...hiddenByUs.keys()]) {
      if (!node.isConnected) hiddenByUs.delete(node);
    }
  }

  // ---------- apply / DOM sync ----------
  let lastProbed = null;
  let lastSig = "";
  let mo = null;
  let syncQueued = false;

  // Coalesce mutation bursts (Spotify mutates a lot) into one sync per frame
  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(() => {
      syncQueued = false;
      syncDom();
    });
  }

  function observeAll() {
    if (!mo) {
      mo = new MutationObserver(queueSync);
      mo.observe(document.body, { childList: true });
    }
    const main = document.getElementById("main");
    if (main) {
      try { mo.observe(main, { childList: true }); } catch {}
    }
  }

  function syncDom() {
    const active = get(K.enabled, "true") === "true" && !!get(K.src, "");
    const src = active ? String(get(K.src, "")) : "";
    const opacity = clamp(num(get(K.opacity, DEF.opacity), DEF.opacity), 0, 100);
    const blur = clamp(num(get(K.blur, DEF.blur), DEF.blur), 0, 100);

    const fontOn = get(K.fontEnabled, "false") === "true" && !!String(get(K.fontFamily, "")).trim();
    const family = String(get(K.fontFamily, "")).trim().replace(/"/g, "");
    const fontSize = clamp(num(get(K.fontSize, DEF.fontSize), DEF.fontSize), 10, 28);
    const stack = `"${family}", CircularSp, "Segoe UI", "Microsoft YaHei", sans-serif`;

    const sig = `${active}|${src}|${opacity}|${blur}|${fontOn}|${family}|${fontSize}`;

    // skip style churn unless something actually changed
    const existing = document.getElementById(LAYER_ID);
    if (sig !== lastSig || (active && !existing)) {
      lastSig = sig;
      document.documentElement.classList.toggle("bgt-active", active);
      document.body.classList.toggle("bgt-active", active);
      let layer = existing;
      if (active) {
        if (!layer) {
          const main = document.getElementById("main");
          if (main) {
            layer = el("div");
            layer.id = LAYER_ID;
            main.prepend(layer);
          }
        }
        if (layer) {
          layer.style.backgroundImage = `url("${src.replace(/"/g, "%22")}")`;
          if (/^https?:/i.test(src) && src !== lastProbed) {
            lastProbed = src;
            const probe = new Image();
            probe.onerror = () => {
              console.error("[bgt] image failed to load (CSP or bad URL?):", src);
              notify("背景图加载失败 — 可能被 CSP 拦截，试试本地上传");
            };
            probe.src = src;
          }
        }
      } else if (layer) {
        layer.remove();
        lastProbed = null;
      }
      const rs = document.documentElement.style;
      rs.setProperty("--bgt-opacity", String(opacity / 100));
      rs.setProperty("--bgt-blur", blur + "px");

      // ---------- custom font ----------
      if (fontOn) {
        document.documentElement.classList.add("bgt-font-on");
        document.body.classList.add("bgt-font-on");
        rs.setProperty("--bgt-font-stack", stack);
        rs.setProperty("--bgt-font-size", fontSize + "px");
      } else {
        document.documentElement.classList.remove("bgt-font-on");
        document.body.classList.remove("bgt-font-on");
      }
    }
    sweep();
    applyFontToIframes(fontOn, stack, fontSize);
    observeAll();
  }

  // custom apps (Marketplace, lyrics, …) render in same-origin iframes the main
  // document's CSS can't reach — inject a standalone font style into each one
  function applyFontToIframes(on, stack, size) {
    const css = on
      ? `:root{font-size:${size}px !important;}body,body *:not(svg,svg *):not(style):not(script){font-family:${stack} !important;}`
      : "";
    for (const frame of document.querySelectorAll("iframe")) {
      let doc;
      try { doc = frame.contentDocument; } catch { continue; }
      if (!doc) continue;
      let st = doc.getElementById("bgt-iframe-font");
      if (on) {
        if (!st) {
          st = doc.createElement("style");
          st.id = "bgt-iframe-font";
          (doc.head || doc.documentElement).appendChild(st);
        }
        if (st.textContent !== css) st.textContent = css;
      } else if (st) {
        st.remove();
      }
    }
  }

  // ---------- local image → downscaled data URL ----------
  async function compressImage(file, maxSize = DEF.maxImgSize, quality = DEF.quality) {
    let source, w, h, objectUrl = null;
    if (typeof createImageBitmap === "function") {
      source = await createImageBitmap(file); // fast path: off-thread decode
      w = source.width;
      h = source.height;
    } else {
      objectUrl = URL.createObjectURL(file);
      source = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("decode failed"));
        i.src = objectUrl;
      });
      w = source.naturalWidth;
      h = source.naturalHeight;
    }
    try {
      const scale = Math.min(1, maxSize / Math.max(w, h));
      const dw = Math.max(1, Math.round(w * scale));
      const dh = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      canvas.getContext("2d").drawImage(source, 0, 0, dw, dh);
      return canvas.toDataURL("image/jpeg", quality);
    } finally {
      if (source.close) source.close();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  // ---------- settings UI ----------
  function sliderRow(key, label, fmt, fallback, min = 0, max = 60) {
    const row = el("div", "display:flex;align-items:center;gap:10px;");
    row.append(el("span", "min-width:52px;font-size:12px;opacity:.75;", label));
    const input = document.createElement("input");
    input.type = "range";
    input.min = min;
    input.max = max;
    input.step = 1;
    input.value = clamp(num(get(key, fallback), fallback), min, max);
    input.style.cssText = "flex:1;cursor:pointer;";
    const val = el("span", "min-width:44px;text-align:right;font-size:12px;opacity:.75;", fmt(+input.value));
    input.addEventListener("input", () => {
      set(key, input.value);
      val.textContent = fmt(+input.value);
      syncDom();
    });
    row.append(input, val);
    return row;
  }

  function button(text, onClick) {
    const b = el("button", "padding:7px 14px;border-radius:500px;border:none;cursor:pointer;font-size:13px;background:rgba(255,255,255,.12);color:inherit;", text);
    b.addEventListener("click", onClick);
    return b;
  }

  // fallback dialog for when Spicetify.PopupModal is unavailable
  function fallbackModal(title, content) {
    const close = () => {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    };
    const onKey = e => { if (e.key === "Escape") close(); };
    const overlay = el("div", "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;");
    const panel = el("div", "background:#181818;border-radius:12px;padding:20px;max-height:80vh;overflow:auto;box-shadow:0 8px 32px rgba(0,0,0,.5);color:#eee;");
    const head = el("div", "display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;");
    head.append(el("h2", "margin:0;font-size:16px;color:#fff;", title));
    head.append(button("✕", close));
    panel.append(head, content);
    overlay.append(panel);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);
    document.body.append(overlay);
  }

  function openSettings() {
    const wrap = el("div", "display:flex;flex-direction:column;gap:14px;width:340px;padding:4px 2px;color:var(--text-base,#eee);font-size:13px;");

    // current image preview
    const preview = document.createElement("img");
    preview.style.cssText = "width:100%;height:110px;object-fit:cover;border-radius:8px;display:none;background:rgba(255,255,255,.06);";
    const syncPreview = () => {
      const src = get(K.src, "");
      if (src) preview.src = src;
      preview.style.display = src ? "block" : "none";
    };

    // image URL input (applies live while typing)
    const src = get(K.src, "");
    wrap.append(el("div", "opacity:.75;", "Image URL"));
    const urlInput = el("input");
    urlInput.type = "text";
    urlInput.placeholder = "https://example.com/wallpaper.jpg";
    urlInput.value = /^https?:\/\//i.test(src) ? src : "";
    urlInput.style.cssText = "width:100%;box-sizing:border-box;padding:8px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:inherit;font-size:13px;outline:none;";
    const applyUrl = () => {
      const v = urlInput.value.trim();
      if (v && /^https?:\/\//i.test(v)) {
        set(K.src, v);
        syncDom();
        syncPreview();
      }
    };
    let urlTimer = null;
    urlInput.addEventListener("input", () => {
      clearTimeout(urlTimer);
      urlTimer = setTimeout(applyUrl, 400);
    });
    urlInput.addEventListener("keydown", e => { if (e.key === "Enter") { clearTimeout(urlTimer); applyUrl(); } });
    urlInput.addEventListener("change", applyUrl);
    wrap.append(urlInput);

    // local upload + clear
    const fileInput = el("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      if (f.size > DEF.maxFileBytes) {
        notify("图片过大（>12MB）— 请压缩后再试");
        return;
      }
      try {
        const dataUrl = await compressImage(f);
        if (dataUrl.length > DEF.maxStorageChars) {
          notify("Image too large — try a smaller file");
          return;
        }
        set(K.src, dataUrl);
        urlInput.value = "";
        syncDom();
        syncPreview();
        notify("Background updated");
      } catch {
        notify("Failed to read image");
      }
    });

    const row = el("div", "display:flex;gap:8px;");
    row.append(button("Upload local image…", () => fileInput.click()));
    row.append(button("Clear background", () => {
      set(K.src, "");
      urlInput.value = "";
      syncDom();
      syncPreview();
    }));
    wrap.append(row, fileInput);

    // opacity / blur sliders
    wrap.append(sliderRow(K.opacity, "Opacity", v => `${v}%`, DEF.opacity, 0, 100));
    wrap.append(sliderRow(K.blur, "Blur", v => `${v}px`, DEF.blur, 0, 60));

    // enable toggle
    const toggle = el("label", "display:flex;align-items:center;gap:8px;cursor:pointer;");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = get(K.enabled, "true") === "true";
    cb.addEventListener("change", () => {
      set(K.enabled, cb.checked);
      syncDom();
    });
    toggle.append(cb, el("span", null, "Enable background"));
    wrap.append(toggle);

    // ---------- font ----------
    wrap.append(el("div", "margin-top:4px;opacity:.75;", "Font"));
    const fontToggle = el("label", "display:flex;align-items:center;gap:8px;cursor:pointer;");
    const fontCb = document.createElement("input");
    fontCb.type = "checkbox";
    fontCb.checked = get(K.fontEnabled, "false") === "true";
    fontCb.addEventListener("change", () => {
      set(K.fontEnabled, fontCb.checked);
      syncDom();
    });
    fontToggle.append(fontCb, el("span", null, "Enable custom font"));
    wrap.append(fontToggle);

    const INPUT_STYLE = "width:100%;box-sizing:border-box;padding:8px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:inherit;font-size:13px;outline:none;";

    const famInput = el("input");
    famInput.type = "text";
    famInput.placeholder = "Installed font name, e.g. Microsoft YaHei";
    famInput.value = String(get(K.fontFamily, ""));
    famInput.style.cssText = INPUT_STYLE;
    const applyFam = () => {
      set(K.fontFamily, famInput.value.trim());
      syncDom();
    };
    let famTimer = null;
    famInput.addEventListener("input", () => {
      clearTimeout(famTimer);
      famTimer = setTimeout(applyFam, 400);
    });
    famInput.addEventListener("keydown", e => { if (e.key === "Enter") { clearTimeout(famTimer); applyFam(); } });
    famInput.addEventListener("change", applyFam);
    wrap.append(famInput);

    wrap.append(sliderRow(K.fontSize, "Size", v => `${v}px`, DEF.fontSize, 10, 28));

    if (Spicetify.PopupModal && Spicetify.PopupModal.display) {
      Spicetify.PopupModal.display({ title: "Background Tweaker", content: wrap, isLarge: false });
    } else {
      fallbackModal("Background Tweaker", wrap);
    }
    syncPreview();
  }

  // ---------- init ----------
  async function waitFor(pred, timeout = 20000) {
    const t0 = Date.now();
    while (!pred()) {
      if (Date.now() - t0 > timeout) return false;
      await new Promise(r => setTimeout(r, 50));
    }
    return true;
  }

  async function init() {
    const t0 = Date.now();
    if (!(await waitFor(() => window.Spicetify && Spicetify.Menu && Spicetify.LocalStorage))) {
      console.error("[bgt] Spicetify core APIs missing after 20s");
      return;
    }
    try {
      const style = el("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
      syncDom();
      // Menu.Item's constructor reads Spicetify.ReactJSX.jsx, which the wrapper
      // only populates after the platform finishes loading — wait for it.
      if (await waitFor(() => window.Spicetify && Spicetify.ReactJSX && Spicetify.ReactJSX.jsx)) {
        new Spicetify.Menu.Item("Background Tweaker", false, openSettings, ICON).register();
        console.info("[bgt] ready in", Date.now() - t0, "ms");
      } else {
        console.error("[bgt] ReactJSX never became available — Spicetify wrapper may be incompatible with this Spotify version");
      }
    } catch (err) {
      console.error("[bgt] init failed:", err);
    }
  }

  init();
})();
