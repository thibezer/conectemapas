/* ==========================================================================
   ConecteMapas - ColorPickerPopover
   Responsabilidade Única: Seletor de cores modular flutuante (estilo Adobe Illustrator)
   com suporte a Preenchimento vs Traço, transparência/alpha, "sem cor", paleta de camadas e swatches CAD.
   ========================================================================== */

if (typeof window !== 'undefined' && !globalThis.process?.versions?.node) {
  import('./ColorPickerPopover.css');
}

const CAD_PALETTE = [
  '#00E08A', '#38bdf8', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#84cc16', '#14b8a6', '#ffffff', '#94a3b8', '#0f172a'
];

export class ColorPickerPopover {
  static _activeInstance = null;

  /**
   * Abre o popover de seleção de cor ancorado a um elemento.
   * Fecha qualquer instância aberta anteriormente.
   * @param {Object} options
   * @param {HTMLElement} options.anchorEl Elemento de ancoragem
   * @param {string} [options.title] Título exibido no cabeçalho
   * @param {'fill'|'stroke'} [options.activeTarget] Alvo ativo inicial ('fill' ou 'stroke')
   * @param {string} [options.fillColor] Cor de preenchimento
   * @param {string} [options.strokeColor] Cor do traço
   * @param {string} [options.color] Cor inicial direta (modo simples)
   * @param {number} [options.opacity] Opacidade inicial (0 a 1)
   * @param {boolean} [options.showOpacity] Exibir controle de opacidade
   * @param {boolean} [options.isMixed] Indicar seleção mista inicial
   * @param {Array<Object>} [options.layers] Camadas do projeto para extrair cores
   * @param {Function} [options.onChange] Callback de pré-visualização contínua
   * @param {Function} [options.onCommit] Callback definitivo ao fechar/confirmar
   */
  static open(options = {}) {
    if (this._activeInstance) {
      this._activeInstance.close(false);
    }
    const instance = new ColorPickerPopover(options);
    this._activeInstance = instance;
    instance.show();
    return instance;
  }

  static closeCurrent() {
    if (this._activeInstance) {
      this._activeInstance.close(true);
      this._activeInstance = null;
    }
  }

  constructor(options = {}) {
    this.anchorEl = options.anchorEl;
    this.title = options.title || 'Seletor de Cor';

    // Suporte a modo dual (Fill + Stroke) ou modo direto
    this.hasDualTargets = Boolean(options.fillColor !== undefined && options.strokeColor !== undefined);
    this.activeTarget = options.activeTarget || (options.target === 'stroke' ? 'stroke' : 'fill');
    
    this.fillColor = this._normalizeColor(options.fillColor || options.color || '#00E08A');
    this.strokeColor = this._normalizeColor(options.strokeColor || '#ffffff');
    this.fillOpacity = options.opacity !== undefined ? Number(options.opacity) : 0.35;

    this.currentColor = this.activeTarget === 'stroke' ? this.strokeColor : this.fillColor;
    this.initialColor = this.currentColor;
    this.initialOpacity = this.fillOpacity;

    this.showOpacity = options.showOpacity !== undefined ? options.showOpacity : (this.activeTarget === 'fill');
    this.isMixed = options.isMixed === true;
    this.layers = Array.isArray(options.layers) ? options.layers : [];
    this.onChange = options.onChange || (() => {});
    this.onCommit = options.onCommit || (() => {});

    this.element = null;
    this._outsideClickListener = null;
    this._keydownListener = null;
  }

  _normalizeColor(c) {
    if (!c || c === 'none' || c === 'transparent') return 'none';
    const s = String(c).trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s;
    if (/^#[0-9a-f]{3}$/i.test(s)) {
      return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
    }
    return '#00e08a';
  }

  show() {
    if (typeof document === 'undefined') return;

    this.element = document.createElement('div');
    this.element.className = 'cm-color-popover';
    this.element.innerHTML = this._renderHtml();

    document.body.appendChild(this.element);
    this._positionPopover();
    this._bindEvents();
  }

  _renderHtml() {
    const isNone = this.currentColor === 'none';
    const hexVal = isNone ? '' : this.currentColor.replace('#', '').toUpperCase();
    const pct = Math.round(this.fillOpacity * 100);

    const layerColors = Array.from(new Set(
      this.layers
        .map(l => l.color)
        .filter(c => c && typeof c === 'string' && c.startsWith('#'))
    ));

    return `
      <div class="cm-cp-header">
        <span class="cm-cp-title">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
          </svg>
          ${this._escape(this.title)}
        </span>
        <button type="button" class="cm-cp-close-btn" data-cp-action="close" title="Fechar (Esc)">✕</button>
      </div>

      ${this.hasDualTargets ? `
        <!-- Alternador Preenchimento x Traço (Atalho X) -->
        <div class="cm-cp-target-tabs">
          <button type="button" class="cm-cp-target-tab ${this.activeTarget === 'fill' ? 'active' : ''}" data-cp-target="fill" title="Preenchimento [X]">
            <span class="cm-cp-tab-swatch cm-cp-tab-swatch--fill" style="${this.fillColor === 'none' ? 'background: transparent;' : `background-color: ${this.fillColor};`}"></span>
            Preenchimento
          </button>
          <button type="button" class="cm-cp-target-tab ${this.activeTarget === 'stroke' ? 'active' : ''}" data-cp-target="stroke" title="Traço / Contorno [X]">
            <span class="cm-cp-tab-swatch cm-cp-tab-swatch--stroke" style="${this.strokeColor === 'none' ? 'border: 2px solid #ef4444;' : `border: 2px solid ${this.strokeColor};`}"></span>
            Traço
          </button>
        </div>
      ` : ''}

      <!-- Preview Antes x Depois -->
      <div class="cm-cp-preview-bar">
        <div class="cm-cp-preview-half" title="Cor Original">
          <div class="cm-cp-preview-color ${this.initialColor === 'none' ? 'cm-cp-preview-none' : ''}" style="${this.initialColor === 'none' ? '' : `background-color: ${this.initialColor}; opacity: ${this.activeTarget === 'fill' ? this.initialOpacity : 1};`}"></div>
          <span>ORIGINAL</span>
        </div>
        <div class="cm-cp-preview-half" title="Nova Cor">
          <div class="cm-cp-preview-color cm-cp-preview-new ${isNone ? 'cm-cp-preview-none' : ''}" style="${isNone ? '' : `background-color: ${this.currentColor}; opacity: ${this.activeTarget === 'fill' ? this.fillOpacity : 1};`}"></div>
          <span>${this.isMixed ? 'MISTO (?)' : 'NOVA'}</span>
        </div>
      </div>

      <!-- Input Hexadecimal & Disparador de Roda Nativa Auxiliar -->
      <div class="cm-cp-hex-row">
        <div class="cm-cp-hex-input-wrap">
          <span class="cm-cp-hex-prefix">#</span>
          <input type="text" class="cm-cp-hex-input" maxlength="6" value="${hexVal}" placeholder="${isNone ? 'NENHUM' : '00E08A'}" spellcheck="false" />
        </div>
        <div class="cm-cp-native-btn" title="Abrir paleta avançada do sistema">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 1 10 10"/>
          </svg>
          <input type="color" class="cm-cp-native-input" value="${isNone ? '#00e08a' : this.currentColor}" />
        </div>
      </div>

      <!-- Controle Deslizante de Opacidade (Alpha) -->
      <div class="cm-cp-opacity-section" style="${this.showOpacity ? '' : 'display: none;'}">
        <div class="cm-cp-opacity-header">
          <span>Opacidade do Preenchimento</span>
          <span class="cm-cp-opacity-val">${pct}%</span>
        </div>
        <input type="range" class="cm-cp-opacity-slider" min="0" max="100" step="1" value="${pct}" />
        <div class="cm-cp-opacity-presets">
          <button type="button" class="cm-cp-opacity-chip ${pct === 25 ? 'active' : ''}" data-cp-alpha="0.25">25%</button>
          <button type="button" class="cm-cp-opacity-chip ${pct === 35 ? 'active' : ''}" data-cp-alpha="0.35">35%</button>
          <button type="button" class="cm-cp-opacity-chip ${pct === 50 ? 'active' : ''}" data-cp-alpha="0.50">50%</button>
          <button type="button" class="cm-cp-opacity-chip ${pct === 75 ? 'active' : ''}" data-cp-alpha="0.75">75%</button>
          <button type="button" class="cm-cp-opacity-chip ${pct === 100 ? 'active' : ''}" data-cp-alpha="1.00">100%</button>
        </div>
      </div>

      <!-- Cores das Camadas do Projeto -->
      ${layerColors.length > 0 ? `
        <div class="cm-cp-section-label">Cores do Projeto</div>
        <div class="cm-cp-swatches-grid">
          ${layerColors.map(c => `
            <div class="cm-cp-swatch ${c.toLowerCase() === this.currentColor ? 'active' : ''}" style="background-color: ${c};" data-cp-color="${c}" title="${c}"></div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Paleta Técnica Padrão CAD/GIS -->
      <div class="cm-cp-section-label">Paleta Padrão CAD</div>
      <div class="cm-cp-swatches-grid">
        ${CAD_PALETTE.map(c => `
          <div class="cm-cp-swatch ${c.toLowerCase() === this.currentColor ? 'active' : ''}" style="background-color: ${c};" data-cp-color="${c}" title="${c}"></div>
        `).join('')}
      </div>

      <!-- Botão Sem Cor -->
      <button type="button" class="cm-cp-none-btn ${isNone ? 'active' : ''}" data-cp-color="none" title="Sem preenchimento ou traço [/]">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="9"/>
          <line x1="5.5" y1="5.5" x2="18.5" y2="18.5"/>
        </svg>
        Sem Cor (Vazado / Transparente)
      </button>

      <!-- Rodapé com Botão de Confirmação -->
      <div class="cm-cp-footer">
        <button type="button" class="cm-cp-btn cm-cp-btn-secondary" data-cp-action="cancel">Cancelar</button>
        <button type="button" class="cm-cp-btn cm-cp-btn-primary" data-cp-action="apply">Concluir</button>
      </div>
    `;
  }

  _positionPopover() {
    if (!this.element || !this.anchorEl) return;
    const rect = this.anchorEl.getBoundingClientRect();
    const popoverRect = this.element.getBoundingClientRect();

    let top = rect.top;
    let left = rect.right + 10;

    // Se vazar à direita da tela, posiciona à esquerda do elemento
    if (left + popoverRect.width > window.innerWidth - 10) {
      left = Math.max(10, rect.left - popoverRect.width - 10);
    }

    // Se vazar abaixo, alinha para cima
    if (top + popoverRect.height > window.innerHeight - 10) {
      top = Math.max(10, window.innerHeight - popoverRect.height - 10);
    }

    this.element.style.top = `${top}px`;
    this.element.style.left = `${left}px`;
  }

  _bindEvents() {
    if (!this.element) return;

    // Abas de Preenchimento vs Traço
    this.element.querySelectorAll('[data-cp-target]').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = tab.getAttribute('data-cp-target');
        this.switchTarget(target);
      });
    });

    // Clique nas amostras de cor (Swatches) e no botão de "Sem Cor"
    this.element.querySelectorAll('[data-cp-color]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = el.getAttribute('data-cp-color');
        this.setColor(color, true);
      });
    });

    // Slider de Opacidade
    const slider = this.element.querySelector('.cm-cp-opacity-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = Number(e.target.value) / 100;
        this.setOpacity(val, false);
      });
      slider.addEventListener('change', (e) => {
        const val = Number(e.target.value) / 100;
        this.setOpacity(val, true);
      });
    }

    // Chips de Opacidade rápida
    this.element.querySelectorAll('[data-cp-alpha]').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const alpha = Number(chip.getAttribute('data-cp-alpha'));
        this.setOpacity(alpha, true);
      });
    });

    // Input Hexadecimal manual
    const hexInput = this.element.querySelector('.cm-cp-hex-input');
    if (hexInput) {
      hexInput.addEventListener('input', (e) => {
        let val = e.target.value.trim().replace(/^#/, '');
        if (/^[0-9a-f]{6}$/i.test(val)) {
          this.setColor(`#${val.toLowerCase()}`, false);
        }
      });
      hexInput.addEventListener('change', (e) => {
        let val = e.target.value.trim().replace(/^#/, '');
        if (/^[0-9a-f]{6}$/i.test(val)) {
          this.setColor(`#${val.toLowerCase()}`, true);
        } else if (/^[0-9a-f]{3}$/i.test(val)) {
          const full = `#${val[0]}${val[0]}${val[1]}${val[1]}${val[2]}${val[2]}`.toLowerCase();
          this.setColor(full, true);
        }
      });
      hexInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.close(true);
        }
      });
    }

    // Input Nativo auxiliar
    const nativeInput = this.element.querySelector('.cm-cp-native-input');
    if (nativeInput) {
      nativeInput.addEventListener('input', (e) => {
        this.setColor(e.target.value.toLowerCase(), false);
      });
      nativeInput.addEventListener('change', (e) => {
        this.setColor(e.target.value.toLowerCase(), true);
      });
    }

    // Botão Concluir / Cancelar / Fechar
    this.element.querySelector('[data-cp-action="close"]')?.addEventListener('click', () => this.close(true));
    this.element.querySelector('[data-cp-action="apply"]')?.addEventListener('click', () => this.close(true));
    this.element.querySelector('[data-cp-action="cancel"]')?.addEventListener('click', () => {
      this.currentColor = this.initialColor;
      this.fillOpacity = this.initialOpacity;
      this._emitChange(false);
      this.close(false);
    });

    // Evita propagação de cliques dentro do popover
    this.element.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.element.addEventListener('click', (e) => e.stopPropagation());

    // Fechar ao clicar fora
    this._outsideClickListener = (e) => {
      if (this.element && !this.element.contains(e.target) && !this.anchorEl?.contains(e.target)) {
        this.close(true);
      }
    };
    window.addEventListener('pointerdown', this._outsideClickListener, true);

    // Tecla Esc e X dentro do popover
    this._keydownListener = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close(true);
      } else if ((e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement !== hexInput) {
        if (this.hasDualTargets) {
          e.preventDefault();
          this.switchTarget(this.activeTarget === 'fill' ? 'stroke' : 'fill');
        }
      }
    };
    window.addEventListener('keydown', this._keydownListener, true);
  }

  switchTarget(target) {
    this.activeTarget = target === 'stroke' ? 'stroke' : 'fill';
    this.currentColor = this.activeTarget === 'stroke' ? this.strokeColor : this.fillColor;
    this.showOpacity = (this.activeTarget === 'fill');
    this._updateVisuals();
  }

  setColor(color, commit = false) {
    this.currentColor = this._normalizeColor(color);
    if (this.activeTarget === 'stroke') {
      this.strokeColor = this.currentColor;
    } else {
      this.fillColor = this.currentColor;
    }
    this.isMixed = false;
    this._updateVisuals();
    this._emitChange(commit);
  }

  setOpacity(opacity, commit = false) {
    this.fillOpacity = Math.max(0, Math.min(1, opacity));
    this._updateVisuals();
    this._emitChange(commit);
  }

  _emitChange(commit = false) {
    const payload = {
      target: this.activeTarget,
      color: this.currentColor,
      opacity: this.fillOpacity,
      fillColor: this.fillColor,
      strokeColor: this.strokeColor,
      fillOpacity: this.fillOpacity
    };
    if (commit) {
      this.onChange(payload);
    } else {
      this.onChange(payload);
    }
  }

  _updateVisuals() {
    if (!this.element) return;
    const isNone = this.currentColor === 'none';

    // Abas de Alvo
    this.element.querySelectorAll('[data-cp-target]').forEach(tab => {
      const t = tab.getAttribute('data-cp-target');
      tab.classList.toggle('active', t === this.activeTarget);
    });

    const swatchFill = this.element.querySelector('.cm-cp-tab-swatch--fill');
    if (swatchFill) {
      swatchFill.style.backgroundColor = this.fillColor === 'none' ? 'transparent' : this.fillColor;
    }
    const swatchStroke = this.element.querySelector('.cm-cp-tab-swatch--stroke');
    if (swatchStroke) {
      swatchStroke.style.borderColor = this.strokeColor === 'none' ? '#ef4444' : this.strokeColor;
    }

    // Seção de Opacidade
    const opacitySec = this.element.querySelector('.cm-cp-opacity-section');
    if (opacitySec) {
      opacitySec.style.display = this.showOpacity ? 'block' : 'none';
    }

    // Preview
    const newPreview = this.element.querySelector('.cm-cp-preview-new');
    if (newPreview) {
      if (isNone) {
        newPreview.classList.add('cm-cp-preview-none');
        newPreview.style.backgroundColor = 'transparent';
      } else {
        newPreview.classList.remove('cm-cp-preview-none');
        newPreview.style.backgroundColor = this.currentColor;
        newPreview.style.opacity = String(this.activeTarget === 'fill' ? this.fillOpacity : 1);
      }
    }

    // Hex input
    const hexInput = this.element.querySelector('.cm-cp-hex-input');
    if (hexInput && document.activeElement !== hexInput) {
      hexInput.value = isNone ? '' : this.currentColor.replace('#', '').toUpperCase();
    }

    // Slider & Badge
    const slider = this.element.querySelector('.cm-cp-opacity-slider');
    const badge = this.element.querySelector('.cm-cp-opacity-val');
    const pct = Math.round(this.fillOpacity * 100);
    if (slider) slider.value = pct;
    if (badge) badge.textContent = `${pct}%`;

    // Presets de opacidade
    this.element.querySelectorAll('[data-cp-alpha]').forEach(chip => {
      const alpha = Number(chip.getAttribute('data-cp-alpha'));
      chip.classList.toggle('active', Math.abs(alpha - this.fillOpacity) < 0.02);
    });

    // Swatches ativos
    this.element.querySelectorAll('.cm-cp-swatch').forEach(sw => {
      const c = sw.getAttribute('data-cp-color');
      sw.classList.toggle('active', c && c.toLowerCase() === this.currentColor);
    });

    // Botão None
    const noneBtn = this.element.querySelector('.cm-cp-none-btn');
    if (noneBtn) noneBtn.classList.toggle('active', isNone);
  }

  close(triggerCommit = true) {
    if (this._outsideClickListener) {
      window.removeEventListener('pointerdown', this._outsideClickListener, true);
      this._outsideClickListener = null;
    }
    if (this._keydownListener) {
      window.removeEventListener('keydown', this._keydownListener, true);
      this._keydownListener = null;
    }

    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
      this.element = null;
    }

    if (triggerCommit) {
      this.onCommit({
        target: this.activeTarget,
        color: this.currentColor,
        opacity: this.fillOpacity,
        fillColor: this.fillColor,
        strokeColor: this.strokeColor,
        fillOpacity: this.fillOpacity
      });
    }

    if (ColorPickerPopover._activeInstance === this) {
      ColorPickerPopover._activeInstance = null;
    }
  }

  _escape(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
}
