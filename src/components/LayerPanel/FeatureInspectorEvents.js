/* ==========================================================================
   ConecteMapas - FeatureInspectorEvents
   Responsabilidade Única: Vinculação de eventos e barramento reativo da Paleta
   de Propriedades (<ui-tabela-propriedades>) e controles do Inspetor de Feições.

   Toda alteração passa por panel.commitFeatureEdit(): o rascunho parte da versão
   mais recente da feição no app, nunca da cópia exibida (evita desfazer edições
   de colaboradores recebidas enquanto o painel estava aberto).
   ========================================================================== */

import { FeaturePropertiesAdapter } from './FeaturePropertiesAdapter.js';
import { GeoFormats } from '../../services/GeoFormats.js';
import { FeatureGeometryUtils } from '../../services/MapEngine/FeatureGeometryUtils.js';
import { UIToast } from '@thibezer/ui-components-kit';

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
    const isLockedNow = () => panel.getLatestFeature(featId)?.locked === true;

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

      tabelaProps.addEventListener('ui-acao-executada', (e) => {
        const { id } = e.detail || {};
        if (id) FeaturePropertiesAdapter.executarAcao(panel, featId, id);
      });
    }

    // 2. Toolbar Rápida do Topo
    q('[data-insp="toggle-lock"]')?.addEventListener('click', () => {
      const saved = panel.commitFeatureEdit(featId, (draft) => { draft.locked = !draft.locked; });
      if (!saved) return;
    });

    q('[data-insp="toggle-float"]')?.addEventListener('click', () => panel.toggleFloatingWindow());
    q('[data-insp="fit"]')?.addEventListener('click', () => panel.onFitFeature(featId));
    q('[data-insp="delete"]')?.addEventListener('click', () => FeaturePropertiesAdapter.confirmDelete(panel, featId));

    // 3. Edição de vértices e cópia da geometria
    q('[data-insp="toggle-vertex-edit"]')?.addEventListener('click', () => {
      if (isLockedNow()) return;
      panel.toggleVertexEditing();
    });

    q('[data-insp="copy-wkt"]')?.addEventListener('click', () => {
      const feat = panel.getLatestFeature(featId) || panel.selectedFeature;
      FeaturePropertiesAdapter.copyToClipboard(GeoFormats.toWKT(feat), 'WKT Copiado', 'Geometria copiada em formato Well-Known Text.');
    });

    q('[data-insp="copy-geojson"]')?.addEventListener('click', () => {
      const feat = panel.getLatestFeature(featId) || panel.selectedFeature;
      FeaturePropertiesAdapter.copyToClipboard(GeoFormats.toGeoJSON([feat]), 'GeoJSON Copiado', 'Feição copiada em formato GeoJSON.');
    });

    // Coordenada de um vértice (lat = eixo 0, lng = eixo 1), por anel
    root.querySelectorAll('.cm-vertex-input').forEach(input => {
      input.addEventListener('change', () => {
        if (isLockedNow()) return;
        const ringIdx = parseInt(input.getAttribute('data-ring'), 10);
        const vIdx = parseInt(input.getAttribute('data-v'), 10);
        const axis = parseInt(input.getAttribute('data-axis'), 10);
        const val = parseFloat(input.value);
        const limit = axis === 0 ? 90 : 180;
        if (!Number.isFinite(val) || Math.abs(val) > limit) {
          UIToast.notificar({ tipo: 'alerta', titulo: 'Coordenada Inválida', mensagem: `${axis === 0 ? 'Latitude' : 'Longitude'} deve estar entre -${limit} e ${limit}.` });
          panel.refreshSelectedFeature(panel.getLatestFeature(featId) || panel.selectedFeature, { immediate: true });
          return;
        }
        panel.commitFeatureEdit(featId, (draft) => {
          const ring = FeatureGeometryUtils.getVertexRings(draft)[ringIdx];
          if (!ring || !ring.points[vIdx]) return false;
          const points = ring.points.map(p => [...p]);
          points[vIdx][axis] = val;
          draft.coordinates = FeatureGeometryUtils.replaceRing(draft.coordinates, ring.path, points, ring.closed);
        });
      });
    });

    // Exclusão de vértice individual
    root.querySelectorAll('.cm-vertex-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isLockedNow()) return;
        const ringIdx = parseInt(btn.getAttribute('data-ring'), 10);
        const vIdx = parseInt(btn.getAttribute('data-v-del'), 10);
        let removed = false;
        panel.commitFeatureEdit(featId, (draft) => {
          const ring = FeatureGeometryUtils.getVertexRings(draft)[ringIdx];
          const minVertices = draft.type === 'Polygon' ? 3 : 2;
          if (!ring || !ring.points[vIdx]) return false;
          if (ring.points.length <= minVertices) {
            UIToast.notificar({ tipo: 'alerta', titulo: 'Limite Mínimo', mensagem: draft.type === 'Polygon' ? 'Cada anel precisa de no mínimo 3 vértices.' : 'Linhas precisam de no mínimo 2 vértices.' });
            return false;
          }
          const points = ring.points.filter((_, i) => i !== vIdx);
          draft.coordinates = FeatureGeometryUtils.replaceRing(draft.coordinates, ring.path, points, ring.closed);
          removed = true;
        });
      });
    });
  }
}
