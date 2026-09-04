/* ==========================================================================
   ConecteMapas - PrintItemsManager
   Responsabilidade Única: Modelos cartográficos, conversões geodésicas (DMS/UTM Proj4),
   tabela de vértices topográfica, selo ABNT NBR 13133/6492 e grade métrica/angular.
   ========================================================================== */

import proj4 from 'proj4';
import { BRAZILIAN_PROJECTIONS } from '../../services/Shapefile/Projections.js';

export class PrintItemsManager {
  /**
   * Sanitização rigorosa de strings para evitar ataques XSS
   */
  static escapeHtml(str) {
    if (typeof str !== 'string') return str == null ? '' : String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Formatação em Graus, Minutos e Segundos (DMS)
   */
  static formatDMS(val, isLat) {
    if (typeof val !== 'number' || isNaN(val)) return isLat ? `15°47'00"S` : `47°52'00"W`;
    const abs = Math.abs(val);
    const deg = Math.floor(abs);
    const min = Math.floor((abs - deg) * 60);
    const sec = Math.round(((abs - deg) * 60 - min) * 60);
    const hemi = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    return `${deg}°${String(min).padStart(2, '0')}'${String(sec).padStart(2, '0')}"${hemi}`;
  }

  /**
   * Formatação de Azimute em Graus, Minutos e Segundos
   */
  static formatAzimuth(degVal) {
    if (typeof degVal !== 'number' || isNaN(degVal)) return `00°00'00"`;
    const val = (degVal % 360 + 360) % 360;
    const deg = Math.floor(val);
    const min = Math.floor((val - deg) * 60);
    const sec = Math.round(((val - deg) * 60 - min) * 60);
    return `${String(deg).padStart(2, '0')}°${String(min).padStart(2, '0')}'${String(sec).padStart(2, '0')}"`;
  }

  /**
   * Detecta automaticamente a Zona UTM brasileira a partir da longitude
   */
  static detectUtmZone(lng) {
    const zone = Math.floor((lng + 180) / 6) + 1;
    return Math.max(18, Math.min(25, zone));
  }

  /**
   * Converte coordenadas [lat, lng] (WGS84 / SIRGAS 2000) para UTM em metros
   */
  static toUtmCoords(lat, lng, forcedZone = null) {
    const zone = forcedZone || this.detectUtmZone(lng);
    const epsgCode = `EPSG:${31960 + zone}`; // SIRGAS 2000 UTM Zonas 18S a 25S
    const projDef = BRAZILIAN_PROJECTIONS[epsgCode] || `+proj=utm +zone=${zone} +south +ellps=GRS80 +units=m +no_defs`;

    try {
      const [easting, northing] = proj4('EPSG:4326', projDef, [lng, lat]);
      return {
        easting: Math.round(easting * 100) / 100,
        northing: Math.round(northing * 100) / 100,
        zone,
        epsgCode
      };
    } catch (err) {
      console.warn('[PrintItemsManager] Erro na projeção UTM:', err);
      return { easting: 0, northing: 0, zone, epsgCode: 'EPSG:4674' };
    }
  }

  /**
   * Calcula escala cartográfica real a partir do zoom Leaflet e latitude
   */
  static calculateScale(zoom, lat = -15.78) {
    const cosLat = Math.cos((lat * Math.PI) / 180);
    return Math.round((591657550.5 * cosLat) / Math.pow(2, zoom));
  }

  /**
   * Calcula zoom do Leaflet a partir da escala numérica e latitude
   */
  static calculateZoom(scale, lat = -15.78) {
    const cosLat = Math.cos((lat * Math.PI) / 180);
    return Math.log2((591657550.5 * cosLat) / Math.max(100, scale));
  }

  /**
   * Renderiza a Rosa dos Ventos / Seta Norte em SVG técnico nítido
   */
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

  /**
   * Renderiza Selo / Carimbo Técnico nos padrões da ABNT NBR 6492 e NBR 13133
   */
  static renderTitleBlock(item, projectName = 'Levantamento Cartográfico') {
    const props = item.properties || {};
    const esc = this.escapeHtml.bind(this);
    return `
      <div class="cm-item-title-block">
        <div class="cm-title-block-header">${esc(props.headerTitle || 'PLANTA TOPOGRÁFICA / CARTOGRÁFICA')}</div>
        <div class="cm-title-block-grid">
          <div class="cm-title-block-cell full-width">
            <span class="cm-cell-label">Projeto / Obra</span>
            <span class="cm-cell-val">${esc(props.projectName || projectName)}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Proprietário / Cliente</span>
            <span class="cm-cell-val">${esc(props.client || 'Particular')}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Imóvel / Endereço</span>
            <span class="cm-cell-val">${esc(props.location || 'Distrito Federal - Brasil')}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Responsável Técnico</span>
            <span class="cm-cell-val">${esc(props.author || 'Eng. Cartógrafo / Agrimensor')}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Registro / ART</span>
            <span class="cm-cell-val">${esc(props.art || 'CREA-BR 2026/0012')}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Sistema Geodésico / Datum</span>
            <span class="cm-cell-val">${esc(props.datum || 'SIRGAS 2000 / UTM')}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Escala Numérica</span>
            <span class="cm-cell-val">${esc(props.scaleText || '1:10.000')}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Área / Perímetro</span>
            <span class="cm-cell-val">${esc(props.areaPerimeter || 'Conforme Tabela')}</span>
          </div>
          <div class="cm-title-block-cell">
            <span class="cm-cell-label">Data / Prancha</span>
            <span class="cm-cell-val">${esc(props.date || new Date().toLocaleDateString('pt-BR'))} (01/01)</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza a Barra de Escala Gráfica segmentada com precisão métrica
   */
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
        <div style="font-size: 7.5px; font-weight: bold; margin-bottom: 2px;">Escala 1:${mapScale.toLocaleString('pt-BR')}</div>
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

  /**
   * Renderiza a Legenda Temática das camadas ativas
   */
  static renderLegend(item, layers = []) {
    const esc = this.escapeHtml.bind(this);
    const visibleLayers = layers.filter(l => l.visible !== false);
    return `
      <div class="cm-item-legend">
        <div class="cm-legend-title">LEGENDA CONVENCIONAL</div>
        <div class="cm-legend-content">
          ${visibleLayers.length > 0 ? visibleLayers.map(l => `
            <div class="cm-legend-row" title="${esc(l.name)}">
              <div class="cm-legend-swatch" style="background: ${l.color || '#00E08A'};"></div>
              <span class="cm-legend-name">${esc(l.name)}</span>
            </div>
          `).join('') : '<div style="font-size: 7px; color: #777; text-align: center; padding: 4px 0;">Nenhuma camada visível</div>'}
        </div>
      </div>
    `;
  }

  /**
   * Calcula vértices, distâncias métricas e azimutes para a Tabela de Vértices
   */
  static extractVerticesData(features = [], selectedFeatureId = null) {
    let targetFeature = null;
    if (selectedFeatureId) {
      targetFeature = features.find(f => f.id === selectedFeatureId);
    }
    if (!targetFeature) {
      targetFeature = features.find(f => {
        const t = (f.type || '').toLowerCase();
        return (t === 'polygon' || t === 'linestring' || t === 'line') && Array.isArray(f.coordinates) && f.coordinates.length >= 3;
      });
    }

    if (!targetFeature || !Array.isArray(targetFeature.coordinates)) {
      return { featureName: 'Nenhuma Feição', vertices: [], totalArea: 0, totalPerimeter: 0 };
    }

    // Normaliza anel de coordenadas
    let rawCoords = targetFeature.coordinates;
    if (Array.isArray(rawCoords[0]) && Array.isArray(rawCoords[0][0])) {
      rawCoords = rawCoords[0]; // Extrai anel exterior se for MultiPolygon
    }

    // Normaliza para array de [lat, lng]
    const points = rawCoords.map(c => {
      if (Array.isArray(c)) return [c[0], c[1]];
      if (c && typeof c.lat === 'number' && typeof c.lng === 'number') return [c.lat, c.lng];
      return null;
    }).filter(Boolean);

    if (points.length < 2) {
      return { featureName: targetFeature.name || 'Feição', vertices: [], totalArea: 0, totalPerimeter: 0 };
    }

    // Identifica zona UTM média
    const avgLng = points.reduce((s, p) => s + p[1], 0) / points.length;
    const utmZone = this.detectUtmZone(avgLng);

    // Converte todos os pontos para UTM em metros
    const utmPoints = points.map(p => this.toUtmCoords(p[0], p[1], utmZone));

    const vertices = [];
    let totalPerimeter = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const curr = utmPoints[i];
      const next = utmPoints[(i + 1) % n];

      const dE = next.easting - curr.easting;
      const dN = next.northing - curr.northing;
      const dist = Math.sqrt(dE * dE + dN * dN);
      let azimuth = (Math.atan2(dE, dN) * 180) / Math.PI;
      if (azimuth < 0) azimuth += 360;

      totalPerimeter += dist;

      vertices.push({
        name: `V${String(i + 1).padStart(2, '0')}`,
        lat: points[i][0],
        lng: points[i][1],
        northing: curr.northing.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        easting: curr.easting.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        distance: dist > 0 ? dist.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-',
        azimuth: dist > 0 ? this.formatAzimuth(azimuth) : '-'
      });
    }

    // Cálculo da Área em projeção UTM via Gauss / Shoelace
    let areaSum = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      areaSum += (utmPoints[i].easting * utmPoints[j].northing) - (utmPoints[j].easting * utmPoints[i].northing);
    }
    const totalAreaM2 = Math.abs(areaSum) / 2;

    return {
      featureName: targetFeature.name || 'Polígono Cadastrado',
      utmZone,
      vertices,
      totalAreaM2,
      totalAreaHa: totalAreaM2 / 10000,
      totalPerimeter
    };
  }

  /**
   * Renderiza a Tabela de Vértices Topográfica em HTML para a folha
   */
  static renderVerticesTable(item, features = []) {
    const esc = this.escapeHtml.bind(this);
    const data = this.extractVerticesData(features, item.targetFeatureId);

    return `
      <div class="cm-item-vertices-table">
        <div class="cm-tb-vert-header">
          <span>TABELA DE COORDENADAS E CONFRONTAÇÕES</span>
          <span style="font-size: 6.5px; opacity: 0.85;">SIRGAS 2000 UTM ${data.utmZone || 23}S</span>
        </div>
        <div class="cm-tb-vert-scroll">
          <table class="cm-vert-native-table">
            <thead>
              <tr>
                <th>Vértice</th>
                <th>Norte (Y)</th>
                <th>Leste (X)</th>
                <th>Azimute</th>
                <th>Distância (m)</th>
              </tr>
            </thead>
            <tbody>
              ${data.vertices.length > 0 ? data.vertices.map(v => `
                <tr>
                  <td class="vert-name">${esc(v.name)}</td>
                  <td>${esc(v.northing)}</td>
                  <td>${esc(v.easting)}</td>
                  <td>${esc(v.azimuth)}</td>
                  <td>${esc(v.distance)}</td>
                </tr>
              `).join('') : `<tr><td colspan="5" style="text-align: center; color: #888;">Nenhum polígono selecionado</td></tr>`}
            </tbody>
          </table>
        </div>
        ${data.vertices.length > 0 ? `
          <div class="cm-tb-vert-footer">
            <span>Área: <strong>${data.totalAreaM2.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²</strong> (${data.totalAreaHa.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ha)</span>
            <span>Perímetro: <strong>${data.totalPerimeter.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m</strong></span>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Renderiza o Bloco de Notas Técnicas / Texto Livre
   */
  static renderTextBlock(item) {
    const esc = this.escapeHtml.bind(this);
    const text = item.text || 'NOTAS TÉCNICAS:\n1. Coordenadas UTM referenciadas ao Datum SIRGAS 2000.\n2. Levantamento planialtimétrico executado com receptores GNSS RTK L1/L2.\n3. Limites e confrontações demarcados de acordo com memorial descritivo.';
    const formatted = esc(text).replace(/\n/g, '<br>');

    return `
      <div class="cm-item-text-block" style="font-size: ${item.fontSize || 7.5}px;">
        <div class="cm-text-block-title">${esc(item.title || 'NOTAS GERAIS')}</div>
        <div class="cm-text-block-body">${formatted}</div>
      </div>
    `;
  }

  /**
   * Renderiza a Moldura e Rótulos da Grade Cartográfica Real no Mapa
   */
  static renderMapGridBorder(mapBounds, mode = 'dms') {
    if (!mapBounds) return `<div class="cm-item-grid-border"></div>`;

    if (mode === 'utm') {
      const avgLng = (mapBounds.west + mapBounds.east) / 2;
      const zone = this.detectUtmZone(avgLng);
      const nw = this.toUtmCoords(mapBounds.north, mapBounds.west, zone);
      const se = this.toUtmCoords(mapBounds.south, mapBounds.east, zone);

      return `
        <div class="cm-item-grid-border">
          <span class="cm-grid-label-n">${nw.northing.toLocaleString('pt-BR')} m N</span>
          <span class="cm-grid-label-s">${se.northing.toLocaleString('pt-BR')} m N</span>
          <span class="cm-grid-label-w">${nw.easting.toLocaleString('pt-BR')} m E</span>
          <span class="cm-grid-label-e">${se.easting.toLocaleString('pt-BR')} m E</span>
        </div>
      `;
    }

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

  /**
   * Elementos padrão de uma nova Composição de Impressão (Normatizada ABNT NBR 13133/6492)
   */
  static createDefaultItems(projectName = 'Projeto', paperSize = null) {
    const size = paperSize || { id: 'A4_L', width: 297, height: 210, marginL: 25, marginO: 7 };
    const defaultCarimbo = {
      headerTitle: 'PLANTA TOPOGRÁFICA / CARTOGRÁFICA',
      projectName: projectName,
      client: 'Particular',
      author: 'Eng. Cartógrafo / Agrimensor',
      art: 'CREA-BR 2026/0012',
      datum: 'SIRGAS 2000 / UTM',
      scaleText: '1:10.000',
      location: 'Distrito Federal - Brasil',
      areaPerimeter: 'Conforme Tabela',
      date: new Date().toLocaleDateString('pt-BR')
    };

    const isLandscape = size.width >= size.height;
    const mL = size.marginL || 25;
    const mO = size.marginO || 7;
    const utilW = size.width - mL - mO;
    const utilH = size.height - 2 * mO;

    if (isLandscape) {
      // Largura da coluna técnica lateral (ajustada para A4 ~72mm, A3/A2 até 82mm)
      const colWidth = Math.min(84, Math.max(70, Math.round(utilW * 0.27)));
      const gap = 3;
      const mapWidth = utilW - colWidth - gap;
      const mapHeight = utilH;
      const colX = mL + mapWidth + gap;

      // Distribuição vertical proporcional na coluna lateral
      const insetHeight = Math.max(45, Math.min(62, Math.round(utilH * 0.25)));
      const toolY = mO + insetHeight + gap;
      const toolHeight = 20;
      const seloHeight = Math.max(58, Math.min(72, Math.round(utilH * 0.33)));
      const seloY = mO + utilH - seloHeight;
      const legY = toolY + toolHeight + gap;
      const legHeight = Math.max(35, seloY - legY - gap);

      return [
        {
          id: 'item-map-main',
          type: 'map',
          name: 'Mapa Principal',
          x: mL,
          y: mO,
          width: mapWidth,
          height: mapHeight,
          locked: false,
          visible: true,
          scale: 10000,
          rotation: 0,
          showGrid: true,
          gridType: 'dms',
          gridInterval: 'auto',
          basemap: 'satelite',
          isOverview: false
        },
        {
          id: 'item-map-inset',
          type: 'inset_map',
          name: 'Mapa de Localização (Inset)',
          x: colX,
          y: mO,
          width: colWidth,
          height: insetHeight,
          locked: false,
          visible: true,
          scale: 5000000,
          rotation: 0,
          showGrid: false,
          basemap: 'esri_light',
          isOverview: true
        },
        {
          id: 'item-north-arrow',
          type: 'north_arrow',
          name: 'Rosa dos Ventos',
          x: colX,
          y: toolY,
          width: 20,
          height: toolHeight,
          locked: false,
          visible: true,
          arrowStyle: 'classic',
          rotation: 0
        },
        {
          id: 'item-scale-bar',
          type: 'scale_bar',
          name: 'Barra de Escala',
          x: colX + 22,
          y: toolY,
          width: colWidth - 22,
          height: toolHeight,
          locked: false,
          visible: true
        },
        {
          id: 'item-legend',
          type: 'legend',
          name: 'Legenda Temática',
          x: colX,
          y: legY,
          width: colWidth,
          height: legHeight,
          locked: false,
          visible: true
        },
        {
          id: 'item-title-block',
          type: 'title_block',
          name: 'Carimbo Técnico (NBR 13133)',
          x: colX,
          y: seloY,
          width: colWidth,
          height: seloHeight,
          locked: false,
          visible: true,
          properties: defaultCarimbo
        }
      ];
    } else {
      // Modo Retrato (A4 Retrato, A3 Retrato)
      const gap = 3;
      const bottomHeight = Math.min(100, Math.round(utilH * 0.35));
      const mapHeight = utilH - bottomHeight - gap;
      const mapWidth = utilW;
      const bottomY = mO + mapHeight + gap;
      const halfW = Math.floor((utilW - gap) / 2);

      return [
        {
          id: 'item-map-main',
          type: 'map',
          name: 'Mapa Principal',
          x: mL,
          y: mO,
          width: mapWidth,
          height: mapHeight,
          locked: false,
          visible: true,
          scale: 10000,
          rotation: 0,
          showGrid: true,
          gridType: 'dms',
          gridInterval: 'auto',
          basemap: 'satelite',
          isOverview: false
        },
        {
          id: 'item-map-inset',
          type: 'inset_map',
          name: 'Mapa de Localização (Inset)',
          x: mL,
          y: bottomY,
          width: halfW,
          height: 38,
          locked: false,
          visible: true,
          scale: 5000000,
          rotation: 0,
          showGrid: false,
          basemap: 'esri_light',
          isOverview: true
        },
        {
          id: 'item-legend',
          type: 'legend',
          name: 'Legenda Temática',
          x: mL,
          y: bottomY + 41,
          width: halfW,
          height: bottomHeight - 41,
          locked: false,
          visible: true
        },
        {
          id: 'item-north-arrow',
          type: 'north_arrow',
          name: 'Rosa dos Ventos',
          x: mL + halfW + gap,
          y: bottomY,
          width: 20,
          height: 20,
          locked: false,
          visible: true,
          arrowStyle: 'classic',
          rotation: 0
        },
        {
          id: 'item-scale-bar',
          type: 'scale_bar',
          name: 'Barra de Escala',
          x: mL + halfW + gap + 22,
          y: bottomY,
          width: halfW - 22,
          height: 20,
          locked: false,
          visible: true
        },
        {
          id: 'item-title-block',
          type: 'title_block',
          name: 'Carimbo Técnico (NBR 13133)',
          x: mL + halfW + gap,
          y: bottomY + 23,
          width: halfW,
          height: bottomHeight - 23,
          locked: false,
          visible: true,
          properties: defaultCarimbo
        }
      ];
    }
  }

  /**
   * Fábrica para criação de novos itens no layout
   */
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
          showGrid: true,
          gridType: 'dms',
          basemap: 'satelite'
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
          basemap: 'esri_light',
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
          height: 45,
          locked: false,
          visible: true
        };
      case 'title_block':
        return {
          id: `item-tb-${ts}`,
          type: 'title_block',
          name: 'Carimbo Técnico',
          x: 180,
          y: 140,
          width: 90,
          height: 60,
          locked: false,
          visible: true,
          properties: {
            headerTitle: 'PLANTA TOPOGRÁFICA',
            projectName,
            client: 'Particular',
            author: 'Eng. Cartógrafo',
            art: 'CREA-BR 2026',
            datum: 'SIRGAS 2000 / UTM',
            scaleText: '1:10.000',
            location: 'Distrito Federal',
            areaPerimeter: 'Conforme Tabela',
            date: new Date().toLocaleDateString('pt-BR')
          }
        };
      case 'table_vertices':
        return {
          id: `item-vert-${ts}`,
          type: 'table_vertices',
          name: 'Tabela de Vértices',
          x: 15,
          y: 130,
          width: 95,
          height: 65,
          locked: false,
          visible: true,
          targetFeatureId: null
        };
      case 'text_block':
        return {
          id: `item-text-${ts}`,
          type: 'text_block',
          name: 'Notas Técnicas',
          x: 15,
          y: 140,
          width: 85,
          height: 45,
          locked: false,
          visible: true,
          title: 'NOTAS GERAIS',
          text: '1. Sistema Geodésico: SIRGAS 2000.\n2. Coordenadas em projeção Universal Transversa de Mercator (UTM).\n3. Levantamento conforme NBR 13133.',
          fontSize: 7.5
        };
      default:
        return null;
    }
  }
}

