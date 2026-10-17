/* ==========================================================================
   ConecteMapas - HeaderBar Component (SRP Module)
   Responsabilidade Única: Gerenciamento da barra superior, branding,
   edição de título do projeto, presença de operadores e ações rápidas.
   ========================================================================== */

import '@thibezer/ui-components-kit/tools';
import './HeaderBar.css';

const svg = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const ICONES = {
  projeto: svg('<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><line x1="12" y1="10" x2="12" y2="16"/><line x1="9" y1="13" x2="15" y2="13"/>'),
  salvar: svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'),
  popup: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  buscar: svg('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/>'),
  layout: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>'),
  importExport: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  conta: svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  compartilhar: svg('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>')
};

export class HeaderBar {
  /**
   * @param {Object} options
   * @param {string} options.projectName - Nome inicial do projeto
   * @param {Array} options.collaborators - Lista de operadores ativos
   * @param {Function} options.onProjectNameChange - Callback ao renomear o projeto
   * @param {Function} options.onSaveProject - Callback ao salvar projeto
   * @param {Function} options.onOpenPrintComposer - Callback para abrir compositor de impressão
   * @param {Function} options.onOpenAdvancedSearch - Callback para abrir busca avançada
   * @param {Function} options.onToggleFeaturePopup - Callback para alternar balões de popup
   * @param {Function} options.onOpenAccount - Callback para abrir modal de conta
   * @param {Function} options.onOpenProject - Callback para abrir o modal de projeto (novo / excluir)
   * @param {string} options.accountName - Nome do operador logado
   */
  constructor(options = {}) {
    this.projectName = options.projectName || 'Levantamento Planialtimétrico';
    this.collaborators = options.collaborators || [];
    this.onProjectNameChange = options.onProjectNameChange || (() => {});
    this.onSaveProject = options.onSaveProject || (() => {});
    this.onOpenPrintComposer = options.onOpenPrintComposer || (() => {});
    this.onOpenAdvancedSearch = options.onOpenAdvancedSearch || (() => {});
    this.onToggleFeaturePopup = options.onToggleFeaturePopup || (() => {});
    this.onOpenAccount = options.onOpenAccount || (() => {});
    this.onOpenProject = options.onOpenProject || (() => {});
    this.accountName = options.accountName || '';
    this.container = null;
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return str == null ? '' : String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Renderiza o componente HeaderBar no container fornecido
   * @param {HTMLElement} container
   */
  render(container) {
    this.container = container;
    const safeProjectName = this.escapeHtml(this.projectName);
    const safeAccountName = this.escapeHtml(this.accountName || 'Entrar');

    this.container.innerHTML = `
      <header class="cm-header" role="banner">
        <!-- Esquerda: Logo, Nome do Projeto e Status -->
        <div class="cm-header-left">
          <a href="#" class="cm-logo" id="cm-brand-link" title="ConecteMapas - Pressione ? para atalhos">
            <svg viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#141417"/>
              <path d="M16 4C10.477 4 6 8.477 6 14C6 21 16 28 16 28C16 28 26 21 26 14C26 8.477 21.523 4 16 4Z" fill="#00E08A" fill-opacity="0.25" stroke="#00E08A" stroke-width="2"/>
              <circle cx="16" cy="14" r="4" fill="#00E08A"/>
              <path d="M7 26L12 23L20 26L25 23" stroke="#00E08A" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 2"/>
            </svg>
            <span>ConecteMapas</span>
          </a>

          <input
            type="text"
            class="cm-project-title-input"
            id="cm-project-name-input"
            value="${safeProjectName}"
            placeholder="Nome do Projeto..."
            title="Clique para editar o nome do projeto (Enter para salvar)"
            aria-label="Nome do projeto"
            spellcheck="false"
            autocomplete="off"
          />

          <ui-chip id="cm-sync-chip" variante="sucesso" class="cm-sync-badge" title="Conexão com Banco de Dados">
            ● Conectado
          </ui-chip>
        </div>

        <!-- Centro: Operadores Colaborativos Ativos -->
        <div class="cm-header-center">
          <div class="cm-collaborators-list" id="cm-collaborators-avatars" role="list" aria-label="Operadores conectados">
            ${this.renderCollaboratorsAvatars()}
          </div>
        </div>

      </header>
      <ui-ribbon id="cm-ribbon" compacto aria-label="Barra de ferramentas do projeto" rotulo-abas="Abas do ribbon"></ui-ribbon>
    `;

    this.setupRibbon();
    this.bindEvents();
    this.observeHeight();
  }

  /**
   * Renderiza os avatares dos operadores conectados na sala
   * @returns {string}
   */
  renderCollaboratorsAvatars() {
    const list = this.collaborators || [];
    if (list.length === 0) return '';

    const MAX_VISIVEIS = 4;
    const visiveis = list.slice(0, MAX_VISIVEIS);
    const extras = list.slice(MAX_VISIVEIS);

    const chip = (c, index) => {
      const nome = String(c.name || 'Operador');
      const eu = index === 0;
      const cor = /^#[0-9a-f]{3,8}$/i.test(c.color || '') ? c.color : '#00E08A';
      const inicial = this.escapeHtml((nome.trim()[0] || '?').toUpperCase());
      const papel = this.escapeHtml(c.role || 'Operador');
      const status = c.status === 'ocupado' || c.status === 'busy' ? 'Ocupado' : 'Online';
      const safeNome = this.escapeHtml(nome);
      return `
        <span class="cm-collab${eu ? ' cm-collab-me' : ''}" style="--cm-collab-color: ${cor}" title="${safeNome} · ${papel} · ${status}">
          <span class="cm-collab-avatar" aria-hidden="true">${inicial}</span>
          <span class="cm-collab-name">${safeNome}</span>
        </span>`;
    };

    const resumo = extras.length
      ? `<span class="cm-collab cm-collab-more" title="${this.escapeHtml(extras.map(c => c.name || 'Operador').join(', '))}">+${extras.length}</span>`
      : '';
    return visiveis.map(chip).join('') + resumo;
  }

  /**
   * Atualiza dinamicamente a lista de colaboradores
   * @param {Array} collaborators
   */
  updateCollaborators(collaborators) {
    this.collaborators = collaborators || [];
    const avatarsContainer = document.getElementById('cm-collaborators-avatars');
    if (avatarsContainer) {
      avatarsContainer.innerHTML = this.renderCollaboratorsAvatars();
    }
  }

  /**
   * Mostra o nome da conta logada no botão (ou "Entrar")
   * @param {string} name
   */
  updateAccount(name) {
    this.accountName = name || '';
    this.ribbon?.atualizarItem?.('btn-open-account', { rotulo: this.accountName || 'Entrar' });
  }

  /**
   * Atualiza o estado de sincronização
   * @param {'sucesso'|'alerta'|'erro'|'informativo'} variante
   * @param {string} texto
   */
  updateSyncStatus(variante = 'sucesso', texto = '● Conectado') {
    const chip = document.getElementById('cm-sync-chip');
    if (chip) {
      if (chip.getAttribute('variante') !== variante) {
        chip.setAttribute('variante', variante);
      }
      if (chip.textContent !== texto) {
        chip.textContent = texto;
      }
    }
  }

  /**
   * Vincula eventos e interações do HeaderBar
   */
  bindEvents() {
    if (!this.container) return;

    // Edição do Nome do Projeto
    const input = this.container.querySelector('#cm-project-name-input');
    if (input) {
      input.addEventListener('change', (e) => {
        const val = e.target.value.trim();
        if (val) {
          this.projectName = val;
          this.onProjectNameChange(this.projectName);
        } else {
          input.value = this.projectName;
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          input.blur();
        }
      });
    }

    // Clique na Logo -> Abre modal de atalhos
    const brandLink = this.container.querySelector('#cm-brand-link');
    if (brandLink) {
      brandLink.addEventListener('click', (e) => {
        e.preventDefault();
        const shortcutsModal = document.getElementById('modal-shortcuts');
        if (shortcutsModal) {
          if (typeof shortcutsModal.abrir === 'function') shortcutsModal.abrir();
          else shortcutsModal.setAttribute('aberto', '');
        }
      });
    }

    this.bindRibbon();
  }

  /**
   * Monta as abas do ribbon (Projeto / Dados) com as ações antes espalhadas no cabeçalho
   */
  setupRibbon() {
    this.ribbon = this.container.querySelector('#cm-ribbon');
    if (!this.ribbon) return;
    this.ribbon.abas = [
      {
        id: 'projeto',
        rotulo: 'Projeto',
        grupos: [
          {
            id: 'grp-projeto',
            rotulo: 'Projeto',
            itens: [
              { id: 'btn-open-project', rotulo: 'Projeto', icone: ICONES.projeto, tamanho: 'grande', rotuloAcessivel: 'Novo projeto ou excluir o projeto aberto' },
              { id: 'btn-manual-save', rotulo: 'Salvar', icone: ICONES.salvar, tamanho: 'grande', atalho: 'Ctrl+S' }
            ]
          },
          {
            id: 'grp-mapa',
            rotulo: 'Mapa',
            itens: [
              { id: 'btn-open-adv-search', rotulo: 'Buscar', icone: ICONES.buscar, tamanho: 'grande', atalho: 'Ctrl+Shift+F' },
              { id: 'btn-toggle-popup', rotulo: 'Popup: Off', icone: ICONES.popup, tamanho: 'grande', tipo: 'toggle', ativo: false }
            ]
          },
          {
            id: 'grp-conta',
            rotulo: 'Conta',
            itens: [
              { id: 'btn-open-account', rotulo: this.accountName || 'Entrar', icone: ICONES.conta, tamanho: 'grande' }
            ]
          }
        ]
      },
      {
        id: 'dados',
        rotulo: 'Dados',
        grupos: [
          {
            id: 'grp-dados',
            rotulo: 'Dados',
            itens: [
              { id: 'btn-open-import-export', rotulo: 'Import / Export', icone: ICONES.importExport, tamanho: 'grande' }
            ]
          },
          {
            id: 'grp-saida',
            rotulo: 'Saída',
            itens: [
              { id: 'btn-open-print-composer', rotulo: 'Layout QGIS', icone: ICONES.layout, tamanho: 'grande' }
            ]
          },
          {
            id: 'grp-colab',
            rotulo: 'Colaboração',
            itens: [
              { id: 'btn-open-share', rotulo: 'Compartilhar', icone: ICONES.compartilhar, tamanho: 'grande' }
            ]
          }
        ]
      }
    ];
    this.ribbon.abaAtiva = 'projeto';
  }

  /**
   * Mantém --cm-header-height igual à altura real (título + ribbon), pois o
   * workspace e os painéis flutuantes calculam a altura a partir dela.
   */
  observeHeight() {
    this.resizeObserver?.disconnect();
    if (typeof ResizeObserver === 'undefined') return;
    const aplicar = () => {
      const h = Math.ceil(this.container.getBoundingClientRect().height);
      if (h > 0) document.documentElement.style.setProperty('--cm-header-height', h + 'px');
    };
    this.resizeObserver = new ResizeObserver(aplicar);
    this.resizeObserver.observe(this.container);
    aplicar();
  }

  /**
   * Roteia os cliques do ribbon para os callbacks do app
   */
  bindRibbon() {
    if (!this.ribbon) return;
    const abrirModal = (id) => {
      const modal = document.getElementById(id);
      if (!modal) return;
      if (typeof modal.abrir === 'function') modal.abrir();
      else modal.setAttribute('aberto', '');
    };
    const acoes = {
      'btn-open-project': () => this.onOpenProject(),
      'btn-manual-save': () => this.onSaveProject(),
      'btn-open-account': () => this.onOpenAccount(),
      'btn-open-adv-search': () => this.onOpenAdvancedSearch(),
      'btn-open-print-composer': () => this.onOpenPrintComposer(),
      'btn-toggle-popup': () => this.onToggleFeaturePopup(),
      'btn-open-import-export': () => abrirModal('modal-import-export'),
      'btn-open-share': () => abrirModal('modal-share')
    };
    this.ribbon.addEventListener('ui-ferramenta', (e) => {
      const id = e.detail?.id;
      const acao = acoes[id];
      if (!acao) return;
      // O estado do toggle de popup pertence ao app (updateFeaturePopupMode)
      if (id === 'btn-toggle-popup') e.preventDefault();
      acao();
    });
  }

  /**
   * Atualiza dinamicamente o estado visual do botão de exibição de popup
   * @param {boolean} isEnabled
   */
  updateFeaturePopupMode(isEnabled) {
    this.ribbon?.atualizarItem?.('btn-toggle-popup', {
      ativo: !!isEnabled,
      rotulo: isEnabled ? 'Popup: On' : 'Popup: Off'
    });
  }
}
