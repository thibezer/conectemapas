/* ==========================================================================
   ConecteMapas - ModifyRibbon (SRP Module)
   Aba "Modificar" da ribbon (estilo Revit): reúne em um só lugar tudo o que age
   sobre a seleção. Este módulo é puro (sem DOM): define a aba e calcula, a partir
   da seleção, quais comandos ficam habilitados e como se apresentam.
   ========================================================================== */

export const MODIFY_TAB_ID = 'modificar';
export const MODIFY_ITEM_PREFIX = 'mod-';
export const MODIFY_LAYER_PREFIX = 'mod-layer:';

const svg = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const EYE = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>';
const LOCK_BODY = '<rect x="3" y="11" width="18" height="11" rx="2"/>';

/** Ícones compartilhados com as outras abas da ribbon (ver ViewRibbon.js). */
export const ICONES = {
  selecionarTudo: svg('<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/>'),
  laco: svg('<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>'),
  limpar: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  zoom: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>'),
  propriedades: svg('<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'),
  tabela: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>'),
  balao: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  copiar: svg('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>'),
  estilo: svg('<path d="M12 22a10 10 0 1 1 10-10c0 3-2 4-4.5 4H15a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22z"/><circle cx="7.5" cy="11" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="16.5" cy="11" r="1"/>'),
  contaGotas: svg('<path d="m14 7 3 3"/><path d="m5 16 6-6"/><path d="m19 8.5-4.5-4.5a2.12 2.12 0 0 0-3 0L3.5 12a2.12 2.12 0 0 0 0 3l1.5 1.5-3 5.5 5.5-3 1.5 1.5a2.12 2.12 0 0 0 3 0L20 11.5a2.12 2.12 0 0 0 0-3z"/>'),
  inverter: svg('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
  unir: svg('<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/><path d="M9 6a6 6 0 0 1 0 12"/><path d="M15 6a6 6 0 0 0 0 12"/>'),
  unirPonte: svg('<rect x="2" y="8" width="6" height="8" rx="1.5"/><rect x="16" y="8" width="6" height="8" rx="1.5"/><path d="M8 12h8" stroke-dasharray="2 2.5"/>'),
  dividir: svg('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>'),
  simplificar: svg('<path d="M3 17l5-8 5 5 8-9"/><circle cx="3" cy="17" r="1.5"/><circle cx="21" cy="5" r="1.5"/>'),
  vertices: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  duplicar: svg('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a2 2 0 0 1 2-2h11"/>'),
  buffer: svg('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/>'),
  excluir: svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>'),
  camada: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  bloquear: svg(`${LOCK_BODY}<path d="M7 11V7a5 5 0 0 1 10 0v4"/>`),
  desbloquear: svg(`${LOCK_BODY}<path d="M7 11V7a5 5 0 0 1 9.9-1"/>`),
  mostrar: svg(EYE),
  ocultar: svg(`${EYE}<path d="m3 3 18 18"/>`),
  regua: svg('<rect width="20" height="9" x="2" y="8" rx="1.5"/><line x1="6" y1="8" x2="6" y2="13"/><line x1="10" y1="8" x2="10" y2="11.5"/><line x1="14" y1="8" x2="14" y2="13"/><line x1="18" y1="8" x2="18" y2="11.5"/>'),
  desfazer: svg('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>'),
  refazer: svg('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>'),
  snap: svg('<path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.35-6.35a2.14 2.14 0 0 0-3-3L6 15Z"/><path d="m5 8 4 4"/><path d="m12 15 4 4"/>'),
  zoomAuto: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>'),
  painelCamadas: svg('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'),
  enquadrar: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>')
};

const VERTEX_EDITABLE = new Set(['Polygon', 'LineString', 'Point', 'Circle']);
const SIMPLIFIABLE = new Set(['Polygon', 'LineString']);
const GEOMETRY_COPY = new Set(['Polygon', 'LineString', 'Point', 'Circle', 'Text']);

/**
 * Aba "Modificar". Grupos na ordem em que o fluxo costuma ir: escolher → ver/editar
 * propriedades → estilo → geometria → editar → organizar → medir → histórico.
 * @returns {import('@thibezer/ui-components-kit').RibbonAba}
 */
export function buildModifyTab() {
  return {
    id: MODIFY_TAB_ID,
    rotulo: 'Modificar',
    grupos: [
      {
        id: 'grp-mod-selecao',
        rotulo: 'Seleção',
        itens: [
          { id: 'mod-select-all', rotulo: 'Selecionar tudo', icone: ICONES.selecionarTudo, tamanho: 'grande', atalho: 'Ctrl+A' },
          { id: 'mod-lasso', rotulo: 'Laço', icone: ICONES.laco, tamanho: 'pequeno', tipo: 'ferramenta', atalho: 'Q' },
          { id: 'mod-clear', rotulo: 'Limpar', icone: ICONES.limpar, tamanho: 'pequeno', atalho: 'Esc' },
          { id: 'mod-zoom', rotulo: 'Zoom seleção', icone: ICONES.zoom, tamanho: 'pequeno', rotuloAcessivel: 'Enquadrar a seleção no mapa' }
        ]
      },
      {
        id: 'grp-mod-propriedades',
        rotulo: 'Propriedades',
        itens: [
          { id: 'mod-inspect', rotulo: 'Propriedades', icone: ICONES.propriedades, tamanho: 'grande' },
          { id: 'mod-table', rotulo: 'Tabela', icone: ICONES.tabela, tamanho: 'pequeno' },
          { id: 'mod-popup', rotulo: 'Balão', icone: ICONES.balao, tamanho: 'pequeno' },
          {
            id: 'mod-copy', rotulo: 'Copiar como', icone: ICONES.copiar, tamanho: 'pequeno',
            filhos: [
              { id: 'mod-copy-geojson', rotulo: 'GeoJSON', tipo: 'botao' },
              { id: 'mod-copy-wkt', rotulo: 'WKT', tipo: 'botao' },
              { id: 'mod-copy-coords', rotulo: 'Coordenadas', tipo: 'botao' }
            ]
          }
        ]
      },
      {
        id: 'grp-mod-estilo',
        rotulo: 'Estilo',
        itens: [
          { id: 'mod-style', rotulo: 'Cores', icone: ICONES.estilo, tamanho: 'grande' },
          { id: 'mod-eyedropper', rotulo: 'Copiar estilo', icone: ICONES.contaGotas, tamanho: 'pequeno', tipo: 'ferramenta', atalho: 'I' },
          { id: 'mod-invert', rotulo: 'Inverter cores', icone: ICONES.inverter, tamanho: 'pequeno' }
        ]
      },
      {
        id: 'grp-mod-geometria',
        rotulo: 'Geometria',
        itens: [
          { id: 'mod-join', rotulo: 'Unir', icone: ICONES.unir, tamanho: 'grande', atalho: 'J' },
          { id: 'mod-split', rotulo: 'Dividir', icone: ICONES.dividir, tamanho: 'grande', tipo: 'ferramenta', atalho: 'K' },
          { id: 'mod-join-bridge', rotulo: 'Unir c/ ponte', icone: ICONES.unirPonte, tamanho: 'pequeno', atalho: 'Shift+J', rotuloAcessivel: 'Unir com ponte' },
          { id: 'mod-simplify', rotulo: 'Simplificar', icone: ICONES.simplificar, tamanho: 'pequeno' }
        ]
      },
      {
        id: 'grp-mod-editar',
        rotulo: 'Editar',
        itens: [
          { id: 'mod-vertices', rotulo: 'Vértices', icone: ICONES.vertices, tamanho: 'grande' },
          { id: 'mod-duplicate', rotulo: 'Duplicar', icone: ICONES.duplicar, tamanho: 'grande' },
          { id: 'mod-buffer', rotulo: 'Buffer', icone: ICONES.buffer, tamanho: 'grande' },
          { id: 'mod-delete', rotulo: 'Excluir', icone: ICONES.excluir, tamanho: 'grande', atalho: 'Del' }
        ]
      },
      {
        id: 'grp-mod-organizar',
        rotulo: 'Organizar',
        itens: [
          { id: 'mod-layer', rotulo: 'Camada', icone: ICONES.camada, tamanho: 'grande', filhos: [] },
          { id: 'mod-lock', rotulo: 'Bloquear', icone: ICONES.bloquear, tamanho: 'pequeno' },
          { id: 'mod-visible', rotulo: 'Ocultar', icone: ICONES.ocultar, tamanho: 'pequeno' }
        ]
      },
      {
        id: 'grp-mod-medir',
        rotulo: 'Medir',
        itens: [
          { id: 'mod-measure', rotulo: 'Régua', icone: ICONES.regua, tamanho: 'grande', tipo: 'ferramenta', atalho: 'M' }
        ]
      },
      {
        id: 'grp-mod-historico',
        rotulo: 'Histórico',
        itens: [
          { id: 'mod-undo', rotulo: 'Desfazer', icone: ICONES.desfazer, tamanho: 'pequeno', atalho: 'Ctrl+Z' },
          { id: 'mod-redo', rotulo: 'Refazer', icone: ICONES.refazer, tamanho: 'pequeno', atalho: 'Ctrl+Y' },
          { id: 'mod-fit', rotulo: 'Enquadrar tudo', icone: ICONES.enquadrar, tamanho: 'pequeno', atalho: 'Z' }
        ]
      }
    ]
  };
}

/**
 * Estado de cada comando da aba para a seleção atual. Sempre devolve todos os ids,
 * para que quem aplica possa comparar com o estado anterior e só tocar no que mudou.
 *
 * @param {Object} ctx
 * @param {Array<Object>} ctx.features Feições selecionadas (versões atuais)
 * @param {Array<Object>} [ctx.layers] Camadas do projeto
 * @param {{undo?: number, redo?: number}} [ctx.history] Passos disponíveis no histórico
 * @param {string} [ctx.activeTool] Ferramenta ativa do mapa
 * @returns {Record<string, Object>} id do item → propriedades parciais (disabled, rotulo, icone, ativo, filhos)
 */
export function computeModifyState({ features = [], layers = [], history = {}, activeTool = 'select' } = {}) {
  const sel = features.filter(Boolean);
  const n = sel.length;
  const unlocked = sel.filter(f => f.locked !== true);
  const u = unlocked.length;
  const single = n === 1 ? sel[0] : null;
  const allLocked = n > 0 && u === 0;
  const allHidden = n > 0 && sel.every(f => f.visible === false);
  const none = n === 0;

  const joinable = u >= 2;
  const canVertices = !!single && single.locked !== true && VERTEX_EDITABLE.has(single.type);
  const canSimplify = unlocked.some(f => SIMPLIFIABLE.has(f.type));
  const canCopyGeometry = n > 0 && sel.every(f => GEOMETRY_COPY.has(f.type));
  const hasLayers = layers.length > 0;

  return {
    'mod-select-all': { disabled: false },
    'mod-lasso': { disabled: false, ativo: activeTool === 'pen-select' },
    'mod-clear': { disabled: none },
    'mod-zoom': { disabled: none },

    'mod-inspect': { disabled: !single },
    'mod-table': { disabled: none },
    'mod-popup': { disabled: !single },
    'mod-copy': { disabled: !canCopyGeometry },
    'mod-copy-geojson': { disabled: !canCopyGeometry },
    'mod-copy-wkt': { disabled: !single || !canCopyGeometry },
    'mod-copy-coords': { disabled: !single },

    'mod-style': { disabled: none },
    'mod-eyedropper': { disabled: false, ativo: activeTool === 'eyedropper' },
    'mod-invert': { disabled: !unlocked.some(f => f.type !== 'Text' && !/LineString/.test(f.type)) },

    'mod-join': { disabled: !joinable },
    'mod-join-bridge': { disabled: !joinable },
    'mod-split': { disabled: false, ativo: activeTool === 'split' },
    'mod-simplify': { disabled: !canSimplify },

    'mod-vertices': { disabled: !canVertices },
    'mod-duplicate': { disabled: !single },
    'mod-buffer': { disabled: !single },
    'mod-delete': { disabled: u === 0 },

    'mod-layer': {
      disabled: u === 0 || !hasLayers,
      filhos: layers.map(l => ({
        id: `${MODIFY_LAYER_PREFIX}${l.id}`,
        rotulo: l.name || 'Camada',
        tipo: 'botao',
        ativo: n > 0 && sel.every(f => f.layerId === l.id)
      }))
    },
    'mod-lock': allLocked
      ? { disabled: false, rotulo: 'Desbloquear', icone: ICONES.desbloquear }
      : { disabled: none, rotulo: 'Bloquear', icone: ICONES.bloquear },
    'mod-visible': allHidden
      ? { disabled: false, rotulo: 'Mostrar', icone: ICONES.mostrar }
      : { disabled: none, rotulo: 'Ocultar', icone: ICONES.ocultar },

    'mod-measure': { disabled: false, ativo: activeTool === 'measure' || activeTool === 'measure-line' },

    'mod-undo': { disabled: !(history.undo > 0) },
    'mod-redo': { disabled: !(history.redo > 0) },
    'mod-fit': { disabled: false }
  };
}
