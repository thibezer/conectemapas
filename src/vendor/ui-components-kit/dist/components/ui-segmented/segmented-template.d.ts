import { UISegmentedOpcao } from './ui-segmented';
export declare const ATRIBUTOS_OBSERVADOS_SEGMENTED: string[];
export declare function criarTemplateSegmented(): string;
export declare function criarBotaoOpcao(opcao: UISegmentedOpcao, indice: number, valorAtual: string, desabilitadoGeral: boolean, onClique: () => void): HTMLButtonElement;
