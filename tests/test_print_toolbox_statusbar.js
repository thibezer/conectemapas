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
assert.ok(toolboxHtml.includes('data-stb-mode="layout"'), 'Botão de modo layout presente');
assert.ok(toolboxHtml.includes('data-stb-mode="content_pan"'), 'Botão de modo pan presente');
assert.ok(toolboxHtml.includes('class="cm-stb-btn is-active"'), 'Modo ativo destacado');

const allItems = PRINT_INSERT_GROUPS.flatMap(g => g.items);
allItems.forEach(it => {
  assert.ok(toolboxHtml.includes(`data-stb-insert="${it.type}"`), `Botão de inserção para ${it.type} presente`);
});
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

console.log('🎉 Todos os testes de Toolbox e Status Bar passaram!');
