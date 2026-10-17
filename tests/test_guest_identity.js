import assert from 'assert';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};

const { GuestIdentity, GUEST_NAME_KEY, GUEST_NAME_MAX } = await import('../src/services/Storage/GuestIdentity.js');

console.log('--- Testando GuestIdentity (nome do convidado) ---');

assert.strictEqual(GuestIdentity.getName(), '', 'Sem nome gravado retorna vazio');
assert.strictEqual(GuestIdentity.setName(' '), '', 'Nome em branco é recusado');
assert.strictEqual(GuestIdentity.setName('A'), '', 'Nome curto demais é recusado');
assert.strictEqual(store.has(GUEST_NAME_KEY), false, 'Nome recusado não é gravado');

assert.strictEqual(GuestIdentity.setName('  Marcos \n  Silva\t'), 'Marcos Silva', 'Espaços e controles são normalizados');
assert.strictEqual(GuestIdentity.getName(), 'Marcos Silva', 'O nome é lembrado entre leituras');

assert.strictEqual(GuestIdentity.setName('x'.repeat(100)).length, GUEST_NAME_MAX, 'Nome é limitado ao máximo');

GuestIdentity.clear();
assert.strictEqual(GuestIdentity.getName(), '', 'clear() esquece o nome (ao criar/entrar numa conta)');

console.log('✔ GuestIdentity OK');
