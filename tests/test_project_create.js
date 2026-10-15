// "Novo projeto" cria outro id e o abre; o projeto aberto não é tocado.
const createMockEl = () => ({
  setAttribute: () => {}, getAttribute: () => null, style: {}, value: '',
  classList: { add: () => {}, remove: () => {}, toggle: () => {} },
  textContent: '', appendChild: () => {}, addEventListener: () => {}, removeEventListener: () => {}
});

const assigned = [];
globalThis.window = {
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  location: {
    hostname: 'localhost', origin: 'http://localhost:5173', pathname: '/', search: '?project=aberto', hash: '',
    assign: (url) => assigned.push(url)
  },
  devicePixelRatio: 1, screen: {}, addEventListener: () => {}, removeEventListener: () => {}
};
globalThis.document = {
  createElement: createMockEl, documentElement: { style: {} }, body: { appendChild: () => {}, classList: { add: () => {}, toggle: () => {} } },
  addEventListener: () => {}, removeEventListener: () => {},
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => []
};
globalThis.HTMLElement = class {};
globalThis.customElements = { define: () => {}, get: () => null };
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};
globalThis.fetch = async () => { throw new Error('nenhuma chamada de rede neste teste'); };

import assert from 'assert';
const { ProjectActionsController } = await import('../src/controllers/ProjectActionsController.js');
const { AppBootstrapSync } = await import('../src/bootstrap/AppBootstrapSync.js');
const { ProjectLifecycle } = await import('../src/services/Storage/ProjectLifecycle.js');
const { DEFAULT_LAYERS } = await import('../src/services/MockData.js');

const features = [{ id: 'f1', layerId: 'layer-topografia', type: 'Point', coordinates: [-23.7, -53.3] }];
const app = {
  projectId: 'aberto',
  projectName: 'Projeto Aberto',
  layers: [...DEFAULT_LAYERS],
  features,
  mapEngine: { map: { getCenter: () => ({ lat: -10, lng: -50 }), getZoom: () => 11, setView: () => { throw new Error('não mexe no mapa'); } } }
};

// 1. Criar gera outro id seguro, com as camadas padrão no enquadramento atual, e navega até ele
const newId = await ProjectActionsController.createProject(app, { name: 'APP Córrego Azul', claim: false });
assert.notStrictEqual(newId, 'aberto');
assert.ok(/^app-corrego-azul_[a-z0-9]{8}$/.test(newId), newId);
assert.deepStrictEqual(assigned, [`http://localhost:5173/?project=${newId}`]);
assert.strictEqual(app.features, features);
assert.strictEqual(app.features.length, 1, 'feições do projeto aberto preservadas');
assert.strictEqual(app.projectName, 'Projeto Aberto');

// 2. Ao abrir o novo id, o boot consome a semente (sem herdar nada do projeto anterior)
const booted = { projectId: newId, projectName: 'Levantamento Topográfico - Umuarama', layers: [...DEFAULT_LAYERS], activeLayerId: 'layer-topografia', features: [], auditLog: [] };
localStorage.setItem('conectemapas_state_v1', JSON.stringify({ id: 'aberto', name: 'Projeto Aberto', layers: DEFAULT_LAYERS, features }));
AppBootstrapSync.loadState(booted);
assert.strictEqual(booted.projectName, 'APP Córrego Azul');
assert.deepStrictEqual(booted.layers.map(l => l.name), DEFAULT_LAYERS.map(l => l.name));
assert.ok(booted.layers.every((l, i) => l.id.startsWith(DEFAULT_LAYERS[i].id + '-') && l.id !== DEFAULT_LAYERS[i].id), 'ids de camada próprios do projeto');
assert.strictEqual(booted.activeLayerId, booted.layers[0].id);
assert.deepStrictEqual(booted.features, []);
assert.deepStrictEqual(booted._projectSeed.center, [-10, -50]);
assert.strictEqual(booted._projectSeed.zoom, 11);
assert.strictEqual(ProjectLifecycle.takeSeed(newId), null, 'semente consumida');

// 3. Sem semente, um id desconhecido não herda o manifesto de outro projeto
const other = { projectId: 'desconhecido', projectName: 'Padrão', layers: [...DEFAULT_LAYERS], activeLayerId: 'layer-topografia', features: [], auditLog: [] };
AppBootstrapSync.loadState(other);
assert.strictEqual(other.projectName, 'Padrão');
assert.deepStrictEqual(other.features, []);

console.log('✔ Novo projeto não toca no aberto');
