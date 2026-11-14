import { PrintItemsManager } from './PrintItemsManager.js';
import { PrintAlignmentHelper } from './PrintAlignmentHelper.js';
import { PrintShortcuts } from './PrintShortcuts.js';
import { PrintImageUtils } from './PrintImageUtils.js';
import { UIToast } from '@thibezer/ui-components-kit';
import { PrintViewResolver } from './PrintViewResolver.js';
import { PrintItemFields } from './PrintItemFields.js';
import { ppIcon, itemTypeIcon } from './PrintIcons.js';

export class PrintPropertiesPanel {
  static render(composer) {
    const selectedItem = composer.items.find(it => it.id === composer.selectedItemId);
    const esc = PrintItemsManager.escapeHtml;
    // Seção aberta ou fechada pelo usuário, lembrada pelo nome (não pela posição)
    const tab = this.TABS.some(t => t[0] === composer.panelTab) ? composer.panelTab : 'item';
    const openAttr = (key) => (composer.panelSections?.[key] === false ? '' : 'open');

    return `
      <div class="cm-print-props-panel">
        <div class="cm-pp-header">
          <div class="cm-pp-header-title">
            <span class="cm-pp-title-ico">${ppIcon('settings')}PROPRIEDADES</span>
            <span class="cm-pp-header-paper">${esc(composer.paperSize.name)}</span>
          </div>
          <button type="button" class="cm-pp-collapse-btn" id="btn-collapse-props-panel" ${PrintShortcuts.attrs('propertiesPanel', 'Recolher painel')} aria-label="Recolher painel">${ppIcon('collapse')}</button>
        </div>

        <div class="cm-pp-tabs" role="tablist" aria-label="Seções do painel">
          ${this.TABS.map(([id, label, icon]) => `
            <button type="button" role="tab" class="cm-pp-tab ${tab === id ? 'is-active' : ''}" data-pp-tab="${id}" aria-selected="${tab === id ? 'true' : 'false'}" title="${label}">${ppIcon(icon)}<span>${label}</span></button>
          `).join('')}
        </div>

        <div class="cm-print-props-scroll">
          <!-- Aba Folha: papel, margens, moldura e pré-definições do projeto -->
          <div class="cm-pp-pane" data-pp-pane="paper" ${tab === 'paper' ? '' : 'hidden'}>
          ${this.renderPaperSection(composer, openAttr)}
          </div>

          <!-- Aba Elementos: árvore da composição -->
          <div class="cm-pp-pane" data-pp-pane="items" ${tab === 'items' ? '' : 'hidden'}>
          <details class="cm-inspector-accordion" data-section="items" ${openAttr('items')}>
            <summary class="cm-pp-summary">${ppIcon('layers')}Elementos da Prancha (${composer.items.length})</summary>
            <div class="cm-pp-body cm-pp-body--list">
              <input type="search" class="cm-pp-items-search" id="cm-pp-items-search" placeholder="Filtrar elementos…" aria-label="Filtrar elementos" value="${esc(composer.itemsFilter || '')}" autocomplete="off">
              <div class="cm-pp-items-hint">Topo da lista = frente da prancha. Arraste para reordenar (Alt+↑/↓ no teclado); duplo clique renomeia.</div>
              ${[...composer.items].reverse().map((it) => {
                // Sem `visible` gravado o item aparece (mesma regra da prancha e do exportador)
                const shown = it.visible !== false;
                const selected = composer.selectedItemIds ? composer.selectedItemIds.has(it.id) : (it.id === composer.selectedItemId);
                const name = esc(it.name || 'Item');
                const typeLabel = this.ITEM_TYPE_LABELS[it.type] || it.type || '';
                const q = String(composer.itemsFilter || '').trim().toLowerCase();
                const matches = !q || `${it.name || ''} ${typeLabel}`.toLowerCase().includes(q);
                return `
                <div class="cm-ai-row cm-pp-item-row ${selected ? 'is-selected' : ''} ${shown ? '' : 'is-hidden'}" data-composer-item-id="${esc(it.id)}" draggable="true" ${matches ? '' : 'hidden'}>
                  <span class="cm-pp-item-grip" aria-hidden="true" title="Arraste para reordenar">⋮⋮</span>
                  <button type="button" class="cm-pp-item-main" data-composer-select="${esc(it.id)}" ${selected ? 'aria-current="true"' : ''} title="${shown ? name : `${name} (oculto)`}">
                    <span class="cm-pp-item-icon" aria-hidden="true">${this.getItemIcon(it.type)}</span>
                    <span class="cm-pp-item-name">${name}</span>
                    <span class="cm-pp-item-type">${esc(typeLabel)}</span>
                  </button>
                  <div class="cm-pp-item-actions">
                    <button type="button" class="cm-ai-micro-btn cm-pp-item-btn ${it.locked ? '' : 'is-off'}" data-composer-lock="${esc(it.id)}" aria-pressed="${it.locked ? 'true' : 'false'}" aria-label="Bloquear ${name}" title="${it.locked ? 'Desbloquear' : 'Bloquear'}">${ppIcon(it.locked ? 'lock' : 'unlock')}</button>
                    <button type="button" class="cm-ai-micro-btn cm-pp-item-btn ${shown ? '' : 'is-off'}" data-composer-vis="${esc(it.id)}" aria-pressed="${shown ? 'false' : 'true'}" aria-label="Ocultar ${name}" title="${shown ? 'Ocultar' : 'Exibir'}">${ppIcon(shown ? 'eye' : 'eyeOff')}</button>
                    <button type="button" class="cm-ai-micro-btn cm-pp-item-btn" data-composer-del="${esc(it.id)}" aria-label="Excluir ${name}" title="${it.locked ? 'Desbloqueie para excluir' : 'Excluir (Ctrl+Z desfaz)'}" ${it.locked ? 'disabled' : ''}>${ppIcon('trash')}</button>
                  </div>
                </div>
              `;
              }).join('')}
            </div>
          </details>
          </div>

          <!-- Aba Atlas (automação em lote estilo QGIS) -->
          <div class="cm-pp-pane" data-pp-pane="atlas" ${tab === 'atlas' ? '' : 'hidden'}>
          ${this.renderAtlasSection(composer, openAttr)}
          </div>

          <!-- Aba Item: elemento selecionado ou seleção múltipla -->
          <div class="cm-pp-pane" data-pp-pane="item" ${tab === 'item' ? '' : 'hidden'}>
          ${composer.selectedGuide ? this.renderGuideSection(composer) : (composer.selectedItemIds && composer.selectedItemIds.size > 1) ? `
            <details class="cm-inspector-accordion" data-section="item" ${openAttr('item')}>
              <summary class="cm-pp-summary cm-pp-summary--active">${ppIcon('target')}${composer.selectedItemIds.size} Itens Selecionados</summary>
              <fieldset class="cm-print-props-fields">
                <div class="cm-pp-toolbox">
                  <div class="cm-pp-toolbox-title">Alinhar itens entre si</div>
                  <div class="cm-pp-btn-row">
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-align-btn" id="btn-prop-align-left" title="Alinhar à Esquerda" aria-label="Alinhar à Esquerda">${ppIcon('alignLeft')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-align-btn" id="btn-prop-align-center-h" title="Centralizar Horizontalmente" aria-label="Centralizar Horizontalmente">${ppIcon('alignCenterH')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-align-btn" id="btn-prop-align-right" title="Alinhar à Direita" aria-label="Alinhar à Direita">${ppIcon('alignRight')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-align-btn" id="btn-prop-align-top" title="Alinhar ao Topo" aria-label="Alinhar ao Topo">${ppIcon('alignTop')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-align-btn" id="btn-prop-align-center-v" title="Centralizar Verticalmente" aria-label="Centralizar Verticalmente">${ppIcon('alignCenterV')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-align-btn" id="btn-prop-align-bottom" title="Alinhar à Base" aria-label="Alinhar à Base">${ppIcon('alignBottom')}</ui-botao-primario>
                  </div>
                  <div class="cm-pp-btn-row">
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-distribute-h" title="Distribuir Horizontalmente (Espaçamento Uniforme)" aria-label="Distribuir Horizontalmente"><span class="cm-pp-btn-lbl">${ppIcon('distributeH')}<span>Dist. H</span></span></ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-distribute-v" title="Distribuir Verticalmente (Espaçamento Uniforme)" aria-label="Distribuir Verticalmente"><span class="cm-pp-btn-lbl">${ppIcon('distributeV')}<span>Dist. V</span></span></ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-duplicate" title="Duplicar Itens (Ctrl+D)"><span class="cm-pp-btn-lbl">${ppIcon('copy')}<span>Duplicar</span></span></ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-delete-multi" title="Excluir Itens (Delete)"><span class="cm-pp-btn-lbl">${ppIcon('trash')}<span>Excluir</span></span></ui-botao-primario>
                  </div>
                  <div class="cm-pp-btn-row">
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-match-w" title="Igualar Largura pelo 1º item"><span class="cm-pp-btn-lbl">${ppIcon('matchW')}<span>Larg.</span></span></ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-match-h" title="Igualar Altura pelo 1º item"><span class="cm-pp-btn-lbl">${ppIcon('matchH')}<span>Alt.</span></span></ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-pack-v" title="Empilhar Verticalmente"><span class="cm-pp-btn-lbl">${ppIcon('packV')}<span>Emp. V</span></span></ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-pack-h" title="Empilhar Horizontalmente"><span class="cm-pp-btn-lbl">${ppIcon('packH')}<span>Emp. H</span></span></ui-botao-primario>
                    ${composer.copiedStyle ? `<ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-paste-style" title="Colar Estilo Copiado"><span class="cm-pp-btn-lbl">${ppIcon('brush')}<span>Estilo</span></span></ui-botao-primario>` : ''}
                  </div>
                </div>
                ${this.renderItemSection()}
              </fieldset>
            </details>
          ` : selectedItem ? `
            <details class="cm-inspector-accordion" data-section="item" ${openAttr('item')}>
              <summary class="cm-pp-summary cm-pp-summary--active">${ppIcon('target')}${esc(selectedItem.name)}</summary>
              ${selectedItem.locked ? `
                <div class="cm-print-props-locked-note">${ppIcon('lock')}Item bloqueado: desbloqueie na lista acima para editar.</div>
              ` : ''}
              ${selectedItem.visible === false ? `
                <div class="cm-print-props-hidden-note">Item oculto: não aparece na prancha nem na exportação.</div>
              ` : ''}
              <fieldset class="cm-print-props-fields" ${selectedItem.locked ? 'disabled' : ''}>
                <!-- Barra de Ações Rápidas e Alinhamento -->
                <div class="cm-pp-toolbox">
                  <div class="cm-pp-toolbox-title">Alinhar na folha</div>
                  <div class="cm-pp-btn-row">
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-align-btn" id="btn-prop-align-left" title="Alinhar à Esquerda" aria-label="Alinhar à Esquerda">${ppIcon('alignLeft')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-align-btn" id="btn-prop-align-center-h" title="Centralizar Horizontalmente" aria-label="Centralizar Horizontalmente">${ppIcon('alignCenterH')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-align-btn" id="btn-prop-align-right" title="Alinhar à Direita" aria-label="Alinhar à Direita">${ppIcon('alignRight')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-align-btn" id="btn-prop-align-top" title="Alinhar ao Topo" aria-label="Alinhar ao Topo">${ppIcon('alignTop')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-align-btn" id="btn-prop-align-center-v" title="Centralizar Verticalmente" aria-label="Centralizar Verticalmente">${ppIcon('alignCenterV')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-align-btn" id="btn-prop-align-bottom" title="Alinhar à Base" aria-label="Alinhar à Base">${ppIcon('alignBottom')}</ui-botao-primario>
                  </div>
                  <div class="cm-pp-btn-row">
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-duplicate" title="Duplicar Item (Ctrl+D)"><span class="cm-pp-btn-lbl">${ppIcon('copy')}<span>Duplicar</span></span></ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-fit-margins" title="Ajustar às Margens da Folha" aria-label="Ajustar às Margens">${ppIcon('fitMargins')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-copy-style" title="Copiar Estilo Visual" aria-label="Copiar Estilo">${ppIcon('brush')}</ui-botao-primario>
                    ${composer.copiedStyle ? `<ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-paste-style" title="Aplicar Estilo Copiado"><span class="cm-pp-btn-lbl">Colar</span></ui-botao-primario>` : ''}
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-bring-forward" title="Avançar 1 Nível" aria-label="Avançar 1 Nível">${ppIcon('forward')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-send-backward" title="Recuar 1 Nível" aria-label="Recuar 1 Nível">${ppIcon('backward')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-bring-front" title="Trazer para Frente" aria-label="Trazer para Frente">${ppIcon('front')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-send-back" title="Enviar para Trás" aria-label="Enviar para Trás">${ppIcon('back')}</ui-botao-primario>
                  </div>
                </div>

                <!-- Nome, posição e tamanho: painel de propriedades do kit -->
                ${this.renderItemSection()}

                ${this.renderLegacyFields(selectedItem, composer)}
              </fieldset>
            </details>
          ` : '<div class="cm-pp-empty">Selecione um elemento para editar.</div>'}
          </div>
        </div>
      </div>
    `;
  }

  /** Propriedades da guia selecionada: posição, trava e exclusão */
  static renderGuideSection(composer) {
    const g = composer.selectedGuide;
    const isX = g.axis === 'x';
    const locked = Boolean(composer.guidesLocked);
    const limit = isX ? composer.paperSize.width : composer.paperSize.height;
    return `
      <details class="cm-inspector-accordion" data-section="guide" open>
        <summary class="cm-pp-summary cm-pp-summary--active">${ppIcon('target')}Guia ${isX ? 'vertical' : 'horizontal'}</summary>
        <fieldset class="cm-print-props-fields">
          <div class="cm-pp-stack cm-pp-stack--tight">
            <span class="cm-param-label">Posição ${isX ? 'X' : 'Y'} (mm):</span>
            <ui-campo-texto type="number" tamanho="sm" id="prop-guide-pos" class="cm-vertex-input cm-pp-full" min="0" max="${limit}" step="0.5" value="${g.val}" ${locked ? 'disabled' : ''}></ui-campo-texto>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Travar guias:</span>
            <ui-checkbox id="prop-guides-locked" ${locked ? 'checked' : ''}></ui-checkbox>
          </div>
          <ui-botao-primario inline variante="secundario" tamanho="sm" id="btn-prop-guide-delete" class="cm-pp-wide-btn" ${locked ? 'disabled' : ''}>${ppIcon('trash')}Excluir guia</ui-botao-primario>
        </fieldset>
      </details>
    `;
  }

  /** Nome do tipo de cada elemento, mostrado na lista de Elementos */
  static ITEM_TYPE_LABELS = {
    map: 'Mapa', inset_map: 'Localização', north_arrow: 'Norte', scale_bar: 'Escala', legend: 'Legenda',
    title_block: 'Selo', table_vertices: 'Vértices', text_block: 'Notas', shape: 'Moldura', image: 'Imagem', label: 'Título'
  };

  /** Ordenação, filtro e renomeação da lista de Elementos (lista exibida do topo/frente para o fundo) */
  static bindItemsList(composer) {
    const rows = [...document.querySelectorAll('.cm-pp-item-row[data-composer-item-id]')];
    if (!rows.length) return;

    const search = document.getElementById('cm-pp-items-search');
    if (search) {
      search.addEventListener('input', () => {
        composer.itemsFilter = search.value;
        const q = search.value.trim().toLowerCase();
        rows.forEach(row => {
          const it = composer.items.find(i => i.id === row.getAttribute('data-composer-item-id'));
          const label = this.ITEM_TYPE_LABELS[it?.type] || it?.type || '';
          row.hidden = Boolean(q) && !`${it?.name || ''} ${label}`.toLowerCase().includes(q);
        });
      });
    }

    // Arrastar para reordenar: soltar acima de uma linha = ficar na frente dela
    let dragId = null;
    const clearMarks = () => rows.forEach(r => r.classList.remove('drop-above', 'drop-below', 'is-dragging'));
    rows.forEach(row => {
      const id = row.getAttribute('data-composer-item-id');
      row.addEventListener('dragstart', (e) => {
        if (composer.readOnly || e.target.closest?.('input')) { e.preventDefault(); return; }
        dragId = id;
        row.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
      });
      row.addEventListener('dragover', (e) => {
        if (!dragId || dragId === id) return;
        e.preventDefault();
        const r = row.getBoundingClientRect();
        const above = e.clientY < r.top + r.height / 2;
        rows.forEach(x => x.classList.remove('drop-above', 'drop-below'));
        row.classList.add(above ? 'drop-above' : 'drop-below');
      });
      row.addEventListener('drop', (e) => {
        if (!dragId || dragId === id) return;
        e.preventDefault();
        const r = row.getBoundingClientRect();
        const above = e.clientY < r.top + r.height / 2;
        const moving = dragId;
        dragId = null;
        clearMarks();
        composer.moveItemRelative(moving, id, above ? 'above' : 'below');
      });
      row.addEventListener('dragend', () => { dragId = null; clearMarks(); });

      row.querySelector('.cm-pp-item-main')?.addEventListener('keydown', (e) => {
        if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
        e.preventDefault();
        composer.stepItemInStack(id, e.key === 'ArrowUp' ? 1 : -1);
      });

      // Duplo clique no nome: renomear na própria lista
      row.querySelector('.cm-pp-item-name')?.addEventListener('dblclick', (e) => {
        const it = composer.items.find(i => i.id === id);
        if (!it || it.locked || composer.readOnly) return;
        e.preventDefault();
        e.stopPropagation();
        const span = e.currentTarget;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'cm-pp-item-rename';
        input.value = it.name || '';
        row.draggable = false;
        span.replaceWith(input);
        input.focus();
        input.select();
        let done = false;
        const finish = (commit) => {
          if (done) return;
          done = true;
          composer.renameItem(id, commit ? input.value : null);
        };
        input.addEventListener('click', ev => ev.stopPropagation());
        input.addEventListener('keydown', (ev) => {
          ev.stopPropagation();
          if (ev.key === 'Enter') finish(true);
          else if (ev.key === 'Escape') finish(false);
        });
        input.addEventListener('blur', () => finish(true));
      });
    });
  }

  /** Abas do painel: [id, rótulo, ícone] */
  static TABS = [['item', 'Item', 'target'], ['items', 'Elementos', 'layers'], ['paper', 'Folha', 'sheet'], ['atlas', 'Atlas', 'book']];

  static PAPER_OPTIONS = [
    ['A4_L', 'A4 Paisagem'], ['A4_P', 'A4 Retrato'],
    ['A3_L', 'A3 Paisagem'], ['A3_P', 'A3 Retrato'],
    ['A2_L', 'A2 Paisagem'], ['A2_P', 'A2 Retrato'],
    ['A1_L', 'A1 Paisagem'], ['A1_P', 'A1 Retrato'],
    ['A0_L', 'A0 Paisagem'], ['A0_P', 'A0 Retrato'],
    ['CUSTOM', 'Personalizado']
  ];

  /** Categorias no contrato de `<ui-painel-propriedades>` para a aba Folha */
  static buildPaperCategories(composer) {
    const paper = composer.paperSize || { id: 'A4_L', name: 'A4 Paisagem', width: 297, height: 210 };
    const sizes = composer.paperSizes || {};
    const m = PrintItemsManager.sheetMargins(paper);
    const isAbnt = PrintItemsManager.isAbntMargins(paper);
    const isStandard = Boolean(sizes[paper.id]);
    const presets = composer.sheetsManager?.loadPresets?.() || [];
    const match = composer.sheetsManager?.findMatchingPreset?.(paper, composer.showAbntMargins) || null;
    const maxW = Math.max(0, Math.floor(paper.width / 2) - PrintItemsManager.MIN_ITEM_MM);
    const maxH = Math.max(0, Math.floor(paper.height / 2) - PrintItemsManager.MIN_ITEM_MM);
    const cfg = composer.guideGeneratorConfig || { rows: 0, rowGutter: 5, cols: 0, colGutter: 5, fitTo: 'margins', mode: 'grid', replace: true };
    const guideCount = (composer.manualGuides?.x?.length || 0) + (composer.manualGuides?.y?.length || 0);

    const paperOpcoes = this.PAPER_OPTIONS.map(([id, label]) => {
      if (id === 'CUSTOM') {
        return {
          id: 'CUSTOM',
          rotulo: !isStandard ? `Personalizado · ${paper.width}×${paper.height} mm` : 'Personalizado…'
        };
      }
      const sz = sizes[id];
      return { id, rotulo: sz ? `${label} · ${sz.width}×${sz.height}` : label };
    });

    const marginProps = [
      { id: 'margin_standard', rotulo: 'Padrão', tipo: 'readonly', valor: isAbnt ? 'ABNT' : 'Personalizada' },
      { id: 'margin_top', rotulo: 'Superior', tipo: 'numero', valor: m.top, unidade: 'mm', min: 0, max: maxH, passo: 0.5, casasDecimais: 1 },
      { id: 'margin_left', rotulo: 'Esquerda', tipo: 'numero', valor: m.left, unidade: 'mm', min: 0, max: maxW, passo: 0.5, casasDecimais: 1 },
      { id: 'margin_bottom', rotulo: 'Inferior', tipo: 'numero', valor: m.bottom, unidade: 'mm', min: 0, max: maxH, passo: 0.5, casasDecimais: 1 },
      { id: 'margin_right', rotulo: 'Direita', tipo: 'numero', valor: m.right, unidade: 'mm', min: 0, max: maxW, passo: 0.5, casasDecimais: 1 },
      { id: 'show_abnt_frame', rotulo: 'Moldura nas margens', tipo: 'booleano', valor: composer.showAbntMargins !== false }
    ];
    if (!isAbnt) {
      marginProps.push({ id: 'reset_margins_abnt', rotulo: 'Margem ABNT', tipo: 'acao', valor: null, rotuloAcao: '↺ Voltar à ABNT' });
    }
    marginProps.push({
      id: 'reset_default_layout',
      rotulo: 'Elementos',
      tipo: 'acao',
      valor: null,
      rotuloAcao: 'Layout padrão',
      dica: 'Volta às margens ABNT e ao layout padrão dos elementos (Ctrl+Z desfaz)'
    });

    const presetProps = [
      {
        id: 'preset_select',
        rotulo: 'Aplicar salva',
        tipo: 'selecao',
        valor: match ? match.id : '',
        opcoes: [
          { id: '', rotulo: presets.length ? 'Pré-definições…' : 'Nenhuma pré-definição' },
          ...presets.map(p => ({ id: p.id, rotulo: p.name }))
        ]
      },
      { id: 'preset_save', rotulo: 'Salvar atual', tipo: 'acao', valor: null, rotuloAcao: 'Salvar pré-definição…' }
    ];
    if (match) {
      presetProps.push({ id: 'preset_delete', rotulo: 'Excluir salva', tipo: 'acao', valor: null, rotuloAcao: `Excluir "${match.name}"` });
    }

    return [
      {
        id: 'formato',
        titulo: 'Formato e Dimensões',
        aberto: true,
        propriedades: [
          { id: 'paper_size', rotulo: 'Formato', tipo: 'selecao', valor: isStandard ? paper.id : 'CUSTOM', opcoes: paperOpcoes },
          {
            id: 'paper_orientation',
            rotulo: 'Orientação',
            tipo: 'selecao',
            valor: paper.width >= paper.height ? 'landscape' : 'portrait',
            opcoes: [{ id: 'landscape', rotulo: 'Paisagem' }, { id: 'portrait', rotulo: 'Retrato' }]
          },
          { id: 'paper_width', rotulo: 'Largura', tipo: 'numero', valor: paper.width, unidade: 'mm', min: 50, max: 5000, passo: 1, casasDecimais: 1, dica: 'Largura da folha (aceita expressões)' },
          { id: 'paper_height', rotulo: 'Altura', tipo: 'numero', valor: paper.height, unidade: 'mm', min: 50, max: 5000, passo: 1, casasDecimais: 1, dica: 'Altura da folha (aceita expressões)' }
        ]
      },
      {
        id: 'margens',
        titulo: 'Margens e Moldura',
        aberto: true,
        propriedades: marginProps
      },
      {
        id: 'guias',
        titulo: 'Criar Guias (Estilo InDesign)',
        aberto: true,
        propriedades: [
          { id: 'guides_rows', rotulo: 'Linhas (Horiz.)', tipo: 'numero', valor: cfg.rows ?? 0, min: 0, max: 50, passo: 1, casasDecimais: 0, dica: 'Quantidade de linhas horizontais' },
          { id: 'guides_row_gutter', rotulo: 'Espaçamento L.', tipo: 'numero', valor: cfg.rowGutter ?? 5, unidade: 'mm', min: 0, max: 500, passo: 0.5, casasDecimais: 1, dica: 'Calha entre linhas (ou passo fixo)' },
          { id: 'guides_cols', rotulo: 'Colunas (Vert.)', tipo: 'numero', valor: cfg.cols ?? 0, min: 0, max: 50, passo: 1, casasDecimais: 0, dica: 'Quantidade de colunas verticais' },
          { id: 'guides_col_gutter', rotulo: 'Espaçamento C.', tipo: 'numero', valor: cfg.colGutter ?? 5, unidade: 'mm', min: 0, max: 500, passo: 0.5, casasDecimais: 1, dica: 'Calha entre colunas (ou passo fixo)' },
          {
            id: 'guides_fit',
            rotulo: 'Ajustar às',
            tipo: 'selecao',
            valor: cfg.fitTo === 'page' ? 'page' : 'margins',
            opcoes: [{ id: 'margins', rotulo: 'Margens' }, { id: 'page', rotulo: 'Página inteira' }]
          },
          {
            id: 'guides_mode',
            rotulo: 'Distribuição',
            tipo: 'selecao',
            valor: cfg.mode === 'step' ? 'step' : 'grid',
            opcoes: [{ id: 'grid', rotulo: 'Dividir área (InDesign)' }, { id: 'step', rotulo: 'Passo fixo (mm)' }]
          },
          { id: 'guides_replace', rotulo: 'Substituir guias', tipo: 'booleano', valor: cfg.replace !== false },
          { id: 'guides_locked', rotulo: 'Travar guias', tipo: 'booleano', valor: Boolean(composer.guidesLocked), dica: 'Impede mover, criar ou excluir guias' },
          { id: 'guides_apply', rotulo: 'Grade', tipo: 'acao', valor: null, rotuloAcao: 'Aplicar guias' },
          { id: 'guides_clear', rotulo: 'Limpeza', tipo: 'acao', valor: null, rotuloAcao: `Limpar guias (${guideCount})` }
        ]
      },
      {
        id: 'presets',
        titulo: 'Pré-definições da Folha',
        aberto: presets.length > 0,
        propriedades: presetProps
      }
    ];
  }

  /** Seção da folha com `<ui-painel-propriedades>` do kit (papel, dimensões, margens e guias InDesign) */
  static renderPaperSection(composer) {
    const esc = PrintItemsManager.escapeHtml;
    const paper = composer.paperSize || { id: 'A4_L', width: 297, height: 210 };
    const isAbnt = PrintItemsManager.isAbntMargins(paper);

    return `
      <ui-painel-propriedades
        id="print-paper-props-panel"
        class="cm-pp-kit-panel"
        titulo="Configuração da Folha"
        filtro
        densidade="compacta"
        modo-aplicar="imediato"
        largura-rotulo="46"
        storage-key="cm_print_paper_props"
        data-paper-id="${esc(paper.id)}"
        data-margins-abnt="${isAbnt ? 'true' : 'false'}"
      ></ui-painel-propriedades>
    `;
  }

  /** Ids do painel de Item do kit → campo da geometria do item */
  static ITEM_GEOMETRY_KEYS = { item_x: 'x', item_y: 'y', item_w: 'width', item_h: 'height' };

  /** Valor que o kit usa para "Varia" (Symbol.for: a mesma identidade em qualquer cópia do pacote) */
  static MIXED_VALUE = Symbol.for('ui-tabela-propriedades:misto');

  /**
   * Categorias do painel de Item (contrato do kit): nome, posição e tamanho, travar proporção e os
   * campos do tipo (`PrintItemFields`).
   * Seleção múltipla mostra só posição e tamanho; medida diferente entre os itens vira "Varia".
   * Item bloqueado fica somente leitura.
   */
  static buildItemCategories(composer) {
    const multi = Boolean(composer.selectedItemIds && composer.selectedItemIds.size > 1);
    const items = multi
      ? composer.items.filter(it => composer.selectedItemIds.has(it.id))
      : composer.items.filter(it => it.id === composer.selectedItemId);
    if (!items.length) return [];
    const paper = composer.paperSize;
    const locked = !multi && Boolean(items[0].locked);
    const round1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
    const measure = (id, rotulo, key, max, min = 0) => {
      const vals = items.map(it => round1(it[key]));
      return {
        id, rotulo, tipo: 'numero', valor: vals[0], misto: vals.some(v => v !== vals[0]),
        unidade: 'mm', min, max, passo: 1, casasDecimais: 1, somenteLeitura: locked
      };
    };
    const geometry = [
      measure('item_x', 'Posição X', 'x', paper.width),
      measure('item_y', 'Posição Y', 'y', paper.height),
      measure('item_w', 'Largura', 'width', paper.width, PrintItemsManager.MIN_ITEM_MM),
      measure('item_h', 'Altura', 'height', paper.height, PrintItemsManager.MIN_ITEM_MM)
    ];
    if (multi) {
      return [{ id: 'item_posicao', titulo: 'Posição e tamanho', aberto: true, propriedades: geometry }];
    }
    return [
      {
        id: 'item_geral', titulo: 'Elemento', aberto: true,
        propriedades: [{ id: 'item_name', rotulo: 'Nome', tipo: 'texto', valor: items[0].name || '', somenteLeitura: locked }]
      },
      {
        id: 'item_posicao', titulo: 'Posição e tamanho', aberto: true,
        propriedades: [
          ...geometry,
          {
            id: 'item_lock_aspect', rotulo: 'Travar proporção', tipo: 'booleano', valor: Boolean(items[0].lockAspect),
            dica: 'Mantém a proporção ao redimensionar com as alças', somenteLeitura: locked
          }
        ]
      },
      ...PrintItemFields.categories(items[0], composer)
    ];
  }

  /** Painel de Item com `<ui-painel-propriedades>` do kit (nome, posição e tamanho) */
  static renderItemSection() {
    return `
      <ui-painel-propriedades
        id="print-item-props-panel"
        class="cm-pp-kit-panel cm-pp-kit-panel--inline"
        titulo="Elemento"
        densidade="compacta"
        modo-aplicar="imediato"
        largura-rotulo="46"
        storage-key="cm_print_item_props"
      ></ui-painel-propriedades>
    `;
  }

  /**
   * Atualiza o painel de Item sem recriá-lo. Estrutura igual (mesmas linhas, limites e bloqueio):
   * só os valores mudam, preservando foco e arrasto do kit; senão troca as categorias.
   */
  static syncItemSection(panelEl, composer) {
    if (!panelEl) return;
    const cats = this.buildItemCategories(composer);
    const sig = JSON.stringify(cats.map(c => [c.id, c.titulo, c.propriedades.map(p => [p.id, p.tipo, p.rotulo, p.rotuloAcao, p.min, p.max, p.somenteLeitura, p.opcoes && p.opcoes.map(o => o.id)])]));
    if (panelEl._itemSig === sig) {
      const values = {};
      cats.forEach(c => c.propriedades.forEach(p => { values[p.id] = p.misto ? this.MIXED_VALUE : p.valor; }));
      panelEl.valores = values;
      return;
    }
    panelEl._itemSig = sig;
    panelEl.categorias = cats;
  }

  /** Eventos do painel de Item (ligados uma vez por instância; `updateCurrent` grava e registra o histórico) */
  static bindItemPanel(composer, updateCurrent) {
    const panel = document.getElementById('print-item-props-panel');
    if (!panel) return;
    this.syncItemSection(panel, composer);
    if (panel.dataset.bound) return;
    panel.dataset.bound = '1';

    // Atalhos do layout não podem agir enquanto se digita no painel (Ctrl/Cmd passam: desfazer etc.)
    panel.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) e.stopPropagation();
    });

    panel.addEventListener('ui-propriedade-alterada', (e) => {
      const { id, valor } = e.detail || {};
      const key = this.ITEM_GEOMETRY_KEYS[id];
      if (key) {
        const v = Number(valor);
        if (composer.selectedItemIds && composer.selectedItemIds.size > 1) {
          // Seleção múltipla: o valor vale para todos os itens desbloqueados
          const targets = composer.items.filter(it => composer.selectedItemIds.has(it.id) && !it.locked);
          if (Number.isFinite(v) && targets.length) {
            targets.forEach(it => {
              it[key] = v;
              PrintItemsManager.clampItemToPaper(it, composer.paperSize);
              composer.updateItemPositionDOM(it);
              if (it.type === 'map' || it.type === 'inset_map') composer.applyMapScaleAndRotation(it);
              else composer.refreshItemContent(it);
            });
            composer.pushHistoryState('Editar Itens', { coalesceKey: `prop:multi:${key}` });
          }
        } else {
          // Valor digitado é limitado à folha e ao tamanho mínimo; o campo mostra o valor aplicado
          updateCurrent(it => {
            if (Number.isFinite(v)) it[key] = v;
            PrintItemsManager.clampItemToPaper(it, composer.paperSize);
          }, false, true, id);
        }
        this.syncItemSection(panel, composer);
      } else if (id === 'item_name') {
        const clean = String(valor || '').trim();
        if (clean) updateCurrent(it => { it.name = clean; }, false, false, id);
        composer.updatePropertiesPanel();
      } else if (id === 'item_lock_aspect') {
        updateCurrent(it => { it.lockAspect = Boolean(valor); }, false, false, id);
      } else {
        this.applyTypeField(panel, composer, updateCurrent, id, valor);
      }
    });

    panel.addEventListener('ui-acao-clique', (e) => {
      const item = composer.items.find(it => it.id === composer.selectedItemId);
      const entry = item && !item.locked ? PrintItemFields.find(item, composer, e.detail?.id) : null;
      entry?.run?.(composer, { updateCurrent, panel });
    });
  }

  /** Campo do tipo do elemento (`PrintItemFields`) alterado no painel */
  static applyTypeField(panel, composer, updateCurrent, id, valor) {
    const item = composer.items.find(it => it.id === composer.selectedItemId);
    const entry = item ? PrintItemFields.find(item, composer, id) : null;
    if (!entry || item.locked) return;
    if (entry.transient) {
      composer.panelTransient = { ...(composer.panelTransient || {}), [id]: valor };
      return;
    }
    if (entry.guard && !entry.guard(item, valor, composer)) {
      this.syncItemSection(panel, composer);
      return;
    }
    updateCurrent(it => entry.apply(it, valor, composer), Boolean(entry.map), false, id);
    if (entry.refresh === 'grid') composer.mapRefreshers?.get(composer.selectedItemId)?.();
    if (entry.rebuild) composer.updatePropertiesPanel();
    else this.syncItemSection(panel, composer);
  }

  /** Há um rótulo do painel da folha sendo arrastado (scrub numérico do kit)? */
  static isPaperScrubbing(panelEl) {
    return Boolean(panelEl?.shadowRoot?.querySelector?.('.ui-prop__col-rotulo--arrastando'));
  }

  /**
   * Atualiza categorias e atributos do `<ui-painel-propriedades>` da folha sem recriar o nó no DOM.
   */
  static syncPaperSection(panelEl, composerOrFresh) {
    if (!panelEl) return;
    const composer = composerOrFresh && 'paperSize' in composerOrFresh ? composerOrFresh : null;
    if (!composer) return;
    const corpo = panelEl.shadowRoot?.getElementById?.('corpo');
    const prevScroll = corpo ? corpo.scrollTop : 0;

    panelEl.dataset.paperId = composer.paperSize?.id || 'A4_L';
    panelEl.dataset.marginsAbnt = PrintItemsManager.isAbntMargins(composer.paperSize) ? 'true' : 'false';
    panelEl.categorias = this.buildPaperCategories(composer);

    if (panelEl.shadowRoot) {
      panelEl.shadowRoot.querySelectorAll('#btn-flutuante, #btn-colapsar-horizontal').forEach((btn) => {
        btn.style.display = 'none';
      });
    }
    if (corpo) corpo.scrollTop = prevScroll;
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

  /** Seção do Gerador de Atlas Cartográfico (Automação em Lote) */
  static renderAtlasSection(composer, openAttr) {
    const atlas = composer.atlas;
    const isEnabled = atlas?.enabled || false;
    const curLayerId = atlas?.layerId || '';
    const margin = atlas?.marginPct ?? 15;
    const layers = composer.layers || [];
    const esc = PrintItemsManager.escapeHtml;
    const count = atlas?.getCoverageFeatures?.()?.length || 0;

    return `
      <details class="cm-inspector-accordion" data-section="atlas" ${openAttr('atlas')}>
        <summary class="cm-pp-summary">${ppIcon('book')}Gerador de Atlas Cartográfico</summary>
        <fieldset class="cm-print-props-fields">
          <div class="cm-pp-field-row cm-pp-atlas-toggle-row">
            <span class="cm-param-label cm-pp-atlas-label">Ativar Atlas de Pranchas:</span>
            <ui-checkbox id="prop-atlas-enable" ${isEnabled ? 'checked' : ''}></ui-checkbox>
          </div>

          <div class="cm-pp-field-col cm-pp-atlas-field">
            <span class="cm-param-label">Camada de cobertura:</span>
            <ui-select id="prop-atlas-layer" class="cm-native-select cm-pp-full" tamanho="sm" value="${esc(curLayerId)}" ${!isEnabled ? 'disabled' : ''}>
              <option value="">(Selecione uma camada)</option>
              ${layers.map(l => `
                <option value="${esc(l.id)}" ${l.id === curLayerId ? 'selected' : ''}>${esc(l.name || l.id)}</option>
              `).join('')}
            </ui-select>
          </div>

          <div class="cm-pp-field-col cm-pp-atlas-field">
            <span class="cm-param-label">Margem de respiro (%):</span>
            <ui-campo-texto type="number" tamanho="sm" id="prop-atlas-margin" class="cm-vertex-input cm-pp-full" min="0" max="100" value="${margin}" ${!isEnabled ? 'disabled' : ''}></ui-campo-texto>
          </div>

          <div class="cm-pp-field-row">
            <span class="cm-param-label">Expressões dinâmicas nos textos</span>
            <button type="button" class="cm-pp-help-btn" data-pp-help="atlas-help" aria-expanded="${composer.helpOpen?.['atlas-help'] ? 'true' : 'false'}" aria-controls="pp-atlas-help" title="Ver expressões suportadas" aria-label="Ver expressões suportadas">?</button>
          </div>
          <div class="cm-pp-help-box cm-pp-atlas-help" id="pp-atlas-help" ${composer.helpOpen?.['atlas-help'] ? '' : 'hidden'}>
            <strong class="cm-pp-atlas-help-title">Expressões Dinâmicas Suportadas:</strong><br>
            <code>[% feature.name %]</code> ou <code>{nome}</code> - Nome da feição<br>
            <code>[% area_ha %]</code> - Área calculada em hectares<br>
            <code>[% area_m2 %]</code> - Área em m²<br>
            <code>[% scale %]</code> - Escala numérica atual<br>
            <code>[% date %]</code> - Data da prancha<br>
            <code>[% atlas.index %]</code> / <code>[% atlas.total %]</code> - Pág. atual e total
          </div>

          ${isEnabled ? `
            <div class="cm-pp-atlas-action">
              <ui-botao-primario inline tamanho="sm" id="btn-prop-export-atlas" class="cm-pp-full">
                ${ppIcon('sheet')}Exportar Caderno PDF (${count} pranchas)
              </ui-botao-primario>
            </div>
          ` : ''}
        </fieldset>
      </details>
    `;
  }

  /** Linha "Fonte" (rótulo, bloco de texto e legenda): mesma lista da prancha (PrintFonts) */
  /**
   * O que o painel de propriedades do kit ainda não cobre, em HTML: texto multilinha das notas,
   * seleção de arquivo da imagem e a lista de itens da legenda (marcador com a cor da camada).
   * Os demais campos de cada tipo vêm de `PrintItemFields`.
   */
  static renderLegacyFields(item, composer) {
    const esc = PrintItemsManager.escapeHtml;
    if (item.type === 'text_block') {
      return `
        <div class="cm-pp-stack cm-pp-section">
          <span class="cm-param-label">Texto das notas (duplo clique na folha edita direto):</span>
          <ui-area-texto id="prop-text-body" class="cm-vertex-input cm-pp-textarea" linhas="5" value="${esc(item.text || '')}">${esc(item.text || '')}</ui-area-texto>
        </div>
      `;
    }
    if (item.type === 'image') {
      return `
        <div class="cm-pp-stack cm-pp-section">
          <span class="cm-param-label">Carregar imagem / logotipo:</span>
          <input type="file" id="prop-image-file" accept="image/*" class="cm-vertex-input cm-pp-file" />
        </div>
      `;
    }
    if (item.type === 'legend') {
      const hidden = new Set((item.hiddenLayerIds || []).map(String));
      const mapItem = PrintItemsManager.legendMapItem(item, composer.items || []);
      const candidates = mapItem
        ? PrintViewResolver.legendEntries(PrintViewResolver.effectiveView(mapItem, composer.library), {
          features: composer.features || [], layers: composer.layers || [], library: composer.library, scale: mapItem.scale
        })
        : [];
      return `
        <div class="cm-pp-stack cm-pp-section">
          <span class="cm-param-label">Itens exibidos (do que aparece no mapa):</span>
          <div class="cm-pp-layer-list">
            ${candidates.map(e => `
              <label class="cm-param-row cm-pp-layer-row" for="prop-legend-layer-${esc(e.id)}">
                <ui-checkbox id="prop-legend-layer-${esc(e.id)}" data-legend-layer="${esc(e.id)}" ${hidden.has(String(e.id)) ? '' : 'checked'}></ui-checkbox>
                <span class="cm-pp-swatch" style="background: ${PrintItemsManager.sanitizeColor(e.graphics.fill.color !== 'none' ? e.graphics.fill.color : e.graphics.stroke.color, '#00E08A')};"></span>
                <span class="cm-pp-layer-name">${e.isFilter ? 'Filtro: ' : ''}${esc(e.name)}</span>
              </label>
            `).join('') || '<span class="cm-pp-hint">Nada aparece no mapa vinculado.</span>'}
          </div>
        </div>
      `;
    }
    return '';
  }

  static getItemIcon(type) {
    return itemTypeIcon(type);
  }

  /** Eventos do `<ui-painel-propriedades>` da folha (ligados uma única vez) */
  static bindPaperEvents(composer) {
    const panel = document.getElementById('print-paper-props-panel');
    if (!panel) return;

    this.syncPaperSection(panel, composer);
    if (panel.dataset.bound) return;
    panel.dataset.bound = '1';

    panel.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) e.stopPropagation();
    });

    panel.addEventListener('ui-propriedade-alterada', (e) => {
      const { id, valor } = e.detail || {};
      switch (id) {
        case 'paper_size':
          composer.setPaperSize(valor);
          break;
        case 'paper_orientation':
          composer.setPaperOrientation(valor);
          break;
        case 'paper_width':
          composer.setCustomPaperDimensions(valor, composer.paperSize.height);
          break;
        case 'paper_height':
          composer.setCustomPaperDimensions(composer.paperSize.width, valor);
          break;
        case 'margin_top':
          composer.setMargins({ top: Number(valor) });
          break;
        case 'margin_left':
          composer.setMargins({ left: Number(valor) });
          break;
        case 'margin_bottom':
          composer.setMargins({ bottom: Number(valor) });
          break;
        case 'margin_right':
          composer.setMargins({ right: Number(valor) });
          break;
        case 'show_abnt_frame':
          composer.setAbntMargins(Boolean(valor));
          break;
        case 'guides_rows':
        case 'guides_cols': {
          const key = id === 'guides_rows' ? 'rows' : 'cols';
          const count = Math.max(0, Math.min(50, Math.round(Number(valor) || 0)));
          if (composer.guideGeneratorConfig?.replace === false) {
            composer.guideGeneratorConfig = { ...composer.guideGeneratorConfig, [key]: count };
          } else {
            composer.applyGridGuides({ [key]: count });
          }
          break;
        }
        case 'guides_row_gutter':
        case 'guides_col_gutter':
        case 'guides_fit':
        case 'guides_mode': {
          const map = {
            guides_row_gutter: { rowGutter: Number(valor) || 0 },
            guides_col_gutter: { colGutter: Number(valor) || 0 },
            guides_fit: { fitTo: valor },
            guides_mode: { mode: valor }
          };
          composer.guideGeneratorConfig = { ...(composer.guideGeneratorConfig || {}), ...map[id] };
          // Em "somar às guias" a edição ao vivo acumularia guias a cada ajuste: só o botão "Aplicar guias" gera
          const cfg = composer.guideGeneratorConfig;
          if (cfg.replace !== false && ((cfg.rows || 0) > 0 || (cfg.cols || 0) > 0)) {
            composer.applyGridGuides(map[id]);
          }
          break;
        }
        case 'guides_replace':
          composer.guideGeneratorConfig = { ...(composer.guideGeneratorConfig || {}), replace: Boolean(valor) };
          break;
        case 'guides_locked':
          composer.setGuidesLocked(Boolean(valor));
          break;
        case 'preset_select':
          if (valor) composer.applyPagePreset(valor);
          break;
      }
    });

    panel.addEventListener('ui-acao-clique', (e) => {
      const { id } = e.detail || {};
      if (id === 'reset_margins_abnt') composer.setMargins(null);
      else if (id === 'reset_default_layout') composer.resetDefaultLayout();
      else if (id === 'guides_apply') composer.applyGridGuides({}, { announce: true });
      else if (id === 'guides_clear') composer.clearManualGuides();
      else if (id === 'preset_save') composer.savePagePreset();
      else if (id === 'preset_delete') {
        const match = composer.sheetsManager?.findMatchingPreset?.(composer.paperSize, composer.showAbntMargins);
        if (match) composer.deletePagePreset(match.id);
      }
    });
  }

  static bindEvents(composer) {
    // Lembra quais seções o usuário abriu ou fechou, pelo nome (sobrevive à reconstrução do painel)
    composer.panelSections = composer.panelSections || {};
    document.querySelectorAll('#cm-print-props-panel-mount details[data-section]').forEach(d => {
      if (d.dataset.bound) return;
      d.addEventListener('toggle', () => { composer.panelSections[d.dataset.section] = d.open; });
    });

    this.bindPaperEvents(composer);

    // Abas: só alterna a visibilidade, sem reconstruir o painel
    const tabsMount = document.querySelectorAll('#cm-print-props-panel-mount [data-pp-tab]');
    tabsMount.forEach(btn => {
      btn.addEventListener('click', () => {
        composer.panelTab = btn.dataset.ppTab;
        tabsMount.forEach(b => {
          const on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        document.querySelectorAll('#cm-print-props-panel-mount [data-pp-pane]').forEach(p => { p.hidden = p.dataset.ppPane !== composer.panelTab; });
      });
    });

    // "?" do Atlas: mostra/oculta a ajuda e lembra o estado
    document.querySelectorAll('#cm-print-props-panel-mount [data-pp-help]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.ppHelp;
        const box = document.getElementById(`pp-${key}`);
        if (!box) return;
        box.hidden = !box.hidden;
        btn.setAttribute('aria-expanded', box.hidden ? 'false' : 'true');
        composer.helpOpen = { ...(composer.helpOpen || {}), [key]: !box.hidden };
      });
    });

    this.bindItemsList(composer);

    document.querySelectorAll('[data-composer-item-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        const additive = e.shiftKey || e.ctrlKey || e.metaKey;
        const clickedId = el.getAttribute('data-composer-item-id');
        // Clique no que já é a única seleção não reconstrói o painel (preserva o duplo clique de renomear)
        if (!additive && composer.selectedItemIds?.size === 1 && composer.selectedItemIds.has(clickedId)) return;
        composer.selectItem(clickedId, { additive, fromPanel: true });
      });
    });

    document.getElementById('btn-collapse-props-panel')?.addEventListener('click', () => {
      composer.togglePropertiesPanel(true);
    });

    // Guia selecionada: posição, trava e exclusão
    document.getElementById('prop-guide-pos')?.addEventListener('change', (e) => {
      const g = composer.selectedGuide;
      const v = parseFloat(e.target.value);
      if (!g) return;
      if (!Number.isFinite(v)) { composer.updatePropertiesPanel(); return; }
      composer.moveGuide(g.axis, g.val, v);
    });
    document.getElementById('prop-guides-locked')?.addEventListener('change', (e) => composer.setGuidesLocked(e.target.checked));
    document.getElementById('btn-prop-guide-delete')?.addEventListener('click', () => composer.deleteSelectedGuide());

    // Eventos do Gerador de Atlas Cartográfico
    const propAtlasEnable = document.getElementById('prop-atlas-enable');
    if (propAtlasEnable) {
      propAtlasEnable.addEventListener('change', (e) => {
        composer.atlas?.setEnabled(e.target.checked);
        composer.updatePropertiesPanel?.();
      });
    }

    const propAtlasLayer = document.getElementById('prop-atlas-layer');
    if (propAtlasLayer) {
      propAtlasLayer.addEventListener('change', (e) => {
        composer.atlas?.setLayerId(e.target.value);
        composer.updatePropertiesPanel?.();
      });
    }

    const propAtlasMargin = document.getElementById('prop-atlas-margin');
    if (propAtlasMargin) {
      propAtlasMargin.addEventListener('change', (e) => {
        composer.atlas?.setMarginPct(Number(e.target.value));
      });
    }

    const btnPropExportAtlas = document.getElementById('btn-prop-export-atlas');
    if (btnPropExportAtlas) {
      btnPropExportAtlas.addEventListener('click', () => {
        composer.atlas?.exportAtlasPDF(composer.exportDpi || 300);
      });
    }

    document.getElementById('btn-prop-delete-multi')?.addEventListener('click', () => {
      const ids = [...(composer.selectedItemIds || [])];
      if (ids.length > 0) composer.deleteItems(ids);
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

    const updateCurrent = (mutator, shouldUpdateMap = false, isPositionOrSizeChange = false, fieldKey = null) => {
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
      const fieldId = fieldKey || document.activeElement?.id || 'campo';
      composer.pushHistoryState(`Editar ${it.name || 'Item'}`, { coalesceKey: `prop:${it.id}:${fieldId}` });
    };

    // Botões de alinhamento e organização do painel
    const btnPropAlignL = document.getElementById('btn-prop-align-left');
    const btnPropAlignCH = document.getElementById('btn-prop-align-center-h');
    const btnPropAlignR = document.getElementById('btn-prop-align-right');
    const btnPropAlignT = document.getElementById('btn-prop-align-top');
    const btnPropAlignCV = document.getElementById('btn-prop-align-center-v');
    const btnPropAlignB = document.getElementById('btn-prop-align-bottom');
    const btnPropDistH = document.getElementById('btn-prop-distribute-h');
    const btnPropDistV = document.getElementById('btn-prop-distribute-v');
    const btnPropDup = document.getElementById('btn-prop-duplicate');
    const btnPropForward = document.getElementById('btn-prop-bring-forward');
    const btnPropBackward = document.getElementById('btn-prop-send-backward');
    const btnPropFront = document.getElementById('btn-prop-bring-front');
    const btnPropBack = document.getElementById('btn-prop-send-back');

    if (btnPropAlignL) btnPropAlignL.onclick = () => composer.alignLeft();
    if (btnPropAlignCH) btnPropAlignCH.onclick = () => composer.alignCenterH();
    if (btnPropAlignR) btnPropAlignR.onclick = () => composer.alignRight();
    if (btnPropAlignT) btnPropAlignT.onclick = () => composer.alignTop();
    if (btnPropAlignCV) btnPropAlignCV.onclick = () => composer.alignCenterV();
    if (btnPropAlignB) btnPropAlignB.onclick = () => composer.alignBottom();
    if (btnPropDistH) btnPropDistH.onclick = () => composer.distributeH();
    if (btnPropDistV) btnPropDistV.onclick = () => composer.distributeV();
    if (btnPropDup) btnPropDup.onclick = () => composer.duplicateSelectedItem();
    if (btnPropForward) btnPropForward.onclick = () => composer.bringForward?.();
    if (btnPropBackward) btnPropBackward.onclick = () => composer.sendBackward?.();
    if (btnPropFront) btnPropFront.onclick = () => composer.bringToFront();
    if (btnPropBack) btnPropBack.onclick = () => composer.sendToBack();

    document.getElementById('btn-prop-match-w')?.addEventListener('click', () => PrintAlignmentHelper.matchWidth(composer));
    document.getElementById('btn-prop-match-h')?.addEventListener('click', () => PrintAlignmentHelper.matchHeight(composer));
    document.getElementById('btn-prop-pack-v')?.addEventListener('click', () => PrintAlignmentHelper.packVertical(composer));
    document.getElementById('btn-prop-pack-h')?.addEventListener('click', () => PrintAlignmentHelper.packHorizontal(composer));
    document.getElementById('btn-prop-fit-margins')?.addEventListener('click', () => PrintAlignmentHelper.fitToMargins(composer));
    document.getElementById('btn-prop-copy-style')?.addEventListener('click', () => {
      if (composer.copyItemStyle?.()) {
        composer.updatePropertiesPanel();
        UIToast.notificar({ tipo: 'sucesso', titulo: 'Estilo Copiado', mensagem: 'Selecione outro objeto e clique em "Colar".', duracao: 2200 });
      }
    });
    document.getElementById('btn-prop-paste-style')?.addEventListener('click', () => composer.pasteItemStyle?.());
    // Nome, posição, tamanho e campos do tipo (painel de propriedades do kit)
    this.bindItemPanel(composer, updateCurrent);

    // O que o kit ainda não cobre (HTML): texto das notas, arquivo da imagem e itens da legenda
    document.getElementById('prop-text-body')?.addEventListener('input', (e) => updateCurrent(it => it.text = e.target.value));
    document.getElementById('prop-image-file')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      // Reduz a imagem antes de gravar: a prancha inteira precisa caber no localStorage
      PrintImageUtils.prepareImageFile(file)
        .then(({ dataUrl }) => { updateCurrent(it => it.imageUrl = dataUrl); composer.updatePropertiesPanel(); })
        .catch(err => UIToast.notificar({
          tipo: 'erro',
          titulo: 'Imagem não carregada',
          mensagem: err.message || 'Não foi possível ler a imagem.',
          duracao: 4000
        }));
    });
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
  }
}

