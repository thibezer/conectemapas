import { nextFeatureName } from '../src/utils/featureNaming.js';

console.log('🧪 Testando nextFeatureName...');

const fail = (msg) => { console.error('✖ ' + msg); process.exit(1); };
const eq = (a, b, msg) => { if (a !== b) fail(`${msg}: esperado "${b}", obtido "${a}"`); };

eq(nextFeatureName([], 'Polígono'), 'Polígono 1', 'projeto vazio');
eq(nextFeatureName(null, 'Ponto'), 'Ponto 1', 'lista ausente');
eq(nextFeatureName([{ name: 'Polígono 1' }, { name: 'Polígono 4' }, { name: 'Ponto 9' }], 'Polígono'), 'Polígono 5', 'segue o maior');
eq(nextFeatureName([{ name: 'Polígono #526' }], 'Polígono'), 'Polígono 527', 'formato antigo');
eq(nextFeatureName([{ name: 'Polígono 3 (Parte 1)' }, { name: 'Lote Polígono 8' }], 'Polígono'), 'Polígono 1', 'ignora nomes parecidos');
eq(nextFeatureName([{ name: 'Raio 100m 2' }], 'Raio 100m'), 'Raio 100m 3', 'prefixo com número');
eq(nextFeatureName([{}, { name: null }], 'Rota'), 'Rota 1', 'feições sem nome');

console.log('✔ nextFeatureName OK');
