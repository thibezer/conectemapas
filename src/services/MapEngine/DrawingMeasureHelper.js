/* ==========================================================================
   ConecteMapas - DrawingMeasureHelper
   Cálculo e renderização de vértices, cotas de trecho, polígono de área
   e tooltips flutuantes para a ferramenta CAD de Régua de Medição.
   ========================================================================== */

import L from 'leaflet';

export class DrawingMeasureHelper {
  static renderMeasureHandles(drawingPoints, vertexMarkers, measureSegmentsLayer, measurePolygonLayer, map, engine) {
    if (!vertexMarkers || !measureSegmentsLayer || !map) return measurePolygonLayer;

    vertexMarkers.clearLayers();
    measureSegmentsLayer.clearLayers();

    drawingPoints.forEach((pt, index) => {
      const markerIcon = L.divIcon({
        className: 'cm-measure-vertex-divicon',
        html: `<div class="cm-measure-vertex-marker">${index + 1}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
      const marker = L.marker(pt, { icon: markerIcon, interactive: false });
      vertexMarkers.addLayer(marker);

      if (index > 0) {
        const prevPt = drawingPoints[index - 1];
        const segDist = engine.calculateDistance(prevPt, pt);
        const segDistText = segDist > 1000 ? `${(segDist / 1000).toFixed(2)} km` : `${segDist.toFixed(1)} m`;
        const midPt = [(prevPt[0] + pt[0]) / 2, (prevPt[1] + pt[1]) / 2];

        const badgeIcon = L.divIcon({
          className: 'cm-measure-segment-divicon',
          html: `<div class="cm-measure-segment-badge">${segDistText}</div>`,
          iconSize: null,
          iconAnchor: [0, 0]
        });
        const badgeMarker = L.marker(midPt, { icon: badgeIcon, interactive: false });
        measureSegmentsLayer.addLayer(badgeMarker);
      }
    });

    let poly = measurePolygonLayer;
    if (drawingPoints.length >= 3) {
      if (!poly) {
        poly = L.polygon(drawingPoints, {
          color: '#f59e0b',
          fillColor: '#f59e0b',
          fillOpacity: 0.16,
          weight: 1.5,
          dashArray: '4, 4'
        }).addTo(map);
      } else {
        poly.setLatLngs(drawingPoints);
      }
    } else if (poly) {
      map.removeLayer(poly);
      poly = null;
    }
    return poly;
  }

  static updateMeasureTooltip(map, currentTooltip, latlng, drawingPoints, currentLatLng, cumulativeDist, engine) {
    if (!map) return currentTooltip;
    let distanceMeters = 0;
    let segmentMeters = 0;
    let bearing = null;
    let areaM2 = 0;

    if (currentLatLng && drawingPoints.length > 0) {
      const lastFixedPoint = drawingPoints[drawingPoints.length - 1];
      segmentMeters = engine.calculateDistance(lastFixedPoint, currentLatLng);
      distanceMeters = cumulativeDist + segmentMeters;
      bearing = engine.calculateBearing(lastFixedPoint, currentLatLng);

      if (drawingPoints.length >= 2) {
        areaM2 = engine.calculatePolygonArea([...drawingPoints, currentLatLng]);
      }
    } else {
      distanceMeters = cumulativeDist || engine.calculatePolylineLength(drawingPoints);
    }

    const totalDistText = distanceMeters > 1000 
      ? `${(distanceMeters / 1000).toFixed(2)} km`
      : `${distanceMeters.toFixed(1)} m`;

    const segmentDistText = segmentMeters > 1000 
      ? `${(segmentMeters / 1000).toFixed(2)} km` 
      : `${segmentMeters.toFixed(1)} m`;

    let bearingText = '';
    if (bearing !== null) {
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const dirIdx = Math.round(bearing / 45) % 8;
      bearingText = `${bearing.toFixed(1)}° ${dirs[dirIdx]}`;
    }

    const tooltipHtml = `
      <div class="cm-measure-tooltip-box">
        <div>📏 Trecho: <strong style="color: #fbbf24;">${segmentDistText}</strong></div>
        <div>📍 Total: <strong style="color: #60a5fa;">${totalDistText}</strong></div>
        ${bearingText ? `<div>🧭 Azimute: <strong style="color: #34d399;">${bearingText}</strong></div>` : ''}
        ${areaM2 > 0 ? `<div>📐 Área: <strong style="color: #a78bfa;">${(areaM2 / 10000).toFixed(2)} ha</strong></div>` : ''}
      </div>
    `;

    let tooltip = currentTooltip;
    if (!tooltip) {
      tooltip = L.popup({
        closeButton: false,
        offset: [0, -12],
        className: 'cm-measure-popup'
      })
      .setLatLng(latlng)
      .setContent(tooltipHtml)
      .openOn(map);
    } else {
      tooltip.setLatLng(latlng);
      tooltip.setContent(tooltipHtml);
    }
    return tooltip;
  }
}
