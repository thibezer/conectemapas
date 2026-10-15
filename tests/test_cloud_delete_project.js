// Integração (opt-in): exclusão de projeto pelo dono no backend PHP/MySQL.
//   CM_TEST_API_URL=http://127.0.0.1:8099/api.php node tests/test_cloud_delete_project.js
import assert from 'assert';
import { requireTestApiUrl } from './_cloud_target.js';

const url = requireTestApiUrl();
const rnd = () => Math.random().toString(36).slice(2, 10);

async function call(action, { method = 'GET', key = null, body = null, query = '' } = {}) {
  const headers = { Accept: 'application/json' };
  if (key) headers['X-Project-Key'] = key;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${url}?action=${action}${query}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const pid = `it_del_${rnd()}`;
const layerId = `layer-it-${rnd()}`;

// Projeto protegido por chave de dono, com camada, feições, auditoria, link de editor, convite e presença
const claim = await call('claim_project', { method: 'POST', body: { projectId: pid, name: 'Projeto de Teste' } });
assert.strictEqual(claim.status, 200, JSON.stringify(claim.data));
const owner = claim.data.key;
assert.ok(/^cmk_[a-f0-9]{32}$/.test(owner));

let r = await call('load', { key: owner, query: `&projectId=${pid}` });
assert.strictEqual(r.data.project.name, 'Projeto de Teste', 'claim_project grava o nome do projeto novo');

r = await call('save_metadata', { method: 'POST', key: owner, body: { id: pid, name: 'Projeto de Teste', layers: [{ id: layerId, name: 'Lotes', color: '#00E08A' }] } });
assert.strictEqual(r.status, 200, JSON.stringify(r.data));
r = await call('sync_deltas', { method: 'POST', key: owner, body: {
  projectId: pid, clientId: 'it',
  toUpsert: [1, 2].map(i => ({ id: `${pid}-f${i}`, layerId, name: `F${i}`, type: 'Point', coordinates: [-23.7, -53.3 + i / 1000] })),
  toDelete: []
} });
assert.strictEqual(r.status, 200, JSON.stringify(r.data));
r = await call('log_audit', { method: 'POST', key: owner, body: { projectId: pid, action: 'teste', detail: 'x' } });
assert.strictEqual(r.status, 200);
const editor = (await call('create_share', { method: 'POST', key: owner, body: { projectId: pid, role: 'editor' } })).data.key;
assert.ok(editor);
r = await call('create_invite', { method: 'POST', key: owner, body: { projectId: pid, role: 'viewer' } });
assert.strictEqual(r.status, 200, JSON.stringify(r.data));
r = await call('pull_changes', { key: owner, query: `&projectId=${pid}&sinceRev=0&clientId=it&name=Teste&color=%2300E08A` });
assert.strictEqual(r.status, 200);

// Só o dono exclui; GET não exclui; o projeto padrão nunca é excluído
r = await call('delete_project', { method: 'POST', key: editor, body: { projectId: pid } });
assert.strictEqual(r.status, 403);
assert.strictEqual(r.data.code, 'insufficient_role');
r = await call('delete_project', { method: 'POST', body: { projectId: pid } });
assert.strictEqual(r.status, 401);
r = await call('delete_project', { key: owner, query: `&projectId=${pid}` });
assert.strictEqual(r.status, 405);
r = await call('delete_project', { method: 'POST', key: owner, body: { projectId: 'projeto_padrao' } });
assert.strictEqual(r.status, 400);
assert.strictEqual(r.data.code, 'default_project');

// Projeto aberto (sem dono) não pode ser excluído por qualquer um
const openPid = `it_open_${rnd()}`;
await call('save_metadata', { method: 'POST', body: { id: openPid, name: 'Aberto' } });
r = await call('delete_project', { method: 'POST', body: { projectId: openPid } });
assert.strictEqual(r.status, 403);
assert.strictEqual(r.data.code, 'claim_required');

// Dono: tudo do projeto sai numa transação
r = await call('delete_project', { method: 'POST', key: owner, body: { projectId: pid } });
assert.strictEqual(r.status, 200, JSON.stringify(r.data));
const removed = r.data.removed;
assert.strictEqual(removed.cm_projects, 1);
assert.strictEqual(removed.cm_features, 2);
assert.strictEqual(removed.cm_layers, 1);
assert.ok(removed.cm_audit >= 1);
assert.strictEqual(removed.cm_presence, 1);
assert.strictEqual(removed.cm_invites, 1);
assert.strictEqual(removed.cm_access, 2);

// Escritas atrasadas (fila offline, flush ao fechar a aba, outro operador) não recriam o projeto
const gone = [
  await call('load', { key: owner, query: `&projectId=${pid}` }),
  await call('pull_changes', { key: owner, query: `&projectId=${pid}&sinceRev=0` }),
  await call('save_metadata', { method: 'POST', body: { id: pid, name: 'Zumbi' } }),
  await call('sync_deltas', { method: 'POST', body: { projectId: pid, toUpsert: [{ id: `${pid}-z`, layerId, name: 'Z', type: 'Point', coordinates: [-23.7, -53.3] }] } }),
  await call('log_audit', { method: 'POST', body: { projectId: pid, action: 'zumbi' } }),
  await call('claim_project', { method: 'POST', body: { projectId: pid } }),
  await call('delete_project', { method: 'POST', key: owner, body: { projectId: pid } })
];
for (const g of gone) {
  assert.strictEqual(g.status, 410, JSON.stringify(g.data));
  assert.strictEqual(g.data.code, 'project_deleted');
}
r = await call('access_info', { query: `&projectId=${pid}` });
assert.strictEqual(r.data.deleted, true);
assert.strictEqual(r.data.canClaim, false);

// O id de camada fica livre para outro projeto (cm_layers.id é global)
const pid2 = `it_new_${rnd()}`;
await call('save_metadata', { method: 'POST', body: { id: pid2, name: 'Outro', layers: [{ id: layerId, name: 'Reaproveitada' }] } });
r = await call('load', { query: `&projectId=${pid2}` });
assert.deepStrictEqual(r.data.layers.map(l => l.id), [layerId]);

console.log('✔ delete_project OK');
