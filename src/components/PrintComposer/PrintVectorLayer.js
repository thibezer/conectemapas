/* ==========================================================================
   ConecteMapas - PrintVectorLayer
   Responsabilidade Única: camada Leaflet da prévia da prancha. Um canvas sobre os
   tiles redesenhado pelo PrintMapRenderer (o mesmo da exportação) a cada movimento.
   O mapa da prancha usa zoomAnimation: false, então não há quadro intermediário.
   ========================================================================== */

import L from 'leaflet';
import { PrintMapRenderer } from './PrintMapRenderer.js';

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
    this._canvas = L.DomUtil.create('canvas', 'cm-print-vector-canvas', map.getContainer());
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
    this._canvas?.remove();
    this._canvas = null;
  },

  redraw() {
    const map = this._map;
    const canvas = this._canvas;
    if (!map || !canvas) return;
    const size = map.getSize();
    // Nitidez acompanha o zoom da prancheta, com teto para não estourar memória
    const maxSide = 4096;
    const res = Math.max(1, Math.min(this._getResolution(), maxSide / Math.max(1, size.x, size.y)));
    const w = Math.max(1, Math.round(size.x * res));
    const h = Math.max(1, Math.round(size.y * res));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const state = this._getState();
    if (!state) return;
    ctx.setTransform(res, 0, 0, res, 0, 0);

    const b = map.getBounds();
    PrintMapRenderer.draw(ctx, {
      ...state,
      project: (ll) => map.latLngToContainerPoint(ll),
      bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }
    });
  }
});
