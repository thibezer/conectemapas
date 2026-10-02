import assert from 'assert';
import { SpatialIndex } from '../src/services/SpatialIndex.js';
import { SpatialAlgorithms } from '../src/services/SpatialAlgorithms.js';

console.log('--- TESTE: Validação do Algoritmo de Seleção Geométrica Exata (Narrow-Phase) ---');

const features = [
  {
    id: 'feat-rota-01',
    name: 'Eixo da Rodovia Vicinal VC-04',
    type: 'LineString',
    layerId: 'layer-vistorias',
    coordinates: [
      [-15.8060, -47.8750],
      [-15.7980, -47.8690],
      [-15.7910, -47.8630],
      [-15.7860, -47.8540]
    ]
  },
  {
    id: 'feat-app-01',
    name: 'Reserva Legal & Mata Ciliar (APP)',
    type: 'Polygon',
    layerId: 'layer-ambiental',
    coordinates: [
      [-15.7920, -47.8720],
      [-15.7880, -47.8650],
      [-15.7940, -47.8610],
      [-15.8010, -47.8670],
      [-15.7970, -47.8730]
    ]
  },
  {
    id: 'feat-marco-01',
    name: 'Marco M-01',
    type: 'Point',
    layerId: 'layer-topografia',
    coordinates: [-15.7950, -47.8600]
  },
  {
    id: 'feat-circulo-01',
    name: 'Pivô Central',
    type: 'Circle',
    layerId: 'layer-agro',
    coordinates: [-15.8100, -47.8500],
    radius: 300 // 300 metros
  }
];

const index = new SpatialIndex();
index.build(features);

// 1. Caixa em área vazia (onde antes o BBox da rodovia dava falso positivo)
const emptyBox = {
  getSouth: () => -15.7870,
  getNorth: () => -15.7865,
  getWest: () => -47.8740,
  getEast: () => -47.8735
};

const candidates1 = index.query(emptyBox, 0);
const selected1 = candidates1.filter(f => SpatialAlgorithms.featureIntersectsBounds(f, emptyBox));
console.log('1. Caixa em área vazia: selecionou', selected1.length, 'feições');
assert.strictEqual(selected1.length, 0, 'Área vazia NÃO deve selecionar nenhuma feição!');

// 2. Caixa no canto vazio do BBox do Polígono APP (onde antes o polígono dava falso positivo)
const emptyCornerBox = {
  getSouth: () => -15.7895,
  getNorth: () => -15.7890,
  getWest: () => -47.8725,
  getEast: () => -47.8720
};

const candidates2 = index.query(emptyCornerBox, 0);
const selected2 = candidates2.filter(f => SpatialAlgorithms.featureIntersectsBounds(f, emptyCornerBox));
console.log('2. Canto vazio do BBox do Polígono: selecionou', selected2.length, 'feições');
assert.strictEqual(selected2.length, 0, 'Canto vazio do polígono NÃO deve ser selecionado!');

// 3. Caixa que REALMENTE toca a borda do Polígono APP
const touchingPolyBox = {
  getSouth: () => -15.7930,
  getNorth: () => -15.7915,
  getWest: () => -47.8725,
  getEast: () => -47.8710
};

const candidates3 = index.query(touchingPolyBox, 0);
const selected3 = candidates3.filter(f => SpatialAlgorithms.featureIntersectsBounds(f, touchingPolyBox));
console.log('3. Caixa que encosta no Polígono: selecionou', selected3.map(f => f.name));
assert.strictEqual(selected3.some(f => f.id === 'feat-app-01'), true, 'Deve selecionar o polígono quando encosta nele');

// 4. Caixa que REALMENTE cruza o segmento da Linha VC-04
const crossingLineBox = {
  getSouth: () => -15.7865,
  getNorth: () => -15.7855,
  getWest: () => -47.8545,
  getEast: () => -47.8535
};

const candidates4 = index.query(crossingLineBox, 0);
const selected4 = candidates4.filter(f => SpatialAlgorithms.featureIntersectsBounds(f, crossingLineBox));
console.log('4. Caixa que cruza a Linha: selecionou', selected4.map(f => f.name));
assert.strictEqual(selected4.some(f => f.id === 'feat-rota-01'), true, 'Deve selecionar a linha quando cruza ela');

// 5. Caixa contendo o Ponto Marco M-01
const pointBox = {
  getSouth: () => -15.7955,
  getNorth: () => -15.7945,
  getWest: () => -47.8605,
  getEast: () => -47.8595
};

const candidates5 = index.query(pointBox, 0);
const selected5 = candidates5.filter(f => SpatialAlgorithms.featureIntersectsBounds(f, pointBox));
console.log('5. Caixa contendo Ponto: selecionou', selected5.map(f => f.name));
assert.strictEqual(selected5.some(f => f.id === 'feat-marco-01'), true, 'Deve selecionar o ponto quando contido');

// 6. Caixa que NÃO encosta no ponto (perto, mas sem encostar)
const nearPointBox = {
  getSouth: () => -15.7960,
  getNorth: () => -15.7955,
  getWest: () => -47.8605,
  getEast: () => -47.8595
};
const selectedNearPoint = index.query(nearPointBox, 0).filter(f => SpatialAlgorithms.featureIntersectsBounds(f, nearPointBox));
console.log('6. Caixa perto do ponto mas sem encostar: selecionou', selectedNearPoint.length, 'feições');
assert.strictEqual(selectedNearPoint.some(f => f.id === 'feat-marco-01'), false, 'Não deve selecionar o ponto sem encostar');

// 7. Círculo: Caixa no canto do BBox do círculo (sem encostar na circunferência)
// Centro: [-15.8100, -47.8500], raio 300m (~0.0027 graus)
// BBox do círculo vai de -15.8127 a -15.8073, e -47.8527 a -47.8473.
// No canto (-15.8075, -47.8475), a distância ao centro é sqrt(0.0025^2 + 0.0025^2) * 111139 = 392m > 300m (fora do círculo!)
const circleCornerBox = {
  getSouth: () => -15.8076,
  getNorth: () => -15.8074,
  getWest: () => -47.8476,
  getEast: () => -47.8474
};
const selectedCircleCorner = index.query(circleCornerBox, 0).filter(f => SpatialAlgorithms.featureIntersectsBounds(f, circleCornerBox));
console.log('7. Canto do BBox do Círculo (sem encostar): selecionou', selectedCircleCorner.length, 'feições');
assert.strictEqual(selectedCircleCorner.some(f => f.id === 'feat-circulo-01'), false, 'Não deve selecionar círculo no canto vazio do BBox');

console.log('--- TODOS OS TESTES DE SELEÇÃO GEOMÉTRICA PASSARAM COM 100% DE SUCESSO! ---');
