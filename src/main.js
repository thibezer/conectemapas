/* ==========================================================================
   ConecteMapas - Main Application Entrypoint
   Plataforma Colaborativa de Mapeamento com thibezer/Componentes-UI
   ========================================================================== */

// 1. Importação da biblioteca oficial de Web Components
import 'ui-components-kit/style.css';
import 'ui-components-kit';
import { UIToast, UIBus } from 'ui-components-kit';

// 2. Importação dos Serviços e Componentes
import { StorageService } from './services/StorageService.js';
import { DEFAULT_LAYERS, DEFAULT_FEATURES, normalizeFeature } from './services/MockData.js';
import { GeoFormats } from './services/GeoFormats.js';
import { CollaborationHub } from './services/CollaborationHub.js';
import { MapEngine } from './services/MapEngine.js';

import { HeaderBar } from './components/HeaderBar.js';
import { DrawingToolbar } from './components/DrawingToolbar.js';
import { LayerPanel } from './components/LayerPanel.js';
import { AttributeTable } from './components/AttributeTable.js';

import { ShareModal } from './components/Modals/ShareModal.js';
import { ImportExportModal } from './components/Modals/ImportExportModal.js';
import { ProjectTemplatesModal } from './components/Modals/ProjectTemplatesModal.js';
import { NewFeatureModal } from './components/Modals/NewFeatureModal.js';

class ConecteMapasApp {
  constructor() {
    this.projectName = 'Levantamento Planialtimétrico - Brasília';
    this.layers = [...DEFAULT_LAYERS];
    this.features = [...DEFAULT_FEATURES];
    this.auditLog = [];
    this.chatMessages = [];
    this.currentBasemap = 'satelite';

    this.mapEngine = null;
    this.collabHub = null;
    this.headerBar = null;
    this.drawingToolbar = null;
    this.layerPanel = null;
    this.attributeTable = null;
    this.newFeatureModal = null;

    // Histórico de Ações para Undo / Redo
    this.historyUndo = [];
    this.historyRedo = [];

    this.init();
  }

  init() {
    this.loadState();
    this.initCollaboration();
    this.initMap();
    this.initComponents();
    this.updateHUD();

    // Notificação inicial de boas-vindas
    setTimeout(() => {
      UIToast.notificar({
        tipo: 'sucesso',
        titulo: 'ConecteMapas Iniciado',
        mensagem: 'Sessão colaborativa ativa com Componentes-UI.',
        duracao: 4000
      });
    }, 500);
  }

  loadState() {
    const saved = StorageService.loadCurrentProject();
    if (saved) {
      if (saved.name) this.projectName = saved.name;
      if (Array.isArray(saved.layers)) this.layers = saved.layers;
      if (Array.isArray(saved.features)) this.features = saved.features.map(normalizeFeature);
      if (Array.isArray(saved.auditLog)) this.auditLog = saved.auditLog;
      if (saved.basemap) this.currentBasemap = saved.basemap;
    } else {
      // Registra entrada inicial
      this.auditLog.push({
        id: 'aud_init',
        action: 'Projeto inicializado',
        user: 'Sistema',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      });
    }
  }

  saveState() {
    const success = StorageService.saveProject({
      name: this.projectName,
      basemap: this.currentBasemap,
      layers: this.layers,
      features: this.features,
      auditLog: this.auditLog
    });

    const syncChip = document.getElementById('cm-sync-chip');
    if (syncChip) {
      if (success) {
        syncChip.setAttribute('variante', 'sucesso');
        syncChip.textContent = '● Salvo no Banco Local';
      } else {
        syncChip.setAttribute('variante', 'alerta');
        syncChip.textContent = '▲ Limite LocalStorage (Salvo apenas no IndexedDB)';
        UIToast.notificar({
          tipo: 'alerta',
          titulo: 'Armazenamento Volumoso',
          mensagem: 'O volume de dados excede o limite do LocalStorage. Os dados continuam salvos no IndexedDB.',
          duracao: 4000
        });
      }
    }
  }

  initCollaboration() {
    this.collabHub = new CollaborationHub(null, (type, data) => {
      this.handleCollabEvent(type, data);
    });
  }

  handleCollabEvent(type, data) {
    if (type === 'cursor:move') {
      if (this.mapEngine) {
        this.mapEngine.updateRemoteCursor(data.user, data.latlng);
      }
    } else if (type === 'feature:created') {
      this.features.push(data.feature);
      this.refreshMapAndTable();
      UIToast.notificar({
        tipo: 'informativo',
        titulo: 'Nova Feição Criada',
        mensagem: `${data.user.name} adicionou "${data.feature.name}".`,
        duracao: 3500
      });
    } else if (type === 'feature:updated') {
      const idx = this.features.findIndex(f => f.id === data.feature.id);
      if (idx >= 0) {
        this.features[idx] = data.feature;
        this.refreshMapAndTable();
      }
    } else if (type === 'feature:deleted') {
      this.features = this.features.filter(f => f.id !== data.featureId);
      this.refreshMapAndTable();
    } else if (type === 'chat:message') {
      if (this.layerPanel) {
        this.layerPanel.addChatMessage(data.message);
      }
    } else if (type === 'audit:log') {
      this.auditLog.unshift(data.entry);
      if (this.layerPanel) {
        this.layerPanel.updateAuditLog(this.auditLog);
      }
    } else if (type === 'user:joined' || type === 'user:presence') {
      if (this.headerBar) {
        this.headerBar.updateCollaborators(this.collabHub.getActiveCollaboratorsList());
      }
    }
  }

  initMap() {
    this.mapEngine = new MapEngine('map-viewport', {
      onFeatureCreated: (rawFeature) => {
        this.handleDrawingCompleted(rawFeature);
      },
      onFeatureSelected: (feature) => {
        if (this.layerPanel) {
          this.layerPanel.setSelectedFeature(feature);
        }
      },
      onCursorMove: (latlng) => {
        if (this.collabHub) {
          this.collabHub.sendCursorPosition([latlng.lat, latlng.lng]);
        }
        const latSpan = document.getElementById('hud-latlng');
        if (latSpan) {
          latSpan.textContent = `Lat: ${latlng.lat.toFixed(5)} | Lng: ${latlng.lng.toFixed(5)}`;
        }
      }
    });

    this.mapEngine.setBaseLayer(this.currentBasemap);
    this.mapEngine.renderFeatures(this.features, this.layers);

    this.mapEngine.map.on('zoomend', () => {
      const zoomSpan = document.getElementById('hud-zoom');
      if (zoomSpan && this.mapEngine.map) {
        zoomSpan.textContent = `Zoom: ${this.mapEngine.map.getZoom()}`;
      }
    });
  }

  initComponents() {
    // 1. Header Bar
    this.headerBar = new HeaderBar({
      projectName: this.projectName,
      collaborators: this.collabHub.getActiveCollaboratorsList(),
      onProjectNameChange: (newName) => {
        this.projectName = newName;
        this.saveState();
        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Projeto Renomeado',
          mensagem: `Nome atualizado para "${newName}".`,
          duracao: 2500
        });
      },
      onSaveProject: () => {
        this.saveState();
        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Projeto Salvo',
          mensagem: `${this.features.length} feições gravadas no banco local com sucesso.`,
          duracao: 3000
        });
      }
    });
    this.headerBar.render(document.getElementById('header-mount'));

    // 2. Drawing Toolbar
    this.drawingToolbar = new DrawingToolbar({
      onToolChange: (tool) => {
        this.mapEngine.setTool(tool);
        UIToast.notificar({
          tipo: 'informativo',
          titulo: 'Ferramenta Ativa',
          mensagem: `Modo: ${this.getToolName(tool)}`,
          duracao: 1500
        });
      },
      onAction: (action) => {
        if (action === 'locate') {
          this.locateUser();
        } else if (action === 'fit') {
          this.mapEngine.fitAllFeatures();
          UIToast.notificar({
            tipo: 'informativo',
            titulo: 'Vista Enquadrada',
            mensagem: 'Todas as feições foram centralizadas.',
            duracao: 2000
          });
        }
      }
    });
    this.drawingToolbar.render(document.getElementById('drawing-toolbar-mount'));

    // 3. Layer & Inspector & Collab Panel
    this.layerPanel = new LayerPanel({
      layers: this.getLayersWithCounts(),
      currentBasemap: this.currentBasemap,
      auditLog: this.auditLog,
      chatMessages: this.chatMessages,
      onLayerToggle: (layerId, isVisible) => {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
          layer.visible = isVisible;
          this.mapEngine.renderFeatures(this.features, this.layers);
          this.saveState();
        }
      },
      onBasemapChange: (basemapName) => {
        this.currentBasemap = basemapName;
        this.mapEngine.setBaseLayer(basemapName);
        this.saveState();
      },
      onAddLayer: () => {
        this.addNewLayer();
      },
      onDeleteFeature: (featureId) => {
        this.deleteFeature(featureId);
      },
      onFeatureUpdate: (updatedFeature) => {
        this.updateFeature(updatedFeature);
      },
      onFeatureCreate: (newFeature) => {
        const norm = normalizeFeature(newFeature);
        this.pushHistory(`Criação de "${norm.name}"`);
        this.features.push(norm);
        this.refreshMapAndTable();
        this.collabHub.notifyFeatureCreated(norm);
        const audit = this.collabHub.logAudit(`Criou feição "${norm.name}"`, norm.type);
        this.auditLog.unshift(audit);
        this.layerPanel.updateAuditLog(this.auditLog);
        this.layerPanel.setSelectedFeature(norm);
        this.saveState();
      },
      onFitFeature: (featureId) => {
        this.mapEngine.zoomToFeature(featureId);
      },
      onStartVertexEdit: (feature) => {
        this.mapEngine.startVertexEditing(feature, (updated) => {
          this.updateFeature(updated);
        });
      },
      onStopVertexEdit: () => {
        this.mapEngine.stopVertexEditing();
      },
      onSendMessage: (text) => {
        const msg = this.collabHub.sendChatMessage(text);
        this.layerPanel.addChatMessage(msg);
      }
    });
    this.layerPanel.render(document.getElementById('layer-panel-mount'));

    // 4. Attribute Table
    this.attributeTable = new AttributeTable({
      features: this.features,
      layers: this.layers,
      onRowClick: (feat) => {
        this.mapEngine.zoomToFeature(feat.id);
        if (this.layerPanel) {
          this.layerPanel.setSelectedFeature(feat);
        }
      },
      onDelete: (featureId) => {
        this.deleteFeature(featureId);
      }
    });
    this.attributeTable.render(document.getElementById('attribute-table-mount'));

    // 5. Modals
    new ShareModal().render(document.getElementById('share-modal-mount'));

    new ImportExportModal({
      onExport: (format) => this.handleExport(format),
      onImport: (content, fileName) => this.handleImport(content, fileName)
    }).render(document.getElementById('import-export-modal-mount'));

    new ProjectTemplatesModal({
      onSelectTemplate: (template) => this.loadTemplate(template)
    }).render(document.getElementById('templates-modal-mount'));

    this.newFeatureModal = new NewFeatureModal({
      layers: this.layers,
      onSave: (newFeature) => {
        this.pushHistory(`Criação de "${newFeature.name}"`);
        this.features.push(newFeature);
        this.refreshMapAndTable();
        this.collabHub.notifyFeatureCreated(newFeature);
        const audit = this.collabHub.logAudit(`Criou feição "${newFeature.name}"`, newFeature.type);
        this.auditLog.unshift(audit);
        this.layerPanel.updateAuditLog(this.auditLog);
        this.saveState();

        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Feição Adicionada',
          mensagem: `"${newFeature.name}" inserida com sucesso.`,
          duracao: 3000
        });
      }
    });
    this.newFeatureModal.render(document.getElementById('new-feature-modal-mount'));

    // 6. Listeners Globais de Teclado (Undo / Redo / CAD)
    this.bindGlobalKeyboardShortcuts();
  }

  pushHistory(description = '') {
    this.historyUndo.push(JSON.stringify(this.features));
    if (this.historyUndo.length > 50) this.historyUndo.shift();
    this.historyRedo = []; // limpa pilha de refazer ao realizar nova ação
  }

  undo() {
    if (this.historyUndo.length === 0) {
      UIToast.notificar({
        tipo: 'informativo',
        titulo: 'Histórico Vazio',
        mensagem: 'Nenhuma ação recente para desfazer.',
        duracao: 2000
      });
      return;
    }

    this.historyRedo.push(JSON.stringify(this.features));
    const previousSnapshot = this.historyUndo.pop();
    this.features = JSON.parse(previousSnapshot);
    this.refreshMapAndTable();
    this.saveState();

    UIToast.notificar({
      tipo: 'sucesso',
      titulo: 'Desfeito (Ctrl+Z)',
      mensagem: 'Estado anterior recuperado.',
      duracao: 2000
    });
  }

  redo() {
    if (this.historyRedo.length === 0) {
      UIToast.notificar({
        tipo: 'informativo',
        titulo: 'Histórico Vazio',
        mensagem: 'Nenhuma ação para refazer.',
        duracao: 2000
      });
      return;
    }

    this.historyUndo.push(JSON.stringify(this.features));
    const nextSnapshot = this.historyRedo.pop();
    this.features = JSON.parse(nextSnapshot);
    this.refreshMapAndTable();
    this.saveState();

    UIToast.notificar({
      tipo: 'sucesso',
      titulo: 'Refeito (Ctrl+Y)',
      mensagem: 'Alteração reaplicada.',
      duracao: 2000
    });
  }

  bindGlobalKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const path = e.composedPath ? e.composedPath() : [e.target];
      const isInput = path.some(el => 
        el && el.tagName && (
          el.tagName === 'INPUT' || 
          el.tagName === 'TEXTAREA' || 
          el.tagName === 'SELECT' || 
          el.tagName.toLowerCase().includes('campo-texto') ||
          el.tagName.toLowerCase().includes('lista-flutuante') ||
          el.isContentEditable
        )
      );
      if (isInput) return;

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        // Se houver desenho em progresso, o MapEngine cuida de desfazer o vértice
        if (this.mapEngine && this.mapEngine.drawingPoints && this.mapEngine.drawingPoints.length > 0) {
          return;
        }
        e.preventDefault();
        this.undo();
      }
      // Redo: Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z
      else if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || 
               ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey)) {
        e.preventDefault();
        this.redo();
      }
      // Save: Ctrl+S / Cmd+S
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveState();
        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Projeto Salvo (Ctrl+S)',
          mensagem: `${this.features.length} feições gravadas no banco de dados local.`,
          duracao: 2500
        });
      }
    });
  }

  handleDrawingCompleted(rawFeature) {
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

    const targetLayer = this.layers.find(l => l.visible) || this.layers[0] || { id: 'layer-default', color: '#00E08A' };
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

    // 1. Salva imediatamente no histórico, estado em memória e banco de dados local
    this.pushHistory(`Criação de "${newFeature.name}"`);
    this.features.push(newFeature);
    this.refreshMapAndTable();
    this.saveState();

    // 2. Notifica colaboração multi-aba
    this.collabHub.notifyFeatureCreated(newFeature);
    const audit = this.collabHub.logAudit(`Criou feição "${newFeature.name}"`, newFeature.type);
    this.auditLog.unshift(audit);
    if (this.layerPanel) {
      this.layerPanel.updateAuditLog(this.auditLog);
      this.layerPanel.setSelectedFeature(newFeature); // abre o inspetor automaticamente para edição rápida!
    }

    UIToast.notificar({
      tipo: 'sucesso',
      titulo: 'Feição Salva no Mapa',
      mensagem: `"${newFeature.name}" adicionada ao mapa.`,
      duracao: 2500
    });
  }

  updateFeature(updatedFeature) {
    const idx = this.features.findIndex(f => f.id === updatedFeature.id);
    if (idx >= 0) {
      // Recalcula métricas se houver coordenadas atualizadas
      if (updatedFeature.type === 'Polygon' && Array.isArray(updatedFeature.coordinates) && this.mapEngine) {
        const areaM2 = this.mapEngine.calculatePolygonArea(updatedFeature.coordinates);
        updatedFeature.properties = updatedFeature.properties || {};
        updatedFeature.properties['Área (ha)'] = (areaM2 / 10000).toFixed(2) + ' ha';
        updatedFeature.properties['Área (m²)'] = areaM2.toFixed(1) + ' m²';
      } else if (updatedFeature.type === 'LineString' && Array.isArray(updatedFeature.coordinates) && this.mapEngine) {
        const lengthM = this.mapEngine.calculatePolylineLength(updatedFeature.coordinates);
        updatedFeature.properties = updatedFeature.properties || {};
        updatedFeature.properties['Extensão'] = lengthM > 1000 ? (lengthM / 1000).toFixed(2) + ' km' : lengthM.toFixed(1) + ' m';
      }

      this.pushHistory(`Edição de "${updatedFeature.name}"`);
      this.features[idx] = updatedFeature;
      this.refreshMapAndTable();
      this.collabHub.notifyFeatureUpdated(updatedFeature);
      const audit = this.collabHub.logAudit(`Editou feição "${updatedFeature.name}"`, updatedFeature.id);
      this.auditLog.unshift(audit);
      this.layerPanel.updateAuditLog(this.auditLog);
      this.saveState();

      UIToast.notificar({
        tipo: 'sucesso',
        titulo: 'Alterações Salvas',
        mensagem: `Feição "${updatedFeature.name}" atualizada.`,
        duracao: 2000
      });
    }
  }

  deleteFeature(featureId) {
    const feat = this.features.find(f => f.id === featureId);
    const name = feat ? feat.name : featureId;
    this.pushHistory(`Exclusão de "${name}"`);
    this.features = this.features.filter(f => f.id !== featureId);
    this.refreshMapAndTable();
    this.collabHub.notifyFeatureDeleted(featureId);
    const audit = this.collabHub.logAudit(`Excluiu feição "${name}"`, featureId);
    this.auditLog.unshift(audit);
    this.layerPanel.updateAuditLog(this.auditLog);
    this.saveState();

    UIToast.notificar({
      tipo: 'alerta',
      titulo: 'Feição Excluída',
      mensagem: `"${name}" foi removida do mapa.`,
      duracao: 3000
    });
  }

  addNewLayer() {
    const name = prompt('Nome da nova camada:', 'Nova Camada ' + (this.layers.length + 1));
    if (!name) return;

    const colors = ['#00E08A', '#38bdf8', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'];
    const color = colors[this.layers.length % colors.length];

    const newLayer = {
      id: 'layer-' + Date.now(),
      name,
      color,
      visible: true,
      opacity: 1,
      locked: false
    };

    this.layers.push(newLayer);
    this.layerPanel.updateLayers(this.getLayersWithCounts());
    this.newFeatureModal.updateLayers(this.layers);
    this.saveState();

    UIToast.notificar({
      tipo: 'sucesso',
      titulo: 'Camada Criada',
      mensagem: `Camada "${name}" disponível para novos elementos.`,
      duracao: 3000
    });
  }

  loadTemplate(template) {
    this.projectName = template.title;
    this.layers = [...template.layers];
    this.features = [];
    this.mapEngine.map.setView(template.center, template.zoom);
    this.refreshMapAndTable();
    this.layerPanel.updateLayers(this.getLayersWithCounts());
    this.newFeatureModal.updateLayers(this.layers);
    this.saveState();

    UIToast.notificar({
      tipo: 'sucesso',
      titulo: 'Modelo Carregado',
      mensagem: `Template "${template.title}" pronto para uso.`,
      duracao: 3500
    });
  }

  handleExport(format) {
    let content = '';
    let mimeType = 'text/plain';
    let fileName = `${this.projectName.toLowerCase().replace(/\s+/g, '_')}.${format}`;

    if (format === 'geojson') {
      content = GeoFormats.toGeoJSON(this.features, this.projectName);
      mimeType = 'application/geo+json';
    } else if (format === 'kml') {
      content = GeoFormats.toKML(this.features, this.projectName);
      mimeType = 'application/vnd.google-earth.kml+xml';
    } else if (format === 'gpx') {
      content = GeoFormats.toGPX(this.features, this.projectName);
      mimeType = 'application/gpx+xml';
    } else if (format === 'csv') {
      content = GeoFormats.toCSV(this.features);
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
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
  }

  handleImport(content, fileName) {
    try {
      const parsed = GeoFormats.parseUploadedFile(content, fileName);
      if (parsed.features && parsed.features.length > 0) {
        this.features.push(...parsed.features);
        this.refreshMapAndTable();
        this.saveState();

        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Importação Concluída',
          mensagem: `${parsed.features.length} feições importadas com sucesso de "${fileName}".`,
          duracao: 4000
        });

        // Fecha modal
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
      UIToast.notificar({
        tipo: 'erro',
        titulo: 'Falha na Importação',
        mensagem: e.message,
        duracao: 5000
      });
    }
  }

  locateUser() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latlng = [pos.coords.latitude, pos.coords.longitude];
          this.mapEngine.map.flyTo(latlng, 16, { duration: 1.5 });
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'Localização Obtida',
            mensagem: `Posição GPS centrada no mapa.`,
            duracao: 3000
          });
        },
        (err) => {
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

  refreshMapAndTable() {
    this.mapEngine.renderFeatures(this.features, this.layers);
    if (this.attributeTable) {
      this.attributeTable.updateData(this.features, this.layers);
    }
    if (this.layerPanel) {
      this.layerPanel.updateLayers(this.getLayersWithCounts());
    }
    this.updateHUD();
  }

  getLayersWithCounts() {
    const countMap = new Map();
    for (let i = 0; i < this.features.length; i++) {
      const lid = this.features[i].layerId;
      countMap.set(lid, (countMap.get(lid) || 0) + 1);
    }

    return this.layers.map(layer => ({
      ...layer,
      featureCount: countMap.get(layer.id) || 0
    }));
  }

  updateHUD() {
    const countSpan = document.getElementById('hud-features-count');
    if (countSpan) {
      countSpan.textContent = `${this.features.length} Feições Ativas`;
    }
  }

  getToolName(tool) {
    const names = {
      select: 'Navegar e Selecionar (V)',
      point: 'Marco / Ponto (P)',
      line: 'Linha / Rota (L)',
      polygon: 'Polígono / Área (A)',
      circle: 'Buffer Circular (C)',
      measure: 'Régua de Medição (M)'
    };
    return names[tool] || tool;
  }
}

// Inicialização da aplicação
window.addEventListener('DOMContentLoaded', () => {
  window.conecteMapasApp = new ConecteMapasApp();
});

// Limpeza graciosa ao descarregar a aba/janela
window.addEventListener('beforeunload', () => {
  if (window.conecteMapasApp && window.conecteMapasApp.collabHub) {
    window.conecteMapasApp.collabHub.destroy();
  }
});
