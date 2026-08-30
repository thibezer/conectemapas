/* ==========================================================================
   ConecteMapas - PrjParser
   Responsabilidade Única: Identificação e parsing de projeções ESRI .PRJ
   ========================================================================== */

import proj4 from 'proj4';
import { BRAZILIAN_PROJECTIONS } from './Projections.js';

export class PrjParser {
  /**
   * Parseia arquivo .PRJ (Sistema de Referência de Coordenadas)
   * @param {ArrayBuffer} prjBuffer
   */
  static parse(prjBuffer) {
    if (!prjBuffer) {
      return { wkt: '', epsg: 'EPSG:4326', name: 'WGS 84 (Padrão)', isWGS84: true };
    }

    const wkt = new TextDecoder('utf-8').decode(prjBuffer).trim();
    const upper = wkt.toUpperCase();

    // 1. Detecção de SIRGAS 2000 UTM
    const utmMatch = upper.match(/UTM[_\s]+ZONE[_\s]+(\d+)[_\s]*(S|SOUTH)?/i) || upper.match(/FUSO[_\s]+(\d+)[_\s]*(S|SUL)?/i);
    const isSirgas = upper.includes('SIRGAS') || upper.includes('GRS_1980') || upper.includes('GRS80');
    const isSad69 = upper.includes('SAD') || upper.includes('SOUTH_AMERICAN_DATUM_1969') || upper.includes('AUST_SA');
    const isWgs84 = upper.includes('WGS_1984') || upper.includes('WGS84');

    if (utmMatch) {
      const zone = parseInt(utmMatch[1], 10);
      if (zone >= 18 && zone <= 25) {
        if (isSirgas) {
          const epsg = `EPSG:${31960 + zone}`;
          return { wkt, epsg, name: `SIRGAS 2000 / UTM Fuso ${zone}S`, isWGS84: false, proj4def: BRAZILIAN_PROJECTIONS[epsg] };
        }
        if (isSad69) {
          const epsg = `EPSG:${29170 + zone}`;
          return { wkt, epsg, name: `SAD69 / UTM Fuso ${zone}S`, isWGS84: false, proj4def: BRAZILIAN_PROJECTIONS[epsg] };
        }
        if (isWgs84) {
          const epsg = `EPSG:${32700 + zone}`;
          return { wkt, epsg, name: `WGS 84 / UTM Fuso ${zone}S`, isWGS84: false, proj4def: BRAZILIAN_PROJECTIONS[epsg] };
        }
      }
    }

    // 2. Geográficas
    if (isSirgas && !utmMatch) {
      return { wkt, epsg: 'EPSG:4674', name: 'SIRGAS 2000 (Geográficas)', isWGS84: false, proj4def: BRAZILIAN_PROJECTIONS['EPSG:4674'] };
    }
    if (isSad69 && !utmMatch) {
      return { wkt, epsg: 'EPSG:4618', name: 'SAD69 (Geográficas)', isWGS84: false, proj4def: BRAZILIAN_PROJECTIONS['EPSG:4618'] };
    }
    if (upper.includes('3857') || upper.includes('WEB_MERCATOR') || upper.includes('PSEUDO_MERCATOR')) {
      return { wkt, epsg: 'EPSG:3857', name: 'WGS 84 / Pseudo-Mercator (EPSG:3857)', isWGS84: false, proj4def: BRAZILIAN_PROJECTIONS['EPSG:3857'] };
    }

    // 3. Tenta passar o WKT diretamente para o proj4
    try {
      proj4.defs('CUSTOM_PRJ', wkt);
      return { wkt, epsg: 'CUSTOM_PRJ', name: 'Projeção Personalizada (WKT)', isWGS84: false, proj4def: wkt };
    } catch {
      return { wkt, epsg: 'EPSG:4326', name: 'WGS 84 (Geográficas)', isWGS84: true };
    }
  }
}
