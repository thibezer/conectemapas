import { SpatialIndex } from '../src/services/SpatialIndex.js';

console.log('--- Testando SpatialIndex com RBush ---');

const index = new SpatialIndex();

// Gerando 10.000 feições simuladas
const mockFeatures = [];
for (let i = 0; i < 10000; i++) {
  const lat = -15.8 + (Math.random() - 0.5) * 0.5;
  const lng = -47.9 + (Math.random() - 0.5) * 0.5;
  mockFeatures.push({
    id: `feat-${i}`,
    type: 'Point',
    coordinates: [lat, lng],
    properties: { name: `Ponto ${i}` }
  });
}

const t0 = performance.now();
index.build(mockFeatures);
const tBuild = performance.now() - t0;
console.log(`Index build com 10.000 feições: ${tBuild.toFixed(2)}ms (tamanho: ${index.size})`);

// Query em uma viewport delimitada
const bounds = {
  minLat: -15.82,
  maxLat: -15.78,
  minLng: -47.92,
  maxLng: -47.88
};

const t0Query = performance.now();
const results = index.query(bounds, 0.0);
const tQuery = performance.now() - t0Query;
console.log(`Query espacial: ${tQuery.toFixed(3)}ms (encontrou: ${results.length} feições)`);

// Teste de inserção e remoção
const newFeat = {
  id: 'feat-test-99999',
  type: 'Point',
  coordinates: [-15.80, -47.90],
  properties: { name: 'Novo Ponto' }
};

index.insert(newFeat);
console.log(`Após insert: has('feat-test-99999') = ${index.has('feat-test-99999')} (tamanho: ${index.size})`);

index.remove('feat-test-99999');
console.log(`Após remove: has('feat-test-99999') = ${index.has('feat-test-99999')} (tamanho: ${index.size})`);

console.log('--- Teste concluído com sucesso! ---');
