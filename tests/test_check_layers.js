import { requireTestApiUrl } from './_cloud_target.js';
const fetch = globalThis.fetch;

async function checkLayers() {
  const url = requireTestApiUrl();
  const res = await fetch(`${url}?action=load&projectId=projeto_padrao`);
  const data = await res.json();
  console.log('Camadas no banco:', data.layers);
}

checkLayers().catch(console.error);
