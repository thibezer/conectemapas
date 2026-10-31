/* ==========================================================================
   ConecteMapas - CollabAuditTab
   Responsabilidade Única: Aba de Equipe (Chat colaborativo em tempo real e
   trilha de auditoria cronológica das ações do projeto).
   ========================================================================== */

export class CollabAuditTab {
  /** Agrupa entradas consecutivas do mesmo usuário e verbo ("Excluiu feição ..."). */
  static groupAudit(entries) {
    const groups = [];
    for (const entry of entries) {
      const verb = /^(Criou|Editou|Excluiu) feição "/.exec(entry.action || '')?.[1];
      const last = groups[groups.length - 1];
      if (verb && last && last.verb === verb && last.entry.user === entry.user) {
        last.count++;
      } else {
        groups.push({ entry, verb, count: 1 });
      }
    }
    return groups;
  }

  /** Mostra a data só quando a entrada não é de hoje. */
  static formatTime(entry) {
    if (!entry.createdAt) return entry.timestamp || '';
    const d = new Date(entry.createdAt);
    const isToday = d.toDateString() === new Date().toDateString();
    return isToday ? entry.timestamp : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${entry.timestamp}`;
  }

  static renderMessage(panel, msg) {
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
        <div class="cm-chat-text">${safeText}</div>
      </div>
    `;
  }

  static render(panel) {
    const groups = CollabAuditTab.groupAudit(panel.auditLog);
    return `
      <div class="cm-collab-tab">
        <div class="cm-collab-audit">
          <span class="cm-sidebar-section-title">Trilha de Auditoria</span>
          <div class="cm-audit-log-list">
            ${groups.length ? groups.map(({ entry, verb, count }) => {
              const action = count > 1 ? `${verb} ${count} feições` : entry.action;
              return `
              <div class="cm-audit-item">
                <span class="cm-audit-user" title="${panel.escapeHtml(entry.user)}">${panel.escapeHtml(entry.user)}</span>
                <span class="cm-audit-action">${panel.escapeHtml(action)}</span>
                <span class="cm-audit-time">${panel.escapeHtml(CollabAuditTab.formatTime(entry))}</span>
              </div>`;
            }).join('') : '<div class="cm-collab-empty">Nenhuma alteração registrada.</div>'}
          </div>
        </div>

        <div class="cm-collab-chat">
          <span class="cm-sidebar-section-title">Chat da Equipe</span>
          <div class="cm-chat-messages" id="cm-chat-messages-box">
            ${panel.chatMessages.length
              ? panel.chatMessages.map(msg => CollabAuditTab.renderMessage(panel, msg)).join('')
              : '<div class="cm-collab-empty" id="cm-chat-empty">Nenhuma mensagem na sala.</div>'}
          </div>

          <form id="cm-chat-form" class="cm-chat-form">
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
