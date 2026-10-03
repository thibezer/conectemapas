export type ScaleMode = 'screen' | 'world';
export type CanvasLayerCategory = 'base' | 'wms' | 'levantamento' | 'referencia' | 'anotacoes' | 'custom';
export type CanvasLayerType = 'tile' | 'wms' | 'vetorial-linhas' | 'vetorial-pontos' | 'vetorial-poligonos' | 'grid' | string;
export interface LayerStyleDef {
    corPrimaria?: string;
    corSecundaria?: string;
    espessuraLinha?: number;
    tamanhoMarcador?: number;
    estiloMarcador?: 'circle' | 'square' | 'cross' | 'circle-dot' | 'triangle' | 'diamond' | string;
    dashArray?: string;
    scaleMode?: ScaleMode;
    /** Dimensão métrica no terreno em metros quando scaleMode === 'world' */
    dimensaoMetros?: number;
}
export interface PopupAcaoCAD {
    id: string;
    rotulo: string;
    variante?: 'primary' | 'secondary' | 'destrutivo';
}
export interface DestacarElementoOpcoes {
    pan?: boolean;
    zoom?: number;
    duracaoMs?: number;
    cor?: string;
}
export interface CanvasLayerDef {
    id: string;
    nome: string;
    categoria: CanvasLayerCategory;
    tipo: CanvasLayerType;
    visivel: boolean;
    opacidade: number;
    zIndex: number;
    interativo: boolean;
    bloqueada?: boolean;
    minZoom?: number;
    maxZoom?: number;
    estilo: LayerStyleDef;
    acoes?: PopupAcaoCAD[];
    /** Dados ou URL associados à camada */
    dados?: any;
}
export interface CanvasLayerState {
    id: string;
    visivel: boolean;
    opacidade: number;
    zIndex: number;
    bloqueada?: boolean;
    estilo?: Partial<LayerStyleDef>;
}
export interface CanvasGraphicScale {
    markerScaleMultiplier: number;
    lineScaleMultiplier: number;
    scaleModeGlobal?: ScaleMode;
}
/** Entidade pontual geométrica primitiva (agnóstica a domínio) */
export interface PontoCAD {
    id: string | number;
    lat: number;
    lon: number;
    estilo?: string;
    grupoId?: string | number;
    grupoKey?: string | number;
    ordem?: number;
    indice?: number;
    metadados?: Record<string, any>;
    acoes?: PopupAcaoCAD[];
    [key: string]: any;
}
/** Entidade de conexão linear entre nós primitivos (agnóstica a domínio) */
export interface ConexaoCAD {
    origemId: string | number;
    destinoId: string | number;
    tipoLinha?: 'continua' | 'tracejada';
    estilo?: Record<string, any>;
    acoes?: PopupAcaoCAD[];
    [key: string]: any;
}
/** Entidade de área/polígono geométrica (agnóstica a domínio) */
export interface PoligonoCAD {
    id: string | number;
    coordenadas?: number[][] | [number, number][];
    wkt?: string;
    estilo?: Record<string, any>;
    acoes?: PopupAcaoCAD[];
    [key: string]: any;
}
export interface Ponto {
    id: number | string;
    lat?: number;
    lon?: number;
    tipo_ponto?: string;
    tipo?: string;
    nome_vertice?: string;
    ignorar_poligono?: number;
    ordem_caminhamento?: number;
    confrontante_id?: number;
    nome_confrontante?: string;
    nome_propriedade?: string;
    matricula_id?: number;
    planilha_origem?: string;
    este?: number;
    norte?: number;
    altitude?: number;
    acoes?: PopupAcaoCAD[];
}
export interface Segmento {
    ponto_inicio_id: number;
    ponto_fim_id: number;
    tipo_limite_sigef?: string;
    tipo_limite?: string;
    metodo_posicionamento_sigef?: string;
    metodo_posicionamento?: string;
}
export interface BancoPonto extends Ponto {
    codigo_completo?: string;
    este?: number;
    norte?: number;
    altitude?: number;
    metodo_posicionamento?: string;
    tipo_limite?: string;
    confrontante_descritivo?: string;
    matricula_id?: number;
    planilha_origem?: string;
}
export interface Confrontante {
    id?: number | string;
    nome?: string;
    nome_propriedade?: string;
    poligono_wkt?: string;
    pontos?: Ponto[];
}
export interface MapaConfiguracoes {
    perimetroWeight: number;
    fechamentoWeight: number;
    vizinhoWeight: number;
    bancoWeight: number;
    markerSizeBase: number;
    markerStyleM?: string;
    markerSizeM?: number;
    markerStyleP?: string;
    markerSizeP?: number;
    markerStyleV?: string;
    markerSizeV?: number;
    enableAnimations: boolean;
    preferCanvas: boolean;
    crosshair?: boolean;
    satOpacity?: number;
    magnetSnap?: boolean;
    scaleMode?: ScaleMode;
}
export interface CanvasRenderContext {
    pontos?: Ponto[];
    segmentos?: Segmento[];
    bancoPontos?: BancoPonto[];
    confrontantes?: Confrontante[];
    config: MapaConfiguracoes;
    graphicScale: CanvasGraphicScale;
    apiBaseUrl?: string;
    modoSequencial?: boolean;
    chaveGrupo?: string;
    zonaProjecao?: number;
    onMarkerClick?: (pontoId: string | number, isVizinho?: boolean, elemento?: any, coords?: {
        lat: number;
        lon: number;
    }) => void;
    onLayerAction?: (action: string, detail: any) => void;
    onPopupAcao?: (acaoId: string, elementoId: string | number, elemento: any) => void;
}
