import assert from 'node:assert/strict';
import { ProjectsScreen } from '../src/components/Modals/ProjectsScreen.js';

function testInitials() {
  assert.equal(ProjectsScreen.computeInitials('Projeto Loteamento Urbano'), 'LU');
  assert.equal(ProjectsScreen.computeInitials('Projeto de Paisagismo II'), 'P2');
  assert.equal(ProjectsScreen.computeInitials('Projeto de teste'), 'PT');
  assert.equal(ProjectsScreen.computeInitials('Novo Projeto'), 'NP');
  assert.equal(ProjectsScreen.computeInitials('Fazenda São José'), 'FS');
  assert.equal(ProjectsScreen.computeInitials('Chácara'), 'CH');
  assert.equal(ProjectsScreen.computeInitials(''), 'PM');

  const topThree = new Set([
    ProjectsScreen.computeInitials('Projeto Loteamento Urbano'),
    ProjectsScreen.computeInitials('Projeto de Paisagismo II'),
    ProjectsScreen.computeInitials('Projeto de teste')
  ]);
  assert.equal(topThree.size, 3, 'Projetos distintos não devem colidir em "PR"');
}

function testFormattingAndTheme() {
  assert.equal(ProjectsScreen.formatFeatureCount(0), '0 feições');
  assert.equal(ProjectsScreen.formatFeatureCount(1), '1 feição');
  assert.equal(ProjectsScreen.formatFeatureCount(13398), '13.398 feições');

  const idx1 = ProjectsScreen.themeIndex('proj_a', 'Projeto Loteamento Urbano');
  const idx2 = ProjectsScreen.themeIndex('proj_a', 'Projeto Loteamento Urbano');
  assert.equal(idx1, idx2);
  assert.ok(idx1 >= 0 && idx1 < 8);

  const now = new Date(2026, 10, 12, 15, 30, 0).getTime();
  assert.equal(ProjectsScreen.formatDate(new Date(2026, 10, 12, 15, 29, 35).toISOString(), now), 'Agora');
  assert.equal(ProjectsScreen.formatDate(new Date(2026, 10, 12, 10, 5, 0).toISOString(), now), 'Hoje às 10:05');
  assert.equal(ProjectsScreen.formatDate(new Date(2026, 10, 11, 18, 0, 0).toISOString(), now), 'Ontem');
  assert.equal(ProjectsScreen.formatDate(new Date(2026, 10, 9, 12, 0, 0).toISOString(), now), 'Há 3 dias');
  assert.equal(ProjectsScreen.formatDate('2026-10-01 08:00:00', now), '01/10/2026');
}

function testFilterAndSort() {
  const screen = new ProjectsScreen({
    getCurrentProjectId: () => 'p2'
  });
  screen.projects = [
    { id: 'p1', name: 'Fazenda Beta', featureCount: 500, updatedAt: '2026-11-12T10:00:00Z', role: 'owner' },
    { id: 'p2', name: 'Área Ativa', featureCount: 19, updatedAt: '2026-11-10T10:00:00Z', role: 'owner' },
    { id: 'p3', name: 'Gleba Compartilhada', featureCount: 13398, updatedAt: '2026-11-11T10:00:00Z', role: 'editor' }
  ];

  assert.deepEqual(screen.computeCounts(), { all: 3, mine: 2, shared: 1 });

  // Ordenação 'recent': projeto aberto fica no topo, restante por updatedAt desc
  screen.sort = 'recent';
  assert.deepEqual(screen.getFilteredProjects().map(p => p.id), ['p2', 'p1', 'p3']);

  // Ordenação 'name': alfabética
  screen.sort = 'name';
  assert.deepEqual(screen.getFilteredProjects().map(p => p.id), ['p2', 'p1', 'p3']);

  // Ordenação 'features': decrescente
  screen.sort = 'features';
  assert.deepEqual(screen.getFilteredProjects().map(p => p.id), ['p3', 'p1', 'p2']);

  // Filtros e busca
  screen.filter = 'shared';
  assert.deepEqual(screen.getFilteredProjects().map(p => p.id), ['p3']);

  screen.filter = 'all';
  screen.query = 'beta';
  assert.deepEqual(screen.getFilteredProjects().map(p => p.id), ['p1']);
}

async function testActions() {
  const created = [];
  const renamed = [];
  const deleted = [];
  const left = [];

  const screen = new ProjectsScreen({
    getCurrentProjectId: () => 'p1',
    onCreate: async (payload) => created.push(payload),
    onRename: async (id, name) => {
      renamed.push({ id, name });
      return name;
    },
    onDelete: async (id) => deleted.push(id),
    onLeave: async (id) => left.push(id)
  });

  screen.projects = [
    { id: 'p1', name: 'Projeto Aberto', featureCount: 10, role: 'owner' },
    { id: 'p2', name: 'Projeto Vazio', featureCount: 0, role: 'owner' },
    { id: 'p3', name: 'Projeto Cheio', featureCount: 25, role: 'owner' },
    { id: 'p4', name: 'Projeto Externo', featureCount: 4, role: 'editor' }
  ];

  // Criação com nome informado
  screen.newName = 'Loteamento Sul';
  await screen._createProject();
  assert.equal(created.length, 1);
  assert.equal(created[0].name, 'Loteamento Sul');
  assert.equal(screen.newName, '');

  // Criação sem nome usa sugestão automática
  await screen._createProject();
  assert.equal(created.length, 2);
  assert.match(created[1].name, /^Novo Projeto/);

  // Renomeação inline atualiza lista
  screen.editingId = 'p2';
  screen.editingName = 'Loteamento Norte';
  await screen._commitRename('p2');
  assert.deepEqual(renamed, [{ id: 'p2', name: 'Loteamento Norte' }]);
  assert.equal(screen.projects.find(p => p.id === 'p2').name, 'Loteamento Norte');
  assert.equal(screen.editingId, '');

  // Exclusão de projeto vazio (0 feições) ocorre direto sem digitar nome
  await screen._commitDelete('p2');
  assert.deepEqual(deleted, ['p2']);
  assert.equal(screen.projects.some(p => p.id === 'p2'), false);

  // Exclusão de projeto não vazio exige confirmação pelo nome
  screen.confirmDeleteTyped = 'nome errado';
  await screen._commitDelete('p3');
  assert.equal(deleted.length, 1);
  assert.equal(screen.projects.some(p => p.id === 'p3'), true);

  screen.confirmDeleteTyped = 'Projeto Cheio';
  await screen._commitDelete('p3');
  assert.deepEqual(deleted, ['p2', 'p3']);
  assert.equal(screen.projects.some(p => p.id === 'p3'), false);

  // Sair de projeto compartilhado remove da lista
  await screen._commitLeave('p4');
  assert.deepEqual(left, ['p4']);
  assert.equal(screen.projects.some(p => p.id === 'p4'), false);
}

testInitials();
testFormattingAndTheme();
testFilterAndSort();
await testActions();

console.log('test_projects_screen: OK');
