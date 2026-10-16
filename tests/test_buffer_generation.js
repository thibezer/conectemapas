import { SpatialAlgorithms } from '../src/services/SpatialAlgorithms.js';

console.log('🧪 Testando SpatialAlgorithms.generateBuffer (Buffer Geodésico)...');

// 1. Ponto -> Círculo
const ptFeature = {
  id: 'pt-01',
  name: 'Marco 01',
  type: 'Point',
  coordinates: [-23.7661, -53.3206],
  layerId: 'layer-topografia'
};
const ptBuffer = SpatialAlgorithms.generateBuffer(ptFeature, 100);
if (!ptBuffer || ptBuffer.type !== 'Circle' || ptBuffer.radius !== 100) {
  console.error('❌ Falha no buffer de Ponto:', ptBuffer);
  process.exit(1);
}
if (ptBuffer.coordinates[0] !== -23.7661 || ptBuffer.coordinates[1] !== -53.3206) {
  console.error('❌ Coordenadas do buffer de Ponto divergentes:', ptBuffer.coordinates);
  process.exit(1);
}
console.log('✔ Buffer de Ponto -> Círculo validado com sucesso.');

// 2. Círculo -> Círculo expandido
const circleFeature = {
  id: 'circ-01',
  name: 'Área de Influência',
  type: 'Circle',
  coordinates: [-23.7661, -53.3206],
  radius: 200,
  layerId: 'layer-topografia'
};
const circleBuffer = SpatialAlgorithms.generateBuffer(circleFeature, 50);
if (!circleBuffer || circleBuffer.type !== 'Circle' || circleBuffer.radius !== 250) {
  console.error('❌ Falha na expansão de Círculo:', circleBuffer);
  process.exit(1);
}
console.log('✔ Expansão de Círculo validada com sucesso (200m + 50m = 250m).');

// 3. Linha -> Polígono cápsula envoltório
const lineFeature = {
  id: 'line-01',
  name: 'Eixo Viário',
  type: 'LineString',
  coordinates: [
    [-23.7660, -53.3200],
    [-23.7600, -53.3200]
  ],
  layerId: 'layer-vias'
};
const lineBuffer = SpatialAlgorithms.generateBuffer(lineFeature, 25);
if (!lineBuffer || lineBuffer.type !== 'Polygon' || !Array.isArray(lineBuffer.coordinates)) {
  console.error('❌ Falha no buffer de Linha:', lineBuffer);
  process.exit(1);
}
const linePts = lineBuffer.coordinates;
if (linePts.length < 30) {
  console.error('❌ Buffer de Linha deve conter arcos caps (esperado >= 30 vértices):', linePts.length);
  process.exit(1);
}
const firstPt = linePts[0];
const lastPt = linePts[linePts.length - 1];
if (Math.abs(firstPt[0] - lastPt[0]) > 1e-6 || Math.abs(firstPt[1] - lastPt[1]) > 1e-6) {
  console.error('❌ Buffer de Linha não está fechado:', firstPt, lastPt);
  process.exit(1);
}
console.log(`✔ Buffer de Linha validado com sucesso (${linePts.length} vértices, anel fechado).`);

// 4. Polígono -> Polígono expandido com miter limit
const polyFeature = {
  id: 'poly-01',
  name: 'Quadra A',
  type: 'Polygon',
  coordinates: [
    [-23.7660, -53.3200],
    [-23.7660, -53.3150],
    [-23.7620, -53.3150],
    [-23.7620, -53.3200],
    [-23.7660, -53.3200]
  ],
  layerId: 'layer-lotes'
};
const polyBuffer = SpatialAlgorithms.generateBuffer(polyFeature, 30);
if (!polyBuffer || polyBuffer.type !== 'Polygon' || !Array.isArray(polyBuffer.coordinates)) {
  console.error('❌ Falha no buffer de Polígono:', polyBuffer);
  process.exit(1);
}
const polyPts = polyBuffer.coordinates;
if (polyPts.length < 4) {
  console.error('❌ Buffer de Polígono deve ter pelo menos 4 pontos:', polyPts.length);
  process.exit(1);
}
const pFirst = polyPts[0];
const pLast = polyPts[polyPts.length - 1];
if (Math.abs(pFirst[0] - pLast[0]) > 1e-6 || Math.abs(pFirst[1] - pLast[1]) > 1e-6) {
  console.error('❌ Buffer de Polígono não está fechado:', pFirst, pLast);
  process.exit(1);
}

// Verifica que o buffer EXPANDIU para fora (é maior que o original)
const minLatOrig = Math.min(...polyFeature.coordinates.map(c => c[0]));
const maxLatOrig = Math.max(...polyFeature.coordinates.map(c => c[0]));
const minLatBuf = Math.min(...polyPts.map(c => c[0]));
const maxLatBuf = Math.max(...polyPts.map(c => c[0]));

if (minLatBuf >= minLatOrig || maxLatBuf <= maxLatOrig) {
  console.error('❌ Buffer de Polígono não expandiu para fora!', { minLatOrig, minLatBuf, maxLatOrig, maxLatBuf });
  process.exit(1);
}

// Valida a distância métrica aproximada em latitude (~30 metros)
const R_EARTH = 6371008.8;
const distSul = (minLatOrig - minLatBuf) * (Math.PI / 180) * R_EARTH;
const distNorte = (maxLatBuf - maxLatOrig) * (Math.PI / 180) * R_EARTH;
if (Math.abs(distSul - 30) > 1.0 || Math.abs(distNorte - 30) > 1.0) {
  console.error('❌ Distância métrica divergente de 30m:', { distSul, distNorte });
  process.exit(1);
}

console.log(`✔ Buffer de Polígono validado com sucesso (${polyPts.length} vértices, expandido exatamente ${distSul.toFixed(1)}m para fora).`);

// 5. Salvaguardas de entrada inválida
if (SpatialAlgorithms.generateBuffer(null, 50) !== null) {
  console.error('❌ Deveria retornar null para feature nula');
  process.exit(1);
}
if (SpatialAlgorithms.generateBuffer(polyFeature, 0) !== null) {
  console.error('❌ Deveria retornar null para raio 0');
  process.exit(1);
}
if (SpatialAlgorithms.generateBuffer(polyFeature, NaN) !== null) {
  console.error('❌ Deveria retornar null para raio NaN');
  process.exit(1);
}
console.log('✔ Salvaguardas de entrada testadas com sucesso.');

console.log('🎉 Todos os testes de SpatialAlgorithms.generateBuffer passaram com 100% de sucesso!');
