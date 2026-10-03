import { CanvasLayerDef, ScaleMode } from '../../gerencigeo-canvas/types';
import { ListenerBag } from '../../core/listener-bag';
export interface PainelCamadasCallbacks {
    setLayerVisibility: (id: string, visivel: boolean) => void;
    setLayerOpacity: (id: string, opacidade: number) => void;
    setLayerBlocked: (id: string, bloqueada: boolean) => void;
    setLayerScaleMode: (id: string, mode: ScaleMode) => void;
}
export declare function renderizarPainelCamadas(container: HTMLElement | null, layers: CanvasLayerDef[], layerItemListeners: ListenerBag, callbacks: PainelCamadasCallbacks): void;
