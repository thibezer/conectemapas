/* ==========================================================================
   ConecteMapas - ImportExportModal Component
   Modal para exportação e importação de formatos GIS (GeoJSON, KML, GPX, CSV)
   ========================================================================== */

export class ImportExportModal {
  constructor(options = {}) {
    this.onExport = options.onExport || (() => {});
    this.onImport = options.onImport || (() => {});
  }

  render(container) {
    container.innerHTML = `
      <ui-modal id="modal-import-export" titulo="⇄ Importar / Exportar Dados Geográficos">
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Seção de Exportação -->
          <div>
            <ui-texto variante="h6" style="font-weight: 600; margin-bottom: 8px;">Exportar Dados do Mapa</ui-texto>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <ui-botao-primario inline id="btn-export-geojson" variante="secundario" title="Exportar FeatureCollection RFC 7946" style="height: 34px;">
                📄 GeoJSON (.geojson)
              </ui-botao-primario>

              <ui-botao-primario inline id="btn-export-kml" variante="secundario" title="Exportar para Google Earth / QGIS" style="height: 34px;">
                🌐 Google Earth (.kml)
              </ui-botao-primario>

              <ui-botao-primario inline id="btn-export-gpx" variante="secundario" title="Exportar para GPS de Campo" style="height: 34px;">
                🧭 GPS Track (.gpx)
              </ui-botao-primario>

              <ui-botao-primario inline id="btn-export-csv" variante="secundario" title="Exportar Tabela de Coordenadas" style="height: 34px;">
                📊 Planilha (.csv)
              </ui-botao-primario>
            </div>
          </div>

          <div style="border-top: 1px solid var(--cm-border); padding-top: 12px;">
            <ui-texto variante="h6" style="font-weight: 600; margin-bottom: 8px;">Importar Arquivo GIS</ui-texto>
            <div id="cm-dropzone" style="
              border: 2px dashed var(--cm-border);
              border-radius: var(--cm-radius-md);
              padding: 20px 16px;
              text-align: center;
              background: var(--cm-surface);
              cursor: pointer;
              transition: all 0.2s;
            ">
              <div style="font-size: 24px; margin-bottom: 6px;">📂</div>
              <ui-texto variante="corpo" style="font-weight: 500;">Arraste e solte seu arquivo aqui</ui-texto>
              <ui-texto variante="caption" style="display: block; color: var(--cm-text-muted); margin-top: 4px;">
                Suporta GeoJSON, KML, GPX ou CSV (com colunas Latitude e Longitude)
              </ui-texto>
              <input type="file" id="cm-file-input" accept=".geojson,.json,.kml,.gpx,.csv" style="display: none;" />
            </div>
          </div>
        </div>

        <div slot="rodape" style="display: flex; justify-content: flex-end; gap: 8px;">
          <ui-botao-primario inline variante="secundario" dismiss-modal style="height: 30px;">
            Fechar
          </ui-botao-primario>
        </div>
      </ui-modal>
    `;

    this.bindEvents(container);
  }

  bindEvents(container) {
    const btnGeoJSON = container.querySelector('#btn-export-geojson');
    const btnKML = container.querySelector('#btn-export-kml');
    const btnGPX = container.querySelector('#btn-export-gpx');
    const btnCSV = container.querySelector('#btn-export-csv');

    if (btnGeoJSON) btnGeoJSON.addEventListener('click', () => this.onExport('geojson'));
    if (btnKML) btnKML.addEventListener('click', () => this.onExport('kml'));
    if (btnGPX) btnGPX.addEventListener('click', () => this.onExport('gpx'));
    if (btnCSV) btnCSV.addEventListener('click', () => this.onExport('csv'));

    const dropzone = container.querySelector('#cm-dropzone');
    const fileInput = container.querySelector('#cm-file-input');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--cm-primary)';
        dropzone.style.background = 'rgba(0, 224, 138, 0.08)';
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--cm-border)';
        dropzone.style.background = 'var(--cm-surface)';
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--cm-border)';
        dropzone.style.background = 'var(--cm-surface)';
        if (e.dataTransfer.files.length > 0) {
          this.handleFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.handleFile(e.target.files[0]);
        }
      });
    }
  }

  handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      this.onImport(content, file.name);
    };
    reader.readAsText(file);
  }
}
