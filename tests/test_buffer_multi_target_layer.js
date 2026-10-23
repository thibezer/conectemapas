import assert from 'assert';
import { SpatialAlgorithms } from '../src/services/SpatialAlgorithms.js';
import { ModifyActionsController } from '../src/controllers/ModifyActionsController.js';
import { FeatureSyncController } from '../src/controllers/FeatureSyncController.js';

console.log('🧪 Iniciando testes de Buffer em Múltiplos Objetos e Escolha de Camada de Destino...');

// 1. SpatialAlgorithms.generateBuffer com camada e cores customizadas
{
  const pt = {
    id: 'pt-1',
    name: 'Ponto Teste',
    type: 'Point',
    coordinates: [-23.7661, -53.3206],
    layerId: 'layer-origem-1'
  };

  // Padrão (sem especificar camada) usa a da feição
  const bufDefault = SpatialAlgorithms.generateBuffer(pt, 50);
  assert.strictEqual(bufDefault.layerId, 'layer-origem-1');
  assert.strictEqual(bufDefault.type, 'Circle');
  assert.strictEqual(bufDefault.radius, 50);

  // Especificando camada por string
  const bufStringLayer = SpatialAlgorithms.generateBuffer(pt, 80, 'layer-destino-custom');
  assert.strictEqual(bufStringLayer.layerId, 'layer-destino-custom');
  assert.strictEqual(bufStringLayer.radius, 80);

  // Especificando camada e cor por objeto
  const bufObjLayer = SpatialAlgorithms.generateBuffer(pt, 30, {
    targetLayerId: 'layer-ambiental',
    color: '#10b981'
  });
  assert.strictEqual(bufObjLayer.layerId, 'layer-ambiental');
  assert.strictEqual(bufObjLayer.color, '#10b981');
  assert.strictEqual(bufObjLayer.style.fillColor, '#10b981');
  assert.strictEqual(bufObjLayer.style.strokeColor, '#10b981');

  console.log('✔ SpatialAlgorithms.generateBuffer com camadas e cores customizadas passou');
}

// 2. Unicidade de IDs em geração rápida síncrona
{
  const poly = {
    id: 'poly-1',
    name: 'Quadra',
    type: 'Polygon',
    coordinates: [[[-23.76, -53.32], [-23.76, -53.31], [-23.75, -53.31], [-23.76, -53.32]]],
    layerId: 'layer-topografia'
  };

  const ids = new Set();
  for (let i = 0; i < 50; i++) {
    const b = SpatialAlgorithms.generateBuffer(poly, 20 + i);
    assert(b && b.id, 'Buffer gerado com ID');
    assert(!ids.has(b.id), `ID duplicado detectado: ${b.id}`);
    ids.add(b.id);
  }
  assert.strictEqual(ids.size, 50, '50 IDs distintos gerados');
  console.log('✔ Geração síncrona de IDs únicos de buffer passou');
}

// 3. Mock do ambiente de aplicação para ModifyActionsController.applyBuffer
function createMockApp() {
  const history = [];
  const layers = [
    { id: 'layer-origem-a', name: 'Lotes A', color: '#f59e0b', visible: true },
    { id: 'layer-origem-b', name: 'Lotes B', color: '#3b82f6', visible: true },
    { id: 'layer-destino', name: 'Zonas de Proteção', color: '#10b981', visible: true }
  ];
  const features = [];
  let selectedIds = [];

  const app = {
    projectId: 'proj-test',
    layers,
    features,
    activeLayerId: 'layer-origem-a',
    pushHistory: (msg) => history.push(msg),
    saveFeaturesBulk: () => {},
    saveMetadata: () => {},
    refreshMapAndTable: () => {},
    getLayersWithCounts: () => layers,
    mapEngine: {
      selectFeature: (id) => { selectedIds = [id]; },
      selectFeatures: (ids) => { selectedIds = [...ids]; },
      get selectedIds() { return selectedIds; }
    }
  };

  return { app, history, getSelected: () => selectedIds };
}

// 4. Aplicar Buffer em múltiplos objetos mantendo camada de origem (__same__)
{
  const { app, history, getSelected } = createMockApp();

  const feat1 = { id: 'f1', name: 'Lote 1', type: 'Point', coordinates: [-23.76, -53.32], layerId: 'layer-origem-a' };
  const feat2 = { id: 'f2', name: 'Lote 2', type: 'Point', coordinates: [-23.77, -53.33], layerId: 'layer-origem-b' };
  const feat3 = { id: 'f3', name: 'Lote 3 Bloqueado', type: 'Point', coordinates: [-23.78, -53.34], layerId: 'layer-origem-a', locked: true };

  app.features.push(feat1, feat2, feat3);

  // Aplica buffer de 40m com camada de destino '__same__'
  const result = ModifyActionsController.applyBuffer(app, [feat1, feat2, feat3], 40, '__same__');

  // Feição bloqueada (f3) deve ter sido ignorada
  assert.strictEqual(result.length, 2, 'Gera buffer apenas para as 2 feições desbloqueadas');
  assert.strictEqual(result[0].layerId, 'layer-origem-a', 'Buffer 1 na camada de origem A');
  assert.strictEqual(result[1].layerId, 'layer-origem-b', 'Buffer 2 na camada de origem B');

  // Adicionadas ao app.features
  assert.strictEqual(app.features.length, 5, '2 buffers adicionados ao total de feições');

  // Selecionadas no mapa
  assert.deepStrictEqual(getSelected(), [result[0].id, result[1].id]);

  // Histórico registrado
  assert.strictEqual(history.length, 1, 'Um único passo de histórico');
  assert(history[0].includes('Buffer (40m)'), 'Mensagem de histórico descritiva');

  console.log('✔ Aplicação em lote com camada de origem (__same__) passou');
}

// 5. Aplicar Buffer em múltiplos objetos para uma camada de destino existente
{
  const { app, history, getSelected } = createMockApp();

  const feat1 = { id: 'l1', name: 'Via 1', type: 'LineString', coordinates: [[-23.76, -53.32], [-23.75, -53.32]], layerId: 'layer-origem-a' };
  const feat2 = { id: 'l2', name: 'Via 2', type: 'LineString', coordinates: [[-23.76, -53.33], [-23.75, -53.33]], layerId: 'layer-origem-b' };

  app.features.push(feat1, feat2);

  // Aplica buffer de 25m na camada 'layer-destino'
  const result = ModifyActionsController.applyBuffer(app, [feat1, feat2], 25, 'layer-destino');

  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].layerId, 'layer-destino', 'Buffer 1 na camada de destino');
  assert.strictEqual(result[1].layerId, 'layer-destino', 'Buffer 2 na camada de destino');
  assert.strictEqual(result[0].color, '#10b981', 'Buffer adota a cor da camada de destino');

  console.log('✔ Aplicação em lote para camada de destino existente passou');
}

// 6. Aplicar Buffer em múltiplos objetos criando uma NOVA camada (__new__)
{
  const { app, history } = createMockApp();

  const feat1 = { id: 'p1', name: 'Área 1', type: 'Point', coordinates: [-23.76, -53.32], layerId: 'layer-origem-a' };
  const feat2 = { id: 'p2', name: 'Área 2', type: 'Point', coordinates: [-23.77, -53.33], layerId: 'layer-origem-b' };

  const initialLayersCount = app.layers.length;

  // Aplica buffer criando nova camada 'Faixas de Servidão'
  const result = ModifyActionsController.applyBuffer(app, [feat1, feat2], 50, '__new__', {
    newLayerName: 'Faixas de Servidão'
  });

  assert.strictEqual(result.length, 2);
  assert.strictEqual(app.layers.length, initialLayersCount + 1, 'Nova camada foi adicionada');

  const createdLayer = app.layers[app.layers.length - 1];
  assert.strictEqual(createdLayer.name, 'Faixas de Servidão');
  assert.strictEqual(result[0].layerId, createdLayer.id, 'Buffer 1 na nova camada criada');
  assert.strictEqual(result[1].layerId, createdLayer.id, 'Buffer 2 na nova camada criada');

  console.log('✔ Criação de nova camada de destino sob demanda passou');
}

console.log('🎉 Todos os testes de Buffer Multi-Objeto e Camada de Destino passaram com 100% de sucesso!');
process.exit(0);
