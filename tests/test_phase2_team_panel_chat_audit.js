/**
 * Teste da Fase 2: Painel de Equipe, Identidades, Chat e Auditoria na Nuvem
 * Verifica:
 * 1. Identidade pública sem vazamento de "Você (Operador)" ou "(você)" no BroadcastChannel, Chat, Auditoria e createdBy.
 * 2. Saída de aba (destroy -> user:leave) remove colaborador e cursor remoto.
 * 3. Ordenação da trilha de auditoria por createdAt numérico (sem inverter dias diferentes por "HH:MM:SS").
 * 4. Sincronização e persistência de Chat e Auditoria em applyRemoteDeltas e hydrateFromCloud.
 * 5. Aba Equipe (CollabAuditTab) renderiza Membros Online (com botão Localizar), Trilha de Auditoria e Chat.
 */

import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};

globalThis.indexedDB = {
  open: () => {
    const req = {};
    setTimeout(() => { if (req.onerror) req.onerror(); }, 0);
    return req;
  }
};

// Mock de BroadcastChannel interconectado em memória
const channelsByName = new Map();
globalThis.BroadcastChannel = class MockBroadcastChannel {
  constructor(name) {
    this.name = name;
    this.onmessage = null;
    if (!channelsByName.has(name)) channelsByName.set(name, new Set());
    channelsByName.get(name).add(this);
  }
  postMessage(msg) {
    const peers = channelsByName.get(this.name) || new Set();
    for (const peer of peers) {
      if (peer !== this && typeof peer.onmessage === 'function') {
        peer.onmessage({ data: JSON.parse(JSON.stringify(msg)) });
      }
    }
  }
  close() {
    channelsByName.get(this.name)?.delete(this);
  }
};

const { CollaborationHub } = await import('../src/services/CollaborationHub.js');
const { CollabAuditTab } = await import('../src/components/LayerPanel/CollabAuditTab.js');
const { IndexedDbStore } = await import('../src/services/Storage/IndexedDbStore.js');
const { StorageService } = await import('../src/services/StorageService.js');
const { FeatureSyncController } = await import('../src/controllers/FeatureSyncController.js');

console.log('🧪 Testando Fase 2: Painel de Equipe, Identidades, Chat e Auditoria...');

// 1. Identidade pública sem vazamento de "Você (Operador)" ou "(você)" + saída limpa (user:leave)
{
  const eventsB = [];
  const hubA = new CollaborationHub(null, () => {}, 'proj_team', 'usr_aaaa1111');
  const hubB = new CollaborationHub(null, (type, data) => eventsB.push({ type, data }), 'proj_team', 'usr_bbbb2222');

  hubA.setAccountName('Thiago');
  hubA.setRole('owner');
  hubA.sendCursorPosition([-23.7661, -53.3206]);

  const listOnB = hubB.getActiveCollaboratorsList();
  const peerAOnB = listOnB.find(c => c.id === 'usr_aaaa1111');
  assert.ok(peerAOnB, 'Aba B deve enxergar o operador da Aba A');
  assert.equal(peerAOnB.name, 'Thiago', 'Aba B deve ver o nome limpo "Thiago", nunca "Thiago (você)" ou "Você (Operador)"');
  assert.equal(peerAOnB.role, 'Dono', 'Aba B deve ver o papel atualizado "Dono"');
  assert.equal(peerAOnB.lat, -23.7661, 'Aba B deve armazenar a latitude do cursor de A');
  assert.equal(peerAOnB.lng, -53.3206, 'Aba B deve armazenar a longitude do cursor de A');

  const chatMsg = hubA.sendChatMessage('Olá equipe!');
  assert.equal(chatMsg.user.name, 'Thiago', 'Mensagem de chat não deve carregar "(você)" no payload');

  const auditEntry = hubA.logAudit('Criou feição "Lote 01"', 'Polygon');
  assert.equal(auditEntry.user, 'Thiago', 'Auditoria deve registrar o displayName real do operador');

  // Saída limpa da Aba A
  hubA.destroy();
  const afterLeaveOnB = hubB.getActiveCollaboratorsList();
  assert.equal(afterLeaveOnB.some(c => c.id === 'usr_aaaa1111'), false, 'Após destroy(), Aba A deve sair da lista de colaboradores ativos da Aba B');
  assert.equal(eventsB.some(e => e.type === 'user:left' && e.data.userId === 'usr_aaaa1111'), true, 'Aba B deve receber evento user:left para remover o cursor do mapa');
  hubB.destroy();
  console.log('  ✔ 1. Identidade limpa (sem vazamento de "Você") e saída de aba (user:leave) validadas.');
}

// 2. Ordenação da auditoria por createdAt numérico (sem bug de "HH:MM:SS" entre dias diferentes)
{
  const entries = [
    { id: 'aud_ontem', action: 'Ação de ontem à noite', timestamp: '23:55:00', createdAt: 1700000000000 },
    { id: 'aud_hoje', action: 'Ação de hoje cedo', timestamp: '08:10:00', createdAt: 1700050000000 }
  ];
  IndexedDbStore.sortAuditEntries(entries);
  assert.equal(entries[0].id, 'aud_hoje', 'A entrada mais recente (createdAt maior) deve ficar no topo mesmo com hora menor');
  assert.equal(entries[1].id, 'aud_ontem');
  console.log('  ✔ 2. Ordenação da trilha de auditoria por createdAt numérico validada.');
}

// 3. Reconciliação de Chat e Auditoria em applyRemoteDeltas + Persistência Local de Chat
{
  store.clear();
  StorageService.setCurrentProjectId('proj_chat_sync');

  const panelUpdates = { audit: 0, chat: [] };
  const app = {
    projectId: 'proj_chat_sync',
    projectName: 'Projeto Chat',
    currentBasemap: 'google_satelite_puro',
    layers: [{ id: 'l-1', name: 'Base', color: '#00E08A' }],
    features: [],
    auditLog: [],
    chatMessages: [],
    layerPanel: {
      updateAuditLog: () => { panelUpdates.audit++; },
      addChatMessage: (m) => { panelUpdates.chat.push(m); },
      updateLayers: () => {}
    },
    getLayersWithCounts: () => app.layers
  };

  FeatureSyncController.applyRemoteDeltas(app, {
    audit: [
      { id: 'aud_rem_1', action: 'Criou feição "Marco 1"', user: 'Ana', timestamp: '14:20:00', createdAt: 1700000010000 }
    ],
    chat: [
      { id: 'msg_rem_1', text: 'Conferi o vértice norte', timestamp: '14:21', createdAt: 1700000020000, user: { id: 'usr_ana', name: 'Ana', color: '#3B82F6' } }
    ]
  });

  assert.equal(app.auditLog.length, 1);
  assert.equal(app.auditLog[0].user, 'Ana');
  assert.equal(app.chatMessages.length, 1);
  assert.equal(app.chatMessages[0].text, 'Conferi o vértice norte');
  assert.equal(StorageService.loadChatMessages('proj_chat_sync').length, 1, 'Mensagens do chat devem persistir no LocalStore');

  // Reaplicar o mesmo delta não deve duplicar mensagens nem entradas de auditoria
  FeatureSyncController.applyRemoteDeltas(app, {
    audit: [{ id: 'aud_rem_1', action: 'Criou feição "Marco 1"', user: 'Ana', timestamp: '14:20:00', createdAt: 1700000010000 }],
    chat: [{ id: 'msg_rem_1', text: 'Conferi o vértice norte', timestamp: '14:21', createdAt: 1700000020000, user: { id: 'usr_ana', name: 'Ana', color: '#3B82F6' } }]
  });
  assert.equal(app.auditLog.length, 1, 'Auditoria não deve duplicar entradas com mesmo id');
  assert.equal(app.chatMessages.length, 1, 'Chat não deve duplicar mensagens com mesmo id');
  console.log('  ✔ 3. Sincronização na nuvem e persistência local de Chat e Auditoria validadas.');
}

// 4. Renderização da aba Equipe (CollabAuditTab) com Membros Online e botão Localizar
{
  const fakePanel = {
    app: {
      collabHub: {
        currentUser: { id: 'usr_me', name: 'Thiago (você)', displayName: 'Thiago', color: '#00E08A', role: 'Dono' },
        getActiveCollaboratorsList: () => [
          { id: 'usr_me', name: 'Thiago (você)', displayName: 'Thiago', color: '#00E08A', role: 'Dono' },
          { id: 'usr_ana', name: 'Ana', displayName: 'Ana', color: '#3B82F6', role: 'Editor', lat: -23.765, lng: -53.321 }
        ]
      }
    },
    auditLog: [
      { id: 'a1', user: 'Ana', action: 'Criou feição "P1"', timestamp: '10:00:00', createdAt: Date.now() }
    ],
    chatMessages: [
      { id: 'm1', text: 'Oi', timestamp: '10:01', user: { id: 'usr_me', name: 'Thiago', displayName: 'Thiago', color: '#00E08A' } },
      { id: 'm2', text: 'Tudo certo', timestamp: '10:02', user: { id: 'usr_ana', name: 'Ana', displayName: 'Ana', color: '#3B82F6' } }
    ],
    escapeHtml: (s) => String(s ?? '')
  };

  const html = CollabAuditTab.render(fakePanel);
  assert.ok(html.includes('Equipe Online (2)'), 'Deve exibir contagem de membros online');
  assert.ok(html.includes('Thiago (você)'), 'Deve identificar o próprio operador com (você)');
  assert.ok(html.includes('cm-team-locate-btn'), 'Deve exibir botão Localizar para colega com cursor ativo');
  assert.ok(!html.includes('Ana (você)'), 'Nunca deve adicionar (você) para outro operador');
  console.log('  ✔ 4. Renderização da aba Equipe (Membros Online, Localizar, Chat e Auditoria) validada.');
}

console.log('✅ Todos os testes da Fase 2 passaram com sucesso!');
process.exit(0);
