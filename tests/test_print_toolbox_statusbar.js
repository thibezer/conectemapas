/* ==========================================================================
   ConecteMapas - Teste da Toolbox Lateral e Status Bar do Layout
   Cobre:
   1. PrintSideToolbox: renderização dos botões de modo (layout e pan) e itens de inserção.
   2. PrintStatusBar: dados da folha, coordenadas e nível de zoom.
   3. PrintComposerModal: integração de marcação no DOM do modal.
   ========================================================================== */

import assert from 'assert';
import { PrintSideToolbox } from '../src/components/PrintComposer/PrintSideToolbox.js';
import { PrintStatusBar } from '../src/components/PrintComposer/PrintStatusBar.js';
import { PRINT_INSERT_GROUPS } from '../src/components/PrintComposer/PrintToolbar.js';

console.log('--- Teste da Toolbox Lateral e Status Bar do Layout ---');

const mockComposer = {
  interactionMode: 'layout',
  readOnly: false,
  paperSize: { name: 'A4 Paisagem', width: 297, height: 210 },
  canvasEngine: { zoom: 1.25 },
  sheetsManager: {
    getCurrentSheet: () => ({ name: 'Prancha 01 - Geral' })
  }
};

// 1. PrintSideToolbox
console.log('1. PrintSideToolbox...');
const toolboxHtml = PrintSideToolbox.render(mockComposer);
assert.ok(toolboxHtml.includes('id="cm-print-side-toolbox"'), 'Contêiner da toolbox lateral presente');
assert.ok(toolboxHtml.includes('<ui-paleta-ferramentas'), 'A caixa lateral é a paleta do kit');
assert.ok(toolboxHtml.includes('orientacao="vertical"'), 'Paleta vertical');

const tools = PrintSideToolbox.tools(mockComposer);
const ids = tools.map(t => t.id);
assert.ok(ids.includes('mode:layout') && ids.includes('mode:content_pan'), 'Modos layout e pan presentes');
assert.strictEqual(new Set(ids).size, ids.length, 'Ids únicos');
assert.strictEqual(PrintSideToolbox.currentValue(mockComposer), 'mode:layout', 'Modo ativo marcado');
assert.strictEqual(PrintSideToolbox.currentValue({ ...mockComposer, interactionMode: 'content_pan' }), 'mode:content_pan');
assert.strictEqual(PrintSideToolbox.currentValue({ ...mockComposer, canvasEngine: { placementType: 'legend' } }), 'insert:legend', 'Inserção em curso tem prioridade');

const allItems = PRINT_INSERT_GROUPS.flatMap(g => g.items);
allItems.forEach(it => {
  assert.ok(ids.includes(`insert:${it.type}`), `Ferramenta de inserção para ${it.type} presente`);
});
assert.ok(tools.filter(t => t.tipo !== 'separador').every(t => t.icone && t.rotulo), 'Todo item tem ícone e rótulo');
assert.strictEqual(tools.find(t => t.id === 'action:atlas').tipo, 'toggle', 'Atlas liga e desliga');
assert.ok(PrintSideToolbox.tools({ ...mockComposer, readOnly: true }).filter(t => t.id.startsWith('insert:')).every(t => t.disabled), 'Somente leitura desabilita a inserção');
console.log('✔ PrintSideToolbox validada!');

// 2. PrintStatusBar
console.log('2. PrintStatusBar...');
const statusHtml = PrintStatusBar.render(mockComposer);
assert.ok(statusHtml.includes('id="cm-print-statusbar"'), 'Contêiner da status bar presente');
assert.ok(statusHtml.includes('Prancha 01 - Geral'), 'Nome da prancha na status bar');
assert.ok(statusHtml.includes('297×210 mm'), 'Dimensões do papel na status bar');
assert.ok(statusHtml.includes('id="cm-psb-coord-x"'), 'Coordenada X presente');
assert.ok(statusHtml.includes('id="cm-psb-coord-y"'), 'Coordenada Y presente');
assert.ok(statusHtml.includes('125%'), 'Zoom na status bar formatado');
assert.ok(statusHtml.includes('🟢 Sincronizado'), 'Status de sincronização');

// Verifica blindagem contra XSS no nome da prancha
const xssComposer = {
  ...mockComposer,
  sheetsManager: {
    getCurrentSheet: () => ({ name: '<img src=x onerror=alert(1)>' })
  }
};
const xssStatusHtml = PrintStatusBar.render(xssComposer);
assert.ok(!xssStatusHtml.includes('<img src=x'), 'Nome da prancha deve ser escapado contra XSS');
assert.ok(xssStatusHtml.includes('&lt;img src=x'), 'Entidades HTML escapadas corretamente');
console.log('✔ PrintStatusBar validada!');

// 3. PrintToolHints: dica acompanha a ferramenta em uso
console.log('3. PrintToolHints...');
import { PrintToolHints } from '../src/components/PrintComposer/PrintToolHints.js';
const hintsOf = (over) => PrintToolHints.resolve({ ...mockComposer, getSelectedItems: () => [], ...over });
assert.strictEqual(hintsOf({}).tool, 'Selecionar', 'Sem seleção: ferramenta Selecionar');
assert.strictEqual(hintsOf({ interactionMode: 'content_pan' }).tool, 'Navegar no mapa', 'Modo pan');
assert.ok(hintsOf({ canvasEngine: { placementType: 'legend' } }).tool.includes('Legenda'), 'Inserção mostra o item');
assert.strictEqual(hintsOf({ _pick: {} }).tool, 'Escolher feição', 'Escolha de feição');
assert.strictEqual(hintsOf({ readOnly: true }).tool, 'Somente leitura', 'Somente leitura');
assert.strictEqual(hintsOf({ selectedGuide: { axis: 'x', val: 10 } }).tool, 'Guia vertical', 'Guia selecionada');
assert.strictEqual(hintsOf({ getSelectedItems: () => [{ type: 'map' }, { type: 'legend' }] }).tool, '2 itens selecionados', 'Seleção múltipla');
const mapHints = hintsOf({ getSelectedItems: () => [{ type: 'map' }] });
assert.strictEqual(mapHints.tool, 'Mapa principal', 'Item único usa o nome do tipo');
assert.ok(mapHints.hints.some(h => h.t === 'navega no mapa'), 'Mapa sugere navegar');
assert.ok(statusHtml.includes('cm-psb-hints'), 'Rodapé mostra as dicas');
console.log('✔ PrintToolHints validado!');

console.log('🎉 Todos os testes de Toolbox e Status Bar passaram!');
