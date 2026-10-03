import { SafeHTMLElement } from '../../core/ssr-safe';
import { MapaBaseItem, PosicaoSeletorMapaBase } from './tipos';
export declare const MAPAS_BASE_PADRAO: MapaBaseItem[];
export declare class UISeletorMapaBase extends SafeHTMLElement {
    static get observedAttributes(): string[];
    private shadow;
    private listeners;
    private _mapasBase;
    private wrapperEl;
    private triggerBtn;
    private popoverEl;
    private listEl;
    private thumbEl;
    private labelEl;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void;
    get mapaBaseAtivo(): string;
    set mapaBaseAtivo(id: string);
    get valor(): string;
    set valor(id: string);
    get posicao(): PosicaoSeletorMapaBase;
    set posicao(pos: PosicaoSeletorMapaBase);
    get aberto(): boolean;
    set aberto(valor: boolean);
    get compacto(): boolean;
    set compacto(valor: boolean);
    get mapasBase(): MapaBaseItem[];
    definirMapasBase(novosMapas: MapaBaseItem[]): void;
    abrir(): void;
    fechar(): void;
    alternar(): void;
    selecionar(mapaBaseId: string): void;
    private atualizarPosicaoClasses;
    private aplicarEstadoAberto;
    private atualizarGatilho;
    private renderizarOpcoes;
    private atualizarSelecaoVisual;
    private conectarEventos;
}
export declare class UIMapaBase extends UISeletorMapaBase {
}
