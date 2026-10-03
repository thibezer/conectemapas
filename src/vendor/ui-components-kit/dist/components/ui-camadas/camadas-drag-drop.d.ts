import { CamadaItem, FeicaoItem } from './tipos';
export interface UICamadasHost {
    camadas: CamadaItem[];
    feicoes: FeicaoItem[];
    editingLayerId: string | null;
    editingFeatureId: string | null;
    solicitarRenderizacao(): void;
    dispararEvento(nome: string, detalhe: unknown): void;
    salvarLembrancaEstado?(): void;
}
export declare class CamadasDragDropManager {
    private host;
    private shadow;
    constructor(host: UICamadasHost, shadow: ShadowRoot);
    bindAll(): void;
    bindInlineRename(): void;
    bindDragAndDrop(): void;
}
