// Mock mínimo para Node.js
globalThis.window = {
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  location: { hostname: 'localhost', search: '?project=fazenda_aurora' },
  devicePixelRatio: 1,
  screen: {},
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.document = {
  createElement: () => ({ setAttribute: () => {}, style: {}, appendChild: () => {} }),
  documentElement: { style: {} },
  body: { appendChild: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: () => null
};

globalThis.HTMLElement = class {};
globalThis.customElements = { define: () => {}, get: () => null };

// Importa módulos do ConecteMapas
const { StorageService } = await import('../src/services/StorageService.js');
const { FeatureSyncController } = await import('../src/controllers/FeatureSyncController.js');
const { CollaborationHub } = await import('../src/services/CollaborationHub.js');

console.log('--- TESTE: Auditoria de Salvamento Compartilhado e Sincronização ---');

// 1. Validação de Isolamento de ProjectId no StorageService
console.log('1. Testando isolamento de projectId no StorageService...');
StorageService.setCurrentProjectId('projeto_alfa');
if (StorageService.getCurrentProjectId() !== 'projeto_alfa') {
  console.error('FALHA: StorageService não definiu projectId para "projeto_alfa"');
  process.exit(1);
}
StorageService.setCurrentProjectId('fazenda_aurora');
if (StorageService.getCurrentProjectId() !== 'fazenda_aurora') {
  console.error('FALHA: StorageService não atualizou projectId para "fazenda_aurora"');
  process.exit(1);
}
console.log('OK: StorageService mantém projectId ativo isolado.');

// 2. Validação do Canal do BroadcastChannel por Projeto no CollaborationHub
console.log('2. Testando isolamento de canal por projeto no CollaborationHub...');
let channelCreatedName = null;
globalThis.BroadcastChannel = class {
  constructor(name) {
    channelCreatedName = name;
    this.name = name;
  }
  postMessage() {}
  close() {}
};

const hub1 = new CollaborationHub(null, () => {}, 'projeto_especifico_123');
if (channelCreatedName !== 'conectemapas_collab_projeto_especifico_123') {
  console.error(`FALHA: Nome do canal incorreto. Esperado: conectemapas_collab_projeto_especifico_123, Obtido: ${channelCreatedName}`);
  process.exit(1);
}
console.log('OK: CollaborationHub isolou canal de broadcast por projeto:', channelCreatedName);

// 3. Validação de Sincronização de Camadas e Círculos via applyRemoteDeltas
console.log('3. Testando sincronização de camadas e raio de círculo...');
const mockApp = {
  projectId: 'fazenda_aurora',
  projectName: 'Fazenda Aurora',
  currentBasemap: 'google_satelite_puro',
  layers: [
    { id: 'l-1', name: 'Pastagem', color: '#00E08A' }
  ],
  features: [],
  auditLog: [],
  mapEngine: {
    isDrawing: false,
    updateFeature: () => {},
    removeFeature: () => {}
  },
  attributeTable: { updateData: () => {} },
  layerPanel: { updateLayers: () => {} },
  updateHUD: () => {},
  getLayersWithCounts: () => [{ id: 'l-1', count: 1 }]
};

const deltaPayload = {
  layers: [
    { id: 'l-1', name: 'Pastagem Principal', color: '#22c55e' },
    { id: 'l-2', name: 'Reserva Legal', color: '#15803d' }
  ],
  upserted: [
    {
      id: 'circ-1',
      name: 'Pivô Central 01',
      type: 'Circle',
      coordinates: [-23.76, -53.32],
      radius: 750,
      layerId: 'l-1'
    }
  ],
  deleted: []
};

FeatureSyncController.applyRemoteDeltas(mockApp, deltaPayload);

// Valida camadas reconciliadas
if (mockApp.layers.length !== 2) {
  console.error('FALHA: Camadas não foram sincronizadas! Total:', mockApp.layers.length);
  process.exit(1);
}
const layerReserva = mockApp.layers.find(l => l.id === 'l-2');
if (!layerReserva || layerReserva.name !== 'Reserva Legal') {
  console.error('FALHA: Camada "Reserva Legal" não foi inserida!');
  process.exit(1);
}
console.log('OK: Camadas sincronizadas com sucesso (criada l-2 e atualizada l-1).');

// Valida círculo e raio
const circFeat = mockApp.features.find(f => f.id === 'circ-1');
if (!circFeat) {
  console.error('FALHA: Feição circular circ-1 não foi inserida!');
  process.exit(1);
}
if (circFeat.radius !== 750) {
  console.error('FALHA: Raio do círculo foi perdido ou alterado! Raio:', circFeat.radius);
  process.exit(1);
}
console.log('OK: Feição circular sincronizada preservando radius = 750m.');

// 4. Validação do handleCollabEvent (Eventos em tempo real via CollabHub)
console.log('4. Testando ingestão de eventos CollabHub em tempo real...');
let appliedLocally = false;
StorageService.applyRemoteChangesLocally = (upserted, deleted, projId) => {
  if (projId === 'fazenda_aurora' && upserted.length > 0 && upserted[0].id === 'feat-collab-1') {
    appliedLocally = true;
  }
};
StorageService.saveMetadata = () => {};

FeatureSyncController.handleCollabEvent(mockApp, 'feature:created', {
  user: { name: 'Operador 2' },
  feature: {
    id: 'feat-collab-1',
    name: 'Marco Geodésico M-01',
    type: 'Point',
    coordinates: [-23.765, -53.325]
  }
});

if (!mockApp.features.some(f => f.id === 'feat-collab-1')) {
  console.error('FALHA: Feição de colaboração não inserida na memória!');
  process.exit(1);
}
if (!appliedLocally) {
  console.error('FALHA: Feição recebida via CollabHub não foi persistida no IndexedDB local!');
  process.exit(1);
}
console.log('OK: Evento feature:created recebido via CollabHub atualizou memória e persistiu no IndexedDB local!');

console.log('--- TODOS OS TESTES DE SINCRONIZAÇÃO E PERSISTÊNCIA PASSARAM COM SUCESSO! ---');
