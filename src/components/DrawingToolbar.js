/* ==========================================================================
   ConecteMapas - DrawingToolbar Component (SRP Module)
   Responsabilidade Única: Barra lateral flutuante de ferramentas de desenho,
   digitalização vetorial (ponto, linha, polígono, raio), medição e GPS.
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
  }

  /**
   * Renderiza a barra de ferramentas
   * @param {HTMLElement} container
   */
  render(container) {
    this.container = container;
    this.container.innerHTML = `
      <div class="cm-drawing-toolbar" role="toolbar" aria-label="Ferramentas de Desenho e Medição">
        <!-- Navegar e Selecionar -->
        <button class="cm-tool-btn ${this.activeTool === 'select' ? 'active' : ''}" data-tool="select" title="Navegar e Selecionar Elementos (V)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 3 7 18 3-7 7-3L3 3z"/><path d="m13 13 6 6"/>
          </svg>
          <span class="cm-tool-shortcut">V</span>
        </button>

        <div class="cm-tool-divider"></div>

        <!-- Ponto / Marco -->
        <button class="cm-tool-btn ${this.activeTool === 'point' ? 'active' : ''}" data-tool="point" title="Adicionar Marco / Ponto (P)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <span class="cm-tool-shortcut">P</span>
        </button>

        <!-- Linha / Rota -->
        <button class="cm-tool-btn ${this.activeTool === 'line' ? 'active' : ''}" data-tool="line" title="Desenhar Linha / Rota (L) - Duplo clique para finalizar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m5 19 14-14"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/>
          </svg>
          <span class="cm-tool-shortcut">L</span>
        </button>

        <!-- Polígono / Área -->
        <button class="cm-tool-btn ${this.activeTool === 'polygon' ? 'active' : ''}" data-tool="polygon" title="Desenhar Polígono / Área (A) - Duplo clique para fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2 2 8.5v7L12 22l10-6.5v-7L12 2z"/>
          </svg>
          <span class="cm-tool-shortcut">A</span>
        </button>

        <!-- Raio / Círculo -->
        <button class="cm-tool-btn ${this.activeTool === 'circle' ? 'active' : ''}" data-tool="circle" title="Criar Buffer Circular (C) - Clique no centro e arraste">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/>
          </svg>
          <span class="cm-tool-shortcut">C</span>
        </button>

        <div class="cm-tool-divider"></div>

        <!-- Régua de Medição -->
        <button class="cm-tool-btn ${this.activeTool === 'measure' ? 'active' : ''}" data-tool="measure" title="Régua de Medição em Tempo Real (M)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span class="cm-tool-shortcut">M</span>
        </button>

        <!-- GPS / Minha Localização -->
        <button class="cm-tool-btn" data-action="locate" title="Minha Localização GPS (G)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
          </svg>
          <span class="cm-tool-shortcut">G</span>
        </button>

        <!-- Enquadrar Tudo / Fit Bounds -->
        <button class="cm-tool-btn" data-action="fit" title="Enquadrar Todas as Feições (Z)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
          <span class="cm-tool-shortcut">Z</span>
        </button>
      </div>
    `;

    this.bindEvents();
  }

  /**
   * Define ferramenta ativa visualmente
   * @param {string} tool
   */
  setActiveTool(tool) {
    this.activeTool = tool;
    if (!this.container) return;
    const btns = this.container.querySelectorAll('.cm-tool-btn');
    btns.forEach(btn => {
      const t = btn.getAttribute('data-tool');
      if (t) {
        btn.classList.toggle('active', t === tool);
      }
    });
  }

  /**
   * Vincula eventos de clique e atalhos de teclado
   */
  bindEvents() {
    if (!this.container) return;

    this.container.querySelectorAll('.cm-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool');
        const action = btn.getAttribute('data-action');

        if (tool) {
          this.setActiveTool(tool);
          this.onToolChange(tool);
        } else if (action) {
          this.onAction(action);
        }
      });
    });

    // Atalhos de Teclado Globais (Apenas teclas simples sem modificadores Ctrl/Cmd/Alt)
    window.addEventListener('keydown', (e) => {
      const path = e.composedPath ? e.composedPath() : [e.target];
      const isInput = path.some(el => 
        el && el.tagName && (
          el.tagName === 'INPUT' || 
          el.tagName === 'TEXTAREA' || 
          el.tagName === 'SELECT' || 
          el.tagName.toLowerCase().includes('campo-texto') ||
          el.tagName.toLowerCase().includes('lista-flutuante') ||
          el.isContentEditable
        )
      );
      if (isInput) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // NUNCA interceptar atalhos como Ctrl+Z, Ctrl+Y, etc.

      const key = e.key.toLowerCase();
      if (key === 'v') this.triggerTool('select');
      if (key === 'p') this.triggerTool('point');
      if (key === 'l') this.triggerTool('line');
      if (key === 'a') this.triggerTool('polygon');
      if (key === 'c') this.triggerTool('circle');
      if (key === 'm') this.triggerTool('measure');
      if (key === 'g') this.onAction('locate');
      if (key === 'z') this.onAction('fit');
    });
  }

  triggerTool(tool) {
    this.setActiveTool(tool);
    this.onToolChange(tool);
  }
}
