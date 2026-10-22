// Histórico de desfazer/refazer: snapshot por feição com strings compartilhadas entre passos
import assert from 'assert';
import { ShortcutsController } from '../src/controllers/ShortcutsController.js';

console.log('🧪 Snapshots de histórico por feição...');

const mk = (i) => ({ id: `f${i}`, name: `Feição ${i}`, coordinates: [[i, 1], [i, 2], [i + 1, 2]], style: { fillColor: '#fff' }, properties: { n: i } });
const app = { features: Array.from({ length: 1000 }, (_, i) => mk(i)), historyUndo: [], historyRedo: [] };

// 1. O snapshot é uma cópia profunda: alteração no lugar depois do pushHistory não o corrompe
ShortcutsController.pushHistory(app, 'a');
app.features[3].name = 'mudou no lugar';
app.features[4].style.fillColor = '#000';
const first = ShortcutsController.restoreSnapshot(app.historyUndo[0], app.features);
assert.strictEqual(first[3].name, 'Feição 3', 'snapshot não enxerga a alteração feita no lugar');
assert.strictEqual(first[4].style.fillColor, '#fff');
assert.strictEqual(first[5], app.features[5], 'feição inalterada mantém a referência');
assert.notStrictEqual(first[3], app.features[3]);

// 2. Passos seguintes compartilham a string das feições que não mudaram
app.features = app.features.map(f => f.id === 'f10' ? { ...f, name: 'editada' } : f);
ShortcutsController.pushHistory(app, 'b');
const [s1, s2] = app.historyUndo;
assert.strictEqual(s1.length, 1000);
let shared = 0;
for (let i = 0; i < 1000; i++) if (s1[i] === s2[i] && Object.is(s1[i], s2[i])) shared++;
assert.ok(shared >= 990, `feições iguais compartilham a mesma string (${shared}/1000)`);
assert.notStrictEqual(s1[10], s2[10], 'a feição editada tem string própria');

// 2b. Mudanças que o snapshot precisa enxergar: atribuição no lugar, troca de coordenadas/estilo/propriedades
{
  const probe = { features: [mk(0), mk(1), mk(2), mk(3), mk(4), mk(5)], historyUndo: [], historyRedo: [] };
  ShortcutsController.pushHistory(probe, 'base');
  probe.features[0].locked = true;                                                // campo novo no lugar
  probe.features[1].visible = false;                                              // campo novo no lugar
  probe.features[2] = { ...probe.features[2], coordinates: [[9, 9], [9, 8], [8, 8]] }; // coordenadas trocadas
  probe.features[3].properties.n = 99;                                            // propriedade no lugar
  probe.features[4].style = { fillColor: '#123' };                                // estilo trocado
  delete probe.features[5].name;                                                  // campo removido
  ShortcutsController.pushHistory(probe, 'depois');
  const [base, depois] = probe.historyUndo;
  for (let i = 0; i < 6; i++) assert.notStrictEqual(base[i], depois[i], `mudança na feição ${i} é vista`);
  assert.strictEqual(JSON.parse(base[0]).locked, undefined, 'o snapshot base não vê a alteração posterior');
  assert.strictEqual(JSON.parse(depois[3]).properties.n, 99);
  // objeto novo com o mesmo conteúdo reaproveita a string
  probe.features = probe.features.map(f => ({ ...f }));
  ShortcutsController.pushHistory(probe, 'copia');
  assert.strictEqual(probe.historyUndo[2][0], depois[0], 'mesmo conteúdo: mesma string');
}

// 3. restoreSnapshot continua aceitando o formato antigo (um JSON do vetor inteiro)
const legacy = JSON.stringify(app.features);
const restoredLegacy = ShortcutsController.restoreSnapshot(legacy, app.features);
assert.strictEqual(restoredLegacy[0], app.features[0], 'formato antigo preserva referências');

// 4. Desfazer e refazer: volta ao estado do passo e mantém as referências intactas
const before = app.features;
ShortcutsController.pushHistory(app, 'c');
app.features = app.features.filter(f => f.id !== 'f20');
const afterDelete = app.features;
const restored = ShortcutsController.restoreSnapshot(app.historyUndo.pop(), app.features);
assert.strictEqual(restored.length, 1000, 'exclusão desfeita');
assert.strictEqual(restored.find(f => f.id === 'f20').name, 'Feição 20');
assert.strictEqual(restored.find(f => f.id === 'f30'), before.find(f => f.id === 'f30'), 'referência preservada no desfazer');
assert.strictEqual(afterDelete.length, 999);

// 5. Excluídas saem do mapa de internamento quando ele cresce demais
const big = { features: Array.from({ length: 10 }, (_, i) => mk(i)), historyUndo: [], historyRedo: [] };
for (let round = 0; round < 40; round++) {
  big.features = Array.from({ length: 10 }, (_, i) => mk(round * 100 + i));
  ShortcutsController.pushHistory(big, `r${round}`);
}
assert.ok(big._historyIntern.size <= 10 * 2 + 100 + 10, `mapa de internamento é podado (${big._historyIntern.size})`);

// 6. Limite de passos preservado
const many = { features: Array.from({ length: 2500 }, (_, i) => mk(i)), historyUndo: [], historyRedo: [] };
for (let i = 0; i < 30; i++) ShortcutsController.pushHistory(many, 'x');
assert.strictEqual(many.historyUndo.length, 15, '>2000 feições mantém 15 passos');

console.log('✅ Snapshots de histórico passaram!');
