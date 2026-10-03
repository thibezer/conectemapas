import { UICard } from './components/ui-card';
export * from './components/ui-card';
declare global {
    interface HTMLElementTagNameMap {
        'ui-card': UICard;
    }
}
