/* ==========================================================================
   ConecteMapas - DrawingSnappingHelper
   Atração magnética a vértices existentes (Snapping) e atualização do
   HUD de desenho CAD com atalhos e feedback interativo.
   ========================================================================== */

export class DrawingSnappingHelper {
  static SNAP_PIXELS = 8;
  // Segurar Alt desativa temporariamente o snap
  static altHeld = false;

  /**
   * Obtém o raio de captura base calibrado dinamicamente para o nível de zoom.
   * Em zooms mais afastados (ex: 19, 18, 17), o raio em pixels é refinado para evitar
  /**
   * Raio de atração magnética padrão confortável estilo CAD (pixels de tela).
   * @param {L.Map} map
   * @returns {number}
   */
  static getBaseSnapRadius(map) {
    if (!map || typeof map.getZoom !== 'function') return 10;
    const zoom = map.getZoom();
    if (zoom >= 20) return 10;
    if (zoom === 19) return 9;
    return 9;
  }

  /**
   * Localiza o vértice mais próximo com alto desempenho O(log N) e comportamento CAD.
   * - Utiliza Bounding Box local minúscula de 30px para busca rápida no SpatialIndex.
   * - Pré-filtra vértices geograficamente antes de qualquer projeção de pixels, garantindo 60 FPS sem travar o mapa.
   * - Trava o cursor e a linha perfeitamente sobre o ponto atraído.
   * - Quando há vértices vizinhos colados (< 18px), reserva zona neutra no meio para desengate livre.
   */
  static findNearbyVertex(map, mouseLatLng, activeTool, drawingPoints, engine, maxPixelDistance = null, excludeFeatureId = null) {
    if (!map || !mouseLatLng || DrawingSnappingHelper.altHeld) return null;
    if (engine && engine.snappingEnabled === false) return null;

    const baseRadius = (maxPixelDistance != null && maxPixelDistance > 0)
      ? maxPixelDistance
      : DrawingSnappingHelper.getBaseSnapRadius(map);

    const mousePt = map.latLngToContainerPoint(mouseLatLng);

    // 1. OTIMIZAÇÃO CRÍTICA DE PERFORMANCE:
    // Nunca varrer a viewport inteira! Criamos uma caixa geográfica local de ~32px em torno do cursor.
    const searchPadPx = 32;
    const sw = map.containerPointToLatLng([mousePt.x - searchPadPx, mousePt.y + searchPadPx]);
    const ne = map.containerPointToLatLng([mousePt.x + searchPadPx, mousePt.y - searchPadPx]);
    const minLat = Math.min(sw.lat, ne.lat);
    const maxLat = Math.max(sw.lat, ne.lat);
    const minLng = Math.min(sw.lng, ne.lng);
    const maxLng = Math.max(sw.lng, ne.lng);
    const searchBounds = { minLat, maxLat, minLng, maxLng };

    const candidates = []; // Array<{ pt: [number, number], p: L.Point, dist: number }>

    // Checagem geográfica preliminar ultra-rápida (nanossegundos) antes de chamar latLngToContainerPoint
    const testCoord = (lat, lng) => {
      if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) return;
      if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) return;

      const p = map.latLngToContainerPoint([lat, lng]);
      const d = Math.hypot(mousePt.x - p.x, mousePt.y - p.y);
      if (d <= searchPadPx) {
        candidates.push({ pt: [lat, lng], p, dist: d });
      }
    };

    // Vértices do buffer atual de desenho CAD
    if (Array.isArray(drawingPoints) && drawingPoints.length > 0) {
      if (activeTool === 'polygon' && drawingPoints.length >= 3 && !excludeFeatureId) {
        // Ponto de origem para fechar polígono
        const p0 = drawingPoints[0];
        testCoord(Number(p0.lat !== undefined ? p0.lat : p0[0]), Number(p0.lng !== undefined ? p0.lng : p0[1]));
      } else if (excludeFeatureId) {
        // Vértices da própria forma durante edição (VertexEditor)
        for (let i = 0; i < drawingPoints.length; i++) {
          const pt = drawingPoints[i];
          testCoord(Number(pt.lat !== undefined ? pt.lat : pt[0]), Number(pt.lng !== undefined ? pt.lng : pt[1]));
        }
      }
    }

    // 2. Consulta ultra-rápida no SpatialIndex (apenas as feições na caixinha de 32px)
    if (engine) {
      let nearbyFeatures = [];
      if (engine.spatialIndex && typeof engine.spatialIndex.query === 'function' && engine.spatialIndex.size > 0) {
        nearbyFeatures = engine.spatialIndex.query(searchBounds, 0) || [];
      } else if (engine.featureRenderer && Array.isArray(engine.featureRenderer.allFeatures)) {
        nearbyFeatures = engine.featureRenderer.allFeatures;
      }

      const layerMap = engine.featureRenderer?.layerMap;
      for (let f = 0; f < nearbyFeatures.length; f++) {
        const feat = nearbyFeatures[f];
        if (!feat || feat.visible === false) continue;
        if (layerMap && layerMap.get(feat.layerId)?.visible === false) continue;
        if (excludeFeatureId != null && feat.id === excludeFeatureId) continue;

        if (feat.type === 'Point' && feat.coordinates) {
          testCoord(Number(feat.coordinates[0]), Number(feat.coordinates[1]));
        } else if ((feat.type === 'LineString' || feat.type === 'Polygon') && Array.isArray(feat.coordinates)) {
          const scan = (coords) => {
            if (!Array.isArray(coords) || coords.length === 0) return;
            if (typeof coords[0] === 'number') {
              testCoord(Number(coords[0]), Number(coords[1]));
            } else if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
              for (let i = 0; i < coords.length; i++) {
                testCoord(Number(coords[i][0]), Number(coords[i][1]));
              }
            } else {
              for (let j = 0; j < coords.length; j++) scan(coords[j]);
            }
          };
          scan(feat.coordinates);
        }
      }
    }

    if (candidates.length === 0) return null;

    // Ordena pelo vértice mais próximo do cursor
    candidates.sort((a, b) => a.dist - b.dist);
    const closest = candidates[0];

    // Se o candidato mais próximo já está fora do raio base, não captura
    if (closest.dist > baseRadius) return null;

    // 3. Proteção contra pulos forçados entre vértices vizinhos muito próximos:
    let nearestNeighborDist = Infinity;
    for (let i = 1; i < candidates.length; i++) {
      const neighbor = candidates[i];
      const interDist = Math.hypot(closest.p.x - neighbor.p.x, closest.p.y - neighbor.p.y);
      if (interDist > 0.5 && interDist < nearestNeighborDist) {
        nearestNeighborDist = interDist;
      }
    }

    // Se dois vértices estiverem a menos de 18px um do outro na tela,
    // calibra o raio para garantir uma zona neutra no meio para desengatar livremente
    let effectiveRadius = baseRadius;
    if (nearestNeighborDist < Infinity && nearestNeighborDist < baseRadius * 2) {
      effectiveRadius = Math.min(baseRadius, Math.max(4, nearestNeighborDist * 0.42));
    }

    if (closest.dist <= effectiveRadius) {
      return closest.pt;
    }

    return null;
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

    const isSnapActive = !DrawingSnappingHelper.altHeld && (engine?.snappingEnabled !== false);
    const snapToggleHtml = `
      <button id="btn-cad-snap-toggle" class="cm-cad-snap-badge" style="background: ${isSnapActive ? 'rgba(0, 224, 138, 0.18)' : 'rgba(255, 255, 255, 0.08)'}; color: ${isSnapActive ? '#00E08A' : '#888'}; border: 1px solid ${isSnapActive ? '#00E08A' : 'rgba(255, 255, 255, 0.2)'}; border-radius: 12px; padding: 2px 8px; font-size: 11px; cursor: pointer; margin-left: 4px; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s ease;" title="Clique para alternar atração magnética (Atalho: tecla S)">🧲 Snap: ${isSnapActive ? 'ON' : 'OFF'} <strong style="font-size: 9px; opacity: 0.85;">[S]</strong></button>
    `;

    const bindSnapBtn = () => {
      const snapBtn = hud.querySelector('#btn-cad-snap-toggle');
      if (snapBtn && engine) {
        snapBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof engine.toggleSnapping === 'function') {
            engine.toggleSnapping();
          } else {
            engine.snappingEnabled = !engine.snappingEnabled;
          }
          DrawingSnappingHelper.updateDrawingHUD(activeTool, drawingPoints, cumulativeDist, engine, onFinish, onClear);
        });
      }
    };

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
      const totalDist = cumulativeDist || (engine ? engine.calculatePolylineLength(drawingPoints) : 0);
      const distFormatted = totalDist > 1000 ? `${(totalDist / 1000).toFixed(2)} km` : `${totalDist.toFixed(1)} m`;
      let areaInfo = '';
      if (count >= 3 && engine) {
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
        <span class="cm-cad-hud-hint">• <strong>[S]</strong> snap</span>
        ${snapToggleHtml}
        ${count >= 2 ? '<button id="btn-cad-finish" class="cm-cad-finish-btn" style="background: #f59e0b; color: #000;">📌 Fixar Medição</button>' : ''}
        <button id="btn-cad-clear" class="cm-cad-finish-btn" style="background: rgba(255,255,255,0.18); color: #fff;">✕ Limpar</button>
      `;

      bindSnapBtn();

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
    if (activeTool === 'rectangle') { toolName = 'Retângulo'; minPts = 2; }
    if (activeTool === 'ellipse') { toolName = 'Elipse'; minPts = 2; }
    if (activeTool === 'regular-polygon') { toolName = 'Polígono Regular (Hexágono)'; minPts = 2; }
    if (activeTool === 'star') { toolName = 'Estrela'; minPts = 2; }
    if (activeTool === 'split') { toolName = 'Divisão / Faca'; minPts = 2; }
    if (activeTool === 'pen-select') { toolName = 'Caneta de Seleção'; minPts = 3; }
    if (activeTool === 'circle') { toolName = 'Círculo'; minPts = 1; }
    if (activeTool === 'eyedropper') { toolName = 'Conta-gotas'; minPts = 1; }

    const canFinish = count >= minPts;

    hud.innerHTML = `
      <span class="cm-cad-hud-pulse"></span>
      <span><strong>${toolName}:</strong> ${count} vértice(s) adicionado(s)</span>
      <span class="cm-cad-hud-hint">• <strong>[Enter]</strong> conclui</span>
      <span class="cm-cad-hud-hint">• <strong>[Ctrl+Z]</strong> desfaz</span>
      <span class="cm-cad-hud-hint">• <strong>[Esc]</strong> cancela</span>
      <span class="cm-cad-hud-hint">• <strong>[S]</strong> ou <strong>[Alt]</strong> snap</span>
      ${snapToggleHtml}
      ${canFinish ? '<button id="btn-cad-finish" class="cm-cad-finish-btn">✔ Concluir Forma</button>' : ''}
    `;

    bindSnapBtn();

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
  const setAlt = (e) => { 
    if (DrawingSnappingHelper.altHeld !== e.altKey) {
      DrawingSnappingHelper.altHeld = e.altKey;
      const hud = document.getElementById('cm-cad-hud');
      if (hud && hud.style.display !== 'none') {
        const snapBtn = hud.querySelector('#btn-cad-snap-toggle');
        if (snapBtn) {
          const isSnap = !e.altKey;
          snapBtn.style.color = isSnap ? '#00E08A' : '#888';
          snapBtn.style.borderColor = isSnap ? '#00E08A' : 'rgba(255,255,255,0.2)';
        }
      }
    }
  };
  window.addEventListener('keydown', setAlt);
  window.addEventListener('keyup', setAlt);
  window.addEventListener('blur', () => { DrawingSnappingHelper.altHeld = false; });
}

