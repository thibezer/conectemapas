/* ==========================================================================
   ConecteMapas - Main Application Entrypoint
   Plataforma Colaborativa de Mapeamento com thibezer/Componentes-UI
   ========================================================================== */

import 'ui-components-kit/style.css';
import 'ui-components-kit';
import { UIToast } from 'ui-components-kit';

import { StorageService } from './services/StorageService.js';
import { DEFAULT_LAYERS, normalizeFeature } from './services/MockData.js';
import { CollaborationHub } from './services/CollaborationHub.js';
import { MapEngine } from './services/MapEngine.js';
import { StressBenchmark } from './services/StressBenchmark.js';

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
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    this.projectId = (urlParams && urlParams.get('project')) ? urlParams.get('project') : 'projeto_padrao';
    this.projectName = 'Levantamento Topográfico - Umuarama';
    this.layers = [...DEFAULT_LAYERS];
    this.features = [];
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
    this._isStorageHydrated = false;

    this.init();
  }

  init() {
    this.loadState();
    this.initCollaboration();
    this.initMap();
    this.initComponents();
    this.updateHUD();
    this.loadStateAsync();

    // Sincronização e Diagnóstico do Banco de Dados MySQL na Hostinger
    StorageService.onCloudStatusChange(() => {
      this._updateSyncChip();
    });
    StorageService.checkCloudConnection().then((status) => {
      this._updateSyncChip();
      if (status && status.connected) {
        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Hostinger MySQL Conectado',
          mensagem: `Banco ${status.database} ativo (${status.latencyMs}ms de resposta).`,
          duracao: 3500
        });
      }
    });

    this.stressBenchmark = new StressBenchmark(this);
    window.stressBenchmark = this.stressBenchmark;

    setTimeout(() => {
      UIToast.notificar({
        tipo: 'sucesso',
        titulo: 'ConecteMapas Iniciado',
        mensagem: 'Sessão colaborativa ativa com persistência dupla (IndexedDB + Hostinger MySQL).',
        duracao: 4000
      });
    }, 500);
  }

  loadState() {
    const saved = StorageService.loadCurrentProject();
    if (saved) {
      if (saved.name) {
        this.projectName = (saved.name === 'Levantamento Planialtimétrico - Brasília')
          ? 'Levantamento Topográfico - Umuarama'
          : saved.name;
      }
      if (Array.isArray(saved.layers)) this.layers = saved.layers;
      if (Array.isArray(saved.features)) {
        this.features = saved.features.map(normalizeFeature);
      }
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
    try {
      const saved = await StorageService.loadCurrentProjectAsync(this.projectId);
      if (saved) {
        if (saved.name) this.projectName = saved.name;
        if (Array.isArray(saved.layers) && saved.layers.length > 0) {
          this.layers = saved.layers;
        }
        if (Array.isArray(saved.auditLog) && saved.auditLog.length > 0) {
          this.auditLog = saved.auditLog;
          if (this.layerPanel) this.layerPanel.updateAuditLog(this.auditLog);
        }

        if (Array.isArray(saved.features)) {
          const TEST_MOCK_IDS = new Set(['feat-m01', 'feat-m02', 'feat-app-01', 'feat-quadra-a', 'feat-rota-01', 'feat-buffer-01']);
          const cleanedFeatures = saved.features.filter(f => {
            if (TEST_MOCK_IDS.has(f.id)) {
              StorageService.deleteFeature(f.id);
              return false;
            }
            return true;
          });

          // Respeita a Regra 1 do GEMINI.md: Array.isArray(saved.features) pode ser [] se o projeto estiver limpo
          this.features = cleanedFeatures.map(normalizeFeature);
          this.refreshMapAndTable(true);
          if (this.layerPanel) this.layerPanel.updateLayers(this.getLayersWithCounts(), this.features);
          if (this.newFeatureModal) this.newFeatureModal.updateLayers(this.layers);
          if (this.attributeTable) this.attributeTable.updateData(this.features, this.layers);
        }
      }

      // Sincronização Inteligente com a Nuvem (Hostinger MySQL)
      // Se o usuário entrou por link compartilhado (?project=...) OU se o banco local está vazio (novo visitante/dispositivo)
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const isExplicitProject = urlParams && urlParams.has('project');
      const isLocalEmpty = !this.features || this.features.length === 0;

      if (isExplicitProject || isLocalEmpty) {
        const cloudData = await StorageService.loadProjectFromCloud(this.projectId);
        if (cloudData && cloudData.exists) {
          let updated = false;

          if (cloudData.project && cloudData.project.name) {
            this.projectName = cloudData.project.name;
            const titleInput = document.getElementById('cm-project-name-input');
            if (titleInput) titleInput.value = this.projectName;
            updated = true;
          }

          if (Array.isArray(cloudData.layers) && cloudData.layers.length > 0) {
            this.layers = cloudData.layers;
            updated = true;
          }

          if (Array.isArray(cloudData.features) && cloudData.features.length > 0) {
            this.features = cloudData.features.map(normalizeFeature);
            updated = true;
          }

          if (cloudData.project && cloudData.project.basemap) {
            this.currentBasemap = cloudData.project.basemap;
            if (this.mapEngine) this.mapEngine.setBaseLayer(this.currentBasemap);
            if (this.layerPanel) this.layerPanel.currentBasemap = this.currentBasemap;
          }

          if (updated) {
            this.refreshMapAndTable(true);
            if (this.layerPanel) this.layerPanel.updateLayers(this.getLayersWithCounts(), this.features);
            if (this.newFeatureModal) this.newFeatureModal.updateLayers(this.layers);
            if (this.attributeTable) this.attributeTable.updateData(this.features, this.layers);
            if (this.mapEngine && this.features.length > 0) {
              setTimeout(() => this.mapEngine.fitAllFeatures(), 300);
            }

            // Grava cópia local no IndexedDB/LocalStorage desse visitante para cache rápido (sem reenviar para a nuvem)
            StorageService.saveMetadata({
              id: this.projectId,
              name: this.projectName,
              basemap: this.currentBasemap,
              layers: this.layers,
              featureCount: this.features.length
            });
            StorageService.applyRemoteChangesLocally(this.features, [], this.projectId);

            UIToast.notificar({
              tipo: 'sucesso',
              titulo: 'Projeto Carregado da Nuvem',
              mensagem: `Sincronizadas ${this.features.length} feições do banco Hostinger (${cloudData.project?.name || 'Projeto'}).`,
              duracao: 4000
            });
          }
        }
      } else {
        // Dispositivo já possui feições em cache local: busca deltas e tombstones ocorridos desde a última sessão
        try {
          const deltaChanges = await StorageService.pullChangesFromCloud(this.projectId);
          if (deltaChanges && (deltaChanges.upserted.length > 0 || deltaChanges.deleted.length > 0)) {
            FeatureSyncController.applyRemoteDeltas(this, deltaChanges);
          }
        } catch (e) {
          console.warn('[ConecteMapas] Falha no pull de deltas inicial:', e);
        }
      }
    } catch (err) {
      console.warn('[ConecteMapas] Erro na hidratação do projeto:', err);
    } finally {
      this._isStorageHydrated = true;
      this._updateSyncChip();
      this.startCloudSyncLoop();
    }
  }

  /**
   * Sincronização inteligente e contínua em tempo real (Smart Sync Polling)
   * Garante que múltiplos dispositivos (desktop, notebook, tablet, celular) recebam
   * adições, edições e exclusões (tombstones) sem perda de dados nem ressuscitação.
   */
  startCloudSyncLoop() {
    if (this._cloudSyncInterval) {
      clearInterval(this._cloudSyncInterval);
    }

    this._cloudSyncInterval = setInterval(async () => {
      // Não consulta se a aba estiver oculta, se o cliente estiver sem internet ou no meio de um clique de vetorização
      if (typeof document !== 'undefined' && document.hidden) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (this.mapEngine && this.mapEngine.isDrawing) return;

      try {
        const changes = await StorageService.pullChangesFromCloud(this.projectId);
        if (!changes) return;

        const hasUpserted = Array.isArray(changes.upserted) && changes.upserted.length > 0;
        const hasDeleted = Array.isArray(changes.deleted) && changes.deleted.length > 0;

        if (hasUpserted || hasDeleted) {
          const changed = FeatureSyncController.applyRemoteDeltas(this, changes);
          if (changed) {
            this._updateSyncChip();
          }
        }
      } catch (err) {
        // Polling tolerante a falhas efêmeras de rede
      }
    }, 4000);
  }

  /**
   * Salva apenas metadados e camadas (O(1), < 5 KB) sem tocar no dataset de feições
   */
  saveMetadata(isImmediate = false) {
    const payload = {
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

  /**
   * Grava uma feição individual no IndexedDB O(1) sem serialização global
   */
  saveFeature(feature) {
    if (feature) {
      StorageService.saveFeature(feature);
      this.saveMetadata(false);
    }
  }

  /**
   * Remove uma feição individual do IndexedDB O(1)
   */
  removeFeature(featureId) {
    if (featureId) {
      StorageService.deleteFeature(featureId);
      this.saveMetadata(false);
    }
  }

  deleteFeature(featureId) {
    FeatureSyncController.deleteFeature(this, featureId);
  }

  saveState(isImmediate = false, options = { featuresChanged: true }) {
    if (options.featuresChanged === false) {
      this.saveMetadata(isImmediate);
      return;
    }

    // Salvaguarda: Não sobrescreve feições em lote se a hidratação inicial do IndexedDB ainda não concluiu
    if (!this._isStorageHydrated) {
      this.saveMetadata(isImmediate);
      return;
    }

    const payload = {
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

  _updateSyncChip() {
    const syncChip = document.getElementById('cm-sync-chip');
    if (!syncChip) return;

    const cloud = StorageService.getCloudStatus();
    if (cloud.syncing) {
      syncChip.setAttribute('variante', 'alerta');
      syncChip.textContent = `● Sincronizando com Hostinger MySQL...`;
      syncChip.title = `Gravando alterações em tempo real no banco u941736878_conectemapas`;
    } else if (cloud.connected) {
      syncChip.setAttribute('variante', 'sucesso');
      syncChip.textContent = `● MySQL Hostinger: Conectado (${cloud.latencyMs || 0}ms)`;
      syncChip.title = `Banco: ${cloud.database} | ${this.features.length} feições ativas | Clique para verificar conexão`;
    } else if (cloud.error) {
      syncChip.setAttribute('variante', 'informativo');
      syncChip.textContent = `● Salvo Localmente (${this.features.length} feições no IndexedDB)`;
      syncChip.title = `Banco local ativo. Nuvem em reconexão: ${cloud.error}`;
    } else {
      syncChip.setAttribute('variante', 'sucesso');
      syncChip.textContent = `● Salvo (${this.features.length} feições no IndexedDB)`;
      syncChip.title = `Persistência ativa`;
    }

    if (!syncChip._hasCloudClickHandler) {
      syncChip._hasCloudClickHandler = true;
      syncChip.style.cursor = 'pointer';
      syncChip.addEventListener('click', () => {
        StorageService.checkCloudConnection().then((st) => {
          if (st.connected) {
            UIToast.notificar({
              tipo: 'sucesso',
              titulo: 'Diagnóstico Hostinger MySQL',
              mensagem: `Conexão ativa com o banco "${st.database}" no servidor ${st.server}. Latência: ${st.latencyMs}ms. Versão MySQL: ${st.mysqlVersion || '8.0'}.`,
              duracao: 5000
            });
          } else {
            UIToast.notificar({
              tipo: 'alerta',
              titulo: 'Status Hostinger MySQL',
              mensagem: `Modo local ativo. Falha na conexão com a nuvem: ${st.error || 'Servidor inacessível'}. Suas edições permanecem 100% salvas no IndexedDB local.`,
              duracao: 5000
            });
          }
        });
      });
    }
  }

  flushSaveState() {
    this.saveState(true);
  }

  initCollaboration() {
    this.collabHub = new CollaborationHub(null, (type, data) => {
      FeatureSyncController.handleCollabEvent(this, type, data);
    });
  }

  initMap() {
    if (this.mapEngine) {
      this.mapEngine.destroy();
      this.mapEngine = null;
    }

    this.mapEngine = new MapEngine('map-viewport', {
      center: [-23.7661, -53.3206],
      zoom: 14,
      initialBasemap: this.currentBasemap,
      onFeatureCreated: (rawFeature) => {
        FeatureSyncController.handleDrawingCompleted(this, rawFeature);
      },
      onFeatureSelected: (feature) => {
        if (this.layerPanel) {
          this.layerPanel.setSelectedFeature(feature);
        }
      },
      onCursorMove: (latlng) => {
        if (!latlng) return;
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
        this.saveMetadata(true);
        UIToast.notificar({ tipo: 'sucesso', titulo: 'Projeto Renomeado', mensagem: `Nome atualizado para "${newName}".`, duracao: 2500 });
      },
      onSaveProject: async () => {
        this.saveState(true, { featuresChanged: true });
        
        UIToast.notificar({ 
          tipo: 'info', 
          titulo: 'Sincronizando Nuvem', 
          mensagem: `Gravando ${this.features.length} feições no MySQL Hostinger...`, 
          duracao: 2500 
        });

        const cloudRes = await StorageService.saveProjectToCloud({
          id: this.projectId || 'projeto_padrao',
          name: this.projectName,
          basemap: this.currentBasemap,
          layers: this.layers,
          features: this.features,
          center: this.mapEngine && this.mapEngine.map ? [this.mapEngine.map.getCenter().lat, this.mapEngine.map.getCenter().lng] : [-23.7661, -53.3206],
          zoom: this.mapEngine && this.mapEngine.map ? this.mapEngine.map.getZoom() : 14
        });

        if (cloudRes && cloudRes.success) {
          UIToast.notificar({ 
            tipo: 'sucesso', 
            titulo: 'Projeto Salvo na Nuvem!', 
            mensagem: `${this.features.length} feições sincronizadas com sucesso. Qualquer pessoa com o link poderá visualizar!`, 
            duracao: 4500 
          });
        } else {
          UIToast.notificar({ 
            tipo: 'alerta', 
            titulo: 'Salvo Apenas Localmente', 
            mensagem: `Salvo no navegador local. Hostinger: ${cloudRes?.error || 'servidor ocupado'}.`, 
            duracao: 4000 
          });
        }
        this._updateSyncChip();
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
          this.mapEngine.setLayerVisibility(layerId, isVisible);
          StorageService.saveLayer(layer);
          this.saveMetadata();
        }
      },
      onLayerReorder: (newLayers) => {
        this.layers = [...newLayers];
        this.mapEngine.reorderLayers(this.layers);
        StorageService.saveLayersBatch(this.layers);
        this.saveMetadata();
        UIToast.notificar({ tipo: 'informativo', titulo: 'Sobreposição Atualizada', mensagem: 'Ordem das camadas e Z-Index reordenados.', duracao: 1800 });
      },
      onLayerOpacityChange: (layerId, opacity) => {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
          layer.opacity = opacity;
          this.mapEngine.setLayerOpacity(layerId, opacity);
          StorageService.saveLayer(layer);
          this.saveMetadata();
        }
      },
      onLayerRename: (layerId, newName) => {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
          layer.name = newName;
          StorageService.saveLayer(layer);
          this.saveMetadata();
          UIToast.notificar({ tipo: 'sucesso', titulo: 'Camada Renomeada', mensagem: `Nome alterado para "${newName}".`, duracao: 2000 });
        }
      },
      onLayerColorChange: (layerId, newColor) => {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
          layer.color = newColor;
          this.mapEngine.setLayerColor(layerId, newColor);
          StorageService.saveLayer(layer);
          this.saveMetadata();
        }
      },

      onLayerDelete: (layerId) => ProjectActionsController.deleteLayer(this, layerId),
      onLayerFit: (layerId) => this.mapEngine.fitLayer(layerId),
      onFeatureToggle: (featureId, isVisible) => {
        const feat = this.features.find(f => f.id === featureId);
        if (feat) {
          feat.visible = isVisible;
          if (isVisible) {
            this.mapEngine.updateFeature(feat, this.layers);
          } else {
            this.mapEngine.removeFeature(feat.id);
          }
          this.saveFeature(feat);
        }
      },
      onFeatureSelect: (feature) => {
        if (this.attributeTable) this.attributeTable.selectFeature(feature.id);
      },
      onFeatureLockToggle: (featureId, isLocked) => {
        const feat = this.features.find(f => f.id === featureId);
        if (feat) {
          feat.locked = isLocked;
          this.saveFeature(feat);
          UIToast.notificar({ tipo: isLocked ? 'alerta' : 'sucesso', titulo: isLocked ? 'Feição Bloqueada' : 'Feição Desbloqueada', mensagem: isLocked ? `"${feat.name}" protegida contra edições.` : `"${feat.name}" liberada para edição.`, duracao: 1800 });
        }
      },
      onBulkUpdate: (updatedFeatures) => {
        this.pushHistory(`Modificação coletiva (${updatedFeatures.length} itens)`);
        const updateMap = new Map(updatedFeatures.map(f => [f.id, f]));
        this.features = this.features.map(f => updateMap.get(f.id) || f);
        this.refreshMapAndTable();
        StorageService.queueFeaturesBulkUpsert(updatedFeatures);
        this.saveMetadata(false);
        UIToast.notificar({ tipo: 'sucesso', titulo: 'Modificação Coletiva', mensagem: `${updatedFeatures.length} feições atualizadas com sucesso.`, duracao: 2500 });
      },
      onBulkDelete: (featureIds) => {
        const idSet = new Set(featureIds);
        this.pushHistory(`Exclusão coletiva (${featureIds.length} itens)`);
        this.features = this.features.filter(f => !idSet.has(f.id));
        this.refreshMapAndTable();
        StorageService.queueFeaturesBulkDelete(featureIds);
        this.saveMetadata(false);
        UIToast.notificar({ tipo: 'alerta', titulo: 'Exclusão Coletiva', mensagem: `${featureIds.length} feições removidas. Pressione Ctrl+Z para desfazer.`, duracao: 3000 });
      },
      onBasemapChange: (basemapName) => {
        this.currentBasemap = basemapName;
        this.mapEngine.setBaseLayer(basemapName);
        this.saveMetadata();
      },
      onAddFeature: (rawFeat) => FeatureSyncController.createFeature(this, rawFeat),
      onDeleteFeature: (featureId) => FeatureSyncController.deleteFeature(this, featureId),
      onFeatureUpdate: (updatedFeature) => FeatureSyncController.updateFeature(this, updatedFeature),
      onFeatureCreate: (newFeature) => FeatureSyncController.createFeature(this, newFeature),
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

    this.shareModal = new ShareModal({
      getProjectId: () => this.projectId || 'projeto_padrao',
      getProjectName: () => this.projectName,
      onSyncBeforeShare: async () => {
        return await StorageService.saveProjectToCloud({
          id: this.projectId || 'projeto_padrao',
          name: this.projectName,
          basemap: this.currentBasemap,
          layers: this.layers,
          features: this.features,
          center: this.mapEngine && this.mapEngine.map ? [this.mapEngine.map.getCenter().lat, this.mapEngine.map.getCenter().lng] : [-23.7661, -53.3206],
          zoom: this.mapEngine && this.mapEngine.map ? this.mapEngine.map.getZoom() : 14
        });
      }
    });
    this.shareModal.render(document.getElementById('share-modal-mount'));
    new ImportExportModal({
      onExport: (format, options) => ProjectActionsController.handleExport(this, format, options),
      onExportImage: (options) => ProjectActionsController.handleExportImage(this, options),
      onImport: (content, fileName, options) => ProjectActionsController.handleImport(this, content, fileName, options)
    }).render(document.getElementById('import-export-modal-mount'));

    new ProjectTemplatesModal({
      onSelectTemplate: (template) => ProjectActionsController.loadTemplate(this, template)
    }).render(document.getElementById('templates-modal-mount'));

    this.newFeatureModal = new NewFeatureModal({
      layers: this.layers,
      onSave: (newFeature) => FeatureSyncController.createFeature(this, newFeature)
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

  createFeature(rawFeature, options = {}) {
    return FeatureSyncController.createFeature(this, rawFeature, options);
  }

  createFeaturesBatch(featureList, options = {}) {
    return FeatureSyncController.createFeaturesBatch(this, featureList, options);
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

// Monitoramento de Conectividade em Tempo Real para Operação Web
window.addEventListener('offline', () => {
  UIToast.notificar({
    tipo: 'alerta',
    titulo: 'Modo Offline Ativado',
    mensagem: 'Conexão com a rede perdida. Suas edições continuam seguras no banco local IndexedDB.',
    duracao: 6000
  });
});

window.addEventListener('online', () => {
  UIToast.notificar({
    tipo: 'sucesso',
    titulo: 'Conexão Restabelecida',
    mensagem: 'Acesso à internet recuperado. Satélite e recursos de rede sincronizados.',
    duracao: 4000
  });
});

