import assert from 'assert';
import { DrawingSnappingHelper } from '../src/services/MapEngine/DrawingSnappingHelper.js';

console.log('--- Testando Precisão, Performance e Zona Neutra do Snap Magnético (CAD Style) ---');

// 1. Validação de Raio de Captura Estilo CAD
const mockMapWithZoom = (zoomLevel) => ({
  getZoom: () => zoomLevel,
  latLngToContainerPoint: (ll) => ({ x: ll[1] * 1000, y: ll[0] * 1000 })
});

assert.strictEqual(DrawingSnappingHelper.getBaseSnapRadius(mockMapWithZoom(22)), 10, 'Zoom 22 deve ter raio 10px');
assert.strictEqual(DrawingSnappingHelper.getBaseSnapRadius(mockMapWithZoom(20)), 10, 'Zoom 20 deve ter raio 10px');
assert.strictEqual(DrawingSnappingHelper.getBaseSnapRadius(mockMapWithZoom(19)), 9, 'Zoom 19 deve ter raio 9px');
assert.strictEqual(DrawingSnappingHelper.getBaseSnapRadius(mockMapWithZoom(15)), 9, 'Zooms afastados mantêm raio 9px confortável estilo CAD');
console.log('✔ Raio de captura base confortável (9-10px) estilo CAD validado.');

// 2. Mock de Mapa Leaflet com projeção e desprojeção de pixels bidirecional
// V1 em X = 100
// V2 em X = 112 [Distância = 12 pixels no Zoom 19]
const v1 = [-23.0000, -53.0000];
const v2 = [-23.0000, -52.9988];

const mapZoom19 = {
  getZoom: () => 19,
  getBounds: () => ({
    contains: () => true
  }),
  latLngToContainerPoint: (ll) => {
    const lat = Array.isArray(ll) ? ll[0] : (ll.lat || 0);
    const lng = Array.isArray(ll) ? ll[1] : (ll.lng || 0);
    const x = 100 + (lng - (-53.0000)) * 10000;
    const y = 100 + (lat - (-23.0000)) * 10000;
    return { x, y };
  },
  containerPointToLatLng: (pt) => {
    const px = Array.isArray(pt) ? pt[0] : pt.x;
    const py = Array.isArray(pt) ? pt[1] : pt.y;
    const lng = -53.0000 + (px - 100) / 10000;
    const lat = -23.0000 + (py - 100) / 10000;
    return { lat, lng };
  }
};

const mockEngine = {
  snappingEnabled: true,
  spatialIndex: {
    size: 2,
    query: (bounds) => [
      {
        id: 'feat-1',
        type: 'Point',
        coordinates: v1,
        visible: true
      },
      {
        id: 'feat-2',
        type: 'Point',
        coordinates: v2,
        visible: true
      }
    ]
  },
  featureRenderer: {
    layerMap: new Map(),
    allFeatures: []
  }
};

// Teste 2.1: Cursor a 2 pixels de V1 (em X=102, Y=100) -> TRAVA no ponto V1
const cursorNearV1 = { lat: -23.0000, lng: -53.0000 + 0.0002 }; // X = 102
const snappedNearV1 = DrawingSnappingHelper.findNearbyVertex(mapZoom19, cursorNearV1, 'line', [], mockEngine);
assert(snappedNearV1 !== null, 'Cursor próximo de V1 deve travar no ponto V1');
assert.strictEqual(snappedNearV1[0], v1[0]);
assert.strictEqual(snappedNearV1[1], v1[1]);
console.log('✔ Cursor trava firmemente sobre V1 quando dentro da distância de snap (2px).');

// Teste 2.2: Cursor a 2 pixels de V2 (em X=110, Y=100) -> TRAVA no ponto V2
const cursorNearV2 = { lat: -23.0000, lng: -52.9990 }; // X = 110
const snappedNearV2 = DrawingSnappingHelper.findNearbyVertex(mapZoom19, cursorNearV2, 'line', [], mockEngine);
assert(snappedNearV2 !== null, 'Cursor próximo de V2 deve travar no ponto V2');
assert.strictEqual(snappedNearV2[0], v2[0]);
assert.strictEqual(snappedNearV2[1], v2[1]);
console.log('✔ Cursor trava firmemente sobre V2 quando dentro da distância de snap (2px).');

// Teste 2.3: Cursor no meio do caminho entre V1 e V2 (X = 106, Y = 100)
// V1 e V2 distam 12px.
// Limite de vizinhos: Math.max(4, 12 * 0.42) = 5.04px.
// A 6px de ambos, o snap DESENGATA e retorna null, garantindo movimento 100% livre!
const cursorMiddle = { lat: -23.0000, lng: -52.9994 }; // X = 106
const snappedMiddle = DrawingSnappingHelper.findNearbyVertex(mapZoom19, cursorMiddle, 'line', [], mockEngine);
assert.strictEqual(snappedMiddle, null, 'No meio entre dois vértices a 12px, o snap desengata e permite mover livremente');
console.log('✔ Desengate de zona neutra validado: cursor move livremente no meio dos pontos sem pular forçadamente.');

// Teste 2.4: Desativação Global do Snap (snappingEnabled = false)
mockEngine.snappingEnabled = false;
const snappedDisabled = DrawingSnappingHelper.findNearbyVertex(mapZoom19, cursorNearV1, 'line', [], mockEngine);
assert.strictEqual(snappedDisabled, null, 'Com snappingEnabled = false, deve retornar null mesmo colado ao vértice');
mockEngine.snappingEnabled = true;
console.log('✔ Desativação global via engine.snappingEnabled testada.');

// Teste 2.5: Desativação Temporária via tecla Alt (altHeld = true)
DrawingSnappingHelper.altHeld = true;
const snappedAlt = DrawingSnappingHelper.findNearbyVertex(mapZoom19, cursorNearV1, 'line', [], mockEngine);
assert.strictEqual(snappedAlt, null, 'Com altHeld = true, deve retornar null');
DrawingSnappingHelper.altHeld = false;
console.log('✔ Desativação temporária via tecla [Alt] testada.');

// Teste 2.6: Suporte a Polígonos com furos e anéis aninhados
const mockEngineComplex = {
  snappingEnabled: true,
  spatialIndex: {
    size: 1,
    query: () => [
      {
        id: 'feat-poly-rings',
        type: 'Polygon',
        coordinates: [
          [[-23.0, -53.0], [-23.0, -53.01], [-23.01, -53.01]], // Anel exterior
          [[-23.002, -52.998], [-23.002, -52.992], [-23.008, -52.992]] // Anel interior
        ],
        visible: true
      }
    ]
  },
  featureRenderer: {
    layerMap: new Map(),
    allFeatures: []
  }
};
// Cursor em X = 120 (0.0020 de lng -> 100 + 20 = 120)
const cursorNearHole = { lat: -23.002, lng: -52.9980 };
const snappedHole = DrawingSnappingHelper.findNearbyVertex(mapZoom19, cursorNearHole, 'line', [], mockEngineComplex);
assert(snappedHole !== null, 'Deve encontrar vértices de anéis interiores de polígonos');
assert.strictEqual(snappedHole[0], -23.002);
console.log('✔ Suporte a polígonos com anéis e furos aninhados validado com sucesso.');

console.log('--- TODOS OS TESTES DE PRECISÃO DO SNAP MAGNÉTICO PASSARAM COM SUCESSO! ---');
