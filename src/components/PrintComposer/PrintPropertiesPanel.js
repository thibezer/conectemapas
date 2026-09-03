import { PrintItemsManager } from './PrintItemsManager.js';

export class PrintPropertiesPanel {
  static render(composer) {
    const selectedItem = composer.items.find(it => it.id === composer.selectedItemId);
    const esc = PrintItemsManager.escapeHtml;

    // Filtra feições poligonais ou de linha para a tabela de vértices
    const polygonFeatures = composer.features.filter(f => {
      const t = (f.type || '').toLowerCase();
      return (t === 'polygon' || t === 'multipolygon' || t === 'linestring' || t === 'line');
    });

    return `
      <div style="width: 300px; background: #18181c; border-left: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; height: 100%;">
        <div style="height: 40px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; padding: 0 12px; font-weight: 700; font-size: 11.5px; color: #fff; justify-content: space-between;">
          <span>⚙️ PROPRIEDADES DO ITEM</span>
          <span style="font-size: 10px; color: var(--cm-primary); font-family: monospace;">${composer.paperSize.name}</span>
        </div>

        <div style="flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px;">
          <!-- 1. Configurações da Folha de Papel -->
          <details class="cm-inspector-accordion" open>
            <summary style="font-size: 11px; font-weight: 600; padding: 6px 8px; cursor: pointer; color: #fff; background: rgba(255,255,255,0.02);">
              📄 Folha de Impressão (${composer.paperSize.name})
            </summary>
            <div style="padding: 8px; display: flex; flex-direction: column; gap: 8px;">
              <div class="cm-param-row">
                <span class="cm-param-label">Tamanho do Papel:</span>
                <select id="print-paper-size-select" class="cm-native-select" style="width: 145px;">
                  <option value="A4_L" ${composer.paperSize.id === 'A4_L' ? 'selected' : ''}>A4 Paisagem (297x210 mm)</option>
                  <option value="A4_P" ${composer.paperSize.id === 'A4_P' ? 'selected' : ''}>A4 Retrato (210x297 mm)</option>
                  <option value="A3_L" ${composer.paperSize.id === 'A3_L' ? 'selected' : ''}>A3 Paisagem (420x297 mm)</option>
                  <option value="A3_P" ${composer.paperSize.id === 'A3_P' ? 'selected' : ''}>A3 Retrato (297x420 mm)</option>
                  <option value="A2_L" ${composer.paperSize.id === 'A2_L' ? 'selected' : ''}>A2 Paisagem (594x420 mm)</option>
                  <option value="A1_L" ${composer.paperSize.id === 'A1_L' ? 'selected' : ''}>A1 Paisagem (841x594 mm)</option>
                </select>
              </div>
              <div class="cm-param-row">
                <span class="cm-param-label">Margens Normatizadas ABNT:</span>
                <input type="checkbox" id="print-abnt-margins-check" ${composer.showAbntMargins ? 'checked' : ''} />
              </div>
              <div style="font-size: 9.5px; color: #888899; line-height: 1.3;">
                Margem esquerda de 25 mm para encadernação e borda interna ABNT.
              </div>
            </div>
          </details>

          <!-- 2. Árvore de Elementos da Composição -->
          <details class="cm-inspector-accordion" open>
            <summary style="font-size: 11px; font-weight: 600; padding: 6px 8px; cursor: pointer; color: #fff; background: rgba(255,255,255,0.02);">
              📑 Elementos da Prancha (${composer.items.length})
            </summary>
            <div style="padding: 6px; display: flex; flex-direction: column; gap: 3px;">
              ${composer.items.map((it) => `
                <div class="cm-ai-row ${it.id === composer.selectedItemId ? 'ai-selected' : ''}" data-composer-item-id="${it.id}" style="height: 26px; padding: 0 6px; display: flex; align-items: center; justify-content: space-between; border-radius: 4px; cursor: pointer;">
                  <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
                    <span style="font-size: 12px;">${this.getItemIcon(it.type)}</span>
                    <span style="font-size: 10.5px; color: #e1e1e6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 135px;">${esc(it.name)}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 2px;">
                    <button class="cm-ai-micro-btn" data-composer-lock="${it.id}" title="${it.locked ? 'Desbloquear' : 'Bloquear'}">${it.locked ? '🔒' : '🔓'}</button>
                    <button class="cm-ai-micro-btn" data-composer-vis="${it.id}" title="${it.visible ? 'Ocultar' : 'Exibir'}">${it.visible ? '👁️' : '✕'}</button>
                    <button class="cm-ai-micro-btn" data-composer-del="${it.id}" title="Excluir">🗑️</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </details>

          <!-- 3. Propriedades do Elemento Selecionado -->
          ${selectedItem ? `
            <details class="cm-inspector-accordion" open>
              <summary style="font-size: 11px; font-weight: 600; padding: 6px 8px; cursor: pointer; color: var(--cm-primary); background: rgba(0,224,138,0.05);">
                🎯 ${esc(selectedItem.name)}
              </summary>
              <div style="padding: 8px; display: flex; flex-direction: column; gap: 6px;">
                <!-- Posição e Dimensão em mm -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                  <div>
                    <span class="cm-param-label">Posição X (mm):</span>
                    <input type="number" id="prop-item-x" class="cm-vertex-input" style="width: 100%;" value="${Math.round(selectedItem.x)}" />
                  </div>
                  <div>
                    <span class="cm-param-label">Posição Y (mm):</span>
                    <input type="number" id="prop-item-y" class="cm-vertex-input" style="width: 100%;" value="${Math.round(selectedItem.y)}" />
                  </div>
                  <div>
                    <span class="cm-param-label">Largura (mm):</span>
                    <input type="number" id="prop-item-w" class="cm-vertex-input" style="width: 100%;" value="${Math.round(selectedItem.width)}" />
                  </div>
                  <div>
                    <span class="cm-param-label">Altura (mm):</span>
                    <input type="number" id="prop-item-h" class="cm-vertex-input" style="width: 100%;" value="${Math.round(selectedItem.height)}" />
                  </div>
                </div>

                <!-- Propriedades do Mapa -->
                ${(selectedItem.type === 'map' || selectedItem.type === 'inset_map') ? `
                  <div style="border-top: 1px solid rgba(255,255,255,0.06); margin-top: 4px; padding-top: 6px; display: flex; flex-direction: column; gap: 6px;">
                    <div class="cm-param-row">
                      <span class="cm-param-label">Camada Base:</span>
                      <select id="prop-map-basemap" class="cm-native-select" style="width: 140px;">
                        <option value="satelite" ${selectedItem.basemap === 'satelite' ? 'selected' : ''}>🛰️ Esri Satélite</option>
                        <option value="osm" ${selectedItem.basemap === 'osm' ? 'selected' : ''}>🗺️ OpenStreetMap</option>
                        <option value="cartodb_positron" ${selectedItem.basemap === 'cartodb_positron' ? 'selected' : ''}>☀️ CartoDB Claro</option>
                        <option value="cartodb_dark" ${selectedItem.basemap === 'cartodb_dark' ? 'selected' : ''}>🌙 CartoDB Escuro</option>
                        <option value="relevo" ${selectedItem.basemap === 'relevo' ? 'selected' : ''}>⛰️ Relevo Topo</option>
                        <option value="branco" ${selectedItem.basemap === 'branco' ? 'selected' : ''}>⚪ Fundo Branco CAD</option>
                      </select>
                    </div>

                    <div class="cm-param-row">
                      <span class="cm-param-label">Escala Numérica (1:):</span>
                      <input type="number" id="prop-map-scale" class="cm-vertex-input" style="width: 100px;" step="500" value="${selectedItem.scale || 10000}" />
                    </div>

                    <div class="cm-param-row">
                      <span class="cm-param-label">Rotação do Mapa:</span>
                      <input type="number" id="prop-map-rot" class="cm-vertex-input" style="width: 60px;" min="0" max="360" value="${selectedItem.rotation || 0}" />
                    </div>

                    <div class="cm-param-row">
                      <span class="cm-param-label">Grade de Coordenadas:</span>
                      <input type="checkbox" id="prop-map-grid" ${selectedItem.showGrid ? 'checked' : ''} />
                    </div>

                    ${selectedItem.showGrid ? `
                      <div class="cm-param-row">
                        <span class="cm-param-label">Tipo de Grade:</span>
                        <select id="prop-map-grid-type" class="cm-native-select" style="width: 130px;">
                          <option value="dms" ${selectedItem.gridType === 'dms' ? 'selected' : ''}>Geográfica (DMS)</option>
                          <option value="utm" ${selectedItem.gridType === 'utm' ? 'selected' : ''}>Métrica UTM (Metros)</option>
                        </select>
                      </div>
                    ` : ''}

                    <div style="margin-top: 6px;">
                      <ui-botao-primario inline id="btn-prop-pan-map" variante="secundario" style="width: 100%; height: 26px; font-size: 11px;">
                        🖐️ Enquadrar Terreno neste Mapa
                      </ui-botao-primario>
                    </div>
                  </div>
                ` : ''}

                <!-- Propriedades da Rosa dos Ventos -->
                ${selectedItem.type === 'north_arrow' ? `
                  <div class="cm-param-row">
                    <span class="cm-param-label">Estilo da Seta:</span>
                    <select id="prop-arrow-style" class="cm-native-select" style="width: 120px;">
                      <option value="classic" ${selectedItem.arrowStyle === 'classic' ? 'selected' : ''}>Cartográfica Clássica</option>
                      <option value="compass" ${selectedItem.arrowStyle === 'compass' ? 'selected' : ''}>Bússola / Rosa</option>
                      <option value="modern" ${selectedItem.arrowStyle === 'modern' ? 'selected' : ''}>Moderna Técnica</option>
                    </select>
                  </div>
                  <div class="cm-param-row">
                    <span class="cm-param-label">Rotação (Norte):</span>
                    <div style="display: flex; align-items: center; gap: 4px;">
                      <input type="range" id="prop-arrow-rot-range" min="0" max="360" value="${selectedItem.rotation || 0}" style="width: 80px;" />
                      <input type="number" id="prop-arrow-rot" class="cm-vertex-input" style="width: 50px;" min="0" max="360" value="${selectedItem.rotation || 0}" />
                    </div>
                  </div>
                ` : ''}

                <!-- Propriedades da Tabela de Vértices -->
                ${selectedItem.type === 'table_vertices' ? `
                  <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
                    <div class="cm-param-row">
                      <span class="cm-param-label">Feição Referência:</span>
                      <select id="prop-vert-feature" class="cm-native-select" style="width: 140px;">
                        <option value="">-- Automático (1º Polígono) --</option>
                        ${polygonFeatures.map(f => `
                          <option value="${f.id}" ${selectedItem.targetFeatureId === f.id ? 'selected' : ''}>${esc(f.name || f.id)}</option>
                        `).join('')}
                      </select>
                    </div>
                    <div style="font-size: 9.5px; color: #888899; line-height: 1.3;">
                      Gera automaticamente vértices numerados (V01, V02...), coordenadas N/E em SIRGAS 2000 UTM, azimutes e distâncias perimétricas.
                    </div>
                  </div>
                ` : ''}

                <!-- Propriedades do Bloco de Notas Técnicas -->
                ${selectedItem.type === 'text_block' ? `
                  <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
                    <span class="cm-param-label">Título do Bloco:</span>
                    <input type="text" id="prop-text-title" class="cm-vertex-input" value="${esc(selectedItem.title || '')}" />
                    <span class="cm-param-label">Texto das Notas:</span>
                    <textarea id="prop-text-body" class="cm-vertex-input" rows="5" style="width: 100%; height: 75px; resize: vertical; font-size: 10px;">${esc(selectedItem.text || '')}</textarea>
                    <div class="cm-param-row">
                      <span class="cm-param-label">Tamanho da Fonte (pt):</span>
                      <input type="number" id="prop-text-size" class="cm-vertex-input" style="width: 60px;" min="5" max="18" step="0.5" value="${selectedItem.fontSize || 7.5}" />
                    </div>
                  </div>
                ` : ''}

                <!-- Propriedades do Carimbo Técnico ABNT -->
                ${selectedItem.type === 'title_block' ? `
                  <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                    <span class="cm-param-label">Título da Prancha:</span>
                    <input type="text" id="prop-tb-header" class="cm-vertex-input" value="${esc(selectedItem.properties?.headerTitle || '')}" />
                    <span class="cm-param-label">Projeto / Obra:</span>
                    <input type="text" id="prop-tb-proj" class="cm-vertex-input" value="${esc(selectedItem.properties?.projectName || '')}" />
                    <span class="cm-param-label">Proprietário / Cliente:</span>
                    <input type="text" id="prop-tb-client" class="cm-vertex-input" value="${esc(selectedItem.properties?.client || '')}" />
                    <span class="cm-param-label">Responsável Técnico:</span>
                    <input type="text" id="prop-tb-author" class="cm-vertex-input" value="${esc(selectedItem.properties?.author || '')}" />
                    <span class="cm-param-label">ART / Registro:</span>
                    <input type="text" id="prop-tb-art" class="cm-vertex-input" value="${esc(selectedItem.properties?.art || '')}" />
                    <span class="cm-param-label">Sistema Geodésico / Projeção:</span>
                    <input type="text" id="prop-tb-datum" class="cm-vertex-input" value="${esc(selectedItem.properties?.datum || '')}" />
                    <span class="cm-param-label">Texto de Escala:</span>
                    <input type="text" id="prop-tb-scale" class="cm-vertex-input" value="${esc(selectedItem.properties?.scaleText || '')}" />
                    <span class="cm-param-label">Área e Perímetro:</span>
                    <div style="display: flex; gap: 4px;">
                      <input type="text" id="prop-tb-area" class="cm-vertex-input" style="flex: 1;" value="${esc(selectedItem.properties?.areaPerimeter || '')}" />
                      <button id="btn-calc-area-carimbo" class="cm-ai-micro-btn" style="padding: 0 6px;" title="Calcular das Feições">⚡</button>
                    </div>
                    <span class="cm-param-label">Localização / Imóvel:</span>
                    <input type="text" id="prop-tb-loc" class="cm-vertex-input" value="${esc(selectedItem.properties?.location || '')}" />
                    <span class="cm-param-label">Data da Planta:</span>
                    <input type="text" id="prop-tb-date" class="cm-vertex-input" value="${esc(selectedItem.properties?.date || '')}" />
                  </div>
                ` : ''}
              </div>
            </details>
          ` : '<div style="font-size: 10.5px; color: var(--cm-text-muted); text-align: center; padding: 25px 0;">Clique em um elemento da prancha para editar suas propriedades.</div>'}
        </div>
      </div>
    `;
  }

  static getItemIcon(type) {
    if (type === 'map') return '🗺️';
    if (type === 'inset_map') return '🌎';
    if (type === 'north_arrow') return '🧭';
    if (type === 'scale_bar') return '📏';
    if (type === 'legend') return '📋';
    if (type === 'title_block') return '🏛️';
    if (type === 'table_vertices') return '📊';
    if (type === 'text_block') return '📝';
    return '📦';
  }

  static bindEvents(composer) {
    const paperSelect = document.getElementById('print-paper-size-select');
    if (paperSelect) {
      paperSelect.addEventListener('change', (e) => composer.setPaperSize(e.target.value));
    }

    const abntMarginsCheck = document.getElementById('print-abnt-margins-check');
    if (abntMarginsCheck) {
      abntMarginsCheck.addEventListener('change', (e) => composer.setAbntMargins(e.target.checked));
    }

    document.querySelectorAll('[data-composer-item-id]').forEach(el => {
      el.addEventListener('click', () => composer.selectItem(el.getAttribute('data-composer-item-id')));
    });

    document.querySelectorAll('[data-composer-lock]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        composer.toggleItemLock(btn.getAttribute('data-composer-lock'));
      });
    });

    document.querySelectorAll('[data-composer-vis]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        composer.toggleItemVisibility(btn.getAttribute('data-composer-vis'));
      });
    });

    document.querySelectorAll('[data-composer-del]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        composer.deleteItem(btn.getAttribute('data-composer-del'));
      });
    });

    const updateCurrent = (mutator, shouldUpdateMap = false, isPositionOrSizeChange = false) => {
      const it = composer.items.find(i => i.id === composer.selectedItemId);
      if (it) {
        mutator(it);
        if (isPositionOrSizeChange) {
          composer.updateItemPositionDOM(it);
          if (it.type === 'map' || it.type === 'inset_map') {
            composer.applyMapScaleAndRotation(it);
          }
        } else if (shouldUpdateMap && (it.type === 'map' || it.type === 'inset_map')) {
          composer.applyMapScaleAndRotation(it);
        } else if (it.type === 'title_block') {
          const container = document.querySelector(`[data-item-id="${it.id}"]`);
          if (container) {
            const tbEl = container.querySelector('.cm-item-title-block');
            if (tbEl) tbEl.outerHTML = PrintItemsManager.renderTitleBlock(it, composer.projectName);
          }
        } else if (it.type === 'table_vertices') {
          const container = document.querySelector(`[data-item-id="${it.id}"]`);
          if (container) {
            const tvEl = container.querySelector('.cm-item-vertices-table');
            if (tvEl) tvEl.outerHTML = PrintItemsManager.renderVerticesTable(it, composer.features);
          }
        } else if (it.type === 'text_block') {
          const container = document.querySelector(`[data-item-id="${it.id}"]`);
          if (container) {
            const txtEl = container.querySelector('.cm-item-text-block');
            if (txtEl) txtEl.outerHTML = PrintItemsManager.renderTextBlock(it);
          }
        } else if (it.type === 'scale_bar') {
          const container = document.querySelector(`[data-item-id="${it.id}"]`);
          if (container) {
            const sbEl = container.querySelector('.cm-item-scale-bar');
            if (sbEl) sbEl.outerHTML = PrintItemsManager.renderScaleBar(it, it.scale || 10000);
          }
        } else if (it.type === 'north_arrow') {
          const container = document.querySelector(`[data-item-id="${it.id}"]`);
          if (container) {
            const naEl = container.querySelector('svg');
            if (naEl) naEl.outerHTML = PrintItemsManager.getNorthArrowSVG(it.arrowStyle, it.rotation);
          }
        } else {
          composer.renderAllItems();
        }
      }
    };

    // Campos de posição e dimensões
    const propX = document.getElementById('prop-item-x');
    const propY = document.getElementById('prop-item-y');
    const propW = document.getElementById('prop-item-w');
    const propH = document.getElementById('prop-item-h');

    if (propX) propX.addEventListener('change', (e) => updateCurrent(it => it.x = parseFloat(e.target.value) || 0, false, true));
    if (propY) propY.addEventListener('change', (e) => updateCurrent(it => it.y = parseFloat(e.target.value) || 0, false, true));
    if (propW) propW.addEventListener('change', (e) => updateCurrent(it => it.width = Math.max(10, parseFloat(e.target.value) || 10), false, true));
    if (propH) propH.addEventListener('change', (e) => updateCurrent(it => it.height = Math.max(10, parseFloat(e.target.value) || 10), false, true));

    // Propriedades do Mapa
    const propMapBasemap = document.getElementById('prop-map-basemap');
    if (propMapBasemap) {
      propMapBasemap.addEventListener('change', (e) => {
        const val = e.target.value;
        updateCurrent(it => {
          it.basemap = val;
          const map = composer.leafletMaps.get(it.id);
          if (map) composer.applyBasemapToMap(map, val);
        });
      });
    }

    const propScale = document.getElementById('prop-map-scale');
    const propMapRot = document.getElementById('prop-map-rot');
    const propGrid = document.getElementById('prop-map-grid');
    const propGridType = document.getElementById('prop-map-grid-type');
    const btnPanMap = document.getElementById('btn-prop-pan-map');

    if (propScale) propScale.addEventListener('change', (e) => updateCurrent(it => it.scale = Math.max(100, parseFloat(e.target.value) || 10000), true));
    if (propMapRot) propMapRot.addEventListener('change', (e) => updateCurrent(it => it.rotation = parseFloat(e.target.value) || 0, true));
    if (propGrid) {
      propGrid.addEventListener('change', (e) => {
        updateCurrent(it => it.showGrid = e.target.checked);
        composer.updatePropertiesPanel();
      });
    }
    if (propGridType) {
      propGridType.addEventListener('change', (e) => {
        updateCurrent(it => it.gridType = e.target.value);
        composer.renderAllItems();
      });
    }
    if (btnPanMap) {
      btnPanMap.addEventListener('click', () => composer.setInteractionMode('content_pan'));
    }

    // Rosa dos ventos
    const propArrow = document.getElementById('prop-arrow-style');
    const propArrowRot = document.getElementById('prop-arrow-rot');
    const propArrowRotRange = document.getElementById('prop-arrow-rot-range');

    if (propArrow) propArrow.addEventListener('change', (e) => updateCurrent(it => it.arrowStyle = e.target.value));

    const syncArrowRot = (val) => {
      const rot = parseFloat(val) || 0;
      if (propArrowRot) propArrowRot.value = rot;
      if (propArrowRotRange) propArrowRotRange.value = rot;
      updateCurrent(it => it.rotation = rot);
    };

    if (propArrowRot) propArrowRot.addEventListener('input', (e) => syncArrowRot(e.target.value));
    if (propArrowRotRange) propArrowRotRange.addEventListener('input', (e) => syncArrowRot(e.target.value));

    // Tabela de vértices
    const propVertFeature = document.getElementById('prop-vert-feature');
    if (propVertFeature) {
      propVertFeature.addEventListener('change', (e) => {
        updateCurrent(it => it.targetFeatureId = e.target.value || null);
      });
    }

    // Bloco de Notas Técnicas
    const propTextTitle = document.getElementById('prop-text-title');
    const propTextBody = document.getElementById('prop-text-body');
    const propTextSize = document.getElementById('prop-text-size');

    if (propTextTitle) propTextTitle.addEventListener('input', (e) => updateCurrent(it => it.title = e.target.value));
    if (propTextBody) propTextBody.addEventListener('input', (e) => updateCurrent(it => it.text = e.target.value));
    if (propTextSize) propTextSize.addEventListener('change', (e) => updateCurrent(it => it.fontSize = parseFloat(e.target.value) || 7.5));

    // Carimbo Técnico ABNT
    const updateTbProp = (key, val) => updateCurrent(it => { it.properties = it.properties || {}; it.properties[key] = val; });
    const propTbHeader = document.getElementById('prop-tb-header');
    const propTbProj = document.getElementById('prop-tb-proj');
    const propTbClient = document.getElementById('prop-tb-client');
    const propTbAuthor = document.getElementById('prop-tb-author');
    const propTbArt = document.getElementById('prop-tb-art');
    const propTbDatum = document.getElementById('prop-tb-datum');
    const propTbScale = document.getElementById('prop-tb-scale');
    const propTbArea = document.getElementById('prop-tb-area');
    const propTbLoc = document.getElementById('prop-tb-loc');
    const propTbDate = document.getElementById('prop-tb-date');
    const btnCalcArea = document.getElementById('btn-calc-area-carimbo');

    if (propTbHeader) propTbHeader.addEventListener('input', (e) => updateTbProp('headerTitle', e.target.value));
    if (propTbProj) propTbProj.addEventListener('input', (e) => updateTbProp('projectName', e.target.value));
    if (propTbClient) propTbClient.addEventListener('input', (e) => updateTbProp('client', e.target.value));
    if (propTbAuthor) propTbAuthor.addEventListener('input', (e) => updateTbProp('author', e.target.value));
    if (propTbArt) propTbArt.addEventListener('input', (e) => updateTbProp('art', e.target.value));
    if (propTbDatum) propTbDatum.addEventListener('input', (e) => updateTbProp('datum', e.target.value));
    if (propTbScale) propTbScale.addEventListener('input', (e) => updateTbProp('scaleText', e.target.value));
    if (propTbArea) propTbArea.addEventListener('input', (e) => updateTbProp('areaPerimeter', e.target.value));
    if (propTbLoc) propTbLoc.addEventListener('input', (e) => updateTbProp('location', e.target.value));
    if (propTbDate) propTbDate.addEventListener('input', (e) => updateTbProp('date', e.target.value));

    if (btnCalcArea) {
      btnCalcArea.addEventListener('click', () => {
        const data = PrintItemsManager.extractVerticesData(composer.features);
        if (data.totalAreaM2 > 0) {
          const txt = `${data.totalAreaM2.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m² (${data.totalAreaHa.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ha) | P: ${data.totalPerimeter.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m`;
          if (propTbArea) propTbArea.value = txt;
          updateTbProp('areaPerimeter', txt);
        }
      });
    }
  }
}

