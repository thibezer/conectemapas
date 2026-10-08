import { requireTestApiUrl } from './_cloud_target.js';
const fetch = globalThis.fetch;

async function query() {
  const url = requireTestApiUrl();
  const res = await fetch(`${url}?action=load&projectId=projeto_padrao`);
  const data = await res.json();
  const f = data.features.find(item => item.id.includes('feat-test-debug'));
  console.log('Encontrou?', f);
}

query().catch(console.error);
