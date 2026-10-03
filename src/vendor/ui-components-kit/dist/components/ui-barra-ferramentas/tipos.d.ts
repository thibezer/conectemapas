/**
 * Tipos compartilhados pelos componentes de barra de ferramentas:
 *  - <ui-ribbon>              → abas + grupos (estilo AutoCAD / Word / Excel)
 *  - <ui-paleta-ferramentas>  → paleta com flyouts (estilo Illustrator / Photoshop)
 */
/**
 * - `botao`      ação pontual (Desfazer, Colar…). Padrão no ribbon.
 * - `toggle`     liga/desliga de forma independente (Negrito, Grade…).
 * - `ferramenta` seleção exclusiva: só uma ativa por vez (Mover, Linha…). Padrão na paleta.
 * - `menu`       abre um menu com `filhos` (ribbon).
 * - `separador`  divisor visual.
 */
export type TipoFerramenta = 'botao' | 'toggle' | 'ferramenta' | 'menu' | 'separador';
export interface FerramentaItem {
    id: string;
    rotulo?: string;
    /** Nome de um ícone do <ui-icone> ou um trecho `<svg>…</svg>` confiável. */
    icone?: string;
    /** Tecla de atalho exibida no tooltip/menu. Na paleta, com o atributo `atalhos`, também é ativa. */
    atalho?: string;
    tipo?: TipoFerramenta;
    ativo?: boolean;
    disabled?: boolean;
    /** Apenas ribbon: botão grande (ícone sobre o rótulo) ou pequeno (em colunas de 3). Padrão: 'pequeno'. */
    tamanho?: 'grande' | 'pequeno';
    /** Apenas ribbon: oculta o rótulo em botões pequenos. */
    somenteIcone?: boolean;
    /** Ribbon: itens do menu suspenso. Paleta: ferramentas agrupadas (flyout). */
    filhos?: FerramentaItem[];
}
export interface RibbonGrupo {
    id: string;
    rotulo: string;
    itens: FerramentaItem[];
}
export interface RibbonAba {
    id: string;
    rotulo: string;
    grupos: RibbonGrupo[];
    /** Aba contextual (destacada, ex.: "Edição de Polilinha"). */
    contextual?: boolean;
    /** Aba oculta até ser habilitada via `definirAbaVisivel`. */
    oculta?: boolean;
}
export interface FerramentaDetail {
    id: string;
    item: FerramentaItem;
    /** Item pai quando o disparo veio de um menu/flyout. */
    pai?: FerramentaItem;
    /** Estado atual para itens `toggle` / `ferramenta`. */
    ativo?: boolean;
    origem: 'ribbon' | 'paleta';
    /** Apenas ribbon: id da aba ativa no momento do disparo. */
    aba?: string;
}
