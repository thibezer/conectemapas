/* ==========================================================================
   ConecteMapas - FeatureInspectorEvents
   Responsabilidade Única: Vinculação de eventos e barramento reativo da Paleta
   de Propriedades (<ui-tabela-propriedades>) e controles do Inspetor de Feições.
   ========================================================================== */

import { FeaturePropertiesAdapter } from './FeaturePropertiesAdapter.js';
import { GeoFormats } from '../../services/GeoFormats.js';
import { UIToast } from 'ui-components-kit';

export class FeatureInspectorEvents {
  static bind(panel) {
    if (!panel.selectedFeature) return;

    const feat = panel.selectedFeature;

    // 1. Inicialização e Vinculação da Paleta <ui-tabela-propriedades>
    const tabelaProps = document.getElementById('cm-feature-properties-table');
    if (tabelaProps) {
      const { tipos, categorias } = FeaturePropertiesAdapter.gerarConfiguracao(panel, feat);
      tabelaProps.tipos = tipos;
      tabelaProps.categorias = categorias;

      // Evento de alteração de propriedade
      tabelaProps.addEventListener('ui-propriedade-alterada', (e) => {
        const { id, valor } = e.detail || {};
        if (id) {
          FeaturePropertiesAdapter.aplicarAlteracao(panel, panel.selectedFeature, id, valor);
        }
      });

      // Evento de execução de ação (botões de ação dentro da tabela)
      tabelaProps.addEventListener('ui-acao-executada', (e) => {
        const { id } = e.detail || {};
        if (id) {
          FeaturePropertiesAdapter.executarAcao(panel, panel.selectedFeature, id);
        }
      });
    }

    // 2. Toolbar Rápida do Topo
    const btnLock = document.getElementById('btn-toggle-lock');
    if (btnLock) {
      btnLock.addEventListener('click', () => {
        const isLocked = !panel.selectedFeature.locked;
        const updated = { ...panel.selectedFeature, locked: isLocked };
        panel.selectedFeature = updated;
        panel.onFeatureUpdate(updated);
        panel.updateContent();
        UIToast.notificar({
          tipo: isLocked ? 'alerta' : 'sucesso',
          titulo: isLocked ? 'Feição Bloqueada' : 'Feição Desbloqueada',
          mensagem: isLocked ? 'Edições travadas.' : 'Edição liberada no mapa.',
          duracao: 2000
        });
      });
    }

    const btnFloat = document.getElementById('btn-toggle-float');
    if (btnFloat) {
      btnFloat.addEventListener('click', () => panel.toggleFloatingWindow());
    }

    const btnFit = document.getElementById('btn-fit-feature');
    if (btnFit) {
      btnFit.addEventListener('click', () => panel.onFitFeature(panel.selectedFeature.id));
    }

    const btnDelete = document.getElementById('btn-delete-inspector');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        if (panel.selectedFeature.locked) {
          UIToast.notificar({
            tipo: 'alerta',
            titulo: 'Elemento Travado',
            mensagem: 'Desbloqueie o elemento antes de excluir.'
          });
          return;
        }
        if (confirm(`Deseja realmente excluir a feição "${panel.selectedFeature.name || 'Sem Nome'}"?`)) {
          panel.onFeatureDelete(panel.selectedFeature.id);
          panel.selectedFeature = null;
          panel.updateContent();
          UIToast.notificar({
            tipo: 'info',
            titulo: 'Feição Excluída',
            mensagem: 'Elemento removido do mapa.'
          });
        }
      });
    }

    // 3. Edição Direta e Cópia de Vértices Topográficos
    const btnToggleVertex = document.getElementById('btn-toggle-vertex-edit');
    if (btnToggleVertex) {
      btnToggleVertex.addEventListener('click', () => {
        panel.toggleVertexEditing();
      });
    }

    const btnCopyWkt = document.getElementById('btn-copy-wkt');
    if (btnCopyWkt) {
      btnCopyWkt.addEventListener('click', () => {
        const wkt = GeoFormats.toWKT(panel.selectedFeature);
        navigator.clipboard.writeText(wkt)
          .then(() => UIToast.notificar({ tipo: 'sucesso', titulo: 'WKT Copiado', mensagem: 'Geometria copiada em formato Well-Known Text.' }))
          .catch(() => UIToast.notificar({ tipo: 'erro', titulo: 'Erro', mensagem: 'Falha ao copiar WKT.' }));
      });
    }

    const btnCopyGeoJson = document.getElementById('btn-copy-geojson');
    if (btnCopyGeoJson) {
      btnCopyGeoJson.addEventListener('click', () => {
        const geojson = GeoFormats.toGeoJSON([panel.selectedFeature]);
        navigator.clipboard.writeText(geojson)
          .then(() => UIToast.notificar({ tipo: 'sucesso', titulo: 'GeoJSON Copiado', mensagem: 'Feição copiada em formato GeoJSON.' }))
          .catch(() => UIToast.notificar({ tipo: 'erro', titulo: 'Erro', mensagem: 'Falha ao copiar GeoJSON.' }));
      });
    }

    // Inputs numéricos de vértices individuais
    document.querySelectorAll('.cm-vertex-input').forEach(input => {
      input.addEventListener('change', () => {
        if (panel.selectedFeature.locked) return;
        const vLat = input.getAttribute('data-v-lat');
        const vLng = input.getAttribute('data-v-lng');
        const idx = vLat !== null ? parseInt(vLat, 10) : parseInt(vLng, 10);
        const val = parseFloat(input.value);

        if (!isNaN(val) && Array.isArray(panel.selectedFeature.coordinates)) {
          const coords = JSON.parse(JSON.stringify(panel.selectedFeature.coordinates));
          if (coords[idx]) {
            if (vLat !== null) coords[idx][0] = val;
            if (vLng !== null) coords[idx][1] = val;
            const updated = { ...panel.selectedFeature, coordinates: coords };
            panel.selectedFeature = updated;
            panel.onFeatureUpdate(updated);
            panel.updateContent();
          }
        }
      });
    });

    // Exclusão de vértice individual
    document.querySelectorAll('.cm-vertex-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (panel.selectedFeature.locked) return;
        const idx = parseInt(btn.getAttribute('data-v-del'), 10);
        if (Array.isArray(panel.selectedFeature.coordinates)) {
          const coords = [...panel.selectedFeature.coordinates];
          if (panel.selectedFeature.type === 'Polygon' && coords.length <= 3) {
            UIToast.notificar({ tipo: 'alerta', titulo: 'Limite Mínimo', mensagem: 'Polígonos precisam de no mínimo 3 vértices.' });
            return;
          }
          if (panel.selectedFeature.type === 'LineString' && coords.length <= 2) {
            UIToast.notificar({ tipo: 'alerta', titulo: 'Limite Mínimo', mensagem: 'Linhas precisam de no mínimo 2 vértices.' });
            return;
          }
          coords.splice(idx, 1);
          const updated = { ...panel.selectedFeature, coordinates: coords };
          panel.selectedFeature = updated;
          panel.onFeatureUpdate(updated);
          panel.updateContent();
          UIToast.notificar({ tipo: 'info', titulo: 'Vértice Removido', mensagem: `Vértice V${idx + 1} excluído.` });
        }
      });
    });
  }
}
