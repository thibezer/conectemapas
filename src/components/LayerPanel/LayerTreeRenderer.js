/* ==========================================================================
   ConecteMapas - LayerTreeRenderer
   Responsabilidade Única: Renderização HTML da Árvore de Camadas, Feições,
   Rodapé Illustrator e Seletor de Mapa Base.
   ========================================================================== */

import { GeometryVersionManager } from '../../services/GeometryVersionManager.js';

export class LayerTreeRenderer {
  static render(panel) {
    const q = (panel.searchQuery || '').trim().toLowerCase();

    const featsByLayer = new Map();
    for (let i = 0; i < panel.features.length; i++) {
      const f = panel.features[i];
      if (!featsByLayer.has(f.layerId)) featsByLayer.set(f.layerId, []);
      featsByLayer.get(f.layerId).push(f);
    }

    let displayLayers = panel.layers;
    if (q) {
      displayLayers = panel.layers.filter(layer => {
        const nameMatch = (layer.name || '').toLowerCase().includes(q);
        const layerFeats = featsByLayer.get(layer.id) || [];
        const featMatch = layerFeats.some(f => 
          (f.name || '').toLowerCase().includes(q) || 
          (f.category || '').toLowerCase().includes(q) ||
          (f.type || '').toLowerCase().includes(q)
        );
        return nameMatch || featMatch;
      });
    }

    const allExpanded = panel.layers.every(l => panel.expandedLayers.has(l.id));
    const allVisible = panel.layers.every(l => l.visible !== false);

    const selectedFeaturesList = panel.features.filter(f => panel.selectedFeatureIds.has(f.id));
    const hasSelection = selectedFeaturesList.length > 0;

    let bulkMetricStr = '';
    const polySelected = selectedFeaturesList.filter(f => f.type === 'Polygon');
    if (polySelected.length > 0) {
      const sumAreaM2 = polySelected.reduce((acc, f) => acc + (panel.calculatePolygonArea(f.coordinates) || 0), 0);
      bulkMetricStr = `${(sumAreaM2 / 10000).toFixed(1)} ha`;
    } else {
      const lineSelected = selectedFeaturesList.filter(f => f.type === 'LineString');
      if (lineSelected.length > 0) {
        const sumLenM = lineSelected.reduce((acc, f) => acc + (panel.calculatePolylineLength(f.coordinates) || 0), 0);
        bulkMetricStr = sumLenM > 1000 ? `${(sumLenM / 1000).toFixed(1)} km` : `${sumLenM.toFixed(0)} m`;
      }
    }

    return `
      <!-- Toolbar Superior da Árvore de Camadas (UI Componentes) -->
      <div class="cm-tree-toolbar">
        <div class="cm-tree-title-group">
          <span class="cm-tree-section-title">CAMADAS</span>
          <ui-badge variante="primario" tamanho="sm">${panel.layers.length}</ui-badge>
        </div>
        <div class="cm-tree-actions">
          <ui-botao-primario inline variante="ghost" id="btn-toggle-all-vis" title="${allVisible ? 'Ocultar Todas as Camadas' : 'Exibir Todas as Camadas'}" style="height: 22px; padding: 0 5px; font-size: 11px;">
            ${allVisible ? '👁️' : '🚫'}
          </ui-botao-primario>
          <ui-botao-primario inline variante="ghost" id="btn-toggle-all-expand" title="${allExpanded ? 'Recolher Todos os Grupos' : 'Expandir Todos os Grupos'}" style="height: 22px; padding: 0 5px; font-size: 11px;">
            ${allExpanded ? '📁' : '📂'}
          </ui-botao-primario>
          <ui-botao-primario inline variante="primary" id="btn-add-layer" title="Adicionar nova camada vetorial" style="height: 22px; padding: 0 7px; font-size: 10.5px; font-weight: 600;">
            + Camada
          </ui-botao-primario>
        </div>
      </div>

      <!-- Barra de Busca Rápida com ui-campo-texto -->
      <div class="cm-tree-search-wrapper" style="display: flex; gap: 4px; align-items: center; margin: 4px 0 6px 0;">
        <ui-campo-texto 
          id="input-layer-search" 
          placeholder="Buscar camada ou feição..." 
          tipo="text" 
          value="${panel.escapeHtml(panel.searchQuery || '')}"
          style="flex: 1; --ui-campo-altura: 26px; --ui-altura-minima: 26px; font-size: 11.5px;">
        </ui-campo-texto>
        ${panel.searchQuery ? `
          <ui-botao-primario inline variante="ghost" id="btn-clear-layer-search" title="Limpar busca" style="height: 26px; padding: 0 6px; font-size: 11px;">
            ✕
          </ui-botao-primario>
        ` : ''}
      </div>

      <!-- Estrutura Unificada da Árvore + Rodapé Illustrator -->
      <div class="cm-ai-panel-box">
        <div class="cm-ai-layer-tree" id="cm-ai-layer-tree-mount">
          ${displayLayers.map((layer) => {
            const safeName = panel.escapeHtml(layer.name || 'Camada');
            const safeId = panel.escapeHtml(layer.id || '');
            const safeColor = panel.escapeHtml(layer.color || '#00E08A');
            const isVisible = layer.visible !== false;
            const isLocked = layer.locked === true;
            const isExpanded = q ? true : panel.expandedLayers.has(layer.id);
            const isSettingsOpen = panel.activeSettingsLayerId === layer.id;

            let layerFeatures = featsByLayer.get(layer.id) || [];
            if (q) {
              layerFeatures = layerFeatures.filter(f => 
                (f.name || '').toLowerCase().includes(q) || 
                (f.category || '').toLowerCase().includes(q) ||
                (f.type || '').toLowerCase().includes(q)
              );
            }

            const allFeatsSelected = layerFeatures.length > 0 && layerFeatures.every(f => panel.selectedFeatureIds.has(f.id));
            const someFeatsSelected = !allFeatsSelected && layerFeatures.some(f => panel.selectedFeatureIds.has(f.id));
            const isActiveLayer = panel.activeLayerId === layer.id;

            return `
            <div class="cm-ai-layer-group" data-layer-id="${safeId}">
              <div class="cm-ai-layer-row ${!isVisible ? 'hidden-layer' : ''} ${isActiveLayer ? 'active-drawing-layer' : ''}" data-layer-row="${safeId}" data-layer-id="${safeId}" draggable="true" style="--layer-active-color: ${safeColor};">
                <div class="cm-ai-col cm-ai-col-drag" title="Arrastar para reordenar Z-Index">⠿</div>
                <div class="cm-ai-col cm-ai-col-eye" data-layer-eye="${safeId}" title="${isVisible ? 'Ocultar Camada' : 'Exibir Camada'}">
                  ${isVisible ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>` : `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`}
                </div>
                <div class="cm-ai-col cm-ai-col-lock" data-layer-lock="${safeId}" title="${isLocked ? 'Desbloquear Camada' : 'Bloquear Camada'}">
                  ${isLocked ? `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#f59e0b" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>` : ''}
                </div>
                <div class="cm-ai-col-colorbar" style="background: ${safeColor};"></div>
                <div class="cm-ai-col cm-ai-col-chevron" data-layer-expand="${safeId}">
                  <span class="cm-ai-chevron-icon ${isExpanded ? 'open' : ''}">▶</span>
                </div>
                <div class="cm-ai-col cm-ai-col-name" data-layer-name-trigger="${safeId}" title="Clique para ativar camada de desenho | Duplo clique para renomear">
                  ${panel.editingLayerId === layer.id ? `
                    <input type="text" class="cm-inline-rename-input" data-inline-layer-input="${safeId}" value="${safeName}" />
                  ` : `
                    <span class="cm-ai-name-text">${safeName}</span>
                    ${isActiveLayer ? `<ui-badge variante="sucesso" style="font-size: 9.5px; padding: 1px 5px;">✏️ Ativa</ui-badge>` : ''}
                    <ui-badge variante="neutro" style="font-size: 9.5px; padding: 1px 5px;">${layerFeatures.length}</ui-badge>
                  `}
                </div>
                <div class="cm-ai-col cm-ai-col-actions">
                  <ui-botao-primario inline variante="ghost" data-layer-fit="${safeId}" title="Enquadrar camada no mapa" style="height: 20px; width: 20px; padding: 0; min-width: 20px; font-size: 10px;">🎯</ui-botao-primario>
                  <ui-botao-primario inline variante="ghost" class="${isSettingsOpen ? 'active' : ''}" data-layer-settings="${safeId}" title="Opacidade e configurações" style="height: 20px; width: 20px; padding: 0; min-width: 20px; font-size: 10px;">⚙️</ui-botao-primario>
                </div>
                <div class="cm-ai-col cm-ai-col-target" data-layer-target="${safeId}" title="Selecionar todas as feições deste grupo">
                  <div class="cm-ai-target-circle ${allFeatsSelected ? 'selected' : (someFeatsSelected ? 'partial' : '')}"></div>
                </div>
              </div>

              ${isSettingsOpen ? `
                <div class="cm-ai-settings-drawer">
                  <div class="cm-ai-drawer-header">Configurações da Camada</div>
                  <div class="cm-ai-drawer-row">
                    <span class="cm-ai-drawer-label">Cor:</span>
                    <input type="color" data-layer-color-picker="${safeId}" value="${safeColor}" class="cm-ai-drawer-color" />
                    <span class="cm-ai-drawer-label" style="margin-left: 8px;">Opacidade:</span>
                    <input type="range" min="0.1" max="1" step="0.05" value="${layer.opacity !== undefined ? layer.opacity : 1}" data-layer-opacity-slider="${safeId}" class="cm-ai-drawer-slider" />
                    <ui-badge variante="primario" id="badge-op-${safeId}" style="font-size: 10px;">${Math.round((layer.opacity !== undefined ? layer.opacity : 1) * 100)}%</ui-badge>
                  </div>
                  <div class="cm-ai-drawer-row" style="margin-top: 6px;">
                    <ui-botao-primario inline variante="destrutivo" data-delete-layer="${safeId}" style="height: 24px; font-size: 10.5px; padding: 0 8px;">🗑️ Excluir Camada</ui-botao-primario>
                  </div>
                </div>
              ` : ''}

              <div class="cm-ai-children-container" style="display: ${isExpanded ? 'block' : 'none'};">
                ${(() => {
                  const maxTreeItems = 60;
                  const visibleTreeFeats = layerFeatures.slice(0, maxTreeItems);
                  const hasTruncated = layerFeatures.length > maxTreeItems;

                  const itemsHtml = visibleTreeFeats.map((feat) => {
                    const featName = panel.escapeHtml(feat.name || 'Feição');
                    const featId = panel.escapeHtml(feat.id || '');
                    const featColor = panel.escapeHtml(feat.color || safeColor);
                    const isFeatVisible = feat.visible !== false;
                    const isFeatLocked = feat.locked === true || isLocked;
                    const isFeatSelected = panel.selectedFeatureIds.has(feat.id);

                    let thumbSvg = '';
                    if (feat.type === 'Polygon') {
                      thumbSvg = `<svg viewBox="0 0 16 16" width="12" height="12"><polygon points="2,14 14,14 12,2 4,4" fill="${featColor}" fill-opacity="0.5" stroke="${featColor}" stroke-width="1.5"/></svg>`;
                    } else if (feat.type === 'LineString') {
                      thumbSvg = `<svg viewBox="0 0 16 16" width="12" height="12"><polyline points="2,13 8,3 14,10" fill="none" stroke="${featColor}" stroke-width="2"/></svg>`;
                    } else {
                      thumbSvg = `<svg viewBox="0 0 16 16" width="12" height="12"><circle cx="8" cy="8" r="4.5" fill="${featColor}" stroke="#fff" stroke-width="1.2"/></svg>`;
                    }

                    return `
                      <div class="cm-ai-feat-row ${isFeatSelected ? 'selected-row' : ''} ${!isFeatVisible ? 'hidden-row' : ''}" data-feat-row="${featId}" data-feat-select="${featId}" data-feat-layer="${safeId}" draggable="true" title="Clique para selecionar | Arraste para reordenar">
                        <div class="cm-ai-col cm-ai-col-eye" data-feat-eye="${featId}" title="${isFeatVisible ? 'Ocultar' : 'Exibir'}">
                          ${isFeatVisible ? `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>` : `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`}
                        </div>
                        <div class="cm-ai-col cm-ai-col-lock" data-feat-lock="${featId}" title="${isFeatLocked ? 'Desbloquear' : 'Bloquear'}">
                          ${isFeatLocked ? `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#f59e0b" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>` : ''}
                        </div>
                        <div class="cm-ai-col cm-ai-col-colorbar" style="background: ${featColor};"></div>
                        <div class="cm-ai-col cm-ai-col-branch"><span class="cm-ai-branch-line">└</span></div>
                        <div class="cm-ai-col cm-ai-col-thumb"><div class="cm-ai-thumb-box">${thumbSvg}</div></div>
                        <div class="cm-ai-col cm-ai-col-name" data-feat-name-trigger="${featId}" title="Duplo clique para renomear">
                          ${panel.editingFeatureId === feat.id ? `
                            <input type="text" class="cm-inline-rename-input" data-inline-feat-input="${featId}" value="${featName}" />
                          ` : `
                            <span class="cm-ai-name-text">${featName}</span>
                            ${(() => {
                              const status = GeometryVersionManager.getFeatureStatus(feat);
                              if (status === 'oficial') {
                                return `<ui-badge variante="sucesso" style="font-size: 9px; padding: 1px 4px;" title="Geometria Oficial">OFICIAL</ui-badge>`;
                              } else if (status === 'previa') {
                                const hasOficial = GeometryVersionManager.hasOfficialGeometry(feat, panel.features);
                                const isDefault = !hasOficial;
                                return `<ui-badge variante="alerta" style="font-size: 9px; padding: 1px 4px;" title="${isDefault ? 'Geometria Prévia (Padrão no mapa - Sem Oficial)' : 'Geometria Prévia (Exibida sob demanda)'}">PRÉVIA${isDefault ? ' ★' : ''}</ui-badge>`;
                              }
                              return '';
                            })()}
                          `}
                        </div>
                        <div class="cm-ai-col cm-ai-col-actions">
                          <ui-botao-primario inline variante="ghost" data-feat-fit="${featId}" title="Enquadrar no mapa" style="height: 18px; width: 18px; padding: 0; min-width: 18px; font-size: 9px;">🎯</ui-botao-primario>
                        </div>
                        <div class="cm-ai-col cm-ai-col-target" data-feat-target="${featId}" title="Selecionar feição">
                          <div class="cm-ai-target-circle ${isFeatSelected ? 'selected' : ''}"></div>
                        </div>
                      </div>
                    `;
                  }).join('');

                  const footerNotice = hasTruncated ? `
                    <div style="padding: 6px 12px; font-size: 11px; color: var(--cm-text-muted); font-style: italic; background: rgba(0,0,0,0.15); border-radius: 4px; margin: 4px 8px;">
                      ⚡ Exibindo ${maxTreeItems} de ${layerFeatures.length.toLocaleString('pt-BR')} feições. Use a busca acima para filtrar.
                    </div>
                  ` : '';

                  return itemsHtml + footerNotice;
                })()}
                ${layerFeatures.length === 0 ? `<div class="cm-ai-empty-row"><span>${q ? 'Nenhum item correspondente' : 'Nenhum elemento neste grupo'}</span></div>` : ''}
              </div>
            </div>
          `;
          }).join('')}
        </div>

        <!-- Rodapé Estilo Adobe Illustrator (UI Componentes) -->
        <div class="cm-ai-tree-footer">
          <div class="cm-ai-footer-left">
            <ui-badge variante="primario" style="margin-right: 4px;">${hasSelection ? selectedFeaturesList.length : panel.layers.length}</ui-badge>
            <span class="cm-ai-footer-label">${hasSelection ? (selectedFeaturesList.length > 1 ? 'selecionados' : 'selecionado') : 'camadas'}</span>
            ${bulkMetricStr ? `<span class="cm-ai-footer-metric">• ${bulkMetricStr}</span>` : ''}
          </div>
          <div class="cm-ai-footer-right">
            <ui-botao-primario inline variante="ghost" class="${!hasSelection ? 'disabled' : ''}" id="btn-footer-vis" title="Alternar visibilidade coletiva" style="height: 22px; width: 22px; padding: 0; min-width: 22px;" ${!hasSelection ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </ui-botao-primario>
            <ui-botao-primario inline variante="ghost" class="${!hasSelection ? 'disabled' : ''}" id="btn-footer-lock" title="Alternar bloqueio coletivo" style="height: 22px; width: 22px; padding: 0; min-width: 22px;" ${!hasSelection ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </ui-botao-primario>
            <div class="cm-ai-footer-color-wrapper ${!hasSelection ? 'disabled' : ''}" title="Alterar cor dos selecionados">
              <input type="color" id="input-footer-color" value="#00E08A" class="cm-ai-footer-color" ${!hasSelection ? 'disabled' : ''} />
            </div>
            <div class="cm-ai-footer-move-wrapper ${!hasSelection ? 'disabled' : ''}" title="Mover selecionados para outra camada">
              <select id="select-footer-move-layer" class="cm-ai-footer-select" ${!hasSelection ? 'disabled' : ''}>
                <option value="" disabled selected>📁</option>
                ${panel.layers.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
              </select>
            </div>
            <ui-botao-primario inline variante="primary" id="btn-footer-new-layer" title="Criar Nova Camada" style="height: 22px; width: 22px; padding: 0; min-width: 22px;">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            </ui-botao-primario>
            <ui-botao-primario inline variante="destrutivo" class="${!hasSelection ? 'disabled' : ''}" id="btn-footer-del" title="Excluir selecionados" style="height: 22px; width: 22px; padding: 0; min-width: 22px;" ${!hasSelection ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </ui-botao-primario>
            ${hasSelection ? `<ui-botao-primario inline variante="ghost" id="btn-footer-clear" title="Limpar seleção" style="height: 22px; padding: 0 6px; font-size: 11px;">✕</ui-botao-primario>` : ''}
          </div>
        </div>
      </div>

      <!-- Seção: Mapa Base -->
      <div class="cm-sidebar-section-header" style="margin-top: 6px;">
        <span class="cm-sidebar-section-title">Mapa Base</span>
      </div>
      <div class="cm-basemap-grid">
        <div class="cm-basemap-card ${(!panel.currentBasemap || panel.currentBasemap === 'none') ? 'active' : ''}" data-basemap="none" title="Sem Mapa Base (Tela CAD Neutra)">
          <div class="cm-basemap-none-preview">🚫</div>
          <span>🚫 Sem Mapa</span>
        </div>
        <div class="cm-basemap-card ${panel.currentBasemap === 'google_satelite_puro' ? 'active' : ''}" data-basemap="google_satelite_puro" title="Google Maps Satélite Puro (sem ruas ou rótulos)">
          <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=160&auto=format&fit=crop&q=80" alt="Google Satélite Puro" onerror="this.style.display='none'" />
          <span>🛰️ Google Puro</span>
        </div>
        <div class="cm-basemap-card ${panel.currentBasemap === 'google_satelite' ? 'active' : ''}" data-basemap="google_satelite" title="Google Maps Satélite Híbrido (com ruas e nomes)">
          <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=160&auto=format&fit=crop&q=80" alt="Google Híbrido" onerror="this.style.display='none'" />
          <span>🗺️ Google Híbrido</span>
        </div>
        <div class="cm-basemap-card ${panel.currentBasemap === 'satelite' ? 'active' : ''}" data-basemap="satelite" title="Satélite de Alta Resolução Esri">
          <img src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=160&auto=format&fit=crop&q=80" alt="Esri Satélite" onerror="this.style.display='none'" />
          <span>🛰️ Esri Satélite</span>
        </div>
        <div class="cm-basemap-card ${panel.currentBasemap === 'osm' ? 'active' : ''}" data-basemap="osm" title="Mapa Urbano OpenStreetMap">
          <img src="https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=160&auto=format&fit=crop&q=80" alt="OSM" onerror="this.style.display='none'" />
          <span>🗺️ OpenStreet</span>
        </div>
        <div class="cm-basemap-card ${panel.currentBasemap === 'topografia' ? 'active' : ''}" data-basemap="topografia" title="Mapa de Curvas de Nível e Relevo">
          <img src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=160&auto=format&fit=crop&q=80" alt="Topografia" onerror="this.style.display='none'" />
          <span>⛰️ Topografia</span>
        </div>
        <div class="cm-basemap-card ${panel.currentBasemap === 'dark' ? 'active' : ''}" data-basemap="dark" title="Mapa Escuro Esri Dark Canvas">
          <img src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=160&auto=format&fit=crop&q=80" alt="Dark" onerror="this.style.display='none'" />
          <span>🌑 Dark Canvas</span>
        </div>
      </div>
    `;

  }
}
