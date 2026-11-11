import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('🧪 Iniciando testes de regressão dos blockers de segurança e persistência...');

const noop = () => {};
function makeEl() {
  return {
    style: {},
    dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    setAttribute: noop,
    getAttribute: () => null,
    appendChild: noop,
    addEventListener: noop,
    removeEventListener: noop,
    querySelectorAll: () => [],
    querySelector: () => null,
    getBoundingClientRect: () => ({ top: 100, bottom: 140, left: 10, right: 180, width: 170, height: 40 }),
    innerHTML: '',
    textContent: ''
  };
}

global.localStorage = {
  store: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};
globalThis.window = {
  innerWidth: 1920,
  innerHeight: 1080,
  addEventListener: noop,
  removeEventListener: noop,
  location: { search: '', hash: '', href: 'http://cloud.invalid/' }
};
globalThis.document = {
  createElement: makeEl,
  documentElement: { style: {} },
  body: makeEl(),
  addEventListener: noop,
  removeEventListener: noop,
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  activeElement: null
};
globalThis.HTMLElement = class {};
globalThis.customElements = { define: noop, get: () => null };
globalThis.CSSStyleSheet = class { replaceSync() {} };

const { GeoCompressor } = await import('../src/services/GeoCompressor.js');
const { LocalStore } = await import('../src/services/Storage/LocalStore.js');
const { DeltaQueue } = await import('../src/services/Storage/DeltaQueue.js');
const { IndexedDbStore } = await import('../src/services/Storage/IndexedDbStore.js');
const { StorageService } = await import('../src/services/StorageService.js');
const { AppBootstrapSync } = await import('../src/bootstrap/AppBootstrapSync.js');
const { FeatureSyncController } = await import('../src/controllers/FeatureSyncController.js');
const { LayerTreeTab } = await import('../src/components/LayerPanel/LayerTreeTab.js');
const { CollabAuditTab } = await import('../src/components/LayerPanel/CollabAuditTab.js');
const { DrawingToolbar } = await import('../src/components/DrawingToolbar.js');

// --------------------------------------------------------------------------
// 1. GeoCompressor preserva feat.status na compactação para IndexedDB
// --------------------------------------------------------------------------
{
  const featWithStatus = {
    id: 'feat-status-1',
    name: 'Marco A',
    type: 'Point',
    layerId: 'l1',
    coordinates: [-23.7661, -53.3206],
    status: 'em_revisao',
    locked: true
  };
  const compacted = GeoCompressor.compactFeatureForStorage(featWithStatus);
  assert.strictEqual(compacted.status, 'em_revisao', 'GeoCompressor deve preservar feat.status');
  assert.strictEqual(compacted.locked, true);

  const withoutStatus = GeoCompressor.compactFeatureForStorage({
    id: 'feat-status-2',
    type: 'Point',
    coordinates: [-23.7661, -53.3206]
  });
  assert.strictEqual('status' in withoutStatus, false, 'Não deve criar chave status quando ausente');
  console.log('✔ GeoCompressor preserva feat.status na compactação');
}

// --------------------------------------------------------------------------
// 2. Auto-cura contínua com feature_count (snake_case) e merge pós releaseTimer
// --------------------------------------------------------------------------
{
  global.localStorage.clear();
  DeltaQueue.discardPending('proj_heal');

  // 2a. Merge preserva feição local pendente criada durante hydrateFromCloud / loadStateAsync
  const pendingFeat = {
    id: 'f-created-during-boot',
    name: 'Criada nos 5s',
    type: 'Point',
    layerId: 'l1',
    coordinates: [-23.76, -53.32]
  };
  StorageService.queueFeatureUpsert(pendingFeat, 'proj_heal');

  const cloudEditedLocal = {
    id: 'f-shared',
    name: 'Versão Local Pendente',
    type: 'Point',
    layerId: 'l1',
    coordinates: [-23.77, -53.33]
  };
  StorageService.queueFeatureUpsert(cloudEditedLocal, 'proj_heal');

  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('action=load')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            exists: true,
            rev: 12,
            project: { name: 'Projeto Teste', basemap: 'osm', feature_count: 2 },
            layers: [{ id: 'l1', name: 'Camada 1', color: '#00E08A', visible: true }],
            features: [
              { id: 'f-cloud-only', name: 'Nuvem', type: 'Point', layerId: 'l1', coordinates: [-23.75, -53.31] },
              { id: 'f-shared', name: 'Versão Antiga Nuvem', type: 'Point', layerId: 'l1', coordinates: [-23.77, -53.33] }
            ]
          })
        };
      }
      if (u.includes('action=pull_changes')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            rev: 12,
            upserted: [],
            deleted: [],
            layers: [],
            audit: [],
            chat: [],
            project: {
              name: 'Projeto Teste',
              basemap: 'osm',
              feature_count: 2
            }
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    };

    const app = {
      projectId: 'proj_heal',
      layers: [],
      features: [pendingFeat, cloudEditedLocal],
      refreshMapAndTable: noop,
      applyProjectMetadata: noop,
      saveState: noop
    };

    await AppBootstrapSync.hydrateFromCloud(app);
    const ids = app.features.map(f => f.id);
    assert.ok(ids.includes('f-cloud-only'), 'Deve trazer feições da nuvem');
    assert.ok(ids.includes('f-created-during-boot'), 'Não pode apagar feição local pendente criada durante a janela do releaseTimer');
    const shared = app.features.find(f => f.id === 'f-shared');
    assert.strictEqual(shared?.name, 'Versão Local Pendente', 'Edição local pendente deve vencer na hidratação');

    // 2b. startCloudSyncLoop: servidor envia feature_count (snake_case) > 0 com app.features = []
    DeltaQueue.discardPending('proj_heal_2');
    let healedLoadCalled = false;
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('action=pull_changes')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            rev: 5,
            upserted: [],
            deleted: [],
            layers: [],
            audit: [],
            chat: [],
            project: { name: 'Projeto AutoCura', basemap: 'osm', feature_count: 3 }
          })
        };
      }
      if (u.includes('action=load')) {
        healedLoadCalled = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            exists: true,
            rev: 5,
            project: { name: 'Projeto AutoCura', basemap: 'osm', feature_count: 1 },
            layers: [{ id: 'l1', name: 'Camada 1', color: '#00E08A', visible: true }],
            features: [{ id: 'f-restored', name: 'Restaurada', type: 'Point', layerId: 'l1', coordinates: [-23.76, -53.32] }]
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    };

    const appEmpty = {
      projectId: 'proj_heal_2',
      projectName: 'Projeto AutoCura',
      layers: [],
      features: [],
      currentBasemap: 'osm',
      refreshMapAndTable: noop,
      applyProjectMetadata: noop,
      saveState: noop
    };

    StorageService.setCurrentProjectId?.('proj_heal_2');
    let capturedTick = null;
    const origSetTimeout = globalThis.setTimeout;
    const origClearTimeout = globalThis.clearTimeout;
    globalThis.setTimeout = (fn) => {
      if (!capturedTick) capturedTick = fn;
      return 999;
    };
    globalThis.clearTimeout = noop;
    const origDocumentHidden = Object.getOwnPropertyDescriptor(globalThis.document, 'hidden');
    const origNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis.document, 'hidden', { value: false, configurable: true });
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: true, userAgent: 'node' }, configurable: true });
    try {
      AppBootstrapSync.startCloudSyncLoop(appEmpty);
      assert.strictEqual(typeof capturedTick, 'function', 'Loop deve agendar tick inicial via setTimeout');
      await capturedTick();
    } finally {
      globalThis.setTimeout = origSetTimeout;
      globalThis.clearTimeout = origClearTimeout;
      if (origDocumentHidden) Object.defineProperty(globalThis.document, 'hidden', origDocumentHidden);
      else delete globalThis.document.hidden;
      if (origNavDesc) Object.defineProperty(globalThis, 'navigator', origNavDesc);
    }

    assert.strictEqual(healedLoadCalled, true, 'Auto-cura deve disparar quando servidor reporta feature_count > 0 e local está vazio');
    assert.strictEqual(appEmpty.features.length, 1);
    assert.strictEqual(appEmpty.features[0].id, 'f-restored');
  } finally {
    globalThis.fetch = origFetch;
  }
  console.log('✔ Auto-cura contínua (feature_count) e merge de feições pendentes verificados');
}

// --------------------------------------------------------------------------
// 3. IndexedDbStore.discardOversizedCache não apaga offline + LocalStore QuotaExceeded
// --------------------------------------------------------------------------
{
  const navDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let readWriteOpened = false;
  const fakeDb = {
    transaction(storeName, mode) {
      if (mode === 'readwrite') readWriteOpened = true;
      return {
        objectStore() {
          return {
            index() {
              return {
                count() {
                  const req = { result: 65000 };
                  setTimeout(() => req.onsuccess?.(), 0);
                  return req;
                }
              };
            }
          };
        }
      };
    }
  };
  globalThis.IDBKeyRange = globalThis.IDBKeyRange || { only: (v) => v };

  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false, userAgent: 'node' },
      configurable: true
    });
    const discarded = await IndexedDbStore.discardOversizedCache(fakeDb, 'proj_offline');
    assert.strictEqual(discarded, false, 'Nunca deve descartar cache local >50k quando navigator.onLine === false');
    assert.strictEqual(readWriteOpened, false, 'Não deve abrir transação readwrite quando offline');
  } finally {
    if (navDesc) Object.defineProperty(globalThis, 'navigator', navDesc);
  }

  // Simula QuotaExceededError no LocalStore.flushQueuedPendingWrites
  global.localStorage.clear();
  const origSetItem = global.localStorage.setItem;
  const origWarn = console.warn;
  let warnCount = 0;
  try {
    console.warn = () => { warnCount++; };
    LocalStore.persistPendingDeltasWithItems(
      [{ id: 'f-quota', name: 'Quota', type: 'Point', coordinates: [-23, -53] }],
      [],
      'proj_quota',
      'proj_quota'
    );
    global.localStorage.setItem = () => {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    };
    LocalStore.flushQueuedPendingWrites();
    assert.ok(warnCount > 0, 'Deve avisar via console.warn em falha de cota do localStorage');
    assert.strictEqual(LocalStore.getOfflinePendingIds('proj_quota').has('f-quota'), true, 'Cache em memória de pendências offline deve sobreviver a QuotaExceededError');
  } finally {
    global.localStorage.setItem = origSetItem;
    console.warn = origWarn;
    global.localStorage.clear();
  }
  console.log('✔ discardOversizedCache offline-safe e tratamento de QuotaExceededError em LocalStore verificados');
}

// --------------------------------------------------------------------------
// 4. Bloqueio de camada: LayerTreeTab delega sem mutação e AppComponentsBuilder persiste
// --------------------------------------------------------------------------
{
  global.localStorage.clear();
  DeltaQueue.discardPending('proj_lock');

  const listeners = {};
  const fakeEl = {
    addEventListener(evt, fn) { listeners[evt] = fn; },
    definirCamadas: noop,
    expandedLayers: new Set(),
    camadas: []
  };

  let delegateCalls = [];
  const originalFeat = { id: 'f-1', layerId: 'l1', name: 'Lote 1', type: 'Polygon', locked: false, coordinates: [[-23, -53], [-23.01, -53], [-23.01, -53.01]] };
  const fakePanel = {
    layers: [{ id: 'l1', name: 'Quadra A', locked: false }],
    features: [originalFeat],
    selectedFeatureIds: new Set(),
    onLayerLockToggle: (id, locked) => delegateCalls.push({ id, locked })
  };

  const origGetById = globalThis.document.getElementById;
  globalThis.document.getElementById = (id) => (id === 'cm-ui-camadas' ? fakeEl : null);
  try {
    LayerTreeTab.bindEvents(fakePanel);
  } finally {
    globalThis.document.getElementById = origGetById;
  }
  assert.strictEqual(typeof listeners['ui-camada-bloqueio'], 'function');
  listeners['ui-camada-bloqueio']({ detail: { camadaId: 'l1', bloqueado: true } });

  assert.strictEqual(delegateCalls.length, 1, 'ui-camada-bloqueio deve delegar para panel.onLayerLockToggle');
  assert.deepStrictEqual(delegateCalls[0], { id: 'l1', locked: true });
  assert.strictEqual(originalFeat.locked, false, 'LayerTreeTab não deve mutar feições no lugar');

  // Verifica contrato de ligação em LayerPanel.js e AppComponentsBuilder.js
  const layerPanelSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'LayerPanel.js'), 'utf8');
  assert.ok(layerPanelSrc.includes('this.onLayerLockToggle = options.onLayerLockToggle || (() => {});'), 'LayerPanel deve expor onLayerLockToggle');
  const builderSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'bootstrap', 'AppComponentsBuilder.js'), 'utf8');
  assert.ok(builderSrc.includes('onLayerLockToggle: (layerId, isLocked) => FeatureSyncController.toggleLayerLock(app, layerId, isLocked)'), 'AppComponentsBuilder deve ligar onLayerLockToggle a FeatureSyncController.toggleLayerLock');

  // Testa FeatureSyncController.toggleLayerLock
  const historyCalls = [];
  const bulkSaved = [];
  const notifiedFeatures = [];
  const notifiedLayers = [];
  const mapRendered = [];
  let metadataCalls = 0;
  let hudCalls = 0;

  const app = {
    projectId: 'proj_lock',
    layers: [{ id: 'l1', name: 'Quadra A', color: '#00E08A', locked: false }],
    features: [
      originalFeat,
      { id: 'f-2', layerId: 'l2', name: 'Outro', type: 'Point', locked: false, coordinates: [-23, -53] }
    ],
    getLayersWithCounts() { return this.layers.map(l => ({ ...l, count: 1 })); },
    pushHistory(label) { historyCalls.push(label); },
    saveFeaturesBulk(feats) { bulkSaved.push(feats); },
    saveMetadata() { metadataCalls++; },
    updateHUD() { hudCalls++; },
    mapEngine: { renderFeatures: (feats, layers) => mapRendered.push({ feats, layers }) },
    layerPanel: {
      updateFeatures: noop,
      updateLayers: noop
    },
    attributeTable: { setData: noop },
    collabHub: {
      notifyFeatureUpdated: (f) => notifiedFeatures.push(f),
      notifyLayerUpdated: (l) => notifiedLayers.push(l)
    }
  };

  const updated = FeatureSyncController.toggleLayerLock(app, 'l1', true);
  assert.strictEqual(updated.length, 1);
  assert.strictEqual(originalFeat.locked, false, 'Objeto original no snapshot não pode ser mutado');
  assert.strictEqual(app.features[0].locked, true, 'Nova referência da feição da camada deve estar bloqueada');
  assert.notStrictEqual(app.features[0], originalFeat, 'Feição alterada deve ganhar nova referência');
  assert.strictEqual(app.features[1].locked, false, 'Feição de outra camada não deve ser afetada');
  assert.strictEqual(app.layers[0].locked, true, 'Estado locked da camada atualizado');
  assert.strictEqual(historyCalls.length, 1, 'Deve registrar passo no histórico Ctrl+Z');
  assert.strictEqual(bulkSaved.length, 1, 'Deve persistir feições em lote via saveFeaturesBulk');
  assert.strictEqual(bulkSaved[0][0].id, 'f-1');
  assert.strictEqual(notifiedFeatures.length, 1, 'Deve notificar colaboradores sobre feição atualizada');
  assert.strictEqual(notifiedLayers.length, 1, 'Deve notificar colaboradores sobre camada atualizada');
  assert.strictEqual(mapRendered.length, 1, 'Deve atualizar renderização no mapa');
  assert.strictEqual(metadataCalls, 1, 'Deve salvar metadados');
  assert.strictEqual(hudCalls, 1, 'Deve atualizar HUD');
  console.log('✔ Bloqueio de camada imutável, persistente e sincronizado verificado');
}

// --------------------------------------------------------------------------
// 5. Sanitização de cores em UI + Auditoria estrutural de public/api.php
// --------------------------------------------------------------------------
{
  assert.strictEqual(CollabAuditTab.sanitizeCssColor('#00E08A'), '#00E08A');
  assert.strictEqual(CollabAuditTab.sanitizeCssColor(' #abc '), '#abc');
  assert.strictEqual(
    CollabAuditTab.sanitizeCssColor('red; background-image: url(https://evil.invalid)', '#00E08A'),
    '#00E08A',
    'Deve bloquear injeção de CSS em cores remotas'
  );

  const mockPanel = {
    app: { collabHub: { currentUser: { id: 'u-self' } } },
    teamMembers: [{ id: 'u-2', name: 'Atacante', color: 'red" onclick="alert(1)', role: 'Editor' }],
    escapeHtml: (s) => String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  };
  const msgHtml = CollabAuditTab.renderMessage(mockPanel, {
    user: { id: 'u-2', name: 'Atacante', color: 'blue; position:fixed' },
    text: 'olá',
    timestamp: '10:00'
  });
  assert.ok(!msgHtml.includes('position:fixed'), 'Cor maliciosa não pode entrar no style da mensagem');
  assert.ok(msgHtml.includes('var(--cm-primary)'), 'Cor inválida no chat deve cair para fallback');

  const membersHtml = CollabAuditTab.renderMembers(mockPanel);
  assert.ok(!membersHtml.includes('onclick'), 'Cor maliciosa não pode injetar atributo em membro');
  assert.ok(membersHtml.includes('#00E08A'), 'Cor inválida de membro deve cair para fallback #00E08A');

  // Testa DrawingToolbar.openLayerMenu
  let capturedListHtml = '';
  const makeMenuNode = () => ({
    ...makeEl(),
    getBoundingClientRect: () => ({ top: 100, bottom: 140, left: 10, right: 180, width: 170, height: 40 })
  });
  const listNode = {
    ...makeEl(),
    set innerHTML(v) { capturedListHtml = v; },
    get innerHTML() { return capturedListHtml; },
    querySelectorAll: () => []
  };
  const nodes = {
    '#cm-layer-dropdown-menu': makeMenuNode(),
    '#cm-layer-dropdown-list': listNode,
    '#cm-layer-dropdown-badge': makeEl(),
    '.cm-drawing-toolbar-wrapper': makeEl(),
    '#cm-active-layer-pill': makeMenuNode()
  };
  const fakeToolbar = {
    activeLayer: { id: 'l1' },
    getLayers: () => [
      { id: 'l1', name: 'Camada Maliciosa', color: 'red; background: url(x)' }
    ],
    container: {
      querySelector: (sel) => nodes[sel] || null
    },
    _esc: DrawingToolbar.prototype._esc
  };
  DrawingToolbar.prototype.openLayerMenu.call(fakeToolbar);
  assert.ok(capturedListHtml.includes('background: #00E08A;'), 'DrawingToolbar deve sanitizar layer.color');
  assert.ok(!capturedListHtml.includes('url(x)'), 'DrawingToolbar não pode renderizar payload CSS em layer.color');

  // Auditoria estrutural em public/api.php
  const apiPhp = fs.readFileSync(path.join(ROOT_DIR, 'public', 'api.php'), 'utf8');
  const schemaMatch = apiPhp.match(/define\('CM_SCHEMA_VERSION',\s*(\d+)\);/);
  assert.ok(schemaMatch && Number(schemaMatch[1]) >= 10, 'CM_SCHEMA_VERSION deve ser >= 10 após adição de force_reload_epoch');
  assert.ok(!apiPhp.includes('CM_FORCE_RELOAD_FILE'), 'Arquivo global .cm_force_reload deve ser removido para evitar DoS cross-tenant');
  assert.ok(!apiPhp.includes('.cm_force_reload'), 'Nenhuma referência ao arquivo global .cm_force_reload pode restar');
  assert.ok(/force_reload_epoch\s+BIGINT/.test(apiPhp), 'Tabela cm_projects deve definir coluna force_reload_epoch');
  assert.ok(
    /UPDATE cm_projects SET force_reload_epoch\s*=\s*\?\s*WHERE id\s*=\s*\?/.test(apiPhp),
    'force_reload deve atualizar epoch estritamente por projectId'
  );
  assert.ok(
    /case\s*'list_projects'[\s\S]*?NOT EXISTS\s*\(\s*SELECT 1 FROM cm_access[\s\S]*?NOT EXISTS\s*\(\s*SELECT 1 FROM cm_members/i.test(apiPhp),
    'list_projects deve ocultar projetos protegidos por cm_access e por cm_members'
  );
  assert.ok(
    /upsertChangedLayers[\s\S]*?preg_match\(['"]\/\^#\[0-9a-fA-F\]\{3,8\}\$\/['"]/.test(apiPhp),
    'upsertChangedLayers deve validar cor hex antes de gravar no banco'
  );
  console.log('✔ Sanitização de cor e blindagem estrutural de public/api.php verificadas');
}

console.log('\n🎉 Todos os testes de regressão dos blockers passaram!');
