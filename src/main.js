/* ==========================================================================
   ConecteMapas - Main Application Entrypoint
   Plataforma Colaborativa de Mapeamento com thibezer/Componentes-UI
   ========================================================================== */

import 'ui-components-kit';
import { UIToast } from 'ui-components-kit';

import { StorageService } from './services/StorageService.js';
import { DEFAULT_LAYERS } from './services/MockData.js';
import { CollaborationHub } from './services/CollaborationHub.js';

import { FeatureSyncController } from './controllers/FeatureSyncController.js';
import { ShortcutsController } from './controllers/ShortcutsController.js';

import { AppBootstrapSync } from './bootstrap/AppBootstrapSync.js';
import { AppComponentsBuilder } from './bootstrap/AppComponentsBuilder.js';
import { AppGeometryCoordinator } from './bootstrap/AppGeometryCoordinator.js';

class ConecteMapasApp {
  constructor() {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    this.projectId = (urlParams && urlParams.get('project')) ? urlParams.get('project') : 'projeto_padrao';
    StorageService.setCurrentProjectId(this.projectId);

    this.projectName = 'Levantamento Topográfico - Umuarama';
    this.layers = [...DEFAULT_LAYERS];
    this.activeLayerId = this.layers[0]?.id || 'layer-topografia';
    this.features = [];
    this.auditLog = [];
    this.chatMessages = [];
    this.currentBasemap = 'satelite';

    this.mapEngine = null;
    this.collabHub = null;
    this.contextMenu = null;
    this.selectionHUD = null;
    this.headerBar = null;
    this.drawingToolbar = null;
    this.layerPanel = null;
    this.attributeTable = null;
    this.newFeatureModal = null;
    this.textPromptModal = null;
    this.newLayerModal = null;
    this.printComposerModal = null;
    this.shareModal = null;

    this.historyUndo = [];
    this.historyRedo = [];
    this._isStorageHydrated = false;

    this.init();
  }

  init() {
    AppBootstrapSync.loadState(this);
    this.initCollaboration();
    AppComponentsBuilder.initMap(this);
    AppComponentsBuilder.initComponents(this);
    AppGeometryCoordinator.updateHUD(this);
    AppBootstrapSync.loadStateAsync(this);

    StorageService.onCloudStatusChange(() => {
      AppBootstrapSync.updateSyncChip(this);
    });

    StorageService.checkCloudConnection().then(() => {
      AppBootstrapSync.updateSyncChip(this);
    });
  }

  initCollaboration() {
    this.collabHub = new CollaborationHub(null, (type, data) => {
      FeatureSyncController.handleCollabEvent(this, type, data);
    }, this.projectId, StorageService.getClientId());
  }

  loadState() {
    AppBootstrapSync.loadState(this);
  }

  loadStateAsync() {
    return AppBootstrapSync.loadStateAsync(this);
  }

  startCloudSyncLoop() {
    AppBootstrapSync.startCloudSyncLoop(this);
  }

  _updateSyncChip() {
    AppBootstrapSync.updateSyncChip(this);
  }

  saveMetadata(isImmediate = false) {
    const payload = {
      id: this.projectId,
      name: this.projectName,
      basemap: this.currentBasemap,
      layers: this.layers,
      auditLog: this.auditLog,
      featureCount: this.features.length
    };

    if (isImmediate) {
      StorageService.saveMetadata(payload);
    } else {
      StorageService.saveMetadataDebounced(payload, 300);
    }
    this._updateSyncChip();
  }

  saveFeature(feature) {
    if (feature) {
      StorageService.saveFeature(feature, this.projectId);
      this.saveMetadata(true);
    }
  }

  removeFeature(featureId) {
    if (featureId) {
      StorageService.deleteFeature(featureId);
      this.saveMetadata(true);
    }
  }

  deleteFeature(featureId) {
    return FeatureSyncController.deleteFeature(this, featureId);
  }

  updateFeature(updatedFeature) {
    return FeatureSyncController.updateFeature(this, updatedFeature);
  }

  createFeature(rawFeature, options = {}) {
    return FeatureSyncController.createFeature(this, rawFeature, options);
  }

  createFeaturesBatch(featureList, options = {}) {
    return FeatureSyncController.createFeaturesBatch(this, featureList, options);
  }

  saveState(isImmediate = false, options = { featuresChanged: true }) {
    if (options.featuresChanged === false || !this._isStorageHydrated) {
      this.saveMetadata(isImmediate);
      return;
    }

    const payload = {
      id: this.projectId,
      name: this.projectName,
      basemap: this.currentBasemap,
      layers: this.layers,
      features: this.features,
      auditLog: this.auditLog
    };

    if (isImmediate) {
      StorageService.flushSync(payload);
    } else {
      StorageService.saveProjectDebounced(payload, 350);
    }
    this._updateSyncChip();
  }

  flushSaveState() {
    this.saveState(true);
  }

  setActiveLayer(layerId, notify = true) {
    const layer = this.layers.find(l => l.id === layerId) || this.layers[0];
    if (!layer) return;
    this.activeLayerId = layer.id;

    if (this.layerPanel?.setActiveLayerId) this.layerPanel.setActiveLayerId(layer.id);
    if (this.mapEngine?.setActiveDrawingLayer) this.mapEngine.setActiveDrawingLayer(layer);
    if (this.drawingToolbar?.setActiveLayer) this.drawingToolbar.setActiveLayer(layer);
    if (this.newFeatureModal?.setActiveLayerId) this.newFeatureModal.setActiveLayerId(layer.id);
    if (this.textPromptModal?.setActiveLayerId) this.textPromptModal.setActiveLayerId(layer.id);
  }

  pushHistory(description = '') {
    ShortcutsController.pushHistory(this, description);
  }

  refreshMapAndTable(forceRebuild = false) {
    this.mapEngine.renderFeatures(this.features, this.layers, forceRebuild);
    if (this.attributeTable) this.attributeTable.updateData(this.features, this.layers);
    if (this.layerPanel) this.layerPanel.updateLayers(this.getLayersWithCounts(), this.features);
    this.updateHUD();
  }

  getLayersWithCounts() {
    const countMap = new Map();
    for (let i = 0; i < this.features.length; i++) {
      const lid = this.features[i].layerId;
      countMap.set(lid, (countMap.get(lid) || 0) + 1);
    }
    return this.layers.map(layer => ({ ...layer, featureCount: countMap.get(layer.id) || 0 }));
  }

  updateSelectionState(features = []) {
    AppGeometryCoordinator.updateSelectionState(this, features);
  }

  updateHUD(selectedCount = null) {
    AppGeometryCoordinator.updateHUD(this, selectedCount);
  }

  setDrawingTool(tool) {
    AppGeometryCoordinator.setDrawingTool(this, tool);
  }

  getToolName(tool) {
    return AppGeometryCoordinator.getToolName(tool);
  }

  toggleGlobalGeometryVersion() {
    AppGeometryCoordinator.toggleGlobalGeometryVersion(this);
  }

  toggleFeatureGeometryVersion(featureId) {
    AppGeometryCoordinator.toggleFeatureGeometryVersion(this, featureId);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.conecteMapasApp = new ConecteMapasApp();
});

window.addEventListener('beforeunload', () => {
  if (window.conecteMapasApp) {
    window.conecteMapasApp.flushSaveState();
    if (window.conecteMapasApp.collabHub) {
      window.conecteMapasApp.collabHub.destroy();
    }
  }
});

window.addEventListener('pagehide', () => {
  if (window.conecteMapasApp) {
    window.conecteMapasApp.flushSaveState();
  }
});

window.addEventListener('offline', () => {
  UIToast.notificar({
    tipo: 'alerta',
    titulo: 'Modo Offline Ativado',
    mensagem: 'Sem rede. Suas edições continuam salvas localmente.',
    duracao: 4000
  });
});
