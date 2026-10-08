import { SpatialAlgorithms } from '../src/services/SpatialAlgorithms.js';

console.log('🧪 Testando splitPolygonWithLine...');

// Quadrado 10x10: [0,0], [0,10], [10,10], [10,0]
const square = [
  [0, 0],
  [0, 10],
  [10, 10],
  [10, 0]
];

// Linha de corte cortando no meio (lat = 5) de lng = -2 até lng = 12
const cutLine = [
  [5, -2],
  [5, 12]
];

const res = SpatialAlgorithms.splitPolygonWithLine(square, cutLine);
console.log('Resultado do split:', res.success ? 'SUCESSO' : 'FALHA: ' + res.reason);

if (!res.success) {
  process.exit(1);
}

if (!res.polygons || res.polygons.length !== 2) {
  console.error('Esperava 2 polígonos, obteve:', res.polygons?.length);
  process.exit(1);
}

console.log('Polígono 1 vértices:', res.polygons[0].length);
console.log('Polígono 2 vértices:', res.polygons[1].length);

// Linha que não cruza o polígono
const lineNoIntersect = [
  [20, 0],
  [20, 10]
];
const resFail = SpatialAlgorithms.splitPolygonWithLine(square, lineNoIntersect);
if (resFail.success) {
  console.error('Deveria ter falhado para linha externa');
  process.exit(1);
}

console.log('✔ Todos os testes de splitPolygonWithLine passaram com sucesso!');
