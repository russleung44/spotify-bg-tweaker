# Background Tweaker

[Spicetify](https://spicetify.app) extension: set a **custom background image** for Spotify with adjustable **opacity** and **blur**, and optionally apply a **custom font**. Supports image URL or local upload.

Spicetify 扩展：自定义 Spotify **背景图片**（可调透明度/模糊，支持图片链接或本地上传）与**自定义字体**（系统字体 + 字号）。

## Features

**Background**
- Image behind the whole Spotify UI — top bar, sidebar and main view become transparent
- Opacity slider (0–100%) and blur slider (0–60px), applied live
- Image source: any `https://` URL, or upload a local image (auto-downscaled to ≤1920px JPEG and stored locally)

**Font**
- Use any installed system font (e.g. `Microsoft YaHei`, `JetBrains Mono`)
- UI font size slider (10–28px)
- Covers both legacy text and Encore-based components (`--font-family` / `--encore-font-family`)

**General**
- **Highest background priority**: theme/snippet backgrounds (pseudo-element layers, dedicated background containers, full-screen fixed layers) are suppressed while our background is active — and restored when you disable it
- Independent toggles for background and font; settings persist across restarts
- Live preview thumbnail, debounced inputs, fallback dialog when `Spicetify.PopupModal` is unavailable

## Install

### From Marketplace (recommended)

Search **Background Tweaker** in [Spicetify Marketplace](https://github.com/spicetify/marketplace) and click install.

### Manual

Copy `bgTweaker.js` to your Extensions folder, then:

```powershell
spicetify config extensions bgTweaker.js
spicetify apply
```

Extensions folder on Windows: `%APPDATA%\spicetify\Extensions`

## Usage

Open the **profile menu (top-right avatar) → Background Tweaker**:

| Section | What it does |
| --- | --- |
| Image URL / Upload | Paste an image URL, or upload a local image |
| Opacity / Blur | Adjust transparency and blur — changes apply instantly |
| Enable background | Temporarily disable the background without losing settings |
| Font | Enable, type an installed font's name, set the UI size |

## Notes

- Local images are stored as compressed base64 in Spicetify's localStorage (~5 MB limit); very large files (>12 MB) are rejected up front — use a URL for huge images.
- Fonts must be installed on your system; the font fallback stack ends in `CircularSp → Segoe UI → Microsoft YaHei → sans-serif`.
- While the background is active, third-party background layers are hidden automatically. Unchecking **Enable background** brings them back untouched.
- Selectors target the current Spotify UI (`.Root__top-container` etc.); a major Spotify update may require updating them.

## Uninstall

```powershell
spicetify config extensions- bgTweaker.js
spicetify apply
```

(If installed via Marketplace, remove it from the Marketplace app instead.)

## License

[MIT](LICENSE)
