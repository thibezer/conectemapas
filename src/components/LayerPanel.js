/* ==========================================================================
   ConecteMapas - LayerPanel Component (SRP Module)
   Responsabilidade Única: Painel lateral para Gestão de Camadas Vetoriais,
   seleção de Mapa Base (TileLayer), Inspetor de Feições e Chat/Auditoria.
   ========================================================================== */

import './LayerPanel.css';
import { GeoFormats } from '../services/GeoFormats.js';
import { UIToast } from 'ui-components-kit';

export class LayerPanel {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.layers = options.layers || [];
    this.activeTab = options.initialTab || 'layers'; // 'layers' | 'inspector' | 'collab'
    this.currentBasemap = options.currentBasemap || 'satelite';
    this.selectedFeature = options.selectedFeature || null;
    this.auditLog = options.auditLog || [];
    this.chatMessages = options.chatMessages || [];
    this.container = null;
    this.isVertexEditing = false;

    this.onLayerToggle = options.onLayerToggle || (() => {});
    this.onBasemapChange = options.onBasemapChange || (() => {});
    this.onAddLayer = options.onAddLayer || (() => {});
    this.onDeleteFeature = options.onDeleteFeature || (() => {});
    this.onFeatureUpdate = options.onFeatureUpdate || (() => {});
    this.onSendMessage = options.onSendMessage || (() => {});
    this.onStartVertexEdit = options.onStartVertexEdit || (() => {});
    this.onStopVertexEdit = options.onStopVertexEdit || (() => {});
  }

  /**
   * Renderiza a barra lateral
   * @param {HTMLElement} container
   */
  render(container) {
    this.container = container;
    this.container.innerHTML = `
      <aside class="cm-sidebar" id="cm-sidebar-panel" aria-label="Painel de Camadas e Ferramentas">
        <!-- Cabeçalho de Abas Superior Compacto -->
        <div class="cm-sidebar-header">
          <div class="cm-sidebar-tabs">
            <button class="cm-sidebar-tab-btn ${this.activeTab === 'layers' ? 'active' : ''}" data-tab="layers">
              🗂️ Camadas
            </button>
            <button class="cm-sidebar-tab-btn ${this.activeTab === 'inspector' ? 'active' : ''}" data-tab="inspector">
              🔍 Inspeção
            </button>
            <button class="cm-sidebar-tab-btn ${this.activeTab === 'collab' ? 'active' : ''}" data-tab="collab">
              💬 Equipe & Log
            </button>
          </div>
        </div>

        <!-- Conteúdo da Aba Ativa -->
        <div class="cm-sidebar-body" id="cm-sidebar-tab-content">
          ${this.renderTabContent()}
        </div>
      </aside>
    `;

    this.bindEvents();
  }

  renderTabContent() {
    if (this.activeTab === 'layers') {
      return this.renderLayersTab();
    } else if (this.activeTab === 'inspector') {
      return this.renderInspectorTab();
    } else if (this.activeTab === 'collab') {
      return this.renderCollabTab();
    }
    return '';
  }

  renderLayersTab() {
    return `
      <!-- Seção: Camadas Vetoriais -->
      <div class="cm-sidebar-section-header">
        <span class="cm-sidebar-section-title">Camadas Vetoriais</span>
        <ui-botao-primario inline id="btn-add-layer" variante="secundario" class="cm-add-layer-btn" title="Adicionar nova camada vetorial">
          + Nova Camada
        </ui-botao-primario>
      </div>

      <div class="cm-layers-list">
        ${this.layers.map(layer => {
          const safeName = this.escapeHtml(layer.name || 'Camada');
          const safeId = this.escapeHtml(layer.id || '');
          const safeColor = this.escapeHtml(layer.color || '#00E08A');
          return `
          <div class="cm-layer-item" data-layer-id="${safeId}">
            <div class="cm-layer-item-left">
              <div class="cm-layer-color-dot" style="background: ${safeColor}; color: ${safeColor};"></div>
              <div class="cm-layer-info">
                <div class="cm-layer-name" title="${safeName}">${safeName}</div>
                <div class="cm-layer-count">${Number(layer.featureCount) || 0} feições</div>
              </div>
            </div>
            <div class="cm-layer-item-right">
              <ui-switch ${layer.visible ? 'checked' : ''} data-switch-layer="${safeId}" title="Alternar visibilidade da camada"></ui-switch>
            </div>
          </div>
        `;
        }).join('')}
      </div>

      <!-- Seção: Mapa Base -->
      <div class="cm-sidebar-section-header" style="margin-top: 6px;">
        <span class="cm-sidebar-section-title">Mapa Base</span>
      </div>

      <div class="cm-basemap-grid">
        <div class="cm-basemap-card ${this.currentBasemap === 'google_satelite' ? 'active' : ''}" data-basemap="google_satelite" title="Google Maps Satélite / Híbrido">
          <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=160&auto=format&fit=crop&q=80" alt="Google Satélite" />
          <span>🛰️ Google Satélite</span>
        </div>

        <div class="cm-basemap-card ${this.currentBasemap === 'satelite' ? 'active' : ''}" data-basemap="satelite" title="Satélite de Alta Resolução Esri">
          <img src="https://images.unsplash.com/photo-1508873696983-2df5293cb32b?w=160&auto=format&fit=crop&q=80" alt="Esri Satélite" />
          <span>🛰️ Esri Satélite</span>
        </div>

        <div class="cm-basemap-card ${this.currentBasemap === 'osm' ? 'active' : ''}" data-basemap="osm" title="Mapa Urbano OpenStreetMap">
          <img src="https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=160&auto=format&fit=crop&q=80" alt="OSM" />
          <span>🗺️ OpenStreet</span>
        </div>

        <div class="cm-basemap-card ${this.currentBasemap === 'topografia' ? 'active' : ''}" data-basemap="topografia" title="Mapa de Curvas de Nível e Relevo">
          <img src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=160&auto=format&fit=crop&q=80" alt="Topografia" />
          <span>⛰️ Topografia</span>
        </div>

        <div class="cm-basemap-card ${this.currentBasemap === 'dark' ? 'active' : ''}" data-basemap="dark" title="Mapa Escuro Esri Dark Canvas">
          <img src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=160&auto=format&fit=crop&q=80" alt="Dark" />
          <span>🌑 Dark Canvas</span>
        </div>
      </div>
    `;
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return str == null ? '' : String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  renderInspectorTab() {
    if (!this.selectedFeature) {
      return `
        <div style="text-align: center; padding: 24px 10px; color: var(--cm-text-muted);">
          <div style="font-size: 24px; margin-bottom: 8px;">📍</div>
          <div style="font-weight: 500; font-size: 12px; color: var(--cm-text);">Nenhum elemento selecionado</div>
          <div style="font-size: 11px; margin-top: 4px;">Clique em uma feição no mapa ou na tabela para editar propriedades e simbologia.</div>
        </div>
      `;
    }

    const feat = this.selectedFeature;
    const safeName = this.escapeHtml(feat.name || '');
    const safeDesc = this.escapeHtml(feat.description || '');
    const safeCategory = this.escapeHtml(feat.category || feat.type || 'Geral');
    const safeId = this.escapeHtml(feat.id || '');

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
    const hasVertices = (isPoly || isLine) && coordinates.length > 0;
    const segments = hasVertices ? this.calculateFeatureSegments(coordinates, isPoly) : [];

    return `
      <div class="cm-inspector-box">
        <!-- Topo da Feição: Badge + ID -->
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <ui-badge variante="primario">${safeCategory}</ui-badge>
          <span style="font-size: 10px; color: var(--cm-text-muted); font-family: var(--cm-fonte-mono);">${safeId}</span>
        </div>

        <ui-campo-texto id="inspector-feat-name" label="Nome do Elemento" value="${safeName}" obrigatorio></ui-campo-texto>
        <ui-campo-texto id="inspector-feat-desc" label="Descrição / Observações" value="${safeDesc}"></ui-campo-texto>

        <!-- Seção: Simbologia e Estilo Paramétrico -->
        <div class="cm-symbology-card">
          <div class="cm-symbology-title">🎨 Aparência & Simbologia</div>

          ${(isPoly || isCircle) ? `
            <!-- Preenchimento e Opacidade -->
            <div class="cm-param-row">
              <span class="cm-param-label">Cor de Preenchimento:</span>
              <div class="cm-color-input-wrapper">
                <input type="color" class="cm-color-picker" id="style-fill-color" value="${style.fillColor}" />
                <span class="cm-param-badge" id="val-fill-color-hex">${style.fillColor}</span>
              </div>
            </div>

            <div class="cm-param-row">
              <span class="cm-param-label">Opacidade:</span>
              <input type="range" class="cm-param-slider" id="style-fill-opacity" min="0" max="1" step="0.05" value="${style.fillOpacity}" />
              <span class="cm-param-badge" id="val-fill-opacity">${Math.round(style.fillOpacity * 100)}%</span>
            </div>
          ` : ''}

          ${(isPoly || isCircle || isLine) ? `
            <!-- Contorno e Padrão de Traço -->
            <div class="cm-param-row">
              <span class="cm-param-label">Cor do Contorno:</span>
              <div class="cm-color-input-wrapper">
                <input type="color" class="cm-color-picker" id="style-stroke-color" value="${style.strokeColor}" />
                <span class="cm-param-badge" id="val-stroke-color-hex">${style.strokeColor}</span>
              </div>
            </div>

            <div class="cm-param-row">
              <span class="cm-param-label">Espessura da Linha:</span>
              <input type="range" class="cm-param-slider" id="style-stroke-width" min="1" max="10" step="0.5" value="${style.strokeWidth}" />
              <span class="cm-param-badge" id="val-stroke-width">${style.strokeWidth}px</span>
            </div>

            <div class="cm-param-row">
              <span class="cm-param-label">Padrão da Linha:</span>
              <select class="cm-native-select" id="style-stroke-dash" style="width: 140px;">
                <option value="" ${style.strokeDashArray === '' ? 'selected' : ''}>Sólida (Contínua)</option>
                <option value="6, 6" ${style.strokeDashArray === '6, 6' ? 'selected' : ''}>Tracejada (---)</option>
                <option value="2, 4" ${style.strokeDashArray === '2, 4' ? 'selected' : ''}>Pontilhada (···)</option>
              </select>
            </div>
          ` : ''}

          ${isPoint ? `
            <!-- Ícone e Rotação do Marcador -->
            <div class="cm-param-row">
              <span class="cm-param-label">Cor do Marcador:</span>
              <div class="cm-color-input-wrapper">
                <input type="color" class="cm-color-picker" id="style-point-color" value="${style.fillColor}" />
                <span class="cm-param-badge" id="val-point-color-hex">${style.fillColor}</span>
              </div>
            </div>

            <div class="cm-param-row">
              <span class="cm-param-label">Ícone Vetorial:</span>
              <select class="cm-native-select" id="style-marker-icon" style="width: 140px;">
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
              <input type="range" class="cm-param-slider" id="style-marker-size" min="16" max="48" step="2" value="${style.markerSize}" />
              <span class="cm-param-badge" id="val-marker-size">${style.markerSize}px</span>
            </div>

            <div class="cm-param-row">
              <span class="cm-param-label">Rotação:</span>
              <input type="range" class="cm-param-slider" id="style-marker-rot" min="0" max="360" step="5" value="${style.markerRotation}" />
              <span class="cm-param-badge" id="val-marker-rot">${style.markerRotation}°</span>
            </div>
          ` : ''}

          <!-- Rótulo Dinâmico no Mapa -->
          <div class="cm-param-row" style="border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 6px; margin-top: 2px;">
            <span class="cm-param-label">Rótulo no Mapa:</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <select class="cm-native-select" id="style-label-field" style="width: 110px;">
                <option value="name" ${style.labelField === 'name' ? 'selected' : ''}>Nome</option>
                <option value="category" ${style.labelField === 'category' ? 'selected' : ''}>Categoria</option>
                ${isPoly ? `<option value="area" ${style.labelField === 'area' ? 'selected' : ''}>Área (ha)</option>` : ''}
                ${isLine ? `<option value="extensao" ${style.labelField === 'extensao' ? 'selected' : ''}>Extensão</option>` : ''}
              </select>
              <ui-switch ${style.showLabel ? 'checked' : ''} id="style-show-label" title="Exibir Rótulo Permanente no Mapa"></ui-switch>
            </div>
          </div>
        </div>

        <!-- Seção: Geometria, Vértices e Azimutes -->
        <div class="cm-symbology-card">
          <div class="cm-symbology-title" style="display: flex; justify-content: space-between; align-items: center;">
            <span>📐 Geometria & Vértices (${hasVertices ? coordinates.length : 1} nós)</span>
            <ui-botao-primario 
              inline 
              id="btn-toggle-vertex-edit" 
              variante="${this.isVertexEditing ? 'primary' : 'secundario'}" 
              style="height: 22px; font-size: 10px; padding: 0 6px;">
              ${this.isVertexEditing ? '✔ Concluir Edição' : '✏️ Editar no Mapa'}
            </ui-botao-primario>
          </div>

          ${hasVertices ? `
            <!-- Tabela de Vértices Editáveis -->
            <details class="cm-vertex-details" open>
              <summary class="cm-vertex-summary">📍 Coordenadas dos Vértices (${coordinates.length})</summary>
              <div class="cm-vertex-list-scroll">
                ${coordinates.map((pt, idx) => `
                  <div class="cm-vertex-row" data-vertex-idx="${idx}">
                    <span class="cm-vertex-badge">V${idx + 1}</span>
                    <input type="number" step="0.00001" class="cm-vertex-input" data-v-lat="${idx}" value="${Number(pt[0]).toFixed(5)}" title="Latitude" />
                    <input type="number" step="0.00001" class="cm-vertex-input" data-v-lng="${idx}" value="${Number(pt[1]).toFixed(5)}" title="Longitude" />
                    <button class="cm-vertex-del-btn" data-v-del="${idx}" title="Excluir Vértice">×</button>
                  </div>
                `).join('')}
              </div>
            </details>

            <!-- Métricas de Segmento (Azimutes e Distâncias) -->
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

          <!-- Botões de Cópia Rápida de Geometria Isolada -->
          <div style="display: flex; gap: 4px; border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 6px; margin-top: 2px;">
            <ui-botao-primario inline id="btn-copy-wkt" variante="secundario" style="flex: 1; height: 24px; font-size: 10px;" title="Copiar Geometria em Formato WKT">
              📋 WKT
            </ui-botao-primario>
            <ui-botao-primario inline id="btn-copy-geojson" variante="secundario" style="flex: 1; height: 24px; font-size: 10px;" title="Copiar Geometria em Formato GeoJSON">
              📋 GeoJSON
            </ui-botao-primario>
            <ui-botao-primario inline id="btn-copy-coord-csv" variante="secundario" style="flex: 1; height: 24px; font-size: 10px;" title="Copiar Vértices em Formato CSV">
              📋 CSV Nós
            </ui-botao-primario>
          </div>
        </div>

        <!-- Seção: Atributos Técnicos -->
        <div style="background: var(--cm-surface); border: 1px solid var(--cm-border); padding: 8px; border-radius: 6px; font-size: 11px;">
          <div style="font-weight: 600; margin-bottom: 4px; color: var(--cm-text);">Atributos Técnicos</div>
          ${Object.entries(feat.properties || {}).map(([k, v]) => `
            <div style="display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dashed rgba(255,255,255,0.05); font-family: var(--cm-fonte-mono); font-size: 10.5px;">
              <span style="color: var(--cm-text-muted);">${this.escapeHtml(k)}:</span>
              <span style="color: var(--cm-text);">${this.escapeHtml(v)}</span>
            </div>
          `).join('')}
        </div>

        <!-- Botões de Ação -->
        <div style="display: flex; gap: 6px; margin-top: 4px;">
          <ui-botao-primario inline id="btn-save-inspector" variante="primary" style="height: 30px; flex: 1;">
            Salvar Alterações
          </ui-botao-primario>
          <ui-botao-primario inline id="btn-delete-inspector" variante="destrutivo" title="Excluir Elemento" style="height: 30px; padding: 0 10px;">
            🗑️
          </ui-botao-primario>
        </div>
      </div>
    `;
  }

  calculateDistance(p1, p2) {
    if (!p1 || !p2) return 0;
    const R = 6371000;
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  calculateBearing(p1, p2) {
    if (!p1 || !p2) return 0;
    const lat1 = p1[0] * Math.PI / 180;
    const lat2 = p2[0] * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  }

  calculateFeatureSegments(coordinates, isClosed = false) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
    const segments = [];
    const count = isClosed ? coordinates.length : coordinates.length - 1;

    for (let i = 0; i < count; i++) {
      const p1 = coordinates[i];
      const p2 = coordinates[(i + 1) % coordinates.length];
      if (!p1 || !p2) continue;

      const dist = this.calculateDistance(p1, p2);
      const az = this.calculateBearing(p1, p2);
      segments.push({
        from: i + 1,
        to: (i + 1) % coordinates.length === 0 ? 1 : i + 2,
        distance: dist,
        azimuth: az
      });
    }
    return segments;
  }

  renderCollabTab() {
    return `
      <div style="display: flex; flex-direction: column; gap: 10px; height: 100%;">
        <div>
          <span class="cm-sidebar-section-title" style="display: block; margin-bottom: 4px;">Trilha de Auditoria</span>
          <div class="cm-audit-log-list">
            ${this.auditLog.length ? this.auditLog.map(entry => `
              <div class="cm-audit-item">
                <span style="color: var(--cm-primary); font-weight: 600;">${this.escapeHtml(entry.user)}:</span>
                <span style="color: var(--cm-text);">${this.escapeHtml(entry.action)}</span>
                <span style="color: var(--cm-text-muted); margin-left: auto;">${this.escapeHtml(entry.timestamp)}</span>
              </div>
            `).join('') : '<div style="color: var(--cm-text-muted); font-size: 10.5px;">Nenhuma alteração registrada.</div>'}
          </div>
        </div>

        <div style="flex: 1; display: flex; flex-direction: column;">
          <span class="cm-sidebar-section-title" style="display: block; margin-bottom: 4px;">Chat da Equipe</span>
          
          <div class="cm-chat-messages" id="cm-chat-messages-box">
            ${this.chatMessages.length ? this.chatMessages.map(msg => {
              const safeUser = this.escapeHtml(msg.user?.name || 'Operador');
              const safeColor = this.escapeHtml(msg.user?.color || 'var(--cm-primary)');
              const safeText = this.escapeHtml(msg.text || '');
              const safeTime = this.escapeHtml(msg.timestamp || '');
              return `
              <div class="cm-chat-bubble">
                <div class="cm-chat-meta">
                  <span class="cm-chat-user" style="color: ${safeColor}">${safeUser}</span>
                  <span>${safeTime}</span>
                </div>
                <div style="color: var(--cm-text); margin-top: 2px;">${safeText}</div>
              </div>
            `;
            }).join('') : '<div style="color: var(--cm-text-muted); font-size: 10.5px;">Nenhuma mensagem na sala.</div>'}
          </div>

          <form id="cm-chat-form" style="display: flex; gap: 6px; margin-top: 6px; align-items: center;">
            <ui-campo-texto id="cm-chat-input" placeholder="Mensagem da equipe..." style="flex: 1; --ui-campo-altura: 30px; --ui-altura-minima: 30px;"></ui-campo-texto>
            <ui-botao-primario inline type="submit" variante="primary" style="height: 30px; padding: 0 12px; font-size: 11.5px;">
              Enviar
            </ui-botao-primario>
          </form>
        </div>
      </div>
    `;
  }

  setSelectedFeature(feat) {
    this.selectedFeature = feat;
    if (feat) {
      this.activeTab = 'inspector';
    }
    this.updateContent();
  }

  updateLayers(layers) {
    this.layers = layers;
    if (this.activeTab === 'layers') this.updateContent();
  }

  updateAuditLog(log) {
    this.auditLog = log;
    if (this.activeTab === 'collab') this.updateContent();
  }

  addChatMessage(msg) {
    this.chatMessages.push(msg);
    if (this.activeTab === 'collab') {
      this.updateContent();
      const box = document.getElementById('cm-chat-messages-box');
      if (box) box.scrollTop = box.scrollHeight;
    }
  }

  updateContent() {
    const body = document.getElementById('cm-sidebar-tab-content');
    if (body) {
      body.innerHTML = this.renderTabContent();
      this.bindTabEvents();
    }

    document.querySelectorAll('.cm-sidebar-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === this.activeTab);
    });
  }

  bindEvents() {
    if (!this.container) return;

    this.container.querySelectorAll('.cm-sidebar-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.getAttribute('data-tab');
        this.updateContent();
      });
    });

    this.bindTabEvents();
  }

  bindTabEvents() {
    // Switches de camada
    document.querySelectorAll('[data-switch-layer]').forEach(sw => {
      sw.addEventListener('ui-change', (e) => {
        const layerId = sw.getAttribute('data-switch-layer');
        this.onLayerToggle(layerId, e.detail ? e.detail.checked : sw.checked);
      });
      sw.addEventListener('change', () => {
        const layerId = sw.getAttribute('data-switch-layer');
        this.onLayerToggle(layerId, sw.checked);
      });
    });

    // Botão nova camada
    const btnAddLayer = document.getElementById('btn-add-layer');
    if (btnAddLayer) {
      btnAddLayer.addEventListener('click', () => this.onAddLayer());
    }

    // Mapas base
    document.querySelectorAll('[data-basemap]').forEach(card => {
      card.addEventListener('click', () => {
        const base = card.getAttribute('data-basemap');
        this.currentBasemap = base;
        this.onBasemapChange(base);
        this.updateContent();
      });
    });

    // Sliders e Color Pickers em Tempo Real
    const fillPicker = document.getElementById('style-fill-color');
    const fillHexBadge = document.getElementById('val-fill-color-hex');
    if (fillPicker && fillHexBadge) {
      fillPicker.addEventListener('input', (e) => {
        fillHexBadge.textContent = e.target.value;
      });
    }

    const strokePicker = document.getElementById('style-stroke-color');
    const strokeHexBadge = document.getElementById('val-stroke-color-hex');
    if (strokePicker && strokeHexBadge) {
      strokePicker.addEventListener('input', (e) => {
        strokeHexBadge.textContent = e.target.value;
      });
    }

    const pointPicker = document.getElementById('style-point-color');
    const pointHexBadge = document.getElementById('val-point-color-hex');
    if (pointPicker && pointHexBadge) {
      pointPicker.addEventListener('input', (e) => {
        pointHexBadge.textContent = e.target.value;
      });
    }

    const fillOpacitySlider = document.getElementById('style-fill-opacity');
    const fillOpacityBadge = document.getElementById('val-fill-opacity');
    if (fillOpacitySlider && fillOpacityBadge) {
      fillOpacitySlider.addEventListener('input', (e) => {
        fillOpacityBadge.textContent = `${Math.round(e.target.value * 100)}%`;
      });
    }

    const strokeWidthSlider = document.getElementById('style-stroke-width');
    const strokeWidthBadge = document.getElementById('val-stroke-width');
    if (strokeWidthSlider && strokeWidthBadge) {
      strokeWidthSlider.addEventListener('input', (e) => {
        strokeWidthBadge.textContent = `${e.target.value}px`;
      });
    }

    const markerSizeSlider = document.getElementById('style-marker-size');
    const markerSizeBadge = document.getElementById('val-marker-size');
    if (markerSizeSlider && markerSizeBadge) {
      markerSizeSlider.addEventListener('input', (e) => {
        markerSizeBadge.textContent = `${e.target.value}px`;
      });
    }

    const markerRotSlider = document.getElementById('style-marker-rot');
    const markerRotBadge = document.getElementById('val-marker-rot');
    if (markerRotSlider && markerRotBadge) {
      markerRotSlider.addEventListener('input', (e) => {
        markerRotBadge.textContent = `${e.target.value}°`;
      });
    }

    // Inspetor Salvar/Excluir
    const btnSave = document.getElementById('btn-save-inspector');
    if (btnSave && this.selectedFeature) {
      btnSave.addEventListener('click', () => {
        const nameInput = document.getElementById('inspector-feat-name');
        const descInput = document.getElementById('inspector-feat-desc');
        const newName = nameInput ? nameInput.value.trim() : '';
        const newDesc = descInput ? descInput.value.trim() : '';

        const isPoly = this.selectedFeature.type === 'Polygon';
        const isPoint = this.selectedFeature.type === 'Point';

        const fillPick = document.getElementById('style-fill-color');
        const strokePick = document.getElementById('style-stroke-color');
        const pointPick = document.getElementById('style-point-color');
        const fillOpSlider = document.getElementById('style-fill-opacity');
        const strokeWSlider = document.getElementById('style-stroke-width');
        const strokeDSelect = document.getElementById('style-stroke-dash');
        const markerISelect = document.getElementById('style-marker-icon');
        const markerSSlider = document.getElementById('style-marker-size');
        const markerRSlider = document.getElementById('style-marker-rot');
        const labelSw = document.getElementById('style-show-label');
        const labelFSelect = document.getElementById('style-label-field');

        const currentStyle = this.selectedFeature.style || {};

        const isLabelChecked = labelSw ? (labelSw.checked || labelSw.hasAttribute('checked')) : false;

        const newStyle = {
          ...currentStyle,
          fillColor: isPoint ? (pointPick?.value || currentStyle.fillColor || '#00E08A') : (fillPick?.value || currentStyle.fillColor || '#00E08A'),
          fillOpacity: fillOpSlider ? parseFloat(fillOpSlider.value) : (currentStyle.fillOpacity ?? 0.35),
          strokeColor: strokePick?.value || currentStyle.strokeColor || (isPoint ? (pointPick?.value || '#00E08A') : '#00E08A'),
          strokeWidth: strokeWSlider ? parseFloat(strokeWSlider.value) : (currentStyle.strokeWidth ?? 2.5),
          strokeDashArray: strokeDSelect ? strokeDSelect.value : (currentStyle.strokeDashArray || ''),
          markerIcon: markerISelect ? markerISelect.value : (currentStyle.markerIcon || 'pin'),
          markerSize: markerSSlider ? parseInt(markerSSlider.value, 10) : (currentStyle.markerSize ?? 24),
          markerRotation: markerRSlider ? parseInt(markerRSlider.value, 10) : (currentStyle.markerRotation ?? 0),
          showLabel: isLabelChecked,
          labelField: labelFSelect ? labelFSelect.value : (currentStyle.labelField || 'name')
        };

        const updated = {
          ...this.selectedFeature,
          name: newName || this.selectedFeature.name,
          description: newDesc,
          color: newStyle.fillColor || newStyle.strokeColor || this.selectedFeature.color,
          style: newStyle
        };

        this.selectedFeature = updated;
        this.onFeatureUpdate(updated);
      });
    }

    // Botão de Ativar / Desativar Modo de Edição de Vértices no Mapa
    const btnToggleVertex = document.getElementById('btn-toggle-vertex-edit');
    if (btnToggleVertex && this.selectedFeature) {
      btnToggleVertex.addEventListener('click', () => {
        this.isVertexEditing = !this.isVertexEditing;
        if (this.isVertexEditing) {
          this.onStartVertexEdit(this.selectedFeature);
        } else {
          this.onStopVertexEdit();
        }
        this.updateContent();
      });
    }

    // Inputs de Latitude dos Vértices
    document.querySelectorAll('[data-v-lat]').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(input.getAttribute('data-v-lat'), 10);
        const newLat = parseFloat(e.target.value);
        if (!isNaN(newLat) && this.selectedFeature && Array.isArray(this.selectedFeature.coordinates)) {
          const coords = [...this.selectedFeature.coordinates];
          if (coords[idx]) {
            coords[idx] = [newLat, coords[idx][1]];
            const updated = { ...this.selectedFeature, coordinates: coords };
            this.selectedFeature = updated;
            this.onFeatureUpdate(updated);
            this.updateContent();
          }
        }
      });
    });

    // Inputs de Longitude dos Vértices
    document.querySelectorAll('[data-v-lng]').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(input.getAttribute('data-v-lng'), 10);
        const newLng = parseFloat(e.target.value);
        if (!isNaN(newLng) && this.selectedFeature && Array.isArray(this.selectedFeature.coordinates)) {
          const coords = [...this.selectedFeature.coordinates];
          if (coords[idx]) {
            coords[idx] = [coords[idx][0], newLng];
            const updated = { ...this.selectedFeature, coordinates: coords };
            this.selectedFeature = updated;
            this.onFeatureUpdate(updated);
            this.updateContent();
          }
        }
      });
    });

    // Exclusão de Vértice Individual
    document.querySelectorAll('[data-v-del]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-v-del'), 10);
        if (this.selectedFeature && Array.isArray(this.selectedFeature.coordinates)) {
          const minNodes = this.selectedFeature.type === 'Polygon' ? 3 : 2;
          if (this.selectedFeature.coordinates.length <= minNodes) {
            UIToast.notificar({
              tipo: 'alerta',
              titulo: 'Limite Mínimo',
              mensagem: `A geometria não pode ter menos de ${minNodes} vértices.`,
              duracao: 2500
            });
            return;
          }
          const coords = [...this.selectedFeature.coordinates];
          coords.splice(idx, 1);
          const updated = { ...this.selectedFeature, coordinates: coords };
          this.selectedFeature = updated;
          this.onFeatureUpdate(updated);
          this.updateContent();
        }
      });
    });

    // Botões de Cópia Rápida
    const btnCopyWKT = document.getElementById('btn-copy-wkt');
    if (btnCopyWKT && this.selectedFeature) {
      btnCopyWKT.addEventListener('click', () => {
        const wkt = GeoFormats.toWKT(this.selectedFeature);
        navigator.clipboard.writeText(wkt).then(() => {
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'WKT Copiado',
            mensagem: 'Geometria no padrão Well-Known Text copiada!',
            duracao: 2500
          });
        });
      });
    }

    const btnCopyGeoJSON = document.getElementById('btn-copy-geojson');
    if (btnCopyGeoJSON && this.selectedFeature) {
      btnCopyGeoJSON.addEventListener('click', () => {
        const geo = GeoFormats.toGeoJSON([this.selectedFeature]);
        navigator.clipboard.writeText(geo).then(() => {
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'GeoJSON Copiado',
            mensagem: 'Feature GeoJSON copiada com sucesso!',
            duracao: 2500
          });
        });
      });
    }

    const btnCopyCSV = document.getElementById('btn-copy-coord-csv');
    if (btnCopyCSV && this.selectedFeature) {
      btnCopyCSV.addEventListener('click', () => {
        const csv = GeoFormats.toCoordinateCSV(this.selectedFeature);
        navigator.clipboard.writeText(csv).then(() => {
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'CSV de Vértices Copiado',
            mensagem: 'Tabela de coordenadas dos nós copiada!',
            duracao: 2500
          });
        });
      });
    }

    const btnDelete = document.getElementById('btn-delete-inspector');
    if (btnDelete && this.selectedFeature) {
      btnDelete.addEventListener('click', () => {
        this.onDeleteFeature(this.selectedFeature.id);
        this.setSelectedFeature(null);
      });
    }

    // Chat Form
    const chatForm = document.getElementById('cm-chat-form');
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('cm-chat-input');
        const text = input?.value?.trim();
        if (text) {
          this.onSendMessage(text);
          if (input) input.value = '';
        }
      });
    }
  }
}
