/* ==========================================================================
   ConecteMapas - FeatureInspectorEvents
   Responsabilidade Única: Vinculação de eventos do Inspetor de Feições
   ========================================================================== */

import { GeoFormats } from '../../services/GeoFormats.js';
import { SpatialAlgorithms } from '../../services/SpatialAlgorithms.js';
import { UIToast } from 'ui-components-kit';

export class FeatureInspectorEvents {
  static bind(panel) {
    if (!panel.selectedFeature) return;

    const fillPicker = document.getElementById('style-fill-color');
    const fillHexBadge = document.getElementById('val-fill-color-hex');
    if (fillPicker && fillHexBadge) fillPicker.addEventListener('input', (e) => { fillHexBadge.textContent = e.target.value; });

    const strokePicker = document.getElementById('style-stroke-color');
    const strokeHexBadge = document.getElementById('val-stroke-color-hex');
    if (strokePicker && strokeHexBadge) strokePicker.addEventListener('input', (e) => { strokeHexBadge.textContent = e.target.value; });

    const pointPicker = document.getElementById('style-point-color');
    const pointHexBadge = document.getElementById('val-point-color-hex');
    if (pointPicker && pointHexBadge) pointPicker.addEventListener('input', (e) => { pointHexBadge.textContent = e.target.value; });

    const fillOpacitySlider = document.getElementById('style-fill-opacity');
    const fillOpacityBadge = document.getElementById('val-fill-opacity');
    if (fillOpacitySlider && fillOpacityBadge) fillOpacitySlider.addEventListener('input', (e) => { fillOpacityBadge.textContent = `${Math.round(e.target.value * 100)}%`; });

    const strokeWidthSlider = document.getElementById('style-stroke-width');
    const strokeWidthBadge = document.getElementById('val-stroke-width');
    if (strokeWidthSlider && strokeWidthBadge) strokeWidthSlider.addEventListener('input', (e) => { strokeWidthBadge.textContent = `${e.target.value}px`; });

    const markerSizeSlider = document.getElementById('style-marker-size');
    const markerSizeBadge = document.getElementById('val-marker-size');
    if (markerSizeSlider && markerSizeBadge) markerSizeSlider.addEventListener('input', (e) => { markerSizeBadge.textContent = `${e.target.value}px`; });

    const markerRotSlider = document.getElementById('style-marker-rot');
    const markerRotBadge = document.getElementById('val-marker-rot');
    if (markerRotSlider && markerRotBadge) markerRotSlider.addEventListener('input', (e) => { markerRotBadge.textContent = `${e.target.value}°`; });

    const btnLock = document.getElementById('btn-toggle-lock');
    if (btnLock) {
      btnLock.addEventListener('click', () => {
        const isLocked = !panel.selectedFeature.locked;
        const updated = { ...panel.selectedFeature, locked: isLocked };
        panel.selectedFeature = updated;
        panel.onFeatureUpdate(updated);
        panel.updateContent();
        UIToast.notificar({
          tipo: isLocked ? 'alerta' : 'sucesso',
          titulo: isLocked ? 'Feição Bloqueada' : 'Feição Desbloqueada',
          mensagem: isLocked ? 'Edições e exclusões travadas.' : 'Edição liberada no mapa.',
          duracao: 2000
        });
      });
    }

    const btnFloat = document.getElementById('btn-toggle-float');
    if (btnFloat) btnFloat.addEventListener('click', () => panel.toggleFloatingWindow());

    const btnFit = document.getElementById('btn-fit-feature');
    if (btnFit) btnFit.addEventListener('click', () => panel.onFitFeature(panel.selectedFeature.id));

    const btnGenBuffer = document.getElementById('btn-generate-buffer');
    if (btnGenBuffer) {
      btnGenBuffer.addEventListener('click', () => {
        const radiusInput = document.getElementById('buffer-radius-input');
        const radius = Math.max(1, parseFloat(radiusInput?.value) || 50);
        const bufferFeature = SpatialAlgorithms.generateBuffer(panel.selectedFeature, radius);
        if (bufferFeature) {
          panel.onFeatureCreate(bufferFeature);
          UIToast.notificar({ tipo: 'sucesso', titulo: 'Buffer Gerado', mensagem: `Buffer de ${radius}m criado no mapa.`, duracao: 2500 });
        }
      });
    }

    const dpSlider = document.getElementById('dp-tolerance-slider');
    const dpValBadge = document.getElementById('dp-tolerance-val');
    if (dpSlider && dpValBadge) dpSlider.addEventListener('input', (e) => { dpValBadge.textContent = `${e.target.value}m`; });

    const btnSimplify = document.getElementById('btn-simplify-dp');
    if (btnSimplify && Array.isArray(panel.selectedFeature.coordinates)) {
      btnSimplify.addEventListener('click', () => {
        const tol = parseFloat(dpSlider?.value) || 5;
        const isPoly = panel.selectedFeature.type === 'Polygon';
        const originalCount = panel.selectedFeature.coordinates.length;
        const simplified = SpatialAlgorithms.simplifyDouglasPeucker(panel.selectedFeature.coordinates, tol, isPoly);
        const reduced = originalCount - simplified.length;
        const updated = { ...panel.selectedFeature, coordinates: simplified };
        panel.selectedFeature = updated;
        panel.onFeatureUpdate(updated);
        panel.updateContent();
        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Geometria Simplificada',
          mensagem: reduced > 0 ? `${reduced} vértices removidos (tolerância ${tol}m).` : 'Geometria já otimizada.',
          duracao: 2500
        });
      });
    }

    const btnDup = document.getElementById('btn-duplicate-feat');
    if (btnDup) {
      btnDup.addEventListener('click', () => {
        const clone = SpatialAlgorithms.duplicateWithOffset(panel.selectedFeature, 30);
        if (clone) {
          panel.onFeatureCreate(clone);
          UIToast.notificar({ tipo: 'sucesso', titulo: 'Feição Duplicada', mensagem: 'Cópia criada com +30m de offset.', duracao: 2500 });
        }
      });
    }

    const btnAddAttr = document.getElementById('btn-add-custom-attr');
    if (btnAddAttr) {
      btnAddAttr.addEventListener('click', () => {
        const current = Array.isArray(panel.selectedFeature.customAttributes) ? [...panel.selectedFeature.customAttributes] : [];
        current.push({ key: '', value: '' });
        panel.selectedFeature.customAttributes = current;
        panel.updateContent();
      });
    }

    document.querySelectorAll('.btn-del-attr').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-attr-del'), 10);
        if (Array.isArray(panel.selectedFeature.customAttributes)) {
          panel.selectedFeature.customAttributes.splice(idx, 1);
          panel.updateContent();
        }
      });
    });

    const btnSave = document.getElementById('btn-save-inspector');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        if (panel.selectedFeature.locked) {
          UIToast.notificar({ tipo: 'alerta', titulo: 'Feição Bloqueada', mensagem: 'Desbloqueie o elemento antes de salvar.' });
          return;
        }

        const nameInput = document.getElementById('inspector-feat-name');
        const descInput = document.getElementById('inspector-feat-desc');
        const layerSelect = document.getElementById('inspector-feat-layer');
        const newName = nameInput ? nameInput.value.trim() : '';
        const newDesc = descInput ? descInput.value.trim() : '';
        const newLayerId = layerSelect ? layerSelect.value : (panel.selectedFeature.layerId || 'layer-topografia');

        const isPoint = panel.selectedFeature.type === 'Point';
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

        const currentStyle = panel.selectedFeature.style || {};
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

        const customAttrs = [];
        document.querySelectorAll('.cm-custom-attr-row').forEach(row => {
          const k = row.querySelector('.attr-key')?.value?.trim();
          const v = row.querySelector('.attr-val')?.value?.trim();
          if (k) customAttrs.push({ key: k, value: v || '' });
        });

        const historyList = Array.isArray(panel.selectedFeature.history) ? [...panel.selectedFeature.history] : [];
        historyList.unshift({
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          action: `Propriedades salvas por Você`
        });

        const updated = {
          ...panel.selectedFeature,
          name: newName || panel.selectedFeature.name,
          description: newDesc,
          layerId: newLayerId,
          color: newStyle.fillColor || newStyle.strokeColor || panel.selectedFeature.color,
          style: newStyle,
          customAttributes: customAttrs,
          history: historyList.slice(0, 8)
        };

        panel.selectedFeature = updated;
        panel.onFeatureUpdate(updated);
      });
    }

    const btnToggleVertex = document.getElementById('btn-toggle-vertex-edit');
    if (btnToggleVertex) {
      btnToggleVertex.addEventListener('click', () => {
        if (panel.selectedFeature.locked) {
          UIToast.notificar({ tipo: 'alerta', titulo: 'Feição Bloqueada', mensagem: 'Desbloqueie o elemento antes de editar vértices.' });
          return;
        }
        panel.isVertexEditing = !panel.isVertexEditing;
        if (panel.isVertexEditing) {
          panel.onStartVertexEdit(panel.selectedFeature);
        } else {
          panel.onStopVertexEdit();
        }
        panel.updateContent();
      });
    }

    document.querySelectorAll('[data-v-lat]').forEach(input => {
      input.addEventListener('change', (e) => {
        if (panel.selectedFeature.locked) return;
        const idx = parseInt(input.getAttribute('data-v-lat'), 10);
        const newLat = parseFloat(e.target.value);
        if (!isNaN(newLat) && Array.isArray(panel.selectedFeature.coordinates)) {
          const coords = [...panel.selectedFeature.coordinates];
          if (coords[idx]) {
            coords[idx] = [newLat, coords[idx][1]];
            const updated = { ...panel.selectedFeature, coordinates: coords };
            panel.selectedFeature = updated;
            panel.onFeatureUpdate(updated);
            panel.updateContent();
          }
        }
      });
    });

    document.querySelectorAll('[data-v-lng]').forEach(input => {
      input.addEventListener('change', (e) => {
        if (panel.selectedFeature.locked) return;
        const idx = parseInt(input.getAttribute('data-v-lng'), 10);
        const newLng = parseFloat(e.target.value);
        if (!isNaN(newLng) && Array.isArray(panel.selectedFeature.coordinates)) {
          const coords = [...panel.selectedFeature.coordinates];
          if (coords[idx]) {
            coords[idx] = [coords[idx][0], newLng];
            const updated = { ...panel.selectedFeature, coordinates: coords };
            panel.selectedFeature = updated;
            panel.onFeatureUpdate(updated);
            panel.updateContent();
          }
        }
      });
    });

    document.querySelectorAll('[data-v-del]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (panel.selectedFeature.locked) return;
        const idx = parseInt(btn.getAttribute('data-v-del'), 10);
        if (Array.isArray(panel.selectedFeature.coordinates)) {
          const minNodes = panel.selectedFeature.type === 'Polygon' ? 3 : 2;
          if (panel.selectedFeature.coordinates.length <= minNodes) {
            UIToast.notificar({ tipo: 'alerta', titulo: 'Limite Mínimo', mensagem: `A geometria não pode ter menos de ${minNodes} vértices.`, duracao: 2500 });
            return;
          }
          const coords = [...panel.selectedFeature.coordinates];
          coords.splice(idx, 1);
          const updated = { ...panel.selectedFeature, coordinates: coords };
          panel.selectedFeature = updated;
          panel.onFeatureUpdate(updated);
          panel.updateContent();
        }
      });
    });

    const btnCopyWKT = document.getElementById('btn-copy-wkt');
    if (btnCopyWKT) {
      btnCopyWKT.addEventListener('click', () => {
        const wkt = GeoFormats.toWKT(panel.selectedFeature);
        navigator.clipboard.writeText(wkt).then(() => {
          UIToast.notificar({ tipo: 'sucesso', titulo: 'WKT Copiado', mensagem: 'Geometria WKT copiada!', duracao: 2500 });
        });
      });
    }

    const btnCopyGeoJSON = document.getElementById('btn-copy-geojson');
    if (btnCopyGeoJSON) {
      btnCopyGeoJSON.addEventListener('click', () => {
        const geo = GeoFormats.toGeoJSON([panel.selectedFeature]);
        navigator.clipboard.writeText(geo).then(() => {
          UIToast.notificar({ tipo: 'sucesso', titulo: 'GeoJSON Copiado', mensagem: 'Feature GeoJSON copiada!', duracao: 2500 });
        });
      });
    }

    const btnCopyCSV = document.getElementById('btn-copy-coord-csv');
    if (btnCopyCSV) {
      btnCopyCSV.addEventListener('click', () => {
        const csv = GeoFormats.toCoordinateCSV(panel.selectedFeature);
        navigator.clipboard.writeText(csv).then(() => {
          UIToast.notificar({ tipo: 'sucesso', titulo: 'CSV de Vértices Copiado', mensagem: 'Tabela de coordenadas copiada!', duracao: 2500 });
        });
      });
    }

    const btnDelete = document.getElementById('btn-delete-inspector');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        if (panel.selectedFeature.locked) {
          UIToast.notificar({ tipo: 'alerta', titulo: 'Feição Bloqueada', mensagem: 'Desbloqueie o elemento antes de excluí-lo.' });
          return;
        }
        panel.onDeleteFeature(panel.selectedFeature.id);
        panel.setSelectedFeature(null);
      });
    }
  }
}
