/* ==========================================================================
   ConecteMapas - PrintItemsManager
   Responsabilidade Única: Gerenciamento e renderização dos elementos cartográficos
   (Mapa Principal, Inset Map, Rosa dos Ventos, Escala, Selo NBR, Legenda).
   ========================================================================== */

export class PrintItemsManager {
  static getNorthArrowSVG(style = 'classic', rotation = 0) {
    if (style === 'compass') {
      return `
        <svg viewBox="0 0 100 100" width="100%" height="100%" style="transform: rotate(${rotation}deg)">
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
        <svg viewBox="0 0 100 100" width="100%" height="100%" style="transform: rotate(${rotation}deg)">
          <polygon points="50,6 64,88 50,72" fill="#000"/>
          <polygon points="50,6 36,88 50,72" fill="#777"/>
          <text x="50" y="24" font-family="Arial, sans-serif" font-size="14" font-weight="900" text-anchor="middle" fill="#fff">N</text>
        </svg>
      `;
    }
    // Classic Default
    return `
      <svg viewBox="0 0 100 100" width="100%" height="100%" style="transform: rotate(${rotation}deg)">
        <polygon points="50,8 60,50 50,44" fill="#000"/>
        <polygon points="50,8 40,50 50,44" fill="#fff" stroke="#000" stroke-width="1"/>
        <polygon points="50,92 60,50 50,56" fill="#fff" stroke="#000" stroke-width="1"/>
        <polygon points="50,92 40,50 50,56" fill="#000"/>
        <text x="50" y="22" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#000">N</text>
      </svg>
    `;
  }

  static renderTitleBlock(item, projectName = 'Levantamento Cartográfico') {
    const props = item.properties || {};
    return `
      <div class="cm-item-title-block">
        <div class="cm-title-block-header">${props.headerTitle || 'PLANTA TOPOGRÁFICA / CARTOGRÁFICA'}</div>
        <div class="cm-title-block-grid">
          <div class="cm-title-block-cell full-width">
            <span class="cm-cell-label">Projeto</span>
            <span class="cm-cell-val">${props.projectName || projectName}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Responsável Técnico</span>
            <span class="cm-cell-val">${props.author || 'Eng. Cartógrafo / Topógrafo'}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">ART / CREA</span>
            <span class="cm-cell-val">${props.art || 'CREA-BR 2026/0012'}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Sistema Geodésico</span>
            <span class="cm-cell-val">${props.datum || 'SIRGAS 2000 / UTM'}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Escala</span>
            <span class="cm-cell-val">${props.scaleText || '1:10.000'}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Localização</span>
            <span class="cm-cell-val">${props.location || 'Distrito Federal - Brasil'}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Data</span>
            <span class="cm-cell-val">${props.date || new Date().toLocaleDateString('pt-BR')}</span>
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
    return `
      <div class="cm-item-legend">
        <div class="cm-legend-title">LEGENDA CONVENCIONAL</div>
        ${layers.filter(l => l.visible !== false).map(l => `
          <div class="cm-legend-row">
            <div class="cm-legend-swatch" style="background: ${l.color || '#00E08A'};"></div>
            <span>${l.name}</span>
          </div>
        `).join('')}
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
        scale: 500000,
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
}
