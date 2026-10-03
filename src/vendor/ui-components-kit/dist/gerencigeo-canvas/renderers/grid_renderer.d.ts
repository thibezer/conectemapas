import { default as L } from 'leaflet';
import { ILayerRenderer } from '../layer_renderer_factory';
import { CanvasLayerDef, CanvasRenderContext } from '../types';
export declare class GridLayerRenderer implements ILayerRenderer {
    private moveListenerMap;
    render(layerDef: CanvasLayerDef, map: L.Map, _context: CanvasRenderContext): L.LayerGroup;
    update(layerDef: CanvasLayerDef, layerInstance: L.LayerGroup): void;
    destroy(layerInstance: L.LayerGroup, map: L.Map): void;
}
