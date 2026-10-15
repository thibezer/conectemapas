import assert from 'assert';

// Ambiente Node: localStorage em memória; o endpoint é o host reservado .invalid
// (nunca resolve) e o fetch abaixo é falso, então nada sai da máquina.
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};

const calls = [];
let nextResponse = null;
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  const { status = 200, body = {} } = nextResponse || {};
  return { ok: status >= 200 && status < 300, status, json: async () => body };
};
const respond = (status, body) => { nextResponse = { status, body }; };

const { ProjectLifecycle, DEFAULT_PROJECT_ID } = await import('../src/services/Storage/ProjectLifecycle.js');
const { AccessManager } = await import('../src/services/Storage/AccessManager.js');
const { AuthService } = await import('../src/services/Storage/AuthService.js');
const { LocalStore } = await import('../src/services/Storage/LocalStore.js');
const { CLOUD_API_URL } = await import('../src/services/Storage/StorageConstants.js');
const { DEFAULT_LAYERS } = await import('../src/services/MockData.js');

assert.ok(CLOUD_API_URL.includes('.invalid'), 'testes nunca apontam para a produção');

// ---- ID seguro: slug + sufixo aleatório, só [a-zA-Z0-9_-], até 64 caracteres ----
assert.strictEqual(ProjectLifecycle.slugify('Levantamento  Área Norte (2026)!'), 'levantamento-area-norte-2026');
assert.strictEqual(ProjectLifecycle.slugify('🌳🌳'), '');
assert.strictEqual(ProjectLifecycle.generateProjectId('Gleba São José', 'abc12345'), 'gleba-sao-jose_abc12345');
assert.strictEqual(ProjectLifecycle.generateProjectId('***', 'abc12345'), 'projeto_abc12345');
const longId = ProjectLifecycle.generateProjectId('x'.repeat(300));
assert.ok(longId.length <= 64, 'cabe em cm_projects.id (VARCHAR 64)');
const ids = new Set();
for (let i = 0; i < 200; i++) {
  const id = ProjectLifecycle.generateProjectId('Projeto <script>alert(1)</script> ../../');
  assert.ok(/^[a-zA-Z0-9_-]{1,64}$/.test(id), `id inseguro: ${id}`);
  assert.ok(ProjectLifecycle.isValidProjectId(id));
  ids.add(id);
}
assert.strictEqual(ids.size, 200, 'sufixo aleatório evita colisão');
assert.strictEqual(ProjectLifecycle.isValidProjectId('a b'), false);
assert.strictEqual(ProjectLifecycle.isValidProjectId(''), false);

// ---- Semente: camadas com ids próprios (cm_layers.id é global), camadas de origem intactas ----
const baseIds = DEFAULT_LAYERS.map(l => l.id);
const seed = ProjectLifecycle.buildSeed({ name: '  Meu   projeto ', layers: DEFAULT_LAYERS, center: [-23.7661, -53.3206], zoom: 13 }, 'zz9');
assert.strictEqual(seed.name, 'Meu projeto');
assert.deepStrictEqual(seed.layers.map(l => l.id), baseIds.map(id => `${id}-zz9`));
assert.deepStrictEqual(seed.layers.map(l => l.order), baseIds.map((_, i) => i));
assert.deepStrictEqual(DEFAULT_LAYERS.map(l => l.id), baseIds, 'DEFAULT_LAYERS não é alterado');
assert.deepStrictEqual(seed.center, [-23.7661, -53.3206]);
assert.strictEqual(seed.zoom, 13);
assert.strictEqual(ProjectLifecycle.buildSeed({ name: 'x', center: [NaN, 1] }).center, null);

ProjectLifecycle.stageSeed('p_seed', seed);
assert.deepStrictEqual(ProjectLifecycle.takeSeed('p_seed'), seed);
assert.strictEqual(ProjectLifecycle.takeSeed('p_seed'), null, 'a semente é consumida uma vez');
localStorage.setItem('cm_project_seed_p_bad', '{quebrado');
assert.strictEqual(ProjectLifecycle.takeSeed('p_bad'), null);

// ---- Criar sem dono: só a semente, nenhuma chamada à nuvem ----
calls.length = 0;
const created = await ProjectLifecycle.createProject({ name: 'Fazenda Boa Vista', layers: DEFAULT_LAYERS, claim: true }, { cloudEnabled: false });
assert.ok(created.id.startsWith('fazenda-boa-vista_'));
assert.strictEqual(created.claimed, false);
assert.strictEqual(calls.length, 0);
assert.strictEqual(ProjectLifecycle.takeSeed(created.id).name, 'Fazenda Boa Vista');
await assert.rejects(ProjectLifecycle.createProject({ name: '   ' }), /nome/);

// ---- Criar com dono (logado): claim_project leva token e nome; sem login não reivindica ----
AuthService._setSession('cms_' + 'a'.repeat(64), { id: 7, name: 'Ana', email: 'ana@example.invalid' });
calls.length = 0;
respond(200, { success: true, role: 'owner', key: null });
const owned = await ProjectLifecycle.createProject({ name: 'Lote 12', layers: DEFAULT_LAYERS, claim: true }, { cloudEnabled: true });
assert.strictEqual(owned.claimed, true);
assert.strictEqual(calls.length, 1);
assert.ok(calls[0].url.includes('action=claim_project'));
assert.strictEqual(calls[0].init.headers['X-Auth-Token'], 'cms_' + 'a'.repeat(64));
assert.deepStrictEqual(JSON.parse(calls[0].init.body), { projectId: owned.id, label: 'Dono', name: 'Lote 12' });
assert.strictEqual(AccessManager.getRole(owned.id), 'owner');
assert.ok(ProjectLifecycle.takeSeed(owned.id), 'semente fica para o app consumir');

// Falha ao reivindicar: erro sobe e a semente não fica órfã
respond(500, { error: 'Falha ao proteger o projeto', code: 'claim_failed' });
const before = new Set(store.keys());
await assert.rejects(ProjectLifecycle.createProject({ name: 'Falha', claim: true }, { cloudEnabled: true }), /dono/);
assert.deepStrictEqual(new Set(store.keys()), before);

// ---- Quem pode excluir ----
assert.strictEqual(ProjectLifecycle.canDelete(DEFAULT_PROJECT_ID, 'owner', true).allowed, false);
assert.strictEqual(ProjectLifecycle.canDelete(DEFAULT_PROJECT_ID, null, false).allowed, false);
assert.strictEqual(ProjectLifecycle.canDelete('p1', 'owner', true).allowed, true);
assert.strictEqual(ProjectLifecycle.canDelete('p1', 'editor', true).allowed, false);
assert.strictEqual(ProjectLifecycle.canDelete('p1', 'viewer', true).allowed, false);
assert.strictEqual(ProjectLifecycle.canDelete('p1', null, true).allowed, false, 'projeto aberto (sem dono) não é excluível');
assert.strictEqual(ProjectLifecycle.canDelete('p1', 'deleted', true).allowed, false);
assert.strictEqual(ProjectLifecycle.canDelete('p1', null, false).allowed, true, 'modo local apaga só a cópia deste navegador');

// ---- Confirmação digitando o nome ----
assert.strictEqual(ProjectLifecycle.deletionConfirmed('Lote  12 ', 'Lote 12'), true);
assert.strictEqual(ProjectLifecycle.deletionConfirmed('lote 12', 'Lote 12'), false);
assert.strictEqual(ProjectLifecycle.deletionConfirmed('', ''), false);
assert.strictEqual(ProjectLifecycle.deletionConfirmed('Lote', 'Lote 12'), false);

// ---- Excluir: nuvem primeiro, depois a cópia local (só deste projeto) ----
const seedLocal = (pid) => {
  localStorage.setItem('cm_tombstones_' + pid, '["f1"]');
  localStorage.setItem('cm_pending_deltas_' + pid, '{"dirty":[],"deleted":["f1"]}');
  localStorage.setItem('cm_sync_cursor_' + pid, '{"rev":3,"id":""}');
  localStorage.setItem('cm_layers_dirty_' + pid, '1');
  localStorage.setItem('cm_access_key_' + pid, 'cmk_' + 'b'.repeat(32));
  localStorage.setItem('cm-adv-search:' + pid, '[]');
  LocalStore.updateProjectsIndex({ id: pid, name: pid, featureCount: 1 });
};
seedLocal('alvo');
seedLocal('outro');
LocalStore.saveManifest({ id: 'alvo', name: 'Alvo', layers: [], features: [] });

// Sem permissão: nada local é apagado
calls.length = 0;
respond(403, { error: 'Seu acesso (editor) não permite esta ação.', code: 'insufficient_role', role: 'editor' });
let purged = false;
await assert.rejects(ProjectLifecycle.deleteProject('alvo', { cloudEnabled: true, beforePurge: () => { purged = true; } }), /não permite/);
assert.strictEqual(purged, false);
assert.ok(localStorage.getItem('cm_tombstones_alvo'));
assert.strictEqual(LocalStore.loadManifest().id, 'alvo');

// Dono: POST delete_project, depois limpa tudo de "alvo" e nada de "outro"
calls.length = 0;
respond(200, { success: true, projectId: 'alvo', removed: {} });
const order = [];
await ProjectLifecycle.deleteProject('alvo', { cloudEnabled: true, beforePurge: () => order.push('beforePurge') });
assert.strictEqual(calls.length, 1);
assert.ok(calls[0].url.includes('action=delete_project'));
assert.strictEqual(calls[0].init.method, 'POST');
assert.deepStrictEqual(JSON.parse(calls[0].init.body), { projectId: 'alvo' });
assert.deepStrictEqual(order, ['beforePurge']);
assert.strictEqual(AccessManager.getRole('alvo'), 'deleted');
for (const prefix of ['cm_tombstones_', 'cm_pending_deltas_', 'cm_sync_cursor_', 'cm_layers_dirty_', 'cm_access_key_', 'cm-adv-search:']) {
  assert.strictEqual(localStorage.getItem(prefix + 'alvo'), null, `${prefix} do projeto excluído`);
  assert.ok(localStorage.getItem(prefix + 'outro') !== null, `${prefix} de outro projeto é preservado`);
}
assert.strictEqual(LocalStore.loadManifest(), null, 'manifesto do projeto excluído removido');
assert.deepStrictEqual(LocalStore.listProjects().map(p => p.id), ['outro']);

// Manifesto de outro projeto não é tocado; já excluído na nuvem (410) ainda limpa a cópia local
LocalStore.saveManifest({ id: 'outro', name: 'Outro', layers: [], features: [] });
seedLocal('ja_excluido');
respond(410, { error: 'Este projeto foi excluído pelo dono.', code: 'project_deleted' });
await ProjectLifecycle.deleteProject('ja_excluido', { cloudEnabled: true });
assert.strictEqual(localStorage.getItem('cm_tombstones_ja_excluido'), null);
assert.strictEqual(LocalStore.loadManifest().id, 'outro');

// Modo local: sem chamada à nuvem
calls.length = 0;
seedLocal('local1');
await ProjectLifecycle.deleteProject('local1', { cloudEnabled: false });
assert.strictEqual(calls.length, 0);
assert.strictEqual(localStorage.getItem('cm_tombstones_local1'), null);

await assert.rejects(ProjectLifecycle.deleteProject(DEFAULT_PROJECT_ID, { cloudEnabled: false }), /não pode/);
await assert.rejects(ProjectLifecycle.deleteProject('../x', { cloudEnabled: false }), /não pode/);

// Manifesto de outro projeto nunca serve de base para um id diferente
assert.strictEqual(LocalStore.loadManifestFor('novo_x'), null);
assert.strictEqual(LocalStore.loadManifestFor('outro').name, 'Outro');

// ---- Destino depois de excluir: projeto da conta, depois local, por fim o padrão ----
respond(200, { success: true, projects: [{ id: 'alvo' }, { id: 'da_conta' }] });
assert.strictEqual(await ProjectLifecycle.pickFallbackProject('alvo'), 'da_conta');
AuthService._setSession(null, null);
assert.strictEqual(await ProjectLifecycle.pickFallbackProject('alvo'), 'outro');
assert.strictEqual(await ProjectLifecycle.pickFallbackProject('outro'), DEFAULT_PROJECT_ID);

// ---- 410 de qualquer resposta marca o projeto como excluído ----
const seen = [];
AccessManager.onRoleChange((id, role) => seen.push(`${id}:${role}`));
assert.strictEqual(AccessManager.handleDenied('p9', 410, { code: 'project_deleted' }), true);
assert.deepStrictEqual(seen, ['p9:deleted']);
assert.strictEqual(AccessManager.handleDenied('p9', 410, { code: 'outro' }), false);

console.log('✔ ProjectLifecycle OK');
