/* ==========================================================================
   ConecteMapas - PrintDrawingEditor
   Editor do item "Desenho": o `<ui-editor-prancha>` do kit (prancha, paleta, camadas,
   propriedades e formas prontas, já ligados) numa camada sobre o layout. Só a COLA fica
   aqui: abrir com os elementos do item, e ao concluir gravar no item (um passo de
   histórico) e deixar a caixa do item acompanhar o desenho.

   O componente do kit é carregado sob demanda (o layout só precisa do núcleo para pintar).
   ========================================================================== */

import './PrintDrawingEditor.css';
import { UIToast } from '@thibezer/ui-components-kit';
import { PrintDrawing } from './PrintDrawing.js';
import { PrintItemsManager } from './PrintItemsManager.js';

const esc = (s) => PrintItemsManager.escapeHtml(String(s ?? ''));

export class PrintDrawingEditor {
  constructor(composer, item) {
    this.composer = composer;
    this.itemId = item.id;
    this.root = null;
    this.editor = null;
    this.closed = false;
  }

  isOpen() { return !this.closed && Boolean(this.root); }

  /** Abre o editor; devolve null se não pode editar (só visualizando, bloqueado, já aberto) */
  static open(composer, item) {
    if (!composer || !item || item.type !== 'drawing') return null;
    if (composer.drawingEditor?.isOpen()) return composer.drawingEditor;
    if (composer.readOnly) {
      UIToast.notificar({ tipo: 'aviso', titulo: 'Somente visualização', mensagem: 'Outro operador está editando esta prancha.', duracao: 3000 });
      return null;
    }
    if (item.locked) return null;
    const editor = new PrintDrawingEditor(composer, item);
    // Já marcado como aberto: as teclas da prancheta ficam bloqueadas enquanto o componente do kit carrega
    composer.drawingEditor = editor;
    editor.mount(item);
    return editor;
  }

  async mount(item) {
    const c = this.composer;
    const host = document.getElementById('cm-print-composer-modal') || document.body;
    const root = document.createElement('div');
    root.className = 'cm-de-overlay';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Editor de desenho');
    root.innerHTML = `
      <header class="cm-de-bar">
        <strong class="cm-de-title">Editar desenho · ${esc(item.name || 'Desenho')}</strong>
        <span class="cm-de-hint">Duplo clique edita âncoras · Ctrl+Z desfaz · Esc cancela o gesto, e depois sai</span>
      </header>
      <div class="cm-de-body"></div>`;
    host.appendChild(root);
    this.root = root;
    try {
      await import('@thibezer/ui-components-kit/prancha');
      await customElements.whenDefined('ui-editor-prancha');
    } catch (err) {
      console.error('[PrintDrawingEditor] Falha ao carregar o editor do kit:', err);
      UIToast.notificar({ tipo: 'erro', titulo: 'Editor indisponível', mensagem: err?.message || 'Não foi possível carregar o editor de desenho.', duracao: 4000 });
      this.close(false);
      return;
    }
    if (this.closed) return;

    const paper = c.paperSize;
    const m = PrintItemsManager.sheetMargins(paper);
    const ed = document.createElement('ui-editor-prancha');
    ed.className = 'cm-de-editor';
    ed.setAttribute('largura', String(paper.width));
    ed.setAttribute('altura', String(paper.height));
    ed.setAttribute('margens', `${m.left} ${m.right} ${m.top} ${m.bottom}`);
    ed.setAttribute('grade', '10');
    ed.setAttribute('mostrar-grade', '');
    ed.setAttribute('ajustar-ao-abrir', item.elements?.length ? 'conteudo' : 'folha');
    root.querySelector('.cm-de-body').appendChild(ed);
    this.editor = ed;

    ed.addEventListener('editor-concluir', (e) => this.finish(e.detail));
    ed.addEventListener('editor-cancelar', () => this.close(false));
    // Esc na barra (fora do editor) também sai
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !e.composedPath().includes(ed)) { e.stopPropagation(); this.close(false); }
    });

    if (Array.isArray(item.layers)) ed.camadas = item.layers;
    ed.elementos = PrintDrawing.toSheetElements(item);
    await ed.pronto;
    ed.focus();
  }

  /** Concluir: grava no item, com a caixa ajustada ao desenho, num único passo de histórico */
  finish(detail) {
    const c = this.composer;
    const item = c.items.find(i => i.id === this.itemId);
    if (item && detail?.modificado !== false) {
      PrintDrawing.commit(item, detail.elementos || [], 0, 0);
      if (Array.isArray(detail.camadas) && detail.camadas.length) item.layers = detail.camadas;
      else delete item.layers;
      c.updateItemPositionDOM?.(item);
      c.refreshItemContent?.(item);
      c.updatePropertiesPanel?.();
      c.pushHistoryState?.('Editar Desenho');
    }
    this.close(false);
  }

  /** Fecha o editor sem gravar (a gravação, quando há, já foi feita em `finish`) */
  close() {
    if (this.closed) return;
    this.closed = true;
    const c = this.composer;
    this.root?.remove();
    this.root = null;
    this.editor = null;
    if (c.drawingEditor === this) c.drawingEditor = null;
  }
}
