/* ==========================================================================
   ConecteMapas - VertexEditor
   Responsabilidade Única: Edição interativa de nós e vértices de geometrias no mapa
   ========================================================================== */

import L from 'leaflet';
import { DrawingSnappingHelper } from './DrawingSnappingHelper.js';
import { UIToast } from 'ui-components-kit';

export class VertexEditor {
  constructor(mapEngine) {
    this.engine = mapEngine;
    this.map = mapEngine.map;
    this.editHandlesLayer = L.layerGroup().addTo(this.map);
    this.editingFeature = null;
    this.onFeatureUpdatedCallback = null;
  }

  isEditing() {
    return Boolean(this.editingFeature);
  }

  startEditing(feature, onFeatureUpdated) {
    if (!feature || feature.locked) return;
    if (this.editHandlesLayer) {
      this.editHandlesLayer.clearLayers();
    }
    this.editingFeature = feature;
    this.onFeatureUpdatedCallback = onFeatureUpdated;

    // Oculta SelectionHUD enquanto estiver editando vértices para evitar qualquer sobreposição
    const selHud = document.getElementById('cm-selection-hud');
    if (selHud) selHud.style.display = 'none';

    this.renderEditHandles();
    this.updateHUD();
  }

  stopEditing() {
    this.editingFeature = null;
    this.onFeatureUpdatedCallback = null;
    if (this.editHandlesLayer) {
      this.editHandlesLayer.clearLayers();
    }
    const hud = document.getElementById('cm-vertex-edit-hud');
    if (hud) {
      hud.style.display = 'none';
    }

    // Restaura a barra de seleção se houver elemento selecionado no motor
    if (this.engine?.selectedFeatureId || (this.engine?.selectedFeatureIds && this.engine.selectedFeatureIds.size > 0)) {
      const selHud = document.getElementById('cm-selection-hud');
      if (selHud) selHud.style.display = 'flex';
    }
  }

  renderEditHandles() {
    if (!this.editHandlesLayer || !this.editingFeature) return;
    this.editHandlesLayer.clearLayers();

    const feat = this.editingFeature;
    const isPoly = feat.type === 'Polygon';
    const isLine = feat.type === 'LineString';
    const isPoint = feat.type === 'Point';

    if (isPoint && feat.coordinates) {
      const coords = [feat.coordinates[0], feat.coordinates[1]];
      const dragIcon = L.divIcon({
        className: 'cm-drag-vertex-handle',
        html: `<div style="width: 14px; height: 14px; background: #fff; border: 3px solid #00E08A; border-radius: 50%; box-shadow: 0 0 10px rgba(0,224,138,0.8); cursor: move;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const dragMarker = L.marker(coords, { icon: dragIcon, draggable: true }).addTo(this.editHandlesLayer);

      dragMarker.on('drag', (e) => {
        let newLL = e.target.getLatLng();
        if (this.engine.options?.snapping !== false) {
          const snapped = DrawingSnappingHelper.findNearbyVertex(
            this.map,
            newLL,
            'point',
            [],
            this.engine,
            14
          );
          if (snapped) {
            newLL = L.latLng(snapped[0], snapped[1]);
            e.target.setLatLng(newLL);
          }
        }
        feat.coordinates = [newLL.lat, newLL.lng];
        const leafLayer = this.engine.renderedFeatures.get(feat.id);
        if (leafLayer && leafLayer.setLatLng) {
          leafLayer.setLatLng(newLL);
        }
        this.updateHUDLiveMetrics(feat.coordinates);
      });

      dragMarker.on('dragend', (e) => {
        const newLL = e.target.getLatLng();
        feat.coordinates = [newLL.lat, newLL.lng];
        this.updateHUD();
        if (this.onFeatureUpdatedCallback) {
          this.onFeatureUpdatedCallback({ ...feat, coordinates: [newLL.lat, newLL.lng] });
        }
      });
      return;
    }

    if ((isPoly || isLine) && Array.isArray(feat.coordinates)) {
      let coords = [...feat.coordinates];
      // Salvaguarda defensiva para polígonos: se o anel vier fechado (com duplicata final), remove o duplicado
      if (isPoly && coords.length > 2) {
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (first && last && Math.abs(first[0] - last[0]) < 1e-7 && Math.abs(first[1] - last[1]) < 1e-7) {
          coords = coords.slice(0, -1);
          feat.coordinates = [...coords];
        }
      }
      const count = coords.length;

      // 1. Cria manipuladores de vértices existentes
      coords.forEach((pt, index) => {
        const dragIcon = L.divIcon({
          className: 'cm-drag-vertex-handle',
          html: `<div style="width: 12px; height: 12px; background: #ffffff; border: 2.5px solid #00b4d8; border-radius: 50%; box-shadow: 0 0 8px rgba(0,0,0,0.8); cursor: grab;"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        });

        const handle = L.marker(pt, { icon: dragIcon, draggable: true }).addTo(this.editHandlesLayer);
        handle.bindTooltip(`Vértice V${index + 1}<br><small style="color: #ff5555;">Botão direito: excluir</small>`, { direction: 'top', offset: [0, -6] });

        handle.on('drag', (e) => {
          let newLL = e.target.getLatLng();
          if (this.engine.options?.snapping !== false) {
            const otherPts = coords.filter((_, i) => i !== index);
            const snapped = DrawingSnappingHelper.findNearbyVertex(
              this.map,
              newLL,
              isPoly ? 'polygon' : 'line',
              otherPts,
              this.engine,
              14
            );
            if (snapped) {
              newLL = L.latLng(snapped[0], snapped[1]);
              e.target.setLatLng(newLL);
            }
          }
          coords[index] = [newLL.lat, newLL.lng];
          const leafLayer = this.engine.renderedFeatures.get(feat.id);
          if (leafLayer && leafLayer.setLatLngs) {
            leafLayer.setLatLngs(coords);
          }
          this.updateHUDLiveMetrics(coords);
        });

        handle.on('dragend', (e) => {
          const newLL = e.target.getLatLng();
          coords[index] = [newLL.lat, newLL.lng];
          feat.coordinates = [...coords];
          this.renderEditHandles();
          this.updateHUD();
          if (this.onFeatureUpdatedCallback) {
            this.onFeatureUpdatedCallback({ ...feat, coordinates: [...coords] });
          }
        });

        handle.on('contextmenu', (e) => {
          L.DomEvent.stopPropagation(e);
          const minNodes = isPoly ? 3 : 2;
          if (coords.length <= minNodes) {
            UIToast.notificar({
              tipo: 'alerta',
              titulo: 'Limite de Vértices',
              mensagem: `A feição não pode ter menos de ${minNodes} vértices.`,
              duracao: 2500
            });
            return;
          }
          coords.splice(index, 1);
          feat.coordinates = [...coords];
          this.renderEditHandles();
          this.updateHUD();
          const leafLayer = this.engine.renderedFeatures.get(feat.id);
          if (leafLayer && leafLayer.setLatLngs) {
            leafLayer.setLatLngs(coords);
          }
          if (this.onFeatureUpdatedCallback) {
            this.onFeatureUpdatedCallback({ ...feat, coordinates: [...coords] });
          }
          UIToast.notificar({
            tipo: 'informativo',
            titulo: 'Vértice Removido',
            mensagem: `Vértice V${index + 1} excluído com sucesso.`,
            duracao: 1500
          });
        });
      });

      // 2. Cria pontos médios (Ghost handles) para inserção rápida
      const segCount = isPoly ? count : count - 1;
      for (let i = 0; i < segCount; i++) {
        const p1 = coords[i];
        const p2 = coords[(i + 1) % count];
        if (!p1 || !p2) continue;

        const midLat = (p1[0] + p2[0]) / 2;
        const midLng = (p1[1] + p2[1]) / 2;

        const midIcon = L.divIcon({
          className: 'cm-mid-vertex-handle',
          html: `<div style="width: 9px; height: 9px; background: rgba(0, 180, 216, 0.75); border: 1.5px solid #ffffff; border-radius: 50%; box-shadow: 0 0 6px rgba(0,0,0,0.5); cursor: pointer;"></div>`,
          iconSize: [9, 9],
          iconAnchor: [4.5, 4.5]
        });

        const midHandle = L.marker([midLat, midLng], { icon: midIcon }).addTo(this.editHandlesLayer);
        midHandle.bindTooltip('Clique para inserir vértice', { direction: 'top', offset: [0, -5] });

        midHandle.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          coords.splice(i + 1, 0, [midLat, midLng]);
          feat.coordinates = [...coords];
          this.renderEditHandles();
          this.updateHUD();
          const leafLayer = this.engine.renderedFeatures.get(feat.id);
          if (leafLayer && leafLayer.setLatLngs) {
            leafLayer.setLatLngs(coords);
          }
          if (this.onFeatureUpdatedCallback) {
            this.onFeatureUpdatedCallback({ ...feat, coordinates: [...coords] });
          }
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'Vértice Inserido',
            mensagem: `Novo nó V${i + 2} adicionado. Arraste para posicionar.`,
            duracao: 1500
          });
        });
      }
    }
  }

  updateHUDLiveMetrics(coords) {
    const metricEl = document.getElementById('cm-vertex-hud-live-metric');
    if (!metricEl || !this.editingFeature) return;

    if (this.editingFeature.type === 'Polygon' && Array.isArray(coords) && coords.length >= 3) {
      const areaM2 = this.engine.calculatePolygonArea(coords);
      const ha = (areaM2 / 10000).toFixed(2);
      metricEl.textContent = `• Área: ${ha} ha (${areaM2.toFixed(1)} m²)`;
    } else if (this.editingFeature.type === 'LineString' && Array.isArray(coords) && coords.length >= 2) {
      const lengthM = this.engine.calculatePolylineLength(coords);
      const str = lengthM >= 1000 ? `${(lengthM / 1000).toFixed(2)} km` : `${lengthM.toFixed(1)} m`;
      metricEl.textContent = `• Extensão: ${str}`;
    } else if (this.editingFeature.type === 'Point' && Array.isArray(coords)) {
      metricEl.textContent = `• Lat: ${Number(coords[0]).toFixed(5)}, Lng: ${Number(coords[1]).toFixed(5)}`;
    }
  }

  updateHUD() {
    const container = document.querySelector('.cm-workspace') || document.body;
    let hud = document.getElementById('cm-vertex-edit-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'cm-vertex-edit-hud';
      hud.className = 'cm-cad-hud cm-vertex-hud';
      container.appendChild(hud);
    } else if (hud.parentElement !== container) {
      container.appendChild(hud);
    }

    if (!this.editingFeature) {
      hud.style.display = 'none';
      return;
    }

    hud.style.display = 'flex';
    const coords = this.editingFeature.coordinates;
    const count = Array.isArray(coords) ? (this.editingFeature.type === 'Point' ? 1 : coords.length) : 1;

    let initialMetric = '';
    if (this.editingFeature.type === 'Polygon' && Array.isArray(coords) && coords.length >= 3) {
      const areaM2 = this.engine.calculatePolygonArea(coords);
      initialMetric = `• Área: ${(areaM2 / 10000).toFixed(2)} ha (${areaM2.toFixed(1)} m²)`;
    } else if (this.editingFeature.type === 'LineString' && Array.isArray(coords) && coords.length >= 2) {
      const lengthM = this.engine.calculatePolylineLength(coords);
      initialMetric = `• Extensão: ${lengthM >= 1000 ? (lengthM / 1000).toFixed(2) + ' km' : lengthM.toFixed(1) + ' m'}`;
    } else if (this.editingFeature.type === 'Point' && Array.isArray(coords)) {
      initialMetric = `• Lat: ${Number(coords[0]).toFixed(5)}, Lng: ${Number(coords[1]).toFixed(5)}`;
    }

    hud.innerHTML = `
      <span class="cm-cad-hud-pulse" style="background: #00b4d8; box-shadow: 0 0 8px #00b4d8;"></span>
      <span><strong>Editor de Vértices:</strong> ${count} nós</span>
      <span id="cm-vertex-hud-live-metric" class="cm-cad-hud-hint" style="color: #00E08A; font-weight: 600;">${initialMetric}</span>
      <span class="cm-cad-hud-hint">• Arraste para mover (Snap ativo)</span>
      <span class="cm-cad-hud-hint">• Botão direito no vértice para excluir</span>
      <button id="btn-finish-vertex-edit" class="cm-cad-finish-btn" style="background: #00b4d8; color: #fff;">✔ Concluir (Enter/Esc)</button>
    `;

    const btn = hud.querySelector('#btn-finish-vertex-edit');
    if (btn) {
      btn.addEventListener('click', () => {
        this.stopEditing();
      });
    }
  }

  destroy() {
    this.stopEditing();
    if (this.editHandlesLayer) {
      this.editHandlesLayer.clearLayers();
      if (this.map && this.map.hasLayer(this.editHandlesLayer)) {
        this.map.removeLayer(this.editHandlesLayer);
      }
      this.editHandlesLayer = null;
    }
    const hud = document.getElementById('cm-vertex-edit-hud');
    if (hud) hud.remove();
    this.map = null;
    this.engine = null;
  }
}
