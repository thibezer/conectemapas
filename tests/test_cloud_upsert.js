import { requireTestApiUrl } from './_cloud_target.js';
const fetch = globalThis.fetch;

async function testCloud() {
  const url = requireTestApiUrl();

  // 1. Testa sync_deltas com upsert (modificação e troca de pasta)
  console.log('\n--- Testando sync_deltas (upsert) ---');
  const deltaPayload = {
    projectId: 'projeto_padrao',
    toUpsert: [
      {
        id: 'feat-test-123',
        layerId: 'layer-topografia',
        name: 'Feição Teste Modificada',
        type: 'Point',
        coordinates: [-23.76, -53.32],
        properties: { teste: '123' },
        style: { color: '#ff0000' },
        color: '#ff0000',
        createdBy: 'Thiago'
      }
    ],
    toDelete: []
  };
  const resDelta = await fetch(`${url}?action=sync_deltas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deltaPayload)
  });
  console.log('sync_deltas upsert code:', resDelta.status);
  console.log('sync_deltas upsert body:', await resDelta.text());
}

testCloud().catch(console.error);
