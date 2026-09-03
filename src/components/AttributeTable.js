/* ==========================================================================
   ConecteMapas - AttributeTable Component
   Tabela de Atributos Densos em <ui-tabela densidade="compacta"> com busca
   ========================================================================== */

export class AttributeTable {
  constructor(options = {}) {
    this.features = options.features || [];
    this.layers = options.layers || [];
    this.isCollapsed = true;
    this.searchQuery = '';

    this.onRowClick = options.onRowClick || (() => {});
    this.onDelete = options.onDelete || (() => {});
  }

  render(container) {
    container.innerHTML = `
      <div class="cm-bottom-table-container ${this.isCollapsed ? 'collapsed' : ''}" id="cm-bottom-table-wrapper" style="height: 260px;">
        <div class="cm-bottom-table-bar" id="cm-bottom-table-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 13px; font-weight: 600; color: var(--cm-text);">
              📊 Tabela de Atributos & Geometrias (${this.features.length})
            </span>
            <span style="font-size: 11px; color: var(--cm-text-muted);">
              Clique na barra para ${this.isCollapsed ? 'expandir' : 'recolher'}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 12px;" onclick="event.stopPropagation()">
            <ui-campo-texto 
              id="cm-table-search-input" 
              placeholder="Buscar feição... (Ctrl+K)" 
              style="width: 220px; --ui-campo-altura: 26px; --ui-altura-minima: 26px; margin-bottom: 0;">
            </ui-campo-texto>

            <button id="cm-btn-toggle-table" style="background: transparent; border: none; color: var(--cm-text); cursor: pointer; font-size: 14px;">
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

    const maxVisibleRows = 200;
    const isLimited = filtered.length > maxVisibleRows;
    const visibleData = filtered.slice(0, maxVisibleRows);

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

    const countHeader = document.querySelector('#cm-bottom-table-header span');
    if (countHeader) {
      countHeader.textContent = isLimited 
        ? `📊 Tabela de Atributos (exibindo 1–${maxVisibleRows} de ${filtered.length.toLocaleString('pt-BR')})`
        : `📊 Tabela de Atributos & Geometrias (${filtered.length.toLocaleString('pt-BR')})`;
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

    const searchInput = container.querySelector('#cm-table-search-input');
    if (searchInput) {
      searchInput.addEventListener('ui-input', (e) => {
        this.searchQuery = e.detail?.value || '';
        this.updateTableData();
      });
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value || '';
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
