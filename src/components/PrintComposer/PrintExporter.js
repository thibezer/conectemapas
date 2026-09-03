/* ==========================================================================
   ConecteMapas - PrintExporter
   Responsabilidade Única: Renderização de pranchas cartográficas em alta resolução
   (300 DPI / 150 DPI), motor vetorial nativo subpixel, salvaguardas de memória GPU,
   tolerância a CORS e geração milimétrica de PDF técnico via jsPDF.
   ========================================================================== */

import { jsPDF } from 'jspdf';
import { UIToast } from 'ui-components-kit';
import { PrintItemsManager } from './PrintItemsManager.js';

export class PrintExporter {
  /**
   * Exporta a prancha cartográfica para arquivo PNG de alta resolução
   */
  static async exportToPNG(composer, dpi = 300) {
    try {
      UIToast.notificar({
        tipo: 'informativo',
        titulo: 'Gerando Imagem PNG',
        mensagem: `Renderizando prancha em ${dpi} DPI com precisão vetorial...`,
        duracao: 3500
      });

      const { canvas, usedFallback } = await this.renderSheetWithFallback(composer, dpi);
      if (!canvas) return;

      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('Falha ao gerar arquivo de imagem.');
        }

        const cleanName = (composer.projectName || 'prancha')
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '_');
        const fileName = `${cleanName}_prancha_${dpi}dpi.png`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => URL.revokeObjectURL(url), 3000);

        if (usedFallback) {
          UIToast.notificar({
            tipo: 'alerta',
            titulo: 'Exportação Concluída com Salvaguarda',
            mensagem: 'Os tiles de satélite restringiram leitura por CORS. A prancha foi exportada em fundo técnico com todos os vetores, grade, tabelas e selo nítidos.',
            duracao: 6500
          });
        } else {
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'Imagem Gerada',
            mensagem: `${fileName} (${canvas.width}×${canvas.height} px) baixada com sucesso!`,
            duracao: 4000
          });
        }
      }, 'image/png');
    } catch (err) {
      console.error('[PrintExporter] Erro na exportação de imagem:', err);
      UIToast.notificar({
        tipo: 'erro',
        titulo: 'Falha na Exportação',
        mensagem: err.message || 'Erro ao processar imagem da prancha.',
        duracao: 4500
      });
    }
  }

  /**
   * Exporta a prancha cartográfica para arquivo PDF técnico em escala 1:1
   */
  static async exportToPDF(composer, dpi = 300) {
    try {
      UIToast.notificar({
        tipo: 'informativo',
        titulo: 'Gerando PDF Técnico',
        mensagem: `Processando prancha ${composer.paperSize.name} em escala 1:1 via jsPDF...`,
        duracao: 3500
      });

      const { canvas, usedFallback } = await this.renderSheetWithFallback(composer, dpi);
      if (!canvas) return;

      const wMm = composer.paperSize.width;
      const hMm = composer.paperSize.height;
      const isLandscape = wMm > hMm;

      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [wMm, hMm],
        compress: true
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);

      const cleanName = (composer.projectName || 'prancha')
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_');
      const fileName = `${cleanName}_${composer.paperSize.id}.pdf`;
      pdf.save(fileName);

      if (usedFallback) {
        UIToast.notificar({
          tipo: 'alerta',
          titulo: 'PDF Gerado com Salvaguarda',
          mensagem: 'O PDF técnico foi gerado com todos os elementos vetoriais e memorial descritivo.',
          duracao: 5000
        });
      } else {
        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'PDF Técnico Salvo',
          mensagem: `Arquivo ${fileName} gravado com dimensões milimétricas exatas.`,
          duracao: 4000
        });
      }
    } catch (err) {
      console.error('[PrintExporter] Erro no PDF:', err);
      UIToast.notificar({
        tipo: 'erro',
        titulo: 'Falha no PDF',
        mensagem: err.message || 'Erro ao gerar arquivo PDF.',
        duracao: 4500
      });
    }
  }

  /**
   * Renderiza a folha com salvaguarda automática contra bloqueio de CORS
   */
  static async renderSheetWithFallback(composer, requestedDpi = 300) {
    let canvas;
    let usedFallback = false;

    // Tentativa primária: Renderiza com tiles de satélite/base
    try {
      canvas = await this.renderSheetToCanvas(composer, requestedDpi, true);
      // Teste de integridade de CORS (se o canvas estiver manchado, lança erro aqui)
      canvas.toDataURL('image/png', 0.1);
    } catch (taintErr) {
      const isSecurity = taintErr.name === 'SecurityError' || String(taintErr).includes('Tainted') || String(taintErr).includes('tainted');
      if (isSecurity) {
        console.warn('[PrintExporter] Tiles de mapa restringiram CORS. Re-renderizando com fundo técnico seguro...');
        usedFallback = true;
        canvas = await this.renderSheetToCanvas(composer, requestedDpi, false);
      } else {
        throw taintErr;
      }
    }

    return { canvas, usedFallback };
  }

  /**
   * Renderiza a composição inteira em um Canvas de alta resolução
   */
  static async renderSheetToCanvas(composer, dpi = 300, includeTiles = true) {
    // Salvaguarda contra estouro de memória da GPU: limita dimensão a 8192px
    const rawScaleFactor = dpi / 25.4;
    const maxDimension = 8192;
    let wPx = Math.round(composer.paperSize.width * rawScaleFactor);
    let hPx = Math.round(composer.paperSize.height * rawScaleFactor);

    let scaleFactor = rawScaleFactor;
    if (wPx > maxDimension || hPx > maxDimension) {
      const downscale = Math.min(maxDimension / wPx, maxDimension / hPx);
      scaleFactor = rawScaleFactor * downscale;
      wPx = Math.round(composer.paperSize.width * scaleFactor);
      hPx = Math.round(composer.paperSize.height * scaleFactor);
    }

    const canvas = document.createElement('canvas');
    canvas.width = wPx;
    canvas.height = hPx;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

    // Fundo Branco do Papel
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, wPx, hPx);

    // 1. Renderiza Moldura com Margens ABNT se habilitado
    if (composer.showAbntMargins) {
      this.drawAbntMarginsFrame(ctx, composer, scaleFactor);
    }

    // 2. Renderiza Itens da Prancha Cartográfica
    for (const item of composer.items) {
      if (item.visible === false) continue;

      const x = Math.round(item.x * scaleFactor);
      const y = Math.round(item.y * scaleFactor);
      const w = Math.round(item.width * scaleFactor);
      const h = Math.round(item.height * scaleFactor);

      if (item.type === 'map' || item.type === 'inset_map') {
        await this.drawMapItem(ctx, item, x, y, w, h, composer, scaleFactor, includeTiles);
      } else if (item.type === 'north_arrow') {
        this.drawNorthArrowItem(ctx, item, x, y, w, h);
      } else if (item.type === 'scale_bar') {
        this.drawScaleBarItem(ctx, item, x, y, w, h, scaleFactor);
      } else if (item.type === 'title_block') {
        this.drawTitleBlockItem(ctx, item, x, y, w, h, composer, scaleFactor);
      } else if (item.type === 'table_vertices') {
        this.drawVerticesTableItem(ctx, item, x, y, w, h, composer, scaleFactor);
      } else if (item.type === 'text_block') {
        this.drawTextBlockItem(ctx, item, x, y, w, h, scaleFactor);
      } else if (item.type === 'legend') {
        this.drawLegendItem(ctx, item, x, y, w, h, composer, scaleFactor);
      }
    }

    return canvas;
  }

  /**
   * Desenha moldura de desenho com margem de 25mm e margens de 10mm/7mm normatizadas ABNT
   */
  static drawAbntMarginsFrame(ctx, composer, scaleFactor) {
    const mL = Math.round(composer.paperSize.marginL * scaleFactor);
    const mO = Math.round(composer.paperSize.marginO * scaleFactor);
    const w = Math.round(composer.paperSize.width * scaleFactor);
    const h = Math.round(composer.paperSize.height * scaleFactor);

    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1.5, Math.round(0.7 * (scaleFactor / (300 / 25.4)))); // Linha técnica ABNT
    ctx.strokeRect(mL, mO, w - mL - mO, h - mO * 2);

    // Marcas de dobra nos cantos da folha
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 0.75;
    const tickLen = Math.round(5 * scaleFactor);
    // Canto superior esquerdo
    ctx.beginPath(); ctx.moveTo(mL - tickLen, mO); ctx.lineTo(mL + tickLen, mO); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mL, mO - tickLen); ctx.lineTo(mL, mO + tickLen); ctx.stroke();
    ctx.restore();
  }

  /**
   * Renderiza Mapa com Tiles e Geometrias Vetoriais Nativas em Alta Resolução
   */
  static async drawMapItem(ctx, item, x, y, w, h, composer, scaleFactor, includeTiles) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    // Fundo do mapa
    ctx.fillStyle = item.basemap === 'branco' ? '#ffffff' : '#f0f3f5';
    ctx.fillRect(x, y, w, h);

    const domEl = document.getElementById(`leaf-map-${item.id}`);
    const map = composer.leafletMaps.get(item.id);

    if (domEl && map) {
      const mapRect = domEl.getBoundingClientRect();
      const scaleX = w / mapRect.width;
      const scaleY = h / mapRect.height;

      // 1. Renderiza Tiles de Imagem (se habilitado)
      if (includeTiles && item.basemap !== 'branco') {
        const tiles = Array.from(domEl.querySelectorAll('.leaflet-tile-pane img'));
        tiles.forEach((img) => {
          if (!img.complete || img.naturalWidth === 0) return;
          const imgRect = img.getBoundingClientRect();
          const destX = x + (imgRect.left - mapRect.left) * scaleX;
          const destY = y + (imgRect.top - mapRect.top) * scaleY;
          const destW = imgRect.width * scaleX;
          const destH = imgRect.height * scaleY;

          try {
            ctx.drawImage(img, destX, destY, destW, destH);
          } catch (e) {
            // Ignora falha em tile específico
          }
        });
      }

      // 2. Renderiza Feições Vetoriais em Resolução Nativa Subpixel
      if (item.type === 'map' && composer.features.length > 0) {
        this.drawNativeVectorFeatures(ctx, map, mapRect, composer.features, composer.layers, x, y, scaleX, scaleY, scaleFactor);
      }

      // 3. Se for Inset Map, desenha o Retângulo de Abrangência (Extent Box) do mapa principal
      if (item.type === 'inset_map') {
        this.drawInsetMapExtentBox(ctx, map, mapRect, composer, x, y, scaleX, scaleY);
      }
    }

    ctx.restore();

    // Moldura do mapa
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1.5, Math.round(1.5 * (scaleFactor / (300 / 25.4))));
    ctx.strokeRect(x, y, w, h);

    // Grade Cartográfica Real (Cruzetas e Rótulos)
    if (item.showGrid && map) {
      this.drawMapGraticule(ctx, item, map, x, y, w, h, scaleFactor);
    }
  }

  /**
   * Renderiza feições vetoriais com precisão cartográfica subpixel
   */
  static drawNativeVectorFeatures(ctx, map, mapRect, features, layers, originX, originY, scaleX, scaleY, scaleFactor) {
    const reversedLayers = [...layers].reverse();

    reversedLayers.forEach(layer => {
      if (layer.visible === false) return;
      const layerFeatures = features.filter(f => f.layerId === layer.id && f.visible !== false);

      layerFeatures.forEach(feat => {
        const color = feat.color || layer.color || '#00E08A';
        const rawType = (feat.type || '').toLowerCase();
        const coords = feat.coordinates;
        if (!coords || coords.length === 0) return;

        ctx.save();

        if (rawType === 'polygon' || rawType === 'multipolygon') {
          let ring = coords;
          if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) ring = coords[0];

          const pts = ring.map(c => {
            const lat = Array.isArray(c) ? c[0] : c.lat;
            const lng = Array.isArray(c) ? c[1] : c.lng;
            const p = map.latLngToContainerPoint([lat, lng]);
            return {
              x: originX + p.x * scaleX,
              y: originY + p.y * scaleY
            };
          });

          if (pts.length >= 3) {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();

            // Preenchimento
            ctx.fillStyle = this.hexToRgba(color, 0.35);
            ctx.fill();

            // Borda nítida
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(1.5, 2.5 * (scaleFactor / (300 / 25.4)));
            ctx.lineJoin = 'round';
            ctx.stroke();

            // Rótulo no centro
            if (feat.name) {
              const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
              const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
              this.drawFeatureLabel(ctx, feat.name, cx, cy, color, scaleFactor);
            }
          }
        } else if (rawType === 'linestring' || rawType === 'line') {
          const pts = coords.map(c => {
            const lat = Array.isArray(c) ? c[0] : c.lat;
            const lng = Array.isArray(c) ? c[1] : c.lng;
            const p = map.latLngToContainerPoint([lat, lng]);
            return {
              x: originX + p.x * scaleX,
              y: originY + p.y * scaleY
            };
          });

          if (pts.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(1.5, 2.5 * (scaleFactor / (300 / 25.4)));
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
          }
        } else if (rawType === 'point') {
          const pt = Array.isArray(coords[0]) ? coords[0] : coords;
          const lat = Array.isArray(pt) ? pt[0] : pt.lat;
          const lng = Array.isArray(pt) ? pt[1] : pt.lng;

          if (!isNaN(lat) && !isNaN(lng)) {
            const p = map.latLngToContainerPoint([lat, lng]);
            const px = originX + p.x * scaleX;
            const py = originY + p.y * scaleY;
            const r = Math.max(3, 6 * (scaleFactor / (300 / 25.4)));

            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(px, py, r * 0.35, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          }
        }

        ctx.restore();
      });
    });
  }

  /**
   * Rótulo de feição com halo protetor branco para máxima legibilidade
   */
  static drawFeatureLabel(ctx, text, x, y, color, scaleFactor) {
    const fontSize = Math.max(10, Math.round(11 * (scaleFactor / (300 / 25.4))));
    ctx.save();
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Halo branco
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(3, fontSize * 0.3);
    ctx.strokeText(text, x, y);

    // Texto preto de alto contraste
    ctx.fillStyle = '#111111';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /**
   * Desenha o Retângulo de Abrangência no Inset Map
   */
  static drawInsetMapExtentBox(ctx, insetMap, mapRect, composer, originX, originY, scaleX, scaleY) {
    const mainMapItem = composer.items.find(i => i.type === 'map');
    if (!mainMapItem) return;
    const mainMap = composer.leafletMaps.get(mainMapItem.id);
    if (!mainMap) return;

    const b = mainMap.getBounds();
    const nw = insetMap.latLngToContainerPoint([b.getNorth(), b.getWest()]);
    const se = insetMap.latLngToContainerPoint([b.getSouth(), b.getEast()]);

    const boxX = originX + nw.x * scaleX;
    const boxY = originY + nw.y * scaleY;
    const boxW = (se.x - nw.x) * scaleX;
    const boxH = (se.y - nw.y) * scaleY;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 34, 68, 0.25)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#ff2244';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.restore();
  }

  /**
   * Desenha a Grade Cartográfica Real (Cruzetas e Rótulos Perimetrais)
   */
  static drawMapGraticule(ctx, item, map, x, y, w, h, scaleFactor) {
    ctx.save();
    const bounds = map.getBounds();
    const fontSize = Math.max(8, Math.round(8.5 * (scaleFactor / (300 / 25.4))));
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = '#000000';

    // Cruzetas internas de grade (+)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1;
    const crossSize = Math.max(4, Math.round(6 * (scaleFactor / (300 / 25.4))));

    const cols = 4;
    const rows = 4;
    for (let c = 1; c < cols; c++) {
      for (let r = 1; r < rows; r++) {
        const cx = x + (w / cols) * c;
        const cy = y + (h / rows) * r;
        ctx.beginPath();
        ctx.moveTo(cx - crossSize, cy); ctx.lineTo(cx + crossSize, cy);
        ctx.moveTo(cx, cy - crossSize); ctx.lineTo(cx, cy + crossSize);
        ctx.stroke();
      }
    }

    // Rótulos nas margens externas
    if (item.gridType === 'utm') {
      const avgLng = (bounds.getWest() + bounds.getEast()) / 2;
      const zone = PrintItemsManager.detectUtmZone(avgLng);
      const nw = PrintItemsManager.toUtmCoords(bounds.getNorth(), bounds.getWest(), zone);
      const se = PrintItemsManager.toUtmCoords(bounds.getSouth(), bounds.getEast(), zone);

      ctx.textAlign = 'center';
      ctx.fillText(`${nw.northing.toLocaleString('pt-BR')} m N`, x + w / 2, y - 4);
      ctx.fillText(`${se.northing.toLocaleString('pt-BR')} m N`, x + w / 2, y + h + fontSize + 2);
    } else {
      const nDMS = PrintItemsManager.formatDMS(bounds.getNorth(), true);
      const sDMS = PrintItemsManager.formatDMS(bounds.getSouth(), true);
      const wDMS = PrintItemsManager.formatDMS(bounds.getWest(), false);
      const eDMS = PrintItemsManager.formatDMS(bounds.getEast(), false);

      ctx.textAlign = 'center';
      ctx.fillText(nDMS, x + w / 2, y - 4);
      ctx.fillText(sDMS, x + w / 2, y + h + fontSize + 2);
    }

    ctx.restore();
  }

  /**
   * Renderiza a Rosa dos Ventos com precisão vetorial
   */
  static drawNorthArrowItem(ctx, item, x, y, w, h) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(((item.rotation || 0) * Math.PI) / 180);
    const r = Math.min(w, h) / 2;

    // Seta Norte preta e branca com alto relevo
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.92);
    ctx.lineTo(r * 0.28, r * 0.25);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.92);
    ctx.lineTo(-r * 0.28, r * 0.25);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Seta Sul oposta
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(0, r * 0.8);
    ctx.lineTo(-r * 0.22, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.8);
    ctx.lineTo(r * 0.22, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Letra N
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${Math.round(r * 0.38)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, -r * 0.45);

    ctx.restore();
  }

  /**
   * Renderiza a Barra de Escala Gráfica segmentada
   */
  static drawScaleBarItem(ctx, item, x, y, w, h, scaleFactor) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    const scaleNum = item.scale || 10000;
    const fontSize = Math.max(7, Math.round(h * 0.22));
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`Escala 1:${scaleNum.toLocaleString('pt-BR')}`, x + w / 2, y + h * 0.28);

    const barY = y + h * 0.48;
    const barH = h * 0.22;
    const segW = (w * 0.82) / 4;
    const barX = x + w * 0.09;

    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#000000' : '#ffffff';
      ctx.fillRect(barX + i * segW, barY, segW, barH);
      ctx.strokeRect(barX + i * segW, barY, segW, barH);
    }

    // Rótulos de distância métrica
    const groundDistanceMeters = ((item.width || 60) / 1000) * scaleNum;
    const labelEnd = groundDistanceMeters >= 1000 ? `${(groundDistanceMeters / 1000).toFixed(1)} km` : `${Math.round(groundDistanceMeters)} m`;
    const labelMid = groundDistanceMeters >= 1000 ? `${(groundDistanceMeters / 2000).toFixed(1)} km` : `${Math.round(groundDistanceMeters / 2)} m`;

    ctx.font = `bold ${Math.round(fontSize * 0.85)}px Arial, sans-serif`;
    ctx.fillText('0', barX, barY + barH + fontSize + 1);
    ctx.fillText(labelMid, barX + segW * 2, barY + barH + fontSize + 1);
    ctx.fillText(labelEnd, barX + segW * 4, barY + barH + fontSize + 1);
  }

  /**
   * Renderiza o Selo / Carimbo Técnico nos padrões ABNT NBR 6492 / NBR 13133
   */
  static drawTitleBlockItem(ctx, item, x, y, w, h, composer, scaleFactor) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1.5, Math.round(1.5 * (scaleFactor / (300 / 25.4))));
    ctx.strokeRect(x, y, w, h);

    const p = item.properties || {};
    const headH = h * 0.18;

    // Cabeçalho preto
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, w, headH);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(headH * 0.52)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(p.headerTitle || 'PLANTA TOPOGRÁFICA / CARTOGRÁFICA', x + w / 2, y + headH * 0.7);

    // Divisões e textos das células
    const rowH = (h - headH) / 4;
    const colW = w / 2;
    const fontLabel = Math.max(6, Math.round(rowH * 0.28));
    const fontVal = Math.max(7, Math.round(rowH * 0.38));

    // Linhas horizontais
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y + headH + rowH * i);
      ctx.lineTo(x + w, y + headH + rowH * i);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Linha vertical intermediária
    ctx.beginPath();
    ctx.moveTo(x + colW, y + headH);
    ctx.lineTo(x + colW, y + h);
    ctx.stroke();

    const drawCell = (cx, cy, label, val) => {
      ctx.fillStyle = '#666666';
      ctx.font = `bold ${fontLabel}px Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(label.toUpperCase(), cx + 4, cy + rowH * 0.38);
      ctx.fillStyle = '#000000';
      ctx.font = `bold ${fontVal}px Arial, sans-serif`;
      ctx.fillText(val || '-', cx + 4, cy + rowH * 0.82);
    };

    drawCell(x, y + headH, 'Projeto', p.projectName || composer.projectName);
    drawCell(x + colW, y + headH, 'Proprietário', p.client || 'Particular');

    drawCell(x, y + headH + rowH, 'Resp. Técnico', p.author || 'Eng. Cartógrafo');
    drawCell(x + colW, y + headH + rowH, 'Registro / ART', p.art || 'CREA-BR 2026');

    drawCell(x, y + headH + rowH * 2, 'Sistema Geodésico', p.datum || 'SIRGAS 2000');
    drawCell(x + colW, y + headH + rowH * 2, 'Escala', p.scaleText || '1:10.000');

    drawCell(x, y + headH + rowH * 3, 'Área / Perímetro', p.areaPerimeter || 'Conforme Tabela');
    drawCell(x + colW, y + headH + rowH * 3, 'Data / Prancha', `${p.date || new Date().toLocaleDateString('pt-BR')} (01/01)`);
  }

  /**
   * Renderiza a Tabela de Vértices Topográfica com precisão milimétrica
   */
  static drawVerticesTableItem(ctx, item, x, y, w, h, composer, scaleFactor) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    const data = PrintItemsManager.extractVerticesData(composer.features, item.targetFeatureId);
    const headH = h * 0.14;

    // Cabeçalho da tabela
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, w, headH);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(headH * 0.5)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('TABELA DE COORDENADAS E CONFRONTAÇÕES', x + w / 2, y + headH * 0.68);

    // Colunas: Vértice (15%), Norte (23%), Leste (23%), Azimute (21%), Distância (18%)
    const cols = [
      { name: 'Vértice', w: w * 0.15 },
      { name: 'Norte (Y)', w: w * 0.23 },
      { name: 'Leste (X)', w: w * 0.23 },
      { name: 'Azimute', w: w * 0.21 },
      { name: 'Distância (m)', w: w * 0.18 }
    ];

    const subHeadH = h * 0.10;
    ctx.fillStyle = '#e8ecef';
    ctx.fillRect(x, y + headH, w, subHeadH);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y + headH, w, subHeadH);

    let curX = x;
    const fontSub = Math.max(6.5, Math.round(subHeadH * 0.45));
    ctx.font = `bold ${fontSub}px Arial, sans-serif`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';

    cols.forEach(c => {
      ctx.fillText(c.name, curX + c.w / 2, y + headH + subHeadH * 0.68);
      curX += c.w;
      ctx.beginPath(); ctx.moveTo(curX, y + headH); ctx.lineTo(curX, y + h); ctx.stroke();
    });

    // Linhas de vértices
    const nRows = Math.min(12, data.vertices.length);
    const rowH = (h - headH - subHeadH - (data.vertices.length > 0 ? h * 0.12 : 0)) / Math.max(1, nRows);
    const fontRow = Math.max(6, Math.round(rowH * 0.48));

    for (let i = 0; i < nRows; i++) {
      const v = data.vertices[i];
      const rY = y + headH + subHeadH + rowH * i;

      if (i % 2 === 1) {
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(x, rY, w, rowH);
      }

      ctx.beginPath(); ctx.moveTo(x, rY + rowH); ctx.lineTo(x + w, rY + rowH); ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = `${fontRow}px monospace`;
      ctx.textAlign = 'center';

      let cx = x;
      ctx.fillText(v.name, cx + cols[0].w / 2, rY + rowH * 0.68);
      cx += cols[0].w;
      ctx.fillText(v.northing, cx + cols[1].w / 2, rY + rowH * 0.68);
      cx += cols[1].w;
      ctx.fillText(v.easting, cx + cols[2].w / 2, rY + rowH * 0.68);
      cx += cols[2].w;
      ctx.fillText(v.azimuth, cx + cols[3].w / 2, rY + rowH * 0.68);
      cx += cols[3].w;
      ctx.fillText(v.distance, cx + cols[4].w / 2, rY + rowH * 0.68);
    }

    // Rodapé de Área e Perímetro
    if (data.vertices.length > 0) {
      const footH = h * 0.12;
      const footY = y + h - footH;
      ctx.fillStyle = '#eef2f5';
      ctx.fillRect(x, footY, w, footH);
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(x, footY, w, footH);

      ctx.fillStyle = '#000000';
      ctx.font = `bold ${Math.max(6.5, Math.round(footH * 0.42))}px Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(`Área: ${data.totalAreaM2.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m² (${data.totalAreaHa.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ha)`, x + 6, footY + footH * 0.65);
      ctx.textAlign = 'right';
      ctx.fillText(`Perímetro: ${data.totalPerimeter.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m`, x + w - 6, footY + footH * 0.65);
    }
  }

  /**
   * Renderiza o Bloco de Notas Técnicas / Texto Livre
   */
  static drawTextBlockItem(ctx, item, x, y, w, h, scaleFactor) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    const headH = Math.min(22 * (scaleFactor / (300 / 25.4)), h * 0.25);
    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(x, y, w, headH);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(headH * 0.52)}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(item.title || 'NOTAS GERAIS', x + 6, y + headH * 0.68);

    const lines = (item.text || '').split('\n');
    const fontSize = Math.max(6.5, Math.round((item.fontSize || 7.5) * (scaleFactor / (300 / 25.4))));
    const lineStep = fontSize * 1.4;

    ctx.fillStyle = '#000000';
    ctx.font = `${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'left';

    let curY = y + headH + lineStep;
    for (const line of lines) {
      if (curY > y + h - 4) break;
      ctx.fillText(line, x + 6, curY);
      curY += lineStep;
    }
  }

  /**
   * Renderiza a Legenda Temática
   */
  static drawLegendItem(ctx, item, x, y, w, h, composer, scaleFactor) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    const headH = Math.min(20 * (scaleFactor / (300 / 25.4)), h * 0.25);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, w, headH);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(headH * 0.5)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('LEGENDA CONVENCIONAL', x + w / 2, y + headH * 0.68);

    const visibleLayers = composer.layers.filter(l => l.visible !== false);
    const rowStep = Math.min(20 * (scaleFactor / (300 / 25.4)), (h - headH) / Math.max(1, visibleLayers.length));
    let rowY = y + headH + rowStep * 0.75;
    const swatchSize = Math.max(6, Math.round(rowStep * 0.5));
    const fontRow = Math.max(6.5, Math.round(rowStep * 0.55));

    for (const layer of visibleLayers) {
      if (rowY > y + h - 4) break;
      ctx.fillStyle = layer.color || '#00E08A';
      ctx.fillRect(x + 8, rowY - swatchSize + 2, swatchSize, swatchSize);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 8, rowY - swatchSize + 2, swatchSize, swatchSize);

      ctx.fillStyle = '#000000';
      ctx.font = `bold ${fontRow}px Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(layer.name, x + 8 + swatchSize + 6, rowY);

      rowY += rowStep;
    }
  }

  static hexToRgba(hex, alpha = 1) {
    if (!hex || typeof hex !== 'string') return `rgba(0, 224, 138, ${alpha})`;
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(0, 224, 138, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
