/* ==========================================================================
   ConecteMapas - Teste GPX (Waypoints, Tracks e Routes)
   ========================================================================== */

import assert from 'assert';
import { GpxConverter } from '../src/services/GeoFormats/GpxConverter.js';
import { GeoFormats } from '../src/services/GeoFormats.js';
import { installMiniDom } from './_mini_dom.js';

console.log('--- Iniciando Teste de Exportação e Importação GPX ---');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: obtido ${a}, esperado ${b} (±${tol})`);

// 1. Exportação toGPX com Polígonos de múltiplas profundidades, furos e linhas
{
  const a1 = [[-15.80, -47.90], [-15.79, -47.90], [-15.79, -47.89], [-15.80, -47.89]];
  const hole = [[-15.795, -47.895], [-15.792, -47.895], [-15.792, -47.892], [-15.795, -47.892]];

  const features = [
    { id: 'p1', name: 'Marco 1', type: 'Point', coordinates: [-15.7939, -47.8828], description: 'Vértice M1' },
    { id: 'c1', name: 'Pivô Central', type: 'Circle', coordinates: [-15.7900, -47.8800], radius: 450 },
    { id: 't1', name: 'Anotação', type: 'Text', coordinates: [-15.7910, -47.8810], text: 'Área de Preservação' },
    { id: 'l1', name: 'Estrada', type: 'LineString', coordinates: [[-15.80, -47.90], [-15.79, -47.89]] },
    { id: 'ml1', name: 'Rede Elétrica', type: 'LineString', coordinates: [[[-15.80, -47.90], [-15.79, -47.89]], [[-15.78, -47.88], [-15.77, -47.87]]] },
    { id: 'poly1', name: 'Gleba A', type: 'Polygon', coordinates: a1 },
    { id: 'poly_holed', name: 'Gleba com Reserva', type: 'Polygon', coordinates: [a1, hole] },
    { id: 'multi_poly', name: 'Duas Glebas', type: 'Polygon', coordinates: [[a1], [hole]] }
  ];

  const gpxXml = GpxConverter.toGPX(features, 'Projeto Fazenda');
  assert.ok(gpxXml.startsWith('<?xml'), 'XML válido');
  assert.ok(gpxXml.includes('<name>Projeto Fazenda</name>'));
  assert.ok(gpxXml.includes('<wpt lat="-15.7939" lon="-47.8828">'));
  assert.ok(gpxXml.includes('<name>Marco 1</name>'));
  assert.ok(gpxXml.includes('[Raio: 450m]'), 'Raio do círculo preservado');
  assert.ok(gpxXml.includes('[Área de Preservação]'), 'Texto preservado');

  // Verifica que nenhuma coordenada saiu como array ou undefined
  assert.ok(!gpxXml.includes('lat="undefined"'), 'Sem lat undefined');
  assert.ok(!gpxXml.includes('lon="undefined"'), 'Sem lon undefined');
  assert.ok(!gpxXml.includes('lat="-15.8,-47.9"'), 'Coordenadas não foram convertidas em strings de array');

  // Conta os segmentos de track criados
  const trksegs = (gpxXml.match(/<trkseg>/g) || []).length;
  // Estrada (1) + Rede Elétrica (2) + Gleba A (1) + Gleba com Reserva (2) + Duas Glebas (2) = 8 segmentos
  assert.strictEqual(trksegs, 8, '8 segmentos de trilha gerados corretamente');

  // Verifica anéis fechados para polígonos
  const glebaAMatch = gpxXml.match(/<name>Gleba A<\/name>\s*<trkseg>([\s\S]*?)<\/trkseg>/);
  assert.ok(glebaAMatch, 'Gleba A exportada');
  const trkpts = glebaAMatch[1].match(/<trkpt lat="([^"]+)" lon="([^"]+)"\/>/g);
  assert.strictEqual(trkpts.length, 5, '4 vértices + 1 vértice de fechamento');
  assert.strictEqual(trkpts[0], trkpts[4], 'primeiro vértice igual ao último');
}

// 2. Importação parseGPX e parseUploadedFile
{
  const restoreDom = installMiniDom();

  const sampleGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Levantamento Campo</name></metadata>
  <wpt lat="-15.7939" lon="-47.8828">
    <name>Marco Base</name>
    <desc>Estação GPS RTK</desc>
    <ele>1024.5</ele>
  </wpt>
  <trk>
    <name>Cerca Perimetral</name>
    <desc>Divisa Leste</desc>
    <trkseg>
      <trkpt lat="-15.80" lon="-47.90"/>
      <trkpt lat="-15.79" lon="-47.89"/>
      <trkpt lat="-15.78" lon="-47.89"/>
    </trkseg>
  </trk>
  <rte>
    <name>Caminho de Acesso</name>
    <rtept lat="-15.81" lon="-47.91"/>
    <rtept lat="-15.82" lon="-47.92"/>
  </rte>
</gpx>`;

  const result = GpxConverter.parseGPX(sampleGpx);
  assert.strictEqual(result.features.length, 3, '1 wpt + 1 trk + 1 rte');

  const wpt = result.features.find(f => f.type === 'Point');
  assert.strictEqual(wpt.name, 'Marco Base');
  near(wpt.coordinates[0], -15.7939, 1e-6, 'lat wpt');
  near(wpt.coordinates[1], -47.8828, 1e-6, 'lon wpt');
  assert.strictEqual(wpt.properties.elevation, 1024.5, 'elevação');

  const trk = result.features.find(f => f.name === 'Cerca Perimetral');
  assert.strictEqual(trk.type, 'LineString');
  assert.strictEqual(trk.coordinates.length, 3);
  near(trk.coordinates[0][0], -15.80, 1e-6, 'lat ponto 1');

  const rte = result.features.find(f => f.name === 'Caminho de Acesso');
  assert.strictEqual(rte.type, 'LineString');
  assert.strictEqual(rte.coordinates.length, 2);

  // Teste via GeoFormats.parseUploadedFile
  const autoParsed = await GeoFormats.parseUploadedFile(sampleGpx, 'campo.gpx');
  assert.strictEqual(autoParsed.features.length, 3, 'parseUploadedFile reconhece .gpx');

  restoreDom();
}

console.log('✔ GPX: exportação limpa de polígonos/linhas e importação completa de waypoints, tracks e rotas validados com sucesso.');
