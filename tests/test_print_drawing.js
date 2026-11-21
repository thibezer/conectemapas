/* ==========================================================================
   Item "Desenho" da prancha (elementos do <ui-canvas-prancha> do kit): migração da antiga
   Moldura (`shape`), esticar sem mudar a espessura do traço, caixa = envelope do desenho,
   aparência em lote e o contexto do PDF (setTransform absoluto exigido pelo pintor do kit).
   ========================================================================== */
import assert from 'assert';
import { jsPDF } from 'jspdf';
import { PrintDrawing } from '../src/components/PrintComposer/PrintDrawing.js';
import { PrintItemsManager } from '../src/components/PrintComposer/PrintItemsManager.js';
import { PrintExporter } from '../src/components/PrintComposer/PrintExporter.js';
import { PdfVectorContext } from '../src/components/PrintComposer/PdfVectorContext.js';
import { diagnosticarContexto } from '@thibezer/ui-components-kit/prancha/nucleo';

const PX = 3.78;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const legacy = (extra = {}) => ({
  id: 'shp', type: 'shape', name: 'Moldura Técnica', x: 12, y: 20, width: 60, height: 40, locked: false, visible: true,
  fillColor: 'rgba(255, 255, 255, 0.4)', strokeColor: '#000000', strokeWidth: 1.5, borderRadius: 0, ...extra
});

/** Contexto que só conta as chamadas (o pintor do kit exige estes métodos) */
function counting() {
  const calls = {};
  const ctx = new Proxy({ fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', globalAlpha: 1 }, {
    get(t, p) { if (p in t) return t[p]; return typeof p === 'string' ? (...a) => { (calls[p] ||= []).push(a); } : undefined; },
    set(t, p, v) { t[p] = v; return true; }
  });
  return { ctx, calls };
}

console.log('1. Migração da Moldura...');
{
  // Cada tipo vira um Desenho com a mesma caixa e elementos do kit; os campos antigos somem
  for (const t of ['rect', 'rounded_rect', 'double_frame', 'ellipse', 'triangle', 'diamond', 'line_h', 'line_v', 'line_diag', 'arrow']) {
    const d = PrintDrawing.migrateShape(legacy({ shapeType: t, strokeStyle: 'dashed', arrowHead: 'both' }));
    assert.strictEqual(d.type, 'drawing', `${t}: tipo`);
    assert.deepStrictEqual([d.x, d.y, d.width, d.height], [12, 20, 60, 40], `${t}: a caixa não muda (sem rotação)`);
    assert.strictEqual(d.elements.length, t === 'double_frame' ? 2 : 1, `${t}: elementos`);
    ['shapeType', 'fillColor', 'strokeColor', 'strokeWidth', 'strokeStyle', 'borderRadius', 'rotation', 'arrowHead'].forEach(k => assert.ok(!(k in d), `${t}: ${k} removido`));
    assert.strictEqual(d.name, 'Moldura Técnica');
    assert.deepStrictEqual(d.base, { width: 60, height: 40 });
  }

  // Aparência: 1,5 px = 0,397 mm; rgba vira cor + opacidade; tracejado vira tipo de linha CAD
  const r = PrintDrawing.migrateShape(legacy({ shapeType: 'rect', strokeStyle: 'dashed', strokeColor: '#1d4ed8', fillColor: 'rgba(255, 0, 0, 0.4)' }));
  const ap = r.elements[0].aparencia;
  assert.ok(near(ap.traco.espessura, 1.5 / PX), 'espessura em mm');
  assert.strictEqual(ap.traco.cor, '#1d4ed8');
  assert.strictEqual(ap.traco.tipoLinha, 'tracejada');
  assert.deepStrictEqual([ap.preenchimento.cor, ap.preenchimento.opacidade], ['#ff0000', 0.4]);

  // A borda externa do traço encosta na caixa do item (como a borda CSS da Moldura)
  const bounds = PrintDrawing.contentBounds(r.elements);
  assert.ok(near(bounds.x, 0) && near(bounds.y, 0) && near(bounds.width, 60) && near(bounds.height, 40), 'envelope = caixa do item');

  // Sem traço e sem preenchimento
  const none = PrintDrawing.migrateShape(legacy({ shapeType: 'ellipse', strokeWidth: 0, fillColor: 'rgba(0,0,0,0)' }));
  assert.strictEqual(none.elements[0].aparencia.traco, null, 'espessura 0 = sem traço');
  assert.strictEqual(none.elements[0].aparencia.preenchimento, null, 'opacidade 0 = sem preenchimento');

  // Arredondado, seta dupla, moldura dupla (preenchimento só na externa)
  assert.strictEqual(PrintDrawing.migrateShape(legacy({ shapeType: 'rect', borderRadius: 10 })).elements[0].geometria.raios?.[0] > 0, true, 'raio do retângulo');
  const arrow = PrintDrawing.migrateShape(legacy({ shapeType: 'arrow', arrowHead: 'both', fillColor: 'red' }));
  assert.ok(arrow.elements[0].aparencia.traco.pontaInicio && arrow.elements[0].aparencia.traco.pontaFim, 'seta dupla');
  assert.strictEqual(arrow.elements[0].aparencia.preenchimento, null, 'linha não tem preenchimento');
  const dbl = PrintDrawing.migrateShape(legacy({ shapeType: 'double_frame' }));
  assert.ok(dbl.elements[0].aparencia.preenchimento && !dbl.elements[1].aparencia.preenchimento, 'moldura dupla: fundo só na externa');
  assert.ok(dbl.elements[1].aparencia.traco.espessura >= dbl.elements[0].aparencia.traco.espessura * 0.5, 'linha interna mais fina');

  // Rotação antiga: vira rotação dos elementos e a caixa abraça o resultado
  const rot = PrintDrawing.migrateShape(legacy({ shapeType: 'rect', rotation: 90, width: 60, height: 40 }));
  assert.ok(near(rot.width, 40) && near(rot.height, 60), `girado 90°: caixa ${rot.width}×${rot.height}`);
  assert.ok(near(rot.x + rot.width / 2, 42) && near(rot.y + rot.height / 2, 40), 'continua centrado no mesmo ponto');

  // Item sem campos (padrões): espessura 1,5 px, preenchimento branco a 50%, tipo desconhecido = retângulo
  const bare = PrintDrawing.migrateShape({ id: 'b', type: 'shape', x: 0, y: 0, width: 40, height: 30, shapeType: 'inexistente' });
  assert.ok(near(bare.elements[0].aparencia.traco.espessura, 1.5 / PX));
  assert.strictEqual(bare.elements[0].aparencia.preenchimento.opacidade, 0.5);
  assert.strictEqual(bare.elements[0].geometria.tipo, 'retangulo');
  console.log('✔ Migração validada');
}

console.log('2. Cargas e idempotência...');
{
  const list = [legacy({ id: 'a' }), { id: 'm', type: 'map', x: 0, y: 0, width: 50, height: 50 }, null];
  const once = PrintDrawing.migrateItems(list);
  assert.deepStrictEqual(once.map(i => i && i.type), ['drawing', 'map', null]);
  assert.deepStrictEqual(PrintDrawing.migrateItems(once), once, 'migrar de novo não muda nada');
  assert.strictEqual(list[0].type, 'shape', 'a lista original não é alterada');
  const cloned = PrintDrawing.cloneItems([legacy({ id: 'c' })]);
  assert.strictEqual(cloned[0].type, 'drawing');
  assert.deepStrictEqual(PrintDrawing.migrateItems(undefined), []);
  assert.deepStrictEqual(PrintDrawing.cloneItems(null), []);
  console.log('✔ Cargas validadas');
}

console.log('3. Esticar o item não muda a espessura...');
{
  const d = PrintDrawing.migrateShape(legacy({ shapeType: 'rect' }));
  const w = d.elements[0].aparencia.traco.espessura;
  const big = { ...d, width: 120, height: 80 }; // o composer só muda width/height
  const els = PrintDrawing.elementsFor(big);
  assert.ok(near(els[0].aparencia.traco.espessura, w), 'espessura do traço em mm intacta');
  const bb = PrintDrawing.contentBounds(els);
  assert.ok(near(bb.width, 120, 0.01) && near(bb.height, 80, 0.01), `a geometria acompanha o item (${bb.width.toFixed(2)} x ${bb.height.toFixed(2)})`);
  assert.deepStrictEqual(d.elements, JSON.parse(JSON.stringify(d.elements)), 'nada é gravado nos elementos');
  assert.strictEqual(PrintDrawing.elementsFor(d), d.elements, 'sem mudança de tamanho: os mesmos elementos');
  // Item sem elementos / dados ruins não lançam
  assert.deepStrictEqual(PrintDrawing.elementsFor({ width: 10, height: 10 }), []);
  assert.deepStrictEqual(PrintDrawing.elementsFor({ width: 10, height: 10, elements: [], base: { width: 0, height: 0 } }), []);
  assert.doesNotThrow(() => PrintDrawing.elementsFor({ width: 'x', height: NaN, elements: d.elements, base: { width: 'y', height: null } }));
  console.log('✔ Esticar validado');
}

console.log('4. Novo item e pré-definições...');
{
  const it = PrintDrawing.fillDefault({ ...PrintItemsManager.createNewItem('drawing', 'P', 0), id: 'novo', width: 80, height: 50 });
  assert.strictEqual(it.elements.length, 1);
  assert.deepStrictEqual(it.base, { width: 80, height: 50 });
  const b = PrintDrawing.contentBounds(it.elements);
  assert.ok(near(b.width, 80) && near(b.height, 50), 'o retângulo padrão ocupa o item');
  // Trocar por uma pré-definição mantém a aparência (cor e espessura) atual
  PrintDrawing.applyStyle(it, { strokeColor: '#ff0000', strokeMm: 0.8 });
  PrintDrawing.applyPreset(it, 'seta-dupla');
  const st = PrintDrawing.styleOf(it);
  assert.strictEqual(st.strokeColor, '#ff0000');
  assert.ok(near(st.strokeMm, 0.8));
  assert.ok(it.elements[0].aparencia.traco.pontaInicio, 'seta dupla');
  PrintDrawing.PRESETS.forEach(p => {
    const copy = JSON.parse(JSON.stringify(it));
    PrintDrawing.applyPreset(copy, p.value);
    assert.ok(copy.elements.length >= 1, `${p.value} gera elementos`);
  });
  console.log('✔ Pré-definições validadas');
}

console.log('5. Aparência em lote...');
{
  const it = PrintDrawing.migrateShape(legacy({ shapeType: 'double_frame', strokeWidth: 2 }));
  const [e1, e2] = it.elements.map(e => e.aparencia.traco.espessura);
  PrintDrawing.applyStyle(it, { strokeMm: e1 * 2 });
  const [f1, f2] = it.elements.map(e => e.aparencia.traco.espessura);
  assert.ok(near(f1, e1 * 2) && near(f2, e2 * 2), 'a razão entre as linhas da moldura dupla se mantém');
  PrintDrawing.applyStyle(it, { strokeColor: '#00ff00', strokeStyle: 'pontilhado' });
  assert.ok(it.elements.every(e => e.aparencia.traco.cor === '#00ff00' && e.aparencia.traco.tipoLinha === 'pontilhada'));
  PrintDrawing.applyStyle(it, { fillHex: '#123456', fillAlpha: 0.8 });
  assert.deepStrictEqual([it.elements[0].aparencia.preenchimento.cor, it.elements[0].aparencia.preenchimento.opacidade], ['#123456', 0.8]);
  assert.strictEqual(it.elements[1].aparencia.preenchimento ?? null, null, 'quem não tinha preenchimento continua sem');
  PrintDrawing.applyStyle(it, { strokeMm: 0 });
  assert.strictEqual(PrintDrawing.styleOf(it).hasStroke, false, 'espessura 0 tira o traço');
  assert.ok(PrintDrawing.nudgeStroke(it, 0.1), 'dá para voltar a ter traço');
  assert.strictEqual(PrintDrawing.styleOf(it).hasStroke, true);
  console.log('✔ Aparência validada');
}

console.log('6. Caixa = envelope do desenho...');
{
  const it = PrintDrawing.fillDefault({ ...PrintItemsManager.createNewItem('drawing', 'P', 0), id: 'c', x: 50, y: 60, width: 70, height: 45 });
  const sheet = PrintDrawing.toSheetElements(it);
  const b0 = PrintDrawing.contentBounds(sheet);
  assert.ok(near(b0.x, 50) && near(b0.y, 60), 'na folha, o desenho começa no canto do item');
  // O editor devolve os elementos na folha (origem 0,0): a caixa acompanha o desenho
  const moved = sheet.map(e => ({ ...e, transformacao: { ...(e.transformacao || { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), e: (e.transformacao?.e || 0) + 20 } }));
  PrintDrawing.commit(it, moved, 0, 0);
  assert.ok(near(it.x, 70, 0.01) && near(it.y, 60, 0.01), `item andou 20 mm (${it.x}, ${it.y})`);
  assert.ok(near(it.width, 70, 0.01) && near(it.height, 45, 0.01));
  assert.deepStrictEqual(it.base, { width: it.width, height: it.height });
  // Linha: a caixa não fica menor que o mínimo, centrada no desenho
  const line = PrintDrawing.applyPreset(PrintDrawing.fillDefault({ ...PrintItemsManager.createNewItem('drawing', 'P', 0), id: 'l', width: 80, height: 40 }), 'linha-horizontal');
  PrintDrawing.commit(line, PrintDrawing.toSheetElements({ ...line, x: 30, y: 30 }), 0, 0);
  assert.ok(line.height >= PrintItemsManager.MIN_ITEM_MM, `altura mínima (${line.height})`);
  assert.ok(near(line.y + line.height / 2, 50, 0.5), 'centrada na linha');
  // Sombra amplia a caixa; sem elementos a caixa fica como está
  const sh = PrintDrawing.fillDefault({ ...PrintItemsManager.createNewItem('drawing', 'P', 0), id: 's', x: 10, y: 10, width: 50, height: 30 });
  const plain = PrintDrawing.contentBounds(sh.elements);
  sh.elements = sh.elements.map(e => ({ ...e, aparencia: { ...e.aparencia, sombra: { deslocamento: [2, 2], desfoque: 1 } } }));
  assert.ok(PrintDrawing.contentBounds(sh.elements).width > plain.width + 4, 'a sombra entra no envelope');
  const empty = { id: 'e', x: 5, y: 6, width: 30, height: 20, elements: [{ id: 'x', oculto: true, geometria: { tipo: 'retangulo', largura: 5, altura: 5 } }] };
  PrintDrawing.commit(empty, empty.elements, 0, 0);
  assert.deepStrictEqual([empty.x, empty.y, empty.width, empty.height], [5, 6, 30, 20]);
  console.log('✔ Caixa validada');
}

console.log('7. Pintura na tela e no PDF...');
{
  const it = PrintDrawing.migrateShape(legacy({ shapeType: 'double_frame', strokeWidth: 2 }));
  const { ctx, calls } = counting();
  const stats = PrintDrawing.paint(ctx, it, PX);
  assert.strictEqual(stats.itens, 2, 'os dois elementos são pintados');
  assert.ok(calls.setTransform && calls.stroke && calls.fill, 'usa o contrato do pintor');
  assert.deepStrictEqual(calls.setTransform[0].slice(0, 4), [PX, 0, 0, PX], 'mm → px da tela');
  assert.strictEqual(PrintDrawing.paint(ctx, { width: 10, height: 10, elements: [] }, PX), null, 'desenho vazio não pinta');
  assert.strictEqual(PrintDrawing.paint(ctx, it, 0), null, 'escala inválida não pinta');

  // PDF vetorial: setTransform ABSOLUTO (relativo ao espaço de exportação), mesmo depois de outro transform
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [297, 210], compress: false });
  const EXP = 300 / 25.4;
  const v = new PdfVectorContext(pdf, { pxPerMm: EXP });
  v.save();
  v.translate(500, 500); // um transform qualquer antes: o absoluto o ignora
  v.setTransform(2, 0, 0, 3, 10, 20);
  assert.ok(near(v._m[0], v._m0[0] * 2) && near(v._m[3], v._m0[3] * 3), 'escala absoluta sobre a base');
  assert.ok(near(v._m[4], v._m0[0] * 10 + v._m0[4]) && near(v._m[5], v._m0[3] * 20 + v._m0[5]), 'translação absoluta sobre a base');
  v.restore();
  assert.doesNotThrow(() => v.setTransform(NaN, 0, 0, 1, 0, 0), 'matriz inválida é ignorada');

  // O contexto do PDF cumpre o contrato do pintor do kit (e a pintura não falha)
  const diag = diagnosticarContexto(v);
  assert.deepStrictEqual(diag.obrigatorios, [], 'PdfVectorContext tem tudo o que o pintor exige');
  assert.strictEqual(diag.transformacao, 'absoluta');
  const stPdf = PrintDrawing.paint(v, it, EXP, { x: 100, y: 100 });
  assert.strictEqual(stPdf.falhas, 0, 'sem falhas ao pintar no PDF');
  PrintExporter.drawDrawingItem(v, it, 100, 100, EXP);
  v.finish();
  const out = pdf.output();
  assert.ok(out.includes('RG') && out.includes('rg') && / cm\n/.test(out.replace(/\r/g, '')), 'o PDF recebe preenchimento, traço e matriz');
  console.log('✔ Pintura validada');
}

console.log('8. Painel do item...');
{
  const locked = PrintDrawing.fillDefault({ ...PrintItemsManager.createNewItem('drawing', 'P', 0), id: 'k', locked: true });
  assert.ok(!PrintItemsManager.CANVAS_ITEM_TYPES || PrintItemsManager.CANVAS_ITEM_TYPES.has('drawing'), 'desenho é item em canvas');
  assert.strictEqual(PrintItemsManager.insertionIndex([{ type: 'map' }, { type: 'legend' }], 'drawing'), 1, 'entra logo acima dos mapas');
  const { PrintItemFields } = await import('../src/components/PrintComposer/PrintItemFields.js');
  const cats = PrintItemFields.build(locked, { items: [locked] });
  assert.ok(cats.length > 0 && cats.every(e => e.prop.somenteLeitura), 'bloqueado: campos só de leitura');
  assert.ok(!cats.some(e => e.prop.tipo === 'acao'), 'bloqueado: sem ação de editar');
  const free = PrintItemFields.build(PrintDrawing.fillDefault({ ...PrintItemsManager.createNewItem('drawing', 'P', 0), id: 'f' }), { items: [] });
  assert.ok(free.some(e => e.prop.id === 'drawing_edit' && e.run), 'tem o botão Editar desenho');
  const ran = [];
  free.find(e => e.prop.id === 'drawing_edit').run({ openDrawingEditor: (id) => ran.push(id) });
  assert.deepStrictEqual(ran, ['f']);
  const edit = PrintDrawing.fillDefault({ ...PrintItemsManager.createNewItem('drawing', 'P', 0), id: 'g' });
  PrintItemFields.find(edit, { items: [edit] }, 'drawing_preset').apply(edit, 'losango');
  assert.strictEqual(edit.elements[0].geometria.geometria.tipo, 'Polygon', 'trocar por losango');
  console.log('✔ Painel validado');
}

console.log('9. Dados vindos de fora e plano de pintura...');
{
  // Dado hostil (nuvem, outro operador): elementos inválidos e ids repetidos saem; o item não quebra
  const good = PrintDrawing.fillDefault({ ...PrintItemsManager.createNewItem('drawing', 'P', 0), id: 'ok' });
  const hostile = {
    ...good, id: 'h', width: 50, height: 30, base: { width: 'x', height: -5 },
    elements: [good.elements[0], good.elements[0], null, 42, { id: 'sem-geometria' }, { id: 'nan', geometria: { tipo: 'retangulo', largura: NaN, altura: 5 } }],
    layers: 'não é lista'
  };
  const warn = console.warn; let warned = 0; console.warn = () => { warned++; };
  const [clean] = PrintDrawing.migrateItems([hostile]);
  console.warn = warn;
  assert.strictEqual(clean.elements.length, 1, 'só o elemento válido, sem id repetido');
  assert.ok(warned > 0, 'avisa o que foi descartado');
  assert.deepStrictEqual(clean.base, { width: 50, height: 30 }, 'base inválida volta ao tamanho do item');
  assert.ok(!('layers' in clean), 'camadas inválidas saem');
  assert.deepStrictEqual(PrintDrawing.migrateItems([{ ...good, elements: 'x' }])[0].elements, [], 'elements que não é lista = vazio');
  const many = { ...good, elements: Array.from({ length: 6000 }, (_, i) => ({ ...good.elements[0], id: 'e' + i })) };
  console.warn = () => {};
  assert.strictEqual(PrintDrawing.migrateItems([many])[0].elements.length, 5000, 'teto de elementos');
  console.warn = warn;
  assert.doesNotThrow(() => PrintDrawing.paint(counting().ctx, clean, 3.78));

  // O plano é calculado uma vez por lista de elementos e tamanho (o zoom não replaneja)
  const it = PrintDrawing.fillDefault({ ...PrintItemsManager.createNewItem('drawing', 'P', 0), id: 'pl', width: 60, height: 40 });
  const p1 = PrintDrawing.planFor(it);
  assert.strictEqual(PrintDrawing.planFor(it), p1, 'mesmo plano em chamadas seguidas (zoom/resolução)');
  PrintDrawing.paint(counting().ctx, it, 3.78);
  PrintDrawing.paint(counting().ctx, it, 11.81);
  assert.strictEqual(PrintDrawing.planFor(it), p1, 'pintar em outra escala não invalida');
  const resized = { ...it, width: 90 };
  assert.notStrictEqual(PrintDrawing.planFor(resized), p1, 'mudar o tamanho do item replaneja');
  console.log('✔ Dados de fora e plano validados');
}

console.log('🎉 Desenho da prancha: tudo certo');
