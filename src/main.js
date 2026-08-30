/* ==========================================================================
   ConecteMapas - Main Application Entrypoint
   Plataforma Colaborativa de Mapeamento com thibezer/Componentes-UI
   ========================================================================== */

import 'ui-components-kit/style.css';
import 'ui-components-kit';
import { UIToast } from 'ui-components-kit';

import { StorageService } from './services/StorageService.js';
import { DEFAULT_LAYERS, DEFAULT_FEATURES, normalizeFeature } from './services/MockData.js';
import { CollaborationHub } from './services/CollaborationHub.js';
import { MapEngine } from './services/MapEngine.js';

import { HeaderBar } from './components/HeaderBar.js';
import { DrawingToolbar } from './components/DrawingToolbar.js';
import { LayerPanel } from './components/LayerPanel.js';
import { AttributeTable } from './components/AttributeTable.js';

import { ShareModal } from './components/Modals/ShareModal.js';
import { ImportExportModal } from './components/Modals/ImportExportModal.js';
import { ProjectTemplatesModal } from './components/Modals/ProjectTemplatesModal.js';
import { NewFeatureModal } from './components/Modals/NewFeatureModal.js';
import { PrintComposerModal } from './components/PrintComposer/PrintComposerModal.js';

import { ProjectActionsController } from './controllers/ProjectActionsController.js';
import { ShortcutsController } from './controllers/ShortcutsController.js';
import { FeatureSyncController } from './controllers/FeatureSyncController.js';

class ConecteMapasApp {
  constructor() {
    this.projectName = 'Levantamento Planialtimétrico - Brasília';
    this.layers = [...DEFAULT_LAYERS];
    this.features = [...DEFAULT_FEATURES];
    this.auditLog = [];
    this.chatMessages = [];
    this.currentBasemap = 'satelite';

    this.mapEngine = null;
    this.collabHub = null;
    this.headerBar = null;
    this.drawingToolbar = null;
    this.layerPanel = null;
    this.attributeTable = null;
    this.newFeatureModal = null;
    this.printComposerModal = null;

    this.historyUndo = [];
    this.historyRedo = [];

    this.init();
  }

  init() {
    this.loadState();
    this.initCollaboration();
    this.initMap();
    this.initComponents();
    this.updateHUD();
    this.loadStateAsync();

    setTimeout(() => {
      UIToast.notificar({
        tipo: 'sucesso',
        titulo: 'ConecteMapas Iniciado',
        mensagem: 'Sessão colaborativa ativa com persistência estendida IndexedDB.',
        duracao: 4000
      });
    }, 500);
  }

  loadState() {
    const saved = StorageService.loadCurrentProject();
    if (saved) {
      if (saved.name) this.projectName = saved.name;
      if (Array.isArray(saved.layers)) this.layers = saved.layers;
      if (Array.isArray(saved.features)) this.features = saved.features.map(normalizeFeature);
      if (Array.isArray(saved.auditLog)) this.auditLog = saved.auditLog;
      if (saved.basemap) this.currentBasemap = saved.basemap;
    } else {
      this.auditLog.push({
        id: 'aud_init',
        action: 'Projeto inicializado',
        user: 'Sistema',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      });
    }
  }

  async loadStateAsync() {
    const saved = await StorageService.loadCurrentProjectAsync();
    if (saved && Array.isArray(saved.features) && saved.features.length > 0) {
      if (saved.features.length !== this.features.length) {
        this.features = saved.features.map(normalizeFeature);
        this.refreshMapAndTable();
        this.layerPanel.updateLayers(this.getLayersWithCounts());
        this.newFeatureModal.updateLayers(this.layers);
        if (this.attributeTable) {
          this.attributeTable.updateData(this.features, this.layers);
        }
      }
    }
  }

  saveState() {
    StorageService.saveProject({
      name: this.projectName,
      basemap: this.currentBasemap,
      layers: this.layers,
      features: this.features,
      auditLog: this.auditLog
    });

    const syncChip = document.getElementById('cm-sync-chip');
    if (syncChip) {
      syncChip.setAttribute('variante', 'sucesso');
      syncChip.textContent = `● Salvo (${this.features.length} feições no IndexedDB)`;
    }
  }

  initCollaboration() {
    this.collabHub = new CollaborationHub(null, (type, data) => {
      FeatureSyncController.handleCollabEvent(this, type, data);
    });
  }

  initMap() {
    this.mapEngine = new MapEngine('map-viewport', {
      onFeatureCreated: (rawFeature) => {
        FeatureSyncController.handleDrawingCompleted(this, rawFeature);
      },
      onFeatureSelected: (feature) => {
        if (this.layerPanel) {
          this.layerPanel.setSelectedFeature(feature);
        }
      },
      onCursorMove: (latlng) => {
        if (this.collabHub) {
          this.collabHub.sendCursorPosition([latlng.lat, latlng.lng]);
        }
        const latSpan = document.getElementById('hud-latlng');
        if (latSpan) {
          latSpan.textContent = `Lat: ${latlng.lat.toFixed(5)} | Lng: ${latlng.lng.toFixed(5)}`;
        }
      }
    });

    this.mapEngine.setBaseLayer(this.currentBasemap);
    this.mapEngine.renderFeatures(this.features, this.layers);

    this.mapEngine.map.on('zoomend', () => {
      const zoomSpan = document.getElementById('hud-zoom');
      if (zoomSpan && this.mapEngine.map) {
        zoomSpan.textContent = `Zoom: ${this.mapEngine.map.getZoom()}`;
      }
    });
  }

  initComponents() {
    this.headerBar = new HeaderBar({
      projectName: this.projectName,
      collaborators: this.collabHub.getActiveCollaboratorsList(),
      onProjectNameChange: (newName) => {
        this.projectName = newName;
        this.saveState();
        UIToast.notificar({ tipo: 'sucesso', titulo: 'Projeto Renomeado', mensagem: `Nome atualizado para "${newName}".`, duracao: 2500 });
      },
      onSaveProject: () => {
        this.saveState();
        UIToast.notificar({ tipo: 'sucesso', titulo: 'Projeto Salvo', mensagem: `${this.features.length} feições gravadas no banco local com sucesso.`, duracao: 3000 });
      },
      onOpenPrintComposer: () => {
        if (this.printComposerModal) {
          this.printComposerModal.open(this.projectName, this.layers, this.features, this.currentBasemap);
        }
      }
    });
    this.headerBar.render(document.getElementById('header-mount'));

    this.drawingToolbar = new DrawingToolbar({
      onToolChange: (tool) => {
        this.mapEngine.setTool(tool);
        UIToast.notificar({ tipo: 'informativo', titulo: 'Ferramenta Ativa', mensagem: `Modo: ${this.getToolName(tool)}`, duracao: 1500 });
      },
      onAction: (action) => {
        if (action === 'locate') {
          ProjectActionsController.locateUser(this);
        } else if (action === 'fit') {
          this.mapEngine.fitAllFeatures();
          UIToast.notificar({ tipo: 'informativo', titulo: 'Vista Enquadrada', mensagem: 'Todas as feições foram centralizadas.', duracao: 2000 });
        }
      }
    });
    this.drawingToolbar.render(document.getElementById('drawing-toolbar-mount'));

    this.layerPanel = new LayerPanel({
      layers: this.getLayersWithCounts(),
      features: this.features,
      currentBasemap: this.currentBasemap,
      auditLog: this.auditLog,
      chatMessages: this.chatMessages,
      onLayerToggle: (layerId, isVisible) => {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
          layer.visible = isVisible;
          this.mapEngine.renderFeatures(this.features, this.layers);
          this.saveState();
        }
      },
      onLayerReorder: (newLayers) => {
        this.layers = [...newLayers];
        this.mapEngine.renderFeatures(this.features, this.layers);
        this.saveState();
        UIToast.notificar({ tipo: 'informativo', titulo: 'Sobreposição Atualizada', mensagem: 'Ordem das camadas e Z-Index reordenados.', duracao: 1800 });
      },
      onLayerOpacityChange: (layerId, opacity) => {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
          layer.opacity = opacity;
          this.mapEngine.renderFeatures(this.features, this.layers);
          this.saveState();
        }
      },
      onLayerRename: (layerId, newName) => {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
          layer.name = newName;
          this.saveState();
          UIToast.notificar({ tipo: 'sucesso', titulo: 'Camada Renomeada', mensagem: `Nome alterado para "${newName}".`, duracao: 2000 });
        }
      },
      onLayerColorChange: (layerId, newColor) => {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
          layer.color = newColor;
          this.mapEngine.renderFeatures(this.features, this.layers);
          this.saveState();
        }
      },
      onLayerDelete: (layerId) => ProjectActionsController.deleteLayer(this, layerId),
      onLayerFit: (layerId) => this.mapEngine.fitLayer(layerId),
      onFeatureToggle: (featureId, isVisible) => {
        const feat = this.features.find(f => f.id === featureId);
        if (feat) {
          feat.visible = isVisible;
          this.mapEngine.renderFeatures(this.features, this.layers);
          this.saveState();
        }
      },
      onFeatureSelect: (feature) => {
        if (this.attributeTable) this.attributeTable.selectFeature(feature.id);
      },
      onFeatureLockToggle: (featureId, isLocked) => {
        const feat = this.features.find(f => f.id === featureId);
        if (feat) {
          feat.locked = isLocked;
          this.saveState();
          UIToast.notificar({ tipo: isLocked ? 'alerta' : 'sucesso', titulo: isLocked ? 'Feição Bloqueada' : 'Feição Desbloqueada', mensagem: isLocked ? `"${feat.name}" protegida contra edições.` : `"${feat.name}" liberada para edição.`, duracao: 1800 });
        }
      },
      onBulkUpdate: (updatedFeatures) => {
        this.pushHistory(`Modificação coletiva (${updatedFeatures.length} itens)`);
        const updateMap = new Map(updatedFeatures.map(f => [f.id, f]));
        this.features = this.features.map(f => updateMap.get(f.id) || f);
        this.refreshMapAndTable();
        this.saveState();
        UIToast.notificar({ tipo: 'sucesso', titulo: 'Modificação Coletiva', mensagem: `${updatedFeatures.length} feições atualizadas com sucesso.`, duracao: 2500 });
      },
      onBulkDelete: (featureIds) => {
        const idSet = new Set(featureIds);
        this.pushHistory(`Exclusão coletiva (${featureIds.length} itens)`);
        this.features = this.features.filter(f => !idSet.has(f.id));
        this.refreshMapAndTable();
        this.saveState();
        UIToast.notificar({ tipo: 'alerta', titulo: 'Exclusão Coletiva', mensagem: `${featureIds.length} feições removidas. Pressione Ctrl+Z para desfazer.`, duracao: 3000 });
      },
      onBasemapChange: (basemapName) => {
        this.currentBasemap = basemapName;
        this.mapEngine.setBaseLayer(basemapName);
        this.saveState();
      },
      onAddLayer: () => ProjectActionsController.addNewLayer(this),
      onDeleteFeature: (featureId) => FeatureSyncController.deleteFeature(this, featureId),
      onFeatureUpdate: (updatedFeature) => FeatureSyncController.updateFeature(this, updatedFeature),
      onFeatureCreate: (newFeature) => {
        const norm = normalizeFeature(newFeature);
        this.pushHistory(`Criação de "${norm.name}"`);
        this.features.push(norm);
        this.refreshMapAndTable();
        this.collabHub.notifyFeatureCreated(norm);
        const audit = this.collabHub.logAudit(`Criou feição "${norm.name}"`, norm.type);
        this.auditLog.unshift(audit);
        this.layerPanel.updateAuditLog(this.auditLog);
        this.layerPanel.setSelectedFeature(norm);
        this.saveState();
      },
      onFitFeature: (featureId) => this.mapEngine.zoomToFeature(featureId),
      onStartVertexEdit: (feature) => {
        this.mapEngine.startVertexEditing(feature, (updated) => FeatureSyncController.updateFeature(this, updated));
      },
      onStopVertexEdit: () => this.mapEngine.stopVertexEditing(),
      onSendMessage: (text) => {
        const msg = this.collabHub.sendChatMessage(text);
        this.layerPanel.addChatMessage(msg);
      }
    });
    this.layerPanel.render(document.getElementById('layer-panel-mount'));

    this.attributeTable = new AttributeTable({
      layers: this.layers,
      features: this.features,
      onSelect: (featureId) => {
        const feat = this.features.find(f => f.id === featureId);
        if (feat) {
          this.mapEngine.zoomToFeature(featureId);
          this.layerPanel.setSelectedFeature(feat);
        }
      },
      onDelete: (featureId) => FeatureSyncController.deleteFeature(this, featureId)
    });
    this.attributeTable.render(document.getElementById('attribute-table-mount'));

    new ShareModal().render(document.getElementById('share-modal-mount'));
    new ImportExportModal({
      onExport: (format) => ProjectActionsController.handleExport(this, format),
      onImport: (content, fileName) => ProjectActionsController.handleImport(this, content, fileName)
    }).render(document.getElementById('import-export-modal-mount'));

    new ProjectTemplatesModal({
      onSelectTemplate: (template) => ProjectActionsController.loadTemplate(this, template)
    }).render(document.getElementById('templates-modal-mount'));

    this.newFeatureModal = new NewFeatureModal({
      layers: this.layers,
      onSave: (newFeature) => {
        this.pushHistory(`Criação de "${newFeature.name}"`);
        this.features.push(newFeature);
        this.refreshMapAndTable();
        this.collabHub.notifyFeatureCreated(newFeature);
        const audit = this.collabHub.logAudit(`Criou feição "${newFeature.name}"`, newFeature.type);
        this.auditLog.unshift(audit);
        this.layerPanel.updateAuditLog(this.auditLog);
        this.saveState();
        UIToast.notificar({ tipo: 'sucesso', titulo: 'Feição Adicionada', mensagem: `"${newFeature.name}" inserida com sucesso.`, duracao: 3000 });
      }
    });
    this.newFeatureModal.render(document.getElementById('new-feature-modal-mount'));

    this.printComposerModal = new PrintComposerModal({
      projectName: this.projectName,
      layers: this.layers,
      features: this.features,
      currentBasemap: this.currentBasemap
    });
    this.printComposerModal.render(document.getElementById('print-composer-mount'));

    ShortcutsController.bindGlobalShortcuts(this);
  }

  pushHistory(description = '') {
    ShortcutsController.pushHistory(this, description);
  }

  refreshMapAndTable() {
    this.mapEngine.renderFeatures(this.features, this.layers);
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

  updateHUD() {
    const countSpan = document.getElementById('hud-features-count');
    if (countSpan) countSpan.textContent = `${this.features.length} Feições Ativas`;
  }

  getToolName(tool) {
    const names = {
      select: 'Navegar e Selecionar (V)',
      point: 'Marco / Ponto (P)',
      line: 'Linha / Rota (L)',
      polygon: 'Polígono / Área (A)',
      circle: 'Buffer Circular (C)',
      measure: 'Régua de Medição (M)'
    };
    return names[tool] || tool;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.conecteMapasApp = new ConecteMapasApp();
});

window.addEventListener('beforeunload', () => {
  if (window.conecteMapasApp && window.conecteMapasApp.collabHub) {
    window.conecteMapasApp.collabHub.destroy();
  }
});
