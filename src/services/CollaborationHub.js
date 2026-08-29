/* ==========================================================================
   ConecteMapas - CollaborationHub
   Sincronização em Tempo Real (BroadcastChannel), Presença e Cursores ao Vivo
   ========================================================================== */

export class CollaborationHub {
  constructor(currentUser, onEvent) {
    const defaultId = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? 'usr_' + crypto.randomUUID().slice(0, 8) 
      : 'usr_' + Math.random().toString(36).substring(2, 10);

    this.currentUser = currentUser || {
      id: defaultId,
      name: 'Você (Operador)',
      role: 'Editor',
      color: '#00E08A',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      status: 'online'
    };

    this.onEvent = onEvent || (() => {});
    this.channel = null;
    this.activeCollaborators = new Map();
    this.lockedFeatures = new Map(); // featureId -> userId
    this.simulationTimer = null;

    this.initChannel();
    this.initSimulatedCollaborators();
  }

  initChannel() {
    try {
      this.channel = new BroadcastChannel('conectemapas_collaboration_v1');
      this.channel.onmessage = (event) => {
        const { type, data, sender } = event.data;
        if (sender && sender.id === this.currentUser.id) return; // Ignora próprias msgs

        this.handleIncomingMessage(type, data, sender);
      };

      // Anuncia entrada na sala
      this.broadcast('user:join', { user: this.currentUser });
    } catch (e) {
      console.warn('[CollaborationHub] BroadcastChannel não suportado neste ambiente:', e);
    }
  }

  initSimulatedCollaborators() {
    // Operadores Virtuais para enriquecer a experiência colaborativa
    const simUsers = [
      {
        id: 'usr_ana_silva',
        name: 'Ana Silva',
        role: 'Topógrafa RTK',
        color: '#38bdf8',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
        status: 'online',
        lastCoords: [-15.7942, -47.8822]
      },
      {
        id: 'usr_carlos_edu',
        name: 'Carlos Eduardo',
        role: 'Engenheiro GIS',
        color: '#f59e0b',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
        status: 'ocupado',
        lastCoords: [-15.7985, -47.8640]
      }
    ];

    simUsers.forEach(u => this.activeCollaborators.set(u.id, u));

    // Movimentação sutil de cursores simulados
    this.simulationTimer = setInterval(() => {
      simUsers.forEach(u => {
        const dLat = (Math.random() - 0.5) * 0.0015;
        const dLng = (Math.random() - 0.5) * 0.0015;
        u.lastCoords = [u.lastCoords[0] + dLat, u.lastCoords[1] + dLng];
        
        this.onEvent('cursor:move', {
          user: u,
          latlng: u.lastCoords
        });
      });
    }, 2800);
  }

  broadcast(type, data) {
    if (!this.channel) return;
    try {
      this.channel.postMessage({
        type,
        data,
        sender: this.currentUser,
        timestamp: Date.now()
      });
    } catch (e) {
      console.warn('[CollaborationHub] Erro no broadcast:', e);
    }
  }

  handleIncomingMessage(type, data, sender) {
    if (sender) {
      this.activeCollaborators.set(sender.id, {
        ...sender,
        lastSeen: Date.now()
      });
    }

    switch (type) {
      case 'user:join':
        this.broadcast('user:presence', { user: this.currentUser });
        this.onEvent('user:joined', { user: sender });
        break;

      case 'user:presence':
        this.onEvent('user:presence', { user: sender });
        break;

      case 'cursor:move':
        this.onEvent('cursor:move', { user: sender, latlng: data.latlng });
        break;

      case 'feature:create':
        this.onEvent('feature:created', { feature: data.feature, user: sender });
        break;

      case 'feature:update':
        this.onEvent('feature:updated', { feature: data.feature, user: sender });
        break;

      case 'feature:delete':
        this.onEvent('feature:deleted', { featureId: data.featureId, user: sender });
        break;

      case 'feature:lock':
        this.lockedFeatures.set(data.featureId, sender.id);
        this.onEvent('feature:locked', { featureId: data.featureId, user: sender });
        break;

      case 'feature:unlock':
        this.lockedFeatures.delete(data.featureId);
        this.onEvent('feature:unlocked', { featureId: data.featureId, user: sender });
        break;

      case 'chat:message':
        this.onEvent('chat:message', { message: data.message, user: sender });
        break;

      case 'audit:log':
        this.onEvent('audit:log', { entry: data.entry, user: sender });
        break;

      default:
        this.onEvent(type, data);
        break;
    }
  }

  sendCursorPosition(latlng) {
    this.broadcast('cursor:move', { latlng });
  }

  notifyFeatureCreated(feature) {
    this.broadcast('feature:create', { feature });
  }

  notifyFeatureUpdated(feature) {
    this.broadcast('feature:update', { feature });
  }

  notifyFeatureDeleted(featureId) {
    this.broadcast('feature:delete', { featureId });
  }

  lockFeature(featureId) {
    this.lockedFeatures.set(featureId, this.currentUser.id);
    this.broadcast('feature:lock', { featureId });
  }

  unlockFeature(featureId) {
    this.lockedFeatures.delete(featureId);
    this.broadcast('feature:unlock', { featureId });
  }

  sendChatMessage(text, coordinates = null) {
    const message = {
      id: 'msg_' + Date.now(),
      text,
      user: this.currentUser,
      coordinates,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
    this.broadcast('chat:message', { message });
    return message;
  }

  logAudit(action, details) {
    const entry = {
      id: 'aud_' + Date.now(),
      action,
      details,
      user: this.currentUser.name,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    this.broadcast('audit:log', { entry });
    return entry;
  }

  getActiveCollaboratorsList() {
    return [this.currentUser, ...Array.from(this.activeCollaborators.values())];
  }

  destroy() {
    if (this.simulationTimer) clearInterval(this.simulationTimer);
    if (this.channel) this.channel.close();
  }
}
