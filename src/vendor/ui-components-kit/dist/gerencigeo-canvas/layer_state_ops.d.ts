import { default as L } from 'leaflet';
import { CanvasLayerDef, CanvasLayerState, CanvasRenderContext } from './types';
export declare function exportarEstadoCamadas(layers: CanvasLayerDef[]): CanvasLayerState[];
export declare function importarEstadoCamadas(layers: CanvasLayerDef[], state: CanvasLayerState[]): void;
export declare function limparDadosCamadas(layers: CanvasLayerDef[], layerInstances: Map<string, L.Layer | L.LayerGroup>, context: CanvasRenderContext | null, idsCamadas?: string[]): void;
export declare function aplicarDadosCamada(layer: CanvasLayerDef, dados: any, map: L.Map | null, context: CanvasRenderContext | null, layerInstances: Map<string, L.Layer | L.LayerGroup>): void;
