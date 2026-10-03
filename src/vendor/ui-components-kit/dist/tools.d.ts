import { UIRibbon, UIPaletaFerramentas } from './components/ui-barra-ferramentas';
export * from './components/ui-barra-ferramentas';
declare global {
    interface HTMLElementTagNameMap {
        'ui-ribbon': UIRibbon;
        'ui-paleta-ferramentas': UIPaletaFerramentas;
    }
}
