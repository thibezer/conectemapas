/* ==========================================================================
   ConecteMapas - PrintShortcuts
   Responsabilidade Única: registro único dos atalhos do Layout de Impressão
   (ação → combinação padrão), personalização por usuário (localStorage),
   leitura da tecla do teclado e detecção de conflitos. Sem DOM e sem composer:
   quem executa a ação é o PrintShortcutActions.
   ========================================================================== */

const STORAGE_KEY = 'cm_print_shortcuts';

export const SHORTCUT_GROUPS = [
  { id: 'tools', label: 'Ferramentas' },
  { id: 'insert', label: 'Inserir na folha' },
  { id: 'stroke', label: 'Espessura da linha' },
  { id: 'edit', label: 'Edição' },
  { id: 'order', label: 'Ordem de empilhamento' },
  { id: 'align', label: 'Alinhar e distribuir' },
  { id: 'view', label: 'Zoom' },
  { id: 'sheet', label: 'Pranchas e exportação' }
];

/**
 * `keys`: combinações padrão (a 1ª é a mostrada nas dicas). `edit`: não roda com a prancha só para leitura.
 * `dialogOk`: roda mesmo com a janela Visibilidade/Gráficos aberta.
 */
export const SHORTCUT_ACTIONS = [
  { id: 'modeLayout', group: 'tools', label: 'Selecionar e mover (2× abre Visibilidade do mapa)', keys: ['V'] },
  { id: 'modeContent', group: 'tools', label: 'Navegar no mapa (pan/zoom do conteúdo)', keys: ['C'] },
  { id: 'smartGuides', group: 'tools', label: 'Guias inteligentes', keys: ['U'] },
  { id: 'lockGuides', group: 'tools', label: 'Travar/destravar guias', keys: ['Ctrl+;'], edit: true },
  { id: 'propertiesPanel', group: 'tools', label: 'Recolher/expandir painel de propriedades', keys: ['P'] },
  { id: 'openShortcuts', group: 'tools', label: 'Abrir esta janela de atalhos', keys: ['Shift+/', 'F1'] },

  { id: 'insert:map', group: 'insert', label: 'Mapa principal', keys: ['M'], edit: true },
  { id: 'insert:inset_map', group: 'insert', label: 'Mapa de localização', keys: ['Shift+M'], edit: true },
  { id: 'insert:north_arrow', group: 'insert', label: 'Norte', keys: ['N'], edit: true },
  { id: 'insert:scale_bar', group: 'insert', label: 'Escala', keys: ['E'], edit: true },
  { id: 'insert:legend', group: 'insert', label: 'Legenda', keys: ['L'], edit: true },
  { id: 'insert:table_vertices', group: 'insert', label: 'Tabela de vértices', keys: ['B'], edit: true },
  { id: 'insert:label', group: 'insert', label: 'Título', keys: ['T'], edit: true },
  { id: 'insert:text_block', group: 'insert', label: 'Notas', keys: ['Shift+T'], edit: true },
  { id: 'insert:title_block', group: 'insert', label: 'Selo ABNT', keys: ['S'], edit: true },
  { id: 'insert:shape', group: 'insert', label: 'Moldura', keys: ['F'], edit: true },
  { id: 'insert:image', group: 'insert', label: 'Logo / imagem', keys: ['I'], edit: true },
  { id: 'atlas', group: 'insert', label: 'Gerador de Atlas', keys: ['A'], edit: true },

  { id: 'strokeDown', group: 'stroke', label: 'Diminuir espessura da linha', keys: ['['], edit: true },
  { id: 'strokeUp', group: 'stroke', label: 'Aumentar espessura da linha', keys: [']'], edit: true },

  { id: 'undo', group: 'edit', label: 'Desfazer', keys: ['Ctrl+Z'], dialogOk: true },
  { id: 'redo', group: 'edit', label: 'Refazer', keys: ['Ctrl+Y', 'Ctrl+Shift+Z'], dialogOk: true },
  { id: 'duplicate', group: 'edit', label: 'Duplicar', keys: ['Ctrl+D'], edit: true },
  { id: 'copy', group: 'edit', label: 'Copiar', keys: ['Ctrl+C'] },
  { id: 'cut', group: 'edit', label: 'Recortar', keys: ['Ctrl+X'], edit: true },
  { id: 'paste', group: 'edit', label: 'Colar', keys: ['Ctrl+V'], edit: true },
  { id: 'copyStyle', group: 'edit', label: 'Copiar estilo', keys: ['Ctrl+Alt+C'] },
  { id: 'pasteStyle', group: 'edit', label: 'Aplicar estilo copiado', keys: ['Ctrl+Alt+V'], edit: true },
  { id: 'delete', group: 'edit', label: 'Excluir', keys: ['Delete', 'Backspace'], edit: true },

  { id: 'bringToFront', group: 'order', label: 'Trazer para frente', keys: ['Ctrl+Shift+]'], edit: true },
  { id: 'sendToBack', group: 'order', label: 'Enviar para trás', keys: ['Ctrl+Shift+['], edit: true },
  { id: 'bringForward', group: 'order', label: 'Avançar 1 nível', keys: ['Ctrl+]'], edit: true },
  { id: 'sendBackward', group: 'order', label: 'Recuar 1 nível', keys: ['Ctrl+['], edit: true },

  { id: 'alignLeft', group: 'align', label: 'Alinhar à esquerda', keys: ['Alt+Shift+Left'], edit: true },
  { id: 'alignRight', group: 'align', label: 'Alinhar à direita', keys: ['Alt+Shift+Right'], edit: true },
  { id: 'alignTop', group: 'align', label: 'Alinhar ao topo', keys: ['Alt+Shift+Up'], edit: true },
  { id: 'alignBottom', group: 'align', label: 'Alinhar à base', keys: ['Alt+Shift+Down'], edit: true },
  { id: 'alignCenterH', group: 'align', label: 'Centralizar horizontalmente', keys: ['Alt+Shift+H'], edit: true },
  { id: 'alignCenterV', group: 'align', label: 'Centralizar verticalmente', keys: ['Alt+Shift+V'], edit: true },
  { id: 'distributeH', group: 'align', label: 'Distribuir horizontalmente', keys: ['Ctrl+Alt+Shift+H'], edit: true },
  { id: 'distributeV', group: 'align', label: 'Distribuir verticalmente', keys: ['Ctrl+Alt+Shift+V'], edit: true },
  { id: 'fitToMargins', group: 'align', label: 'Ajustar às margens', keys: ['Alt+Shift+M'], edit: true },
  { id: 'matchWidth', group: 'align', label: 'Igualar largura', keys: ['Alt+Shift+W'], edit: true },
  { id: 'matchHeight', group: 'align', label: 'Igualar altura', keys: ['Alt+Shift+G'], edit: true },

  { id: 'zoomFit', group: 'view', label: 'Enquadrar folha', keys: ['0'] },
  { id: 'zoomIn', group: 'view', label: 'Aproximar', keys: ['=', 'Shift+='] },
  { id: 'zoomOut', group: 'view', label: 'Afastar', keys: ['-', 'Shift+-'] },

  { id: 'prevSheet', group: 'sheet', label: 'Prancha anterior', keys: ['PageUp'] },
  { id: 'nextSheet', group: 'sheet', label: 'Próxima prancha', keys: ['PageDown'] },
  { id: 'exportPdf', group: 'sheet', label: 'Exportar PDF desta prancha', keys: ['Ctrl+P'] },
  { id: 'exportPng', group: 'sheet', label: 'Exportar PNG desta prancha', keys: ['Ctrl+Shift+E'] }
];

/** Teclas fixas (não personalizáveis): reservadas, nenhuma ação pode usá-las. */
export const RESERVED_COMBOS = new Set([
  'Escape', 'Left', 'Right', 'Up', 'Down', 'Shift+Left', 'Shift+Right', 'Shift+Up', 'Shift+Down',
  'Ctrl+S', 'Ctrl+A', 'Ctrl+W', 'Ctrl+T', 'Ctrl+N', 'Ctrl+R', 'F5', 'F11', 'F12'
]);

const CODE_TOKENS = {
  BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Backslash: '\\', Slash: '/', Comma: ',',
  Period: '.', Equal: '=', Minus: '-', Backquote: '`', NumpadAdd: '=', NumpadSubtract: '-', NumpadDivide: '/',
  ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down', Space: 'Space'
};
const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'OS']);

const BY_ID = new Map(SHORTCUT_ACTIONS.map(a => [a.id, a]));

let overrides = null; // { [actionId]: string[] } — só o que o usuário mudou
const listeners = new Set();

function storage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

function load() {
  if (overrides) return overrides;
  overrides = {};
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      for (const [id, keys] of Object.entries(parsed)) {
        if (BY_ID.has(id) && Array.isArray(keys)) overrides[id] = keys.filter(k => typeof k === 'string' && k && !RESERVED_COMBOS.has(k));
      }
    }
  } catch { overrides = {}; }
  return overrides;
}

function persist() {
  try {
    const store = storage();
    if (!store) return;
    if (Object.keys(overrides).length) store.setItem(STORAGE_KEY, JSON.stringify(overrides));
    else store.removeItem(STORAGE_KEY);
  } catch { /* sem armazenamento: vale só nesta sessão */ }
}

function emit() { listeners.forEach(fn => { try { fn(); } catch { /* ouvinte não pode derrubar os outros */ } }); }

export class PrintShortcuts {
  static get actions() { return SHORTCUT_ACTIONS; }

  static getAction(id) { return BY_ID.get(id) || null; }

  /** Combinações em vigor da ação (as do usuário, ou as padrão). Lista vazia = sem atalho. */
  static keysFor(id) {
    const action = BY_ID.get(id);
    if (!action) return [];
    const own = load()[id];
    return own ? [...own] : [...action.keys];
  }

  static isCustomized(id) { return Object.prototype.hasOwnProperty.call(load(), id); }

  /** Combinação normalizada do evento (ex.: `Ctrl+Shift+]`), ou '' para tecla só de modificador. */
  static comboFromEvent(e) {
    if (!e || MODIFIER_KEYS.has(e.key)) return '';
    const code = e.code || '';
    let key;
    if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
    else if (/^(Digit|Numpad)\d$/.test(code)) key = code.slice(-1);
    else if (CODE_TOKENS[code]) key = CODE_TOKENS[code];
    else key = e.key === ' ' ? 'Space' : (e.key && e.key.length === 1 ? e.key.toUpperCase() : e.key);
    if (!key) return '';
    const mods = [];
    if (e.ctrlKey || e.metaKey) mods.push('Ctrl');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    return [...mods, key].join('+');
  }

  /** Id da ação que usa a combinação (ou null). `ignoreId` ignora uma ação (ao regravar a mesma). */
  static actionForCombo(combo, ignoreId = null) {
    if (!combo) return null;
    for (const a of SHORTCUT_ACTIONS) {
      if (a.id === ignoreId) continue;
      if (this.keysFor(a.id).includes(combo)) return a.id;
    }
    return null;
  }

  static actionForEvent(e) {
    return this.actionForCombo(this.comboFromEvent(e));
  }

  /** Texto legível: `Ctrl+Shift+Left` → `Ctrl+Shift+←`; `=`/`Shift+=` → `+`. */
  static prettyCombo(combo) {
    if (!combo) return '—';
    const whole = { '=': '+', 'Shift+=': '+', '-': '−', 'Shift+-': '_' };
    if (whole[combo]) return whole[combo];
    const part = { Left: '←', Right: '→', Up: '↑', Down: '↓', Delete: 'Del' };
    return combo.split('+').map(p => part[p] || p).join('+');
  }

  /** Dica curta da ação para tooltips: ` (M)`; vazio se a ação não tem atalho. */
  static hint(id) {
    const first = this.keysFor(id)[0];
    return first ? ` (${this.prettyCombo(first)})` : '';
  }

  static titleFor(id, base) { return `${base}${this.hint(id)}`; }

  /**
   * Atributos HTML do botão da ação: `title` com o atalho em vigor e os `data-sc*` que o
   * PrintShortcutsDialog.applyHints usa para atualizar a dica quando o usuário muda a tecla.
   * `base` deve ser texto fixo do código (não vem de dados do usuário).
   */
  static attrs(id, base) {
    return `title="${this.titleFor(id, base)}" data-sc="${id}" data-sc-title="${base}"`;
  }

  /**
   * Define a combinação da ação. Devolve `{ ok, error?, displaced? }`: reservada/inválida é recusada;
   * se outra ação já usa a combinação, ela perde essa tecla (`displaced` = id dessa ação).
   */
  static setCombo(id, combo) {
    if (!BY_ID.has(id)) return { ok: false, error: 'Ação desconhecida.' };
    if (!combo || /^(Ctrl|Alt|Shift)(\+(Ctrl|Alt|Shift))*$/.test(combo)) return { ok: false, error: 'Use uma tecla além do modificador.' };
    if (RESERVED_COMBOS.has(combo)) return { ok: false, error: `${this.prettyCombo(combo)} é reservada.` };
    const store = load();
    const other = this.actionForCombo(combo, id);
    if (other) store[other] = this.keysFor(other).filter(k => k !== combo);
    store[id] = [combo];
    persist();
    emit();
    return { ok: true, displaced: other };
  }

  /** Deixa a ação sem atalho. */
  static clearCombo(id) {
    if (!BY_ID.has(id)) return false;
    load()[id] = [];
    persist();
    emit();
    return true;
  }

  /** Volta uma ação (ou todas, sem argumento) ao padrão. */
  static reset(id = null) {
    const store = load();
    if (id) delete store[id];
    else for (const k of Object.keys(store)) delete store[k];
    persist();
    emit();
  }

  static onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  /** Só para testes: descarta o cache e o que foi salvo. */
  static _resetForTests() {
    overrides = null;
    listeners.clear();
    try { storage()?.removeItem(STORAGE_KEY); } catch { /* ok */ }
  }
}
