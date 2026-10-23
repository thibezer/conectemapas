/* ==========================================================================
   ConecteMapas - PrintSheetsManager
   Responsabilidade Única: Gestão de Múltiplas Pranchas no Projeto de Impressão,
   criação, duplicação, exclusão, alternância, numeração ABNT e persistência local/IndexedDB.
   ========================================================================== */

import { PrintItemsManager } from './PrintItemsManager.js';
import { UIToast } from '@thibezer/ui-components-kit';

export class PrintSheetsManager {
  static STORAGE_PREFIX = 'cm_print_sheets_';

  constructor(composer) {
    this.composer = composer;
    this.projectId = 'projeto_padrao';
    this.sheets = [];
    this.activeSheetId = null;
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
      this.activeSheetId = this.sheets[0].id;
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
    return this.getCurrentSheet();
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
   * Alterna para outra prancha do projeto
   */
  switchToSheet(sheetId) {
    if (this.activeSheetId === sheetId) return;

    // Salva a prancha atual antes de trocar
    this.saveCurrentStateFromComposer();

    const target = this.sheets.find(s => s.id === sheetId);
    if (!target) return;

    this.activeSheetId = target.id;

    // Carrega na UI do compositor
    this.composer.paperSize = target.paperSize;
    this.composer.showAbntMargins = target.showAbntMargins !== false;
    this.composer.items = JSON.parse(JSON.stringify(target.items || []));
    this.composer.selectedItemId = (this.composer.items.find(i => i.type === 'map') || this.composer.items[0])?.id || null;

    // Atualiza badges e UI
    const badge = document.getElementById('cm-print-paper-badge');
    if (badge) badge.textContent = this.composer.paperSize.name;

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

    const paperSize = this.composer.paperSizes[paperSizeKey] || this.composer.paperSizes.A4_L;
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
          x: paperSize.marginL || 25,
          y: paperSize.marginO || 7,
          width: paperSize.width - (paperSize.marginL || 25) - (paperSize.marginO || 7),
          height: paperSize.height - (paperSize.marginO || 7) * 2,
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
      const target = this.sheets[nextIndex];
      this.composer.paperSize = target.paperSize;
      this.composer.showAbntMargins = target.showAbntMargins !== false;
      this.composer.items = JSON.parse(JSON.stringify(target.items || []));
      this.composer.selectedItemId = this.composer.items[0]?.id || null;
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
      const pranchaTag = `(${numStr}/${totStr})`;

      if (Array.isArray(sheet.items)) {
        sheet.items.forEach(it => {
          if (it.type === 'title_block' && it.properties) {
            const curDate = it.properties.date || new Date().toLocaleDateString('pt-BR');
            const cleanDate = curDate.split('(')[0].trim();
            it.properties.sheetNumber = `${numStr}/${totStr}`;
            it.properties.date = `${cleanDate} ${pranchaTag}`;
          }
        });
      }
    });
  }

  /**
   * Renderiza os controles de Pranchas na barra superior do compositor
   */
  renderSheetsSelectorDOM() {
    const container = document.getElementById('cm-print-sheets-controls');
    if (!container) return;

    const cur = this.getCurrentSheet();
    const curIndex = this.sheets.findIndex(s => s.id === this.activeSheetId) + 1;
    const total = this.sheets.length;

    container.innerHTML = `
      <div class="cm-print-sheets-bar" style="display: flex; align-items: center; gap: 4px;">
        <span class="cm-tb-label" style="font-size: 11px; color: #a0a0b0; font-weight: 600;">📑 Prancha:</span>
        <select id="cm-print-sheet-select" class="cm-native-select cm-print-sheet-dropdown" style="max-width: 170px; height: 28px; font-size: 11.5px; font-weight: 600; color: #fff; background: #22222a; border-color: rgba(255,255,255,0.15);">
          ${this.sheets.map((s, i) => `
            <option value="${s.id}" ${s.id === this.activeSheetId ? 'selected' : ''}>
              ${i + 1}/${total} - ${PrintItemsManager.escapeHtml(s.name)}
            </option>
          `).join('')}
        </select>

        <button class="cm-print-tool-btn" id="btn-add-new-sheet" title="Adicionar Nova Prancha ao Projeto" style="height: 28px; padding: 0 6px;">
          ➕ <span class="cm-tb-label">Nova</span>
        </button>
        <button class="cm-print-tool-btn" id="btn-duplicate-sheet" title="Duplicar Prancha Atual" style="height: 28px; padding: 0 6px;">
          📋 <span class="cm-tb-label">Duplicar</span>
        </button>
        <button class="cm-print-tool-btn" id="btn-rename-sheet" title="Renomear Prancha Atual" style="height: 28px; padding: 0 6px;">
          ✏️
        </button>
        ${total > 1 ? `
          <button class="cm-print-tool-btn" id="btn-delete-sheet" title="Excluir Prancha Atual" style="height: 28px; padding: 0 6px; color: #ff6b6b;">
            🗑️
          </button>
        ` : ''}
      </div>
    `;

    // Eventos
    const select = document.getElementById('cm-print-sheet-select');
    if (select) {
      select.onchange = (e) => this.switchToSheet(e.target.value);
    }

    const btnAdd = document.getElementById('btn-add-new-sheet');
    if (btnAdd) {
      btnAdd.onclick = () => {
        const nextNum = String(this.sheets.length + 1).padStart(2, '0');
        const name = prompt('Nome da nova prancha:', `Prancha ${nextNum} - Planta`);
        if (name !== null) {
          this.createSheet(name, this.composer.paperSize.id, 'abnt');
        }
      };
    }

    const btnDup = document.getElementById('btn-duplicate-sheet');
    if (btnDup) {
      btnDup.onclick = () => this.duplicateCurrentSheet();
    }

    const btnRen = document.getElementById('btn-rename-sheet');
    if (btnRen) {
      btnRen.onclick = () => {
        const curSheet = this.getCurrentSheet();
        if (!curSheet) return;
        const name = prompt('Novo nome da prancha:', curSheet.name);
        if (name && name.trim()) {
          this.renameSheet(curSheet.id, name);
        }
      };
    }

    const btnDel = document.getElementById('btn-delete-sheet');
    if (btnDel) {
      btnDel.onclick = () => {
        const curSheet = this.getCurrentSheet();
        if (!curSheet) return;
        if (confirm(`Tem certeza que deseja excluir a "${curSheet.name}"?`)) {
          this.deleteSheet(curSheet.id);
        }
      };
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
    } catch (e) {
      console.warn('[PrintSheetsManager] Falha ao persistir pranchas no LocalStorage:', e);
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
