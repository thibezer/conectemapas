/* ==========================================================================
   ConecteMapas - ImportExportModal Component
   Modal para exportação e importação de formatos GIS:
   ESRI Shapefile (os 5 arquivos .shp, .dbf, .prj, .shx, .cpg e .zip), GeoJSON, KML, GPX, CSV
   ========================================================================== */

export class ImportExportModal {
  constructor(options = {}) {
    this.onExport = options.onExport || (() => {});
    this.onExportImage = options.onExportImage || ((opts) => this.onExport('png', opts));
    this.onImport = options.onImport || (() => {});
    this.pendingFiles = null;
    this.selectedScale = 2;
  }

  render(container) {
    container.innerHTML = `
      <ui-modal id="modal-import-export" titulo="⇄ Importar / Exportar Dados Cartográficos & GIS">
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Seção de Exportação de Vetores & Tabelas -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <ui-texto variante="h6" style="font-weight: 600;">Exportar Vetores & Tabelas</ui-texto>
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

          <!-- Seção de Exportação de Imagem PNG em Alta Resolução -->
          <div style="border-top: 1px solid var(--cm-border); padding-top: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <ui-texto variante="h6" style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
                <span>🖼️ Imagem do Mapa (PNG Alta Resolução)</span>
              </ui-texto>
              <span style="font-size: 10px; color: var(--cm-primary); font-family: var(--cm-fonte-mono); font-weight: 600;">Full HD • 2K • 4K (300 DPI)</span>
            </div>

            <div style="
              background: rgba(255, 255, 255, 0.03);
              border: 1px solid var(--cm-border);
              border-radius: 8px;
              padding: 12px;
              display: flex;
              flex-direction: column;
              gap: 10px;
            ">
              <!-- Seletor de Resolução / Qualidade -->
              <div>
                <span style="font-size: 11px; font-weight: 600; color: var(--cm-text); display: block; margin-bottom: 6px;">
                  Resolução / Densidade de Pixels:
                </span>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;" id="cm-png-scale-selector">
                  <button type="button" class="cm-scale-opt-btn" data-scale="1" style="
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid var(--cm-border);
                    border-radius: 6px;
                    padding: 6px 4px;
                    color: var(--cm-text-muted);
                    font-size: 11px;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2px;
                    transition: all 0.2s;
                  ">
                    <span style="font-weight: 600;">1x Padrão</span>
                    <span style="font-size: 9.5px; opacity: 0.8;">Full HD 1080p</span>
                  </button>

                  <button type="button" class="cm-scale-opt-btn active" data-scale="2" style="
                    background: rgba(0, 224, 138, 0.12);
                    border: 1px solid var(--cm-primary);
                    border-radius: 6px;
                    padding: 6px 4px;
                    color: var(--cm-primary);
                    font-size: 11px;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2px;
                    transition: all 0.2s;
                  ">
                    <span style="font-weight: 700;">💎 2x Alta Qualidade</span>
                    <span style="font-size: 9.5px; opacity: 0.9;">2K QHD (Recomendado)</span>
                  </button>

                  <button type="button" class="cm-scale-opt-btn" data-scale="3" style="
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid var(--cm-border);
                    border-radius: 6px;
                    padding: 6px 4px;
                    color: var(--cm-text-muted);
                    font-size: 11px;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2px;
                    transition: all 0.2s;
                  ">
                    <span style="font-weight: 600;">🌟 3x Ultra HD</span>
                    <span style="font-size: 9.5px; opacity: 0.8;">4K UHD (300 DPI)</span>
                  </button>
                </div>
              </div>

              <!-- Elementos Cartográficos Opcionais -->
              <div>
                <span style="font-size: 11px; font-weight: 600; color: var(--cm-text); display: block; margin-bottom: 6px;">
                  Composição Cartográfica na Imagem:
                </span>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; color: var(--cm-text);">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;">
                    <input type="checkbox" id="cm-png-scalebar" checked style="accent-color: var(--cm-primary); cursor: pointer;" />
                    <span>📏 Régua de Escala</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;">
                    <input type="checkbox" id="cm-png-north" checked style="accent-color: var(--cm-primary); cursor: pointer;" />
                    <span>🧭 Rosa dos Ventos (Norte)</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;">
                    <input type="checkbox" id="cm-png-titleblock" checked style="accent-color: var(--cm-primary); cursor: pointer;" />
                    <span>📋 Carimbo & Datum SIRGAS</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;">
                    <input type="checkbox" id="cm-png-legend" checked style="accent-color: var(--cm-primary); cursor: pointer;" />
                    <span>🏷️ Legenda das Camadas</span>
                  </label>
                </div>
              </div>

              <!-- Botão de Download da Imagem -->
              <div style="margin-top: 4px;">
                <ui-botao-primario inline id="btn-export-png-direct" variante="primary" title="Renderizar e baixar imagem PNG em alta resolução" style="width: 100%; height: 38px; font-weight: 600; font-size: 12.5px;">
                  📥 Baixar Imagem PNG em Alta Qualidade
                </ui-botao-primario>
              </div>
            </div>
          </div>

          <!-- Seção de Importação com Suporte Completo a AutoCAD (DWG/DXF) e ESRI Shapefile -->
          <div style="border-top: 1px solid var(--cm-border); padding-top: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <ui-texto variante="h6" style="font-weight: 600;">Importar Camadas & Desenhos Técnicos</ui-texto>
              <span style="font-size: 10px; color: var(--cm-primary); font-family: var(--cm-fonte-mono);">DWG, DXF, SHP, GeoJSON, KML, CSV</span>
            </div>

            <!-- Guia Visual: AutoCAD e Shapefile -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
              <!-- Card AutoCAD -->
              <div style="
                background: rgba(239, 68, 68, 0.06); 
                border: 1px solid rgba(239, 68, 68, 0.25); 
                border-radius: 6px; 
                padding: 8px 10px; 
                font-size: 11px;
              ">
                <div style="font-weight: 600; margin-bottom: 4px; color: #f87171; display: flex; align-items: center; gap: 6px;">
                  <span>📐 AutoCAD (.DWG / .DXF)</span>
                </div>
                <div style="color: var(--cm-text-muted); font-size: 10px; line-height: 1.4;">
                  Reconhece <strong>camadas originais</strong>, linhas, polígonos, cotas e <strong>coordenadas métricas UTM</strong>.
                </div>
              </div>

              <!-- Card Shapefile -->
              <div style="
                background: rgba(0, 224, 138, 0.05); 
                border: 1px solid rgba(0, 224, 138, 0.2); 
                border-radius: 6px; 
                padding: 8px 10px; 
                font-size: 11px;
              ">
                <div style="font-weight: 600; margin-bottom: 4px; color: var(--cm-primary); display: flex; align-items: center; gap: 6px;">
                  <span>📦 ESRI Shapefile (.ZIP / .SHP)</span>
                </div>
                <div style="color: var(--cm-text-muted); font-size: 10px; line-height: 1.4;">
                  Pacote completo com <strong>.shp, .dbf, .prj, .shx e .cpg</strong> com decodificação dBase.
                </div>
              </div>
            </div>

            <!-- Dropzone para Upload -->
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
              <ui-texto variante="corpo" style="font-weight: 500;">Arraste e solte o arquivo <strong>AutoCAD (.DWG / .DXF)</strong> ou <strong>Shapefile (.ZIP)</strong></ui-texto>
              <ui-texto variante="caption" style="display: block; color: var(--cm-text-muted); margin-top: 4px;">
                Também suporta GeoJSON, KML e planilhas CSV com coordenadas
              </ui-texto>
              <input type="file" id="cm-file-input" accept=".dwg,.dxf,.zip,.shp,.dbf,.prj,.shx,.cpg,.geojson,.json,.kml,.gpx,.csv" multiple style="display: none;" />
            </div>

            <!-- Preview dos Arquivos Detectados & Configuração de Projeção -->
            <div id="cm-shp-file-preview" style="display: none; margin-top: 10px; background: rgba(0, 224, 138, 0.05); border: 1px solid rgba(0, 224, 138, 0.2); border-radius: 6px; padding: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 11.5px; font-weight: 600; color: var(--cm-primary);" id="cm-preview-title">Arquivos Carregados</span>
                <span style="font-size: 10.5px; color: var(--cm-text-muted);" id="cm-preview-count">0 arquivos</span>
              </div>
              <div id="cm-preview-badges" style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px;"></div>

              <!-- Seletor de Fuso UTM / Datum para Desenhos CAD -->
              <div id="cm-cad-proj-wrapper" style="margin-top: 6px; margin-bottom: 10px; background: rgba(0, 0, 0, 0.2); border-radius: 6px; padding: 8px;">
                <div style="font-size: 11px; font-weight: 600; color: var(--cm-text); margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                  <span>🌐 Projeção / Fuso UTM do Desenho:</span>
                </div>
                <select id="cm-cad-proj-select" style="
                  width: 100%;
                  height: 30px;
                  background: var(--cm-surface);
                  border: 1px solid var(--cm-border);
                  border-radius: 4px;
                  color: var(--cm-text);
                  font-size: 11px;
                  padding: 0 8px;
                  outline: none;
                ">
                  <option value="EPSG:31983" selected>SIRGAS 2000 / UTM Zona 23S (DF, SP, MG, RJ) - Padrão</option>
                  <option value="EPSG:31982">SIRGAS 2000 / UTM Zona 22S (PR, SC, RS, MS, GO Sul)</option>
                  <option value="EPSG:31984">SIRGAS 2000 / UTM Zona 24S (BA, SE, AL, PE, PB, RN, CE)</option>
                  <option value="EPSG:31981">SIRGAS 2000 / UTM Zona 21S (MT, RO, AC, MS Oeste)</option>
                  <option value="EPSG:31985">SIRGAS 2000 / UTM Zona 25S (Litoral Nordeste / PB / PE)</option>
                  <option value="EPSG:29193">SAD69 / UTM Zona 23S (Legado TopoGRAPH)</option>
                  <option value="EPSG:29192">SAD69 / UTM Zona 22S (Legado)</option>
                  <option value="EPSG:4326">Coordenadas Geográficas (Graus Decimais WGS84)</option>
                </select>
              </div>

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
    const btnPNG = container.querySelector('#btn-export-png-direct');

    if (btnSHP) btnSHP.addEventListener('click', () => this.onExport('shapefile'));
    if (btnGeoJSON) btnGeoJSON.addEventListener('click', () => this.onExport('geojson'));
    if (btnKML) btnKML.addEventListener('click', () => this.onExport('kml'));
    if (btnCSV) btnCSV.addEventListener('click', () => this.onExport('csv'));

    // Configuração dos botões de escala de resolução
    const scaleButtons = container.querySelectorAll('.cm-scale-opt-btn');
    scaleButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        scaleButtons.forEach((b) => {
          b.classList.remove('active');
          b.style.background = 'rgba(255, 255, 255, 0.05)';
          b.style.borderColor = 'var(--cm-border)';
          b.style.color = 'var(--cm-text-muted)';
        });
        btn.classList.add('active');
        btn.style.background = 'rgba(0, 224, 138, 0.12)';
        btn.style.borderColor = 'var(--cm-primary)';
        btn.style.color = 'var(--cm-primary)';
        this.selectedScale = Number(btn.getAttribute('data-scale')) || 2;
      });
    });

    if (btnPNG) {
      btnPNG.addEventListener('click', () => {
        const checkScaleBar = container.querySelector('#cm-png-scalebar');
        const checkNorth = container.querySelector('#cm-png-north');
        const checkTitleBlock = container.querySelector('#cm-png-titleblock');
        const checkLegend = container.querySelector('#cm-png-legend');

        const options = {
          scale: this.selectedScale,
          elements: {
            scaleBar: checkScaleBar ? checkScaleBar.checked : true,
            northArrow: checkNorth ? checkNorth.checked : true,
            titleBlock: checkTitleBlock ? checkTitleBlock.checked : true,
            legend: checkLegend ? checkLegend.checked : true
          }
        };

        this.onExportImage(options);
      });
    }

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
          const projSelect = container.querySelector('#cm-cad-proj-select');
          const selectedProj = projSelect ? projSelect.value : 'EPSG:31983';
          const importOptions = { sourceProjection: selectedProj };

          if (this.pendingFiles.length === 1) {
            const singleFile = this.pendingFiles[0];
            const name = singleFile.name.toLowerCase();

            if (name.endsWith('.dwg')) {
              // DWG binário: lê como ArrayBuffer para decodificação
              const reader = new FileReader();
              reader.onload = (e) => {
                this.onImport(e.target.result, singleFile.name, importOptions);
              };
              reader.readAsArrayBuffer(singleFile);
            } else if (name.endsWith('.dxf') || name.endsWith('.geojson') || name.endsWith('.json') || name.endsWith('.kml') || name.endsWith('.csv')) {
              const reader = new FileReader();
              reader.onload = (e) => {
                this.onImport(e.target.result, singleFile.name, importOptions);
              };
              reader.readAsText(singleFile);
            } else {
              // Shapefile ZIP ou SHP binário
              this.onImport(singleFile, singleFile.name, importOptions);
            }
          } else {
            // Múltiplos arquivos Shapefile
            this.onImport(Array.from(this.pendingFiles), 'shapefile_bundle', importOptions);
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

    const extCounts = { dwg: 0, dxf: 0, shp: 0, dbf: 0, prj: 0, shx: 0, cpg: 0, zip: 0, other: 0 };
    const cadProjWrapper = document.getElementById('cm-cad-proj-wrapper');

    Array.from(files).forEach(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      if (ext in extCounts) extCounts[ext]++;
      else extCounts.other++;

      const isCad = ext === 'dwg' || ext === 'dxf';
      const isShp = ['shp', 'dbf', 'prj', 'shx', 'cpg'].includes(ext);

      const badge = document.createElement('span');
      badge.style.cssText = `
        font-size: 10px;
        font-family: var(--cm-fonte-mono, monospace);
        background: ${isCad ? 'rgba(239, 68, 68, 0.15)' : (isShp ? 'rgba(0, 224, 138, 0.15)' : 'rgba(255, 255, 255, 0.08)')};
        border: 1px solid ${isCad ? '#ef4444' : (isShp ? '#00E08A' : 'rgba(255, 255, 255, 0.1)')};
        padding: 2px 6px;
        border-radius: 4px;
        color: ${isCad ? '#fca5a5' : (isShp ? '#6ee7b7' : 'var(--cm-text)')};
        font-weight: ${isCad || isShp ? '600' : '400'};
      `;
      badge.textContent = `${f.name} (${(f.size / 1024).toFixed(1)} KB)`;
      previewBadges.appendChild(badge);
    });

    // Exibe ou oculta o seletor de projeção UTM para arquivos CAD
    if (extCounts.dwg > 0 || extCounts.dxf > 0) {
      if (cadProjWrapper) cadProjWrapper.style.display = 'block';
      const fileExt = extCounts.dwg > 0 ? 'DWG' : 'DXF';
      previewTitle.textContent = `📐 Desenho AutoCAD .${fileExt} Detectado (${files[0].name})`;
    } else {
      if (cadProjWrapper) cadProjWrapper.style.display = 'none';
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
}

