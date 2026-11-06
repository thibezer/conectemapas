/* Troca de folha: itens de tamanho fixo, orientação e ida e volta */
import assert from 'assert';
import { PrintItemsManager as M } from '../src/components/PrintComposer/PrintItemsManager.js';

const P = {
  A4_L: { id: 'A4_L', width: 297, height: 210, marginL: 25, marginO: 7 },
  A4_P: { id: 'A4_P', width: 210, height: 297, marginL: 25, marginO: 7 },
  A3_L: { id: 'A3_L', width: 420, height: 297, marginL: 25, marginO: 10 },
  A1_L: { id: 'A1_L', width: 841, height: 594, marginL: 25, marginO: 10 }
};
const get = (items, id) => items.find(i => i.id === id);
const inside = (items, p) => items.every(i => i.x >= 0 && i.y >= 0 && i.x + i.width <= p.width + 1e-9 && i.y + i.height <= p.height + 1e-9);

// 1. Layout intacto segue o layout padrão da nova folha
const base = M.createDefaultItems('P', P.A4_L);
const a1 = M.fitItemsToPaper(base, P.A4_L, P.A1_L);
const a1Def = M.createDefaultItems('P', P.A1_L);
['item-title-block', 'item-north-arrow', 'item-scale-bar'].forEach(id => {
  assert.strictEqual(get(a1, id).width, get(a1Def, id).width, `${id} tem a largura do padrão A1`);
  assert.strictEqual(get(a1, id).height, get(a1Def, id).height);
});

// 2. Troca de orientação: conteúdo preservado, geometria do padrão retrato
const custom = JSON.parse(JSON.stringify(base));
get(custom, 'item-title-block').properties.client = 'ACME';
get(custom, 'item-legend').y += 4; // layout editado
const portrait = M.fitItemsToPaper(custom, P.A4_L, P.A4_P);
assert.strictEqual(get(portrait, 'item-title-block').properties.client, 'ACME');
assert.strictEqual(get(portrait, 'item-title-block').width, get(M.createDefaultItems('P', P.A4_P), 'item-title-block').width);
assert.ok(inside(portrait, P.A4_P));

// 3. Layout editado, mesma orientação: tamanho fixo e ida e volta sem deriva
const edited = JSON.parse(JSON.stringify(base));
get(edited, 'item-map-main').width -= 10;
const big = M.fitItemsToPaper(edited, P.A4_L, P.A1_L);
['item-title-block', 'item-north-arrow', 'item-scale-bar'].forEach(id => {
  assert.strictEqual(get(big, id).width, get(edited, id).width, `${id} não estica`);
  assert.strictEqual(get(big, id).height, get(edited, id).height);
});
assert.ok(inside(big, P.A1_L));
const back = M.fitItemsToPaper(big, P.A1_L, P.A4_L);
['item-title-block', 'item-north-arrow', 'item-scale-bar'].forEach(id => {
  const a = get(back, id), b = get(edited, id);
  assert.ok(Math.abs(a.x - b.x) < 0.2 && Math.abs(a.y - b.y) < 0.2, `${id} volta ao lugar`);
  assert.strictEqual(a.width, b.width);
});

// 4. Ciclo longo: a seta norte não encolhe
let cur = edited, from = P.A4_L;
for (const k of ['A4_P', 'A1_L', 'A3_L', 'A4_L']) { cur = M.fitItemsToPaper(cur, from, P[k]); from = P[k]; }
assert.strictEqual(get(cur, 'item-north-arrow').width, 20, 'Seta norte mantém 20 mm');
console.log('🎉 TESTES DE TROCA DE FOLHA PASSARAM!');
