const fetch = globalThis.fetch;

async function test() {
  const url = 'https://lavender-panther-702784.hostingersite.com/api.php';
  const id = 'feat-test-debug-' + Date.now();
  console.log('Criando feição:', id);

  const res1 = await fetch(`${url}?action=sync_deltas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: 'projeto_padrao',
      toUpsert: [{
        id: id,
        layerId: 'layer-topografia',
        name: 'Teste Debug',
        type: 'Point',
        coordinates: [-23.76, -53.32]
      }],
      toDelete: []
    })
  });
  console.log('Status sync_deltas:', res1.status, await res1.text());

  // Checa no pull_changes
  const resPull = await fetch(`${url}?action=pull_changes&projectId=projeto_padrao&since=1970-01-01`);
  const pullData = await resPull.json();
  const inPull = pullData.upserted.find(f => f.id === id);
  console.log('Encontrado no pull_changes?', !!inPull, inPull ? inPull.layerId : null);

  // Checa no load
  const resLoad = await fetch(`${url}?action=load&projectId=projeto_padrao`);
  const loadData = await resLoad.json();
  const inLoad = loadData.features.find(f => f.id === id);
  console.log('Encontrado no load?', !!inLoad, inLoad ? inLoad.layerId : null);
}

test().catch(console.error);
