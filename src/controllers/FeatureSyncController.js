/* ==========================================================================
   ConecteMapas - FeatureSyncController
   Responsabilidade Única: Gerenciamento do ciclo de vida das feições
   (criação pós-desenho, edição paramétrica, exclusão e sincronização colaborativa).
   ========================================================================== */

import { normalizeFeature } from '../services/MockData.js';
import { StorageService } from '../services/StorageService.js';
import { geoWorkerClient } from '../services/Workers/GeoWorkerClient.js';
import { UIToast } from 'ui-components-kit';
import { notifyUndoable } from '../utils/toastHelpers.js';
import { FeatureGeometryUtils } from '../services/MapEngine/FeatureGeometryUtils.js';

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
      skipHistory = false,
      skipSave = false
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
      } else if (rawFeature.type === 'Text') {
        defaultName = rawFeature.properties?.text || `Texto #${num}`;
        defaultCat = 'Anotação / Rótulo';
      } else {
        defaultName = `Feição #${num}`;
      }
    }

    const activeLayer = app.layers.find(l => l.id === app.activeLayerId)
      || app.layers.find(l => l.visible)
      || app.layers[0]
      || { id: 'layer-default', color: '#00E08A' };

    const targetLayer = app.layers.find(l => l.id === rawFeature.layerId) || activeLayer;
    const layerColor = rawFeature.color || (rawFeature.layerId ? targetLayer.color : (activeLayer.color || targetLayer.color || '#00E08A'));

    // 2. Normalização estrita da feição e cálculo de propriedades geométricas
    const initialProps = { ...(rawFeature.properties || {}) };
    // Métricas derivadas da geometria (área elipsoidal, perímetro fechado, extensão, raio)
    const metricProps = FeatureGeometryUtils.computeMetricProperties({ ...rawFeature, coordinates: rawFeature.coordinates });
    for (const [key, value] of Object.entries(metricProps)) {
      if (!initialProps[key]) initialProps[key] = value;
    }

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
      properties: initialProps,
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
    StorageService.queueFeaturesBulkUpsert(normalized, app.projectId);

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
    StorageService.queueFeaturesBulkUpsert(normalized, app.projectId);

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
      selectInUI: true
    });
  }

  /**
   * Corrige métricas gravadas por versões anteriores (a fórmula antiga de área
   * superestimava ~2,2× e ignorava o lado de fechamento no perímetro).
   * Só regrava feições que já possuem atributos métricos e cujo valor diverge.
   * @returns {number} quantidade de feições corrigidas
   */
  static refreshStoredMetrics(app) {
    if (!app || !Array.isArray(app.features)) return 0;
    const changed = [];
    for (let i = 0; i < app.features.length; i++) {
      const feat = app.features[i];
      if (!feat || !feat.properties || typeof feat.properties !== 'object') continue;
      const metrics = FeatureGeometryUtils.computeMetricProperties(feat);
      const keys = Object.keys(metrics);
      if (keys.length === 0 || !keys.some(k => k in feat.properties)) continue;
      if (keys.every(k => feat.properties[k] === metrics[k])) continue;
      const fixed = { ...feat, properties: { ...feat.properties, ...metrics } };
      app.features[i] = fixed;
      changed.push(fixed);
    }
    if (changed.length > 0) {
      StorageService.queueFeaturesBulkUpsert(changed, app.projectId);
      if (app.mapEngine) changed.forEach(f => app.mapEngine.updateFeature(f, app.layers));
      if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
      if (app.layerPanel) {
        app.layerPanel.updateFeatures(app.features);
        const fresh = changed.find(f => f.id === app.layerPanel.selectedFeature?.id);
        if (fresh) app.layerPanel.refreshSelectedFeature?.(fresh);
      }
    }
    return changed.length;
  }

  static updateFeature(app, updatedFeature) {
    const idx = app.features.findIndex(f => f.id === updatedFeature.id);
    if (idx >= 0) {
      // Recalcula as métricas gravadas a cada edição (geometria, raio)
      const metricProps = FeatureGeometryUtils.computeMetricProperties(updatedFeature);
      if (Object.keys(metricProps).length > 0) {
        updatedFeature.properties = { ...(updatedFeature.properties || {}), ...metricProps };
      }

      app.pushHistory(`Edição de "${updatedFeature.name}"`);
      app.features[idx] = updatedFeature;
      app.mapEngine.updateFeature(updatedFeature, app.layers);
      if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
      if (app.layerPanel) {
        app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features);
        // Re-renderiza o inspetor com a versão gravada (métricas recalculadas, bloqueio, camada)
        app.layerPanel.refreshSelectedFeature?.(updatedFeature, { immediate: true });
      }
      app.collabHub.notifyFeatureUpdated(updatedFeature);
      const audit = app.collabHub.logAudit(`Editou feição "${updatedFeature.name}"`, updatedFeature.id);
      app.auditLog.unshift(audit);
      StorageService.logAudit(audit);
      if (app.layerPanel) app.layerPanel.updateAuditLog(app.auditLog);
      app.saveFeature(updatedFeature);

    }
  }

  /** Feição bloqueada não pode ser excluída nem alterada por atalhos/ações em lote. */
  static isFeatureLocked(app, featureId) {
    const feat = app && Array.isArray(app.features) ? app.features.find(f => f.id === featureId) : null;
    return !!(feat && feat.locked === true);
  }

  static notifyLocked(names) {
    UIToast.notificar({
      tipo: 'alerta',
      titulo: 'Elemento Bloqueado',
      mensagem: `${names} está bloqueado. Desbloqueie no inspetor antes de alterar ou excluir.`,
      duracao: 3500
    });
  }

  static deleteFeature(app, featureId) {
    const feat = app.features.find(f => f.id === featureId);
    if (feat && feat.locked === true) {
      FeatureSyncController.notifyLocked(`"${feat.name || 'A feição'}"`);
      return false;
    }
    const name = feat ? feat.name : featureId;
    app.pushHistory(`Exclusão de "${name}"`);
    app.features = app.features.filter(f => f.id !== featureId);
    app.mapEngine.removeFeature(featureId);
    if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
    if (app.layerPanel) {
      app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features);
      app.layerPanel.handleSelectedFeatureRemoved?.(featureId);
    }
    app.updateHUD();
    app.collabHub.notifyFeatureDeleted(featureId);
    const audit = app.collabHub.logAudit(`Excluiu feição "${name}"`, featureId);
    app.auditLog.unshift(audit);
    StorageService.logAudit(audit);
    if (app.layerPanel) app.layerPanel.updateAuditLog(app.auditLog);
    app.removeFeature(featureId);

    notifyUndoable(app, { titulo: 'Feição excluída', mensagem: `"${name}" removida.` });
  }

  static handleCollabEvent(app, type, data) {
    if (type === 'cursor:move') {
      if (app.mapEngine && data.user) {
        app.mapEngine.updateRemoteCursor({ ...data.user, name: data.user.displayName || data.user.name }, data.latlng);
      }
    } else if (type === 'feature:created') {
      app.features.push(data.feature);
      app.mapEngine.updateFeature(data.feature, app.layers);
      if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
      if (app.layerPanel) app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features);
      app.updateHUD();

      // Persistência local imediata para que a feição criada pelo colega não desapareça ao recarregar a aba
      StorageService.applyRemoteChangesLocally([data.feature], [], app.projectId);
      StorageService.saveMetadata({
        id: app.projectId,
        name: app.projectName,
        basemap: app.currentBasemap,
        layers: app.layers,
        featureCount: app.features.length
      });

    } else if (type === 'feature:updated') {
      const idx = app.features.findIndex(f => f.id === data.feature.id);
      if (idx >= 0) {
        app.features[idx] = data.feature;
        app.mapEngine.updateFeature(data.feature, app.layers);
        if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
        if (app.layerPanel) app.layerPanel.refreshSelectedFeature?.(data.feature);
        StorageService.applyRemoteChangesLocally([data.feature], [], app.projectId);
      }
    } else if (type === 'feature:deleted') {
      app.features = app.features.filter(f => f.id !== data.featureId);
      app.mapEngine.removeFeature(data.featureId);
      if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
      if (app.layerPanel) {
        app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features);
        app.layerPanel.handleSelectedFeatureRemoved?.(data.featureId);
      }
      app.updateHUD();

      // Persistência local imediata do expurgo
      StorageService.applyRemoteChangesLocally([], [data.featureId], app.projectId);
      StorageService.saveMetadata({
        id: app.projectId,
        name: app.projectName,
        basemap: app.currentBasemap,
        layers: app.layers,
        featureCount: app.features.length
      });

    } else if (type === 'layer:created') {
      if (data.layer && !app.layers.some(l => l.id === data.layer.id)) {
        app.layers.push(data.layer);
        StorageService.saveLayer(data.layer, app.projectId);
        if (app.layerPanel) app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features);
        if (app.newFeatureModal) app.newFeatureModal.updateLayers(app.layers);
        if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
      }
    } else if (type === 'layer:updated') {
      if (data.layer) {
        const lIdx = app.layers.findIndex(l => l.id === data.layer.id);
        if (lIdx >= 0) {
          app.layers[lIdx] = data.layer;
          StorageService.saveLayer(data.layer, app.projectId);
          if (app.mapEngine) {
            app.mapEngine.setLayerColor(data.layer.id, data.layer.color);
            app.mapEngine.setLayerVisibility(data.layer.id, data.layer.visible !== false);
          }
          if (app.layerPanel) app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features);
        }
      }
    } else if (type === 'layer:deleted') {
      if (data.layerId) {
        app.layers = app.layers.filter(l => l.id !== data.layerId);
        StorageService.deleteLayer(data.layerId, null, app.projectId);
        if (app.layerPanel) app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features);
        if (app.newFeatureModal) app.newFeatureModal.updateLayers(app.layers);
        app.refreshMapAndTable();
      }
    } else if (type === 'chat:message') {
      if (app.layerPanel) {
        app.layerPanel.addChatMessage(data.message);
      }
    } else if (type === 'audit:log') {
      app.auditLog.unshift(data.entry);
      StorageService.logAudit(data.entry, app.projectId);
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
  static applyRemoteDeltas(app, { upserted = [], deleted = [], layers = [], project = null } = {}) {
    if (!app) return false;

    let stateChanged = false;
    const deletedSet = new Set(deleted);

    // 1. Processa reconciliação de camadas remotas
    if (Array.isArray(layers) && layers.length > 0) {
      let layersChanged = false;
      // Edição local de camadas ainda não confirmada na nuvem vence: não reverte nome/cor
      const localLayersPending = StorageService.hasPendingLayerSync();
      for (const remLayer of layers) {
        if (!remLayer || !remLayer.id) continue;
        const localLayer = app.layers.find(l => l.id === remLayer.id);
        if (!localLayer) {
          app.layers.push(remLayer);
          layersChanged = true;
        } else if (!localLayersPending) {
          if (localLayer.name !== remLayer.name || localLayer.color !== remLayer.color) {
            localLayer.name = remLayer.name;
            localLayer.color = remLayer.color;
            layersChanged = true;
          }
        }
      }
      if (layersChanged) {
        stateChanged = true;
        if (typeof app.setActiveLayer === 'function' && !app.layers.some(l => l.id === app.activeLayerId) && app.layers.length > 0) {
          app.setActiveLayer(app.layers[0].id, false);
        }
        StorageService.saveLayersBatch(app.layers, app.projectId);
        if (app.layerPanel) app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features);
        if (app.newFeatureModal) app.newFeatureModal.updateLayers(app.layers);
      }
    }

    // 2. Processa expurgos remotos (Tombstones)
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

    // 3. Processa feições criadas ou atualizadas remotamente
    if (Array.isArray(upserted) && upserted.length > 0) {
      for (const rawFeat of upserted) {
        if (!rawFeat || !rawFeat.id) continue;
        // Se a feição foi excluída localmente, ignora o upsert remoto (evita ressuscitação)
        if (StorageService.hasLocalTombstone(rawFeat.id, app.projectId)) continue;
        // (Edições locais não confirmadas já são filtradas em StorageService.pullChangesFromCloud,
        // e o loop de sync não consulta a nuvem durante um desenho ativo.)

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

    // 4. Atualiza UI se houve qualquer modificação
    if (stateChanged) {
      if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
      if (app.layerPanel) {
        app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features);
        // Inspetor aberto na feição alterada/excluída por um colaborador
        const selId = app.layerPanel.selectedFeature?.id;
        if (selId) {
          if (deletedSet.has(selId)) {
            app.layerPanel.handleSelectedFeatureRemoved?.(selId);
          } else {
            const fresh = app.features.find(f => f.id === selId);
            if (fresh && fresh !== app.layerPanel.selectedFeature) app.layerPanel.refreshSelectedFeature?.(fresh);
          }
        }
      }
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

  /**
   * Aplica a presença vinda da nuvem (operadores em outros dispositivos/navegadores):
   * cursores ao vivo no mapa e avatares no cabeçalho.
   * @param {Object} app
   * @param {Array<{id: string, name: string, color: string, lat: number|null, lng: number|null}>} presenceList
   */
  static applyRemotePresence(app, presenceList) {
    if (!app || !Array.isArray(presenceList)) return;

    const seen = new Set();
    for (const p of presenceList) {
      if (!p || !p.id) continue;
      seen.add(p.id);
      const user = { id: p.id, name: p.name || 'Colaborador', color: p.color || '#00E08A', role: 'Editor', status: 'online' };
      if (app.mapEngine && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
        app.mapEngine.updateRemoteCursor(user, [p.lat, p.lng]);
      }
    }

    // Remove cursores de quem saiu (apenas os que vieram da presença em nuvem)
    const previous = app._cloudPresenceIds || new Set();
    for (const id of previous) {
      if (!seen.has(id) && app.mapEngine && typeof app.mapEngine.removeRemoteCursor === 'function') {
        app.mapEngine.removeRemoteCursor(id);
      }
    }
    app._cloudPresenceIds = seen;

    // Só re-renderiza os avatares quando a lista de participantes muda (o pull roda a cada ~1 s)
    const presenceKey = presenceList.map(p => `${p.id}:${p.name}:${p.color}`).sort().join('|');
    if (app.collabHub && presenceKey !== app._cloudPresenceKey) {
      app._cloudPresenceKey = presenceKey;
      app.collabHub.setCloudPresence(presenceList);
      if (app.headerBar) {
        app.headerBar.updateCollaborators(app.collabHub.getActiveCollaboratorsList());
      }
    }
  }
}
