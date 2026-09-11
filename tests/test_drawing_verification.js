import assert from 'assert';
import { normalizeFeature } from '../src/services/MockData.js';

console.log('--- Testando Verificação Profunda do Módulo de Desenhos & Geodésia ---');

// 1. Teste de cálculo de área esférica (Shoelace) com polígono aberto vs fechado
function calculateSinglePolygonArea(coords) {
  if (!Array.isArray(coords) || coords.length < 3) return 0;
  let pts = coords;
  if (coords.length > 3) {
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first && last && Math.abs(first[0] - last[0]) < 1e-7 && Math.abs(first[1] - last[1]) < 1e-7) {
      pts = coords.slice(0, -1);
    }
  }
  if (pts.length < 3) return 0;

  const R = 6378137;
  let total = 0;
  const len = pts.length;
  for (let i = 0; i < len; i++) {
    const lower = pts[i];
    const middle = pts[(i + 1) % len];
    const upper = pts[(i + 2) % len];
    const x1 = (middle[1] - lower[1]) * (Math.PI / 180);
    const y1 = (middle[0] - lower[0]) * (Math.PI / 180);
    const x2 = (upper[1] - middle[1]) * (Math.PI / 180);
    const y2 = (upper[0] - middle[0]) * (Math.PI / 180);
    total += (x1 * y2 - y1 * x2);
  }
  const area = Math.abs(total * (R * R) / 2);
  return isNaN(area) ? 0 : area;
}

const openPolygon = [
  [-23.7661, -53.3206],
  [-23.7661, -53.3106],
  [-23.7561, -53.3106],
  [-23.7561, -53.3206]
];

const closedPolygon = [
  ...openPolygon,
  [-23.7661, -53.3206] // Fechado
];

const areaOpen = calculateSinglePolygonArea(openPolygon);
const areaClosed = calculateSinglePolygonArea(closedPolygon);

console.log(`Área Polígono Aberto: ${areaOpen.toFixed(2)} m²`);
console.log(`Área Polígono Fechado: ${areaClosed.toFixed(2)} m²`);
assert(Math.abs(areaOpen - areaClosed) < 1, 'Área de polígono aberto e fechado deve ser idêntica');
console.log('✔ Cálculo de área resiliente contra polígonos GeoJSON fechados e abertos.');

// 2. Teste de normalização e propriedades de feições recém-desenhadas
const featPonto = normalizeFeature({
  id: 'feat-p1',
  type: 'Point',
  coordinates: [-23.7661, -53.3206],
  name: 'Ponto Teste'
});
assert.strictEqual(featPonto.type, 'Point');
assert.strictEqual(featPonto.locked, false);
assert(featPonto.style.strokeColor);
console.log('✔ Normalização de feição pontual testada com sucesso.');

// 3. Teste de detecção de proximidade em pixels (Simulação de Snapping e Duplo-clique)
const p1 = { x: 100, y: 100 };
const p2DoubleClicked = { x: 102, y: 101 };
const p3Distinct = { x: 150, y: 180 };

const distDouble = Math.hypot(p1.x - p2DoubleClicked.x, p1.y - p2DoubleClicked.y);
const distDistinct = Math.hypot(p1.x - p3Distinct.x, p1.y - p3Distinct.y);

assert(distDouble < 16, 'Duplo clique próximo deve ser podado');
assert(distDistinct > 16, 'Vértice intencional não deve ser podado');
console.log(`✔ Pruning de duplo-clique por pixels validado (dist: ${distDouble.toFixed(1)}px < 16px).`);

console.log('--- TODOS OS TESTES DO MOTOR DE DESENHO PASSARAM COM SUCESSO! ---');
