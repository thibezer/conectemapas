import assert from 'assert';
import { DrawingPenHelper } from '../src/services/MapEngine/DrawingPenHelper.js';

console.log('🧪 Iniciando testes da Caneta (retas + curvas Bézier)...');

const A = (p, hIn = null, hOut = null) => ({ p, hIn, hOut });

// 1. Âncoras sem alças geram só retas (um vértice por âncora)
const straight = DrawingPenHelper.flattenPath([A([0, 0]), A([0, 0.001]), A([0.001, 0.001])]);
assert.deepStrictEqual(straight, [[0, 0], [0, 0.001], [0.001, 0.001]]);
console.log('✔ Âncoras sem alças geram segmentos retos');

// 2. Segmento curvo gera vértices intermediários e termina exatamente na âncora
const curved = DrawingPenHelper.flattenPath([
  A([0, 0], null, [0.001, 0.0005]),
  A([0, 0.002], [0.001, 0.0015], null)
], false, { steps: 10 });
assert.strictEqual(curved.length, 11, 'início + 10 amostras');
assert.deepStrictEqual(curved[0], [0, 0]);
assert.deepStrictEqual(curved[curved.length - 1], [0, 0.002]);
const maxLat = Math.max(...curved.map(p => p[0]));
assert(maxLat > 0.0005 && maxLat < 0.001, 'A curva deve abaulhar na direção das alças');
console.log('✔ Segmento curvo é amostrado e abaulha na direção das alças');

// 3. Mistura: reta -> curva -> reta no mesmo traçado
const mixed = DrawingPenHelper.flattenPath([
  A([0, 0]),
  A([0, 0.001], null, [0.0005, 0.0015]),
  A([0, 0.003], [0.0005, 0.0025], null),
  A([0, 0.004])
], false, { steps: 6 });
assert.strictEqual(mixed.length, 1 + 1 + 6 + 1, 'reta (1) + curva (6) + reta (1) + início');
console.log('✔ Retas e curvas podem ser misturadas no mesmo traçado');

// 4. Fechado: não repete o primeiro vértice e inclui o segmento de fechamento curvo
const closedStraight = DrawingPenHelper.flattenPath([A([0, 0]), A([0, 1]), A([1, 1])], true);
assert.strictEqual(closedStraight.length, 3);
const closedCurve = DrawingPenHelper.flattenPath([
  A([0, 0], [0.001, -0.001], null),
  A([0, 0.002], null, [0.001, 0.003]),
  A([0.002, 0.001], null, null)
], true, { steps: 5 });
assert(closedCurve.length > 3, 'Fechamento curvo gera vértices extras');
assert.notDeepStrictEqual(closedCurve[closedCurve.length - 1], closedCurve[0], 'Não repete o 1º ponto');
console.log('✔ Traçado fechado correto (sem vértice repetido)');

// 5. Alça espelhada fica simétrica em relação à âncora
const m = DrawingPenHelper.mirror([-23.76, -53.32], [-23.759, -53.319]);
assert(Math.abs(m[1] - (-53.321)) < 1e-6, 'Espelho em longitude');
assert(Math.abs(m[0] - (-23.761)) < 1e-4, 'Espelho em latitude');
console.log('✔ Alça espelhada simétrica');

// 6. autoSteps: poucos vértices em curva suave, mais em curva fechada, sempre dentro dos limites
const gentle = DrawingPenHelper.autoSteps(A([0, 0], null, [0, 0.0001]), A([0, 0.0003], [0, 0.0002]));
assert(gentle <= 6, `Curva quase reta deve usar poucos vértices (usou ${gentle})`);
const wide = DrawingPenHelper.autoSteps(A([0, 0], null, [0.001, 0.0005]), A([0, 0.002], [0.001, 0.0015]));
assert(wide >= 4 && wide <= 30, `Curva de ~200 m deve ficar em dezenas de vértices, não centenas (usou ${wide})`);
assert.strictEqual(DrawingPenHelper.autoSteps(A([0, 0], null, [0, 1]), A([0, 2], [0, 1])), 96);
console.log('✔ Densidade de amostragem pela planura (' + gentle + ' / ' + wide + ' vértices)');

console.log('🎉 Todos os testes da Caneta passaram com 100% de sucesso!');
