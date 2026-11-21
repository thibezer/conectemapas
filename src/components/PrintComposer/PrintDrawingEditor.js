/* ==========================================================================
   ConecteMapas - PrintDrawingEditor
   Editor do item "Desenho": a folha inteira num <ui-canvas-prancha> do kit (caneta, formas,
   alças, rotação, Pathfinder, camadas, histórico, snap), com a paleta, a lista de camadas
   e as propriedades do kit. Só a COLA fica aqui: abrir com os elementos do item, avisar o
   composer ao concluir (um passo de histórico) e a caixa do item acompanhar o desenho.
   ========================================================================== */

import './PrintDrawingEditor.css';
import {
  CAMADA_SEM_CAMADA, FERRAMENTAS_PALETA_PRANCHA, camadaDoPainel, camadasComMudanca, camadasNaOrdemDoPainel, ferramentaDaPaleta
} from '@thibezer/ui-components-kit/prancha';
import { UIToast } from '@thibezer/ui-components-kit';
import { PrintDrawing } from './PrintDrawing.js';
import { PrintItemsManager } from './PrintItemsManager.js';

const esc = (s) => PrintItemsManager.escapeHtml(String(s ?? ''));

/** Pré-definições que ocupam o quadro das margens da folha em vez de um tamanho fixo */
const FRAME_PRESETS = new Set(['retangulo', 'moldura-dupla']);

export class PrintDrawingEditor {
  constructor(composer, item) {
    this.composer = composer;
    this.itemId = item.id;
    this.root = null;
    this.prancha = null;
    this.closed = false;
    this.onKeyDown = null;
    this.initialJson = '';
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
    composer.drawingEditor = editor;
    editor.mount(item);
    return editor;
  }

  mount(item) {
    const c = this.composer;
    const host = document.getElementById('cm-print-composer-modal') || document.body;
    const paper = c.paperSize;
    const root = document.createElement('div');
    root.className = 'cm-de-overlay';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Editor de desenho');
    root.innerHTML = `
      <header class="cm-de-bar">
        <strong class="cm-de-title">Editar desenho · ${esc(item.name || 'Desenho')}</strong>
        <select class="cm-native-select cm-de-preset" id="cm-de-preset" aria-label="Inserir forma pronta">
          <option value="">Inserir forma pronta…</option>
          ${PrintDrawing.PRESETS.map(p => `<option value="${p.value}">${esc(p.label)}</option>`).join('')}
        </select>
        <span class="cm-de-bar-gap"></span>
        <span class="cm-de-hint">Duplo clique edita âncoras · Ctrl+Z desfaz · Esc cancela o gesto</span>
        <ui-botao-primario inline variante="ghost" tamanho="sm" id="cm-de-cancel">Cancelar</ui-botao-primario>
        <ui-botao-primario inline tamanho="sm" id="cm-de-ok">Concluir</ui-botao-primario>
      </header>
      <div class="cm-de-body">
        <ui-paleta-ferramentas id="cm-de-paleta" orientacao="vertical" atalhos class="cm-de-paleta"></ui-paleta-ferramentas>
        <ui-canvas-prancha id="cm-de-prancha" largura="${paper.width}" altura="${paper.height}" mostrar-grade grade="10" rotulo="Desenho: ${esc(item.name || 'Desenho')}" class="cm-de-canvas"></ui-canvas-prancha>
        <aside class="cm-de-side">
          <ui-camadas id="cm-de-camadas" densidade="compacto" mostrar-mapas-base="false" mostrar-rodape="false" persistir="false" altura="220"></ui-camadas>
          <ui-tabela-propriedades id="cm-de-props" titulo="Aparência" modo-aplicar="imediato" class="cm-de-props"></ui-tabela-propriedades>
        </aside>
      </div>`;
    host.appendChild(root);
    this.root = root;
    this.prancha = root.querySelector('#cm-de-prancha');

    root.querySelector('#cm-de-ok').addEventListener('click', () => this.close(true));
    root.querySelector('#cm-de-cancel').addEventListener('click', () => this.close(false));
    root.querySelector('#cm-de-preset').addEventListener('change', (e) => {
      const tipo = e.target.value;
      e.target.value = '';
      if (tipo) this.insertPreset(tipo);
    });
    // Esc fora do canvas (foco na barra) cancela; dentro dele o kit trata (gesto, seleção)
    this.onKeyDown = (e) => {
      if (e.key === 'Escape' && !e.composedPath().some(el => el?.tagName === 'UI-CANVAS-PRANCHA')) {
        e.stopPropagation();
        this.close(false);
      }
    };
    root.addEventListener('keydown', this.onKeyDown);

    // Os dados chegam depois do componente existir (a tag é definida pelo import do kit)
    customElements.whenDefined('ui-canvas-prancha').then(() => {
      if (this.closed) return;
      this.setupCanvas(item);
      this.wirePanels();
    });
  }

  setupCanvas(item) {
    const p = this.prancha;
    const els = PrintDrawing.toSheetElements(item);
    p.definirElementos(els);
    this.initialJson = JSON.stringify(p.obterElementos());
    // Margens da folha como guias (o quadro da prancha), para alinhar o desenho com elas
    const m = PrintItemsManager.sheetMargins(this.composer.paperSize);
    const w = this.composer.paperSize.width;
    const h = this.composer.paperSize.height;
    p.definirGuias([
      { orientacao: 'vertical', posicao: m.left }, { orientacao: 'vertical', posicao: w - m.right },
      { orientacao: 'horizontal', posicao: m.top }, { orientacao: 'horizontal', posicao: h - m.bottom }
    ]);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (this.closed) return;
      p.ajustarFolha();
      if (els.length) {
        p.selecionarTudo();
        p.ajustarSelecao();
        p.limparSelecao();
      }
      p.focus?.();
    }));
  }

  /** Pré-definição na folha: o quadro das margens (moldura) ou uma caixa de 60 × 40 mm centrada no desenho */
  insertPreset(tipo) {
    const paper = this.composer.paperSize;
    const m = PrintItemsManager.sheetMargins(paper);
    const w = paper.width, h = paper.height;
    let caixa;
    if (FRAME_PRESETS.has(tipo)) {
      caixa = { x: m.left, y: m.top, largura: w - m.left - m.right, altura: h - m.top - m.bottom };
    } else {
      // Perto do que já existe (ou do item), não no meio da folha, que pode estar longe da vista
      const item = this.composer.items.find(i => i.id === this.itemId);
      const b = PrintDrawing.contentBounds(this.prancha.obterElementos())
        || (item ? { x: item.x, y: item.y, width: item.width, height: item.height } : { x: w / 2, y: h / 2, width: 0, height: 0 });
      caixa = { x: b.x + b.width / 2 - 30, y: b.y + b.height / 2 - 20, largura: 60, altura: 40 };
    }
    this.prancha.inserirPredefinicao(tipo, caixa, { espessura: PrintDrawing.DEFAULT_STYLE.strokeMm });
  }

  /** Liga a paleta, as camadas e as propriedades do kit à prancha (mesma composição do playground do kit) */
  wirePanels() {
    const p = this.prancha;
    const q = (id) => this.root.querySelector(id);
    const paleta = q('#cm-de-paleta');
    const camadasPainel = q('#cm-de-camadas');
    const propriedades = q('#cm-de-props');

    paleta.ferramentas = FERRAMENTAS_PALETA_PRANCHA;
    paleta.valor = 'selecao';
    paleta.addEventListener('ui-change', (e) => {
      const f = ferramentaDaPaleta(e.detail.valor);
      if (f) p.definirFerramenta(f);
    });
    p.addEventListener('prancha-ferramenta', (e) => { paleta.valor = e.detail.ferramenta; });

    const refreshProps = () => { propriedades.categorias = p.categoriasDePropriedades(); };
    propriedades.addEventListener('ui-propriedade-alterada', (e) => p.aplicarPropriedade(e.detail.id, e.detail.valor));

    const refreshLayers = () => {
      const d = p.dadosParaPainelDeCamadas();
      camadasPainel.definirCamadas(d.camadas, d.feicoes);
      camadasPainel.selecionarFeicoes(p.selecao);
    };
    const changeLayer = (id, mudanca) => {
      if (id !== CAMADA_SEM_CAMADA) p.definirCamadas(camadasComMudanca(p.obterCamadas(), id, mudanca));
    };
    const on = (nome, fn) => camadasPainel.addEventListener(nome, (e) => fn(e.detail));
    on('ui-camada-visibilidade', (d) => changeLayer(d.camadaId, { visivel: d.visivel }));
    on('ui-camada-bloqueio', (d) => changeLayer(d.camadaId, { bloqueada: d.bloqueado }));
    on('ui-camada-opacidade', (d) => changeLayer(d.camadaId, { opacidade: d.opacidade }));
    on('ui-camada-renomeada', (d) => changeLayer(d.camadaId, { nome: d.novoNome }));
    on('ui-camada-selecionada', (d) => p.definirCamadaAtiva(camadaDoPainel(d.camadaId)));
    on('ui-camadas-reordenadas', (d) => p.definirCamadas(camadasNaOrdemDoPainel(p.obterCamadas(), (d.camadas || []).map(k => k.id))));
    on('ui-camada-adicionar', () => {
      const atuais = p.obterCamadas();
      p.definirCamadas([...atuais, { id: `camada-${Date.now()}`, nome: `Camada ${atuais.length + 1}` }]);
    });
    on('ui-feicao-selecionada', (d) => p.selecionarElementos([d.feicaoId]));
    on('ui-feicoes-selecionadas', (d) => p.selecionarElementos(d.feicoesIds || []));
    on('ui-feicao-visibilidade', (d) => p.alterarElementos([d.feicaoId], { oculto: !d.visivel }));
    on('ui-feicao-bloqueio', (d) => p.alterarElementos([d.feicaoId], { bloqueado: d.bloqueado }));
    on('ui-feicao-renomeada', (d) => p.alterarElementos([d.feicaoId], { nome: d.novoNome }));
    on('ui-feicao-movida', (d) => p.alterarElementos([d.feicaoId], { camadaId: camadaDoPainel(d.camadaDestinoId) }));

    ['prancha-elemento-criado', 'prancha-elemento-atualizado', 'prancha-elemento-removido', 'prancha-ordem', 'prancha-camadas']
      .forEach(nome => p.addEventListener(nome, () => { refreshLayers(); refreshProps(); }));
    p.addEventListener('prancha-selecao', () => { camadasPainel.selecionarFeicoes(p.selecao); refreshProps(); });
    refreshLayers();
    refreshProps();
  }

  /**
   * Fecha o editor. `commit`: grava os elementos no item (a caixa do item passa a ser o envelope do desenho) num único
   * passo de histórico; sem mudança nada é gravado.
   */
  close(commit) {
    if (this.closed) return;
    this.closed = true;
    const c = this.composer;
    const item = c.items.find(i => i.id === this.itemId);
    try {
      if (commit && item && this.prancha?.obterElementos) {
        const els = this.prancha.obterElementos();
        if (JSON.stringify(els) !== this.initialJson) {
          PrintDrawing.commit(item, els, 0, 0);
          c.updateItemPositionDOM?.(item);
          c.refreshItemContent?.(item);
          c.updatePropertiesPanel?.();
          c.pushHistoryState?.('Editar Desenho');
        }
      }
    } finally {
      this.root?.removeEventListener('keydown', this.onKeyDown);
      this.root?.remove();
      this.root = null;
      this.prancha = null;
      if (c.drawingEditor === this) c.drawingEditor = null;
    }
  }
}
