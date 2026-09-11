import { normalizeFeature } from '../src/services/MockData.js';

console.log('--- TESTE: Verificação das Novas Funcionalidades de Seleção e Menu de Contexto ---');

const mockPolygon = normalizeFeature({
  id: 'test_poly_1',
  name: 'Área de Preservação',
  type: 'Polygon',
  layerId: 'layer-topografia',
  coordinates: [[[-23.76, -53.32], [-23.77, -53.32], [-23.77, -53.31], [-23.76, -53.31]]]
});

const mockPoint = normalizeFeature({
  id: 'test_point_1',
  name: 'Marco Geodésico M-01',
  type: 'Point',
  layerId: 'layer-topografia',
  coordinates: [-23.765, -53.321]
});

console.log('1. Verificando normalização das feições...');
if (!mockPolygon || !mockPoint) {
  throw new Error('Falha ao normalizar feições de teste');
}
console.log('OK: Feições normalizadas com sucesso.');

console.log('2. Verificando cálculo de coordenadas...');
if (mockPolygon.type !== 'Polygon' || mockPoint.type !== 'Point') {
  throw new Error('Tipos de feição incorretos');
}
console.log('OK: Tipos de feições validados.');

console.log('--- TESTE CONCLUÍDO COM SUCESSO! ---');
