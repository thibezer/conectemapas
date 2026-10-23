/* ==========================================================================
   ConecteMapas - ModifyActionsController
   Executa os comandos da aba "Modificar" da ribbon sobre a seleção atual e
   mantém a aba sincronizada (habilitação, rótulos, ferramenta ativa).
   Não implementa geometria nova: cada comando reaproveita o que o HUD, o menu de
   contexto, o inspetor e a barra de desenho já usam, para que todos se comportem igual.
   ========================================================================== */

import { UIToast } from '@thibezer/ui-components-kit';
import { StorageService } from '../services/StorageService.js';
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
        if (sel.length > 0) this.buffer(app, sel);
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

  /**
   * Abre o modal de parametrização de buffer ou processa as feições fornecidas.
   * @param {Object} app
   * @param {Object|Object[]} targets Feição ou lista de feições
   */
  static buffer(app, targets) {
    const list = Array.isArray(targets) ? targets : (targets ? [targets] : []);
    const valid = list.filter(f => f && f.locked !== true);
    if (valid.length === 0) {
      UIToast.notificar({
        tipo: 'alerta',
        titulo: 'Buffer',
        mensagem: 'Nenhuma feição editável selecionada para gerar buffer.',
        duracao: 3000
      });
      return;
    }

    if (app.bufferModal) {
      app.bufferModal.open(valid);
      return;
    }

    // Fallback caso o modal não esteja montado (ex: testes sem DOM completo)
    const promptMsg = valid.length === 1
      ? `Informe o raio do buffer em metros para "${valid[0].name || 'Feição'}":`
      : `Informe o raio do buffer em metros para as ${valid.length} feições selecionadas:`;
    const input = typeof window !== 'undefined' && window.prompt ? window.prompt(promptMsg, '50') : '50';
    if (input === null) return;
    const radius = parseFloat(String(input).trim().replace(',', '.'));
    if (!Number.isFinite(radius) || radius === 0) return;

    this.applyBuffer(app, valid, radius, '__same__');
  }

  /**
   * Aplica a criação de buffer em lote ou individual com escolha de camada de destino.
   * @param {Object} app
   * @param {Object[]} targets
   * @param {number} radius
   * @param {string} targetLayerId ID da camada de destino, '__same__' ou '__new__'
   * @param {Object} [options] { newLayerName }
   * @returns {Object[]} Feições de buffer criadas
   */
  static applyBuffer(app, targets, radius, targetLayerId = '__same__', options = {}) {
    const list = Array.isArray(targets) ? targets : (targets ? [targets] : []);
    const valid = list.filter(f => f && f.locked !== true);
    if (valid.length === 0 || !Number.isFinite(radius) || radius === 0) return [];

    let resolvedLayerId = targetLayerId;
    let targetLayer = null;

    // Se for solicitada criação de nova camada
    if (targetLayerId === '__new__') {
      const layerName = options.newLayerName || `Buffer (${radius}m)`;
      resolvedLayerId = 'layer-' + Date.now();
      const newLayer = {
        id: resolvedLayerId,
        name: layerName,
        color: '#38bdf8',
        visible: true,
        opacity: 1,
        locked: false,
        order: app.layers?.length || 0
      };
      if (app.layers) app.layers.push(newLayer);
      StorageService.saveLayer(newLayer, app.projectId);
      if (app.collabHub) app.collabHub.notifyLayerCreated(newLayer);
      if (app.layerPanel) app.layerPanel.updateLayers(app.getLayersWithCounts?.() || app.layers, app.features);
      if (app.newFeatureModal) app.newFeatureModal.updateLayers(app.layers);
      if (app.bufferModal) app.bufferModal.updateLayers(app.layers);
      if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
      app.saveMetadata();
      targetLayer = newLayer;
    } else if (targetLayerId && targetLayerId !== '__same__') {
      targetLayer = app.layers?.find(l => l.id === targetLayerId);
      resolvedLayerId = targetLayer?.id || targetLayerId;
    }

    const createdBuffers = [];
    for (const feat of valid) {
      const finalLayerId = (targetLayerId === '__same__' || !resolvedLayerId)
        ? (feat.layerId || app.activeLayerId || 'layer-topografia')
        : resolvedLayerId;

      const layerObj = app.layers?.find(l => l.id === finalLayerId);
      const buf = SpatialAlgorithms.generateBuffer(feat, radius, {
        targetLayerId: finalLayerId,
        color: layerObj?.color || '#38bdf8'
      });

      if (buf) {
        createdBuffers.push(buf);
      }
    }

    if (createdBuffers.length === 0) {
      UIToast.notificar({
        tipo: 'alerta',
        titulo: 'Falha no Buffer',
        mensagem: 'Não foi possível gerar a zona de amortecimento para as feições selecionadas.',
        duracao: 4000
      });
      return [];
    }

    // Regra 5 do GEMINI.md: ingestão consolidada em lote (um IndexedDB bulk, um pushHistory, um refresh)
    const ingested = FeatureSyncController.createFeaturesBatch(app, createdBuffers, {
      sourceDescription: `Buffer (${radius}m)`,
      broadcastCollab: true
    });

    const newIds = ingested.map(f => f.id);
    if (newIds.length === 1) {
      app.mapEngine?.selectFeature?.(newIds[0]);
    } else if (newIds.length > 1) {
      app.mapEngine?.selectFeatures?.(newIds);
    }

    const destName = targetLayer?.name || (targetLayerId === '__same__' ? 'camada de origem' : 'camada definida');
    const msg = ingested.length === 1
      ? `Buffer de ${radius} m gerado com sucesso em "${destName}".`
      : `${ingested.length} buffers de ${radius} m gerados com sucesso em "${destName}".`;

    UIToast.notificar({
      tipo: 'sucesso',
      titulo: 'Buffer Criado',
      mensagem: msg,
      duracao: 3500
    });

    return ingested;
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
