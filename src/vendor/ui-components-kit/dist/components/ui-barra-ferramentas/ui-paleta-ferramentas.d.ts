import { FerramentaItem } from './tipos';
import { SafeHTMLElement } from '../../core/ssr-safe';
/**
 * <ui-paleta-ferramentas> — paleta de ferramentas (estilo Illustrator / Photoshop).
 *
 * - Itens com `filhos` viram um grupo: mostra a última ferramenta usada e abre um flyout
 *   com clique longo, botão direito ou seta (→ na vertical, ↓ na horizontal).
 * - Ferramentas (`tipo` padrão) são exclusivas; `toggle` liga/desliga; `botao` só dispara ação.
 * - Com o atributo `atalhos`, a tecla `atalho` do item ativa a ferramenta; teclas repetidas
 *   entre itens percorrem o grupo (como Shift+letra no Photoshop).
 *
 * Atributos: valor, orientacao (vertical|horizontal), colunas (1|2), tamanho (sm|md|lg), atalhos
 * Propriedades: ferramentas, valor
 * Métodos: ativar(id), atualizarItem(id, parcial)
 * Eventos: ui-change / ui-selecionar { valor, item, anterior }, ui-ferramenta { id, item, pai?, ativo?, origem }
 */
export declare class UIPaletaFerramentas extends SafeHTMLElement {
    static get observedAttributes(): string[];
    private rootElement;
    private _ferramentas;
    private _ativo;
    private visiveis;
    private menu;
    private timerPressao;
    private suprimirClique;
    private listeners;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(name: string, old: string | null, value: string | null): void;
    get ferramentas(): FerramentaItem[];
    set ferramentas(val: FerramentaItem[]);
    get valor(): string;
    set valor(id: string);
    get value(): string;
    set value(id: string);
    /** Ativa uma ferramenta (exclusiva). Se estiver dentro de um grupo, ela passa a ser a exibida. */
    ativar(id: string, emitir?: boolean): void;
    atualizarItem(id: string, parcial: Partial<FerramentaItem>): void;
    private definirAtivoInterno;
    private itemExibido;
    private todasFerramentas;
    private renderizar;
    private botoes;
    private acionar;
    private handleClick;
    private handlePointerDown;
    private cancelarPressao;
    private handleContextMenu;
    private handleKeyDown;
    private handleAtalho;
    private abrirFlyout;
    private fecharMenu;
}
