import assert from 'assert';

const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};

const TOKEN = 'cms_' + 'b'.repeat(64);
const calls = [];
globalThis.fetch = async (url, opts = {}) => {
  const action = new URL(url, 'http://x').searchParams.get('action');
  calls.push({ action, headers: opts.headers || {}, body: opts.body ? JSON.parse(opts.body) : null });
  const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
  if (action === 'auth_login') {
    const { password } = JSON.parse(opts.body);
    return password === 'Correta123'
      ? json(200, { success: true, token: TOKEN, user: { id: 1, name: 'Maria', email: 'm@x.com' } })
      : json(401, { code: 'bad_credentials', error: 'E-mail ou senha incorretos.' });
  }
  if (action === 'auth_register') {
    return json(200, { success: true, token: TOKEN, projectId: 'p9', role: 'editor', user: { id: 2, name: 'João', email: 'j@x.com' } });
  }
  if (action === 'auth_me') return json(200, { success: true, user: null });
  if (action === 'auth_logout') return json(200, { success: true });
  return json(404, {});
};

const { AuthService } = await import('../src/services/Storage/AuthService.js');
const { AccessManager } = await import('../src/services/Storage/AccessManager.js');

assert.strictEqual(AuthService.isLoggedIn(), false);
assert.deepStrictEqual(AccessManager.headers('p1'), {});

// Senha errada: erro com código e sem sessão
await assert.rejects(() => AuthService.login('m@x.com', 'errada'), e => e.code === 'bad_credentials' && e.status === 401);
assert.strictEqual(AuthService.isLoggedIn(), false);

// Login guarda o token e passa a enviá-lo em todas as chamadas à API
const changes = [];
AuthService.onChange(u => changes.push(u && u.name));
await AuthService.login('m@x.com', 'Correta123');
assert.strictEqual(AuthService.getUser().name, 'Maria');
assert.strictEqual(AccessManager.headers('p1')['X-Auth-Token'], TOKEN);

// Cadastro por convite devolve o projeto/papel do convite
const reg = await AuthService.register({ code: 'cmi_' + 'c'.repeat(32), name: 'João', email: 'j@x.com', password: 'Senha12345' });
assert.deepStrictEqual([reg.projectId, reg.role], ['p9', 'editor']);

// Sessão revogada no servidor derruba o login local
await AuthService.refresh();
assert.strictEqual(AuthService.isLoggedIn(), false);

// Logout limpa o token mesmo que a rede falhe
await AuthService.login('m@x.com', 'Correta123');
await AuthService.logout();
assert.strictEqual(AuthService.getToken(), null);
assert.deepStrictEqual(AccessManager.headers('p1'), {});
assert.ok(changes.includes('Maria') && changes.includes(null));

// Token malformado guardado à mão é ignorado
localStorage.setItem('cm_auth_token', 'qualquer-coisa');
assert.strictEqual(AuthService.getToken(), null);

// Convite no fragmento da URL
globalThis.window = { location: { hash: '#invite=cmi_' + 'd'.repeat(32), pathname: '/', search: '?project=p9' }, history: { replaceState() {} } };
assert.strictEqual(AccessManager.takeInviteFromUrl(), 'cmi_' + 'd'.repeat(32));
window.location.hash = '#invite=lixo';
assert.strictEqual(AccessManager.takeInviteFromUrl(), null);

console.log('✔ AuthService OK');
