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
      <div class="cm-print-props-panel" style="background: #18181c; border-left: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; box-sizing: border-box;">
        <div style="height: 40px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; padding: 0 12px; font-weight: 700; font-size: 11.5px; color: #fff; justify-content: space-between;">
          <span>⚙️ PROPRIEDADES DO ITEM</span>
          <span style="font-size: 10px; color: var(--cm-primary); font-family: monospace;">${composer.paperSize.name}</span>
        </div>

        <div class="cm-print-props-scroll" style="flex: 1; min-height: 0; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px;">
          <!-- 1. Configurações da Folha de Papel -->
          <details class="cm-inspector-accordion" open>
            <summary style="font-size: 11px; font-weight: 600; padding: 6px 8px; cursor: pointer; color: #fff; background: rgba(255,255,255,0.02);">
              📄 Folha de Impressão (${composer.paperSize.name})
            </summary>
            <div style="padding: 8px; display: flex; flex-direction: column; gap: 8px;">
              <div class="cm-param-row" style="flex-direction: column; align-items: stretch;">
                <span class="cm-param-label">Tamanho do Papel:</span>
                <select id="print-paper-size-select" class="cm-native-select" style="width: 100%;">
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
              <ui-botao-primario inline id="btn-prop-align-abnt" variante="secundario" title="Substitui os elementos pelo layout padrão ABNT (Ctrl+Z desfaz)" style="width: 100%; height: 26px; font-size: 11px; margin-top: 4px;">
                📐 Restaurar Layout Padrão ABNT
              </ui-botao-primario>
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
                    <button class="cm-ai-micro-btn" data-composer-del="${it.id}" title="${it.locked ? 'Desbloqueie para excluir' : 'Excluir'}" ${it.locked ? 'disabled' : ''}>🗑️</button>
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
              ${selectedItem.locked ? `
                <div class="cm-print-props-locked-note">🔒 Item bloqueado: desbloqueie na lista acima para editar.</div>
              ` : ''}
              <fieldset class="cm-print-props-fields" ${selectedItem.locked ? 'disabled' : ''} style="padding: 8px; display: flex; flex-direction: column; gap: 6px;">
                <!-- Barra de Ações Rápidas e Alinhamento -->
                <div style="display: flex; flex-direction: column; gap: 4px; background: rgba(255,255,255,0.03); padding: 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.06);">
                  <div style="font-size: 9.5px; color: #a0a0b0; font-weight: 600;">📐 ALINHAMENTO NA FOLHA (ABNT):</div>
                  <div style="display: flex; gap: 2px; justify-content: space-between;">
                    <button class="cm-ai-micro-btn" id="btn-prop-align-left" title="Alinhar à Esquerda" style="flex: 1;">⇤ Esq</button>
                    <button class="cm-ai-micro-btn" id="btn-prop-align-center-h" title="Centralizar Horizontalmente" style="flex: 1;">⧿ Centro</button>
                    <button class="cm-ai-micro-btn" id="btn-prop-align-right" title="Alinhar à Direita" style="flex: 1;">⇥ Dir</button>
                    <button class="cm-ai-micro-btn" id="btn-prop-align-top" title="Alinhar ao Topo" style="flex: 1;">⤒ Topo</button>
                    <button class="cm-ai-micro-btn" id="btn-prop-align-center-v" title="Centralizar Verticalmente" style="flex: 1;">⧾ Meio</button>
                    <button class="cm-ai-micro-btn" id="btn-prop-align-bottom" title="Alinhar à Base" style="flex: 1;">⤓ Base</button>
                  </div>
                  <div style="display: flex; gap: 4px; margin-top: 2px;">
                    <button class="cm-ai-micro-btn" id="btn-prop-duplicate" title="Duplicar Item (Ctrl+D)" style="flex: 1;">📋 Duplicar</button>
                    <button class="cm-ai-micro-btn" id="btn-prop-bring-front" title="Trazer para Frente" style="flex: 1;">⬆️ Frente</button>
                    <button class="cm-ai-micro-btn" id="btn-prop-send-back" title="Enviar para Trás" style="flex: 1;">⬇️ Trás</button>
                  </div>
                </div>

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
                        <option value="google_satelite_puro" ${selectedItem.basemap === 'google_satelite_puro' ? 'selected' : ''}>🛰️ Google Satélite Puro</option>
                        <option value="google_satelite" ${selectedItem.basemap === 'google_satelite' ? 'selected' : ''}>🛰️ Google Híbrido</option>
                        <option value="osm" ${selectedItem.basemap === 'osm' ? 'selected' : ''}>🗺️ OpenStreetMap</option>
                        <option value="esri_light" ${selectedItem.basemap === 'esri_light' || selectedItem.basemap === 'cartodb_positron' ? 'selected' : ''}>☀️ Esri Claro Neutro</option>
                        <option value="esri_dark" ${selectedItem.basemap === 'esri_dark' || selectedItem.basemap === 'cartodb_dark' ? 'selected' : ''}>🌙 Esri Escuro</option>
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

                <!-- Propriedades da Moldura / Forma Geométrica -->
                ${selectedItem.type === 'shape' ? `
                  <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
                    <div class="cm-param-row">
                      <span class="cm-param-label">Cor de Preenchimento:</span>
                      <input type="text" id="prop-shape-fill" class="cm-vertex-input" style="width: 120px;" value="${esc(selectedItem.fillColor || 'rgba(255,255,255,0.4)')}" />
                    </div>
                    <div class="cm-param-row">
                      <span class="cm-param-label">Cor da Borda:</span>
                      <input type="color" id="prop-shape-stroke" value="${selectedItem.strokeColor || '#000000'}" style="width: 40px; height: 24px; padding: 0; border: none; cursor: pointer;" />
                    </div>
                    <div class="cm-param-row">
                      <span class="cm-param-label">Espessura da Borda (px):</span>
                      <input type="number" id="prop-shape-strokew" class="cm-vertex-input" style="width: 60px;" min="0" max="10" step="0.5" value="${selectedItem.strokeWidth !== undefined ? selectedItem.strokeWidth : 1.5}" />
                    </div>
                  </div>
                ` : ''}

                <!-- Propriedades da Imagem / Logotipo -->
                ${selectedItem.type === 'image' ? `
                  <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
                    <span class="cm-param-label">Carregar Imagem / Logotipo:</span>
                    <input type="file" id="prop-image-file" accept="image/*" class="cm-vertex-input" style="width: 100%; font-size: 10px;" />
                    <div class="cm-param-row">
                      <span class="cm-param-label">Ajuste de Enquadramento:</span>
                      <select id="prop-image-fit" class="cm-native-select" style="width: 120px;">
                        <option value="contain" ${selectedItem.objectFit === 'contain' ? 'selected' : ''}>Conter (Manter Proporção)</option>
                        <option value="cover" ${selectedItem.objectFit === 'cover' ? 'selected' : ''}>Preencher (Cortar Excesso)</option>
                      </select>
                    </div>
                    ${selectedItem.imageUrl ? `
                      <ui-botao-primario inline id="btn-remove-image-url" variante="secundario" style="height: 24px; font-size: 10px; margin-top: 2px;">
                        🗑️ Limpar Imagem
                      </ui-botao-primario>
                    ` : ''}
                  </div>
                ` : ''}

                <!-- Propriedades do Rótulo de Texto Livre / Título -->
                ${selectedItem.type === 'label' ? `
                  <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
                    <span class="cm-param-label">Texto do Título:</span>
                    <input type="text" id="prop-label-text" class="cm-vertex-input" value="${esc(selectedItem.text || '')}" />
                    <div class="cm-param-row">
                      <span class="cm-param-label">Tamanho da Fonte (pt):</span>
                      <input type="number" id="prop-label-size" class="cm-vertex-input" style="width: 60px;" min="6" max="36" value="${selectedItem.fontSize || 10}" />
                    </div>
                    <div class="cm-param-row">
                      <span class="cm-param-label">Peso da Fonte:</span>
                      <select id="prop-label-weight" class="cm-native-select" style="width: 100px;">
                        <option value="bold" ${selectedItem.fontWeight === 'bold' ? 'selected' : ''}>Negrito</option>
                        <option value="normal" ${selectedItem.fontWeight === 'normal' ? 'selected' : ''}>Normal</option>
                      </select>
                    </div>
                    <div class="cm-param-row">
                      <span class="cm-param-label">Alinhamento:</span>
                      <select id="prop-label-align" class="cm-native-select" style="width: 100px;">
                        <option value="center" ${selectedItem.textAlign === 'center' ? 'selected' : ''}>Centralizado</option>
                        <option value="left" ${selectedItem.textAlign === 'left' ? 'selected' : ''}>À Esquerda</option>
                        <option value="right" ${selectedItem.textAlign === 'right' ? 'selected' : ''}>À Direita</option>
                      </select>
                    </div>
                    <div class="cm-param-row">
                      <span class="cm-param-label">Cor do Texto:</span>
                      <input type="color" id="prop-label-color" value="${selectedItem.textColor || '#000000'}" style="width: 40px; height: 24px; padding: 0; border: none; cursor: pointer;" />
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
              </fieldset>
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
    if (type === 'shape') return '🔲';
    if (type === 'image') return '🖼️';
    if (type === 'label') return '🏷️';
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

    const btnAlignAbnt = document.getElementById('btn-prop-align-abnt');
    if (btnAlignAbnt) {
      btnAlignAbnt.addEventListener('click', () => composer.resetDefaultLayout());
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
      // Item bloqueado não é editado pelo painel (só o próprio bloqueio muda)
      if (!it || it.locked) return;
      const isMap = it.type === 'map' || it.type === 'inset_map';
      mutator(it);
      if (isPositionOrSizeChange) {
        composer.updateItemPositionDOM(it);
        if (isMap) composer.applyMapScaleAndRotation(it);
        else composer.refreshItemContent(it);
      } else if (shouldUpdateMap && isMap) {
        composer.applyMapScaleAndRotation(it);
      } else {
        // Redesenha só este item: os mapas Leaflet nunca são recriados a cada tecla
        composer.refreshItemContent(it);
      }
      // Digitação seguida no mesmo campo vira um único passo de desfazer
      const fieldId = document.activeElement?.id || 'campo';
      composer.pushHistoryState(`Editar ${it.name || 'Item'}`, { coalesceKey: `prop:${it.id}:${fieldId}` });
    };

    // Botões de alinhamento e organização do painel
    const btnPropAlignL = document.getElementById('btn-prop-align-left');
    const btnPropAlignCH = document.getElementById('btn-prop-align-center-h');
    const btnPropAlignR = document.getElementById('btn-prop-align-right');
    const btnPropAlignT = document.getElementById('btn-prop-align-top');
    const btnPropAlignCV = document.getElementById('btn-prop-align-center-v');
    const btnPropAlignB = document.getElementById('btn-prop-align-bottom');
    const btnPropDup = document.getElementById('btn-prop-duplicate');
    const btnPropFront = document.getElementById('btn-prop-bring-front');
    const btnPropBack = document.getElementById('btn-prop-send-back');

    if (btnPropAlignL) btnPropAlignL.onclick = () => composer.alignLeft();
    if (btnPropAlignCH) btnPropAlignCH.onclick = () => composer.alignCenterH();
    if (btnPropAlignR) btnPropAlignR.onclick = () => composer.alignRight();
    if (btnPropAlignT) btnPropAlignT.onclick = () => composer.alignTop();
    if (btnPropAlignCV) btnPropAlignCV.onclick = () => composer.alignCenterV();
    if (btnPropAlignB) btnPropAlignB.onclick = () => composer.alignBottom();
    if (btnPropDup) btnPropDup.onclick = () => composer.duplicateSelectedItem();
    if (btnPropFront) btnPropFront.onclick = () => composer.bringToFront();
    if (btnPropBack) btnPropBack.onclick = () => composer.sendToBack();

    // Eventos de Shape, Image, Label
    const propShapeFill = document.getElementById('prop-shape-fill');
    const propShapeStroke = document.getElementById('prop-shape-stroke');
    const propShapeStrokeW = document.getElementById('prop-shape-strokew');
    if (propShapeFill) propShapeFill.onchange = (e) => updateCurrent(it => it.fillColor = e.target.value);
    if (propShapeStroke) propShapeStroke.onchange = (e) => updateCurrent(it => it.strokeColor = e.target.value);
    if (propShapeStrokeW) propShapeStrokeW.onchange = (e) => updateCurrent(it => it.strokeWidth = parseFloat(e.target.value) || 0);

    const propImgFile = document.getElementById('prop-image-file');
    const propImgFit = document.getElementById('prop-image-fit');
    const btnRemImg = document.getElementById('btn-remove-image-url');
    if (propImgFile) {
      propImgFile.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (re) => {
            updateCurrent(it => it.imageUrl = re.target.result);
          };
          reader.readAsDataURL(file);
        }
      };
    }
    if (propImgFit) propImgFit.onchange = (e) => updateCurrent(it => it.objectFit = e.target.value);
    if (btnRemImg) btnRemImg.onclick = () => updateCurrent(it => it.imageUrl = '');

    const propLabelText = document.getElementById('prop-label-text');
    const propLabelSize = document.getElementById('prop-label-size');
    const propLabelWeight = document.getElementById('prop-label-weight');
    const propLabelAlign = document.getElementById('prop-label-align');
    const propLabelColor = document.getElementById('prop-label-color');

    if (propLabelText) propLabelText.oninput = (e) => updateCurrent(it => it.text = e.target.value);
    if (propLabelSize) propLabelSize.onchange = (e) => updateCurrent(it => it.fontSize = parseFloat(e.target.value) || 10);
    if (propLabelWeight) propLabelWeight.onchange = (e) => updateCurrent(it => it.fontWeight = e.target.value);
    if (propLabelAlign) propLabelAlign.onchange = (e) => updateCurrent(it => it.textAlign = e.target.value);
    if (propLabelColor) propLabelColor.onchange = (e) => updateCurrent(it => it.textColor = e.target.value);

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
      propGridType.addEventListener('change', (e) => updateCurrent(it => it.gridType = e.target.value));
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

