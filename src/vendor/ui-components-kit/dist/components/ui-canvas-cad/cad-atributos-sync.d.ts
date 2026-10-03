import { UICanvasCAD } from './ui-canvas-cad';
import { GerenciadorBroadcastConfig } from './cad-broadcast';
import { GerenciGeoMapaController } from '../../gerencigeo-canvas/mapa_controller';
export interface ContextoAtributosCAD {
    host: UICanvasCAD;
    controller: GerenciGeoMapaController;
    mapContainer: HTMLDivElement | null;
    broadcastConfig: GerenciadorBroadcastConfig;
    setLayerOpacity: (id: string, op: number) => void;
    setLayerScaleMode: (id: string, mode: any) => void;
    atualizarZonaProjecao: (zona: number) => void;
}
export declare function sincronizarAtributoCAD(ctx: ContextoAtributosCAD, name: string, oldVal: string, newVal: string): void;
