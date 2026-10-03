import { UIRadio } from './ui-radio';
export declare class RadioGrupoRegistry {
    private static registry;
    static getScopeNode(radio: HTMLElement): Node;
    static registrar(radio: UIRadio): void;
    static desregistrar(radio: UIRadio): void;
    static obterRadiosDoGrupo(radio: UIRadio): UIRadio[];
    static desmarcarOutros(radio: UIRadio): void;
    static tratarNavegacaoTeclado(e: KeyboardEvent, radioAtual: UIRadio): void;
}
