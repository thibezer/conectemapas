/* ==========================================================================
   ConecteMapas - PrintSheetsManager
   Responsabilidade Única: Gestão de Múltiplas Pranchas no Projeto de Impressão,
   criação, duplicação, exclusão, alternância, numeração ABNT e persistência local/IndexedDB.
   ========================================================================== */

import { PrintItemsManager } from './PrintItemsManager.js';
import { PrintToolbar } from './PrintToolbar.js';
import { UIToast } from '@thibezer/ui-components-kit';

export class PrintSheetsManager {
  static STORAGE_PREFIX = 'cm_print_sheets_';
  static ACTIVE_PREFIX = 'cm_print_active_sheet_';
  static PRESETS_PREFIX = 'cm_print_presets_';
  static LIBRARY_PREFIX = 'cm_print_library_';
  static AUTOSAVE_DELAY_MS = 400;

  constructor(composer) {
    this.composer = composer;
    this.projectId = 'projeto_padrao';
    this.sheets = [];
    this.activeSheetId = null;
    this._saveTimer = null;
  }

  /**
   * Inicializa as pranchas do projeto carregando do armazenamento local ou criando a prancha inicial
   */
  init(projectId, projectName, paperSizes) {
    this.projectId = projectId || 'projeto_padrao';
    const loaded = this.loadSheetsFromStorage();

    if (loaded && Array.isArray(loaded) && loaded.length > 0) {
      this.sheets = loaded;
      // Garante que o paperSize referenciado tenha as dimensões corretas do dicionário
      this.sheets.forEach(sh => {
        if (sh.paperSize && sh.paperSize.id && paperSizes[sh.paperSize.id]) {
          sh.paperSize = { ...paperSizes[sh.paperSize.id], ...sh.paperSize };
        }
      });
      // Reabre na última prancha usada (ou na primeira, se ela não existir mais)
      const lastActive = this.loadActiveSheetId();
      this.activeSheetId = this.sheets.some(s => s.id === lastActive) ? lastActive : this.sheets[0].id;
    } else {
      // Primeira prancha padrão com itens ABNT
      const defaultPaper = paperSizes.A4_L || { id: 'A4_L', name: 'A4 Paisagem', width: 297, height: 210, marginL: 25, marginO: 7 };
      const firstSheet = {
        id: `sheet-${Date.now()}-1`,
        name: 'Prancha 01 - Planta Geral',
        paperSize: defaultPaper,
        showAbntMargins: true,
        items: PrintItemsManager.createDefaultItems(projectName, defaultPaper),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.sheets = [firstSheet];
      this.activeSheetId = firstSheet.id;
      this.saveToStorage();
    }

    this.updateSheetNumbersInTitleBlocks();
    const cur = this.getCurrentSheet();
    if (cur && (!this.composer.items || this.composer.items.length === 0)) {
      this.composer.items = JSON.parse(JSON.stringify(cur.items || []));
    }
    return cur;
  }

  /**
   * Retorna a prancha atualmente ativa
   */
  getCurrentSheet() {
    return this.sheets.find(s => s.id === this.activeSheetId) || this.sheets[0] || null;
  }

  /**
   * Sincroniza o estado atual do compositor para a prancha ativa
   */
  saveCurrentStateFromComposer() {
    this.cancelScheduledSave();
    const cur = this.getCurrentSheet();
    if (!cur) return;

    cur.paperSize = { ...this.composer.paperSize };
    cur.showAbntMargins = this.composer.showAbntMargins;
    cur.items = JSON.parse(JSON.stringify(this.composer.items || []));
    cur.updatedAt = new Date().toISOString();
    this.updateSheetNumbersInTitleBlocks();
    this.saveToStorage();
  }

  /**
   * Salvamento automático: agrupa edições em rajada (digitação, setas, pan do mapa) em uma gravação
   */
  scheduleSave() {
    this.cancelScheduledSave();
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.saveCurrentStateFromComposer();
    }, PrintSheetsManager.AUTOSAVE_DELAY_MS);
  }

  cancelScheduledSave() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
  }

  /** Grava imediatamente uma edição ainda pendente (ex.: ao fechar ou sair da página) */
  flushPendingSave() {
    if (this._saveTimer) this.saveCurrentStateFromComposer();
  }

  /**
   * Alterna para outra prancha do projeto
   */
  switchToSheet(sheetId) {
    if (this.activeSheetId === sheetId) return;

    // Salva a prancha atual antes de trocar
    this.saveCurrentStateFromComposer();

    const target = this.sheets.find(s => s.id === sheetId);
    if (!target) return;

    this.activeSheetId = target.id;
    this.saveToStorage();

    // Carrega na UI do compositor
    this.composer.paperSize = target.paperSize;
    this.composer.showAbntMargins = target.showAbntMargins !== false;
    this.composer.items = JSON.parse(JSON.stringify(target.items || []));
    this.composer.selectedItemId = (this.composer.items.find(i => i.type === 'map') || this.composer.items[0])?.id || null;
    // O histórico é de cada prancha: desfazer não pode trazer itens da prancha anterior
    this.composer.resetHistory?.();

    this.composer.updatePaperSheetDOM();
    this.composer.renderAllItems();
    this.composer.updatePropertiesPanel();
    this.renderSheetsSelectorDOM();

    setTimeout(() => {
      this.composer.canvasEngine.zoomFit();
      this.composer.canvasEngine.renderRulers();
      this.composer.updateInsetMapExtent();
    }, 100);

    UIToast.notificar({
      tipo: 'informativo',
      titulo: 'Prancha Carregada',
      mensagem: `${target.name} (${target.paperSize.name})`,
      duracao: 2000
    });
  }

  /**
   * Cria uma nova prancha no projeto
   */
  createSheet(name, paperSizeKey = 'A4_L', template = 'abnt') {
    this.saveCurrentStateFromComposer();

    // Mesma folha da prancha atual: herda também as margens personalizadas
    const curPaper = this.composer.paperSize;
    const paperSize = curPaper && curPaper.id === paperSizeKey
      ? { ...curPaper }
      : (this.composer.paperSizes[paperSizeKey] || this.composer.paperSizes.A4_L);
    const margins = PrintItemsManager.sheetMargins(paperSize);
    const count = this.sheets.length + 1;
    const sheetNum = String(count).padStart(2, '0');
    const finalName = (name && name.trim()) || `Prancha ${sheetNum} - Detalhe`;

    let items = [];
    if (template === 'abnt') {
      items = PrintItemsManager.createDefaultItems(this.composer.projectName, paperSize);
    } else {
      // Prancha com mapa básico
      items = [
        {
          id: `item-map-${Date.now()}`,
          type: 'map',
          name: 'Mapa da Prancha',
          x: margins.left,
          y: margins.top,
          width: paperSize.width - margins.left - margins.right,
          height: paperSize.height - margins.top - margins.bottom,
          locked: false,
          visible: true,
          scale: 10000,
          rotation: 0,
          showGrid: true,
          gridType: 'dms',
          basemap: this.composer.currentBasemap || 'satelite'
        }
      ];
    }

    const newSheet = {
      id: `sheet-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: finalName,
      paperSize,
      showAbntMargins: true,
      items,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.sheets.push(newSheet);
    this.saveToStorage();
    this.switchToSheet(newSheet.id);

    UIToast.notificar({
      tipo: 'sucesso',
      titulo: 'Nova Prancha Criada',
      mensagem: `${finalName} adicionada ao projeto.`,
      duracao: 2500
    });
  }

  /**
   * Duplica a prancha ativa com todos os seus elementos
   */
  duplicateCurrentSheet() {
    this.saveCurrentStateFromComposer();
    const cur = this.getCurrentSheet();
    if (!cur) return;

    const count = this.sheets.length + 1;
    const sheetNum = String(count).padStart(2, '0');
    const newName = `${cur.name} (Cópia)`;

    // Clona os itens gerando novos IDs para evitar colisão de elementos Leaflet
    const clonedItems = (cur.items || []).map(it => {
      const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substr(2, 4);
      return {
        ...JSON.parse(JSON.stringify(it)),
        id: `item-${it.type}-${uniqueSuffix}`
      };
    });

    const newSheet = {
      id: `sheet-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: newName,
      paperSize: { ...cur.paperSize },
      showAbntMargins: cur.showAbntMargins,
      items: clonedItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.sheets.push(newSheet);
    this.saveToStorage();
    this.switchToSheet(newSheet.id);

    UIToast.notificar({
      tipo: 'sucesso',
      titulo: 'Prancha Duplicada',
      mensagem: `${newName} criada com sucesso.`,
      duracao: 2500
    });
  }

  /**
   * Renomeia uma prancha
   */
  renameSheet(sheetId, newName) {
    const target = this.sheets.find(s => s.id === sheetId);
    if (!target || !newName || !newName.trim()) return;

    target.name = newName.trim();
    target.updatedAt = new Date().toISOString();
    this.saveToStorage();
    this.renderSheetsSelectorDOM();

    UIToast.notificar({
      tipo: 'sucesso',
      titulo: 'Prancha Renomeada',
      mensagem: `Nome alterado para "${target.name}".`,
      duracao: 2000
    });
  }

  /**
   * Exclui uma prancha
   */
  deleteSheet(sheetId) {
    if (this.sheets.length <= 1) {
      UIToast.notificar({
        tipo: 'alerta',
        titulo: 'Ação Não Permitida',
        mensagem: 'O projeto precisa conter pelo menos uma prancha de impressão.',
        duracao: 3000
      });
      return;
    }

    const index = this.sheets.findIndex(s => s.id === sheetId);
    if (index === -1) return;

    const [deleted] = this.sheets.splice(index, 1);
    this.saveToStorage();

    // Se a excluída for a ativa, vai para a anterior ou primeira
    if (this.activeSheetId === sheetId) {
      const nextIndex = Math.max(0, index - 1);
      this.activeSheetId = this.sheets[nextIndex].id;
      this.saveToStorage();
      const target = this.sheets[nextIndex];
      this.composer.paperSize = target.paperSize;
      this.composer.showAbntMargins = target.showAbntMargins !== false;
      this.composer.items = JSON.parse(JSON.stringify(target.items || []));
      this.composer.selectedItemId = this.composer.items[0]?.id || null;
      this.composer.resetHistory?.();
      this.composer.updatePaperSheetDOM();
      this.composer.renderAllItems();
      this.composer.updatePropertiesPanel();
      setTimeout(() => this.composer.canvasEngine.zoomFit(), 50);
    }

    this.updateSheetNumbersInTitleBlocks();
    this.renderSheetsSelectorDOM();

    UIToast.notificar({
      tipo: 'sucesso',
      titulo: 'Prancha Removida',
      mensagem: `A prancha "${deleted.name}" foi excluída.`,
      duracao: 2500
    });
  }

  /**
   * Atualiza automaticamente a numeração da prancha no carimbo ABNT (ex: "01/03", "02/03")
   */
  updateSheetNumbersInTitleBlocks() {
    const total = this.sheets.length;
    this.sheets.forEach((sheet, idx) => {
      const numStr = String(idx + 1).padStart(2, '0');
      const totStr = String(total).padStart(2, '0');

      if (Array.isArray(sheet.items)) {
        sheet.items.forEach(it => {
          if (it.type === 'title_block' && it.properties) {
            // O número fica só em sheetNumber; a data guarda só a data (o carimbo junta os dois)
            const curDate = it.properties.date || new Date().toLocaleDateString('pt-BR');
            it.properties.sheetNumber = `${numStr}/${totStr}`;
            it.properties.date = String(curDate).split('(')[0].trim();
          }
        });
      }
    });
  }

  /**
   * Renderiza o menu de Pranchas na barra superior do compositor (os cliques são tratados
   * pela PrintToolbar, que chama runMenuAction)
   */
  renderSheetsSelectorDOM() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('cm-print-sheets-controls');
    if (!container) return;

    const cur = this.getCurrentSheet();
    const curIndex = this.sheets.findIndex(s => s.id === this.activeSheetId) + 1;
    const total = this.sheets.length;
    const esc = PrintItemsManager.escapeHtml;

    container.innerHTML = PrintToolbar.dropdown(
      'sheets',
      `<span class="cm-ptb-sheet-name">${esc(cur?.name || 'Prancha')}</span><span class="cm-ptb-count">${curIndex}/${total}</span>`,
      PrintToolbar.renderSheetsMenu(this.sheets, this.activeSheetId),
      { triggerClass: 'cm-ptb-outline', title: 'Trocar, criar, renomear ou excluir pranchas' }
    );
  }

  /** Ações do menu de Pranchas: `switch=<id>`, `new`, `duplicate`, `rename`, `delete` */
  runMenuAction(action) {
    if (action.startsWith('switch=')) {
      this.switchToSheet(action.slice('switch='.length));
      return;
    }
    const curSheet = this.getCurrentSheet();
    if (action === 'new') {
      const nextNum = String(this.sheets.length + 1).padStart(2, '0');
      const name = prompt('Nome da nova prancha:', `Prancha ${nextNum} - Planta`);
      if (name !== null) this.createSheet(name, this.composer.paperSize.id, 'abnt');
    } else if (action === 'duplicate') {
      this.duplicateCurrentSheet();
    } else if (action === 'rename' && curSheet) {
      const name = prompt('Novo nome da prancha:', curSheet.name);
      if (name && name.trim()) this.renameSheet(curSheet.id, name);
    } else if (action === 'delete' && curSheet) {
      // Com uma prancha só, deleteSheet avisa que não é possível (sem pedir confirmação à toa)
      if (this.sheets.length <= 1 || confirm(`Tem certeza que deseja excluir a "${curSheet.name}"?`)) {
        this.deleteSheet(curSheet.id);
      }
    }
  }

  /**
   * Persiste as pranchas no LocalStorage
   */
  saveToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const key = PrintSheetsManager.STORAGE_PREFIX + this.projectId;
      localStorage.setItem(key, JSON.stringify(this.sheets));
      if (this.activeSheetId) {
        localStorage.setItem(PrintSheetsManager.ACTIVE_PREFIX + this.projectId, this.activeSheetId);
      }
      this.saveFailed = false;
      return true;
    } catch (e) {
      console.warn('[PrintSheetsManager] Falha ao persistir pranchas no LocalStorage:', e);
      // Avisa uma vez por sequência de falhas (o salvamento automático tenta a cada edição)
      if (!this.saveFailed) {
        UIToast.notificar({
          tipo: 'erro',
          titulo: 'Prancha não salva',
          mensagem: 'O espaço de armazenamento do navegador acabou. Remova ou troque imagens grandes da prancha; as próximas edições não serão gravadas até lá.',
          duracao: 8000
        });
      }
      this.saveFailed = true;
      return false;
    }
  }

  /**
   * Pré-definições de folha do projeto: { id, name, paperSizeId, margins (null = ABNT), showFrame }
   */
  loadPresets() {
    if (typeof localStorage === 'undefined') return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(PrintSheetsManager.PRESETS_PREFIX + this.projectId) || '[]');
      return Array.isArray(parsed) ? parsed.filter(p => p && p.id && p.paperSizeId) : [];
    } catch (e) {
      return [];
    }
  }

  savePresets(presets) {
    if (typeof localStorage === 'undefined') return false;
    try {
      localStorage.setItem(PrintSheetsManager.PRESETS_PREFIX + this.projectId, JSON.stringify(presets));
      return true;
    } catch (e) {
      console.warn('[PrintSheetsManager] Falha ao salvar pré-definições:', e);
      return false;
    }
  }

  /** Grava a folha atual (papel, margens e moldura) como pré-definição; mesmo nome substitui */
  addPreset(name, paperSize, showFrame) {
    const cleanName = String(name || '').trim().slice(0, 60);
    if (!cleanName || !paperSize?.id) return null;
    const preset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      paperSizeId: paperSize.id,
      margins: paperSize.margins ? { ...PrintItemsManager.sheetMargins(paperSize) } : null,
      showFrame: showFrame !== false
    };
    const presets = this.loadPresets().filter(p => p.name.toLowerCase() !== cleanName.toLowerCase());
    presets.push(preset);
    return this.savePresets(presets) ? preset : null;
  }

  deletePreset(presetId) {
    const presets = this.loadPresets();
    const next = presets.filter(p => p.id !== presetId);
    if (next.length === presets.length) return false;
    return this.savePresets(next);
  }

  /** Biblioteca de impressão do projeto: { filters: [], viewTemplates: [] } */
  loadLibrary(projectId = this.projectId) {
    const empty = { filters: [], viewTemplates: [] };
    if (typeof localStorage === 'undefined') return empty;
    try {
      const parsed = JSON.parse(localStorage.getItem(PrintSheetsManager.LIBRARY_PREFIX + projectId) || 'null');
      if (!parsed || typeof parsed !== 'object') return empty;
      return {
        filters: Array.isArray(parsed.filters) ? parsed.filters.filter(f => f && f.id) : [],
        viewTemplates: Array.isArray(parsed.viewTemplates) ? parsed.viewTemplates.filter(t => t && t.id) : []
      };
    } catch (e) {
      return empty;
    }
  }

  saveLibrary(library) {
    if (typeof localStorage === 'undefined') return false;
    try {
      localStorage.setItem(PrintSheetsManager.LIBRARY_PREFIX + this.projectId, JSON.stringify({
        filters: library?.filters || [],
        viewTemplates: library?.viewTemplates || []
      }));
      return true;
    } catch (e) {
      console.warn('[PrintSheetsManager] Biblioteca não salva:', e);
      return false;
    }
  }

  /** Pré-definição idêntica à folha atual (para mostrá-la selecionada), ou null */
  findMatchingPreset(paperSize, showFrame) {
    const cur = PrintItemsManager.sheetMargins(paperSize);
    return this.loadPresets().find(p => {
      if (p.paperSizeId !== paperSize.id || (p.showFrame !== false) !== (showFrame !== false)) return false;
      const m = PrintItemsManager.sheetMargins({ ...paperSize, margins: p.margins || undefined });
      return ['top', 'right', 'bottom', 'left'].every(k => m[k] === cur[k]);
    }) || null;
  }

  loadActiveSheetId() {
    if (typeof localStorage === 'undefined') return null;
    try {
      return localStorage.getItem(PrintSheetsManager.ACTIVE_PREFIX + this.projectId);
    } catch (e) {
      return null;
    }
  }

  /**
   * Carrega as pranchas do LocalStorage
   */
  loadSheetsFromStorage() {
    if (typeof localStorage === 'undefined') return null;
    try {
      const key = PrintSheetsManager.STORAGE_PREFIX + this.projectId;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch (e) {
      console.warn('[PrintSheetsManager] Falha ao carregar pranchas:', e);
      return null;
    }
  }
}
