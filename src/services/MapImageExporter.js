/* ==========================================================================
   ConecteMapas - MapImageExporter Service
   Responsabilidade Única: Renderização do mapa atual em alta resolução (PNG 1x/2K/4K),
   projeção vetorial nativa subpixel, composição cartográfica e salvaguarda CORS.
   ========================================================================== */

import { UIToast } from 'ui-components-kit';

export class MapImageExporter {
  /**
   * Exporta a visualização atual do mapa para um arquivo PNG em alta resolução
   * @param {Object} app - Instância principal do ConecteMapasApp
   * @param {Object} options - Configurações de exportação
   * @param {number} [options.scale=2] - Multiplicador de resolução (1: Tela, 2: 2K QHD, 3: 4K UHD, 4: Master)
   * @param {Object} [options.elements] - Elementos cartográficos a incluir
   * @param {boolean} [options.elements.scaleBar=true] - Incluir régua de escala gráfica
   * @param {boolean} [options.elements.northArrow=true] - Incluir rosa dos ventos / norte
   * @param {boolean} [options.elements.titleBlock=true] - Incluir carimbo técnico com dados do projeto
   * @param {boolean} [options.elements.legend=true] - Incluir legenda de camadas ativas
   * @param {string} [options.customTitle] - Título customizado
   */
  static async exportMapToPNG(app, options = {}) {
    const scale = Math.max(1, Math.min(4, options.scale || 2));
    const elements = {
      scaleBar: options.elements?.scaleBar !== false,
      northArrow: options.elements?.northArrow !== false,
      titleBlock: options.elements?.titleBlock !== false,
      legend: options.elements?.legend !== false,
      ...options.elements
    };

    const resolutionNames = {
      1: 'Padrão (1080p)',
      2: 'Alta Resolução (2K)',
      3: 'Ultra HD (4K / 300 DPI)',
      4: 'Master Cartográfico (Super HD)'
    };

    const resLabel = resolutionNames[scale] || `${scale}x`;

    UIToast.notificar({
      tipo: 'informativo',
      titulo: 'Gerando Imagem PNG',
      mensagem: `Renderizando mapa em ${resLabel} com vetores e satélite...`,
      duracao: 3500
    });

    try {
      let canvas;
      let usedTilesFallback = false;

      // 1. Tentativa primária: Renderiza com basemap
      try {
        canvas = await this.renderMapToCanvas(app, scale, elements, options.customTitle, true);
        // Teste de integridade de segurança de domínio cruzado (CORS)
        canvas.toDataURL('image/png', 0.1);
      } catch (taintErr) {
        const isSecurity = taintErr.name === 'SecurityError' || String(taintErr).includes('Tainted') || String(taintErr).includes('tainted');
        if (isSecurity) {
          console.warn('[MapImageExporter] Camada base restringe CORS. Gerando exportação vetorial com carimbo...');
          usedTilesFallback = true;
          canvas = await this.renderMapToCanvas(app, scale, elements, options.customTitle, false);
        } else {
          throw taintErr;
        }
      }

      if (!canvas) {
        throw new Error('Não foi possível gerar a área gráfica do mapa.');
      }

      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('Falha na conversão para arquivo PNG.');
        }

        const cleanProjectName = (app.projectName || 'mapa_conectemapas')
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '_');

        const fileName = `${cleanProjectName}_${scale}x_${canvas.width}x${canvas.height}.png`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 2000);

        if (usedTilesFallback) {
          UIToast.notificar({
            tipo: 'alerta',
            titulo: 'Exportação com Salvaguarda CORS',
            mensagem: 'Os servidores do Google Maps bloqueiam leitura de imagem por CORS. O mapa foi gerado com todos os vetores, medições e carimbo. Para satélite na imagem, selecione Esri Satélite.',
            duracao: 8000
          });
        } else {
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'Exportação Concluída',
            mensagem: `Imagem ${fileName} (${canvas.width}×${canvas.height} px) gerada com sucesso!`,
            duracao: 4500
          });
        }
      }, 'image/png');
    } catch (err) {
      console.error('Erro na exportação de imagem:', err);
      UIToast.notificar({
        tipo: 'erro',
        titulo: 'Falha na Exportação',
        mensagem: err.message || 'Ocorreu um erro ao processar o mapa para imagem.',
        duracao: 4500
      });
    }
  }

  /**
   * Renderiza o mapa completo em um Canvas de alta densidade de pixels
   */
  static async renderMapToCanvas(app, scale = 2, elements = {}, customTitle = '', includeBaseTiles = true) {
    const mapEngine = app.mapEngine;
    if (!mapEngine || !mapEngine.map) {
      throw new Error('Motor cartográfico não inicializado.');
    }

    const map = mapEngine.map;
    const mapContainer = map.getContainer();
    const baseW = mapContainer.clientWidth || 1280;
    const baseH = mapContainer.clientHeight || 720;

    // Salvaguarda de limite máximo para evitar estouro de memória GPU
    const maxDimension = 8192;
    const finalW = Math.min(maxDimension, Math.round(baseW * scale));
    const finalH = Math.min(maxDimension, Math.round(baseH * scale));
    const actualScale = finalW / baseW;

    const canvas = document.createElement('canvas');
    canvas.width = finalW;
    canvas.height = finalH;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

    // Fundo escuro neutro
    ctx.fillStyle = '#141419';
    ctx.fillRect(0, 0, finalW, finalH);

    // 1. Renderiza Tiles de Imagem da Camada Base se habilitado e seguro
    if (includeBaseTiles) {
      await this.drawBaseTiles(ctx, mapContainer, actualScale);
    }

    // 2. Renderiza Feições Vetoriais em Alta Resolução Nativa Subpixel
    this.drawVectorFeatures(ctx, map, app.features, app.layers, actualScale);

    // 3. Renderiza Elementos Cartográficos Opcionais
    if (elements.titleBlock) {
      this.drawTitleBlock(ctx, finalW, finalH, actualScale, app, customTitle);
    }

    if (elements.northArrow) {
      this.drawNorthArrow(ctx, finalW, finalH, actualScale);
    }

    if (elements.scaleBar) {
      this.drawScaleBar(ctx, map, finalW, finalH, actualScale);
    }

    if (elements.legend) {
      this.drawLegend(ctx, finalW, finalH, actualScale, app.layers, app.features);
    }

    // 4. Moldura Cartográfica de Precisão
    this.drawBorderAndGrid(ctx, finalW, finalH, actualScale);

    return canvas;
  }

  /**
   * Captura e desenha os tiles de base do Leaflet
   */
  static async drawBaseTiles(ctx, mapContainer, scale) {
    const mapRect = mapContainer.getBoundingClientRect();
    const tileImages = Array.from(mapContainer.querySelectorAll('.leaflet-tile-pane img'));

    if (tileImages.length === 0) return;

    // Aguarda imagens completarem se houver tiles carregando
    const promises = tileImages.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve(img);
      return new Promise((resolve) => {
        const onDone = () => resolve(img);
        img.addEventListener('load', onDone, { once: true });
        img.addEventListener('error', onDone, { once: true });
        setTimeout(onDone, 800); // timeout de segurança
      });
    });

    await Promise.allSettled(promises);

    tileImages.forEach((img) => {
      if (!img.complete || img.naturalWidth === 0) return;

      const imgRect = img.getBoundingClientRect();
      const destX = (imgRect.left - mapRect.left) * scale;
      const destY = (imgRect.top - mapRect.top) * scale;
      const destW = imgRect.width * scale;
      const destH = imgRect.height * scale;

      try {
        ctx.drawImage(img, destX, destY, destW, destH);
      } catch (e) {
        // Fallback gracioso para segurança de mesmo domínio (CORS)
      }
    });
  }

  /**
   * Projeta e desenha todas as feições vetoriais ativas com precisão geométrica
   */
  static drawVectorFeatures(ctx, map, features = [], layers = [], scale = 1) {
    // Agrupa feições por camada respeitando a ordem Z-Index inversa
    const reversedLayers = [...layers].reverse();

    reversedLayers.forEach((layer) => {
      if (layer.visible === false) return;

      const layerFeatures = features.filter((f) => f.layerId === layer.id && f.visible !== false);
      const layerOpacity = layer.opacity !== undefined ? Number(layer.opacity) : 1;

      layerFeatures.forEach((feat) => {
        this.drawSingleFeature(ctx, map, feat, layer, layerOpacity, scale);
      });
    });
  }

  /**
   * Renderiza uma feição individual no Canvas
   */
  static drawSingleFeature(ctx, map, feat, layer, layerOpacity, scale) {
    const color = feat.color || layer.color || '#00E08A';
    const rawFillOpacity = feat.style?.fillOpacity !== undefined ? Number(feat.style.fillOpacity) : 0.35;
    const fillOpacity = Math.max(0, Math.min(1, rawFillOpacity * layerOpacity));
    const strokeColor = feat.style?.strokeColor || color;
    const strokeWidth = (feat.style?.strokeWidth !== undefined ? Number(feat.style.strokeWidth) : 2.5) * scale;

    const coords = this.normalizeFeatureCoordinates(feat);
    if (!coords || coords.length === 0) return;

    ctx.save();

    if (feat.type === 'polygon') {
      const pts = coords.map((latlng) => {
        const p = map.latLngToContainerPoint(latlng);
        return { x: p.x * scale, y: p.y * scale };
      });

      if (pts.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();

        // Preenchimento
        ctx.fillStyle = this.hexToRgba(feat.style?.fillColor || color, fillOpacity);
        ctx.fill();

        // Contorno
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (feat.style?.strokeDashArray) {
          ctx.setLineDash(feat.style.strokeDashArray.split(',').map((n) => Number(n) * scale));
        }
        ctx.stroke();

        // Rótulo no centroide do polígono
        if (feat.name) {
          const center = this.calculatePolygonCentroid(pts);
          this.drawFeatureLabel(ctx, feat.name, center.x, center.y, strokeColor, scale);
        }
      }
    } else if (feat.type === 'line') {
      const pts = coords.map((latlng) => {
        const p = map.latLngToContainerPoint(latlng);
        return { x: p.x * scale, y: p.y * scale };
      });

      if (pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (feat.style?.strokeDashArray) {
          ctx.setLineDash(feat.style.strokeDashArray.split(',').map((n) => Number(n) * scale));
        }
        ctx.stroke();

        // Rótulo no meio da linha
        if (feat.name && pts.length >= 2) {
          const midIdx = Math.floor(pts.length / 2);
          const midPt = pts[midIdx];
          this.drawFeatureLabel(ctx, feat.name, midPt.x, midPt.y - 8 * scale, strokeColor, scale);
        }
      }
    } else if (feat.type === 'point') {
      const latlng = coords[0] || coords;
      if (latlng && !isNaN(latlng[0]) && !isNaN(latlng[1])) {
        const p = map.latLngToContainerPoint(latlng);
        const x = p.x * scale;
        const y = p.y * scale;
        const radius = (feat.style?.markerSize ? Number(feat.style.markerSize) / 2 : 7) * scale;

        // Halo translúcido externo
        ctx.beginPath();
        ctx.arc(x, y, radius + 4 * scale, 0, Math.PI * 2);
        ctx.fillStyle = this.hexToRgba(color, 0.25);
        ctx.fill();

        // Borda preta de contraste
        ctx.beginPath();
        ctx.arc(x, y, radius + 1.5 * scale, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();

        // Círculo principal
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Ponto central
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.5, radius * 0.35), 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Rótulo acima do ponto
        if (feat.name) {
          this.drawFeatureLabel(ctx, feat.name, x, y - radius - 6 * scale, color, scale);
        }
      }
    } else if (feat.type === 'circle') {
      const centerLatLng = coords[0] || coords;
      if (centerLatLng && feat.radius) {
        const p = map.latLngToContainerPoint(centerLatLng);
        const x = p.x * scale;
        const y = p.y * scale;

        // Calcula raio aproximado em pixels
        const northLat = centerLatLng[0] + (feat.radius / 111320);
        const pNorth = map.latLngToContainerPoint([northLat, centerLatLng[1]]);
        const radiusPx = Math.abs(p.y - pNorth.y) * scale;

        ctx.beginPath();
        ctx.arc(x, y, radiusPx, 0, Math.PI * 2);
        ctx.fillStyle = this.hexToRgba(color, fillOpacity);
        ctx.fill();

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();

        if (feat.name) {
          this.drawFeatureLabel(ctx, feat.name, x, y, color, scale);
        }
      }
    }

    ctx.restore();
  }

  /**
   * Renderiza texto de rótulo com halo de contraste nítido
   */
  static drawFeatureLabel(ctx, text, x, y, color, scale) {
    if (!text) return;
    const fontSize = Math.max(10, Math.round(11 * scale));
    ctx.save();
    ctx.font = `600 ${fontSize}px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Halo escuro para máxima legibilidade sobre satélite e mapas claros
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.lineWidth = 3 * scale;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);

    // Texto com cor nítida
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /**
   * Carimbo Técnico Cartográfico (Title Block)
   */
  static drawTitleBlock(ctx, w, h, scale, app, customTitle) {
    const boxW = Math.min(w * 0.45, 340 * scale);
    const boxH = 92 * scale;
    const margin = 14 * scale;
    const x = margin;
    const y = margin;

    ctx.save();
    // Fundo translúcido moderno com borda sutil
    ctx.fillStyle = 'rgba(18, 18, 23, 0.88)';
    this.roundRect(ctx, x, y, boxW, boxH, 8 * scale);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.2 * scale;
    this.roundRect(ctx, x, y, boxW, boxH, 8 * scale);
    ctx.stroke();

    // Barra de acento verde
    ctx.fillStyle = '#00E08A';
    this.roundRect(ctx, x + 10 * scale, y + 10 * scale, 3 * scale, boxH - 20 * scale, 1.5 * scale);
    ctx.fill();

    const titleText = customTitle || app.projectName || 'Levantamento Cartográfico';
    const textX = x + 20 * scale;

    // Título Principal
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(13 * scale)}px "Inter", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const truncatedTitle = this.truncateText(ctx, titleText, boxW - 30 * scale);
    ctx.fillText(truncatedTitle, textX, y + 12 * scale);

    // Metadados Cartográficos
    const center = app.mapEngine.map.getCenter();
    const zoom = app.mapEngine.map.getZoom();
    const dateStr = new Date().toLocaleDateString('pt-BR');
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    ctx.fillStyle = '#a1a1aa';
    ctx.font = `${Math.round(9.5 * scale)}px "Inter", monospace`;

    ctx.fillText(`Datum: SIRGAS 2000 / WGS 84 (EPSG:4674) • Zoom: ${zoom}`, textX, y + 32 * scale);
    ctx.fillText(`Centro: Lat ${center.lat.toFixed(5)}° | Lng ${center.lng.toFixed(5)}°`, textX, y + 48 * scale);
    ctx.fillText(`Data: ${dateStr} ${timeStr} • ConecteMapas GIS Platform`, textX, y + 64 * scale);

    ctx.restore();
  }

  /**
   * Rosa dos Ventos / Indicador de Norte Magnético
   */
  static drawNorthArrow(ctx, w, h, scale) {
    const size = 44 * scale;
    const margin = 18 * scale;
    const cx = w - margin - size / 2;
    const cy = margin + size / 2;

    ctx.save();
    // Fundo circular translúcido
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 + 4 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(18, 18, 23, 0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1 * scale;
    ctx.stroke();

    const r = size * 0.42;

    // Asa Norte Direita (Escura)
    ctx.fillStyle = '#00E08A';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.28, cy + r * 0.2);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();

    // Asa Norte Esquerda (Branca)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx - r * 0.28, cy + r * 0.2);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();

    // Letra N
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(9 * scale)}px "Inter", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('N', cx, cy - r - 2 * scale);

    ctx.restore();
  }

  /**
   * Régua de Escala Gráfica Métrica Dinâmica
   */
  static drawScaleBar(ctx, map, w, h, scale) {
    const center = map.getCenter();
    const lat = center.lat;
    const zoom = map.getZoom();

    // Metros por pixel na latitude central (fórmula geodésica Mercator)
    const metersPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);

    // Determina um valor redondo adequado para a barra
    const targetPx = 120;
    const rawMeters = metersPerPixel * targetPx;
    const roundedMeters = this.getNiceNumber(rawMeters);
    const barWidthPx = (roundedMeters / metersPerPixel) * scale;

    const margin = 14 * scale;
    const x = margin;
    const y = h - margin - 28 * scale;
    const barH = 7 * scale;

    ctx.save();
    // Fundo do card da escala
    ctx.fillStyle = 'rgba(18, 18, 23, 0.85)';
    this.roundRect(ctx, x, y - 14 * scale, barWidthPx + 16 * scale, barH + 24 * scale, 6 * scale);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1 * scale;
    this.roundRect(ctx, x, y - 14 * scale, barWidthPx + 16 * scale, barH + 24 * scale, 6 * scale);
    ctx.stroke();

    const startX = x + 8 * scale;
    const numSegments = 4;
    const segW = barWidthPx / numSegments;

    // Segmentos alternados preto e branco
    for (let i = 0; i < numSegments; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#141419';
      ctx.fillRect(startX + i * segW, y, segW, barH);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8 * scale;
      ctx.strokeRect(startX + i * segW, y, segW, barH);
    }

    // Texto da unidade de medida
    const textLabel = roundedMeters >= 1000 ? `${(roundedMeters / 1000).toLocaleString('pt-BR')} km` : `${roundedMeters.toLocaleString('pt-BR')} m`;

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(8.5 * scale)}px "Inter", monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('0', startX, y - 2 * scale);

    ctx.textAlign = 'right';
    ctx.fillText(textLabel, startX + barWidthPx, y - 2 * scale);

    ctx.restore();
  }

  /**
   * Legenda Compacta das Camadas Visíveis
   */
  static drawLegend(ctx, w, h, scale, layers = [], features = []) {
    const visibleLayers = layers.filter((l) => l.visible !== false);
    if (visibleLayers.length === 0) return;

    const countMap = new Map();
    features.forEach((f) => {
      if (f.visible !== false) {
        countMap.set(f.layerId, (countMap.get(f.layerId) || 0) + 1);
      }
    });

    const boxW = Math.min(w * 0.4, 210 * scale);
    const rowH = 16 * scale;
    const headerH = 22 * scale;
    const boxH = headerH + visibleLayers.length * rowH + 8 * scale;

    const margin = 14 * scale;
    const x = w - margin - boxW;
    const y = h - margin - boxH;

    ctx.save();
    ctx.fillStyle = 'rgba(18, 18, 23, 0.88)';
    this.roundRect(ctx, x, y, boxW, boxH, 8 * scale);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1 * scale;
    this.roundRect(ctx, x, y, boxW, boxH, 8 * scale);
    ctx.stroke();

    // Cabeçalho da Legenda
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(10 * scale)}px "Inter", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('LEGENDA DAS CAMADAS', x + 10 * scale, y + 6 * scale);

    let currY = y + headerH;
    visibleLayers.forEach((l) => {
      const count = countMap.get(l.id) || 0;
      const chipColor = l.color || '#00E08A';

      // Marcador de cor
      ctx.fillStyle = chipColor;
      this.roundRect(ctx, x + 10 * scale, currY + 2 * scale, 10 * scale, 10 * scale, 2 * scale);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 0.7 * scale;
      this.roundRect(ctx, x + 10 * scale, currY + 2 * scale, 10 * scale, 10 * scale, 2 * scale);
      ctx.stroke();

      // Nome da Camada
      ctx.fillStyle = '#e4e4e7';
      ctx.font = `${Math.round(9 * scale)}px "Inter", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const maxTextW = boxW - 55 * scale;
      const truncatedName = this.truncateText(ctx, l.name, maxTextW);
      ctx.fillText(truncatedName, x + 26 * scale, currY + 7 * scale);

      // Contagem
      ctx.fillStyle = '#71717a';
      ctx.font = `${Math.round(8 * scale)}px monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(`(${count})`, x + boxW - 8 * scale, currY + 7 * scale);

      currY += rowH;
    });

    ctx.restore();
  }

  /**
   * Borda e marcas cartográficas perimetrais
   */
  static drawBorderAndGrid(ctx, w, h, scale) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5 * scale;
    ctx.strokeRect(0, 0, w, h);
    ctx.restore();
  }

  /**
   * Auxiliar: Normaliza coordenadas de uma feição
   */
  static normalizeFeatureCoordinates(feat) {
    if (!feat || !feat.coordinates) return [];
    const c = feat.coordinates;

    if (feat.type === 'polygon' || feat.type === 'line') {
      if (Array.isArray(c)) {
        return c.map((pt) => {
          if (Array.isArray(pt)) return [Number(pt[0]), Number(pt[1])];
          if (pt && typeof pt === 'object') return [Number(pt.lat), Number(pt.lng)];
          return [0, 0];
        });
      }
    } else if (feat.type === 'point' || feat.type === 'circle') {
      if (Array.isArray(c)) {
        if (typeof c[0] === 'number') return [Number(c[0]), Number(c[1])];
        if (Array.isArray(c[0])) return [Number(c[0][0]), Number(c[0][1])];
      }
      if (c && typeof c === 'object') return [Number(c.lat), Number(c.lng)];
    }
    return [];
  }

  /**
   * Auxiliar: Calcula centroide de polígono projetado
   */
  static calculatePolygonCentroid(pts) {
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < pts.length; i++) {
      cx += pts[i].x;
      cy += pts[i].y;
    }
    return { x: cx / pts.length, y: cy / pts.length };
  }

  /**
   * Converte Hex (#RRGGBB) para rgba string
   */
  static hexToRgba(hex, opacity = 1) {
    if (!hex || typeof hex !== 'string') return `rgba(0, 224, 138, ${opacity})`;
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((ch) => ch + ch).join('');
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(0, 224, 138, ${opacity})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  /**
   * Desenha retângulo com cantos arredondados
   */
  static roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Trunca texto com ellipsis se exceder largura máxima
   */
  static truncateText(ctx, text, maxWidth) {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxWidth) return text;
    let tr = text;
    while (tr.length > 0 && ctx.measureText(tr + '…').width > maxWidth) {
      tr = tr.slice(0, -1);
    }
    return tr + '…';
  }

  /**
   * Arredonda valor de distância para escalas limpas (ex: 50, 100, 250, 500, 1000)
   */
  static getNiceNumber(val) {
    const exp = Math.floor(Math.log10(val));
    const frac = val / Math.pow(10, exp);
    let nice;
    if (frac < 1.5) nice = 1;
    else if (frac < 3) nice = 2;
    else if (frac < 7) nice = 5;
    else nice = 10;
    return nice * Math.pow(10, exp);
  }
}
