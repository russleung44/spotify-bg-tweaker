# Background Tweaker

Spicetify extension: set a custom background image for Spotify, with adjustable **opacity** and **blur**. Supports **image URL** or **local upload**.

Spicetify 扩展：自定义 Spotify 背景图片，可调节 **透明度（opacity）** 和 **模糊（blur）**，支持 **图片链接** 或 **本地上传**。

## Features

- Background image behind the whole Spotify UI (top bar / sidebar / main view become transparent)
- Opacity slider (0–100%) and blur slider (0–60px), applied live
- Image source: any `https://` URL, or upload a local image (auto-downscaled to ≤1920px JPEG and stored locally)
- Settings persist across restarts; toggle on/off anytime

## Install (manual)

```powershell
# copy bgTweaker.js to your Extensions folder, then:
spicetify config extensions bgTweaker.js
spicetify apply
```

Extensions folder on Windows: `%APPDATA%\spicetify\Extensions`

## Usage

Open the **profile menu (top-right avatar) → Background Tweaker**:

1. Paste an image URL, or click **Upload local image…**
2. Adjust **Opacity** / **Blur** sliders (changes apply instantly)
3. **Enable background** checkbox to temporarily disable without losing settings

## Publish to Marketplace

This repo already follows the [Publishing to Marketplace](https://github.com/spicetify/marketplace/wiki/Publishing-to-Marketplace) format:

- `manifest.json` in the root ✅
- `main` → `bgTweaker.js`, `readme` → `README.md` ✅
- `preview.jpg` — currently a placeholder; replace with a real screenshot of the extension in action
- Public GitHub repo with the topic tag **`spicetify-extensions`**

## Uninstall

```powershell
spicetify config extensions- bgTweaker.js
spicetify apply
```

## Notes

- **Highest background priority**: while enabled, this extension claims the background — theme/snippet backgrounds are suppressed automatically (pseudo-element layers like `body::before`, dedicated background containers, full-screen fixed layers). Disable our background (uncheck *Enable background*) to bring them back.
- Local images are stored as compressed base64 in Spicetify's localStorage (~5MB limit); very large files are rejected — use a URL for huge images.
- Selectors target the current Spotify UI (`.Root__top-container`); a major Spotify update may require updating them.
