/* ==========================================================================
   ConecteMapas - ViewRibbon (SRP Module)
   Abas "Projeto" e "Dados" da ribbon: ciclo do projeto, vista do mapa e painéis.
   Módulo puro (sem DOM): define as abas e calcula o estado dos botões que
   dependem do app (histórico, snap, zoom automático, painéis abertos).
   A aba "Modificar" está em ModifyRibbon.js.
   ========================================================================== */

import { ICONES as ICONES_COMUNS } from './ModifyRibbon.js';

const svg = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const ICONES = {
  ...ICONES_COMUNS,
  projeto: svg('<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><line x1="12" y1="10" x2="12" y2="16"/><line x1="9" y1="13" x2="15" y2="13"/>'),
  salvar: svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'),
  popup: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  buscar: svg('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/>'),
  layout: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>'),
  importExport: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  conta: svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  compartilhar: svg('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>')
};

/** Botões das abas Projeto e Dados cujo estado vem do app (ver computeViewState). */
export const VIEW_ITEM_IDS = [
  'btn-undo',
  'btn-redo',
  'btn-fit',
  'btn-toggle-snap',
  'btn-toggle-autozoom',
  'btn-toggle-layers',
  'btn-toggle-table'
];

/** Aba "Projeto": salvar e desfazer, vista do mapa (enquadrar, snap, zoom, balão) e conta. */
export function buildProjectTab({ accountName = '' } = {}) {
  return {
    id: 'projeto',
    rotulo: 'Projeto',
    grupos: [
      {
        id: 'grp-projeto',
        rotulo: 'Projeto',
        itens: [
          { id: 'btn-open-project', rotulo: 'Projeto', icone: ICONES.projeto, tamanho: 'grande', rotuloAcessivel: 'Novo projeto ou excluir o projeto aberto' },
          { id: 'btn-manual-save', rotulo: 'Salvar', icone: ICONES.salvar, tamanho: 'grande', atalho: 'Ctrl+S' },
          { id: 'btn-undo', rotulo: 'Desfazer', icone: ICONES.desfazer, tamanho: 'pequeno', atalho: 'Ctrl+Z', disabled: true },
          { id: 'btn-redo', rotulo: 'Refazer', icone: ICONES.refazer, tamanho: 'pequeno', atalho: 'Ctrl+Y', disabled: true }
        ]
      },
      {
        id: 'grp-mapa',
        rotulo: 'Mapa',
        itens: [
          { id: 'btn-open-adv-search', rotulo: 'Buscar', icone: ICONES.buscar, tamanho: 'grande', atalho: 'Ctrl+Shift+F' },
          { id: 'btn-fit', rotulo: 'Enquadrar tudo', icone: ICONES.enquadrar, tamanho: 'grande', atalho: 'Z' },
          { id: 'btn-toggle-snap', rotulo: 'Snap', icone: ICONES.snap, tamanho: 'pequeno', tipo: 'toggle', ativo: false, atalho: 'S', rotuloAcessivel: 'Snap magnético a vértices' },
          { id: 'btn-toggle-autozoom', rotulo: 'Zoom auto', icone: ICONES.zoomAuto, tamanho: 'pequeno', tipo: 'toggle', ativo: false, rotuloAcessivel: 'Zoom automático ao importar ou selecionar' },
          { id: 'btn-toggle-popup', rotulo: 'Popup: Off', icone: ICONES.popup, tamanho: 'pequeno', tipo: 'toggle', ativo: false }
        ]
      },
      {
        id: 'grp-conta',
        rotulo: 'Conta',
        itens: [
          { id: 'btn-open-account', rotulo: accountName || 'Entrar', icone: ICONES.conta, tamanho: 'grande' }
        ]
      }
    ]
  };
}

/** Aba "Dados": entrada e saída de dados, painéis do app e compartilhamento. */
export function buildDataTab() {
  return {
    id: 'dados',
    rotulo: 'Dados',
    grupos: [
      {
        id: 'grp-dados',
        rotulo: 'Dados',
        itens: [
          { id: 'btn-open-import-export', rotulo: 'Import / Export', icone: ICONES.importExport, tamanho: 'grande' }
        ]
      },
      {
        id: 'grp-saida',
        rotulo: 'Saída',
        itens: [
          { id: 'btn-open-print-composer', rotulo: 'Layout QGIS', icone: ICONES.layout, tamanho: 'grande' }
        ]
      },
      {
        id: 'grp-paineis',
        rotulo: 'Painéis',
        itens: [
          { id: 'btn-toggle-layers', rotulo: 'Camadas', icone: ICONES.painelCamadas, tamanho: 'grande', tipo: 'toggle', ativo: false, rotuloAcessivel: 'Mostrar ou ocultar o painel de camadas' },
          { id: 'btn-toggle-table', rotulo: 'Tabela', icone: ICONES.tabela, tamanho: 'grande', tipo: 'toggle', ativo: false, atalho: 'Ctrl+K', rotuloAcessivel: 'Mostrar ou ocultar a tabela de atributos' }
        ]
      },
      {
        id: 'grp-colab',
        rotulo: 'Colaboração',
        itens: [
          { id: 'btn-open-share', rotulo: 'Compartilhar', icone: ICONES.compartilhar, tamanho: 'grande' }
        ]
      }
    ]
  };
}

/**
 * Estado dos botões que dependem do app.
 * @param {Object} ctx
 * @param {{undo?: number, redo?: number}} [ctx.history] Passos disponíveis no histórico
 * @param {boolean} [ctx.snap] Snap ligado
 * @param {boolean} [ctx.autoZoom] Zoom automático ligado
 * @param {boolean} [ctx.layersOpen] Painel de camadas visível
 * @param {boolean} [ctx.tableOpen] Tabela de atributos expandida
 * @returns {Record<string, Object>} id do item → propriedades parciais
 */
export function computeViewState({ history = {}, snap = false, autoZoom = false, layersOpen = false, tableOpen = false } = {}) {
  return {
    'btn-undo': { disabled: !(history.undo > 0) },
    'btn-redo': { disabled: !(history.redo > 0) },
    'btn-fit': { disabled: false },
    'btn-toggle-snap': { ativo: !!snap },
    'btn-toggle-autozoom': { ativo: !!autoZoom },
    'btn-toggle-layers': { ativo: !!layersOpen },
    'btn-toggle-table': { ativo: !!tableOpen }
  };
}
