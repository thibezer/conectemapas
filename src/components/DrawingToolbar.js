/* ==========================================================================
   ConecteMapas - DrawingToolbar Component (SRP Module)
   Responsabilidade Única: Barra lateral flutuante de ferramentas vetoriais
   implementada com o Web Component nativo <ui-paleta-ferramentas>.
   ========================================================================== */

import './DrawingToolbar.css';

export class DrawingToolbar {
  /**
   * @param {Object} options
   * @param {string} options.initialTool
   * @param {Function} options.onToolChange
   * @param {Function} options.onAction
   */
  constructor(options = {}) {
    this.activeTool = options.initialTool || 'select';
    this.onToolChange = options.onToolChange || (() => {});
    this.onAction = options.onAction || (() => {});
    this.container = null;
    this.paleta = null;
    this.activeLayer = null;
  }

  /**
   * Definição canônica das ferramentas da paleta CAD/GIS
   * @returns {Array<Object>}
   */
  getToolsDefinition() {
    return [
      {
        id: 'select',
        rotulo: 'Navegar e Selecionar Elementos',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 7 18 3-7 7-3L3 3z"/><path d="m13 13 6 6"/></svg>',
        atalho: 'V',
        tipo: 'ferramenta'
      },
      {
        id: 'pen-select',
        rotulo: 'Caneta de Seleção Poligonal',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
        atalho: 'Q',
        tipo: 'ferramenta'
      },
      {
        id: 'sep-1',
        tipo: 'separador'
      },
      {
        id: 'point',
        rotulo: 'Adicionar Marco / Ponto',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
        atalho: 'P',
        tipo: 'ferramenta'
      },
      {
        id: 'line',
        rotulo: 'Desenhar Linha / Rota',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 19 14-14"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/></svg>',
        atalho: 'L',
        tipo: 'ferramenta'
      },
      {
        id: 'polygon',
        rotulo: 'Desenhar Polígono / Área',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 8.5v7L12 22l10-6.5v-7L12 2z"/></svg>',
        atalho: 'A',
        tipo: 'ferramenta'
      },
      {
        id: 'circle',
        rotulo: 'Criar Buffer Circular',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/></svg>',
        atalho: 'C',
        tipo: 'ferramenta'
      },
      {
        id: 'text',
        rotulo: 'Texto / Rótulo no Mapa',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
        atalho: 'T',
        tipo: 'ferramenta'
      },
      {
        id: 'sep-2',
        tipo: 'separador'
      },
      {
        id: 'measure',
        rotulo: 'Régua de Medição (Distância & Área)',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.12 6.4-6.4-6.4a2 2 0 0 0-2.83 0L2.4 9.49a2 2 0 0 0 0 2.83l6.4 6.4a2 2 0 0 0 2.83 0l9.49-9.49a2 2 0 0 0 0-2.83Z"/><line x1="7.5" y1="10.5" x2="6" y2="9"/><line x1="10.5" y1="13.5" x2="9" y2="12"/><line x1="13.5" y1="16.5" x2="12" y2="15"/><line x1="16.5" y1="19.5" x2="15" y2="18"/></svg>',
        atalho: 'M',
        tipo: 'ferramenta'
      },
      {
        id: 'sep-3',
        tipo: 'separador'
      },
      {
        id: 'locate',
        rotulo: 'Minha Localização GPS',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>',
        atalho: 'G',
        tipo: 'botao'
      },
      {
        id: 'fit',
        rotulo: 'Enquadrar Todas as Feições',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
        atalho: 'Z',
        tipo: 'botao'
      }
    ];
  }

  /**
   * Renderiza a paleta de ferramentas
   * @param {HTMLElement} container
   */
  render(container) {
    this.container = container;
    this.container.innerHTML = `
      <div class="cm-drawing-toolbar-wrapper">
        <ui-paleta-ferramentas 
          id="cm-paleta-ferramentas" 
          orientacao="vertical" 
          tamanho="md"
          atalhos
          valor="${this.activeTool}"
          aria-label="Ferramentas de Desenho e Medição">
        </ui-paleta-ferramentas>

        <!-- Indicador de Camada Ativa -->
        <div class="cm-active-layer-indicator" id="cm-active-layer-indicator" title="Camada ativa para novos desenhos">
          <div class="cm-active-layer-dot" style="background: ${this.activeLayer?.color || '#00E08A'};"></div>
        </div>
      </div>
    `;

    this.paleta = this.container.querySelector('#cm-paleta-ferramentas');
    if (this.paleta) {
      this.paleta.ferramentas = this.getToolsDefinition();
      this.paleta.valor = this.activeTool;
    }

    this.bindEvents();
  }

  /**
   * Atualiza a camada ativa de desenho na toolbar
   * @param {Object} layer
   */
  setActiveLayer(layer) {
    this.activeLayer = layer;
    if (!this.container) return;
    const indicator = this.container.querySelector('#cm-active-layer-indicator');
    if (indicator && layer) {
      indicator.title = `Camada ativa: "${layer.name}" (novos desenhos serão salvos nela)`;
      const dot = indicator.querySelector('.cm-active-layer-dot');
      if (dot) dot.style.background = layer.color || '#00E08A';
    }
  }

  /**
   * Define ferramenta ativa visualmente na paleta
   * @param {string} tool
   */
  setActiveTool(tool) {
    this.activeTool = tool;
    if (this.paleta && this.paleta.valor !== tool) {
      this.paleta.ativar(tool, false);
    }
  }

  /**
   * Vincula eventos de clique e atalhos da paleta
   */
  bindEvents() {
    if (!this.paleta) return;

    // Ferramenta exclusiva selecionada (V, Q, P, L, A, C, M)
    this.paleta.addEventListener('ui-change', (e) => {
      const tool = e.detail?.valor;
      if (tool && tool !== this.activeTool) {
        this.activeTool = tool;
        this.onToolChange(tool);
      }
    });

    // Disparo de botões de ação pontual (locate, fit)
    this.paleta.addEventListener('ui-ferramenta', (e) => {
      const id = e.detail?.id;
      const tipo = e.detail?.item?.tipo;
      if (tipo === 'botao') {
        this.onAction(id);
      }
    });
  }

  triggerTool(tool) {
    this.setActiveTool(tool);
    this.onToolChange(tool);
  }
}
