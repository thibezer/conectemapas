import { UICanvasCAD } from './components/ui-canvas-cad';
export * from './components/ui-canvas-cad';
export * from './gerencigeo-canvas';
declare global {
    interface HTMLElementTagNameMap {
        'ui-canvas-cad': UICanvasCAD;
    }
}
