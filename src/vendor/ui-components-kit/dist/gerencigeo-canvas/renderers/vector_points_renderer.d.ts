import { default as L } from 'leaflet';
import { ILayerRenderer } from '../layer_renderer_factory';
import { CanvasLayerDef, CanvasRenderContext } from '../types';
export declare class VectorPointsLayerRenderer implements ILayerRenderer {
    private zoomListenerMap;
    render(layerDef: CanvasLayerDef, map: L.Map, context: CanvasRenderContext): L.LayerGroup;
    private calculateSize;
    private rebuildPoints;
    update(layerDef: CanvasLayerDef, layerInstance: L.LayerGroup, changes: Partial<CanvasLayerDef>, context: CanvasRenderContext, map: L.Map): void;
    destroy(layerInstance: L.LayerGroup, map: L.Map): void;
}
