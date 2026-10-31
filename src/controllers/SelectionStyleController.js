/* ==========================================================================
   ConecteMapas - SelectionStyleController
   Cores da seleção: grava só o que mudou, restaura feição por feição e mantém
   a barra de cores espelhando a seleção. Usado pela barra, pelo HUD e pelo conta-gotas.
   ========================================================================== */

import { abrirSeletorCor } from '@thibezer/ui-components-kit';
import { BatchActions } from '../services/BatchActions.js';
import { FeatureSyncController } from './FeatureSyncController.js';
import { AppGeometryCoordinator } from '../bootstrap/AppGeometryCoordinator.js';

// Nomes do <ui-seletor-cor> (kit) → nomes de estilo do app
const PICKER_PROPS = { preenchimento: 'fillColor', traco: 'strokeColor', opacidade: 'fillOpacity', espessuraTraco: 'strokeWidth' };

export class SelectionStyleController {
  /** Feições atualmente selecionadas (HUD, painel de camadas ou seleção única). */
  static getSelectedFeatures(app) {
    const hudFeats = app.selectionHUD?.selectedFeatures || [];
    if (hudFeats.length > 0) return hudFeats;
    const ids = app.layerPanel?.selectedFeatureIds ? Array.from(app.layerPanel.selectedFeatureIds) : [];
    const fromIds = ids.map(id => app.features.find(f => f.id === id)).filter(Boolean);
    if (fromIds.length > 0) return fromIds;
    return app.layerPanel?.selectedFeature ? [app.layerPanel.selectedFeature] : [];
  }

  /**
   * Grava cores nas feições selecionadas.
   * Só altera as propriedades indicadas em `changed`; linhas usam apenas o traço e textos a cor do texto.
   * @param {{fillColor?: string, strokeColor?: string, fillOpacity?: number}} colors
   * @param {Array<'fillColor'|'strokeColor'|'fillOpacity'>} [changed]
   */
  static applyColorsToSelection(app, colors, changed = ['fillColor', 'strokeColor', 'strokeWidth']) {
    const targets = this.getSelectedFeatures(app)
      .filter(f => !FeatureSyncController.isFeatureLocked(app, f.id));
    // Só o que mudou: numa seleção com cores diferentes, as demais propriedades ficam como estão
    const props = (changed || []).filter(k => colors[k] !== undefined);
    if (targets.length === 0 || props.length === 0) return;

    if (targets.length === 1 && typeof app.layerPanel?.commitFeatureEdit === 'function') {
      app.layerPanel.commitFeatureEdit(targets[0].id, (draft) => {
        if (!BatchActions._paint(draft, colors, props)) return false;
      });
    } else {
      // Seleções múltiplas / lotes: 1 histórico, 1 re-render e gravação consolidada
      const only = Object.fromEntries(props.map(k => [k, colors[k]]));
      BatchActions.applyColors(app, targets.map(t => t.id), only);
    }
    AppGeometryCoordinator.resyncToolbarWithSelection(app);
  }

  /** Desfaz a prévia do seletor aberto: devolve ao mapa as feições como estão em app.features. */
  static revertStylePreview(app) {
    const ids = app._stylePreviewIds;
    app._stylePreviewIds = null;
    if (!ids?.length || !app.mapEngine?.updateFeature) return;
    const byId = new Map((app.features || []).map(f => [f.id, f]));
    for (const id of ids) {
      const feat = byId.get(id);
      if (feat) app.mapEngine.updateFeature(feat, app.layers);
    }
  }

  /**
   * Seletor de estilo da seleção (botão "Estilo" do HUD), com pré-visualização ao vivo.
   * A prévia só pinta o mapa (cópias das feições): nada de histórico, gravação ou colaboração.
   * Ao confirmar, grava de uma vez só o que mudou desde a abertura (1 histórico, 1 gravação),
   * então seleções com cores diferentes não são uniformizadas. Cancelar só desfaz a prévia.
   * @param {Function} [open] abrirSeletorCor (substituível em testes)
   * @returns {Object|null} controle do seletor aberto
   */
  static openStylePicker(app, hudFeatures, anchorEl, open = abrirSeletorCor) {
    if (!hudFeatures || hudFeatures.length === 0) return null;
    // Um seletor novo descarta a prévia do anterior (o kit o fecha sem avisar)
    this.revertStylePreview(app);
    // O HUD guarda a seleção de quando foi aberto; o seletor parte das cores atuais
    const byId = new Map((app.features || []).map(f => [f.id, f]));
    const features = hudFeatures.map(f => byId.get(f.id) || f);
    const isSingle = features.length === 1;
    const first = features[0];
    const fillOf = (f) => f.style?.fillColor || f.style?.textColor || f.color || '#00E08A';

    let initial = null;

    // Propriedades que diferem do estado de abertura (nomes do app)
    const changedProps = (res) => Object.keys(PICKER_PROPS).filter(k => res[k] !== initial[k]).map(k => PICKER_PROPS[k]);
    const toColors = (res) => ({
      fillColor: res.preenchimento,
      strokeColor: res.traco,
      fillOpacity: res.opacidade,
      strokeWidth: res.espessuraTraco
    });

    const preview = (res) => {
      if (!initial) return;
      const props = changedProps(res);
      if (props.length === 0) { this.revertStylePreview(app); return; }
      const colors = toColors(res);
      const ids = [];
      for (const feat of features) {
        if (FeatureSyncController.isFeatureLocked(app, feat.id)) continue;
        const original = byId.get(feat.id) || feat;
        const draft = JSON.parse(JSON.stringify(original));
        BatchActions._paint(draft, colors, props);
        app.mapEngine?.updateFeature?.(draft, app.layers);
        ids.push(feat.id);
      }
      app._stylePreviewIds = ids;
    };

    const confirm = (res) => {
      if (!initial) return;
      const props = changedProps(res);
      this.revertStylePreview(app);
      if (props.length) this.applyColorsToSelection(app, toColors(res), props);
    };

    const handle = open({
      ancora: anchorEl || document.body,
      titulo: isSingle ? `Estilo de "${first.name || 'Feição'}"` : `Estilo em Lote (${features.length})`,
      modo: 'duplo',
      alvo: 'preenchimento',
      preenchimento: fillOf(first),
      traco: first.style?.strokeColor || '#ffffff',
      opacidade: first.style?.fillOpacity !== undefined ? Number(first.style.fillOpacity) : 0.35,
      espessuraTraco: first.style?.strokeWidth !== undefined ? Number(first.style.strokeWidth) : 2.5,
      misto: new Set(features.map(f => String(fillOf(f)).toLowerCase())).size > 1,
      coresProjeto: (app.layers || []).map(l => l.color),
      aoAlterar: preview,
      aoConfirmar: confirm,
      aoCancelar: () => this.revertStylePreview(app)
    });
    // Valores já normalizados pelo componente (#rrggbb minúsculo), para comparar com os eventos
    initial = handle?.elemento?.obterEstado?.() || null;
    return handle;
  }
}
