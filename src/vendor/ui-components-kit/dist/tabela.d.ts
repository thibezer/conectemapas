import { UITabela } from './components/ui-tabela';
import { UITabelaPropriedades } from './components/ui-tabela-propriedades';
export * from './components/ui-tabela';
export * from './components/ui-tabela-propriedades';
declare global {
    interface HTMLElementTagNameMap {
        'ui-tabela': UITabela;
        'ui-tabela-propriedades': UITabelaPropriedades;
        'ui-painel-propriedades': UITabelaPropriedades;
        'ui-propriedades': UITabelaPropriedades;
    }
}
