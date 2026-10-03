import { SeletorTipoItem } from './tipos';
export interface ContextoSeletorTipo {
    tipoContainerElement: HTMLElement | null;
    tipos: SeletorTipoItem[];
    tipoSelecionadoId: string;
    estiloVisual: string;
    onSelecionarTipo: (id: string) => void;
    onEditarTipo: (tipo: SeletorTipoItem) => void;
    onQuickSelect: (tipo: SeletorTipoItem) => void;
    onSelectObjects: (tipo: SeletorTipoItem) => void;
    onCalculadora: (tipo: SeletorTipoItem) => void;
}
export declare function renderizarSeletorTipos(ctx: ContextoSeletorTipo): void;
