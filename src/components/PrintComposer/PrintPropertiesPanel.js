import { PrintItemsManager } from './PrintItemsManager.js';
import { PrintImageUtils } from './PrintImageUtils.js';
import { UIToast } from '@thibezer/ui-components-kit';
import { BasemapCatalog } from '../../services/BasemapCatalog.js';
import { PrintViewResolver } from './PrintViewResolver.js';

export class PrintPropertiesPanel {
  static render(composer) {
    const selectedItem = composer.items.find(it => it.id === composer.selectedItemId);
    const esc = PrintItemsManager.escapeHtml;
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
          <span>⚙️ PROPRIEDADES</span>
          <span class="cm-pp-header-paper">${esc(composer.paperSize.name)}</span>
        </div>

        <div class="cm-print-props-scroll">
          <!-- 1. Folha: papel, margens, moldura e pré-definições do projeto -->
          ${this.renderPaperSection(composer, openAttr)}

          <!-- 2. Árvore de Elementos da Composição -->
          <details class="cm-inspector-accordion" data-section="items" ${openAttr('items')}>
            <summary class="cm-pp-summary">📑 Elementos da Prancha (${composer.items.length})</summary>
            <div class="cm-pp-body cm-pp-body--list">
              ${composer.items.map((it) => {
                // Sem `visible` gravado o item aparece (mesma regra da prancha e do exportador)
                const shown = it.visible !== false;
                const selected = it.id === composer.selectedItemId;
                const name = esc(it.name || 'Item');
                return `
                <div class="cm-ai-row cm-pp-item-row ${selected ? 'is-selected' : ''} ${shown ? '' : 'is-hidden'}" data-composer-item-id="${esc(it.id)}">
                  <button type="button" class="cm-pp-item-main" data-composer-select="${esc(it.id)}" ${selected ? 'aria-current="true"' : ''} title="${shown ? name : `${name} (oculto)`}">
                    <span class="cm-pp-item-icon" aria-hidden="true">${this.getItemIcon(it.type)}</span>
                    <span class="cm-pp-item-name">${name}</span>
                  </button>
                  <div class="cm-pp-item-actions">
                    <button type="button" class="cm-ai-micro-btn cm-pp-item-btn ${it.locked ? '' : 'is-off'}" data-composer-lock="${esc(it.id)}" aria-pressed="${it.locked ? 'true' : 'false'}" aria-label="Bloquear ${name}" title="${it.locked ? 'Desbloquear' : 'Bloquear'}">${it.locked ? '🔒' : '🔓'}</button>
                    <button type="button" class="cm-ai-micro-btn cm-pp-item-btn ${shown ? '' : 'is-off'}" data-composer-vis="${esc(it.id)}" aria-pressed="${shown ? 'false' : 'true'}" aria-label="Ocultar ${name}" title="${shown ? 'Ocultar' : 'Exibir'}">👁️</button>
                    <button type="button" class="cm-ai-micro-btn cm-pp-item-btn" data-composer-del="${esc(it.id)}" aria-label="Excluir ${name}" title="${it.locked ? 'Desbloqueie para excluir' : 'Excluir (Ctrl+Z desfaz)'}" ${it.locked ? 'disabled' : ''}>🗑️</button>
                  </div>
                </div>
              `;
              }).join('')}
            </div>
          </details>

          <!-- 3. Propriedades do Elemento Selecionado -->
          ${selectedItem ? `
            <details class="cm-inspector-accordion" data-section="item" ${openAttr('item')}>
              <summary class="cm-pp-summary cm-pp-summary--active">🎯 ${esc(selectedItem.name)}</summary>
              ${selectedItem.locked ? `
                <div class="cm-print-props-locked-note">🔒 Item bloqueado: desbloqueie na lista acima para editar.</div>
              ` : ''}
              ${selectedItem.visible === false ? `
                <div class="cm-print-props-hidden-note">Item oculto: não aparece na prancha nem na exportação.</div>
              ` : ''}
              <fieldset class="cm-print-props-fields" ${selectedItem.locked ? 'disabled' : ''}>
                <!-- Barra de Ações Rápidas e Alinhamento -->
                <div class="cm-pp-toolbox">
                  <div class="cm-pp-toolbox-title">Alinhar na folha</div>
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
          ` : '<div class="cm-pp-empty">Selecione um elemento para editar.</div>'}
        </div>
      </div>
    `;
  }

  static PAPER_OPTIONS = [
    ['A4_L', 'A4 Paisagem'], ['A4_P', 'A4 Retrato'], ['A3_L', 'A3 Paisagem'],
    ['A3_P', 'A3 Retrato'], ['A2_L', 'A2 Paisagem'], ['A1_L', 'A1 Paisagem']
  ];

  /** Seção da folha: papel, margens (ABNT por padrão, editáveis), moldura e pré-definições */
  static renderPaperSection(composer, openAttr) {
    const esc = PrintItemsManager.escapeHtml;
    const paper = composer.paperSize;
    const sizes = composer.paperSizes || {};
    const m = PrintItemsManager.sheetMargins(paper);
    const isAbnt = !paper.margins;
    const presets = composer.sheetsManager?.loadPresets?.() || [];
    const match = composer.sheetsManager?.findMatchingPreset?.(paper, composer.showAbntMargins) || null;
    const maxW = Math.floor(paper.width / 2);
    const maxH = Math.floor(paper.height / 2);
    const marginInput = (side, label, max) => `
      <label class="cm-pp-margin-label" for="print-margin-${side}">${label}</label>
      <input type="number" id="print-margin-${side}" class="cm-vertex-input cm-pp-margin-input" data-margin-side="${side}" min="0" max="${max}" step="0.5" value="${m[side]}" />
    `;

    return `
      <details class="cm-inspector-accordion" data-section="paper" ${openAttr('paper')}>
        <summary class="cm-pp-summary">📄 Folha</summary>
        <div class="cm-pp-body">
          <select id="print-paper-size-select" class="cm-native-select cm-pp-full cm-pp-compact-select" title="Tamanho do papel">
            ${this.PAPER_OPTIONS.map(([id, label]) => {
              const sz = sizes[id];
              const dims = sz ? ` · ${sz.width}×${sz.height}` : '';
              return `<option value="${id}" ${paper.id === id ? 'selected' : ''}>${label}${dims}</option>`;
            }).join('')}
          </select>

          <div class="cm-pp-margins">
            <div class="cm-pp-margins-head">
              <span class="cm-param-label">Margens (mm)</span>
              <span class="cm-pp-badge" id="print-margins-abnt-badge" title="25 mm à esquerda para encadernação" ${isAbnt ? '' : 'hidden'}>ABNT</span>
              <button class="cm-ai-micro-btn" id="btn-margins-abnt" title="Voltar às margens ABNT" ${isAbnt ? 'hidden' : ''}>↺ ABNT</button>
            </div>
            <div class="cm-pp-margins-grid">
              ${marginInput('top', 'Sup.', maxH)}
              ${marginInput('left', 'Esq.', maxW)}
              ${marginInput('bottom', 'Inf.', maxH)}
              ${marginInput('right', 'Dir.', maxW)}
            </div>
          </div>
          <label class="cm-param-row" for="print-abnt-margins-check">
            <span class="cm-param-label">Moldura nas margens</span>
            <input type="checkbox" id="print-abnt-margins-check" ${composer.showAbntMargins ? 'checked' : ''} />
          </label>

          <div class="cm-pp-inline">
            <select id="print-preset-select" class="cm-native-select cm-pp-grow cm-pp-compact-select" title="Pré-definições deste projeto">
              <option value="" ${match ? '' : 'selected'}>${presets.length ? 'Pré-definições…' : 'Nenhuma pré-definição'}</option>
              ${presets.map(p => `<option value="${esc(p.id)}" ${match?.id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
            </select>
            <button class="cm-ai-micro-btn cm-pp-preset-btn" id="btn-preset-save" title="Salvar papel, margens e moldura atuais">💾</button>
            <button class="cm-ai-micro-btn cm-pp-preset-btn" id="btn-preset-delete" title="Excluir a pré-definição selecionada" ${match ? `data-preset-id="${esc(match.id)}"` : 'disabled'}>🗑️</button>
          </div>

          <ui-botao-primario inline id="btn-prop-align-abnt" variante="secundario" class="cm-pp-wide-btn" title="Volta às margens ABNT e ao layout padrão dos elementos (Ctrl+Z desfaz)">
            📐 Layout padrão
          </ui-botao-primario>
        </div>
      </details>
    `;
  }

  /**
   * Copia o estado da seção da folha recém-renderizada para a que já está na tela, sem recriar
   * os controles: um clique em pré-definição ou "↺ ABNT" logo após editar uma margem (o `change`
   * do campo reconstrói o painel) continua caindo num elemento vivo.
   */
  static syncPaperSection(kept, fresh) {
    const pick = (root, sel) => root.querySelector(sel);
    const copyValue = (sel) => {
      const a = pick(kept, sel);
      const b = pick(fresh, sel);
      if (a && b) a.value = b.value;
    };
    copyValue('#print-paper-size-select');
    kept.querySelectorAll('[data-margin-side]').forEach(input => copyValue(`[data-margin-side="${input.dataset.marginSide}"]`));
    ['#print-margins-abnt-badge', '#btn-margins-abnt'].forEach(sel => {
      const a = pick(kept, sel);
      const b = pick(fresh, sel);
      if (a && b) a.hidden = b.hidden;
    });
    const check = pick(kept, '#print-abnt-margins-check');
    if (check) check.checked = !!pick(fresh, '#print-abnt-margins-check')?.checked;
    const presets = pick(kept, '#print-preset-select');
    const freshPresets = pick(fresh, '#print-preset-select');
    if (presets && freshPresets) {
      presets.innerHTML = freshPresets.innerHTML;
      presets.value = freshPresets.value;
    }
    const del = pick(kept, '#btn-preset-delete');
    const freshDel = pick(fresh, '#btn-preset-delete');
    if (del && freshDel) {
      del.disabled = freshDel.disabled;
      if (freshDel.dataset.presetId) del.dataset.presetId = freshDel.dataset.presetId;
      else delete del.dataset.presetId;
    }
  }

  static LIST_FOCUS_ATTRS = ['data-composer-select', 'data-composer-lock', 'data-composer-vis', 'data-composer-del'];

  /** Seletor do controle da lista de elementos que está com o foco (para devolvê-lo após reconstruir o painel) */
  static listFocusSelector(active, mount) {
    if (!active || !mount?.contains(active)) return null;
    const attr = this.LIST_FOCUS_ATTRS.find(a => active.hasAttribute?.(a));
    if (!attr) return null;
    const id = String(active.getAttribute(attr)).replace(/["\\]/g, '\\$&');
    return `[${attr}="${id}"]`;
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
              ${(() => {
                // Sem fundo gravado, o mapa usa o do mapa principal (mesma regra do mountLeafletMaps)
                const current = BasemapCatalog.normalize(item.basemap || (item.type === 'inset_map' ? 'esri_light' : composer.currentBasemap));
                return BasemapCatalog.list().map(b => `
                  <option value="${b.id}" ${sel(current === b.id)}>${b.icon} ${esc(b.name)}${b.exportable ? '' : ' (pode não sair no PDF)'}</option>
                `).join('');
              })()}
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
          ${item.type === 'map' ? this.renderViewSummary(item, composer) : ''}
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
        </div>
      `;
    }

    if (item.type === 'legend') {
      const hidden = new Set((item.hiddenLayerIds || []).map(String));
      const maps = (composer.items || []).filter(i => i.type === 'map');
      const mapItem = PrintItemsManager.legendMapItem(item, composer.items || []);
      // Candidatas: tudo que aparece na vista do mapa vinculado (a legenda só esconde, não inventa)
      const candidates = mapItem
        ? PrintViewResolver.legendEntries(PrintViewResolver.effectiveView(mapItem, composer.library), {
          features: composer.features || [], layers: composer.layers || [], library: composer.library, scale: mapItem.scale
        })
        : [];
      return `
        <div class="cm-pp-stack">
          <span class="cm-param-label">Título da Legenda (vazio = sem título):</span>
          <input type="text" id="prop-legend-title" class="cm-vertex-input" value="${esc(item.title ?? PrintItemsManager.DEFAULT_LEGEND_TITLE)}" />
          ${maps.length > 1 ? `
            <div class="cm-param-row">
              <span class="cm-param-label">Mapa vinculado:</span>
              <select id="prop-legend-map" class="cm-native-select cm-pp-w-l">
                ${maps.map(m => `<option value="${esc(m.id)}" ${sel(mapItem?.id === m.id)}>${esc(m.name || 'Mapa')}</option>`).join('')}
              </select>
            </div>
          ` : ''}
          <span class="cm-param-label">Itens exibidos (do que aparece no mapa):</span>
          <div class="cm-pp-layer-list">
            ${candidates.map(e => `
              <label class="cm-param-row cm-pp-layer-row" for="prop-legend-layer-${esc(e.id)}">
                <input type="checkbox" id="prop-legend-layer-${esc(e.id)}" data-legend-layer="${esc(e.id)}" ${hidden.has(String(e.id)) ? '' : 'checked'} />
                <span class="cm-pp-swatch" style="background: ${PrintItemsManager.sanitizeColor(e.graphics.fill.color !== 'none' ? e.graphics.fill.color : e.graphics.stroke.color, '#00E08A')};"></span>
                <span class="cm-pp-layer-name">${e.isFilter ? 'Filtro: ' : ''}${esc(e.name)}</span>
              </label>
            `).join('') || '<span class="cm-pp-hint">Nada aparece no mapa vinculado.</span>'}
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
          <span class="cm-param-label">Texto de Escala:</span>
          <input type="text" id="prop-tb-scale" class="cm-vertex-input" value="${esc(PrintItemsManager.titleBlockScaleText(p, composer.items.find(i => i.type === 'map')?.scale))}" />
          <div class="cm-param-row">
            <span class="cm-param-label">Acompanhar a escala do mapa:</span>
            <input type="checkbox" id="prop-tb-scale-auto" ${PrintItemsManager.isTitleBlockScaleAuto(p) ? 'checked' : ''} />
          </div>
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

  /** Resumo da vista do mapa (padrão Revit) e acesso à janela Visibilidade/Gráficos */
  static renderViewSummary(item, composer) {
    const esc = PrintItemsManager.escapeHtml;
    const view = PrintViewResolver.effectiveView(item, composer.library);
    const layers = composer.layers || [];
    const hiddenLayers = view.followProject
      ? layers.filter(l => l.visible === false).length
      : layers.filter(l => view.layers?.[l.id]?.visible === false).length;
    const styled = Object.values(view.layers || {}).filter(o => o && (o.stroke || o.fill || o.halftone)).length;
    const activeFilters = (view.filters || []).filter(f => f.enabled !== false).length;
    const labels = Object.values(view.labels || {}).filter(l => l && l.show).length;
    const parts = [
      view.followProject ? 'espelha o mapa principal' : `${hiddenLayers} camada(s) oculta(s)`,
      styled ? `${styled} com gráficos próprios` : '',
      activeFilters ? `${activeFilters} filtro(s)` : '',
      labels ? `${labels} com rótulo` : ''
    ].filter(Boolean);
    return `
      <div class="cm-pp-view-summary">
        <div class="cm-pp-view-line">
          <span class="cm-param-label">Vista:</span>
          <span class="cm-pp-view-template">${view.template ? `📐 ${esc(view.template.name)}` : 'Sem modelo'}</span>
        </div>
        <div class="cm-pp-hint">${esc(parts.join(' · '))}</div>
        <ui-botao-primario inline id="btn-prop-open-vv" variante="secundario" class="cm-pp-wide-btn" title="Visibilidade e gráficos deste mapa (V V)">
          👁️ Visibilidade/Gráficos (VV)
        </ui-botao-primario>
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

  /** Eventos da seção da folha (ligados uma única vez; os controles sobrevivem às reconstruções) */
  static bindPaperEvents(composer) {
    document.getElementById('print-paper-size-select')?.addEventListener('change', (e) => composer.setPaperSize(e.target.value));
    document.getElementById('print-abnt-margins-check')?.addEventListener('change', (e) => composer.setAbntMargins(e.target.checked));

    // Margens: aplicadas ao confirmar o campo (Enter, setas ou ao sair), um passo no histórico cada
    document.querySelectorAll('[data-margin-side]').forEach(input => {
      input.addEventListener('change', () => {
        if (input.value === '') { composer.updatePropertiesPanel(); return; }
        composer.setMargins({ [input.dataset.marginSide]: Number(input.value) });
      });
    });
    document.getElementById('btn-margins-abnt')?.addEventListener('click', () => composer.setMargins(null));

    document.getElementById('print-preset-select')?.addEventListener('change', (e) => {
      if (e.target.value) composer.applyPagePreset(e.target.value);
    });
    document.getElementById('btn-preset-save')?.addEventListener('click', () => composer.savePagePreset());
    const presetDel = document.getElementById('btn-preset-delete');
    presetDel?.addEventListener('click', () => {
      if (presetDel.dataset.presetId) composer.deletePagePreset(presetDel.dataset.presetId);
    });
    document.getElementById('btn-prop-align-abnt')?.addEventListener('click', () => composer.resetDefaultLayout());
  }

  static bindEvents(composer) {
    // Lembra quais seções o usuário abriu ou fechou, pelo nome (sobrevive à reconstrução do painel)
    composer.panelSections = composer.panelSections || {};
    document.querySelectorAll('#cm-print-props-panel-mount details[data-section]').forEach(d => {
      if (d.dataset.bound) return;
      d.addEventListener('toggle', () => { composer.panelSections[d.dataset.section] = d.open; });
    });

    // A seção da folha é mantida entre reconstruções (syncPaperSection): seus eventos são ligados uma vez
    const paperSection = document.querySelector('#cm-print-props-panel-mount details[data-section="paper"]');
    if (paperSection && !paperSection.dataset.bound) {
      paperSection.dataset.bound = '1';
      this.bindPaperEvents(composer);
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
    document.getElementById('btn-prop-open-vv')?.addEventListener('click', () => composer.openVisibilityDialog(composer.selectedItemId));
    const propLegendMap = document.getElementById('prop-legend-map');
    if (propLegendMap) {
      propLegendMap.addEventListener('change', (e) => {
        updateCurrent(it => { it.mapItemId = e.target.value; });
        composer.updatePropertiesPanel();
      });
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
    // Digitar uma escala própria desliga o acompanhamento automático do mapa
    if (propTbScale) {
      propTbScale.addEventListener('input', (e) => {
        updateCurrent(it => { it.properties = it.properties || {}; it.properties.scaleText = e.target.value; it.properties.scaleAuto = false; });
        const auto = document.getElementById('prop-tb-scale-auto');
        if (auto) auto.checked = false;
      });
    }
    const propTbScaleAuto = document.getElementById('prop-tb-scale-auto');
    if (propTbScaleAuto) {
      propTbScaleAuto.addEventListener('change', (e) => {
        updateCurrent(it => {
          it.properties = it.properties || {};
          // Ao desligar, congela o texto que está à mostra (não volta para um valor antigo)
          if (!e.target.checked && propTbScale) it.properties.scaleText = propTbScale.value;
          it.properties.scaleAuto = e.target.checked;
        });
        const mapScale = composer.items.find(i => i.type === 'map')?.scale;
        const it = composer.items.find(i => i.id === composer.selectedItemId);
        if (propTbScale && it) propTbScale.value = PrintItemsManager.titleBlockScaleText(it.properties, mapScale);
      });
    }
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

