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
    composer.renderAllItems();
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
    composer.renderAllItems();
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
    composer.renderAllItems();
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
    composer.renderAllItems();
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
}
