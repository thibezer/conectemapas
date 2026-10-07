/* ==========================================================================
   ConecteMapas - AppModalsBuilder
   Instanciação e montagem dos modais da aplicação
   ========================================================================== */

import { StorageService } from '../services/StorageService.js';
import { ShareModal } from '../components/Modals/ShareModal.js';
import { AuthModal } from '../components/Modals/AuthModal.js';
import { ImportExportModal } from '../components/Modals/ImportExportModal.js';
import { ProjectTemplatesModal } from '../components/Modals/ProjectTemplatesModal.js';
import { NewFeatureModal } from '../components/Modals/NewFeatureModal.js';
import { NewLayerModal } from '../components/Modals/NewLayerModal.js';
import { PrintComposerModal } from '../components/PrintComposer/PrintComposerModal.js';
import { TextPromptModal } from '../components/Modals/TextPromptModal.js';

import { ProjectActionsController } from '../controllers/ProjectActionsController.js';
import { FeatureSyncController } from '../controllers/FeatureSyncController.js';

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
      onInviteAccepted: ({ projectId }) => app.openProjectAfterInvite(projectId)
    });
    app.authModal.render(document.getElementById('auth-modal-mount'));

    new ImportExportModal({
      onExport: (format, options) => ProjectActionsController.handleExport(app, format, options),
      onExportImage: (options) => ProjectActionsController.handleExportImage(app, options),
      onImport: (content, fileName, options) => ProjectActionsController.handleImport(app, content, fileName, options)
    }).render(document.getElementById('import-export-modal-mount'));

    new ProjectTemplatesModal({
      onSelectTemplate: (template) => ProjectActionsController.loadTemplate(app, template)
    }).render(document.getElementById('templates-modal-mount'));

    app.newFeatureModal = new NewFeatureModal({
      layers: app.layers,
      activeLayerId: app.activeLayerId,
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

    app.newLayerModal = new NewLayerModal({
      onSave: (layerData) => ProjectActionsController.createLayer(app, layerData)
    });
    app.newLayerModal.render(document.getElementById('new-layer-modal-mount'));

    app.printComposerModal = new PrintComposerModal({
      projectName: app.projectName,
      layers: app.layers,
      features: app.features,
      currentBasemap: app.currentBasemap
    });
    app.printComposerModal.render(document.getElementById('print-composer-mount'));
  }
}
