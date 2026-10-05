/* ==========================================================================
   ConecteMapas - AppGeometryCoordinator
   Coordenação de ferramentas de desenho CAD, inspeção de seleções,
   HUD de métricas e alternância de versões geométricas (oficiais vs prévias).
   ========================================================================== */

import { GeometryVersionManager } from '../services/GeometryVersionManager.js';

export class AppGeometryCoordinator {
  static getToolName(tool) {
    const names = {
      select: 'Navegar e Selecionar (V)',
      'pen-select': 'Caneta de Seleção Poligonal (Q)',
      point: 'Marco / Ponto (P)',
      line: 'Linha / Rota (L)',
      polygon: 'Polígono / Área (A)',
      circle: 'Buffer Circular (C)',
      rectangle: 'Retângulo / BBox (R)',
      text: 'Texto / Rótulo no Mapa (T)',
      measure: 'Régua de Medição (M)',
      'measure-line': 'Régua de Medição (M)'
    };
    return names[tool] || tool;
  }

  static setDrawingTool(app, tool) {
    if (!app.mapEngine) return;
    // Regra 2 do GEMINI.md: limpa buffers antes de trocar de ferramenta
    app.mapEngine.resetDrawingState();
    app.mapEngine.setTool(tool);
    if (app.drawingToolbar) {
      app.drawingToolbar.setActiveTool(tool);
    }
  }

  static updateSelectionState(app, features = []) {
    const list = Array.isArray(features) ? features : (features ? [features] : []);

    if (app.selectionHUD) {
      const isVertexEditing = Boolean(app.mapEngine?.vertexEditor?.isEditing?.());
      const isDrawing = Boolean(app.mapEngine?.activeTool && app.mapEngine.activeTool !== 'select');
      if (isVertexEditing || isDrawing) {
        app.selectionHUD.hide();
      } else {
        app.selectionHUD.update(list, app.layers);
      }
    }

    if (app.layerPanel) {
      if (list.length === 1) {
        app.layerPanel.setSelectedFeature(list[0]);
      } else if (list.length > 1) {
        app.layerPanel.setSelectedFeatures(list);
      } else {
        app.layerPanel.setSelectedFeature(null);
      }
    }

    if (app.attributeTable && list.length === 1) {
      app.attributeTable.selectFeature(list[0].id);
    }

    this.updateHUD(app, list.length);
  }

  static updateHUD(app, selectedCount = null) {
    const countSpan = document.getElementById('hud-features-count');
    if (countSpan) {
      const total = app.features ? app.features.length : 0;
      const count = selectedCount !== null 
        ? selectedCount 
        : (app.mapEngine?.selectedFeatureIds?.size || (app.mapEngine?.selectedFeatureId ? 1 : 0));

      if (count > 0) {
        countSpan.innerHTML = `<strong>${total}</strong> Feições Ativas <span style="color: #38bdf8; font-weight: 600;">(${count} selecionada${count > 1 ? 's' : ''})</span>`;
      } else {
        countSpan.textContent = `${total} Feições Ativas`;
      }
    }
  }

  static toggleGlobalGeometryVersion(app) {
    const isShowingPreviews = app.mapEngine.toggleGlobalShowPreviews();
    if (app.headerBar) {
      app.headerBar.updateGeometryVersionMode(isShowingPreviews);
    }
    app.refreshMapAndTable();
  }

  static toggleFeatureGeometryVersion(app, featureId) {
    if (!featureId) return;
    const feat = app.features.find(f => f.id === featureId);
    if (!feat) return;

    const isActive = app.mapEngine.toggleIndividualPreview(featureId);
    const linked = GeometryVersionManager.findLinkedFeature(feat, app.features);

    let targetToSelect = feat;
    if (isActive && linked && GeometryVersionManager.isPreview(linked)) {
      targetToSelect = linked;
    } else if (!isActive && linked && GeometryVersionManager.isOfficial(linked)) {
      targetToSelect = linked;
    }

    app.mapEngine.selectFeature(targetToSelect.id);
    this.updateSelectionState(app, [targetToSelect]);
    app.refreshMapAndTable();

  }
}
