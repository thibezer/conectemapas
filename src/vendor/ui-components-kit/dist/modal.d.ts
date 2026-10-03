import { UIModal, UIDialog } from './components/ui-modal';
export * from './components/ui-modal';
declare global {
    interface HTMLElementTagNameMap {
        'ui-modal': UIModal;
        'ui-dialog': UIDialog;
    }
}
