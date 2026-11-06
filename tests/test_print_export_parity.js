/* ==========================================================================
   Paridade tela × exportação dos itens da prancha (barra de escala, seta norte, tabela de
   vértices, bloco de texto, rótulo, legenda). Antes, texto e tabela saíam com tamanho
   diferente do da tela (≈3× menor / sobrepostos) e a tabela cortava vértices em silêncio.
   ========================================================================== */
import assert from 'assert';
import { PrintItemsManager } from '../src/components/PrintComposer/PrintItemsManager.js';
import { PrintExporter } from '../src/components/PrintComposer/PrintExporter.js';
import { PrintLegendRenderer } from '../src/components/PrintComposer/PrintLegendRenderer.js';

const BASE = 3.78;           // px de tela por mm (100%)
const EXP = 300 / 25.4;      // px por mm a 300 dpi
const K = EXP / BASE;

/** Contexto que registra fontes e textos (largura = 0,5 em por letra, como uma fonte média) */
function recorder() {
  const log = { texts: [], fonts: [], arcs: [], polys: 0 };
  let font = '';
  const ctx = {
    save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, closePath() {}, clip() {}, rect() {},
    moveTo() {}, lineTo() {}, arc(x, y, r) { log.arcs.push(r); }, fill() { log.polys++; }, stroke() {},
    fillRect() {}, strokeRect() {}, setLineDash() {},
    set font(v) { font = v; log.fonts.push(v); }, get font() { return font; },
    measureText(t) { const px = parseFloat(/([\d.]+)px/.exec(font)?.[1] || 10); return { width: String(t).length * px * 0.5 }; },
    fillText(t, x, y) { log.texts.push({ t: String(t), x, y, font }); }
  };
  return { ctx, log };
}
const sizeOf = (font) => parseFloat(/([\d.]+)px/.exec(font)[1]);

// --- Bloco de texto: o tamanho é o da tela (px a 100%) × k, não mais o valor cru em px a 300 dpi ---
{
  const { ctx, log } = recorder();
  const item = { title: 'NOTAS', text: 'linha um\nlinha dois', fontSize: 7.5, width: 80, height: 30 };
  PrintExporter.drawTextBlockItem(ctx, item, 0, 0, Math.round(80 * EXP), Math.round(30 * EXP), null, EXP);
  const body = log.texts.find(t => t.t === 'linha um');
  assert.ok(body, 'corpo do texto é desenhado');
  assert.ok(Math.abs(sizeOf(body.font) - 7.5 * K) < 0.01, `fonte do bloco = ${7.5 * K} px (veio ${sizeOf(body.font)})`);
  assert.ok(sizeOf(body.font) / EXP > 1.9, 'texto passa de ~1,9 mm (antes ~0,6 mm)');

  // Sem texto próprio, usa o mesmo padrão da tela
  const r2 = recorder();
  PrintExporter.drawTextBlockItem(r2.ctx, { width: 80, height: 40, fontSize: 7.5 }, 0, 0, Math.round(80 * EXP), Math.round(40 * EXP), null, EXP);
  assert.ok(r2.log.texts.some(t => t.t.startsWith('1. Coordenadas UTM')), 'texto padrão idêntico ao da tela');
  assert.ok(PrintItemsManager.renderTextBlock({}).includes('Coordenadas UTM'), 'a tela usa o mesmo padrão');

  // Texto que não cabe: última linha visível termina em reticências
  const r3 = recorder();
  const many = Array.from({ length: 40 }, (_, i) => `Nota ${i}`).join('\n');
  PrintExporter.drawTextBlockItem(r3.ctx, { text: many, width: 60, height: 20, fontSize: 7.5 }, 0, 0, Math.round(60 * EXP), Math.round(20 * EXP), null, EXP);
  assert.ok(r3.log.texts.at(-1).t.endsWith('…'), 'excedente termina em "…"');
}

// --- Rótulo ---
{
  const { ctx, log } = recorder();
  PrintExporter.drawLabelItem(ctx, { text: 'TITULO', fontSize: 10, width: 80, height: 12 }, 0, 0, Math.round(80 * EXP), Math.round(12 * EXP), null, EXP);
  assert.ok(Math.abs(sizeOf(log.texts[0].font) - 10 * K) < 0.01, 'rótulo na mesma medida da tela');
  const r2 = recorder();
  PrintExporter.drawLabelItem(r2.ctx, { width: 80, height: 12 }, 0, 0, 2000, 200, null, EXP);
  assert.strictEqual(r2.log.texts[0].t, PrintItemsManager.LABEL_DEFAULT_TEXT, 'rótulo vazio mostra o padrão da tela');
  const r3 = recorder();
  PrintExporter.drawLabelItem(r3.ctx, { text: 'X', fontWeight: 'normal', width: 80, height: 12 }, 0, 0, 100, 100, null, EXP);
  assert.ok(/^normal /.test(r3.log.texts[0].font), 'peso normal respeitado');
}

// --- Seta norte: um modelo só para SVG e canvas ---
{
  for (const style of ['classic', 'compass', 'modern']) {
    const model = PrintItemsManager.northArrowModel(style);
    const svg = PrintItemsManager.getNorthArrowSVG(style, 12);
    assert.strictEqual((svg.match(/<polygon/g) || []).length, model.polys.length, `${style}: SVG tem os polígonos do modelo`);
    assert.strictEqual((svg.match(/<circle/g) || []).length, model.circles.length, `${style}: SVG tem os círculos do modelo`);
    assert.ok(svg.includes('rotate(12deg)'));
    const { ctx, log } = recorder();
    PrintExporter.drawNorthArrowItem(ctx, { arrowStyle: style, rotation: 12 }, 0, 0, 40, 40);
    assert.strictEqual(log.polys, model.polys.length, `${style}: exportação desenha os mesmos polígonos`);
    assert.strictEqual(log.arcs.length, model.circles.length);
    assert.strictEqual(log.texts[0].t, 'N');
  }
}

// --- Tabela de vértices: nada some em silêncio e o texto cabe na coluna ---
{
  const mk = (n) => ({ vertices: Array.from({ length: n }, (_, i) => ({ name: `V${i + 1}`, northing: '7.370.448,06', easting: '265.589,92', azimuth: `326°13'39"`, distance: '1.267,14' })) });
  const few = PrintItemsManager.verticesTableFit(mk(5), 80, 60);
  assert.strictEqual(few.shown, 5);
  assert.strictEqual(few.hidden, 0);
  assert.ok(few.scale > 0.9, `poucas linhas: fonte quase cheia (${few.scale})`);

  const many = PrintItemsManager.verticesTableFit(mk(30), 80, 60);
  assert.ok(many.scale >= PrintItemsManager.VERT_TABLE.MIN_SCALE && many.scale < 1, 'muitas linhas: fonte encolhe');
  assert.strictEqual(many.shown + many.hidden, 30, 'mostrados + escondidos = total');

  const huge = PrintItemsManager.verticesTableFit(mk(200), 80, 40);
  assert.ok(huge.hidden > 0 && huge.shown + huge.hidden === 200, 'cabe o que dá e avisa o resto');

  const narrow = PrintItemsManager.verticesTableFit(mk(3), 40, 80);
  assert.ok(narrow.scale < 1, 'tabela estreita encolhe a fonte em vez de sobrepor colunas');

  assert.strictEqual(PrintItemsManager.verticesTableDatum({ vertices: [] }), '', 'sem vértices, sem fuso inventado');
  assert.strictEqual(PrintItemsManager.verticesTableDatum({ utmZone: 22, utmHemisphere: 'S' }), 'SIRGAS 2000 UTM 22S');

  // Tela e exportação mostram o aviso "+N" na mesma situação
  const feature = { id: 'f', type: 'polygon', name: 'L', coordinates: Array.from({ length: 60 }, (_, i) => [-23.76 + Math.sin(i / 9.5) * 0.01, -53.31 + Math.cos(i / 9.5) * 0.01]) };
  const html = PrintItemsManager.renderVerticesTable({ width: 80, height: 40 }, [feature]);
  assert.ok(/vert-more/.test(html) && /não cabem/.test(html), 'tela avisa vértices não exibidos');
  const { ctx, log } = recorder();
  PrintExporter.drawVerticesTableItem(ctx, { width: 80, height: 40 }, 0, 0, Math.round(80 * EXP), Math.round(40 * EXP), { features: [feature] }, EXP);
  assert.ok(log.texts.some(t => t.t.includes('não cabem')), 'exportação avisa também');
  assert.ok(!log.texts.some(t => /\+\d+ vértices \(total/.test(t.t)), 'sem o aviso antigo');
}

// --- Barra de escala: fontes da tela (7,5 px título, 7 px rótulos) × k ---
{
  const { ctx, log } = recorder();
  PrintExporter.drawScaleBarItem(ctx, { width: 70, height: 18, scale: 52095, segments: 4 }, 0, 0, Math.round(70 * EXP), Math.round(18 * EXP), EXP);
  const title = log.texts.find(t => t.t.startsWith('Escala 1:'));
  const label = log.texts.find(t => t.t.endsWith('km'));
  assert.ok(Math.abs(sizeOf(title.font) - 7.5 * K) < 0.01, 'título da barra na medida da tela');
  assert.ok(Math.abs(sizeOf(label.font) - 7 * K) < 0.01, 'rótulos da barra na medida da tela');
}

// --- Legenda: nome comprido é encurtado com "…" ---
{
  const { ctx, log } = recorder();
  const g = { kind: 'polygon', fill: { color: '#3388ff', opacity: 0.5, pattern: 'solido' }, stroke: { color: '#003366', widthMm: 0.35 }, point: { sizeMm: 2 }, label: {} };
  ctx.setLineDash = () => {};
  ctx.lineWidth = 1;
  try {
    PrintLegendRenderer.draw(ctx, { entries: [{ name: 'Área de Preservação Permanente com nome muito longo da camada', isFilter: false, graphics: g }], wMm: 40, hMm: 20, pxPerMm: 10, title: 'LEGENDA' });
  } catch { /* o contexto de teste não cobre o desenho da amostra */ }
  const name = log.texts.find(t => t.t.startsWith('Área'));
  assert.ok(name && name.t.endsWith('…'), `nome encurtado (${name?.t})`);
}

console.log('🎉 PARIDADE TELA × EXPORTAÇÃO DOS ITENS VALIDADA!');
