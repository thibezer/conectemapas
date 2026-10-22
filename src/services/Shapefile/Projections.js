/* ==========================================================================
   ConecteMapas - Projections
   Responsabilidade Única: Definições de datums e projeções cartográficas brasileiras
   ========================================================================== */

import proj4 from 'proj4';

export const BRAZILIAN_PROJECTIONS = {
  'EPSG:4674': '+proj=longlat +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +no_defs', // SIRGAS 2000 Geográficas
  'EPSG:4618': '+proj=longlat +ellps=aust_SA +towgs84=-66.87,4.37,-38.52,0,0,0,0 +no_defs', // SAD69 Geográficas
  'EPSG:4225': '+proj=longlat +ellps=intl +towgs84=-205.57,168.77,-3.68,0,0,0,0 +no_defs', // Córrego Alegre
  'EPSG:4326': '+proj=longlat +datum=WGS84 +no_defs', // WGS 84
  'EPSG:3857': '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs' // Web Mercator
};

/** Parâmetros de datum por família UTM (códigos EPSG: base + fuso). */
const UTM_DATUMS = {
  sirgas: { label: 'SIRGAS 2000', params: '+ellps=GRS80 +towgs84=0,0,0,0,0,0,0', southBase: 31960, northBase: 31954 },
  sad69: { label: 'SAD69', params: '+ellps=aust_SA +towgs84=-66.87,4.37,-38.52,0,0,0,0', southBase: 29170, northBase: 29150 },
  wgs84: { label: 'WGS 84', params: '+datum=WGS84', southBase: 32700, northBase: 32600 }
};

// Fusos do Brasil: 18S a 25S e 18N a 22N (Roraima, Amapá e norte do Amazonas/Pará)
const SOUTH_ZONES = [18, 19, 20, 21, 22, 23, 24, 25];
const NORTH_ZONES = [18, 19, 20, 21, 22];

function utmDefinition(datum, zone, south) {
  return `+proj=utm +zone=${zone}${south ? ' +south' : ''} ${UTM_DATUMS[datum].params} +units=m +no_defs`;
}

for (const datum of Object.keys(UTM_DATUMS)) {
  const { southBase, northBase } = UTM_DATUMS[datum];
  for (const zone of SOUTH_ZONES) {
    BRAZILIAN_PROJECTIONS[`EPSG:${southBase + zone}`] = utmDefinition(datum, zone, true);
  }
  for (const zone of NORTH_ZONES) {
    BRAZILIAN_PROJECTIONS[`EPSG:${northBase + zone}`] = utmDefinition(datum, zone, false);
  }
}

// Registra projeções geográficas e UTM
Object.entries(BRAZILIAN_PROJECTIONS).forEach(([code, def]) => {
  proj4.defs(code, def);
});

/**
 * Projeção UTM de um datum/fuso/hemisfério. Fusos do Brasil usam o código EPSG oficial;
 * fora deles (ou datum desconhecido) a definição é registrada sob um código interno `CM_UTM_*`.
 * @param {'sirgas'|'sad69'|'wgs84'} datum
 * @param {number} zone fuso UTM (1–60)
 * @param {boolean} south hemisfério sul
 * @returns {{ epsg: string, def: string, name: string }}
 */
export function utmProjection(datum, zone, south = true) {
  const info = UTM_DATUMS[datum] || UTM_DATUMS.sirgas;
  const key = UTM_DATUMS[datum] ? datum : 'sirgas';
  const hemi = south ? 'S' : 'N';
  const name = `${info.label} / UTM Fuso ${zone}${hemi}`;
  const brazilian = (south ? SOUTH_ZONES : NORTH_ZONES).includes(zone);
  const epsg = brazilian
    ? `EPSG:${(south ? info.southBase : info.northBase) + zone}`
    : `CM_UTM_${key.toUpperCase()}_${zone}${hemi}`;
  if (!BRAZILIAN_PROJECTIONS[epsg]) {
    BRAZILIAN_PROJECTIONS[epsg] = utmDefinition(key, zone, south);
    proj4.defs(epsg, BRAZILIAN_PROJECTIONS[epsg]);
  }
  return { epsg, def: BRAZILIAN_PROJECTIONS[epsg], name };
}
