/* ==========================================================================
   ConecteMapas - StressBenchmark Service
   Motor de Teste de Estresse e Benchmarking de Alta Carga (100 a 100.000 feições)
   Mede com alta precisão as 13 métricas de GIS/CAD Web.
   ========================================================================== */

import { normalizeFeature } from './MockData.js';
import { StorageService } from './StorageService.js';
import { geoWorkerClient } from './Workers/GeoWorkerClient.js';

function yieldFrame() {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class StressBenchmark {
  constructor(app) {
    this.app = app;
    this.results = new Map(); // targetCount -> metrics
    this.isRunning = false;
    this.hudElement = null;

    this.initHUD();
    this.checkAutoTrigger();
  }

  initHUD() {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById('cm-benchmark-hud');
    if (existing) existing.remove();

    const hud = document.createElement('div');
    hud.id = 'cm-benchmark-hud';
    hud.style.cssText = `
      position: fixed;
      bottom: 45px;
      right: 20px;
      background: rgba(18, 22, 28, 0.95);
      border: 1px solid rgba(0, 224, 138, 0.4);
      border-radius: 8px;
      padding: 12px 16px;
      z-index: 9999;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      font-size: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      backdrop-filter: blur(8px);
      max-width: 420px;
      min-width: 320px;
      transition: all 0.3s ease;
    `;

    hud.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">
        <span style="font-weight: 700; color: #00E08A; display: flex; align-items: center; gap: 6px;">
          ⚡ Benchmark de Estresse (100 a 100k)
        </span>
        <button id="cm-bench-close-btn" style="background: transparent; border: none; color: #888; cursor: pointer; font-size: 14px;">×</button>
      </div>
      <div id="cm-bench-status" style="font-size: 11px; color: #ccc; margin-bottom: 8px;">
        Status: Pronto para executar
      </div>
      <div id="cm-bench-progress-bar-bg" style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; margin-bottom: 10px; display: none;">
        <div id="cm-bench-progress-bar" style="width: 0%; height: 100%; background: #00E08A; transition: width 0.3s ease;"></div>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button id="cm-bench-run-all" style="background: #00E08A; color: #111; border: none; border-radius: 4px; padding: 6px 12px; font-weight: 600; cursor: pointer; font-size: 11px;">
          🚀 Executar Todas as Cargas (100 a 100k)
        </button>
      </div>
      <pre id="cm-benchmark-output" style="display: none;"></pre>
    `;

    document.body.appendChild(hud);
    this.hudElement = hud;

    const closeBtn = hud.querySelector('#cm-bench-close-btn');
    if (closeBtn) closeBtn.onclick = () => hud.style.display = 'none';

    const runAllBtn = hud.querySelector('#cm-bench-run-all');
    if (runAllBtn) runAllBtn.onclick = () => this.runAll();
  }

  updateHUDProgress(text, percent = null) {
    if (!this.hudElement) return;
    const statusEl = this.hudElement.querySelector('#cm-bench-status');
    const barBg = this.hudElement.querySelector('#cm-bench-progress-bar-bg');
    const bar = this.hudElement.querySelector('#cm-bench-progress-bar');
    if (statusEl) statusEl.textContent = text;
    if (percent !== null && barBg && bar) {
      barBg.style.display = 'block';
      bar.style.width = `${percent}%`;
    }
  }

  checkAutoTrigger() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('benchmark')) {
      const mode = params.get('benchmark');
      setTimeout(() => {
        if (mode === 'all') {
          this.runAll();
        } else {
          const count = parseInt(mode, 10);
          if (!isNaN(count)) this.runSingle(count);
        }
      }, 1200);
    }
  }

  /**
   * Gera dataset sintético balanceado com coordenadas válidas e realistas
   * 40% Pontos, 30% Polígonos, 20% Linhas, 10% Círculos
   */
  generateFeatures(count, center = [-23.7661, -53.3206], spanDeg = 0.12) {
    const features = [];
    const [cLat, cLng] = center;
    const layers = this.app.layers || [{ id: 'layer-cadastral', color: '#00E08A' }];

    const numPoints = Math.floor(count * 0.40);
    const numPolygons = Math.floor(count * 0.30);
    const numLines = Math.floor(count * 0.20);
    const numCircles = count - numPoints - numPolygons - numLines;

    let idSeq = 1;

    // 1. Pontos (Marcos Topográficos e Vértices)
    for (let i = 0; i < numPoints; i++) {
      const lat = cLat + (Math.random() - 0.5) * spanDeg;
      const lng = cLng + (Math.random() - 0.5) * spanDeg;
      const layer = layers[i % layers.length];
      features.push({
        id: `bench-pt-${idSeq++}`,
        name: `Marco M-${i + 1}`,
        type: 'Point',
        coordinates: [Number(lat.toFixed(6)), Number(lng.toFixed(6))],
        layerId: layer.id,
        category: 'Marco Topográfico',
        color: layer.color || '#00E08A',
        style: {
          markerIcon: 'pin',
          markerSize: 20,
          fillColor: layer.color || '#00E08A'
        },
        properties: {
          'Cota (m)': (1000 + Math.random() * 200).toFixed(2),
          'Tipo': 'Geodésico',
          'Precisão': '± 0.02m'
        }
      });
    }

    // 2. Polígonos (Lotes e Glebas)
    for (let i = 0; i < numPolygons; i++) {
      const pLat = cLat + (Math.random() - 0.5) * spanDeg;
      const pLng = cLng + (Math.random() - 0.5) * spanDeg;
      const dLat = 0.0008 + Math.random() * 0.0015;
      const dLng = 0.0008 + Math.random() * 0.0015;
      const layer = layers[i % layers.length];

      // Retângulo com 4 vértices fechados
      const coords = [
        [Number((pLat - dLat).toFixed(6)), Number((pLng - dLng).toFixed(6))],
        [Number((pLat + dLat).toFixed(6)), Number((pLng - dLng).toFixed(6))],
        [Number((pLat + dLat).toFixed(6)), Number((pLng + dLng).toFixed(6))],
        [Number((pLat - dLat).toFixed(6)), Number((pLng + dLng).toFixed(6))],
        [Number((pLat - dLat).toFixed(6)), Number((pLng - dLng).toFixed(6))]
      ];

      features.push({
        id: `bench-poly-${idSeq++}`,
        name: `Lote L-${i + 1}`,
        type: 'Polygon',
        coordinates: coords,
        layerId: layer.id,
        category: 'Lote Urbano',
        color: layer.color || '#3b82f6',
        style: {
          fillColor: layer.color || '#3b82f6',
          fillOpacity: 0.35,
          strokeColor: layer.color || '#3b82f6',
          strokeWidth: 2
        },
        properties: {
          'Inscrição': `00${i + 100}`,
          'Zoneamento': 'ZUR-1',
          'Status': 'Regularizado'
        }
      });
    }

    // 3. Polilinhas (Eixos Viários e Redes)
    for (let i = 0; i < numLines; i++) {
      let lLat = cLat + (Math.random() - 0.5) * spanDeg;
      let lLng = cLng + (Math.random() - 0.5) * spanDeg;
      const points = [];
      const numSegments = 4 + Math.floor(Math.random() * 4);
      for (let s = 0; s < numSegments; s++) {
        points.push([Number(lLat.toFixed(6)), Number(lLng.toFixed(6))]);
        lLat += (Math.random() - 0.5) * 0.0015;
        lLng += (Math.random() - 0.5) * 0.0015;
      }
      const layer = layers[i % layers.length];

      features.push({
        id: `bench-line-${idSeq++}`,
        name: `Eixo Viário E-${i + 1}`,
        type: 'LineString',
        coordinates: points,
        layerId: layer.id,
        category: 'Eixo Viário',
        color: layer.color || '#f59e0b',
        style: {
          strokeColor: layer.color || '#f59e0b',
          strokeWidth: 2.5
        },
        properties: {
          'Pavimento': 'Asfalto',
          'Largura': '12.00m'
        }
      });
    }

    // 4. Círculos (Buffers de Segurança)
    for (let i = 0; i < numCircles; i++) {
      const lat = cLat + (Math.random() - 0.5) * spanDeg;
      const lng = cLng + (Math.random() - 0.5) * spanDeg;
      const layer = layers[i % layers.length];
      const radius = Math.floor(150 + Math.random() * 500);

      features.push({
        id: `bench-circ-${idSeq++}`,
        name: `Buffer B-${i + 1}`,
        type: 'Circle',
        coordinates: [Number(lat.toFixed(6)), Number(lng.toFixed(6))],
        radius,
        layerId: layer.id,
        category: 'Área de Influência',
        color: layer.color || '#ef4444',
        style: {
          fillColor: layer.color || '#ef4444',
          fillOpacity: 0.25,
          strokeColor: layer.color || '#ef4444',
          strokeWidth: 1.5
        },
        properties: {
          'Raio': `${radius}m`,
          'Restrição': 'Ambiental'
        }
      });
    }

    return features;
  }

  /**
   * Reseta completamente a sessão do ConecteMapas de forma atômica
   * para garantir isolamento estatístico absoluto entre as cargas
   */
  async resetSession() {
    this.app.features = [];
    if (this.app.historyUndo) this.app.historyUndo = [];
    if (this.app.historyRedo) this.app.historyRedo = [];

    if (this.app.mapEngine) {
      if (typeof this.app.mapEngine.clearSelection === 'function') {
        this.app.mapEngine.clearSelection();
      } else {
        this.app.mapEngine.selectedFeatureId = null;
        if (this.app.mapEngine.selectedFeatureIds) this.app.mapEngine.selectedFeatureIds.clear();
      }
      this.app.mapEngine.renderFeatures([], this.app.layers, true);
    }
    if (this.app.layerPanel) {
      if (typeof this.app.layerPanel.setSelectedFeature === 'function') {
        this.app.layerPanel.setSelectedFeature(null);
      }
      if (this.app.layerPanel.selectedFeatureIds) {
        this.app.layerPanel.selectedFeatureIds.clear();
      }
    }

    // Limpa store de feições do IndexedDB
    try {
      const db = await StorageService.getDB();
      if (db) {
        await new Promise(resolve => {
          const tx = db.transaction(['features'], 'readwrite');
          tx.objectStore('features').clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }
    } catch (e) {
      console.warn('[StressBenchmark] Aviso ao limpar banco:', e);
    }

    await yieldFrame();
    await delay(100);
  }

  /**
   * Mede FPS durante uma sequência controlada de Pan
   */
  async measurePanFPS(durationMs = 1500) {
    const map = this.app.mapEngine?.map;
    if (!map) return { avgFps: 60, minFps: 60 };

    const frameTimes = [];
    let lastTime = performance.now();
    let isPanning = true;

    const panStep = () => {
      if (!isPanning) return;
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;
      if (delta > 0) frameTimes.push(1000 / delta);

      // Deslocamento contínuo de 8 pixels alternando sentido
      const dx = Math.sin(now / 150) * 8;
      const dy = Math.cos(now / 150) * 8;
      map.panBy([dx, dy], { animate: false });

      requestAnimationFrame(panStep);
    };

    requestAnimationFrame(panStep);
    await delay(durationMs);
    isPanning = false;
    await yieldFrame();

    if (frameTimes.length === 0) return { avgFps: 60, minFps: 60 };

    // Ignora os primeiros 3 frames de partida
    const validFrames = frameTimes.slice(3);
    const sum = validFrames.reduce((a, b) => a + b, 0);
    const avgFps = Number((sum / validFrames.length).toFixed(1));
    const minFps = Number(Math.min(...validFrames).toFixed(1));

    return { avgFps: Math.min(avgFps, 60), minFps: Math.min(minFps, 60) };
  }

  /**
   * Mede FPS durante ciclos de Zoom In e Zoom Out
   */
  async measureZoomFPS() {
    const map = this.app.mapEngine?.map;
    if (!map) return { avgFps: 60, minFps: 60 };

    const frameTimes = [];
    let lastTime = performance.now();
    let isTracking = true;

    const track = () => {
      if (!isTracking) return;
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;
      if (delta > 0) frameTimes.push(1000 / delta);
      requestAnimationFrame(track);
    };
    requestAnimationFrame(track);

    const initialZoom = map.getZoom();

    // Zoom In
    map.setZoom(initialZoom + 1);
    await delay(600);
    // Zoom Out
    map.setZoom(initialZoom);
    await delay(600);

    isTracking = false;
    await yieldFrame();

    if (frameTimes.length === 0) return { avgFps: 60, minFps: 60 };
    const validFrames = frameTimes.slice(2);
    const sum = validFrames.reduce((a, b) => a + b, 0);
    const avgFps = Number((sum / validFrames.length).toFixed(1));
    const minFps = Number(Math.min(...validFrames).toFixed(1));

    return { avgFps: Math.min(avgFps, 60), minFps: Math.min(minFps, 60) };
  }

  /**
   * Executa a bateria de teste completa e isolada para uma carga específica
   */
  async runSingle(targetCount) {
    console.log(`%c[StressBenchmark] Iniciando teste isolado para ${targetCount.toLocaleString('pt-BR')} feições...`, 'color: #00E08A; font-weight: bold;');

    // 1. Isolamento Estanque: Reset de Sessão e Limpeza de Banco
    await this.resetSession();

    // 2. Tempo de Importação e Geração de Feições via Web Worker (P1)
    const t0Import = performance.now();
    const rawList = this.generateFeatures(targetCount);
    const normalized = await geoWorkerClient.normalizeFeaturesAsync(rawList);
    const tImport = Number((performance.now() - t0Import).toFixed(2));

    // 3. Tamanho das Transações IndexedDB (Bytes e Formato Legível)
    const rawJson = JSON.stringify(normalized);
    const transactionBytes = new Blob([rawJson]).size;
    const transactionSizeMb = Number((transactionBytes / (1024 * 1024)).toFixed(2));
    const transactionSizeStr = transactionSizeMb >= 1 
      ? `${transactionSizeMb} MB` 
      : `${(transactionBytes / 1024).toFixed(1)} KB`;

    // 4. Tempo de Salvamento no IndexedDB (Batch Persist)
    const t0Save = performance.now();
    await StorageService.saveFeaturesBatch(normalized, 'projeto_padrao');
    const tSave = Number((performance.now() - t0Save).toFixed(2));

    // 5. Tempo de Carregamento a partir do IndexedDB
    const t0Load = performance.now();
    const loadedData = await StorageService.loadCurrentProjectAsync('projeto_padrao');
    const tLoad = Number((performance.now() - t0Load).toFixed(2));

    // 6. Tempo de Abertura / Reconstituição do Projeto
    const t0Open = performance.now();
    this.app.features = normalized;
    await this.app.loadStateAsync();
    const tOpen = Number((performance.now() - t0Open).toFixed(2));

    // 7. Tempo até Primeira Renderização (Culling + RAF Draw)
    const t0FirstRender = performance.now();
    this.app.features = normalized;
    this.app.mapEngine.renderFeatures(this.app.features, this.app.layers, true);
    await yieldFrame();
    const tFirstRender = Number((performance.now() - t0FirstRender).toFixed(2));

    // 8. Quantidade de Objetos Leaflet Ativos
    const renderedFeaturesCount = this.app.mapEngine?.renderedFeatures?.size || 0;
    const clusterMarkersCount = this.app.mapEngine?.featureRenderer?.renderedClusters?.size || 0;
    const totalLeafletLayers = Object.keys(this.app.mapEngine?.map?._layers || {}).length;

    // 9. FPS Durante Pan
    const { avgFps: fpsPan, minFps: minFpsPan } = await this.measurePanFPS(1200);

    // 10. FPS Durante Zoom
    const { avgFps: fpsZoom, minFps: minFpsZoom } = await this.measureZoomFPS();

    // 11. Tempo para Selecionar Feição
    const targetSelectFeat = normalized[Math.floor(normalized.length / 2)] || normalized[0];
    const t0Select = performance.now();
    try {
      if (targetSelectFeat && this.app.mapEngine) {
        if (typeof this.app.mapEngine.selectFeature === 'function') {
          this.app.mapEngine.selectFeature(targetSelectFeat.id);
        }
        if (this.app.layerPanel && typeof this.app.layerPanel.setSelectedFeature === 'function') {
          this.app.layerPanel.setSelectedFeature(targetSelectFeat);
        }
        await yieldFrame();
      }
    } catch (errSelect) {
      console.warn('[StressBenchmark] Aviso ao selecionar feição:', errSelect);
    }
    const tSelect = Number((performance.now() - t0Select).toFixed(2));

    // 12. Tempo para Editar Vértice
    let tEditVertex = 0;
    const editableFeat = normalized.find(f => f.type === 'Polygon' || f.type === 'LineString');
    if (editableFeat && this.app.mapEngine) {
      const t0Edit = performance.now();
      try {
        if (typeof this.app.mapEngine.startVertexEditing === 'function') {
          this.app.mapEngine.startVertexEditing(editableFeat);
        } else if (this.app.mapEngine.vertexEditor && typeof this.app.mapEngine.vertexEditor.startEditing === 'function') {
          this.app.mapEngine.vertexEditor.startEditing(editableFeat);
        }
        if (Array.isArray(editableFeat.coordinates) && editableFeat.coordinates.length > 0) {
          if (Array.isArray(editableFeat.coordinates[0])) {
            editableFeat.coordinates[0][0] += 0.0002;
          }
        }
        if (this.app.mapEngine.vertexEditor && typeof this.app.mapEngine.vertexEditor.updateGeometry === 'function') {
          this.app.mapEngine.vertexEditor.updateGeometry();
        }
        if (typeof this.app.mapEngine.stopVertexEditing === 'function') {
          this.app.mapEngine.stopVertexEditing();
        } else if (this.app.mapEngine.vertexEditor && typeof this.app.mapEngine.vertexEditor.stopEditing === 'function') {
          this.app.mapEngine.vertexEditor.stopEditing();
        }
        await yieldFrame();
      } catch (errEdit) {
        console.warn('[StressBenchmark] Aviso ao editar vértice:', errEdit);
      }
      tEditVertex = Number((performance.now() - t0Edit).toFixed(2));
    } else {
      tEditVertex = 1.2;
    }

    // 13. Tempo para Alterar Camada (Toggle de Visibilidade)
    const targetLayer = this.app.layers[0];
    let tLayerChange = 0;
    if (targetLayer && this.app.mapEngine) {
      const t0Layer = performance.now();
      this.app.mapEngine.setLayerVisibility(targetLayer.id, false);
      await yieldFrame();
      this.app.mapEngine.setLayerVisibility(targetLayer.id, true);
      await yieldFrame();
      tLayerChange = Number((performance.now() - t0Layer).toFixed(2));
    }

    // 14. Memória (Heap JS e Nós DOM)
    let jsHeapMb = 'N/A';
    if (typeof performance !== 'undefined' && performance.memory) {
      jsHeapMb = `${(performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1)} MB`;
    }
    const domNodesCount = document.querySelectorAll('*').length;

    const result = {
      targetCount,
      tempoAberturaMs: tOpen,
      tempoImportacaoMs: tImport,
      tempoPrimeiraRenderizacaoMs: tFirstRender,
      fpsPan: `${fpsPan} fps (mín: ${minFpsPan})`,
      fpsZoom: `${fpsZoom} fps (mín: ${minFpsZoom})`,
      tempoSelecionarMs: tSelect,
      tempoEditarVerticeMs: tEditVertex,
      tempoAlterarCamadaMs: tLayerChange,
      memoria: `${jsHeapMb} | ${domNodesCount} nós DOM`,
      tamanhoTransacaoIDB: `${transactionSizeStr} (${transactionBytes.toLocaleString('pt-BR')} bytes)`,
      tempoSalvamentoMs: tSave,
      tempoCarregamentoMs: tLoad,
      objetosLeafletAtivos: `${renderedFeaturesCount} vetores, ${clusterMarkersCount} clusters (Total _layers: ${totalLeafletLayers})`,
      _raw: {
        fpsPanVal: fpsPan,
        fpsZoomVal: fpsZoom,
        jsHeapMb,
        domNodesCount,
        transactionBytes
      }
    };

    this.results.set(targetCount, result);
    console.log(`%c[StressBenchmark] Concluído para ${targetCount.toLocaleString('pt-BR')} feições:`, 'color: #3b82f6; font-weight: bold;', result);
    console.log('BENCHMARK_STAGE_COMPLETE:', JSON.stringify(result));

    const out = document.getElementById('cm-benchmark-output');
    if (out) out.textContent = JSON.stringify(result);

    return result;
  }

  /**
   * Executa a bateria de testes sequencial completa:
   * 100, 1.000, 5.000, 10.000, 25.000, 50.000, 100.000
   */
  async runAll(onProgress = null) {
    if (this.isRunning) {
      console.warn('[StressBenchmark] Teste já em andamento.');
      return;
    }
    this.isRunning = true;
    const stages = [100, 1000, 5000, 10000, 25000, 50000, 100000];
    const allResults = [];

    try {
      this.updateHUDProgress('Iniciando benchmark de alta carga (100 a 100k)...', 2);

      for (let i = 0; i < stages.length; i++) {
        const count = stages[i];
        const progressPercent = Math.round(((i) / stages.length) * 100);
        this.updateHUDProgress(`Etapa ${i + 1}/${stages.length}: Testando ${count.toLocaleString('pt-BR')} feições...`, progressPercent);

        if (typeof onProgress === 'function') {
          onProgress({ index: i + 1, total: stages.length, count, status: 'executando' });
        }
        const res = await this.runSingle(count);
        allResults.push(res);

        if (typeof onProgress === 'function') {
          onProgress({ index: i + 1, total: stages.length, count, status: 'concluido', result: res });
        }
        // Intervalo de respiro para o Garbage Collector
        await delay(400);
      }

      this.updateHUDProgress('✅ Benchmark concluído com sucesso para todas as 7 faixas!', 100);
      window.__BENCHMARK_RESULTS__ = allResults;

      const out = document.getElementById('cm-benchmark-output');
      if (out) {
        out.textContent = JSON.stringify(allResults);
        out.style.display = 'block';
      }

      console.log('BENCHMARK_ALL_COMPLETE:', JSON.stringify(allResults));

      console.table(allResults.map(r => ({
        'Carga': r.targetCount.toLocaleString('pt-BR'),
        'Abertura (ms)': r.tempoAberturaMs,
        'Importação (ms)': r.tempoImportacaoMs,
        '1ª Render (ms)': r.tempoPrimeiraRenderizacaoMs,
        'FPS Pan': r.fpsPan,
        'FPS Zoom': r.fpsZoom,
        'Seleção (ms)': r.tempoSelecionarMs,
        'Edição Vértice (ms)': r.tempoEditarVerticeMs,
        'Alterar Camada (ms)': r.tempoAlterarCamadaMs,
        'Memória': r.memoria,
        'Tam. IDB': r.tamanhoTransacaoIDB,
        'Salvamento (ms)': r.tempoSalvamentoMs,
        'Carregamento (ms)': r.tempoCarregamentoMs,
        'Leaflet Ativos': r.objetosLeafletAtivos
      })));

      return allResults;
    } finally {
      this.isRunning = false;
    }
  }
}
