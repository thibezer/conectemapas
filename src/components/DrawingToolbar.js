/* ==========================================================================
   ConecteMapas - DrawingToolbar Component (SRP Module)
   Barra lateral flutuante híbrida CAD/GIS:
   - Modo híbrido com alternador dinâmico de 1 ou 2 colunas (com persistência)
   - Ferramentas completas de seleção, vetor, conta-gotas, formas e divisão (faca)
   - Toggle de Snap Magnético sincronizado com luz indicadora
   - Ações rápidas de Undo/Redo, Enquadrar, GPS, Limpar e Excluir
   - Par de cores Fill / Stroke (<ui-controle-cores> do kit), aplicado à seleção e aos novos desenhos
   - Seletor rápido de camada ativa integrado com popover
   ========================================================================== */

if (typeof window !== 'undefined' && !globalThis.process?.versions?.node) {
  import('./DrawingToolbar.css');
}

import '@thibezer/ui-components-kit/cores';

const DEFAULT_FILL = '#00E08A';
const DEFAULT_STROKE = '#ffffff';
// O app fala fill/stroke; o <ui-controle-cores> do kit fala preenchimento/traco
const TO_KIT_TARGET = { fill: 'preenchimento', stroke: 'traco' };
const FROM_KIT_TARGET = { preenchimento: 'fill', traco: 'stroke' };
const FROM_KIT_PROP = { preenchimento: 'fillColor', traco: 'strokeColor', opacidade: 'fillOpacity', espessuraTraco: 'strokeWidth' };

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
    this.autoZoomEnabled = options.autoZoomEnabled !== undefined ? options.autoZoomEnabled : true;
    this.columns = localStorage.getItem('cm_toolbar_cols') || '2';
    this.fillColor = options.initialFillColor || '#00E08A';
    this.strokeColor = options.initialStrokeColor || '#ffffff';
    this.fillOpacity = options.initialFillOpacity !== undefined ? options.initialFillOpacity : 0.35;
    this.strokeWidth = options.initialStrokeWidth !== undefined ? Number(options.initialStrokeWidth) : 2.5;
    this.activeColorTarget = 'fill'; // 'fill' ou 'stroke'
    this.isMixedFill = false;
    this.isMixedStroke = false;
    this.activeLayer = options.initialLayer || null;

    this.getLayers = options.getLayers || (() => []);
    this.onToolChange = options.onToolChange || (() => {});
    this.onAction = options.onAction || (() => {});
    this.onColorChange = options.onColorChange || (() => {});
    this.onSelectLayer = options.onSelectLayer || (() => {});

    this.container = null;
    this.paleta = null;
    this.colorControl = null; // <ui-controle-cores>, depois do render
    this.isLayerMenuOpen = false;

    this._handleDocClick = this._handleDocClick.bind(this);
    this._handleDocKeydown = this._handleDocKeydown.bind(this);
    this._handleWindowResize = this._handleWindowResize.bind(this);
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
        rotulo: 'Desenhar Polígono / Área Livre',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 8.5v7L12 22l10-6.5v-7L12 2z"/></svg>',
        atalho: 'A',
        tipo: 'ferramenta'
      },
      {
        id: 'formas',
        rotulo: 'Formas Geométricas',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="14" x="3" y="5" rx="2"/></svg>',
        tipo: 'ferramenta',
        filhos: [
          {
            id: 'rectangle',
            rotulo: 'Retângulo / Caixa',
            icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="14" x="3" y="5" rx="2"/></svg>',
            atalho: 'R',
            tipo: 'ferramenta'
          },
          {
            id: 'circle',
            rotulo: 'Círculo / Buffer Circular',
            icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/></svg>',
            atalho: 'C',
            tipo: 'ferramenta'
          },
          {
            id: 'ellipse',
            rotulo: 'Elipse Geodésica',
            icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="10" ry="6"/></svg>',
            atalho: 'E',
            tipo: 'ferramenta'
          },
          {
            id: 'regular-polygon',
            rotulo: 'Polígono Regular (Hexágono)',
            icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 21 7 21 17 12 22 3 17 3 7"/></svg>',
            atalho: 'H',
            tipo: 'ferramenta'
          },
          {
            id: 'star',
            rotulo: 'Estrela (5 Pontas)',
            icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
            atalho: 'B',
            tipo: 'ferramenta'
          }
        ]
      },
      {
        id: 'line',
        rotulo: 'Desenhar Linha / Rota',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 19 14-14"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/></svg>',
        atalho: 'L',
        tipo: 'ferramenta'
      },
      {
        id: 'pen',
        rotulo: 'Caneta: retas e curvas [N] (clique = reta, arraste = curva, 1º ponto fecha)',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17C5 10 10 5 17 5"/><rect x="2.5" y="16.5" width="5" height="5" rx="1"/><rect x="16.5" y="2.5" width="5" height="5" rx="1"/></svg>',
        atalho: 'N',
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
        id: 'unir',
        rotulo: 'Unir Formas',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/><path d="M9 6a6 6 0 0 1 0 12"/><path d="M15 6a6 6 0 0 0 0 12"/></svg>',
        tipo: 'botao',
        filhos: [
          {
            id: 'join',
            rotulo: 'Unir Conectadas [J] (só junta o que já se toca; 2 ou mais)',
            icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/><path d="M9 6a6 6 0 0 1 0 12"/><path d="M15 6a6 6 0 0 0 0 12"/></svg>',
            tipo: 'botao'
          },
          {
            id: 'join-bridge',
            rotulo: 'Unir com Ponte [Shift+J] (liga também o que não se toca; 2 ou mais)',
            icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8" width="6" height="8" rx="1.5"/><rect x="16" y="8" width="6" height="8" rx="1.5"/><path d="M8 12h8" stroke-dasharray="2 2.5"/></svg>',
            tipo: 'botao'
          }
        ]
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
        id: 'auto-zoom',
        rotulo: 'Zoom Automático (desligado: o mapa só enquadra pelos botões de enquadrar)',
        icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>',
        tipo: 'toggle',
        ativo: this.autoZoomEnabled
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

      // --- GRUPO 5: NAVEGAÇÃO & UTILITÁRIOS ---
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

        <!-- Par de cores de desenho (preenchimento/traço) do kit: <ui-controle-cores> -->
        <div class="cm-color-controller" id="cm-color-controller">
          <ui-controle-cores
            id="cm-controle-cores"
            preenchimento="${this._esc(this.fillColor)}"
            traco="${this._esc(this.strokeColor)}"
            opacidade="${this.fillOpacity}"
            espessura-traco="${this.strokeWidth}"
            alvo="${this.activeColorTarget === 'stroke' ? 'traco' : 'preenchimento'}"
            padrao-preenchimento="${this._esc(this.activeLayer?.color || DEFAULT_FILL)}"
            padrao-traco="${DEFAULT_STROKE}"
            titulo-seletor="Cores & Estilo CAD">
          </ui-controle-cores>
        </div>

        <!-- Seletor Rápido de Camada Ativa Integrado -->
        <div class="cm-active-layer-pill" id="cm-active-layer-pill" title="Camada ativa: &quot;${this._esc(this.activeLayer?.name || 'Padrão')}&quot; (clique para alternar)" role="button" tabindex="0" aria-haspopup="listbox" aria-expanded="false">
          <div class="cm-active-layer-dot" style="background: ${this.activeLayer?.color || '#00E08A'};"></div>
          <span class="cm-active-layer-name">${this._esc(this.activeLayer?.name || 'Padrão')}</span>
          <svg class="cm-active-layer-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>

        <!-- Popover Flutuante com Menu de Camadas -->
        <div class="cm-layer-dropdown-menu" id="cm-layer-dropdown-menu" style="display: none;" role="listbox" aria-label="Camada ativa de desenho">
          <div class="cm-layer-dropdown-title">
            <span>Camada Ativa de Desenho</span>
            <span class="cm-layer-dropdown-badge" id="cm-layer-dropdown-badge">0</span>
          </div>
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
   * Sincroniza o estado do zoom automático na interface
   * @param {boolean} enabled
   */
  setAutoZoomEnabled(enabled) {
    this.autoZoomEnabled = !!enabled;
    if (this.paleta && typeof this.paleta.atualizarItem === 'function') {
      this.paleta.atualizarItem('auto-zoom', { ativo: this.autoZoomEnabled });
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

    // "Restaurar padrão" do controle de cores usa a cor da camada ativa
    if (layer?.color) this.colorControl?.setAttribute('padrao-preenchimento', layer.color);
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
   * Escapa texto para uso seguro em innerHTML
   * @param {string} text
   * @returns {string}
   */
  _esc(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /**
   * Normaliza uma cor para #rrggbb (mantém a caixa recebida) ou 'none'.
   * Aceita #rgb, #rrggbb, 'none' e 'transparent'; devolve null para qualquer outro formato.
   * @param {string} color
   * @returns {string|null}
   */
  _normalizeHex(color) {
    if (typeof color !== 'string') return null;
    const c = color.trim();
    const lower = c.toLowerCase();
    if (lower === 'none' || lower === 'transparent') return 'none';
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
    return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : null;
  }

  /**
   * Define cores de preenchimento e traço (apenas visual/estado; não dispara onColorChange).
   * Suporta hexadecimais e 'none' (transparente).
   * @param {Object} colors
   * @param {string} [colors.fillColor]
   * @param {string} [colors.strokeColor]
   */
  setColors({ fillColor, strokeColor, fillOpacity, strokeWidth } = {}) {
    const fill = this._normalizeHex(fillColor);
    const stroke = this._normalizeHex(strokeColor);
    if (fill) {
      this.fillColor = fill;
      this.isMixedFill = false;
    }
    if (stroke) {
      this.strokeColor = stroke;
      this.isMixedStroke = false;
    }
    if (fillOpacity !== undefined) {
      this.fillOpacity = Math.max(0, Math.min(1, Number(fillOpacity)));
    }
    if (strokeWidth !== undefined) {
      this.strokeWidth = Math.max(0.5, Math.min(50, Number(strokeWidth)));
    }
    const payload = {};
    if (fill) payload.preenchimento = fill;
    if (stroke) payload.traco = stroke;
    if (fillOpacity !== undefined) payload.opacidade = Number(fillOpacity);
    if (strokeWidth !== undefined) payload.espessuraTraco = Number(strokeWidth);
    this.colorControl?.definirCores(payload);
  }

  getColors() {
    return {
      fillColor: this.fillColor,
      strokeColor: this.strokeColor
    };
  }

  /**
   * Marca visualmente o alvo ativo (fill/stroke)
   * @param {'fill'|'stroke'} target
   */
  setActiveColorTarget(target) {
    this.activeColorTarget = target === 'stroke' ? 'stroke' : 'fill';
    this.colorControl?.definirAlvo(TO_KIT_TARGET[this.activeColorTarget]);
  }

  /**
   * Alterna o alvo ativo entre preenchimento e traço (atalho X clássico do Illustrator)
   */
  toggleActiveColorTarget() {
    this.setActiveColorTarget(this.activeColorTarget === 'stroke' ? 'fill' : 'stroke');
  }

  /**
   * Define visualmente o estado misto (?) para seleções com cores heterogêneas
   */
  setMixedState({ fill = false, stroke = false } = {}) {
    this.isMixedFill = !!fill;
    this.isMixedStroke = !!stroke;
    this.colorControl?.definirMisto({ preenchimento: this.isMixedFill, traco: this.isMixedStroke });
  }

  /**
   * Abre o seletor de cor do kit ancorado na amostra de Preenchimento ou Traço
   * @param {'fill'|'stroke'} [target]
   */
  openColorPicker(target = this.activeColorTarget) {
    this.setActiveColorTarget(target);
    if (!this.colorControl) return;
    this._refreshProjectColors();
    this.colorControl.abrirSeletor(TO_KIT_TARGET[this.activeColorTarget]);
  }

  /**
   * Indica que a seleção atual só usa traço (linhas), esmaecendo o preenchimento
   * @param {boolean} strokeOnly
   */
  setStrokeOnly(strokeOnly) {
    this.colorControl?.toggleAttribute('so-traco', !!strokeOnly);
  }

  /**
   * Inverte as cores de preenchimento e traço (atalho Shift+X)
   */
  swapColors() {
    const temp = this.fillColor;
    this.setColors({
      fillColor: this.strokeColor,
      strokeColor: temp
    });
    this.onColorChange(this.getColors(), { commit: true, changed: ['fillColor', 'strokeColor'] });
  }

  /**
   * Reseta as cores para os padrões da camada ativa (atalho D)
   */
  resetDefaultColors() {
    const layerColor = this.activeLayer?.color || DEFAULT_FILL;
    this.setColors({
      fillColor: layerColor,
      strokeColor: DEFAULT_STROKE
    });
    this.onColorChange(this.getColors(), { commit: true, changed: ['fillColor', 'strokeColor'] });
  }

  /**
   * Define o alvo ativo (Preenchimento ou Traço) como sem cor / transparente (atalho /)
   */
  setNoneColor() {
    const prop = this.activeColorTarget === 'stroke' ? 'strokeColor' : 'fillColor';
    this.setColors({ [prop]: 'none' });
    this.onColorChange(this.getColors(), { commit: true, changed: [prop] });
  }

  /** As cores das camadas aparecem como "Cores do projeto" no seletor */
  _refreshProjectColors() {
    if (!this.colorControl) return;
    const layers = typeof this.getLayers === 'function' ? this.getLayers() : [];
    this.colorControl.coresProjeto = (layers || []).map(l => l?.color).filter(Boolean);
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
        if (e.detail?.pai?.id === 'unir' && this.paleta.visiveis?.set) {
          this.paleta.visiveis.set('unir', id);
          this.paleta.renderizar?.();
        }
        this.onAction(id);
      } else if (tipo === 'toggle' && (id === 'snap' || id === 'auto-zoom')) {
        this.onAction(id);
      }
    });
  }

  /**
   * Liga o <ui-controle-cores> ao estado da barra.
   * Botões do controle (inverter, sem cor, padrão) seguem o mesmo contrato dos atalhos;
   * o seletor de cor pré-visualiza com commit: false e grava com commit: true.
   */
  bindColorEvents() {
    const control = this.container?.querySelector('#cm-controle-cores');
    this.colorControl = control || null;
    if (!control) return;

    control.atalhos = { alternar: 'X', inverter: 'Shift+X', semCor: '/', padrao: 'D' };
    this._refreshProjectColors();
    // Antes do clique que pode abrir o seletor, atualiza as cores das camadas
    control.addEventListener('pointerdown', () => this._refreshProjectColors(), true);
    control.addEventListener('keydown', () => this._refreshProjectColors(), true);

    control.addEventListener('ui-alvo-change', (e) => {
      this.activeColorTarget = FROM_KIT_TARGET[e.detail?.alvo] || 'fill';
    });

    control.addEventListener('ui-cores-change', (e) => {
      const d = e.detail || {};
      this.fillColor = d.preenchimento;
      this.strokeColor = d.traco;
      if (typeof d.opacidade === 'number') this.fillOpacity = d.opacidade;
      if (typeof d.espessuraTraco === 'number') this.strokeWidth = d.espessuraTraco;
      if (d.alvo) this.activeColorTarget = FROM_KIT_TARGET[d.alvo] || this.activeColorTarget;
      if (d.alterados?.includes('preenchimento')) this.isMixedFill = false;
      if (d.alterados?.includes('traco')) this.isMixedStroke = false;

      // Só o que mudou (na confirmação do seletor, desde que ele abriu): numa seleção com
      // cores diferentes, as propriedades não tocadas continuam diferentes
      const changed = (d.alterados || []).map(k => FROM_KIT_PROP[k]).filter(Boolean);
      if (d.origem === 'seletor') {
        this.onColorChange(
          { ...this.getColors(), fillOpacity: this.fillOpacity },
          { commit: d.confirmado === true, changed }
        );
      } else {
        this.onColorChange(this.getColors(), { commit: true, changed });
      }
    });
  }

  /**
   * Vincula eventos do seletor rápido de camada ativa
   */
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
      pill.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.toggleLayerMenu();
        }
      });
    }

    document.removeEventListener('pointerdown', this._handleDocClick, true);
    document.removeEventListener('keydown', this._handleDocKeydown, true);
    window.removeEventListener('resize', this._handleWindowResize);

    document.addEventListener('pointerdown', this._handleDocClick, true);
    document.addEventListener('keydown', this._handleDocKeydown, true);
    window.addEventListener('resize', this._handleWindowResize);
  }

  _handleDocClick(e) {
    if (!this.isLayerMenuOpen) return;
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    const menu = this.container?.querySelector('#cm-layer-dropdown-menu');
    const pill = this.container?.querySelector('#cm-active-layer-pill');
    if (menu && !path.includes(menu) && pill && !path.includes(pill)) {
      this.closeLayerMenu();
    }
  }

  _handleDocKeydown(e) {
    if (e.key === 'Escape' && this.isLayerMenuOpen) {
      e.preventDefault();
      e.stopPropagation();
      this.closeLayerMenu();
      this.container?.querySelector('#cm-active-layer-pill')?.focus();
    }
  }

  _handleWindowResize() {
    if (this.isLayerMenuOpen) {
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
    const badge = this.container?.querySelector('#cm-layer-dropdown-badge');
    const wrapper = this.container?.querySelector('.cm-drawing-toolbar-wrapper');
    const pill = this.container?.querySelector('#cm-active-layer-pill');
    if (!menu || !list || !pill) return;

    const layers = typeof this.getLayers === 'function' ? this.getLayers() : [];
    if (badge) badge.textContent = String(layers.length);

    if (layers.length === 0) {
      list.innerHTML = `<div class="cm-layer-dropdown-empty">Nenhuma camada cadastrada</div>`;
    } else {
      list.innerHTML = layers.map(layer => {
        const isSelected = layer.id === this.activeLayer?.id;
        return `
          <div class="cm-layer-dropdown-item ${isSelected ? 'cm-layer-dropdown-item--active' : ''}" 
               data-layer-id="${this._esc(layer.id)}" 
               title="${this._esc(layer.name)}" 
               role="option" 
               aria-selected="${isSelected}">
            <span class="cm-layer-dropdown-dot" style="background: ${layer.color || '#00E08A'};"></span>
            <span class="cm-layer-dropdown-name">${this._esc(layer.name)}</span>
            ${isSelected ? '<svg class="cm-layer-dropdown-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </div>
        `;
      }).join('');
    }

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

    // Eleva o z-index do wrapper acima da tabela de atributos (600) e painéis flutuantes
    wrapper?.classList.add('cm-toolbar--menu-open');
    pill.setAttribute('aria-expanded', 'true');

    // Abre e mede para calcular o posicionamento livre de cortes
    menu.style.display = 'flex';
    menu.style.top = '0px';

    // Determina o limite inferior seguro (evita sobrepor a barra da tabela de atributos)
    const tableEl = document.getElementById('cm-bottom-table-wrapper');
    let bottomBound = window.innerHeight - 10;
    if (tableEl) {
      const tableRect = tableEl.getBoundingClientRect();
      if (tableRect.top > 60 && tableRect.top < window.innerHeight) {
        bottomBound = Math.min(bottomBound, tableRect.top - 8);
      }
    }

    const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : { top: 10 };
    const pillOffset = pill.offsetTop;

    // Altura máxima da lista para caber com folga no espaço livre da tela
    const maxViewportHeight = Math.max(160, bottomBound - 20);
    const headerHeight = 36;
    const maxListHeight = Math.max(120, Math.min(360, maxViewportHeight - headerHeight));
    list.style.maxHeight = `${maxListHeight}px`;

    const finalMenuHeight = menu.offsetHeight;

    // Posição top inicial alinhada ao botão da pílula
    let topPos = pillOffset;

    // Se ultrapassar o limite inferior (tabela de atributos ou rodapé da tela), desloca para cima
    const menuBottom = wrapperRect.top + topPos + finalMenuHeight;
    if (menuBottom > bottomBound) {
      topPos = topPos - (menuBottom - bottomBound);
    }

    // Se subir demais além do topo do wrapper, impede sair pelo topo da tela
    const minTopPos = 10 - wrapperRect.top;
    if (topPos < minTopPos) {
      topPos = minTopPos;
    }

    menu.style.top = `${Math.round(topPos)}px`;
    this.isLayerMenuOpen = true;

    // Se houver item ativo, garante que ele está visível no scroll interno
    const activeItem = list.querySelector('.cm-layer-dropdown-item--active');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }

  closeLayerMenu() {
    const menu = this.container?.querySelector('#cm-layer-dropdown-menu');
    const wrapper = this.container?.querySelector('.cm-drawing-toolbar-wrapper');
    const pill = this.container?.querySelector('#cm-active-layer-pill');
    if (menu) {
      menu.style.display = 'none';
    }
    wrapper?.classList.remove('cm-toolbar--menu-open');
    pill?.setAttribute('aria-expanded', 'false');
    this.isLayerMenuOpen = false;
  }

  triggerTool(tool) {
    this.setActiveTool(tool);
    this.onToolChange(tool);
  }

  destroy() {
    document.removeEventListener('pointerdown', this._handleDocClick, true);
    document.removeEventListener('keydown', this._handleDocKeydown, true);
    window.removeEventListener('resize', this._handleWindowResize);
  }
}
