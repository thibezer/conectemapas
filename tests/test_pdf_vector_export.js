// Exportação em PDF vetorial: textos, formas, traços e preenchimentos NÃO podem virar raster.
import assert from 'assert';
import { jsPDF } from 'jspdf';
import { PdfVectorContext, parseCssColor } from '../src/components/PrintComposer/PdfVectorContext.js';
import { PrintTitleBlockRenderer } from '../src/components/PrintComposer/PrintTitleBlockRenderer.js';
import { PrintLegendRenderer } from '../src/components/PrintComposer/PrintLegendRenderer.js';
import { PrintMapRenderer } from '../src/components/PrintComposer/PrintMapRenderer.js';

const newDoc = () => new jsPDF({ orientation: 'landscape', unit: 'mm', format: [420, 297], compress: false });
const countLines = (text, op) => text.split('\n').filter(l => l === op).length;
const DPI = 300;
const PX = DPI / 25.4;

// ----- Cores ---------------------------------------------------------------
assert.deepStrictEqual(parseCssColor('#ff0000'), { r: 255, g: 0, b: 0, a: 1 });
assert.deepStrictEqual(parseCssColor('#f00'), { r: 255, g: 0, b: 0, a: 1 });
assert.strictEqual(parseCssColor('rgba(255, 255, 255, 0.5)').a, 0.5);
assert.strictEqual(parseCssColor('none'), null);
assert.strictEqual(parseCssColor('transparent'), null);

// ----- Primitivas ----------------------------------------------------------
{
  const pdf = newDoc();
  const ctx = new PdfVectorContext(pdf, { pxPerMm: PX });
  ctx.fillStyle = '#ff8800';
  ctx.strokeStyle = '#0000ff';
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 2]);
  ctx.beginPath();
  ctx.rect(10, 10, 100, 80);
  ctx.rect(30, 30, 20, 20);
  ctx.fill('evenodd');
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(200, 200, 30, 0, Math.PI * 2);
  ctx.globalAlpha = 0.4;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = 'bold 40px Arial, sans-serif';
  ctx.fillStyle = '#112233';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Área 12,5 m² - Nº 3', 300, 100);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText('Halo', 300, 160);
  assert.ok(ctx.measureText('Hello').width > 0, 'measureText deve medir o texto');
  ctx.save();
  ctx.translate(50, 50);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Rotacionado', 0, 0);
  ctx.restore();
  ctx.finish();

  const out = pdf.output();
  assert.ok(!/\/Subtype\s*\/Image/.test(out), 'o PDF não pode conter imagens raster');
  assert.ok(/\sf\*\n/.test(out), 'preenchimento evenodd (furos) deve virar f*');
  assert.ok(/\nS\n/.test(out), 'traço deve virar operador S');
  assert.ok(/\[4 2\] 0 d/.test(out), 'tracejado deve virar operador d');
  assert.ok(/\/GS\d+ gs/.test(out), 'opacidade deve virar ExtGState');
  assert.ok(/\(Área 12,5 m² - Nº 3\) Tj|\(\\?[^)]*12,5[^)]*\) Tj/.test(out), 'texto deve ser texto real (Tj), selecionável');
  assert.ok(/\n1 Tr\n/.test(out), 'halo deve usar renderização de texto por traço');
  assert.strictEqual(countLines(out, 'q'), countLines(out, 'Q'), 'q/Q balanceados');
}

// ----- Carimbo, legenda e feição (mesmos renderizadores da tela) -----------
{
  const pdf = newDoc();
  const ctx = new PdfVectorContext(pdf, { pxPerMm: PX });
  ctx.save();
  ctx.translate(20 * PX, 20 * PX);
  PrintTitleBlockRenderer.draw(ctx, { item: { properties: {} }, projectName: 'Projeto Teste', mapScale: 5000, wMm: 180, hMm: 50, pxPerMm: PX });
  ctx.restore();
  ctx.save();
  ctx.translate(220 * PX, 20 * PX);
  PrintLegendRenderer.draw(ctx, {
    entries: [{ name: 'Lote', isFilter: false, graphics: { kind: 'polygon', fill: { color: '#3388ff', opacity: 0.5, pattern: 'hachura' }, stroke: { color: '#003366', widthMm: 0.35, dashMm: [2, 1] }, point: { sizeMm: 2 }, label: {} } }],
    wMm: 60, hMm: 30, pxPerMm: PX, title: 'LEGENDA'
  });
  ctx.restore();

  // Polígono com furo + círculo + linha + ponto + texto pelo desenhador de feições
  const g = (kind, extra = {}) => ({
    kind,
    fill: { color: '#22aa44', opacity: 0.6, pattern: 'solido' },
    stroke: { color: '#115522', widthMm: 0.3, dashMm: null, pattern: 'continuo' },
    point: { sizeMm: 2 }, text: { sizePt: 8, color: '#000000', halo: true }, label: { show: false },
    ...extra
  });
  const project = (ll) => ({ x: 100 + ll[1] * 1000, y: 800 - ll[0] * 1000 });
  const poly = { coordinates: [[[0, 0], [0.2, 0], [0.2, 0.2], [0, 0.2]], [[0.05, 0.05], [0.1, 0.05], [0.1, 0.1], [0.05, 0.1]]] };
  ctx.save();
  PrintMapRenderer.drawFeature(ctx, poly, g('polygon'), project, PX);
  PrintMapRenderer.drawFeature(ctx, { coordinates: [[0, 0], [0.3, 0.3]] }, g('line'), project, PX);
  PrintMapRenderer.drawFeature(ctx, { coordinates: [0.1, 0.1], radius: 500 }, g('circle'), project, PX);
  PrintMapRenderer.drawFeature(ctx, { coordinates: [0.15, 0.15] }, g('point'), project, PX);
  PrintMapRenderer.drawFeature(ctx, { coordinates: [0.12, 0.12], name: 'Rótulo' }, g('text'), project, PX);
  // Hachura recortada por clip evenodd
  PrintMapRenderer.drawFeature(ctx, poly, g('polygon', { fill: { color: '#aa2222', opacity: 1, pattern: 'hachura' } }), project, PX);
  ctx.restore();
  ctx.finish();

  const out = pdf.output();
  assert.ok(!/\/Subtype\s*\/Image/.test(out), 'carimbo/legenda/feições não podem virar imagem');
  assert.ok(/PROJETO \/ OBRA|Projeto \/ Obra/i.test(out), 'texto do carimbo deve ficar no PDF como texto');
  assert.ok(/W\* n/.test(out), 'clip evenodd da hachura deve virar W* n');
  assert.ok(/\bm\n|\sm\n/.test(out) && /\sc\n/.test(out), 'caminhos e curvas (círculo) vetoriais');
  assert.strictEqual(countLines(out, 'q'), countLines(out, 'Q'), 'q/Q balanceados');
}

// ----- Raster: só quando há imagem de verdade ------------------------------
{
  const pdf = newDoc();
  const ctx = new PdfVectorContext(pdf, { pxPerMm: PX });
  const tainted = {
    width: 10, height: 10, naturalWidth: 10, naturalHeight: 10
  };
  // Sem DOM no Node: uma fonte inválida não pode deixar a página suja (falha antes de emitir)
  let threw = false;
  try { ctx.drawImage(tainted, 0, 0, 10, 10); } catch (e) { threw = true; }
  assert.ok(threw, 'sem DOM, drawImage deve falhar antes de emitir operadores');
  assert.throws(() => ctx.drawImage(tainted, 0, 0), /exige/);
  ctx.finish();
}

console.log('✔ test_pdf_vector_export: PDF vetorial OK');
