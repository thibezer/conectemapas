import { PrintItemsManager } from './PrintItemsManager.js';
import { PrintTitleBlockRenderer } from './PrintTitleBlockRenderer.js';
import { PrintAlignmentHelper } from './PrintAlignmentHelper.js';
import { PrintImageUtils } from './PrintImageUtils.js';
import { UIToast } from '@thibezer/ui-components-kit';
import { BasemapCatalog } from '../../services/BasemapCatalog.js';
import { PrintViewResolver } from './PrintViewResolver.js';
import { PrintFonts } from './PrintFonts.js';
import { ppIcon, itemTypeIcon } from './PrintIcons.js';

export class PrintPropertiesPanel {
  static render(composer) {
    const selectedItem = composer.items.find(it => it.id === composer.selectedItemId);
    const esc = PrintItemsManager.escapeHtml;
    // Seção aberta ou fechada pelo usuário, lembrada pelo nome (não pela posição)
    const tab = this.TABS.some(t => t[0] === composer.panelTab) ? composer.panelTab : 'item';
    // Valor comum arredondado de uma medida entre os itens selecionados ('' = misto)
    const multiItems = composer.selectedItemIds && composer.selectedItemIds.size > 1
      ? composer.items.filter(it => composer.selectedItemIds.has(it.id)) : [];
    const common = (key) => {
      const vals = multiItems.map(it => Math.round(it[key]));
      return vals.every(v => v === vals[0]) ? String(vals[0]) : '';
    };
    const multiField = (key, label, max, min = 0) => {
      const v = common(key);
      return `<div>
                    <span class="cm-param-label">${label}</span>
                    <ui-campo-texto type="number" tamanho="sm" id="prop-multi-${key}" data-multi-key="${key}" class="cm-vertex-input cm-pp-full" min="${min}" max="${max}" value="${v}" placeholder="${v === '' ? 'Misto' : ''}"></ui-campo-texto>
                  </div>`;
    };
    const openAttr = (key) => (composer.panelSections?.[key] === false ? '' : 'open');

    // Filtra feições poligonais ou de linha para a tabela de vértices
    const polygonFeatures = (composer.features || []).filter(f => {
      const t = (f.type || '').toLowerCase();
      return (t === 'polygon' || t === 'multipolygon' || t === 'linestring' || t === 'line');
    });

    return `
      <div class="cm-print-props-panel">
        <div class="cm-pp-header">
          <div class="cm-pp-header-title">
            <span class="cm-pp-title-ico">${ppIcon('settings')}PROPRIEDADES</span>
            <span class="cm-pp-header-paper">${esc(composer.paperSize.name)}</span>
          </div>
          <button type="button" class="cm-pp-collapse-btn" id="btn-collapse-props-panel" title="Recolher painel (atalho [)" aria-label="Recolher painel">${ppIcon('collapse')}</button>
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
              ${composer.items.map((it) => {
                // Sem `visible` gravado o item aparece (mesma regra da prancha e do exportador)
                const shown = it.visible !== false;
                const selected = composer.selectedItemIds ? composer.selectedItemIds.has(it.id) : (it.id === composer.selectedItemId);
                const name = esc(it.name || 'Item');
                return `
                <div class="cm-ai-row cm-pp-item-row ${selected ? 'is-selected' : ''} ${shown ? '' : 'is-hidden'}" data-composer-item-id="${esc(it.id)}">
                  <button type="button" class="cm-pp-item-main" data-composer-select="${esc(it.id)}" ${selected ? 'aria-current="true"' : ''} title="${shown ? name : `${name} (oculto)`}">
                    <span class="cm-pp-item-icon" aria-hidden="true">${this.getItemIcon(it.type)}</span>
                    <span class="cm-pp-item-name">${name}</span>
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
          ${(composer.selectedItemIds && composer.selectedItemIds.size > 1) ? `
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
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-distribute-h" title="Distribuir Horizontalmente (Espaçamento Uniforme)" aria-label="Distribuir Horizontalmente"><span class="cm-pp-btn-lbl">${ppIcon('distributeH')}Dist. H</span></ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-distribute-v" title="Distribuir Verticalmente (Espaçamento Uniforme)" aria-label="Distribuir Verticalmente"><span class="cm-pp-btn-lbl">${ppIcon('distributeV')}Dist. V</span></ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-duplicate" title="Duplicar Itens (Ctrl+D)"><span class="cm-pp-btn-lbl">${ppIcon('copy')}Duplicar</span></ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-delete-multi" title="Excluir Itens (Delete)"><span class="cm-pp-btn-lbl">${ppIcon('trash')}Excluir</span></ui-botao-primario>
                  </div>
                  <div class="cm-pp-btn-row">
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-match-w" title="Igualar Largura pelo 1º item"><span class="cm-pp-btn-lbl">${ppIcon('matchW')}Larg.</span></ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-match-h" title="Igualar Altura pelo 1º item"><span class="cm-pp-btn-lbl">${ppIcon('matchH')}Alt.</span></ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-pack-v" title="Empilhar Verticalmente"><span class="cm-pp-btn-lbl">${ppIcon('packV')}Emp. V</span></ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-pack-h" title="Empilhar Horizontalmente"><span class="cm-pp-btn-lbl">${ppIcon('packH')}Emp. H</span></ui-botao-primario>
                    ${composer.copiedStyle ? `<ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-paste-style" title="Colar Estilo Copiado"><span class="cm-pp-btn-lbl">${ppIcon('brush')}Estilo</span></ui-botao-primario>` : ''}
                  </div>
                </div>
                <div class="cm-pp-subtitle">Posição e tamanho</div>
                <div class="cm-pp-grid2">
                  ${multiField('x', 'X (mm)', composer.paperSize.width)}
                  ${multiField('y', 'Y (mm)', composer.paperSize.height)}
                  ${multiField('width', 'Largura (mm)', composer.paperSize.width, PrintItemsManager.MIN_ITEM_MM)}
                  ${multiField('height', 'Altura (mm)', composer.paperSize.height, PrintItemsManager.MIN_ITEM_MM)}
                </div>
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
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-duplicate" title="Duplicar Item (Ctrl+D)"><span class="cm-pp-btn-lbl">${ppIcon('copy')}Duplicar</span></ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-fit-margins" title="Ajustar às Margens da Folha" aria-label="Ajustar às Margens">${ppIcon('fitMargins')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-copy-style" title="Copiar Estilo Visual" aria-label="Copiar Estilo">${ppIcon('brush')}</ui-botao-primario>
                    ${composer.copiedStyle ? `<ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-paste-style" title="Aplicar Estilo Copiado"><span class="cm-pp-btn-lbl">Colar</span></ui-botao-primario>` : ''}
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-bring-forward" title="Avançar 1 Nível" aria-label="Avançar 1 Nível">${ppIcon('forward')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-send-backward" title="Recuar 1 Nível" aria-label="Recuar 1 Nível">${ppIcon('backward')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-bring-front" title="Trazer para Frente" aria-label="Trazer para Frente">${ppIcon('front')}</ui-botao-primario>
                    <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-prop-send-back" title="Enviar para Trás" aria-label="Enviar para Trás">${ppIcon('back')}</ui-botao-primario>
                  </div>
                </div>

                <!-- Nome do Elemento -->
                <div class="cm-pp-stack cm-pp-stack--tight">
                  <span class="cm-param-label">Nome:</span>
                  <ui-campo-texto type="text" tamanho="sm" id="prop-item-name" class="cm-vertex-input cm-pp-full" value="${esc(selectedItem.name || '')}"></ui-campo-texto>
                </div>

                <!-- Posição e Dimensão em mm -->
                <div class="cm-pp-subtitle">Posição e tamanho</div>
                <div class="cm-pp-grid2">
                  <div>
                    <span class="cm-param-label">Posição X (mm):</span>
                    <ui-campo-texto type="number" tamanho="sm" id="prop-item-x" class="cm-vertex-input cm-pp-full" min="0" max="${composer.paperSize.width}" value="${Math.round(selectedItem.x)}"></ui-campo-texto>
                  </div>
                  <div>
                    <span class="cm-param-label">Posição Y (mm):</span>
                    <ui-campo-texto type="number" tamanho="sm" id="prop-item-y" class="cm-vertex-input cm-pp-full" min="0" max="${composer.paperSize.height}" value="${Math.round(selectedItem.y)}"></ui-campo-texto>
                  </div>
                  <div>
                    <span class="cm-param-label">Largura (mm):</span>
                    <ui-campo-texto type="number" tamanho="sm" id="prop-item-w" class="cm-vertex-input cm-pp-full" min="${PrintItemsManager.MIN_ITEM_MM}" max="${composer.paperSize.width}" value="${Math.round(selectedItem.width)}"></ui-campo-texto>
                  </div>
                  <div>
                    <span class="cm-param-label">Altura (mm):</span>
                    <ui-campo-texto type="number" tamanho="sm" id="prop-item-h" class="cm-vertex-input cm-pp-full" min="${PrintItemsManager.MIN_ITEM_MM}" max="${composer.paperSize.height}" value="${Math.round(selectedItem.height)}"></ui-campo-texto>
                  </div>
                </div>
                <div class="cm-param-row">
                  <span class="cm-param-label">Travar proporção ao redimensionar:</span>
                  <ui-checkbox id="prop-item-lock-aspect" ${selectedItem.lockAspect ? 'checked' : ''}></ui-checkbox>
                </div>

                ${this.renderTypeFields(selectedItem, composer, polygonFeatures)}
              </fieldset>
            </details>
          ` : '<div class="cm-pp-empty">Selecione um elemento para editar.</div>'}
          </div>
        </div>
      </div>
    `;
  }

  /** Abas do painel: [id, rótulo, ícone] */
  static TABS = [['item', 'Item', 'target'], ['items', 'Elementos', 'layers'], ['paper', 'Folha', 'sheet'], ['atlas', 'Atlas', 'book']];

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
      <ui-campo-texto type="number" tamanho="sm" id="print-margin-${side}" class="cm-vertex-input cm-pp-margin-input" data-margin-side="${side}" min="0" max="${max}" step="0.5" value="${m[side]}"></ui-campo-texto>
    `;

    return `
      <details class="cm-inspector-accordion" data-section="paper" ${openAttr('paper')}>
        <summary class="cm-pp-summary">${ppIcon('sheet')}Folha</summary>
        <div class="cm-pp-body">
          <ui-select id="print-paper-size-select" class="cm-native-select cm-pp-full cm-pp-compact-select" tamanho="sm" value="${esc(paper.id)}" title="Tamanho do papel">
            ${this.PAPER_OPTIONS.map(([id, label]) => {
              const sz = sizes[id];
              const dims = sz ? ` · ${sz.width}×${sz.height}` : '';
              return `<option value="${id}" ${paper.id === id ? 'selected' : ''}>${label}${dims}</option>`;
            }).join('')}
          </ui-select>

          <div class="cm-pp-margins">
            <div class="cm-pp-margins-head">
              <span class="cm-param-label">Margens (mm)</span>
              <ui-badge variante="sucesso" tamanho="sm" class="cm-pp-badge" id="print-margins-abnt-badge" title="25 mm à esquerda para encadernação" ${isAbnt ? '' : 'hidden'}>ABNT</ui-badge>
              <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn" id="btn-margins-abnt" title="Voltar às margens ABNT" ${isAbnt ? 'hidden' : ''}>↺ ABNT</ui-botao-primario>
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
            <ui-checkbox id="print-abnt-margins-check" ${composer.showAbntMargins ? 'checked' : ''}></ui-checkbox>
          </label>

          <div class="cm-pp-inline">
            <ui-select id="print-preset-select" class="cm-native-select cm-pp-grow cm-pp-compact-select" tamanho="sm" value="${match ? esc(match.id) : ''}" title="Pré-definições deste projeto">
              <option value="" ${match ? '' : 'selected'}>${presets.length ? 'Pré-definições…' : 'Nenhuma pré-definição'}</option>
              ${presets.map(p => `<option value="${esc(p.id)}" ${match?.id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
            </ui-select>
            <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-preset-btn" id="btn-preset-save" title="Salvar papel, margens e moldura atuais" aria-label="Salvar pré-definição">${ppIcon('save')}</ui-botao-primario>
            <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-preset-btn" id="btn-preset-delete" title="Excluir a pré-definição selecionada" ${match ? `data-preset-id="${esc(match.id)}"` : 'disabled'} aria-label=\"Excluir pré-definição\">${ppIcon('trash')}</ui-botao-primario>
          </div>

          <ui-botao-primario inline id="btn-prop-align-abnt" variante="secundario" class="cm-pp-wide-btn" title="Volta às margens ABNT e ao layout padrão dos elementos (Ctrl+Z desfaz)">
            ${ppIcon('layout')}Layout padrão
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
      presets.carregarItensFilhos?.();
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
  static fontRow(item, id) {
    const current = PrintFonts.normalize(item.fontFamily);
    return `
          <div class="cm-param-row">
            <span class="cm-param-label">Fonte:</span>
            <ui-select id="${id}" class="cm-native-select cm-pp-w-l" tamanho="sm" value="${current}">
              ${PrintFonts.list().map(f => `<option value="${f.id}" ${f.id === current ? 'selected' : ''}>${PrintItemsManager.escapeHtml(f.label)}</option>`).join('')}
            </ui-select>
          </div>`;
  }

  /** Campos específicos do tipo do elemento selecionado */
  static renderTypeFields(item, composer, polygonFeatures) {
    const esc = PrintItemsManager.escapeHtml;
    const sel = (cond) => (cond ? 'selected' : '');
    const colorValue = (value, fallback) => (PrintItemsManager.parseColor(value) || { hex: fallback }).hex;

    if (item.type === 'map' || item.type === 'inset_map') {
      const currentBasemap = BasemapCatalog.normalize(composer.basemapFor ? composer.basemapFor(item) : (item.basemap || (item.type === 'inset_map' ? 'esri_light' : composer.currentBasemap)));
      return `
        <div class="cm-pp-stack cm-pp-section">
          <div class="cm-param-row">
            <span class="cm-param-label">Camada Base:</span>
            <ui-select id="prop-map-basemap" class="cm-native-select cm-pp-w-xl" tamanho="sm" value="${esc(currentBasemap)}" ${PrintViewResolver.isLockedByTemplate(item, composer.library, 'basemap') ? 'disabled title="Controlado pelo modelo de vista"' : ''}>
              ${BasemapCatalog.list().map(b => `
                <option value="${b.id}" ${sel(currentBasemap === b.id)}>${b.icon} ${esc(b.name)}${b.exportable ? '' : ' (pode não sair no PDF)'}</option>
              `).join('')}
            </ui-select>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Escala Numérica (1:):</span>
            <ui-campo-texto type="number" tamanho="sm" id="prop-map-scale" class="cm-vertex-input cm-pp-w-m" step="500" value="${Number(item.scale) || 10000}"></ui-campo-texto>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Rotação do Mapa:</span>
            <ui-campo-texto type="number" tamanho="sm" id="prop-map-rot" class="cm-vertex-input cm-pp-w-s" min="0" max="360" value="${Number(item.rotation) || 0}"></ui-campo-texto>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Grade de Coordenadas:</span>
            <ui-checkbox id="prop-map-grid" ${item.showGrid ? 'checked' : ''}></ui-checkbox>
          </div>
          ${item.showGrid ? `
            <div class="cm-param-row">
              <span class="cm-param-label">Tipo de Grade:</span>
              <ui-select id="prop-map-grid-type" class="cm-native-select cm-pp-w-xl" tamanho="sm" value="${item.gridType === 'utm' ? 'utm' : 'dms'}">
                <option value="dms" ${sel(item.gridType === 'dms')}>Geográfica (DMS)</option>
                <option value="utm" ${sel(item.gridType === 'utm')}>Métrica UTM (m)</option>
              </ui-select>
            </div>
            <div class="cm-param-row">
              <span class="cm-param-label">Estilo da Grade:</span>
              <ui-select id="prop-map-grid-format" class="cm-native-select cm-pp-w-xl" tamanho="sm" value="${item.gridFormat || 'crosses'}">
                <option value="crosses" ${sel(!item.gridFormat || item.gridFormat === 'crosses')}>Cruzetas e Ticks (+)</option>
                <option value="lines" ${sel(item.gridFormat === 'lines')}>Linhas Contínuas</option>
                <option value="ticks" ${sel(item.gridFormat === 'ticks')}>Apenas Ticks nas Bordas</option>
              </ui-select>
            </div>
            <div class="cm-param-row">
              <span class="cm-param-label">Rótulos Laterais:</span>
              <ui-select id="prop-map-grid-label-rot" class="cm-native-select cm-pp-w-xl" tamanho="sm" value="${item.gridLabelRot || 'vertical'}">
                <option value="vertical" ${sel(!item.gridLabelRot || item.gridLabelRot === 'vertical')}>Vertical (Padrão ABNT/QGIS)</option>
                <option value="horizontal" ${sel(item.gridLabelRot === 'horizontal')}>Horizontal</option>
              </ui-select>
            </div>
          ` : ''}
          <ui-botao-primario inline id="btn-prop-pan-map" variante="secundario" class="cm-pp-wide-btn">
            ${ppIcon('hand')}Enquadrar Terreno neste Mapa
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
            <ui-select id="prop-arrow-style" class="cm-native-select cm-pp-w-l" tamanho="sm" value="${esc(item.arrowStyle || 'classic')}">
              <option value="classic" ${sel(item.arrowStyle === 'classic')}>Cartográfica Clássica</option>
              <option value="compass" ${sel(item.arrowStyle === 'compass')}>Bússola / Rosa</option>
              <option value="star8" ${sel(item.arrowStyle === 'star8')}>Rosa 8 Pontas</option>
              <option value="technical" ${sel(item.arrowStyle === 'technical')}>Alvo Técnico (RET)</option>
              <option value="modern" ${sel(item.arrowStyle === 'modern')}>Moderna Minimalista</option>
            </ui-select>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Cor Principal:</span>
            <input type="color" id="prop-arrow-color" class="cm-pp-color" value="${colorValue(item.color, '#000000')}" />
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Rotação (Norte):</span>
            <div class="cm-pp-inline">
              <input type="range" id="prop-arrow-rot-range" class="cm-pp-w-range" min="0" max="360" value="${Number(item.rotation) || 0}" />
              <ui-campo-texto type="number" tamanho="sm" id="prop-arrow-rot" class="cm-vertex-input cm-pp-w-xs" min="0" max="360" value="${Number(item.rotation) || 0}"></ui-campo-texto>
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
            <span class="cm-param-label">Estilo da Régua:</span>
            <ui-select id="prop-sb-style" class="cm-native-select cm-pp-w-l" tamanho="sm" value="${esc(item.barStyle || 'alternating')}">
              <option value="alternating" ${sel(!item.barStyle || item.barStyle === 'alternating')}>Barras Alternadas</option>
              <option value="double" ${sel(item.barStyle === 'double')}>Barra Dupla (Zebrada)</option>
              <option value="line_ticks" ${sel(item.barStyle === 'line_ticks')}>Linha com Marcas</option>
            </ui-select>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Divisões:</span>
            <ui-campo-texto type="number" tamanho="sm" id="prop-sb-segments" class="cm-vertex-input cm-pp-w-s" min="1" max="8" step="1" value="${Number(item.segments) || 4}"></ui-campo-texto>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Unidade:</span>
            <ui-select id="prop-sb-units" class="cm-native-select cm-pp-w-l" tamanho="sm" value="${esc(item.units || 'auto')}">
              <option value="auto" ${sel(!item.units || item.units === 'auto')}>Automática</option>
              <option value="m" ${sel(item.units === 'm')}>Metros (m)</option>
              <option value="km" ${sel(item.units === 'km')}>Quilômetros (km)</option>
            </ui-select>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Cor da Barra:</span>
            <input type="color" id="prop-sb-color" class="cm-pp-color" value="${colorValue(item.barColor, '#000000')}" />
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Mostrar escala numérica:</span>
            <ui-checkbox id="prop-sb-text" ${item.showScaleText !== false ? 'checked' : ''}></ui-checkbox>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Caixa de fundo e moldura:</span>
            <ui-checkbox id="prop-sb-box" ${item.showBox !== false ? 'checked' : ''}></ui-checkbox>
          </div>
        </div>
      `;
    }

    if (item.type === 'legend') {
      const hidden = new Set((item.hiddenLayerIds || []).map(String));
      const maps = (composer.items || []).filter(i => i.type === 'map');
      const mapItem = PrintItemsManager.legendMapItem(item, composer.items || []);
      const candidates = mapItem
        ? PrintViewResolver.legendEntries(PrintViewResolver.effectiveView(mapItem, composer.library), {
          features: composer.features || [], layers: composer.layers || [], library: composer.library, scale: mapItem.scale
        })
        : [];
      const bgAlpha = Math.round((item.bgOpacity == null ? 0.95 : Number(item.bgOpacity)) * 100);
      return `
        <div class="cm-pp-stack">
          <span class="cm-param-label">Título da Legenda (vazio = sem título):</span>
          <ui-campo-texto type="text" tamanho="sm" id="prop-legend-title" class="cm-vertex-input" value="${esc(item.title ?? PrintItemsManager.DEFAULT_LEGEND_TITLE)}"></ui-campo-texto>
          <div class="cm-param-row">
            <span class="cm-param-label">Colunas:</span>
            <ui-select id="prop-legend-columns" class="cm-native-select cm-pp-w-s" tamanho="sm" value="${Math.min(3, Math.max(1, Number(item.legendColumns) || 1))}">
              ${[1, 2, 3].map(n => `<option value="${n}" ${sel((Number(item.legendColumns) || 1) === n)}>${n}</option>`).join('')}
            </ui-select>
          </div>
          ${this.fontRow(item, 'prop-legend-font')}
          ${maps.length > 1 ? `
            <div class="cm-param-row">
              <span class="cm-param-label">Mapa vinculado:</span>
              <ui-select id="prop-legend-map" class="cm-native-select cm-pp-w-l" tamanho="sm" value="${esc(mapItem?.id || '')}">
                ${maps.map(m => `<option value="${esc(m.id)}" ${sel(mapItem?.id === m.id)}>${esc(m.name || 'Mapa')}</option>`).join('')}
              </ui-select>
            </div>
          ` : ''}
          <div class="cm-pp-subtitle">Conteúdo e métricas</div>
          <div class="cm-param-row">
            <span class="cm-param-label">Mostrar contagem de feições:</span>
            <ui-checkbox id="prop-legend-count" ${item.showFeatureCount ? 'checked' : ''}></ui-checkbox>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Mostrar soma de área (ha):</span>
            <ui-checkbox id="prop-legend-area" ${item.showAreaHa ? 'checked' : ''}></ui-checkbox>
          </div>
          <div class="cm-pp-subtitle">Aparência da caixa</div>
          <div class="cm-param-row">
            <span class="cm-param-label">Faixa de fundo no título:</span>
            <ui-checkbox id="prop-legend-hdr-bg" ${item.showHeaderBg !== false ? 'checked' : ''}></ui-checkbox>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Cor do Cabeçalho:</span>
            <input type="color" id="prop-legend-hdr-color" class="cm-pp-color" value="${colorValue(item.headerColor, '#000000')}" />
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Moldura ao redor:</span>
            <ui-checkbox id="prop-legend-border" ${item.showBorder !== false ? 'checked' : ''}></ui-checkbox>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Opacidade do fundo:</span>
            <div class="cm-pp-inline">
              <input type="range" id="prop-legend-alpha" class="cm-pp-w-range" min="0" max="100" step="5" value="${bgAlpha}" />
              <span class="cm-pp-value">${bgAlpha}%</span>
            </div>
          </div>
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

    if (item.type === 'table_vertices') {
      const mode = item.tableMode === 'areas' ? 'areas' : 'vertices';
      const crs = item.crs === 'dms' ? 'dms' : 'utm';
      const activeCols = Array.isArray(item.columns) && item.columns.length
        ? item.columns
        : (crs === 'dms' ? ['name', 'latDms', 'lngDms', 'azimuth', 'distance'] : ['name', 'northing', 'easting', 'azimuth', 'distance']);
      const colSet = new Set(activeCols);
      const colDefs = crs === 'dms'
        ? [['name', 'Vértice'], ['latDms', 'Latitude'], ['lngDms', 'Longitude'], ['azimuth', 'Azimute'], ['distance', 'Distância']]
        : [['name', 'Vértice'], ['northing', 'Norte (Y)'], ['easting', 'Leste (X)'], ['azimuth', 'Azimute'], ['distance', 'Distância']];
      return `
        <div class="cm-pp-stack">
          <div class="cm-param-row">
            <span class="cm-param-label">Modo da Tabela:</span>
            <ui-select id="prop-vert-mode" class="cm-native-select cm-pp-w-xl" tamanho="sm" value="${mode}">
              <option value="vertices" ${sel(mode === 'vertices')}>Tabela de Vértices (Geodésica)</option>
              <option value="areas" ${sel(mode === 'areas')}>Quadro Resumo de Áreas</option>
            </ui-select>
          </div>
          <span class="cm-param-label">Título Personalizado (opcional):</span>
          <ui-campo-texto type="text" tamanho="sm" id="prop-vert-title" class="cm-vertex-input" value="${esc(item.title || '')}"></ui-campo-texto>
          ${mode === 'vertices' ? `
            <div class="cm-param-row">
              <span class="cm-param-label">Feição Referência:</span>
              <ui-select id="prop-vert-feature" class="cm-native-select cm-pp-w-xl" tamanho="sm" value="${esc(item.targetFeatureId || '')}">
                <option value="">-- Automático (1º Polígono) --</option>
                ${polygonFeatures.map(f => `
                  <option value="${esc(f.id)}" ${sel(item.targetFeatureId === f.id)}>${esc(f.name || f.id)}</option>
                `).join('')}
              </ui-select>
            </div>
            <div class="cm-pp-subtitle">Formato &amp; Sistema de Coordenadas</div>
            <div class="cm-param-row">
              <span class="cm-param-label">Sistema (CRS):</span>
              <ui-select id="prop-vert-crs" class="cm-native-select cm-pp-w-l" tamanho="sm" value="${crs}">
                <option value="utm" ${sel(crs === 'utm')}>UTM SIRGAS 2000 (m)</option>
                <option value="dms" ${sel(crs === 'dms')}>Geográficas (G°M'S")</option>
              </ui-select>
            </div>
            <div class="cm-param-row">
              <span class="cm-param-label">1ª Coluna:</span>
              <ui-select id="prop-vert-segfmt" class="cm-native-select cm-pp-w-l" tamanho="sm" value="${esc(item.segmentFormat || 'vertex')}">
                <option value="vertex" ${sel(!item.segmentFormat || item.segmentFormat === 'vertex')}>Ponto (V01)</option>
                <option value="segment" ${sel(item.segmentFormat === 'segment')}>Segmento (V01 → V02)</option>
              </ui-select>
            </div>
            <div class="cm-param-row">
              <span class="cm-param-label">Prefixo dos Vértices:</span>
              <ui-campo-texto type="text" tamanho="sm" id="prop-vert-prefix" class="cm-vertex-input cm-pp-w-s" value="${esc(item.vertexPrefix || 'V')}"></ui-campo-texto>
            </div>
            <span class="cm-param-label">Colunas visíveis:</span>
            <div class="cm-pp-col-checks">
              ${colDefs.map(([k, lbl]) => `
                <label class="cm-param-row cm-pp-layer-row" for="prop-vert-col-${k}">
                  <ui-checkbox id="prop-vert-col-${k}" data-vert-col="${k}" ${colSet.has(k) ? 'checked' : ''}></ui-checkbox>
                  <span>${lbl}</span>
                </label>
              `).join('')}
            </div>
            <div class="cm-pp-subtitle">Intervalo / Paginação</div>
            <div class="cm-pp-grid2">
              <div>
                <span class="cm-param-label">Vértice inicial:</span>
                <ui-campo-texto type="number" tamanho="sm" id="prop-vert-start" class="cm-vertex-input cm-pp-full" min="1" value="${Number(item.startVertex) || 1}"></ui-campo-texto>
              </div>
              <div>
                <span class="cm-param-label">Vértice final (0=fim):</span>
                <ui-campo-texto type="number" tamanho="sm" id="prop-vert-end" class="cm-vertex-input cm-pp-full" min="0" value="${Number(item.endVertex) || 0}"></ui-campo-texto>
              </div>
            </div>
            <ui-botao-primario inline id="btn-split-vert-table" variante="secundario" class="cm-pp-wide-btn" title="Cria automaticamente uma segunda tabela ao lado com os vértices que não couberam">
              ${ppIcon('split')}Dividir em Tabela de Continuação
            </ui-botao-primario>
          ` : ''}
          <div class="cm-pp-subtitle">Aparência</div>
          <div class="cm-param-row">
            <span class="cm-param-label">Cor do Cabeçalho:</span>
            <input type="color" id="prop-vert-hdr-color" class="cm-pp-color" value="${colorValue(item.headerBgColor, '#000000')}" />
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Exibir rodapé (Área / Perímetro):</span>
            <ui-checkbox id="prop-vert-footer" ${item.showFooter !== false ? 'checked' : ''}></ui-checkbox>
          </div>
        </div>
      `;
    }

    if (item.type === 'text_block') {
      return `
        <div class="cm-pp-stack">
          <div class="cm-pp-subtitle">Conteúdo</div>
          <span class="cm-param-label">Título do Bloco:</span>
          <ui-campo-texto type="text" tamanho="sm" id="prop-text-title" class="cm-vertex-input" value="${esc(item.title || '')}"></ui-campo-texto>
          <span class="cm-param-label">Texto das Notas (duplo clique na folha edita direto):</span>
          <ui-area-texto id="prop-text-body" class="cm-vertex-input cm-pp-textarea" linhas="5" value="${esc(item.text || '')}">${esc(item.text || '')}</ui-area-texto>
          <ui-botao-primario inline id="btn-generate-memorial" variante="secundario" class="cm-pp-wide-btn" title="Gera automaticamente o Memorial Descritivo ABNT a partir das feições do projeto">
            ${ppIcon('sheet')}Gerar Memorial Descritivo ABNT
          </ui-botao-primario>
          <div class="cm-pp-subtitle">Tipografia &amp; Layout</div>
          <div class="cm-param-row">
            <span class="cm-param-label">Exibir título:</span>
            <ui-checkbox id="prop-text-show-title" ${item.showTitle !== false ? 'checked' : ''}></ui-checkbox>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Tamanho da Fonte (pt):</span>
            <ui-campo-texto type="number" tamanho="sm" id="prop-text-size" class="cm-vertex-input cm-pp-w-s" min="5" max="18" step="0.5" value="${Number(item.fontSize) || 7.5}"></ui-campo-texto>
          </div>
          ${this.fontRow(item, 'prop-text-font')}
          <div class="cm-param-row">
            <span class="cm-param-label">Alinhamento:</span>
            <ui-select id="prop-text-align" class="cm-native-select cm-pp-w-m" tamanho="sm" value="${esc(item.textAlign || 'left')}">
              <option value="left" ${sel(!item.textAlign || item.textAlign === 'left')}>À Esquerda</option>
              <option value="justify" ${sel(item.textAlign === 'justify')}>Justificado</option>
              <option value="center" ${sel(item.textAlign === 'center')}>Centralizado</option>
              <option value="right" ${sel(item.textAlign === 'right')}>À Direita</option>
            </ui-select>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Colunas de texto:</span>
            <ui-select id="prop-text-cols" class="cm-native-select cm-pp-w-s" tamanho="sm" value="${Number(item.columns) === 2 ? '2' : '1'}">
              <option value="1" ${sel(Number(item.columns) !== 2)}>1</option>
              <option value="2" ${sel(Number(item.columns) === 2)}>2</option>
            </ui-select>
          </div>
          <div class="cm-pp-subtitle">Cores &amp; Moldura</div>
          <div class="cm-param-row">
            <span class="cm-param-label">Cor do Texto / Cabeçalho:</span>
            <div class="cm-pp-inline">
              <input type="color" id="prop-text-color" class="cm-pp-color" value="${colorValue(item.textColor, '#1f2937')}" />
              <input type="color" id="prop-text-hdr-color" class="cm-pp-color" value="${colorValue(item.headerColor, '#111827')}" />
            </div>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Exibir borda ao redor:</span>
            <ui-checkbox id="prop-text-border" ${item.showBorder !== false ? 'checked' : ''}></ui-checkbox>
          </div>
        </div>
      `;
    }

    if (item.type === 'shape') {
      const fill = PrintItemsManager.parseColor(item.fillColor) || { hex: '#ffffff', alpha: 0.4 };
      const stype = item.shapeType || 'rect';
      return `
        <div class="cm-pp-stack">
          <div class="cm-pp-subtitle">Geometria da Forma</div>
          <div class="cm-param-row">
            <span class="cm-param-label">Tipo de Forma:</span>
            <ui-select id="prop-shape-type" class="cm-native-select cm-pp-w-xl" tamanho="sm" value="${esc(stype)}">
              ${PrintItemsManager.SHAPE_TYPES.map(t => `<option value="${t.value}" ${sel(stype === t.value)}>${esc(t.label)}</option>`).join('')}
            </ui-select>
          </div>
          ${stype === 'arrow' ? `
            <div class="cm-param-row">
              <span class="cm-param-label">Pontas da Seta:</span>
              <ui-select id="prop-shape-arrowhead" class="cm-native-select cm-pp-w-l" tamanho="sm" value="${esc(item.arrowHead || 'end')}">
                <option value="end" ${sel(!item.arrowHead || item.arrowHead === 'end')}>Ponta Única (→)</option>
                <option value="both" ${sel(item.arrowHead === 'both')}>Dupla (↔)</option>
              </ui-select>
            </div>
          ` : ''}
          <div class="cm-param-row">
            <span class="cm-param-label">Rotação (graus):</span>
            <ui-campo-texto type="number" tamanho="sm" id="prop-shape-rot" class="cm-vertex-input cm-pp-w-s" min="-360" max="360" value="${Number(item.rotation) || 0}"></ui-campo-texto>
          </div>
          <div class="cm-pp-subtitle">Aparência</div>
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
            <span class="cm-param-label">Cor do Contorno / Linha:</span>
            <input type="color" id="prop-shape-stroke" class="cm-pp-color" value="${colorValue(item.strokeColor, '#000000')}" />
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Estilo do Traço:</span>
            <ui-select id="prop-shape-strokestyle" class="cm-native-select cm-pp-w-l" tamanho="sm" value="${esc(item.strokeStyle || 'solid')}">
              ${PrintItemsManager.STROKE_STYLES.map(s => `<option value="${s.value}" ${sel((item.strokeStyle || 'solid') === s.value)}>${esc(s.label)}</option>`).join('')}
            </ui-select>
          </div>
          <div class="cm-pp-grid2">
            <div>
              <span class="cm-param-label">Espessura (px):</span>
              <ui-campo-texto type="number" tamanho="sm" id="prop-shape-strokew" class="cm-vertex-input cm-pp-full" min="0" max="15" step="0.5" value="${item.strokeWidth == null ? 1.5 : (Number(item.strokeWidth) || 0)}"></ui-campo-texto>
            </div>
            <div>
              <span class="cm-param-label">Raio Cantos (px):</span>
              <ui-campo-texto type="number" tamanho="sm" id="prop-shape-radius" class="cm-vertex-input cm-pp-full" min="0" max="60" step="1" value="${Number(item.borderRadius) || 0}"></ui-campo-texto>
            </div>
          </div>
        </div>
      `;
    }

    if (item.type === 'image') {
      const imgAlpha = Math.round((item.opacity == null ? 1 : Number(item.opacity)) * 100);
      return `
        <div class="cm-pp-stack">
          <span class="cm-param-label">Carregar Imagem / Logotipo:</span>
          <input type="file" id="prop-image-file" accept="image/*" class="cm-vertex-input cm-pp-file" />
          <div class="cm-param-row">
            <span class="cm-param-label">Ajuste de Enquadramento:</span>
            <ui-select id="prop-image-fit" class="cm-native-select cm-pp-w-l" tamanho="sm" value="${esc(item.objectFit || 'contain')}">
              <option value="contain" ${sel(item.objectFit === 'contain')}>Conter (Manter Proporção)</option>
              <option value="cover" ${sel(item.objectFit === 'cover')}>Preencher (Cortar Excesso)</option>
            </ui-select>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Opacidade:</span>
            <div class="cm-pp-inline">
              <input type="range" id="prop-image-opacity" class="cm-pp-w-range" min="10" max="100" step="5" value="${imgAlpha}" />
              <span class="cm-pp-value">${imgAlpha}%</span>
            </div>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Moldura (px / cor):</span>
            <div class="cm-pp-inline">
              <ui-campo-texto type="number" tamanho="sm" id="prop-image-strokew" class="cm-vertex-input cm-pp-w-xs" min="0" max="10" step="0.5" value="${Number(item.strokeWidth) || 0}"></ui-campo-texto>
              <input type="color" id="prop-image-stroke" class="cm-pp-color" value="${colorValue(item.strokeColor, '#000000')}" />
            </div>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Rotação (graus):</span>
            <ui-campo-texto type="number" tamanho="sm" id="prop-image-rot" class="cm-vertex-input cm-pp-w-s" min="-360" max="360" value="${Number(item.rotation) || 0}"></ui-campo-texto>
          </div>
          ${item.imageUrl ? `
            <ui-botao-primario inline id="btn-remove-image-url" variante="secundario" class="cm-pp-small-btn">
              ${ppIcon('trash')}Limpar Imagem
            </ui-botao-primario>
          ` : ''}
        </div>
      `;
    }

    if (item.type === 'label') {
      const hasBg = !!item.fillColor;
      return `
        <div class="cm-pp-stack">
          <div class="cm-pp-subtitle">Conteúdo</div>
          <span class="cm-param-label">Texto do Rótulo (duplo clique edita na folha):</span>
          <ui-campo-texto type="text" tamanho="sm" id="prop-label-text" class="cm-vertex-input" value="${esc(item.text || '')}"></ui-campo-texto>
          <div class="cm-pp-subtitle">Tipografia</div>
          <div class="cm-pp-grid2">
            <div>
              <span class="cm-param-label">Tamanho (pt):</span>
              <ui-campo-texto type="number" tamanho="sm" id="prop-label-size" class="cm-vertex-input cm-pp-full" min="5" max="72" value="${Number(item.fontSize) || 10}"></ui-campo-texto>
            </div>
            <div>
              <span class="cm-param-label">Espaço letras (px):</span>
              <ui-campo-texto type="number" tamanho="sm" id="prop-label-ls" class="cm-vertex-input cm-pp-full" min="0" max="20" step="0.5" value="${Number(item.letterSpacing) || 0}"></ui-campo-texto>
            </div>
          </div>
          ${this.fontRow(item, 'prop-label-font')}
          <div class="cm-param-row">
            <span class="cm-param-label">Peso / Estilo:</span>
            <div class="cm-pp-inline">
              <ui-select id="prop-label-weight" class="cm-native-select cm-pp-w-m" tamanho="sm" value="${esc(item.fontWeight || 'bold')}">
                <option value="bold" ${sel(item.fontWeight === 'bold')}>Negrito</option>
                <option value="normal" ${sel(item.fontWeight === 'normal')}>Normal</option>
              </ui-select>
              <ui-select id="prop-label-style" class="cm-native-select cm-pp-w-s" tamanho="sm" value="${esc(item.fontStyle || 'normal')}">
                <option value="normal" ${sel(item.fontStyle !== 'italic')}>Regular</option>
                <option value="italic" ${sel(item.fontStyle === 'italic')}>Itálico</option>
              </ui-select>
            </div>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Caixa do Texto:</span>
            <ui-select id="prop-label-transform" class="cm-native-select cm-pp-w-l" tamanho="sm" value="${esc(item.textTransform || 'none')}">
              <option value="none" ${sel(!item.textTransform || item.textTransform === 'none')}>Como digitado</option>
              <option value="uppercase" ${sel(item.textTransform === 'uppercase')}>MAIÚSCULAS</option>
              <option value="lowercase" ${sel(item.textTransform === 'lowercase')}>minúsculas</option>
            </ui-select>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Alinhamento H / V:</span>
            <div class="cm-pp-inline">
              <ui-select id="prop-label-align" class="cm-native-select cm-pp-w-m" tamanho="sm" value="${esc(item.textAlign || 'center')}">
                <option value="center" ${sel(item.textAlign === 'center')}>Centro</option>
                <option value="left" ${sel(item.textAlign === 'left')}>Esquerda</option>
                <option value="right" ${sel(item.textAlign === 'right')}>Direita</option>
              </ui-select>
              <ui-select id="prop-label-valign" class="cm-native-select cm-pp-w-m" tamanho="sm" value="${esc(item.verticalAlign || 'middle')}">
                <option value="middle" ${sel(!item.verticalAlign || item.verticalAlign === 'middle')}>Meio</option>
                <option value="top" ${sel(item.verticalAlign === 'top')}>Topo</option>
                <option value="bottom" ${sel(item.verticalAlign === 'bottom')}>Base</option>
              </ui-select>
            </div>
          </div>
          <div class="cm-pp-subtitle">Cores, Caixa &amp; Rotação</div>
          <div class="cm-param-row">
            <span class="cm-param-label">Cor do Texto:</span>
            <input type="color" id="prop-label-color" class="cm-pp-color" value="${colorValue(item.textColor, '#000000')}" />
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Fundo colorido:</span>
            <div class="cm-pp-inline">
              <ui-checkbox id="prop-label-bg-on" ${hasBg ? 'checked' : ''}></ui-checkbox>
              <input type="color" id="prop-label-fill" class="cm-pp-color" value="${colorValue(item.fillColor, '#ffffff')}" />
            </div>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Borda (px / cor):</span>
            <div class="cm-pp-inline">
              <ui-campo-texto type="number" tamanho="sm" id="prop-label-strokew" class="cm-vertex-input cm-pp-w-xs" min="0" max="8" step="0.5" value="${Number(item.strokeWidth) || 0}"></ui-campo-texto>
              <input type="color" id="prop-label-stroke" class="cm-pp-color" value="${colorValue(item.strokeColor, '#000000')}" />
            </div>
          </div>
          <div class="cm-param-row">
            <span class="cm-param-label">Rotação (graus):</span>
            <ui-campo-texto type="number" tamanho="sm" id="prop-label-rot" class="cm-vertex-input cm-pp-w-s" min="-360" max="360" value="${Number(item.rotation) || 0}"></ui-campo-texto>
          </div>
        </div>
      `;
    }

    if (item.type === 'title_block') {
      const p = item.properties || {};
      const customFields = Array.isArray(p.customFields) ? p.customFields : [];
      const field = (id, label, key) => `
        <span class="cm-param-label">${label}:</span>
        <ui-campo-texto type="text" tamanho="sm" id="${id}" class="cm-vertex-input" value="${esc(p[key] || '')}"></ui-campo-texto>
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
          <ui-campo-texto id="prop-tb-scale" class="cm-vertex-input" value="${esc(PrintItemsManager.titleBlockScaleText(p, composer.items.find(i => i.type === 'map')?.scale))}" type="text" tamanho="sm"></ui-campo-texto>
          <div class="cm-param-row">
            <span class="cm-param-label">Acompanhar a escala do mapa:</span>
            <ui-checkbox id="prop-tb-scale-auto" ${PrintItemsManager.isTitleBlockScaleAuto(p) ? 'checked' : ''}></ui-checkbox>
          </div>
          <span class="cm-param-label">Área e Perímetro:</span>
          <div class="cm-pp-inline">
            <ui-campo-texto type="text" tamanho="sm" id="prop-tb-area" class="cm-vertex-input cm-pp-grow" value="${esc(p.areaPerimeter || '')}"></ui-campo-texto>
            <ui-botao-primario inline variante="ghost" tamanho="sm" id="btn-calc-area-carimbo" class="cm-ai-micro-btn cm-pp-icon-btn" title="Calcular das Feições">⚡</ui-botao-primario>
          </div>
          ${field('prop-tb-loc', 'Localização / Imóvel', 'location')}
          ${field('prop-tb-date', 'Data da Planta', 'date')}
          ${field('prop-tb-drawn', 'Desenhista / Projetista (opcional)', 'drawnBy')}
          ${field('prop-tb-doc', 'Nº do Desenho (opcional)', 'docNumber')}
          ${field('prop-tb-rev', 'Revisão (opcional)', 'revision')}
          <div class="cm-param-row">
            <span class="cm-param-label">Campo de assinatura:</span>
            <ui-checkbox id="prop-tb-signature" ${p.showSignature === true ? 'checked' : ''}></ui-checkbox>
          </div>
          <div class="cm-pp-subtitle">Campos Personalizados</div>
          <div class="cm-pp-stack cm-pp-stack--tight">
            ${customFields.map((cf, idx) => `
              <div class="cm-pp-custom-field-row" data-tb-cf-idx="${idx}">
                <ui-campo-texto type="text" tamanho="sm" data-tb-cf-label="${idx}" placeholder="Rótulo" class="cm-vertex-input" value="${esc(cf.label || '')}"></ui-campo-texto>
                <ui-campo-texto type="text" tamanho="sm" data-tb-cf-val="${idx}" placeholder="Valor" class="cm-vertex-input" value="${esc(cf.value || '')}"></ui-campo-texto>
                <ui-botao-primario inline variante="ghost" tamanho="sm" data-tb-cf-del="${idx}" class="cm-ai-micro-btn cm-pp-icon-btn" title="Remover campo">${ppIcon('trash')}</ui-botao-primario>
              </div>
            `).join('')}
            <ui-botao-primario inline id="btn-tb-add-custom" variante="ghost" class="cm-pp-wide-btn">
              + Adicionar Campo Personalizado
            </ui-botao-primario>
          </div>
          <div class="cm-pp-subtitle">Aparência</div>
          <div class="cm-param-row">
            <span class="cm-param-label">Cor do Cabeçalho:</span>
            <input type="color" id="prop-tb-accent" class="cm-pp-color" value="${colorValue(p.accentColor, '#000000')}" />
          </div>
          <ui-botao-primario inline id="btn-tb-fit-height" variante="ghost" class="cm-pp-wide-btn" title="Ajusta a altura do carimbo ao número de campos">
            Ajustar altura ao conteúdo
          </ui-botao-primario>
          <ui-botao-primario inline id="btn-sync-project-meta-carimbo" variante="secundario" class="cm-pp-wide-btn" title="Sincronizar projeto, escala, área e data com os dados atuais">
            ${ppIcon('sync')}Sincronizar com o Projeto
          </ui-botao-primario>
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
          <span class="cm-pp-view-template">${view.template ? `${ppIcon('layout')} ${esc(view.template.name)}` : 'Sem modelo'}</span>
        </div>
        <div class="cm-pp-hint">${esc(parts.join(' · '))}</div>
        <ui-botao-primario inline id="btn-prop-open-vv" variante="secundario" class="cm-pp-wide-btn" title="Visibilidade e gráficos deste mapa (V V)">
          ${ppIcon('eye')}Visibilidade/Gráficos (VV)
        </ui-botao-primario>
        ${this.renderTempControls(item, composer)}
      </div>
    `;
  }

  /** Isolar/ocultar temporário e "Revelar ocultos" (só na tela; não salva nem exporta) */
  static renderTempControls(item, composer) {
    const esc = PrintItemsManager.escapeHtml;
    const temp = composer.tempViews?.get?.(item.id) || null;
    const revealing = Boolean(composer.revealHidden?.has?.(item.id));
    const layers = composer.layers || [];
    return `
      <div class="cm-pp-temp" role="group" aria-label="Visualização temporária">
        <span class="cm-param-label">Temporário (não sai no PDF):</span>
        <div class="cm-pp-inline">
          <ui-select id="prop-temp-layer" class="cm-native-select cm-pp-grow cm-pp-compact-select" tamanho="sm" aria-label="Camada">
            ${layers.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}
          </ui-select>
          <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-text-btn" id="btn-temp-isolate" title="Mostra só esta camada">Isolar</ui-botao-primario>
          <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-text-btn" id="btn-temp-hide" title="Esconde esta camada">Ocultar</ui-botao-primario>
        </div>
        <div class="cm-pp-inline">
          <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-text-btn" id="btn-temp-isolate-feature" title="Clique numa feição: só ela aparece">Isolar feição…</ui-botao-primario>
          <ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-text-btn ${revealing ? 'is-active' : ''}" id="btn-reveal-hidden" aria-pressed="${revealing}" title="Mostra em magenta o que esta vista esconde; clique para religar">${ppIcon('bulb')}Revelar ocultos</ui-botao-primario>
          ${temp ? '<ui-botao-primario inline variante="ghost" tamanho="sm" class="cm-ai-micro-btn cm-pp-text-btn is-active" id="btn-temp-reset" title="Volta a mostrar a vista salva">↺ Restaurar</ui-botao-primario>' : ''}
        </div>
      </div>
    `;
  }

  static getItemIcon(type) {
    return itemTypeIcon(type);
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

    // Seleção múltipla: o valor digitado vale para todos os itens desbloqueados
    document.querySelectorAll('#cm-print-props-panel-mount [data-multi-key]').forEach(input => {
      input.addEventListener('change', () => {
        const v = parseFloat(input.value);
        const key = input.dataset.multiKey;
        const targets = composer.items.filter(it => composer.selectedItemIds?.has(it.id) && !it.locked);
        if (!Number.isFinite(v) || !targets.length) { composer.updatePropertiesPanel(); return; }
        targets.forEach(it => {
          it[key] = v;
          PrintItemsManager.clampItemToPaper(it, composer.paperSize);
          composer.updateItemPositionDOM(it);
          if (it.type === 'map' || it.type === 'inset_map') composer.applyMapScaleAndRotation(it);
          else composer.refreshItemContent(it);
        });
        composer.pushHistoryState('Editar Itens', { coalesceKey: `prop:multi:${key}` });
        composer.updatePropertiesPanel();
      });
    });

    document.querySelectorAll('[data-composer-item-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        const additive = e.shiftKey || e.ctrlKey || e.metaKey;
        composer.selectItem(el.getAttribute('data-composer-item-id'), { additive, fromPanel: true });
      });
    });

    document.getElementById('btn-collapse-props-panel')?.addEventListener('click', () => {
      composer.togglePropertiesPanel(true);
    });

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
    document.getElementById('prop-item-lock-aspect')?.addEventListener('change', (e) => {
      updateCurrent(it => { it.lockAspect = !!e.target.checked; });
    });

    const propItemName = document.getElementById('prop-item-name');
    if (propItemName) {
      propItemName.addEventListener('change', (e) => {
        const clean = String(e.target.value || '').trim();
        if (!clean) {
          composer.updatePropertiesPanel();
          return;
        }
        updateCurrent(it => { it.name = clean; });
        composer.updatePropertiesPanel();
      });
    }

    // Eventos de Shape, Image, Label
    const propShapeType = document.getElementById('prop-shape-type');
    const propShapeArrowHead = document.getElementById('prop-shape-arrowhead');
    const propShapeRot = document.getElementById('prop-shape-rot');
    const propShapeFill = document.getElementById('prop-shape-fill');
    const propShapeFillAlpha = document.getElementById('prop-shape-fill-alpha');
    const propShapeFillAlphaValue = document.getElementById('prop-shape-fill-alpha-value');
    const propShapeStroke = document.getElementById('prop-shape-stroke');
    const propShapeStrokeStyle = document.getElementById('prop-shape-strokestyle');
    const propShapeStrokeW = document.getElementById('prop-shape-strokew');
    const propShapeRadius = document.getElementById('prop-shape-radius');

    if (propShapeType) propShapeType.onchange = (e) => { updateCurrent(it => it.shapeType = e.target.value); composer.updatePropertiesPanel(); };
    if (propShapeArrowHead) propShapeArrowHead.onchange = (e) => updateCurrent(it => it.arrowHead = e.target.value);
    if (propShapeRot) propShapeRot.onchange = (e) => updateCurrent(it => it.rotation = parseFloat(e.target.value) || 0);
    const applyShapeFill = () => {
      const alpha = (parseFloat(propShapeFillAlpha?.value) || 0) / 100;
      if (propShapeFillAlphaValue) propShapeFillAlphaValue.textContent = `${Math.round(alpha * 100)}%`;
      updateCurrent(it => it.fillColor = PrintItemsManager.toRgba(propShapeFill.value, alpha));
    };
    if (propShapeFill) propShapeFill.addEventListener('input', applyShapeFill);
    if (propShapeFillAlpha) propShapeFillAlpha.addEventListener('input', applyShapeFill);
    if (propShapeStroke) propShapeStroke.onchange = (e) => updateCurrent(it => it.strokeColor = e.target.value);
    if (propShapeStrokeStyle) propShapeStrokeStyle.onchange = (e) => updateCurrent(it => it.strokeStyle = e.target.value);
    if (propShapeStrokeW) propShapeStrokeW.onchange = (e) => updateCurrent(it => it.strokeWidth = parseFloat(e.target.value) || 0);
    if (propShapeRadius) propShapeRadius.onchange = (e) => updateCurrent(it => it.borderRadius = Math.max(0, parseFloat(e.target.value) || 0));

    const propImgFile = document.getElementById('prop-image-file');
    const propImgFit = document.getElementById('prop-image-fit');
    const propImgOpacity = document.getElementById('prop-image-opacity');
    const propImgStrokeW = document.getElementById('prop-image-strokew');
    const propImgStroke = document.getElementById('prop-image-stroke');
    const propImgRot = document.getElementById('prop-image-rot');
    const btnRemImg = document.getElementById('btn-remove-image-url');
    if (propImgFile) {
      propImgFile.onchange = (e) => {
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
      };
    }
    if (propImgFit) propImgFit.onchange = (e) => updateCurrent(it => it.objectFit = e.target.value);
    if (propImgOpacity) propImgOpacity.oninput = (e) => {
      const pct = Math.max(10, Math.min(100, parseFloat(e.target.value) || 100));
      if (propImgOpacity.nextElementSibling) propImgOpacity.nextElementSibling.textContent = `${pct}%`;
      updateCurrent(it => it.opacity = pct / 100);
    };
    if (propImgStrokeW) propImgStrokeW.onchange = (e) => updateCurrent(it => it.strokeWidth = Math.max(0, parseFloat(e.target.value) || 0));
    if (propImgStroke) propImgStroke.onchange = (e) => updateCurrent(it => it.strokeColor = e.target.value);
    if (propImgRot) propImgRot.onchange = (e) => updateCurrent(it => it.rotation = parseFloat(e.target.value) || 0);
    if (btnRemImg) btnRemImg.onclick = () => { updateCurrent(it => it.imageUrl = ''); composer.updatePropertiesPanel(); };

    const propLabelText = document.getElementById('prop-label-text');
    const propLabelSize = document.getElementById('prop-label-size');
    const propLabelLs = document.getElementById('prop-label-ls');
    const propLabelWeight = document.getElementById('prop-label-weight');
    const propLabelStyle = document.getElementById('prop-label-style');
    const propLabelTransform = document.getElementById('prop-label-transform');
    const propLabelAlign = document.getElementById('prop-label-align');
    const propLabelVAlign = document.getElementById('prop-label-valign');
    const propLabelColor = document.getElementById('prop-label-color');
    const propLabelBgOn = document.getElementById('prop-label-bg-on');
    const propLabelFill = document.getElementById('prop-label-fill');
    const propLabelStrokeW = document.getElementById('prop-label-strokew');
    const propLabelStroke = document.getElementById('prop-label-stroke');
    const propLabelRot = document.getElementById('prop-label-rot');

    if (propLabelText) propLabelText.oninput = (e) => updateCurrent(it => it.text = e.target.value);
    if (propLabelSize) propLabelSize.onchange = (e) => updateCurrent(it => it.fontSize = parseFloat(e.target.value) || 10);
    if (propLabelLs) propLabelLs.onchange = (e) => updateCurrent(it => it.letterSpacing = Math.max(0, parseFloat(e.target.value) || 0));
    if (propLabelWeight) propLabelWeight.onchange = (e) => updateCurrent(it => it.fontWeight = e.target.value);
    if (propLabelStyle) propLabelStyle.onchange = (e) => updateCurrent(it => it.fontStyle = e.target.value);
    if (propLabelTransform) propLabelTransform.onchange = (e) => updateCurrent(it => it.textTransform = e.target.value);
    if (propLabelAlign) propLabelAlign.onchange = (e) => updateCurrent(it => it.textAlign = e.target.value);
    if (propLabelVAlign) propLabelVAlign.onchange = (e) => updateCurrent(it => it.verticalAlign = e.target.value);
    if (propLabelColor) propLabelColor.onchange = (e) => updateCurrent(it => it.textColor = e.target.value);
    if (propLabelBgOn) propLabelBgOn.onchange = (e) => updateCurrent(it => it.fillColor = e.target.checked ? (propLabelFill?.value || '#ffffff') : '');
    if (propLabelFill) propLabelFill.oninput = (e) => updateCurrent(it => { it.fillColor = e.target.value; if (propLabelBgOn) propLabelBgOn.checked = true; });
    if (propLabelStrokeW) propLabelStrokeW.onchange = (e) => updateCurrent(it => it.strokeWidth = Math.max(0, parseFloat(e.target.value) || 0));
    if (propLabelStroke) propLabelStroke.onchange = (e) => updateCurrent(it => it.strokeColor = e.target.value);
    if (propLabelRot) propLabelRot.onchange = (e) => updateCurrent(it => it.rotation = parseFloat(e.target.value) || 0);

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
    const propGridFormat = document.getElementById('prop-map-grid-format');
    const propGridLabelRot = document.getElementById('prop-map-grid-label-rot');
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
        composer.mapRefreshers?.get(composer.selectedItemId)?.();
      });
    }
    if (propGridFormat) {
      propGridFormat.addEventListener('change', (e) => {
        updateCurrent(it => it.gridFormat = e.target.value);
        composer.mapRefreshers?.get(composer.selectedItemId)?.();
      });
    }
    if (propGridLabelRot) {
      propGridLabelRot.addEventListener('change', (e) => {
        updateCurrent(it => it.gridLabelRot = e.target.value);
        composer.mapRefreshers?.get(composer.selectedItemId)?.();
      });
    }
    if (btnPanMap) {
      btnPanMap.addEventListener('click', () => composer.setInteractionMode('content_pan'));
    }
    document.getElementById('btn-prop-open-vv')?.addEventListener('click', () => composer.openVisibilityDialog(composer.selectedItemId));

    // Temporários do mapa selecionado (padrão Revit: óculos escuros e lâmpada)
    const tempLayer = () => document.getElementById('prop-temp-layer')?.value;
    document.getElementById('btn-temp-isolate')?.addEventListener('click', () => {
      if (tempLayer()) composer.setTempView(composer.selectedItemId, { isolateLayers: new Set([tempLayer()]) });
    });
    document.getElementById('btn-temp-hide')?.addEventListener('click', () => {
      const cur = composer.tempViews.get(composer.selectedItemId);
      const hide = new Set([...(cur?.hideLayers || []), tempLayer()].filter(Boolean));
      composer.setTempView(composer.selectedItemId, { ...(cur || {}), hideLayers: hide });
    });
    document.getElementById('btn-temp-isolate-feature')?.addEventListener('click', async () => {
      const itemId = composer.selectedItemId;
      const feat = await composer.pickFeature(itemId, { message: 'Clique na feição que deve ficar sozinha no mapa (Esc cancela).' });
      if (feat) composer.setTempView(itemId, { isolateFeatures: new Set([String(feat.id)]) });
    });
    document.getElementById('btn-temp-reset')?.addEventListener('click', () => composer.setTempView(composer.selectedItemId, null));
    document.getElementById('btn-reveal-hidden')?.addEventListener('click', () => composer.toggleRevealHidden(composer.selectedItemId));
    const propLegendMap = document.getElementById('prop-legend-map');
    if (propLegendMap) {
      propLegendMap.addEventListener('change', (e) => {
        updateCurrent(it => { it.mapItemId = e.target.value; });
        composer.updatePropertiesPanel();
      });
    }

    // Rosa dos ventos
    const propArrow = document.getElementById('prop-arrow-style');
    const propArrowColor = document.getElementById('prop-arrow-color');
    const propArrowRot = document.getElementById('prop-arrow-rot');
    const propArrowRotRange = document.getElementById('prop-arrow-rot-range');

    if (propArrow) propArrow.addEventListener('change', (e) => updateCurrent(it => it.arrowStyle = e.target.value));
    if (propArrowColor) propArrowColor.addEventListener('input', (e) => updateCurrent(it => it.color = e.target.value));

    const syncArrowRot = (val) => {
      const rot = parseFloat(val) || 0;
      if (propArrowRot) propArrowRot.value = rot;
      if (propArrowRotRange) propArrowRotRange.value = rot;
      updateCurrent(it => it.rotation = rot);
    };

    if (propArrowRot) propArrowRot.addEventListener('input', (e) => syncArrowRot(e.target.value));
    if (propArrowRotRange) propArrowRotRange.addEventListener('input', (e) => syncArrowRot(e.target.value));

    // Barra de escala
    const propSbStyle = document.getElementById('prop-sb-style');
    const propSbSegments = document.getElementById('prop-sb-segments');
    const propSbUnits = document.getElementById('prop-sb-units');
    const propSbColor = document.getElementById('prop-sb-color');
    const propSbText = document.getElementById('prop-sb-text');
    const propSbBox = document.getElementById('prop-sb-box');
    if (propSbStyle) propSbStyle.addEventListener('change', (e) => updateCurrent(it => it.barStyle = e.target.value));
    if (propSbSegments) {
      propSbSegments.addEventListener('change', (e) => {
        const n = Math.min(8, Math.max(1, Math.round(parseFloat(e.target.value) || 4)));
        e.target.value = n;
        updateCurrent(it => it.segments = n);
      });
    }
    if (propSbUnits) propSbUnits.addEventListener('change', (e) => updateCurrent(it => it.units = e.target.value));
    if (propSbColor) propSbColor.addEventListener('input', (e) => updateCurrent(it => it.barColor = e.target.value));
    if (propSbText) propSbText.addEventListener('change', (e) => updateCurrent(it => it.showScaleText = e.target.checked));
    if (propSbBox) propSbBox.addEventListener('change', (e) => updateCurrent(it => it.showBox = e.target.checked));

    // Legenda
    const propLegendTitle = document.getElementById('prop-legend-title');
    if (propLegendTitle) propLegendTitle.addEventListener('input', (e) => updateCurrent(it => it.title = e.target.value));
    const setFont = (e) => updateCurrent(it => { it.fontFamily = e.target.value === 'sans' && !it.fontFamily ? undefined : PrintFonts.normalize(e.target.value); });
    ['prop-label-font', 'prop-text-font', 'prop-legend-font'].forEach(id => document.getElementById(id)?.addEventListener('change', setFont));
    document.getElementById('prop-legend-columns')?.addEventListener('change', (e) => updateCurrent(it => { it.legendColumns = Math.min(3, Math.max(1, parseInt(e.target.value, 10) || 1)); }));
    document.getElementById('prop-legend-count')?.addEventListener('change', (e) => updateCurrent(it => it.showFeatureCount = !!e.target.checked));
    document.getElementById('prop-legend-area')?.addEventListener('change', (e) => updateCurrent(it => it.showAreaHa = !!e.target.checked));
    document.getElementById('prop-legend-hdr-bg')?.addEventListener('change', (e) => updateCurrent(it => it.showHeaderBg = !!e.target.checked));
    document.getElementById('prop-legend-hdr-color')?.addEventListener('input', (e) => updateCurrent(it => it.headerColor = e.target.value));
    document.getElementById('prop-legend-border')?.addEventListener('change', (e) => updateCurrent(it => it.showBorder = !!e.target.checked));
    const propLegendAlpha = document.getElementById('prop-legend-alpha');
    if (propLegendAlpha) {
      propLegendAlpha.addEventListener('input', (e) => {
        const pct = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
        if (propLegendAlpha.nextElementSibling) propLegendAlpha.nextElementSibling.textContent = `${pct}%`;
        updateCurrent(it => it.bgOpacity = pct / 100);
      });
    }
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

    // Tabela de vértices e Quadro de Áreas
    document.getElementById('prop-vert-mode')?.addEventListener('change', (e) => {
      updateCurrent(it => { it.tableMode = e.target.value; });
      composer.updatePropertiesPanel();
    });
    document.getElementById('prop-vert-title')?.addEventListener('input', (e) => updateCurrent(it => it.title = e.target.value));
    document.getElementById('prop-vert-feature')?.addEventListener('change', (e) => updateCurrent(it => it.targetFeatureId = e.target.value || null));
    document.getElementById('prop-vert-crs')?.addEventListener('change', (e) => {
      updateCurrent(it => {
        it.crs = e.target.value;
        it.columns = null;
      });
      composer.updatePropertiesPanel();
    });
    document.getElementById('prop-vert-segfmt')?.addEventListener('change', (e) => updateCurrent(it => it.segmentFormat = e.target.value));
    document.getElementById('prop-vert-prefix')?.addEventListener('input', (e) => updateCurrent(it => it.vertexPrefix = e.target.value));
    document.getElementById('prop-vert-start')?.addEventListener('change', (e) => updateCurrent(it => it.startVertex = Math.max(1, parseInt(e.target.value, 10) || 1)));
    document.getElementById('prop-vert-end')?.addEventListener('change', (e) => updateCurrent(it => it.endVertex = Math.max(0, parseInt(e.target.value, 10) || 0)));
    document.getElementById('prop-vert-hdr-color')?.addEventListener('input', (e) => updateCurrent(it => it.headerBgColor = e.target.value));
    document.getElementById('prop-vert-footer')?.addEventListener('change', (e) => updateCurrent(it => it.showFooter = !!e.target.checked));
    document.querySelectorAll('[data-vert-col]').forEach(chk => {
      chk.addEventListener('change', () => {
        updateCurrent(it => {
          const all = Array.from(document.querySelectorAll('[data-vert-col]'))
            .filter(c => c.checked)
            .map(c => c.getAttribute('data-vert-col'));
          if (all.length > 0) it.columns = all;
          else chk.checked = true;
        });
      });
    });
    document.getElementById('btn-split-vert-table')?.addEventListener('click', () => {
      const created = composer.splitVerticesTableContinuation?.(composer.selectedItemId);
      if (!created) {
        UIToast.notificar({ tipo: 'info', titulo: 'Tabela já completa', mensagem: 'Todos os vértices exibidos já cabem na tabela atual.', duracao: 2500 });
      }
    });

    // Bloco de Notas Técnicas
    const propTextTitle = document.getElementById('prop-text-title');
    const propTextBody = document.getElementById('prop-text-body');
    const propTextSize = document.getElementById('prop-text-size');

    if (propTextTitle) propTextTitle.addEventListener('input', (e) => updateCurrent(it => it.title = e.target.value));
    if (propTextBody) propTextBody.addEventListener('input', (e) => updateCurrent(it => it.text = e.target.value));
    if (propTextSize) propTextSize.addEventListener('change', (e) => updateCurrent(it => it.fontSize = parseFloat(e.target.value) || 7.5));
    document.getElementById('prop-text-show-title')?.addEventListener('change', (e) => updateCurrent(it => it.showTitle = !!e.target.checked));
    document.getElementById('prop-text-align')?.addEventListener('change', (e) => updateCurrent(it => it.textAlign = e.target.value));
    document.getElementById('prop-text-cols')?.addEventListener('change', (e) => updateCurrent(it => it.columns = parseInt(e.target.value, 10) === 2 ? 2 : 1));
    document.getElementById('prop-text-color')?.addEventListener('input', (e) => updateCurrent(it => it.textColor = e.target.value));
    document.getElementById('prop-text-hdr-color')?.addEventListener('input', (e) => updateCurrent(it => it.headerColor = e.target.value));
    document.getElementById('prop-text-border')?.addEventListener('change', (e) => updateCurrent(it => it.showBorder = !!e.target.checked));
    document.getElementById('btn-generate-memorial')?.addEventListener('click', () => {
      const memorial = PrintItemsManager.generateDescriptiveMemorial(composer.features, null);
      updateCurrent(it => {
        it.title = 'MEMORIAL DESCRITIVO';
        it.text = memorial;
      });
      composer.updatePropertiesPanel();
      UIToast.notificar({ tipo: 'sucesso', titulo: 'Memorial Gerado', mensagem: 'Memorial descritivo ABNT preenchido a partir da feição.', duracao: 2500 });
    });

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

    const propTbDrawn = document.getElementById('prop-tb-drawn');
    const propTbDoc = document.getElementById('prop-tb-doc');
    const propTbRev = document.getElementById('prop-tb-rev');
    const propTbSignature = document.getElementById('prop-tb-signature');
    const propTbAccent = document.getElementById('prop-tb-accent');
    const btnTbFitHeight = document.getElementById('btn-tb-fit-height');
    if (propTbDrawn) propTbDrawn.addEventListener('input', (e) => updateTbProp('drawnBy', e.target.value));
    if (propTbDoc) propTbDoc.addEventListener('input', (e) => updateTbProp('docNumber', e.target.value));
    if (propTbRev) propTbRev.addEventListener('input', (e) => updateTbProp('revision', e.target.value));
    if (propTbSignature) propTbSignature.addEventListener('change', (e) => updateTbProp('showSignature', !!e.target.checked));
    if (propTbAccent) propTbAccent.addEventListener('input', (e) => updateTbProp('accentColor', e.target.value));

    document.getElementById('btn-tb-add-custom')?.addEventListener('click', () => {
      updateCurrent(it => {
        it.properties = it.properties || {};
        const list = Array.isArray(it.properties.customFields) ? [...it.properties.customFields] : [];
        list.push({ label: `Campo ${list.length + 1}`, value: '' });
        it.properties.customFields = list;
      });
      composer.updatePropertiesPanel();
    });
    document.querySelectorAll('[data-tb-cf-label]').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(inp.getAttribute('data-tb-cf-label'), 10);
        updateCurrent(it => {
          const list = it.properties?.customFields;
          if (Array.isArray(list) && list[idx]) list[idx].label = e.target.value;
        });
      });
    });
    document.querySelectorAll('[data-tb-cf-val]').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(inp.getAttribute('data-tb-cf-val'), 10);
        updateCurrent(it => {
          const list = it.properties?.customFields;
          if (Array.isArray(list) && list[idx]) list[idx].value = e.target.value;
        });
      });
    });
    document.querySelectorAll('[data-tb-cf-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-tb-cf-del'), 10);
        updateCurrent(it => {
          if (Array.isArray(it.properties?.customFields)) it.properties.customFields.splice(idx, 1);
        });
        composer.updatePropertiesPanel();
      });
    });
    if (btnTbFitHeight) {
      btnTbFitHeight.addEventListener('click', () => {
        updateCurrent(it => {
          if (it.type !== 'title_block') return;
          // Cresce/encolhe ancorado na borda mais próxima (o carimbo costuma ficar embaixo)
          const anchorBottom = it.y + it.height / 2 > composer.paperSize.height / 2;
          const bottom = it.y + it.height;
          it.height = PrintTitleBlockRenderer.idealHeightMm(it, composer.projectName);
          if (anchorBottom) it.y = bottom - it.height;
          PrintItemsManager.clampItemToPaper(it, composer.paperSize);
        }, false, true);
        composer.updatePropertiesPanel();
      });
    }

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

    const btnSyncMeta = document.getElementById('btn-sync-project-meta-carimbo');
    if (btnSyncMeta) {
      btnSyncMeta.addEventListener('click', () => {
        const it = composer.items.find(i => i.id === composer.selectedItemId);
        if (!it || it.type !== 'title_block' || it.locked) return;
        const updated = PrintItemsManager.syncTitleBlockWithProject(it, composer);
        if (updated && updated.length > 0) {
          composer.refreshItemContent(it);
          composer.updatePropertiesPanel();
          composer.pushHistoryState('Sincronizar Selo ABNT');
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'Selo ABNT Atualizado',
            mensagem: `Campos sincronizados: ${updated.join(', ')}.`,
            duracao: 3000
          });
        }
      });
    }
  }
}

