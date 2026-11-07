/* ==========================================================================
   ConecteMapas - Teste dos efeitos cartográficos da prancha
   Cobre: mesclagem e opacidade por camada, hachura com ângulo/espaço/pena, linha composta
   (contorno, bicolor, símbolos ao longo), ícones de ponto, rótulo curvo, famílias de fonte
   e legenda em colunas. Tudo pelo desenho único (PrintMapRenderer) num canvas falso.
   ========================================================================== */

import assert from 'assert';
import { PrintViewResolver, BLEND_MODES, POINT_ICONS } from '../src/components/PrintComposer/PrintViewResolver.js';
import { PrintViewEdits } from '../src/components/PrintComposer/PrintViewEdits.js';
import { PrintMapRenderer } from '../src/components/PrintComposer/PrintMapRenderer.js';
import { PrintLegendRenderer } from '../src/components/PrintComposer/PrintLegendRenderer.js';
import { PrintFonts, FONT_FAMILIES } from '../src/components/PrintComposer/PrintFonts.js';
import { PrintItemsManager } from '../src/components/PrintComposer/PrintItemsManager.js';

console.log('--- Teste dos efeitos cartográficos da prancha ---');

function fakeCtx() {
  const calls = [];
  const state = { measureText: (t) => ({ width: String(t).length * 4 }) };
  const ctx = new Proxy(state, {
    get(t, prop) {
      if (prop === '__calls') return calls;
      if (prop in t) return t[prop];
      return (...args) => { calls.push([prop, ...args]); };
    },
    set(t, prop, value) { t[prop] = value; calls.push(['set', prop, value]); return true; }
  });
  return ctx;
}
const count = (ctx, name) => ctx.__calls.filter(c => c[0] === name).length;
const sets = (ctx, prop) => ctx.__calls.filter(c => c[0] === 'set' && c[1] === prop).map(c => c[2]);

const layers = [
  { id: 'verde', name: 'Verde', color: '#2e7d32' },
  { id: 'trilho', name: 'Trilho', color: '#444444' },
  { id: 'pontos', name: 'Pontos', color: '#000000' }
];
const poly = { id: 'p', layerId: 'verde', type: 'Polygon', name: 'Mata', coordinates: [[0, 0], [0, 10], [10, 10], [10, 0]] };
const line = { id: 'l', layerId: 'trilho', type: 'LineString', name: 'Linha Norte', coordinates: [[0, 0], [2, 6], [1, 12], [3, 20]] };
const point = { id: 'pt', layerId: 'pontos', type: 'Point', name: 'Ponto', coordinates: [5, 5] };
const features = [poly, line, point];
const project = ([lat, lng]) => ({ x: lng * 10 + 50, y: 500 - lat * 10 });

function resolveWith(view) {
  const v = { ...PrintViewResolver.emptyView(), ...view };
  return { ...PrintViewResolver.prepare(v, { features, layers }), view: v };
}

// ---------------------------------------------------------------- 1. resolvedor
console.log('1. Resolvedor...');
const v1 = resolveWith({
  layers: {
    verde: { blend: 'multiply', opacity: 0.5, fill: { pattern: 'hachura', hatchAngle: 30, hatchSpacingMm: 2, hatchWidthMm: 0.3 } },
    trilho: { stroke: { casingColor: '#ffffff', casingWidthMm: 0.4, altColor: '#ffff00', decor: 'tracos', pattern: 'tracejado-longo' } },
    pontos: { point: { icon: 'estrela', sizeMm: 4 } }
  },
  labels: { trilho: { show: true, font: 'serif', bold: true, curved: true } }
});
const gv = PrintViewResolver.resolve(poly, v1);
assert.strictEqual(gv.blend, 'multiply');
assert.strictEqual(gv.opacity, 0.5);
assert.deepStrictEqual(gv.fill.hatch, { angle: 30, spacingMm: 2, widthMm: 0.3 });
const gl = PrintViewResolver.resolve(line, v1);
assert.deepStrictEqual(gl.stroke.casing, { color: '#ffffff', widthMm: 0.4 });
assert.strictEqual(gl.stroke.altColor, '#ffff00');
assert.strictEqual(gl.stroke.decor, 'tracos');
assert.ok(gl.stroke.dashMm && gl.stroke.dashMm[0] > 3, 'Tracejado longo tem traço maior que o tracejado comum');
assert.strictEqual(gl.label.font, 'serif');
assert.strictEqual(gl.label.bold, true);
assert.strictEqual(gl.label.curved, true);
const gp = PrintViewResolver.resolve(point, v1);
assert.strictEqual(gp.point.icon, 'estrela');
assert.strictEqual(gp.point.sizeMm, 4);
// Valores inválidos voltam ao padrão (não quebram o desenho)
const bad = resolveWith({ layers: { verde: { blend: 'xyz', opacity: 9, fill: { hatchSpacingMm: -3 } }, pontos: { point: { icon: 'inexistente' } } } });
const gb = PrintViewResolver.resolve(poly, bad);
assert.strictEqual(gb.blend, 'normal');
assert.strictEqual(gb.opacity, 1);
assert.ok(gb.fill.hatch.spacingMm >= 0.4, 'Espaçamento da hachura tem mínimo');
assert.strictEqual(PrintViewResolver.resolve(point, bad).point.icon, 'circulo');
// Sem ajuste, nada muda
const g0 = PrintViewResolver.resolve(poly, resolveWith({}));
assert.strictEqual(g0.blend, 'normal');
assert.strictEqual(g0.opacity, 1);
assert.strictEqual(g0.stroke.decor, 'nenhum');
assert.strictEqual(g0.fill.hatch.angle, null);

// Edição esparsa: campos novos entram e saem como os demais
const view = PrintViewResolver.emptyView();
PrintViewEdits.setField(view, 'layer', 'verde', 'blend', 'multiply');
PrintViewEdits.setField(view, 'layer', 'verde', 'fill.hatchAngle', 45);
PrintViewEdits.setField(view, 'layer', 'verde', 'point.icon', 'ponte');
assert.strictEqual(view.layers.verde.blend, 'multiply');
assert.strictEqual(view.layers.verde.fill.hatchAngle, 45);
PrintViewEdits.setField(view, 'layer', 'verde', 'blend', null);
PrintViewEdits.setField(view, 'layer', 'verde', 'fill.hatchAngle', '');
PrintViewEdits.setField(view, 'layer', 'verde', 'point.icon', null);
assert.ok(!PrintViewEdits.hasOverride(view, 'layer', 'verde'), 'Limpar tudo remove a linha');
const fview = { filters: [{ filterId: 'f', enabled: true, blend: 'screen', point: { icon: 'x' }, opacity: 0.4 }] };
assert.ok(PrintViewEdits.hasOverride(fview, 'filter', 'f'));
PrintViewEdits.reset(fview, 'filter', 'f');
assert.strictEqual(fview.filters[0].blend, undefined);
assert.strictEqual(fview.filters[0].point, undefined);
assert.strictEqual(fview.filters[0].opacity, undefined);
assert.strictEqual(fview.filters[0].enabled, true, 'Reset do filtro mantém o vínculo');
// A legenda inclui filtros que só mudam mesclagem, opacidade ou ícone
assert.ok(Object.keys(POINT_ICONS).length >= 10 && Object.keys(BLEND_MODES).includes('multiply'));
console.log('✔ Resolvedor validado');

// ---------------------------------------------------------------- 2. mesclagem em trechos
console.log('2. Mesclagem...');
const plan = PrintMapRenderer.plan({ features, layers, resolveCtx: v1 });
// Ordem: pontos (última camada da lista, por baixo) → trilho → verde (1ª da lista, por cima)
assert.deepStrictEqual(plan.runs.map(r => r.blend), ['normal', 'multiply']);
assert.strictEqual(plan.items.length, 3);
const ctxExport = fakeCtx();
const opts = { features, layers, resolveCtx: v1, project, pxPerMm: 3.78 };
const drawn = PrintMapRenderer.draw(ctxExport, opts);
assert.strictEqual(drawn, 3);
assert.ok(sets(ctxExport, 'globalCompositeOperation').includes('multiply'), 'Exportação mescla no próprio canvas');
const ctxPreview = fakeCtx();
PrintMapRenderer.drawRun(ctxPreview, plan.runs[1], { ...opts, applyBlend: false });
assert.strictEqual(sets(ctxPreview, 'globalCompositeOperation').length, 0, 'Na prévia a mesclagem é do elemento canvas');
assert.ok(sets(ctxPreview, 'globalAlpha').some(a => Math.abs(a - 0.5) < 1e-9), 'Opacidade geral aplicada');
console.log('✔ Mesclagem validada');

// ---------------------------------------------------------------- 3. hachura, linha composta, ícones
console.log('3. Desenho...');
const ctxH = fakeCtx();
PrintMapRenderer.drawFeature(ctxH, poly, gv, project, 3.78);
assert.ok(count(ctxH, 'clip') >= 1, 'Hachura recortada');
const rot = ctxH.__calls.find(c => c[0] === 'rotate');
assert.ok(rot && Math.abs(rot[1] - (-30 * Math.PI) / 180) < 1e-9, 'Hachura gira no ângulo escolhido (anti-horário)');
assert.ok(sets(ctxH, 'lineWidth').some(w => Math.abs(w - 0.3 * 3.78) < 1e-6), 'Pena da hachura em mm');
// Hachura cruzada = 2 direções
const ctxX = fakeCtx();
PrintMapRenderer.drawFeature(ctxX, poly, { ...gv, fill: { ...gv.fill, pattern: 'quadriculado', hatch: { angle: null, spacingMm: 2, widthMm: 0.13 } } }, project, 3.78);
assert.strictEqual(count(ctxX, 'rotate'), 2, 'Quadriculado desenha duas direções');

const ctxL = fakeCtx();
PrintMapRenderer.drawFeature(ctxL, line, gl, project, 3.78);
const strokes = sets(ctxL, 'strokeStyle');
assert.ok(strokes.indexOf('#ffffff') >= 0 && strokes.indexOf('#ffff00') > strokes.indexOf('#ffffff'), 'Contorno antes do fundo bicolor');
assert.ok(strokes.indexOf('#444444') > strokes.indexOf('#ffff00'), 'Traço principal por cima');
const widths = sets(ctxL, 'lineWidth');
assert.ok(widths[0] > widths[1], 'Contorno mais largo que o traço');
assert.ok(count(ctxL, 'stroke') >= 4, 'Contorno + bicolor + traço + travessas');
// Dentes (fortificação) preenchem triângulos
const ctxD = fakeCtx();
PrintMapRenderer.drawFeature(ctxD, line, { ...gl, stroke: { ...gl.stroke, casing: { color: null, widthMm: 0 }, altColor: null, decor: 'dentes' } }, project, 3.78);
assert.ok(count(ctxD, 'fill') >= 1 && count(ctxD, 'closePath') >= 1, 'Dentes desenhados como triângulos');

// Todo ícone desenha sem erro e termina com restore
Object.keys(POINT_ICONS).forEach(icon => {
  const c = fakeCtx();
  PrintMapRenderer.drawFeature(c, point, { ...gp, point: { sizeMm: 3, icon } }, project, 3.78);
  assert.ok(count(c, 'fill') >= 1, `Ícone ${icon} preenchido`);
  assert.strictEqual(count(c, 'save'), count(c, 'restore'), `Ícone ${icon} equilibra save/restore`);
});
// Compatível com gráficos antigos (sem os campos novos)
const legacy = { kind: 'polygon', fill: { color: '#22aa44', opacity: 0.6, pattern: 'hachura' }, stroke: { color: '#115522', widthMm: 0.3, dashMm: null }, point: { sizeMm: 2 }, text: {}, label: { show: false } };
PrintMapRenderer.drawFeature(fakeCtx(), poly, legacy, project, 3.78);
PrintMapRenderer.drawFeature(fakeCtx(), point, { ...legacy, kind: 'point' }, project, 3.78);
console.log('✔ Desenho validado');

// ---------------------------------------------------------------- 4. rótulo curvo e fonte
console.log('4. Rótulos...');
const ctxT = fakeCtx();
const anchor = PrintMapRenderer.lineAnchor([PrintMapRenderer.linesOf(line.coordinates)[0].map(project)]);
assert.ok(anchor.path && anchor.pathLen > 0, 'Âncora da linha guarda o traçado');
PrintMapRenderer.drawLabel(ctxT, { anchor, g: gl, f: line }, 3.78);
const letters = ctxT.__calls.filter(c => c[0] === 'fillText').map(c => c[1]);
assert.ok(letters.length > 5 && letters.every(t => t.length === 1) && letters.join('') === 'LinhaNorte', 'Texto curvo desenha letra a letra');
assert.ok(ctxT.__calls.filter(c => c[0] === 'rotate').length >= letters.length, 'Cada letra gira com a linha');
assert.ok(sets(ctxT, 'font').every(f => f.startsWith('bold ') && f.includes('Georgia')), 'Fonte serifada em negrito');
// Não cabe: cai no texto reto
const short = PrintMapRenderer.lineAnchor([[{ x: 0, y: 0 }, { x: 8, y: 2 }]]);
const ctxS = fakeCtx();
PrintMapRenderer.drawLabel(ctxS, { anchor: short, g: gl, f: line }, 3.78);
assert.ok(ctxS.__calls.some(c => c[0] === 'fillText' && c[1] === 'Linha Norte'), 'Linha curta: texto reto inteiro');
// Direção sempre legível: linha desenhada da direita para a esquerda
const rtl = PrintMapRenderer.lineAnchor([[{ x: 400, y: 100 }, { x: 200, y: 140 }, { x: 0, y: 100 }]]);
const ctxR = fakeCtx();
PrintMapRenderer.drawLabel(ctxR, { anchor: rtl, g: gl, f: line }, 3.78);
assert.strictEqual(ctxR.__calls.filter(c => c[0] === 'fillText').map(c => c[1]).join(''), 'LinhaNorte', 'Texto não sai de cabeça para baixo');
// Chamada: rótulo deslocado por feição, com linha-guia e sem girar
const vC = resolveWith({ labels: { pontos: { show: true } }, elements: { pt: { label: { dxMm: 10, dyMm: -6 } } } });
const gC = PrintViewResolver.resolve(point, vC);
assert.strictEqual(gC.label.dxMm, 10);
assert.strictEqual(gC.label.dyMm, -6);
const ctxC = fakeCtx();
PrintMapRenderer.drawLabel(ctxC, { anchor: { x: 100, y: 100, angle: 0 }, g: gC, f: point }, 4);
assert.ok(ctxC.__calls.some(c => c[0] === 'lineTo' && c[1] === 140 && c[2] === 76), 'Linha-guia até o rótulo deslocado');
assert.ok(ctxC.__calls.some(c => c[0] === 'fillText' && c[1] === 'Ponto' && c[2] === 140 && c[3] === 76), 'Texto na posição deslocada');
assert.strictEqual(PrintViewResolver.resolve(point, resolveWith({ labels: { pontos: { show: true } } })).label.dxMm, undefined, 'Sem ajuste: rótulo no lugar');
// Texto de várias linhas não acompanha a curva
assert.ok(PrintFonts.normalize('nada') === 'sans' && Object.keys(FONT_FAMILIES).length >= 5);
assert.ok(PrintFonts.css('mono').includes('Courier'));
assert.strictEqual(PrintItemsManager.fontStack({}), 'Arial, sans-serif', 'Item sem fonte mantém Arial');
assert.ok(PrintItemsManager.fontStack({ fontFamily: 'serif' }).includes('Georgia'));
const html = PrintItemsManager.renderLabel({ text: 'Teste', fontFamily: 'condensed' });
assert.ok(html.includes('&quot;Arial Narrow&quot;'), 'Aspas da pilha de fontes escapadas no atributo style');
console.log('✔ Rótulos validados');

// ---------------------------------------------------------------- 5. legenda em colunas
console.log('5. Legenda...');
const entries = Array.from({ length: 6 }, (_, i) => ({ name: `Camada ${i + 1}`, isFilter: false, graphics: gv }));
const one = fakeCtx();
PrintLegendRenderer.draw(one, { entries, wMm: 80, hMm: 60, pxPerMm: 3.78, title: 'LEGENDA', columns: 1 });
const two = fakeCtx();
PrintLegendRenderer.draw(two, { entries, wMm: 80, hMm: 60, pxPerMm: 3.78, title: 'LEGENDA', columns: 2 });
const xs = (c) => [...new Set(c.__calls.filter(k => k[0] === 'fillText' && /^Camada/.test(k[1])).map(k => Math.round(k[2])))];
assert.strictEqual(xs(one).length, 1, '1 coluna: todos os nomes alinhados');
assert.strictEqual(xs(two).length, 2, '2 colunas: dois alinhamentos de nome');
assert.strictEqual(two.__calls.filter(k => k[0] === 'fillText' && /^Camada/.test(k[1])).length, 6, 'Nenhuma entrada perdida');
// Amostra de linha composta e de ícone na legenda
const sw = fakeCtx();
PrintMapRenderer.drawSwatch(sw, gl, 0, 0, 24, 12, 3.78);
assert.ok(sets(sw, 'strokeStyle').includes('#ffffff'), 'Amostra da linha mostra o contorno');
const swp = fakeCtx();
PrintMapRenderer.drawSwatch(swp, gp, 0, 0, 24, 12, 3.78);
assert.ok(count(swp, 'fill') >= 1, 'Amostra do ponto usa o ícone');
console.log('✔ Legenda validada');

console.log('\n✅ Efeitos cartográficos da prancha: tudo OK');
