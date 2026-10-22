/* ==========================================================================
   ConecteMapas - Motor geodésico (regressão)
   Verifica:
   1. UTM SIRGAS 2000 (proj4) contra a série de Redfearn (referência independente).
   2. Geodesy / FeatureGeometryUtils: distância e azimute elipsoidais (linha Flinders Peak–Buninyong,
      referência publicada da Geoscience Australia) e área elipsoidal.
   3. PrjParser: UTM norte/sul, projeções não-UTM (Policônica), datum SAD69 geográfico, WGS84.
   4. Shapefile: partes disjuntas viram feições com área própria; furo continua furo; ida e volta
      do escritor; coordenadas inválidas nunca entram no projeto.
   5. GeoJSON/KML: MultiPolygon importado por parte; polígono com furo exportado como Polygon.
   6. Impressão: UTM do hemisfério norte, tabela de vértices geodésica, segundos sem "60".
   7. DXF: parseDxf não lança e projeta as entidades para lat/lng.
   ========================================================================== */

import assert from 'assert';
import proj4 from 'proj4';
import { Geodesy } from '../src/services/Geodesy.js';
import { FeatureGeometryUtils as G } from '../src/services/MapEngine/FeatureGeometryUtils.js';
import { BRAZILIAN_PROJECTIONS } from '../src/services/Shapefile/Projections.js';
import { PrjParser } from '../src/services/Shapefile/PrjParser.js';
import { ShapefileParser } from '../src/services/ShapefileParser.js';
import { ShapefileWriter } from '../src/services/Shapefile/ShapefileWriter.js';
import { ShpParser } from '../src/services/Shapefile/ShpParser.js';
import { GeoJsonConverter } from '../src/services/GeoFormats/GeoJsonConverter.js';
import { KmlConverter } from '../src/services/GeoFormats/KmlConverter.js';
import { PrintItemsManager as P } from '../src/components/PrintComposer/PrintItemsManager.js';
import { DwgDxfParser } from '../src/services/CadFormats/DwgDxfParser.js';

console.log('--- Iniciando Teste do Motor Geodésico ---');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: obtido ${a}, esperado ${b} (±${tol})`);
const enc = (s) => new TextEncoder().encode(s).buffer;
const sq = (lat, lng, d) => [[lat, lng], [lat + d, lng], [lat + d, lng + d], [lat, lng + d]];

// ---------------------------------------------------------------------------
// 1. UTM SIRGAS 2000 contra Redfearn (série de Snyder, GRS80)
// ---------------------------------------------------------------------------
function redfearn(latDeg, lonDeg, lon0Deg, FN) {
  const rad = (d) => d * Math.PI / 180;
  const a = 6378137, f = 1 / 298.257222101, k0 = 0.9996, FE = 500000;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const p = rad(latDeg), l = rad(lonDeg), l0 = rad(lon0Deg);
  const N = a / Math.sqrt(1 - e2 * Math.sin(p) ** 2);
  const T = Math.tan(p) ** 2, C = ep2 * Math.cos(p) ** 2, A = (l - l0) * Math.cos(p);
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * p
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * p)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * p)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * p));
  const x = FE + k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120);
  const y = FN + k0 * (M + N * Math.tan(p) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24
    + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
  return [x, y];
}

for (const [lat, lon, zone] of [[-15.7939, -47.8828, 23], [-30.03, -51.23, 22], [-8.05, -34.88, 25], [-9.97, -67.81, 19]]) {
  const def = BRAZILIAN_PROJECTIONS[`EPSG:${31960 + zone}`];
  assert.ok(def, `fuso ${zone}S registrado`);
  const [x, y] = proj4('EPSG:4326', def, [lon, lat]);
  const [rx, ry] = redfearn(lat, lon, -183 + 6 * zone, 10000000);
  near(x, rx, 0.001, `E fuso ${zone}S`);
  near(y, ry, 0.001, `N fuso ${zone}S`);
}
// Norte (Roraima/Amapá): fusos 18N–22N com False_Northing 0
{
  const def = BRAZILIAN_PROJECTIONS['EPSG:31975']; // SIRGAS 2000 / UTM 21N
  assert.ok(def && !def.includes('+south'), 'EPSG:31975 é hemisfério norte');
  const [x, y] = proj4('EPSG:4326', def, [-55.5, 2.5]);
  const [rx, ry] = redfearn(2.5, -55.5, -57, 0);
  near(x, rx, 0.001, 'E 21N'); near(y, ry, 0.001, 'N 21N');
}

// ---------------------------------------------------------------------------
// 2. Distância, azimute e área elipsoidais
// ---------------------------------------------------------------------------
{
  // Flinders Peak -> Buninyong (GRS80): 54 972,271 m, azimute 306°52'05,37"
  const flinders = [-(37 + 57 / 60 + 3.72030 / 3600), 144 + 25 / 60 + 29.52440 / 3600];
  const buninyong = [-(37 + 39 / 60 + 10.15610 / 3600), 143 + 55 / 60 + 35.38390 / 3600];
  const r = Geodesy.inverse(flinders, buninyong);
  near(r.distance, 54972.271, 0.002, 'distância Flinders–Buninyong');
  near(r.azimuth, 306 + 52 / 60 + 5.37 / 3600, 0.00001, 'azimute Flinders–Buninyong');
  near(G.calculateDistance(flinders, buninyong), 54972.271, 0.002, 'FeatureGeometryUtils.calculateDistance é geodésico');
  near(G.calculateBearing(flinders, buninyong), 306 + 52 / 60 + 5.37 / 3600, 0.00001, 'FeatureGeometryUtils.calculateBearing é geodésico');

  // Haversine daria +0,49% ao longo do meridiano em -15,79°: 0,01° de latitude = 1106,565 m no elipsoide
  near(G.calculateDistance([-15.79, -47.88], [-15.78, -47.88]), 1106.565, 0.002, 'norte–sul de 0,01°');
  near(G.calculateDistance([-15.79, -47.88], [-15.79, -47.87]), 1071.455, 0.002, 'leste–oeste de 0,01°');
  assert.strictEqual(G.calculateDistance([-15.79, -47.88], [-15.79, -47.88]), 0, 'pontos iguais');
  // Azimute de 45° em coordenadas: a esfera erraria ~10′
  near(G.calculateBearing([-15.79, -47.88], [-15.78, -47.87]), 44.07852, 0.0001, 'azimute diagonal');

  // Área: faixa entre paralelos e meridianos tem solução fechada (latitude autálica)
  const a = 6378137, f = 1 / 298.257222101, e2 = f * (2 - f), e = Math.sqrt(e2);
  const q = (phi) => { const s = Math.sin(phi); return (1 - e2) * (s / (1 - e2 * s * s) - (1 / (2 * e)) * Math.log((1 - e * s) / (1 + e * s))); };
  const exact = (la, dla, dlo) => (a * a * q(Math.PI / 2) / 2) * (dlo * Math.PI / 180) * (q((la + dla) * Math.PI / 180) - q(la * Math.PI / 180)) / q(Math.PI / 2);
  for (const [la, lo, dla, dlo] of [[-15.80, -47.90, 0.001, 0.001], [-16.7, -49.3, 0.03, 0.03], [-3, -60, 0.5, 0.5]]) {
    const ring = [[la, lo], [la + dla, lo], [la + dla, lo + dlo], [la, lo + dlo]];
    const ex = exact(la, dla, dlo);
    assert.ok(Math.abs(G.calculatePolygonArea(ring) - ex) / ex < 1e-4, `área elipsoidal em ${la}`);
  }
  // Perímetro de um quadrado de 0,01°: soma de geodésicas, não esfera
  const ring = sq(-15.79, -47.88, 0.01);
  const perim = G.calculatePolygonPerimeter(ring);
  const edges = ring.map((p, i) => Geodesy.distance(p, ring[(i + 1) % ring.length]));
  near(perim, edges.reduce((a, b) => a + b, 0), 1e-9, 'perímetro = soma das geodésicas (com o lado de fechamento)');
  near(edges[0], 1106.565, 0.002, 'lado norte–sul');
  // arco de paralelo em -15,78°: N·cos(φ)·Δλ (a geodésica de 1 km difere disso em ~1e-9)
  const phi = -15.78 * Math.PI / 180;
  const arcParalelo = (6378137 / Math.sqrt(1 - 0.00669438002290 * Math.sin(phi) ** 2)) * Math.cos(phi) * (0.01 * Math.PI / 180);
  near(edges[1], arcParalelo, 0.001, 'lado leste–oeste');
}

// ---------------------------------------------------------------------------
// 3. PrjParser
// ---------------------------------------------------------------------------
{
  const SIRGAS = 'GEOGCS["GCS_SIRGAS_2000",DATUM["D_SIRGAS_2000",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
  const SAD69 = 'GEOGCS["GCS_South_American_1969",DATUM["D_South_American_1969",SPHEROID["GRS_1967_Truncated",6378160.0,298.25]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
  const WGS = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
  const utm = (name, geog, cm, fn) => `PROJCS["${name}",${geog},PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",${fn}],PARAMETER["Central_Meridian",${cm}],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]`;
  const reproject = (wkt, xy) => {
    const info = PrjParser.parse(enc(wkt));
    const [lat, lng] = ShapefileParser.reprojectGeometry([xy[1], xy[0]], 'Point', info, null);
    return { info, lat, lng };
  };

  // SIRGAS UTM 23S
  let wkt = utm('SIRGAS_2000_UTM_Zone_23S', SIRGAS, -45.0, '10000000.0');
  let xy = proj4(wkt).forward([-47.8828, -15.7939]);
  let r = reproject(wkt, xy);
  assert.strictEqual(r.info.epsg, 'EPSG:31983');
  near(r.lat, -15.7939, 1e-8, 'lat UTM 23S'); near(r.lng, -47.8828, 1e-8, 'lng UTM 23S');

  // SIRGAS UTM 21N: antes lido como 21S (latitude -87°)
  wkt = utm('SIRGAS_2000_UTM_Zone_21N', SIRGAS, -57.0, '0.0');
  xy = proj4(wkt).forward([-55.5, 2.5]);
  r = reproject(wkt, xy);
  assert.strictEqual(r.info.epsg, 'EPSG:31975', 'UTM norte reconhecido como norte');
  near(r.lat, 2.5, 1e-8, 'lat UTM 21N'); near(r.lng, -55.5, 1e-8, 'lng UTM 21N');

  // Sufixo ausente: o False_Northing decide o hemisfério
  wkt = utm('SIRGAS_2000_UTM_Zone_20', SIRGAS, -63.0, '0.0');
  assert.strictEqual(PrjParser.parse(enc(wkt)).epsg, 'EPSG:31974', 'sem sufixo, FN=0 é norte');

  // Policônica do IBGE (SIRGAS projetada, não UTM): antes virava "geográfica" com latitude de 8 milhões
  wkt = `PROJCS["SIRGAS_2000_Brazil_Polyconic",${SIRGAS},PROJECTION["Polyconic"],PARAMETER["False_Easting",5000000.0],PARAMETER["False_Northing",10000000.0],PARAMETER["Central_Meridian",-54.0],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]`;
  xy = proj4(wkt).forward([-47.8828, -15.7939]);
  r = reproject(wkt, xy);
  assert.notStrictEqual(r.info.epsg, 'EPSG:4674', 'projetada não é geográfica');
  near(r.lat, -15.7939, 1e-7, 'lat Policônica'); near(r.lng, -47.8828, 1e-7, 'lng Policônica');

  // SAD69 geográfica ESRI (sem TOWGS84): deve receber o deslocamento de datum (~68 m)
  r = reproject(SAD69, [-47.8828, -15.7939]);
  assert.strictEqual(r.info.epsg, 'EPSG:4618');
  const shift = Geodesy.distance([r.lat, r.lng], [-15.7939, -47.8828]);
  assert.ok(shift > 60 && shift < 80, `deslocamento SAD69→SIRGAS ~68 m, obtido ${shift.toFixed(1)} m`);

  // SAD69 UTM
  wkt = utm('SAD_1969_UTM_Zone_22S', SAD69, -51.0, '10000000.0');
  r = reproject(wkt, proj4(wkt).forward([-51.2, -30.0]));
  assert.strictEqual(r.info.epsg, 'EPSG:29192');
  assert.ok(Geodesy.distance([r.lat, r.lng], [-30.0, -51.2]) > 60, 'UTM SAD69 também desloca o datum');

  // WGS84 geográfica: sem transformação
  const wgs = PrjParser.parse(enc(WGS));
  assert.strictEqual(wgs.isWGS84, true);
  assert.deepStrictEqual(ShapefileParser.reprojectGeometry([-15.5, -47.5], 'Point', wgs), [-15.5, -47.5]);

  // Fuso fora do conjunto brasileiro continua funcionando (WKT próprio), sem sobrescrever outros
  wkt = utm('WGS_1984_UTM_Zone_30N', WGS, -3.0, '0.0');
  r = reproject(wkt, proj4(wkt).forward([-3.7, 40.4]));
  near(r.lat, 40.4, 1e-8, 'UTM 30N lat'); near(r.lng, -3.7, 1e-8, 'UTM 30N lng');

  // Posições fora da faixa nunca passam como válidas
  assert.strictEqual(ShapefileParser.coordinatesInRange([8243641, 5655325]), false);
  assert.strictEqual(ShapefileParser.coordinatesInRange([[-15, -47], [-16, 190]]), false);
  assert.strictEqual(ShapefileParser.coordinatesInRange([[[-15, -47], [-16, -46]]]), true);
  assert.strictEqual(ShapefileParser.coordinatesInRange([NaN, -47]), false);
}

// ---------------------------------------------------------------------------
// 4. Shapefile: partes, furos, orientação, validação
// ---------------------------------------------------------------------------
{
  const a1 = sq(-15.80, -47.90, 0.001);
  const a2 = sq(-15.80, -47.80, 0.001);
  const single = G.calculatePolygonArea(a1);

  // groupPolygonRings: externo horário + furo anti-horário; partes disjuntas
  const cw = (r) => (G.signedRingArea(r) < 0 ? r : [...r].reverse());
  const ccw = (r) => (G.signedRingArea(r) > 0 ? r : [...r].reverse());
  const outer = cw(sq(-15.80, -47.90, 0.002));
  const hole = ccw(sq(-15.7995, -47.8995, 0.001));
  let groups = G.groupPolygonRings([outer, hole]);
  assert.strictEqual(groups.length, 1); assert.strictEqual(groups[0].length, 2, 'furo agrupado ao externo');
  groups = G.groupPolygonRings([cw(a1), cw(a2)]);
  assert.strictEqual(groups.length, 2, 'duas partes disjuntas');
  groups = G.groupPolygonRings([ccw(sq(-15.80, -47.90, 0.002)), ccw(sq(-15.7995, -47.8995, 0.001))]);
  assert.strictEqual(groups.length, 1, 'arquivo fora da norma (tudo anti-horário): aninhamento decide');
  assert.strictEqual(groups[0].length, 2);
  assert.strictEqual(G.groupPolygonRings([cw(a1), ccw(a2)]).length, 2, 'furo órfão não se perde');

  // Escritor: dois polígonos (profundidade 4) e polígono com furo, na orientação do formato
  const multi = { id: 'm', name: 'duas glebas', type: 'Polygon', coordinates: [[a1], [a2]] };
  const holed = { id: 'h', name: 'com furo', type: 'Polygon', coordinates: [sq(-15.80, -47.90, 0.002), sq(-15.7995, -47.8995, 0.001)] };
  const { shpBuffer } = ShapefileWriter.buildShpAndShx([multi, holed]);
  const raw = ShpParser.parse(shpBuffer, null);
  assert.strictEqual(raw[0].polygons.length, 2, 'SHP com 2 partes disjuntas');
  assert.ok(raw[0].polygons.every(p => p.length === 1 && G.signedRingArea(p[0]) < 0), 'externos gravados no sentido horário');
  assert.strictEqual(raw[1].polygons.length, 1);
  assert.strictEqual(raw[1].polygons[0].length, 2, 'furo continua furo');
  assert.ok(G.signedRingArea(raw[1].polygons[0][1]) > 0, 'furo gravado no sentido anti-horário');

  // Importação completa: cada parte vira uma feição com área própria (antes: 2 glebas somavam 0 m²)
  const prj = enc('GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]');
  const parsed = await ShapefileParser.parseFileMap(new Map([['t.shp', shpBuffer], ['t.prj', prj]]));
  assert.strictEqual(parsed.features.length, 3, '2 partes + 1 polígono com furo');
  near(G.calculatePolygonArea(parsed.features[0].coordinates), single, 0.01, 'parte 1');
  near(G.calculatePolygonArea(parsed.features[1].coordinates), single, 0.01, 'parte 2');
  assert.ok(parsed.features[0].id !== parsed.features[1].id, 'ids únicos por parte');
  assert.match(parsed.features[0].name, /parte 1\/2/);
  const expectedHoled = G.calculatePolygonArea([sq(-15.80, -47.90, 0.002)]) - single * 0 - G.calculatePolygonArea(sq(-15.7995, -47.8995, 0.001));
  near(G.calculatePolygonArea(parsed.features[2].coordinates), expectedHoled, 0.01, 'área com furo subtraído');

  // Coordenadas métricas sem .prj, ou .prj que não converte: erro claro, nada é importado
  const metric = ShapefileWriter.buildShpAndShx([{ id: 'p', name: 'p', type: 'Point', coordinates: [8250000, 300000] }]).shpBuffer;
  await assert.rejects(() => ShapefileParser.parseFileMap(new Map([['m.shp', metric]])), /\.prj/);

  // UTM 23S com .prj correto: converte; ponto metro em arquivo WGS84 é descartado e contado
  const utmWkt = 'PROJCS["SIRGAS_2000_UTM_Zone_23S",GEOGCS["GCS_SIRGAS_2000",DATUM["D_SIRGAS_2000",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",10000000.0],PARAMETER["Central_Meridian",-45.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]';
  const [ux, uy] = proj4(utmWkt).forward([-47.8828, -15.7939]);
  const utmShp = ShapefileWriter.buildShpAndShx([{ id: 'p', name: 'p', type: 'Point', coordinates: [uy, ux] }]).shpBuffer;
  const utmParsed = await ShapefileParser.parseFileMap(new Map([['u.shp', utmShp], ['u.prj', enc(utmWkt)]]));
  near(utmParsed.features[0].coordinates[0], -15.7939, 1e-7, 'ponto UTM → lat');
  near(utmParsed.features[0].coordinates[1], -47.8828, 1e-7, 'ponto UTM → lng');
  assert.strictEqual(utmParsed.metadata.epsg, 'EPSG:31983');
}

// ---------------------------------------------------------------------------
// 5. GeoJSON / KML
// ---------------------------------------------------------------------------
{
  const a1 = sq(-15.80, -47.90, 0.001);
  const a2 = sq(-15.80, -47.80, 0.001);
  const single = G.calculatePolygonArea(a1);
  const closed = (r) => [...r, r[0]].map(c => [c[1], c[0]]);

  const gj = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [[closed(a1)], [closed(a2)]] } }] };
  const imported = GeoJsonConverter.parseGeoJSON(gj).features;
  assert.strictEqual(imported.length, 2, 'MultiPolygon vira uma feição por polígono');
  imported.forEach(f => near(G.calculatePolygonArea(f.coordinates), single, 0.01, 'área de cada parte'));
  assert.notStrictEqual(imported[0].id, imported[1].id);

  const holed = { id: 'h', name: 'com furo', type: 'Polygon', coordinates: [sq(-15.80, -47.90, 0.002), sq(-15.7995, -47.8995, 0.001)] };
  let geom = JSON.parse(GeoJsonConverter.toGeoJSON([holed])).features[0].geometry;
  assert.strictEqual(geom.type, 'Polygon', 'polígono com furo continua Polygon');
  assert.strictEqual(geom.coordinates.length, 2);
  geom.coordinates.forEach(r => assert.deepStrictEqual(r[0], r[r.length - 1], 'anel fechado'));

  const multi = { id: 'm', name: 'duas', type: 'Polygon', coordinates: [[a1], [a2]] };
  geom = JSON.parse(GeoJsonConverter.toGeoJSON([multi])).features[0].geometry;
  assert.strictEqual(geom.type, 'MultiPolygon'); assert.strictEqual(geom.coordinates.length, 2);

  const simple = JSON.parse(GeoJsonConverter.toGeoJSON([{ id: 's', name: 's', type: 'Polygon', coordinates: a1 }])).features[0].geometry;
  assert.strictEqual(simple.type, 'Polygon'); assert.strictEqual(simple.coordinates.length, 1);

  // Ida e volta do polígono com furo preserva a área
  const back = GeoJsonConverter.parseGeoJSON(JSON.parse(GeoJsonConverter.toGeoJSON([holed]))).features[0];
  near(G.calculatePolygonArea(back.coordinates), G.calculatePolygonArea(holed.coordinates), 0.01, 'ida e volta GeoJSON');

  const kml = KmlConverter.toKML([holed]);
  assert.strictEqual((kml.match(/<Polygon>/g) || []).length, 1, 'KML: um Polygon');
  assert.strictEqual((kml.match(/<innerBoundaryIs>/g) || []).length, 1, 'KML: furo em innerBoundaryIs');
  assert.ok(!kml.includes('<MultiGeometry>'));
  assert.ok(KmlConverter.toKML([multi]).includes('<MultiGeometry>'));
}

// ---------------------------------------------------------------------------
// 6. Impressão: UTM, tabela de vértices, formatação
// ---------------------------------------------------------------------------
{
  // Boa Vista (RR): hemisfério norte; antes saía N = 10.309.737 m
  const boaVista = P.toUtmCoords(2.8, -60.7);
  assert.strictEqual(boaVista.zone, 20); assert.strictEqual(boaVista.south, false);
  near(boaVista.northing, 309737.41, 0.01, 'Norte em Boa Vista');
  near(boaVista.easting, 755697.72, 0.01, 'Leste em Boa Vista');
  const brasilia = P.toUtmCoords(-15.7939, -47.8828);
  assert.strictEqual(brasilia.zone, 23); assert.strictEqual(brasilia.south, true);
  near(brasilia.northing, 8251745.906, 0.01, 'Norte em Brasília');

  // Tabela: azimute/distância geodésicos e área igual à do inspetor
  const ring = sq(-15.80, -47.90, 0.03);
  const feat = { id: 't', name: 'T', type: 'Polygon', coordinates: ring };
  const d = P.extractVerticesData([feat], 't');
  assert.strictEqual(d.vertices.length, 4);
  assert.strictEqual(d.vertices[0].azimuth, `00°00'00"`, 'lado norte–sul: azimute geodésico 0°, não 359°12\'');
  near(d.totalAreaM2, G.calculatePolygonArea(ring), 1e-6, 'área da tabela = área do inspetor');
  near(d.totalPerimeter, G.calculatePolygonPerimeter(ring), 1e-6, 'perímetro da tabela = geodésico');
  assert.strictEqual(d.utmHemisphere, 'S');

  // Anel fechado (primeiro == último) não duplica vértice
  const closedFeat = { id: 'c', name: 'C', type: 'Polygon', coordinates: [...ring, ring[0]] };
  assert.strictEqual(P.extractVerticesData([closedFeat], 'c').vertices.length, 4);

  // Polígono com furo e multipolígono não quebram a tabela
  const holedFeat = { id: 'h', name: 'H', type: 'Polygon', coordinates: [sq(-15.80, -47.90, 0.02), sq(-15.795, -47.895, 0.005)] };
  assert.strictEqual(P.extractVerticesData([holedFeat], 'h').vertices.length, 4);
  near(P.extractVerticesData([holedFeat], 'h').totalAreaM2, G.calculatePolygonArea(holedFeat.coordinates), 1e-6, 'área com furo');

  // Hemisfério norte na tabela
  const north = { id: 'n', name: 'N', type: 'Polygon', coordinates: sq(2.80, -60.70, 0.01) };
  const dn = P.extractVerticesData([north], 'n');
  assert.strictEqual(dn.utmHemisphere, 'N');
  assert.ok(parseFloat(dn.vertices[0].northing.replace(/\./g, '').replace(',', '.')) < 1000000, 'Norte pequeno no hemisfério norte');

  // Segundos nunca chegam a 60
  assert.strictEqual(P.formatAzimuth(359.99999), `00°00'00"`);
  assert.strictEqual(P.formatAzimuth(10.99999), `11°00'00"`);
  assert.strictEqual(P.formatAzimuth(44.07852), `44°04'43"`);
  assert.strictEqual(P.formatDMS(-15.99999, true), `16°00'00"S`);
  assert.strictEqual(P.formatDMS(-47.5, false), `47°30'00"W`);
}

// ---------------------------------------------------------------------------
// 7. DXF: o parser roda (antes: ReferenceError: sourceProj is not defined)
// ---------------------------------------------------------------------------
{
  const dxf = (body) => `0\nSECTION\n2\nENTITIES\n${body}0\nENDSEC\n0\nEOF\n`;
  const [e0, n0] = proj4('EPSG:4326', BRAZILIAN_PROJECTIONS['EPSG:31983'], [-47.8828, -15.7939]);

  const result = DwgDxfParser.parseDxf(dxf(
    `0\nPOINT\n8\nMARCOS\n10\n${e0}\n20\n${n0}\n` +
    `0\nLINE\n8\nEIXO\n10\n${e0}\n20\n${n0}\n11\n${e0 + 100}\n21\n${n0}\n` +
    `0\nLWPOLYLINE\n8\nLOTES\n90\n3\n70\n1\n10\n${e0}\n20\n${n0}\n10\n${e0 + 100}\n20\n${n0}\n10\n${e0 + 100}\n20\n${n0 + 100}\n`
  ), { sourceProjection: 'EPSG:31983' });

  assert.strictEqual(result.features.length, 3);
  const point = result.features.find(f => f.type === 'Point');
  near(point.coordinates[0], -15.7939, 1e-7, 'DXF POINT lat'); near(point.coordinates[1], -47.8828, 1e-7, 'DXF POINT lng');
  const line = result.features.find(f => f.type === 'LineString');
  // 100 m de quadrícula = ~99,92 m no terreno a 2,9° do meridiano central (fator de escala UTM)
  near(Geodesy.distance(line.coordinates[0], line.coordinates[1]), 99.92, 0.02, 'LINE de 100 m de quadrícula');
  assert.ok(result.features.some(f => f.type === 'Polygon'));

  // A projeção escolhida (SAD69) precisa ser a usada: o datum desloca dezenas de metros
  const sad = DwgDxfParser.parseDxf(dxf(`0\nPOINT\n8\n0\n10\n${e0}\n20\n${n0}\n`), { sourceProjection: 'EPSG:29193' });
  assert.ok(Geodesy.distance(sad.features[0].coordinates, point.coordinates) > 50, 'sourceProjection é respeitada');
}

console.log('✔ Motor geodésico: UTM, distância/azimute/área elipsoidais, .prj, partes/furos, UTM norte e DXF validados.');
