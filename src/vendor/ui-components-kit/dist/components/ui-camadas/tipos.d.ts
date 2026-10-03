export type TipoGeometriaFeicao = 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon' | string;
export type StatusGeometriaFeicao = 'oficial' | 'previa' | 'rascunho' | string;
export interface FeicaoEstilo {
    cor?: string;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    opacity?: number;
    fillOpacity?: number;
    dashArray?: string;
    [key: string]: unknown;
}
export type CoordenadasGeoJSON = [number, number] | [number, number][] | [number, number][][] | [number, number][][][] | number[] | number[][] | number[][][] | number[][][][] | unknown;
export interface FeicaoItem {
    id: string;
    name: string;
    layerId: string;
    type?: TipoGeometriaFeicao;
    geometryType?: string;
    visible?: boolean;
    locked?: boolean;
    color?: string;
    style?: FeicaoEstilo;
    category?: string;
    status?: StatusGeometriaFeicao;
    coordinates?: CoordenadasGeoJSON;
    properties?: Record<string, unknown>;
    [key: string]: unknown;
}
export interface CamadaItem {
    id: string;
    name: string;
    color?: string;
    visible?: boolean;
    locked?: boolean;
    opacity?: number;
    order?: number;
    count?: number;
    description?: string;
    [key: string]: unknown;
}
export interface MapaBaseItem {
    id: string;
    nome: string;
    descricao?: string;
    thumbnailUrl?: string;
    icone?: string;
}
export type AbaPainelCamadas = 'camadas' | 'inspecao' | 'equipe';
export interface UICamadasOpcoes {
    camadas?: CamadaItem[];
    feicoes?: FeicaoItem[];
    mapasBase?: MapaBaseItem[];
    mapaBaseAtivo?: string;
    camadaAtivaId?: string;
    abaAtiva?: AbaPainelCamadas;
    colapsavel?: boolean;
    colapsado?: boolean;
    flutuante?: boolean;
    mostrarMapasBase?: boolean;
    mostrarRodape?: boolean;
    mostrarBusca?: boolean;
    densidade?: 'compacto' | 'normal';
}
export interface DetalheEventoCamada {
    camadaId: string;
    camada?: CamadaItem;
}
export interface DetalheEventoVisibilidadeCamada {
    camadaId: string;
    visivel: boolean;
}
export interface DetalheEventoBloqueioCamada {
    camadaId: string;
    bloqueado: boolean;
}
export interface DetalheEventoOpacidadeCamada {
    camadaId: string;
    opacidade: number;
}
export interface DetalheEventoCorCamada {
    camadaId: string;
    cor: string;
}
export interface DetalheEventoRenomearCamada {
    camadaId: string;
    novoNome: string;
}
export interface DetalheEventoFeicao {
    feicaoId: string;
    feicao?: FeicaoItem;
}
export interface DetalheEventoVisibilidadeFeicao {
    feicaoId: string;
    visivel: boolean;
}
export interface DetalheEventoBloqueioFeicao {
    feicaoId: string;
    bloqueado: boolean;
}
export interface DetalheEventoRenomearFeicao {
    feicaoId: string;
    novoNome: string;
}
export interface DetalheEventoMoverFeicao {
    feicaoId: string;
    camadaOrigemId: string;
    camadaDestinoId: string;
    feicao: FeicaoItem;
}
export interface DetalheEventoAcaoMassa {
    feicoesIds: string[];
    feicoes: FeicaoItem[];
    acao: 'visibilidade' | 'bloqueio' | 'cor' | 'mover' | 'excluir' | 'limpar';
    valor?: unknown;
}
