/* ==========================================================================
   ConecteMapas - DrawingSnappingHelper
   Atração magnética a vértices existentes (Snapping) e atualização do
   HUD de desenho CAD com atalhos e feedback interativo.
   ========================================================================== */

export class DrawingSnappingHelper {
  static SNAP_PIXELS = 8;
  // Segurar Alt desativa temporariamente o snap
  static altHeld = false;

  static findNearbyVertex(map, mouseLatLng, activeTool, drawingPoints, engine, maxPixelDistance = DrawingSnappingHelper.SNAP_PIXELS, excludeFeatureId = null) {
    if (!map || !mouseLatLng || DrawingSnappingHelper.altHeld) return null;
    const mousePt = map.latLngToContainerPoint(mouseLatLng);
    let best = null;
    let bestDist = maxPixelDistance;
    const consider = (pt) => {
      const p = map.latLngToContainerPoint(pt);
      const d = Math.hypot(mousePt.x - p.x, mousePt.y - p.y);
      if (d <= bestDist) { bestDist = d; best = pt; }
    };

    if (activeTool === 'polygon' && drawingPoints.length >= 3) {
      consider(drawingPoints[0]);
    }

    if (engine.featureRenderer && engine.featureRenderer.allFeatures) {
      const bounds = map.getBounds();
      const visibleFeatures = engine.spatialIndex 
        ? engine.spatialIndex.query(bounds, 0.05)
        : engine.featureRenderer.allFeatures;

      for (const feat of visibleFeatures) {
        if (!feat || feat.visible === false) continue;
        if (excludeFeatureId != null && feat.id === excludeFeatureId) continue;
        if (feat.type === 'Point' && feat.coordinates) {
          consider([feat.coordinates[0], feat.coordinates[1]]);
        } else if ((feat.type === 'LineString' || feat.type === 'Polygon') && Array.isArray(feat.coordinates)) {
          for (const vertex of feat.coordinates) {
            if (!vertex) continue;
            consider((vertex.lat !== undefined) ? [vertex.lat, vertex.lng] : vertex);
          }
        }
      }
    }
    return best;
  }

  static updateDrawingHUD(activeTool, drawingPoints, cumulativeDist, engine, onFinish, onClear) {
    const container = document.querySelector('.cm-workspace') || document.body;
    let hud = document.getElementById('cm-cad-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'cm-cad-hud';
      hud.className = 'cm-cad-hud';
      container.appendChild(hud);
    } else if (hud.parentElement !== container) {
      container.appendChild(hud);
    }

    if (activeTool === 'select' || (drawingPoints.length === 0 && activeTool !== 'point' && activeTool !== 'text')) {
      hud.style.display = 'none';
      return;
    }

    // Oculta SelectionHUD enquanto ferramentas de desenho CAD estiverem ativas
    const selHud = document.getElementById('cm-selection-hud');
    if (selHud) selHud.style.display = 'none';

    if (activeTool === 'text') {
      hud.style.display = 'flex';
      hud.innerHTML = `
        <span class="cm-cad-hud-pulse" style="background: #38bdf8;"></span>
        <span><strong>Texto / Rótulo:</strong> Clique no mapa na posição onde deseja inserir a anotação</span>
        <span class="cm-cad-hud-hint">• <strong>[Esc]</strong> cancela</span>
      `;
      return;
    }

    if (activeTool === 'measure') {
      hud.style.display = 'flex';
      const count = drawingPoints.length;
      const totalDist = cumulativeDist || engine.calculatePolylineLength(drawingPoints);
      const distFormatted = totalDist > 1000 ? `${(totalDist / 1000).toFixed(2)} km` : `${totalDist.toFixed(1)} m`;
      let areaInfo = '';
      if (count >= 3) {
        const areaM2 = engine.calculatePolygonArea(drawingPoints);
        const ha = (areaM2 / 10000).toFixed(2);
        areaInfo = ` • Área Delimitada: <strong>${ha} ha</strong> (${areaM2.toFixed(0)} m²)`;
      }

      hud.innerHTML = `
        <span class="cm-cad-hud-pulse" style="background: #fbbf24;"></span>
        <span><strong>Régua de Medição:</strong> ${count} ponto(s) | Distância: <strong>${distFormatted}</strong>${areaInfo}</span>
        <span class="cm-cad-hud-hint">• <strong>[Enter]</strong> fixa cota</span>
        <span class="cm-cad-hud-hint">• <strong>[Ctrl+Z]</strong> desfaz</span>
        <span class="cm-cad-hud-hint">• <strong>[Esc]</strong> limpa</span>
        ${count >= 2 ? '<button id="btn-cad-finish" class="cm-cad-finish-btn" style="background: #f59e0b; color: #000;">📌 Fixar Medição</button>' : ''}
        <button id="btn-cad-clear" class="cm-cad-finish-btn" style="background: rgba(255,255,255,0.18); color: #fff;">✕ Limpar</button>
      `;

      const finishBtn = hud.querySelector('#btn-cad-finish');
      if (finishBtn && typeof onFinish === 'function') {
        finishBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          onFinish();
        });
      }
      const clearBtn = hud.querySelector('#btn-cad-clear');
      if (clearBtn && typeof onClear === 'function') {
        clearBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          onClear();
        });
      }
      return;
    }

    hud.style.display = 'flex';
    const count = drawingPoints.length;
    let toolName = 'Forma';
    let minPts = 2;
    if (activeTool === 'line') { toolName = 'Linha'; minPts = 2; }
    if (activeTool === 'polygon') { toolName = 'Polígono'; minPts = 3; }
    if (activeTool === 'pen-select') { toolName = 'Caneta de Seleção'; minPts = 3; }
    if (activeTool === 'circle') { toolName = 'Círculo'; minPts = 1; }

    const canFinish = count >= minPts;

    hud.innerHTML = `
      <span class="cm-cad-hud-pulse"></span>
      <span><strong>${toolName}:</strong> ${count} vértice(s) adicionado(s)</span>
      <span class="cm-cad-hud-hint">• <strong>[Enter]</strong> ou <strong>[Espaço]</strong> conclui</span>
      <span class="cm-cad-hud-hint">• <strong>[Ctrl+Z]</strong> ou <strong>[Botão Direito]</strong> desfaz</span>
      <span class="cm-cad-hud-hint">• <strong>[Esc]</strong> cancela</span>
      <span class="cm-cad-hud-hint">• <strong>[Alt]</strong> segurado desativa o snap</span>
      ${canFinish ? '<button id="btn-cad-finish" class="cm-cad-finish-btn">✔ Concluir Forma</button>' : ''}
    `;

    const finishBtn = hud.querySelector('#btn-cad-finish');
    if (finishBtn && typeof onFinish === 'function') {
      finishBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onFinish();
      });
    }
  }
}

if (typeof window !== 'undefined') {
  const setAlt = (e) => { DrawingSnappingHelper.altHeld = e.altKey; };
  window.addEventListener('keydown', setAlt);
  window.addEventListener('keyup', setAlt);
  window.addEventListener('blur', () => { DrawingSnappingHelper.altHeld = false; });
}
