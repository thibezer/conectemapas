// Desfazer/Refazer só desfaz o que é do próprio operador: o trabalho de colegas (nuvem) é preservado.
import assert from 'assert';
import { ShortcutsController as SC } from '../src/controllers/ShortcutsController.js';

const mk = (id, extra = {}) => ({ id, name: id, type: 'Point', coordinates: [1, 2], ...extra });
const names = (list) => list.map(f => `${f.id}:${f.name}`).sort();

function newApp(features) {
  return { features, historyUndo: [], historyRedo: [], projectId: 'p', syncRibbon() {}, refreshMapAndTable() {}, saveMetadata() {} };
}

// --- Cenário 1: sem mudança remota, o Desfazer restaura tudo (comportamento de sempre)
{
  const app = newApp([mk('a'), mk('b')]);
  app.historyUndo.push(SC.takeSnapshot(app));       // foto antes da minha ação
  app.features = [...app.features, mk('meu')];       // minha ação: criei "meu"
  const { features, kept } = SC.reconcileSnapshot(app, app.historyUndo.pop(), app.features);
  assert.deepStrictEqual(names(features), ['a:a', 'b:b']);
  assert.strictEqual(kept, 0);
  console.log('  ✔ 1. sem mudança remota: desfaz normalmente');
}

// --- Cenário 2: colega CRIOU feição depois da minha foto -> Desfazer não a apaga
{
  const app = newApp([mk('a')]);
  const snap = SC.takeSnapshot(app);
  app.features = [...app.features, mk('meu')];       // minha ação
  SC.markRemoteTouched(app, ['colega']);
  app.features = [...app.features, mk('colega')];    // chegou da nuvem
  const { features, kept } = SC.reconcileSnapshot(app, snap, app.features);
  assert.deepStrictEqual(names(features), ['a:a', 'colega:colega'], 'meu criado some; o do colega fica');
  assert.strictEqual(kept, 1);
  console.log('  ✔ 2. feição criada por colega não é apagada pelo Desfazer');
}

// --- Cenário 3: colega EDITOU outra feição -> Desfazer não reverte a edição dele
{
  const app = newApp([mk('a'), mk('b')]);
  const snap = SC.takeSnapshot(app);
  app.features = app.features.map(f => (f.id === 'a' ? { ...f, name: 'a-minha' } : f));   // minha edição
  SC.markRemoteTouched(app, ['b']);
  app.features = app.features.map(f => (f.id === 'b' ? { ...f, name: 'b-do-colega' } : f)); // do colega
  const { features } = SC.reconcileSnapshot(app, snap, app.features);
  assert.deepStrictEqual(names(features), ['a:a', 'b:b-do-colega'], 'só a minha edição foi desfeita');
  console.log('  ✔ 3. edição de colega em outra feição é preservada');
}

// --- Cenário 4: colega EXCLUIU feição -> Desfazer não a ressuscita
{
  const app = newApp([mk('a'), mk('b')]);
  const snap = SC.takeSnapshot(app);
  app.features = app.features.map(f => (f.id === 'a' ? { ...f, name: 'a-minha' } : f));
  SC.markRemoteTouched(app, ['b']);
  app.features = app.features.filter(f => f.id !== 'b');                                    // colega excluiu b
  const { features } = SC.reconcileSnapshot(app, snap, app.features);
  assert.deepStrictEqual(names(features), ['a:a'], 'b continua excluída');
  console.log('  ✔ 4. feição excluída por colega não ressuscita');
}

// --- Cenário 5: mudança remota ANTES da foto não interfere
{
  const app = newApp([mk('a'), mk('b')]);
  SC.markRemoteTouched(app, ['b']);                  // colega mexeu em b antes
  const snap = SC.takeSnapshot(app);                 // foto tirada depois (seq já avançou)
  app.features = app.features.map(f => (f.id === 'b' ? { ...f, name: 'b-minha' } : f));
  const { features, kept } = SC.reconcileSnapshot(app, snap, app.features);
  assert.deepStrictEqual(names(features), ['a:a', 'b:b']);
  assert.strictEqual(kept, 0);
  console.log('  ✔ 5. mudanças remotas anteriores à foto não bloqueiam o Desfazer');
}

// --- Cenário 6: Refazer tem a mesma proteção
{
  const app = newApp([mk('a')]);
  const before = SC.takeSnapshot(app);
  app.features = [...app.features, mk('meu')];
  const redoSnap = SC.takeSnapshot(app);             // foto para Refazer (com 'meu')
  app.features = SC.reconcileSnapshot(app, before, app.features).features; // desfez
  SC.markRemoteTouched(app, ['colega']);
  app.features = [...app.features, mk('colega')];
  const { features } = SC.reconcileSnapshot(app, redoSnap, app.features);
  assert.deepStrictEqual(names(features), ['a:a', 'colega:colega', 'meu:meu'], 'refaz o meu e mantém o do colega');
  console.log('  ✔ 6. Refazer preserva o trabalho de colegas');
}

// --- Cenário 7: sem mudanças, referências inalteradas são reaproveitadas (applyDiff não reenvia tudo)
{
  const a = mk('a');
  const app = newApp([a, mk('b')]);
  const snap = SC.takeSnapshot(app);
  SC.markRemoteTouched(app, ['zzz']);
  const { features } = SC.reconcileSnapshot(app, snap, app.features);
  assert.strictEqual(features[0], a);
  console.log('  ✔ 7. referências inalteradas preservadas no caminho com mudanças remotas');
}

console.log('OK test_undo_remote_safe');
