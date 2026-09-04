/* ==========================================================================
   ConecteMapas - ProjectActionsController
   Responsabilidade Única: Ações de I/O de Projeto (Exportação, Importação,
   Gerenciamento de Camadas, Modelos de Projeto e Geolocalização).
   ========================================================================== */

import { GeoFormats } from '../services/GeoFormats.js';
import { normalizeFeature } from '../services/MockData.js';
import { MapImageExporter } from '../services/MapImageExporter.js';
import { StorageService } from '../services/StorageService.js';
import { FeatureSyncController } from './FeatureSyncController.js';
import { UIToast } from 'ui-components-kit';

export class ProjectActionsController {
  static async handleExport(app, format, options = {}) {
    try {
      if (format === 'png' || format === 'image') {
        await MapImageExporter.exportMapToPNG(app, options);
        return;
      }

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

  static async handleExportImage(app, options = {}) {
    return MapImageExporter.exportMapToPNG(app, options);
  }

  static async handleImport(app, content, fileName, options = {}) {
    try {
      UIToast.notificar({
        tipo: 'info',
        titulo: 'Processando Arquivo',
        mensagem: `Lendo geometrias e atributos de "${fileName}"...`,
        duracao: 2500
      });

      const parsed = await GeoFormats.parseUploadedFile(content, fileName, options);

      // Se o arquivo tiver camadas (como AutoCAD DWG/DXF), integra ao projeto
      if (Array.isArray(parsed.layers) && parsed.layers.length > 0) {
        let addedLayersCount = 0;
        parsed.layers.forEach(cadLayer => {
          if (!app.layers.some(l => l.id === cadLayer.id)) {
            app.layers.push(cadLayer);
            addedLayersCount++;
          }
        });

        if (addedLayersCount > 0) {
          app.saveMetadata(false);
          if (app.layerPanel) {
            app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features);
          }
          if (app.newFeatureModal) {
            app.newFeatureModal.updateLayers(app.layers);
          }
        }
      }

      if (parsed.features && parsed.features.length > 0) {
        // Pipeline consolidado em lote via Web Worker (P1)
        const normalized = await FeatureSyncController.createFeaturesBatchAsync(app, parsed.features, {
          sourceDescription: `Importação de "${fileName}"`
        });

        let metaMsg = `${normalized.length} feições importadas com sucesso.`;
        if (parsed.metadata) {
          const m = parsed.metadata;
          metaMsg = `${normalized.length} feições do Shapefile "${m.baseName}" importadas. Projeção: ${m.projection} | Codificação: ${m.encoding.toUpperCase()}`;
        } else if (parsed.isDwg || fileName.toLowerCase().endsWith('.dwg') || fileName.toLowerCase().endsWith('.dxf')) {
          const cadVer = parsed.version?.versionName || 'AutoCAD CAD';
          const layerTotal = parsed.layers?.length || 1;
          metaMsg = `${normalized.length} entidades do ${cadVer} importadas em ${layerTotal} camada(s) com conversão UTM SIRGAS 2000.`;
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

        // Sincroniza lote importado com o MySQL da Hostinger em segundo plano
        StorageService.syncProjectToCloudDebounced({
          id: app.projectId || 'projeto_padrao',
          name: app.projectName,
          basemap: app.currentBasemap,
          layers: app.layers,
          features: app.features,
          center: app.mapEngine && app.mapEngine.map ? [app.mapEngine.map.getCenter().lat, app.mapEngine.map.getCenter().lng] : [-23.7661, -53.3206],
          zoom: app.mapEngine && app.mapEngine.map ? app.mapEngine.map.getZoom() : 14
        }, 1000);

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
      locked: false,
      order: app.layers.length
    };

    app.layers.push(newLayer);
    StorageService.saveLayer(newLayer);
    app.layerPanel.updateLayers(app.getLayersWithCounts());
    app.newFeatureModal.updateLayers(app.layers);
    app.saveMetadata();

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

    const movedFeatures = [];
    app.features.forEach(f => {
      if (f.layerId === layerId) {
        f.layerId = remainingLayer.id;
        movedFeatures.push(f);
      }
    });

    StorageService.deleteLayer(layerId, remainingLayer.id);
    if (movedFeatures.length > 0) {
      StorageService.queueFeaturesBulkUpsert(movedFeatures);
    }

    app.layers = app.layers.filter(l => l.id !== layerId);
    app.refreshMapAndTable();
    if (app.newFeatureModal) app.newFeatureModal.updateLayers(app.layers);
    app.saveMetadata(false);

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
    StorageService.saveFeaturesBatch([]);
    StorageService.saveLayersBatch(app.layers);
    app.saveMetadata(true);

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
