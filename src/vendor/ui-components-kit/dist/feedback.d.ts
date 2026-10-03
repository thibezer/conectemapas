import { UIModal, UIDialog } from './components/ui-modal';
import { UIDrawer, UISheet, UIPainelLateral, UIGaveta } from './components/ui-drawer';
import { UIAlerta, UIToast } from './components/ui-alerta';
import { UITooltip, UIPopover } from './components/ui-tooltip';
import { UISkeleton, UIEsqueleto } from './components/ui-skeleton';
export * from './components/ui-modal';
export * from './components/ui-drawer';
export * from './components/ui-alerta';
export * from './components/ui-tooltip';
export * from './components/ui-skeleton';
declare global {
    interface HTMLElementTagNameMap {
        'ui-modal': UIModal;
        'ui-dialog': UIDialog;
        'ui-drawer': UIDrawer;
        'ui-sheet': UISheet;
        'ui-painel-lateral': UIPainelLateral;
        'ui-gaveta': UIGaveta;
        'ui-alerta': UIAlerta;
        'ui-toast': UIToast;
        'ui-tooltip': UITooltip;
        'ui-popover': UIPopover;
        'ui-skeleton': UISkeleton;
        'ui-esqueleto': UIEsqueleto;
    }
}
