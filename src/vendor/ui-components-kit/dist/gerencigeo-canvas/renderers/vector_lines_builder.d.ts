import { default as L } from 'leaflet';
import { CanvasLayerDef, CanvasRenderContext } from '../types';
export declare function calculateLineWeight(layerDef: CanvasLayerDef, map: L.Map, context: CanvasRenderContext): number;
export declare function rebuildVectorLines(layerDef: CanvasLayerDef, group: L.LayerGroup, map: L.Map, context: CanvasRenderContext, paneName: string): void;
