/* ==========================================================================
   ConecteMapas - PrintToolHints
   Responsabilidade Única: decidir qual ferramenta está em uso no Layout de
   Impressão e o que fazer nela (dicas com as teclas em vigor). Sem DOM: só
   lê o estado do composer e devolve { tool, hints: [{ k, t }] }
   (k = tecla ou gesto, t = o que faz). Quem desenha é o PrintStatusBar.
   ========================================================================== */

import { PrintShortcuts } from './PrintShortcuts.js';
import { PRINT_INSERT_GROUPS } from './PrintToolbar.js';

const ITEM_LABELS = Object.fromEntries(PRINT_INSERT_GROUPS.flatMap(g => g.items).map(i => [i.type, i.label]));

/** Tecla em vigor da ação (o usuário pode mudá-la); '' se a ação ficou sem atalho. */
const keyOf = (id) => {
  const first = PrintShortcuts.keysFor(id)[0];
  return first ? PrintShortcuts.prettyCombo(first) : '';
};

const hint = (k, t) => ({ k, t });
const hintFor = (id, t) => { const k = keyOf(id); return k ? hint(k, t) : null; };
const list = (...hs) => hs.filter(Boolean);

export class PrintToolHints {
  static resolve(composer) {
    if (composer._pick) {
      return { tool: 'Escolher feição', hints: list(hint('Clique', 'numa feição do mapa'), hint('Esc', 'cancela')) };
    }
    if (composer.readOnly) {
      return { tool: 'Somente leitura', hints: list(hint('Roda', 'zoom'), hint('Arrastar', 'move a folha'), hintFor('zoomFit', 'enquadra')) };
    }
    const placing = composer.canvasEngine?.placementType;
    if (placing) {
      return { tool: `Inserir · ${ITEM_LABELS[placing] || 'item'}`, hints: list(hint('Arrastar', 'na folha para desenhar'), hint('Esc', 'cancela')) };
    }
    if (composer.interactionMode === 'content_pan') {
      return {
        tool: 'Navegar no mapa',
        hints: list(hint('Arrastar', 'move o mapa'), hint('Roda', 'zoom do mapa'), hint('Esc', 'conclui'), hintFor('modeLayout', 'volta a selecionar'))
      };
    }
    if (composer.selectedGuide) return this.guide(composer);

    const sel = composer.getSelectedItems?.() || [];
    if (sel.length > 1) {
      return {
        tool: `${sel.length} itens selecionados`,
        hints: list(hint('Arrastar', 'move o grupo'), hint('Shift+clique', 'adiciona/remove'), hintFor('alignLeft', 'alinha'), hintFor('duplicate', 'duplica'), hintFor('delete', 'exclui'))
      };
    }
    if (sel.length === 1) return this.item(sel[0]);

    return {
      tool: 'Selecionar',
      hints: list(
        hint('Clique', 'seleciona um item'),
        hint('Arrastar', 'move a folha'),
        hint('Roda', 'zoom'),
        hint('Régua', 'arraste para criar guia'),
        hintFor('insert:map', 'insere mapa'),
        hintFor('openShortcuts', 'todos os atalhos')
      )
    };
  }

  static guide(composer) {
    const tool = `Guia ${composer.selectedGuide.axis === 'x' ? 'vertical' : 'horizontal'}`;
    if (composer.guidesLocked) {
      return { tool, hints: list(hint('🔒', 'guias travadas'), hintFor('lockGuides', 'destravar')) };
    }
    return { tool, hints: list(hint('Arrastar', 'move'), hint('2 cliques', 'exclui'), hintFor('delete', 'exclui'), hint('Painel', 'posição exata')) };
  }

  static item(it) {
    const tool = ITEM_LABELS[it.type] || 'Item';
    if (it.locked) return { tool, hints: list(hint('🔒', 'item travado'), hint('Painel', 'destrava')) };
    const isMap = it.type === 'map' || it.type === 'inset_map';
    return {
      tool,
      hints: list(
        hint('Arrastar', 'move'),
        hint('Alças', 'redimensiona'),
        hint('Shift', 'mantém proporção'),
        isMap ? hint('2 cliques', 'navega no mapa') : null,
        hint('Setas', 'ajustam 1 mm'),
        hintFor('duplicate', 'duplica'),
        hintFor('delete', 'exclui')
      )
    };
  }
}
