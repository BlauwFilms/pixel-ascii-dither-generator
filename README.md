# Pixel, ASCII & Dither Art Generator

A free, client-side creative transformation tool by [Blauw Films](https://www.blauwfilms.com/).

## Files

| File | Purpose |
|---|---|
| `style.css` | All styles (Webflow-compatible classes) |
| `engine.js` | Image processing engine (pixel art, ASCII art, dither art) |
| `app.js` | UI controller, event handling, zoom, export |
| `template.html` | HTML structure (loaded dynamically by Webflow) |
| `index.html` | Standalone test page (open locally to test) |
| `webflow-loader.html` | Code to paste into Webflow Embed element |

## Setup for Webflow

1. Push `style.css`, `engine.js`, `app.js`, and `template.html` to a GitHub repo
2. Enable **GitHub Pages** (Settings → Pages → Deploy from branch `main`)
3. Update the `BASE_URL` in `webflow-loader.html` to your GitHub Pages URL
4. In Webflow, add an **Embed** element and paste the contents of `webflow-loader.html`

### Using jsDelivr CDN (recommended for performance)

Replace the `BASE_URL` with:
```
https://cdn.jsdelivr.net/gh/YOURUSERNAME/REPONAME@main
```

## Local Testing

Open `index.html` in a browser. No server required — all processing is client-side.

## Features

- **Pixel Art**: Adjustable pixel size, brightness, contrast, saturation, 9 classic palettes + custom palette builder
- **ASCII Art**: 8 character presets, cell size control, invert, B&W, rotate, mixed density
- **Dither Art**: 7 algorithms (Floyd–Steinberg, Atkinson, Jarvis, Stucki, Burkes, Sierra, Sierra Lite), palette selection
- **Zoom controls**: Zoom in/out/fit for precise preview inspection
- **Export**: PNG at original resolution (always), TXT for ASCII art
- **No server, no ads, no watermarks**

## License

© Blauw Films. All rights reserved.
