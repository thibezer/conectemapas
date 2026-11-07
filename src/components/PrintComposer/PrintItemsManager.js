/* ==========================================================================
   ConecteMapas - PrintItemsManager
   Responsabilidade Única: Modelos cartográficos, conversões geodésicas (DMS/UTM Proj4),
   tabela de vértices topográfica, selo ABNT NBR 13133/6492 e grade métrica/angular.
   ========================================================================== */

import proj4 from 'proj4';
import { utmProjection } from '../../services/Shapefile/Projections.js';
import { Geodesy } from '../../services/Geodesy.js';
import { FeatureGeometryUtils } from '../../services/MapEngine/FeatureGeometryUtils.js';
import { PrintFonts } from './PrintFonts.js';

export class PrintItemsManager {
  /** Menor lado de um item, em mm (o mesmo para as alças e para o painel) */
  static MIN_ITEM_MM = 10;

  /** Título padrão da legenda */
  static DEFAULT_LEGEND_TITLE = 'LEGENDA CONVENCIONAL';

  /**
   * Posição de inserção na pilha (fim = frente). Moldura entra logo acima dos mapas,
   * para não cobrir os demais elementos; o resto vai para a frente.
   */
  static insertionIndex(items = [], type) {
    if (type !== 'shape') return items.length;
    let lastMap = -1;
    items.forEach((it, i) => { if (it.type === 'map' || it.type === 'inset_map') lastMap = i; });
    return lastMap + 1;
  }

  /**
   * Mantém o item dentro da folha e com o tamanho mínimo (altera e retorna o próprio item)
   */
  static clampItemToPaper(item, paper) {
    const min = this.MIN_ITEM_MM;
    const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);
    item.width = Math.min(paper.width, Math.max(min, num(item.width, min)));
    item.height = Math.min(paper.height, Math.max(min, num(item.height, min)));
    item.x = Math.min(paper.width - item.width, Math.max(0, num(item.x, 0)));
    item.y = Math.min(paper.height - item.height, Math.max(0, num(item.y, 0)));
    return item;
  }

  /**
   * Arredonda para baixo a um valor "redondo" de cartografia (1, 2, 2,5 ou 5 × 10ⁿ)
   */
  static niceFloor(value) {
    if (!(value > 0)) return 0;
    const pow = Math.pow(10, Math.floor(Math.log10(value)));
    const f = value / pow;
    const step = f >= 5 ? 5 : f >= 2.5 ? 2.5 : f >= 2 ? 2 : 1;
    return step * pow;
  }

  /**
   * Geometria da barra de escala: comprimento da régua (fração da largura do item) que
   * corresponde exatamente a uma distância redonda no terreno, e os rótulos de cada divisão.
   * Usada pela prancheta e pelo exportador, para que os dois mostrem a mesma régua.
   */
  static scaleBarModel(item, mapScale = 10000) {
    const scale = Math.max(1, Number(mapScale) || 10000);
    const segments = Math.min(8, Math.max(1, Math.round(Number(item.segments) || 4)));
    const maxRatio = 0.9; // a régua ocupa no máximo 90% da largura do item
    const maxGroundM = ((item.width || 60) * maxRatio / 1000) * scale;
    const segmentM = this.niceFloor(maxGroundM / segments);
    const totalM = segmentM * segments;
    const units = item.units === 'm' || item.units === 'km' ? item.units : (totalM >= 1000 ? 'km' : 'm');
    const div = units === 'km' ? 1000 : 1;
    const fmt = (m) => (m / div).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
    const labelEvery = segments <= 4 ? 1 : segments;

    const labels = [];
    for (let i = 0; i <= segments; i += labelEvery) {
      labels.push({ position: i / segments, text: i === segments ? `${fmt(i * segmentM)} ${units}` : fmt(i * segmentM) });
    }

    return {
      segments,
      units,
      totalMeters: totalM,
      ratio: totalM > 0 ? (totalM / scale * 1000) / (item.width || 60) : 0,
      labels,
      showText: item.showScaleText !== false,
      scaleText: `Escala 1:${Math.round(scale).toLocaleString('pt-BR')}`
    };
  }

  /**
   * Cor segura para `style`/canvas: só #hex, rgb()/rgba() numéricos ou nome simples de cor.
   * Qualquer outra coisa (aspas, ponto e vírgula, url(), etc.) vira `fallback`.
   */
  static sanitizeColor(value, fallback = '#000000') {
    if (typeof value !== 'string') return fallback;
    const v = value.trim();
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return v;
    if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i.test(v)) return v;
    if (/^[a-z]{3,20}$/i.test(v)) return v;
    return fallback;
  }

  /** Separa uma cor em #rrggbb (para o seletor) e opacidade 0–1; null se não for #hex/rgb(a) */
  static parseColor(value) {
    const v = typeof value === 'string' ? value.trim() : '';
    let m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
      return { hex: `#${h.toLowerCase()}`, alpha: 1 };
    }
    m = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)$/i);
    if (!m) return null;
    const hex = '#' + [m[1], m[2], m[3]].map(n => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('');
    return { hex, alpha: m[4] === undefined ? 1 : Number(m[4]) };
  }

  /** Monta rgba() a partir de #rrggbb e opacidade 0–1 */
  static toRgba(hex, alpha = 1) {
    const p = this.parseColor(hex) || { hex: '#ffffff' };
    const n = parseInt(p.hex.slice(1), 16);
    const a = Math.round(Math.min(1, Math.max(0, Number(alpha) || 0)) * 100) / 100;
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  /** Intervalos de grade geográfica, em segundos de arco (1" a 10°) */
  static GRID_DMS_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 18000, 36000];

  /** Menor valor "redondo" (1, 2, 2,5 ou 5 × 10ⁿ) maior ou igual a `value` */
  static niceCeil(value) {
    if (!(value > 0)) return 0;
    const pow = Math.pow(10, Math.floor(Math.log10(value)));
    const f = value / pow;
    const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return step * pow;
  }

  /**
   * Linhas da grade de coordenadas em intervalos redondos, como frações da moldura do mapa
   * (x: 0 = oeste → 1 = leste; y: 0 = norte → 1 = sul, em Web Mercator como o Leaflet).
   * `mode` 'dms' = geográfica (graus/minutos/segundos); 'utm' = metros SIRGAS 2000 / UTM.
   * Usado pela prancheta e pelo exportador, que desenham a mesma grade.
   */
  static graticuleModel(bounds, mode = 'dms', maxLines = 4) {
    const { north, south, west, east } = bounds || {};
    const empty = { xs: [], ys: [] };
    if (![north, south, west, east].every(Number.isFinite) || north <= south || east <= west) return empty;

    const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    const yFrac = (lat) => (mercY(north) - mercY(lat)) / (mercY(north) - mercY(south));
    const xFrac = (lng) => (lng - west) / (east - west);
    const inside = (l) => l.f > 0.03 && l.f < 0.97;

    if (mode === 'utm') {
      const cLat = (north + south) / 2;
      const cLng = (west + east) / 2;
      const zone = this.detectUtmZone(cLng);
      const southHemi = cLat < 0;
      const { def } = utmProjection('sirgas', zone, southHemi);
      const fwd = (lat, lng) => proj4('EPSG:4326', def, [lng, lat]);
      const inv = (e, n) => proj4(def, 'EPSG:4326', [e, n]);
      const [eMin] = fwd(cLat, west);
      const [eMax, nCenter] = fwd(cLat, east);
      const [eCenter, nMax] = fwd(north, cLng);
      const [, nMin] = fwd(south, cLng);
      const fmt = (v) => `${Math.round(v).toLocaleString('pt-BR')} m`;

      const stepE = this.niceCeil((eMax - eMin) / maxLines);
      const stepN = this.niceCeil((nMax - nMin) / maxLines);
      const xs = [];
      for (let e = Math.ceil(eMin / stepE) * stepE; e < eMax; e += stepE) {
        xs.push({ f: xFrac(inv(e, nCenter)[0]), label: `${fmt(e)} E` });
      }
      const ys = [];
      for (let n = Math.ceil(nMin / stepN) * stepN; n < nMax; n += stepN) {
        ys.push({ f: yFrac(inv(eCenter, n)[1]), label: `${fmt(n)} N` });
      }
      const byF = (u, v) => u.f - v.f;
      return { xs: xs.filter(inside).sort(byF), ys: ys.filter(inside).sort(byF) };
    }

    const pick = (spanDeg) => this.GRID_DMS_STEPS.find(s => (spanDeg * 3600) / s <= maxLines) || 36000;
    const lines = (min, max, isLat) => {
      const step = pick(max - min);
      const out = [];
      for (let s = Math.ceil((min * 3600) / step) * step; s < max * 3600; s += step) {
        const deg = s / 3600;
        out.push({ f: isLat ? yFrac(deg) : xFrac(deg), label: this.formatDMS(deg, isLat) });
      }
      return out.filter(inside).sort((u, v) => u.f - v.f);
    };
    return { xs: lines(west, east, false), ys: lines(south, north, true) };
  }

  /**
   * Escala mostrada no carimbo: acompanha o mapa principal, a menos que o usuário tenha
   * digitado um texto próprio (scaleAuto = false). Pranchas antigas com o padrão fixo
   * "1:10.000" passam a acompanhar o mapa.
   */
  static isTitleBlockScaleAuto(props = {}) {
    if (props.scaleAuto !== undefined) return props.scaleAuto !== false;
    return !props.scaleText || props.scaleText === '1:10.000';
  }

  static titleBlockScaleText(props = {}, mapScale = null) {
    if (this.isTitleBlockScaleAuto(props) && Number(mapScale) > 0) return `1:${Math.round(mapScale).toLocaleString('pt-BR')}`;
    return props.scaleText || '1:10.000';
  }

  /** Só a data do carimbo (ignora números de prancha antigos gravados nela: "23/10/2026 (01/01)") */
  static titleBlockDateOnly(props = {}) {
    return String(props.date || new Date().toLocaleDateString('pt-BR')).split('(')[0].trim();
  }

  /** Número da prancha do carimbo: "02/03" */
  static titleBlockSheetText(props = {}) {
    return props.sheetNumber || '01/01';
  }

  /** Data e número da prancha do carimbo: "23/10/2026 (02/03)" */
  static titleBlockDateText(props = {}) {
    return `${this.titleBlockDateOnly(props)} (${this.titleBlockSheetText(props)})`;
  }

  /**
   * Datum do carimbo. "SIRGAS 2000 / UTM" (sem fuso) ganha o fuso e o hemisfério do centro do mapa
   * principal ("SIRGAS 2000 / UTM 22S"); texto que já traz o fuso ou centro inválido ficam como estão.
   */
  static titleBlockDatumText(props = {}, center = null) {
    const base = String(props.datum || 'SIRGAS 2000 / UTM').trim();
    const lat = Number(center?.[0]);
    const lng = Number(center?.[1]);
    if (!/\bUTM$/i.test(base) || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return base;
    return `${base} ${this.detectUtmZone(lng)}${lat < 0 ? 'S' : 'N'}`;
  }

  /**
   * "30.307,5 m² (3,031 ha) | P: 662,9 m" → { area, perimeter }; null quando o texto não segue
   * esse formato (texto livre, "Conforme Tabela"): o carimbo mostra uma célula só.
   */
  static splitAreaPerimeter(text) {
    const parts = String(text ?? '').split('|');
    if (parts.length !== 2) return null;
    const m = parts[1].trim().match(/^(?:P|Per[ií]metro)\s*[:=]?\s*(.+)$/i);
    const area = parts[0].trim();
    return m && area ? { area, perimeter: m[1].trim() } : null;
  }

  /**
   * Sincroniza metadados do projeto com o carimbo técnico (Selo ABNT):
   * Nome do projeto, Sistema de Coordenadas (SIRGAS 2000 UTM), Data atual,
   * cálculo de área/perímetro das feições e escala do mapa principal.
   */
  static syncTitleBlockWithProject(item, composer) {
    if (!item || item.type !== 'title_block') return null;
    item.properties = item.properties || {};

    const updated = [];
    if (composer.projectName) {
      item.properties.projectName = composer.projectName;
      updated.push('Projeto');
    }

    const todayStr = new Intl.DateTimeFormat('pt-BR').format(new Date());
    item.properties.date = todayStr;
    updated.push('Data');

    if (!item.properties.datum || item.properties.datum === 'SIRGAS 2000') {
      item.properties.datum = 'SIRGAS 2000 / Projeção UTM';
      updated.push('Datum');
    }

    if (composer.features && composer.features.length > 0) {
      const data = this.extractVerticesData(composer.features);
      if (data.totalAreaM2 > 0) {
        item.properties.areaPerimeter = `${data.totalAreaM2.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m² (${data.totalAreaHa.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ha) | P: ${data.totalPerimeter.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m`;
        updated.push('Área e Perímetro');
      }
    }

    item.properties.scaleAuto = true;
    const mapItem = (composer.items || []).find(i => i.type === 'map');
    if (mapItem && mapItem.scale) {
      item.properties.scaleText = this.titleBlockScaleText(item.properties, mapItem.scale);
      updated.push('Escala');
    }

    return updated;
  }

  /** Abaixo disso (px no mapa de localização) a área vira um marcador: o retângulo sumiria */
  static INSET_MIN_BOX_PX = 8;

  /**
   * Como mostrar a área do mapa principal no mapa de localização, a partir dos cantos em px:
   * retângulo quando é visível, ou ponto no centro quando a área é pequena demais (planta a 1:10.000
   * num mapa de localização do país ocupa menos de 1 px).
   */
  static insetLocator(nw, se, minPx = this.INSET_MIN_BOX_PX) {
    const w = Math.abs(se.x - nw.x);
    const h = Math.abs(se.y - nw.y);
    if (w >= minPx && h >= minPx) return { type: 'rect', x: Math.min(nw.x, se.x), y: Math.min(nw.y, se.y), w, h };
    return { type: 'point', x: (nw.x + se.x) / 2, y: (nw.y + se.y) / 2 };
  }

  /** Título da legenda ('' = sem título; ausente = padrão) */
  static legendTitle(item) {
    return item?.title ?? this.DEFAULT_LEGEND_TITLE;
  }

  /** Mapa ao qual a legenda está ligada (o escolhido ou o primeiro mapa da prancha) */
  static legendMapItem(item, items = []) {
    const maps = items.filter(i => i.type === 'map');
    return maps.find(m => m.id === item?.mapItemId) || maps[0] || null;
  }

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
    // Arredonda em segundos inteiros ANTES de separar (evita 59'60" e 10°59'60")
    const total = Math.round(Math.abs(val) * 3600);
    const deg = Math.floor(total / 3600);
    const min = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    const hemi = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    return `${deg}°${String(min).padStart(2, '0')}'${String(sec).padStart(2, '0')}"${hemi}`;
  }

  /**
   * Formatação de Azimute em Graus, Minutos e Segundos
   */
  static formatAzimuth(degVal) {
    if (typeof degVal !== 'number' || isNaN(degVal)) return `00°00'00"`;
    const val = (degVal % 360 + 360) % 360;
    const total = Math.round(val * 3600) % (360 * 3600); // 359°59'59,6" arredonda para 0°
    const deg = Math.floor(total / 3600);
    const min = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    return `${String(deg).padStart(2, '0')}°${String(min).padStart(2, '0')}'${String(sec).padStart(2, '0')}"`;
  }

  /**
   * Fuso UTM (1–60) a partir da longitude
   */
  static detectUtmZone(lng) {
    const zone = Math.floor((lng + 180) / 6) + 1;
    return Math.max(1, Math.min(60, zone));
  }

  /**
   * Converte coordenadas [lat, lng] (WGS84 / SIRGAS 2000) para UTM em metros.
   * O hemisfério vem da latitude (norte: Roraima, Amapá...) a menos que `forcedSouth` seja informado
   * (um polígono que cruza o equador usa um único hemisfério para todos os vértices).
   */
  static toUtmCoords(lat, lng, forcedZone = null, forcedSouth = null) {
    const zone = forcedZone || this.detectUtmZone(lng);
    const south = forcedSouth === null ? lat < 0 : forcedSouth;
    const { epsg, def } = utmProjection('sirgas', zone, south);

    try {
      const [easting, northing] = proj4('EPSG:4326', def, [lng, lat]);
      return {
        easting: Math.round(easting * 100) / 100,
        northing: Math.round(northing * 100) / 100,
        zone,
        south,
        epsgCode: epsg
      };
    } catch (err) {
      console.warn('[PrintItemsManager] Erro na projeção UTM:', err);
      return { easting: 0, northing: 0, zone, south, epsgCode: 'EPSG:4674' };
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
   * Modelo único da seta norte (viewBox 0–100): a tela monta o SVG e o exportador desenha os
   * mesmos polígonos/círculos/letra no canvas/PDF. Mexer aqui muda os dois.
   * @returns {{ circles: Array, polys: Array, text: object }}
   */
  static northArrowModel(style = 'classic') {
    const B = '#000000', Wt = '#ffffff';
    const poly = (pts, fill, stroke = null, w = 1) => ({ pts, fill, stroke, w });
    if (style === 'compass') {
      return {
        circles: [
          { r: 46, w: 2, dash: null },
          { r: 40, w: 0.75, dash: [2, 2] }
        ],
        polys: [
          poly([[50, 10], [58, 45], [50, 40]], B),
          poly([[50, 10], [42, 45], [50, 40]], Wt, B, 0.75),
          poly([[50, 90], [58, 55], [50, 60]], Wt, B, 0.75),
          poly([[50, 90], [42, 55], [50, 60]], B),
          poly([[90, 50], [55, 58], [60, 50]], Wt, B, 0.75),
          poly([[90, 50], [55, 42], [60, 50]], B),
          poly([[10, 50], [45, 58], [40, 50]], B),
          poly([[10, 50], [45, 42], [40, 50]], Wt, B, 0.75)
        ],
        text: { x: 50, y: 8, size: 10, fill: B }
      };
    }
    if (style === 'modern') {
      return {
        circles: [],
        polys: [
          poly([[50, 6], [64, 88], [50, 72]], B),
          poly([[50, 6], [36, 88], [50, 72]], '#777777')
        ],
        text: { x: 50, y: 24, size: 14, fill: Wt }
      };
    }
    return {
      circles: [],
      polys: [
        poly([[50, 8], [60, 50], [50, 44]], B),
        poly([[50, 8], [40, 50], [50, 44]], Wt, B, 1),
        poly([[50, 92], [60, 50], [50, 56]], Wt, B, 1),
        poly([[50, 92], [40, 50], [50, 56]], B)
      ],
      text: { x: 50, y: 22, size: 12, fill: B }
    };
  }

  /**
   * Renderiza a Rosa dos Ventos / Seta Norte em SVG técnico nítido
   */
  static getNorthArrowSVG(style = 'classic', rotation = 0) {
    const m = this.northArrowModel(style);
    const rot = Number(rotation) || 0;
    const circles = m.circles.map(c => `<circle cx="50" cy="50" r="${c.r}" fill="none" stroke="#000" stroke-width="${c.w}"${c.dash ? ` stroke-dasharray="${c.dash.join(' ')}"` : ''}/>`).join('');
    const polys = m.polys.map(p => `<polygon points="${p.pts.map(q => q.join(',')).join(' ')}" fill="${p.fill === '#000000' ? '#000' : p.fill === '#ffffff' ? '#fff' : p.fill}"${p.stroke ? ` stroke="#000" stroke-width="${p.w}"` : ''}/>`).join('');
    const t = m.text;
    return `
      <svg viewBox="0 0 100 100" width="100%" height="100%" style="transform: rotate(${rot}deg); transition: transform 0.1s ease;">
        ${circles}${polys}
        <text x="${t.x}" y="${t.y}" font-family="Arial, sans-serif" font-size="${t.size}" font-weight="bold" text-anchor="middle" fill="${t.fill}">N</text>
      </svg>
    `;
  }

  /**
   * Renderiza a Barra de Escala Gráfica segmentada com precisão métrica
   */
  static renderScaleBar(item, mapScale = 10000) {
    const model = this.scaleBarModel(item, mapScale);
    // Comprimento absoluto (não %): a caixa tem recuo interno e a régua precisa medir exatamente
    // a distância rotulada. 3,78 px/mm = PrintCanvasEngine.BASE_PX_PER_MM (conteúdo a 100%).
    const barPx = (model.ratio * (item.width || 60) * 3.78).toFixed(2);

    return `
      <div class="cm-item-scale-bar">
        ${model.showText ? `<div style="font-size: 7.5px; font-weight: bold; margin-bottom: 2px;">${model.scaleText}</div>` : ''}
        <div class="cm-scale-bar-ruler" style="width: ${barPx}px;">
          ${'<div class="cm-scale-bar-seg"></div>'.repeat(model.segments)}
        </div>
        <div class="cm-scale-bar-labels" style="width: ${barPx}px;">
          ${model.labels.map(l => `<span style="left: ${(l.position * 100).toFixed(3)}%;">${this.escapeHtml(l.text)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  /** Itens desenhados em canvas pelo mesmo código da exportação (legenda e carimbo) */
  static CANVAS_ITEM_TYPES = new Set(['legend', 'title_block']);

  /** Legenda e carimbo na tela: um canvas (desenhado pelo compositor, igual à exportação) */
  static renderItemCanvas(item) {
    return `<canvas class="cm-item-canvas" data-item-canvas="${this.escapeHtml(item.id)}"></canvas>`;
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
        if (t !== 'polygon' && t !== 'multipolygon' && t !== 'linestring' && t !== 'line') return false;
        if (!Array.isArray(f.coordinates) || f.coordinates.length === 0) return false;
        const ring = Array.isArray(f.coordinates[0]) ? (Array.isArray(f.coordinates[0][0]) ? f.coordinates[0][0] : f.coordinates[0]) : f.coordinates;
        return Array.isArray(ring) && ring.length >= 2;
      });
    }

    if (!targetFeature || !Array.isArray(targetFeature.coordinates)) {
      return { featureName: 'Nenhuma Feição', vertices: [], totalArea: 0, totalPerimeter: 0 };
    }

    // Anel exterior: o primeiro polígono, mesmo que a feição tenha furos ou várias partes
    const isPolygon = (targetFeature.type || '').toLowerCase() === 'polygon';
    let rawCoords = targetFeature.coordinates;
    const depth = FeatureGeometryUtils.coordinateDepth(rawCoords);
    if (depth >= 4) rawCoords = rawCoords[0][0];
    else if (depth === 3) rawCoords = rawCoords[0];

    // Normaliza para array de [lat, lng]
    let points = rawCoords.map(c => {
      if (Array.isArray(c)) return [c[0], c[1]];
      if (c && typeof c.lat === 'number' && typeof c.lng === 'number') return [c.lat, c.lng];
      return null;
    }).filter(Boolean);
    if (isPolygon) points = FeatureGeometryUtils.openRing(points);

    if (points.length < 2) {
      return { featureName: targetFeature.name || 'Feição', vertices: [], totalArea: 0, totalPerimeter: 0 };
    }

    // Fuso e hemisfério médios; todos os vértices usam o mesmo fuso
    const avgLng = points.reduce((s, p) => s + p[1], 0) / points.length;
    const avgLat = points.reduce((s, p) => s + p[0], 0) / points.length;
    const utmZone = this.detectUtmZone(avgLng);
    const utmSouth = avgLat < 0;

    // Coordenadas UTM (Norte/Leste) de cada vértice
    const utmPoints = points.map(p => this.toUtmCoords(p[0], p[1], utmZone, utmSouth));

    // Distâncias e azimutes geodésicos no elipsoide (os mesmos do inspetor de feições);
    // distância e azimute de quadrícula UTM divergem até ~0,08% e pela convergência meridiana.
    const vertices = [];
    let totalPerimeter = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const curr = utmPoints[i];
      const geo = Geodesy.inverse(points[i], points[(i + 1) % n]);
      const dist = geo.distance;

      totalPerimeter += dist;

      vertices.push({
        name: `V${String(i + 1).padStart(2, '0')}`,
        lat: points[i][0],
        lng: points[i][1],
        northing: curr.northing.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        easting: curr.easting.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        distance: dist > 0 ? dist.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-',
        azimuth: dist > 0 ? this.formatAzimuth(geo.azimuth) : '-'
      });
    }

    // Área elipsoidal (a mesma do inspetor: furos subtraídos, partes somadas)
    const totalAreaM2 = isPolygon
      ? FeatureGeometryUtils.calculatePolygonArea(targetFeature.coordinates)
      : FeatureGeometryUtils.calculateSinglePolygonArea(points);

    return {
      featureName: targetFeature.name || 'Polígono Cadastrado',
      utmZone,
      utmHemisphere: utmSouth ? 'S' : 'N',
      vertices,
      totalAreaM2,
      totalAreaHa: totalAreaM2 / 10000,
      totalPerimeter
    };
  }

  /** Medidas da tabela de vértices em px de tela a 100% (1 mm = 3,78 px): tela e exportação partem delas */
  static VERT_TABLE = { FONT: 6.5, HEAD: 14, SUB: 12.5, ROW: 12.5, FOOT: 12.5, BORDER: 1.5, MIN_SCALE: 0.55, PX_PER_MM: 3.78,
    COLS: [
      { key: 'name', label: 'Vértice', pct: 0.15 },
      { key: 'northing', label: 'Norte (Y)', pct: 0.23 },
      { key: 'easting', label: 'Leste (X)', pct: 0.23 },
      { key: 'azimuth', label: 'Azimute geod.', pct: 0.21 },
      { key: 'distance', label: 'Dist. geod. (m)', pct: 0.18 }
    ] };

  /**
   * Como a tabela de vértices cabe no item: fator de escala da fonte e das linhas (pela altura e pelo
   * texto mais largo de cada coluna) e quantos vértices aparecem. Se nem na escala mínima cabem todos,
   * a última linha vira "+N vértices" (nunca some vértice em silêncio).
   * @returns {{ scale: number, shown: number, hidden: number, rowH: number }} rowH em px de tela a 100%
   */
  static verticesTableFit(data, wMm, hMm) {
    const T = this.VERT_TABLE;
    const vertices = data?.vertices || [];
    const n = vertices.length;
    const wPx = wMm * T.PX_PER_MM;
    const hPx = hMm * T.PX_PER_MM;
    const avail = Math.max(0, hPx - T.HEAD - T.SUB - (n ? T.FOOT : 0) - T.BORDER * 2);

    let scale = 1;
    T.COLS.slice(1).forEach(col => {
      const longest = Math.max(1, ...vertices.map(v => String(v[col.key] ?? '').length));
      scale = Math.min(scale, (wPx * col.pct) / (longest * 0.6 * T.FONT + 6)); // monoespaçada ≈ 0,6 em
    });
    if (n) scale = Math.min(scale, avail / (n * T.ROW));
    scale = Math.max(T.MIN_SCALE, Math.min(1, scale));

    const rowH = T.ROW * scale;
    const slots = Math.floor(avail / rowH);
    if (slots >= n) return { scale, shown: n, hidden: 0, rowH };
    const shown = Math.max(0, slots - 1); // a última vaga é o aviso "+N vértices"
    return { scale, shown, hidden: n - shown, rowH };
  }

  /** Rodapé da tabela de vértices (o mesmo texto na tela e na exportação) */
  static verticesFooterParts(data) {
    return {
      area: `${data.totalAreaM2.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²`,
      hectares: `(${data.totalAreaHa.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ha)`,
      perimeter: `${data.totalPerimeter.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m`
    };
  }

  /** Título do cabeçalho: sistema de referência só quando há vértices (sem fuso inventado) */
  static verticesTableDatum(data) {
    return data?.utmZone ? `SIRGAS 2000 UTM ${data.utmZone}${data.utmHemisphere || 'S'}` : '';
  }

  /**
   * Renderiza a Tabela de Vértices Topográfica em HTML para a folha
   */
  static renderVerticesTable(item, features = []) {
    const esc = this.escapeHtml.bind(this);
    const data = this.extractVerticesData(features, item.targetFeatureId);
    const T = this.VERT_TABLE;
    const fit = this.verticesTableFit(data, item.width || 80, item.height || 60);
    const foot = data.vertices.length > 0 ? this.verticesFooterParts(data) : null;
    const shownRows = data.vertices.slice(0, fit.shown);

    return `
      <div class="cm-item-vertices-table" style="--vt-s: ${fit.scale.toFixed(3)};">
        <div class="cm-tb-vert-header">
          <span class="cm-tb-vert-title">TABELA DE COORDENADAS E CONFRONTAÇÕES</span>
          <span class="cm-tb-vert-datum">${esc(this.verticesTableDatum(data))}</span>
        </div>
        <div class="cm-tb-vert-scroll">
          <table class="cm-vert-native-table">
            <colgroup>${T.COLS.map(c => `<col style="width: ${c.pct * 100}%">`).join('')}</colgroup>
            <thead>
              <tr>${T.COLS.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${data.vertices.length > 0 ? shownRows.map(v => `
                <tr>${T.COLS.map(c => `<td${c.key === 'name' ? ' class="vert-name"' : ''}>${esc(v[c.key])}</td>`).join('')}</tr>
              `).join('') + (fit.hidden > 0 ? `
                <tr class="vert-more"><td colspan="5">… +${fit.hidden} vértice(s) não cabem: aumente a tabela (total: ${data.vertices.length})</td></tr>
              ` : '') : `<tr><td colspan="5" class="vert-empty">Nenhum polígono selecionado</td></tr>`}
            </tbody>
          </table>
        </div>
        ${foot ? `
          <div class="cm-tb-vert-footer">
            <span>Área: <strong>${esc(foot.area)}</strong> ${esc(foot.hectares)}</span>
            <span>Perímetro: <strong>${esc(foot.perimeter)}</strong></span>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Renderiza o Bloco de Notas Técnicas / Texto Livre
   */
  /**
   * Renderiza a Moldura / Forma Geométrica Retangular Técnica
   */
  static renderShape(item) {
    const fill = this.sanitizeColor(item.fillColor, 'rgba(255, 255, 255, 0.5)');
    const stroke = this.sanitizeColor(item.strokeColor, '#000000');
    const strokeW = item.strokeWidth == null || item.strokeWidth === '' ? 1.5 : (Number(item.strokeWidth) || 0);
    const radius = Number(item.borderRadius) || 0;

    return `
      <div class="cm-item-shape-box" style="width: 100%; height: 100%; background: ${fill}; border: ${strokeW}px solid ${stroke}; border-radius: ${radius}px; box-sizing: border-box;"></div>
    `;
  }

  /**
   * Renderiza Logotipo ou Imagem Carregada
   */
  static renderImage(item) {
    const esc = this.escapeHtml.bind(this);
    if (!item.imageUrl) {
      return `
        <div class="cm-item-image-placeholder" style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.05); border: 1px dashed rgba(0,0,0,0.3); font-size: 8px; color: #555; text-align: center; padding: 4px; box-sizing: border-box;">
          <span>🖼️ Sem Imagem</span>
          <span style="font-size: 6.5px; opacity: 0.8;">Carregue o logotipo no painel</span>
        </div>
      `;
    }
    const fit = item.objectFit === 'cover' ? 'cover' : 'contain';
    return `
      <div class="cm-item-image-box" style="width: 100%; height: 100%; overflow: hidden; display: flex; align-items: center; justify-content: center;">
        <img src="${esc(item.imageUrl)}" alt="${esc(item.name || 'Imagem')}" style="width: 100%; height: 100%; object-fit: ${fit}; pointer-events: none;" />
      </div>
    `;
  }

  /**
   * Renderiza Rótulo de Texto Livre / Título Customizado
   */
  static renderLabel(item) {
    const esc = this.escapeHtml.bind(this);
    const text = item.text || this.LABEL_DEFAULT_TEXT;
    const fontSize = Number(item.fontSize) || 10;
    const weight = item.fontWeight === 'normal' ? 'normal' : 'bold';
    const color = this.sanitizeColor(item.textColor, '#000000');
    const align = ['left', 'right'].includes(item.textAlign) ? item.textAlign : 'center';
    const family = this.escapeHtml(this.fontStack(item));

    return `
      <div class="cm-item-label-box" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: ${align === 'center' ? 'center' : (align === 'right' ? 'flex-end' : 'flex-start')}; font-size: ${fontSize}px; font-weight: ${weight}; color: ${color}; text-align: ${align}; font-family: ${family}; white-space: pre-wrap; word-break: break-word; box-sizing: border-box; padding: 2px;">
        ${esc(text)}
      </div>
    `;
  }

  /** Pilha de fontes do item (sem `fontFamily` = Arial, como sempre foi); tela e PDF usam esta */
  static fontStack(item) {
    return item?.fontFamily ? PrintFonts.css(item.fontFamily) : 'Arial, sans-serif';
  }

  /** Textos padrão (item sem texto): o exportador usa os mesmos da tela */
  static LABEL_DEFAULT_TEXT = 'TÍTULO DO PROJETO';
  static TEXT_BLOCK_DEFAULT_TEXT = 'NOTAS TÉCNICAS:\n1. Coordenadas UTM referenciadas ao Datum SIRGAS 2000.\n2. Levantamento planialtimétrico executado com receptores GNSS RTK L1/L2.\n3. Limites e confrontações demarcados de acordo com memorial descritivo.';
  static TEXT_BLOCK_DEFAULT_TITLE = 'NOTAS GERAIS';

  static renderTextBlock(item) {
    const esc = this.escapeHtml.bind(this);
    const text = item.text || this.TEXT_BLOCK_DEFAULT_TEXT;
    const formatted = esc(text).replace(/\n/g, '<br>');

    return `
      <div class="cm-item-text-block" style="font-size: ${Number(item.fontSize) || 7.5}px;${item.fontFamily ? ` font-family: ${this.escapeHtml(this.fontStack(item))};` : ''}">
        <div class="cm-text-block-title">${esc(item.title || 'NOTAS GERAIS')}</div>
        <div class="cm-text-block-body">${formatted}</div>
      </div>
    `;
  }

  /**
   * Renderiza a Moldura e Rótulos da Grade Cartográfica Real no Mapa
   * Suporta formatos: 'crosses' (cruzetas e ticks), 'lines' (linhas completas), 'ticks' (somente bordas)
   * e rotação dos rótulos: 'vertical' (padrão técnico) ou 'horizontal'.
   */
  static renderMapGridBorder(mapBounds, mode = 'dms', format = 'crosses', labelRot = 'vertical') {
    const { xs, ys } = this.graticuleModel(mapBounds, mode);
    const esc = this.escapeHtml.bind(this);
    const pct = (f) => `${(f * 100).toFixed(3)}%`;

    const isLines = format === 'lines';
    const isCrosses = format === 'crosses' || !format;
    const isHorizLabel = labelRot === 'horizontal';

    return `
      <div class="cm-item-grid-border cm-grid-format-${esc(format)} ${isHorizLabel ? 'cm-grid-labels-horizontal' : ''}">
        ${isLines ? xs.map(x => `<span class="cm-grid-full-line cm-grid-line-v" style="left: ${pct(x.f)};"></span>`).join('') : ''}
        ${isLines ? ys.map(y => `<span class="cm-grid-full-line cm-grid-line-h" style="top: ${pct(y.f)};"></span>`).join('') : ''}
        ${xs.map(x => `
          <span class="cm-grid-tick cm-grid-tick-top" style="left: ${pct(x.f)};"></span>
          <span class="cm-grid-tick cm-grid-tick-bottom" style="left: ${pct(x.f)};"></span>
          <span class="cm-grid-label cm-grid-label-top" style="left: ${pct(x.f)};">${esc(x.label)}</span>
          <span class="cm-grid-label cm-grid-label-bottom" style="left: ${pct(x.f)};">${esc(x.label)}</span>
        `).join('')}
        ${ys.map(y => `
          <span class="cm-grid-tick cm-grid-tick-left" style="top: ${pct(y.f)};"></span>
          <span class="cm-grid-tick cm-grid-tick-right" style="top: ${pct(y.f)};"></span>
          <span class="cm-grid-label cm-grid-label-left ${isHorizLabel ? 'is-horizontal' : ''}" style="top: ${pct(y.f)};">${esc(y.label)}</span>
          <span class="cm-grid-label cm-grid-label-right ${isHorizLabel ? 'is-horizontal' : ''}" style="top: ${pct(y.f)};">${esc(y.label)}</span>
        `).join('')}
        ${isCrosses ? xs.map(x => ys.map(y => `<span class="cm-grid-cross" style="left: ${pct(x.f)}; top: ${pct(y.f)};"></span>`).join('')).join('') : ''}
      </div>
    `;
  }

  /** Margens ABNT da folha, em mm: 25 mm à esquerda (encadernação) e `marginO` nos demais lados */
  static abntMargins(paper = {}) {
    const o = Number.isFinite(paper.marginO) ? paper.marginO : 7;
    const l = Number.isFinite(paper.marginL) ? paper.marginL : 25;
    return { top: o, right: o, bottom: o, left: l };
  }

  /**
   * Margens em vigor na folha (mm). `paper.margins` guarda só as personalizadas; sem ele vale a ABNT.
   * Fonte única para moldura, alinhamento, guias, layout padrão e exportação.
   */
  static sheetMargins(paper = {}) {
    return paper.margins ? this.sanitizeMargins(paper.margins, paper) : this.abntMargins(paper);
  }

  /** Margens válidas: números ≥ 0, arredondados a 0,5 mm, deixando ao menos 2 × MIN_ITEM_MM úteis em cada eixo */
  static sanitizeMargins(margins = {}, paper = {}) {
    const base = this.abntMargins(paper);
    const minUsable = 2 * this.MIN_ITEM_MM;
    const num = (v, fb) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.round(n * 2) / 2) : fb;
    };
    const m = {
      top: num(margins.top, base.top),
      right: num(margins.right, base.right),
      bottom: num(margins.bottom, base.bottom),
      left: num(margins.left, base.left)
    };
    const fit = (a, b, size) => {
      const max = Number.isFinite(size) ? Math.max(0, size - minUsable) : Infinity;
      if (m[a] + m[b] <= max) return;
      const k = max / (m[a] + m[b]);
      m[a] = Math.floor(m[a] * k * 2) / 2;
      m[b] = Math.floor(m[b] * k * 2) / 2;
    };
    fit('left', 'right', paper.width);
    fit('top', 'bottom', paper.height);
    return m;
  }

  static isAbntMargins(paper = {}) {
    const a = this.abntMargins(paper);
    const m = this.sheetMargins(paper);
    return ['top', 'right', 'bottom', 'left'].every(k => m[k] === a[k]);
  }

  /**
   * Folha com as margens dadas. Iguais às ABNT, a folha volta ao padrão (sem `margins`). Retorna cópia.
   */
  static withMargins(paper, margins) {
    const { margins: _old, ...base } = paper;
    if (!margins) return base;
    const m = this.sanitizeMargins(margins, base);
    const a = this.abntMargins(base);
    return ['top', 'right', 'bottom', 'left'].every(k => m[k] === a[k]) ? base : { ...base, margins: m };
  }

  /** Itens de tamanho físico fixo: não esticam com a folha (o texto interno tem tamanho fixo em pt) */
  static FIXED_SIZE_TYPES = new Set(['north_arrow', 'scale_bar', 'title_block', 'label']);

  /** Itens que mantêm a proporção ao serem reescalados */
  static KEEP_ASPECT_TYPES = new Set(['north_arrow', 'image']);

  /**
   * Reajusta os itens de uma folha para outra. Retorna cópias.
   * - Mudou a orientação (paisagem x retrato): os itens do layout padrão (mesmos ids) assumem a
   *   posição e o tamanho do layout padrão da nova folha, mantendo todo o conteúdo e a vista;
   *   os demais são reescalados.
   * - Mesma orientação: mapa, localização, legenda etc. acompanham a área útil; carimbo, barra de
   *   escala, seta norte e rótulos mantêm o tamanho e ficam presos à borda mais próxima da área
   *   útil (a ida e volta devolve o item ao lugar original).
   */
  static fitItemsToPaper(items = [], fromPaper, toPaper) {
    const usable = (p) => {
      const m = this.sheetMargins(p);
      return { x: m.left, y: m.top, w: p.width - m.left - m.right, h: p.height - m.top - m.bottom };
    };
    const from = usable(fromPaper);
    const to = usable(toPaper);
    const sx = to.w / from.w;
    const sy = to.h / from.h;
    const round = (v) => Math.round(v * 10) / 10;
    const clampPos = (it) => {
      it.x = round(Math.max(0, Math.min(toPaper.width - it.width, it.x)));
      it.y = round(Math.max(0, Math.min(toPaper.height - it.height, it.y)));
    };

    const orientationChanged = (fromPaper.width >= fromPaper.height) !== (toPaper.width >= toPaper.height);
    // Layout ainda intacto (nada movido ou redimensionado)? Então segue o layout padrão da nova folha
    const near = (a, b) => Math.abs(a - b) <= 0.5;
    const origDefaults = new Map(this.createDefaultItems('Projeto', fromPaper).map(d => [d.id, d]));
    const pristine = items.every(i => {
      const d = origDefaults.get(i.id);
      return !d || (near(i.x, d.x) && near(i.y, d.y) && near(i.width, d.width) && near(i.height, d.height));
    });
    const defaults = (orientationChanged || pristine)
      ? new Map(this.createDefaultItems('Projeto', toPaper).map(d => [d.id, d]))
      : null;

    return items.map(src => {
      const it = JSON.parse(JSON.stringify(src));

      const def = defaults && defaults.get(src.id);
      if (def) {
        it.x = def.x; it.y = def.y; it.width = def.width; it.height = def.height;
        return it;
      }

      if (this.FIXED_SIZE_TYPES.has(src.type)) {
        // Mantém o tamanho e a distância até a borda (esquerda/direita, topo/base) mais próxima
        const cx = src.x + src.width / 2;
        const cy = src.y + src.height / 2;
        const midX = from.x + from.w / 2;
        const midY = from.y + from.h / 2;
        it.width = src.width;
        it.height = src.height;
        it.x = cx <= midX ? to.x + (src.x - from.x) : to.x + to.w - (from.x + from.w - (src.x + src.width)) - src.width;
        it.y = cy <= midY ? to.y + (src.y - from.y) : to.y + to.h - (from.y + from.h - (src.y + src.height)) - src.height;
        clampPos(it);
        return it;
      }

      const keep = this.KEEP_ASPECT_TYPES.has(it.type);
      const ux = keep ? Math.min(sx, sy) : sx;
      const uy = keep ? Math.min(sx, sy) : sy;
      it.width = round(Math.min(toPaper.width, Math.max(10, src.width * ux)));
      it.height = round(Math.min(toPaper.height, Math.max(10, src.height * uy)));
      // Posiciona pelo centro do item, para que itens que mantêm a proporção não saiam do lugar
      const cx = to.x + (src.x + src.width / 2 - from.x) * sx;
      const cy = to.y + (src.y + src.height / 2 - from.y) * sy;
      it.x = cx - it.width / 2;
      it.y = cy - it.height / 2;
      clampPos(it);
      return it;
    });
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
    const margins = this.sheetMargins(size);
    const mL = margins.left;
    const mO = margins.top;
    const utilW = size.width - margins.left - margins.right;
    const utilH = size.height - margins.top - margins.bottom;

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
      case 'shape':
        return {
          id: `item-shape-${ts}`,
          type: 'shape',
          name: 'Moldura Técnica',
          x: 25,
          y: 20,
          width: 70,
          height: 45,
          locked: false,
          visible: true,
          fillColor: 'rgba(255, 255, 255, 0.4)',
          strokeColor: '#000000',
          strokeWidth: 1.5,
          borderRadius: 0
        };
      case 'image':
        return {
          id: `item-img-${ts}`,
          type: 'image',
          name: 'Logotipo / Imagem',
          x: 25,
          y: 20,
          width: 45,
          height: 30,
          locked: false,
          visible: true,
          imageUrl: '',
          objectFit: 'contain'
        };
      case 'label':
        return {
          id: `item-label-${ts}`,
          type: 'label',
          name: 'Título Customizado',
          x: 25,
          y: 15,
          width: 110,
          height: 14,
          locked: false,
          visible: true,
          text: 'LEVANTAMENTO TOPOGRÁFICO',
          fontSize: 10,
          fontWeight: 'bold',
          textColor: '#000000',
          textAlign: 'center'
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

