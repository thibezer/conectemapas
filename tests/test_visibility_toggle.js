import assert from 'assert';
import { GeoCompressor } from '../src/services/GeoCompressor.js';
import { normalizeFeature } from '../src/services/MockData.js';

console.log('--- Testando Ciclo de Vida da Visibilidade (Olhinho) ---');

// 1. Teste no GeoCompressor
const feat = {
  id: 'feat-test-1',
  name: 'Polígono Teste',
  type: 'Polygon',
  layerId: 'layer-1',
  coordinates: [[-23.76, -53.32], [-23.76, -53.31], [-23.75, -53.31]],
  visible: false
};

const compacted = GeoCompressor.compactFeatureForStorage(feat);
console.log('Compacted feature visible property:', compacted.visible);
assert.strictEqual(compacted.visible, false, 'GeoCompressor DEVE preservar visible: false');

console.log('✔ GeoCompressor preserva visible com sucesso!');
