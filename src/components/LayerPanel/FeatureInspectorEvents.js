/* ==========================================================================
   ConecteMapas - FeatureInspectorEvents
   Responsabilidade Única: Vinculação de eventos e barramento reativo da Paleta
   de Propriedades (<ui-tabela-propriedades>) e controles do Inspetor de Feições.

   Toda alteração passa por panel.commitFeatureEdit(): o rascunho parte da versão
   mais recente da feição no app, nunca da cópia exibida (evita desfazer edições
   de colaboradores recebidas enquanto o painel estava aberto).
   ========================================================================== */

import { FeaturePropertiesAdapter } from './FeaturePropertiesAdapter.js';

// O seletor de cor nativo dispara 'input' a cada movimento: só grava após uma pausa
const COLOR_COMMIT_DELAY_MS = 300;
const COLOR_PROPS = new Set(['fillColor', 'strokeColor', 'pointColor', 'textColor']);

export class FeatureInspectorEvents {
  /**
   * @param {Object} panel LayerPanel
   * @param {ParentNode} root contêiner do inspetor (barra lateral ou janela flutuante)
   */
  static bind(panel, root = document) {
    if (!panel.selectedFeature || !root) return;
    const q = (sel) => root.querySelector(sel);
    const featId = panel.selectedFeature.id;

    // 1. Paleta <ui-tabela-propriedades>
    const tabelaProps = q('[data-insp="properties"]');
    if (tabelaProps) {
      const { tipos, categorias } = FeaturePropertiesAdapter.gerarConfiguracao(panel, panel.selectedFeature);
      tabelaProps.tipos = tipos;
      tabelaProps.categorias = categorias;

      const colorTimers = new Map();
      tabelaProps.addEventListener('ui-propriedade-alterada', (e) => {
        const { id, valor } = e.detail || {};
        if (!id) return;
        if (COLOR_PROPS.has(id)) {
          // Pré-visualização instantânea no mapa sem gravar; grava ao parar de arrastar
          FeaturePropertiesAdapter.previewAlteracao(panel, featId, id, valor);
          clearTimeout(colorTimers.get(id));
          colorTimers.set(id, setTimeout(() => {
            colorTimers.delete(id);
            FeaturePropertiesAdapter.aplicarAlteracao(panel, featId, id, valor);
          }, COLOR_COMMIT_DELAY_MS));
          return;
        }
        FeaturePropertiesAdapter.aplicarAlteracao(panel, featId, id, valor);
      });

      // Botões de ação da tabela (o kit emite 'ui-acao-clique')
      tabelaProps.addEventListener('ui-acao-clique', (e) => {
        const { id } = e.detail || {};
        if (id) FeaturePropertiesAdapter.executarAcao(panel, featId, id);
      });

      // Lembra categorias abertas/fechadas: a tabela é recriada a cada gravação
      tabelaProps.addEventListener('ui-categoria-toggle', (e) => {
        const { id, aberto } = e.detail || {};
        if (!id) return;
        panel._inspectorCategoryOpen = { ...(panel._inspectorCategoryOpen || {}), [id]: !!aberto };
      });
    }

    // 2. Toolbar Rápida do Topo
    q('[data-insp="toggle-lock"]')?.addEventListener('click', () => {
      const saved = panel.commitFeatureEdit(featId, (draft) => { draft.locked = !draft.locked; });
      if (!saved) return;
    });

    // Nome editável no topo: grava ao sair do campo ou com Enter; Esc desfaz
    const nameInput = q('[data-insp="name"]');
    if (nameInput) {
      const original = panel.selectedFeature.name || '';
      nameInput.addEventListener('change', () => {
        const value = String(nameInput.value ?? '').trim();
        if (value === original) return;
        if (!value) nameInput.value = original;
        FeaturePropertiesAdapter.aplicarAlteracao(panel, featId, 'name', value);
      });
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); nameInput.value = original; nameInput.blur(); }
      });
    }

    q('[data-insp="toggle-float"]')?.addEventListener('click', () => panel.toggleFloatingWindow());
    q('[data-insp="fit"]')?.addEventListener('click', () => panel.onFitFeature(featId));
    q('[data-insp="delete"]')?.addEventListener('click', () => FeaturePropertiesAdapter.confirmDelete(panel, featId));
  }
}
