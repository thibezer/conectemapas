// Testes de regressão da Fase 2 (/review: warnings & nitpicks de persistência e sincronização)
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Polyfills mínimos de navegador para execução isolada em Node
const localMap = new Map();
globalThis.localStorage = {
  getItem: (k) => (localMap.has(k) ? localMap.get(k) : null),
  setItem: (k, v) => { localMap.set(k, String(v)); },
  removeItem: (k) => { localMap.delete(k); },
  clear: () => { localMap.clear(); }
};

const sessionMap = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (sessionMap.has(k) ? sessionMap.get(k) : null),
  setItem: (k, v) => { sessionMap.set(k, String(v)); },
  removeItem: (k) => { sessionMap.delete(k); }
};

let fetchHandler = async () => ({ ok: true, status: 200, json: async () => ({ success: true }) });
const fetchLog = [];
globalThis.fetch = async (url, opts = {}) => {
  fetchLog.push({ url: String(url), opts });
  return fetchHandler(String(url), opts);
};
const jsonRes = (data, ok = true, status = 200) => ({ ok, status, json: async () => data });

const { StorageService } = await import('../src/services/StorageService.js');
const { DeltaQueue } = await import('../src/services/Storage/DeltaQueue.js');
const { LocalStore } = await import('../src/services/Storage/LocalStore.js');
const { IndexedDbStore } = await import('../src/services/Storage/IndexedDbStore.js');
const { STORE_PROJECTS, STORE_LAYERS } = await import('../src/services/Storage/StorageConstants.js');
const { normalizeCoordinates } = await import('../src/services/MapEngine/GeometryNormalizer.js');
const { normalizeFeature } = await import('../src/services/MockData.js');
const { GeoWorkerClient } = await import('../src/services/Workers/GeoWorkerClient.js');
const { CollaborationHub } = await import('../src/services/CollaborationHub.js');
const { FeatureSyncController } = await import('../src/controllers/FeatureSyncController.js');
const { ShortcutsController } = await import('../src/controllers/ShortcutsController.js');

const pt = (id, name = id) => ({
  id,
  name,
  type: 'Point',
  layerId: 'l1',
  color: '#00E08A',
  coordinates: [-23.76, -53.32],
  style: { fillColor: '#00E08A', strokeColor: '#00E08A' },
  properties: {}
});

// ---------------------------------------------------------------------------
// 1. Isolamento por projeto na DeltaQueue + setCurrentProjectId
// ---------------------------------------------------------------------------
{
  localMap.clear();
  fetchLog.length = 0;
  fetchHandler = async () => jsonRes({ success: true, rev: 1 });

  StorageService.setCurrentProjectId('proj_iso_a');
  DeltaQueue.queueFeatureUpsert(pt('feat-a', 'A'), 'proj_iso_a');
  DeltaQueue.queueFeatureUpsert(pt('feat-b', 'B'), 'proj_iso_b');

  assert.strictEqual(DeltaQueue.hasPendingLocalChange('feat-a', 'proj_iso_a'), true);
  assert.strictEqual(DeltaQueue.hasPendingLocalChange('feat-a', 'proj_iso_b'), false);
  assert.strictEqual(DeltaQueue.hasPendingLocalChange('feat-b', 'proj_iso_b'), true);
  assert.strictEqual(DeltaQueue.hasPendingLocalChange('feat-b', 'proj_iso_a'), false);

  // Trocar projeto dispara flush do projeto anterior sem contaminar a fila do novo
  StorageService.setCurrentProjectId('proj_iso_c');
  await new Promise(r => setTimeout(r, 20));
  assert.strictEqual(DeltaQueue.hasPendingLocalChange('feat-b', 'proj_iso_b'), true);

  DeltaQueue.discardPending('proj_iso_a');
  DeltaQueue.discardPending('proj_iso_b');
  DeltaQueue.discardPending('proj_iso_c');
  console.log('✔ [1] Isolamento por projeto na DeltaQueue verificado.');
}

// ---------------------------------------------------------------------------
// 2. Drenagem multi-página em pullChangesFromCloud com heldCursor + hasMore
// ---------------------------------------------------------------------------
{
  localMap.clear();
  fetchLog.length = 0;
  const PID = 'proj_multi_page';
  StorageService.setCurrentProjectId(PID);
  DeltaQueue.discardPending(PID);

  // Deixa edição local pendente para forçar retenção do cursor antes de rev=2
  StorageService.queueFeatureUpsert(pt('f-local', 'Minha Edição'), PID);

  const requestedUrls = [];
  fetchHandler = async (url) => {
    requestedUrls.push(url);
    const parsed = new URL(url, 'http://cloud.invalid');
    const sinceRev = Number(parsed.searchParams.get('sinceRev') || 0);
    if (sinceRev === 0) {
      return jsonRes({
        success: true,
        rev: 3,
        cursor: { rev: 3, id: 'rem-2' },
        hasMore: true,
        changes: [
          { id: 'rem-1', rev: 1, deleted: false, feature: pt('rem-1', 'Rem 1') },
          { id: 'f-local', rev: 2, deleted: false, feature: pt('f-local', 'Sobrescrita Nuvem') },
          { id: 'rem-2', rev: 3, deleted: false, feature: pt('rem-2', 'Rem 2') }
        ],
        layers: []
      });
    }
    if (sinceRev === 3) {
      return jsonRes({
        success: true,
        rev: 4,
        cursor: { rev: 4, id: 'rem-3' },
        hasMore: false,
        changes: [
          { id: 'rem-3', rev: 4, deleted: false, feature: pt('rem-3', 'Rem 3 Página 2') }
        ],
        layers: []
      });
    }
    throw new Error(`Paginação inesperada para sinceRev=${sinceRev}`);
  };

  const pullRes = await StorageService.pullChangesFromCloud(PID);
  assert.strictEqual(requestedUrls.length, 2, 'Deve drenar página 2 mesmo com heldCursor na página 1');
  const secondUrl = new URL(requestedUrls[1], 'http://cloud.invalid');
  assert.strictEqual(secondUrl.searchParams.get('sinceRev'), '3');
  assert.strictEqual(secondUrl.searchParams.get('sinceId'), 'rem-2');

  const upIds = pullRes.upserted.map(f => f.id);
  assert.ok(upIds.includes('rem-1'), 'rem-1 da página 1 deve ser aplicado');
  assert.ok(upIds.includes('rem-2'), 'rem-2 da página 1 deve ser aplicado');
  assert.ok(upIds.includes('rem-3'), 'rem-3 da página 2 não pode ficar preso atrás do heldCursor');
  assert.ok(!upIds.includes('f-local'), 'Edição local continua protegida contra sobrescrita');

  const savedCursor = LocalStore.getCachedSyncCursor(PID);
  assert.strictEqual(savedCursor.rev, 1, 'Cursor salvo deve permanecer retido antes de f-local (rev=2)');
  assert.strictEqual(savedCursor.id, 'rem-1');

  DeltaQueue.discardPending(PID);
  console.log('✔ [2] Drenagem multi-página com heldCursor sem perda de alterações posteriores.');
}

// ---------------------------------------------------------------------------
// 3. IndexedDbStore aguarda tx.oncomplete (saveLayersBatch / saveProjectRecord)
// ---------------------------------------------------------------------------
{
  const origGetDB = IndexedDbStore.getDB;
  let txCompleteFired = false;
  let putCount = 0;

  try {
    const mockDb = {
      transaction(storeNames) {
        const stores = new Map();
        const list = Array.isArray(storeNames) ? storeNames : [storeNames];
        for (const name of list) {
          stores.set(name, { put: () => { putCount++; }, delete: () => {} });
        }
        const tx = {
          oncomplete: null,
          onerror: null,
          onabort: null,
          objectStore: (n) => stores.get(n)
        };
        setTimeout(() => {
          txCompleteFired = true;
          tx.oncomplete?.();
        }, 15);
        return tx;
      }
    };
    IndexedDbStore.getDB = async () => mockDb;

    const layersOk = await IndexedDbStore.saveLayersBatch([
      { id: 'l1', name: 'Camada 1', color: '#00E08A' },
      { id: 'l2', name: 'Camada 2', color: '#38BDF8' }
    ], 'proj_idb');

    assert.strictEqual(layersOk, true);
    assert.strictEqual(txCompleteFired, true, 'saveLayersBatch deve resolver somente após tx.oncomplete');
    assert.strictEqual(putCount, 2);

    txCompleteFired = false;
    const projOk = await IndexedDbStore.saveProjectRecord({ id: 'proj_idb', name: 'Teste IDB' });
    assert.strictEqual(projOk, true);
    assert.strictEqual(txCompleteFired, true, 'saveProjectRecord deve resolver somente após tx.oncomplete');

    // Testa abort retornando false
    IndexedDbStore.getDB = async () => ({
      transaction() {
        const tx = {
          oncomplete: null,
          onerror: null,
          onabort: null,
          objectStore: () => ({ put: () => {} })
        };
        setTimeout(() => tx.onabort?.(), 5);
        return tx;
      }
    });
    const abortOk = await IndexedDbStore.saveProjectRecord({ id: 'proj_idb', name: 'Abort' });
    assert.strictEqual(abortOk, false, 'Transação abortada deve retornar false sem travar');
    assert.ok(STORE_PROJECTS && STORE_LAYERS);
  } finally {
    IndexedDbStore.getDB = origGetDB;
  }
  console.log('✔ [3] IndexedDbStore aguarda tx.oncomplete e trata tx.onabort.');
}

// ---------------------------------------------------------------------------
// 4. LocalStore.removeConfirmedDeltas com comparação estrutural sem JSON redundante
// ---------------------------------------------------------------------------
{
  localMap.clear();
  const PID = 'proj_confirm_struct';
  const polyA1 = {
    id: 'f1',
    name: 'Antes',
    type: 'Polygon',
    layerId: 'l1',
    color: '#00E08A',
    coordinates: [[[-23.7, -53.3], [-23.7, -53.2], [-23.8, -53.2], [-23.8, -53.3]]],
    style: { fillColor: '#00E08A' },
    properties: { obs: 'v1' }
  };
  const polyA2 = {
    ...polyA1,
    name: 'Editado Depois do Envio',
    coordinates: [[[-23.7, -53.3], [-23.7, -53.2], [-23.8, -53.2], [-23.8, -53.3]]]
  };
  const featB = pt('f2', 'Intacto');

  // Persiste pendência mais recente (f1 como V2, f2 intacto)
  LocalStore.persistPendingDeltasWithItems([polyA2, featB], [], PID, PID);
  // Confirma envio de f1 V1 e f2
  LocalStore.removeConfirmedDeltas([polyA1, featB], [], PID, PID);

  const remaining = LocalStore.readPendingDeltas(PID);
  assert.strictEqual(remaining.dirty.length, 1, 'Somente f1 modificado localmente após o snapshot enviado deve permanecer');
  assert.strictEqual(remaining.dirty[0].id, 'f1');
  assert.strictEqual(remaining.dirty[0].name, 'Editado Depois do Envio');
  console.log('✔ [4] LocalStore.removeConfirmedDeltas compara estruturalmente sem remover edições mais novas.');
}

// ---------------------------------------------------------------------------
// 5. GeometryNormalizer + MockData: MultiPolygon profundidade 4 e filtro de NaN/degenerada
// ---------------------------------------------------------------------------
{
  const multiPolyCoords = [
    [[{ lat: -23.1, lng: -53.1 }, { lat: -23.1, lng: -53.0 }, { lat: -23.2, lng: -53.0 }, { lat: -23.1, lng: -53.1 }]],
    [[[-24.1, -54.1], [-24.1, -54.0], [-24.2, -54.0], [-24.1, -54.1]]]
  ];
  const normMulti = normalizeCoordinates(multiPolyCoords, 'Polygon');
  assert.strictEqual(normMulti.length, 2, 'MultiPolygon com 2 partes deve preservar ambas as partes');
  assert.strictEqual(normMulti[0][0].length, 3, 'Anel fechado do MultiPolygon deve abrir de 4 para 3 vértices');
  assert.deepStrictEqual(normMulti[0][0][0], [-23.1, -53.1]);
  assert.strictEqual(normMulti[1][0].length, 3);

  const nanPoly = normalizeCoordinates([[-23.1, -53.1], [NaN, -53.0], [-23.2, Infinity]], 'Polygon');
  assert.strictEqual(nanPoly, null, 'Polígono degenerado após remoção de NaN/Infinity deve virar null');

  const workerClient = new GeoWorkerClient();
  const cleanedList = await workerClient.normalizeFeaturesAsync([
    { id: 'ok-1', type: 'Point', coordinates: { lat: -23.5, lng: -53.5 } },
    { id: 'bad-1', type: 'Polygon', coordinates: [[-23.1, -53.1], [NaN, -53.2]] },
    { id: 'ok-2', type: 'LineString', coordinates: [[-23.1, -53.1], [-23.2, -53.2]] }
  ]);
  workerClient.destroy();
  assert.strictEqual(normalizeFeature({ id: 'bad-2', type: 'LineString', coordinates: [[-23.1, -53.1]] }).coordinates, null);
  assert.deepStrictEqual(cleanedList.map(f => f.id), ['ok-1', 'ok-2'], 'Lote deve descartar feições com geometria nula');
  assert.deepStrictEqual(cleanedList[0].coordinates, [-23.5, -53.5]);
  console.log('✔ [5] GeometryNormalizer preserva MultiPolygon e descarta geometrias degeneradas em lote.');
}

// ---------------------------------------------------------------------------
// 6. CollaborationHub batch events + FeatureSyncController.handleCollabEvent
// ---------------------------------------------------------------------------
{
  const emitted = [];
  const hub = new CollaborationHub(null, (ev, payload) => {
    emitted.push({ ev, payload });
  }, 'proj_batch_test');
  hub.channel?.close?.();
  const posted = [];
  hub.channel = {
    postMessage: (msg) => posted.push(msg),
    close: () => {}
  };

  const fBatch1 = { id: 'fb1', name: 'B1', type: 'Point', layerId: 'l1', coordinates: { lat: -23.11, lng: -53.22 } };
  const fBatch2 = { id: 'fb2', name: 'B2', type: 'Point', layerId: 'l1', coordinates: { lat: -23.12, lng: -53.23 } };
  hub.notifyFeaturesBatchCreated([fBatch1, fBatch2]);
  hub.notifyFeaturesBatchUpdated([fBatch1]);
  hub.notifyFeaturesBatchDeleted(['fb1']);

  assert.deepStrictEqual(posted.map(m => m.type), [
    'features:batch-create',
    'features:batch-update',
    'features:batch-delete'
  ]);

  hub.handleIncomingMessage('features:batch-create', { features: [fBatch1, fBatch2] }, { id: 'u2', name: 'Colega' });
  hub.handleIncomingMessage('features:batch-update', { features: [{ ...fBatch1, name: 'B1 Editado' }] }, { id: 'u2', name: 'Colega' });
  hub.handleIncomingMessage('features:batch-delete', { featureIds: ['fb2'] }, { id: 'u2', name: 'Colega' });

  assert.deepStrictEqual(emitted.map(e => e.ev), [
    'features:batch-created',
    'features:batch-updated',
    'features:batch-deleted'
  ]);

  // Verifica normalizeFeature em handleCollabEvent para evento único e batch
  const appMock = {
    projectId: 'proj_batch_test',
    projectName: 'Batch Test',
    currentBasemap: 'google_satelite_puro',
    layers: [{ id: 'l1', name: 'L1', color: '#00E08A', visible: true }],
    features: [],
    mapEngine: {
      rendered: [],
      updateFeature(f) { this.rendered.push(f.id); },
      renderFeatures() {},
      removeFeature() {}
    },
    updateHUD() {},
    refreshMapAndTable() {},
    getLayersWithCounts() { return this.layers; },
    layerPanel: { updateLayers() {}, updateFeatures() {}, handleSelectedFeatureRemoved() {} }
  };

  FeatureSyncController.handleCollabEvent(appMock, 'feature:created', {
    feature: { id: 'single-obj', name: 'Single', type: 'Point', layerId: 'l1', coordinates: { lat: -23.5, lng: -53.4 } }
  });
  const single = appMock.features.find(f => f.id === 'single-obj');
  assert.ok(single && Array.isArray(single.coordinates), 'feature:created deve normalizar coordenadas {lat, lng} -> [lat, lng]');
  assert.deepStrictEqual(single.coordinates, [-23.5, -53.4]);

  FeatureSyncController.handleCollabEvent(appMock, 'features:batch-created', {
    features: [fBatch1, fBatch2]
  });
  const gotB1 = appMock.features.find(f => f.id === 'fb1');
  assert.ok(gotB1 && Array.isArray(gotB1.coordinates));
  assert.deepStrictEqual(gotB1.coordinates, [-23.11, -53.22]);

  FeatureSyncController.handleCollabEvent(appMock, 'features:batch-deleted', {
    featureIds: ['fb2']
  });
  assert.strictEqual(appMock.features.some(f => f.id === 'fb2'), false);
  await new Promise(r => setTimeout(r, 80));
  hub.destroy();
  console.log('✔ [6] Eventos batch e normalização em FeatureSyncController.handleCollabEvent verificados.');
}

// ---------------------------------------------------------------------------
// 7. ShortcutsController.restoreSnapshot usa fast-path _entries e preserva mutação in-place
// ---------------------------------------------------------------------------
{
  const f1 = pt('snap-1', 'Intacta');
  const f2 = pt('snap-2', 'Original');
  const appSnap = { features: [f1, f2] };

  const snap = ShortcutsController.takeSnapshot(appSnap);
  assert.ok(Array.isArray(snap._entries) && snap._entries.length === 2, 'Snapshot deve anexar _entries não-enumerável');

  // Mutação in-place pós-snapshot em f2 (f1 permanece intocado)
  f2.name = 'Mutado No Lugar';
  f2.style.fillColor = '#FF0000';

  let jsonParseCalls = 0;
  const origParse = JSON.parse;
  JSON.parse = (...args) => {
    jsonParseCalls++;
    return origParse(...args);
  };
  try {
    const restored = ShortcutsController.restoreSnapshot(snap, appSnap.features);
    assert.strictEqual(restored[0], f1, 'Feição intocada deve manter exatamente a mesma referência');
    assert.strictEqual(restored[1].name, 'Original', 'Feição mutada in-place deve ser restaurada pelo snapshot');
    assert.strictEqual(restored[1].style.fillColor, '#00E08A');
    assert.strictEqual(jsonParseCalls, 1, 'Somente a feição alterada (f2) deve passar por JSON.parse; f1 usa fast-path O(1)');
  } finally {
    JSON.parse = origParse;
  }
  console.log('✔ [7] ShortcutsController.restoreSnapshot evita JSON.parse em feições inalteradas via _entries.');
}

// ---------------------------------------------------------------------------
// 8. Checagens estruturais finais (AppComponentsBuilder, ProjectActionsController, main.js, api.php)
// ---------------------------------------------------------------------------
{
  const builderSrc = fs.readFileSync(path.join(ROOT, 'src/bootstrap/AppComponentsBuilder.js'), 'utf8');
  assert.ok(builderSrc.includes("await StorageService.commitDeltas(pid, { waitForCloud: true })"));
  assert.ok(builderSrc.includes('syncMetadataToCloud('));
  assert.ok(builderSrc.includes('waitForCloudPushIdle()'));
  assert.ok(!/onFeaturesReorder:[\s\S]{0,160}queueFeaturesBulkUpsert/.test(builderSrc), 'onFeaturesReorder não deve enfileirar bulk upsert nem duplicar metadata');

  const projActionsSrc = fs.readFileSync(path.join(ROOT, 'src/controllers/ProjectActionsController.js'), 'utf8');
  assert.ok(!projActionsSrc.includes('syncProjectToCloudDebounced('), 'handleImport não deve disparar save_all completo redundante');
  assert.ok(projActionsSrc.includes('commitDeltasDebounced(200, app.projectId)'));
  assert.ok(/deleteLayer\s*\([\s\S]*app\.pushHistory\?\./.test(projActionsSrc), 'deleteLayer deve registrar histórico');
  assert.ok(projActionsSrc.includes('notifyFeaturesBatchUpdated'), 'deleteLayer deve notificar movimentação em lote');

  const mainSrc = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
  assert.ok(mainSrc.includes('StorageService.deleteFeature(featureId, this.projectId)'), 'main.removeFeature deve repassar projectId');

  const apiSrc = fs.readFileSync(path.join(ROOT, 'public/api.php'), 'utf8');
  assert.ok(apiSrc.includes('CM_ALLOWED_ORIGINS'), 'CORS deve ser configurável via CM_ALLOWED_ORIGINS');
  assert.ok(apiSrc.includes('CM_MAX_BODY_BYTES') && apiSrc.includes('http_response_code(413)'), 'getJsonBody deve aplicar teto de tamanho (HTTP 413)');
  assert.ok(/function executeFeatureUpsert[\s\S]*preg_match\('\/\^#\[0-9a-fA-F\]\{3,8\}\$\/', \$rawColor\)/.test(apiSrc), 'executeFeatureUpsert deve validar cor hex');
  assert.ok((apiSrc.match(/unset\(\$props\['radius'\], \$props\['visible'\]\);/g) || []).length >= 2, 'decodeFeatureRow e load devem limpar radius/visible de properties');
  assert.ok(/INSERT IGNORE INTO cm_layers[\s\S]*rev, updated_at/.test(apiSrc), 'load deve atribuir nextRevision às camadas recriadas automaticamente');
  const saveMetaMatch = apiSrc.match(/case 'save_metadata':[\s\S]*?assertProjectNotDeleted/);
  assert.ok(saveMetaMatch && !/ON DUPLICATE KEY UPDATE[\s\S]*feature_count\s*=/.test(saveMetaMatch[0]), 'save_metadata não deve sobrescrever feature_count no ON DUPLICATE KEY UPDATE');

  console.log('✔ [8] Contratos estruturais (AppComponentsBuilder, ProjectActionsController, main.js, api.php) validados.');
}

console.log('\n🎉 Todos os testes da Fase 2 (/review) passaram!');
