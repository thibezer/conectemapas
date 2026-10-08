import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('🧪 Testando isolamento entre o ambiente local de testes e a nuvem de produção...');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (tag) => import(`../src/services/Storage/StorageConstants.js?${tag}`);

let fetchCalls = 0;
globalThis.fetch = async () => { fetchCalls++; return { ok: true, json: async () => ({}) }; };

// 1. localhost (npm run dev): nuvem desativada e nenhuma requisição sai
globalThis.window = { location: { hostname: 'localhost' } };
const dev = await load('dev');
assert.strictEqual(dev.CLOUD_API_URL, '');
assert.strictEqual(dev.CLOUD_ENABLED, false);
await assert.rejects(() => dev.cloudFetch('?action=sync_deltas', { method: 'POST' }), /desativada/);
assert.strictEqual(fetchCalls, 0, 'cloudFetch não pode chamar fetch com a nuvem desativada');
console.log('✔ localhost: nuvem desativada, nenhuma chamada de rede');

// 2. Hospedagem: usa o api.php da própria origem
globalThis.window = { location: { hostname: 'meu-site.example' } };
const prod = await load('prod');
assert.strictEqual(prod.CLOUD_API_URL, './api.php');
assert.strictEqual(prod.CLOUD_ENABLED, true);
await prod.cloudFetch('./api.php?action=status');
assert.strictEqual(fetchCalls, 1);
console.log('✔ hospedagem: usa ./api.php da própria origem');

// 3. Node sem window (testes): host reservado que nunca resolve
delete globalThis.window;
const node = await load('node');
assert(node.CLOUD_API_URL.includes('.invalid'), 'sem window deve usar host .invalid');
console.log('✔ testes em Node: host .invalid');

// 4. Nenhum arquivo versionado de código/testes pode conter o endereço de produção
const offenders = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|html)$/.test(entry.name) && full !== fileURLToPath(import.meta.url) && !full.endsWith('_cloud_target.js')) {
      if (/hostingersite\.com/.test(fs.readFileSync(full, 'utf8'))) offenders.push(path.relative(root, full));
    }
  }
};
walk(path.join(root, 'src'));
walk(path.join(root, 'tests'));
assert.deepStrictEqual(offenders, [], `URL de produção hardcoded em: ${offenders.join(', ')}`);
console.log('✔ nenhuma URL de produção hardcoded em src/ e tests/');

console.log('🏁 Isolamento local x nuvem: todos os testes passaram');
