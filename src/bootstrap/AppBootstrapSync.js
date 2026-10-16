/* ==========================================================================
   ConecteMapas - AppBootstrapSync
   Inicialização, hidratação assíncrona do estado (IndexedDB + Hostinger MySQL)
   e loop de sincronização colaborativa em tempo real.
   ========================================================================== */

import { UIToast } from '@thibezer/ui-components-kit';
import { StorageService } from '../services/StorageService.js';
import { CLOUD_ENABLED } from '../services/Storage/StorageConstants.js';
import { ProjectLifecycle } from '../services/Storage/ProjectLifecycle.js';
import { normalizeFeature } from '../services/MockData.js';
import { FeatureSyncController } from '../controllers/FeatureSyncController.js';

export class AppBootstrapSync {
  /**
   * Carrega o estado síncrono ultra-rápido do LocalStorage (frame zero sem FOUC)
   */
  static loadState(app) {
    const saved = StorageService.loadCurrentProject();
    if (saved && (!saved.id || saved.id === app.projectId)) {
      if (saved.name) {
        app.projectName = (saved.name === 'Levantamento Planialtimétrico - Brasília')
          ? 'Levantamento Topográfico - Umuarama'
          : saved.name;
      }
      if (Array.isArray(saved.layers) && saved.layers.length > 0) {
        app.layers = saved.layers;
        if (!app.layers.some(l => l.id === app.activeLayerId)) {
          app.activeLayerId = app.layers[0].id;
        }
      }
      if (Array.isArray(saved.features)) {
        app.features = saved.features.map(normalizeFeature);
      }
      if (Array.isArray(saved.auditLog)) app.auditLog = saved.auditLog;
      if (saved.basemap) app.currentBasemap = saved.basemap;
    } else {
      // Projeto recém-criado pelo app: nome, camadas e enquadramento vêm da semente
      const seed = ProjectLifecycle.takeSeed(app.projectId);
      if (seed) {
        app.projectName = seed.name;
        if (seed.layers.length > 0) {
          app.layers = seed.layers;
          app.activeLayerId = app.layers[0].id;
        }
        app._projectSeed = seed;
      }
      app.features = [];
      app.auditLog.push({
        id: 'aud_init',
        action: 'Projeto inicializado',
        user: 'Sistema',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      });
    }
  }

  /**
   * Hidratação completa e assíncrona do IndexedDB e nuvem
   */
  static async loadStateAsync(app) {
    try {
      const saved = await StorageService.loadCurrentProjectAsync(app.projectId);
      if (saved) {
        if (saved.name) app.projectName = saved.name;
        if (Array.isArray(saved.layers) && saved.layers.length > 0) {
          app.layers = saved.layers;
          if (!app.layers.some(l => l.id === app.activeLayerId)) {
            app.activeLayerId = app.layers[0].id;
          }
          const curActive = app.layers.find(l => l.id === app.activeLayerId) || app.layers[0];
          if (curActive) {
            if (app.mapEngine) app.mapEngine.setActiveDrawingLayer(curActive);
            if (app.drawingToolbar) app.drawingToolbar.setActiveLayer(curActive);
            if (app.layerPanel) app.layerPanel.setActiveLayerId(curActive.id);
            if (app.newFeatureModal) app.newFeatureModal.setActiveLayerId(curActive.id);
            if (app.textPromptModal) app.textPromptModal.setActiveLayerId(curActive.id);
          }
        }
        if (Array.isArray(saved.auditLog) && saved.auditLog.length > 0) {
          app.auditLog = saved.auditLog;
          if (app.layerPanel) app.layerPanel.updateAuditLog(app.auditLog);
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

          // Respeita Regra 1 do GEMINI.md: array vazio [] se o projeto estiver limpo
          app.features = cleanedFeatures.map(normalizeFeature);
          app.refreshMapAndTable(true);
          if (app.layerPanel) app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features);
          if (app.newFeatureModal) app.newFeatureModal.updateLayers(app.layers);
          if (app.textPromptModal) app.textPromptModal.updateLayers(app.layers);
          if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
        }
      }

      const hasLocalFeatures = Array.isArray(app.features) && app.features.length > 0;

      try {
        await StorageService.commitDeltas();
      } catch (e) {
        console.warn('[AppBootstrapSync] Commit de deltas pendentes no boot:', e);
      }

      // Auto-cura preventiva: se localmente não há feições, SEMPRE consulta a nuvem
      if (!hasLocalFeatures) {
        const hydrated = await this.hydrateFromCloud(app);
        if (!hydrated && saved) {
          // Fallback se a nuvem estiver indisponível no momento: tenta deltas incrementais
          try {
            const deltaChanges = await StorageService.pullChangesFromCloud(app.projectId);
            if (deltaChanges && (deltaChanges.upserted.length > 0 || deltaChanges.deleted.length > 0 || deltaChanges.layers.length > 0)) {
              FeatureSyncController.applyRemoteDeltas(app, deltaChanges);
            }
          } catch (e) {
            console.warn('[AppBootstrapSync] Falha no pull de deltas inicial:', e);
          }
        }
      } else {
        try {
          // Reenvia camadas editadas antes do último F5 para a nuvem não reverter o nome/pasta
          if (StorageService.hasPendingLayerSync()) {
            await StorageService.syncMetadataToCloud({
              id: app.projectId,
              name: app.projectName,
              basemap: app.currentBasemap,
              layers: app.layers,
              featureCount: app.features.length
            });
          }
          const deltaChanges = await StorageService.pullChangesFromCloud(app.projectId);
          if (deltaChanges) this.applyRemoteProjectName(app, deltaChanges.project);
          if (deltaChanges && (deltaChanges.upserted.length > 0 || deltaChanges.deleted.length > 0 || deltaChanges.layers.length > 0)) {
            FeatureSyncController.applyRemoteDeltas(app, deltaChanges);
          }
        } catch (e) {
          console.warn('[AppBootstrapSync] Falha no pull de deltas inicial:', e);
        }
      }
    } catch (err) {
      console.warn('[AppBootstrapSync] Erro na hidratação do projeto:', err);
    } finally {
      app._isStorageHydrated = true;
      try {
        const fixed = FeatureSyncController.refreshStoredMetrics(app);
        if (fixed > 0) console.info(`[AppBootstrapSync] Métricas de ${fixed} feição(ões) recalculadas (área/perímetro).`);
      } catch (e) {
        console.warn('[AppBootstrapSync] Falha ao recalcular métricas gravadas:', e);
      }
      this.updateSyncChip(app);
      this.startCloudSyncLoop(app);
    }
  }

  /**
   * Traz para este aparelho um nome de projeto alterado em outro lugar.
   * Não sobrescreve enquanto há edição local não enviada ou o campo está em digitação.
   */
  static applyRemoteProjectName(app, remoteProject) {
    const name = remoteProject && typeof remoteProject.name === 'string' ? remoteProject.name.trim() : '';
    if (!name || name === app.projectName) return false;
    if (StorageService.hasPendingLayerSync()) return false;

    const titleInput = typeof document !== 'undefined' ? document.getElementById('cm-project-name-input') : null;
    if (titleInput && document.activeElement === titleInput) return false;

    app.projectName = name;
    if (titleInput) titleInput.value = name;
    if (app.headerBar) app.headerBar.projectName = name;
    StorageService.saveMetadata({
      id: app.projectId,
      name,
      basemap: app.currentBasemap,
      layers: app.layers,
      featureCount: app.features.length
    });
    return true;
  }

  /**
   * Hidrata o estado da aplicação a partir de um payload da nuvem com resiliência
   */
  static async hydrateFromCloud(app, providedCloudData = null) {
    try {
      const cloudData = providedCloudData || await StorageService.loadProjectFromCloud(app.projectId);
      if (!cloudData || !cloudData.exists) return false;

      let updated = false;

      if (cloudData.project && cloudData.project.name) {
        app.projectName = cloudData.project.name;
        const titleInput = document.getElementById('cm-project-name-input');
        if (titleInput) titleInput.value = app.projectName;
        updated = true;
      }

      if (Array.isArray(cloudData.layers) && cloudData.layers.length > 0) {
        app.layers = cloudData.layers;
        updated = true;
      }

      if (Array.isArray(cloudData.features)) {
        app.features = cloudData.features
          .filter(f => !StorageService.hasLocalTombstone(f.id, app.projectId))
          .map(normalizeFeature);
        updated = true;
      }

      if (cloudData.project && cloudData.project.basemap) {
        app.currentBasemap = cloudData.project.basemap;
        if (app.mapEngine) app.mapEngine.setBaseLayer(app.currentBasemap);
        if (app.layerPanel) app.layerPanel.currentBasemap = app.currentBasemap;
        const seletor = document.getElementById('cm-seletor-mapa-base');
        if (seletor) seletor.mapaBaseAtivo = app.currentBasemap;
      }

      if (updated) {
        app.refreshMapAndTable?.(true);
        if (app.layerPanel) {
          const layersWithCounts = typeof app.getLayersWithCounts === 'function' ? app.getLayersWithCounts() : app.layers;
          app.layerPanel.updateLayers(layersWithCounts, app.features);
        }
        if (app.newFeatureModal) app.newFeatureModal.updateLayers(app.layers);
        if (app.textPromptModal) app.textPromptModal.updateLayers(app.layers);
        if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
        if (app.mapEngine && app.mapEngine.autoZoomEnabled !== false && app.features.length > 0) {
          setTimeout(() => app.mapEngine.fitAllFeatures?.(), 300);
        }

        StorageService.saveMetadata({
          id: app.projectId,
          name: app.projectName,
          basemap: app.currentBasemap,
          layers: app.layers,
          featureCount: app.features.length
        });
        await StorageService.applyRemoteChangesLocally(app.features, [], app.projectId);
      }
      return true;
    } catch (err) {
      console.warn('[AppBootstrapSync] Falha ao hidratar da nuvem:', err);
      return false;
    }
  }

  /**
   * Sincronização colaborativa quase em tempo real sobre PHP/MySQL
   */
  static startCloudSyncLoop(app) {
    // Modo local de testes: sem nuvem não há o que sincronizar
    if (!CLOUD_ENABLED) return;
    const ACTIVE_INTERVAL_MS = 1000;
    const HIDDEN_INTERVAL_MS = 5000;
    const MAX_BACKOFF_MS = 15000;

    if (app._cloudSyncTimer) {
      clearTimeout(app._cloudSyncTimer);
    }
    app._cloudSyncBackoff = ACTIVE_INTERVAL_MS;

    const schedule = (delay) => {
      if (app._cloudSyncTimer) clearTimeout(app._cloudSyncTimer);
      app._cloudSyncTimer = setTimeout(tick, delay);
    };

    const tick = async () => {
      app._cloudSyncTimer = null;
      if (app._cloudSyncRunning || app._projectClosed) return;

      if ((typeof document !== 'undefined' && document.hidden) ||
          (typeof navigator !== 'undefined' && !navigator.onLine)) {
        schedule(HIDDEN_INTERVAL_MS);
        return;
      }

      if (app.mapEngine && app.mapEngine.isDrawing) {
        schedule(ACTIVE_INTERVAL_MS);
        return;
      }

      app._cloudSyncRunning = true;
      let nextDelay = ACTIVE_INTERVAL_MS;
      try {
        if (StorageService.hasPendingOfflineDeltas()) {
          StorageService.flushPendingOfflineDeltas(app.projectId);
        }
        // Camadas editadas offline/sem confirmação: reenvia antes de puxar da nuvem
        if (app._isStorageHydrated && StorageService.hasPendingLayerSync() && !StorageService.hasLayerSyncActive()) {
          await StorageService.syncMetadataToCloud({
            id: app.projectId,
            name: app.projectName,
            basemap: app.currentBasemap,
            layers: app.layers,
            featureCount: app.features.length
          });
        }

        const user = app.collabHub ? app.collabHub.currentUser : null;
        const presence = user ? {
          name: user.displayName || user.name,
          color: user.color,
          lat: app._lastCursorLatLng ? app._lastCursorLatLng.lat : undefined,
          lng: app._lastCursorLatLng ? app._lastCursorLatLng.lng : undefined
        } : null;

        const changes = await StorageService.pullChangesFromCloud(app.projectId, presence);
        if (!changes) {
          app._cloudSyncBackoff = Math.min((app._cloudSyncBackoff || ACTIVE_INTERVAL_MS) * 2, MAX_BACKOFF_MS);
          nextDelay = app._cloudSyncBackoff;
        } else {
          app._cloudSyncBackoff = ACTIVE_INTERVAL_MS;

          // Auto-cura contínua: se o servidor tem feições mas o cliente está com 0 feições locais
          if (changes.project && typeof changes.project.featureCount === 'number' && changes.project.featureCount > 0 && app.features.length === 0) {
            console.warn(`[AppBootstrapSync] Auto-cura ativada: servidor tem ${changes.project.featureCount} feições e local está com 0. Re-hidratando...`);
            await this.hydrateFromCloud(app);
          }

          this.applyRemoteProjectName(app, changes.project);

          const hasUpserted = changes.upserted.length > 0;
          const hasDeleted = changes.deleted.length > 0;
          const hasLayers = changes.layers.length > 0;
          if (hasUpserted || hasDeleted || hasLayers) {
            const changed = FeatureSyncController.applyRemoteDeltas(app, changes);
            if (changed) {
              this.updateSyncChip(app);
            }
          }
          if (changes.presence) {
            FeatureSyncController.applyRemotePresence(app, changes.presence);
          }
          if (changes.hasMore) {
            nextDelay = 0;
          }
        }
      } catch {
        nextDelay = ACTIVE_INTERVAL_MS * 2;
      } finally {
        app._cloudSyncRunning = false;
        schedule(nextDelay);
      }
    };

    if (!app._cloudSyncWakeBound && typeof document !== 'undefined') {
      app._cloudSyncWakeBound = true;
      const wake = () => {
        if (!document.hidden) {
          app._cloudSyncBackoff = ACTIVE_INTERVAL_MS;
          schedule(0);
        }
      };
      document.addEventListener('visibilitychange', wake);
      if (typeof window !== 'undefined') window.addEventListener('online', wake);
    }

    schedule(0);
  }

  static updateSyncChip(app) {
    const syncChip = document.getElementById('cm-sync-chip');
    if (!syncChip) return;

    const cloud = StorageService.getCloudStatus();
    let variante = 'sucesso';
    let texto = '● Conectado';
    let title = '';

    const count = Array.isArray(app.features) ? app.features.length : 0;

    if (!CLOUD_ENABLED) {
      variante = 'alerta';
      texto = `● Modo Local (${count})`;
      title = `Ambiente de desenvolvimento: persistência local ativa (${count} feições no IndexedDB). Nada é enviado à Hostinger.`;
    } else if (cloud.syncing) {
      variante = 'alerta';
      texto = '● Salvando...';
      title = 'Gravando alterações em tempo real no banco MySQL';
    } else if (cloud.connected) {
      variante = 'sucesso';
      texto = '● Conectado';
      title = `MySQL Hostinger: Conectado (${cloud.latencyMs || 0}ms) | Banco: ${cloud.database || 'u941736878_conectemapas'} | ${count} feições | Clique para testar conexão`;
    } else if (cloud.error) {
      variante = 'informativo';
      texto = `● Salvo Local (${count})`;
      title = `Banco local ativo no IndexedDB (${count} feições). Nuvem em reconexão: ${cloud.error}`;
    } else {
      variante = 'sucesso';
      texto = `● Salvo (${count})`;
      title = `Persistência ativa (${count} feições no IndexedDB)`;
    }

    // Memoização contra repaints: só toca no DOM se os valores realmente mudaram
    if (syncChip.getAttribute('variante') !== variante) {
      syncChip.setAttribute('variante', variante);
    }
    if (syncChip.textContent !== texto) {
      syncChip.textContent = texto;
    }
    if (syncChip.title !== title) {
      syncChip.title = title;
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
              mensagem: `Banco "${st.database}" ativo (${st.latencyMs}ms). Clique duplo para forçar recarga da nuvem.`,
              duracao: 4000
            });
          } else {
            UIToast.notificar({
              tipo: 'alerta',
              titulo: 'Status Hostinger MySQL',
              mensagem: `Modo local ativo (${st.error || 'servidor inacessível'}). Suas edições continuam salvas no navegador.`,
              duracao: 4000
            });
          }
        });
      });
      syncChip.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (app.reloadFromCloud) {
          app.reloadFromCloud();
        }
      });
    }
  }
}
