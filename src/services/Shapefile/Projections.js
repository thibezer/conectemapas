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

// Registra fusos UTM comuns do Brasil (Zonas 18S a 25S)
for (let zone = 18; zone <= 25; zone++) {
  // SIRGAS 2000 UTM
  const sirgasCode = `EPSG:${31960 + zone}`; // 31978 (18S) a 31985 (25S)
  const sirgasProj = `+proj=utm +zone=${zone} +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs`;
  BRAZILIAN_PROJECTIONS[sirgasCode] = sirgasProj;
  proj4.defs(sirgasCode, sirgasProj);

  // SAD69 UTM
  const sadCode = `EPSG:${29170 + zone}`; // 29188 a 29195
  const sadProj = `+proj=utm +zone=${zone} +south +ellps=aust_SA +towgs84=-66.87,4.37,-38.52,0,0,0,0 +units=m +no_defs`;
  BRAZILIAN_PROJECTIONS[sadCode] = sadProj;
  proj4.defs(sadCode, sadProj);

  // WGS 84 UTM
  const wgsCode = `EPSG:${32700 + zone}`;
  const wgsProj = `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`;
  BRAZILIAN_PROJECTIONS[wgsCode] = wgsProj;
  proj4.defs(wgsCode, wgsProj);
}

// Registra projeções geográficas
Object.entries(BRAZILIAN_PROJECTIONS).forEach(([code, def]) => {
  proj4.defs(code, def);
});
