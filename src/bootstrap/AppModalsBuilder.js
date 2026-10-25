/* ==========================================================================
   ConecteMapas - AppModalsBuilder
   Instanciação e montagem dos modais da aplicação
   ========================================================================== */

import { StorageService } from '../services/StorageService.js';
import { CLOUD_ENABLED } from '../services/Storage/StorageConstants.js';
import { AuthService } from '../services/Storage/AuthService.js';
import { AccessManager } from '../services/Storage/AccessManager.js';
import { PrintCloudStore } from '../services/Storage/PrintCloudStore.js';
import { ProjectLifecycle } from '../services/Storage/ProjectLifecycle.js';
import { ShareModal } from '../components/Modals/ShareModal.js';
import { AuthModal } from '../components/Modals/AuthModal.js';
import { GuestNameModal } from '../components/Modals/GuestNameModal.js';
import { ImportExportModal } from '../components/Modals/ImportExportModal.js';
import { ProjectModal } from '../components/Modals/ProjectModal.js';
import { NewFeatureModal } from '../components/Modals/NewFeatureModal.js';
import { NewLayerModal } from '../components/Modals/NewLayerModal.js';
import { PrintComposerModal } from '../components/PrintComposer/PrintComposerModal.js';
import { TextPromptModal } from '../components/Modals/TextPromptModal.js';
import { BufferModal } from '../components/Modals/BufferModal.js';
import { ShortcutsModal } from '../components/Modals/ShortcutsModal.js';

import { ProjectActionsController } from '../controllers/ProjectActionsController.js';
import { FeatureSyncController } from '../controllers/FeatureSyncController.js';
import { ModifyActionsController } from '../controllers/ModifyActionsController.js';

export class AppModalsBuilder {
  static initModals(app) {
    app.shareModal = new ShareModal({
      getProjectId: () => app.projectId || 'projeto_padrao',
      getProjectName: () => app.projectName,
      onSyncBeforeShare: async () => {
        return await StorageService.saveProjectToCloud({
          id: app.projectId || 'projeto_padrao',
          name: app.projectName,
          basemap: app.currentBasemap,
          layers: app.layers,
          features: app.features,
          center: app.mapEngine?.map ? [app.mapEngine.map.getCenter().lat, app.mapEngine.map.getCenter().lng] : [-23.7661, -53.3206],
          zoom: app.mapEngine?.map ? app.mapEngine.map.getZoom() : 14
        });
      }
    });
    app.shareModal.render(document.getElementById('share-modal-mount'));

    app.authModal = new AuthModal({
      currentProjectId: app.projectId,
      getCurrentProjectId: () => app.projectId,
      onInviteAccepted: ({ projectId }) => app.openProjectAfterInvite(projectId)
    });
    app.authModal.render(document.getElementById('auth-modal-mount'));

    app.guestNameModal = new GuestNameModal({
      onNameSet: () => app.applyAccount(null),
      onOpenLogin: () => app.authModal.open('login')
    });
    app.guestNameModal.render(document.getElementById('guest-name-modal-mount'));

    new ImportExportModal({
      onExport: (format, options) => ProjectActionsController.handleExport(app, format, options),
      onExportImage: (options) => ProjectActionsController.handleExportImage(app, options),
      onImport: (content, fileName, options) => ProjectActionsController.handleImport(app, content, fileName, options)
    }).render(document.getElementById('import-export-modal-mount'));

    app.projectModal = new ProjectModal({
      getProject: () => ({ id: app.projectId, name: app.projectName }),
      getDeletePermission: () => ProjectLifecycle.canDelete(app.projectId),
      getClaimMode: () => (!CLOUD_ENABLED ? 'local' : (AuthService.isLoggedIn() ? 'offer' : 'anonymous')),
      onCreate: (data) => ProjectActionsController.createProject(app, data),
      onDelete: () => ProjectActionsController.deleteCurrentProject(app)
    });
    app.projectModal.render(document.getElementById('project-modal-mount'));

    app.newFeatureModal = new NewFeatureModal({
      layers: app.layers,
      activeLayerId: app.activeLayerId,
      getFeatures: () => app.features,
      onSave: (newFeature) => FeatureSyncController.createFeature(app, newFeature)
    });
    app.newFeatureModal.render(document.getElementById('new-feature-modal-mount'));

    app.textPromptModal = new TextPromptModal({
      layers: app.layers,
      activeLayerId: app.activeLayerId,
      onSave: (newFeature) => {
        FeatureSyncController.handleDrawingCompleted(app, newFeature);
        if (app.mapEngine) app.mapEngine.setTool('select');
      },
      onCancel: () => {
        if (app.mapEngine) app.mapEngine.setTool('select');
      }
    });
    app.textPromptModal.render(document.getElementById('text-prompt-modal-mount'));

    app.bufferModal = new BufferModal({
      app,
      getLayers: () => app.layers,
      onApply: (targets, radius, targetLayerId, opts) => {
        ModifyActionsController.applyBuffer(app, targets, radius, targetLayerId, opts);
      }
    });
    app.bufferModal.render(document.getElementById('buffer-modal-mount'));

    app.newLayerModal = new NewLayerModal({
      onSave: (layerData) => ProjectActionsController.createLayer(app, layerData)
    });
    app.newLayerModal.render(document.getElementById('new-layer-modal-mount'));

    app.printComposerModal = new PrintComposerModal({
      projectName: app.projectName,
      layers: app.layers,
      features: app.features,
      currentBasemap: app.currentBasemap,
      // Pranchas na nuvem (sem nuvem configurada, ficam só neste navegador)
      clientId: StorageService.getClientId(),
      canWrite: (projectId) => AccessManager.canWrite(projectId),
      createCloudStore: (projectId) => (CLOUD_ENABLED
        ? new PrintCloudStore({
          projectId,
          clientId: StorageService.getClientId(),
          getUserName: () => app.collabHub?.currentUser?.displayName || ''
        })
        : null)
    });
    app.printComposerModal.render(document.getElementById('print-composer-mount'));

    app.shortcutsModal = new ShortcutsModal();
    app.shortcutsModal.render(document.getElementById('shortcuts-modal-mount'));
  }
}
