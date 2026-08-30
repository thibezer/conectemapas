/* ==========================================================================
   ConecteMapas - PrintPropertiesPanel
   Responsabilidade Única: Painel lateral de propriedades do item selecionado,
   configurações da folha de papel e árvore de elementos da prancha.
   ========================================================================== */

export class PrintPropertiesPanel {
  static render(composer) {
    const selectedItem = composer.items.find(it => it.id === composer.selectedItemId);

    return `
      <div style="width: 290px; background: #18181c; border-left: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; height: 100%;">
        <div style="height: 38px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; padding: 0 10px; font-weight: 700; font-size: 11.5px; color: #fff; justify-content: space-between;">
          <span>⚙️ PROPRIEDADES DO ITEM</span>
          <span style="font-size: 10px; color: var(--cm-primary); font-family: monospace;">${composer.paperSize.name}</span>
        </div>

        <div style="flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px;">
          <!-- 1. Configurações da Folha de Papel -->
          <details class="cm-inspector-accordion" open>
            <summary style="font-size: 11px; font-weight: 600; padding: 6px 8px; cursor: pointer; color: #fff; background: rgba(255,255,255,0.02);">
              📄 Folha de Impressão (${composer.paperSize.name})
            </summary>
            <div style="padding: 8px; display: flex; flex-direction: column; gap: 6px;">
              <div class="cm-param-row">
                <span class="cm-param-label">Tamanho do Papel:</span>
                <select id="print-paper-size-select" class="cm-native-select" style="width: 140px;">
                  <option value="A4_L" ${composer.paperSize.id === 'A4_L' ? 'selected' : ''}>A4 Paisagem (297x210 mm)</option>
                  <option value="A4_P" ${composer.paperSize.id === 'A4_P' ? 'selected' : ''}>A4 Retrato (210x297 mm)</option>
                  <option value="A3_L" ${composer.paperSize.id === 'A3_L' ? 'selected' : ''}>A3 Paisagem (420x297 mm)</option>
                  <option value="A3_P" ${composer.paperSize.id === 'A3_P' ? 'selected' : ''}>A3 Retrato (297x420 mm)</option>
                  <option value="A2_L" ${composer.paperSize.id === 'A2_L' ? 'selected' : ''}>A2 Paisagem (594x420 mm)</option>
                  <option value="A1_L" ${composer.paperSize.id === 'A1_L' ? 'selected' : ''}>A1 Paisagem (841x594 mm)</option>
                </select>
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
                <div class="cm-ai-row ${it.id === composer.selectedItemId ? 'ai-selected' : ''}" data-composer-item-id="${it.id}" style="height: 24px; padding: 0 4px; display: flex; align-items: center; justify-content: space-between; border-radius: 3px; cursor: pointer;">
                  <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
                    <span style="font-size: 11px;">${this.getItemIcon(it.type)}</span>
                    <span style="font-size: 10.5px; color: #e1e1e6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">${it.name}</span>
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
                🎯 ${selectedItem.name}
              </summary>
              <div style="padding: 8px; display: flex; flex-direction: column; gap: 6px;">
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

                ${(selectedItem.type === 'map' || selectedItem.type === 'inset_map') ? `
                  <div class="cm-param-row" style="margin-top: 4px;">
                    <span class="cm-param-label">Escala Numérica (1:):</span>
                    <input type="number" id="prop-map-scale" class="cm-vertex-input" style="width: 110px;" step="500" value="${selectedItem.scale || 10000}" />
                  </div>
                  <div class="cm-param-row">
                    <span class="cm-param-label">Rotação do Mapa:</span>
                    <input type="number" id="prop-map-rot" class="cm-vertex-input" style="width: 60px;" min="0" max="360" value="${selectedItem.rotation || 0}" />
                  </div>
                  <div class="cm-param-row">
                    <span class="cm-param-label">Grade de Coordenadas:</span>
                    <input type="checkbox" id="prop-map-grid" ${selectedItem.showGrid ? 'checked' : ''} />
                  </div>
                ` : ''}

                ${selectedItem.type === 'north_arrow' ? `
                  <div class="cm-param-row">
                    <span class="cm-param-label">Estilo da Seta:</span>
                    <select id="prop-arrow-style" class="cm-native-select" style="width: 110px;">
                      <option value="classic" ${selectedItem.arrowStyle === 'classic' ? 'selected' : ''}>Cartográfica</option>
                      <option value="compass" ${selectedItem.arrowStyle === 'compass' ? 'selected' : ''}>Bússola</option>
                      <option value="modern" ${selectedItem.arrowStyle === 'modern' ? 'selected' : ''}>Moderna</option>
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

                ${selectedItem.type === 'title_block' ? `
                  <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                    <span class="cm-param-label">Título da Prancha:</span>
                    <input type="text" id="prop-tb-header" class="cm-vertex-input" value="${selectedItem.properties?.headerTitle || ''}" />
                    <span class="cm-param-label">Nome do Projeto:</span>
                    <input type="text" id="prop-tb-proj" class="cm-vertex-input" value="${selectedItem.properties?.projectName || ''}" />
                    <span class="cm-param-label">Responsável Técnico:</span>
                    <input type="text" id="prop-tb-author" class="cm-vertex-input" value="${selectedItem.properties?.author || ''}" />
                    <span class="cm-param-label">ART / CREA:</span>
                    <input type="text" id="prop-tb-art" class="cm-vertex-input" value="${selectedItem.properties?.art || ''}" />
                    <span class="cm-param-label">Sistema Geodésico / Projeção:</span>
                    <input type="text" id="prop-tb-datum" class="cm-vertex-input" value="${selectedItem.properties?.datum || ''}" />
                    <span class="cm-param-label">Texto de Escala:</span>
                    <input type="text" id="prop-tb-scale" class="cm-vertex-input" value="${selectedItem.properties?.scaleText || ''}" />
                    <span class="cm-param-label">Localização / UF:</span>
                    <input type="text" id="prop-tb-loc" class="cm-vertex-input" value="${selectedItem.properties?.location || ''}" />
                    <span class="cm-param-label">Data da Planta:</span>
                    <input type="text" id="prop-tb-date" class="cm-vertex-input" value="${selectedItem.properties?.date || ''}" />
                  </div>
                ` : ''}
              </div>
            </details>
          ` : '<div style="font-size: 10.5px; color: var(--cm-text-muted); text-align: center; padding: 20px 0;">Clique em um elemento para editar suas propriedades.</div>'}
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
    return '📦';
  }

  static bindEvents(composer) {
    const paperSelect = document.getElementById('print-paper-size-select');
    if (paperSelect) {
      paperSelect.addEventListener('change', (e) => composer.setPaperSize(e.target.value));
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

    const updateCurrent = (mutator, shouldUpdateMap = false) => {
      const it = composer.items.find(i => i.id === composer.selectedItemId);
      if (it) {
        mutator(it);
        if (shouldUpdateMap && (it.type === 'map' || it.type === 'inset_map')) {
          composer.applyMapScaleAndRotation(it);
        } else if (it.type === 'title_block') {
          const container = document.querySelector(`[data-item-id="${it.id}"]`);
          if (container) {
            const tbEl = container.querySelector('.cm-item-title-block');
            if (tbEl) tbEl.outerHTML = PrintItemsManager.renderTitleBlock(it, composer.projectName);
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
          composer.updateCanvas();
        }
      }
    };

    const propX = document.getElementById('prop-item-x');
    const propY = document.getElementById('prop-item-y');
    const propW = document.getElementById('prop-item-w');
    const propH = document.getElementById('prop-item-h');
    const propScale = document.getElementById('prop-map-scale');
    const propMapRot = document.getElementById('prop-map-rot');
    const propGrid = document.getElementById('prop-map-grid');
    const propArrow = document.getElementById('prop-arrow-style');
    const propArrowRot = document.getElementById('prop-arrow-rot');
    const propArrowRotRange = document.getElementById('prop-arrow-rot-range');

    const propTbHeader = document.getElementById('prop-tb-header');
    const propTbProj = document.getElementById('prop-tb-proj');
    const propTbAuthor = document.getElementById('prop-tb-author');
    const propTbArt = document.getElementById('prop-tb-art');
    const propTbDatum = document.getElementById('prop-tb-datum');
    const propTbScale = document.getElementById('prop-tb-scale');
    const propTbLoc = document.getElementById('prop-tb-loc');
    const propTbDate = document.getElementById('prop-tb-date');

    if (propX) propX.addEventListener('change', (e) => updateCurrent(it => it.x = parseFloat(e.target.value) || 0));
    if (propY) propY.addEventListener('change', (e) => updateCurrent(it => it.y = parseFloat(e.target.value) || 0));
    if (propW) propW.addEventListener('change', (e) => updateCurrent(it => it.width = Math.max(10, parseFloat(e.target.value) || 10)));
    if (propH) propH.addEventListener('change', (e) => updateCurrent(it => it.height = Math.max(10, parseFloat(e.target.value) || 10)));
    if (propScale) propScale.addEventListener('change', (e) => updateCurrent(it => it.scale = Math.max(100, parseFloat(e.target.value) || 10000), true));
    if (propMapRot) propMapRot.addEventListener('change', (e) => updateCurrent(it => it.rotation = parseFloat(e.target.value) || 0, true));
    if (propGrid) propGrid.addEventListener('change', (e) => updateCurrent(it => it.showGrid = e.target.checked));
    if (propArrow) propArrow.addEventListener('change', (e) => updateCurrent(it => it.arrowStyle = e.target.value));

    const syncArrowRot = (val) => {
      const rot = parseFloat(val) || 0;
      if (propArrowRot) propArrowRot.value = rot;
      if (propArrowRotRange) propArrowRotRange.value = rot;
      updateCurrent(it => it.rotation = rot);
    };

    if (propArrowRot) propArrowRot.addEventListener('input', (e) => syncArrowRot(e.target.value));
    if (propArrowRotRange) propArrowRotRange.addEventListener('input', (e) => syncArrowRot(e.target.value));

    // Carimbo
    const updateTbProp = (key, val) => updateCurrent(it => { it.properties = it.properties || {}; it.properties[key] = val; });
    if (propTbHeader) propTbHeader.addEventListener('input', (e) => updateTbProp('headerTitle', e.target.value));
    if (propTbProj) propTbProj.addEventListener('input', (e) => updateTbProp('projectName', e.target.value));
    if (propTbAuthor) propTbAuthor.addEventListener('input', (e) => updateTbProp('author', e.target.value));
    if (propTbArt) propTbArt.addEventListener('input', (e) => updateTbProp('art', e.target.value));
    if (propTbDatum) propTbDatum.addEventListener('input', (e) => updateTbProp('datum', e.target.value));
    if (propTbScale) propTbScale.addEventListener('input', (e) => updateTbProp('scaleText', e.target.value));
    if (propTbLoc) propTbLoc.addEventListener('input', (e) => updateTbProp('location', e.target.value));
    if (propTbDate) propTbDate.addEventListener('input', (e) => updateTbProp('date', e.target.value));
  }
}
