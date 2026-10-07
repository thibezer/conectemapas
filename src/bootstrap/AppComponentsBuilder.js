/* ==========================================================================
   ConecteMapas - AppComponentsBuilder
   Montagem dos componentes de interface e motor cartográfico Leaflet.
   ========================================================================== */

import { UIToast } from '@thibezer/ui-components-kit';
import { AuthService } from '../services/Storage/AuthService.js';
import { notifyProgress, copyToClipboardWithToast, notifyUndoable } from '../utils/toastHelpers.js';
import { MapEngine } from '../services/MapEngine.js';
import { StorageService } from '../services/StorageService.js';

import { HeaderBar } from '../components/HeaderBar.js';
import { DrawingToolbar } from '../components/DrawingToolbar.js';
import { LayerPanel } from '../components/LayerPanel.js';
import { AttributeTable } from '../components/AttributeTable.js';
import { ContextMenu } from '../components/ContextMenu.js';
import { SelectionHUD } from '../components/SelectionHUD.js';

import { ProjectActionsController } from '../controllers/ProjectActionsController.js';
import { ShortcutsController } from '../controllers/ShortcutsController.js';
import { FeatureSyncController } from '../controllers/FeatureSyncController.js';
import { AppModalsBuilder } from './AppModalsBuilder.js';

export class AppComponentsBuilder {
  static initMap(app) {
    if (app.mapEngine) {
      app.mapEngine.destroy();
      app.mapEngine = null;
    }

    app.mapEngine = new MapEngine('map-viewport', {
      center: [-23.7661, -53.3206],
      zoom: 14,
      initialBasemap: app.currentBasemap,
      onToolChange: (tool) => {
        if (app.drawingToolbar) {
          app.drawingToolbar.setActiveTool(tool);
        }
      },
      onFeatureCreated: (rawFeature) => {
        FeatureSyncController.handleDrawingCompleted(app, rawFeature);
      },
      onFeatureUpdated: (updatedFeature) => {
        FeatureSyncController.updateFeature(app, updatedFeature);
      },
      onTextPromptRequested: (latlng) => {
        if (app.textPromptModal) {
          app.textPromptModal.openWithLocation(latlng);
        }
      },
      onContextMenu: (data) => {
        if (app.contextMenu) {
          app.contextMenu.open(data);
        }
      },
      // Ações dos botões do popup de feição (mesmo comportamento do HUD e do menu de contexto)
      onFeatureAction: (action, feature) => {
        if (!feature || !app.mapEngine) return;
        if (action === 'inspect') {
          if (app.selectionHUD) app.selectionHUD.onInspect(feature);
        } else if (action === 'zoom') {
          app.mapEngine.zoomToFeature(feature.id);
        } else if (action === 'edit-vertex') {
          app.mapEngine.closeFeaturePopup();
          app.mapEngine.startVertexEditing(feature, (updated) => {
            FeatureSyncController.updateFeature(app, updated);
          });
        } else if (action === 'copy-coords') {
          const c = Array.isArray(feature.coordinates) ? feature.coordinates : [feature.coordinates?.lat, feature.coordinates?.lng];
          const text = `${Number(c[0]).toFixed(6)}, ${Number(c[1]).toFixed(6)}`;
          copyToClipboardWithToast(text, 'Coordenadas copiadas');
        }
      },
      onFeatureSelected: (feature) => {
        app.updateSelectionState(feature ? [feature] : []);
      },
      onFeaturesSelected: (features) => {
        app.updateSelectionState(features || []);
      },
      onCursorMove: (latlng) => {
        if (!latlng) return;
        app._lastCursorLatLng = latlng;
        if (app.collabHub) {
          app.collabHub.sendCursorPosition([latlng.lat, latlng.lng]);
        }
        const latSpan = document.getElementById('hud-latlng');
        if (latSpan) {
          latSpan.textContent = `Lat: ${latlng.lat.toFixed(5)} | Lng: ${latlng.lng.toFixed(5)}`;
        }
      }
    });

    app.mapEngine.setBaseLayer(app.currentBasemap);
    app.mapEngine.renderFeatures(app.features, app.layers);

    const initialActive = app.layers.find(l => l.id === app.activeLayerId) || app.layers[0];
    if (initialActive && app.mapEngine) {
      app.mapEngine.setActiveDrawingLayer(initialActive);
    }

    app.mapEngine.map.on('zoomend', () => {
      const zoomSpan = document.getElementById('hud-zoom');
      if (zoomSpan && app.mapEngine.map) {
        zoomSpan.textContent = `Zoom: ${app.mapEngine.map.getZoom()}`;
      }
    });
  }

  static initComponents(app) {
    app.headerBar = new HeaderBar({
      projectName: app.projectName,
      collaborators: app.collabHub.getActiveCollaboratorsList(),
      accountName: AuthService.getUser()?.name || '',
      onOpenAccount: () => app.authModal && app.authModal.open(),
      onProjectNameChange: (newName) => {
        app.projectName = newName;
        app.saveMetadata(true);
      },
      onSaveProject: async () => {
        app.saveState(true, { featuresChanged: true });
        const progress = notifyProgress({
          titulo: 'Sincronizando com a nuvem',
          mensagem: `Gravando ${app.features.length} feições...`
        });

        const cloudRes = await StorageService.saveProjectToCloud({
          id: app.projectId || 'projeto_padrao',
          name: app.projectName,
          basemap: app.currentBasemap,
          layers: app.layers,
          features: app.features,
          center: app.mapEngine?.map ? [app.mapEngine.map.getCenter().lat, app.mapEngine.map.getCenter().lng] : [-23.7661, -53.3206],
          zoom: app.mapEngine?.map ? app.mapEngine.map.getZoom() : 14
        });

        progress.done();
        if (cloudRes && cloudRes.success) {
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'Projeto salvo na nuvem',
            mensagem: `${app.features.length} feições sincronizadas. Qualquer pessoa com o link pode visualizar.`,
            duracao: 3500
          });
        } else {
          UIToast.notificar({
            tipo: 'alerta',
            titulo: 'Salvo Apenas Localmente',
            mensagem: `Salvo no navegador local. Hostinger: ${cloudRes?.error || 'servidor ocupado'}.`,
            duracao: 4000
          });
        }
        app._updateSyncChip();
      },
      onOpenPrintComposer: () => {
        if (app.printComposerModal) {
          app.printComposerModal.open(app.projectName, app.layers, app.features, app.currentBasemap);
        }
      },
      onToggleGeometryVersion: () => {
        app.toggleGlobalGeometryVersion();
      }
    });
    app.headerBar.render(document.getElementById('header-mount'));

    app.drawingToolbar = new DrawingToolbar({
      onToolChange: (tool) => {
        app.mapEngine.setTool(tool);
      },
      onAction: (action) => {
        if (action === 'locate') {
          ProjectActionsController.locateUser(app);
        } else if (action === 'fit') {
          app.mapEngine.fitAllFeatures();
        }
      }
    });
    app.drawingToolbar.render(document.getElementById('drawing-toolbar-mount'));

    const initialLayer = app.layers.find(l => l.id === app.activeLayerId) || app.layers[0];
    if (initialLayer && app.drawingToolbar) {
      app.drawingToolbar.setActiveLayer(initialLayer);
    }

    app.layerPanel = new LayerPanel({
      app,
      layers: app.getLayersWithCounts(),
      features: app.features,
      activeLayerId: app.activeLayerId,
      onLayerSelect: (layerId) => app.setActiveLayer(layerId),
      currentBasemap: app.currentBasemap,
      auditLog: app.auditLog,
      chatMessages: app.chatMessages,
      onLayerToggle: (layerId, isVisible) => {
        const layer = app.layers.find(l => l.id === layerId);
        if (layer) {
          layer.visible = isVisible;
          app.mapEngine.setLayerVisibility(layerId, isVisible);
          StorageService.saveLayer(layer, app.projectId);
          if (app.collabHub) app.collabHub.notifyLayerUpdated(layer);
          app.saveMetadata();
        }
      },
      onLayerReorder: (newLayers) => {
        app.layers = [...newLayers];
        app.mapEngine.reorderLayers(app.layers);
        StorageService.saveLayersBatch(app.layers, app.projectId);
        app.saveMetadata(true);
      },
      onLayerOpacityChange: (layerId, opacity) => {
        const layer = app.layers.find(l => l.id === layerId);
        if (layer) {
          layer.opacity = opacity;
          app.mapEngine.setLayerOpacity(layerId, opacity);
          StorageService.saveLayer(layer, app.projectId);
          if (app.collabHub) app.collabHub.notifyLayerUpdated(layer);
          app.saveMetadata(true);
        }
      },
      onLayerRename: (layerId, newName) => {
        const layer = app.layers.find(l => l.id === layerId);
        if (layer) {
          layer.name = newName;
          StorageService.saveLayer(layer, app.projectId);
          if (app.collabHub) app.collabHub.notifyLayerUpdated(layer);
          app.saveMetadata(true);
        }
      },
      onLayerColorChange: (layerId, newColor) => {
        const layer = app.layers.find(l => l.id === layerId);
        if (layer) {
          layer.color = newColor;
          app.mapEngine.setLayerColor(layerId, newColor);
          StorageService.saveLayer(layer, app.projectId);
          if (app.collabHub) app.collabHub.notifyLayerUpdated(layer);
          app.saveMetadata(true);
        }
      },
      onLayerDelete: (layerId) => ProjectActionsController.deleteLayer(app, layerId),
      onLayerFit: (layerId) => app.mapEngine.fitLayer(layerId),
      onAddLayer: () => ProjectActionsController.openNewLayerModal(app),
      onFeatureToggle: (featureId, isVisible) => {
        const feat = app.features.find(f => f.id === featureId);
        if (feat) {
          feat.visible = isVisible;
          app.mapEngine.updateFeature(feat, app.layers);
          app.saveFeature(feat);
        }
      },
      onFeatureSelect: (feature) => {
        if (!feature) {
          if (app.mapEngine) app.mapEngine.clearSelection();
          return;
        }
        if (app.mapEngine) app.mapEngine.selectFeature(feature.id);
        if (app.attributeTable) app.attributeTable.selectFeature(feature.id);
      },
      onFeaturesSelect: (features) => {
        const ids = (features || []).map(f => f.id);
        if (app.mapEngine) app.mapEngine.selectFeatures(ids);
        if (features && features.length > 0 && app.attributeTable) {
          app.attributeTable.selectFeature(features[0].id);
        }
      },
      onFeaturesReorder: (newFeatures) => {
        app.features = [...newFeatures];
        app.refreshMapAndTable();
        StorageService.queueFeaturesBulkUpsert(app.features);
        app.saveMetadata(false);
      },
      onFeatureLockToggle: (featureId, isLocked) => {
        const feat = app.features.find(f => f.id === featureId);
        if (feat) {
          feat.locked = isLocked;
          app.saveFeature(feat);
        }
      },
      onBulkUpdate: (updatedFeatures) => {
        app.pushHistory(`Modificação coletiva (${updatedFeatures.length} itens)`);
        const updateMap = new Map(updatedFeatures.map(f => [f.id, f]));
        app.features = app.features.map(f => updateMap.get(f.id) || f);
        app.refreshMapAndTable();
        StorageService.queueFeaturesBulkUpsert(updatedFeatures);
        app.saveMetadata(false);
        UIToast.notificar({ tipo: 'sucesso', titulo: 'Modificação Coletiva', mensagem: `${updatedFeatures.length} feições atualizadas com sucesso.`, duracao: 2500 });
      },
      onBulkDelete: (requestedIds) => {
        // Feições bloqueadas ficam de fora da exclusão em lote
        const lockedIds = requestedIds.filter(id => FeatureSyncController.isFeatureLocked(app, id));
        const featureIds = requestedIds.filter(id => !lockedIds.includes(id));
        if (lockedIds.length > 0) {
          FeatureSyncController.notifyLocked(`${lockedIds.length} feição(ões) selecionada(s)`);
        }
        if (featureIds.length === 0) return;
        const idSet = new Set(featureIds);
        app.pushHistory(`Exclusão coletiva (${featureIds.length} itens)`);
        app.features = app.features.filter(f => !idSet.has(f.id));
        app.refreshMapAndTable();
        StorageService.queueFeaturesBulkDelete(featureIds);
        featureIds.forEach(id => app.layerPanel && app.layerPanel.handleSelectedFeatureRemoved?.(id));
        app.saveMetadata(false);
        notifyUndoable(app, { titulo: 'Exclusão Coletiva', mensagem: `${featureIds.length} feições removidas.` });
      },
      onBasemapChange: (basemapName) => {
        app.currentBasemap = basemapName;
        app.mapEngine.setBaseLayer(basemapName);
        app.saveMetadata();
      },
      onAddFeature: (rawFeat) => FeatureSyncController.createFeature(app, rawFeat),
      onDeleteFeature: (featureId) => FeatureSyncController.deleteFeature(app, featureId),
      onFeatureUpdate: (updatedFeature) => FeatureSyncController.updateFeature(app, updatedFeature),
      onFeatureCreate: (newFeature) => FeatureSyncController.createFeature(app, newFeature),
      onFitFeature: (featureId) => app.mapEngine.zoomToFeature(featureId),
      onStartVertexEdit: (feature) => {
        app.mapEngine.startVertexEditing(feature, (updated) => FeatureSyncController.updateFeature(app, updated));
      },
      onStopVertexEdit: () => app.mapEngine.stopVertexEditing(),
      onSendMessage: (text) => {
        const msg = app.collabHub.sendChatMessage(text);
        app.layerPanel.addChatMessage(msg);
      }
    });
    app.layerPanel.render(document.getElementById('layer-panel-mount'));

    // Conexão do Seletor Flutuante de Mapa Base
    const seletorMapaBase = document.getElementById('cm-seletor-mapa-base');
    if (seletorMapaBase) {
      if (app.currentBasemap) seletorMapaBase.mapaBaseAtivo = app.currentBasemap;
      seletorMapaBase.addEventListener('ui-mapa-base-alterado', (e) => {
        const novoBasemap = e.detail?.mapaBaseId;
        if (novoBasemap && app.currentBasemap !== novoBasemap) {
          app.currentBasemap = novoBasemap;
          app.mapEngine.setBaseLayer(novoBasemap);
          app.saveMetadata();
        }
      });
    }

    app.attributeTable = new AttributeTable({
      layers: app.layers,
      features: app.features,
      onSelect: (featureId) => {
        const feat = app.features.find(f => f.id === featureId);
        if (feat) {
          app.mapEngine.zoomToFeature(featureId);
          app.mapEngine.selectFeature(featureId);
          app.layerPanel.setSelectedFeature(feat, false);
        }
      },
      onDelete: (featureId) => FeatureSyncController.deleteFeature(app, featureId)
    });
    app.attributeTable.render(document.getElementById('attribute-table-mount'));

    AppModalsBuilder.initModals(app);

    app.contextMenu = new ContextMenu(app);

    app.selectionHUD = new SelectionHUD({
      container: document.querySelector('.cm-workspace') || document.body,
      onInspect: (feature) => {
        if (app.layerPanel) {
          app.layerPanel.setSelectedFeature(feature, true);
          const sidebar = document.getElementById('cm-sidebar-panel');
          if (sidebar && sidebar.classList.contains('collapsed')) {
            sidebar.classList.remove('collapsed');
          }
          const btnExpand = document.getElementById('btn-expand-sidebar');
          if (btnExpand) btnExpand.style.display = 'none';
        }
      },
      onEditVertices: (feature) => {
        app.mapEngine.startVertexEditing(feature, (updated) => {
          FeatureSyncController.updateFeature(app, updated);
        });
      },
      onZoom: (features) => {
        if (!features || features.length === 0) return;
        if (app.mapEngine) app.mapEngine.zoomToFeatures(features);
      },
      onOpenTable: (features) => {
        if (app.attributeTable) {
          if (app.attributeTable.isCollapsed) {
            app.attributeTable.toggleCollapse();
          }
          if (features.length > 0) {
            app.attributeTable.selectFeature(features[0].id);
          }
        }
      },
      onDelete: (features) => {
        if (!features || features.length === 0) return;
        if (features.length === 1) {
          app.deleteFeature(features[0].id);
        } else {
          const ids = features.map(f => f.id);
          app.layerPanel?.onBulkDelete?.(ids);
        }
      },
      onClear: () => {
        if (app.mapEngine) app.mapEngine.clearSelection();
        if (app.layerPanel) {
          app.layerPanel.selectedFeatureIds.clear();
          app.layerPanel.selectedFeature = null;
          app.layerPanel.updateContent();
        }
      }
    });

    ShortcutsController.bindGlobalShortcuts(app);
  }
}
