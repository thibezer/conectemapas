import { default as L } from 'leaflet';
import { ILayerRenderer } from '../layer_renderer_factory';
import { CanvasLayerDef, CanvasRenderContext } from '../types';
export declare class VectorPolygonsLayerRenderer implements ILayerRenderer {
    render(layerDef: CanvasLayerDef, _map: L.Map, context: CanvasRenderContext): L.LayerGroup;
    private rebuildPolygons;
    update(layerDef: CanvasLayerDef, layerInstance: L.LayerGroup, changes: Partial<CanvasLayerDef>, context: CanvasRenderContext): void;
    destroy(layerInstance: L.LayerGroup, map: L.Map): void;
}
