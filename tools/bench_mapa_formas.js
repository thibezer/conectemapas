/* ==========================================================================
   Benchmark do mapa com muitas formas (para colar no console do app em dev)

   Uso:
     1. npm run dev, abra http://localhost:5173/?project=bench_perf (projeto de teste, nada é gravado na nuvem)
     2. cole este arquivo inteiro no console
     3. await __bench.rodar(20000)           // uma carga
        await __bench.tabela([1000, 5000, 20000, 50000])

   Mede por MUDANÇA DE VISTA (pan + reconciliação do kit + redesenho dos canvases forçado por getImageData),
   sem depender de requestAnimationFrame (que o painel estrangula quando a janela perde o foco).
   Dados sintéticos: 50% polígonos de 14 vértices (~90 m), 25% linhas de 8 vértices, 25% pontos, em 5 camadas,
   num bloco de ~13 km. O zoom 12 é o pior caso (todas as formas na tela).

   Não grava nada: marca o app como "projeto fechado" para o flush ao sair não persistir as feições de teste.
   ========================================================================== */
(() => {
  const app = window.conecteMapasApp;
  const L = window.L;
  if (!app || !L) throw new Error('Rode no app em dev (window.conecteMapasApp e window.L precisam existir).');
  app._projectClosed = true;
  app.mapEngine.setBaseLayer('none');
  const map = app.mapEngine.map;
  const realRaf = window.requestAnimationFrame.bind(window);

  const gerar = (n) => {
    const camadas = app.layers.map(l => l.id);
    let s = 12345;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const out = [];
    for (let i = 0; i < n; i++) {
      const lat = -23.77 + (rnd() - 0.5) * 0.12;
      const lng = -53.32 + (rnd() - 0.5) * 0.12;
      const base = {
        id: 'bench-' + i, name: 'Feição ' + i, layerId: camadas[i % camadas.length], category: 'Teste',
        createdBy: 'bench', createdAt: '2026-01-01T00:00:00Z',
        style: { fillColor: '#3b82f6', strokeColor: '#ffffff', fillOpacity: 0.35, strokeWidth: 2 }, properties: {}
      };
      const k = i % 4;
      if (k === 0) out.push({ ...base, type: 'Point', coordinates: [lat, lng] });
      else if (k === 1) {
        const c = [];
        for (let j = 0; j < 8; j++) c.push([lat + j * 0.0003, lng + Math.sin(j) * 0.0004]);
        out.push({ ...base, type: 'LineString', coordinates: c });
      } else {
        const c = [];
        for (let j = 0; j < 14; j++) {
          const a = (j / 14) * Math.PI * 2;
          const r = 0.0008 * (0.7 + rnd() * 0.6);
          c.push([lat + Math.sin(a) * r, lng + Math.cos(a) * r]);
        }
        out.push({ ...base, type: 'Polygon', coordinates: c });
      }
    }
    return out;
  };

  const ceder = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
  const cederVarias = async () => { for (let i = 0; i < 5; i++) await ceder(); };
  const sincrono = (f) => { const t = performance.now(); f(); return +(performance.now() - t).toFixed(0); };

  const renderers = () => {
    const set = new Set();
    if (map._renderer) set.add(map._renderer);
    Object.values(map._paneRenderers || {}).forEach(r => set.add(r));
    return [...set];
  };
  // força o desenho e a rasterização agora (getImageData espera o canvas terminar)
  const forcarDesenho = () => {
    for (const r of renderers()) {
      if (r._redrawRequest) { L.Util.cancelAnimFrame(r._redrawRequest); r._redrawRequest = null; }
      try { r._redraw && r._redraw(); } catch { /* renderer sem _redraw */ }
      const c = r._container;
      if (c && c.width) { try { c.getContext('2d').getImageData(0, 0, 1, 1); } catch { /* canvas tainted */ } }
    }
  };
  const usarRafSincrono = () => {
    window.requestAnimationFrame = (cb) => { const c = new MessageChannel(); c.port1.onmessage = () => cb(performance.now()); c.port2.postMessage(0); return 1; };
  };
  const restaurarRaf = () => { window.requestAnimationFrame = realRaf; };

  const carregar = async (n) => {
    app.features = []; app.mapEngine.renderFeatures([], app.layers);
    app.historyUndo = []; app.historyRedo = []; app._historyIntern = null;
    await cederVarias();
    app.features = gerar(n);
    const renderFeatures_ms = sincrono(() => app.mapEngine.renderFeatures(app.features, app.layers));
    await cederVarias();
    return renderFeatures_ms;
  };

  const rodar = async (n, zooms = [12, 15, 18]) => {
    usarRafSincrono();
    try {
      const res = { formas: n, heapMB_antes: Math.round(performance.memory.usedJSHeapSize / 1048576) };
      res.renderFeatures_ms = await carregar(n);
      res.primeiro_desenho_ms = sincrono(forcarDesenho);
      for (const z of zooms) {
        map.setView([-23.77, -53.32], z, { animate: false });
        await cederVarias(); forcarDesenho();
        const totais = [];
        for (let i = 0; i < 4; i++) {
          const a = performance.now();
          map.panBy([i % 2 ? 60 : -60, 20], { animate: false });
          await cederVarias();
          forcarDesenho();
          totais.push(+(performance.now() - a).toFixed(0));
        }
        totais.sort((x, y) => x - y);
        res['mudanca_de_vista_z' + z + '_ms (mediana)'] = totais[2];
      }
      // operações pontuais
      map.setView([-23.77, -53.32], 14, { animate: false }); await cederVarias(); forcarDesenho();
      const alvo = app.features.find(f => f.type === 'Polygon');
      const medir = async (nome, fn) => {
        const t = performance.now(); fn(); const sinc = performance.now() - t;
        await cederVarias(); forcarDesenho();
        res[nome] = `${sinc.toFixed(0)} sinc / ${(performance.now() - t).toFixed(0)} total ms`;
      };
      await medir('selecionar_1', () => app.mapEngine.selectFeatures([alvo.id]));
      await medir('limpar_selecao', () => app.mapEngine.clearSelection());
      const dois_mil = app.features.slice(0, 2000).map(f => f.id);
      await medir('selecionar_2000', () => app.mapEngine.selectFeatures(dois_mil));
      await medir('limpar_selecao_2000', () => app.mapEngine.clearSelection());
      await medir('editar_1_feicao', () => app.mapEngine.updateFeature({ ...alvo, name: 'edit' }, app.layers));
      await medir('ocultar_camada', () => app.mapEngine.setLayerVisibility(app.layers[0].id, false));
      await medir('reexibir_camada', () => app.mapEngine.setLayerVisibility(app.layers[0].id, true));
      res.pushHistory_ms = sincrono(() => app.pushHistory('bench'));
      res.layerPanel_updateLayers_ms = sincrono(() => app.layerPanel.updateLayers(app.getLayersWithCounts(), app.features));
      res.heapMB_depois = Math.round(performance.memory.usedJSHeapSize / 1048576);
      res.camadas_leaflet_vivas = Object.keys(map._layers).length;
      res.canvases = renderers().length;
      return res;
    } finally {
      restaurarRaf();
      app.historyUndo = []; app.historyRedo = [];
    }
  };

  const tabela = async (tamanhos = [1000, 5000, 20000]) => {
    const linhas = [];
    for (const n of tamanhos) linhas.push(await rodar(n));
    console.table(linhas);
    return linhas;
  };

  window.__bench = { gerar, rodar, tabela };
  console.log('Benchmark pronto: await __bench.rodar(20000) | await __bench.tabela([1000, 5000, 20000, 50000])');
})();
