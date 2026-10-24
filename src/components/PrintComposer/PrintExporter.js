/* ==========================================================================
   ConecteMapas - PrintExporter
   Responsabilidade Única: Renderização de pranchas cartográficas em alta resolução
   (300 DPI / 150 DPI), motor vetorial nativo subpixel, salvaguardas de memória GPU,
   tolerância a CORS e geração milimétrica de PDF técnico via jsPDF.
   ========================================================================== */

import { jsPDF } from 'jspdf';
import { UIToast } from '@thibezer/ui-components-kit';
import { notifyProgress } from '../../utils/toastHelpers.js';
import { PrintItemsManager } from './PrintItemsManager.js';
import { PrintMapRenderer } from './PrintMapRenderer.js';
import { PrintCanvasEngine } from './PrintCanvasEngine.js';
import { BasemapCatalog } from '../../services/BasemapCatalog.js';

export class PrintExporter {
  /**
   * Exporta a prancha cartográfica para arquivo PNG de alta resolução
   */
  static async exportToPNG(composer, dpi = 300) {
    try {
      const progress = notifyProgress({
        titulo: 'Gerando imagem PNG',
        mensagem: `Renderizando prancha em ${dpi} DPI...`
      });

      let rendered;
      try {
        rendered = await this.renderSheetWithFallback(composer, dpi);
      } finally {
        progress.done();
      }
      const { canvas, usedFallback } = rendered;
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
      const progress = notifyProgress({
        titulo: 'Gerando PDF técnico',
        mensagem: `Processando prancha ${composer.paperSize.name}...`
      });

      let rendered;
      try {
        rendered = await this.renderSheetWithFallback(composer, dpi);
      } finally {
        progress.done();
      }
      const { canvas, usedFallback } = rendered;
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
      } else if (item.type === 'shape') {
        this.drawShapeItem(ctx, item, x, y, w, h);
      } else if (item.type === 'image') {
        await this.drawImageItem(ctx, item, x, y, w, h);
      } else if (item.type === 'label') {
        this.drawLabelItem(ctx, item, x, y, w, h, scaleFactor);
      }
    }

    return canvas;
  }

  /**
   * Desenha a moldura nas margens da folha (ABNT ou personalizadas)
   */
  static drawAbntMarginsFrame(ctx, composer, scaleFactor) {
    const m = PrintItemsManager.sheetMargins(composer.paperSize);
    const mL = Math.round(m.left * scaleFactor);
    const mO = Math.round(m.top * scaleFactor);
    const w = Math.round(composer.paperSize.width * scaleFactor);
    const h = Math.round(composer.paperSize.height * scaleFactor);
    const innerW = w - mL - Math.round(m.right * scaleFactor);
    const innerH = h - mO - Math.round(m.bottom * scaleFactor);

    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1.5, Math.round(0.7 * (scaleFactor / (300 / 25.4)))); // Linha técnica ABNT
    ctx.strokeRect(mL, mO, innerW, innerH);

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
    const basemapId = BasemapCatalog.normalize(item.basemap);
    ctx.fillStyle = BasemapCatalog.backgroundOf(basemapId);
    ctx.fillRect(x, y, w, h);

    const domEl = document.getElementById(`leaf-map-${item.id}`);
    const map = composer.leafletMaps.get(item.id);

    if (domEl && map) {
      const mapRect = domEl.getBoundingClientRect();
      const scaleX = w / mapRect.width;
      const scaleY = h / mapRect.height;

      // 1. Renderiza Tiles de Imagem (se habilitado)
      if (includeTiles && BasemapCatalog.get(basemapId).tiles.length) {
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

      // Coordenadas de contêiner do Leaflet (latLngToContainerPoint) são em px CSS sem o zoom da prancheta
      // (o item é escalado por transform), então a razão para a folha usa offsetWidth/offsetHeight.
      const cssScaleX = w / (domEl.offsetWidth || mapRect.width);
      const cssScaleY = h / (domEl.offsetHeight || mapRect.height);

      // 2. Feições pela vista do mapa: o mesmo desenho da tela (PrintMapRenderer), em px CSS escalados
      if (item.type === 'map') {
        const state = composer.vectorStateFor(item, map);
        if (state) {
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(cssScaleX, cssScaleY);
          PrintMapRenderer.draw(ctx, {
            ...state,
            pxPerMm: PrintCanvasEngine.BASE_PX_PER_MM,
            project: (ll) => map.latLngToContainerPoint(ll)
          });
          ctx.restore();
        }
      }

      // 3. Se for Inset Map, desenha o Retângulo de Abrangência (Extent Box) do mapa principal
      if (item.type === 'inset_map') {
        this.drawInsetMapExtentBox(ctx, map, mapRect, composer, x, y, cssScaleX, cssScaleY);
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

    // Mesmo critério da tela: área pequena demais vira um ponto no centro
    const locator = PrintItemsManager.insetLocator(nw, se);

    ctx.save();
    ctx.strokeStyle = '#ff2244';
    ctx.lineWidth = 2;
    if (locator.type === 'rect') {
      const boxX = originX + locator.x * scaleX;
      const boxY = originY + locator.y * scaleY;
      ctx.fillStyle = 'rgba(255, 34, 68, 0.25)';
      ctx.fillRect(boxX, boxY, locator.w * scaleX, locator.h * scaleY);
      ctx.strokeRect(boxX, boxY, locator.w * scaleX, locator.h * scaleY);
    } else {
      ctx.fillStyle = 'rgba(255, 34, 68, 0.85)';
      ctx.beginPath();
      ctx.arc(originX + locator.x * scaleX, originY + locator.y * scaleY, 4 * scaleX, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Desenha a Grade Cartográfica Real (Cruzetas e Rótulos Perimetrais)
   */
  static drawMapGraticule(ctx, item, map, x, y, w, h, scaleFactor) {
    const b = map.getBounds();
    // Mesma grade da prancheta: intervalos redondos em DMS ou UTM
    const { xs, ys } = PrintItemsManager.graticuleModel(
      { north: b.getNorth(), south: b.getSouth(), west: b.getWest(), east: b.getEast() },
      item.gridType || 'dms'
    );
    const mm = scaleFactor; // px por mm na resolução de exportação
    const tick = 1.8 * mm;
    const cross = 1.5 * mm;
    const fontSize = Math.max(6, Math.round(1.9 * mm));

    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1, 0.25 * mm);
    ctx.beginPath();
    xs.forEach(gx => {
      const px = x + gx.f * w;
      ctx.moveTo(px, y); ctx.lineTo(px, y + tick);
      ctx.moveTo(px, y + h); ctx.lineTo(px, y + h - tick);
    });
    ys.forEach(gy => {
      const py = y + gy.f * h;
      ctx.moveTo(x, py); ctx.lineTo(x + tick, py);
      ctx.moveTo(x + w, py); ctx.lineTo(x + w - tick, py);
    });
    xs.forEach(gx => ys.forEach(gy => {
      const cx = x + gx.f * w;
      const cy = y + gy.f * h;
      ctx.moveTo(cx - cross, cy); ctx.lineTo(cx + cross, cy);
      ctx.moveTo(cx, cy - cross); ctx.lineTo(cx, cy + cross);
    }));
    ctx.stroke();

    // Rótulo com fundo branco, centrado em (cx, cy), opcionalmente girado
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = (text, cx, cy, angle = 0) => {
      const tw = ctx.measureText(text).width + fontSize * 0.5;
      const th = fontSize * 1.25;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(-tw / 2, -th / 2, tw, th);
      ctx.fillStyle = '#111111';
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };
    const gap = tick + fontSize * 0.75;
    xs.forEach(gx => {
      const px = x + gx.f * w;
      label(gx.label, px, y + gap);
      label(gx.label, px, y + h - gap);
    });
    ys.forEach(gy => {
      const py = y + gy.f * h;
      label(gy.label, x + gap, py, -Math.PI / 2);
      label(gy.label, x + w - gap, py, Math.PI / 2);
    });
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

    // Mesma régua da prancheta: comprimento = distância rotulada na escala do mapa
    const model = PrintItemsManager.scaleBarModel(item, item.scale || 10000);
    const fontSize = Math.max(7, Math.round(h * 0.22));
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    if (model.showText) ctx.fillText(model.scaleText, x + w / 2, y + h * 0.28);

    const barY = y + h * (model.showText ? 0.48 : 0.3);
    const barH = h * 0.22;
    const barW = w * model.ratio;
    const segW = barW / model.segments;
    const barX = x + (w - barW) / 2;

    for (let i = 0; i < model.segments; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#000000' : '#ffffff';
      ctx.fillRect(barX + i * segW, barY, segW, barH);
      ctx.strokeRect(barX + i * segW, barY, segW, barH);
    }

    ctx.fillStyle = '#000000';
    ctx.font = `bold ${Math.round(fontSize * 0.85)}px Arial, sans-serif`;
    model.labels.forEach(l => ctx.fillText(l.text, barX + barW * l.position, barY + barH + fontSize + 1));
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
    drawCell(x + colW, y + headH + rowH * 2, 'Escala', PrintItemsManager.titleBlockScaleText(p, composer.items.find(i => i.type === 'map')?.scale));

    drawCell(x, y + headH + rowH * 3, 'Área / Perímetro', p.areaPerimeter || 'Conforme Tabela');
    drawCell(x + colW, y + headH + rowH * 3, 'Data / Prancha', PrintItemsManager.titleBlockDateText(p));
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
      { name: 'Az. geod.', w: w * 0.21 },
      { name: 'Dist. geod. (m)', w: w * 0.18 }
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

    const title = item.title ?? PrintItemsManager.DEFAULT_LEGEND_TITLE;
    const headH = title ? Math.min(20 * (scaleFactor / (300 / 25.4)), h * 0.25) : 0;
    if (title) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(x, y, w, headH);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(headH * 0.5)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(title, x + w / 2, y + headH * 0.68);
    }

    const visibleLayers = PrintItemsManager.legendLayers(item, composer.layers);
    const rowStep = Math.min(20 * (scaleFactor / (300 / 25.4)), (h - headH) / Math.max(1, visibleLayers.length));
    let rowY = y + headH + rowStep * 0.75;
    const swatchSize = Math.max(6, Math.round(rowStep * 0.5));
    const fontRow = Math.max(6.5, Math.round(rowStep * 0.55));

    for (const layer of visibleLayers) {
      if (rowY > y + h - 4) break;
      ctx.fillStyle = PrintItemsManager.sanitizeColor(layer.color, '#00E08A');
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

  /**
   * Renderiza Forma Geométrica / Moldura Técnica
   */
  static drawShapeItem(ctx, item, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = PrintItemsManager.sanitizeColor(item.fillColor, 'rgba(255, 255, 255, 0.5)');
    ctx.strokeStyle = PrintItemsManager.sanitizeColor(item.strokeColor, '#000000');
    ctx.lineWidth = item.strokeWidth !== undefined ? item.strokeWidth : 1.5;
    ctx.fillRect(x, y, w, h);
    if (ctx.lineWidth > 0) ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  /**
   * Renderiza Imagem / Logotipo em Alta Resolução
   */
  static async drawImageItem(ctx, item, x, y, w, h) {
    if (!item.imageUrl) return;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          ctx.drawImage(img, x, y, w, h);
        } catch (e) {}
        resolve();
      };
      img.onerror = () => resolve();
      img.src = item.imageUrl;
    });
  }

  /**
   * Renderiza Rótulo de Texto Livre / Título Customizado
   */
  static drawLabelItem(ctx, item, x, y, w, h, scaleFactor) {
    ctx.save();
    const fontSize = Math.max(8, Math.round((item.fontSize || 10) * (scaleFactor / (300 / 25.4))));
    const weight = item.fontWeight || 'bold';
    ctx.font = `${weight} ${fontSize}px Arial, sans-serif`;
    ctx.fillStyle = PrintItemsManager.sanitizeColor(item.textColor, '#000000');
    const align = item.textAlign || 'center';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const textX = align === 'center' ? x + w / 2 : (align === 'right' ? x + w - 4 : x + 4);
    ctx.fillText(item.text || 'TÍTULO', textX, y + h / 2);
    ctx.restore();
  }

  /**
   * Exporta Todas as Pranchas do Projeto em um Único Documento PDF Técnico (Caderno de Pranchas)
   */
  static async exportAllSheetsToPDF(composer, dpi = 300) {
    try {
      if (!composer.sheetsManager || !composer.sheetsManager.sheets || composer.sheetsManager.sheets.length <= 1) {
        return this.exportToPDF(composer, dpi);
      }

      composer.sheetsManager.saveCurrentStateFromComposer();
      const sheets = composer.sheetsManager.sheets;
      const initialSheetId = composer.sheetsManager.activeSheetId;

      const progress = notifyProgress({
        titulo: 'Gerando Caderno de Pranchas',
        mensagem: `Processando ${sheets.length} pranchas em PDF técnico...`
      });

      let pdf = null;

      try {
        for (let i = 0; i < sheets.length; i++) {
          const sh = sheets[i];
          // Aplica dados da prancha temporariamente no compositor para renderizar
          composer.paperSize = sh.paperSize;
          composer.showAbntMargins = sh.showAbntMargins !== false;
          composer.items = sh.items;

          const rendered = await this.renderSheetWithFallback(composer, dpi);
          const { canvas } = rendered;
          if (!canvas) continue;

          const wMm = sh.paperSize.width;
          const hMm = sh.paperSize.height;
          const isLandscape = wMm > hMm;

          if (!pdf) {
            pdf = new jsPDF({
              orientation: isLandscape ? 'landscape' : 'portrait',
              unit: 'mm',
              format: [wMm, hMm],
              compress: true
            });
          } else {
            pdf.addPage([wMm, hMm], isLandscape ? 'landscape' : 'portrait');
          }

          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          pdf.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);
        }
      } finally {
        progress.done();
        // Restaura a prancha original ativa
        composer.sheetsManager.switchToSheet(initialSheetId);
      }

      if (pdf) {
        const cleanName = (composer.projectName || 'projeto')
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '_');
        const fileName = `${cleanName}_caderno_${sheets.length}_pranchas.pdf`;
        pdf.save(fileName);

        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Caderno de Pranchas Gerado',
          mensagem: `PDF com ${sheets.length} pranchas salvo como ${fileName}.`,
          duracao: 4500
        });
      }
    } catch (err) {
      console.error('[PrintExporter] Erro ao exportar todas as pranchas:', err);
      UIToast.notificar({
        tipo: 'erro',
        titulo: 'Falha no Caderno de Pranchas',
        mensagem: err.message || 'Erro ao processar PDF com múltiplas pranchas.',
        duracao: 4500
      });
    }
  }
}
