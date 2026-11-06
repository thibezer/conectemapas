// Preferências de visualização da camada (olhinho e opacidade) são locais; só o que o operador mudou vai à nuvem.
import assert from 'assert';
import {
  mergeLocalVisibility, keepLocalVisibility, layersForCloud, layersForSignature,
  sharedLayerSignature, changedLayers, baselineFrom
} from '../src/services/Storage/LayerVisibility.js';

const local = [{ id: 'a', visible: false, opacity: 0.3 }, { id: 'b', visible: true, opacity: 1 }];
const remote = [
  { id: 'a', name: 'A', visible: true, opacity: 0.9 },   // aqui continua oculta e com 0.3
  { id: 'b', name: 'B', visible: false, opacity: 0.2 },  // aqui continua visível e com 1
  { id: 'c', name: 'C', visible: false, opacity: 0.5 }   // camada nova: visível, opacidade inicial da nuvem
];
const merged = mergeLocalVisibility(remote, local);
assert.deepStrictEqual(merged.map(l => l.visible), [false, true, true]);
assert.deepStrictEqual(merged.map(l => l.opacity), [0.3, 1, 0.5]);
assert.deepStrictEqual(merged.map(l => l.name), ['A', 'B', 'C'], 'demais campos vêm da nuvem');
assert.strictEqual(remote[0].visible, true, 'não muta a entrada');

const kept = keepLocalVisibility({ id: 'a', visible: true, opacity: 0.9 }, { id: 'a', visible: false, opacity: 0.3 });
assert.strictEqual(kept.visible, false);
assert.strictEqual(kept.opacity, 0.3);
const fresh = keepLocalVisibility({ id: 'n', visible: false, opacity: 0.6 }, null);
assert.strictEqual(fresh.visible, true);
assert.strictEqual(fresh.opacity, 0.6);

// Assinatura de metadados: olhinho e opacidade não contam como mudança
const sig = (l) => JSON.stringify(layersForSignature([l]));
assert.strictEqual(sig({ id: 'a', name: 'A', visible: false, opacity: 0.2 }), sig({ id: 'a', name: 'A', visible: true, opacity: 1 }));
assert.notStrictEqual(sig({ id: 'a', name: 'A' }), sig({ id: 'a', name: 'B' }));
assert.strictEqual(layersForCloud([{ id: 'a', visible: false, opacity: 0.4 }])[0].visible, true);
assert.strictEqual(layersForCloud([{ id: 'a', visible: false, opacity: 0.4 }])[0].opacity, 0.4, 'opacidade inicial segue na criação');

// Só vai à nuvem a camada que ESTE operador mudou (cópia defasada não sobrescreve o colega)
const confirmed = [{ id: 'x', name: 'X', color: '#111', order: 0 }, { id: 'y', name: 'Y', color: '#222', order: 1 }];
const baseline = baselineFrom(confirmed);
assert.deepStrictEqual(changedLayers(confirmed, baseline), [], 'nada mudou');
const staleCopy = [{ ...confirmed[0] }, { ...confirmed[1], name: 'Y renomeada por mim' }];
assert.deepStrictEqual(changedLayers(staleCopy, baseline).map(l => l.id), ['y'], 'só a minha edição');
const withNew = [...confirmed, { id: 'z', name: 'Nova' }];
assert.deepStrictEqual(changedLayers(withNew, baseline).map(l => l.id), ['z'], 'camada nova sempre vai');
assert.strictEqual(changedLayers(confirmed, new Map()).length, 2, 'sem base conhecida envia todas');
// alternar olhinho/opacidade não torna a camada "alterada"
assert.deepStrictEqual(changedLayers([{ ...confirmed[0], visible: false, opacity: 0.1 }, confirmed[1]], baseline), []);
assert.notStrictEqual(sharedLayerSignature({ id: 'x', order: 0 }), sharedLayerSignature({ id: 'x', order: 1 }));

assert.deepStrictEqual(mergeLocalVisibility(undefined, local), undefined);
assert.deepStrictEqual(layersForCloud(undefined), []);

console.log('OK test_layer_visibility_local');
