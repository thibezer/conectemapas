/* ==========================================================================
   ConecteMapas - PrintAtlasEngine
   Responsabilidade Única: Motor de Automação de Pranchas em Lote (Gerador de Atlas),
   enquadramento paramétrico por feição, interpolação de expressões dinâmicas e
   exportação sequencial de cadernos de mapas em PDF multipáginas.
   ========================================================================== */

import { FeatureGeometryUtils } from '../../services/MapEngine/FeatureGeometryUtils.js';
import { PrintExporter } from './PrintExporter.js';
import { jsPDF } from 'jspdf';
import { UIToast } from '@thibezer/ui-components-kit';
import { notifyProgress } from '../../utils/toastHelpers.js';

export class PrintAtlasEngine {
  constructor(composer) {
    this.composer = composer;
    this.enabled = false;
    this.layerId = '';
    this.currentIndex = 0;
    this.marginPct = 15; // 15% de respiro ao redor do polígono
    this.mapItemId = 'item-map-main';
  }

  /**
   * Retorna a lista de feições da camada de cobertura configurada
   */
  getCoverageFeatures() {
    if (!this.layerId) return [];
    return (this.composer.features || []).filter(f => f.layerId === this.layerId);
  }

  /**
   * Retorna a feição ativa do Atlas
   */
  getCurrentFeature() {
    if (!this.enabled) return null;
    const features = this.getCoverageFeatures();
    if (!features.length) return null;
    const idx = Math.max(0, Math.min(features.length - 1, this.currentIndex));
    return features[idx] || null;
  }

  /**
   * Ativa ou desativa o gerador de Atlas
   */
  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (this.enabled) {
      if (!this.layerId) {
        // Seleciona por padrão a primeira camada que contém polígonos
        const polyLayer = (this.composer.layers || []).find(l => {
          return (this.composer.features || []).some(f => f.layerId === l.id && (f.type === 'Polygon' || f.type === 'MultiPolygon'));
        });
        if (polyLayer) this.layerId = polyLayer.id;
      }
      this.currentIndex = 0;
      this.applyCurrentFeature();
    } else {
      this.refreshComposerVisuals();
    }
    this.updateAtlasUI();
  }

  setLayerId(layerId) {
    this.layerId = layerId;
    this.currentIndex = 0;
    if (this.enabled) {
      this.applyCurrentFeature();
    }
    this.updateAtlasUI();
  }

  setMarginPct(pct) {
    this.marginPct = Math.max(0, Math.min(100, Number(pct) || 15));
    if (this.enabled) {
      this.applyCurrentFeature();
    }
  }

  next() {
    const features = this.getCoverageFeatures();
    if (!features.length) return;
    if (this.currentIndex < features.length - 1) {
      this.currentIndex++;
      this.applyCurrentFeature();
      this.updateAtlasUI();
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.applyCurrentFeature();
      this.updateAtlasUI();
    }
  }

  goTo(index) {
    const features = this.getCoverageFeatures();
    if (!features.length) return;
    this.currentIndex = Math.max(0, Math.min(features.length - 1, Number(index) || 0));
    this.applyCurrentFeature();
    this.updateAtlasUI();
  }

  /**
   * Calcula o Bounding Box [ [minLat, minLng], [maxLat, maxLng] ] de qualquer geometria
   */
  static computeFeatureBounds(feature) {
    if (!feature || !feature.coordinates) return null;

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    const scan = (coords) => {
      if (!Array.isArray(coords)) return;
      if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        const lat = coords[0];
        const lng = coords[1];
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
        }
        return;
      }
      coords.forEach(scan);
    };

    scan(feature.coordinates);

    if (!Number.isFinite(minLat) || !Number.isFinite(maxLat)) return null;
    return { minLat, maxLat, minLng, maxLng };
  }

  /**
   * Enquadra o mapa da prancha na feição ativa com a margem percentual configurada
   */
  applyCurrentFeature() {
    const feat = this.getCurrentFeature();
    if (!feat) return;

    const mapItem = this.composer.items.find(i => i.id === this.mapItemId && i.type === 'map')
      || this.composer.items.find(i => i.type === 'map');
    if (!mapItem) return;

    const leafletMap = this.composer.leafletMaps?.get(mapItem.id);
    if (!leafletMap) return;

    const bounds = PrintAtlasEngine.computeFeatureBounds(feat);
    if (!bounds) return;

    const latSpan = bounds.maxLat - bounds.minLat;
    const lngSpan = bounds.maxLng - bounds.minLng;
    const pad = (this.marginPct / 100);

    // Bounding box expandido pela margem
    const padLat = Math.max(0.0001, latSpan * pad);
    const padLng = Math.max(0.0001, lngSpan * pad);

    const southWest = [bounds.minLat - padLat, bounds.minLng - padLng];
    const northEast = [bounds.maxLat + padLat, bounds.maxLng + padLng];

    leafletMap.fitBounds([southWest, northEast], { animate: false });

    // Salva a nova vista do mapa no item
    const center = leafletMap.getCenter();
    mapItem.view = {
      center: [center.lat, center.lng],
      zoom: leafletMap.getZoom()
    };
    mapItem.scale = Math.round(this.composer.canvasEngine.calculateMapScale(leafletMap, mapItem));

    this.refreshComposerVisuals();
  }

  /**
   * Atualiza textos, carimbo e tabela de vértices com os dados da feição ativa
   */
  refreshComposerVisuals() {
    this.composer.layoutItemsDOM?.();
    this.composer.refreshLegends?.();
    this.composer.updatePropertiesPanel?.();

    // Redesenha os elementos na prancheta que dependem de expressões
    this.composer.items.forEach(it => {
      if (it.type === 'label' || it.type === 'text_block' || it.type === 'title_block' || it.type === 'table_vertices') {
        this.composer.refreshItemContent?.(it);
      }
    });

    // Se houver tabela de vértices, atualiza para mirar na feição ativa do Atlas
    const feat = this.getCurrentFeature();
    if (feat) {
      const vertItem = this.composer.items.find(i => i.type === 'table_vertices');
      if (vertItem && !vertItem.targetFeatureId) {
        this.composer.refreshItemContent?.(vertItem);
      }
    }
  }

  /**
   * Avalia expressões dinâmicas substituindo variáveis em tempo real
   * Suporta: [% nome %], [@feature.name], {nome}, etc.
   */
  evaluateExpressions(text) {
    if (typeof text !== 'string' || !text) return text;

    const feat = this.getCurrentFeature();
    const props = feat?.properties || {};
    const featName = feat?.name || props.nome || props.name || feat?.id || '';

    let areaHa = '';
    let areaM2 = '';
    let perimeter = props['Perímetro'] || '';

    if (feat && feat.coordinates) {
      const m2 = FeatureGeometryUtils.calculatePolygonArea?.(feat.coordinates) || 0;
      if (m2 > 0) {
        areaM2 = `${Math.round(m2).toLocaleString('pt-BR')} m²`;
        areaHa = `${(m2 / 10000).toFixed(4)} ha`;
      }
    }

    const curSheet = this.composer.sheetsManager?.getCurrentSheet?.();
    const mainMap = this.composer.items.find(i => i.type === 'map');
    const scaleFormatted = mainMap?.scale ? `1:${Math.round(mainMap.scale).toLocaleString('pt-BR')}` : 'Indicada';

    const vars = {
      'feature.name': featName,
      'feicao.nome': featName,
      'nome': featName,
      'feature.id': feat?.id || '',
      'id': feat?.id || '',
      'feature.area_ha': areaHa,
      'area_ha': areaHa,
      'feature.area_m2': areaM2,
      'area_m2': areaM2,
      'feature.perimeter': perimeter,
      'perimetro': perimeter,
      'project.name': this.composer.projectName || 'Projeto',
      'projeto': this.composer.projectName || 'Projeto',
      'sheet.name': curSheet?.name || 'Prancha',
      'prancha': curSheet?.name || 'Prancha',
      'scale': scaleFormatted,
      'escala': scaleFormatted,
      'date': new Date().toLocaleDateString('pt-BR'),
      'data': new Date().toLocaleDateString('pt-BR'),
      'atlas.index': String((this.currentIndex || 0) + 1),
      'atlas.total': String(this.getCoverageFeatures().length || 1)
    };

    // Mescla propriedades customizadas da feição
    Object.keys(props).forEach(k => {
      vars[`prop.${k}`] = props[k];
      if (vars[k] === undefined) vars[k] = props[k];
    });

    return text.replace(/\[%\s*([^%]+?)\s*%\]|\{\s*([^}]+?)\s*\}|\[@\s*([^\]]+?)\s*\]/g, (match, p1, p2, p3) => {
      const key = (p1 || p2 || p3 || '').trim();
      return vars[key] !== undefined ? vars[key] : (props[key] !== undefined ? props[key] : match);
    });
  }

  /**
   * Exporta todo o Atlas em um único PDF Multipáginas (1 página por feição)
   */
  async exportAtlasPDF(dpi = 300) {
    const features = this.getCoverageFeatures();
    if (!features.length) {
      UIToast.notificar({
        tipo: 'alerta',
        titulo: 'Atlas Vazio',
        mensagem: 'Nenhuma feição encontrada na camada de cobertura para exportar.',
        duracao: 3500
      });
      return;
    }

    const progress = notifyProgress({
      titulo: 'Exportando Atlas em Lote',
      mensagem: `Gerando ${features.length} pranchas em PDF (${dpi} DPI)...`
    });

    const originalIndex = this.currentIndex;
    this.composer.exporting = true;

    try {
      const wMm = this.composer.paperSize.width;
      const hMm = this.composer.paperSize.height;
      const isLandscape = wMm > hMm;

      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [wMm, hMm],
        compress: true
      });

      for (let i = 0; i < features.length; i++) {
        this.currentIndex = i;
        this.applyCurrentFeature();

        // Aguarda renderização dos tiles do mapa
        await this.composer.waitForMapsReady?.(3000);

        const rendered = await PrintExporter.renderSheetWithFallback(this.composer, dpi);
        const { canvas } = rendered;
        if (canvas) {
          const imgData = canvas.toDataURL('image/jpeg', 0.92);
          if (i > 0) {
            pdf.addPage([wMm, hMm], isLandscape ? 'landscape' : 'portrait');
          }
          pdf.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);
        }
      }

      const cleanProject = (this.composer.projectName || 'projeto').toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
      const fileName = `atlas_${cleanProject}_${features.length}_pranchas.pdf`;
      pdf.save(fileName);

      UIToast.notificar({
        tipo: 'sucesso',
        titulo: 'Atlas Concluído com Sucesso',
        mensagem: `${features.length} pranchas exportadas no arquivo ${fileName}.`,
        duracao: 5000
      });
    } catch (err) {
      console.error('[PrintAtlasEngine] Erro na exportação do Atlas:', err);
      UIToast.notificar({
        tipo: 'erro',
        titulo: 'Falha no Atlas',
        mensagem: err.message || 'Erro ao processar as pranchas do Atlas.',
        duracao: 4500
      });
    } finally {
      this.composer.exporting = false;
      this.currentIndex = originalIndex;
      this.applyCurrentFeature();
      progress.done();
    }
  }

  updateAtlasUI() {
    if (typeof document === 'undefined') return;
    const bar = document.getElementById('cm-print-atlas-bar');
    if (bar) {
      bar.classList.toggle('hidden', !this.enabled);
      const features = this.getCoverageFeatures();
      const feat = this.getCurrentFeature();
      const currentLbl = bar.querySelector('[data-atlas-cur]');
      const totalLbl = bar.querySelector('[data-atlas-total]');
      const nameLbl = bar.querySelector('[data-atlas-name]');
      if (currentLbl) currentLbl.textContent = features.length ? String(this.currentIndex + 1) : '0';
      if (totalLbl) totalLbl.textContent = String(features.length);
      if (nameLbl) nameLbl.textContent = feat ? (feat.name || feat.id) : '(Nenhuma feição)';

      const prevBtn = bar.querySelector('[data-atlas-nav="prev"]');
      const nextBtn = bar.querySelector('[data-atlas-nav="next"]');
      if (prevBtn) prevBtn.disabled = this.currentIndex <= 0;
      if (nextBtn) nextBtn.disabled = this.currentIndex >= features.length - 1;
    }

    const toolboxBtn = document.querySelector('[data-stb-action="toggle-atlas"]');
    if (toolboxBtn) {
      toolboxBtn.classList.toggle('is-active', this.enabled);
      toolboxBtn.setAttribute('aria-pressed', String(this.enabled));
    }
  }
}
