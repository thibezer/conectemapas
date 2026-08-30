/* ==========================================================================
   ConecteMapas - ProjectActionsController
   Responsabilidade Única: Ações de I/O de Projeto (Exportação, Importação,
   Gerenciamento de Camadas, Modelos de Projeto e Geolocalização).
   ========================================================================== */

import { GeoFormats } from '../services/GeoFormats.js';
import { normalizeFeature } from '../services/MockData.js';
import { UIToast } from 'ui-components-kit';

export class ProjectActionsController {
  static async handleExport(app, format) {
    try {
      let content = '';
      let mimeType = 'text/plain';
      let fileName = `${app.projectName.toLowerCase().replace(/\s+/g, '_')}.${format}`;
      let blob = null;

      if (format === 'shapefile' || format === 'shp') {
        blob = await GeoFormats.toShapefileZip(app.features, app.projectName.toLowerCase().replace(/\s+/g, '_'));
        fileName = `${app.projectName.toLowerCase().replace(/\s+/g, '_')}_shapefile.zip`;
      } else if (format === 'geojson') {
        content = GeoFormats.toGeoJSON(app.features, app.projectName);
        mimeType = 'application/geo+json';
        blob = new Blob([content], { type: mimeType });
      } else if (format === 'kml') {
        content = GeoFormats.toKML(app.features, app.projectName);
        mimeType = 'application/vnd.google-earth.kml+xml';
        blob = new Blob([content], { type: mimeType });
      } else if (format === 'gpx') {
        content = GeoFormats.toGPX(app.features, app.projectName);
        mimeType = 'application/gpx+xml';
        blob = new Blob([content], { type: mimeType });
      } else if (format === 'csv') {
        content = GeoFormats.toCSV(app.features);
        mimeType = 'text/csv';
        blob = new Blob([content], { type: mimeType });
      }

      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      UIToast.notificar({
        tipo: 'sucesso',
        titulo: 'Exportação Concluída',
        mensagem: `Arquivo ${fileName} baixado com sucesso!`,
        duracao: 4000
      });
    } catch (err) {
      UIToast.notificar({
        tipo: 'erro',
        titulo: 'Falha na Exportação',
        mensagem: err.message,
        duracao: 4000
      });
    }
  }

  static async handleImport(app, content, fileName) {
    try {
      UIToast.notificar({
        tipo: 'info',
        titulo: 'Processando Arquivo',
        mensagem: `Lendo geometrias e atributos de "${fileName}"...`,
        duracao: 2500
      });

      const parsed = await GeoFormats.parseUploadedFile(content, fileName);
      if (parsed.features && parsed.features.length > 0) {
        const normalized = parsed.features.map(f => normalizeFeature(f));
        app.pushHistory(`Importação de ${normalized.length} feições (${fileName})`);
        app.features.push(...normalized);
        app.refreshMapAndTable();
        app.saveState();

        let metaMsg = `${normalized.length} feições importadas com sucesso.`;
        if (parsed.metadata) {
          const m = parsed.metadata;
          metaMsg = `${normalized.length} feições do Shapefile "${m.baseName}" importadas. Projeção: ${m.projection} | Codificação: ${m.encoding.toUpperCase()}`;
        }

        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Importação Concluída',
          mensagem: metaMsg,
          duracao: 5000
        });

        if (normalized.length > 0 && normalized[0].id) {
          app.mapEngine.zoomToFeature(normalized[0].id);
        }

        const modal = document.getElementById('modal-import-export');
        if (modal && modal.fechar) modal.fechar();
      } else {
        UIToast.notificar({
          tipo: 'alerta',
          titulo: 'Nenhuma Feição Encontrada',
          mensagem: 'O arquivo não continha geometrias válidas.',
          duracao: 3000
        });
      }
    } catch (e) {
      console.error('Erro na importação:', e);
      UIToast.notificar({
        tipo: 'erro',
        titulo: 'Falha na Importação',
        mensagem: e.message || 'Não foi possível ler o arquivo fornecido.',
        duracao: 5000
      });
    }
  }

  static addNewLayer(app) {
    const name = prompt('Nome da nova camada:', 'Nova Camada ' + (app.layers.length + 1));
    if (!name) return;

    const colors = ['#00E08A', '#38bdf8', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'];
    const color = colors[app.layers.length % colors.length];

    const newLayer = {
      id: 'layer-' + Date.now(),
      name,
      color,
      visible: true,
      opacity: 1,
      locked: false
    };

    app.layers.push(newLayer);
    app.layerPanel.updateLayers(app.getLayersWithCounts());
    app.newFeatureModal.updateLayers(app.layers);
    app.saveState();

    UIToast.notificar({
      tipo: 'sucesso',
      titulo: 'Camada Criada',
      mensagem: `Camada "${name}" disponível para novos elementos.`,
      duracao: 3000
    });
  }

  static deleteLayer(app, layerId) {
    if (app.layers.length <= 1) {
      UIToast.notificar({ tipo: 'alerta', titulo: 'Aviso', mensagem: 'O projeto deve conter pelo menos uma camada ativa.' });
      return;
    }
    const layer = app.layers.find(l => l.id === layerId);
    const layerName = layer ? layer.name : layerId;
    const remainingLayer = app.layers.find(l => l.id !== layerId);

    app.features.forEach(f => {
      if (f.layerId === layerId) {
        f.layerId = remainingLayer.id;
      }
    });

    app.layers = app.layers.filter(l => l.id !== layerId);
    app.refreshMapAndTable();
    if (app.newFeatureModal) app.newFeatureModal.updateLayers(app.layers);
    app.saveState();

    UIToast.notificar({
      tipo: 'sucesso',
      titulo: 'Camada Excluída',
      mensagem: `Camada "${layerName}" removida. Feições movidas para "${remainingLayer.name}".`,
      duracao: 3000
    });
  }

  static loadTemplate(app, template) {
    app.projectName = template.title;
    app.layers = [...template.layers];
    app.features = [];
    app.mapEngine.map.setView(template.center, template.zoom);
    app.refreshMapAndTable();
    app.layerPanel.updateLayers(app.getLayersWithCounts());
    app.newFeatureModal.updateLayers(app.layers);
    app.saveState();

    UIToast.notificar({
      tipo: 'sucesso',
      titulo: 'Modelo Carregado',
      mensagem: `Template "${template.title}" pronto para uso.`,
      duracao: 3500
    });
  }

  static locateUser(app) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latlng = [pos.coords.latitude, pos.coords.longitude];
          app.mapEngine.map.flyTo(latlng, 16, { duration: 1.5 });
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'Localização Obtida',
            mensagem: `Posição GPS centrada no mapa.`,
            duracao: 3000
          });
        },
        () => {
          UIToast.notificar({
            tipo: 'alerta',
            titulo: 'GPS Indisponível',
            mensagem: 'Permissão de localização não concedida.',
            duracao: 3000
          });
        }
      );
    }
  }
}
