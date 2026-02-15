/* ============================================================
   engine.js — Image Processing Engine
   Pixel, ASCII & Dither Art Generator — Blauw Films
   ============================================================ */

window.PxlEngine = (function () {
  'use strict';

  /* ---- Palettes ---- */
  const PALETTES = {
    gameboy: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
    gbc: [
      '#0f380f','#306230','#8bac0f','#9bbc0f','#e0f8cf','#86c06c',
      '#306850','#071821','#65a49b','#8b8b8b','#d8d8d8','#ffffff',
      '#555555','#aa3939','#ff7777','#ffaa00'
    ],
    gba: [
      '#000000','#400000','#800000','#c00000','#ff0000','#004000',
      '#008000','#00c000','#00ff00','#000040','#000080','#0000c0',
      '#0000ff','#ffffff','#c0c0c0','#808080','#404040','#ffff00',
      '#ff8000','#00ffff','#ff00ff','#8080ff','#80ff80','#ff8080',
      '#200020','#402040','#604060','#806080','#a080a0','#c0a0c0',
      '#e0c0e0','#ffe0ff'
    ],
    nes: [
      '#000000','#fcfcfc','#f8f8f8','#bcbcbc','#7c7c7c','#a4e4fc',
      '#3cbcfc','#0078f8','#0000fc','#b8b8f8','#6888fc','#0058f8',
      '#0000bc','#d8b8f8','#9878f8','#6844fc','#4428bc','#f8b8f8',
      '#f878f8','#d800cc','#940084','#f8a4c0','#f85898','#e40058',
      '#a80020','#f0d0b0','#f87858','#f83800','#a81000','#fce0a8',
      '#fca044','#e45c10','#881400','#f8d878','#f8b800','#ac7c00',
      '#503000','#d8f878','#b8f818','#00b800','#007800','#b8f8b8',
      '#58d854','#00a800','#006800','#b8f8d8','#58f898','#00a844',
      '#005800','#00fcfc','#00e8d8','#008888','#004058','#f8d8f8',
      '#787878'
    ],
    snes: [
      '#000000','#ffffff','#ff0000','#00ff00','#0000ff','#ffff00',
      '#ff00ff','#00ffff','#800000','#008000','#000080','#808000',
      '#800080','#008080','#c0c0c0','#808080'
    ],
    genesis: [
      '#000000','#002200','#004400','#006600','#008800','#00aa00',
      '#00cc00','#00ee00','#220000','#440000','#660000','#880000',
      '#aa0000','#cc0000','#ee0000','#000022','#000044','#000066',
      '#000088','#0000aa','#0000cc','#0000ee','#eeeeee','#cccccc',
      '#aaaaaa','#888888','#666666','#444444','#222222','#ee8800',
      '#eeee00','#00eeee'
    ],
    c64: [
      '#000000','#ffffff','#880000','#aaffee','#cc44cc','#00cc55',
      '#0000aa','#eeee77','#dd8855','#664400','#ff7777','#333333',
      '#777777','#aaff66','#0088ff','#bbbbbb'
    ],
    pico8: [
      '#000000','#1d2b53','#7e2553','#008751','#ab5236','#5f574f',
      '#c2c3c7','#fff1e8','#ff004d','#ffa300','#ffec27','#00e436',
      '#29adff','#83769c','#ff77a8','#ffccaa'
    ],
    bw: ['#000000', '#ffffff'],
    mac: ['#000000', '#ffffff', '#555555', '#aaaaaa', '#2b2b2b', '#d4d4d4'],
    newspaper: ['#000000', '#ffffff', '#f5f0e1', '#1a1a1a'],
    print: ['#000000', '#ffffff', '#00ffff', '#ff00ff', '#ffff00', '#ff0000']
  };

  /* ---- ASCII Charsets ---- */
  const CHARSETS = {
    standard:  ' .:-=+*#%@',
    dense:     ' .`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
    minimal:   ' .:+#',
    blocks:    ' \u2591\u2592\u2593\u2588',
    braille:   '\u2800\u2801\u2802\u2803\u2804\u2805\u2806\u2807\u2808\u2809\u280a\u280b\u280c\u280d\u280e\u280f\u2810\u2811\u2812\u2813\u2814\u2815\u2816\u2817\u2818\u2819\u281a\u281b\u281c\u281d\u281e\u281f\u2820\u2821\u2822\u2823\u2824\u2825\u2826\u2827\u2828\u2829\u282a\u282b\u282c\u282d\u282e\u282f\u2830\u2831\u2832\u2833\u2834\u2835\u2836\u2837\u2838\u2839\u283a\u283b\u283c\u283d\u283e\u283f',
    technical: ' \u00b7\u2022\u25cb\u25cf\u25a1\u25a0\u25ca\u25c6',
    matrix:    ' 0123456789ABCDEFabcdef.:',
    hatching:  ' \u2500\u2502\u253c\u2571\u2572\u2573\u2591\u2592\u2593\u2588'
  };

  /* ---- Dither Kernels ---- */
  const KERNELS = {
    floydsteinberg: [
      [1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]
    ],
    atkinson: [
      [1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8],
      [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]
    ],
    jarvis: [
      [1,0,7/48],[2,0,5/48],[-2,1,3/48],[-1,1,5/48],[0,1,7/48],
      [1,1,5/48],[2,1,3/48],[-2,2,1/48],[-1,2,3/48],[0,2,5/48],
      [1,2,3/48],[2,2,1/48]
    ],
    stucki: [
      [1,0,8/42],[2,0,4/42],[-2,1,2/42],[-1,1,4/42],[0,1,8/42],
      [1,1,4/42],[2,1,2/42],[-2,2,1/42],[-1,2,2/42],[0,2,4/42],
      [1,2,2/42],[2,2,1/42]
    ],
    burkes: [
      [1,0,8/32],[2,0,4/32],[-2,1,2/32],[-1,1,4/32],
      [0,1,8/32],[1,1,4/32],[2,1,2/32]
    ],
    sierra: [
      [1,0,5/32],[2,0,3/32],[-2,1,2/32],[-1,1,4/32],[0,1,5/32],
      [1,1,4/32],[2,1,2/32],[-1,2,2/32],[0,2,3/32],[1,2,2/32]
    ],
    sierralite: [
      [1, 0, 2 / 4], [-1, 1, 1 / 4], [0, 1, 1 / 4]
    ]
  };

  /* ---- Utility ---- */
  function clamp(v, mn, mx) { return v < mn ? mn : v > mx ? mx : v; }

  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [parseInt(h.substr(0,2),16), parseInt(h.substr(2,2),16), parseInt(h.substr(4,2),16)];
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
  }

  function colorDistSq(a, b) {
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return dr * dr + dg * dg + db * db;
  }

  function nearestColor(rgb, palette) {
    let best = palette[0], bestD = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const d = colorDistSq(rgb, palette[i]);
      if (d < bestD) { bestD = d; best = palette[i]; }
    }
    return best;
  }

  /* ---- Image Adjustment ---- */
  function adjustImageData(data, brightness, contrast, saturation) {
    const bright = brightness * 2.55;
    const con = contrast * 2.55;
    const f = (259 * (con + 255)) / (255 * (259 - con));
    const sat = saturation !== undefined ? saturation / 100 : 1;

    for (let i = 0; i < data.length; i += 4) {
      let r = f * (data[i] - 128) + 128 + bright;
      let g = f * (data[i+1] - 128) + 128 + bright;
      let b = f * (data[i+2] - 128) + 128 + bright;
      if (sat !== 1) {
        const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = gray + sat * (r - gray);
        g = gray + sat * (g - gray);
        b = gray + sat * (b - gray);
      }
      data[i]   = clamp(Math.round(r), 0, 255);
      data[i+1] = clamp(Math.round(g), 0, 255);
      data[i+2] = clamp(Math.round(b), 0, 255);
    }
  }

  /* Get source image data at a given max dimension, with adjustments applied */
  function getSourceData(img, maxW, maxH, brightness, contrast, saturation) {
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (maxW && w > maxW) { h = Math.round(h * (maxW / w)); w = maxW; }
    if (maxH && h > maxH) { w = Math.round(w * (maxH / h)); h = maxH; }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    adjustImageData(imgData.data, brightness, contrast, saturation);
    return { w, h, data: imgData.data };
  }

  /* ============================================================
     PIXEL ART
     ============================================================ */
  function renderPixelArt(img, opts) {
    const { pixelSize, brightness, contrast, saturation, paletteName, customColors } = opts;
    const ps = pixelSize;
    // Always process at original res for export quality
    const src = getSourceData(img, null, null, brightness, contrast, saturation);
    const { w, h, data } = src;
    const cols = Math.ceil(w / ps);
    const rows = Math.ceil(h / ps);

    const palette = paletteName === 'custom'
      ? (customColors || []).map(hexToRgb)
      : paletteName !== 'none'
        ? (PALETTES[paletteName] || []).map(hexToRgb)
        : null;

    // Output canvas at the SAME resolution as source
    const outW = cols * ps;
    const outH = rows * ps;
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let rr = 0, gg = 0, bb = 0, cnt = 0;
        for (let dy = 0; dy < ps && r * ps + dy < h; dy++) {
          for (let dx = 0; dx < ps && c * ps + dx < w; dx++) {
            const idx = ((r * ps + dy) * w + (c * ps + dx)) * 4;
            rr += data[idx]; gg += data[idx+1]; bb += data[idx+2]; cnt++;
          }
        }
        let avgR = Math.round(rr / cnt);
        let avgG = Math.round(gg / cnt);
        let avgB = Math.round(bb / cnt);
        if (palette && palette.length > 0) {
          const nc = nearestColor([avgR, avgG, avgB], palette);
          avgR = nc[0]; avgG = nc[1]; avgB = nc[2];
        }
        ctx.fillStyle = rgbToHex(avgR, avgG, avgB);
        ctx.fillRect(c * ps, r * ps, ps, ps);
      }
    }
    return canvas;
  }

  /* ============================================================
     ASCII ART
     ============================================================ */
  function renderAsciiArt(img, opts) {
    const {
      cellSize, brightness, contrast, preset, invert, bw,
      rotate, mixedDensity
    } = opts;

    let charset = CHARSETS[preset] || CHARSETS.standard;
    if (mixedDensity) {
      // Combine standard + dense for more range
      charset = CHARSETS.dense;
    }

    const src = getSourceData(img, null, null, brightness, contrast);
    const { w, h, data } = src;
    const cols = Math.floor(w / cellSize);
    const rows = Math.floor(h / (cellSize * 2)); // aspect correction

    // Build text and color data
    const lines = [];
    const colorData = [];
    for (let r = 0; r < rows; r++) {
      let line = '';
      const lineColors = [];
      for (let c = 0; c < cols; c++) {
        let rr = 0, gg = 0, bb = 0, cnt = 0;
        for (let dy = 0; dy < cellSize * 2 && r * cellSize * 2 + dy < h; dy++) {
          for (let dx = 0; dx < cellSize && c * cellSize + dx < w; dx++) {
            const idx = ((r * cellSize * 2 + dy) * w + (c * cellSize + dx)) * 4;
            rr += data[idx]; gg += data[idx+1]; bb += data[idx+2]; cnt++;
          }
        }
        rr = Math.round(rr / cnt);
        gg = Math.round(gg / cnt);
        bb = Math.round(bb / cnt);
        let lum = (0.2126 * rr + 0.7152 * gg + 0.0722 * bb) / 255;
        if (invert) lum = 1 - lum;
        const ci = Math.round(lum * (charset.length - 1));
        line += charset[clamp(ci, 0, charset.length - 1)];
        lineColors.push([rr, gg, bb]);
      }
      lines.push(line);
      colorData.push(lineColors);
    }

    const text = lines.join('\n');

    // Render to canvas at a size that fills the original image dimensions
    // We want the output to be roughly the same pixel dimensions as the source
    const targetW = w;
    const targetH = h;
    const charW = targetW / cols;
    const charH = targetH / rows;
    const fontSize = Math.max(4, Math.floor(charH));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = invert ? '#ffffff' : '#1a1a1a';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.font = fontSize + 'px "Roboto Mono", monospace';
    ctx.textBaseline = 'top';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = lines[r][c];
        if (ch === ' ') continue;

        if (bw) {
          ctx.fillStyle = invert ? '#1a1a1a' : '#ffffff';
        } else {
          const [cr, cg, cb] = colorData[r][c];
          ctx.fillStyle = rgbToHex(cr, cg, cb);
        }

        const x = c * charW;
        const y = r * charH;

        if (rotate) {
          ctx.save();
          ctx.translate(x + charW / 2, y + charH / 2);
          // Rotate based on luminance
          const [cr, cg, cb] = colorData[r][c];
          const lum = (0.2126 * cr + 0.7152 * cg + 0.0722 * cb) / 255;
          ctx.rotate(lum * Math.PI * 0.5);
          ctx.fillText(ch, -charW / 2, -charH / 2);
          ctx.restore();
        } else {
          ctx.fillText(ch, x, y);
        }
      }
    }

    return { canvas, text };
  }

  /* ============================================================
     DITHER ART
     ============================================================ */
  function renderDitherArt(img, opts) {
    const {
      algorithm, pointSize, threshold, brightness, contrast,
      paletteName, customColors
    } = opts;

    const src = getSourceData(img, null, null, brightness, contrast);
    const { w, h, data: srcData } = src;

    const palette = paletteName === 'custom'
      ? (customColors || []).map(hexToRgb)
      : (PALETTES[paletteName] || PALETTES.bw).map(hexToRgb);

    const kernel = KERNELS[algorithm] || KERNELS.floydsteinberg;

    // Work with float copy
    const pix = new Float32Array(w * h * 3);
    for (let i = 0, j = 0; i < srcData.length; i += 4, j += 3) {
      pix[j]   = srcData[i];
      pix[j+1] = srcData[i+1];
      pix[j+2] = srcData[i+2];
    }

    // Error diffusion
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const j = (y * w + x) * 3;
        const old0 = pix[j], old1 = pix[j+1], old2 = pix[j+2];
        const nc = nearestColor(
          [clamp(Math.round(old0),0,255), clamp(Math.round(old1),0,255), clamp(Math.round(old2),0,255)],
          palette
        );
        pix[j] = nc[0]; pix[j+1] = nc[1]; pix[j+2] = nc[2];
        const e0 = old0 - nc[0], e1 = old1 - nc[1], e2 = old2 - nc[2];
        for (let k = 0; k < kernel.length; k++) {
          const dx = kernel[k][0], dy = kernel[k][1], wt = kernel[k][2];
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nj = (ny * w + nx) * 3;
            pix[nj]   += e0 * wt;
            pix[nj+1] += e1 * wt;
            pix[nj+2] += e2 * wt;
          }
        }
      }
    }

    // Render — always at original resolution (pointSize only affects visual scaling)
    const ps = pointSize;
    const outW = w * ps;
    const outH = h * ps;
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');

    if (ps === 1) {
      const imgData = ctx.createImageData(w, h);
      const out = imgData.data;
      for (let i = 0, j = 0; j < pix.length; i += 4, j += 3) {
        out[i]   = clamp(Math.round(pix[j]),   0, 255);
        out[i+1] = clamp(Math.round(pix[j+1]), 0, 255);
        out[i+2] = clamp(Math.round(pix[j+2]), 0, 255);
        out[i+3] = 255;
      }
      canvas.width = w; canvas.height = h;
      ctx.putImageData(imgData, 0, 0);
    } else {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const j = (y * w + x) * 3;
          ctx.fillStyle = rgbToHex(
            clamp(Math.round(pix[j]),0,255),
            clamp(Math.round(pix[j+1]),0,255),
            clamp(Math.round(pix[j+2]),0,255)
          );
          ctx.fillRect(x * ps, y * ps, ps, ps);
        }
      }
    }

    return canvas;
  }

  /* ---- Public API ---- */
  return {
    PALETTES,
    CHARSETS,
    renderPixelArt,
    renderAsciiArt,
    renderDitherArt,
    hexToRgb,
    rgbToHex
  };

})();
