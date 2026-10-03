import { UIAlerta } from './ui-alerta-base';
export interface UIToastAcao {
    rotulo: string;
    onClick: (e: MouseEvent) => void;
    tipo?: 'primario' | 'secundario' | 'destrutivo';
}
export interface UIToastOpcoes {
    tipo?: 'sucesso' | 'erro' | 'alerta' | 'info';
    titulo?: string;
    mensagem: string;
    duracao?: number;
    posicao?: 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left' | 'bottom-center' | 'top-center';
    acao?: UIToastAcao;
    fechavel?: boolean;
    pausarNoHover?: boolean;
}
export declare class UIToast extends UIAlerta {
    private timerId;
    private tempoRestante;
    private inicioTimestamp;
    private isPausado;
    private acaoConfig?;
    private containerRef;
    configurarAcao(acao: UIToastAcao): void;
    connectedCallback(): void;
    fechar(): void;
    disconnectedCallback(): void;
    private handleAcaoClick;
    private iniciarTimer;
    private pausarTimer;
    private retomarTimer;
    private static obterContainer;
    static notificar(opcoes: UIToastOpcoes): any;
}
