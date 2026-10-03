import { PopupAcaoCAD } from './types';
/**
 * Utilitários auxiliares para o ecossistema Canvas/Mapa do GerenciGeo
 */
export declare const escapeHtml: (unsafe: string | null | undefined) => string;
export declare const formatUTM: (val: number | null | undefined, casas?: number) => string;
export interface CoordenadaGeo {
    lat: number;
    lon: number;
}
/**
 * Converte e valida coordenadas geográficas (Lat/Lon) em graus decimais WGS-84.
 * - Trata números e strings no formato brasileiro (vírgula como separador decimal: "-23,7661")
 * - Filtra valores inválidos, NaN, Null Island (0, 0)
 * - Identifica e rejeita coordenadas planas métricas (UTM/SIRGAS2000 acima de 90°/180°)
 */
export declare const parseCoordenada: (rawLat: any, rawLon: any) => CoordenadaGeo | null;
/**
 * Gera o HTML dos botões de ação customizados para o rodapé do popup.
 */
export declare const renderPopupAcoesHtml: (acoes: PopupAcaoCAD[] | undefined | null, elementoId: string | number) => string;
/**
 * Associa os eventos de clique nos botões de ação renderizados dentro do popup do Leaflet.
 */
export declare const bindPopupAcoesEvents: (popup: any, elemento: any, context: {
    onPopupAcao?: (acaoId: string, elementoId: string | number, elemento: any) => void;
}, sourceLayer?: any) => void;
/**
 * Agrupa coleção de pontos geométricos por uma chave de grupo genérica.
 * Prioridade de resolução da chave:
 * 1. ponto[chaveGrupo] (se chaveGrupo for fornecida explicitamente)
 * 2. ponto.grupoId
 * 3. ponto.grupoKey
 * 4. ponto.matricula_id (como `mat_${matricula_id}`)
 * 5. ponto.planilha_origem
 * 6. 'padrao'
 */
export declare const agruparPontosPorChave: (pontos: any[], chaveGrupo?: string) => Record<string, any[]>;
/**
 * Ordena pontos de um grupo por sua propriedade de sequência (ordem, indice, index, seq, ordem_caminhamento, id).
 */
export declare const ordenarPontosPorSequencia: (pontos: any[]) => any[];
/**
 * Extrai o centroide geográfico (Lat, Lon) a partir de uma representação WKT (ex: POLYGON, MULTIPOLYGON, POINT, LINESTRING).
 */
export declare const extrairCentroDeWkt: (wkt: string | null | undefined) => CoordenadaGeo | null;
