/* ==========================================================================
   ConecteMapas - FeatureInspectorRenderer
   Responsabilidade Única: Renderização HTML do Workbench de Inspeção de Feições
   ========================================================================== */

import { SpatialAlgorithms } from '../../services/SpatialAlgorithms.js';

export class FeatureInspectorRenderer {
  static render(panel) {
    if (!panel.selectedFeature) {
      return `
        <div style="text-align: center; padding: 24px 10px; color: var(--cm-text-muted);">
          <div style="font-size: 24px; margin-bottom: 8px;">📍</div>
          <div style="font-weight: 500; font-size: 12px; color: var(--cm-text);">Nenhum elemento selecionado</div>
          <div style="font-size: 11px; margin-top: 4px;">Clique em uma feição no mapa ou na tabela para abrir o Workbench CAD/GIS.</div>
        </div>
      `;
    }

    const feat = panel.selectedFeature;
    const isLocked = feat.locked === true;
    const safeName = panel.escapeHtml(feat.name || '');
    const safeDesc = panel.escapeHtml(feat.description || '');
    const safeCategory = panel.escapeHtml(feat.category || feat.type || 'Geral');
    const safeId = panel.escapeHtml(feat.id || '');

    const isPoly = feat.type === 'Polygon';
    const isCircle = feat.type === 'Circle';
    const isLine = feat.type === 'LineString';
    const isPoint = feat.type === 'Point';

    const defaultColor = feat.color || '#00E08A';
    const style = {
      fillColor: feat.style?.fillColor || defaultColor,
      fillOpacity: feat.style?.fillOpacity !== undefined ? Number(feat.style.fillOpacity) : (isLine ? 1 : 0.35),
      strokeColor: feat.style?.strokeColor || defaultColor,
      strokeWidth: feat.style?.strokeWidth !== undefined ? Number(feat.style.strokeWidth) : 2.5,
      strokeDashArray: feat.style?.strokeDashArray || '',
      markerIcon: feat.style?.markerIcon || 'pin',
      markerSize: feat.style?.markerSize !== undefined ? Number(feat.style.markerSize) : 24,
      markerRotation: feat.style?.markerRotation !== undefined ? Number(feat.style.markerRotation) : 0,
      showLabel: feat.style?.showLabel === true,
      labelField: feat.style?.labelField || 'name'
    };

    const coordinates = Array.isArray(feat.coordinates) ? feat.coordinates : [];
    const isMultiGeom = Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0]);
    const flattenedPoints = isMultiGeom ? coordinates.flat() : coordinates;
    const hasVertices = (isPoly || isLine) && flattenedPoints.length > 0;
    const segments = hasVertices && !isMultiGeom ? panel.calculateFeatureSegments(coordinates, isPoly) : [];

    let areaM2 = 0;
    let lengthM = 0;
    if (isPoly && (coordinates.length >= 3 || (isMultiGeom && flattenedPoints.length >= 3))) {
      areaM2 = panel.calculatePolygonArea(coordinates);
    } else if (isCircle) {
      areaM2 = Math.PI * (feat.radius || 0) * (feat.radius || 0);
    } else if (isLine && (coordinates.length >= 2 || (isMultiGeom && flattenedPoints.length >= 2))) {
      lengthM = panel.calculatePolylineLength(coordinates);
    }

    const areaConversions = SpatialAlgorithms.convertArea(areaM2);
    const lengthConversions = SpatialAlgorithms.convertLength(lengthM);

    let refCoord = [0, 0];
    if (isPoint || isCircle) {
      refCoord = coordinates;
    } else if (flattenedPoints.length > 0) {
      refCoord = [
        flattenedPoints.reduce((acc, c) => acc + c[0], 0) / flattenedPoints.length,
        flattenedPoints.reduce((acc, c) => acc + c[1], 0) / flattenedPoints.length
      ];
    }
    const dmsLat = SpatialAlgorithms.ddToDms(refCoord[0], true);
    const dmsLng = SpatialAlgorithms.ddToDms(refCoord[1], false);

    const customAttrs = Array.isArray(feat.customAttributes) ? feat.customAttributes : [];
    const historyList = Array.isArray(feat.history) ? feat.history : [];
    const layerName = panel.layers.find(l => l.id === feat.layerId)?.name || 'Padrão';
    let dimSummary = 'Ponto';
    if (isPoly) {
      const ha = areaM2 / 10000;
      dimSummary = ha >= 1000 ? `${ha.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha` : `${ha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`;
    } else if (isLine) {
      const km = lengthM / 1000;
      dimSummary = km >= 1 ? `${km.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km` : `${lengthM.toFixed(1)} m`;
    } else if (isCircle) {
      dimSummary = `R: ${feat.radius || 50}m`;
    }

    return `
      <div class="cm-inspector-box">
        <!-- Topo da Feição: Header Card Visualmente Polido -->
        <div class="cm-inspector-header-card">
          <div class="cm-inspector-header-top">
            <div class="cm-header-badge-group">
              <ui-badge variante="primario">${safeCategory}</ui-badge>
              ${isLocked ? `<span class="cm-locked-badge">🔒 Bloqueado</span>` : `<span class="cm-summary-pill-main" title="${dimSummary}">${dimSummary}</span>`}
            </div>
            <div class="cm-inspector-quick-toolbar">
              <button id="btn-toggle-lock" class="cm-quick-tool-btn ${isLocked ? 'active-lock' : ''}" title="${isLocked ? 'Feição Bloqueada (Clique para Desbloquear)' : 'Feição Livre (Clique para Bloquear)'}">
                ${isLocked ? '🔒' : '🔓'}
              </button>
              <button id="btn-toggle-float" class="cm-quick-tool-btn" title="Destacar Inspetor em Janela Flutuante">🪟</button>
              <button id="btn-fit-feature" class="cm-quick-tool-btn" title="Enquadrar no Mapa">🎯</button>
              <button id="btn-delete-inspector" class="cm-quick-tool-btn btn-danger" title="Excluir Feição">🗑️</button>
            </div>
          </div>
          <div class="cm-inspector-meta-row">
            <div class="cm-meta-chip" title="ID: ${safeId}">
              <span class="cm-meta-label">ID</span>
              <span class="cm-meta-val">${safeId}</span>
            </div>
            <div class="cm-meta-chip" title="Camada: ${panel.escapeHtml(layerName)}">
              <span class="cm-meta-label">CAMADA</span>
              <span class="cm-meta-val">📁 ${panel.escapeHtml(layerName)}</span>
            </div>
          </div>
        </div>

        <!-- 1. IDENTIFICAÇÃO -->
        <details class="cm-inspector-accordion" open>
          ${panel.renderAccordionHeader('📌 Identificação & Camada')}
          <div class="cm-accordion-content">
            <ui-campo-texto id="inspector-feat-name" label="Nome do Elemento" value="${safeName}" ${isLocked ? 'desabilitado' : ''} obrigatorio></ui-campo-texto>
            <ui-campo-texto id="inspector-feat-desc" label="Descrição / Observações" value="${safeDesc}" ${isLocked ? 'desabilitado' : ''}></ui-campo-texto>
            <div class="cm-inspector-field-group">
              <label class="cm-field-label" for="inspector-feat-layer">Camada de Destino</label>
              <select class="cm-native-select cm-layer-select-full" id="inspector-feat-layer" ${isLocked ? 'disabled' : ''}>
                ${panel.layers.map(l => `<option value="${l.id}" ${feat.layerId === l.id ? 'selected' : ''}>📁 ${panel.escapeHtml(l.name)}</option>`).join('')}
              </select>
            </div>
          </div>
        </details>

        <!-- 2. APARÊNCIA & SIMBOLOGIA -->
        <details class="cm-inspector-accordion" open>
          ${panel.renderAccordionHeader('🎨 Aparência & Simbologia', isPoint ? `${style.markerIcon} • ${style.markerSize}px` : `<span style="background:${style.fillColor}; width:8px; height:8px; border-radius:2px; display:inline-block; vertical-align:middle; margin-right:3px;"></span>${Math.round(style.fillOpacity * 100)}% • ${style.strokeWidth}px`)}
          <div class="cm-accordion-content">
            ${(isPoly || isCircle) ? `
              <div class="cm-param-row">
                <span class="cm-param-label">Preenchimento:</span>
                <div class="cm-color-input-wrapper">
                  <input type="color" class="cm-color-picker" id="style-fill-color" value="${style.fillColor}" ${isLocked ? 'disabled' : ''} />
                  <span class="cm-param-badge" id="val-fill-color-hex">${style.fillColor}</span>
                </div>
              </div>
              <div class="cm-param-row">
                <span class="cm-param-label">Opacidade:</span>
                <input type="range" class="cm-param-slider" id="style-fill-opacity" min="0" max="1" step="0.05" value="${style.fillOpacity}" ${isLocked ? 'disabled' : ''} />
                <span class="cm-param-badge" id="val-fill-opacity">${Math.round(style.fillOpacity * 100)}%</span>
              </div>
            ` : ''}

            ${(isPoly || isCircle || isLine) ? `
              <div class="cm-param-row">
                <span class="cm-param-label">Contorno:</span>
                <div class="cm-color-input-wrapper">
                  <input type="color" class="cm-color-picker" id="style-stroke-color" value="${style.strokeColor}" ${isLocked ? 'disabled' : ''} />
                  <span class="cm-param-badge" id="val-stroke-color-hex">${style.strokeColor}</span>
                </div>
              </div>
              <div class="cm-param-row">
                <span class="cm-param-label">Espessura:</span>
                <input type="range" class="cm-param-slider" id="style-stroke-width" min="1" max="10" step="0.5" value="${style.strokeWidth}" ${isLocked ? 'disabled' : ''} />
                <span class="cm-param-badge" id="val-stroke-width">${style.strokeWidth}px</span>
              </div>
              <div class="cm-param-row">
                <span class="cm-param-label">Padrão:</span>
                <select class="cm-native-select" id="style-stroke-dash" style="width: 140px;" ${isLocked ? 'disabled' : ''}>
                  <option value="" ${style.strokeDashArray === '' ? 'selected' : ''}>Sólida (Contínua)</option>
                  <option value="6, 6" ${style.strokeDashArray === '6, 6' ? 'selected' : ''}>Tracejada (---)</option>
                  <option value="2, 4" ${style.strokeDashArray === '2, 4' ? 'selected' : ''}>Pontilhada (···)</option>
                </select>
              </div>
            ` : ''}

            ${isPoint ? `
              <div class="cm-param-row">
                <span class="cm-param-label">Cor Marcador:</span>
                <div class="cm-color-input-wrapper">
                  <input type="color" class="cm-color-picker" id="style-point-color" value="${style.fillColor}" ${isLocked ? 'disabled' : ''} />
                  <span class="cm-param-badge" id="val-point-color-hex">${style.fillColor}</span>
                </div>
              </div>
              <div class="cm-param-row">
                <span class="cm-param-label">Ícone Vetorial:</span>
                <select class="cm-native-select" id="style-marker-icon" style="width: 140px;" ${isLocked ? 'disabled' : ''}>
                  <option value="pin" ${style.markerIcon === 'pin' ? 'selected' : ''}>📌 Pino Padrão</option>
                  <option value="tower" ${style.markerIcon === 'tower' ? 'selected' : ''}>🗼 Base RTK / Torre</option>
                  <option value="tree" ${style.markerIcon === 'tree' ? 'selected' : ''}>🌲 Reserva / APP</option>
                  <option value="warning" ${style.markerIcon === 'warning' ? 'selected' : ''}>⚠️ Alerta / Inspeção</option>
                  <option value="water" ${style.markerIcon === 'water' ? 'selected' : ''}>💧 Hidrografia / Nascente</option>
                  <option value="boundary" ${style.markerIcon === 'boundary' ? 'selected' : ''}>🏛️ Marco Topográfico</option>
                </select>
              </div>
              <div class="cm-param-row">
                <span class="cm-param-label">Tamanho:</span>
                <input type="range" class="cm-param-slider" id="style-marker-size" min="16" max="48" step="2" value="${style.markerSize}" ${isLocked ? 'disabled' : ''} />
                <span class="cm-param-badge" id="val-marker-size">${style.markerSize}px</span>
              </div>
              <div class="cm-param-row">
                <span class="cm-param-label">Rotação:</span>
                <input type="range" class="cm-param-slider" id="style-marker-rot" min="0" max="360" step="5" value="${style.markerRotation}" ${isLocked ? 'disabled' : ''} />
                <span class="cm-param-badge" id="val-marker-rot">${style.markerRotation}°</span>
              </div>
            ` : ''}

            <div class="cm-param-row" style="border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 6px;">
              <span class="cm-param-label">Rótulo no Mapa:</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <select class="cm-native-select" id="style-label-field" style="width: 110px;" ${isLocked ? 'disabled' : ''}>
                  <option value="name" ${style.labelField === 'name' ? 'selected' : ''}>Nome</option>
                  <option value="category" ${style.labelField === 'category' ? 'selected' : ''}>Categoria</option>
                  ${isPoly ? `<option value="area" ${style.labelField === 'area' ? 'selected' : ''}>Área (ha)</option>` : ''}
                  ${isLine ? `<option value="extensao" ${style.labelField === 'extensao' ? 'selected' : ''}>Extensão</option>` : ''}
                </select>
                <ui-switch ${style.showLabel ? 'checked' : ''} id="style-show-label" ${isLocked ? 'desabilitado' : ''}></ui-switch>
              </div>
            </div>
          </div>
        </details>

        <!-- 3. GEOMETRIA & VÉRTICES -->
        <details class="cm-inspector-accordion">
          ${panel.renderAccordionHeader('📐 Geometria & Vértices', `${hasVertices ? coordinates.length : 1} nós`)}
          <div class="cm-accordion-content">
            <div style="display: flex; justify-content: flex-end;">
              <ui-botao-primario inline id="btn-toggle-vertex-edit" variante="${panel.isVertexEditing ? 'primary' : 'secundario'}" style="height: 24px; font-size: 10.5px; padding: 0 8px;" ${isLocked ? 'desabilitado' : ''}>
                ${panel.isVertexEditing ? '✔ Concluir Edição' : '✏️ Editar Vértices no Mapa'}
              </ui-botao-primario>
            </div>
            ${hasVertices ? `
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

              <details class="cm-vertex-details">
                <summary class="cm-vertex-summary">🧭 Azimutes & Distâncias das Arestas</summary>
                <div class="cm-vertex-list-scroll" style="max-height: 110px;">
                  ${segments.map(seg => `
                    <div class="cm-segment-row">
                      <span style="color: var(--cm-primary); font-weight: 600;">V${seg.from} ➔ V${seg.to}</span>
                      <span>Az: <strong>${seg.azimuth.toFixed(1)}°</strong></span>
                      <span style="color: var(--cm-text-muted);">${seg.distance > 1000 ? (seg.distance/1000).toFixed(2) + ' km' : seg.distance.toFixed(1) + ' m'}</span>
                    </div>
                  `).join('')}
                </div>
              </details>
            ` : ''}

            <div style="display: flex; gap: 4px; border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 6px;">
              <ui-botao-primario inline id="btn-copy-wkt" variante="secundario" style="flex: 1; height: 24px; font-size: 10px;">📋 WKT</ui-botao-primario>
              <ui-botao-primario inline id="btn-copy-geojson" variante="secundario" style="flex: 1; height: 24px; font-size: 10px;">📋 GeoJSON</ui-botao-primario>
              <ui-botao-primario inline id="btn-copy-coord-csv" variante="secundario" style="flex: 1; height: 24px; font-size: 10px;">📋 CSV</ui-botao-primario>
            </div>
          </div>
        </details>

        <!-- 4. MICRO-FERRAMENTAS ESPACIAIS -->
        <details class="cm-inspector-accordion">
          ${panel.renderAccordionHeader('🛠️ Micro-ferramentas Espaciais', 'Buffer • DP • Clone')}
          <div class="cm-accordion-content">
            <div class="cm-spatial-tool-card">
              <div class="cm-spatial-tool-header"><span>🔄 Zona de Amortecimento (Buffer)</span></div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <input type="number" id="buffer-radius-input" class="cm-native-select" style="width: 80px; height: 26px; padding: 0 6px;" value="50" min="1" max="10000" step="5" />
                <span style="font-size: 10.5px; color: var(--cm-text-muted);">metros</span>
                <ui-botao-primario inline id="btn-generate-buffer" variante="secundario" style="flex: 1; height: 26px; font-size: 10.5px;">Criar Buffer</ui-botao-primario>
              </div>
            </div>

            ${(isPoly || isLine) ? `
              <div class="cm-spatial-tool-card">
                <div class="cm-spatial-tool-header">
                  <span>📉 Simplificar Nós (Douglas-Peucker)</span>
                  <span id="dp-tolerance-val" style="color: var(--cm-primary); font-family: var(--cm-fonte-mono);">5m</span>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <input type="range" id="dp-tolerance-slider" class="cm-param-slider" min="1" max="50" step="1" value="5" />
                  <ui-botao-primario inline id="btn-simplify-dp" variante="secundario" style="height: 26px; font-size: 10.5px; padding: 0 8px;" ${isLocked ? 'desabilitado' : ''}>Simplificar</ui-botao-primario>
                </div>
              </div>
            ` : ''}

            <div style="display: flex; justify-content: flex-end;">
              <ui-botao-primario inline id="btn-duplicate-feat" variante="secundario" style="height: 24px; font-size: 10.5px; width: 100%;">📑 Duplicar Feição (+30m offset)</ui-botao-primario>
            </div>
          </div>
        </details>

        <!-- 5. ATRIBUTOS PERSONALIZADOS -->
        <details class="cm-inspector-accordion">
          ${panel.renderAccordionHeader('📋 Atributos Personalizados', `${customAttrs.length} campos`)}
          <div class="cm-accordion-content">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 10px; color: var(--cm-text-muted);">Pares Chave / Valor</span>
              <button id="btn-add-custom-attr" class="cm-native-select" style="padding: 1px 6px; font-size: 10px;" ${isLocked ? 'disabled' : ''}>+ Adicionar</button>
            </div>
            <div id="cm-custom-attr-list" style="display: flex; flex-direction: column; gap: 4px;">
              ${customAttrs.map((attr, idx) => `
                <div class="cm-custom-attr-row" data-attr-idx="${idx}">
                  <input type="text" class="cm-custom-attr-input attr-key" placeholder="Campo" value="${panel.escapeHtml(attr.key)}" ${isLocked ? 'disabled' : ''} />
                  <input type="text" class="cm-custom-attr-input attr-val" placeholder="Valor" value="${panel.escapeHtml(attr.value)}" ${isLocked ? 'disabled' : ''} />
                  ${!isLocked ? `<button class="cm-vertex-del-btn btn-del-attr" data-attr-del="${idx}">×</button>` : ''}
                </div>
              `).join('')}
              ${customAttrs.length === 0 ? `<div style="font-size: 10px; color: var(--cm-text-muted); font-style: italic;">Nenhum atributo adicional cadastrado.</div>` : ''}
            </div>
          </div>
        </details>

        <!-- 6. CONVERSOR DE UNIDADES -->
        <details class="cm-inspector-accordion">
          ${panel.renderAccordionHeader('🔄 Conversor de Unidades', isPoly ? `${areaConversions.ha} ha` : (isLine ? `${lengthConversions.km} km` : 'DMS'))}
          <div class="cm-accordion-content">
            ${(isPoly || isCircle) ? `
              <div style="font-size: 10px; font-weight: 600; color: var(--cm-text);">Área Equivalente:</div>
              <div class="cm-converter-grid">
                <div class="cm-converter-item"><span class="cm-converter-label">Hectares</span><span class="cm-converter-val">${areaConversions.ha}</span></div>
                <div class="cm-converter-item"><span class="cm-converter-label">Metros Quadrados</span><span class="cm-converter-val">${areaConversions.m2}</span></div>
                <div class="cm-converter-item"><span class="cm-converter-label">Alqueire Paulista</span><span class="cm-converter-val">${areaConversions.alqueirePaulista}</span></div>
                <div class="cm-converter-item"><span class="cm-converter-label">Alqueire Mineiro</span><span class="cm-converter-val">${areaConversions.alqueireMineiro}</span></div>
              </div>
            ` : ''}
            ${isLine ? `
              <div style="font-size: 10px; font-weight: 600; color: var(--cm-text);">Extensão Linear:</div>
              <div class="cm-converter-grid">
                <div class="cm-converter-item"><span class="cm-converter-label">Metros</span><span class="cm-converter-val">${lengthConversions.meters}</span></div>
                <div class="cm-converter-item"><span class="cm-converter-label">Quilômetros</span><span class="cm-converter-val">${lengthConversions.km}</span></div>
                <div class="cm-converter-item"><span class="cm-converter-label">Milhas</span><span class="cm-converter-val">${lengthConversions.miles}</span></div>
                <div class="cm-converter-item"><span class="cm-converter-label">Pés</span><span class="cm-converter-val">${lengthConversions.feet}</span></div>
              </div>
            ` : ''}
            <div style="font-size: 10px; font-weight: 600; color: var(--cm-text); margin-top: 4px;">Centroide / Coordenadas:</div>
            <div class="cm-converter-grid">
              <div class="cm-converter-item"><span class="cm-converter-label">Graus Decimais (DD)</span><span class="cm-converter-val">${refCoord[0].toFixed(5)}, ${refCoord[1].toFixed(5)}</span></div>
              <div class="cm-converter-item"><span class="cm-converter-label">DMS (GMS)</span><span class="cm-converter-val" style="font-size: 9.5px;">${dmsLat}<br>${dmsLng}</span></div>
            </div>
          </div>
        </details>

        <!-- 7. HISTÓRICO LOCAL -->
        <details class="cm-inspector-accordion">
          ${panel.renderAccordionHeader('🕒 Histórico de Modificações', `${historyList.length} eventos`)}
          <div class="cm-accordion-content">
            <div class="cm-audit-log-list" style="max-height: 100px;">
              ${historyList.length > 0 ? historyList.map(h => `
                <div class="cm-audit-item">
                  <span style="color: var(--cm-primary);">${panel.escapeHtml(h.time || '')}:</span>
                  <span style="color: var(--cm-text);">${panel.escapeHtml(h.action || '')}</span>
                </div>
              `).join('') : `
                <div class="cm-audit-item"><span style="color: var(--cm-text-muted);">Criado em ${new Date(feat.createdAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div>
              `}
            </div>
          </div>
        </details>

        <!-- Sticky Action Footer -->
        <div class="cm-inspector-sticky-footer">
          <ui-botao-primario inline id="btn-save-inspector" variante="primary" style="height: 30px; flex: 1;" ${isLocked ? 'desabilitado' : ''}>
            Salvar Alterações <kbd class="cm-save-shortcut-kbd">Ctrl+S</kbd>
          </ui-botao-primario>
        </div>
      </div>
    `;
  }
}
