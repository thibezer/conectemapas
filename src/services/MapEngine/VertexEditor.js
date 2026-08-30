/* ==========================================================================
   ConecteMapas - VertexEditor
   Responsabilidade Única: Edição interativa de nós e vértices de geometrias no mapa
   ========================================================================== */

import L from 'leaflet';

export class VertexEditor {
  constructor(mapEngine) {
    this.engine = mapEngine;
    this.map = mapEngine.map;
    this.editHandlesLayer = L.layerGroup().addTo(this.map);
    this.editingFeature = null;
    this.onFeatureUpdatedCallback = null;
  }

  startEditing(feature, onFeatureUpdated) {
    this.stopEditing();
    this.editingFeature = feature;
    this.onFeatureUpdatedCallback = onFeatureUpdated;
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
      dragMarker.on('dragend', (e) => {
        const newLL = e.target.getLatLng();
        feat.coordinates = [newLL.lat, newLL.lng];
        if (this.onFeatureUpdatedCallback) {
          this.onFeatureUpdatedCallback({ ...feat });
        }
      });
      return;
    }

    if ((isPoly || isLine) && Array.isArray(feat.coordinates)) {
      const coords = [...feat.coordinates];
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
          const newLL = e.target.getLatLng();
          coords[index] = [newLL.lat, newLL.lng];
          const leafLayer = this.engine.renderedFeatures.get(feat.id);
          if (leafLayer && leafLayer.setLatLngs) {
            leafLayer.setLatLngs(coords);
          }
        });

        handle.on('dragend', (e) => {
          const newLL = e.target.getLatLng();
          coords[index] = [newLL.lat, newLL.lng];
          feat.coordinates = [...coords];
          this.renderEditHandles();
          if (this.onFeatureUpdatedCallback) {
            this.onFeatureUpdatedCallback({ ...feat, coordinates: [...coords] });
          }
        });

        handle.on('contextmenu', (e) => {
          L.DomEvent.stopPropagation(e);
          const minNodes = isPoly ? 3 : 2;
          if (coords.length <= minNodes) {
            alert(`A feição não pode ter menos de ${minNodes} vértices.`);
            return;
          }
          coords.splice(index, 1);
          feat.coordinates = [...coords];
          this.renderEditHandles();
          const leafLayer = this.engine.renderedFeatures.get(feat.id);
          if (leafLayer && leafLayer.setLatLngs) {
            leafLayer.setLatLngs(coords);
          }
          if (this.onFeatureUpdatedCallback) {
            this.onFeatureUpdatedCallback({ ...feat, coordinates: [...coords] });
          }
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
          const leafLayer = this.engine.renderedFeatures.get(feat.id);
          if (leafLayer && leafLayer.setLatLngs) {
            leafLayer.setLatLngs(coords);
          }
          if (this.onFeatureUpdatedCallback) {
            this.onFeatureUpdatedCallback({ ...feat, coordinates: [...coords] });
          }
        });
      }
    }
  }

  updateHUD() {
    let hud = document.getElementById('cm-vertex-edit-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'cm-vertex-edit-hud';
      hud.className = 'cm-cad-hud';
      document.body.appendChild(hud);
    }

    if (!this.editingFeature) {
      hud.style.display = 'none';
      return;
    }

    hud.style.display = 'flex';
    const count = Array.isArray(this.editingFeature.coordinates) ? this.editingFeature.coordinates.length : 1;

    hud.innerHTML = `
      <span class="cm-cad-hud-pulse" style="background: #00b4d8; box-shadow: 0 0 8px #00b4d8;"></span>
      <span><strong>Editor de Vértices:</strong> ${count} nós</span>
      <span class="cm-cad-hud-hint">• Arraste os pontos</span>
      <span class="cm-cad-hud-hint">• Clique nos nós intermediários para criar</span>
      <span class="cm-cad-hud-hint">• Botão direito para excluir</span>
      <button id="btn-finish-vertex-edit" class="cm-cad-finish-btn" style="background: #00b4d8; color: #fff;">✔ Concluir</button>
    `;

    const btn = hud.querySelector('#btn-finish-vertex-edit');
    if (btn) {
      btn.addEventListener('click', () => {
        this.stopEditing();
      });
    }
  }
}
