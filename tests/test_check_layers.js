const fetch = globalThis.fetch;

async function checkLayers() {
  const url = 'https://lavender-panther-702784.hostingersite.com/api.php';
  const res = await fetch(`${url}?action=load&projectId=projeto_padrao`);
  const data = await res.json();
  console.log('Camadas no banco:', data.layers);
}

checkLayers().catch(console.error);
