/* ==========================================================================
   ConecteMapas - Teste de Consistência de Anel de Polígono (Aberto vs Fechado)
   Verifica que:
   1. Importação GeoJSON normaliza para anel aberto (remove vértice repetido).
   2. Exportação GeoJSON produz LinearRing fechado (RFC 7946).
   3. Importação KML normaliza para anel aberto (remove vértice repetido).
   4. Exportação KML produz LinearRing fechado.
   5. normalizeCoordinates em MockData abre Polygon mas preserva LineString em circuito.
   ========================================================================== */

import assert from 'assert';
import { GeoJsonConverter } from '../src/services/GeoFormats/GeoJsonConverter.js';
import { KmlConverter } from '../src/services/GeoFormats/KmlConverter.js';
import { normalizeCoordinates, normalizeFeature } from '../src/services/MockData.js';

console.log('--- Iniciando Teste de Consistência de Anel de Polígonos ---');

// 1. Teste GeoJSON Import (parseGeoJSON)
const sampleGeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'poly-1',
      properties: { name: 'Triângulo Teste', layerId: 'layer-topografia' },
      geometry: {
        type: 'Polygon',
        // RFC 7946: 4 pontos [lng, lat], onde primeiro == último
        coordinates: [
          [
            [-47.86, -15.79],
            [-47.85, -15.78],
            [-47.84, -15.80],
            [-47.86, -15.79] // Fechamento duplicado
          ]
        ]
      }
    }
  ]
};

const parsedGeo = GeoJsonConverter.parseGeoJSON(sampleGeoJSON);
assert.strictEqual(parsedGeo.features.length, 1, 'Deve importar 1 feição');
const featGeo = parsedGeo.features[0];
assert.strictEqual(featGeo.type, 'Polygon', 'Tipo deve ser Polygon');
assert.strictEqual(featGeo.coordinates.length, 3, 'Polígono importado DEVE ter anel aberto (3 vértices, sem duplicata)');
assert.deepStrictEqual(featGeo.coordinates[0], [-15.79, -47.86], 'Vértice 0 correto [lat, lng]');
assert.deepStrictEqual(featGeo.coordinates[1], [-15.78, -47.85], 'Vértice 1 correto [lat, lng]');
assert.deepStrictEqual(featGeo.coordinates[2], [-15.80, -47.84], 'Vértice 2 correto [lat, lng]');
console.log('✓ GeoJsonConverter.parseGeoJSON removeu com sucesso o vértice final duplicado (3 vértices).');

// 2. Teste GeoJSON Export (toGeoJSON)
const exportedGeoStr = GeoJsonConverter.toGeoJSON([featGeo]);
const exportedGeoObj = JSON.parse(exportedGeoStr);
const exportedCoords = exportedGeoObj.features[0].geometry.coordinates[0];
assert.strictEqual(exportedCoords.length, 4, 'GeoJSON exportado DEVE fechar o LinearRing com 4 pontos');
assert.deepStrictEqual(exportedCoords[0], exportedCoords[3], 'Primeiro e último pontos exportados devem ser idênticos no GeoJSON');
console.log('✓ GeoJsonConverter.toGeoJSON gerou LinearRing fechado conforme RFC 7946 (4 pontos).');

// 3. Teste KML Import (parseKML)
const sampleKML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark id="kml-poly-1">
      <name>Polígono KML Teste</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <!-- lng,lat,alt -->
            <coordinates>
              -47.86,-15.79,0 -47.85,-15.78,0 -47.84,-15.80,0 -47.86,-15.79,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

// Como parseKML usa DOMParser no browser, testamos a lógica com um mock simples de DOMParser se rodando no Node
if (typeof DOMParser === 'undefined') {
  // Polyfill básico para teste em ambiente Node puro
  global.DOMParser = class {
    parseFromString(text) {
      return {
        querySelector: () => null,
        querySelectorAll: (selector) => {
          if (selector === 'Placemark') {
            return [{
              querySelector: (sub) => {
                if (sub === 'name') return { textContent: 'Polígono KML Teste' };
                if (sub === 'Polygon coordinates') return {
                  textContent: '-47.86,-15.79,0 -47.85,-15.78,0 -47.84,-15.80,0 -47.86,-15.79,0'
                };
                return null;
              }
            }];
          }
          return [];
        }
      };
    }
  };
}

const parsedKML = KmlConverter.parseKML(sampleKML);
assert.strictEqual(parsedKML.features.length, 1, 'Deve importar 1 feição KML');
const featKML = parsedKML.features[0];
assert.strictEqual(featKML.coordinates.length, 3, 'Polígono KML importado DEVE ter anel aberto (3 vértices, sem duplicata)');
console.log('✓ KmlConverter.parseKML removeu com sucesso o vértice final duplicado (3 vértices).');

// 4. Teste KML Export (toKML)
const exportedKML = KmlConverter.toKML([featKML]);
assert(exportedKML.includes('-47.86,-15.79,0 -47.85,-15.78,0 -47.84,-15.8,0 -47.86,-15.79,0'), 'KML exportado deve ter LinearRing fechado (4 coordenadas)');
console.log('✓ KmlConverter.toKML gerou LinearRing fechado com vértice final duplicado.');

// 5. Teste normalizeCoordinates em MockData
const closedPolyCoords = [
  [-15.79, -47.86],
  [-15.78, -47.85],
  [-15.80, -47.84],
  [-15.79, -47.86] // duplicado
];

const normalizedPolyCoords = normalizeCoordinates(closedPolyCoords, 'Polygon');
assert.strictEqual(normalizedPolyCoords.length, 3, 'normalizeCoordinates deve converter Polygon fechado para anel aberto');

// Teste de segurança: LineString fechada (circuito) NÃO deve perder o ponto final!
const closedLineCoords = [
  [-15.79, -47.86],
  [-15.78, -47.85],
  [-15.80, -47.84],
  [-15.79, -47.86] // volta ao ponto de partida
];
const normalizedLineCoords = normalizeCoordinates(closedLineCoords, 'LineString');
assert.strictEqual(normalizedLineCoords.length, 4, 'normalizeCoordinates NÃO deve remover ponto final de LineString fechada (circuito)');
console.log('✓ normalizeCoordinates tratou perfeitamente Polygon (anel aberto) e preservou circuito de LineString.');

console.log('--- Todos os testes de anel de polígono passaram com sucesso! ---');
