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

// 5. joinMany: 3 linhas encadeadas (estrito), em ordem embaralhada e com sentidos invertidos
const L = (...pts) => ({ type: 'LineString', coordinates: pts });
const l1 = L([-23.7600, -53.3200], [-23.7610, -53.3210]);
const l2 = L([-23.7620, -53.3220], [-23.7610, -53.3210]); // invertida
const l3 = L([-23.7620, -53.3220], [-23.7630, -53.3230]);
const strict3 = SpatialAlgorithms.joinMany([l3, l1, l2]);
assert(strict3.success, 'Junção estrita de 3 linhas conectadas deve funcionar');
assert.strictEqual(strict3.coordinates.length, 4, 'Emendas não duplicam vértices');
assert.strictEqual(strict3.bridges, 0);
console.log('✔ joinMany estrito: 3 linhas conectadas');

// 6. Estrito junta só o que se toca: a linha afastada fica de fora
const lGap = L([-23.7700, -53.3300], [-23.7710, -53.3310]);
const strictGap = SpatialAlgorithms.joinMany([l1, l2, lGap]);
assert(strictGap.success && strictGap.results.length === 1, 'Estrito deve unir o grupo conectado');
assert.deepStrictEqual(strictGap.results[0].sources.sort(), [0, 1], 'A linha afastada não deve ser consumida');
assert(!SpatialAlgorithms.joinMany([l1, lGap]).success, 'Estrito falha se nada se toca');
console.log('✔ joinMany estrito: une o conectado e deixa o desconectado de fora');

// 6b. Duas "caixas" de 4 linhas cada, selecionadas juntas e embaralhadas => 2 polígonos
const box = (x, y) => [
  L([x, y], [x, y + 0.001]),
  L([x, y + 0.001], [x + 0.001, y + 0.001]),
  L([x + 0.001, y + 0.001], [x + 0.001, y]),
  L([x + 0.001, y], [x, y])
];
const b1 = box(-23.76, -53.32), b2 = box(-23.78, -53.34);
const eight = [b1[0], b2[2], b1[1], b2[0], b1[3], b2[1], b1[2], b2[3]];
const boxes = SpatialAlgorithms.joinMany(eight);
assert(boxes.success, 'Duas caixas devem ser unidas de uma vez');
assert.strictEqual(boxes.results.length, 2, 'Deve gerar 2 resultados');
boxes.results.forEach((r) => {
  assert.strictEqual(r.type, 'Polygon', 'Linhas que fecham viram polígono');
  assert.strictEqual(r.coordinates.length, 4, 'Quadrado com 4 vértices');
  assert.strictEqual(r.sources.length, 4);
});
console.log('✔ joinMany estrito: 8 linhas => 2 quadrados (polígonos)');

// 7. Com ponte: liga as desconectadas
const bridged = SpatialAlgorithms.joinMany([l1, l2, lGap], { bridge: true });
assert(bridged.success, 'Com ponte deve unir tudo');
assert.strictEqual(bridged.bridges, 1);
assert(bridged.bridgeLength > 1000, 'Comprimento da ponte deve ser informado em metros');
assert.strictEqual(bridged.coordinates.length, 5);
console.log('✔ joinMany com ponte: 3 linhas, 1 trecho de junção');

// 8. Polígonos: 3 adjacentes (estrito) e 1 afastado (só com ponte)
const sq = (x, y) => ({ type: 'Polygon', coordinates: [[x, y], [x, y + 10], [x + 10, y + 10], [x + 10, y]] });
const pA = sq(0, 0), pB = sq(10, 0), pC = sq(20, 0), pFar = sq(100, 0);
const polyStrict = SpatialAlgorithms.joinMany([pA, pB, pC]);
assert(polyStrict.success && polyStrict.type === 'Polygon', 'Polígonos adjacentes devem virar um polígono');
const polyStrictFar = SpatialAlgorithms.joinMany([pA, pB, pFar]);
assert(polyStrictFar.success && polyStrictFar.results.length === 1, 'Estrito une só o par adjacente');
assert.deepStrictEqual(polyStrictFar.results[0].sources.sort(), [0, 1], 'Polígono afastado fica de fora');
assert(!SpatialAlgorithms.joinMany([pA, pFar]).success, 'Estrito falha se nenhum polígono se toca');
const polyBridge = SpatialAlgorithms.joinMany([pA, pB, pFar], { bridge: true });
assert(polyBridge.success && polyBridge.type === 'Polygon' && polyBridge.bridges === 1, 'Ponte deve gerar polígono único');
console.log('✔ joinMany polígonos: estrito e com ponte');

// 9. Apenas 1 feição de cada tipo juntável (nenhuma tem par)
assert(!SpatialAlgorithms.joinMany([l1, pA], { bridge: true }).success, 'Sem pares compatíveis a junção deve falhar');
console.log('✔ joinMany recusa quando não há pares compatíveis para unir');

// 10. Peças não juntáveis selecionadas no meio de juntáveis (ex: Linhas + Ponto)
const ptNonJoinable = { type: 'Point', coordinates: [-23.7650, -53.3250] };
const resMixedWithPoint = SpatialAlgorithms.joinMany([l1, ptNonJoinable, l2]);
assert(resMixedWithPoint.success, 'Deve unir as linhas mesmo com ponto no meio');
assert.strictEqual(resMixedWithPoint.results.length, 1);
assert.deepStrictEqual(resMixedWithPoint.results[0].sources, [0, 2], 'Deve consumir apenas as linhas (índices 0 e 2) e preservar o ponto');
assert.strictEqual(resMixedWithPoint.unmergedCount, 1, 'Ponto deve ser contado como não unido');
console.log('✔ joinMany tolera pontos e peças não juntáveis no meio de peças juntáveis');

// 11. Seleção mista: 2 Linhas conectadas + 2 Polígonos adjacentes + Círculo
const circleNonJoinable = { type: 'Circle', coordinates: [-23.76, -53.32], radius: 100 };
const resMultiType = SpatialAlgorithms.joinMany([l1, ptNonJoinable, pA, circleNonJoinable, l2, pB]);
assert(resMultiType.success, 'Deve realizar junções simultâneas de tipos suportados');
assert.strictEqual(resMultiType.results.length, 2, 'Deve gerar 1 Linha unida e 1 Polígono unido');
assert.deepStrictEqual(resMultiType.consumedSources.sort((a, b) => a - b), [0, 2, 4, 5], 'Deve consumir as 2 linhas e os 2 polígonos');
assert.strictEqual(resMultiType.unmergedCount, 2, 'Ponto e Círculo devem ser preservados');
console.log('✔ joinMany realiza união simultânea de linhas e polígonos mantendo peças não juntáveis intactas');

// 12. Polígonos com 2 arestas consecutivas compartilhadas (L-shape e Quina)
const pL = {
  type: 'Polygon',
  coordinates: [
    [-23.7600, -53.3200],
    [-23.7600, -53.3220],
    [-23.7610, -53.3220],
    [-23.7610, -53.3210],
    [-23.7620, -53.3210],
    [-23.7620, -53.3200]
  ]
};
const pCorner = {
  type: 'Polygon',
  coordinates: [
    [-23.7610, -53.3210],
    [-23.7610, -53.3220],
    [-23.7620, -53.3220],
    [-23.7620, -53.3210]
  ]
};
const resMultiEdge = SpatialAlgorithms.joinMany([pL, pCorner]);
assert(resMultiEdge.success, 'Deve unir polígonos que compartilham 2 arestas');
assert.strictEqual(resMultiEdge.type, 'Polygon');
console.log('✔ joinMany polígonos com múltiplas arestas contíguas passou com sucesso');

// 13. Polígonos com nó em T (sub-aresta colinear)
const pLong = {
  type: 'Polygon',
  coordinates: [
    [-23.7600, -53.3200],
    [-23.7600, -53.3210],
    [-23.7620, -53.3210],
    [-23.7620, -53.3200]
  ]
};
const pSubEdge = {
  type: 'Polygon',
  coordinates: [
    [-23.7600, -53.3210],
    [-23.7600, -53.3220],
    [-23.7610, -53.3220],
    [-23.7610, -53.3210]
  ]
};
const resTJunction = SpatialAlgorithms.joinMany([pLong, pSubEdge]);
assert(resTJunction.success, 'Deve unir polígonos com nó em T');
assert.strictEqual(resTJunction.type, 'Polygon');
console.log('✔ joinMany polígonos com T-junction (vértice em aresta) passou com sucesso');

// 14. Polígonos com sobreposição parcial (overlap)
const pOver1 = {
  type: 'Polygon',
  coordinates: [
    [-23.7600, -53.3200],
    [-23.7600, -53.3210],
    [-23.7610, -53.3210],
    [-23.7610, -53.3200]
  ]
};
const pOver2 = {
  type: 'Polygon',
  coordinates: [
    [-23.7605, -53.3200],
    [-23.7605, -53.3210],
    [-23.7615, -53.3210],
    [-23.7615, -53.3200]
  ]
};
const resOverlap = SpatialAlgorithms.joinMany([pOver1, pOver2]);
assert(resOverlap.success, 'Deve unir polígonos com sobreposição');
assert.strictEqual(resOverlap.type, 'Polygon');
console.log('✔ joinMany polígonos com sobreposição (overlap) passou com sucesso');

// 15. Feição com geometria degenerada no meio de feições válidas
const corruptedLine = { type: 'LineString', coordinates: [[-23.76, -53.32]] }; // apenas 1 ponto
const corruptedPoly = { type: 'Polygon', coordinates: [] }; // vazio
const resCorrupted = SpatialAlgorithms.joinMany([l1, corruptedLine, corruptedPoly, l2]);
assert(resCorrupted.success, 'Não deve quebrar se houver feições corrompidas no meio');
assert.strictEqual(resCorrupted.results.length, 1);
assert.deepStrictEqual(resCorrupted.results[0].sources, [0, 3], 'Deve unir l1 (0) e l2 (3)');
console.log('✔ joinMany ignora com resiliência feições corrompidas e une as válidas');

console.log('🎉 Todos os testes de junção CAD passaram com 100% de sucesso!');

