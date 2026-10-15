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
const PICKER_PROPS = { preenchimento: 'fillColor', traco: 'strokeColor', opacidade: 'fillOpacity' };

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
  static applyColorsToSelection(app, colors, changed = ['fillColor', 'strokeColor']) {
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

  /**
   * Devolve às feições as cores do snapshot (só nas propriedades indicadas), cada uma com a sua.
   * @param {Map<string, {color: string, style: Object}>} snapshots de BatchActions.snapshotStyles()
   * @param {Array<'fillColor'|'strokeColor'|'fillOpacity'>} props
   */
  static restoreSelectionStyles(app, snapshots, props) {
    if (!snapshots?.size || !props?.length) return;
    const ids = [...snapshots.keys()].filter(id => !FeatureSyncController.isFeatureLocked(app, id));
    if (ids.length === 0) return;
    if (ids.length === 1 && typeof app.layerPanel?.commitFeatureEdit === 'function') {
      app.layerPanel.commitFeatureEdit(ids[0], (draft) => {
        if (!BatchActions._restoreProps(draft, snapshots.get(ids[0]), props)) return false;
      });
    } else {
      BatchActions.restoreStyleProps(app, new Map(ids.map(id => [id, snapshots.get(id)])), props);
    }
    AppGeometryCoordinator.resyncToolbarWithSelection(app);
  }

  /**
   * Seletor de estilo da seleção (botão "Estilo" do HUD), com pré-visualização ao vivo.
   * Cada passo grava só o que mudou; o que volta ao valor inicial (inclusive no "Cancelar")
   * é restaurado feição por feição, então seleções com cores diferentes não são uniformizadas.
   * @param {Function} [open] abrirSeletorCor (substituível em testes)
   * @returns {Object|null} controle do seletor aberto
   */
  static openStylePicker(app, hudFeatures, anchorEl, open = abrirSeletorCor) {
    if (!hudFeatures || hudFeatures.length === 0) return null;
    // O HUD guarda a seleção de quando foi aberto; o seletor parte das cores atuais
    const byId = new Map((app.features || []).map(f => [f.id, f]));
    const features = hudFeatures.map(f => byId.get(f.id) || f);
    const isSingle = features.length === 1;
    const first = features[0];
    const fillOf = (f) => f.style?.fillColor || f.style?.textColor || f.color || '#00E08A';

    const snapshots = BatchActions.snapshotStyles(features);
    let initial = null;
    let last = null;

    const step = (res) => {
      if (!initial) return;
      const moved = Object.keys(PICKER_PROPS).filter(k => res[k] !== last[k]);
      last = res;
      const restore = moved.filter(k => res[k] === initial[k]).map(k => PICKER_PROPS[k]);
      const paint = moved.filter(k => res[k] !== initial[k]).map(k => PICKER_PROPS[k]);
      if (restore.length) this.restoreSelectionStyles(app, snapshots, restore);
      if (paint.length) {
        this.applyColorsToSelection(app, {
          fillColor: res.preenchimento,
          strokeColor: res.traco,
          fillOpacity: res.opacidade
        }, paint);
      }
    };

    const handle = open({
      ancora: anchorEl || document.body,
      titulo: isSingle ? `Estilo de "${first.name || 'Feição'}"` : `Estilo em Lote (${features.length})`,
      modo: 'duplo',
      alvo: 'preenchimento',
      preenchimento: fillOf(first),
      traco: first.style?.strokeColor || '#ffffff',
      opacidade: first.style?.fillOpacity !== undefined ? Number(first.style.fillOpacity) : 0.35,
      misto: new Set(features.map(f => String(fillOf(f)).toLowerCase())).size > 1,
      coresProjeto: (app.layers || []).map(l => l.color),
      aoAlterar: step,
      aoConfirmar: step
    });
    // Valores já normalizados pelo componente (#rrggbb minúsculo), para comparar com os eventos
    initial = handle?.elemento?.obterEstado?.() || null;
    last = initial;
    return handle;
  }
}
