/* ==========================================================================
   ConecteMapas - PrintSideToolbox
   Responsabilidade Única: Barra de ferramentas vertical de inserção rápida e
   alternância de modos na prancheta (padrão QGIS Print Layout / Figma / CAD).
   O desenho da barra, a navegação por teclado, o tooltip e o excesso de itens
   (menu "Mais ferramentas") são do <ui-paleta-ferramentas> do kit; aqui ficam só
   os itens do produto e a cola com o compositor.
   ========================================================================== */

import { PRINT_ICONS, PRINT_INSERT_GROUPS } from './PrintToolbar.js';
import { PrintShortcuts } from './PrintShortcuts.js';

const ICON_LAYOUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 7 18 3-7 7-3z"/></svg>';
const ICON_PAN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 10V3.5a1.5 1.5 0 0 1 3 0V11M14 10.5V5a1.5 1.5 0 0 1 3 0v8M8 13l-1.6-2.4a1.5 1.5 0 0 0-2.5 1.6L7 18a6 6 0 0 0 5 3h1a6 6 0 0 0 6-6v-2"/></svg>';
const ICON_ATLAS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="13" y2="11"/></svg>';

const ID_MODE = 'mode:';
const ID_INSERT = 'insert:';
const ID_ATLAS = 'action:atlas';

/** Tecla em vigor da ação (o usuário pode mudá-la em PrintShortcuts) */
const keyOf = (actionId) => {
  const first = PrintShortcuts.keysFor(actionId)[0];
  return first ? PrintShortcuts.prettyCombo(first) : undefined;
};

export class PrintSideToolbox {
  /** Itens da paleta do kit (dados puros, sem DOM). `ativo` do Atlas vem do compositor. */
  static tools(composer) {
    const insertItems = PRINT_INSERT_GROUPS.flatMap(g => g.items);
    return [
      { id: `${ID_MODE}layout`, rotulo: 'Selecionar e mover elementos', rotuloAcessivel: 'Modo Layout (Selecionar e mover)', icone: ICON_LAYOUT, atalho: keyOf('modeLayout') },
      { id: `${ID_MODE}content_pan`, rotulo: 'Navegar no mapa selecionado (pan e zoom no terreno)', rotuloAcessivel: 'Modo Navegar Terreno no Mapa', icone: ICON_PAN, atalho: keyOf('modeContent'), disabled: composer.readOnly === true },
      { id: 'sep-insert', tipo: 'separador' },
      ...insertItems.map(it => ({
        id: `${ID_INSERT}${it.type}`,
        rotulo: `Desenhar ${it.label} na folha`,
        rotuloAcessivel: `Desenhar ${it.label} na folha`,
        icone: PRINT_ICONS[it.icon] || '',
        atalho: keyOf(`insert:${it.type}`),
        disabled: composer.readOnly === true
      })),
      { id: 'sep-atlas', tipo: 'separador' },
      {
        id: ID_ATLAS,
        tipo: 'toggle',
        rotulo: 'Gerador de Atlas Cartográfico (Automação em Lote)',
        rotuloAcessivel: 'Gerador de Atlas Cartográfico',
        icone: ICON_ATLAS,
        atalho: keyOf('atlas'),
        ativo: Boolean(composer.atlas?.enabled),
        disabled: composer.readOnly === true
      }
    ];
  }

  /** Ferramenta marcada: a de inserção em curso ou, sem ela, o modo de interação */
  static currentValue(composer) {
    const placing = composer.canvasEngine?.placementType;
    return placing ? `${ID_INSERT}${placing}` : `${ID_MODE}${composer.interactionMode === 'content_pan' ? 'content_pan' : 'layout'}`;
  }

  static render() {
    return `
      <aside class="cm-print-side-toolbox" id="cm-print-side-toolbox">
        <ui-paleta-ferramentas class="cm-stb-palette" orientacao="vertical" tamanho="sm" excesso="menu" aria-label="Ferramentas de Layout"></ui-paleta-ferramentas>
      </aside>
    `;
  }

  static palette() {
    return typeof document !== 'undefined' ? document.querySelector('#cm-print-side-toolbox ui-paleta-ferramentas') : null;
  }

  /** Entrega os itens e o valor atual à paleta (também reaplicado quando um atalho muda) */
  static refreshTools(composer) {
    const palette = this.palette();
    if (!palette) return;
    palette.ferramentas = this.tools(composer);
    palette.valor = this.currentValue(composer);
  }

  static bind(composer) {
    const palette = this.palette();
    if (!palette) return;
    this.refreshTools(composer);

    palette.addEventListener('ui-ferramenta', (e) => {
      const id = e.detail?.id || '';
      if (id === ID_ATLAS) {
        composer.atlas?.setEnabled(!composer.atlas.enabled);
        return;
      }
      if (id.startsWith(ID_MODE)) {
        // Escolher um modo encerra a inserção em curso (a paleta marca uma ferramenta por vez)
        if (composer.canvasEngine?.placementType) composer.setPlacementTool?.(null);
        composer.setInteractionMode(id.slice(ID_MODE.length));
        return;
      }
      if (id.startsWith(ID_INSERT)) {
        const type = id.slice(ID_INSERT.length);
        if (typeof composer.setPlacementTool === 'function') {
          const next = composer.canvasEngine?.placementType === type ? null : type;
          composer.setPlacementTool(next);
        } else {
          composer.insertItem?.(type);
        }
        // Segundo clique na mesma ferramenta a solta: a paleta volta ao modo de interação
        this.updateActivePlacementTool(composer);
      }
    });

    // Tooltips e teclas mostradas acompanham os atalhos personalizados
    composer._stbUnsubscribe?.();
    composer._stbUnsubscribe = PrintShortcuts.onChange(() => this.refreshTools(composer));
  }

  static updateActivePlacementTool(composer) {
    this.palette()?.ativar?.(this.currentValue(composer), false);
  }

  static updateActiveMode(composer) {
    this.palette()?.ativar?.(this.currentValue(composer), false);
  }

  /** Atlas ligado/desligado por fora da paleta (painel de propriedades, barra do atlas) */
  static updateAtlas(enabled) {
    this.palette()?.atualizarItem?.(ID_ATLAS, { ativo: Boolean(enabled) });
  }

  /** Bloqueia o que altera a prancha enquanto outro operador edita */
  static setReadOnly(readOnly) {
    const palette = this.palette();
    if (!palette) return;
    PRINT_INSERT_GROUPS.flatMap(g => g.items).forEach(it => palette.atualizarItem(`${ID_INSERT}${it.type}`, { disabled: readOnly }));
    palette.atualizarItem(`${ID_MODE}content_pan`, { disabled: readOnly });
    palette.atualizarItem(ID_ATLAS, { disabled: readOnly });
  }
}
