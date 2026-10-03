import { UISeletorMapaBase } from './components/ui-seletor-mapa-base';
export * from './components/ui-seletor-mapa-base';
declare global {
    interface HTMLElementTagNameMap {
        'ui-seletor-mapa-base': UISeletorMapaBase;
        'ui-mapa-base': UISeletorMapaBase;
    }
}
