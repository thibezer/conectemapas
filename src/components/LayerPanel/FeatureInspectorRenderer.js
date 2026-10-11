/* ==========================================================================
   ConecteMapas - FeatureInspectorRenderer
   Responsabilidade Única: Renderização HTML da Inspeção de Feições utilizando
   a Paleta de Propriedades Técnica (<ui-tabela-propriedades>) de Componentes-UI.
   ========================================================================== */

import { FeatureGeometryUtils } from '../../services/MapEngine/FeatureGeometryUtils.js';

// 8 casas decimais ≈ 1 mm: precisão compatível com levantamento topográfico
const COORD_DECIMALS = 8;

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
    const safeId = panel.escapeHtml(feat.id || '');

    const isPoly = feat.type === 'Polygon';
    const rings = FeatureGeometryUtils.getVertexRings(feat);
    const vertexCount = rings.reduce((sum, r) => sum + r.points.length, 0);
    const hasVertices = vertexCount > 0;
    // Azimutes só fazem sentido para geometria de parte única (anel externo ou linha simples)
    const segments = rings.length === 1 ? panel.calculateFeatureSegments(rings[0].points, isPoly) : [];
    const dimSummary = this.buildDimensionSummary(panel, feat);

    return `
      <div class="cm-inspector-box">
        <!-- Topo: Header Card com Toolbar Rápida -->
        <div class="cm-inspector-header-card">
          <div class="cm-inspector-header-top">
            <div class="cm-header-badge-group">
              <ui-badge variante="primario">${safeCategory}</ui-badge>
              ${isLocked
                ? `<span class="cm-locked-badge">🔒 Travado</span>`
                : `<span class="cm-summary-pill-main" title="${panel.escapeHtml(dimSummary)}">${panel.escapeHtml(dimSummary)}</span>`}
            </div>
            <div class="cm-inspector-quick-toolbar">
              <button data-insp="toggle-lock" class="cm-quick-tool-btn ${isLocked ? 'active-lock' : ''}" title="${isLocked ? 'Feição Bloqueada (Clique para Desbloquear)' : 'Feição Livre (Clique para Bloquear)'}">
                ${isLocked ? '🔒' : '🔓'}
              </button>
              <button data-insp="toggle-float" class="cm-quick-tool-btn" title="${panel.isFloating ? 'Acoplar na barra lateral' : 'Destacar em Janela Flutuante'}">🪟</button>
              <button data-insp="fit" class="cm-quick-tool-btn" title="Enquadrar no Mapa">🎯</button>
              <button data-insp="delete" class="cm-quick-tool-btn btn-danger" title="${isLocked ? 'Desbloqueie para excluir' : 'Excluir Feição'}" ${isLocked ? 'disabled' : ''}>🗑️</button>
            </div>
          </div>
          <div class="cm-inspector-meta-row">
            <div class="cm-meta-chip" title="ID: ${safeId}">
              <span class="cm-meta-label">ID</span>
              <span class="cm-meta-val">${safeId}</span>
            </div>
            <div class="cm-meta-chip" title="Status">
              <span class="cm-meta-label">STATUS</span>
              <span class="cm-meta-val">${isLocked ? 'Bloqueada' : 'Editável'}</span>
            </div>
          </div>
        </div>

        <!-- Painel Rápido de Estilo & Cores CAD -->
        ${this.renderColorPalette(panel, feat, isLocked)}

        <!-- Componente Principal: Paleta de Propriedades AutoCAD / Revit (<ui-tabela-propriedades>) -->
        <div class="cm-properties-panel-wrapper">
          <ui-tabela-propriedades
            data-insp="properties"
            titulo="Propriedades CAD / GIS"
            modo-aplicar="imediato"
            filtro="true"
            largura-rotulo="44">
          </ui-tabela-propriedades>
        </div>

        <!-- Vértices & Azimutes Topográficos (Para Polígonos e Linhas) -->
        ${hasVertices ? `
          <details class="cm-inspector-accordion cm-vertices-accordion">
            ${panel.renderAccordionHeader('📐 Vértices & Azimutes', `${vertexCount} nós`)}
            <div class="cm-accordion-content">
              <div style="display: flex; justify-content: flex-end; margin-bottom: 6px;">
                <ui-botao-primario inline data-insp="toggle-vertex-edit" variante="${panel.isVertexEditing ? 'primary' : 'secundario'}" style="height: 24px; font-size: 10.5px; padding: 0 8px;" ${isLocked ? 'desabilitado' : ''}>
                  ${panel.isVertexEditing ? '✔ Concluir Edição' : '✏️ Editar Vértices no Mapa'}
                </ui-botao-primario>
              </div>

              ${rings.map((ring, ringIdx) => this.renderRing(ring, ringIdx, rings.length > 1, isLocked, feat.type)).join('')}

              ${segments.length > 0 ? `
                <details class="cm-vertex-details">
                  <summary class="cm-vertex-summary">🧭 Azimutes & Distâncias das Arestas</summary>
                  <div class="cm-vertex-list-scroll" style="max-height: 110px;">
                    ${segments.map(seg => `
                      <div class="cm-segment-row">
                        <span style="color: var(--cm-primary); font-weight: 600;">V${seg.from} ➔ V${seg.to}</span>
                        <span>Az: <strong>${this.formatAzimuth(seg.azimuth)}</strong></span>
                        <span style="color: var(--cm-text-muted);">${seg.distance > 1000 ? (seg.distance / 1000).toFixed(3) + ' km' : seg.distance.toFixed(2) + ' m'}</span>
                      </div>
                    `).join('')}
                  </div>
                </details>
              ` : ''}

              <div style="display: flex; gap: 4px; border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 6px; margin-top: 6px;">
                <ui-botao-primario inline data-insp="copy-wkt" variante="secundario" style="flex: 1; height: 24px; font-size: 10px;">📋 WKT</ui-botao-primario>
                <ui-botao-primario inline data-insp="copy-geojson" variante="secundario" style="flex: 1; height: 24px; font-size: 10px;">📋 GeoJSON</ui-botao-primario>
              </div>
            </div>
          </details>
        ` : ''}
      </div>
    `;
  }

  static renderRing(ring, ringIdx, showLabel, isLocked, type) {
    const minVertices = type === 'Polygon' ? 3 : 2;
    const canDelete = !isLocked && ring.points.length > minVertices;
    return `
      <details class="cm-vertex-details" ${ringIdx === 0 ? 'open' : ''} style="margin-bottom: 4px;">
        <summary class="cm-vertex-summary">📍 ${showLabel ? `${ring.label} — ` : 'Coordenadas dos Vértices '}(${ring.points.length})</summary>
        <div class="cm-vertex-list-scroll">
          ${ring.points.map((pt, idx) => `
            <div class="cm-vertex-row">
              <span class="cm-vertex-badge">V${idx + 1}</span>
              <input type="number" step="any" class="cm-vertex-input" data-ring="${ringIdx}" data-v="${idx}" data-axis="0" value="${Number(pt[0]).toFixed(COORD_DECIMALS)}" title="Latitude" ${isLocked ? 'disabled' : ''} />
              <input type="number" step="any" class="cm-vertex-input" data-ring="${ringIdx}" data-v="${idx}" data-axis="1" value="${Number(pt[1]).toFixed(COORD_DECIMALS)}" title="Longitude" ${isLocked ? 'disabled' : ''} />
              ${canDelete ? `<button class="cm-vertex-del-btn" data-ring="${ringIdx}" data-v-del="${idx}" title="Excluir Vértice">×</button>` : ''}
            </div>
          `).join('')}
        </div>
      </details>
    `;
  }

  static buildDimensionSummary(panel, feat) {
    const coords = feat.coordinates;
    if (feat.type === 'Polygon' && Array.isArray(coords)) {
      const ha = panel.calculatePolygonArea(coords) / 10000;
      return ha >= 1000
        ? `${ha.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha`
        : `${ha.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ha`;
    }
    if (feat.type === 'LineString' && Array.isArray(coords)) {
      const lengthM = panel.calculatePolylineLength(coords);
      return lengthM >= 1000
        ? `${(lengthM / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} km`
        : `${lengthM.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
    }
    if (feat.type === 'Circle') {
      return feat.radius ? `R: ${Number(feat.radius).toLocaleString('pt-BR')} m` : 'Círculo';
    }
    return FeatureGeometryUtils.getTypeLabel(feat.type);
  }

  // Azimute em graus, minutos e segundos (convenção topográfica)
  static formatAzimuth(deg) {
    const total = Math.round(((deg % 360) + 360) % 360 * 3600);
    const d = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
  }

  static renderColorPalette(panel, feat, isLocked) {
    const isPoly = feat.type === 'Polygon';
    const isCircle = feat.type === 'Circle';
    const isLine = /LineString/.test(feat.type);
    const isPoint = feat.type === 'Point';
    const isText = feat.type === 'Text';

    if (isText) return '';

    const defaultColor = feat.color || '#00E08A';
    const rawFill = feat.style?.fillColor;
    const isFillNone = rawFill === 'none' || rawFill === 'transparent';
    const effectiveFill = isFillNone ? (feat.style?._lastFillColor || defaultColor) : (rawFill || defaultColor);

    const rawStroke = feat.style?.strokeColor;
    const isStrokeNone = rawStroke === 'none' || rawStroke === 'transparent';
    const effectiveStroke = isStrokeNone ? (feat.style?._lastStrokeColor || '#ffffff') : (rawStroke || (isLine ? defaultColor : '#ffffff'));

    const disabledAttr = isLocked ? 'disabled' : '';

    return `
      <div class="cm-inspector-color-card" data-insp-color-card>
        <div class="cm-color-card-header">
          <span class="cm-color-card-title">🎨 Cores & Estilo CAD</span>
          ${isPoly || isCircle ? `
            <div class="cm-color-quick-actions">
              <button type="button" class="cm-color-mini-btn" data-insp-action="swap-colors" title="Inverter Preenchimento e Borda [X]" ${disabledAttr}>⇄ Inverter</button>
              <button type="button" class="cm-color-mini-btn cm-color-mini-btn--clear" data-insp-action="clear-both-colors" title="Deixar ambos sem cor (vazado total)" ${disabledAttr}>🚫 Ambos sem cor</button>
            </div>
          ` : ''}
        </div>

        <div class="cm-color-card-body">
          ${isPoly || isCircle ? `
            <!-- Preenchimento -->
            <div class="cm-color-channel-row ${isFillNone ? 'is-none' : ''}">
              <div class="cm-channel-info">
                <span class="cm-channel-label">Preenchimento</span>
                <span class="cm-channel-status">${isFillNone ? 'Sem cor (Vazado)' : panel.escapeHtml(effectiveFill)}</span>
              </div>
              <div class="cm-channel-controls">
                <label class="cm-swatch-picker-label ${isFillNone ? 'cm-swatch-none' : ''}" title="${isFillNone ? 'Sem preenchimento (clique para escolher cor)' : `Cor: ${effectiveFill} (clique para alterar)`}">
                  <span class="cm-swatch-preview" style="${isFillNone ? '' : `background-color: ${effectiveFill};`}"></span>
                  <input type="color" class="cm-swatch-native-input" data-insp-picker="fillColor" value="${effectiveFill.startsWith('#') && effectiveFill.length === 7 ? effectiveFill : '#00E08A'}" ${disabledAttr} />
                </label>
                <button type="button" class="cm-color-toggle-btn ${isFillNone ? 'cm-btn-add' : 'cm-btn-remove'}" data-insp-toggle="fillColor" title="${isFillNone ? 'Ativar cor de preenchimento' : 'Deixar preenchimento sem cor'}" ${disabledAttr}>
                  ${isFillNone ? '🎨 Colorir' : '🚫 Sem cor'}
                </button>
              </div>
            </div>
          ` : ''}

          ${isPoly || isCircle || isLine ? `
            <!-- Borda / Contorno -->
            <div class="cm-color-channel-row ${isStrokeNone ? 'is-none' : ''}">
              <div class="cm-channel-info">
                <span class="cm-channel-label">${isLine ? 'Cor da Linha' : 'Cor da Borda'}</span>
                <span class="cm-channel-status">${isStrokeNone ? 'Sem cor (Sem linha)' : panel.escapeHtml(effectiveStroke)}</span>
              </div>
              <div class="cm-channel-controls">
                <label class="cm-swatch-picker-label ${isStrokeNone ? 'cm-swatch-none' : ''}" title="${isStrokeNone ? 'Sem borda (clique para escolher cor)' : `Cor da borda: ${effectiveStroke} (clique para alterar)`}">
                  <span class="cm-swatch-preview ${isLine ? 'cm-swatch-preview--line' : 'cm-swatch-preview--stroke'}" style="${isStrokeNone ? '' : `border-color: ${effectiveStroke}; background: transparent;`}"></span>
                  <input type="color" class="cm-swatch-native-input" data-insp-picker="strokeColor" value="${effectiveStroke.startsWith('#') && effectiveStroke.length === 7 ? effectiveStroke : '#ffffff'}" ${disabledAttr} />
                </label>
                <button type="button" class="cm-color-toggle-btn ${isStrokeNone ? 'cm-btn-add' : 'cm-btn-remove'}" data-insp-toggle="strokeColor" title="${isStrokeNone ? 'Ativar borda' : 'Deixar borda sem cor'}" ${disabledAttr}>
                  ${isStrokeNone ? '🎨 Colorir' : '🚫 Sem cor'}
                </button>
              </div>
            </div>
          ` : ''}

          ${isPoint ? `
            <!-- Marcador -->
            <div class="cm-color-channel-row">
              <div class="cm-channel-info">
                <span class="cm-channel-label">Cor do Marcador</span>
                <span class="cm-channel-status">${panel.escapeHtml(effectiveFill)}</span>
              </div>
              <div class="cm-channel-controls">
                <label class="cm-swatch-picker-label" title="Cor: ${effectiveFill}">
                  <span class="cm-swatch-preview" style="background-color: ${effectiveFill}; border-radius: 50%;"></span>
                  <input type="color" class="cm-swatch-native-input" data-insp-picker="pointColor" value="${effectiveFill.startsWith('#') && effectiveFill.length === 7 ? effectiveFill : '#00E08A'}" ${disabledAttr} />
                </label>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}
