import assert from 'assert';

const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};

const { AccessManager } = await import('../src/services/Storage/AccessManager.js');

const KEY = 'cmk_' + 'a'.repeat(32);

// Chave inválida nunca é guardada nem enviada
AccessManager.setKey('p1', 'lixo');
assert.strictEqual(AccessManager.getKey('p1'), null);
assert.deepStrictEqual(AccessManager.headers('p1'), {});

// Chave válida vai no header, isolada por projeto
AccessManager.setKey('p1', KEY);
assert.strictEqual(AccessManager.headers('p1', { Accept: 'x' })['X-Project-Key'], KEY);
assert.strictEqual(AccessManager.getKey('p2'), null);

// Papéis: sem informação = pode tentar (projeto aberto); leitor e sem acesso não escrevem
assert.strictEqual(AccessManager.canWrite('p1'), true);
const seen = [];
AccessManager.onRoleChange((id, role) => seen.push(`${id}:${role}`));
AccessManager.handleDenied('p1', 403, { code: 'insufficient_role', role: 'viewer' });
assert.strictEqual(AccessManager.canWrite('p1'), false);
AccessManager.handleDenied('p1', 401, { code: 'key_required' });
assert.strictEqual(AccessManager.getRole('p1'), 'none');
assert.deepStrictEqual(seen, ['p1:viewer', 'p1:none']);
assert.strictEqual(AccessManager.handleDenied('p1', 500, {}), false);

AccessManager.setRole('p1', 'owner');
assert.strictEqual(AccessManager.canWrite('p1'), true);

// Link de compartilhamento leva a chave no fragmento, nunca na query
const url = AccessManager.buildShareUrl('p1', KEY);
assert.ok(url.endsWith(`#k=${KEY}`));
assert.ok(!url.split('#')[0].includes(KEY));

console.log('✔ AccessManager OK');
