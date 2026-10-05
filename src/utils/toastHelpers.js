/* ==========================================================================
   Helpers de notificação — padroniza os padrões de toast reutilizados:
   progresso substituível, copiar para área de transferência e ação "Desfazer".
   ========================================================================== */

import { UIToast } from 'ui-components-kit';
import { ShortcutsController } from '../controllers/ShortcutsController.js';

/**
 * Toast de progresso para operações longas. O resultado final deve chamar
 * `handle.done()` antes de notificar, evitando empilhar "Gerando..." + "Concluído".
 */
export function notifyProgress({ titulo, mensagem, duracao = 30000 }) {
  const toast = UIToast.notificar({ tipo: 'info', titulo, mensagem, duracao });
  return {
    done() {
      try { toast?.fechar?.(); } catch (_) { /* toast já removido pelo usuário */ }
    }
  };
}

/**
 * Copia texto para a área de transferência com um único feedback (sucesso ou falha).
 * Copiar não tem retorno visual próprio, por isso o toast é mantido.
 */
export async function copyToClipboardWithToast(text, titulo = 'Copiado') {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard indisponível');
    await navigator.clipboard.writeText(text);
    UIToast.notificar({ tipo: 'sucesso', titulo, mensagem: text, duracao: 2000 });
    return true;
  } catch (_) {
    UIToast.notificar({ tipo: 'alerta', titulo: 'Não foi possível copiar', mensagem: text, duracao: 4000 });
    return false;
  }
}

/**
 * Aviso de exclusão com botão "Desfazer" (substitui a dica textual "Pressione Ctrl+Z").
 */
export function notifyUndoable(app, { titulo, mensagem, duracao = 5000 }) {
  const toast = UIToast.notificar({
    tipo: 'alerta',
    titulo,
    mensagem,
    duracao,
    acao: {
      rotulo: 'Desfazer',
      tipo: 'primario',
      onClick: () => {
        ShortcutsController.undo(app);
        try { toast?.fechar?.(); } catch (_) { /* já fechado */ }
      }
    }
  });
  return toast;
}
