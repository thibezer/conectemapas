const fetch = globalThis.fetch;

async function testCloud() {
  const url = 'https://lavender-panther-702784.hostingersite.com/api.php';
  
  // 1. Testa status
  console.log('--- Testando status ---');
  const resStatus = await fetch(`${url}?action=status`);
  console.log('Status code:', resStatus.status);
  console.log('Status body:', await resStatus.text());

  // 2. Testa save_metadata com uma camada renomeada
  console.log('\n--- Testando save_metadata ---');
  const metaPayload = {
    id: 'projeto_padrao',
    name: 'Levantamento Planialtimétrico - Brasília',
    layers: [
      { id: 'layer-cad-dwg', name: 'AutoCAD Teste', color: '#00E08A', type: 'cad', visible: true, opacity: 1, order: 0 }
    ]
  };
  const resMeta = await fetch(`${url}?action=save_metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metaPayload)
  });
  console.log('save_metadata code:', resMeta.status);
  console.log('save_metadata body:', await resMeta.text());

  // 3. Testa sync_deltas com deleção
  console.log('\n--- Testando sync_deltas (delete) ---');
  const deltaPayload = {
    projectId: 'projeto_padrao',
    toUpsert: [],
    toDelete: ['test-dummy-id-999']
  };
  const resDelta = await fetch(`${url}?action=sync_deltas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deltaPayload)
  });
  console.log('sync_deltas code:', resDelta.status);
  console.log('sync_deltas body:', await resDelta.text());
}

testCloud().catch(console.error);
