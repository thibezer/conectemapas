/* ==========================================================================
   ConecteMapas - FeatureInspectorRenderer
   Responsabilidade Única: Renderização HTML da Inspeção de Feições utilizando
   a Paleta de Propriedades Técnica (<ui-tabela-propriedades>) de Componentes-UI.
   ========================================================================== */

import { FeatureGeometryUtils } from '../../services/MapEngine/FeatureGeometryUtils.js';

export class FeatureInspectorRenderer {
  /**
   * @param {Object} panel LayerPanel
   * @param {'sidebar'|'floating'} context onde o inspetor está sendo desenhado
   */
  static render(panel, context = 'sidebar') {
    // Com a janela flutuante aberta, a barra lateral não duplica o inspetor (IDs únicos)
    if (context === 'sidebar' && panel.isFloating) {
      return `
        <div class="cm-inspector-empty-state">
          <div class="cm-inspector-empty-icon">🪟</div>
          <div class="cm-inspector-empty-title">Inspetor em janela flutuante</div>
          <div class="cm-inspector-empty-desc">As propriedades estão sendo exibidas na janela destacada. Use "📌 Acoplar" para trazê-la de volta.</div>
        </div>
      `;
    }

    if (!panel.selectedFeature) {
      return `
        <div class="cm-inspector-empty-state">
          <div class="cm-inspector-empty-icon">📐</div>
          <div class="cm-inspector-empty-title">Nenhum elemento selecionado</div>
          <div class="cm-inspector-empty-desc">Clique em uma feição no mapa ou na tabela para inspecionar e editar propriedades CAD/GIS em tempo real.</div>
        </div>
      `;
    }

    const feat = panel.selectedFeature;
    const isLocked = feat.locked === true;
    const typeLabel = FeatureGeometryUtils.getTypeLabel(feat.type);
    const safeCategory = panel.escapeHtml(feat.category && feat.category !== feat.type ? feat.category : typeLabel);
    const safeName = panel.escapeHtml(feat.name || '');
    // ID técnico fica só na dica (e no seletor da tabela de propriedades)
    const safeTooltip = panel.escapeHtml(`${typeLabel} · ID ${feat.id || ''}`);
    const dimSummary = this.buildDimensionSummary(panel, feat);

    return `
      <div class="cm-inspector-box">
        <!-- Topo: nome editável, categoria · métrica e ações rápidas -->
        <div class="cm-inspector-header-card ${isLocked ? 'is-locked' : ''}">
          <div class="cm-insp-identity">
            ${isLocked
              ? `<span class="cm-insp-name" title="${safeName}">${safeName || 'Sem nome'}</span>`
              : `<ui-campo-texto data-insp="name" class="cm-insp-name-input" value="${safeName}" placeholder="Sem nome" aria-label="Nome da feição" title="Clique para renomear"></ui-campo-texto>`}
            <div class="cm-insp-subline" title="${safeTooltip}">
              <span class="cm-insp-category">${safeCategory}</span>
              ${dimSummary ? `<span class="cm-insp-metric">${panel.escapeHtml(dimSummary)}</span>` : ''}
            </div>
          </div>
          <div class="cm-insp-actions" role="toolbar" aria-label="Ações da feição">
            <ui-botao-primario inline variante="ghost" data-insp="toggle-lock" class="cm-insp-tool ${isLocked ? 'is-active' : ''}" aria-pressed="${isLocked}" title="${isLocked ? 'Bloqueada — clique para desbloquear' : 'Bloquear edição e exclusão'}">${isLocked ? '🔒' : '🔓'}</ui-botao-primario>
            <ui-botao-primario inline variante="ghost" data-insp="fit" class="cm-insp-tool" title="Enquadrar no mapa">🎯</ui-botao-primario>
            ${context === 'sidebar' ? `<ui-botao-primario inline variante="ghost" data-insp="toggle-float" class="cm-insp-tool" title="Abrir em janela flutuante">🪟</ui-botao-primario>` : ''}
            <span class="cm-insp-actions-sep" aria-hidden="true"></span>
            <ui-botao-primario inline variante="ghost" data-insp="delete" class="cm-insp-tool cm-insp-tool--danger" title="${isLocked ? 'Desbloqueie para excluir' : 'Excluir feição'}" ${isLocked ? 'disabled' : ''}>🗑️</ui-botao-primario>
          </div>
        </div>

        <!-- Componente Principal: Paleta de Propriedades AutoCAD / Revit (<ui-tabela-propriedades>) -->
        <div class="cm-properties-panel-wrapper">
          <ui-tabela-propriedades
            data-insp="properties"
            titulo="Propriedades"
            modo-aplicar="imediato"
            filtro="true"
            largura-rotulo="44">
          </ui-tabela-propriedades>
        </div>
      </div>
    `;
  }

  // Resumo para leitura rápida no topo; os valores completos (4 casas) ficam
  // nas métricas da tabela de propriedades
  static buildDimensionSummary(panel, feat) {
    const coords = feat.coordinates;
    const fmt = (n, digits) => n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (feat.type === 'Polygon' && Array.isArray(coords)) {
      const m2 = panel.calculatePolygonArea(coords);
      return m2 < 10000 ? `${fmt(m2, 0)} m²` : `${fmt(m2 / 10000, 2)} ha`;
    }
    if (feat.type === 'LineString' && Array.isArray(coords)) {
      const lengthM = panel.calculatePolylineLength(coords);
      return lengthM >= 1000 ? `${fmt(lengthM / 1000, 2)} km` : `${fmt(lengthM, 1)} m`;
    }
    if (feat.type === 'Circle' && feat.radius) {
      return `raio ${fmt(Number(feat.radius), Number.isInteger(Number(feat.radius)) ? 0 : 1)} m`;
    }
    return '';
  }
}
