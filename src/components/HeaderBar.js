/* ==========================================================================
   ConecteMapas - HeaderBar Component (SRP Module)
   Responsabilidade Única: Gerenciamento completo da barra superior,
   branding, edição de título do projeto, presença de operadores e ações rápidas.
   ========================================================================== */

import './HeaderBar.css';

export class HeaderBar {
  /**
   * @param {Object} options
   * @param {string} options.projectName - Nome inicial do projeto
   * @param {Array} options.collaborators - Lista de operadores ativos
   * @param {Function} options.onProjectNameChange - Callback ao renomear o projeto
   */
  constructor(options = {}) {
    this.projectName = options.projectName || 'Levantamento Planialtimétrico';
    this.collaborators = options.collaborators || [];
    this.onProjectNameChange = options.onProjectNameChange || (() => {});
    this.onSaveProject = options.onSaveProject || (() => {});
    this.onOpenPrintComposer = options.onOpenPrintComposer || (() => {});
    this.onOpenAdvancedSearch = options.onOpenAdvancedSearch || (() => {});
    this.onToggleGeometryVersion = options.onToggleGeometryVersion || (() => {});
    this.onOpenAccount = options.onOpenAccount || (() => {});
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
    this.container.innerHTML = `
      <header class="cm-header" role="banner">
        <!-- Esquerda: Logo e Nome do Projeto -->
        <div class="cm-header-left">
          <a href="#" class="cm-logo" title="ConecteMapas GIS Platform">
            <svg viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#141417"/>
              <path d="M16 4C10.477 4 6 8.477 6 14C6 21 16 28 16 28C16 28 26 21 26 14C26 8.477 21.523 4 16 4Z" fill="#00E08A" fill-opacity="0.25" stroke="#00E08A" stroke-width="2"/>
              <circle cx="16" cy="14" r="4" fill="#00E08A"/>
              <path d="M7 26L12 23L20 26L25 23" stroke="#00E08A" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 2"/>
            </svg>
            <span>ConecteMapas</span>
          </a>

          <div class="cm-project-title-wrapper" title="Clique para editar o nome do projeto">
            <input 
              type="text" 
              class="cm-project-title-input" 
              id="cm-project-name-input" 
              value="${safeProjectName}" 
              placeholder="Nome do Projeto..." 
              spellcheck="false" 
              autocomplete="off"
            />
            <ui-chip id="cm-sync-chip" variante="sucesso" class="cm-sync-badge">
              ● Salvo no Banco Local
            </ui-chip>
          </div>
        </div>

        <!-- Centro: Operadores Colaborativos Ativos -->
        <div class="cm-header-center">
          <div class="cm-collaborators-list" id="cm-collaborators-avatars" title="Operadores conectados na sala">
            ${this.renderCollaboratorsAvatars()}
          </div>
        </div>

        <!-- Direita: Ações Principais -->
        <div class="cm-header-right">
          <ui-botao-primario 
            inline 
            id="btn-manual-save" 
            variante="primary" 
            title="Salvar Projeto no Banco de Dados Local (Ctrl+S)">
            <div class="cm-header-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              <span>Salvar</span>
            </div>
          </ui-botao-primario>

          <ui-botao-primario 
            inline 
            id="btn-toggle-geom-version" 
            variante="secundario" 
            title="Alternar Modo de Geometria: Oficial (Padrão) vs Prévias Solicitadas">
            <div class="cm-header-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                <polyline points="2 17 12 22 22 17"/>
                <polyline points="2 12 12 17 22 12"/>
              </svg>
              <span id="cm-geom-version-text">Geometria: Oficial</span>
            </div>
          </ui-botao-primario>

          <ui-botao-primario 
            inline 
            id="btn-open-adv-search" 
            variante="secundario" 
            title="Busca Avançada: filtrar, selecionar, mover de camada e aplicar cores (Ctrl+Shift+F)">
            <div class="cm-header-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="7"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
                <line x1="11" y1="8" x2="11" y2="14"/>
              </svg>
              <span>Buscar</span>
            </div>
          </ui-botao-primario>

          <ui-botao-primario 
            inline 
            id="btn-open-print-composer" 
            variante="secundario" 
            title="Abrir Compositor de Layout de Impressão (Estilo QGIS)">
            <div class="cm-header-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"/>
                <path d="M3 9h18"/>
                <path d="M9 21V9"/>
              </svg>
              <span>Layout QGIS</span>
            </div>
          </ui-botao-primario>

          <ui-botao-primario 
            inline 
            id="btn-open-templates" 
            variante="secundario" 
            target-modal="modal-templates" 
            title="Carregar Modelos Prontos de Mapa">
            <div class="cm-header-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
              </svg>
              <span>Modelos</span>
            </div>
          </ui-botao-primario>

          <ui-botao-primario 
            inline 
            id="btn-open-import-export" 
            variante="secundario" 
            target-modal="modal-import-export" 
            title="Importar ou Exportar dados GeoJSON / KML / CSV">
            <div class="cm-header-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Import / Export</span>
            </div>
          </ui-botao-primario>

          <ui-botao-primario 
            inline 
            id="btn-open-account" 
            variante="secundario" 
            title="Entrar ou gerenciar sua conta">
            <div class="cm-header-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span id="cm-account-label">${this.escapeHtml(this.accountName || 'Entrar')}</span>
            </div>
          </ui-botao-primario>

          <ui-botao-primario 
            inline 
            id="btn-open-share" 
            variante="secundario" 
            target-modal="modal-share" 
            title="Compartilhar sala de colaboração em tempo real">
            <div class="cm-header-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              <span>Compartilhar</span>
            </div>
          </ui-botao-primario>
        </div>
      </header>
    `;

    this.bindEvents();
  }

  /**
   * Renderiza os avatares dos operadores conectados
   * @returns {string}
   */
  renderCollaboratorsAvatars() {
    return this.collaborators.map(c => {
      const safeName = this.escapeHtml(c.name || 'Operador');
      const safeAvatar = this.escapeHtml(c.avatar || '');
      const safeRole = this.escapeHtml(c.role || 'Operador');
      const statusText = c.status === 'online' ? 'Online' : 'Ocupado';
      const safeStatus = this.escapeHtml(c.status || 'online');
      return `
      <ui-avatar 
        nome="${safeName}" 
        foto="${safeAvatar}" 
        status="${safeStatus}"
        title="${safeName} (${safeRole}) - ${statusText}"
        tamanho="sm">
      </ui-avatar>
    `;
    }).join('');
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
    const label = document.getElementById('cm-account-label');
    if (label) label.textContent = this.accountName || 'Entrar';
  }

  /**
   * Atualiza o estado de sincronização
   * @param {'sucesso'|'alerta'|'erro'} variante
   * @param {string} texto
   */
  updateSyncStatus(variante = 'sucesso', texto = '● Sincronizado') {
    const chip = document.getElementById('cm-sync-chip');
    if (chip) {
      chip.setAttribute('variante', variante);
      chip.textContent = texto;
    }
  }

  /**
   * Vincula eventos do HeaderBar
   */
  bindEvents() {
    if (!this.container) return;

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

      // Salva ao pressionar Enter
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          input.blur();
        }
      });
    }

    const btnSave = this.container.querySelector('#btn-manual-save');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        this.onSaveProject();
      });
    }

    const btnAccount = this.container.querySelector('#btn-open-account');
    if (btnAccount) {
      btnAccount.addEventListener('click', () => this.onOpenAccount());
    }

    this.container.querySelector('#btn-open-adv-search')?.addEventListener('click', () => this.onOpenAdvancedSearch());

    const btnComposer = this.container.querySelector('#btn-open-print-composer');
    if (btnComposer) {
      btnComposer.addEventListener('click', () => {
        this.onOpenPrintComposer();
      });
    }

    const btnGeomVersion = this.container.querySelector('#btn-toggle-geom-version');
    if (btnGeomVersion) {
      btnGeomVersion.addEventListener('click', () => {
        this.onToggleGeometryVersion();
      });
    }
  }

  /**
   * Atualiza dinamicamente o estado visual do botão de modo de geometria
   * @param {boolean} isShowingPreviews
   */
  updateGeometryVersionMode(isShowingPreviews) {
    const textEl = document.getElementById('cm-geom-version-text');
    const btn = document.getElementById('btn-toggle-geom-version');
    if (textEl) {
      textEl.textContent = isShowingPreviews ? 'Geometria: Prévia' : 'Geometria: Oficial';
    }
    if (btn) {
      btn.setAttribute('variante', isShowingPreviews ? 'aviso' : 'secundario');
    }
  }
}
