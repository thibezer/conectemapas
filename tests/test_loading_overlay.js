// Aviso de carregamento: textos, limite de "projeto grande", atualização e remoção do overlay.
import assert from 'assert';
import { LoadingOverlay, LARGE_PROJECT_FEATURES } from '../src/bootstrap/LoadingOverlay.js';

// Sem DOM (Node puro): nada pode lançar erro
LoadingOverlay.update('x', 'y');
LoadingOverlay.hide();
await LoadingOverlay.nextPaint(10);

// Textos
assert.strictEqual(LoadingOverlay.formatCount(1), '1 forma');
assert.strictEqual(LoadingOverlay.formatCount(0), '0 formas');
assert.ok(/^12[. ]?345 formas$/.test(LoadingOverlay.formatCount(12345)), LoadingOverlay.formatCount(12345));
assert.strictEqual(LoadingOverlay.formatCount(undefined), '0 formas');

// Limite: só projetos grandes anunciam o desenho
assert.strictEqual(LoadingOverlay.isLarge(LARGE_PROJECT_FEATURES - 1), false);
assert.strictEqual(LoadingOverlay.isLarge(LARGE_PROJECT_FEATURES), true);
assert.strictEqual(LoadingOverlay.announceDrawing(10), false);

// DOM mínimo
const els = {};
const make = (id) => {
  const el = {
    id, textContent: '', dataset: {}, removed: false,
    classList: { items: new Set(), add(c) { this.items.add(c); }, contains(c) { return this.items.has(c); } },
    remove() { this.removed = true; }
  };
  els[id] = el;
  return el;
};
['cm-loading', 'cm-loading-title', 'cm-loading-detail'].forEach(make);
globalThis.document = { getElementById: (id) => (els[id] && !els[id].removed ? els[id] : null) };

assert.strictEqual(LoadingOverlay.announceDrawing(2000), true);
assert.ok(els['cm-loading-title'].textContent.includes('2'), els['cm-loading-title'].textContent);
assert.ok(els['cm-loading-title'].textContent.includes('formas'));
assert.ok(els['cm-loading-detail'].textContent.includes('não travou'));

LoadingOverlay.update('Outro título', null);
assert.strictEqual(els['cm-loading-title'].textContent, 'Outro título');
assert.ok(els['cm-loading-detail'].textContent.includes('não travou'), 'detalhe null não pode apagar o texto');

LoadingOverlay.hide();
assert.ok(els['cm-loading'].classList.contains('is-done'));
assert.strictEqual(els['cm-loading'].dataset.done, '1');

// Depois de esconder, atualizações são ignoradas
LoadingOverlay.update('Tarde demais', 'x');
assert.strictEqual(els['cm-loading-title'].textContent, 'Outro título');

// hideAfterPaint nunca fica pendente
await LoadingOverlay.hideAfterPaint();
await new Promise((r) => setTimeout(r, 350));
assert.strictEqual(els['cm-loading'].removed, true);

console.log('OK test_loading_overlay');
