// O nome ao lado do logo acompanha o nome real do projeto (sem renomeio legado do cabeçalho).
import assert from 'assert';
import { AppBootstrapSync } from '../src/bootstrap/AppBootstrapSync.js';

const input = { value: 'Levantamento Topográfico - Umuarama' };
globalThis.document = { getElementById: (id) => (id === 'cm-project-name-input' ? input : null), activeElement: null };

const app = { projectName: 'Levantamento Topográfico - Umuarama', headerBar: { projectName: 'x' } };
AppBootstrapSync.showProjectName(app, 'Levantamento Planialtimétrico - Brasília');
assert.strictEqual(app.projectName, 'Levantamento Planialtimétrico - Brasília');
assert.strictEqual(app.headerBar.projectName, 'Levantamento Planialtimétrico - Brasília');
assert.strictEqual(input.value, 'Levantamento Planialtimétrico - Brasília');

// Campo em digitação não é sobrescrito
document.activeElement = input;
input.value = 'digitando';
AppBootstrapSync.showProjectName(app, 'Outro');
assert.strictEqual(input.value, 'digitando');
assert.strictEqual(app.projectName, 'Outro');

console.log('✅ test_project_name_header OK');

// Nome padrão de projeto novo: "Novo Projeto", "Novo Projeto 1", "Novo Projeto 2"...
const { ProjectLifecycle } = await import('../src/services/Storage/ProjectLifecycle.js');
assert.strictEqual(ProjectLifecycle.nextDefaultName([]), 'Novo Projeto');
assert.strictEqual(ProjectLifecycle.nextDefaultName(['Outro']), 'Novo Projeto');
assert.strictEqual(ProjectLifecycle.nextDefaultName(['Novo Projeto']), 'Novo Projeto 1');
assert.strictEqual(ProjectLifecycle.nextDefaultName(['novo projeto', 'Novo Projeto 1', 'Novo Projeto 3']), 'Novo Projeto 2');
assert.strictEqual(ProjectLifecycle.nextDefaultName(undefined), 'Novo Projeto');
console.log('✅ nomes padrão OK');
