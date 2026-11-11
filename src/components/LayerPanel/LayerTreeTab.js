/* ==========================================================================
   ConecteMapas - LayerTreeTab (Web Component <ui-camadas>)
   Responsabilidade Única: Ponto de entrada para o componente nativo <ui-camadas>
   do Componentes-UI (thibezer/Componentes-UI)
   ========================================================================== */

import '@thibezer/ui-components-kit/camadas';
import { BatchActions } from '../../services/BatchActions.js';
import { loadCollapsedLayers, saveCollapsedLayers } from '../../services/Storage/LayerExpansion.js';

export class LayerTreeTab {
  /**
   * Injeta camadas/feições no <ui-camadas> preservando as camadas que o usuário colapsou:
   * as já conhecidas mantêm o estado atual; as demais seguem o registro local (sobrevive ao F5).
   * Com `persistir="false"` o componente reexpande todas as camadas a cada definirCamadas().
   */
  static syncData(el, layers, features) {
    if (!el || typeof el.definirCamadas !== 'function') return;
    const hadState = el.expandedLayers instanceof Set && Array.isArray(el.camadas) && el.camadas.length > 0;
    const known = hadState ? new Set(el.camadas.map(c => c.id)) : new Set();
    const expanded = hadState ? new Set(el.expandedLayers) : new Set();
    const stored = loadCollapsedLayers();
    const apply = () => {
      el.definirCamadas(layers, features);
      let changed = false;
      for (const l of layers || []) {
        if (!l) continue;
        const collapsed = known.has(l.id) ? !expanded.has(l.id) : stored.has(l.id);
        if (collapsed && el.expandedLayers.delete(l.id)) changed = true;
      }
      return changed;
    };
    if (typeof el.emLote === 'function') el.emLote(apply);
    else if (apply() && typeof el.solicitarRenderizacao === 'function') el.solicitarRenderizacao();
  }

  /** Grava no registro local o estado de expansão atual (só se mudou desde a última gravação). */
  static persistExpansion(el) {
    if (!el || !(el.expandedLayers instanceof Set) || !Array.isArray(el.camadas) || el.camadas.length === 0) return;
    const sig = el.camadas.map(c => (el.expandedLayers.has(c.id) ? '1' : '0') + c.id).join('|');
    if (el._cmExpansionSig === sig) return;
    el._cmExpansionSig = sig;
    saveCollapsedLayers(el.camadas.map(c => c.id), el.expandedLayers);
  }

  static render(panel) {
    return `
      <ui-camadas 
        id="cm-ui-camadas" 
        persistir="false"
        style="width: 100%; height: 100%; display: flex; flex-direction: column;"
        mapa-base-ativo="${panel.currentBasemap || 'satelite'}"
        camada-ativa="${panel.activeLayerId || (panel.layers[0]?.id || '')}"
        mostrar-mapas-base="false">
      </ui-camadas>
    `;
  }

  static bindEvents(panel) {
    const el = document.getElementById('cm-ui-camadas');
    if (!el) return;

    // Desativa e limpa qualquer cache interno antigo do <ui-camadas> no localStorage
    // que sobrescrevia cores de camadas de volta para valores anteriores (reidratar).
    el.persistir = false;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('ui-camadas:cm-ui-camadas');
      } catch {}
    }

    // 1. Injeta dados do ConecteMapas no Web Component <ui-camadas>
    if (typeof el.definirCamadas === 'function') {
      LayerTreeTab.syncData(el, panel.layers || [], panel.features || []);
    } else {
      el.camadas = panel.layers || [];
      el.feicoes = panel.features || [];
    }

    if (panel.activeLayerId) el.camadaAtivaId = panel.activeLayerId;
    if (panel.currentBasemap) el.mapaBaseAtivo = panel.currentBasemap;

    if (panel.selectedFeatureIds && panel.selectedFeatureIds.size > 0) {
      if (typeof el.selecionarFeicoes === 'function') {
        el.selecionarFeicoes(Array.from(panel.selectedFeatureIds), false);
      }
      el.lastClickedFeatureId = Array.from(panel.selectedFeatureIds)[0];
    }

    // Lembra (localmente) quais camadas o operador recolheu. O componente usa Shadow DOM e interrompe
    // a propagação do clique no chevron, então escuta-se na captura e lê-se o estado após ele tratar o clique.
    el.addEventListener('click', () => {
      queueMicrotask(() => LayerTreeTab.persistExpansion(el));
    }, true);

    // Garante âncora para seleção com Shift mesmo se o clique anterior ocorreu fora do componente
    el.addEventListener('click', (e) => {
      if (e.shiftKey && !el.lastClickedFeatureId && el.selectedFeatureIds && el.selectedFeatureIds.size > 0) {
        el.lastClickedFeatureId = Array.from(el.selectedFeatureIds)[0];
      }
    }, true);

    // Flag de reentrância para isolar callbacks de loops de eco
    let _isSyncing = false;

    // Seleção de Camada Ativa para desenho
    el.addEventListener('ui-camada-selecionada', (e) => {
      if (_isSyncing) return;
      const camadaId = e.detail?.camadaId;
      if (camadaId && panel.activeLayerId !== camadaId) {
        _isSyncing = true;
        try {
          panel.activeLayerId = camadaId;
          panel.onLayerSelect(camadaId);
        } finally {
          _isSyncing = false;
        }
      }
    });

    // Alternância de Visibilidade da Camada
    el.addEventListener('ui-camada-visibilidade', (e) => {
      const { camadaId, visivel } = e.detail || {};
      const layer = panel.layers.find(l => l.id === camadaId);
      if (layer) {
        layer.visible = visivel;
        panel.onLayerToggle(camadaId, visivel);
      }
    });

    // Bloqueio de Camada
    el.addEventListener('ui-camada-bloqueio', (e) => {
      const { camadaId, bloqueado } = e.detail || {};
      if (!camadaId) return;
      panel.onLayerLockToggle(camadaId, !!bloqueado);
    });

    // Opacidade da Camada
    el.addEventListener('ui-camada-opacidade', (e) => {
      const { camadaId, opacidade } = e.detail || {};
      const layer = panel.layers.find(l => l.id === camadaId);
      if (layer) {
        layer.opacity = opacidade;
        panel.onLayerOpacityChange(camadaId, opacidade);
      }
    });

    // Cor da Camada
    el.addEventListener('ui-camada-cor', (e) => {
      const { camadaId, cor } = e.detail || {};
      const layer = panel.layers.find(l => l.id === camadaId);
      if (layer) {
        const previousColor = layer.color;
        layer.color = cor;
        panel.onLayerColorChange(camadaId, cor, previousColor);
      }
    });

    // Enquadrar Camada no Mapa
    el.addEventListener('ui-camada-enquadrar', (e) => {
      const camadaId = e.detail?.camadaId;
      if (camadaId) panel.onLayerFit(camadaId);
    });

    // Exclusão de Camada
    el.addEventListener('ui-camada-excluida', (e) => {
      const camadaId = e.detail?.camadaId;
      if (camadaId) panel.onLayerDelete(camadaId);
    });

    // Reordenação de Camadas (Z-Index / Drag & Drop)
    el.addEventListener('ui-camadas-reordenadas', (e) => {
      const novasCamadas = e.detail?.camadas;
      if (Array.isArray(novasCamadas)) {
        panel.layers = novasCamadas;
        panel.onLayerReorder(novasCamadas);
      }
    });

    // Botão "+ Camada"
    el.addEventListener('ui-camada-adicionar', () => {
      panel.onAddLayer();
    });

    // Seleção de Feições (individual ou coletiva)
    el.addEventListener('ui-feicoes-selecionadas', (e) => {
      if (_isSyncing) return;
      const { feicoesIds } = e.detail || {};
      const newIds = feicoesIds || [];
      const currentIds = Array.from(panel.selectedFeatureIds);

      // Se os IDs selecionados já são exatamente iguais, não faz nada
      if (currentIds.length === newIds.length && newIds.every(id => panel.selectedFeatureIds.has(id))) {
        return;
      }

      _isSyncing = true;
      try {
        panel.selectedFeatureIds.clear();
        newIds.forEach(id => panel.selectedFeatureIds.add(id));

        // Resolve os objetos reais de feição a partir do catálogo do painel
        const resolvedFeatures = newIds
          .map(id => panel.features.find(f => f.id === id))
          .filter(Boolean);

        if (resolvedFeatures.length === 1) {
          panel.selectedFeature = resolvedFeatures[0];
        } else {
          panel.selectedFeature = null;
        }

        if (typeof panel.onFeaturesSelect === 'function') {
          panel.onFeaturesSelect(resolvedFeatures);
        } else if (typeof panel.onFeatureSelect === 'function') {
          panel.onFeatureSelect(resolvedFeatures[0] || null);
        }
      } finally {
        _isSyncing = false;
      }
    });

    // Visibilidade de Feição Individual
    el.addEventListener('ui-feicao-visibilidade', (e) => {
      const { feicaoId, visivel } = e.detail || {};
      const feat = panel.features.find(f => f.id === feicaoId);
      if (feat) {
        panel.onFeatureToggle(feicaoId, visivel);
      }
    });

    // Bloqueio de Feição Individual
    el.addEventListener('ui-feicao-bloqueio', (e) => {
      const { feicaoId, bloqueado } = e.detail || {};
      const feat = panel.features.find(f => f.id === feicaoId);
      if (feat) {
        panel.onFeatureLockToggle(feicaoId, bloqueado);
      }
    });

    // Enquadrar Feição Individual no Mapa
    el.addEventListener('ui-feicao-enquadrar', (e) => {
      const feicaoId = e.detail?.feicaoId;
      if (feicaoId) panel.onFitFeature(feicaoId);
    });

    // Feição Movida de Camada (Arrastar entre grupos)
    el.addEventListener('ui-feicao-movida', (e) => {
      const { feicaoId, camadaDestinoId } = e.detail || {};
      const feat = panel.features.find(f => f.id === feicaoId);
      if (feat && camadaDestinoId) {
        panel.onFeatureUpdate({ ...feat, layerId: camadaDestinoId });
      }
    });

    // Renomeação inline de Feição (cria cópia para que o pushHistory capture o nome anterior)
    el.addEventListener('ui-feicao-renomeada', (e) => {
      const { feicaoId, novoNome } = e.detail || {};
      const name = String(novoNome ?? '').trim();
      const feat = panel.features.find(f => f.id === feicaoId);
      if (feat && name) {
        panel.onFeatureUpdate({ ...feat, name });
      }
    });

    // Renomeação inline de Camada
    el.addEventListener('ui-camada-renomeada', (e) => {
      const { camadaId, novoNome } = e.detail || {};
      const name = String(novoNome ?? '').trim();
      const layer = panel.layers.find(l => l.id === camadaId);
      if (layer && name) {
        layer.name = name;
        panel.onLayerRename(camadaId, name);
      }
    });

    // Reordenação de Feições dentro da Camada
    el.addEventListener('ui-feicoes-reordenadas', (e) => {
      const { feicoes } = e.detail || {};
      if (typeof panel.onFeaturesReorder !== 'function' || !Array.isArray(feicoes)) return;
      // O callback espera a lista completa: mantém as demais camadas e aplica a nova ordem desta
      const byId = new Map(panel.features.map(f => [f.id, f]));
      const reordered = feicoes.map(f => byId.get(f.id)).filter(Boolean);
      const ids = new Set(reordered.map(f => f.id));
      const others = panel.features.filter(f => !ids.has(f.id));
      panel.onFeaturesReorder([...others, ...reordered]);
    });

    // Alternância de Mapa Base (Satélite, OpenStreetMap, Google, Dark, etc.)
    el.addEventListener('ui-mapa-base-alterado', (e) => {
      if (_isSyncing) return;
      const mapaBaseId = e.detail?.mapaBaseId;
      if (mapaBaseId && panel.currentBasemap !== mapaBaseId) {
        _isSyncing = true;
        try {
          panel.currentBasemap = mapaBaseId;
          panel.onBasemapChange(mapaBaseId);
        } finally {
          _isSyncing = false;
        }
      }
    });

    // Ações em Massa do Rodapé do Painel (Visibilidade, Bloqueio, Cor, Mover, Excluir)
    el.addEventListener('ui-acao-massa', (e) => {
      const { acao, feicoesIds, valor } = e.detail || {};
      if (acao === 'excluir') {
        panel.onBulkDelete(feicoesIds);
      } else if (acao === 'visibilidade') {
        if (panel.app?.batchActions?.setVisible) {
          panel.app.batchActions.setVisible(feicoesIds || [], valor);
        } else {
          (feicoesIds || []).forEach(id => panel.onFeatureToggle(id, valor));
        }
      } else if (acao === 'bloqueio') {
        if (panel.app?.batchActions?.setLocked) {
          panel.app.batchActions.setLocked(feicoesIds || [], valor);
        } else {
          (feicoesIds || []).forEach(id => panel.onFeatureLockToggle(id, valor));
        }
      } else if (acao === 'cor') {
        if (panel.app && Array.isArray(panel.app.features)) {
          BatchActions.applyColors(panel.app, feicoesIds || [], { fillColor: valor, strokeColor: valor });
        } else {
          (feicoesIds || []).forEach(id => {
            const f = panel.features.find(feat => feat.id === id);
            if (f) {
              const isLine = /LineString/.test(f.type);
              panel.onFeatureUpdate({
                ...f,
                color: valor,
                style: {
                  ...(f.style || {}),
                  ...(isLine ? { strokeColor: valor } : { fillColor: valor })
                }
              });
            }
          });
        }
      } else if (acao === 'mover') {
        if (panel.app?.batchActions?.moveToLayer) {
          panel.app.batchActions.moveToLayer(feicoesIds || [], valor);
        } else {
          (feicoesIds || []).forEach(id => {
            const f = panel.features.find(feat => feat.id === id);
            if (f) {
              panel.onFeatureUpdate({ ...f, layerId: valor });
            }
          });
        }
      }
    });
  }
}
