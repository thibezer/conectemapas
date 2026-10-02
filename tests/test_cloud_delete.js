const fetch = globalThis.fetch;

async function testDeleteAndLoad() {
  const url = 'https://lavender-panther-702784.hostingersite.com/api.php';

  // 1. Deleta feat-test-123
  console.log('--- Deletando feat-test-123 ---');
  const resDel = await fetch(`${url}?action=sync_deltas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: 'projeto_padrao',
      toUpsert: [],
      toDelete: ['feat-test-123']
    })
  });
  console.log('Delete res:', await resDel.text());

  // 2. Chama load e verifica se feat-test-123 está na lista
  console.log('--- Verificando se aparece no load ---');
  const resLoad = await fetch(`${url}?action=load&projectId=projeto_padrao`);
  const data = await resLoad.json();
  const found = data.features.find(f => f.id === 'feat-test-123');
  console.log('feat-test-123 foi encontrada no load?', found ? 'SIM (ERRO!)' : 'NÃO (corretamente deletada)');
}

testDeleteAndLoad().catch(console.error);
