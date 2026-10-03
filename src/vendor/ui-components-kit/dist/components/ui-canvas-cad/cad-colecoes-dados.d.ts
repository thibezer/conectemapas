import { default as L } from 'leaflet';
import { Ponto, Segmento, BancoPonto, Confrontante, PontoCAD, ConexaoCAD, PoligonoCAD } from '../../gerencigeo-canvas/types';
import { GerenciGeoMapaController } from '../../gerencigeo-canvas/mapa_controller';
export interface ContextoColecoesDados {
    obterController: () => GerenciGeoMapaController;
    obterChaveGrupo: () => string | undefined;
    setLayerVisibility: (id: string, visivel: boolean) => void;
}
/**
 * Gerencia as coleções de entidades geométricas em memória (pontos, segmentos,
 * banco de pontos, confrontantes) e a sincronização com a engine de mapa.
 */
export declare class GerenciadorColecoesDados {
    private contexto;
    private _pontos;
    private _segmentos;
    private _bancoPontos;
    private _confrontantes;
    customMarkerClickHandler?: (pontoId: number, isVizinho?: boolean) => void;
    constructor(contexto: ContextoColecoesDados);
    get pontos(): Ponto[];
    set pontos(val: Ponto[]);
    get segmentos(): Segmento[];
    set segmentos(val: Segmento[]);
    get bancoPontos(): BancoPonto[];
    set bancoPontos(val: BancoPonto[]);
    get confrontantes(): Confrontante[];
    set confrontantes(val: Confrontante[]);
    sincronizarInicial(): void;
    obterElementoPorId(id: string | number): any;
    plotarPontos(pontos?: PontoCAD[] | null, camadaId?: string, onClique?: (ponto: PontoCAD) => void): void;
    plotarConexoes(conexoes?: ConexaoCAD[] | null, camadaId?: string): void;
    plotarPolilinhaSequencial(pontos?: PontoCAD[] | null, fechar?: boolean, camadaId?: string, chaveGrupo?: string): void;
    plotarPoligonos(poligonos?: PoligonoCAD[] | null, camadaId?: string): void;
    limparCamadas(idsCamadas?: string[]): void;
    obterMarcadores(camadaId?: string): L.Marker[];
    plotPontos(pontos?: Ponto[] | null, onMarkerClick?: (pontoId: number, isVizinho?: boolean) => void): void;
    plotSegmentos(segmentos?: Segmento[] | null, pontos?: Ponto[] | null): void;
    plotPolilinhaTemporaria(pontos?: Ponto[] | null): void;
    plotPoligonalHomologada(bancoPontos?: BancoPonto[] | null): void;
    plotPontosVizinhos(pontos?: Ponto[] | null): void;
    plotPoligonosVizinhos(confrontantes?: Confrontante[] | null): void;
    clearOverlays(manterBanco?: boolean): void;
    getMarkers(): L.Marker[];
    getVizinhosMarkers(): L.Marker[];
}
