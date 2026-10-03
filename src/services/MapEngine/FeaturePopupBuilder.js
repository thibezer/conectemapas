/* ==========================================================================
   ConecteMapas - FeaturePopupBuilder
   Geração sob demanda de popups informativos (QGIS-like), tooltips
   e ícones vetoriais SVG customizados para marcadores pontuais.
   ========================================================================== */

import { FeatureGeometryUtils } from './FeatureGeometryUtils.js';

export class FeaturePopupBuilder {
  static getMarkerSVG(iconName, color, size = 24, rotation = 0) {
    let glyph = '';
    if (iconName === 'tower') {
      glyph = '<path d="M12 2L6 22h12L12 2zM9 14h6M8 18h8M12 2v20" stroke="#ffffff" stroke-width="1.6" fill="none"/>';
    } else if (iconName === 'tree') {
      glyph = '<path d="M12 2L5 12h4l-3 6h12l-3-6h4L12 2z" fill="#ffffff" fill-opacity="0.95"/><path d="M12 18v4" stroke="#ffffff" stroke-width="2"/>';
    } else if (iconName === 'warning') {
      glyph = '<path d="M12 3L2 20h20L12 3z" stroke="#ffffff" stroke-width="1.8" fill="#ffffff" fill-opacity="0.25"/><path d="M12 9v5M12 17h.01" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>';
    } else if (iconName === 'water') {
      glyph = '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill="#ffffff" fill-opacity="0.9"/>';
    } else if (iconName === 'boundary') {
      glyph = '<rect x="5" y="5" width="14" height="14" rx="2" stroke="#ffffff" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="3" fill="#ffffff"/>';
    } else {
      glyph = `<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ffffff" fill-opacity="0.95"/><circle cx="12" cy="9" r="2.5" fill="${color}"/>`;
    }

    return `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 2px solid #ffffff;
        border-radius: 50%;
        transform: rotate(${rotation}deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 12px ${color}99, 0 3px 8px rgba(0,0,0,0.6);
        cursor: pointer;
      ">
        <svg viewBox="0 0 24 24" style="width: ${Math.round(size * 0.65)}px; height: ${Math.round(size * 0.65)}px;" fill="none">
          ${glyph}
        </svg>
      </div>
    `;
  }

  /**
   * Popup informativo (estilo "Identificar" do QGIS): título, tipo e camada, métricas
   * geométricas, atributos do usuário, autoria e ações rápidas.
   * @param {Object} feat
   * @param {Object|null} layer configuração da camada (nome/cor)
   */
  static createFeaturePopupHtml(feat, layer = null) {
    const esc = (v) => FeatureGeometryUtils.escapeHtml(v);
    const coords = FeatureGeometryUtils.normalizeCoordinates(feat);
    const metrics = this._buildMetrics(feat, coords);
    const attributes = this._userAttributes(feat);

    const rawColor = feat.color || feat.style?.fillColor || layer?.color || '#00E08A';
    const color = /^#[0-9a-fA-F]{3,8}$/.test(rawColor) ? rawColor : '#00E08A';
    const typeLabel = FeatureGeometryUtils.getTypeLabel(feat.type);
    const subtitle = [typeLabel, layer?.name].filter(Boolean).map(esc).join(' · ');
    const category = feat.category && feat.category !== feat.type ? esc(feat.category) : '';

    const MAX_ATTRS = 6;
    const attrRows = attributes.slice(0, MAX_ATTRS).map(([key, value]) => `
      <div class="cm-popup-attr">
        <span class="cm-popup-attr-key" title="${esc(key)}">${esc(key)}</span>
        <span class="cm-popup-attr-value" title="${esc(value)}">${esc(value)}</span>
      </div>`).join('');
    const extraAttrs = attributes.length > MAX_ATTRS
      ? `<button type="button" class="cm-popup-more" data-popup-action="inspect">+${attributes.length - MAX_ATTRS} atributo(s)</button>`
      : '';

    const author = feat.createdBy || 'Sistema';
    const created = this._formatDate(feat.createdAt);
    const meta = [`Por <strong>${esc(author)}</strong>`, created ? esc(created) : ''].filter(Boolean).join(' · ');

    const isPoint = feat.type === 'Point' || feat.type === 'Text';
    const canEditVertices = feat.type === 'Polygon' || feat.type === 'LineString';

    return `
      <div class="cm-popup-card" style="--cm-popup-accent: ${color};">
        <div class="cm-popup-header">
          <span class="cm-popup-swatch" aria-hidden="true"></span>
          <div class="cm-popup-heading">
            <div class="cm-popup-title" title="${esc(feat.name || 'Sem nome')}">${esc(feat.name || 'Sem nome')}</div>
            <div class="cm-popup-subtitle">${subtitle}${category ? ` · <span class="cm-popup-category">${category}</span>` : ''}</div>
          </div>
        </div>
        ${feat.description ? `<div class="cm-popup-desc">${esc(feat.description)}</div>` : ''}
        ${metrics.length ? `
        <div class="cm-popup-metrics">
          ${metrics.map(m => `
            <div class="cm-popup-metric${m.wide ? ' wide' : ''}">
              <span class="cm-popup-metric-label">${esc(m.label)}</span>
              <span class="cm-popup-metric-value">${esc(m.value)}${m.unit ? ` <small>${esc(m.unit)}</small>` : ''}</span>
            </div>`).join('')}
        </div>` : ''}
        ${attrRows ? `<div class="cm-popup-attrs">${attrRows}${extraAttrs}</div>` : ''}
        <div class="cm-popup-meta">${meta}</div>
        <div class="cm-popup-actions">
          <button type="button" class="cm-popup-btn primary" data-popup-action="inspect" title="Abrir no painel de propriedades">Inspecionar</button>
          <button type="button" class="cm-popup-btn" data-popup-action="zoom" title="Enquadrar a feição">Zoom</button>
          ${canEditVertices ? '<button type="button" class="cm-popup-btn" data-popup-action="edit-vertex" title="Editar vértices no mapa">Vértices</button>' : ''}
          ${isPoint ? '<button type="button" class="cm-popup-btn" data-popup-action="copy-coords" title="Copiar latitude, longitude">Copiar coord.</button>' : ''}
        </div>
      </div>
    `;
  }

  static _buildMetrics(feat, coords) {
    const nf = (n, digits) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    const length = (m) => (m >= 1000 ? { value: nf(m / 1000, 2), unit: 'km' } : { value: nf(m, 1), unit: 'm' });
    const metrics = [];

    try {
      if (feat.type === 'Polygon') {
        const area = FeatureGeometryUtils.calculatePolygonArea(coords);
        const perim = FeatureGeometryUtils.calculatePolygonPerimeter(coords);
        metrics.push({ label: 'Área', value: nf(area / 10000, 4), unit: 'ha' });
        metrics.push({ label: 'Área', value: nf(area, 0), unit: 'm²' });
        metrics.push({ label: 'Perímetro', ...length(perim) });
        metrics.push({ label: 'Vértices', value: String(this._countVertices(coords)) });
      } else if (feat.type === 'LineString') {
        metrics.push({ label: 'Extensão', ...length(FeatureGeometryUtils.calculatePolylineLength(coords)) });
        metrics.push({ label: 'Vértices', value: String(this._countVertices(coords)) });
      } else if (feat.type === 'Circle') {
        const r = Number(feat.radius) || 0;
        metrics.push({ label: 'Raio', ...length(r) });
        metrics.push({ label: 'Área', value: nf((Math.PI * r * r) / 10000, 4), unit: 'ha' });
      } else if ((feat.type === 'Point' || feat.type === 'Text') && Array.isArray(coords)) {
        metrics.push({ label: 'Latitude', value: Number(coords[0]).toFixed(6) });
        metrics.push({ label: 'Longitude', value: Number(coords[1]).toFixed(6) });
        if (feat.type === 'Text') {
          metrics.push({ label: 'Texto', value: feat.properties?.text || feat.name || '', wide: true });
        }
      }
    } catch {
      // Geometria malformada não deve impedir a abertura do popup
    }
    return metrics;
  }

  static _countVertices(coords) {
    if (!Array.isArray(coords)) return 0;
    if (!Array.isArray(coords[0])) return 1;
    if (!Array.isArray(coords[0][0])) return coords.length;
    return coords.reduce((sum, c) => sum + this._countVertices(c), 0);
  }

  // Atributos preenchidos pelo usuário (exclui métricas calculadas e campos internos)
  static _userAttributes(feat) {
    const hidden = new Set([
      'Área (ha)', 'Área (m²)', 'Perímetro', 'Extensão', 'Raio', 'Área Coberta',
      'radius', 'raio', 'visible', 'text'
    ]);
    const props = feat.properties && typeof feat.properties === 'object' ? feat.properties : {};
    return Object.entries(props)
      .filter(([key, value]) => !hidden.has(key) && !key.startsWith('_') && value !== null && value !== undefined && value !== '' && typeof value !== 'object')
      .map(([key, value]) => [key, String(value)]);
  }

  static _formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  static updatePopupAndTooltip(leafLayer, feat, rawCoords, style) {
    // O popup não é mais vinculado a cada camada Leaflet: o MapEngine abre um popup único
    // sob demanda no clique (hit-test), evitando milhares de popups e cliques perdidos.
    if (leafLayer.getPopup && leafLayer.getPopup()) {
      leafLayer.unbindPopup();
    }

    if (style.showLabel) {
      let labelText = feat.name || 'Feição';
      if (style.labelField === 'category') {
        labelText = feat.category || feat.type;
      } else if (style.labelField === 'area' && feat.type === 'Polygon') {
        const a = FeatureGeometryUtils.calculatePolygonArea(rawCoords);
        labelText = `${(a / 10000).toFixed(2)} ha`;
      } else if (style.labelField === 'extensao' && feat.type === 'LineString') {
        const l = FeatureGeometryUtils.calculatePolylineLength(rawCoords);
        labelText = l > 1000 ? `${(l / 1000).toFixed(2)} km` : `${l.toFixed(0)} m`;
      }

      const tooltipContent = `<span class="cm-map-feature-label">${FeatureGeometryUtils.escapeHtml(labelText)}</span>`;
      if (leafLayer.getTooltip()) {
        leafLayer.setTooltipContent(tooltipContent);
      } else {
        leafLayer.bindTooltip(tooltipContent, { permanent: true, direction: 'center', className: 'cm-map-label-tooltip', interactive: false });
      }
    } else if (leafLayer.getTooltip()) {
      leafLayer.unbindTooltip();
    }
  }
}
