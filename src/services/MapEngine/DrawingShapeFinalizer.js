/* ==========================================================================
   ConecteMapas - DrawingShapeFinalizer
   Responsabilidade Única: Conversão de buffers CAD em feições geográficas definitivas.
   GEMINI.md Guard:
   Ordem obrigatória ao concluir:
   1. resetDrawingState()
   2. setTool('select')
   3. engine.onFeatureCreated(feature) / engine.selectFeatures(selectedIds)
   ========================================================================== */

import { DrawingPenSelectHelper } from './DrawingPenSelectHelper.js';
import { ShapeGeometryGenerator } from './ShapeGeometryGenerator.js';

export class DrawingShapeFinalizer {
  /**
   * Finaliza o desenho CAD atual de acordo com a ferramenta ativa.
   * @param {Object} ctx - Contexto de desenho (DrawingEngine)
   * @returns {boolean} Se a forma foi finalizada com sucesso
   */
  static finalize(ctx) {
    const { activeTool, drawingPoints, lastCircleRadius, activeDrawingLayer, engine } = ctx;
    const layerId = activeDrawingLayer ? activeDrawingLayer.id : undefined;
    const layerColor = activeDrawingLayer ? activeDrawingLayer.color : undefined;

    const activeStyles = engine.activeDrawingStyles || {};
    const strokeColor = activeStyles.strokeColor || '#ffffff';
    const fillColor = activeStyles.fillColor || layerColor || '#00E08A';
    const fillOpacity = activeStyles.fillOpacity !== undefined ? activeStyles.fillOpacity : 0.35;
    const strokeWidth = activeStyles.strokeWidth !== undefined ? activeStyles.strokeWidth : 2.5;

    const shapeStyle = {
      fillColor,
      strokeColor,
      fillOpacity,
      strokeWidth
    };

    if (activeTool === 'line' && drawingPoints.length >= 2) {
      const coords = [...drawingPoints];
      ctx.resetDrawingState();
      ctx.setTool('select');

      engine.onFeatureCreated({
        type: 'LineString',
        coordinates: coords,
        layerId,
        color: strokeColor,
        style: {
          strokeColor,
          strokeWidth
        }
      });
      return true;
    }

    if (activeTool === 'pen-select' && drawingPoints.length >= 3) {
      const polyCoords = [...drawingPoints];
      ctx.resetDrawingState();
      ctx.setTool('select');

      const allFeatures = engine.featureRenderer?.allFeatures || [];
      const layerMap = engine.featureRenderer?.layerMap || new Map();
      const selectedIds = DrawingPenSelectHelper.processPenSelection(polyCoords, allFeatures, layerMap);

      if (typeof engine.selectFeatures === 'function') {
        engine.selectFeatures(selectedIds);
      }
      return true;
    }

    if (activeTool === 'polygon' && drawingPoints.length >= 3) {
      const coords = [...drawingPoints];
      ctx.resetDrawingState();
      ctx.setTool('select');

      engine.onFeatureCreated({
        type: 'Polygon',
        coordinates: coords,
        layerId,
        color: strokeColor,
        style: { ...shapeStyle }
      });
      return true;
    }

    if (activeTool === 'rectangle' && drawingPoints.length >= 2) {
      const p1 = drawingPoints[0];
      const p2 = drawingPoints[1];
      const minLat = Math.min(p1[0], p2[0]);
      const maxLat = Math.max(p1[0], p2[0]);
      const minLng = Math.min(p1[1], p2[1]);
      const maxLng = Math.max(p1[1], p2[1]);
      const polyCoords = [
        [maxLat, minLng],
        [maxLat, maxLng],
        [minLat, maxLng],
        [minLat, minLng]
      ];
      ctx.resetDrawingState();
      ctx.setTool('select');

      engine.onFeatureCreated({
        type: 'Polygon',
        coordinates: polyCoords,
        layerId,
        color: strokeColor,
        style: { ...shapeStyle }
      });
      return true;
    }

    if (activeTool === 'ellipse' && drawingPoints.length >= 2) {
      const polyCoords = ShapeGeometryGenerator.generateEllipse(drawingPoints[0], drawingPoints[1]);
      ctx.resetDrawingState();
      ctx.setTool('select');

      engine.onFeatureCreated({
        type: 'Polygon',
        coordinates: polyCoords,
        layerId,
        color: strokeColor,
        style: { ...shapeStyle }
      });
      return true;
    }

    if (activeTool === 'regular-polygon' && drawingPoints.length >= 2) {
      const polyCoords = ShapeGeometryGenerator.generateRegularPolygon(drawingPoints[0], drawingPoints[1], 6);
      ctx.resetDrawingState();
      ctx.setTool('select');

      engine.onFeatureCreated({
        type: 'Polygon',
        coordinates: polyCoords,
        layerId,
        color: strokeColor,
        style: { ...shapeStyle }
      });
      return true;
    }

    if (activeTool === 'star' && drawingPoints.length >= 2) {
      const polyCoords = ShapeGeometryGenerator.generateStar(drawingPoints[0], drawingPoints[1], 5);
      ctx.resetDrawingState();
      ctx.setTool('select');

      engine.onFeatureCreated({
        type: 'Polygon',
        coordinates: polyCoords,
        layerId,
        color: strokeColor,
        style: { ...shapeStyle }
      });
      return true;
    }

    if (activeTool === 'split' && drawingPoints.length >= 2) {
      const lineCoords = [...drawingPoints];
      ctx.resetDrawingState();
      ctx.setTool('select');

      if (typeof engine.onSplitRequested === 'function') {
        engine.onSplitRequested(lineCoords);
      }
      return true;
    }

    if (activeTool === 'circle' && drawingPoints.length >= 1 && lastCircleRadius && lastCircleRadius >= 2) {
      const center = drawingPoints[0];
      const radius = Math.round(lastCircleRadius);
      ctx.resetDrawingState();
      ctx.setTool('select');

      engine.onFeatureCreated({
        type: 'Circle',
        coordinates: center,
        radius,
        layerId,
        color: strokeColor,
        style: { ...shapeStyle }
      });
      return true;
    }

    if (activeTool === 'measure' && drawingPoints.length >= 2) {
      const totalDist = engine.calculatePolylineLength(drawingPoints);
      const distFormatted = totalDist > 1000 ? `${(totalDist / 1000).toFixed(2)} km` : `${totalDist.toFixed(1)} m`;
      const coords = [...drawingPoints];
      const segs = engine.calculateSegments(coords);
      const segText = segs.map((s, i) => `T${i + 1}: ${s.distance > 1000 ? (s.distance / 1000).toFixed(2) + 'km' : s.distance.toFixed(1) + 'm'}`).join(', ');

      let areaM2 = 0;
      let areaText = '';
      if (coords.length >= 3) {
        areaM2 = engine.calculatePolygonArea(coords);
        areaText = `${(areaM2 / 10000).toFixed(2)} ha`;
      }

      ctx.resetDrawingState();
      ctx.setTool('select');

      engine.onFeatureCreated({
        type: 'LineString',
        coordinates: coords,
        name: `Medição (${distFormatted})`,
        category: 'Medição & Cotas',
        layerId,
        color: '#f59e0b',
        properties: {
          'Extensão Total': distFormatted,
          'Vértices': coords.length,
          'Trechos': segText,
          ...(areaM2 > 0 ? { 'Área Delimitada': areaText, 'Área (m²)': areaM2.toFixed(1) + ' m²' } : {})
        },
        style: {
          strokeColor: '#f59e0b',
          strokeWidth: 3,
          strokeDashArray: '6, 4',
          showLabel: true,
          labelField: 'extensao'
        }
      });
      return true;
    }

    return false;
  }
}
