import { FeicaoItem } from './tipos';
/**
 * Calcula a distância em metros entre duas coordenadas [lat, lon] ou [lon, lat]
 */
export declare function calcularDistanciaPontos(p1: [number, number], p2: [number, number]): number;
/**
 * Calcula o comprimento total de uma linha de coordenadas em metros
 */
export declare function calcularComprimentoLinha(coords: unknown): number;
/**
 * Calcula a área de um anel poligonal em m² usando fórmula esférica
 */
export declare function calcularAreaPoligono(coords: unknown): number;
/**
 * Formata métrica resumida para lista de feições selecionadas
 */
export declare function formatarMetricaFeicoes(feicoes: FeicaoItem[]): string;
