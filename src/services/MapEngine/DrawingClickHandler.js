/* ==========================================================================
   ConecteMapas - DrawingClickHandler
   Responsabilidade Única: Roteamento de eventos de clique para ferramentas de desenho.
   ========================================================================== */

import L from 'leaflet';

export class DrawingClickHandler {
  /**
   * Processa o evento de clique do mapa durante modo de desenho ativo.
   * @param {Object} ctx - Instância do DrawingEngine
   * @param {Object} e - Evento de clique do Leaflet
   */
  static handleClick(ctx, e) {
    const rawLatLng = [e.latlng.lat, e.latlng.lng];
    const latlng = ctx._activeSnapLatLng || rawLatLng;
    const activeColor = ctx.activeDrawingLayer?.color || '#00E08A';
    const activeLayerId = ctx.activeDrawingLayer?.id;

    // A Caneta trabalha em mousedown/arraste/mouseup (ver DrawingEngine.penPointerDown); o clique já foi tratado
    if (ctx.activeTool === 'pen') return;

    if (ctx.activeTool === 'eyedropper') {
      const hitResult = ctx.engine.hitTester?.hitTest(e.latlng) || ctx.engine.hitTester?.hitTestAll(e.latlng)?.[0];
      const feat = hitResult?.feat || hitResult;
      ctx.resetDrawingState();
      ctx.setTool('select');
      if (feat && typeof ctx.engine.onEyedropperSampled === 'function') {
        ctx.engine.onEyedropperSampled(feat, latlng);
      }
      return;
    }

    if (ctx.activeTool === 'text') {
      if (ctx.engine && typeof ctx.engine.onTextPromptRequested === 'function') {
        ctx.engine.onTextPromptRequested(latlng);
      }
      return;
    }

    if (ctx.activeTool === 'point') {
      const activeStyles = ctx.engine.activeDrawingStyles || {};
      const strokeColor = activeStyles.strokeColor || '#ffffff';
      const fillColor = activeStyles.fillColor || activeColor;
      ctx.resetDrawingState();
      ctx.setTool('select');
      ctx.engine.onFeatureCreated({
        type: 'Point',
        coordinates: latlng,
        layerId: activeLayerId,
        color: strokeColor,
        style: {
          fillColor,
          strokeColor,
          fillOpacity: 1,
          markerSize: 24
        }
      });
      return;
    }

    if (ctx.activeTool === 'line') {
      ctx.drawingPoints.push(latlng);
      ctx._previewPoints = [...ctx.drawingPoints, latlng];
      ctx.renderVertexHandles();
      const activeStyles = ctx.engine.activeDrawingStyles || {};
      const strokeColor = activeStyles.strokeColor || activeColor;
      if (!ctx.tempLayer) {
        ctx.tempLayer = L.polyline(ctx.drawingPoints, {
          color: strokeColor,
          weight: 3,
          dashArray: '4, 4'
        }).addTo(ctx.map);
      } else {
        ctx.tempLayer.setLatLngs(ctx.drawingPoints);
      }
      ctx.updateDrawingHUD();
      return;
    }

    if (ctx.activeTool === 'pen-select') {
      if (ctx.drawingPoints.length >= 3 && ctx._activeSnapLatLng && 
          ctx._activeSnapLatLng[0] === ctx.drawingPoints[0][0] && 
          ctx._activeSnapLatLng[1] === ctx.drawingPoints[0][1]) {
        ctx.finalizeCurrentDrawing();
        return;
      }

      ctx.drawingPoints.push(latlng);
      ctx._previewPoints = [...ctx.drawingPoints, latlng];
      ctx.renderVertexHandles();
      if (!ctx.tempLayer) {
        ctx.tempLayer = L.polygon(ctx.drawingPoints, {
          color: '#00f5a0',
          fillColor: '#00f5a0',
          fillOpacity: 0.22,
          weight: 2,
          dashArray: '3, 3'
        }).addTo(ctx.map);
      } else {
        ctx.tempLayer.setLatLngs(ctx.drawingPoints);
      }
      ctx.updateDrawingHUD();
      return;
    }

    if (ctx.activeTool === 'polygon') {
      if (ctx.drawingPoints.length >= 3 && ctx._activeSnapLatLng && 
          ctx._activeSnapLatLng[0] === ctx.drawingPoints[0][0] && 
          ctx._activeSnapLatLng[1] === ctx.drawingPoints[0][1]) {
        ctx.finalizeCurrentDrawing();
        return;
      }

      ctx.drawingPoints.push(latlng);
      ctx._previewPoints = [...ctx.drawingPoints, latlng];
      ctx.renderVertexHandles();
      const activeStyles = ctx.engine.activeDrawingStyles || {};
      const strokeColor = activeStyles.strokeColor || '#ffffff';
      const fillColor = activeStyles.fillColor || activeColor;
      if (!ctx.tempLayer) {
        ctx.tempLayer = L.polygon(ctx.drawingPoints, {
          color: strokeColor,
          fillColor: fillColor,
          fillOpacity: 0.35,
          weight: 2.5,
          dashArray: '4, 4'
        }).addTo(ctx.map);
      } else {
        ctx.tempLayer.setLatLngs(ctx.drawingPoints);
      }
      ctx.updateDrawingHUD();
      return;
    }

    if (ctx.activeTool === 'circle') {
      if (ctx.drawingPoints.length === 0) {
        ctx.drawingPoints.push(latlng);
        ctx._previewPoints = [...ctx.drawingPoints, latlng];
        ctx.renderVertexHandles();
        ctx.updateDrawingHUD();
      } else {
        const center = ctx.drawingPoints[0];
        const radius = ctx.engine.calculateDistance(center, latlng);
        if (radius < 2) return;
        ctx.lastCircleRadius = radius;
        ctx.finalizeCurrentDrawing();
      }
      return;
    }

    if (ctx.activeTool === 'rectangle' || ctx.activeTool === 'ellipse' || 
        ctx.activeTool === 'regular-polygon' || ctx.activeTool === 'star') {
      if (ctx.drawingPoints.length === 0) {
        ctx.drawingPoints.push(latlng);
        ctx._previewPoints = [latlng, latlng];
        ctx.renderVertexHandles();
        ctx.updateDrawingHUD();
      } else {
        ctx.drawingPoints.push(latlng);
        ctx.finalizeCurrentDrawing();
      }
      return;
    }

    if (ctx.activeTool === 'split') {
      ctx.drawingPoints.push(latlng);
      ctx._previewPoints = [...ctx.drawingPoints, latlng];
      ctx.renderVertexHandles();
      if (!ctx.tempLayer) {
        ctx.tempLayer = L.polyline(ctx.drawingPoints, {
          color: '#ff4444',
          weight: 3,
          dashArray: '5, 5'
        }).addTo(ctx.map);
      } else {
        ctx.tempLayer.setLatLngs(ctx.drawingPoints);
      }
      ctx.updateDrawingHUD();

      if (ctx.drawingPoints.length >= 2) {
        ctx.finalizeCurrentDrawing();
      }
      return;
    }

    if (ctx.activeTool === 'measure') {
      if (ctx.drawingPoints.length > 0) {
        const prev = ctx.drawingPoints[ctx.drawingPoints.length - 1];
        ctx._cumulativeMeasureDistance += ctx.engine.calculateDistance(prev, latlng);
      } else {
        ctx._cumulativeMeasureDistance = 0;
      }
      ctx.drawingPoints.push(latlng);
      ctx._previewPoints = [...ctx.drawingPoints, latlng];
      ctx.renderVertexHandles();
      if (!ctx.tempLayer) {
        ctx.tempLayer = L.polyline(ctx.drawingPoints, {
          color: '#ffb86c',
          weight: 3
        }).addTo(ctx.map);
      } else {
        ctx.tempLayer.setLatLngs(ctx.drawingPoints);
      }
      ctx.updateMeasureTooltip(e.latlng);
      ctx.updateDrawingHUD();
    }
  }
}
