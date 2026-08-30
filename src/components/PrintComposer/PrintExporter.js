/* ==========================================================================
   ConecteMapas - PrintExporter
   Responsabilidade Única: Renderização em alta resolução (300 DPI / 150 DPI),
   captura integral de tiles de satélite/vetores e geração real de PDF via jsPDF.
   ========================================================================== */

import { jsPDF } from 'jspdf';
import { UIToast } from 'ui-components-kit';

export class PrintExporter {
  static async exportToPNG(composer, dpi = 300) {
    try {
      UIToast.notificar({
        tipo: 'informativo',
        titulo: 'Gerando Imagem',
        mensagem: `Renderizando prancha em ${dpi} DPI com satélite e vetores...`,
        duracao: 3500
      });

      const canvas = await this.renderSheetToCanvas(composer, dpi);
      if (!canvas) return;

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const fileName = `${composer.projectName.toLowerCase().replace(/\s+/g, '_')}_prancha_${dpi}dpi.png`;
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);

        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Exportação Concluída',
          mensagem: `Imagem ${fileName} baixada com sucesso!`,
          duracao: 4000
        });
      }, 'image/png');
    } catch (err) {
      console.error('Erro na exportação de imagem:', err);
      UIToast.notificar({
        tipo: 'erro',
        titulo: 'Falha na Exportação',
        mensagem: err.message || 'Erro ao gerar imagem.',
        duracao: 4000
      });
    }
  }

  static async exportToPDF(composer, dpi = 300) {
    try {
      UIToast.notificar({
        tipo: 'informativo',
        titulo: 'Gerando PDF Técnico',
        mensagem: 'Processando prancha cartográfica em escala 1:1 via jsPDF...',
        duracao: 3500
      });

      const canvas = await this.renderSheetToCanvas(composer, dpi);
      if (!canvas) return;

      const wMm = composer.paperSize.width;
      const hMm = composer.paperSize.height;
      const isLandscape = wMm > hMm;

      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [wMm, hMm]
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);

      const fileName = `${composer.projectName.toLowerCase().replace(/\s+/g, '_')}_prancha.pdf`;
      pdf.save(fileName);

      UIToast.notificar({
        tipo: 'sucesso',
        titulo: 'PDF Gerado com Sucesso',
        mensagem: `Arquivo ${fileName} gravado com dimensões milimétricas exatas.`,
        duracao: 4000
      });
    } catch (err) {
      console.error('Erro na exportação para PDF:', err);
      UIToast.notificar({
        tipo: 'erro',
        titulo: 'Falha no PDF',
        mensagem: err.message || 'Erro ao gerar arquivo PDF.',
        duracao: 4000
      });
    }
  }

  static async renderSheetToCanvas(composer, dpi = 300) {
    const scaleFactor = dpi / 25.4;
    const wPx = Math.round(composer.paperSize.width * scaleFactor);
    const hPx = Math.round(composer.paperSize.height * scaleFactor);

    const canvas = document.createElement('canvas');
    canvas.width = wPx;
    canvas.height = hPx;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, wPx, hPx);

    for (const item of composer.items) {
      if (item.visible === false) continue;

      const x = Math.round(item.x * scaleFactor);
      const y = Math.round(item.y * scaleFactor);
      const w = Math.round(item.width * scaleFactor);
      const h = Math.round(item.height * scaleFactor);

      if (item.type === 'map' || item.type === 'inset_map') {
        await this.drawMapItem(ctx, item, x, y, w, h, composer, scaleFactor);
      } else if (item.type === 'north_arrow') {
        this.drawNorthArrowItem(ctx, item, x, y, w, h);
      } else if (item.type === 'scale_bar') {
        this.drawScaleBarItem(ctx, item, x, y, w, h);
      } else if (item.type === 'title_block') {
        this.drawTitleBlockItem(ctx, item, x, y, w, h, composer);
      } else if (item.type === 'legend') {
        this.drawLegendItem(ctx, item, x, y, w, h, composer);
      }
    }

    return canvas;
  }

  static async drawMapItem(ctx, item, x, y, w, h, composer, scaleFactor) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.fillStyle = '#e8ecef';
    ctx.fillRect(x, y, w, h);

    const domEl = document.getElementById(`leaf-map-${item.id}`);
    if (domEl) {
      const mapRect = domEl.getBoundingClientRect();
      const scaleX = w / mapRect.width;
      const scaleY = h / mapRect.height;

      // 1. Renderiza os tiles de imagem do satélite/base
      const tiles = domEl.querySelectorAll('.leaflet-tile-pane img');
      tiles.forEach((img) => {
        if (!img.complete || img.naturalWidth === 0) return;
        const imgRect = img.getBoundingClientRect();
        const destX = x + (imgRect.left - mapRect.left) * scaleX;
        const destY = y + (imgRect.top - mapRect.top) * scaleY;
        const destW = imgRect.width * scaleX;
        const destH = imgRect.height * scaleY;

        try {
          ctx.drawImage(img, destX, destY, destW, destH);
        } catch (e) { /* ignora se bloqueado por CORS */ }
      });

      // 2. Renderiza camada de overlay canvas se presente
      const overlayCanvases = domEl.querySelectorAll('.leaflet-overlay-pane canvas');
      overlayCanvases.forEach((c) => {
        const cRect = c.getBoundingClientRect();
        const destX = x + (cRect.left - mapRect.left) * scaleX;
        const destY = y + (cRect.top - mapRect.top) * scaleY;
        const destW = cRect.width * scaleX;
        const destH = cRect.height * scaleY;
        try {
          ctx.drawImage(c, destX, destY, destW, destH);
        } catch (e) { /* ignore */ }
      });
    }

    ctx.restore();

    // Moldura do Mapa
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Grade de coordenadas
    if (item.showGrid) {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 4]);
      for (let gx = x + w * 0.25; gx < x + w; gx += w * 0.25) {
        ctx.beginPath();
        ctx.moveTo(gx, y);
        ctx.lineTo(gx, y + h);
        ctx.stroke();
      }
      for (let gy = y + h * 0.25; gy < y + h; gy += h * 0.25) {
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.lineTo(x + w, gy);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  static drawNorthArrowItem(ctx, item, x, y, w, h) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(((item.rotation || 0) * Math.PI) / 180);

    const r = Math.min(w, h) / 2;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.9);
    ctx.lineTo(r * 0.25, r * 0.2);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.9);
    ctx.lineTo(-r * 0.25, r * 0.2);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000';
    ctx.font = `bold ${Math.round(r * 0.35)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, -r * 0.4);

    ctx.restore();
  }

  static drawScaleBarItem(ctx, item, x, y, w, h) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    const scaleNum = item.scale || 10000;
    ctx.fillStyle = '#000';
    ctx.font = `bold ${Math.round(h * 0.22)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`Escala 1:${scaleNum.toLocaleString('pt-BR')}`, x + w / 2, y + h * 0.3);

    const barY = y + h * 0.5;
    const barH = h * 0.2;
    const segW = (w * 0.8) / 4;
    const barX = x + w * 0.1;

    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#000' : '#fff';
      ctx.fillRect(barX + i * segW, barY, segW, barH);
      ctx.strokeRect(barX + i * segW, barY, segW, barH);
    }
  }

  static drawTitleBlockItem(ctx, item, x, y, w, h, composer) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    const headH = h * 0.22;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, w, headH);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(headH * 0.55)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(item.properties?.headerTitle || 'PLANTA TOPOGRÁFICA', x + w / 2, y + headH * 0.7);

    const p = item.properties || {};
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${Math.round(h * 0.11)}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`Projeto: ${p.projectName || composer.projectName}`, x + 6, y + headH + h * 0.18);
    ctx.fillText(`Resp: ${p.author || 'Eng. Cartógrafo'} | ART: ${p.art || 'CREA-BR'}`, x + 6, y + headH + h * 0.38);
    ctx.fillText(`Datum: ${p.datum || 'SIRGAS 2000'} | Escala: ${p.scaleText || '1:10.000'}`, x + 6, y + headH + h * 0.58);
    ctx.fillText(`Local: ${p.location || 'Brasil'} | Data: ${p.date || new Date().toLocaleDateString('pt-BR')}`, x + 6, y + headH + h * 0.78);
  }

  static drawLegendItem(ctx, item, x, y, w, h, composer) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#000';
    ctx.font = `bold ${Math.round(h * 0.16)}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('LEGENDA', x + 8, y + h * 0.2);

    const visibleLayers = composer.layers.filter(l => l.visible !== false);
    const rowStep = Math.min(22, (h * 0.75) / Math.max(1, visibleLayers.length));
    let rowY = y + h * 0.38;

    for (const layer of visibleLayers) {
      if (rowY > y + h - 10) break;
      ctx.fillStyle = layer.color || '#00E08A';
      ctx.fillRect(x + 8, rowY - 8, 10, 10);
      ctx.strokeRect(x + 8, rowY - 8, 10, 10);

      ctx.fillStyle = '#000';
      ctx.font = `${Math.round(Math.min(12, rowStep * 0.7))}px Arial, sans-serif`;
      ctx.fillText(layer.name, x + 24, rowY);
      rowY += rowStep;
    }
  }
}
