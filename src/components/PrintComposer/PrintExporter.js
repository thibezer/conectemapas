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
import { PrintTitleBlockRenderer } from './PrintTitleBlockRenderer.js';
import { PdfVectorContext } from './PdfVectorContext.js';
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

      const wMm = composer.paperSize.width;
      const hMm = composer.paperSize.height;
      const isLandscape = wMm > hMm;

      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [wMm, hMm],
        compress: true
      });
      pdf.setProperties({ title: composer.projectName || 'Prancha', creator: 'ConecteMapas' });

      // Vetorial: textos, formas, traços e preenchimentos viram operadores de PDF (não pixels)
      let usedFallback;
      try {
        ({ usedFallback } = await this.renderSheetToPdfPage(pdf, composer, dpi));
      } finally {
        progress.done();
      }

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

    await this.paintSheet(ctx, composer, scaleFactor, wPx, hPx, includeTiles);
    return canvas;
  }

  /**
   * Adiciona a prancha montada à página ATUAL do jsPDF em VETOR: textos, formas, traços,
   * preenchimentos e feições saem como operadores de PDF (nítidos em qualquer zoom). Só os
   * tiles do fundo e imagens do usuário seguem raster. Mesmo desenho do PNG (`paintSheet`).
   * @returns {Promise<{ usedFallback: boolean }>} usedFallback: algum fundo raster foi dispensado por CORS
   */
  static async renderSheetToPdfPage(pdf, composer, dpi = 300) {
    const scaleFactor = dpi / 25.4;
    const wPx = Math.round(composer.paperSize.width * scaleFactor);
    const hPx = Math.round(composer.paperSize.height * scaleFactor);
    const ctx = new PdfVectorContext(pdf, { pxPerMm: scaleFactor });
    try {
      await this.paintSheet(ctx, composer, scaleFactor, wPx, hPx, true);
    } finally {
      ctx.finish();
    }
    return { usedFallback: ctx.rasterBlocked };
  }

  /**
   * Desenha papel, moldura e todos os itens da prancha num contexto 2D (canvas ou PdfVectorContext)
   */
  static async paintSheet(ctx, composer, scaleFactor, wPx, hPx, includeTiles = true) {
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
        this.drawTextBlockItem(ctx, item, x, y, w, h, composer, scaleFactor);
      } else if (item.type === 'legend') {
        this.drawLegendItem(ctx, item, x, y, w, h, composer, scaleFactor);
      } else if (item.type === 'shape') {
        this.drawShapeItem(ctx, item, x, y, w, h, scaleFactor);
      } else if (item.type === 'image') {
        await this.drawImageItem(ctx, item, x, y, w, h, scaleFactor);
      } else if (item.type === 'label') {
        this.drawLabelItem(ctx, item, x, y, w, h, composer, scaleFactor);
      }
    }
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
    // Fundo efetivo: o do modelo de vista vinculado, quando ele controla o fundo
    const basemapId = BasemapCatalog.normalize(composer.basemapFor ? composer.basemapFor(item) : item.basemap);
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
        // No PDF vetorial os tiles são juntados num único raster (sem emendas nem centenas de imagens)
        const vector = ctx.isVector === true;
        const k = vector ? Math.min(1, 4096 / Math.max(w, h)) : 1;
        let tileCanvas = null;
        let tileCtx = ctx;
        let ox = x;
        let oy = y;
        if (vector) {
          tileCanvas = document.createElement('canvas');
          tileCanvas.width = Math.max(1, Math.round(w * k));
          tileCanvas.height = Math.max(1, Math.round(h * k));
          tileCanvas._opaque = true;
          tileCtx = tileCanvas.getContext('2d');
          tileCtx.fillStyle = BasemapCatalog.backgroundOf(basemapId);
          tileCtx.fillRect(0, 0, tileCanvas.width, tileCanvas.height);
          ox = 0;
          oy = 0;
        }
        tiles.forEach((img) => {
          if (!img.complete || img.naturalWidth === 0) return;
          const imgRect = img.getBoundingClientRect();
          const destX = ox + (imgRect.left - mapRect.left) * scaleX * k;
          const destY = oy + (imgRect.top - mapRect.top) * scaleY * k;
          const destW = imgRect.width * scaleX * k;
          const destH = imgRect.height * scaleY * k;

          try {
            tileCtx.drawImage(img, destX, destY, destW, destH);
          } catch (e) {
            // Ignora falha em tile específico
          }
        });
        if (vector) {
          try {
            ctx.drawImage(tileCanvas, x, y, w, h);
          } catch (e) {
            // CORS (canvas "sujo") ou falha ao codificar o fundo: o mapa segue em fundo técnico, com todos os vetores
            console.warn('[PrintExporter] Fundo raster do mapa dispensado no PDF:', e);
            ctx.rasterBlocked = true;
          }
        }
      }

      // Coordenadas de contêiner do Leaflet (latLngToContainerPoint) são em px CSS sem o zoom da prancheta
      // (o item é escalado por transform), então a razão para a folha usa offsetWidth/offsetHeight.
      const cssScaleX = w / (domEl.offsetWidth || mapRect.width);
      const cssScaleY = h / (domEl.offsetHeight || mapRect.height);

      // 2. Feições pela vista do mapa: o mesmo desenho da tela (PrintMapRenderer), em px CSS escalados
      if (item.type === 'map') {
        const state = composer.vectorStateFor(item, map, { forExport: true });
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

    const format = item.gridFormat || 'crosses';
    const labelRot = item.gridLabelRot || 'vertical';

    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1, 0.25 * mm);
    ctx.beginPath();

    // 1. Linhas contínuas (quando format === 'lines')
    if (format === 'lines') {
      xs.forEach(gx => {
        const px = x + gx.f * w;
        ctx.moveTo(px, y); ctx.lineTo(px, y + h);
      });
      ys.forEach(gy => {
        const py = y + gy.f * h;
        ctx.moveTo(x, py); ctx.lineTo(x + w, py);
      });
    }

    // 2. Ticks nas bordas (sempre presentes para precisão cartográfica)
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

    // 3. Cruzetas nos cruzamentos (quando format === 'crosses')
    if (format === 'crosses') {
      xs.forEach(gx => ys.forEach(gy => {
        const cx = x + gx.f * w;
        const cy = y + gy.f * h;
        ctx.moveTo(cx - cross, cy); ctx.lineTo(cx + cross, cy);
        ctx.moveTo(cx, cy - cross); ctx.lineTo(cx, cy + cross);
      }));
    }
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
      const angleL = labelRot === 'horizontal' ? 0 : -Math.PI / 2;
      const angleR = labelRot === 'horizontal' ? 0 : Math.PI / 2;
      label(gy.label, x + gap, py, angleL);
      label(gy.label, x + w - gap, py, angleR);
    });
    ctx.restore();
  }

  /**
   * Seta norte/rosa dos ventos: desenha o mesmo modelo que a tela monta em SVG
   * (PrintItemsManager.northArrowModel), centrado e na escala do menor lado do item.
   */
  static drawNorthArrowItem(ctx, item, x, y, w, h) {
    const color = PrintItemsManager.sanitizeColor(item.color, '#000000');
    const model = PrintItemsManager.northArrowModel(item.arrowStyle || 'classic', color);
    const u = Math.min(w, h) / 100;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(((item.rotation || 0) * Math.PI) / 180);
    const px = (v) => (v - 50) * u;

    model.circles.forEach(c => {
      ctx.strokeStyle = color;
      ctx.lineWidth = c.w * u;
      if (typeof ctx.setLineDash === 'function') ctx.setLineDash(c.dash ? c.dash.map(d => d * u) : []);
      ctx.beginPath();
      ctx.arc(0, 0, c.r * u, 0, Math.PI * 2);
      ctx.stroke();
    });
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);

    model.polys.forEach(p => {
      ctx.beginPath();
      p.pts.forEach(([vx, vy], i) => (i === 0 ? ctx.moveTo(px(vx), px(vy)) : ctx.lineTo(px(vx), px(vy))));
      ctx.closePath();
      ctx.fillStyle = p.fill;
      ctx.fill();
      if (p.stroke) {
        ctx.strokeStyle = p.stroke;
        ctx.lineWidth = p.w * u;
        ctx.stroke();
      }
    });

    const t = model.text;
    ctx.fillStyle = t.fill;
    ctx.font = `bold ${t.size * u}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('N', px(t.x), px(t.y));
    ctx.restore();
  }

  /**
   * Barra de escala gráfica, com as mesmas medidas da tela (.cm-item-scale-bar, em px de tela × k):
   * caixa com borda de 1 px, título 7,5 px, régua de 6 px e rótulos de 7 px, centrados na vertical.
   */
  static drawScaleBarItem(ctx, item, x, y, w, h, scaleFactor) {
    const k = scaleFactor / PrintCanvasEngine.BASE_PX_PER_MM;
    const model = PrintItemsManager.scaleBarModel(item, item.scale || 10000);
    const barStyle = ['double', 'line_ticks'].includes(item.barStyle) ? item.barStyle : 'alternating';
    const barColor = PrintItemsManager.sanitizeColor(item.barColor, '#000000');
    const showBox = item.showBox !== false;

    ctx.save();
    if (showBox) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = barColor;
      ctx.lineWidth = k;
      ctx.strokeRect(x + k / 2, y + k / 2, w - k, h - k);
    }

    const titleH = model.showText ? 8.6 * k : 0;
    const titleGap = model.showText ? 2 * k : 0;
    const rulerH = 6 * k;
    const labelsH = 9 * k;
    const total = titleH + titleGap + 2 * k + rulerH + 2 * k + labelsH;
    let top = y + (h - total) / 2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = barColor;
    if (model.showText) {
      ctx.font = `bold ${7.5 * k}px Arial, sans-serif`;
      ctx.fillText(model.scaleText, x + w / 2, top + titleH / 2);
    }
    top += titleH + titleGap + 2 * k;

    const barW = w * model.ratio;
    const barX = x + (w - barW) / 2;
    const segW = barW / model.segments;
    if (barStyle === 'double') {
      const halfH = rulerH / 2;
      for (let i = 0; i < model.segments; i++) {
        const topDark = i % 2 === 0;
        ctx.fillStyle = topDark ? barColor : '#ffffff';
        ctx.fillRect(barX + i * segW, top, segW, halfH);
        ctx.fillStyle = topDark ? '#ffffff' : barColor;
        ctx.fillRect(barX + i * segW, top + halfH, segW, halfH);
      }
      ctx.strokeStyle = barColor;
      ctx.lineWidth = k;
      ctx.strokeRect(barX + k / 2, top + k / 2, barW - k, rulerH - k);
    } else if (barStyle === 'line_ticks') {
      ctx.strokeStyle = barColor;
      ctx.lineWidth = Math.max(1, k * 1.2);
      ctx.beginPath();
      const baseY = top + rulerH;
      ctx.moveTo(barX, baseY);
      ctx.lineTo(barX + barW, baseY);
      for (let i = 0; i <= model.segments; i++) {
        const tx = barX + i * segW;
        ctx.moveTo(tx, top + (i % 2 === 0 ? 0 : rulerH * 0.35));
        ctx.lineTo(tx, baseY);
      }
      ctx.stroke();
    } else {
      for (let i = 0; i < model.segments; i++) {
        ctx.fillStyle = i % 2 === 0 ? barColor : '#ffffff';
        ctx.fillRect(barX + i * segW, top, segW, rulerH);
      }
      ctx.strokeStyle = barColor;
      ctx.lineWidth = k;
      ctx.strokeRect(barX + k / 2, top + k / 2, barW - k, rulerH - k);
    }

    top += rulerH + 2 * k;
    ctx.fillStyle = barColor;
    ctx.font = `bold ${7 * k}px Arial, sans-serif`;
    model.labels.forEach(l => ctx.fillText(l.text, barX + barW * l.position, top + 4 * k));
    ctx.restore();
  }

  /**
   * Renderiza o Selo / Carimbo Técnico nos padrões ABNT NBR 6492 / NBR 13133
   */
  static drawTitleBlockItem(ctx, item, x, y, w, h, composer, scaleFactor) {
    // Mesmo desenho da tela (PrintTitleBlockRenderer), na resolução da exportação
    ctx.save();
    ctx.translate(x, y);
    composer.drawCanvasItem(ctx, item, scaleFactor);
    ctx.restore();
  }


  /**
   * Tabela de Vértices Topográfica. As medidas (PrintItemsManager.VERT_TABLE) e o ajuste de escala
   * (verticesTableFit) são os mesmos da tela: nenhuma linha some nem o texto se sobrepõe.
   */
  static drawVerticesTableItem(ctx, item, x, y, w, h, composer, scaleFactor) {
    const T = PrintItemsManager.VERT_TABLE;
    const k = scaleFactor / T.PX_PER_MM;
    const isAreas = item.tableMode === 'areas';
    const targetId = item.targetFeatureId || (composer?.atlas?.enabled ? composer.atlas.getCurrentFeature()?.id : null);
    const data = isAreas
      ? PrintItemsManager.extractAreasSummaryData(composer?.features || [], composer?.layers || [])
      : PrintItemsManager.extractVerticesData(composer?.features || [], targetId, {
          crs: item.crs || 'utm',
          segmentFormat: item.segmentFormat || 'vertex',
          vertexPrefix: item.vertexPrefix,
          startVertex: item.startVertex,
          endVertex: item.endVertex
        });
    const baseCols = PrintItemsManager.resolveVerticesTableColumns(item);
    const showFooter = item.showFooter !== false;
    const fit = PrintItemsManager.verticesTableFit(data, item.width, item.height, baseCols, { showFooter });
    const fitText = (text, maxW) => PrintTitleBlockRenderer.fit(ctx, text, maxW);

    const bw = T.BORDER * k;
    const ix = x + bw;
    const iy = y + bw;
    const iw = w - bw * 2;
    const ih = h - bw * 2;
    const headH = T.HEAD * k;
    const subH = T.SUB * k;
    const rowH = fit.rowH * k;
    const footH = T.FOOT * k;
    const px = T.FONT * fit.scale * k;
    const pad = 3 * fit.scale * k;
    const hair = Math.max(0.5, k);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    ctx.textBaseline = 'middle';

    // Cabeçalho: título à esquerda (encurtado se preciso) e sistema de referência à direita
    ctx.fillStyle = item.headerBgColor ? PrintItemsManager.sanitizeColor(item.headerBgColor, '#000000') : '#000000';
    ctx.fillRect(ix, iy, iw, headH);
    const datum = PrintItemsManager.verticesTableDatum(data, item);
    let datumW = 0;
    if (datum) {
      ctx.font = `${T.FONT * k}px Arial, sans-serif`;
      datumW = ctx.measureText(datum).width;
      ctx.fillStyle = '#d9d9d9';
      ctx.textAlign = 'right';
      ctx.fillText(datum, ix + iw - 5 * k, iy + headH / 2);
    }
    const defaultTitle = isAreas ? 'QUADRO DE ÁREAS E PERÍMETROS' : 'TABELA DE COORDENADAS E CONFRONTAÇÕES';
    const headerTitle = item.title || defaultTitle;
    ctx.font = `bold ${7 * k}px Arial, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(fitText(headerTitle, iw - 10 * k - datumW - (datum ? 6 * k : 0)), ix + 5 * k, iy + headH / 2);

    // Colunas
    const cols = baseCols.map((c, i) => ({ ...c, x0: ix + baseCols.slice(0, i).reduce((s, q) => s + q.pct * iw, 0), w: c.pct * iw }));
    const subY = iy + headH;
    ctx.fillStyle = '#e8ecef';
    ctx.fillRect(ix, subY, iw, subH);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = hair;
    ctx.beginPath();
    ctx.moveTo(ix, subY + subH);
    ctx.lineTo(ix + iw, subY + subH);
    cols.slice(0, -1).forEach(c => { ctx.moveTo(c.x0 + c.w, subY); ctx.lineTo(c.x0 + c.w, subY + subH); });
    ctx.stroke();
    ctx.fillStyle = '#111111';
    ctx.textAlign = 'center';
    ctx.font = `bold ${px}px Arial, sans-serif`;
    cols.forEach(c => ctx.fillText(fitText(c.label, c.w - pad * 2), c.x0 + c.w / 2, subY + subH / 2));

    // Linhas de vértices (todas as que cabem; o resto vira o aviso "+N")
    const rowsY = subY + subH;
    if (!data.vertices.length) {
      ctx.fillStyle = '#888888';
      ctx.font = `${px}px Arial, sans-serif`;
      ctx.fillText(fitText(isAreas ? 'Nenhuma feição medida na prancha' : 'Nenhum polígono selecionado', iw - pad * 2), ix + iw / 2, rowsY + rowH / 2);
    }
    data.vertices.slice(0, fit.shown).forEach((v, i) => {
      const ry = rowsY + rowH * i;
      if (i % 2 === 1) { ctx.fillStyle = '#f8f9fa'; ctx.fillRect(ix, ry, iw, rowH); }
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = hair;
      ctx.beginPath();
      ctx.moveTo(ix, ry + rowH);
      ctx.lineTo(ix + iw, ry + rowH);
      cols.slice(0, -1).forEach(c => { ctx.moveTo(c.x0 + c.w, ry); ctx.lineTo(c.x0 + c.w, ry + rowH); });
      ctx.stroke();
      cols.forEach(c => {
        const isName = c.key === 'name';
        ctx.font = isName ? `bold ${px}px Arial, sans-serif` : `${px}px monospace`;
        ctx.fillStyle = '#000000';
        ctx.fillText(fitText(String(v[c.key] ?? ''), c.w - pad * 2), c.x0 + c.w / 2, ry + rowH / 2);
      });
    });
    if (fit.hidden > 0) {
      const ry = rowsY + rowH * fit.shown;
      ctx.fillStyle = '#fff3cd';
      ctx.fillRect(ix, ry, iw, rowH);
      ctx.fillStyle = '#333333';
      ctx.font = `bold ${px}px Arial, sans-serif`;
      ctx.fillText(fitText(`… +${fit.hidden} vértice(s) não cabem: aumente a tabela (total: ${data.vertices.length})`, iw - pad * 2), ix + iw / 2, ry + rowH / 2);
    }

    // Rodapé: "Área: valor (ha)" à esquerda e "Perímetro: valor" à direita (rótulo normal, valor em negrito)
    if (showFooter && data.vertices.length > 0) {
      const foot = PrintItemsManager.verticesFooterParts(data);
      const fy = iy + ih - footH;
      ctx.fillStyle = '#eef2f5';
      ctx.fillRect(ix, fy, iw, footH);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = hair;
      ctx.beginPath();
      ctx.moveTo(ix, fy);
      ctx.lineTo(ix + iw, fy);
      ctx.stroke();

      const parts = (size) => {
        const width = (t, bold) => { ctx.font = `${bold ? 'bold ' : ''}${size}px Arial, sans-serif`; return ctx.measureText(t).width; };
        return {
          left: [[`Área${isAreas ? ' total' : ''}: `, false], [foot.area, true], [` ${foot.hectares}`, false]],
          right: [[`Perímetro${isAreas ? ' total' : ''}: `, false], [foot.perimeter, true]],
          width
        };
      };
      let size = T.FONT * k;
      let p = parts(size);
      const total = (p) => [...p.left, ...p.right].reduce((s, [t, b]) => s + p.width(t, b), 0) + 12 * k + 8 * k;
      while (total(p) > iw && size > T.FONT * k * 0.5) { size *= 0.94; p = parts(size); }
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      let cx = ix + 6 * k;
      p.left.forEach(([t, b]) => { ctx.font = `${b ? 'bold ' : ''}${size}px Arial, sans-serif`; ctx.fillText(t, cx, fy + footH / 2); cx += p.width(t, b); });
      cx = ix + iw - 6 * k - p.right.reduce((s, [t, b]) => s + p.width(t, b), 0);
      p.right.forEach(([t, b]) => { ctx.font = `${b ? 'bold ' : ''}${size}px Arial, sans-serif`; ctx.fillText(t, cx, fy + footH / 2); cx += p.width(t, b); });
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = bw;
    ctx.strokeRect(x + bw / 2, y + bw / 2, w - bw, h - bw);
    ctx.restore();
  }

  /**
   * Quebra linhas de um texto para caber dentro de maxWidth usando a métrica da fonte ativa em ctx
   */
  static wrapTextLines(ctx, text, maxWidth) {
    const paragraphs = String(text ?? '').split('\n');
    if (!(maxWidth > 0) || typeof ctx?.measureText !== 'function') return paragraphs;
    const out = [];
    for (const para of paragraphs) {
      if (!para) {
        out.push('');
        continue;
      }
      const words = para.split(/\s+/);
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(candidate).width > maxWidth) {
          out.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) out.push(line);
    }
    return out.length ? out : [''];
  }

  /**
   * Bloco de Notas Técnicas / Texto Livre. As medidas seguem o da tela (.cm-item-text-block): o
   * tamanho do texto é em px de tela a 100% (1 mm = 3,78 px), por isso tudo é multiplicado por k.
   */
  static drawTextBlockItem(ctx, item, x, y, w, h, composer, scaleFactor) {
    if (typeof composer === 'number') {
      scaleFactor = composer;
      composer = null;
    }
    const k = scaleFactor / PrintCanvasEngine.BASE_PX_PER_MM;
    const fs = (Number(item.fontSize) || 7.5) * k;
    const evalAtlas = (t) => (composer?.atlas?.enabled ? composer.atlas.evaluateExpressions(t) : t);
    const hasCustomStroke = item.strokeWidth != null && item.strokeWidth !== '';
    const border = item.showBorder === false ? 0 : (hasCustomStroke ? (Number(item.strokeWidth) || 0) : 1.5) * k;

    ctx.save();
    ctx.fillStyle = item.fillColor
      ? PrintItemsManager.sanitizeColor(item.fillColor, 'rgba(255, 255, 255, 0.98)')
      : 'rgba(255, 255, 255, 0.98)';
    ctx.fillRect(x, y, w, h);
    if (border > 0) {
      ctx.strokeStyle = item.strokeColor
        ? PrintItemsManager.sanitizeColor(item.strokeColor, '#000000')
        : '#000000';
      ctx.lineWidth = border;
      ctx.strokeRect(x + border / 2, y + border / 2, w - border, h - border);
    }

    if (typeof ctx.beginPath === 'function' && typeof ctx.rect === 'function' && typeof ctx.clip === 'function') {
      ctx.beginPath();
      ctx.rect(x + border, y + border, w - border * 2, h - border * 2);
      ctx.clip();
    }

    const left = x + border + 6 * k;
    const textW = Math.max(10, w - (border + 6 * k) * 2);
    const top = y + border + 4 * k;
    const bottom = y + h - border - 4 * k;
    const family = PrintItemsManager.fontStack(item);
    const showTitle = item.showTitle !== false;
    let first = top;

    if (showTitle) {
      const titleH = fs * 1.15;
      const hdrColor = item.headerColor ? PrintItemsManager.sanitizeColor(item.headerColor, '#000000') : '#000000';
      ctx.fillStyle = hdrColor;
      ctx.font = `bold ${fs}px ${family}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const titleText = evalAtlas(item.title || PrintItemsManager.TEXT_BLOCK_DEFAULT_TITLE);
      ctx.fillText(PrintTitleBlockRenderer.fit(ctx, titleText, textW), left, top + titleH / 2);
      const ruleY = top + titleH + 2 * k;
      ctx.strokeStyle = hdrColor;
      ctx.lineWidth = k;
      ctx.beginPath();
      ctx.moveTo(left, ruleY + k / 2);
      ctx.lineTo(left + textW, ruleY + k / 2);
      ctx.stroke();
      first = ruleY + k + 3 * k;
    }

    const cols = Number(item.columns) === 2 ? 2 : 1;
    const gap = cols > 1 ? 10 * k : 0;
    const colW = (textW - gap * (cols - 1)) / cols;
    const align = ['left', 'center', 'right', 'justify'].includes(item.textAlign) ? item.textAlign : 'left';
    const lineStep = fs * 1.35;
    ctx.fillStyle = item.textColor ? PrintItemsManager.sanitizeColor(item.textColor, '#000000') : '#000000';
    ctx.font = `${fs}px ${family}`;
    ctx.textBaseline = 'middle';
    const lines = this.wrapTextLines(ctx, evalAtlas(item.text || PrintItemsManager.TEXT_BLOCK_DEFAULT_TEXT), colW);
    const capPerCol = Math.max(1, Math.floor((bottom - first) / lineStep));
    const totalCap = capPerCol * cols;

    lines.slice(0, totalCap).forEach((line, i) => {
      const colIdx = Math.floor(i / capPerCol);
      const rowIdx = i % capPerCol;
      const cx0 = left + colIdx * (colW + gap);
      const cy = first + rowIdx * lineStep + lineStep / 2;
      const cut = lines.length > totalCap && i === totalCap - 1;
      const drawLine = cut ? PrintTitleBlockRenderer.fit(ctx, `${line} …`, colW) : line;
      if (align === 'center') {
        ctx.textAlign = 'center';
        ctx.fillText(drawLine, cx0 + colW / 2, cy);
      } else if (align === 'right') {
        ctx.textAlign = 'right';
        ctx.fillText(drawLine, cx0 + colW, cy);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(drawLine, cx0, cy);
      }
    });
    ctx.restore();
  }

  /**
   * Renderiza a Legenda Temática
   */
  static drawLegendItem(ctx, item, x, y, w, h, composer, scaleFactor) {
    // Mesmo desenho da tela (PrintLegendRenderer), na resolução da exportação
    ctx.save();
    ctx.translate(x, y);
    composer.drawCanvasItem(ctx, item, scaleFactor);
    ctx.restore();
  }

  /** Traça caminho de retângulo arredondado compatível com Canvas 2D e PdfVectorContext */
  static _traceRoundedRect(ctx, x, y, w, h, r) {
    const rad = Math.max(0, Math.min(r, w / 2, h / 2));
    if (rad <= 0 || typeof ctx.quadraticCurveTo !== 'function') {
      ctx.rect(x, y, w, h);
      return;
    }
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  /** Traça caminho de elipse com 4 curvas Bézier cúbicas (sem depender de ctx.ellipse) */
  static _traceEllipse(ctx, cx, cy, rx, ry) {
    if (typeof ctx.bezierCurveTo !== 'function') {
      ctx.arc(cx, cy, Math.min(rx, ry), 0, Math.PI * 2);
      return;
    }
    const ox = rx * 0.5522848;
    const oy = ry * 0.5522848;
    ctx.moveTo(cx - rx, cy);
    ctx.bezierCurveTo(cx - rx, cy - oy, cx - ox, cy - ry, cx, cy - ry);
    ctx.bezierCurveTo(cx + ox, cy - ry, cx + rx, cy - oy, cx + rx, cy);
    ctx.bezierCurveTo(cx + rx, cy + oy, cx + ox, cy + ry, cx, cy + ry);
    ctx.bezierCurveTo(cx - ox, cy + ry, cx - rx, cy + oy, cx - rx, cy);
    ctx.closePath();
  }

  /**
   * Renderiza Forma Geométrica / Moldura Técnica
   */
  static drawShapeItem(ctx, item, x, y, w, h, scaleFactor = PrintCanvasEngine.BASE_PX_PER_MM) {
    const k = (Number(scaleFactor) || PrintCanvasEngine.BASE_PX_PER_MM) / PrintCanvasEngine.BASE_PX_PER_MM;
    const fill = PrintItemsManager.sanitizeColor(item.fillColor, 'rgba(255, 255, 255, 0.5)');
    const stroke = PrintItemsManager.sanitizeColor(item.strokeColor, '#000000');
    const rawW = item.strokeWidth == null || item.strokeWidth === '' ? 1.5 : (Number(item.strokeWidth) || 0);
    const lw = rawW * k;
    const shapeType = item.shapeType || 'rect';
    const strokeStyle = item.strokeStyle || 'solid';
    const radius = (Number(item.borderRadius) || (shapeType === 'rounded_rect' ? 8 : 0)) * k;
    const rot = Number(item.rotation) || 0;

    ctx.save();
    if (rot) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }

    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;

    if (shapeType === 'rect' && strokeStyle === 'solid' && radius <= 0 && !rot) {
      ctx.fillRect(x, y, w, h);
      if (lw > 0) ctx.strokeRect(x, y, w, h);
      ctx.restore();
      return;
    }

    const dash = PrintItemsManager.strokeDashArray(strokeStyle, lw);
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash(dash);

    if (shapeType === 'rect' || shapeType === 'rounded_rect' || shapeType === 'double_frame') {
      ctx.beginPath();
      this._traceRoundedRect(ctx, x, y, w, h, radius);
      ctx.fill();
      if (lw > 0) ctx.stroke();
      if (shapeType === 'double_frame' && lw > 0) {
        const gap = Math.max(2 * k, lw * 2);
        const ix = x + gap;
        const iy = y + gap;
        const iw = w - gap * 2;
        const ih = h - gap * 2;
        if (iw > 2 && ih > 2) {
          ctx.beginPath();
          ctx.lineWidth = Math.max(0.75 * k, lw * 0.55);
          this._traceRoundedRect(ctx, ix, iy, iw, ih, Math.max(0, radius - gap));
          ctx.stroke();
        }
      }
    } else if (shapeType === 'ellipse') {
      ctx.beginPath();
      this._traceEllipse(ctx, x + w / 2, y + h / 2, Math.max(1, (w - lw) / 2), Math.max(1, (h - lw) / 2));
      ctx.fill();
      if (lw > 0) ctx.stroke();
    } else if (shapeType === 'triangle' || shapeType === 'diamond') {
      const pad = Math.max(1, lw);
      const pts = shapeType === 'triangle'
        ? [[x + w / 2, y + pad], [x + w - pad, y + h - pad], [x + pad, y + h - pad]]
        : [[x + w / 2, y + pad], [x + w - pad, y + h / 2], [x + w / 2, y + h - pad], [x + pad, y + h / 2]];
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.closePath();
      ctx.fill();
      if (lw > 0) ctx.stroke();
    } else if (shapeType === 'line_h' || shapeType === 'line_v' || shapeType === 'line_diag') {
      const pad = Math.max(1, lw);
      const [x1, y1, x2, y2] = shapeType === 'line_h'
        ? [x + pad, y + h / 2, x + w - pad, y + h / 2]
        : shapeType === 'line_v'
          ? [x + w / 2, y + pad, x + w / 2, y + h - pad]
          : [x + pad, y + h - pad, x + w - pad, y + pad];
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      if (lw > 0) ctx.stroke();
    } else if (shapeType === 'arrow') {
      const pad = Math.max(1, lw);
      const head = Math.min(Math.min(w, h) * 0.45, Math.max(8 * k, lw * 4.5));
      const cy = y + h / 2;
      const x1 = x + pad;
      const x2 = Math.max(x1 + head + 2, x + w - pad);
      const wingY = Math.min((h / 2) - pad * 0.5, head * 0.65);
      ctx.beginPath();
      ctx.moveTo(x1, cy);
      ctx.lineTo(x2 - head * 0.6, cy);
      if (lw > 0) ctx.stroke();
      if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);
      ctx.fillStyle = stroke;
      ctx.beginPath();
      ctx.moveTo(x2, cy);
      ctx.lineTo(x2 - head, cy - wingY);
      ctx.lineTo(x2 - head, cy + wingY);
      ctx.closePath();
      ctx.fill();
      if (item.arrowHead === 'both') {
        ctx.beginPath();
        ctx.moveTo(x1, cy);
        ctx.lineTo(x1 + head, cy - wingY);
        ctx.lineTo(x1 + head, cy + wingY);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Renderiza Imagem / Logotipo em Alta Resolução respeitando objectFit ('contain' ou 'cover')
   */
  static async drawImageItem(ctx, item, x, y, w, h, scaleFactor = PrintCanvasEngine.BASE_PX_PER_MM) {
    if (!item.imageUrl) return;
    const k = (Number(scaleFactor) || PrintCanvasEngine.BASE_PX_PER_MM) / PrintCanvasEngine.BASE_PX_PER_MM;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const iw = img.naturalWidth || img.width || w;
          const ih = img.naturalHeight || img.height || h;
          const fit = item.objectFit === 'cover' ? 'cover' : 'contain';
          let dx = x, dy = y, dw = w, dh = h;
          if (iw > 0 && ih > 0 && w > 0 && h > 0) {
            const scale = fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
            dw = iw * scale;
            dh = ih * scale;
            dx = x + (w - dw) / 2;
            dy = y + (h - dh) / 2;
          }
          ctx.save();
          const rot = Number(item.rotation) || 0;
          if (rot) {
            ctx.translate(x + w / 2, y + h / 2);
            ctx.rotate((rot * Math.PI) / 180);
            ctx.translate(-(x + w / 2), -(y + h / 2));
          }
          if (item.opacity != null && 'globalAlpha' in ctx) {
            ctx.globalAlpha = Math.min(1, Math.max(0.05, Number(item.opacity) || 1));
          }
          if (fit === 'cover' && typeof ctx.beginPath === 'function' && typeof ctx.rect === 'function' && typeof ctx.clip === 'function') {
            ctx.beginPath();
            ctx.rect(x, y, w, h);
            ctx.clip();
          }
          ctx.drawImage(img, dx, dy, dw, dh);
          const strokeW = (Number(item.strokeWidth) || 0) * k;
          if (strokeW > 0) {
            ctx.strokeStyle = PrintItemsManager.sanitizeColor(item.strokeColor, '#000000');
            ctx.lineWidth = strokeW;
            ctx.strokeRect(x + strokeW / 2, y + strokeW / 2, w - strokeW, h - strokeW);
          }
          ctx.restore();
        } catch (e) {}
        resolve();
      };
      img.onerror = () => resolve();
      img.src = item.imageUrl;
    });
  }

  /**
   * Rótulo de Texto Livre / Título Customizado. Mesmas regras da tela (.cm-item-label-box): tamanho em
   * px de tela a 100% (× k), recuo de 2 px, linha a 1,15, quebra por palavras, fundo/borda/rotação opcionais.
   */
  static drawLabelItem(ctx, item, x, y, w, h, composer, scaleFactor) {
    if (typeof composer === 'number') {
      scaleFactor = composer;
      composer = null;
    }
    const k = scaleFactor / PrintCanvasEngine.BASE_PX_PER_MM;

    ctx.save();
    const rot = Number(item.rotation) || 0;
    if (rot) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    if (item.fillColor) {
      ctx.fillStyle = PrintItemsManager.sanitizeColor(item.fillColor, 'transparent');
      ctx.fillRect(x, y, w, h);
    }
    const strokeW = (Number(item.strokeWidth) || 0) * k;
    if (strokeW > 0) {
      ctx.strokeStyle = PrintItemsManager.sanitizeColor(item.strokeColor, '#000000');
      ctx.lineWidth = strokeW;
      ctx.strokeRect(x + strokeW / 2, y + strokeW / 2, w - strokeW, h - strokeW);
    }
    if (typeof ctx.beginPath === 'function' && typeof ctx.rect === 'function' && typeof ctx.clip === 'function') {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
    }
    const fontSize = (Number(item.fontSize) || 10) * k;
    const style = item.fontStyle === 'italic' ? 'italic ' : '';
    const weight = item.fontWeight === 'normal' ? 'normal' : 'bold';
    ctx.font = `${style}${weight} ${fontSize}px ${PrintItemsManager.fontStack(item)}`;
    ctx.fillStyle = PrintItemsManager.sanitizeColor(item.textColor, '#000000');
    const align = ['left', 'right'].includes(item.textAlign) ? item.textAlign : 'center';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const pad = 3 * k;
    const textX = align === 'center' ? x + w / 2 : (align === 'right' ? x + w - pad : x + pad);
    const rawBase = item.text || PrintItemsManager.LABEL_DEFAULT_TEXT;
    const rawEval = composer?.atlas?.enabled ? composer.atlas.evaluateExpressions(rawBase) : rawBase;
    const evaluatedText = item.textTransform === 'uppercase'
      ? rawEval.toUpperCase()
      : (item.textTransform === 'lowercase' ? rawEval.toLowerCase() : rawEval);
    const lines = this.wrapTextLines(ctx, evaluatedText, Math.max(10, w - pad * 2));
    const lineStep = fontSize * 1.25;
    const vAlign = item.verticalAlign === 'top' ? 'top' : (item.verticalAlign === 'bottom' ? 'bottom' : 'middle');
    const startY = vAlign === 'top'
      ? y + pad + lineStep / 2
      : (vAlign === 'bottom' ? y + h - pad - (lines.length - 0.5) * lineStep : y + h / 2 - ((lines.length - 1) * lineStep) / 2);
    const ls = (Number(item.letterSpacing) || 0) * k;

    lines.forEach((line, idx) => {
      const ly = startY + idx * lineStep;
      if (ls > 0 && line.length > 1) {
        const chars = Array.from(line);
        const totalW = chars.reduce((s, ch) => s + ctx.measureText(ch).width, 0) + ls * (chars.length - 1);
        let cx = align === 'center' ? textX - totalW / 2 : (align === 'right' ? textX - totalW : textX);
        ctx.textAlign = 'left';
        chars.forEach(ch => {
          ctx.fillText(ch, cx, ly);
          cx += ctx.measureText(ch).width + ls;
        });
        ctx.textAlign = align;
      } else {
        ctx.fillText(line, textX, ly);
      }
    });
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
      const sheets = composer.sheetsManager.sheets.slice();
      // Estado da tela para voltar depois (sem perder o histórico de desfazer)
      const restore = {
        paperSize: composer.paperSize,
        showAbntMargins: composer.showAbntMargins,
        items: JSON.parse(JSON.stringify(composer.items || [])),
        selectedItemId: composer.selectedItemId
      };

      const progress = notifyProgress({
        titulo: 'Gerando Caderno de Pranchas',
        mensagem: `Processando ${sheets.length} pranchas em PDF técnico...`
      });

      let pdf = null;
      composer.exporting = true;
      composer.selectItem?.(null);

      try {
        for (let i = 0; i < sheets.length; i++) {
          const sh = sheets[i];
          // Cada prancha é montada de verdade: mapas com o enquadramento, a escala e a vista dela
          await composer.mountSheetForExport(sh);

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

          // Mesma página vetorial do PDF de uma prancha
          await this.renderSheetToPdfPage(pdf, composer, dpi);
        }
      } finally {
        progress.done();
        // Volta a prancha que estava aberta
        composer.paperSize = restore.paperSize;
        composer.showAbntMargins = restore.showAbntMargins;
        composer.items = restore.items;
        composer.updatePaperSheetDOM();
        composer.renderAllItems();
        composer.exporting = false;
        if (restore.selectedItemId) composer.selectItem(restore.selectedItemId);
        else composer.updatePropertiesPanel();
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
