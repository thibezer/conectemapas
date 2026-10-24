/* ==========================================================================
   ConecteMapas - PrintAlignmentHelper
   Responsabilidade Única: Operações de Alinhamento Rápido, Centralização na Folha,
   Distribuição Espacial e Reordenação de Camadas (Z-Index) para Itens da Prancha.
   ========================================================================== */

export class PrintAlignmentHelper {
  /**
   * Alinha item(ns) à esquerda
   */
  static alignLeft(composer) {
    const item = composer.items.find(i => i.id === composer.selectedItemId);
    if (!item || item.locked) return;

    const minX = composer.showAbntMargins ? composer.paperSize.marginL : 0;
    item.x = minX;
    composer.updateItemPositionDOM(item);
    composer.updatePropertiesPanel();
    composer.pushHistoryState('Alinhar à Esquerda');
  }

  /**
   * Alinha item(ns) ao centro horizontal da folha
   */
  static alignCenterH(composer) {
    const item = composer.items.find(i => i.id === composer.selectedItemId);
    if (!item || item.locked) return;

    item.x = Math.max(0, Math.round((composer.paperSize.width - item.width) / 2));
    composer.updateItemPositionDOM(item);
    composer.updatePropertiesPanel();
    composer.pushHistoryState('Centralizar Horizontalmente');
  }

  /**
   * Alinha item(ns) à direita
   */
  static alignRight(composer) {
    const item = composer.items.find(i => i.id === composer.selectedItemId);
    if (!item || item.locked) return;

    const maxX = composer.showAbntMargins
      ? composer.paperSize.width - composer.paperSize.marginO - item.width
      : composer.paperSize.width - item.width;
    item.x = Math.max(0, maxX);
    composer.updateItemPositionDOM(item);
    composer.updatePropertiesPanel();
    composer.pushHistoryState('Alinhar à Direita');
  }

  /**
   * Alinha item(ns) ao topo
   */
  static alignTop(composer) {
    const item = composer.items.find(i => i.id === composer.selectedItemId);
    if (!item || item.locked) return;

    const minY = composer.showAbntMargins ? composer.paperSize.marginO : 0;
    item.y = minY;
    composer.updateItemPositionDOM(item);
    composer.updatePropertiesPanel();
    composer.pushHistoryState('Alinhar ao Topo');
  }

  /**
   * Alinha item(ns) ao centro vertical da folha
   */
  static alignCenterV(composer) {
    const item = composer.items.find(i => i.id === composer.selectedItemId);
    if (!item || item.locked) return;

    item.y = Math.max(0, Math.round((composer.paperSize.height - item.height) / 2));
    composer.updateItemPositionDOM(item);
    composer.updatePropertiesPanel();
    composer.pushHistoryState('Centralizar Verticalmente');
  }

  /**
   * Alinha item(ns) à base (inferior)
   */
  static alignBottom(composer) {
    const item = composer.items.find(i => i.id === composer.selectedItemId);
    if (!item || item.locked) return;

    const maxY = composer.showAbntMargins
      ? composer.paperSize.height - composer.paperSize.marginO - item.height
      : composer.paperSize.height - item.height;
    item.y = Math.max(0, maxY);
    composer.updateItemPositionDOM(item);
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
   * Duplica o item selecionado
   */
  static duplicateItem(composer) {
    const item = composer.items.find(i => i.id === composer.selectedItemId);
    if (!item) return;

    const ts = Date.now();
    const clone = JSON.parse(JSON.stringify(item));
    clone.id = `item-${item.type}-${ts}`;
    clone.name = `${item.name || 'Item'} (Cópia)`;
    // Desloca 5mm em X e Y se couber na folha
    clone.x = Math.min(composer.paperSize.width - clone.width, item.x + 5);
    clone.y = Math.min(composer.paperSize.height - clone.height, item.y + 5);
    clone.locked = false;

    composer.items.push(clone);
    composer.renderAllItems();
    composer.selectItem(clone.id);
    composer.pushHistoryState('Duplicar Item');
  }
}
