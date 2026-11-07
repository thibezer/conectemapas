/* ==========================================================================
   ConecteMapas - PrintVectorLayer
   Responsabilidade Única: camada Leaflet da prévia da prancha. Um canvas sobre os
   tiles redesenhado pelo PrintMapRenderer (o mesmo da exportação) a cada movimento.
   O mapa da prancha usa zoomAnimation: false, então não há quadro intermediário.
   ========================================================================== */

import L from 'leaflet';
import { PrintMapRenderer } from './PrintMapRenderer.js';
import { BLEND_MODES } from './PrintViewResolver.js';

export const PrintVectorLayer = L.Layer.extend({
  /**
   * @param {() => ({ features, layers, resolveCtx, pxPerMm }) | null} getState
   * @param {() => number} getResolution  pixels de tela por px CSS (zoom da prancheta × devicePixelRatio)
   */
  initialize(getState, getResolution) {
    this._getState = getState;
    this._getResolution = getResolution || (() => 1);
    this._frame = null;
  },

  onAdd(map) {
    this._canvases = [];
    this._schedule = () => {
      if (this._frame) return;
      this._frame = requestAnimationFrame(() => {
        this._frame = null;
        this.redraw();
      });
    };
    map.on('move zoom resize viewreset', this._schedule);
    this.redraw();
  },

  onRemove(map) {
    map.off('move zoom resize viewreset', this._schedule);
    if (this._frame) cancelAnimationFrame(this._frame);
    this._frame = null;
    (this._canvases || []).forEach(c => c.remove());
    this._canvases = [];
  },

  /** Garante `n` canvases empilhados na ordem de desenho (um por trecho de mesclagem) */
  _ensureCanvases(n) {
    while (this._canvases.length < n) {
      this._canvases.push(L.DomUtil.create('canvas', 'cm-print-vector-canvas', this._map.getContainer()));
    }
    while (this._canvases.length > n) this._canvases.pop().remove();
  },

  redraw() {
    const map = this._map;
    if (!map || !this._canvases) return;
    const size = map.getSize();
    // Nitidez acompanha o zoom da prancheta, com teto para não estourar memória
    const maxSide = 4096;
    const res = Math.max(1, Math.min(this._getResolution(), maxSide / Math.max(1, size.x, size.y)));
    const w = Math.max(1, Math.round(size.x * res));
    const h = Math.max(1, Math.round(size.y * res));

    const state = this._getState();
    const b = map.getBounds();
    // Na prévia a mesclagem é do elemento canvas (mix-blend-mode), não do contexto
    const opts = state && {
      ...state,
      applyBlend: false,
      project: (ll) => map.latLngToContainerPoint(ll),
      bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }
    };
    const runs = opts ? PrintMapRenderer.plan(opts).runs : [];
    // Rótulos vão por cima de tudo, sem mesclagem: no último trecho se ele é normal, senão num canvas à parte
    const labelsOnLast = runs.length > 0 && runs[runs.length - 1].blend === 'normal';
    const count = Math.max(1, runs.length + (labelsOnLast || !runs.length ? 0 : 1));
    this._ensureCanvases(count);

    const ctxs = this._canvases.map((canvas, i) => {
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      const run = runs[i];
      canvas.style.mixBlendMode = run ? BLEND_MODES[run.blend].css : 'normal';
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.setTransform(res, 0, 0, res, 0, 0);
      return ctx;
    });
    if (!opts) return;

    const labels = [];
    runs.forEach((run, i) => labels.push(...PrintMapRenderer.drawRun(ctxs[i], run, opts)));
    const labelCtx = ctxs[labelsOnLast ? runs.length - 1 : ctxs.length - 1];
    labels.forEach(l => PrintMapRenderer.drawLabel(labelCtx, l, opts.pxPerMm));
  }
});
