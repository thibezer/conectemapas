import assert from 'assert';
import { SpatialAlgorithms } from '../src/services/SpatialAlgorithms.js';

console.log('🧪 Iniciando testes de validação da ferramenta de junção CAD (SpatialAlgorithms.join)...');

// 1. Teste de junção de duas linhas conectadas
const lineA = [
  [-23.7600, -53.3200],
  [-23.7610, -53.3210]
];
const lineB = [
  [-23.7610, -53.3210],
  [-23.7620, -53.3220]
];

const resLines = SpatialAlgorithms.joinLines(lineA, lineB);
assert(resLines.success, 'Junção de linhas deve ser bem sucedida');
assert.strictEqual(resLines.coordinates.length, 3, 'Linhas conectadas devem ter 3 vértices (removendo nó duplicado na emenda)');
console.log('✔ Junção de duas linhas com nó compartilhado passou com sucesso');

// 2. Teste de junção de duas linhas com pontas invertidas
const lineC = [
  [-23.7630, -53.3230],
  [-23.7620, -53.3220]
];
const resInvert = SpatialAlgorithms.joinLines(lineA, lineC);
assert(resInvert.success, 'Junção de linhas com pontas invertidas deve funcionar');
console.log('✔ Junção de duas linhas invertidas passou com sucesso');

// 3. Teste de junção de dois polígonos adjacentes (compartilhando uma aresta)
// Polígono 1: [0,0] -> [0,10] -> [10,10] -> [10,0]
// Aresta direita de poly1 é [10,0] até [10,10] (ou [10,10] até [10,0])
// Polígono 2 adjacente à direita: [10,0] -> [10,10] -> [20,10] -> [20,0]
const poly1 = [
  [0, 0],
  [0, 10],
  [10, 10],
  [10, 0]
];
const poly2 = [
  [10, 0],
  [10, 10],
  [20, 10],
  [20, 0]
];

const resPoly = SpatialAlgorithms.joinPolygons(poly1, poly2);
assert(resPoly.success, 'Junção de polígonos deve ser bem sucedida');
console.log('Tipo retornado na união de polígonos:', resPoly.type);
console.log('✔ Junção de dois polígonos adjacentes passou com sucesso');

// 4. Teste de joinFeatures
const featLineA = { type: 'LineString', coordinates: lineA };
const featLineB = { type: 'LineString', coordinates: lineB };
const resFeat = SpatialAlgorithms.joinFeatures(featLineA, featLineB);
assert(resFeat.success, 'joinFeatures deve unir feições de linha');
assert.strictEqual(resFeat.type, 'LineString');

console.log('🎉 Todos os testes de junção CAD passaram com 100% de sucesso!');
