/* ==========================================================================
   ConecteMapas - ModifyActionsController
   Executa os comandos da aba "Modificar" da ribbon sobre a seleção atual e
   mantém a aba sincronizada (habilitação, rótulos, ferramenta ativa).
   Não implementa geometria nova: cada comando reaproveita o que o HUD, o menu de
   contexto, o inspetor e a barra de desenho já usam, para que todos se comportem igual.
   ========================================================================== */

import { UIToast } from '@thibezer/ui-components-kit';
import { SpatialAlgorithms } from '../services/SpatialAlgorithms.js';
import { GeoFormats } from '../services/GeoFormats.js';
import { AppGeometryCoordinator } from '../bootstrap/AppGeometryCoordinator.js';
import { FeatureSyncController } from './FeatureSyncController.js';
import { SelectionStyleController } from './SelectionStyleController.js';
import { ShortcutsController } from './ShortcutsController.js';
import { MODIFY_LAYER_PREFIX, computeModifyState } from '../components/ModifyRibbon.js';

/** Comandos que são só um atalho para uma ação da barra de desenho (fonte única do comportamento). */
const TOOLBAR_ACTIONS = {
  'mod-clear': 'clear-selection',
  'mod-join': 'join',
  'mod-join-bridge': 'join-bridge',
  'mod-delete': 'delete-feature',
  'mod-undo': 'undo',
  'mod-redo': 'redo',
  'mod-fit': 'fit'
};

/** Comandos que ligam/desligam uma ferramenta do mapa (clicar de novo volta para a seleção). */
const TOOLS = {
  'mod-lasso': 'pen-select',
  'mod-eyedropper': 'eyedropper',
  'mod-split': 'split',
  'mod-measure': 'measure'
};

export class ModifyActionsController {
  /** Seleção atual com as versões mais recentes das feições (o HUD pode guardar cópias antigas). */
  static getSelection(app) {
    const byId = new Map((app.features || []).map(f => [f.id, f]));
    return SelectionStyleController.getSelectedFeatures(app)
      .map(f => byId.get(f.id))
      .filter(Boolean);
  }

  /** Recalcula o estado da aba e entrega à HeaderBar. */
  static sync(app) {
    if (!app.headerBar?.syncModify) return;
    const features = this.getSelection(app);
    app.headerBar.syncModify(computeModifyState({
      features,
      layers: app.layers || [],
      history: { undo: app.historyUndo?.length || 0, redo: app.historyRedo?.length || 0 },
      activeTool: app.mapEngine?.activeTool || 'select'
    }), features.length > 0);
  }

  /**
   * @param {Object} app
   * @param {string} id Id do item da ribbon (`mod-*`)
   * @param {{anchor?: HTMLElement}} [ctx] anchor = botão clicado (para o seletor de cor)
   */
  static run(app, id, ctx = {}) {
    if (TOOLBAR_ACTIONS[id]) {
      app.drawingToolbar?.onAction?.(TOOLBAR_ACTIONS[id]);
      return;
    }
    if (TOOLS[id]) {
      const tool = TOOLS[id];
      const active = app.mapEngine?.activeTool === tool;
      AppGeometryCoordinator.setDrawingTool(app, active ? 'select' : tool);
      return;
    }
    if (id.startsWith(MODIFY_LAYER_PREFIX)) {
      const ids = this.getSelection(app).map(f => f.id);
      app.batchActions?.moveToLayer(ids, id.slice(MODIFY_LAYER_PREFIX.length), {});
      return;
    }

    const sel = this.getSelection(app);
    const ids = sel.map(f => f.id);
    const one = sel.length === 1 ? sel[0] : null;

    switch (id) {
      case 'mod-select-all':
        ShortcutsController.selectAll(app);
        break;
      case 'mod-zoom':
        if (sel.length) app.mapEngine?.zoomToFeatures(sel);
        break;
      case 'mod-inspect':
        if (one) app.selectionHUD?.onInspect(one);
        break;
      case 'mod-table':
        if (sel.length) app.selectionHUD?.onOpenTable(sel);
        break;
      case 'mod-popup':
        if (one) app.mapEngine?.openFeaturePopup(one.id);
        break;
      case 'mod-style':
        SelectionStyleController.openStylePicker(app, sel, ctx.anchor);
        break;
      case 'mod-invert':
        app.batchActions?.invertColors(ids);
        break;
      case 'mod-simplify':
        app.batchActions?.simplify(ids);
        break;
      case 'mod-vertices':
        if (one) app.selectionHUD?.onEditVertices(one);
        break;
      case 'mod-duplicate':
        if (one) this.duplicate(app, one);
        break;
      case 'mod-buffer':
        if (one) this.buffer(app, one);
        break;
      case 'mod-lock':
        app.batchActions?.setLocked(ids, !sel.every(f => f.locked === true));
        break;
      case 'mod-visible':
        app.batchActions?.setVisible(ids, sel.every(f => f.visible === false));
        break;
      case 'mod-copy-geojson':
        if (sel.length) this.copy(GeoFormats.toGeoJSON(sel), 'GeoJSON Copiado', `${sel.length} feição(ões) copiada(s) como GeoJSON.`);
        break;
      case 'mod-copy-wkt':
        if (one) this.copy(GeoFormats.toWKT(one), 'WKT Copiado', 'WKT copiado para a área de transferência.');
        break;
      case 'mod-copy-coords':
        if (one) this.copy(JSON.stringify(one.coordinates), 'Coordenadas Copiadas', 'Coordenadas copiadas para a área de transferência.');
        break;
      default:
        break;
    }
  }

  /** Duplica a feição deslocada 30 m e abre o modal de nova feição (igual ao menu de contexto). */
  static duplicate(app, feat) {
    const clone = SpatialAlgorithms.duplicateWithOffset(feat, 30);
    if (clone) app.newFeatureModal?.openWithFeature(clone);
  }

  /** Pergunta o raio e cria a zona de amortecimento como nova feição. */
  static buffer(app, feat) {
    const input = window.prompt(`Informe o raio do buffer em metros para "${feat.name || 'Feição'}":`, '50');
    if (input === null) return;
    const radius = parseFloat(input.trim().replace(',', '.'));
    if (!Number.isFinite(radius) || radius === 0) return;

    const buf = SpatialAlgorithms.generateBuffer(feat, radius);
    if (!buf) {
      UIToast.notificar({
        tipo: 'alerta',
        titulo: 'Falha no Buffer',
        mensagem: 'Não foi possível gerar a zona de amortecimento para esta feição.',
        duracao: 4000
      });
      return;
    }
    const created = FeatureSyncController.createFeature(app, buf);
    if (created) app.mapEngine?.selectFeature(created.id);
    UIToast.notificar({
      tipo: 'sucesso',
      titulo: 'Buffer Criado',
      mensagem: `Buffer de ${radius} m gerado com sucesso para "${feat.name || 'Feição'}".`,
      duracao: 3500
    });
  }

  static copy(text, titulo, mensagem) {
    if (!navigator.clipboard?.writeText) {
      UIToast.notificar({ tipo: 'erro', titulo: 'Erro', mensagem: 'Área de transferência indisponível neste navegador.' });
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => UIToast.notificar({ tipo: 'sucesso', titulo, mensagem, duracao: 2000 }))
      .catch(() => UIToast.notificar({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível acessar a área de transferência.' }));
  }
}
