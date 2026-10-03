import { UIMapa } from './components/ui-mapa';
import { UIMapaMarcador } from './components/ui-mapa/ui-mapa-marcador';
import { UIMapaLinha } from './components/ui-mapa/ui-mapa-linha';
export * from './components/ui-mapa';
declare global {
    interface HTMLElementTagNameMap {
        'ui-mapa': UIMapa;
        'ui-mapa-marcador': UIMapaMarcador;
        'ui-mapa-linha': UIMapaLinha;
    }
}
