import { UIBotao, UIBotaoPrimario } from './components/ui-botao';
export * from './components/ui-botao';
declare global {
    interface HTMLElementTagNameMap {
        'ui-botao': UIBotao;
        'ui-botao-primario': UIBotaoPrimario;
    }
}
