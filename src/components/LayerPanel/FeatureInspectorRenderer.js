/* ==========================================================================
   ConecteMapas - FeatureInspectorRenderer
   Responsabilidade Única: Renderização HTML da Inspeção de Feições utilizando
   a Paleta de Propriedades Técnica (<ui-tabela-propriedades>) de Componentes-UI.
   ========================================================================== */

export class FeatureInspectorRenderer {
  static render(panel) {
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
    const safeCategory = panel.escapeHtml(feat.category || feat.type || 'Geral');
    const safeId = panel.escapeHtml(feat.id || '');

    const isPoly = feat.type === 'Polygon';
    const isLine = feat.type === 'LineString';
    const isCircle = feat.type === 'Circle';
    const coordinates = Array.isArray(feat.coordinates) ? feat.coordinates : [];
    const isMultiGeom = Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0]);
    const flattenedPoints = isMultiGeom ? coordinates.flat() : coordinates;
    const hasVertices = (isPoly || isLine) && flattenedPoints.length > 0;
    const segments = hasVertices && !isMultiGeom ? panel.calculateFeatureSegments(coordinates, isPoly) : [];

    let dimSummary = 'Ponto';
    if (isPoly && coordinates.length >= 3) {
      const areaM2 = panel.calculatePolygonArea(coordinates);
      const ha = areaM2 / 10000;
      dimSummary = ha >= 1000 
        ? `${ha.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha` 
        : `${ha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`;
    } else if (isLine && coordinates.length >= 2) {
      const lengthM = panel.calculatePolylineLength(coordinates);
      dimSummary = lengthM >= 1000 
        ? `${(lengthM / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km` 
        : `${lengthM.toFixed(1)} m`;
    } else if (isCircle) {
      dimSummary = `R: ${feat.radius || 50}m`;
    }

    return `
      <div class="cm-inspector-box">
        <!-- Topo: Header Card com Toolbar Rápida -->
        <div class="cm-inspector-header-card">
          <div class="cm-inspector-header-top">
            <div class="cm-header-badge-group">
              <ui-badge variante="primario">${safeCategory}</ui-badge>
              ${isLocked 
                ? `<span class="cm-locked-badge">🔒 Travado</span>` 
                : `<span class="cm-summary-pill-main" title="${dimSummary}">${dimSummary}</span>`}
            </div>
            <div class="cm-inspector-quick-toolbar">
              <button id="btn-toggle-lock" class="cm-quick-tool-btn ${isLocked ? 'active-lock' : ''}" title="${isLocked ? 'Feição Bloqueada (Clique para Desbloquear)' : 'Feição Livre (Clique para Bloquear)'}">
                ${isLocked ? '🔒' : '🔓'}
              </button>
              <button id="btn-toggle-float" class="cm-quick-tool-btn" title="Destacar em Janela Flutuante">🪟</button>
              <button id="btn-fit-feature" class="cm-quick-tool-btn" title="Enquadrar no Mapa">🎯</button>
              <button id="btn-delete-inspector" class="cm-quick-tool-btn btn-danger" title="Excluir Feição">🗑️</button>
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

        <!-- Componente Principal: Paleta de Propriedades AutoCAD / Revit (<ui-tabela-propriedades>) -->
        <div class="cm-properties-panel-wrapper">
          <ui-tabela-propriedades
            id="cm-feature-properties-table"
            titulo="Propriedades CAD / GIS"
            modo-aplicar="imediato"
            filtro="true"
            largura-rotulo="44">
          </ui-tabela-propriedades>
        </div>

        <!-- Vértices & Azimutes Topográficos (Para Polígonos e Linhas) -->
        ${hasVertices ? `
          <details class="cm-inspector-accordion cm-vertices-accordion">
            ${panel.renderAccordionHeader('📐 Vértices & Azimutes', `${coordinates.length} nós`)}
            <div class="cm-accordion-content">
              <div style="display: flex; justify-content: flex-end; margin-bottom: 6px;">
                <ui-botao-primario inline id="btn-toggle-vertex-edit" variante="${panel.isVertexEditing ? 'primary' : 'secundario'}" style="height: 24px; font-size: 10.5px; padding: 0 8px;" ${isLocked ? 'desabilitado' : ''}>
                  ${panel.isVertexEditing ? '✔ Concluir Edição' : '✏️ Editar Vértices no Mapa'}
                </ui-botao-primario>
              </div>

              <details class="cm-vertex-details" open>
                <summary class="cm-vertex-summary">📍 Coordenadas dos Vértices (${coordinates.length})</summary>
                <div class="cm-vertex-list-scroll">
                  ${coordinates.map((pt, idx) => `
                    <div class="cm-vertex-row" data-vertex-idx="${idx}">
                      <span class="cm-vertex-badge">V${idx + 1}</span>
                      <input type="number" step="0.00001" class="cm-vertex-input" data-v-lat="${idx}" value="${Number(pt[0]).toFixed(5)}" ${isLocked ? 'disabled' : ''} />
                      <input type="number" step="0.00001" class="cm-vertex-input" data-v-lng="${idx}" value="${Number(pt[1]).toFixed(5)}" ${isLocked ? 'disabled' : ''} />
                      ${!isLocked ? `<button class="cm-vertex-del-btn" data-v-del="${idx}" title="Excluir Vértice">×</button>` : ''}
                    </div>
                  `).join('')}
                </div>
              </details>

              ${segments.length > 0 ? `
                <details class="cm-vertex-details">
                  <summary class="cm-vertex-summary">🧭 Azimutes & Distâncias das Arestas</summary>
                  <div class="cm-vertex-list-scroll" style="max-height: 110px;">
                    ${segments.map(seg => `
                      <div class="cm-segment-row">
                        <span style="color: var(--cm-primary); font-weight: 600;">V${seg.from} ➔ V${seg.to}</span>
                        <span>Az: <strong>${seg.azimuth.toFixed(1)}°</strong></span>
                        <span style="color: var(--cm-text-muted);">${seg.distance > 1000 ? (seg.distance / 1000).toFixed(2) + ' km' : seg.distance.toFixed(1) + ' m'}</span>
                      </div>
                    `).join('')}
                  </div>
                </details>
              ` : ''}

              <div style="display: flex; gap: 4px; border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 6px; margin-top: 6px;">
                <ui-botao-primario inline id="btn-copy-wkt" variante="secundario" style="flex: 1; height: 24px; font-size: 10px;">📋 WKT</ui-botao-primario>
                <ui-botao-primario inline id="btn-copy-geojson" variante="secundario" style="flex: 1; height: 24px; font-size: 10px;">📋 GeoJSON</ui-botao-primario>
              </div>
            </div>
          </details>
        ` : ''}
      </div>
    `;
  }
}
