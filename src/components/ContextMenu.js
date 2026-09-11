/* ==========================================================================
   ConecteMapas - ContextMenu Component (SRP Encapsulated)
   Menu de Contexto do Botão Direito (AutoCAD & GIS Context Menu)
   ========================================================================== */

import './ContextMenu.css';
import { SpatialAlgorithms } from '../services/SpatialAlgorithms.js';
import { UIToast } from 'ui-components-kit';

export class ContextMenu {
  /**
   * @param {Object} app Instância principal do ConecteMapasApp
   */
  constructor(app) {
    this.app = app;
    this.menuElement = null;
    this._closeHandler = this.close.bind(this);
  }

  /**
   * Abre o menu de contexto na posição do mouse
   * @param {Object} params
   * @param {Object} params.latlng { lat, lng }
   * @param {Object} params.point { x, y }
   * @param {MouseEvent} params.originalEvent
   * @param {Object|null} params.feature Feição alvo (se clicada)
   */
  open({ latlng, point, originalEvent, feature = null }) {
    this.close();

    const clientX = originalEvent ? originalEvent.clientX : (point?.x || 100);
    const clientY = originalEvent ? originalEvent.clientY : (point?.y || 100);

    const menu = document.createElement('div');
    menu.className = 'cm-context-menu';
    menu.id = 'cm-context-menu';

    // Se houver feição alvo (ou se já havia feição selecionada sob o cursor)
    const activeFeat = feature || (this.app.mapEngine?.selectedFeatureId 
      ? this.app.features.find(f => f.id === this.app.mapEngine.selectedFeatureId) 
      : null);

    if (activeFeat) {
      // Se não estava selecionada, seleciona para foco imediato
      if (this.app.mapEngine.selectedFeatureId !== activeFeat.id) {
        this.app.mapEngine.selectFeature(activeFeat.id);
        if (this.app.layerPanel) this.app.layerPanel.setSelectedFeature(activeFeat);
      }
      this.renderFeatureMenu(menu, activeFeat, latlng);
    } else {
      this.renderMapMenu(menu, latlng);
    }

    document.body.appendChild(menu);
    this.menuElement = menu;

    // Posicionamento inteligente (evita sair da tela)
    const rect = menu.getBoundingClientRect();
    let posX = clientX;
    let posY = clientY;

    if (posX + rect.width > window.innerWidth - 10) {
      posX = window.innerWidth - rect.width - 10;
    }
    if (posY + rect.height > window.innerHeight - 10) {
      posY = window.innerHeight - rect.height - 10;
    }

    menu.style.left = `${Math.max(10, posX)}px`;
    menu.style.top = `${Math.max(10, posY)}px`;

    // Fechar ao clicar fora, ao rolar mapa ou ao teclar ESC
    setTimeout(() => {
      window.addEventListener('click', this._closeHandler, { once: true });
      window.addEventListener('contextmenu', this._closeHandler, { once: true });
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.close();
      }, { once: true });
      if (this.app.mapEngine?.map) {
        this.app.mapEngine.map.once('movestart', this._closeHandler);
      }
    }, 10);
  }

  /**
   * Renderiza menu contextual quando clicado sobre uma Feição
   */
  renderFeatureMenu(menu, feat, latlng) {
    const layer = this.app.layers.find(l => l.id === feat.layerId) || { name: 'Camada Padrão', color: '#00E08A' };
    const isPoly = feat.type === 'Polygon';
    const isLine = feat.type === 'LineString';
    const isPoint = feat.type === 'Point';
    const isCircle = feat.type === 'Circle';
    const isLocked = feat.locked === true;

    const typeLabel = isPoly ? 'Área' : (isLine ? 'Rota' : (isCircle ? 'Raio' : 'Ponto'));

    menu.innerHTML = `
      <div class="cm-ctx-header">
        <div class="cm-ctx-title-row">
          <span style="color: ${layer.color || '#00E08A'};">●</span>
          <span>${this.escape(feat.name || 'Feição')}</span>
          <span class="cm-ctx-badge">${typeLabel}</span>
        </div>
        <div class="cm-ctx-subtitle">Camada: ${this.escape(layer.name)}</div>
      </div>

      <div class="cm-ctx-list">
        <div class="cm-ctx-item" data-action="inspect">
          <div class="cm-ctx-item-left">
            <span class="cm-ctx-icon">🔍</span>
            <span class="cm-ctx-text">Inspecionar Propriedades</span>
          </div>
          <span class="cm-ctx-shortcut">Enter</span>
        </div>

        <div class="cm-ctx-item" data-action="fit">
          <div class="cm-ctx-item-left">
            <span class="cm-ctx-icon">🎯</span>
            <span class="cm-ctx-text">Aproximar / Centralizar</span>
          </div>
          <span class="cm-ctx-shortcut">Z</span>
        </div>

        ${(isPoly || isLine) ? `
          <div class="cm-ctx-item" data-action="edit-vertex">
            <div class="cm-ctx-item-left">
              <span class="cm-ctx-icon">✏️</span>
              <span class="cm-ctx-text">Editar Vértices CAD</span>
            </div>
            <span class="cm-ctx-shortcut">F2</span>
          </div>
        ` : ''}

        <div class="cm-ctx-item" data-action="duplicate">
          <div class="cm-ctx-item-left">
            <span class="cm-ctx-icon">📋</span>
            <span class="cm-ctx-text">Duplicar Feição (+30m)</span>
          </div>
          <span class="cm-ctx-shortcut">Ctrl+D</span>
        </div>

        <div class="cm-ctx-submenu-wrap">
          <div class="cm-ctx-item" data-action="move-layer-trigger">
            <div class="cm-ctx-item-left">
              <span class="cm-ctx-icon">📁</span>
              <span class="cm-ctx-text">Mover para Camada...</span>
            </div>
            <span class="cm-ctx-shortcut">▶</span>
          </div>
          <div class="cm-ctx-submenu">
            ${this.app.layers.map(l => `
              <div class="cm-ctx-item ${l.id === feat.layerId ? 'active' : ''}" data-action="set-layer" data-layer-id="${l.id}">
                <div class="cm-ctx-item-left">
                  <span style="color: ${l.color};">●</span>
                  <span class="cm-ctx-text">${this.escape(l.name)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="cm-ctx-item" data-action="toggle-lock">
          <div class="cm-ctx-item-left">
            <span class="cm-ctx-icon">${isLocked ? '🔓' : '🔒'}</span>
            <span class="cm-ctx-text">${isLocked ? 'Desbloquear Feição' : 'Bloquear contra Edições'}</span>
          </div>
        </div>

        <div class="cm-ctx-divider"></div>

        <div class="cm-ctx-item" data-action="copy-coords">
          <div class="cm-ctx-item-left">
            <span class="cm-ctx-icon">📍</span>
            <span class="cm-ctx-text">Copiar Coordenadas</span>
          </div>
        </div>

        <div class="cm-ctx-divider"></div>

        <div class="cm-ctx-item cm-ctx-danger" data-action="delete">
          <div class="cm-ctx-item-left">
            <span class="cm-ctx-icon">🗑️</span>
            <span class="cm-ctx-text">Excluir Feição</span>
          </div>
          <span class="cm-ctx-shortcut">Del</span>
        </div>
      </div>
    `;

    this.bindEvents(menu, { feat, latlng });
  }

  /**
   * Renderiza menu contextual quando clicado em Área Aberta do Mapa
   */
  renderMapMenu(menu, latlng) {
    const lat = latlng ? latlng.lat.toFixed(5) : '0.00000';
    const lng = latlng ? latlng.lng.toFixed(5) : '0.00000';
    const activeLayer = this.app.layers.find(l => l.id === this.app.activeLayerId) || this.app.layers[0] || { name: 'Topografia', color: '#00E08A' };

    menu.innerHTML = `
      <div class="cm-ctx-header">
        <div class="cm-ctx-title-row">
          <span style="color: ${activeLayer.color || '#00E08A'};">✏️</span>
          <span>Ações no Ponto</span>
          <span class="cm-ctx-badge" style="color: ${activeLayer.color}; border-color: ${activeLayer.color}44;">${this.escape(activeLayer.name)}</span>
        </div>
        <div class="cm-ctx-subtitle">Lat: ${lat} | Lng: ${lng}</div>
      </div>

      <div class="cm-ctx-list">
        <div class="cm-ctx-item" data-action="add-point-here">
          <div class="cm-ctx-item-left">
            <span class="cm-ctx-icon">📍</span>
            <span class="cm-ctx-text">Criar Marco / Ponto Aqui</span>
          </div>
          <span class="cm-ctx-shortcut">P</span>
        </div>

        <div class="cm-ctx-item" data-action="start-line-here">
          <div class="cm-ctx-item-left">
            <span class="cm-ctx-icon">📐</span>
            <span class="cm-ctx-text">Traçar Linha / Rota Aqui</span>
          </div>
          <span class="cm-ctx-shortcut">L</span>
        </div>

        <div class="cm-ctx-item" data-action="start-polygon-here">
          <div class="cm-ctx-item-left">
            <span class="cm-ctx-icon">⬡</span>
            <span class="cm-ctx-text">Desenhar Polígono Aqui</span>
          </div>
          <span class="cm-ctx-shortcut">A</span>
        </div>

        <div class="cm-ctx-item" data-action="add-circle-here">
          <div class="cm-ctx-item-left">
            <span class="cm-ctx-icon">⭕</span>
            <span class="cm-ctx-text">Criar Raio de Cobertura (100m)</span>
          </div>
          <span class="cm-ctx-shortcut">C</span>
        </div>

        <div class="cm-ctx-item" data-action="measure-from-here">
          <div class="cm-ctx-item-left">
            <span class="cm-ctx-icon">📏</span>
            <span class="cm-ctx-text">Iniciar Medição a partir daqui</span>
          </div>
          <span class="cm-ctx-shortcut">M</span>
        </div>

        <div class="cm-ctx-divider"></div>

        <div class="cm-ctx-item" data-action="copy-coords">
          <div class="cm-ctx-item-left">
            <span class="cm-ctx-icon">📋</span>
            <span class="cm-ctx-text">Copiar Coordenadas (Lat/Lng)</span>
          </div>
        </div>

        <div class="cm-ctx-item" data-action="fit-all">
          <div class="cm-ctx-item-left">
            <span class="cm-ctx-icon">🎯</span>
            <span class="cm-ctx-text">Enquadrar Todo o Projeto</span>
          </div>
          <span class="cm-ctx-shortcut">Z</span>
        </div>

        ${(this.app.mapEngine?.selectedFeatureIds?.size > 0 || this.app.mapEngine?.selectedFeatureId) ? `
          <div class="cm-ctx-divider"></div>
          <div class="cm-ctx-item" data-action="clear-selection">
            <div class="cm-ctx-item-left">
              <span class="cm-ctx-icon">🧹</span>
              <span class="cm-ctx-text">Desmarcar Seleção Atual</span>
            </div>
            <span class="cm-ctx-shortcut">Esc</span>
          </div>
        ` : ''}
      </div>
    `;

    this.bindEvents(menu, { feat: null, latlng });
  }

  /**
   * Vincula cliques nos itens do menu
   */
  bindEvents(menu, { feat, latlng }) {
    menu.querySelectorAll('[data-action]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.getAttribute('data-action');
        this.close();

        // 1. Ações em Feição
        if (action === 'inspect' && feat) {
          if (this.app.layerPanel) {
            this.app.layerPanel.setSelectedFeature(feat);
          }
        } else if (action === 'fit' && feat) {
          this.app.mapEngine.zoomToFeature(feat.id);
        } else if (action === 'edit-vertex' && feat) {
          if (this.app.layerPanel) {
            this.app.layerPanel.setSelectedFeature(feat);
            this.app.mapEngine.startVertexEditing(feat, (updated) => {
              this.app.saveFeature(updated);
            });
          }
        } else if (action === 'duplicate' && feat) {
          const clone = SpatialAlgorithms.duplicateWithOffset(feat, 30);
          if (clone) {
            this.app.newFeatureModal?.openWithFeature(clone);
          }
        } else if (action === 'set-layer' && feat) {
          const targetLayerId = item.getAttribute('data-layer-id');
          if (targetLayerId && targetLayerId !== feat.layerId) {
            const updated = { ...feat, layerId: targetLayerId };
            this.app.saveFeature(updated);
            this.app.mapEngine.updateFeature(updated, this.app.layers);
            if (this.app.layerPanel) this.app.layerPanel.updateLayers(this.app.getLayersWithCounts(), this.app.features);
            UIToast.notificar({
              tipo: 'sucesso',
              titulo: 'Feição Movida',
              mensagem: `Feição transferida para nova camada com sucesso.`
            });
          }
        } else if (action === 'toggle-lock' && feat) {
          const isLocked = !feat.locked;
          feat.locked = isLocked;
          this.app.saveFeature(feat);
          UIToast.notificar({
            tipo: isLocked ? 'alerta' : 'sucesso',
            titulo: isLocked ? 'Feição Bloqueada' : 'Feição Desbloqueada',
            mensagem: isLocked ? 'Protegida contra edições acidentais.' : 'Liberada para edição no mapa.'
          });
        } else if (action === 'delete' && feat) {
          this.app.deleteFeature(feat.id);
        } else if (action === 'copy-coords') {
          const coordsText = latlng 
            ? `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`
            : (feat ? JSON.stringify(feat.coordinates) : '');
          if (navigator.clipboard) {
            navigator.clipboard.writeText(coordsText);
            UIToast.notificar({ tipo: 'sucesso', titulo: 'Coordenadas Copiadas', mensagem: coordsText, duracao: 2000 });
          }
        }
        
        // 2. Ações no Mapa Aberto
        else if (action === 'add-point-here' && latlng) {
          const ptCoords = [latlng.lat, latlng.lng];
          const activeLayer = this.app.layers.find(l => l.id === this.app.activeLayerId) || this.app.layers[0];
          const newPt = {
            type: 'Point',
            coordinates: ptCoords,
            name: `Ponto #${Math.floor(Math.random() * 900 + 100)}`,
            layerId: activeLayer?.id,
            color: activeLayer?.color
          };
          this.app.newFeatureModal ? this.app.newFeatureModal.openWithFeature(newPt) : null;
        } else if (action === 'add-circle-here' && latlng) {
          const activeLayer = this.app.layers.find(l => l.id === this.app.activeLayerId) || this.app.layers[0];
          const newCircle = {
            type: 'Circle',
            coordinates: [latlng.lat, latlng.lng],
            radius: 100,
            name: `Raio 100m #${Math.floor(Math.random() * 900 + 100)}`,
            layerId: activeLayer?.id,
            color: activeLayer?.color
          };
          this.app.newFeatureModal ? this.app.newFeatureModal.openWithFeature(newCircle) : null;
        } else if (action === 'start-line-here' && latlng) {
          this.app.mapEngine.setTool('line');
          if (this.app.mapEngine.drawingEngine) {
            this.app.mapEngine.drawingEngine.handleClick({ latlng });
          }
          UIToast.notificar({ tipo: 'informativo', titulo: 'Linha Iniciada', mensagem: 'Clique nos próximos pontos no mapa.' });
        } else if (action === 'start-polygon-here' && latlng) {
          this.app.mapEngine.setTool('polygon');
          if (this.app.mapEngine.drawingEngine) {
            this.app.mapEngine.drawingEngine.handleClick({ latlng });
          }
          UIToast.notificar({ tipo: 'informativo', titulo: 'Polígono Iniciado', mensagem: 'Clique nos próximos vértices para delimitar a área.' });
        } else if (action === 'measure-from-here' && latlng) {
          this.app.mapEngine.setTool('measure');
          if (this.app.mapEngine.drawingEngine) {
            this.app.mapEngine.drawingEngine.handleClick({ latlng });
          }
        } else if (action === 'fit-all') {
          this.app.mapEngine.fitAllFeatures();
        } else if (action === 'clear-selection') {
          this.app.mapEngine.clearSelection();
          if (this.app.layerPanel) this.app.layerPanel.setSelectedFeatures([]);
        }
      });
    });
  }

  /**
   * Fecha o menu de contexto
   */
  close() {
    if (this.menuElement) {
      this.menuElement.remove();
      this.menuElement = null;
    }
    window.removeEventListener('click', this._closeHandler);
    window.removeEventListener('contextmenu', this._closeHandler);
  }

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
