import { default as L } from 'leaflet';
import { ILayerRenderer } from '../layer_renderer_factory';
import { CanvasLayerDef, CanvasRenderContext } from '../types';
export declare class WmsLayerRenderer implements ILayerRenderer {
    render(layerDef: CanvasLayerDef, _map: L.Map, _context: CanvasRenderContext): L.Layer | null;
    update(_layerDef: CanvasLayerDef, layerInstance: L.Layer, changes: Partial<CanvasLayerDef>): void;
    destroy(layerInstance: L.Layer, map: L.Map): void;
}
