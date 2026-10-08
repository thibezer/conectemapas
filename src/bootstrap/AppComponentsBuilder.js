/* ==========================================================================
   ConecteMapas - AppComponentsBuilder
   Montagem dos componentes de interface e motor cartográfico Leaflet.
   ========================================================================== */

import { UIToast } from '@thibezer/ui-components-kit';
import { AuthService } from '../services/Storage/AuthService.js';
import { notifyProgress, copyToClipboardWithToast, notifyUndoable } from '../utils/toastHelpers.js';
import { MapEngine } from '../services/MapEngine.js';
import { StorageService } from '../services/StorageService.js';
import { SpatialAlgorithms } from '../services/SpatialAlgorithms.js';

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

    const initialLayer = app.layers.find(l => l.id === app.activeLayerId) || app.layers[0];

    app.drawingToolbar = new DrawingToolbar({
      initialTool: 'select',
      snappingEnabled: app.mapEngine?.snappingEnabled ?? true,
      initialFillColor: initialLayer?.color || '#00E08A',
      initialStrokeColor: '#ffffff',
      initialLayer,
      getLayers: () => app.layers || [],
      onSelectLayer: (layerId) => {
        app.setActiveLayer(layerId);
      },
      onToolChange: (tool) => {
        app.mapEngine.setTool(tool);
      },
      onColorChange: (colors) => {
        if (app.mapEngine) {
          app.mapEngine.setActiveDrawingStyles(colors);
        }
        const selFeat = app.layerPanel?.selectedFeature;
        if (selFeat && typeof app.commitFeatureEdit === 'function') {
          ShortcutsController.pushHistory(app, 'Alterar Cor');
          app.commitFeatureEdit(selFeat.id, (draft) => {
            if (!draft.style) draft.style = {};
            if (colors.fillColor) {
              draft.style.fillColor = colors.fillColor;
              draft.color = colors.fillColor;
            }
            if (colors.strokeColor) {
              draft.style.strokeColor = colors.strokeColor;
            }
          });
        }
      },
      onAction: (action) => {
        if (action === 'locate') {
          ProjectActionsController.locateUser(app);
        } else if (action === 'fit') {
          app.mapEngine.fitAllFeatures();
        } else if (action === 'snap') {
          const isEnabled = app.mapEngine.toggleSnapping();
          app.drawingToolbar.setSnappingEnabled(isEnabled);
          UIToast.notificar({
            tipo: 'info',
            titulo: isEnabled ? 'Ímã / Snap Ativado' : 'Ímã / Snap Desativado',
            mensagem: isEnabled ? 'Atração magnética a vértices ligada [S].' : 'Cursor livre de atração magnética [S].',
            duracao: 1500
          });
        } else if (action === 'undo') {
          if (app.mapEngine && (app.mapEngine.isDrawing || (app.mapEngine.drawingEngine && app.mapEngine.drawingEngine.drawingPoints?.length > 0))) {
            app.mapEngine.undoLastVertex();
          } else {
            ShortcutsController.undo(app);
          }
        } else if (action === 'redo') {
          ShortcutsController.redo(app);
        } else if (action === 'clear-selection') {
          if (app.contextMenu) app.contextMenu.close();
          if (app.mapEngine) app.mapEngine.clearSelection();
          if (app.layerPanel) {
            app.layerPanel.selectedFeatureIds.clear();
            app.layerPanel.selectedFeature = null;
            app.layerPanel.updateContent();
          }
          if (app.selectionHUD) app.selectionHUD.hide();
          UIToast.notificar({ tipo: 'info', titulo: 'Seleção Limpa', duracao: 1000 });
        } else if (action === 'delete-feature') {
          const hudFeats = app.selectionHUD?.selectedFeatures || [];
          const panelSelectedIds = app.layerPanel?.selectedFeatureIds ? Array.from(app.layerPanel.selectedFeatureIds) : [];
          if (hudFeats.length > 1) {
            app.layerPanel?.onBulkDelete?.(hudFeats.map(f => f.id));
          } else if (panelSelectedIds.length > 1) {
            app.layerPanel?.onBulkDelete?.(panelSelectedIds);
          } else {
            const singleFeat = hudFeats[0] || app.layerPanel?.selectedFeature || (panelSelectedIds.length === 1 ? app.features.find(f => f.id === panelSelectedIds[0]) : null);
            if (singleFeat && typeof app.deleteFeature === 'function') {
              app.deleteFeature(singleFeat.id);
            } else {
              UIToast.notificar({
                tipo: 'alerta',
                titulo: 'Nenhuma Feição Selecionada',
                mensagem: 'Selecione uma feição para excluir.',
                duracao: 1500
              });
            }
          }
        } else if (action === 'join') {
          const hudFeats = app.selectionHUD?.selectedFeatures || [];
          const panelSelectedIds = app.layerPanel?.selectedFeatureIds ? Array.from(app.layerPanel.selectedFeatureIds) : [];
          let selected = hudFeats;
          if (selected.length < 2 && panelSelectedIds.length >= 2) {
            selected = panelSelectedIds.map(id => app.features.find(f => f.id === id)).filter(Boolean);
          }

          if (selected.length < 2) {
            UIToast.notificar({
              tipo: 'alerta',
              titulo: 'Junção de Formas [J]',
              mensagem: 'Selecione pelo menos 2 feições do mesmo tipo (linhas ou polígonos) para unir.',
              duracao: 3500
            });
            return;
          }

          const featA = selected[0];
          const featB = selected[1];
          const joinRes = SpatialAlgorithms.joinFeatures(featA, featB);

          if (!joinRes.success) {
            UIToast.notificar({
              tipo: 'erro',
              titulo: 'Falha na Junção',
              mensagem: joinRes.reason || 'Não foi possível unir as feições selecionadas.',
              duracao: 3500
            });
            return;
          }

          ShortcutsController.pushHistory(app, 'Unir Formas');

          app.features = app.features.filter(f => f.id !== featA.id && f.id !== featB.id);
          StorageService.deleteFeature(featA.id, app.projectId);
          StorageService.deleteFeature(featB.id, app.projectId);

          const baseName = featA.name || featB.name || 'Forma Unida';
          const mergedFeat = {
            ...JSON.parse(JSON.stringify(featA)),
            id: 'feat_' + Date.now() + '_joined',
            name: `${baseName} (União)`,
            type: joinRes.type || featA.type,
            coordinates: joinRes.coordinates
          };

          app.features.push(mergedFeat);
          StorageService.saveFeature(mergedFeat, app.projectId);

          app.refreshMapAndTable();
          app.saveMetadata(true);

          if (app.mapEngine) {
            app.mapEngine.selectFeatures([mergedFeat.id]);
          }

          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'Junção Realizada [J]',
            mensagem: `"${featA.name || 'Feição 1'}" e "${featB.name || 'Feição 2'}" foram unidas com sucesso.`,
            duracao: 3500
          });
        }
      }
    });
    app.drawingToolbar.render(document.getElementById('drawing-toolbar-mount'));

    if (initialLayer && app.drawingToolbar) {
      app.drawingToolbar.setActiveLayer(initialLayer);
    }

    // Configura callbacks do MapEngine para snapping, eyedropper e split
    if (app.mapEngine) {
      app.mapEngine.onSnappingChange = (enabled) => {
        if (app.drawingToolbar) app.drawingToolbar.setSnappingEnabled(enabled);
      };

      app.mapEngine.onEyedropperSampled = (feat) => {
        const targetLayer = app.layers.find(l => l.id === feat.layerId);
        const color = feat.style?.fillColor || feat.color || targetLayer?.color || '#00E08A';
        const stroke = feat.style?.strokeColor || feat.style?.color || feat.color || '#ffffff';
        
        if (app.drawingToolbar) {
          app.drawingToolbar.setColors({ fillColor: color, strokeColor: stroke });
        }
        app.mapEngine.setActiveDrawingStyles({ fillColor: color, strokeColor: stroke });

        if (app.layerPanel?.selectedFeature && typeof app.commitFeatureEdit === 'function') {
          app.commitFeatureEdit(app.layerPanel.selectedFeature.id, (draft) => {
            if (!draft.style) draft.style = {};
            draft.style.fillColor = color;
            draft.style.strokeColor = stroke;
            draft.color = color;
          });
        }

        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Estilo Copiado [I]',
          mensagem: `Cores de "${feat.name || 'Feição'}" capturadas com sucesso.`,
          duracao: 2500
        });
      };

      app.mapEngine.onFeatureSplit = (targetFeat, polygons) => {
        ShortcutsController.pushHistory(app, 'Dividir Polígono');
        const oldId = targetFeat.id;
        app.features = app.features.filter(f => f.id !== oldId);
        StorageService.deleteFeature(oldId, app.projectId);

        const baseName = targetFeat.name || 'Polígono';
        const featA = {
          ...JSON.parse(JSON.stringify(targetFeat)),
          id: 'feat_' + Date.now() + '_a',
          name: `${baseName} (Parte 1)`,
          coordinates: polygons[0]
        };
        const featB = {
          ...JSON.parse(JSON.stringify(targetFeat)),
          id: 'feat_' + (Date.now() + 1) + '_b',
          name: `${baseName} (Parte 2)`,
          coordinates: polygons[1]
        };

        app.features.push(featA, featB);
        StorageService.saveFeature(featA, app.projectId);
        StorageService.saveFeature(featB, app.projectId);

        app.refreshMapAndTable();
        app.saveMetadata(true);

        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Polígono Dividido [K]',
          mensagem: `"${baseName}" foi dividido em 2 partes com sucesso.`,
          duracao: 3500
        });
      };

      app.mapEngine.onSplitFailed = (reason) => {
        UIToast.notificar({
          tipo: 'alerta',
          titulo: 'Divisão não realizada',
          mensagem: reason || 'A linha de corte precisa atravessar o polígono de uma borda a outra.',
          duracao: 3000
        });
      };
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
