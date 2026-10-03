const fetch = globalThis.fetch;

async function testFullRealtimeCycle() {
  const url = 'https://lavender-panther-702784.hostingersite.com/api.php';
  console.log('=== TESTE DE CICLO DE SALVAMENTO EM TEMPO REAL ===\n');

  // 1. Testa renomeação de camada
  console.log('1. Renomeando camada "layer-topografia" para "Topografia e APP (Atualizado)"...');
  const resMeta = await fetch(`${url}?action=save_metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'projeto_padrao',
      name: 'Levantamento Planialtimétrico - Brasília',
      layers: [
        { id: 'layer-topografia', name: 'Topografia e APP (Atualizado)', color: '#00E08A', type: 'custom', visible: true, opacity: 1, order: 0 }
      ]
    })
  });
  console.log('save_metadata status:', resMeta.status, await resMeta.json());

  // 2. Verifica se a camada foi realmente salva com o novo nome
  const resLoad1 = await fetch(`${url}?action=load&projectId=projeto_padrao&_nocache=${Date.now()}`);
  const data1 = await resLoad1.json();
  const topoLayer = data1.layers.find(l => l.id === 'layer-topografia');
  console.log('Nome da camada retornado pelo load:', topoLayer?.name);
  if (topoLayer?.name !== 'Topografia e APP (Atualizado)') {
    throw new Error('Falha: Nome da camada não persistiu!');
  }
  console.log('-> Sucesso: Nome da pasta/camada persistiu com sucesso!\n');

  // 3. Cria feição teste na camada "layer-topografia"
  console.log('2. Criando feição teste na camada "layer-topografia"...');
  const testFeatId = 'feat-rt-test-' + Date.now();
  await fetch(`${url}?action=sync_deltas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: 'projeto_padrao',
      toUpsert: [{
        id: testFeatId,
        layerId: 'layer-topografia',
        name: 'Objeto Teste Tempo Real',
        type: 'Point',
        coordinates: [-23.76, -53.32],
        properties: { teste: true },
        style: { color: '#00E08A' },
        color: '#00E08A',
        createdBy: 'Thiago'
      }],
      toDelete: []
    })
  });

  // 4. Transfere feição teste para a camada "layer-ambiental"
  console.log('3. Transferindo feição teste para "layer-ambiental"...');
  await fetch(`${url}?action=sync_deltas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: 'projeto_padrao',
      toUpsert: [{
        id: testFeatId,
        layerId: 'layer-ambiental',
        name: 'Objeto Teste Tempo Real (Movido)',
        type: 'Point',
        coordinates: [-23.76, -53.32],
        properties: { teste: true, movido: true },
        style: { color: '#10b981' },
        color: '#10b981',
        createdBy: 'Thiago'
      }],
      toDelete: []
    })
  });

  // 5. Verifica se a transferência persistiu
  const resLoad2 = await fetch(`${url}?action=load&projectId=projeto_padrao&_nocache=${Date.now()}`);
  const data2 = await resLoad2.json();
  const movedFeat = data2.features.find(f => f.id === testFeatId);
  console.log('Feição após transferência:', movedFeat ? { id: movedFeat.id, layerId: movedFeat.layerId, name: movedFeat.name } : 'Não encontrada!');
  if (!movedFeat || movedFeat.layerId !== 'layer-ambiental') {
    throw new Error('Falha: Transferência de camada não persistiu!');
  }
  console.log('-> Sucesso: Transferência de pasta persistiu com sucesso!\n');

  // 6. Exclui a feição teste
  console.log('4. Excluindo a feição teste...');
  await fetch(`${url}?action=sync_deltas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: 'projeto_padrao',
      toUpsert: [],
      toDelete: [testFeatId]
    })
  });

  // 7. Verifica se a feição sumiu no load
  const resLoad3 = await fetch(`${url}?action=load&projectId=projeto_padrao&_nocache=${Date.now()}`);
  const data3 = await resLoad3.json();
  const deletedFeat = data3.features.find(f => f.id === testFeatId);
  console.log('Feição encontrada após exclusão?', deletedFeat ? 'SIM (ERRO: RESSUSCITOU)' : 'NÃO (corretamente excluída)');
  if (deletedFeat) {
    throw new Error('Falha: Feição ressuscitou após exclusão!');
  }
  console.log('-> Sucesso: Exclusão persistiu e não ressuscitou!\n');

  console.log('=== TODOS OS TESTES PASSARAM COM 100% DE SUCESSO! ===');
}

testFullRealtimeCycle().catch(err => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
