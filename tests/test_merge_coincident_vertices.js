/* ==========================================================================
   ConecteMapas - Fusão de vértices na mesma posição
   Verifica que FeatureGeometryUtils.mergeCoincidentVertices:
   1. Funde vizinhos idênticos de polígono (aberto e fechado), inclusive último == primeiro.
   2. Não funde pontos próximos mas diferentes, nem pontos iguais não vizinhos.
   3. Nunca reduz abaixo de 3 vértices (polígono) / 2 pontos (linha).
   4. Mantém o circuito proposital da linha (último == primeiro) e funde vizinhos repetidos.
   5. Devolve a mesma referência quando nada muda e não altera a entrada.
   6. A edição pela tabela de vértices (applyVertexEdit) também funde.
   ========================================================================== */

import assert from 'assert';
import { FeatureGeometryUtils as G } from '../src/services/MapEngine/FeatureGeometryUtils.js';
import { FeaturePropertiesAdapter } from '../src/components/LayerPanel/FeaturePropertiesAdapter.js';

console.log('--- Iniciando Teste de Fusão de Vértices Coincidentes ---');

const A = [-15.0, -47.0];
const B = [-15.0, -46.9];
const C = [-14.9, -46.9];
const D = [-14.9, -47.0];

// 1. Polígono aberto: vértice arrastado sobre o vizinho
let open = [A, B, B, C, D];
let merged = G.mergeCoincidentVertices(open, 'Polygon');
assert.deepStrictEqual(merged, [A, B, C, D], 'vizinhos idênticos viram um só');
assert.deepStrictEqual(open, [A, B, B, C, D], 'entrada não é alterada');

// Polígono fechado (primeiro == último repetido): mantém o fechamento
assert.deepStrictEqual(G.mergeCoincidentVertices([A, B, B, C, D, A], 'Polygon'), [A, B, C, D, A]);

// Último vértice sobre o primeiro (anel aberto): a forma fecha, sem ponto sobrando
assert.deepStrictEqual(G.mergeCoincidentVertices([A, B, C, D, A], 'Polygon'), [A, B, C, D, A],
  'anel já fechado (RFC 7946) permanece fechado');
assert.deepStrictEqual(G.mergeCoincidentVertices([A, B, C, A, A], 'Polygon'), [A, B, C, A]);

// 2. Pontos distintos (mesmo que muito próximos) e iguais não vizinhos ficam como estão
const near = [A[0], A[1] + 1e-12];
open = [A, near, B, C];
assert.strictEqual(G.mergeCoincidentVertices(open, 'Polygon'), open, 'tolerância zero: só posição exata');
const pinch = [A, B, C, B, D];
assert.strictEqual(G.mergeCoincidentVertices(pinch, 'Polygon'), pinch, 'iguais não vizinhos não se fundem');

// 3. Mínimos
const tri = [A, B, B];
assert.strictEqual(G.mergeCoincidentVertices(tri, 'Polygon'), tri, 'polígono não cai abaixo de 3 vértices');
const seg = [A, A];
assert.strictEqual(G.mergeCoincidentVertices(seg, 'LineString'), seg, 'linha não cai abaixo de 2 pontos');

// 4. Linha
assert.deepStrictEqual(G.mergeCoincidentVertices([A, B, B, C], 'LineString'), [A, B, C]);
const loop = [A, B, C, A];
assert.strictEqual(G.mergeCoincidentVertices(loop, 'LineString'), loop, 'circuito proposital da linha é preservado');

// Polígono com furo (profundidade 3): cada anel é tratado por si
const withHole = [[A, B, C, D, A], [[-14.95, -46.97], [-14.95, -46.97], [-14.95, -46.93], [-14.97, -46.95], [-14.95, -46.97]]];
const m2 = G.mergeCoincidentVertices(withHole, 'Polygon');
assert.strictEqual(m2[0].length, 5, 'anel externo intacto');
assert.strictEqual(m2[1].length, 4, 'furo perde o vértice repetido e continua fechado');
assert.deepStrictEqual(m2[1][0], m2[1][m2[1].length - 1]);

// 5. Sem mudança => mesma referência
const clean = [A, B, C, D];
assert.strictEqual(G.mergeCoincidentVertices(clean, 'Polygon'), clean);

// Tipos sem vértices
assert.strictEqual(G.mergeCoincidentVertices(A, 'Point'), A);

// 6. Edição pela tabela de vértices: levar B para a posição de C funde os dois
const draft = { type: 'Polygon', coordinates: [A, B, C, D] };
const ok = FeaturePropertiesAdapter.applyVertexEdit(draft, 'vtx_0_1_1', String(C[1]), () => {});
assert.ok(ok);
assert.strictEqual(draft.coordinates.length, 4, 'B passa a ter longitude de C (ainda distinto)');
FeaturePropertiesAdapter.applyVertexEdit(draft, 'vtx_0_1_0', String(C[0]), () => {});
assert.deepStrictEqual(draft.coordinates, [A, C, D], 'B sobre C vira um só vértice');

console.log('✔ Fusão de vértices coincidentes OK');
