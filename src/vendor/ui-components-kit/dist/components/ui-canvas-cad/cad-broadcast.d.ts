import { GerenciGeoMapaController } from '../../gerencigeo-canvas/mapa_controller';
export interface ContextoBroadcastCAD {
    host: HTMLElement;
    controller: GerenciGeoMapaController;
    mapContainer: HTMLDivElement | null;
    setLayerOpacity: (camadaId: string, opacidade: number) => void;
}
/**
 * Gerencia a comunicação assíncrona desacoplada via BroadcastChannel
 * para aplicar parâmetros de tema, cursor e opacidade em tempo real.
 */
export declare class GerenciadorBroadcastConfig {
    private canal;
    private contexto;
    constructor(contexto: ContextoBroadcastCAD);
    conectar(canalNome?: string | null): void;
    processarMensagem(data: any): void;
    desconectar(): void;
}
