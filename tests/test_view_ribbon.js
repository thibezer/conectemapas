import assert from 'assert';
import { VIEW_ITEM_IDS, buildDataTab, buildProjectTab, computeViewState } from '../src/components/ViewRibbon.js';
import { buildModifyTab } from '../src/components/ModifyRibbon.js';

console.log('🧪 Iniciando testes das abas Projeto e Dados da ribbon...');

const flat = (tab) => tab.grupos.flatMap(g => g.itens.flatMap(i => [i, ...(i.filhos || [])]));

// ---- Definição das abas ---------------------------------------------------
{
  const tabs = [buildProjectTab({ accountName: 'Ana' }), buildModifyTab(), buildDataTab()];
  assert.deepStrictEqual(tabs.map(t => t.id), ['projeto', 'modificar', 'dados']);

  const items = tabs.flatMap(flat);
  const ids = items.map(i => i.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'ids únicos em todas as abas (atualizarItem acha pelo id)');
  assert(items.every(i => i.rotulo), 'todo item tem rótulo');
  assert(items.filter(i => !i.id.startsWith('mod-copy-')).every(i => i.icone), 'todo botão (fora dos filhos de menu) tem ícone');

  for (const id of VIEW_ITEM_IDS) assert(ids.includes(id), `${id} existe em alguma aba`);
  console.log('✔ Definição das abas (ids únicos, rótulos, ícones) passou');
}

// ---- Conteúdo reorganizado ------------------------------------------------
{
  const projeto = flat(buildProjectTab()).map(i => i.id);
  for (const id of ['btn-manual-save', 'btn-undo', 'btn-redo', 'btn-fit', 'btn-toggle-snap', 'btn-toggle-autozoom',
    'btn-toggle-popup', 'btn-open-adv-search', 'btn-open-account']) {
    assert(projeto.includes(id), `${id} na aba Projeto`);
  }
  const dados = flat(buildDataTab()).map(i => i.id);
  for (const id of ['btn-open-import-export', 'btn-open-print-composer', 'btn-toggle-layers', 'btn-toggle-table', 'btn-open-share']) {
    assert(dados.includes(id), `${id} na aba Dados`);
  }
  assert.strictEqual(buildProjectTab({ accountName: 'Ana' }).grupos.at(-1).itens[0].rotulo, 'Ana', 'botão da conta mostra o nome');
  assert.strictEqual(buildProjectTab().grupos.at(-1).itens[0].rotulo, 'Entrar');

  // Todo toggle precisa de estado inicial explícito (o app é quem o define depois)
  for (const item of [...flat(buildProjectTab()), ...flat(buildDataTab())].filter(i => i.tipo === 'toggle')) {
    assert.strictEqual(typeof item.ativo, 'boolean', `${item.id} começa com ativo definido`);
  }
  console.log('✔ Conteúdo das abas Projeto e Dados passou');
}

// ---- Estado ---------------------------------------------------------------
{
  const vazio = computeViewState();
  assert.deepStrictEqual(Object.keys(vazio).sort(), [...VIEW_ITEM_IDS].sort(), 'estado cobre exatamente os botões de vista');
  assert.strictEqual(vazio['btn-undo'].disabled, true);
  assert.strictEqual(vazio['btn-redo'].disabled, true);
  assert.strictEqual(vazio['btn-toggle-snap'].ativo, false);

  const cheio = computeViewState({ history: { undo: 3, redo: 1 }, snap: true, autoZoom: true, layersOpen: true, tableOpen: true });
  assert.strictEqual(cheio['btn-undo'].disabled, false);
  assert.strictEqual(cheio['btn-redo'].disabled, false);
  for (const id of ['btn-toggle-snap', 'btn-toggle-autozoom', 'btn-toggle-layers', 'btn-toggle-table']) {
    assert.strictEqual(cheio[id].ativo, true, `${id} ativo`);
  }
  assert.strictEqual(computeViewState({ snap: undefined })['btn-toggle-snap'].ativo, false, 'indefinido vira falso');
  console.log('✔ Estado dos botões de vista passou');
}

console.log('🎉 Testes das abas Projeto e Dados concluídos com sucesso!');
