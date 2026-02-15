/* ============================================================
   app.js — UI Controller
   Pixel, ASCII & Dither Art Generator — Blauw Films
   ============================================================ */

(function () {
  'use strict';

  const Engine = window.PxlEngine;
  if (!Engine) { console.error('PxlEngine not loaded'); return; }

  /* ---- State ---- */
  let srcImg = null;
  let mode = 'pixel';
  let zoom = 1; // 1 = fit-to-container
  let lastAsciiText = '';
  let lastResultCanvas = null;
  let customPxColors = [];
  let customDtColors = [];
  let renderPending = false;
  let debounceTimer = null;

  // Preview fit size: we render at full res, then display scaled
  const MAX_PREVIEW_DIM = 4096; // generous; zoom handles display

  /* ---- DOM shortcuts ---- */
  const $ = (id) => document.getElementById(id);

  const el = {
    gen: $('pxlGen'),
    upload: $('pxlUpload'),
    fileInput: $('pxlFileInput'),
    fileInfo: $('pxlFileInfo'),
    fileName: $('pxlFileName'),
    fileRes: $('pxlFileRes'),
    fileSize: $('pxlFileSize'),
    removeBtn: $('pxlRemoveBtn'),
    modes: $('pxlModes'),
    main: $('pxlMain'),
    previewCanvas: $('pxlCanvas'),
    placeholder: $('pxlPlaceholder'),
    processing: $('pxlProcessing'),
    previewWrap: $('pxlPreviewWrap'),
    exportBar: $('pxlExportBar'),
    btnPng: $('btnExportPng'),
    btnTxt: $('btnExportTxt'),
    zoomIn: $('btnZoomIn'),
    zoomOut: $('btnZoomOut'),
    zoomFit: $('btnZoomFit'),
    zoomLabel: $('zoomLabel'),
    // Pixel
    ctrlPixel: $('ctrlPixel'),
    sldPixelSize: $('sldPixelSize'),
    sldPxBright: $('sldPxBright'),
    sldPxContrast: $('sldPxContrast'),
    sldPxSat: $('sldPxSat'),
    selPxPalette: $('selPxPalette'),
    pxPalettePreview: $('pxlPalettePreview'),
    pxCustomPalette: $('pxlCustomPalette'),
    pxCustomColor: $('pxlCustomColor'),
    pxCustomHex: $('pxlCustomHex'),
    pxAddColor: $('pxlAddColor'),
    pxCustomColors: $('pxlCustomColors'),
    pxClearCustom: $('pxlClearCustom'),
    // ASCII
    ctrlAscii: $('ctrlAscii'),
    selAsciiPreset: $('selAsciiPreset'),
    sldAsciiCell: $('sldAsciiCell'),
    sldAsBright: $('sldAsBright'),
    sldAsContrast: $('sldAsContrast'),
    sldAsDetail: $('sldAsDetail'),
    chkAsciiInvert: $('chkAsciiInvert'),
    chkAsciiBW: $('chkAsciiBW'),
    chkAsciiRotate: $('chkAsciiRotate'),
    chkAsciiMixed: $('chkAsciiMixed'),
    // Dither
    ctrlDither: $('ctrlDither'),
    selDitherAlgo: $('selDitherAlgo'),
    sldDitherPt: $('sldDitherPt'),
    sldDitherTh: $('sldDitherTh'),
    sldDtBright: $('sldDtBright'),
    sldDtContrast: $('sldDtContrast'),
    sldDtDetail: $('sldDtDetail'),
    selDtPalette: $('selDtPalette'),
    dtPalettePreview: $('dtPalettePreview'),
    dtCustomPalette: $('dtCustomPalette'),
    dtCustomColor: $('dtCustomColor'),
    dtCustomHex: $('dtCustomHex'),
    dtAddColor: $('dtAddColor'),
    dtCustomColors: $('dtCustomColors'),
    dtClearCustom: $('dtClearCustom'),
  };

  /* ---- Helpers ---- */
  function formatBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  function show(elem) { elem.classList.remove('pxl-hidden'); }
  function hide(elem) { elem.classList.add('pxl-hidden'); }
  function toggle(elem, visible) { visible ? show(elem) : hide(elem); }

  /* ---- Palette swatches ---- */
  function showPaletteSwatches(container, paletteName) {
    container.innerHTML = '';
    if (!paletteName || paletteName === 'none' || paletteName === 'custom') return;
    const colors = Engine.PALETTES[paletteName];
    if (!colors) return;
    colors.forEach(c => {
      const s = document.createElement('div');
      s.className = 'pxl-palette-swatch';
      s.style.backgroundColor = c;
      s.title = c;
      container.appendChild(s);
    });
  }

  function renderCustomSwatches(container, colors, onRemove) {
    container.innerHTML = '';
    colors.forEach((c, i) => {
      const s = document.createElement('div');
      s.className = 'pxl-palette-swatch';
      s.style.backgroundColor = c;
      s.title = c + ' (click to remove)';
      s.addEventListener('click', () => onRemove(i));
      container.appendChild(s);
    });
  }

  /* ---- Zoom ---- */
  function updateZoom() {
    if (!lastResultCanvas) return;
    const wrapW = el.previewWrap.clientWidth;
    const wrapH = el.previewWrap.clientHeight || 500;
    const cW = lastResultCanvas.width;
    const cH = lastResultCanvas.height;

    if (zoom <= 0) {
      // Fit mode: scale to fit container
      const scaleX = wrapW / cW;
      const scaleY = wrapH / cH;
      zoom = Math.min(scaleX, scaleY, 1); // don't upscale beyond 100%
    }

    const dispW = Math.round(cW * zoom);
    const dispH = Math.round(cH * zoom);

    el.previewCanvas.style.width = dispW + 'px';
    el.previewCanvas.style.height = dispH + 'px';
    el.zoomLabel.textContent = Math.round(zoom * 100) + '%';
  }

  function zoomIn() {
    zoom = Math.min((zoom > 0 ? zoom : 0.5) * 1.25, 4);
    updateZoom();
  }

  function zoomOut() {
    zoom = Math.max((zoom > 0 ? zoom : 0.5) * 0.8, 0.05);
    updateZoom();
  }

  function zoomFit() {
    zoom = 0; // signal fit mode
    updateZoom();
  }

  /* ---- Display result ---- */
  function displayResult(canvas) {
    lastResultCanvas = canvas;

    // Copy result to the visible canvas element
    el.previewCanvas.width = canvas.width;
    el.previewCanvas.height = canvas.height;
    const ctx = el.previewCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    el.previewCanvas.style.display = 'block';

    // Auto-fit on first render or when in fit mode
    if (zoom <= 0 || zoom === 1) {
      zoom = 0;
    }
    updateZoom();
    hide(el.placeholder);
  }

  /* ---- Core render ---- */
  function doRender() {
    if (!srcImg) return;
    show(el.processing);

    // Use rAF + setTimeout(0) to let the "Processing" indicator paint
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          let resultCanvas = null;

          if (mode === 'pixel') {
            resultCanvas = Engine.renderPixelArt(srcImg, {
              pixelSize: parseInt(el.sldPixelSize.value),
              brightness: parseInt(el.sldPxBright.value),
              contrast: parseInt(el.sldPxContrast.value),
              saturation: parseInt(el.sldPxSat.value),
              paletteName: el.selPxPalette.value,
              customColors: customPxColors,
            });
          } else if (mode === 'ascii') {
            const result = Engine.renderAsciiArt(srcImg, {
              cellSize: parseInt(el.sldAsciiCell.value),
              brightness: parseInt(el.sldAsBright.value),
              contrast: parseInt(el.sldAsContrast.value),
              preset: el.selAsciiPreset.value,
              invert: el.chkAsciiInvert.checked,
              bw: el.chkAsciiBW.checked,
              rotate: el.chkAsciiRotate.checked,
              mixedDensity: el.chkAsciiMixed.checked,
            });
            resultCanvas = result.canvas;
            lastAsciiText = result.text;
          } else if (mode === 'dither') {
            resultCanvas = Engine.renderDitherArt(srcImg, {
              algorithm: el.selDitherAlgo.value,
              pointSize: parseInt(el.sldDitherPt.value),
              threshold: parseInt(el.sldDitherTh.value),
              brightness: parseInt(el.sldDtBright.value),
              contrast: parseInt(el.sldDtContrast.value),
              paletteName: el.selDtPalette.value,
              customColors: customDtColors,
            });
          }

          if (resultCanvas) {
            displayResult(resultCanvas);
          }
        } catch (e) {
          console.error('Render error:', e);
        }
        hide(el.processing);
        renderPending = false;
      }, 0);
    });
  }

  function scheduleRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!renderPending) {
        renderPending = true;
        doRender();
      }
    }, 120);
  }

  // Faster schedule for non-heavy controls
  function scheduleRenderFast() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!renderPending) {
        renderPending = true;
        doRender();
      }
    }, 50);
  }

  /* ---- Image upload ---- */
  function loadImage(file) {
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!validTypes.includes(file.type)) {
      alert('Unsupported format. Please upload JPG, PNG, WebP, or AVIF.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => alert('Could not read file. It may be corrupted.');
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => alert('Could not decode image. It may be corrupted.');
      img.onload = () => {
        srcImg = img;
        el.fileName.textContent = file.name;
        el.fileRes.textContent = img.naturalWidth + '\u00d7' + img.naturalHeight;
        el.fileSize.textContent = formatBytes(file.size);
        show(el.fileInfo);
        hide(el.upload);
        show(el.modes);
        show(el.main);
        zoom = 0; // fit
        scheduleRenderFast();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function removeImage() {
    srcImg = null;
    lastResultCanvas = null;
    lastAsciiText = '';
    hide(el.fileInfo);
    show(el.upload);
    hide(el.modes);
    hide(el.main);
    el.previewCanvas.style.display = 'none';
    show(el.placeholder);
    el.fileInput.value = '';
  }

  /* ---- Bind slider with value display ---- */
  function bindSlider(sliderId, displayId, fast) {
    const slider = $(sliderId);
    const display = $(displayId);
    if (!slider || !display) return;
    slider.addEventListener('input', () => {
      display.textContent = slider.value;
      if (fast) { scheduleRenderFast(); } else { scheduleRender(); }
    });
  }

  /* ============================================================
     EVENT BINDING
     ============================================================ */

  /* ---- Upload ---- */
  el.upload.addEventListener('click', (e) => {
    if (e.target === el.fileInput) return;
    el.fileInput.click();
  });
  el.fileInput.addEventListener('click', (e) => e.stopPropagation());
  el.fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) loadImage(e.target.files[0]);
  });
  el.upload.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.upload.classList.add('dragover');
  });
  el.upload.addEventListener('dragleave', () => {
    el.upload.classList.remove('dragover');
  });
  el.upload.addEventListener('drop', (e) => {
    e.preventDefault();
    el.upload.classList.remove('dragover');
    if (e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]);
  });
  el.removeBtn.addEventListener('click', removeImage);

  /* ---- Mode switching ---- */
  document.querySelectorAll('.pxl-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pxl-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mode = btn.dataset.mode;
      toggle(el.ctrlPixel, mode === 'pixel');
      toggle(el.ctrlAscii, mode === 'ascii');
      toggle(el.ctrlDither, mode === 'dither');
      toggle(el.btnTxt, mode === 'ascii');
      zoom = 0; // re-fit on mode switch
      scheduleRenderFast();
    });
  });

  /* ---- Collapsible groups ---- */
  document.querySelectorAll('.pxl-group-header').forEach((h) => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('collapsed'));
  });

  /* ---- Zoom controls ---- */
  el.zoomIn.addEventListener('click', zoomIn);
  el.zoomOut.addEventListener('click', zoomOut);
  el.zoomFit.addEventListener('click', zoomFit);

  /* ---- Pixel Art sliders ---- */
  bindSlider('sldPixelSize', 'valPixelSize', false);
  bindSlider('sldPxBright', 'valPxBright', true);
  bindSlider('sldPxContrast', 'valPxContrast', true);
  bindSlider('sldPxSat', 'valPxSat', true);

  /* ---- ASCII sliders ---- */
  bindSlider('sldAsciiCell', 'valAsciiCell', false);
  bindSlider('sldAsBright', 'valAsBright', true);
  bindSlider('sldAsContrast', 'valAsContrast', true);
  bindSlider('sldAsDetail', 'valAsDetail', true);

  /* ---- ASCII checkboxes ---- */
  [el.chkAsciiInvert, el.chkAsciiBW, el.chkAsciiRotate, el.chkAsciiMixed].forEach(c => {
    if (c) c.addEventListener('change', scheduleRenderFast);
  });
  el.selAsciiPreset.addEventListener('change', scheduleRenderFast);

  /* ---- Dither sliders ---- */
  bindSlider('sldDitherPt', 'valDitherPt', false);
  bindSlider('sldDitherTh', 'valDitherTh', false);
  bindSlider('sldDtBright', 'valDtBright', true);
  bindSlider('sldDtContrast', 'valDtContrast', true);
  bindSlider('sldDtDetail', 'valDtDetail', true);
  el.selDitherAlgo.addEventListener('change', scheduleRender);

  /* ---- Pixel palette ---- */
  el.selPxPalette.addEventListener('change', () => {
    const v = el.selPxPalette.value;
    showPaletteSwatches(el.pxPalettePreview, v);
    toggle(el.pxCustomPalette, v === 'custom');
    scheduleRender();
  });

  /* ---- Dither palette ---- */
  el.selDtPalette.addEventListener('change', () => {
    const v = el.selDtPalette.value;
    showPaletteSwatches(el.dtPalettePreview, v);
    toggle(el.dtCustomPalette, v === 'custom');
    scheduleRender();
  });

  /* ---- Custom color sync ---- */
  el.pxCustomColor.addEventListener('input', () => { el.pxCustomHex.value = el.pxCustomColor.value; });
  el.pxCustomHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(el.pxCustomHex.value)) el.pxCustomColor.value = el.pxCustomHex.value;
  });
  el.dtCustomColor.addEventListener('input', () => { el.dtCustomHex.value = el.dtCustomColor.value; });
  el.dtCustomHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(el.dtCustomHex.value)) el.dtCustomColor.value = el.dtCustomHex.value;
  });

  /* ---- Custom palette: Pixel ---- */
  el.pxAddColor.addEventListener('click', () => {
    const c = el.pxCustomColor.value;
    if (!customPxColors.includes(c)) {
      customPxColors.push(c);
      renderCustomSwatches(el.pxCustomColors, customPxColors, (i) => {
        customPxColors.splice(i, 1);
        renderCustomSwatches(el.pxCustomColors, customPxColors, arguments.callee);
        scheduleRender();
      });
      scheduleRender();
    }
  });
  el.pxClearCustom.addEventListener('click', () => {
    customPxColors = [];
    el.pxCustomColors.innerHTML = '';
    scheduleRender();
  });

  /* ---- Custom palette: Dither ---- */
  el.dtAddColor.addEventListener('click', () => {
    const c = el.dtCustomColor.value;
    if (!customDtColors.includes(c)) {
      customDtColors.push(c);
      renderCustomSwatches(el.dtCustomColors, customDtColors, (i) => {
        customDtColors.splice(i, 1);
        renderCustomSwatches(el.dtCustomColors, customDtColors, arguments.callee);
        scheduleRender();
      });
      scheduleRender();
    }
  });
  el.dtClearCustom.addEventListener('click', () => {
    customDtColors = [];
    el.dtCustomColors.innerHTML = '';
    scheduleRender();
  });

  /* ---- Export ---- */
  el.btnPng.addEventListener('click', () => {
    if (!lastResultCanvas) return;
    const a = document.createElement('a');
    const names = { pixel: 'pixel-art', ascii: 'ascii-art', dither: 'dither-art' };
    a.download = (names[mode] || 'output') + '.png';
    a.href = lastResultCanvas.toDataURL('image/png');
    a.click();
  });

  el.btnTxt.addEventListener('click', () => {
    if (!lastAsciiText) return;
    const blob = new Blob([lastAsciiText], { type: 'text/plain' });
    const a = document.createElement('a');
    a.download = 'ascii-art.txt';
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  });

  /* ---- Init ---- */
  showPaletteSwatches(el.pxPalettePreview, 'none');

})();
