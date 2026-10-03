export interface MapaBaseItem {
    id: string;
    nome: string;
    descricao?: string;
    thumbnailUrl?: string;
    icone?: string;
}
export type PosicaoSeletorMapaBase = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'inline';
export type VarianteSeletorMapaBase = 'pill' | 'compacto' | 'icone' | 'flutuante';
export interface UISeletorMapaBaseOpcoes {
    mapasBase?: MapaBaseItem[];
    mapaBaseAtivo?: string;
    posicao?: PosicaoSeletorMapaBase;
    variante?: VarianteSeletorMapaBase;
    aberto?: boolean;
    desabilitado?: boolean;
    rotulo?: string;
}
export interface DetalheEventoMapaBaseAlterado {
    mapaBaseId: string;
    item?: MapaBaseItem;
}
