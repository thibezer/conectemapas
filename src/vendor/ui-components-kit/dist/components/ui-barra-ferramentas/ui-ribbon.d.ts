import { FerramentaItem, RibbonAba } from './tipos';
import { SafeHTMLElement } from '../../core/ssr-safe';
/**
 * <ui-ribbon> — barra de ferramentas em abas com grupos (estilo AutoCAD / Word / Excel).
 *
 * Atributos: aba-ativa, recolhido, compacto
 * Propriedades: abas, abaAtiva, recolhido
 * Métodos: atualizarItem(id, parcial), definirAbaVisivel(id, visivel), selecionarAba(id)
 * Eventos: ui-ferramenta { id, item, pai?, ativo?, origem, aba }, ui-aba-change { id, aba }
 */
export declare class UIRibbon extends SafeHTMLElement {
    static get observedAttributes(): string[];
    private rootElement;
    private abasElement;
    private gruposElement;
    private _abas;
    private _abaAtiva;
    private menu;
    private listeners;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(name: string, old: string | null, value: string | null): void;
    get abas(): RibbonAba[];
    set abas(val: RibbonAba[]);
    get abaAtiva(): string;
    set abaAtiva(id: string);
    get recolhido(): boolean;
    set recolhido(val: boolean);
    selecionarAba(id: string, emitir?: boolean): void;
    definirAbaVisivel(id: string, visivel: boolean): void;
    /** Atualiza um item (estado ou aparência) sem precisar recriar as abas. */
    atualizarItem(id: string, parcial: Partial<FerramentaItem>): void;
    private abasVisiveis;
    private renderizar;
    private renderizarAbas;
    private renderizarPainel;
    private criarGrupo;
    private criarBotao;
    private botoesPainel;
    private handleClickAbas;
    private handleDblClickAbas;
    private handleKeyDownAbas;
    private handleClickGrupos;
    private handleKeyDownGrupos;
    private handleEscape;
    private handlePointerDownFora;
    private acionar;
    private alternarMenu;
    private fecharMenu;
    private emitir;
}
