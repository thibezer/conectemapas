/* ==========================================================================
   ConecteMapas - CollabAuditTab
   Responsabilidade Única: Aba de Equipe (Chat colaborativo em tempo real e
   trilha de auditoria cronológica das ações do projeto).
   ========================================================================== */

export class CollabAuditTab {
  static render(panel) {
    return `
      <div style="display: flex; flex-direction: column; gap: 10px; height: 100%;">
        <div>
          <span class="cm-sidebar-section-title" style="display: block; margin-bottom: 4px;">Trilha de Auditoria</span>
          <div class="cm-audit-log-list">
            ${panel.auditLog.length ? panel.auditLog.map(entry => `
              <div class="cm-audit-item">
                <span style="color: var(--cm-primary); font-weight: 600;">${panel.escapeHtml(entry.user)}:</span>
                <span style="color: var(--cm-text);">${panel.escapeHtml(entry.action)}</span>
                <span style="color: var(--cm-text-muted); margin-left: auto;">${panel.escapeHtml(entry.timestamp)}</span>
              </div>
            `).join('') : '<div style="color: var(--cm-text-muted); font-size: 10.5px;">Nenhuma alteração registrada.</div>'}
          </div>
        </div>

        <div style="flex: 1; display: flex; flex-direction: column;">
          <span class="cm-sidebar-section-title" style="display: block; margin-bottom: 4px;">Chat da Equipe</span>
          
          <div class="cm-chat-messages" id="cm-chat-messages-box">
            ${panel.chatMessages.length ? panel.chatMessages.map(msg => {
              const safeUser = panel.escapeHtml(msg.user?.name || 'Operador');
              const safeColor = panel.escapeHtml(msg.user?.color || 'var(--cm-primary)');
              const safeText = panel.escapeHtml(msg.text || '');
              const safeTime = panel.escapeHtml(msg.timestamp || '');
              return `
              <div class="cm-chat-bubble">
                <div class="cm-chat-meta">
                  <span class="cm-chat-user" style="color: ${safeColor}">${safeUser}</span>
                  <span>${safeTime}</span>
                </div>
                <div style="color: var(--cm-text); margin-top: 2px;">${safeText}</div>
              </div>
            `;
            }).join('') : '<div style="color: var(--cm-text-muted); font-size: 10.5px;">Nenhuma mensagem na sala.</div>'}
          </div>

          <form id="cm-chat-form" style="display: flex; gap: 6px; margin-top: 6px; align-items: center;">
            <ui-campo-texto id="cm-chat-input" placeholder="Mensagem da equipe..." style="flex: 1; --ui-campo-altura: 30px; --ui-altura-minima: 30px;"></ui-campo-texto>
            <ui-botao-primario inline type="submit" variante="primary" style="height: 30px; padding: 0 12px; font-size: 11.5px;">
              Enviar
            </ui-botao-primario>
          </form>
        </div>
      </div>
    `;
  }

  static bindEvents(panel) {
    const chatForm = document.getElementById('cm-chat-form');
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('cm-chat-input');
        const text = input?.value?.trim();
        if (text) {
          panel.onSendMessage(text);
          if (input) input.value = '';
        }
      });
    }
  }
}
