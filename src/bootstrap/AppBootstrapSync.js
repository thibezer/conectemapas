/* ==========================================================================
   ConecteMapas - AppBootstrapSync
   Inicialização, hidratação assíncrona do estado (IndexedDB + Hostinger MySQL)
   e loop de sincronização colaborativa em tempo real.
   ========================================================================== */

import { UIToast } from 'ui-components-kit';
import { StorageService } from '../services/StorageService.js';
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

      const hasLocalProjectData = saved && (
        (Array.isArray(saved.features) && saved.features.length > 0) ||
        (Array.isArray(saved.layers) && saved.layers.length > 0) ||
        saved.updatedAt
      );

      try {
        await StorageService.commitDeltas();
      } catch (e) {
        console.warn('[AppBootstrapSync] Commit de deltas pendentes no boot:', e);
      }

      if (!hasLocalProjectData) {
        const cloudData = await StorageService.loadProjectFromCloud(app.projectId);
        if (cloudData && cloudData.exists) {
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
            app.refreshMapAndTable(true);
            if (app.layerPanel) app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features);
            if (app.newFeatureModal) app.newFeatureModal.updateLayers(app.layers);
            if (app.textPromptModal) app.textPromptModal.updateLayers(app.layers);
            if (app.attributeTable) app.attributeTable.updateData(app.features, app.layers);
            if (app.mapEngine && app.features.length > 0) {
              setTimeout(() => app.mapEngine.fitAllFeatures(), 300);
            }

            StorageService.saveMetadata({
              id: app.projectId,
              name: app.projectName,
              basemap: app.currentBasemap,
              layers: app.layers,
              featureCount: app.features.length
            });
            StorageService.applyRemoteChangesLocally(app.features, [], app.projectId);

            UIToast.notificar({
              tipo: 'sucesso',
              titulo: 'Projeto Carregado da Nuvem',
              mensagem: `Sincronizadas ${app.features.length} feições do banco Hostinger (${cloudData.project?.name || 'Projeto'}).`,
              duracao: 4000
            });
          }
        }
      } else {
        try {
          const deltaChanges = await StorageService.pullChangesFromCloud(app.projectId);
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
   * Sincronização colaborativa quase em tempo real sobre PHP/MySQL
   */
  static startCloudSyncLoop(app) {
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
      if (app._cloudSyncRunning) return;

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
    if (cloud.syncing) {
      syncChip.setAttribute('variante', 'alerta');
      syncChip.textContent = '● Sincronizando com Hostinger MySQL...';
      syncChip.title = 'Gravando alterações em tempo real no banco u941736878_conectemapas';
    } else if (cloud.connected) {
      syncChip.setAttribute('variante', 'sucesso');
      syncChip.textContent = `● MySQL Hostinger: Conectado (${cloud.latencyMs || 0}ms)`;
      syncChip.title = `Banco: ${cloud.database} | ${app.features.length} feições ativas | Clique para verificar conexão`;
    } else if (cloud.error) {
      syncChip.setAttribute('variante', 'informativo');
      syncChip.textContent = `● Salvo Localmente (${app.features.length} feições no IndexedDB)`;
      syncChip.title = `Banco local ativo. Nuvem em reconexão: ${cloud.error}`;
    } else {
      syncChip.setAttribute('variante', 'sucesso');
      syncChip.textContent = `● Salvo (${app.features.length} feições no IndexedDB)`;
      syncChip.title = 'Persistência ativa';
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
}
