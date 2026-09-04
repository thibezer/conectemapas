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

    this.onRowClick = options.onRowClick || (() => {});
    this.onDelete = options.onDelete || (() => {});
  }

  render(container) {
    container.innerHTML = `
      <div class="cm-bottom-table-container ${this.isCollapsed ? 'collapsed' : ''}" id="cm-bottom-table-wrapper" style="height: 260px;">
        <div class="cm-bottom-table-bar" id="cm-bottom-table-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span id="cm-attribute-table-title" style="font-size: 13px; font-weight: 600; color: var(--cm-text);">
              📊 Tabela de Atributos & Geometrias (${this.features.length})
            </span>
            <span style="font-size: 11px; color: var(--cm-text-muted);">
              Clique na barra para ${this.isCollapsed ? 'expandir' : 'recolher'}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 12px;" onclick="event.stopPropagation()">
            <!-- Controles de Paginação Virtualizada (P2) -->
            <div id="cm-table-pagination-controls" style="display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">
              <button id="cm-btn-prev-page" title="Página anterior" style="background: transparent; border: none; color: var(--cm-text); cursor: pointer; font-size: 11px; padding: 2px 4px; border-radius: 3px;">◀</button>
              <span id="cm-table-page-indicator" style="font-size: 11px; color: var(--cm-text-muted); font-variant-numeric: tabular-nums; min-width: 70px; text-align: center;">Pág. 1 / 1</span>
              <button id="cm-btn-next-page" title="Próxima página" style="background: transparent; border: none; color: var(--cm-text); cursor: pointer; font-size: 11px; padding: 2px 4px; border-radius: 3px;">▶</button>
            </div>

            <ui-campo-texto 
              id="cm-table-search-input" 
              placeholder="Buscar feição... (Ctrl+K)" 
              style="width: 200px; --ui-campo-altura: 26px; --ui-altura-minima: 26px; margin-bottom: 0;">
            </ui-campo-texto>

            <button id="cm-btn-toggle-table" style="background: transparent; border: none; color: var(--cm-text); cursor: pointer; font-size: 13px; font-weight: 500;">
              ${this.isCollapsed ? '▲ Expandir' : '▼ Recolher'}
            </button>
          </div>
        </div>

        <div class="cm-bottom-table-content" id="cm-bottom-table-body" style="display: ${this.isCollapsed ? 'none' : 'block'}; height: calc(100% - 36px);">
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
      { id: 'tipo', rotulo: 'Tipo', ordenavel: true, largura: '100px' },
      { id: 'nome', rotulo: 'Nome da Feição', ordenavel: true },
      { id: 'camada', rotulo: 'Camada', ordenavel: true },
      { id: 'dimensao', rotulo: 'Dimensão / Coordenadas' },
      { id: 'categoria', rotulo: 'Categoria' },
      { id: 'autor', rotulo: 'Autor', ordenavel: true },
      { id: 'data', rotulo: 'Criado em' }
    ];

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
        dim = f.properties?.['Extensão'] || f.properties?.extensao || `${Array.isArray(f.coordinates) ? f.coordinates.length : 0} nós`;
      } else if (f.type === 'Polygon') {
        dim = f.properties?.['Área (ha)'] || f.properties?.areaCalculada || `${Array.isArray(f.coordinates) ? f.coordinates.length : 0} nós`;
      } else if (f.type === 'Circle') {
        dim = `Raio: ${f.radius || 500}m`;
      }

      return {
        id: f.id,
        tipo: f.locked ? `🔒 ${f.type}` : f.type,
        nome: f.name || 'Sem nome',
        camada: layerMap.get(f.layerId) || 'Padrão',
        dimensao: dim,
        categoria: f.category || '-',
        autor: f.createdBy || 'Sistema',
        data: f.createdAt ? new Date(f.createdAt).toLocaleDateString('pt-BR') : '-'
      };
    });

    tableEl.colunas = columns;
    tableEl.dados = rows;

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

    if (wrapper) wrapper.classList.toggle('collapsed', this.isCollapsed);
    if (body) body.style.display = this.isCollapsed ? 'none' : 'block';
    if (btn) btn.innerHTML = this.isCollapsed ? '▲ Expandir' : '▼ Recolher';

    if (!this.isCollapsed) {
      setTimeout(() => this.updateTableData(), 50);
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
