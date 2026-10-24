import { PrintItemsManager } from './PrintItemsManager.js';
import { PrintImageUtils } from './PrintImageUtils.js';
import { UIToast } from '@thibezer/ui-components-kit';

export class PrintPropertiesPanel {
  static render(composer) {
    const selectedItem = composer.items.find(it => it.id === composer.selectedItemId);
    const esc = PrintItemsManager.escapeHtml;
    const sel = (cond) => (cond ? 'selected' : '');
    // Seção aberta ou fechada pelo usuário, lembrada pelo nome (não pela posição)
    const openAttr = (key) => (composer.panelSections?.[key] === false ? '' : 'open');

    // Filtra feições poligonais ou de linha para a tabela de vértices
    const polygonFeatures = composer.features.filter(f => {
      const t = (f.type || '').toLowerCase();
      return (t === 'polygon' || t === 'multipolygon' || t === 'linestring' || t === 'line');
    });

    return `
      <div class="cm-print-props-panel">
        <div class="cm-pp-header">
          <span>⚙️ PROPRIEDADES DO ITEM</span>
          <span class="cm-pp-header-paper">${esc(composer.paperSize.name)}</span>
        </div>

        <div class="cm-print-props-scroll">
          <!-- 1. Configurações da Folha de Papel -->
          <details class="cm-inspector-accordion" data-section="paper" ${openAttr('paper')}>
            <summary class="cm-pp-summary">📄 Folha de Impressão (${esc(composer.paperSize.name)})</summary>
            <div class="cm-pp-body">
              <div class="cm-param-row cm-pp-row-stack">
                <span class="cm-param-label">Tamanho do Papel:</span>
                <select id="print-paper-size-select" class="cm-native-select cm-pp-full">
                  <option value="A4_L" ${sel(composer.paperSize.id === 'A4_L')}>A4 Paisagem (297x210 mm)</option>
                  <option value="A4_P" ${sel(composer.paperSize.id === 'A4_P')}>A4 Retrato (210x297 mm)</option>
                  <option value="A3_L" ${sel(composer.paperSize.id === 'A3_L')}>A3 Paisagem (420x297 mm)</option>
                  <option value="A3_P" ${sel(composer.paperSize.id === 'A3_P')}>A3 Retrato (297x420 mm)</option>
                  <option value="A2_L" ${sel(composer.paperSize.id === 'A2_L')}>A2 Paisagem (594x420 mm)</option>
                  <option value="A1_L" ${sel(composer.paperSize.id === 'A1_L')}>A1 Paisagem (841x594 mm)</option>
                </select>
              </div>
              <div class="cm-param-row">
                <span class="cm-param-label">Margens Normatizadas ABNT:</span>
                <input type="checkbox" id="print-abnt-margins-check" ${composer.showAbntMargins ? 'checked' : ''} />
              </div>
              <div class="cm-pp-hint">Margem esquerda de 25 mm para encadernação e borda interna ABNT.</div>
              <ui-botao-primario inline id="btn-prop-align-abnt" variante="secundario" class="cm-pp-wide-btn" title="Substitui os elementos pelo layout padrão ABNT (Ctrl+Z desfaz)">
                📐 Restaurar Layout Padrão ABNT
              </ui-botao-primario>
            </div>
          </details>

          <!-- 2. Árvore de Elementos da Composição -->
          <details class="cm-inspector-accordion" data-section="items" ${openAttr('items')}>
            <summary class="cm-pp-summary">📑 Elementos da Prancha (${composer.items.length})</summary>
            <div class="cm-pp-body cm-pp-body--list">
              ${composer.items.map((it) => `
                <div class="cm-ai-row cm-pp-item-row ${it.id === composer.selectedItemId ? 'ai-selected' : ''}" data-composer-item-id="${esc(it.id)}">
                  <div class="cm-pp-item-main">
                    <span class="cm-pp-item-icon">${this.getItemIcon(it.type)}</span>
                    <span class="cm-pp-item-name">${esc(it.name)}</span>
                  </div>
                  <div class="cm-pp-item-actions">
                    <button class="cm-ai-micro-btn" data-composer-lock="${esc(it.id)}" title="${it.locked ? 'Desbloquear' : 'Bloquear'}">${it.locked ? '🔒' : '🔓'}</button>
                    <button class="cm-ai-micro-btn" data-composer-vis="${esc(it.id)}" title="${it.visible ? 'Ocultar' : 'Exibir'}">${it.visible ? '👁️' : '✕'}</button>
                    <button class="cm-ai-micro-btn" data-composer-del="${esc(it.id)}" title="${it.locked ? 'Desbloqueie para excluir' : 'Excluir'}" ${it.locked ? 'disabled' : ''}>🗑️</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </details>

          <!-- 3. Propriedades do Elemento Selecionado -->
          ${selectedItem ? `
            <details class="cm-inspector-accordion" data-section="item" ${openAttr('item')}>
              <summary class="cm-pp-summary cm-pp-summary--active">🎯 ${esc(selectedItem.name)}</summary>
              ${selectedItem.locked ? `
                <div class="cm-print-props-locked-note">🔒 Item bloqueado: desbloqueie na lista acima para editar.</div>
              ` : ''}
              <fieldset class="cm-print-props-fields" ${selectedItem.locked ? 'disabled' : ''}>
                <!-- Barra de Ações Rápidas e Alinhamento -->
                <div class="cm-pp-toolbox">
                  <div class="cm-pp-toolbox-title">📐 ALINHAMENTO NA FOLHA (ABNT):</div>
                  <div class="cm-pp-btn-row">
                    <button class="cm-ai-micro-btn" id="btn-prop-align-left" title="Alinhar à Esquerda">⇤ Esq</button>
                    <button class="cm-ai-micro-btn" id="btn-prop-align-center-h" title="Centralizar Horizontalmente">⧿ Centro</button>
                    <button class="cm-ai-micro-btn" id="btn-prop-align-right" title="Alinhar à Direita">⇥ Dir</button>
                    <button class="cm-ai-micro-btn" id="btn-prop-align-top" title="Alinhar ao Topo">⤒ Topo</button>
                    <button class="cm-ai-micro-btn" id="btn-prop-align-center-v" title="Centralizar Verticalmente">⧾ Meio</button>
                    <button class="cm-ai-micro-btn" id="btn-prop-align-bottom" title="Alinhar à Base">⤓ Base</button>
                  </div>
                  <div class="cm-pp-btn-row">
                    <button class="cm-ai-micro-btn" id="btn-prop-duplicate" title="Duplicar Item (Ctrl+D)">📋 Duplicar</button>
                    <button class="cm-ai-micro-btn" id="btn-prop-bring-front" title="Trazer para Frente">⬆️ Frente</button>
                    <button class="cm-ai-micro-btn" id="btn-prop-send-back" title="Enviar para Trás">⬇️ Trás</button>
                  </div>
                </div>

                <!-- Posição e Dimensão em mm -->
                <div class="cm-pp-grid2">
                  <div>
                    <span class="cm-param-label">Posição X (mm):</span>
                    <input type="number" id="prop-item-x" class="cm-vertex-input cm-pp-full" min="0" max="${composer.paperSize.width}" value="${Math.round(selectedItem.x)}" />
                  </div>
                  <div>
                    <span class="cm-param-label">Posição Y (mm):</span>
                    <input type="number" id="prop-item-y" class="cm-vertex-input cm-pp-full" min="0" max="${composer.paperSize.height}" value="${Math.round(selectedItem.y)}" />
                  </div>
                  <div>
                    <span class="cm-param-label">Largura (mm):</span>
                    <input type="number" id="prop-item-w" class="cm-vertex-input cm-pp-full" min="${PrintItemsManager.MIN_ITEM_MM}" max="${composer.paperSize.width}" value="${Math.round(selectedItem.width)}" />
                  </div>
                  <div>
                    <span class="cm-param-label">Altura (mm):</span>
                    <input type="number" id="prop-item-h" class="cm-vertex-input cm-pp-full" min="${PrintItemsManager.MIN_ITEM_MM}" max="${composer.paperSize.height}" value="${Math.round(selectedItem.height)}" />
                  </div>
                </div>

                ${this.renderTypeFields(selectedItem, composer, polygonFeatures)}
              </fieldset>
            </details>
          ` : '<div class="cm-pp-empty">Clique em um elemento da prancha para editar suas propriedades.</div>'}
        </div>
      </div>
    `;
  }

  /** Campos específicos do tipo do elemento selecionado */
  static renderTypeFields(item, composer, polygonFeatures) {
    const esc = PrintItemsManager.escapeHtml;
    const sel = (cond) => (cond ? 'selected' : '');
    const colorValue = (value, fallback) => (PrintItemsManager.parseColor(value) || { hex: fallback }).hex;

    if (item.type === 'map' || item.type === 'inset_map') {
      return `
        <div class="cm-pp-stack cm-pp-section">
          <div class="cm-param-row">
            <span class="cm-param-label">Camada Base:</span>
            <select id="prop-map-basemap" class="cm-native-select cm-pp-w-xl">
              <option value="satelite" ${sel(item.basemap === 'satelite')}>🛰️ Esri Satélite</option>
              <option value="google_satelite_puro" ${sel(item.basemap === 'google_satelite_puro')}>🛰️ Google Satélite Puro</option>
              <option value="google_satelite" ${sel(item.basemap === 'google_satelite')}>🛰️ Google Híbrido</option>
              <option value="osm" ${sel(item.basemap === 'osm')}>🗺️ OpenStreetMap</option>
              <option value="esri_light" ${sel(item.basemap === 'esri_light' || item.basemap === 'cartodb_positron')}>☀️ Esri Claro Neutro</option>
              <option value="esri_dark" ${sel(item.basemap === 'esri_dark' || item.basemap === 'cartodb_dark')}>🌙 Esri Escuro</option>
              <option value="relevo" ${sel(item.basemap === 'relevo')}>⛰️ Relevo Topo</option>
              <option value="branco" ${sel(item.basemap === 'branco')}>⚪ Fundo Branco CAD</option>
            </select>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Escala Numérica (1:):</span>
            <input type="number" id="prop-map-scale" class="cm-vertex-input cm-pp-w-m" step="500" value="${Number(item.scale) || 10000}" />
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Rotação do Mapa:</span>
            <input type="number" id="prop-map-rot" class="cm-vertex-input cm-pp-w-s" min="0" max="360" value="${Number(item.rotation) || 0}" />
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Grade de Coordenadas:</span>
            <input type="checkbox" id="prop-map-grid" ${item.showGrid ? 'checked' : ''} />
          </div>
          ${item.showGrid ? `
            <div class="cm-param-row">
              <span class="cm-param-label">Tipo de Grade:</span>
              <select id="prop-map-grid-type" class="cm-native-select cm-pp-w-l">
                <option value="dms" ${sel(item.gridType === 'dms')}>Geográfica (DMS)</option>
                <option value="utm" ${sel(item.gridType === 'utm')}>Métrica UTM (Metros)</option>
              </select>
            </div>
          ` : ''}
          <ui-botao-primario inline id="btn-prop-pan-map" variante="secundario" class="cm-pp-wide-btn">
            🖐️ Enquadrar Terreno neste Mapa
          </ui-botao-primario>
        </div>
      `;
    }

    if (item.type === 'north_arrow') {
      return `
        <div class="cm-pp-stack">
          <div class="cm-param-row">
            <span class="cm-param-label">Estilo da Seta:</span>
            <select id="prop-arrow-style" class="cm-native-select cm-pp-w-l">
              <option value="classic" ${sel(item.arrowStyle === 'classic')}>Cartográfica Clássica</option>
              <option value="compass" ${sel(item.arrowStyle === 'compass')}>Bússola / Rosa</option>
              <option value="modern" ${sel(item.arrowStyle === 'modern')}>Moderna Técnica</option>
            </select>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Rotação (Norte):</span>
            <div class="cm-pp-inline">
              <input type="range" id="prop-arrow-rot-range" class="cm-pp-w-range" min="0" max="360" value="${Number(item.rotation) || 0}" />
              <input type="number" id="prop-arrow-rot" class="cm-vertex-input cm-pp-w-xs" min="0" max="360" value="${Number(item.rotation) || 0}" />
            </div>
          </div>
        </div>
      `;
    }

    if (item.type === 'scale_bar') {
      return `
        <div class="cm-pp-stack">
          <div class="cm-param-row">
            <span class="cm-param-label">Escala (vinculada ao mapa):</span>
            <span class="cm-pp-value">1:${Math.round(Number(item.scale) || 10000).toLocaleString('pt-BR')}</span>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Divisões:</span>
            <input type="number" id="prop-sb-segments" class="cm-vertex-input cm-pp-w-s" min="1" max="8" step="1" value="${Number(item.segments) || 4}" />
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Unidade:</span>
            <select id="prop-sb-units" class="cm-native-select cm-pp-w-l">
              <option value="auto" ${sel(!item.units || item.units === 'auto')}>Automática</option>
              <option value="m" ${sel(item.units === 'm')}>Metros (m)</option>
              <option value="km" ${sel(item.units === 'km')}>Quilômetros (km)</option>
            </select>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Mostrar escala numérica:</span>
            <input type="checkbox" id="prop-sb-text" ${item.showScaleText !== false ? 'checked' : ''} />
          </div>
          <div class="cm-pp-hint">O comprimento da régua corresponde exatamente à distância indicada, arredondada a um valor redondo.</div>
        </div>
      `;
    }

    if (item.type === 'legend') {
      const hidden = (item.hiddenLayerIds || []).map(String);
      const layers = (composer.layers || []).filter(l => l.visible !== false);
      return `
        <div class="cm-pp-stack">
          <span class="cm-param-label">Título da Legenda (vazio = sem título):</span>
          <input type="text" id="prop-legend-title" class="cm-vertex-input" value="${esc(item.title ?? PrintItemsManager.DEFAULT_LEGEND_TITLE)}" />
          <span class="cm-param-label">Camadas exibidas:</span>
          <div class="cm-pp-layer-list">
            ${layers.map(l => `
              <label class="cm-param-row cm-pp-layer-row" for="prop-legend-layer-${esc(l.id)}">
                <input type="checkbox" id="prop-legend-layer-${esc(l.id)}" data-legend-layer="${esc(l.id)}" ${hidden.includes(String(l.id)) ? '' : 'checked'} />
                <span class="cm-pp-swatch" style="background: ${PrintItemsManager.sanitizeColor(l.color, '#00E08A')};"></span>
                <span class="cm-pp-layer-name">${esc(l.name)}</span>
              </label>
            `).join('') || '<span class="cm-pp-hint">Nenhuma camada visível no projeto.</span>'}
          </div>
        </div>
      `;
    }

    if (item.type === 'table_vertices') {
      return `
        <div class="cm-pp-stack">
          <div class="cm-param-row">
            <span class="cm-param-label">Feição Referência:</span>
            <select id="prop-vert-feature" class="cm-native-select cm-pp-w-xl">
              <option value="">-- Automático (1º Polígono) --</option>
              ${polygonFeatures.map(f => `
                <option value="${esc(f.id)}" ${sel(item.targetFeatureId === f.id)}>${esc(f.name || f.id)}</option>
              `).join('')}
            </select>
          </div>
          <div class="cm-pp-hint">Gera automaticamente vértices numerados (V01, V02...), coordenadas N/E em SIRGAS 2000 UTM, azimutes e distâncias perimétricas.</div>
        </div>
      `;
    }

    if (item.type === 'text_block') {
      return `
        <div class="cm-pp-stack">
          <span class="cm-param-label">Título do Bloco:</span>
          <input type="text" id="prop-text-title" class="cm-vertex-input" value="${esc(item.title || '')}" />
          <span class="cm-param-label">Texto das Notas:</span>
          <textarea id="prop-text-body" class="cm-vertex-input cm-pp-textarea" rows="5">${esc(item.text || '')}</textarea>
          <div class="cm-param-row">
            <span class="cm-param-label">Tamanho da Fonte (pt):</span>
            <input type="number" id="prop-text-size" class="cm-vertex-input cm-pp-w-s" min="5" max="18" step="0.5" value="${Number(item.fontSize) || 7.5}" />
          </div>
        </div>
      `;
    }

    if (item.type === 'shape') {
      const fill = PrintItemsManager.parseColor(item.fillColor) || { hex: '#ffffff', alpha: 0.4 };
      return `
        <div class="cm-pp-stack">
          <div class="cm-param-row">
            <span class="cm-param-label">Cor de Preenchimento:</span>
            <input type="color" id="prop-shape-fill" class="cm-pp-color" value="${fill.hex}" />
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Opacidade do Preenchimento:</span>
            <div class="cm-pp-inline">
              <input type="range" id="prop-shape-fill-alpha" class="cm-pp-w-range" min="0" max="100" step="5" value="${Math.round(fill.alpha * 100)}" />
              <span id="prop-shape-fill-alpha-value" class="cm-pp-value">${Math.round(fill.alpha * 100)}%</span>
            </div>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Cor da Borda:</span>
            <input type="color" id="prop-shape-stroke" class="cm-pp-color" value="${colorValue(item.strokeColor, '#000000')}" />
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Espessura da Borda (px):</span>
            <input type="number" id="prop-shape-strokew" class="cm-vertex-input cm-pp-w-s" min="0" max="10" step="0.5" value="${item.strokeWidth == null ? 1.5 : (Number(item.strokeWidth) || 0)}" />
          </div>
        </div>
      `;
    }

    if (item.type === 'image') {
      return `
        <div class="cm-pp-stack">
          <span class="cm-param-label">Carregar Imagem / Logotipo:</span>
          <input type="file" id="prop-image-file" accept="image/*" class="cm-vertex-input cm-pp-file" />
          <div class="cm-param-row">
            <span class="cm-param-label">Ajuste de Enquadramento:</span>
            <select id="prop-image-fit" class="cm-native-select cm-pp-w-l">
              <option value="contain" ${sel(item.objectFit === 'contain')}>Conter (Manter Proporção)</option>
              <option value="cover" ${sel(item.objectFit === 'cover')}>Preencher (Cortar Excesso)</option>
            </select>
          </div>
          ${item.imageUrl ? `
            <ui-botao-primario inline id="btn-remove-image-url" variante="secundario" class="cm-pp-small-btn">
              🗑️ Limpar Imagem
            </ui-botao-primario>
          ` : ''}
        </div>
      `;
    }

    if (item.type === 'label') {
      return `
        <div class="cm-pp-stack">
          <span class="cm-param-label">Texto do Título:</span>
          <input type="text" id="prop-label-text" class="cm-vertex-input" value="${esc(item.text || '')}" />
          <div class="cm-param-row">
            <span class="cm-param-label">Tamanho da Fonte (pt):</span>
            <input type="number" id="prop-label-size" class="cm-vertex-input cm-pp-w-s" min="6" max="36" value="${Number(item.fontSize) || 10}" />
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Peso da Fonte:</span>
            <select id="prop-label-weight" class="cm-native-select cm-pp-w-m">
              <option value="bold" ${sel(item.fontWeight === 'bold')}>Negrito</option>
              <option value="normal" ${sel(item.fontWeight === 'normal')}>Normal</option>
            </select>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Alinhamento:</span>
            <select id="prop-label-align" class="cm-native-select cm-pp-w-m">
              <option value="center" ${sel(item.textAlign === 'center')}>Centralizado</option>
              <option value="left" ${sel(item.textAlign === 'left')}>À Esquerda</option>
              <option value="right" ${sel(item.textAlign === 'right')}>À Direita</option>
            </select>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Cor do Texto:</span>
            <input type="color" id="prop-label-color" class="cm-pp-color" value="${colorValue(item.textColor, '#000000')}" />
          </div>
        </div>
      `;
    }

    if (item.type === 'title_block') {
      const p = item.properties || {};
      const field = (id, label, key) => `
        <span class="cm-param-label">${label}:</span>
        <input type="text" id="${id}" class="cm-vertex-input" value="${esc(p[key] || '')}" />
      `;
      return `
        <div class="cm-pp-stack cm-pp-stack--tight">
          ${field('prop-tb-header', 'Título da Prancha', 'headerTitle')}
          ${field('prop-tb-proj', 'Projeto / Obra', 'projectName')}
          ${field('prop-tb-client', 'Proprietário / Cliente', 'client')}
          ${field('prop-tb-author', 'Responsável Técnico', 'author')}
          ${field('prop-tb-art', 'ART / Registro', 'art')}
          ${field('prop-tb-datum', 'Sistema Geodésico / Projeção', 'datum')}
          ${field('prop-tb-scale', 'Texto de Escala', 'scaleText')}
          <span class="cm-param-label">Área e Perímetro:</span>
          <div class="cm-pp-inline">
            <input type="text" id="prop-tb-area" class="cm-vertex-input cm-pp-grow" value="${esc(p.areaPerimeter || '')}" />
            <button id="btn-calc-area-carimbo" class="cm-ai-micro-btn cm-pp-icon-btn" title="Calcular das Feições">⚡</button>
          </div>
          ${field('prop-tb-loc', 'Localização / Imóvel', 'location')}
          ${field('prop-tb-date', 'Data da Planta', 'date')}
        </div>
      `;
    }

    return '';
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
    // Lembra quais seções o usuário abriu ou fechou, pelo nome (sobrevive à reconstrução do painel)
    composer.panelSections = composer.panelSections || {};
    document.querySelectorAll('#cm-print-props-panel-mount details[data-section]').forEach(d => {
      d.addEventListener('toggle', () => { composer.panelSections[d.dataset.section] = d.open; });
    });

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
    const propShapeFillAlpha = document.getElementById('prop-shape-fill-alpha');
    const propShapeFillAlphaValue = document.getElementById('prop-shape-fill-alpha-value');
    const propShapeStroke = document.getElementById('prop-shape-stroke');
    const propShapeStrokeW = document.getElementById('prop-shape-strokew');
    // Preenchimento = cor do seletor + opacidade, gravados juntos como rgba()
    const applyShapeFill = () => {
      const alpha = (parseFloat(propShapeFillAlpha?.value) || 0) / 100;
      if (propShapeFillAlphaValue) propShapeFillAlphaValue.textContent = `${Math.round(alpha * 100)}%`;
      updateCurrent(it => it.fillColor = PrintItemsManager.toRgba(propShapeFill.value, alpha));
    };
    if (propShapeFill) propShapeFill.addEventListener('input', applyShapeFill);
    if (propShapeFillAlpha) propShapeFillAlpha.addEventListener('input', applyShapeFill);
    if (propShapeStroke) propShapeStroke.onchange = (e) => updateCurrent(it => it.strokeColor = e.target.value);
    if (propShapeStrokeW) propShapeStrokeW.onchange = (e) => updateCurrent(it => it.strokeWidth = parseFloat(e.target.value) || 0);

    const propImgFile = document.getElementById('prop-image-file');
    const propImgFit = document.getElementById('prop-image-fit');
    const btnRemImg = document.getElementById('btn-remove-image-url');
    if (propImgFile) {
      propImgFile.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        // Reduz a imagem antes de gravar: a prancha inteira precisa caber no localStorage
        PrintImageUtils.prepareImageFile(file)
          .then(({ dataUrl }) => updateCurrent(it => it.imageUrl = dataUrl))
          .catch(err => UIToast.notificar({
            tipo: 'erro',
            titulo: 'Imagem não carregada',
            mensagem: err.message || 'Não foi possível ler a imagem.',
            duracao: 4000
          }));
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

    // Valor digitado é limitado à folha e ao tamanho mínimo; o campo mostra o valor aplicado
    const bindGeometryField = (input, key) => {
      if (!input) return;
      input.addEventListener('change', (e) => {
        const v = parseFloat(e.target.value);
        updateCurrent(it => {
          if (Number.isFinite(v)) it[key] = v;
          PrintItemsManager.clampItemToPaper(it, composer.paperSize);
          e.target.value = Math.round(it[key]);
        }, false, true);
      });
    };
    bindGeometryField(propX, 'x');
    bindGeometryField(propY, 'y');
    bindGeometryField(propW, 'width');
    bindGeometryField(propH, 'height');

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

    // Barra de escala
    const propSbSegments = document.getElementById('prop-sb-segments');
    const propSbUnits = document.getElementById('prop-sb-units');
    const propSbText = document.getElementById('prop-sb-text');
    if (propSbSegments) {
      propSbSegments.addEventListener('change', (e) => {
        const n = Math.min(8, Math.max(1, Math.round(parseFloat(e.target.value) || 4)));
        e.target.value = n;
        updateCurrent(it => it.segments = n);
      });
    }
    if (propSbUnits) propSbUnits.addEventListener('change', (e) => updateCurrent(it => it.units = e.target.value));
    if (propSbText) propSbText.addEventListener('change', (e) => updateCurrent(it => it.showScaleText = e.target.checked));

    // Legenda
    const propLegendTitle = document.getElementById('prop-legend-title');
    if (propLegendTitle) propLegendTitle.addEventListener('input', (e) => updateCurrent(it => it.title = e.target.value));
    document.querySelectorAll('[data-legend-layer]').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.getAttribute('data-legend-layer');
        updateCurrent(it => {
          const hidden = new Set(it.hiddenLayerIds || []);
          if (chk.checked) hidden.delete(id);
          else hidden.add(id);
          it.hiddenLayerIds = [...hidden];
        });
      });
    });

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

