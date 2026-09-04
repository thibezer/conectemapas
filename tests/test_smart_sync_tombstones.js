// Mock mínimo para Node.js
globalThis.window = {
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  location: { hostname: 'localhost' },
  devicePixelRatio: 1,
  screen: {},
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.document = {
  createElement: () => ({ setAttribute: () => {}, style: {} }),
  documentElement: { style: {} },
  addEventListener: () => {},
  removeEventListener: () => {}
};

globalThis.HTMLElement = class {};
globalThis.customElements = { define: () => {}, get: () => null };

// Teste unitário de concorrência: Smart Sync, Deltas e Tombstones
const { FeatureSyncController } = await import('../src/controllers/FeatureSyncController.js');

console.log('--- Testando Smart Sync & Tombstones (Concorrência Multi-Dispositivo) ---');

// Mock do estado do aplicativo
const mockApp = {
  projectId: 'test_proj',
  projectName: 'Projeto Teste',
  currentBasemap: 'google_satelite_puro',
  layers: [{ id: 'layer-1', name: 'Lotes' }],
  features: [
    { id: 'f-1', name: 'Lote 01', type: 'Polygon', coordinates: [[-23.76, -53.32], [-23.76, -53.31], [-23.77, -53.31]] },
    { id: 'f-2', name: 'Lote 02', type: 'Polygon', coordinates: [[-23.77, -53.32], [-23.77, -53.31], [-23.78, -53.31]] }
  ],
  mapEngine: {
    isDrawing: false,
    updateFeature: (feat) => {},
    removeFeature: (id) => {}
  },
  attributeTable: { updateData: () => {} },
  layerPanel: { updateLayers: () => {} },
  updateHUD: () => {},
  getLayersWithCounts: () => [{ id: 'layer-1', count: 2 }]
};

// 1. Cenário: Outro operador excluiu a feição 'f-1' (Tombstone remoto)
console.log('1. Aplicando tombstone para feição f-1...');
const result1 = FeatureSyncController.applyRemoteDeltas(mockApp, {
  upserted: [],
  deleted: ['f-1']
});

if (mockApp.features.some(f => f.id === 'f-1')) {
  console.error('ERRO: Feição f-1 ainda está presente após exclusão remota!');
  process.exit(1);
} else {
  console.log('OK: Feição f-1 expurgada com sucesso da memória local.');
}

// 2. Cenário: Outro operador criou a feição 'f-3' e atualizou 'f-2'
console.log('2. Aplicando upsert remoto (criação f-3 e edição f-2)...');
const result2 = FeatureSyncController.applyRemoteDeltas(mockApp, {
  upserted: [
    { id: 'f-3', name: 'Lote 03', type: 'Polygon', coordinates: [[-23.78, -53.32], [-23.78, -53.31], [-23.79, -53.31]] },
    { id: 'f-2', name: 'Lote 02 (Modificado)', type: 'Polygon', coordinates: [[-23.77, -53.32], [-23.77, -53.31], [-23.78, -53.31]] }
  ],
  deleted: []
});

const f3 = mockApp.features.find(f => f.id === 'f-3');
const f2 = mockApp.features.find(f => f.id === 'f-2');

if (!f3) {
  console.error('ERRO: Feição f-3 não foi inserida!');
  process.exit(1);
}
if (!f2 || f2.name !== 'Lote 02 (Modificado)') {
  console.error('ERRO: Feição f-2 não foi atualizada!');
  process.exit(1);
}

console.log('OK: Feição f-3 inserida e f-2 atualizada perfeitamente.');
console.log('Total de feições finais:', mockApp.features.length);
console.log('--- Teste Concluído com Sucesso Total! ---');
