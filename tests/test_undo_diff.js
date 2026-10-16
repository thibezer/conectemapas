// Desfazer/Refazer: feições inalteradas mantêm a referência (applyDiff só regrava o que mudou)
import assert from 'assert';
import { ShortcutsController } from '../src/controllers/ShortcutsController.js';

const a = { id: 'a', name: 'A', coordinates: [[1, 2], [3, 4]], style: { fillColor: '#fff' } };
const b = { id: 'b', name: 'B', coordinates: [5, 6] };
const snapshot = JSON.stringify([a, b]);

const current = [a, { ...b, name: 'B editada' }];
const restored = ShortcutsController.restoreSnapshot(snapshot, current);

assert.strictEqual(restored[0], current[0], 'feição inalterada mantém a referência');
assert.notStrictEqual(restored[1], current[1], 'feição alterada volta ao estado do snapshot');
assert.strictEqual(restored[1].name, 'B');
console.log('✔ restoreSnapshot preserva referências inalteradas');
