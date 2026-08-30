/* ==========================================================================
   ConecteMapas - PrintItemsManager
   Responsabilidade Única: Gerenciamento, modelos vetoriais, conversão geodésica
   de escala/coordenadas e renderização dos elementos cartográficos.
   ========================================================================== */

export class PrintItemsManager {
  static formatDMS(val, isLat) {
    if (typeof val !== 'number' || isNaN(val)) return isLat ? `15°47'00"S` : `47°52'00"W`;
    const abs = Math.abs(val);
    const deg = Math.floor(abs);
    const min = Math.floor((abs - deg) * 60);
    const sec = Math.round(((abs - deg) * 60 - min) * 60);
    const hemi = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    return `${deg}°${String(min).padStart(2, '0')}'${String(sec).padStart(2, '0')}"${hemi}`;
  }

  static calculateScale(zoom, lat = -15.78) {
    const cosLat = Math.cos((lat * Math.PI) / 180);
    return Math.round((591657550.5 * cosLat) / Math.pow(2, zoom));
  }

  static calculateZoom(scale, lat = -15.78) {
    const cosLat = Math.cos((lat * Math.PI) / 180);
    return Math.log2((591657550.5 * cosLat) / Math.max(100, scale));
  }

  static getNorthArrowSVG(style = 'classic', rotation = 0) {
    if (style === 'compass') {
      return `
        <svg viewBox="0 0 100 100" width="100%" height="100%" style="transform: rotate(${rotation}deg); transition: transform 0.1s ease;">
          <circle cx="50" cy="50" r="46" fill="none" stroke="#000" stroke-width="2"/>
          <circle cx="50" cy="50" r="40" fill="none" stroke="#000" stroke-width="0.75" stroke-dasharray="2 2"/>
          <polygon points="50,10 58,45 50,40" fill="#000"/>
          <polygon points="50,10 42,45 50,40" fill="#fff" stroke="#000" stroke-width="0.75"/>
          <polygon points="50,90 58,55 50,60" fill="#fff" stroke="#000" stroke-width="0.75"/>
          <polygon points="50,90 42,55 50,60" fill="#000"/>
          <polygon points="90,50 55,58 60,50" fill="#fff" stroke="#000" stroke-width="0.75"/>
          <polygon points="90,50 55,42 60,50" fill="#000"/>
          <polygon points="10,50 45,58 40,50" fill="#000"/>
          <polygon points="10,50 45,42 40,50" fill="#fff" stroke="#000" stroke-width="0.75"/>
          <text x="50" y="8" font-family="Arial, sans-serif" font-size="10" font-weight="bold" text-anchor="middle" fill="#000">N</text>
        </svg>
      `;
    } else if (style === 'modern') {
      return `
        <svg viewBox="0 0 100 100" width="100%" height="100%" style="transform: rotate(${rotation}deg); transition: transform 0.1s ease;">
          <polygon points="50,6 64,88 50,72" fill="#000"/>
          <polygon points="50,6 36,88 50,72" fill="#777"/>
          <text x="50" y="24" font-family="Arial, sans-serif" font-size="14" font-weight="900" text-anchor="middle" fill="#fff">N</text>
        </svg>
      `;
    }
    return `
      <svg viewBox="0 0 100 100" width="100%" height="100%" style="transform: rotate(${rotation}deg); transition: transform 0.1s ease;">
        <polygon points="50,8 60,50 50,44" fill="#000"/>
        <polygon points="50,8 40,50 50,44" fill="#fff" stroke="#000" stroke-width="1"/>
        <polygon points="50,92 60,50 50,56" fill="#fff" stroke="#000" stroke-width="1"/>
        <polygon points="50,92 40,50 50,56" fill="#000"/>
        <text x="50" y="22" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#000">N</text>
      </svg>
    `;
  }

  static escapeHtml(str) {
    if (typeof str !== 'string') return str == null ? '' : String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  static renderTitleBlock(item, projectName = 'Levantamento Cartográfico') {
    const props = item.properties || {};
    const esc = this.escapeHtml.bind(this);
    return `
      <div class="cm-item-title-block">
        <div class="cm-title-block-header">${esc(props.headerTitle || 'PLANTA TOPOGRÁFICA / CARTOGRÁFICA')}</div>
        <div class="cm-title-block-grid">
          <div class="cm-title-block-cell full-width">
            <span class="cm-cell-label">Projeto</span>
            <span class="cm-cell-val">${esc(props.projectName || projectName)}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Responsável Técnico</span>
            <span class="cm-cell-val">${esc(props.author || 'Eng. Cartógrafo / Topógrafo')}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">ART / CREA</span>
            <span class="cm-cell-val">${esc(props.art || 'CREA-BR 2026/0012')}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Sistema Geodésico</span>
            <span class="cm-cell-val">${esc(props.datum || 'SIRGAS 2000 / UTM')}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Escala</span>
            <span class="cm-cell-val">${esc(props.scaleText || '1:10.000')}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Localização</span>
            <span class="cm-cell-val">${esc(props.location || 'Distrito Federal - Brasil')}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Data</span>
            <span class="cm-cell-val">${esc(props.date || new Date().toLocaleDateString('pt-BR'))}</span>
          </div>
        </div>
      </div>
    `;
  }

  static renderScaleBar(item, mapScale = 10000) {
    const widthMm = item.width || 60;
    const groundDistanceMeters = (widthMm / 1000) * mapScale;
    let labelEnd = '';
    let labelMid = '';

    if (groundDistanceMeters >= 1000) {
      const km = (groundDistanceMeters / 1000).toFixed(1);
      const halfKm = (groundDistanceMeters / 2000).toFixed(1);
      labelEnd = `${km} km`;
      labelMid = `${halfKm} km`;
    } else {
      const m = Math.round(groundDistanceMeters);
      const halfM = Math.round(groundDistanceMeters / 2);
      labelEnd = `${m} m`;
      labelMid = `${halfM} m`;
    }

    return `
      <div class="cm-item-scale-bar">
        <div style="font-size: 7.5px; font-weight: bold;">Escala 1:${mapScale.toLocaleString('pt-BR')}</div>
        <div class="cm-scale-bar-ruler">
          <div class="cm-scale-bar-seg"></div>
          <div class="cm-scale-bar-seg"></div>
          <div class="cm-scale-bar-seg"></div>
          <div class="cm-scale-bar-seg"></div>
        </div>
        <div class="cm-scale-bar-labels">
          <span>0</span>
          <span>${labelMid}</span>
          <span>${labelEnd}</span>
        </div>
      </div>
    `;
  }

  static renderLegend(item, layers = []) {
    const esc = this.escapeHtml.bind(this);
    return `
      <div class="cm-item-legend">
        <div class="cm-legend-title">LEGENDA CONVENCIONAL</div>
        ${layers.filter(l => l.visible !== false).map(l => `
          <div class="cm-legend-row">
            <div class="cm-legend-swatch" style="background: ${l.color || '#00E08A'};"></div>
            <span>${esc(l.name)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  static renderMapGridBorder(mapBounds) {
    if (!mapBounds) return `<div class="cm-item-grid-border"></div>`;
    const n = this.formatDMS(mapBounds.north, true);
    const s = this.formatDMS(mapBounds.south, true);
    const w = this.formatDMS(mapBounds.west, false);
    const e = this.formatDMS(mapBounds.east, false);

    return `
      <div class="cm-item-grid-border">
        <span class="cm-grid-label-n">${n}</span>
        <span class="cm-grid-label-s">${s}</span>
        <span class="cm-grid-label-w">${w}</span>
        <span class="cm-grid-label-e">${e}</span>
      </div>
    `;
  }

  static createDefaultItems(projectName = 'Projeto') {
    return [
      {
        id: 'item-map-main',
        type: 'map',
        name: 'Mapa Principal',
        x: 10,
        y: 10,
        width: 190,
        height: 190,
        locked: false,
        visible: true,
        scale: 10000,
        rotation: 0,
        showGrid: true,
        gridInterval: 0.02,
        isOverview: false
      },
      {
        id: 'item-map-inset',
        type: 'inset_map',
        name: 'Mapa de Localização (Inset)',
        x: 205,
        y: 10,
        width: 82,
        height: 65,
        locked: false,
        visible: true,
        scale: 5000000,
        rotation: 0,
        showGrid: false,
        isOverview: true
      },
      {
        id: 'item-north-arrow',
        type: 'north_arrow',
        name: 'Rosa dos Ventos',
        x: 210,
        y: 80,
        width: 25,
        height: 25,
        locked: false,
        visible: true,
        arrowStyle: 'classic',
        rotation: 0
      },
      {
        id: 'item-scale-bar',
        type: 'scale_bar',
        name: 'Barra de Escala',
        x: 240,
        y: 80,
        width: 47,
        height: 25,
        locked: false,
        visible: true
      },
      {
        id: 'item-legend',
        type: 'legend',
        name: 'Legenda Temática',
        x: 205,
        y: 110,
        width: 82,
        height: 45,
        locked: false,
        visible: true
      },
      {
        id: 'item-title-block',
        type: 'title_block',
        name: 'Carimbo Técnico (NBR 13133)',
        x: 205,
        y: 160,
        width: 82,
        height: 40,
        locked: false,
        visible: true,
        properties: {
          headerTitle: 'LEVANTAMENTO TOPOGRÁFICO',
          projectName: projectName,
          author: 'Eng. Cartógrafo / Topógrafo',
          art: 'CREA-BR 2026/0012',
          datum: 'SIRGAS 2000 / UTM',
          scaleText: '1:10.000',
          location: 'Distrito Federal - Brasil',
          date: new Date().toLocaleDateString('pt-BR')
        }
      }
    ];
  }

  static createNewItem(type, projectName = 'Projeto', currentCount = 0) {
    const ts = Date.now();
    switch (type) {
      case 'map':
        return {
          id: `item-map-${ts}`,
          type: 'map',
          name: `Mapa #${currentCount + 1}`,
          x: 20,
          y: 20,
          width: 140,
          height: 100,
          locked: false,
          visible: true,
          scale: 10000,
          rotation: 0,
          showGrid: true
        };
      case 'inset_map':
        return {
          id: `item-inset-${ts}`,
          type: 'inset_map',
          name: 'Mini-mapa Inset',
          x: 180,
          y: 20,
          width: 80,
          height: 60,
          locked: false,
          visible: true,
          scale: 5000000,
          rotation: 0,
          showGrid: false,
          isOverview: true
        };
      case 'north_arrow':
        return {
          id: `item-arrow-${ts}`,
          type: 'north_arrow',
          name: 'Rosa dos Ventos',
          x: 20,
          y: 130,
          width: 25,
          height: 25,
          locked: false,
          visible: true,
          arrowStyle: 'classic',
          rotation: 0
        };
      case 'scale_bar':
        return {
          id: `item-scale-${ts}`,
          type: 'scale_bar',
          name: 'Barra de Escala',
          x: 50,
          y: 130,
          width: 50,
          height: 25,
          locked: false,
          visible: true
        };
      case 'legend':
        return {
          id: `item-legend-${ts}`,
          type: 'legend',
          name: 'Legenda',
          x: 180,
          y: 90,
          width: 80,
          height: 50,
          locked: false,
          visible: true
        };
      case 'title_block':
        return {
          id: `item-tb-${ts}`,
          type: 'title_block',
          name: 'Carimbo Técnico',
          x: 180,
          y: 150,
          width: 90,
          height: 45,
          locked: false,
          visible: true,
          properties: {
            headerTitle: 'PLANTA TOPOGRÁFICA',
            projectName: projectName,
            author: 'Eng. Cartógrafo',
            art: 'CREA-BR 2026',
            datum: 'SIRGAS 2000',
            scaleText: '1:10.000',
            location: 'Brasil',
            date: new Date().toLocaleDateString('pt-BR')
          }
        };
      default:
        return null;
    }
  }
}
