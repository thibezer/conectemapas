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

  static createFeaturePopupHtml(feat) {
    let dimensionInfo = '';
    if (feat.type === 'LineString') {
      const len = FeatureGeometryUtils.calculatePolylineLength(feat.coordinates);
      dimensionInfo = `<div>Extensão: <strong>${len > 1000 ? (len / 1000).toFixed(2) + ' km' : len.toFixed(1) + ' m'}</strong></div>`;
    } else if (feat.type === 'Polygon') {
      const area = FeatureGeometryUtils.calculatePolygonArea(feat.coordinates);
      const ha = (area / 10000).toFixed(2);
      dimensionInfo = `<div>Área: <strong>${ha} ha</strong> (${area.toFixed(0)} m²)</div>`;
    } else if (feat.type === 'Circle') {
      dimensionInfo = `<div>Raio: <strong>${feat.radius} m</strong></div>`;
    } else if (feat.type === 'Point') {
      dimensionInfo = `<div>Coordenadas: <strong>${feat.coordinates[0].toFixed(5)}, ${feat.coordinates[1].toFixed(5)}</strong></div>`;
    } else if (feat.type === 'Text') {
      dimensionInfo = `<div>Rótulo: <strong>${FeatureGeometryUtils.escapeHtml(feat.properties?.text || feat.name)}</strong></div>`;
    }

    const safeName = FeatureGeometryUtils.escapeHtml(feat.name || 'Sem nome');
    const safeCategory = FeatureGeometryUtils.escapeHtml(feat.category || feat.type || 'Geral');
    const safeDesc = feat.description ? FeatureGeometryUtils.escapeHtml(feat.description) : '';
    const safeAuthor = FeatureGeometryUtils.escapeHtml(feat.createdBy || 'Sistema');
    const safeColor = FeatureGeometryUtils.escapeHtml(feat.color || '#00E08A');

    return `
      <div class="cm-popup-card">
        <div class="cm-popup-header">
          <span class="cm-popup-title">${safeName}</span>
          <span style="font-size: 10px; background: ${safeColor}22; color: ${safeColor}; padding: 2px 6px; border-radius: 4px; font-weight: 600;">
            ${safeCategory}
          </span>
        </div>
        ${safeDesc ? `<div class="cm-popup-desc">${safeDesc}</div>` : ''}
        <div class="cm-popup-stats">
          ${dimensionInfo}
          <div>Autor: <strong>${safeAuthor}</strong></div>
        </div>
      </div>
    `;
  }

  static updatePopupAndTooltip(leafLayer, feat, rawCoords, style) {
    const getPopupContent = () => this.createFeaturePopupHtml({ ...feat, coordinates: rawCoords });
    if (leafLayer.getPopup()) {
      leafLayer.setPopupContent(getPopupContent);
    } else {
      leafLayer.bindPopup(getPopupContent, { maxWidth: 280 });
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
