import assert from 'assert';
import {
  MODIFY_TAB_ID,
  buildModifyTab,
  computeModifyState
} from '../src/components/ModifyRibbon.js';
import { ModifyActionsController } from '../src/controllers/ModifyActionsController.js';
import { SpatialAlgorithms } from '../src/services/SpatialAlgorithms.js';
import { FeatureGeometryUtils } from '../src/services/MapEngine/FeatureGeometryUtils.js';
import { BatchActions } from '../src/services/BatchActions.js';
import { FeatureSyncController } from '../src/controllers/FeatureSyncController.js';
import { Geodesy } from '../src/services/Geodesy.js';

console.log('================================================================');
console.log('🧪 AUDITORIA AGENTE 2: TOPOLOGIA E OPERAÇÕES CAD (ConecteMapas)');
console.log('================================================================\n');

const layers = [
  { id: 'L_TOP', name: 'Topografia', color: '#38bdf8' },
  { id: 'L_VIAS', name: 'Vias', color: '#fbbf24' }
];

const mkPoly = (id, extra = {}) => ({
  id,
  name: `Polígono ${id}`,
  type: 'Polygon',
  layerId: 'L_TOP',
  coordinates: [
    [-23.5505, -46.6333],
    [-23.5505, -46.6323],
    [-23.5515, -46.6323],
    [-23.5515, -46.6333],
    [-23.5505, -46.6333]
  ],
  ...extra
});

const mkLine = (id, extra = {}) => ({
  id,
  name: `Linha ${id}`,
  type: 'LineString',
  layerId: 'L_VIAS',
  coordinates: [
    [-23.5505, -46.6333],
    [-23.5515, -46.6323]
  ],
  ...extra
});

const mkPoint = (id, extra = {}) => ({
  id,
  name: `Ponto ${id}`,
  type: 'Point',
  layerId: 'L_TOP',
  coordinates: [-23.5505, -46.6333],
  ...extra
});

const mkCircle = (id, extra = {}) => ({
  id,
  name: `Círculo ${id}`,
  type: 'Circle',
  layerId: 'L_TOP',
  coordinates: [-23.5505, -46.6333],
  radius: 100,
  ...extra
});

const mkText = (id, extra = {}) => ({
  id,
  name: `Texto ${id}`,
  type: 'Text',
  layerId: 'L_TOP',
  coordinates: [-23.5505, -46.6333],
  text: 'Anotação',
  ...extra
});

// Helper de estado da ribbon
const getState = (features, activeTool = 'select', history = {}) =>
  computeModifyState({ features, layers, activeTool, history });

// ============================================================================
// 1. VALIDAÇÃO DE HABILITAÇÃO DOS BOTÕES DA ABA MODIFICAR
// ============================================================================
console.log('--- Teste 1: Regras de Habilitação dos Botões da Ribbon ---');
{
  // 1.1 mod-join e mod-join-bridge (exigem >= 2 desbloqueadas)
  assert.strictEqual(getState([])['mod-join'].disabled, true, '0 feições: mod-join deve estar desabilitado');
  assert.strictEqual(getState([])['mod-join-bridge'].disabled, true, '0 feições: mod-join-bridge deve estar desabilitado');

  assert.strictEqual(getState([mkPoly('1')])['mod-join'].disabled, true, '1 feição: mod-join deve estar desabilitado');
  assert.strictEqual(getState([mkPoly('1')])['mod-join-bridge'].disabled, true, '1 feição: mod-join-bridge deve estar desabilitado');

  assert.strictEqual(getState([mkPoly('1'), mkPoly('2')])['mod-join'].disabled, false, '2 feições desbloqueadas: mod-join habilitado');
  assert.strictEqual(getState([mkPoly('1'), mkPoly('2')])['mod-join-bridge'].disabled, false, '2 feições desbloqueadas: mod-join-bridge habilitado');

  // Com 1 bloqueada e 1 desbloqueada (u = 1) -> desabilitado
  assert.strictEqual(getState([mkPoly('1', { locked: true }), mkPoly('2')])['mod-join'].disabled, true, '1 bloqueada + 1 livre: mod-join desabilitado');
  assert.strictEqual(getState([mkPoly('1', { locked: true }), mkPoly('2')])['mod-join-bridge'].disabled, true, '1 bloqueada + 1 livre: mod-join-bridge desabilitado');

  // Com 2 desbloqueadas e 1 bloqueada (u = 2) -> habilitado
  assert.strictEqual(getState([mkPoly('1', { locked: true }), mkPoly('2'), mkPoly('3')])['mod-join'].disabled, false, '2 livres + 1 bloqueada: mod-join habilitado');
  assert.strictEqual(getState([mkPoly('1', { locked: true }), mkPoly('2'), mkPoly('3')])['mod-join-bridge'].disabled, false, '2 livres + 1 bloqueada: mod-join-bridge habilitado');

  // 1.2 mod-vertices e mod-duplicate (exigem exatamente 1 feição editável)
  assert.strictEqual(getState([])['mod-vertices'].disabled, true, '0 feições: mod-vertices desabilitado');
  assert.strictEqual(getState([])['mod-duplicate'].disabled, true, '0 feições: mod-duplicate desabilitado');

  assert.strictEqual(getState([mkPoly('1')])['mod-vertices'].disabled, false, '1 polígono desbloqueado: mod-vertices habilitado');
  assert.strictEqual(getState([mkPoly('1')])['mod-duplicate'].disabled, false, '1 polígono desbloqueado: mod-duplicate habilitado');

  assert.strictEqual(getState([mkPoly('1', { locked: true })])['mod-vertices'].disabled, true, '1 polígono bloqueado: mod-vertices desabilitado');
  assert.strictEqual(getState([mkPoly('1', { locked: true })])['mod-duplicate'].disabled, true, '1 polígono bloqueado: mod-duplicate desabilitado');

  assert.strictEqual(getState([mkText('t1')])['mod-vertices'].disabled, true, 'Texto não tem vértices editáveis no mapa: mod-vertices desabilitado');
  assert.strictEqual(getState([mkText('t1')])['mod-duplicate'].disabled, false, 'Texto desbloqueado pode ser duplicado: mod-duplicate habilitado');

  assert.strictEqual(getState([mkPoly('1'), mkPoly('2')])['mod-vertices'].disabled, true, '2 feições: mod-vertices desabilitado');
  assert.strictEqual(getState([mkPoly('1'), mkPoly('2')])['mod-duplicate'].disabled, true, '2 feições: mod-duplicate desabilitado');

  // 1.3 mod-buffer e mod-delete (funcionam com 1 ou mais feições desbloqueadas)
  assert.strictEqual(getState([])['mod-buffer'].disabled, true, '0 feições: mod-buffer desabilitado');
  assert.strictEqual(getState([])['mod-delete'].disabled, true, '0 feições: mod-delete desabilitado');

  assert.strictEqual(getState([mkPoly('1')])['mod-buffer'].disabled, false, '1 desbloqueada: mod-buffer habilitado');
  assert.strictEqual(getState([mkPoly('1')])['mod-delete'].disabled, false, '1 desbloqueada: mod-delete habilitado');

  assert.strictEqual(getState([mkPoly('1', { locked: true })])['mod-buffer'].disabled, true, '1 bloqueada: mod-buffer desabilitado');
  assert.strictEqual(getState([mkPoly('1', { locked: true })])['mod-delete'].disabled, true, '1 bloqueada: mod-delete desabilitado');

  assert.strictEqual(getState([mkPoly('1', { locked: true }), mkPoly('2', { locked: true })])['mod-buffer'].disabled, true, 'Todas bloqueadas: mod-buffer desabilitado');
  assert.strictEqual(getState([mkPoly('1', { locked: true }), mkPoly('2', { locked: true })])['mod-delete'].disabled, true, 'Todas bloqueadas: mod-delete desabilitado');

  assert.strictEqual(getState([mkPoly('1', { locked: true }), mkPoly('2')])['mod-buffer'].disabled, false, '1 livre e 1 bloqueada: mod-buffer habilitado');
  assert.strictEqual(getState([mkPoly('1', { locked: true }), mkPoly('2')])['mod-delete'].disabled, false, '1 livre e 1 bloqueada: mod-delete habilitado');

  // 1.4 mod-simplify (apenas linhas e polígonos desbloqueados)
  assert.strictEqual(getState([])['mod-simplify'].disabled, true, '0 feições: mod-simplify desabilitado');
  assert.strictEqual(getState([mkPoint('p')])['mod-simplify'].disabled, true, 'Ponto: mod-simplify desabilitado');
  assert.strictEqual(getState([mkText('t')])['mod-simplify'].disabled, true, 'Texto: mod-simplify desabilitado');
  assert.strictEqual(getState([mkCircle('c')])['mod-simplify'].disabled, true, 'Círculo: mod-simplify desabilitado');
  assert.strictEqual(getState([mkLine('l')])['mod-simplify'].disabled, false, 'Linha desbloqueada: mod-simplify habilitado');
  assert.strictEqual(getState([mkPoly('p')])['mod-simplify'].disabled, false, 'Polígono desbloqueado: mod-simplify habilitado');
  assert.strictEqual(getState([mkPoly('p', { locked: true })])['mod-simplify'].disabled, true, 'Polígono bloqueado: mod-simplify desabilitado');
  assert.strictEqual(getState([mkPoly('p', { locked: true }), mkLine('l')])['mod-simplify'].disabled, false, 'Misto com linha livre: mod-simplify habilitado');

  console.log('✔ Habilitação de botões validada com sucesso!');
}

// ============================================================================
// 2. SALVAGUARDAS RÍGIDAS CONTRA FEIÇÕES BLOQUEADAS (locked: true)
// ============================================================================
console.log('\n--- Teste 2: Salvaguardas Rígidas contra Feições Bloqueadas ---');
{
  // 2.1 BatchActions.remove NUNCA exclui feições bloqueadas
  const appFake1 = {
    features: [
      mkPoly('f_livre'),
      mkPoly('f_bloq', { locked: true })
    ],
    pushHistory: () => {},
    collabHub: { notifyFeatureDeleted: () => {} },
    removeFeaturesBulk: () => {},
    refreshMapAndTable: () => {}
  };
  const delRes = BatchActions.remove(appFake1, ['f_livre', 'f_bloq']);
  assert.strictEqual(delRes.changed, 1, 'Apenas 1 feição excluída');
  assert.strictEqual(delRes.locked, 1, '1 feição bloqueada foi protegida e ignorada');
  assert.deepStrictEqual(delRes.ids, ['f_livre']);
  assert(appFake1.features.some(f => f.id === 'f_bloq'), 'Feição bloqueada continua intacta no app');

  // 2.2 FeatureSyncController.deleteFeature bloqueia exclusão
  const appFake2 = {
    features: [mkPoly('f_bloq', { locked: true })],
    pushHistory: () => {},
    mapEngine: { removeFeature: () => {} }
  };
  const delSingleRes = FeatureSyncController.deleteFeature(appFake2, 'f_bloq');
  assert.strictEqual(delSingleRes, false, 'deleteFeature recusou exclusão de feição bloqueada');
  assert.strictEqual(appFake2.features.length, 1, 'Feição bloqueada não foi removida');

  // 2.3 FeatureSyncController.splitFeature recusa corte de feição bloqueada
  const appFake3 = {
    features: [mkPoly('poly_bloq', { locked: true })],
    pushHistory: () => {}
  };
  const splitRes = FeatureSyncController.splitFeature(appFake3, { id: 'poly_bloq', locked: true }, [
    [[-23.5505, -46.6333], [-23.5505, -46.6328], [-23.5515, -46.6328], [-23.5505, -46.6333]],
    [[-23.5505, -46.6328], [-23.5505, -46.6323], [-23.5515, -46.6323], [-23.5505, -46.6328]]
  ]);
  assert.deepStrictEqual(splitRes, [], 'splitFeature retornou array vazio (corte recusado)');
  assert.strictEqual(appFake3.features.length, 1, 'Polígono bloqueado permaneceu intacto');

  // 2.4 BatchActions.simplify NUNCA altera feição bloqueada
  const colineares = [[0, 0], [0.0001, 0.00001], [0.0002, 0], [0.0003, 0.00001], [0.0004, 0]];
  const appFake4 = {
    features: [
      mkLine('linha_bloq', { locked: true, coordinates: colineares })
    ],
    pushHistory: () => {},
    collabHub: { notifyFeatureUpdated: () => {} },
    saveFeaturesBulk: () => {},
    refreshMapAndTable: () => {}
  };
  const simpRes = BatchActions.simplify(appFake4, ['linha_bloq'], 10);
  assert.strictEqual(simpRes.changed, 0, 'Nenhuma feição alterada');
  assert.strictEqual(simpRes.locked, 1, 'Feição bloqueada foi classificada como locked');
  assert.strictEqual(appFake4.features[0].coordinates.length, colineares.length, 'Coordenadas da linha bloqueada não foram simplificadas');

  // 2.5 ModifyActionsController.buffer ignora alvos bloqueados
  let modalOpenedWith = null;
  const appFake5 = {
    bufferModal: {
      open: (targets) => { modalOpenedWith = targets; }
    }
  };
  ModifyActionsController.buffer(appFake5, [
    mkPoly('p_bloq', { locked: true }),
    mkPoly('p_livre', { locked: false })
  ]);
  assert.strictEqual(modalOpenedWith?.length, 1, 'Modal de buffer recebeu apenas a feição livre');
  assert.strictEqual(modalOpenedWith[0].id, 'p_livre');

  // 2.6 ModifyActionsController.duplicate ignora feição bloqueada
  let newFeatureOpened = false;
  const appFake6 = {
    newFeatureModal: {
      openWithFeature: () => { newFeatureOpened = true; }
    }
  };
  ModifyActionsController.duplicate(appFake6, mkPoly('p_bloq', { locked: true }));
  assert.strictEqual(newFeatureOpened, false, 'duplicate não abriu modal nem duplicou feição bloqueada');

  console.log('✔ Salvaguardas contra feições bloqueadas verificadas com 100% de conformidade!');
}

// ============================================================================
// 3. CÁLCULO GEODÉSICO DE BUFFER E DUPLICAÇÃO COM OFFSET DE 30 METROS
// ============================================================================
console.log('\n--- Teste 3: Buffer Geodésico e Duplicação com Offset de 30m ---');
{
  // 3.1 Buffer de Ponto -> Círculo
  const pt = mkPoint('pt1');
  const bufPt = SpatialAlgorithms.generateBuffer(pt, 50);
  assert(bufPt, 'Buffer de ponto gerado');
  assert.strictEqual(bufPt.type, 'Circle', 'Buffer de ponto vira Círculo geodésico');
  assert.strictEqual(bufPt.radius, 50, 'Raio métrico exato de 50m');
  assert.deepStrictEqual(bufPt.coordinates, pt.coordinates, 'Centro coincide com ponto original');
  assert.strictEqual(bufPt.category, 'Zona de Amortecimento');

  // 3.2 Buffer de Círculo -> Círculo expandido
  const circ = mkCircle('c1', { radius: 100 });
  const bufCirc = SpatialAlgorithms.generateBuffer(circ, 25);
  assert(bufCirc, 'Buffer de círculo gerado');
  assert.strictEqual(bufCirc.type, 'Circle');
  assert.strictEqual(bufCirc.radius, 125, 'Raio expandido para 125m (100 + 25)');

  // 3.3 Buffer de Linha -> Polígono envoltório
  const linha = mkLine('l1');
  const bufLinha = SpatialAlgorithms.generateBuffer(linha, 15);
  assert(bufLinha, 'Buffer de linha gerado');
  assert.strictEqual(bufLinha.type, 'Polygon', 'Buffer de linha vira polígono');
  assert(Array.isArray(bufLinha.coordinates) && bufLinha.coordinates.length >= 4, 'Polígono fechado com caps arredondados');

  // 3.4 Buffer de Polígono -> Polígono expandido
  const poly = mkPoly('poly1');
  const bufPoly = SpatialAlgorithms.generateBuffer(poly, 30);
  assert(bufPoly, 'Buffer de polígono gerado');
  assert.strictEqual(bufPoly.type, 'Polygon');
  const areaOrig = FeatureGeometryUtils.calculatePolygonArea(poly.coordinates);
  const areaBuf = FeatureGeometryUtils.calculatePolygonArea(bufPoly.coordinates);
  assert(areaBuf > areaOrig, `Área do buffer (${areaBuf.toFixed(1)} m²) deve ser maior que a original (${areaOrig.toFixed(1)} m²)`);

  // 3.5 Duplicação com offset de 30m
  const featOrig = mkPoly('original', { locked: true }); // original pode estar bloqueada
  const clone = SpatialAlgorithms.duplicateWithOffset(featOrig, 30);
  assert(clone, 'Clone gerado');
  assert.strictEqual(clone.locked, false, 'Clone gerado nasce obrigatoriamente editável (locked: false)');
  assert.notStrictEqual(clone.id, featOrig.id, 'Clone possui ID único e diferente da origem');
  assert(clone.name.includes('(Cópia)'), 'Nome do clone possui sufixo "(Cópia)"');

  // Verificar se o deslocamento métrico é geodésico e aproximadamente 30m em cada eixo
  const origCoord = featOrig.coordinates[0];
  const cloneCoord = clone.coordinates[0];
  const distEixoLat = Geodesy.distance(origCoord, [cloneCoord[0], origCoord[1]]);
  const distEixoLng = Geodesy.distance(origCoord, [origCoord[0], cloneCoord[1]]);
  assert(Math.abs(distEixoLat - 30) < 0.2, `Deslocamento latitudinal (${distEixoLat.toFixed(2)}m) deve ser ~30m`);
  assert(Math.abs(distEixoLng - 30) < 0.2, `Deslocamento longitudinal (${distEixoLng.toFixed(2)}m) deve ser ~30m`);

  console.log('✔ Cálculos geodésicos de buffer e duplicação com offset métrico validados!');
}

// ============================================================================
// 4. RESILIÊNCIA CONTRA RAIOS INVÁLIDOS E CASOS DE BORDA EM BUFFER
// ============================================================================
console.log('\n--- Teste 4: Resiliência contra Raios Inválidos e Casos de Borda ---');
{
  const poly = mkPoly('p');
  const pt = mkPoint('pt');

  // Raio 0
  assert.strictEqual(SpatialAlgorithms.generateBuffer(poly, 0), null, 'Raio 0 retorna null');

  // Raio negativo em Ponto (impossível retrair um ponto)
  assert.strictEqual(SpatialAlgorithms.generateBuffer(pt, -10), null, 'Raio negativo em Ponto retorna null');

  // Raio negativo que colapsa polígono (retração maior que a largura do lote)
  assert.strictEqual(SpatialAlgorithms.generateBuffer(poly, -5000), null, 'Retração excessiva de polígono retorna null com segurança');

  // Valores não finitos ou inválidos
  assert.strictEqual(SpatialAlgorithms.generateBuffer(poly, NaN), null, 'Raio NaN retorna null');
  assert.strictEqual(SpatialAlgorithms.generateBuffer(poly, Infinity), null, 'Raio Infinity retorna null');
  assert.strictEqual(SpatialAlgorithms.generateBuffer(poly, null), null, 'Raio null retorna null');
  assert.strictEqual(SpatialAlgorithms.generateBuffer(poly, 'string_invalida'), null, 'Raio string não numérica retorna null');

  // Parâmetro omitido/undefined usa o default intencional de 50m
  const bufDefault = SpatialAlgorithms.generateBuffer(poly);
  assert(bufDefault && bufDefault.name.includes('50m'), 'Buffer com raio omitido adota 50m padrão');

  // Feição nula ou sem geometria
  assert.strictEqual(SpatialAlgorithms.generateBuffer(null, 50), null, 'Feição nula retorna null');
  assert.strictEqual(SpatialAlgorithms.generateBuffer({ type: 'Polygon', coordinates: [] }, 50), null, 'Coordenadas vazias retornam null');

  console.log('✔ Resiliência de entradas e raios de buffer validada com êxito!');
}

// ============================================================================
// 5. SANITIZAÇÃO DE COORDENADAS E PREVENÇÃO DE GEOMETRIAS DEGENERADAS
// ============================================================================
console.log('\n--- Teste 5: Sanitização de Coordenadas e Geometrias Degeneradas ---');
{
  // 5.1 Polígono degenerado (< 3 pontos)
  const polyDegenerado1 = {
    type: 'Polygon',
    coordinates: [[-23.55, -46.63], [-23.56, -46.64]] // apenas 2 pontos
  };
  const norm1 = FeatureGeometryUtils.normalizeCoordinates(polyDegenerado1);
  assert.strictEqual(norm1, null, 'Polígono com < 3 vértices é descartado pela normalização');
  assert.strictEqual(SpatialAlgorithms.generateBuffer(polyDegenerado1, 20), null, 'Buffer de polígono degenerado retorna null');

  // 5.2 Linha degenerada (< 2 pontos)
  const linhaDegenerada = {
    type: 'LineString',
    coordinates: [[-23.55, -46.63]] // apenas 1 ponto
  };
  const norm2 = FeatureGeometryUtils.normalizeCoordinates(linhaDegenerada);
  assert.strictEqual(norm2, null, 'Linha com < 2 vértices é descartada pela normalização');
  assert.strictEqual(SpatialAlgorithms.generateBuffer(linhaDegenerada, 20), null, 'Buffer de linha degenerada retorna null');

  // 5.3 Coordenadas com NaN / Infinity
  const polyComNaN = {
    type: 'Polygon',
    coordinates: [
      [-23.55, -46.63],
      [NaN, -46.64],
      [-23.57, Infinity],
      [-23.55, -46.63]
    ]
  };
  const norm3 = FeatureGeometryUtils.normalizeCoordinates(polyComNaN);
  assert.strictEqual(norm3, null, 'Polígono cujos pontos válidos restaram < 3 é descartado');

  // 5.4 Salvaguarda Douglas-Peucker: nunca reduzir abaixo do mínimo topológico
  const triangle = [
    [-23.5505, -46.6333],
    [-23.5515, -46.6323],
    [-23.5525, -46.6333],
    [-23.5505, -46.6333]
  ];
  // Mesmo com tolerância brutal de 100km, o triângulo nunca perde seus 3 vértices fundamentais
  const simplifiedPoly = SpatialAlgorithms.simplifyDouglasPeucker(triangle, 100000, true);
  assert(simplifiedPoly.length >= 3, 'Polígono simplificado mantém no mínimo 3 vértices');

  const line2pts = [
    [-23.5505, -46.6333],
    [-23.5515, -46.6323]
  ];
  const simplifiedLine = SpatialAlgorithms.simplifyDouglasPeucker(line2pts, 100000, false);
  assert.strictEqual(simplifiedLine.length, 2, 'Linha simplificada mantém no mínimo 2 vértices');

  console.log('✔ Sanitização e prevenção contra geometrias degeneradas validadas!');
}

// ============================================================================
// 6. ALTERNÂNCIA DE FERRAMENTAS CONTÍNUAS (split, measure)
// ============================================================================
console.log('\n--- Teste 6: Alternância de Ferramentas Contínuas (Toggle) ---');
{
  let currentTool = 'select';
  const appFakeTools = {
    mapEngine: {
      get activeTool() { return currentTool; },
      resetDrawingState: () => {},
      setTool: (t) => { currentTool = t; }
    },
    drawingToolbar: {
      setActiveTool: () => {}
    }
  };

  // 6.1 Alternar mod-split: de 'select' -> 'split'
  ModifyActionsController.run(appFakeTools, 'mod-split');
  assert.strictEqual(currentTool, 'split', 'Primeiro clique em mod-split ativa ferramenta split');

  // Ao clicar novamente em mod-split -> volta para 'select'
  ModifyActionsController.run(appFakeTools, 'mod-split');
  assert.strictEqual(currentTool, 'select', 'Segundo clique em mod-split desativa e volta para select');

  // 6.2 Alternar mod-measure: de 'select' -> 'measure'
  ModifyActionsController.run(appFakeTools, 'mod-measure');
  assert.strictEqual(currentTool, 'measure', 'Primeiro clique em mod-measure ativa ferramenta measure');

  // Ao clicar novamente em mod-measure -> volta para 'select'
  ModifyActionsController.run(appFakeTools, 'mod-measure');
  assert.strictEqual(currentTool, 'select', 'Segundo clique em mod-measure desativa e volta para select');

  console.log('✔ Alternância de ferramentas contínuas validada com sucesso!');
}

console.log('\n================================================================');
console.log('🎉 TODOS OS TESTES DO AGENTE 2 FORAM CONCLUÍDOS COM SUCESSO! 100% OK');
console.log('================================================================\n');
