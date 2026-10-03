import { MapaConfiguracoes } from './types';
export declare const DEFAULT_CONFIG: MapaConfiguracoes;
export declare class MapaConfigManager {
    private static instance;
    private config;
    private constructor();
    static getInstance(): MapaConfigManager;
    private loadConfig;
    saveConfig(newConfig: Partial<MapaConfiguracoes>): void;
    getConfig(): MapaConfiguracoes;
}
