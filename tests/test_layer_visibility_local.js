// O olhinho da camada é local: não vai para a nuvem e não é aceito de outros operadores.
import assert from 'assert';
import { mergeLocalVisibility, keepLocalVisibility, layersForCloud } from '../src/services/Storage/LayerVisibility.js';

const local = [{ id: 'a', visible: false }, { id: 'b', visible: true }];
const remote = [
  { id: 'a', name: 'A', visible: true },   // outro operador deixou visível; aqui continua oculta
  { id: 'b', name: 'B', visible: false },  // outro operador ocultou; aqui continua visível
  { id: 'c', name: 'C', visible: false }   // camada nova: nasce visível
];
const merged = mergeLocalVisibility(remote, local);
assert.deepStrictEqual(merged.map(l => l.visible), [false, true, true]);
assert.deepStrictEqual(merged.map(l => l.name), ['A', 'B', 'C'], 'demais campos vêm da nuvem');
assert.strictEqual(remote[0].visible, true, 'não muta a entrada');

assert.strictEqual(keepLocalVisibility({ id: 'a', visible: true }, { id: 'a', visible: false }).visible, false);
assert.strictEqual(keepLocalVisibility({ id: 'n', visible: false }, null).visible, true);

// Para a nuvem: sempre visível, então alternar o olhinho não muda a assinatura enviada
const a = JSON.stringify(layersForCloud([{ id: 'a', visible: false }]));
const b = JSON.stringify(layersForCloud([{ id: 'a', visible: true }]));
assert.strictEqual(a, b);
assert.strictEqual(JSON.parse(a)[0].visible, true);

assert.deepStrictEqual(mergeLocalVisibility(undefined, local), undefined);
assert.deepStrictEqual(layersForCloud(undefined), []);

console.log('OK test_layer_visibility_local');
