/* ==========================================================================
   ConecteMapas - PrjParser
   Responsabilidade Única: Identificação e parsing de projeções ESRI .PRJ

   Regras:
   - Geográfica (GEOGCS) x projetada (PROJCS) vem da estrutura do WKT, nunca do nome do datum:
     "SIRGAS 2000 / Brazil Polyconic" é projetada, mesmo citando SIRGAS.
   - UTM só é reconhecido com fuso explícito; o hemisfério vem do sufixo N/S do nome ou do
     False_Northing (0 = norte, 10.000.000 = sul).
   - SAD69 e Córrego Alegre vindos do ESRI (sem TOWGS84) recebem os parâmetros de transformação
     do datum, senão a posição fica deslocada dezenas de metros.
   ========================================================================== */

import proj4 from 'proj4';
import { BRAZILIAN_PROJECTIONS, utmProjection } from './Projections.js';

const DATUM_SHIFTS = {
  sad69: [-66.87, 4.37, -38.52, 0, 0, 0, 0],
  corrego: [-205.57, 168.77, -3.68, 0, 0, 0, 0]
};

let customCounter = 0;

function detectDatum(upper) {
  // O nome do datum/GEOGCS é mais confiável que o texto inteiro (que cita elipsoides e projeções)
  const datumName = (upper.match(/DATUM\s*\[\s*"([^"]+)"/) || [])[1] || '';
  const geogName = (upper.match(/GEOG(?:CS|CRS)\s*\[\s*"([^"]+)"/) || [])[1] || '';
  const ident = `${datumName} ${geogName}`.trim() || upper;

  if (/SIRGAS|SISTEMA_DE_REFERENCIA_GEOCENTRICO/.test(ident)) return 'sirgas';
  if (/CORREGO[_\s]*ALEGRE/.test(ident)) return 'corrego';
  if (/SAD[_\s-]?(19)?69|SOUTH[_\s]*AMERICAN[_\s]*(DATUM[_\s]*)?1969|(^|[^A-Z])SAD([^A-Z]|$)/.test(ident)) return 'sad69';
  if (/WGS[_\s-]*(19)?84/.test(ident)) return 'wgs84';
  return null;
}

function detectUtm(upper) {
  const m = upper.match(/UTM[_\s-]*(?:ZONE|FUSO)?[_\s-]*(\d{1,2})[_\s]*(N|S|NORTH|SOUTH|NORTE|SUL)?(?![A-Z])/);
  if (!m) return null;
  const zone = parseInt(m[1], 10);
  if (zone < 1 || zone > 60) return null;

  let south;
  if (m[2]) {
    south = m[2][0] === 'S';
  } else {
    const fn = upper.match(/FALSE_NORTHING"?\s*,\s*(-?[\d.]+)/);
    south = fn ? parseFloat(fn[1]) >= 5000000 : true; // sem indício: padrão do Brasil
  }
  return { zone, south };
}

export class PrjParser {
  /**
   * Parseia arquivo .PRJ (Sistema de Referência de Coordenadas)
   * @param {ArrayBuffer} prjBuffer
   * @returns {{wkt: string, epsg: string, name: string, isWGS84: boolean, proj4def?: string, proj4Key?: string}}
   */
  static parse(prjBuffer) {
    if (!prjBuffer) {
      return { wkt: '', epsg: 'EPSG:4326', name: 'WGS 84 (Padrão)', isWGS84: true };
    }

    const wkt = new TextDecoder('utf-8').decode(prjBuffer).trim();
    if (!wkt) {
      return { wkt: '', epsg: 'EPSG:4326', name: 'WGS 84 (Padrão)', isWGS84: true };
    }
    const upper = wkt.toUpperCase();

    const isProjected = /(PROJCS|PROJCRS)\s*\[/.test(upper);
    const datum = detectDatum(upper);

    if (isProjected) {
      // 1. UTM com fuso explícito
      const utm = detectUtm(upper);
      if (utm && datum && datum !== 'corrego') {
        const { epsg, def, name } = utmProjection(datum, utm.zone, utm.south);
        return { wkt, epsg, name, isWGS84: false, proj4def: def, proj4Key: epsg };
      }
      // 2. Web Mercator
      if (/3857|WEB_MERCATOR|PSEUDO_MERCATOR|MERCATOR_AUXILIARY_SPHERE/.test(upper)) {
        return { wkt, epsg: 'EPSG:3857', name: 'WGS 84 / Pseudo-Mercator (EPSG:3857)', isWGS84: false, proj4def: BRAZILIAN_PROJECTIONS['EPSG:3857'], proj4Key: 'EPSG:3857' };
      }
      // 3. Qualquer outra projeção (Policônica, Albers, Lambert, UTM de outro país...): usa o próprio WKT
      return this.fromWkt(wkt, upper, datum, 'Projeção Personalizada (WKT)');
    }

    // Geográficas
    if (datum === 'sirgas') {
      return { wkt, epsg: 'EPSG:4674', name: 'SIRGAS 2000 (Geográficas)', isWGS84: false, proj4def: BRAZILIAN_PROJECTIONS['EPSG:4674'], proj4Key: 'EPSG:4674' };
    }
    if (datum === 'sad69') {
      return { wkt, epsg: 'EPSG:4618', name: 'SAD69 (Geográficas)', isWGS84: false, proj4def: BRAZILIAN_PROJECTIONS['EPSG:4618'], proj4Key: 'EPSG:4618' };
    }
    if (datum === 'corrego') {
      return { wkt, epsg: 'EPSG:4225', name: 'Córrego Alegre (Geográficas)', isWGS84: false, proj4def: BRAZILIAN_PROJECTIONS['EPSG:4225'], proj4Key: 'EPSG:4225' };
    }
    if (datum === 'wgs84') {
      return { wkt, epsg: 'EPSG:4326', name: 'WGS 84 (Geográficas)', isWGS84: true };
    }

    return this.fromWkt(wkt, upper, datum, 'Geográfica Personalizada (WKT)');
  }

  /**
   * Registra o WKT no proj4 sob uma chave própria (sem sobrescrever leituras anteriores) e,
   * para SAD69/Córrego Alegre sem TOWGS84, injeta os parâmetros de transformação do datum.
   */
  static fromWkt(wkt, upper, datum, name) {
    const key = `CUSTOM_PRJ_${++customCounter}`;
    try {
      proj4.defs(key, wkt);
      const def = proj4.defs(key);
      if (!def) throw new Error('WKT não reconhecido');
      if (!/TOWGS84/.test(upper) && DATUM_SHIFTS[datum] && !def.datum_params) {
        def.datum_params = [...DATUM_SHIFTS[datum]];
      }
      return { wkt, epsg: 'CUSTOM_PRJ', name, isWGS84: false, proj4def: wkt, proj4Key: key };
    } catch {
      return { wkt, epsg: 'EPSG:4326', name: 'WGS 84 (Geográficas)', isWGS84: true, unrecognized: true };
    }
  }
}
