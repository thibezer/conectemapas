/* ==========================================================================
   ConecteMapas - CollaborationHub
   Sincronização em Tempo Real (BroadcastChannel), Presença e Cursores ao Vivo
   ========================================================================== */

const PRESENCE_COLORS = ['#00E08A', '#3B82F6', '#F59E0B', '#EF4444', '#A855F7', '#EC4899', '#14B8A6', '#F97316'];

export class CollaborationHub {
  /**
   * @param {Object|null} currentUser
   * @param {Function} onEvent
   * @param {string} projectId
   * @param {string|null} userId id compartilhado com a sincronização em nuvem (StorageService.getClientId())
   */
  constructor(currentUser, onEvent, projectId = 'projeto_padrao', userId = null) {
    const defaultId = userId || (typeof crypto !== 'undefined' && crypto.randomUUID
      ? 'usr_' + crypto.randomUUID().slice(0, 8)
      : 'usr_' + Math.random().toString(36).substring(2, 10));
    const colorIdx = Array.from(defaultId).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % PRESENCE_COLORS.length;

    this.projectId = projectId || 'projeto_padrao';
    this.cloudPresence = new Map();
    this.currentUser = currentUser || {
      id: defaultId,
      name: 'Você (Operador)',
      // Nome exibido aos outros operadores (o local continua vendo "Você")
      displayName: `Operador ${defaultId.slice(-4).toUpperCase()}`,
      role: 'Editor',
      color: PRESENCE_COLORS[colorIdx],
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      status: 'online'
    };

    this.onEvent = onEvent || (() => {});
    this.channel = null;
    this.activeCollaborators = new Map();
    this.lockedFeatures = new Map(); // featureId -> userId
    this.simulationTimer = null;

    this.initChannel();
  }

  initChannel() {
    try {
      this.channel = new BroadcastChannel(`conectemapas_collab_${this.projectId}`);
      this.channel.onmessage = (event) => {
        const { type, data, sender } = event.data;
        if (sender && sender.id === this.currentUser.id) return; // Ignora próprias msgs

        this.handleIncomingMessage(type, data, sender);
      };

      // Anuncia entrada na sala
      this.broadcast('user:join', { user: this.getPublicUser() });
    } catch (e) {
      console.warn('[CollaborationHub] BroadcastChannel não suportado neste ambiente:', e);
    }
  }

  /** Representação pública do operador (sem o sufixo local "(você)" / "Você (Operador)"). */
  getPublicUser() {
    const publicName = this.currentUser.displayName || 'Operador';
    return {
      ...this.currentUser,
      name: publicName,
      displayName: publicName
    };
  }

  broadcast(type, data) {
    if (!this.channel) return;
    try {
      this.channel.postMessage({
        type,
        data,
        sender: this.getPublicUser(),
        timestamp: Date.now()
      });
    } catch (e) {
      console.warn('[CollaborationHub] Erro no broadcast:', e);
    }
  }

  handleIncomingMessage(type, data, sender) {
    if (type === 'user:leave') {
      const leftId = data?.userId || sender?.id;
      if (leftId) {
        this.activeCollaborators.delete(leftId);
        this.onEvent('user:left', { userId: leftId, user: sender });
      }
      return;
    }

    if (sender) {
      const prev = this.activeCollaborators.get(sender.id) || {};
      const cleanName = (sender.displayName || sender.name || 'Operador').replace(/^Você\s*\(Operador\)$/i, 'Operador').replace(/\s*\(você\)$/i, '');
      const coords = type === 'cursor:move' && Array.isArray(data?.latlng) ? data.latlng : null;
      this.activeCollaborators.set(sender.id, {
        ...prev,
        ...sender,
        name: cleanName,
        displayName: cleanName,
        lat: coords && Number.isFinite(coords[0]) ? coords[0] : (prev.lat ?? null),
        lng: coords && Number.isFinite(coords[1]) ? coords[1] : (prev.lng ?? null),
        lastSeen: Date.now()
      });
    }

    switch (type) {
      case 'user:join':
        this.broadcast('user:presence', { user: this.getPublicUser() });
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

      case 'layer:create':
        this.onEvent('layer:created', { layer: data.layer, user: sender });
        break;

      case 'layer:update':
        this.onEvent('layer:updated', { layer: data.layer, user: sender });
        break;

      case 'layer:delete':
        this.onEvent('layer:deleted', { layerId: data.layerId, fallbackLayerId: data.fallbackLayerId || null, user: sender });
        break;

      case 'layers:reorder':
        this.onEvent('layers:reordered', { layers: data.layers, user: sender });
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
    const now = performance.now();
    if (this._lastCursorSend && now - this._lastCursorSend < 50) {
      this._pendingCursorLatLng = latlng;
      if (!this._cursorThrottleTimer) {
        this._cursorThrottleTimer = setTimeout(() => {
          this._cursorThrottleTimer = null;
          this._lastCursorSend = performance.now();
          if (this._pendingCursorLatLng) {
            this.broadcast('cursor:move', { latlng: this._pendingCursorLatLng });
            this._pendingCursorLatLng = null;
          }
        }, 50);
      }
      return;
    }
    this._lastCursorSend = now;
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

  notifyLayerCreated(layer) {
    this.broadcast('layer:create', { layer });
  }

  notifyLayerUpdated(layer) {
    this.broadcast('layer:update', { layer });
  }

  notifyLayerDeleted(layerId, fallbackLayerId = null) {
    this.broadcast('layer:delete', { layerId, fallbackLayerId });
  }

  notifyLayersReordered(layers) {
    this.broadcast('layers:reorder', { layers });
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
    const now = Date.now();
    const message = {
      id: 'msg_' + now + '_' + Math.random().toString(36).slice(2, 6),
      text,
      user: this.getPublicUser(),
      coordinates,
      createdAt: now,
      timestamp: new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
    this.broadcast('chat:message', { message });
    return message;
  }

  logAudit(action, details) {
    const now = Date.now();
    const entry = {
      id: 'aud_' + now + '_' + Math.random().toString(36).slice(2, 6),
      action,
      detail: details || '',
      details: details || '',
      user: this.currentUser.displayName || 'Operador',
      userId: this.currentUser.id,
      createdAt: now,
      timestamp: new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    this.broadcast('audit:log', { entry });
    return entry;
  }

  /**
   * Registra os operadores ativos vistos pela nuvem (outros dispositivos/navegadores)
   * @param {Array<{id: string, name: string, color: string, role?: string, lat?: number, lng?: number}>} list
   */
  setCloudPresence(list) {
    this.cloudPresence = new Map();
    for (const p of list || []) {
      if (p && p.id && p.id !== this.currentUser.id) {
        const cleanName = (p.name || 'Colaborador').replace(/^Você\s*\(Operador\)$/i, 'Colaborador').replace(/\s*\(você\)$/i, '');
        this.cloudPresence.set(p.id, {
          id: p.id,
          name: cleanName,
          displayName: cleanName,
          color: p.color || '#00E08A',
          role: CollaborationHub.roleLabel(p.role) || 'Editor',
          lat: Number.isFinite(p.lat) ? p.lat : null,
          lng: Number.isFinite(p.lng) ? p.lng : null,
          status: 'online'
        });
      }
    }
  }

  /** Nome da conta logada passa a identificar o operador para os demais (null volta ao nome anônimo). */
  setAccountName(name) {
    this._anonymousDisplayName = this._anonymousDisplayName || this.currentUser.displayName;
    const prevDisplay = this.currentUser.displayName;
    this.currentUser.displayName = name || this._anonymousDisplayName;
    this.currentUser.name = name ? `${name} (você)` : 'Você (Operador)';
    if (this.currentUser.displayName !== prevDisplay) {
      this.broadcast('user:presence', { user: this.getPublicUser() });
    }
  }

  setRole(role) {
    const nextRole = CollaborationHub.roleLabel(role) || this.currentUser.role;
    if (nextRole !== this.currentUser.role) {
      this.currentUser.role = nextRole;
      this.broadcast('user:presence', { user: this.getPublicUser() });
    }
  }

  static roleLabel(role) {
    return { owner: 'Dono', editor: 'Editor', viewer: 'Leitor' }[role] || null;
  }

  getActiveCollaboratorsList() {
    const now = Date.now();
    for (const [id, c] of this.activeCollaborators.entries()) {
      if (c.lastSeen && now - c.lastSeen > 60000 && !this.cloudPresence.has(id)) {
        this.activeCollaborators.delete(id);
      }
    }
    const merged = new Map(this.cloudPresence);
    for (const c of this.activeCollaborators.values()) {
      const cloud = merged.get(c.id);
      merged.set(c.id, {
        ...(cloud || {}),
        ...c,
        lat: Number.isFinite(c.lat) ? c.lat : (cloud?.lat ?? null),
        lng: Number.isFinite(c.lng) ? c.lng : (cloud?.lng ?? null)
      });
    }
    merged.delete(this.currentUser.id);
    return [this.currentUser, ...merged.values()];
  }

  destroy() {
    if (this.simulationTimer) clearInterval(this.simulationTimer);
    if (this._cursorThrottleTimer) {
      clearTimeout(this._cursorThrottleTimer);
      this._cursorThrottleTimer = null;
    }
    if (this.channel) {
      try {
        this.broadcast('user:leave', { userId: this.currentUser.id });
      } catch {}
      this.channel.close();
      this.channel = null;
    }
  }
}
