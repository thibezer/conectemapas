import { DensidadeTabela } from './tipos';
export interface EstruturaDOMElementos {
    containerElement: HTMLDivElement;
    tableElement: HTMLTableElement;
    theadElement: HTMLTableSectionElement;
    tbodyElement: HTMLTableSectionElement;
    colgroupElement: HTMLTableColElement;
    emptyElement: HTMLDivElement;
    loadingElement: HTMLDivElement;
}
export declare function formatWidth(largura?: string | number): string;
export declare function getAlignmentClass(alinhamento?: string): string;
export declare function getTextAlign(alinhamento?: string): string;
export declare function getRowHeight(densidade: DensidadeTabela): number;
export declare function montarEstruturaDOM(shadow: ShadowRoot, textoVazio: string, maxHeightAttr: string | null, carregando: boolean): EstruturaDOMElementos;
