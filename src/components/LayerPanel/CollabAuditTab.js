/* ==========================================================================
   ConecteMapas - CollabAuditTab
   Responsabilidade Única: Aba de Equipe (Chat colaborativo em tempo real e
   trilha de auditoria cronológica das ações do projeto).
   ========================================================================== */

import { StorageService } from '../../services/StorageService.js';
import { UIToast } from '@thibezer/ui-components-kit';

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

  static sanitizeCssColor(raw, fallback = '#00E08A') {
    const val = typeof raw === 'string' ? raw.trim() : '';
    return /^#[0-9a-f]{3,8}$/i.test(val) ? val : fallback;
  }

  static renderMessage(panel, msg) {
    const selfId = panel.app?.collabHub?.currentUser?.id;
    const isSelf = !!(selfId && msg.user?.id === selfId);
    const rawName = (msg.user?.displayName || msg.user?.name || 'Operador').replace(/\s*\(você\)$/i, '');
    const displayUser = isSelf ? `${rawName} (você)` : rawName.replace(/^Você\s*\(Operador\)$/i, 'Operador');
    const safeUser = panel.escapeHtml(displayUser);
    const safeColor = this.sanitizeCssColor(msg.user?.color, 'var(--cm-primary)');
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

  static renderMembers(panel) {
    const members = (panel.teamMembers && panel.teamMembers.length > 0)
      ? panel.teamMembers
      : (panel.app?.collabHub?.getActiveCollaboratorsList?.() || []);
    const selfId = panel.app?.collabHub?.currentUser?.id;

    if (!members.length) {
      return '<div class="cm-collab-empty">Nenhum operador conectado.</div>';
    }

    return members.map(m => {
      const isSelf = !!(selfId && m.id === selfId);
      const rawName = (m.displayName || m.name || 'Operador').replace(/\s*\(você\)$/i, '').replace(/^Você\s*\(Operador\)$/i, 'Operador');
      const label = isSelf ? `${rawName} (você)` : rawName;
      const initial = (rawName.trim()[0] || 'U').toUpperCase();
      const color = this.sanitizeCssColor(m.color, '#00E08A');
      const role = panel.escapeHtml(m.role || 'Editor');
      const hasCoords = !isSelf && Number.isFinite(m.lat) && Number.isFinite(m.lng);
      return `
        <div class="cm-team-member-row">
          <span class="cm-team-member-avatar" style="background: ${color}">${panel.escapeHtml(initial)}</span>
          <span class="cm-team-member-name" title="${panel.escapeHtml(label)}">${panel.escapeHtml(label)}</span>
          <span class="cm-team-member-role">${role}</span>
          ${hasCoords ? `<button type="button" class="cm-team-locate-btn" data-lat="${m.lat}" data-lng="${m.lng}" title="Ir até o cursor deste operador no mapa">Localizar</button>` : ''}
        </div>
      `;
    }).join('');
  }

  static renderAuditItems(panel) {
    const groups = CollabAuditTab.groupAudit(panel.auditLog || []);
    if (!groups.length) {
      return '<div class="cm-collab-empty">Nenhuma alteração registrada.</div>';
    }
    return groups.map(({ entry, verb, count }) => {
      const action = count > 1 ? `${verb} ${count} feições` : entry.action;
      const cleanUser = (entry.user || 'Operador').replace(/^Você\s*\(Operador\)$/i, 'Operador');
      return `
        <div class="cm-audit-item">
          <span class="cm-audit-user" title="${panel.escapeHtml(cleanUser)}">${panel.escapeHtml(cleanUser)}</span>
          <span class="cm-audit-action">${panel.escapeHtml(action)}</span>
          <span class="cm-audit-time">${panel.escapeHtml(CollabAuditTab.formatTime(entry))}</span>
        </div>`;
    }).join('');
  }

  static render(panel) {
    const members = (panel.teamMembers && panel.teamMembers.length > 0)
      ? panel.teamMembers
      : (panel.app?.collabHub?.getActiveCollaboratorsList?.() || []);
    return `
      <div class="cm-collab-tab">
        <div class="cm-collab-members">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span class="cm-sidebar-section-title">Equipe Online (${members.length})</span>
            <ui-botao-primario inline id="btn-force-reload-all" variante="ghost" style="height: 22px; padding: 0 8px; font-size: 10.5px;" title="Força todos os operadores com o site aberto a recarregarem a página agora">
              ↻ Atualizar Todos
            </ui-botao-primario>
          </div>
          <div class="cm-team-members-list" id="cm-team-members-box">
            ${CollabAuditTab.renderMembers(panel)}
          </div>
        </div>

        <div class="cm-collab-audit">
          <span class="cm-sidebar-section-title">Trilha de Auditoria</span>
          <div class="cm-audit-log-list" id="cm-audit-log-list">
            ${CollabAuditTab.renderAuditItems(panel)}
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

    const btnReloadAll = document.getElementById('btn-force-reload-all');
    if (btnReloadAll && !btnReloadAll._boundReloadAll) {
      btnReloadAll._boundReloadAll = true;
      btnReloadAll.addEventListener('click', async () => {
        btnReloadAll.setAttribute('disabled', 'true');
        try {
          await StorageService.triggerForceReloadAll(panel.app?.projectId || 'projeto_padrao');
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'Comando Enviado',
            mensagem: 'Todos os usuários conectados recarregarão a página em instantes.',
            duracao: 3500
          });
        } catch (err) {
          UIToast.notificar({
            tipo: 'erro',
            titulo: 'Falha ao disparar atualização',
            mensagem: err.message || 'Não foi possível enviar o comando ao servidor.',
            duracao: 4000
          });
        } finally {
          btnReloadAll.removeAttribute('disabled');
        }
      });
    }

    const membersBox = document.getElementById('cm-team-members-box');
    if (membersBox && !membersBox._boundLocate) {
      membersBox._boundLocate = true;
      membersBox.addEventListener('click', (e) => {
        const btn = e.target?.closest?.('.cm-team-locate-btn');
        if (!btn) return;
        const lat = Number(btn.getAttribute('data-lat'));
        const lng = Number(btn.getAttribute('data-lng'));
        if (Number.isFinite(lat) && Number.isFinite(lng) && panel.app?.mapEngine?.map) {
          panel.app.mapEngine.map.panTo([lat, lng], { animate: true });
        }
      });
    }
  }
}
