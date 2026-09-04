import { SpatialIndex } from '../src/services/SpatialIndex.js';

console.log('--- Testando SpatialIndex com RBush (100.000 feições) ---');

const index = new SpatialIndex();

const mockFeatures = [];
for (let i = 0; i < 100000; i++) {
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
console.log(`Index build com 100.000 feições: ${tBuild.toFixed(2)}ms (tamanho: ${index.size})`);

const bounds = {
  minLat: -15.82,
  maxLat: -15.78,
  minLng: -47.92,
  maxLng: -47.88
};

const t0Query = performance.now();
const results = index.query(bounds, 0.0);
const tQuery = performance.now() - t0Query;
console.log(`Query espacial para 100k feições: ${tQuery.toFixed(3)}ms (encontrou: ${results.length} feições)`);

console.log('--- Teste concluído com sucesso! ---');
