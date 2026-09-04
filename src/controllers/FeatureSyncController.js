/* ==========================================================================
   ConecteMapas - FeatureSyncController
   Responsabilidade Única: Gerenciamento do ciclo de vida das feições
   (criação pós-desenho, edição paramétrica, exclusão e sincronização colaborativa).
   ========================================================================== */

import { normalizeFeature } from '../services/MockData.js';
import { StorageService } from '../services/StorageService.js';
import { geoWorkerClient } from '../services/Workers/GeoWorkerClient.js';
import { UIToast } from 'ui-components-kit';

export class FeatureSyncController {
  /**
   * FLUXO ÚNICO CENTRALIZADO DE CRIAÇÃO DE FEIÇÃO (Item 12)
   * Elimina duplicidades entre CAD, Modais, Clones e Buffers.
   * Garante normalização única, persistência relacional O(1),
   * atualização atômica de UI, histórico, colaboração e mapa.
   */
  static createFeature(app, rawFeature, options = {}) {
    if (!rawFeature) return null;

    const {
      broadcastCollab = true,
      selectInUI = true,
      notifyToast = true,
      skipHistory = false,
      skipSave = false,
      toastTitle = 'Feição Salva no Mapa',
      toastMessage = null
    } = options;

    // 1. Gera nomes e atributos padrão quando não fornecidos
    let defaultName = rawFeature.name;
    let defaultCat = rawFeature.category || 'Geral';
    if (!defaultName) {
      const num = Math.floor(Math.random() * 900 + 100);
      if (rawFeature.type === 'Point') {
        defaultName = `Ponto #${num}`;
        defaultCat = 'Marco Topográfico';
      } else if (rawFeature.type === 'LineString') {
        defaultName = `Rota #${num}`;
        defaultCat = 'Eixo Viário';
      } else if (rawFeature.type === 'Polygon') {
        defaultName = `Polígono #${num}`;
        defaultCat = 'Área Delimitada';
      } else if (rawFeature.type === 'Circle') {
        defaultName = `Buffer (${rawFeature.radius || 500}m)`;
        defaultCat = 'Raio de Cobertura';
      } else {
        defaultName = `Feição #${num}`;
      }
    }

    const targetLayer = app.layers.find(l => l.id === rawFeature.layerId) 
      || app.layers.find(l => l.visible) 
      || app.layers[0] 
      || { id: 'layer-default', color: '#00E08A' };
    const layerColor = rawFeature.color || targetLayer.color || '#00E08A';

    // 2. Normalização estrita da feição
    const newFeature = normalizeFeature({
      ...rawFeature,
      id: rawFeature.id || ('feat-' + Date.now() + '-' + Math.floor(Math.random() * 1000)),
      name: defaultName,
      layerId: targetLayer.id,
      category: defaultCat,
      color: layerColor,
      description: rawFeature.description || '',
      style: {
        fillColor: layerColor,
        fillOpacity: rawFeature.type === 'LineString' ? 1 : 0.35,
        strokeColor: layerColor,
        strokeWidth: 2.5,
        strokeDashArray: '',
        markerIcon: 'pin',
        markerSize: 24,
        markerRotation: 0,
        showLabel: false,
        labelField: 'name',
        ...(rawFeature.style || {})
      },
      properties: {
        ...(rawFeature.properties || {})
      },
      createdBy: rawFeature.createdBy || 'Você',
      createdAt: rawFeature.createdAt || new Date().toISOString()
    });

    // 3. Histórico e Estado em Memória
    if (!skipHistory) {
      app.pushHistory(`Criação de "${newFeature.name}"`);
    }
    app.features.push(newFeature);

    // 4. MapEngine (adiciona com suporte a culling espacial e z-index de pane)
    if (app.mapEngine) {
      app.mapEngine.addFeature(newFeature, app.layers);
    }

    // 5. Persistência Relacional Granular O(1)
    if (!skipSave) {
      app.saveFeature(newFeature);
    }

    // 6. Colaboração em tempo real e Auditoria
    if (app.collabHub) {
      if (broadcastCollab) {
        app.collabHub.notifyFeatureCreated(newFeature);
      }
      const audit = app.collabHub.logAudit(`Criou feição "${newFeature.name}"`, newFeature.type);
      app.auditLog.unshift(audit);
      StorageService.logAudit(audit);
      if (app.layerPanel) {
        app.layerPanel.updateAuditLog(app.auditLog);
      }
    }

    // 7. Atualizações Coordenadas de UI (sem reflows redundantes)
    if (app.attributeTable) {
      app.attributeTable.updateData(app.features, app.layers);
    }
    if (app.layerPanel) {
      app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features);
      if (selectInUI) {
        app.layerPanel.setSelectedFeature(newFeature);
      }
    }
    app.updateHUD();

    // 8. Feedback visual ao usuário
    if (notifyToast) {
      UIToast.notificar({
        tipo: 'sucesso',
        titulo: toastTitle,
        mensagem: toastMessage || `"${newFeature.name}" adicionada ao mapa.`,
        duracao: 2500
      });
    }

    return newFeature;
  }

  /**
   * INGESTÃO EM LOTE CONSOLIDADA (BATCH/BULK PIPELINE) (Item 13)
   * Processa milhares de feições em um único ciclo atômico:
   * Processa em memória -> Salva lote IndexedDB -> Reconstrói índice -> Renderiza mapa 1x -> Atualiza UI 1x
   */
  static createFeaturesBatch(app, featureList, options = {}) {
    if (!Array.isArray(featureList) || featureList.length === 0) return [];

    const {
      sourceDescription = 'Ingestão em lote',
      skipHistory = false,
      broadcastCollab = false
    } = options;

    const normalized = featureList.map(raw => normalizeFeature(raw));

    if (!skipHistory) {
      app.pushHistory(`${sourceDescription} (${normalized.length} feições)`);
    }

    // 1. Ingestão em lote na memória
    app.features.push(...normalized);

    // 2. Gravação em lote atômica e assíncrona no IndexedDB
    StorageService.queueFeaturesBulkUpsert(normalized);

    // 3. Atualização única e consolidada de todo o sistema
    app.refreshMapAndTable(true);
    app.saveMetadata(false);

    // 4. Notificação de Colaboração em lote (se aplicável)
    if (broadcastCollab && app.collabHub) {
      normalized.forEach(f => app.collabHub.notifyFeatureCreated(f));
    }

    return normalized;
  }

  /**
   * INGESTÃO EM LOTE CONSOLIDADA VIA WEB WORKER (P1)
   * Processa a normalização massiva fora da thread principal,
   * salvando lotes no IndexedDB e renderizando sem bloquear a interface.
   */
  static async createFeaturesBatchAsync(app, featureList, options = {}) {
    if (!Array.isArray(featureList) || featureList.length === 0) return [];

    const {
      sourceDescription = 'Ingestão em lote assíncrona',
      skipHistory = false,
      broadcastCollab = false
    } = options;

    const normalized = await geoWorkerClient.normalizeFeaturesAsync(featureList);

    if (!skipHistory) {
      app.pushHistory(`${sourceDescription} (${normalized.length} feições)`);
    }

    // 1. Ingestão em lote na memória
    app.features.push(...normalized);

    // 2. Gravação em lote atômica e assíncrona no IndexedDB
    StorageService.queueFeaturesBulkUpsert(normalized);

    // 3. Atualização única e consolidada de todo o sistema
    app.refreshMapAndTable(true);
    app.saveMetadata(false);

    // 4. Notificação de Colaboração em lote (se aplicável)
    if (broadcastCollab && app.collabHub) {
      normalized.forEach(f => app.collabHub.notifyFeatureCreated(f));
    }

    return normalized;
  }

  /**
   * Delegador para desenho interativo concluído no mapa
   */
  static handleDrawingCompleted(app, rawFeature) {
    return FeatureSyncController.createFeature(app, rawFeature, {
      selectInUI: true,
      notifyToast: true,
      toastTitle: 'Feição Salva no Mapa'
    });
  }

  static updateFeature(app, updatedFeature) {
    const idx = app.features.findIndex(f => f.id === updatedFeature.id);
    if (idx >= 0) {
      if (updatedFeature.type === 'Polygon' && Array.isArray(updatedFeature.coordinates) && app.mapEngine) {
        const areaM2 = app.mapEngine.calculatePolygonArea(updatedFeature.coordinates);
        updatedFeature.properties = updatedFeature.properties || {};
        updatedFeature.properties['Área (ha)'] = (areaM2 / 10000).toFixed(2) + ' ha';
        updatedFeature.properties['Área (m²)'] = areaM2.toFixed(1) + ' m²';
      } else if (updatedFeature.type === 'LineString' && Array.isArray(updatedFeature.coordinates) && app.mapEngine) {
        const lengthM = app.mapEngine.calculatePolylineLength(updatedFeature.coordinates);
        updatedFeature.properties = updatedFeature.properties || {};
        updatedFeature.properties['Extensão'] = lengthM > 1000 ? (lengthM / 1000).toFixed(2) + ' km' : lengthM.toFixed(1) + ' m';
      }

      app.pushHistory(`Edição de "${updatedFeature.name}"`);
      app.features[idx] = updatedFeature;
      app.mapEngine.updateFeature(updatedFeature, app.layers);
      if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
      if (app.layerPanel && app.layerPanel.selectedFeature?.id === updatedFeature.id) {
        app.layerPanel.selectedFeature = updatedFeature;
      }
      app.collabHub.notifyFeatureUpdated(updatedFeature);
      const audit = app.collabHub.logAudit(`Editou feição "${updatedFeature.name}"`, updatedFeature.id);
      app.auditLog.unshift(audit);
      StorageService.logAudit(audit);
      if (app.layerPanel) app.layerPanel.updateAuditLog(app.auditLog);
      app.saveFeature(updatedFeature);

      UIToast.notificar({
        tipo: 'sucesso',
        titulo: 'Alterações Salvas',
        mensagem: `Feição "${updatedFeature.name}" atualizada.`,
        duracao: 2000
      });
    }
  }

  static deleteFeature(app, featureId) {
    const feat = app.features.find(f => f.id === featureId);
    const name = feat ? feat.name : featureId;
    app.pushHistory(`Exclusão de "${name}"`);
    app.features = app.features.filter(f => f.id !== featureId);
    app.mapEngine.removeFeature(featureId);
    if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
    if (app.layerPanel) app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features);
    app.updateHUD();
    app.collabHub.notifyFeatureDeleted(featureId);
    const audit = app.collabHub.logAudit(`Excluiu feição "${name}"`, featureId);
    app.auditLog.unshift(audit);
    StorageService.logAudit(audit);
    if (app.layerPanel) app.layerPanel.updateAuditLog(app.auditLog);
    app.removeFeature(featureId);

    UIToast.notificar({
      tipo: 'alerta',
      titulo: 'Feição Excluída',
      mensagem: `"${name}" removida. Pressione Ctrl+Z para desfazer.`,
      duracao: 3500
    });
  }

  static handleCollabEvent(app, type, data) {
    if (type === 'cursor:move') {
      if (app.mapEngine) {
        app.mapEngine.updateRemoteCursor(data.user, data.latlng);
      }
    } else if (type === 'feature:created') {
      app.features.push(data.feature);
      app.mapEngine.updateFeature(data.feature, app.layers);
      if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
      if (app.layerPanel) app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features);
      app.updateHUD();
      UIToast.notificar({
        tipo: 'informativo',
        titulo: 'Nova Feição Criada',
        mensagem: `${data.user.name} adicionou "${data.feature.name}".`,
        duracao: 3500
      });
    } else if (type === 'feature:updated') {
      const idx = app.features.findIndex(f => f.id === data.feature.id);
      if (idx >= 0) {
        app.features[idx] = data.feature;
        app.mapEngine.updateFeature(data.feature, app.layers);
        if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
      }
    } else if (type === 'feature:deleted') {
      app.features = app.features.filter(f => f.id !== data.featureId);
      app.mapEngine.removeFeature(data.featureId);
      if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
      if (app.layerPanel) app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features);
      app.updateHUD();
      UIToast.notificar({
        tipo: 'informativo',
        titulo: 'Feição Excluída',
        mensagem: `${data.user.name} removeu uma feição.`,
        duracao: 3500
      });
    } else if (type === 'chat:message') {
      if (app.layerPanel) {
        app.layerPanel.addChatMessage(data.message);
      }
    } else if (type === 'audit:log') {
      app.auditLog.unshift(data.entry);
      StorageService.logAudit(data.entry);
      if (app.layerPanel) {
        app.layerPanel.updateAuditLog(app.auditLog);
      }
    } else if (type === 'user:joined' || type === 'user:presence') {
      if (app.headerBar) {
        app.headerBar.updateCollaborators(app.collabHub.getActiveCollaboratorsList());
      }
    }
  }

  /**
   * Aplica deltas recebidos da sincronização na nuvem (multi-dispositivo)
   * Atualiza com segurança a memória, o motor de mapa e o IndexedDB local
   */
  static applyRemoteDeltas(app, { upserted = [], deleted = [], project = null } = {}) {
    if (!app) return false;

    let stateChanged = false;
    const deletedSet = new Set(deleted);

    // 1. Processa expurgos remotos (Tombstones)
    if (deletedSet.size > 0) {
      const initialCount = app.features.length;
      app.features = app.features.filter(f => !deletedSet.has(f.id));
      if (app.features.length !== initialCount) {
        stateChanged = true;
        for (const delId of deletedSet) {
          if (app.mapEngine) {
            app.mapEngine.removeFeature(delId);
          }
        }
      }
    }

    // 2. Processa feições criadas ou atualizadas remotamente
    if (Array.isArray(upserted) && upserted.length > 0) {
      for (const rawFeat of upserted) {
        if (!rawFeat || !rawFeat.id) continue;
        // Se o operador local estiver ativamente desenhando, adia para não interromper a precisão de clique
        if (app.mapEngine && app.mapEngine.isDrawing) continue;

        const normalized = normalizeFeature(rawFeat);
        const existingIdx = app.features.findIndex(f => f.id === normalized.id);

        if (existingIdx >= 0) {
          app.features[existingIdx] = normalized;
        } else {
          app.features.push(normalized);
        }

        if (app.mapEngine) {
          app.mapEngine.updateFeature(normalized, app.layers);
        }
        stateChanged = true;
      }
    }

    // 3. Atualiza UI se houve qualquer modificação
    if (stateChanged) {
      if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
      if (app.layerPanel) app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features);
      if (app.updateHUD) app.updateHUD();

      // Persiste no IndexedDB local de forma assíncrona sem disparar eco para a nuvem
      StorageService.applyRemoteChangesLocally(upserted, deleted, app.projectId);
      StorageService.saveMetadata({
        id: app.projectId,
        name: app.projectName,
        basemap: app.currentBasemap,
        layers: app.layers,
        featureCount: app.features.length
      });
    }

    return stateChanged;
  }
}
