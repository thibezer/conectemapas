/* ==========================================================================
   ConecteMapas - PrintAlignmentHelper
   Responsabilidade Única: Operações de Alinhamento Rápido, Centralização na Folha,
   Distribuição Espacial e Reordenação de Camadas (Z-Index) para Itens da Prancha.
   Suporta seleção única (alinha na folha/margens) e múltipla (alinha entre itens).
   ========================================================================== */

import { PrintItemsManager } from './PrintItemsManager.js';

export class PrintAlignmentHelper {
  /**
   * Obtém itens selecionados (único ou múltiplo)
   */
  static getSelectedItems(composer) {
    if (typeof composer.getSelectedItems === 'function') {
      const items = composer.getSelectedItems();
      if (items && items.length > 0) return items;
    }
    const item = composer.items.find(i => i.id === composer.selectedItemId);
    return item ? [item] : [];
  }

  /**
   * Alinha item(ns) à esquerda
   */
  static alignLeft(composer) {
    const items = this.getSelectedItems(composer).filter(i => !i.locked);
    if (!items.length) return;

    if (items.length === 1) {
      const minX = composer.showAbntMargins ? PrintItemsManager.sheetMargins(composer.paperSize).left : 0;
      items[0].x = minX;
      composer.updateItemPositionDOM(items[0]);
    } else {
      const minX = Math.min(...items.map(i => i.x));
      items.forEach(it => {
        it.x = minX;
        composer.updateItemPositionDOM(it);
      });
    }

    composer.updatePropertiesPanel();
    composer.pushHistoryState('Alinhar à Esquerda');
  }

  /**
   * Alinha item(ns) ao centro horizontal
   */
  static alignCenterH(composer) {
    const items = this.getSelectedItems(composer).filter(i => !i.locked);
    if (!items.length) return;

    if (items.length === 1) {
      items[0].x = Math.max(0, Math.round((composer.paperSize.width - items[0].width) / 2));
      composer.updateItemPositionDOM(items[0]);
    } else {
      const minX = Math.min(...items.map(i => i.x));
      const maxRight = Math.max(...items.map(i => i.x + i.width));
      const midX = (minX + maxRight) / 2;
      items.forEach(it => {
        it.x = Math.max(0, Math.round(midX - it.width / 2));
        composer.updateItemPositionDOM(it);
      });
    }

    composer.updatePropertiesPanel();
    composer.pushHistoryState('Centralizar Horizontalmente');
  }

  /**
   * Alinha item(ns) à direita
   */
  static alignRight(composer) {
    const items = this.getSelectedItems(composer).filter(i => !i.locked);
    if (!items.length) return;

    if (items.length === 1) {
      const maxX = composer.showAbntMargins
        ? composer.paperSize.width - PrintItemsManager.sheetMargins(composer.paperSize).right - items[0].width
        : composer.paperSize.width - items[0].width;
      items[0].x = Math.max(0, maxX);
      composer.updateItemPositionDOM(items[0]);
    } else {
      const maxRight = Math.max(...items.map(i => i.x + i.width));
      items.forEach(it => {
        it.x = Math.max(0, maxRight - it.width);
        composer.updateItemPositionDOM(it);
      });
    }

    composer.updatePropertiesPanel();
    composer.pushHistoryState('Alinhar à Direita');
  }

  /**
   * Alinha item(ns) ao topo
   */
  static alignTop(composer) {
    const items = this.getSelectedItems(composer).filter(i => !i.locked);
    if (!items.length) return;

    if (items.length === 1) {
      const minY = composer.showAbntMargins ? PrintItemsManager.sheetMargins(composer.paperSize).top : 0;
      items[0].y = minY;
      composer.updateItemPositionDOM(items[0]);
    } else {
      const minY = Math.min(...items.map(i => i.y));
      items.forEach(it => {
        it.y = minY;
        composer.updateItemPositionDOM(it);
      });
    }

    composer.updatePropertiesPanel();
    composer.pushHistoryState('Alinhar ao Topo');
  }

  /**
   * Alinha item(ns) ao centro vertical
   */
  static alignCenterV(composer) {
    const items = this.getSelectedItems(composer).filter(i => !i.locked);
    if (!items.length) return;

    if (items.length === 1) {
      items[0].y = Math.max(0, Math.round((composer.paperSize.height - items[0].height) / 2));
      composer.updateItemPositionDOM(items[0]);
    } else {
      const minY = Math.min(...items.map(i => i.y));
      const maxBottom = Math.max(...items.map(i => i.y + i.height));
      const midY = (minY + maxBottom) / 2;
      items.forEach(it => {
        it.y = Math.max(0, Math.round(midY - it.height / 2));
        composer.updateItemPositionDOM(it);
      });
    }

    composer.updatePropertiesPanel();
    composer.pushHistoryState('Centralizar Verticalmente');
  }

  /**
   * Alinha item(ns) à base (inferior)
   */
  static alignBottom(composer) {
    const items = this.getSelectedItems(composer).filter(i => !i.locked);
    if (!items.length) return;

    if (items.length === 1) {
      const maxY = composer.showAbntMargins
        ? composer.paperSize.height - PrintItemsManager.sheetMargins(composer.paperSize).bottom - items[0].height
        : composer.paperSize.height - items[0].height;
      items[0].y = Math.max(0, maxY);
      composer.updateItemPositionDOM(items[0]);
    } else {
      const maxBottom = Math.max(...items.map(i => i.y + i.height));
      items.forEach(it => {
        it.y = Math.max(0, maxBottom - it.height);
        composer.updateItemPositionDOM(it);
      });
    }

    composer.updatePropertiesPanel();
    composer.pushHistoryState('Alinhar à Base');
  }

  /**
   * Traz o item para a frente (frente da pilha visual)
   */
  static bringToFront(composer) {
    const idx = composer.items.findIndex(i => i.id === composer.selectedItemId);
    if (idx === -1 || idx === composer.items.length - 1) return;

    const [item] = composer.items.splice(idx, 1);
    composer.items.push(item);
    composer.applyItemStacking();
    composer.selectItem(item.id);
    composer.pushHistoryState('Trazer para Frente');
  }

  /**
   * Envia o item para trás (fundo da pilha visual)
   */
  static sendToBack(composer) {
    const idx = composer.items.findIndex(i => i.id === composer.selectedItemId);
    if (idx === -1 || idx === 0) return;

    const [item] = composer.items.splice(idx, 1);
    composer.items.unshift(item);
    composer.applyItemStacking();
    composer.selectItem(item.id);
    composer.pushHistoryState('Enviar para Trás');
  }

  /**
   * Avança 1 nível na pilha visual
   */
  static bringForward(composer) {
    const idx = composer.items.findIndex(i => i.id === composer.selectedItemId);
    if (idx === -1 || idx === composer.items.length - 1) return;

    const temp = composer.items[idx];
    composer.items[idx] = composer.items[idx + 1];
    composer.items[idx + 1] = temp;
    composer.applyItemStacking();
    composer.selectItem(temp.id);
    composer.pushHistoryState('Avançar Camada');
  }

  /**
   * Recua 1 nível na pilha visual
   */
  static sendBackward(composer) {
    const idx = composer.items.findIndex(i => i.id === composer.selectedItemId);
    if (idx === -1 || idx === 0) return;

    const temp = composer.items[idx];
    composer.items[idx] = composer.items[idx - 1];
    composer.items[idx - 1] = temp;
    composer.applyItemStacking();
    composer.selectItem(temp.id);
    composer.pushHistoryState('Recuar Camada');
  }

  /**
   * Duplica o item selecionado (ou itens selecionados em lote)
   */
  static duplicateItem(composer) {
    const items = this.getSelectedItems(composer);
    if (!items.length) return;

    const ts = Date.now();
    const newItems = [];
    items.forEach((item, idx) => {
      const clone = JSON.parse(JSON.stringify(item));
      clone.id = `item-${item.type}-${ts}-${idx}`;
      clone.name = `${item.name || 'Item'} (Cópia)`;
      clone.x = Math.min(composer.paperSize.width - clone.width, item.x + 5);
      clone.y = Math.min(composer.paperSize.height - clone.height, item.y + 5);
      clone.locked = false;
      composer.items.push(clone);
      newItems.push(clone);
    });

    composer.renderAllItems();
    if (newItems.length === 1) {
      composer.selectItem(newItems[0].id);
    } else {
      if (typeof composer.selectItems === 'function') {
        composer.selectItems(newItems.map(i => i.id));
      } else {
        composer.selectItem(newItems[0].id);
      }
    }
    composer.pushHistoryState(items.length > 1 ? `Duplicar ${items.length} Itens` : 'Duplicar Item');
  }

  /**
   * Distribui 3 ou mais itens horizontalmente com espaçamento uniforme
   */
  static distributeH(composer) {
    const items = this.getSelectedItems(composer).filter(i => !i.locked);
    if (items.length < 3) return;

    const sorted = [...items].sort((a, b) => a.x - b.x);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const minX = first.x;
    const maxX = last.x + last.width;
    const totalItemWidths = sorted.reduce((sum, it) => sum + it.width, 0);
    const availableGap = maxX - minX - totalItemWidths;
    const gap = availableGap / (sorted.length - 1);

    let currentX = minX;
    sorted.forEach((it, idx) => {
      if (idx > 0 && idx < sorted.length - 1) {
        it.x = Math.round(currentX * 10) / 10;
        composer.updateItemPositionDOM(it);
      }
      currentX += it.width + gap;
    });

    composer.updatePropertiesPanel();
    composer.pushHistoryState('Distribuir Horizontalmente');
  }

  /**
   * Distribui 3 ou mais itens verticalmente com espaçamento uniforme
   */
  static distributeV(composer) {
    const items = this.getSelectedItems(composer).filter(i => !i.locked);
    if (items.length < 3) return;

    const sorted = [...items].sort((a, b) => a.y - b.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const minY = first.y;
    const maxY = last.y + last.height;
    const totalItemHeights = sorted.reduce((sum, it) => sum + it.height, 0);
    const availableGap = maxY - minY - totalItemHeights;
    const gap = availableGap / (sorted.length - 1);

    let currentY = minY;
    sorted.forEach((it, idx) => {
      if (idx > 0 && idx < sorted.length - 1) {
        it.y = Math.round(currentY * 10) / 10;
        composer.updateItemPositionDOM(it);
      }
      currentY += it.height + gap;
    });

    composer.updatePropertiesPanel();
    composer.pushHistoryState('Distribuir Verticalmente');
  }

  /** Helper comum após alterações de posição/dimensão em lote */
  static _commitBatchLayout(composer, items, historyLabel) {
    items.forEach(it => {
      if (composer.paperSize) PrintItemsManager.clampItemToPaper(it, composer.paperSize);
      composer.updateItemPositionDOM?.(it);
      composer.refreshItemContent?.(it.id);
    });
    composer.updatePropertiesPanel?.();
    composer.pushHistoryState?.(historyLabel);
  }

  /** Iguala largura, altura ou ambas usando o primeiro item selecionado como referência */
  static _matchDimension(composer, mode) {
    const selected = this.getSelectedItems(composer);
    if (selected.length < 2) return;
    const ref = selected[0];
    const unlocked = selected.filter(i => !i.locked && i.id !== ref.id);
    if (!unlocked.length) return;
    unlocked.forEach(it => {
      if (mode === 'width' || mode === 'both') it.width = ref.width;
      if (mode === 'height' || mode === 'both') it.height = ref.height;
    });
    const labels = { width: 'Igualar Largura', height: 'Igualar Altura', both: 'Igualar Tamanho' };
    this._commitBatchLayout(composer, unlocked, labels[mode] || 'Igualar Dimensão');
  }

  static matchWidth(composer) { return this._matchDimension(composer, 'width'); }
  static matchHeight(composer) { return this._matchDimension(composer, 'height'); }
  static matchSize(composer) { return this._matchDimension(composer, 'both'); }

  /** Empilha itens selecionados em sequência vertical (sem espaçamento ou com intervalo fixo) */
  static packVertical(composer, gapMm = 0) {
    const items = this.getSelectedItems(composer).filter(i => !i.locked);
    if (items.length < 2) return;
    const sorted = [...items].sort((a, b) => a.y - b.y);
    let cursorY = sorted[0].y + sorted[0].height + gapMm;
    for (let i = 1; i < sorted.length; i++) {
      sorted[i].y = Math.round(cursorY * 10) / 10;
      cursorY = sorted[i].y + sorted[i].height + gapMm;
    }
    this._commitBatchLayout(composer, sorted, 'Empilhar Verticalmente');
  }

  /** Empilha itens selecionados lado a lado em sequência horizontal */
  static packHorizontal(composer, gapMm = 0) {
    const items = this.getSelectedItems(composer).filter(i => !i.locked);
    if (items.length < 2) return;
    const sorted = [...items].sort((a, b) => a.x - b.x);
    let cursorX = sorted[0].x + sorted[0].width + gapMm;
    for (let i = 1; i < sorted.length; i++) {
      sorted[i].x = Math.round(cursorX * 10) / 10;
      cursorX = sorted[i].x + sorted[i].width + gapMm;
    }
    this._commitBatchLayout(composer, sorted, 'Empilhar Horizontalmente');
  }

  /** Encaixa o item selecionado dentro das margens úteis da folha */
  static fitToMargins(composer) {
    const items = this.getSelectedItems(composer).filter(i => !i.locked);
    if (!items.length || !composer.paperSize) return;
    const m = PrintItemsManager.sheetMargins(composer.paperSize);
    const w = Math.max(PrintItemsManager.MIN_ITEM_MM, composer.paperSize.width - m.left - m.right);
    const h = Math.max(PrintItemsManager.MIN_ITEM_MM, composer.paperSize.height - m.top - m.bottom);
    items.forEach(it => {
      it.x = m.left;
      it.y = m.top;
      it.width = w;
      it.height = h;
    });
    this._commitBatchLayout(composer, items, 'Ajustar às Margens');
  }
}
