/* ==========================================================================
   ConecteMapas - FeatureSyncController
   Responsabilidade Única: Gerenciamento do ciclo de vida das feições
   (criação pós-desenho, edição paramétrica, exclusão e sincronização colaborativa).
   ========================================================================== */

import { normalizeFeature } from '../services/MockData.js';
import { UIToast } from 'ui-components-kit';

export class FeatureSyncController {
  static handleDrawingCompleted(app, rawFeature) {
    let defaultName = 'Nova Feição';
    let defaultCat = 'Geral';
    const num = Math.floor(Math.random() * 900 + 100);

    if (rawFeature.type === 'Point') {
      defaultName = `Ponto #${num}`;
      defaultCat = 'Marco Topográfico';
    } else if (rawFeature.type === 'LineString') {
      defaultName = `Rota #${num}`;
      defaultCat = 'Eixo Viário';
    } else if (rawFeature.type === 'Polygon') {
      defaultName = `Polígono #${num}`;
      defaultCat = 'Área Delimitada';
    } else if (rawFeature.type === 'Circle') {
      defaultName = `Buffer (${rawFeature.radius}m)`;
      defaultCat = 'Raio de Cobertura';
    }

    const targetLayer = app.layers.find(l => l.visible) || app.layers[0] || { id: 'layer-default', color: '#00E08A' };
    const layerColor = targetLayer.color || '#00E08A';

    const newFeature = normalizeFeature({
      ...rawFeature,
      id: 'feat-' + Date.now(),
      name: defaultName,
      layerId: targetLayer.id,
      category: defaultCat,
      color: layerColor,
      description: '',
      style: {
        fillColor: layerColor,
        fillOpacity: rawFeature.type === 'LineString' ? 1 : 0.35,
        strokeColor: layerColor,
        strokeWidth: 2.5,
        strokeDashArray: '',
        markerIcon: 'pin',
        markerSize: 24,
        markerRotation: 0,
        showLabel: false,
        labelField: 'name'
      },
      properties: {
        ...(rawFeature.properties || {})
      },
      createdBy: 'Você',
      createdAt: new Date().toISOString()
    });

    app.pushHistory(`Criação de "${newFeature.name}"`);
    app.features.push(newFeature);
    app.refreshMapAndTable();
    app.saveState();

    app.collabHub.notifyFeatureCreated(newFeature);
    const audit = app.collabHub.logAudit(`Criou feição "${newFeature.name}"`, newFeature.type);
    app.auditLog.unshift(audit);
    if (app.layerPanel) {
      app.layerPanel.updateAuditLog(app.auditLog);
      app.layerPanel.setSelectedFeature(newFeature);
    }

    UIToast.notificar({
      tipo: 'sucesso',
      titulo: 'Feição Salva no Mapa',
      mensagem: `"${newFeature.name}" adicionada ao mapa.`,
      duracao: 2500
    });
  }

  static updateFeature(app, updatedFeature) {
    const idx = app.features.findIndex(f => f.id === updatedFeature.id);
    if (idx >= 0) {
      if (updatedFeature.type === 'Polygon' && Array.isArray(updatedFeature.coordinates) && app.mapEngine) {
        const areaM2 = app.mapEngine.calculatePolygonArea(updatedFeature.coordinates);
        updatedFeature.properties = updatedFeature.properties || {};
        updatedFeature.properties['Área (ha)'] = (areaM2 / 10000).toFixed(2) + ' ha';
        updatedFeature.properties['Área (m²)'] = areaM2.toFixed(1) + ' m²';
      } else if (updatedFeature.type === 'LineString' && Array.isArray(updatedFeature.coordinates) && app.mapEngine) {
        const lengthM = app.mapEngine.calculatePolylineLength(updatedFeature.coordinates);
        updatedFeature.properties = updatedFeature.properties || {};
        updatedFeature.properties['Extensão'] = lengthM > 1000 ? (lengthM / 1000).toFixed(2) + ' km' : lengthM.toFixed(1) + ' m';
      }

      app.pushHistory(`Edição de "${updatedFeature.name}"`);
      app.features[idx] = updatedFeature;
      app.refreshMapAndTable();
      app.collabHub.notifyFeatureUpdated(updatedFeature);
      const audit = app.collabHub.logAudit(`Editou feição "${updatedFeature.name}"`, updatedFeature.id);
      app.auditLog.unshift(audit);
      app.layerPanel.updateAuditLog(app.auditLog);
      app.saveState();

      UIToast.notificar({
        tipo: 'sucesso',
        titulo: 'Alterações Salvas',
        mensagem: `Feição "${updatedFeature.name}" atualizada.`,
        duracao: 2000
      });
    }
  }

  static deleteFeature(app, featureId) {
    const feat = app.features.find(f => f.id === featureId);
    const name = feat ? feat.name : featureId;
    app.pushHistory(`Exclusão de "${name}"`);
    app.features = app.features.filter(f => f.id !== featureId);
    app.refreshMapAndTable();
    app.collabHub.notifyFeatureDeleted(featureId);
    const audit = app.collabHub.logAudit(`Excluiu feição "${name}"`, featureId);
    app.auditLog.unshift(audit);
    app.layerPanel.updateAuditLog(app.auditLog);
    app.saveState();

    UIToast.notificar({
      tipo: 'alerta',
      titulo: 'Feição Excluída',
      mensagem: `"${name}" removida. Pressione Ctrl+Z para desfazer.`,
      duracao: 3500
    });
  }

  static handleCollabEvent(app, type, data) {
    if (type === 'cursor:move') {
      if (app.mapEngine) {
        app.mapEngine.updateRemoteCursor(data.user, data.latlng);
      }
    } else if (type === 'feature:created') {
      app.features.push(data.feature);
      app.refreshMapAndTable();
      UIToast.notificar({
        tipo: 'informativo',
        titulo: 'Nova Feição Criada',
        mensagem: `${data.user.name} adicionou "${data.feature.name}".`,
        duracao: 3500
      });
    } else if (type === 'feature:updated') {
      const idx = app.features.findIndex(f => f.id === data.feature.id);
      if (idx >= 0) {
        app.features[idx] = data.feature;
        app.refreshMapAndTable();
      }
    } else if (type === 'feature:deleted') {
      app.features = app.features.filter(f => f.id !== data.featureId);
      app.refreshMapAndTable();
    } else if (type === 'chat:message') {
      if (app.layerPanel) {
        app.layerPanel.addChatMessage(data.message);
      }
    } else if (type === 'audit:log') {
      app.auditLog.unshift(data.entry);
      if (app.layerPanel) {
        app.layerPanel.updateAuditLog(app.auditLog);
      }
    } else if (type === 'user:joined' || type === 'user:presence') {
      if (app.headerBar) {
        app.headerBar.updateCollaborators(app.collabHub.getActiveCollaboratorsList());
      }
    }
  }
}
