/* ==========================================================================
   ConecteMapas - AttributeTable Component
   Tabela de Atributos Densos em <ui-tabela densidade="compacta"> com busca
   e Virtualização de Viewport / Paginação de Alta Performance (P2).
   Mantém a árvore DOM enxuta (< 400 nós) mesmo com 100.000 feições no projeto.
   ========================================================================== */

export class AttributeTable {
  constructor(options = {}) {
    this.features = options.features || [];
    this.layers = options.layers || [];
    this.isCollapsed = true;
    this.searchQuery = '';
    this.pageSize = 50; // Janela ideal de alta densidade sem sobrecarga de DOM
    this.currentPage = 1;

    const rawSelect = options.onRowClick || options.onSelect || (() => {});
    this.onRowClick = (feat) => {
      if (!feat) return;
      rawSelect(feat.id, feat);
    };
    this.onDelete = options.onDelete || (() => {});
  }

  render(container) {
    container.innerHTML = `
      <div class="cm-bottom-table-container ${this.isCollapsed ? 'collapsed' : ''}" id="cm-bottom-table-wrapper" style="height: 290px;">
        <div class="cm-bottom-table-bar" id="cm-bottom-table-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span id="cm-attribute-table-title" style="font-size: 12px; font-weight: 600; color: var(--cm-text); line-height: 1;">
              📊 Tabela de Atributos & Geometrias (${this.features.length})
            </span>
            <span id="cm-attribute-table-subtitle" style="font-size: 10.5px; color: var(--cm-text-muted); line-height: 1;">
              Clique na barra para ${this.isCollapsed ? 'expandir' : 'recolher'}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;" onclick="event.stopPropagation()">
            <!-- Controles de Paginação Virtualizada (P2) -->
            <div id="cm-table-pagination-controls" style="display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.12); height: 24px; box-sizing: border-box;">
              <button id="cm-btn-prev-page" title="Página anterior" style="background: transparent; border: none; color: var(--cm-text); cursor: pointer; font-size: 10px; padding: 0 4px; line-height: 1;">◀</button>
              <span id="cm-table-page-indicator" style="font-size: 11px; color: var(--cm-text-muted); font-variant-numeric: tabular-nums; min-width: 65px; text-align: center; line-height: 1;">Pág. 1 / 1</span>
              <button id="cm-btn-next-page" title="Próxima página" style="background: transparent; border: none; color: var(--cm-text); cursor: pointer; font-size: 10px; padding: 0 4px; line-height: 1;">▶</button>
            </div>

            <ui-campo-texto 
              id="cm-table-search-input" 
              placeholder="Buscar feição... (Ctrl+K)" 
              style="width: 210px; --ui-campo-altura: 24px; --ui-altura-minima: 24px; margin-bottom: 0;">
            </ui-campo-texto>

            <button id="cm-btn-toggle-table" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: var(--cm-text); cursor: pointer; font-size: 11px; font-weight: 500; padding: 3px 8px; height: 24px; display: inline-flex; align-items: center; gap: 4px;">
              ${this.isCollapsed ? '▲ Expandir' : '▼ Recolher'}
            </button>
          </div>
        </div>

        <div class="cm-bottom-table-content" id="cm-bottom-table-body" style="display: ${this.isCollapsed ? 'none' : 'block'}; height: calc(100% - 34px);">
          <ui-tabela densidade="compacta" id="cm-attribute-ui-table" style="width: 100%; height: 100%;"></ui-tabela>
        </div>
      </div>
    `;

    this.bindEvents(container);
    this.updateTableData();
  }

  updateData(features, layers) {
    this.features = features || [];
    this.layers = layers || [];
    this.updateTableData();
  }

  updateTableData() {
    const totalCount = this.features.length;

    // Se estiver recolhida, evita trabalho computacional e mutações de DOM desnecessárias
    if (this.isCollapsed) {
      const titleEl = document.getElementById('cm-attribute-table-title');
      if (titleEl) {
        titleEl.textContent = `📊 Tabela de Atributos & Geometrias (${totalCount.toLocaleString('pt-BR')})`;
      }
      return;
    }

    const tableEl = document.getElementById('cm-attribute-ui-table');
    if (!tableEl) return;

    const layerMap = new Map(this.layers.map(l => [l.id, l.name]));

    // Filtra dados pela busca
    const filtered = this.features.filter(f => {
      if (!this.searchQuery) return true;
      const q = this.searchQuery.toLowerCase();
      return (
        f.name?.toLowerCase().includes(q) ||
        f.category?.toLowerCase().includes(q) ||
        f.type?.toLowerCase().includes(q) ||
        f.createdBy?.toLowerCase().includes(q)
      );
    });

    const totalFiltered = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / this.pageSize));
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, totalFiltered);
    const visibleData = filtered.slice(startIndex, endIndex);

    const columns = [
      { id: 'tipo', rotulo: 'Tipo', ordenavel: true, largura: '110px' },
      { id: 'nome', rotulo: 'Nome da Feição', ordenavel: true, largura: '220px' },
      { id: 'camada', rotulo: 'Camada', ordenavel: true, largura: '160px' },
      { id: 'dimensao', rotulo: 'Dimensão / Coordenadas', largura: '180px' },
      { id: 'categoria', rotulo: 'Categoria', largura: '120px' },
      { id: 'autor', rotulo: 'Autor', ordenavel: true, largura: '110px' },
      { id: 'data', rotulo: 'Criado em', largura: '110px' }
    ];

    const TYPE_LABELS = {
      Point: '📍 Ponto',
      LineString: '📏 Linha',
      Polygon: '⬡ Polígono',
      Circle: '⭕ Círculo',
      Text: '🔤 Texto'
    };

    const rows = visibleData.map(f => {
      let dim = '';
      if (f.type === 'Point') {
        const coords = f.coordinates;
        const lat = Array.isArray(coords) ? coords[0] : coords?.lat;
        const lng = Array.isArray(coords) ? coords[1] : coords?.lng;
        dim = (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) 
          ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` 
          : '-';
      } else if (f.type === 'LineString') {
        const segs = Array.isArray(f.coordinates) ? f.coordinates.length : 0;
        dim = f.properties?.['Extensão'] || f.properties?.extensao || `${segs} nós`;
      } else if (f.type === 'Polygon') {
        const segs = Array.isArray(f.coordinates) ? f.coordinates.length : 0;
        dim = f.properties?.['Área (ha)'] || f.properties?.areaCalculada || `${segs} nós`;
      } else if (f.type === 'Circle') {
        dim = `Raio: ${f.radius || 500}m`;
      } else if (f.type === 'Text') {
        dim = f.properties?.text || f.name || 'Rótulo';
      }

      const tipoFormatado = TYPE_LABELS[f.type] || f.type || 'Feição';

      return {
        id: f.id,
        tipo: f.locked ? `🔒 ${tipoFormatado}` : tipoFormatado,
        nome: f.name || 'Sem nome',
        camada: layerMap.get(f.layerId) || 'Padrão',
        dimensao: dim,
        categoria: f.category || '-',
        autor: f.createdBy || 'Você',
        data: f.createdAt ? new Date(f.createdAt).toLocaleDateString('pt-BR') : '-'
      };
    });

    tableEl.colunas = columns;
    tableEl.dados = rows;
    this.applyMinimalRowHeight(tableEl);

    // Atualiza indicadores de paginação e título
    const titleEl = document.getElementById('cm-attribute-table-title');
    if (titleEl) {
      if (totalFiltered === 0) {
        titleEl.textContent = `📊 Tabela de Atributos (nenhum registro)`;
      } else {
        titleEl.textContent = `📊 Tabela de Atributos (${(startIndex + 1).toLocaleString('pt-BR')}–${endIndex.toLocaleString('pt-BR')} de ${totalFiltered.toLocaleString('pt-BR')})`;
      }
    }

    const pageIndicator = document.getElementById('cm-table-page-indicator');
    if (pageIndicator) {
      pageIndicator.textContent = `Pág. ${this.currentPage} / ${totalPages}`;
    }

    const btnPrev = document.getElementById('cm-btn-prev-page');
    if (btnPrev) {
      btnPrev.style.opacity = this.currentPage <= 1 ? '0.35' : '1';
      btnPrev.style.pointerEvents = this.currentPage <= 1 ? 'none' : 'auto';
    }

    const btnNext = document.getElementById('cm-btn-next-page');
    if (btnNext) {
      btnNext.style.opacity = this.currentPage >= totalPages ? '0.35' : '1';
      btnNext.style.pointerEvents = this.currentPage >= totalPages ? 'none' : 'auto';
    }
  }

  applyMinimalRowHeight(tableEl) {
    if (!tableEl) return;
    
    // Altura ideal para densidade compacta sem espremer o texto
    const COMPACT_ROW_HEIGHT = 26;
    tableEl.getRowHeight = () => COMPACT_ROW_HEIGHT;

    const UITabelaClass = window.customElements?.get('ui-tabela');
    if (UITabelaClass && !UITabelaClass.prototype._cmPatched) {
      const orig = UITabelaClass.prototype.getRowHeight;
      UITabelaClass.prototype.getRowHeight = function() {
        if (this.id === 'cm-attribute-ui-table' || this.hasAttribute('minimal-rows') || this.getAttribute('densidade') === 'compacta') {
          return COMPACT_ROW_HEIGHT;
        }
        return orig ? orig.call(this) : COMPACT_ROW_HEIGHT;
      };
      UITabelaClass.prototype._cmPatched = true;
    }

    if (tableEl.shadowRoot) {
      let style = tableEl.shadowRoot.getElementById('cm-tabela-minimal-density');
      if (!style) {
        style = document.createElement('style');
        style.id = 'cm-tabela-minimal-density';
        tableEl.shadowRoot.appendChild(style);
      }
      style.textContent = `
        :host {
          background-color: #111115 !important;
        }
        .ui-tabela-container {
          background-color: #111115 !important;
          border: none !important;
          border-radius: 0 !important;
          max-height: 100% !important;
          height: 100% !important;
        }
        .ui-tabela {
          font-size: 11px !important;
          line-height: 1.2 !important;
          background-color: #111115 !important;
        }
        .ui-tabela thead th {
          padding: 2px 8px !important;
          height: 26px !important;
          min-height: 26px !important;
          max-height: 26px !important;
          font-size: 10.5px !important;
          font-weight: 600 !important;
          color: #94a3b8 !important;
          background-color: #16161c !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          box-sizing: border-box !important;
        }
        .ui-tabela tbody td {
          padding: 0 8px !important;
          height: 26px !important;
          min-height: 26px !important;
          max-height: 26px !important;
          font-size: 11px !important;
          line-height: 26px !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04) !important;
          box-sizing: border-box !important;
        }
        .ui-tabela tbody tr {
          height: 26px !important;
          min-height: 26px !important;
          max-height: 26px !important;
        }
        .ui-tabela tbody tr:nth-child(even) {
          background-color: rgba(255, 255, 255, 0.015) !important;
        }
        .ui-tabela tbody tr:hover {
          background-color: rgba(255, 255, 255, 0.05) !important;
        }
        .ui-tabela tbody tr.ui-tabela__tr--selecionada,
        .ui-tabela tbody tr[data-selecionada="true"] {
          background-color: rgba(0, 224, 138, 0.12) !important;
        }
        .ui-tabela__virtual-spacer td {
          padding: 0 !important;
          border: none !important;
          height: inherit !important;
        }
        .ui-tabela__cell-content {
          height: 26px !important;
          line-height: 26px !important;
        }
        .ui-tabela__header-content {
          height: 26px !important;
        }
        .ui-tabela__header-text {
          margin-right: 6px !important;
        }
        .ui-tabela__sort-icon,
        .ui-tabela__header-icon {
          width: 14px !important;
          min-width: 14px !important;
          max-width: 14px !important;
        }
        .ui-tabela__resizer {
          height: 26px !important;
        }
      `;

      if (typeof tableEl.renderBody === 'function') {
        tableEl.renderBody();
      }
    }
  }

  selectFeature(featId) {
    if (!featId) return;
    const index = this.features.findIndex(f => f.id === featId);
    if (index !== -1) {
      const targetPage = Math.floor(index / this.pageSize) + 1;
      if (this.currentPage !== targetPage) {
        this.currentPage = targetPage;
        this.updateTableData();
      }
    }
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    const wrapper = document.getElementById('cm-bottom-table-wrapper');
    const body = document.getElementById('cm-bottom-table-body');
    const btn = document.getElementById('cm-btn-toggle-table');
    const subtitle = document.getElementById('cm-attribute-table-subtitle');

    if (wrapper) wrapper.classList.toggle('collapsed', this.isCollapsed);
    if (body) body.style.display = this.isCollapsed ? 'none' : 'block';
    if (btn) btn.innerHTML = this.isCollapsed ? '▲ Expandir' : '▼ Recolher';
    if (subtitle) {
      subtitle.textContent = `Clique na barra para ${this.isCollapsed ? 'expandir' : 'recolher'}`;
    }

    if (!this.isCollapsed) {
      setTimeout(() => {
        this.updateTableData();
        const table = document.getElementById('cm-attribute-ui-table');
        if (table) this.applyMinimalRowHeight(table);
      }, 50);
    }
  }

  bindEvents(container) {
    const header = container.querySelector('#cm-bottom-table-header');
    if (header) {
      header.addEventListener('click', () => this.toggleCollapse());
    }

    // Botões de Paginação Virtualizada
    const btnPrev = container.querySelector('#cm-btn-prev-page');
    if (btnPrev) {
      btnPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.currentPage > 1) {
          this.currentPage--;
          this.updateTableData();
        }
      });
    }

    const btnNext = container.querySelector('#cm-btn-next-page');
    if (btnNext) {
      btnNext.addEventListener('click', (e) => {
        e.stopPropagation();
        const totalPages = Math.max(1, Math.ceil(this.features.length / this.pageSize));
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.updateTableData();
        }
      });
    }

    const searchInput = container.querySelector('#cm-table-search-input');
    if (searchInput) {
      searchInput.addEventListener('ui-input', (e) => {
        this.searchQuery = e.detail?.value || '';
        this.currentPage = 1;
        this.updateTableData();
      });
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value || '';
        this.currentPage = 1;
        this.updateTableData();
      });
    }

    // Atalho Ctrl+K
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (this.isCollapsed) this.toggleCollapse();
        const input = document.getElementById('cm-table-search-input');
        if (input) {
          if (input.shadowRoot) {
            const inner = input.shadowRoot.querySelector('input');
            if (inner) inner.focus();
          } else {
            input.focus();
          }
        }
      }
    });

    const tableEl = container.querySelector('#cm-attribute-ui-table');
    if (tableEl) {
      tableEl.addEventListener('ui-selecionar', (e) => {
        const item = e.detail?.item || e.detail;
        if (item && item.id) {
          const feat = this.features.find(f => f.id === item.id);
          if (feat) this.onRowClick(feat);
        }
      });
    }
  }
}
