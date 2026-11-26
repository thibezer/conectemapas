/* ==========================================================================
   ConecteMapas - MeasureHUD Component (SRP Encapsulated)
   Painel flutuante padrão GIS para medições efêmeras (sem sujar o desenho).
   ========================================================================== */

if (typeof document !== 'undefined') {
  import('./MeasureHUD.css').catch(() => {});
}

import { UIToast } from '@thibezer/ui-components-kit';

export class MeasureHUD {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container
   * @param {(mode: 'distance'|'area') => void} [options.onModeChange]
   * @param {() => void} [options.onClear]
   * @param {() => void} [options.onClose]
   * @param {(measurement: Object) => void} [options.onSaveAsFeature]
   */
  constructor(options = {}) {
    this.container = options.container || (typeof document !== 'undefined' ? document.body : null);
    this.onModeChange = options.onModeChange || (() => {});
    this.onClear = options.onClear || (() => {});
    this.onClose = options.onClose || (() => {});
    this.onSaveAsFeature = options.onSaveAsFeature || (() => {});

    this.mode = 'distance'; // 'distance' | 'area'
    this.unitMode = 'auto'; // 'auto' | 'metric-m' | 'metric-km'
    this.measurement = null;
    this.showSegments = false;
    this.isVisible = false;
    this.el = null;
  }

  show(mode = this.mode) {
    this.mode = mode === 'area' ? 'area' : 'distance';
    this.isVisible = true;
    this._ensureEl();
    this.el.style.display = 'block';
    this._render();
  }

  hide() {
    this.isVisible = false;
    this.measurement = null;
    this.showSegments = false;
    if (this.el) {
      this.el.style.display = 'none';
    }
  }

  setMode(mode) {
    const next = mode === 'area' ? 'area' : 'distance';
    if (this.mode !== next) {
      this.mode = next;
      this.measurement = null;
      this.showSegments = false;
    }
    if (this.isVisible) this._render();
  }

  setMeasurement(data) {
    this.measurement = data || null;
    if (data?.mode) {
      this.mode = data.mode === 'area' ? 'area' : 'distance';
    }
    if (!this.isVisible) {
      this.isVisible = true;
      this._ensureEl();
      this.el.style.display = 'block';
    }
    this._render();
  }

  clearResult() {
    this.measurement = null;
    this.showSegments = false;
    if (this.isVisible) this._render();
  }

  _ensureEl() {
    if (this.el || !this.container) return;
    this.el = document.createElement('div');
    this.el.className = 'cm-measure-hud';
    this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-label', 'Régua de Medição GIS');
    this.container.appendChild(this.el);
  }

  _fmtDist(meters) {
    const m = Number(meters) || 0;
    if (this.unitMode === 'metric-m') {
      return `${m.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
    }
    if (this.unitMode === 'metric-km') {
      return `${(m / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} km`;
    }
    if (m >= 1000) {
      return `${(m / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} km`;
    }
    return `${m.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m`;
  }

  _fmtArea(m2) {
    const v = Number(m2) || 0;
    if (this.unitMode === 'metric-m') {
      return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²`;
    }
    if (this.unitMode === 'metric-km') {
      if (v >= 1000000) {
        return `${(v / 1000000).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} km²`;
      }
      return `${(v / 10000).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ha`;
    }
    if (v >= 10000) {
      return `${(v / 10000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ha`;
    }
    return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²`;
  }

  _fmtAreaSub(m2) {
    const v = Number(m2) || 0;
    if (v <= 0) return '';
    if (this.unitMode === 'metric-m' || v < 10000) {
      return `${(v / 10000).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ha`;
    }
    return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} m²`;
  }

  _buildSummaryText() {
    const m = this.measurement;
    if (!m) return '';
    const lines = [];
    if (m.mode === 'area') {
      lines.push(`Área: ${this._fmtArea(m.areaM2)}`);
      lines.push(`Perímetro: ${this._fmtDist(m.perimeterM)}`);
    } else {
      lines.push(`Distância Total: ${this._fmtDist(m.lengthM)}`);
      if (m.areaM2 > 0) {
        lines.push(`Área Delimitada: ${this._fmtArea(m.areaM2)}`);
      }
    }
    if (Array.isArray(m.segments) && m.segments.length > 0) {
      lines.push('Trechos:');
      m.segments.forEach((s, idx) => {
        lines.push(`  T${idx + 1}: ${this._fmtDist(s.distance)} (Az ${Number(s.bearing).toFixed(1)}°)`);
      });
    }
    return lines.join('\n');
  }

  _render() {
    if (!this.el) return;
    const m = this.measurement;
    const isArea = this.mode === 'area';
    const hasResult = Boolean(m && Array.isArray(m.coords) && m.coords.length >= 2);
    const segments = hasResult && Array.isArray(m.segments) ? m.segments : [];

    const summaryHtml = !hasResult
      ? `<span class="cm-measure-hint">Clique no mapa para medir (${isArea ? 'mín. 3 pontos' : 'mín. 2 pontos'})</span>`
      : isArea
        ? `
          <span class="cm-measure-stat">
            <span class="cm-measure-stat-lbl">Área</span>
            <span class="cm-measure-stat-val">${this._fmtArea(m.areaM2)}</span>
          </span>
          <span class="cm-measure-stat">
            <span class="cm-measure-stat-lbl">Perím.</span>
            <span class="cm-measure-stat-val">${this._fmtDist(m.perimeterM)}</span>
          </span>
        `
        : `
          <span class="cm-measure-stat">
            <span class="cm-measure-stat-lbl">Dist.</span>
            <span class="cm-measure-stat-val">${this._fmtDist(m.lengthM)}</span>
          </span>
          ${m.areaM2 > 0 ? `
            <span class="cm-measure-stat">
              <span class="cm-measure-stat-lbl">Área</span>
              <span class="cm-measure-stat-val">${this._fmtArea(m.areaM2)}</span>
            </span>
          ` : ''}
        `;

    this.el.innerHTML = `
      <div class="cm-measure-bar">
        <div class="cm-measure-segmented" role="group" aria-label="Modo de medição">
          <button type="button" class="cm-measure-seg-btn ${!isArea ? 'is-active' : ''}" data-mode="distance">Distância</button>
          <button type="button" class="cm-measure-seg-btn ${isArea ? 'is-active' : ''}" data-mode="area">Área</button>
        </div>
        <span class="cm-measure-sep"></span>
        <div class="cm-measure-summary">${summaryHtml}</div>
        <span class="cm-measure-sep"></span>
        <select class="cm-measure-unit-select" aria-label="Unidade de medida" data-action="unit">
          <option value="auto" ${this.unitMode === 'auto' ? 'selected' : ''}>Auto</option>
          <option value="metric-m" ${this.unitMode === 'metric-m' ? 'selected' : ''}>m / m²</option>
          <option value="metric-km" ${this.unitMode === 'metric-km' ? 'selected' : ''}>km / ha</option>
        </select>
        <div class="cm-measure-actions">
          ${segments.length > 0 ? `<button type="button" class="cm-measure-btn" data-action="toggle-segments" title="Ver trechos e azimutes">${segments.length}T ${this.showSegments ? '▲' : '▼'}</button>` : ''}
          <button type="button" class="cm-measure-btn" data-action="clear" ${!hasResult ? 'disabled' : ''} title="Limpar medição">Limpar</button>
          <button type="button" class="cm-measure-btn" data-action="copy" ${!hasResult ? 'disabled' : ''} title="Copiar resumo">Copiar</button>
          <button type="button" class="cm-measure-btn cm-measure-btn--primary" data-action="save" ${!hasResult ? 'disabled' : ''} title="Converter em feição permanente">Salvar</button>
          <button type="button" class="cm-measure-close" data-action="close" title="Fechar régua (Esc)" aria-label="Fechar régua">&times;</button>
        </div>
      </div>
      ${this.showSegments && segments.length > 0 ? `
        <div class="cm-measure-popover">
          ${segments.map((s, idx) => `
            <div class="cm-measure-segment-row">
              <span class="cm-measure-segment-idx">T${idx + 1}</span>
              <span class="cm-measure-segment-dist">${this._fmtDist(s.distance)}</span>
              <span class="cm-measure-segment-az">Az ${Number(s.bearing).toFixed(1)}°</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    this._bindEvents();
  }

  _bindEvents() {
    if (!this.el) return;
    this.el.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const nextMode = btn.getAttribute('data-mode');
        if (nextMode && nextMode !== this.mode) {
          this.setMode(nextMode);
          this.onModeChange(nextMode);
        }
      });
    });

    const unitSelect = this.el.querySelector('[data-action="unit"]');
    unitSelect?.addEventListener('change', (e) => {
      this.unitMode = e.target.value || 'auto';
      this._render();
    });

    this.el.querySelector('[data-action="toggle-segments"]')?.addEventListener('click', () => {
      this.showSegments = !this.showSegments;
      this._render();
    });

    this.el.querySelector('[data-action="clear"]')?.addEventListener('click', () => {
      this.clearResult();
      this.onClear();
    });

    this.el.querySelector('[data-action="copy"]')?.addEventListener('click', async () => {
      const txt = this._buildSummaryText();
      if (!txt) return;
      try {
        await navigator.clipboard.writeText(txt);
        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Medição copiada',
          mensagem: 'Resumo copiado para a área de transferência.',
          duracao: 1800
        });
      } catch {
        UIToast.notificar({
          tipo: 'alerta',
          titulo: 'Não foi possível copiar',
          mensagem: 'Permissão de área de transferência indisponível.',
          duracao: 2200
        });
      }
    });

    this.el.querySelector('[data-action="save"]')?.addEventListener('click', () => {
      if (!this.measurement) return;
      this.onSaveAsFeature(this.measurement);
    });

    this.el.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      this.hide();
      this.onClose();
    });
  }
}
