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
      pen: 'Caneta: retas e curvas (N)',
      polygon: 'Polígono / Área (A)',
      circle: 'Buffer Circular (C)',
      rectangle: 'Retângulo / BBox (R)',
      split: 'Divisão de Formas / Faca (K)',
      eyedropper: 'Conta-gotas de Estilos (I)',
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

    this.syncToolbarColors(app, list);
    this.updateHUD(app, list.length);
  }

  /** Ids da seleção atual (HUD, painel de camadas ou feição do inspetor). */
  static selectedFeatureIds(app) {
    const hud = app.selectionHUD?.selectedFeatures || [];
    if (hud.length > 0) return hud.map(f => f.id);
    const ids = app.layerPanel?.selectedFeatureIds ? Array.from(app.layerPanel.selectedFeatureIds) : [];
    if (ids.length > 0) return ids;
    return app.layerPanel?.selectedFeature?.id ? [app.layerPanel.selectedFeature.id] : [];
  }

  /**
   * Depois de gravar estilo (barra, HUD, inspetor), a barra volta a espelhar a seleção
   * com as versões atuais das feições. Sem seleção, a barra fica como está.
   */
  static resyncToolbarWithSelection(app, changedIds = null) {
    const ids = this.selectedFeatureIds(app);
    if (ids.length === 0) return;
    if (changedIds && !ids.some(id => changedIds.includes(id))) return;
    const byId = new Map((app.features || []).map(f => [f.id, f]));
    const list = ids.map(id => byId.get(id)).filter(Boolean);
    if (list.length > 0) this.syncToolbarColors(app, list);
  }

  /**
   * Espelha no seletor de cores o estilo da feição selecionada (seleção única ou múltipla),
   * exibindo estado misto (?) quando houver divergência de cores entre elementos.
   */
  static syncToolbarColors(app, list) {
    const toolbar = app.drawingToolbar;
    if (!toolbar || typeof toolbar.setColors !== 'function') return;

    if (!list || list.length === 0) {
      toolbar.setStrokeOnly(false);
      toolbar.setMixedState?.({ fill: false, stroke: false });
      return;
    }

    if (list.length === 1) {
      toolbar.setMixedState?.({ fill: false, stroke: false });
      const feat = list[0];
      const layer = (app.layers || []).find(l => l.id === feat.layerId);
      const isLine = /LineString/.test(feat.type);
      const style = feat.style || {};

      toolbar.setStrokeOnly(isLine);
      if (style.fillOpacity !== undefined) {
        toolbar.fillOpacity = Number(style.fillOpacity);
      }
      if (style.strokeWidth !== undefined) {
        toolbar.strokeWidth = Number(style.strokeWidth);
      }
      toolbar.setColors({
        fillColor: isLine ? undefined : (style.fillColor || style.textColor || feat.color || layer?.color),
        strokeColor: style.strokeColor || (isLine ? feat.color : undefined),
        fillOpacity: style.fillOpacity !== undefined ? Number(style.fillOpacity) : undefined,
        strokeWidth: style.strokeWidth !== undefined ? Number(style.strokeWidth) : undefined
      });
      app.mapEngine?.setActiveDrawingStyles(toolbar.getColors());
      return;
    }

    // Seleção Múltipla (> 1 elemento)
    const fillColors = new Set();
    const strokeColors = new Set();
    const strokeWidths = new Set();
    let allLines = true;

    for (const feat of list) {
      const isLine = /LineString/.test(feat.type);
      if (!isLine) allLines = false;
      const layer = (app.layers || []).find(l => l.id === feat.layerId);
      const s = feat.style || {};

      if (!isLine) {
        const rawFill = s.fillColor || s.textColor || feat.color || layer?.color || '';
        const fCol = String(rawFill).toLowerCase();
        if (fCol) fillColors.add(fCol);
      }
      const rawStroke = s.strokeColor || (isLine ? feat.color : undefined) || '#ffffff';
      const sCol = String(rawStroke).toLowerCase();
      if (sCol) strokeColors.add(sCol);
      if (s.strokeWidth !== undefined) strokeWidths.add(Number(s.strokeWidth));
    }

    toolbar.setStrokeOnly(allLines);

    const isMixedFill = fillColors.size > 1;
    const isMixedStroke = strokeColors.size > 1;

    toolbar.setMixedState?.({ fill: isMixedFill, stroke: isMixedStroke });

    const commonFill = (!isMixedFill && fillColors.size === 1) ? Array.from(fillColors)[0] : undefined;
    const commonStroke = (!isMixedStroke && strokeColors.size === 1) ? Array.from(strokeColors)[0] : undefined;
    const commonStrokeWidth = strokeWidths.size === 1 ? Array.from(strokeWidths)[0] : undefined;

    if (commonFill || commonStroke || commonStrokeWidth !== undefined) {
      toolbar.setColors({
        fillColor: commonFill,
        strokeColor: commonStroke,
        strokeWidth: commonStrokeWidth
      });
    }
  }

  static updateHUD(app, selectedCount = null) {
    // Seleção, recarga do mapa e desfazer/refazer passam por aqui: a aba Modificar acompanha
    app.syncRibbon?.();
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
