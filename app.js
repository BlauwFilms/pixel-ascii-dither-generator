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
  let lastAsciiText = '';
  let lastResultCanvas = null;
  let customPxColors = [];
  let customDtColors = [];
  let renderPending = false;
  let debounceTimer = null;

  /* ---- Pan / Zoom state ---- */
  let zoom = 1;
  let fitScale = 1;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPanX = 0;
  let dragStartPanY = 0;
  let needsFit = true;

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
    previewInner: $('pxlPreviewInner'),
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

  function show(elem) { if (elem) elem.classList.remove('pxl-hidden'); }
  function hide(elem) { if (elem) elem.classList.add('pxl-hidden'); }
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

  /* ============================================================
     PAN / ZOOM
     Uses CSS transform on the canvas. Preview container clips.
     ============================================================ */

  function computeFitScale() {
    if (!lastResultCanvas) return 1;
    const wrapRect = el.previewWrap.getBoundingClientRect();
    const wW = wrapRect.width;
    const wH = wrapRect.height;
    const cW = lastResultCanvas.width;
    const cH = lastResultCanvas.height;
    if (cW === 0 || cH === 0) return 1;
    var pad = 16;
    var scX = (wW - pad) / cW;
    var scY = (wH - pad) / cH;
    return Math.min(scX, scY);
  }

  function centerCanvas() {
    if (!lastResultCanvas) return;
    var wrapRect = el.previewWrap.getBoundingClientRect();
    var wW = wrapRect.width;
    var wH = wrapRect.height;
    var cW = lastResultCanvas.width * zoom;
    var cH = lastResultCanvas.height * zoom;
    panX = (wW - cW) / 2;
    panY = (wH - cH) / 2;
  }

  function applyTransform() {
    el.previewCanvas.style.transform =
      'translate(' + panX + 'px, ' + panY + 'px) scale(' + zoom + ')';
    el.zoomLabel.textContent = Math.round(zoom * 100) + '%';
  }

  function doFit() {
    fitScale = computeFitScale();
    zoom = fitScale;
    centerCanvas();
    applyTransform();
  }

  function zoomAroundPoint(cx, cy, factor) {
    var oldZoom = zoom;
    zoom = Math.max(0.02, Math.min(10, zoom * factor));
    panX = cx - (cx - panX) * (zoom / oldZoom);
    panY = cy - (cy - panY) * (zoom / oldZoom);
    applyTransform();
  }

  function doZoomIn() {
    var r = el.previewWrap.getBoundingClientRect();
    zoomAroundPoint(r.width / 2, r.height / 2, 1.25);
  }

  function doZoomOut() {
    var r = el.previewWrap.getBoundingClientRect();
    zoomAroundPoint(r.width / 2, r.height / 2, 0.8);
  }

  /* ---- Mouse drag ---- */
  el.previewWrap.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartPanX = panX;
    dragStartPanY = panY;
    el.previewWrap.classList.add('is-dragging');
    e.preventDefault();
  });

  window.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    panX = dragStartPanX + (e.clientX - dragStartX);
    panY = dragStartPanY + (e.clientY - dragStartY);
    applyTransform();
  });

  window.addEventListener('mouseup', function () {
    if (isDragging) {
      isDragging = false;
      el.previewWrap.classList.remove('is-dragging');
    }
  });

  /* ---- Touch drag ---- */
  el.previewWrap.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) {
      isDragging = true;
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      dragStartPanX = panX;
      dragStartPanY = panY;
    }
  }, { passive: true });

  window.addEventListener('touchmove', function (e) {
    if (!isDragging || e.touches.length !== 1) return;
    panX = dragStartPanX + (e.touches[0].clientX - dragStartX);
    panY = dragStartPanY + (e.touches[0].clientY - dragStartY);
    applyTransform();
  }, { passive: true });

  window.addEventListener('touchend', function () { isDragging = false; });

  /* ---- Wheel zoom ---- */
  el.previewWrap.addEventListener('wheel', function (e) {
    e.preventDefault();
    var rect = el.previewWrap.getBoundingClientRect();
    var cx = e.clientX - rect.left;
    var cy = e.clientY - rect.top;
    var factor = e.deltaY < 0 ? 1.1 : 0.9;
    zoomAroundPoint(cx, cy, factor);
  }, { passive: false });

  /* ---- Display result ---- */
  function displayResult(canvas) {
    lastResultCanvas = canvas;

    el.previewCanvas.width = canvas.width;
    el.previewCanvas.height = canvas.height;
    var ctx = el.previewCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    el.previewCanvas.style.display = 'block';
    // Clear any manual width/height — transform handles display sizing
    el.previewCanvas.style.width = '';
    el.previewCanvas.style.height = '';

    if (needsFit) {
      needsFit = false;
      doFit();
    } else {
      // Keep current zoom/pan, just re-apply transform
      applyTransform();
    }

    hide(el.placeholder);
  }

  /* ---- Core render ---- */
  function doRender() {
    if (!srcImg) return;
    show(el.processing);

    requestAnimationFrame(function () {
      setTimeout(function () {
        try {
          var resultCanvas = null;

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
            var result = Engine.renderAsciiArt(srcImg, {
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
    debounceTimer = setTimeout(function () {
      if (!renderPending) { renderPending = true; doRender(); }
    }, 120);
  }

  function scheduleRenderFast() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      if (!renderPending) { renderPending = true; doRender(); }
    }, 50);
  }

  /* ---- Image upload ---- */
  function loadImage(file) {
    if (!file) return;
    var validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (validTypes.indexOf(file.type) === -1) {
      alert('Unsupported format. Please upload JPG, PNG, WebP, or AVIF.');
      return;
    }
    var reader = new FileReader();
    reader.onerror = function () { alert('Could not read file. It may be corrupted.'); };
    reader.onload = function (e) {
      var img = new Image();
      img.onerror = function () { alert('Could not decode image. It may be corrupted.'); };
      img.onload = function () {
        srcImg = img;
        el.fileName.textContent = file.name;
        el.fileRes.textContent = img.naturalWidth + '\u00d7' + img.naturalHeight;
        el.fileSize.textContent = formatBytes(file.size);
        show(el.fileInfo);
        hide(el.upload);
        show(el.modes);
        show(el.main);
        needsFit = true;
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
    needsFit = true;
  }

  /* ---- Bind slider ---- */
  function bindSlider(sliderId, displayId, fast) {
    var slider = $(sliderId);
    var display = $(displayId);
    if (!slider || !display) return;
    slider.addEventListener('input', function () {
      display.textContent = slider.value;
      if (fast) { scheduleRenderFast(); } else { scheduleRender(); }
    });
  }

  /* ============================================================
     EVENT BINDING
     ============================================================ */

  /* Upload */
  el.upload.addEventListener('click', function (e) {
    if (e.target === el.fileInput) return;
    el.fileInput.click();
  });
  el.fileInput.addEventListener('click', function (e) { e.stopPropagation(); });
  el.fileInput.addEventListener('change', function (e) {
    if (e.target.files[0]) loadImage(e.target.files[0]);
  });
  el.upload.addEventListener('dragover', function (e) {
    e.preventDefault();
    el.upload.classList.add('dragover');
  });
  el.upload.addEventListener('dragleave', function () {
    el.upload.classList.remove('dragover');
  });
  el.upload.addEventListener('drop', function (e) {
    e.preventDefault();
    el.upload.classList.remove('dragover');
    if (e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]);
  });
  el.removeBtn.addEventListener('click', removeImage);

  /* Mode switching — preserves zoom/pan */
  document.querySelectorAll('.pxl-mode-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.pxl-mode-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      mode = btn.dataset.mode;
      toggle(el.ctrlPixel, mode === 'pixel');
      toggle(el.ctrlAscii, mode === 'ascii');
      toggle(el.ctrlDither, mode === 'dither');
      toggle(el.btnTxt, mode === 'ascii');
      scheduleRenderFast();
    });
  });

  /* Collapsible groups */
  document.querySelectorAll('.pxl-group-header').forEach(function (h) {
    h.addEventListener('click', function () { h.parentElement.classList.toggle('collapsed'); });
  });

  /* Zoom controls */
  el.zoomIn.addEventListener('click', doZoomIn);
  el.zoomOut.addEventListener('click', doZoomOut);
  el.zoomFit.addEventListener('click', function () { doFit(); });

  /* Pixel sliders */
  bindSlider('sldPixelSize', 'valPixelSize', false);
  bindSlider('sldPxBright', 'valPxBright', true);
  bindSlider('sldPxContrast', 'valPxContrast', true);
  bindSlider('sldPxSat', 'valPxSat', true);

  /* ASCII sliders */
  bindSlider('sldAsciiCell', 'valAsciiCell', false);
  bindSlider('sldAsBright', 'valAsBright', true);
  bindSlider('sldAsContrast', 'valAsContrast', true);
  bindSlider('sldAsDetail', 'valAsDetail', true);

  /* ASCII checkboxes */
  [el.chkAsciiInvert, el.chkAsciiBW, el.chkAsciiRotate, el.chkAsciiMixed].forEach(function (c) {
    if (c) c.addEventListener('change', scheduleRenderFast);
  });
  el.selAsciiPreset.addEventListener('change', scheduleRenderFast);

  /* Dither sliders */
  bindSlider('sldDitherPt', 'valDitherPt', false);
  bindSlider('sldDitherTh', 'valDitherTh', false);
  bindSlider('sldDtBright', 'valDtBright', true);
  bindSlider('sldDtContrast', 'valDtContrast', true);
  bindSlider('sldDtDetail', 'valDtDetail', true);
  el.selDitherAlgo.addEventListener('change', scheduleRender);

  /* Pixel palette */
  el.selPxPalette.addEventListener('change', function () {
    var v = el.selPxPalette.value;
    showPaletteSwatches(el.pxPalettePreview, v);
    toggle(el.pxCustomPalette, v === 'custom');
    scheduleRender();
  });

  /* Dither palette */
  el.selDtPalette.addEventListener('change', function () {
    var v = el.selDtPalette.value;
    showPaletteSwatches(el.dtPalettePreview, v);
    toggle(el.dtCustomPalette, v === 'custom');
    scheduleRender();
  });

  /* Custom color sync */
  el.pxCustomColor.addEventListener('input', function () { el.pxCustomHex.value = el.pxCustomColor.value; });
  el.pxCustomHex.addEventListener('input', function () {
    if (/^#[0-9a-f]{6}$/i.test(el.pxCustomHex.value)) el.pxCustomColor.value = el.pxCustomHex.value;
  });
  el.dtCustomColor.addEventListener('input', function () { el.dtCustomHex.value = el.dtCustomColor.value; });
  el.dtCustomHex.addEventListener('input', function () {
    if (/^#[0-9a-f]{6}$/i.test(el.dtCustomHex.value)) el.dtCustomColor.value = el.dtCustomHex.value;
  });

  /* Custom palette: Pixel */
  function refreshPxSwatches() {
    renderCustomSwatches(el.pxCustomColors, customPxColors, function (i) {
      customPxColors.splice(i, 1);
      refreshPxSwatches();
      scheduleRender();
    });
  }
  el.pxAddColor.addEventListener('click', function () {
    var c = el.pxCustomColor.value;
    if (customPxColors.indexOf(c) === -1) {
      customPxColors.push(c);
      refreshPxSwatches();
      scheduleRender();
    }
  });
  el.pxClearCustom.addEventListener('click', function () {
    customPxColors = [];
    el.pxCustomColors.innerHTML = '';
    scheduleRender();
  });

  /* Custom palette: Dither */
  function refreshDtSwatches() {
    renderCustomSwatches(el.dtCustomColors, customDtColors, function (i) {
      customDtColors.splice(i, 1);
      refreshDtSwatches();
      scheduleRender();
    });
  }
  el.dtAddColor.addEventListener('click', function () {
    var c = el.dtCustomColor.value;
    if (customDtColors.indexOf(c) === -1) {
      customDtColors.push(c);
      refreshDtSwatches();
      scheduleRender();
    }
  });
  el.dtClearCustom.addEventListener('click', function () {
    customDtColors = [];
    el.dtCustomColors.innerHTML = '';
    scheduleRender();
  });

  /* Export */
  el.btnPng.addEventListener('click', function () {
    if (!lastResultCanvas) return;
    var a = document.createElement('a');
    var names = { pixel: 'pixel-art', ascii: 'ascii-art', dither: 'dither-art' };
    a.download = (names[mode] || 'output') + '.png';
    a.href = lastResultCanvas.toDataURL('image/png');
    a.click();
  });

  el.btnTxt.addEventListener('click', function () {
    if (!lastAsciiText) return;
    var blob = new Blob([lastAsciiText], { type: 'text/plain' });
    var a = document.createElement('a');
    a.download = 'ascii-art.txt';
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  });

  /* Window resize: re-fit if currently at fit scale */
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (lastResultCanvas && Math.abs(zoom - fitScale) < 0.01) {
        doFit();
      }
    }, 200);
  });

  /* Init */
  showPaletteSwatches(el.pxPalettePreview, 'none');

})();
