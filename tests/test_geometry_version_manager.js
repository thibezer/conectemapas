/* ==========================================================================
   ConecteMapas - Teste do GeometryVersionManager (Oficial vs Prévia)
   ========================================================================== */

import assert from 'assert';
import { GeometryVersionManager } from '../src/services/GeometryVersionManager.js';

console.log('--- Iniciando Teste de Geometria Oficial vs Prévia ---');

// Cenário 1: Feição Oficial e Feição Prévia vinculadas
const featOficial = {
  id: 'lote-10-oficial',
  name: 'Lote 10',
  type: 'Polygon',
  status: 'oficial',
  coordinates: [[-15.80, -47.85], [-15.81, -47.85], [-15.81, -47.84], [-15.80, -47.84]],
  properties: { codigo: 'LOT-10' }
};

const featPrevia = {
  id: 'lote-10-previa',
  name: 'Lote 10',
  type: 'Polygon',
  status: 'previa',
  coordinates: [[-15.801, -47.851], [-15.811, -47.851], [-15.811, -47.841], [-15.801, -47.841]],
  properties: { codigo: 'LOT-10', linkedId: 'lote-10-oficial' }
};

// Cenário 2: Feição Prévia Órfã (SEM geometria oficial no projeto)
const featPreviaSemOficial = {
  id: 'lote-99-previa',
  name: 'Lote 99 (Rascunho de Campo)',
  type: 'Polygon',
  status: 'previa',
  coordinates: [[-15.85, -47.90], [-15.86, -47.90], [-15.86, -47.89], [-15.85, -47.89]],
  properties: { codigo: 'LOT-99' }
};

// Cenário 3: Feição Comum (Sem status)
const featComum = {
  id: 'marco-01',
  name: 'Marco M-01',
  type: 'Point',
  coordinates: [-15.79, -47.86]
};

const allFeatures = [featOficial, featPrevia, featPreviaSemOficial, featComum];

// 1. Identificação de Status e Vínculos
assert.strictEqual(GeometryVersionManager.isOfficial(featOficial), true, 'Deve identificar status oficial');
assert.strictEqual(GeometryVersionManager.isPreview(featPrevia), true, 'Deve identificar status prévia');
assert.strictEqual(GeometryVersionManager.findLinkedFeature(featOficial, allFeatures)?.id, 'lote-10-previa', 'Oficial deve achar a prévia vinculada');
assert.strictEqual(GeometryVersionManager.findLinkedFeature(featPrevia, allFeatures)?.id, 'lote-10-oficial', 'Prévia deve achar a oficial vinculada');
assert.strictEqual(GeometryVersionManager.hasOfficialGeometry(featPrevia, allFeatures), true, 'Lote 10 Prévia TEM oficial');
assert.strictEqual(GeometryVersionManager.hasOfficialGeometry(featPreviaSemOficial, allFeatures), false, 'Lote 99 Prévia NÃO TEM oficial');
console.log('✓ Vínculos e identificação de status validados com sucesso.');

// 2. Comportamento Padrão (Sem solicitação de prévia)
// Regra 1: Temos geometria oficial -> a prévia NÃO aparece por padrão, a oficial aparece.
assert.strictEqual(GeometryVersionManager.shouldRenderFeature(featOficial, allFeatures, false), true, 'Oficial deve aparecer como padrão');
assert.strictEqual(GeometryVersionManager.shouldRenderFeature(featPrevia, allFeatures, false), false, 'Prévia vinculada a oficial NÃO deve aparecer por padrão');

// Regra 2: NÃO temos geometria oficial -> a geometria prévia aparece como padrão!
assert.strictEqual(GeometryVersionManager.shouldRenderFeature(featPreviaSemOficial, allFeatures, false), true, 'Prévia SEM oficial DEVE aparecer como padrão!');

// Feição comum sempre aparece
assert.strictEqual(GeometryVersionManager.shouldRenderFeature(featComum, allFeatures, false), true, 'Feição comum deve aparecer');
console.log('✓ Comportamento padrão validado: oficial na tela e prévia sem oficial na tela.');

// 3. Solicitação Global de Prévias (globalShowPreviews = true)
// Quando o usuário solicita, a renderização alterna (troca a oficial pela prévia)
assert.strictEqual(GeometryVersionManager.shouldRenderFeature(featOficial, allFeatures, true), false, 'Oficial deve ser ocultada quando prévia for solicitada globalmente');
assert.strictEqual(GeometryVersionManager.shouldRenderFeature(featPrevia, allFeatures, true), true, 'Prévia deve ser exibida quando solicitada globalmente');
assert.strictEqual(GeometryVersionManager.shouldRenderFeature(featPreviaSemOficial, allFeatures, true), true, 'Prévia sem oficial continua visível');
console.log('✓ Alternância por toggle global validada com sucesso.');

// 4. Solicitação Individual (individualPreviewToggles com lote-10)
const individualToggles = new Set(['lote-10-oficial']);
assert.strictEqual(GeometryVersionManager.shouldRenderFeature(featOficial, allFeatures, false, individualToggles), false, 'Oficial deve ser ocultada com toggle individual');
assert.strictEqual(GeometryVersionManager.shouldRenderFeature(featPrevia, allFeatures, false, individualToggles), true, 'Prévia deve ser exibida com toggle individual');
console.log('✓ Alternância por toggle individual validada com sucesso.');

console.log('--- TODOS OS TESTES DO GEOMETRY VERSION MANAGER PASSARAM COM SUCESSO! ---');
