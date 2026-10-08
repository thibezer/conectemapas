/* ==========================================================================
   ConecteMapas - DrawingToolbar Component (SRP Module)
   Barra lateral flutuante híbrida CAD/GIS:
   - Modo híbrido com alternador dinâmico de 1 ou 2 colunas (com persistência)
   - Ferramentas completas de seleção, vetor, conta-gotas, formas e divisão (faca)
   - Toggle de Snap Magnético sincronizado com luz indicadora
   - Ações rápidas de Undo/Redo, Enquadrar, GPS, Limpar e Excluir
   - Seletor de Cores clássico estilo Adobe Illustrator (Fill / Stroke)
   - Seletor rápido de camada ativa integrado com popover
   ========================================================================== */

if (typeof window !== 'undefined') {
  import('./DrawingToolbar.css');
}

export class DrawingToolbar {
  /**
   * @param {Object} options
   * @param {string} [options.initialTool='select']
   * @param {boolean} [options.snappingEnabled=true]
   * @param {string} [options.initialFillColor='#00E08A']
   * @param {string} [options.initialStrokeColor='#ffffff']
   * @param {Object} [options.initialLayer=null]
   * @param {Function} [options.getLayers]
   * @param {Function} [options.onToolChange]
   * @param {Function} [options.onAction]
   * @param {Function} [options.onColorChange]
   * @param {Function} [options.onSelectLayer]
   */
  constructor(options = {}) {
    this.activeTool = options.initialTool || 'select';
    this.snappingEnabled = options.snappingEnabled !== undefined ? options.snappingEnabled : true;
    this.columns = localStorage.getItem('cm_toolbar_cols') || '2';
    this.fillColor = options.initialFillColor || '#00E08A';
    this.strokeColor = options.initialStrokeColor || '#ffffff';
    this.activeColorTarget = 'fill'; // 'fill' ou 'stroke'
    this.activeLayer = options.initialLayer || null;

    this.getLayers = options.getLayers || (() => []);
    this.onToolChange = options.onToolChange || (() => {});
    this.onAction = options.onAction || (() => {});
    this.onColorChange = options.onColorChange || (() => {});
    this.onSelectLayer = options.onSelectLayer || (() => {});

    this.container = null;
    this.paleta = null;
    this.isLayerMenuOpen = false;

    this._handleDocClick = this._handleDocClick.bind(this);
  }

  /**
   * Definição canônica das ferramentas da paleta CAD/GIS
   * @returns {Array<Object>}
   */
  getToolsDefinition() {
    return [
      // --- GRUPO 1: SELEÇÃO & NAVEGAÇÃO ---
      {
        id: 'select',
        rotulo: 'Navegar e Selecionar Elementos',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 7 18 3-7 7-3L3 3z"/><path d="m13 13 6 6"/></svg>',
        atalho: 'V',
        tipo: 'ferramenta'
      },
      {
        id: 'pen-select',
        rotulo: 'Laço Poligonal de Seleção',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
        atalho: 'Q',
        tipo: 'ferramenta'
      },
      {
        id: 'sep-1',
        tipo: 'separador'
      },

      // --- GRUPO 2: FORMAS VETORIAIS (SHAPES) ---
      {
        id: 'polygon',
        rotulo: 'Desenhar Polígono / Área',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 8.5v7L12 22l10-6.5v-7L12 2z"/></svg>',
        atalho: 'A',
        tipo: 'ferramenta'
      },
      {
        id: 'rectangle',
        rotulo: 'Desenhar Retângulo / Caixa',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="14" x="3" y="5" rx="2"/></svg>',
        atalho: 'R',
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
        id: 'point',
        rotulo: 'Adicionar Marco / Ponto',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
        atalho: 'P',
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

      // --- GRUPO 3: FERRAMENTAS ESPECIAIS (CONTA-GOTAS & DIVISÃO) ---
      {
        id: 'eyedropper',
        rotulo: 'Conta-gotas (Copiar Estilo de Feição)',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 7 3 3"/><path d="m5 16 6-6"/><path d="m19 8.5-4.5-4.5a2.12 2.12 0 0 0-3 0L3.5 12a2.12 2.12 0 0 0 0 3l1.5 1.5-3 5.5 5.5-3 1.5 1.5a2.12 2.12 0 0 0 3 0L20 11.5a2.12 2.12 0 0 0 0-3z"/></svg>',
        atalho: 'I',
        tipo: 'ferramenta'
      },
      {
        id: 'split',
        rotulo: 'Divisão de Formas / Faca (Cortar Polígono)',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
        atalho: 'K',
        tipo: 'ferramenta'
      },
      {
        id: 'join',
        rotulo: 'Junção de Formas / União CAD',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/><path d="M9 6a6 6 0 0 1 0 12"/><path d="M15 6a6 6 0 0 0 0 12"/></svg>',
        atalho: 'J',
        tipo: 'botao'
      },
      {
        id: 'sep-3',
        tipo: 'separador'
      },

      // --- GRUPO 4: PRECISÃO & MEDIÇÃO CAD ---
      {
        id: 'snap',
        rotulo: 'Snap Magnético a Vértices (Ímã CAD)',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.35-6.35a2.14 2.14 0 0 0-3-3L6 15Z"/><path d="m5 8 4 4"/><path d="m12 15 4 4"/></svg>',
        atalho: 'S',
        tipo: 'toggle',
        ativo: this.snappingEnabled
      },
      {
        id: 'measure',
        rotulo: 'Régua de Medição (Distância & Área)',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="9" x="2" y="8" rx="1.5"/><line x1="6" y1="8" x2="6" y2="13"/><line x1="10" y1="8" x2="10" y2="11.5"/><line x1="14" y1="8" x2="14" y2="13"/><line x1="18" y1="8" x2="18" y2="11.5"/></svg>',
        atalho: 'M',
        tipo: 'ferramenta'
      },
      {
        id: 'sep-4',
        tipo: 'separador'
      },

      // --- GRUPO 5: HISTÓRICO & AÇÕES RÁPIDAS ---
      {
        id: 'undo',
        rotulo: 'Desfazer Vértice ou Ação',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>',
        atalho: 'Ctrl+Z',
        tipo: 'botao'
      },
      {
        id: 'redo',
        rotulo: 'Refazer Ação',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>',
        atalho: 'Ctrl+Y',
        tipo: 'botao'
      },
      {
        id: 'fit',
        rotulo: 'Enquadrar Todas as Feições',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
        atalho: 'Z',
        tipo: 'botao'
      },
      {
        id: 'locate',
        rotulo: 'Minha Localização GPS',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>',
        atalho: 'G',
        tipo: 'botao'
      },
      {
        id: 'clear-selection',
        rotulo: 'Limpar Seleção / Desmarcar',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/></svg>',
        atalho: 'Esc',
        tipo: 'botao'
      },
      {
        id: 'delete-feature',
        rotulo: 'Excluir Feição Selecionada',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
        atalho: 'Del',
        tipo: 'botao'
      }
    ];
  }

  /**
   * Renderiza a paleta de ferramentas com barra de topo, paleta, seletor de cores e rodapé de camadas
   * @param {HTMLElement} container
   */
  render(container) {
    this.container = container;
    const isCols2 = this.columns === '2';

    this.container.innerHTML = `
      <div class="cm-drawing-toolbar-wrapper ${isCols2 ? 'cm-drawing-toolbar-wrapper--cols-2' : 'cm-drawing-toolbar-wrapper--cols-1'}">
        <!-- Cabeçalho com Toggle de Layout Híbrido (1 ou 2 Colunas) -->
        <div class="cm-toolbar-header">
          <button type="button" 
                  class="cm-toolbar-col-toggle-btn" 
                  id="cm-toolbar-col-toggle" 
                  title="${isCols2 ? 'Alternar para 1 coluna esguia' : 'Alternar para 2 colunas compactas'}">
            ${isCols2 
              ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="8" height="18" x="8" y="3" rx="1"/></svg>'
              : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="8" height="18" x="3" y="3" rx="1"/><rect width="8" height="18" x="13" y="3" rx="1"/></svg>'
            }
          </button>
        </div>

        <!-- Paleta Web Component Nativa -->
        <ui-paleta-ferramentas 
          id="cm-paleta-ferramentas" 
          orientacao="vertical" 
          colunas="${this.columns}"
          tamanho="md"
          atalhos
          valor="${this.activeTool}"
          aria-label="Ferramentas de Desenho e Medição">
        </ui-paleta-ferramentas>

        <!-- Seletor de Cores Clássico do Illustrator (Fill & Stroke) -->
        <div class="cm-illustrator-color-widget" id="cm-illustrator-color-widget" title="Seletor de Cores de Preenchimento e Traço">
          <div class="cm-illustrator-color-box">
            <!-- Botão Inverter Fill / Stroke (X) -->
            <button type="button" class="cm-color-swap-btn" id="cm-color-swap" title="Alternar Preenchimento e Traço [X]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
            </button>

            <!-- Bloco de Traço (Stroke) -->
            <div class="cm-color-block cm-color-block--stroke ${this.activeColorTarget === 'stroke' ? 'cm-color-block--active' : ''}" 
                 id="cm-stroke-block" 
                 title="Cor do Traço / Contorno">
              <div class="cm-color-stroke-inner" style="border-color: ${this.strokeColor};"></div>
              <input type="color" class="cm-color-input-hidden" id="cm-stroke-picker" value="${this.strokeColor}">
            </div>

            <!-- Bloco de Preenchimento (Fill) -->
            <div class="cm-color-block cm-color-block--fill ${this.activeColorTarget === 'fill' ? 'cm-color-block--active' : ''}" 
                 id="cm-fill-block" 
                 title="Cor do Preenchimento">
              <div class="cm-color-fill-inner" style="background-color: ${this.fillColor};"></div>
              <input type="color" class="cm-color-input-hidden" id="cm-fill-picker" value="${this.fillColor}">
            </div>

            <!-- Botão de Cores Padrão (D) -->
            <button type="button" class="cm-color-default-btn" id="cm-color-default" title="Cores Padrão [D]">
              <div class="cm-color-default-square cm-color-default-square--white"></div>
              <div class="cm-color-default-square cm-color-default-square--color" style="background: ${this.activeLayer?.color || '#00E08A'}"></div>
            </button>
          </div>
        </div>

        <!-- Seletor Rápido de Camada Ativa Integrado -->
        <div class="cm-active-layer-pill" id="cm-active-layer-pill" title="Camada de destino dos novos desenhos (clique para alternar)">
          <div class="cm-active-layer-dot" style="background: ${this.activeLayer?.color || '#00E08A'};"></div>
          <span class="cm-active-layer-name">${this.activeLayer?.name || 'Padrão'}</span>
          <svg class="cm-active-layer-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>

        <!-- Popover Flutuante com Menu de Camadas -->
        <div class="cm-layer-dropdown-menu" id="cm-layer-dropdown-menu" style="display: none;">
          <div class="cm-layer-dropdown-title">Camada Ativa de Desenho</div>
          <div class="cm-layer-dropdown-list" id="cm-layer-dropdown-list"></div>
        </div>
      </div>
    `;

    this.paleta = this.container.querySelector('#cm-paleta-ferramentas');
    if (this.paleta) {
      this.paleta.ferramentas = this.getToolsDefinition();
      this.paleta.valor = this.activeTool;
    }

    this.bindEvents();
    this.bindColorEvents();
    this.bindLayerEvents();
  }

  /**
   * Alterna entre modo 1 coluna ou 2 colunas
   * @param {string} cols '1' ou '2'
   */
  setColumns(cols) {
    this.columns = cols === '2' ? '2' : '1';
    localStorage.setItem('cm_toolbar_cols', this.columns);

    const wrapper = this.container?.querySelector('.cm-drawing-toolbar-wrapper');
    if (wrapper) {
      wrapper.classList.toggle('cm-drawing-toolbar-wrapper--cols-2', this.columns === '2');
      wrapper.classList.toggle('cm-drawing-toolbar-wrapper--cols-1', this.columns === '1');
    }

    if (this.paleta) {
      this.paleta.setAttribute('colunas', this.columns);
    }

    const toggleBtn = this.container?.querySelector('#cm-toolbar-col-toggle');
    if (toggleBtn) {
      toggleBtn.title = this.columns === '2' ? 'Alternar para 1 coluna esguia' : 'Alternar para 2 colunas compactas';
      toggleBtn.innerHTML = this.columns === '2'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="8" height="18" x="8" y="3" rx="1"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="8" height="18" x="3" y="3" rx="1"/><rect width="8" height="18" x="13" y="3" rx="1"/></svg>';
    }
  }

  /**
   * Sincroniza o estado de snap magnético na interface
   * @param {boolean} enabled
   */
  setSnappingEnabled(enabled) {
    this.snappingEnabled = !!enabled;
    if (this.paleta && typeof this.paleta.atualizarItem === 'function') {
      this.paleta.atualizarItem('snap', { ativo: this.snappingEnabled });
    }
  }

  /**
   * Atualiza a camada ativa de desenho na toolbar
   * @param {Object} layer
   */
  setActiveLayer(layer) {
    this.activeLayer = layer;
    if (!this.container) return;

    const pill = this.container.querySelector('#cm-active-layer-pill');
    if (pill && layer) {
      pill.title = `Camada ativa: "${layer.name}" (novos desenhos serão salvos nela)`;
      const dot = pill.querySelector('.cm-active-layer-dot');
      if (dot) dot.style.background = layer.color || '#00E08A';
      const name = pill.querySelector('.cm-active-layer-name');
      if (name) name.textContent = layer.name;
    }

    const defaultSq = this.container.querySelector('.cm-color-default-square--color');
    if (defaultSq && layer?.color) {
      defaultSq.style.background = layer.color;
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
   * Define cores de preenchimento e traço
   * @param {Object} colors
   * @param {string} [colors.fillColor]
   * @param {string} [colors.strokeColor]
   */
  setColors({ fillColor, strokeColor }) {
    if (fillColor) {
      this.fillColor = fillColor;
      const fillInner = this.container?.querySelector('.cm-color-fill-inner');
      if (fillInner) fillInner.style.backgroundColor = fillColor;
      const fillPicker = this.container?.querySelector('#cm-fill-picker');
      if (fillPicker) fillPicker.value = fillColor;
    }
    if (strokeColor) {
      this.strokeColor = strokeColor;
      const strokeInner = this.container?.querySelector('.cm-color-stroke-inner');
      if (strokeInner) strokeInner.style.borderColor = strokeColor;
      const strokePicker = this.container?.querySelector('#cm-stroke-picker');
      if (strokePicker) strokePicker.value = strokeColor;
    }
  }

  getColors() {
    return {
      fillColor: this.fillColor,
      strokeColor: this.strokeColor
    };
  }

  /**
   * Inverte as cores de preenchimento e traço (atalho X)
   */
  swapColors() {
    const temp = this.fillColor;
    this.setColors({
      fillColor: this.strokeColor,
      strokeColor: temp
    });
    this.onColorChange(this.getColors());
  }

  /**
   * Reseta as cores para os padrões da camada ativa (atalho D)
   */
  resetDefaultColors() {
    const layerColor = this.activeLayer?.color || '#00E08A';
    this.setColors({
      fillColor: layerColor,
      strokeColor: '#ffffff'
    });
    this.onColorChange(this.getColors());
  }

  /**
   * Vincula eventos da paleta e botões
   */
  bindEvents() {
    if (!this.paleta) return;

    // Alternador de colunas 1 / 2
    const toggleBtn = this.container.querySelector('#cm-toolbar-col-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.setColumns(this.columns === '2' ? '1' : '2');
      });
    }

    // Ferramentas exclusivas
    this.paleta.addEventListener('ui-change', (e) => {
      const tool = e.detail?.valor;
      if (tool && tool !== this.activeTool) {
        this.activeTool = tool;
        this.onToolChange(tool);
      }
    });

    // Ações pontuais e toggles
    this.paleta.addEventListener('ui-ferramenta', (e) => {
      const id = e.detail?.id;
      const tipo = e.detail?.item?.tipo;
      if (tipo === 'botao') {
        this.onAction(id);
      } else if (tipo === 'toggle' && id === 'snap') {
        this.onAction('snap');
      }
    });
  }

  /**
   * Vincula eventos do seletor de cores estilo Illustrator
   */
  bindColorEvents() {
    const fillBlock = this.container.querySelector('#cm-fill-block');
    const strokeBlock = this.container.querySelector('#cm-stroke-block');
    const fillPicker = this.container.querySelector('#cm-fill-picker');
    const strokePicker = this.container.querySelector('#cm-stroke-picker');
    const swapBtn = this.container.querySelector('#cm-color-swap');
    const defaultBtn = this.container.querySelector('#cm-color-default');

    if (fillBlock && fillPicker) {
      fillBlock.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activeColorTarget = 'fill';
        fillBlock.classList.add('cm-color-block--active');
        strokeBlock?.classList.remove('cm-color-block--active');
        fillPicker.click();
      });
      fillPicker.addEventListener('input', (e) => {
        this.setColors({ fillColor: e.target.value });
        this.onColorChange(this.getColors());
      });
    }

    if (strokeBlock && strokePicker) {
      strokeBlock.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activeColorTarget = 'stroke';
        strokeBlock.classList.add('cm-color-block--active');
        fillBlock?.classList.remove('cm-color-block--active');
        strokePicker.click();
      });
      strokePicker.addEventListener('input', (e) => {
        this.setColors({ strokeColor: e.target.value });
        this.onColorChange(this.getColors());
      });
    }

    if (swapBtn) {
      swapBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.swapColors();
      });
    }

    if (defaultBtn) {
      defaultBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.resetDefaultColors();
      });
    }
  }

  /**
   * Vincula eventos do seletor rápido de camada ativa
   */
  bindLayerEvents() {
    const pill = this.container.querySelector('#cm-active-layer-pill');
    const menu = this.container.querySelector('#cm-layer-dropdown-menu');

    if (pill && menu) {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleLayerMenu();
      });
    }

    document.addEventListener('click', this._handleDocClick);
  }

  _handleDocClick(e) {
    if (this.isLayerMenuOpen && !e.composedPath().includes(this.container)) {
      this.closeLayerMenu();
    }
  }

  toggleLayerMenu() {
    if (this.isLayerMenuOpen) {
      this.closeLayerMenu();
    } else {
      this.openLayerMenu();
    }
  }

  openLayerMenu() {
    const menu = this.container?.querySelector('#cm-layer-dropdown-menu');
    const list = this.container?.querySelector('#cm-layer-dropdown-list');
    if (!menu || !list) return;

    const layers = this.getLayers();
    list.innerHTML = layers.map(layer => {
      const isSelected = layer.id === this.activeLayer?.id;
      return `
        <div class="cm-layer-dropdown-item ${isSelected ? 'cm-layer-dropdown-item--active' : ''}" data-layer-id="${layer.id}">
          <span class="cm-layer-dropdown-dot" style="background: ${layer.color || '#00E08A'};"></span>
          <span class="cm-layer-dropdown-name">${layer.name}</span>
          ${isSelected ? '<svg class="cm-layer-dropdown-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </div>
      `;
    }).join('');

    list.querySelectorAll('.cm-layer-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const layerId = item.dataset.layerId;
        const selected = layers.find(l => l.id === layerId);
        if (selected) {
          this.setActiveLayer(selected);
          this.onSelectLayer(layerId);
        }
        this.closeLayerMenu();
      });
    });

    menu.style.display = 'flex';
    this.isLayerMenuOpen = true;
  }

  closeLayerMenu() {
    const menu = this.container?.querySelector('#cm-layer-dropdown-menu');
    if (menu) {
      menu.style.display = 'none';
    }
    this.isLayerMenuOpen = false;
  }

  triggerTool(tool) {
    this.setActiveTool(tool);
    this.onToolChange(tool);
  }

  destroy() {
    document.removeEventListener('click', this._handleDocClick);
  }
}
