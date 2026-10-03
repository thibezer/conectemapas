import { CamadaItem, FeicaoItem } from './tipos';
import { escapeHtml } from './camadas-utils';
export interface ParametrosRenderArvore {
    camadas: CamadaItem[];
    feicoes: FeicaoItem[];
    camadaAtivaId: string | null;
    expandedLayers: Set<string>;
    selectedFeatureIds: Set<string>;
    activeSettingsLayerId: string | null;
    editingLayerId: string | null;
    editingFeatureId: string | null;
    searchQuery: string;
    limiteFeicoesPorCamada?: number;
}
export { escapeHtml };
export declare function renderizarThumbGeometria(tipo: string | undefined, cor: string): string;
export declare function renderizarArvoreCamadas(params: ParametrosRenderArvore): string;
