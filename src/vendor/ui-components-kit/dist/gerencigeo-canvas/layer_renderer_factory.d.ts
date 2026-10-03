import { default as L } from 'leaflet';
import { CanvasLayerDef, CanvasRenderContext } from './types';
export interface ILayerRenderer {
    render(layerDef: CanvasLayerDef, map: L.Map, context: CanvasRenderContext): L.Layer | L.LayerGroup | null;
    update(layerDef: CanvasLayerDef, layerInstance: L.Layer | L.LayerGroup, changes: Partial<CanvasLayerDef>, context: CanvasRenderContext, map: L.Map): void;
    destroy(layerInstance: L.Layer | L.LayerGroup, map: L.Map): void;
}
export declare class LayerRendererFactory {
    private static renderers;
    static register(tipo: string, renderer: ILayerRenderer): void;
    static get(tipo: string): ILayerRenderer | undefined;
    static has(tipo: string): boolean;
    static getRegisteredTypes(): string[];
}
