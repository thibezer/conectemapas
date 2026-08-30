/* ==========================================================================
   ConecteMapas - ImportExportModal Component
   Modal para exportação e importação de formatos GIS:
   ESRI Shapefile (os 5 arquivos .shp, .dbf, .prj, .shx, .cpg e .zip), GeoJSON, KML, GPX, CSV
   ========================================================================== */

export class ImportExportModal {
  constructor(options = {}) {
    this.onExport = options.onExport || (() => {});
    this.onImport = options.onImport || (() => {});
    this.pendingFiles = null;
  }

  render(container) {
    container.innerHTML = `
      <ui-modal id="modal-import-export" titulo="⇄ Importar / Exportar Dados Cartográficos & GIS">
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Seção de Exportação -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <ui-texto variante="h6" style="font-weight: 600;">Exportar Dados do Mapa</ui-texto>
              <span style="font-size: 10.5px; color: var(--cm-text-muted);">Padrões OGC & ESRI</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <ui-botao-primario inline id="btn-export-shp" variante="primary" title="Exportar pacote ESRI Shapefile com os 5 arquivos (.shp, .dbf, .prj, .shx, .cpg)" style="height: 34px; font-weight: 600;">
                📦 ESRI Shapefile (.zip)
              </ui-botao-primario>

              <ui-botao-primario inline id="btn-export-geojson" variante="secundario" title="Exportar FeatureCollection RFC 7946" style="height: 34px;">
                📄 GeoJSON (.geojson)
              </ui-botao-primario>

              <ui-botao-primario inline id="btn-export-kml" variante="secundario" title="Exportar para Google Earth / QGIS" style="height: 34px;">
                🌐 Google Earth (.kml)
              </ui-botao-primario>

              <ui-botao-primario inline id="btn-export-csv" variante="secundario" title="Exportar Tabela de Coordenadas" style="height: 34px;">
                📊 Planilha (.csv)
              </ui-botao-primario>
            </div>
          </div>

          <!-- Seção de Importação com Suporte Completo aos 5 Arquivos SHP -->
          <div style="border-top: 1px solid var(--cm-border); padding-top: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <ui-texto variante="h6" style="font-weight: 600;">Importar Camadas & Geometrias</ui-texto>
              <span style="font-size: 10px; color: var(--cm-primary); font-family: var(--cm-fonte-mono);">SHP, DBF, PRJ, SHX, CPG, ZIP, GeoJSON, KML, CSV</span>
            </div>

            <!-- Guia Visual dos 5 Arquivos do SHP -->
            <div style="
              background: rgba(255, 255, 255, 0.03); 
              border: 1px solid var(--cm-border); 
              border-radius: 6px; 
              padding: 8px 10px; 
              margin-bottom: 10px;
              font-size: 11px;
            ">
              <div style="font-weight: 600; margin-bottom: 4px; color: var(--cm-text); display: flex; align-items: center; gap: 6px;">
                <span>📦 Suporte Completo ao Pacote ESRI Shapefile:</span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 4px; color: var(--cm-text-muted); font-size: 10px;">
                <div><strong style="color: var(--cm-primary);">.SHP:</strong> Geometria Vetorial</div>
                <div><strong style="color: #60a5fa;">.DBF:</strong> Atributos dBase</div>
                <div><strong style="color: #f59e0b;">.PRJ:</strong> Datum & Projeção</div>
                <div><strong style="color: #a78bfa;">.SHX:</strong> Índice Posicional</div>
                <div><strong style="color: #34d399;">.CPG:</strong> Codificação UTF-8</div>
              </div>
            </div>

            <div id="cm-dropzone" style="
              border: 2px dashed var(--cm-border);
              border-radius: var(--cm-radius-md);
              padding: 22px 16px;
              text-align: center;
              background: var(--cm-surface);
              cursor: pointer;
              transition: all 0.2s;
            ">
              <div style="font-size: 28px; margin-bottom: 6px;">📂</div>
              <ui-texto variante="corpo" style="font-weight: 500;">Arraste e solte o arquivo <strong>.ZIP</strong> ou os <strong>5 arquivos SHP</strong> juntos</ui-texto>
              <ui-texto variante="caption" style="display: block; color: var(--cm-text-muted); margin-top: 4px;">
                Você pode selecionar arquivos avulsos (.shp, .dbf, .prj, .shx, .cpg) ou arquivo compactado (.zip)
              </ui-texto>
              <input type="file" id="cm-file-input" accept=".zip,.shp,.dbf,.prj,.shx,.cpg,.geojson,.json,.kml,.gpx,.csv" multiple style="display: none;" />
            </div>

            <!-- Preview dos Arquivos Detectados -->
            <div id="cm-shp-file-preview" style="display: none; margin-top: 10px; background: rgba(0, 224, 138, 0.05); border: 1px solid rgba(0, 224, 138, 0.2); border-radius: 6px; padding: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 11.5px; font-weight: 600; color: var(--cm-primary);" id="cm-preview-title">Arquivos Carregados</span>
                <span style="font-size: 10.5px; color: var(--cm-text-muted);" id="cm-preview-count">0 arquivos</span>
              </div>
              <div id="cm-preview-badges" style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px;"></div>
              <div style="display: flex; justify-content: flex-end; gap: 6px;">
                <ui-botao-primario inline id="btn-cancel-upload" variante="secundario" style="height: 28px; font-size: 11px;">
                  Cancelar
                </ui-botao-primario>
                <ui-botao-primario inline id="btn-confirm-import" variante="primary" style="height: 28px; font-size: 11px; font-weight: 600;">
                  ✔ Processar e Importar
                </ui-botao-primario>
              </div>
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
    const btnSHP = container.querySelector('#btn-export-shp');
    const btnGeoJSON = container.querySelector('#btn-export-geojson');
    const btnKML = container.querySelector('#btn-export-kml');
    const btnCSV = container.querySelector('#btn-export-csv');

    if (btnSHP) btnSHP.addEventListener('click', () => this.onExport('shapefile'));
    if (btnGeoJSON) btnGeoJSON.addEventListener('click', () => this.onExport('geojson'));
    if (btnKML) btnKML.addEventListener('click', () => this.onExport('kml'));
    if (btnCSV) btnCSV.addEventListener('click', () => this.onExport('csv'));

    const dropzone = container.querySelector('#cm-dropzone');
    const fileInput = container.querySelector('#cm-file-input');
    const previewBox = container.querySelector('#cm-shp-file-preview');
    const previewTitle = container.querySelector('#cm-preview-title');
    const previewCount = container.querySelector('#cm-preview-count');
    const previewBadges = container.querySelector('#cm-preview-badges');
    const btnConfirm = container.querySelector('#btn-confirm-import');
    const btnCancel = container.querySelector('#btn-cancel-upload');

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
          this.handleFiles(e.dataTransfer.files, previewBox, previewTitle, previewCount, previewBadges);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.handleFiles(e.target.files, previewBox, previewTitle, previewCount, previewBadges);
        }
      });
    }

    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => {
        if (this.pendingFiles) {
          if (this.pendingFiles.length === 1) {
            const singleFile = this.pendingFiles[0];
            const name = singleFile.name.toLowerCase();
            if (name.endsWith('.geojson') || name.endsWith('.json') || name.endsWith('.kml') || name.endsWith('.csv')) {
              const reader = new FileReader();
              reader.onload = (e) => {
                this.onImport(e.target.result, singleFile.name);
              };
              reader.readAsText(singleFile);
            } else {
              // Shapefile ZIP ou SHP binário
              this.onImport(singleFile, singleFile.name);
            }
          } else {
            // Múltiplos arquivos Shapefile
            this.onImport(Array.from(this.pendingFiles), 'shapefile_bundle');
          }

          if (previewBox) previewBox.style.display = 'none';
          this.pendingFiles = null;
        }
      });
    }

    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        this.pendingFiles = null;
        if (previewBox) previewBox.style.display = 'none';
        if (fileInput) fileInput.value = '';
      });
    }
  }

  handleFiles(files, previewBox, previewTitle, previewCount, previewBadges) {
    this.pendingFiles = files;

    if (!previewBox || !previewBadges) return;

    previewBox.style.display = 'block';
    previewCount.textContent = `${files.length} arquivo(s) selecionado(s)`;
    previewBadges.innerHTML = '';

    const extCounts = { shp: 0, dbf: 0, prj: 0, shx: 0, cpg: 0, zip: 0, other: 0 };

    Array.from(files).forEach(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      if (ext in extCounts) extCounts[ext]++;
      else extCounts.other++;

      const badge = document.createElement('span');
      badge.style.cssText = `
        font-size: 10px;
        font-family: var(--cm-fonte-mono, monospace);
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        color: var(--cm-text);
      `;
      badge.textContent = `${f.name} (${(f.size / 1024).toFixed(1)} KB)`;
      previewBadges.appendChild(badge);
    });

    if (extCounts.zip > 0) {
      previewTitle.textContent = `📦 Pacote ZIP Detectado (${files[0].name})`;
    } else if (extCounts.shp > 0) {
      const missing = [];
      if (extCounts.dbf === 0) missing.push('.dbf (atributos)');
      if (extCounts.prj === 0) missing.push('.prj (projeção)');
      if (extCounts.shx === 0) missing.push('.shx (índice)');
      if (extCounts.cpg === 0) missing.push('.cpg (codificação)');

      if (missing.length === 0) {
        previewTitle.textContent = `✔ Pacote Shapefile Completo (5 de 5 arquivos presentes)`;
      } else {
        previewTitle.textContent = `⚠️ Shapefile Parcial (.shp detectado - ausentes: ${missing.join(', ')})`;
      }
    } else {
      previewTitle.textContent = `Arquivos Prontos para Importação`;
    }
  }
}

