/* ==========================================================================
   ConecteMapas - LayerTreeTab (Web Component <ui-camadas>)
   Responsabilidade Única: Ponto de entrada para o componente nativo <ui-camadas>
   do Componentes-UI (thibezer/Componentes-UI)
   ========================================================================== */

import 'ui-components-kit/camadas';

export class LayerTreeTab {
  static render(panel) {
    return `
      <ui-camadas 
        id="cm-ui-camadas" 
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

    // 1. Injeta dados do ConecteMapas no Web Component <ui-camadas>
    if (typeof el.definirCamadas === 'function') {
      el.definirCamadas(panel.layers || [], panel.features || []);
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
    }

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
      const layer = panel.layers.find(l => l.id === camadaId);
      if (layer) {
        layer.locked = bloqueado;
        panel.features.forEach(f => {
          if (f.layerId === camadaId) f.locked = bloqueado;
        });
      }
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
        layer.color = cor;
        panel.onLayerColorChange(camadaId, cor);
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
      const { feicoesIds, feicoes } = e.detail || {};
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
        if (feicoes && feicoes.length === 1) {
          panel.selectedFeature = feicoes[0];
        } else {
          panel.selectedFeature = null;
        }

        if (typeof panel.onFeaturesSelect === 'function') {
          panel.onFeaturesSelect(feicoes || []);
        } else if (typeof panel.onFeatureSelect === 'function') {
          panel.onFeatureSelect(feicoes?.[0] || null);
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
        feat.visible = visivel;
        panel.onFeatureToggle(feicaoId, visivel);
      }
    });

    // Bloqueio de Feição Individual
    el.addEventListener('ui-feicao-bloqueio', (e) => {
      const { feicaoId, bloqueado } = e.detail || {};
      const feat = panel.features.find(f => f.id === feicaoId);
      if (feat) {
        feat.locked = bloqueado;
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
        feat.layerId = camadaDestinoId;
        panel.onFeatureUpdate(feat);
      }
    });

    // Renomeação inline de Feição (o componente só altera o objeto em memória)
    el.addEventListener('ui-feicao-renomeada', (e) => {
      const { feicaoId, novoNome } = e.detail || {};
      const name = String(novoNome ?? '').trim();
      const feat = panel.features.find(f => f.id === feicaoId);
      if (feat && name) {
        feat.name = name;
        panel.onFeatureUpdate(feat);
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
      const { camadaId, feicoes } = e.detail || {};
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
        (feicoesIds || []).forEach(id => {
          const f = panel.features.find(feat => feat.id === id);
          if (f) {
            f.visible = valor;
            panel.onFeatureToggle(id, valor);
          }
        });
      } else if (acao === 'bloqueio') {
        (feicoesIds || []).forEach(id => {
          const f = panel.features.find(feat => feat.id === id);
          if (f) {
            f.locked = valor;
            panel.onFeatureLockToggle(id, valor);
          }
        });
      } else if (acao === 'cor') {
        (feicoesIds || []).forEach(id => {
          const f = panel.features.find(feat => feat.id === id);
          if (f) {
            f.color = valor;
            panel.onFeatureUpdate(f);
          }
        });
      } else if (acao === 'mover') {
        (feicoesIds || []).forEach(id => {
          const f = panel.features.find(feat => feat.id === id);
          if (f) {
            f.layerId = valor;
            panel.onFeatureUpdate(f);
          }
        });
      }
    });
  }
}
