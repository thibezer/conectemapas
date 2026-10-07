/* ==========================================================================
   ConecteMapas - Main Application Entrypoint
   Plataforma Colaborativa de Mapeamento com thibezer/Componentes-UI
   ========================================================================== */

import '@thibezer/ui-components-kit';
import { UIToast } from '@thibezer/ui-components-kit';

import { StorageService } from './services/StorageService.js';
import { DEFAULT_LAYERS } from './services/MockData.js';
import { CollaborationHub } from './services/CollaborationHub.js';
import { AccessManager } from './services/Storage/AccessManager.js';
import { AuthService } from './services/Storage/AuthService.js';

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
    AccessManager.adoptKeyFromUrl(this.projectId);

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

    AccessManager.onRoleChange((projectId, role) => {
      if (projectId === this.projectId) this.applyAccessMode(role);
    });
    AuthService.onChange((user) => {
      this.applyAccount(user);
      AccessManager.refresh(this.projectId);
    });
    this.applyAccount(AuthService.getUser());
    AuthService.refresh().then(() => AccessManager.refresh(this.projectId));
    AccessManager.refresh(this.projectId);

    const inviteCode = AccessManager.takeInviteFromUrl();
    if (inviteCode && this.authModal) this.authModal.openInvite(inviteCode);
  }

  /** Nome da conta no cabeçalho e na presença; o servidor ainda decide o papel. */
  applyAccount(user) {
    if (this.headerBar) this.headerBar.updateAccount(user ? user.name : '');
    if (this.collabHub) this.collabHub.setAccountName(user ? user.name : null);
  }

  /** Após aceitar um convite: abre o projeto do convite (recarrega se for outro). */
  openProjectAfterInvite(projectId) {
    if (projectId && projectId !== this.projectId) {
      window.location.assign(AccessManager.buildShareUrl(projectId));
      return;
    }
    AccessManager.refresh(this.projectId);
  }

  /**
   * Reflete o papel de acesso na interface: leitor e "sem acesso" não editam.
   * O servidor é quem garante (403); aqui só evitamos oferecer ações que falhariam.
   */
  applyAccessMode(role) {
    // Projeto protegido que estava sem acesso e agora liberou (login/convite): recarrega para baixar os dados
    if (this._lastAccessRole === 'none' && role && role !== 'none') {
      window.location.reload();
      return;
    }
    this._lastAccessRole = role;
    const readOnly = role === 'viewer' || role === 'none';
    document.body.classList.toggle('cm-readonly', readOnly);
    if (readOnly && this.mapEngine) this.mapEngine.setTool('select');
    if (this.collabHub) this.collabHub.setRole(role);
    if (role === 'viewer') {
      UIToast.notificar({ tipo: 'alerta', titulo: 'Modo leitura', mensagem: 'Você pode visualizar o mapa, mas não editá-lo.', duracao: 5000 });
    } else if (role === 'none') {
      UIToast.notificar({ tipo: 'erro', titulo: 'Acesso negado', mensagem: 'Este projeto exige um link de acesso válido.', duracao: 6000 });
    }
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

  /**
   * Salvaguarda: feição cuja camada não existe mais fica invisível para sempre.
   * Agenda uma checagem (com atraso, para não agir durante o carregamento inicial,
   * quando feições podem chegar antes das camadas) e resgata as órfãs para a
   * camada determinística "Recuperadas".
   */
  _scheduleOrphanCheck() {
    if (this._orphanTimer || !this.layers.length) return;
    this._orphanTimer = setTimeout(() => {
      this._orphanTimer = null;
      this.adoptOrphanFeatures();
    }, 4000);
  }

  adoptOrphanFeatures() {
    if (!this.layers.length || !this.features.length) return 0;
    const known = new Set(this.layers.map(l => l.id));
    const orphans = this.features.filter(f => f && f.layerId && !known.has(f.layerId));
    const noLayer = this.features.filter(f => f && !f.layerId);
    const all = [...orphans, ...noLayer];
    if (all.length === 0) return 0;

    const RESCUE_ID = 'layer-recuperadas';
    let rescue = this.layers.find(l => l.id === RESCUE_ID);
    if (!rescue) {
      rescue = { id: RESCUE_ID, name: 'Recuperadas', color: '#F5A524', visible: true, opacity: 1, locked: false, order: this.layers.length };
      this.layers.push(rescue);
      StorageService.saveLayer(rescue, this.projectId);
      if (this.collabHub) this.collabHub.notifyLayerCreated(rescue);
      if (this.newFeatureModal) this.newFeatureModal.updateLayers(this.layers);
      this.saveMetadata(false);
    }
    all.forEach(f => { f.layerId = RESCUE_ID; });
    StorageService.queueFeaturesBulkUpsert(all, this.projectId);
    console.warn(`[ConecteMapas] ${all.length} feição(ões) órfã(s) movida(s) para "Recuperadas".`);
    UIToast.notificar({
      tipo: 'alerta',
      titulo: 'Feições recuperadas',
      mensagem: `${all.length} feição(ões) estavam sem camada e foram movidas para "Recuperadas".`,
      duracao: 6000
    });
    this.refreshMapAndTable(true);
    return all.length;
  }

  refreshMapAndTable(forceRebuild = false) {
    this._scheduleOrphanCheck();
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
