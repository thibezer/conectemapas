/* ==========================================================================
   ConecteMapas - PrintCloudSync
   Responsabilidade Única: manter as pranchas e a biblioteca de impressão na nuvem.
   - Carga: a nuvem é a fonte; pranchas criadas só neste navegador sobem; a 1ª vez
     (nuvem vazia) envia as pranchas locais (migração).
   - Edição exclusiva: quem abre uma prancha pega a trava (renovada a cada 30 s);
     os demais ficam só visualizando até ela ser liberada.
   - Envio: a prancha ativa sobe após cada salvamento local (agrupado), com baseRev.
   - Leitura: a cada 5 s busca o que mudou (pranchas, travas e biblioteca).
   Sem nuvem (npm run dev sem VITE_CLOUD_API_URL) nada disso roda: só localStorage.
   ========================================================================== */

import { UIToast } from '@thibezer/ui-components-kit';

const KNOWN_PREFIX = 'cm_print_cloud_known_';

export class PrintCloudSync {
  static POLL_MS = 5000;
  static RENEW_MS = 30000;
  static PUSH_DELAY_MS = 1200;

  /**
   * @param composer   PrintComposerModal
   * @param store      PrintCloudStore (ou null = nuvem desativada)
   * @param options    { canWrite: () => boolean, clientId }
   */
  constructor(composer, store, { canWrite = () => true, clientId = '' } = {}) {
    this.composer = composer;
    this.store = store;
    this.canWrite = canWrite;
    this.clientId = clientId;
    this.active = false;
    this.lastRev = 0;
    this.libraryRev = 0;
    this.sheetRevs = new Map();
    this.pushed = new Map();
    this.lock = { sheetId: null, mine: null, holder: null };
    this._pollTimer = null;
    this._renewTimer = null;
    this._pushTimer = null;
    this._pushing = null;
  }

  get enabled() {
    return Boolean(this.store);
  }

  get sheetsManager() {
    return this.composer.sheetsManager;
  }

  // ------------------------------------------------------------------ ciclo
  async start() {
    if (!this.enabled) return;
    this.active = true;
    let data;
    try {
      data = await this.store.changes(0);
    } catch (e) {
      console.warn('[PrintCloudSync] Nuvem indisponível; seguindo com a cópia local.', e);
      this.composer.setReadOnly(false);
      this.startTimers();
      return;
    }
    if (!this.active) return;
    await this.adoptInitial(data);
    await this.acquireActive();
    this.startTimers();
  }

  stop({ keepalive = true } = {}) {
    if (!this.enabled) return;
    this.active = false;
    clearInterval(this._pollTimer);
    clearInterval(this._renewTimer);
    this._pollTimer = this._renewTimer = null;
    if (this._pushTimer) {
      clearTimeout(this._pushTimer);
      this._pushTimer = null;
      this.pushNow();
    }
    if (this.lock.mine && this.lock.sheetId) this.store.release(this.lock.sheetId, { keepalive }).catch(() => {});
    this.lock = { sheetId: null, mine: null, holder: null };
  }

  startTimers() {
    clearInterval(this._pollTimer);
    clearInterval(this._renewTimer);
    this._pollTimer = setInterval(() => this.poll(), PrintCloudSync.POLL_MS);
    this._renewTimer = setInterval(() => this.renew(), PrintCloudSync.RENEW_MS);
  }

  // ------------------------------------------------------------------ carga
  knownIds() {
    try {
      return new Set(JSON.parse(localStorage.getItem(KNOWN_PREFIX + this.composer.projectId) || '[]'));
    } catch (e) {
      return new Set();
    }
  }

  saveKnownIds(ids) {
    try {
      localStorage.setItem(KNOWN_PREFIX + this.composer.projectId, JSON.stringify([...ids]));
    } catch (e) { /* cache apenas */ }
  }

  /**
   * Junta a nuvem com a cópia local: nuvem vence; pranchas que só existem aqui e nunca
   * subiram são enviadas; as que já estiveram na nuvem e sumiram foram excluídas lá.
   */
  async adoptInitial(data) {
    const sm = this.sheetsManager;
    const cloud = (data.sheets || []).filter(s => !s.deleted && s.sheet);
    const known = this.knownIds();
    const cloudIds = new Set(cloud.map(s => s.id));
    const localOnly = sm.sheets.filter(s => !cloudIds.has(s.id) && !known.has(s.id));

    cloud.forEach(s => this.sheetRevs.set(s.id, s.rev));
    this.lastRev = data.rev || 0;

    if (cloud.length) {
      const ordered = [...cloud].sort((a, b) => a.order - b.order).map(s => ({ ...s.sheet, id: s.id }));
      sm.sheets = [...ordered, ...localOnly];
      ordered.forEach(s => this.pushed.set(s.id, JSON.stringify(s)));
      if (!sm.sheets.some(s => s.id === sm.activeSheetId)) sm.activeSheetId = sm.sheets[0].id;
      sm.updateSheetNumbersInTitleBlocks();
      sm.saveToStorage({ skipCloud: true });
      this.composer.loadActiveSheetIntoComposer({ keepSelection: true });
    }
    this.saveKnownIds(new Set([...cloudIds]));

    // Biblioteca: a da nuvem vence; sem ela, sobe a local (se houver algo)
    if (data.library && data.library.data) {
      this.libraryRev = data.library.rev;
      this.composer.setLibrary(data.library.data, { fromCloud: true });
    } else if ((this.composer.library?.filters?.length || this.composer.library?.viewTemplates?.length) && this.canWrite()) {
      this.pushLibrary();
    }

    // Migração / pranchas criadas sem conexão: sobem agora (travando cada uma)
    if (this.canWrite()) {
      for (const sheet of (cloud.length ? localOnly : sm.sheets)) {
        await this.pushSheet(sheet, { releaseAfter: sheet.id !== sm.activeSheetId });
      }
    }
  }

  // ------------------------------------------------------------------ trava
  async acquireActive() {
    const sheetId = this.sheetsManager.activeSheetId;
    if (!sheetId) return;
    if (!this.canWrite()) {
      this.lock = { sheetId, mine: false, holder: null };
      this.composer.setReadOnly(true, null);
      return;
    }
    let res;
    try {
      res = await this.store.lock(sheetId);
    } catch (e) {
      // Sem conexão: segue editando; o envio confere a versão (baseRev) depois
      this.lock = { sheetId, mine: null, holder: null };
      this.composer.setReadOnly(false);
      return;
    }
    if (sheetId !== this.sheetsManager.activeSheetId) return; // trocou de prancha no meio
    if (res.ok) {
      this.lock = { sheetId, mine: true, holder: null };
      this.composer.setReadOnly(false);
    } else if (res.holder) {
      this.lock = { sheetId, mine: false, holder: res.holder };
      this.composer.setReadOnly(true, res.holder);
    }
  }

  async renew() {
    if (!this.active || !this.lock.mine || !this.lock.sheetId) return;
    try {
      const res = await this.store.lock(this.lock.sheetId);
      if (!res.ok && res.holder) {
        // A trava expirou (ex.: sem conexão) e outro operador a pegou
        this.lock = { ...this.lock, mine: false, holder: res.holder };
        this.composer.setReadOnly(true, res.holder);
        UIToast.notificar({ tipo: 'alerta', titulo: 'Prancha em edição por outro operador', mensagem: `${res.holder} passou a editar esta prancha. Ela ficou só para visualização.`, duracao: 6000 });
      }
    } catch (e) { /* tenta de novo no próximo ciclo */ }
  }

  /** Botão "Editar" da faixa de só visualização */
  async tryEdit() {
    await this.acquireActive();
    if (this.lock.mine) {
      UIToast.notificar({ tipo: 'sucesso', titulo: 'Edição liberada', mensagem: 'Agora você está editando esta prancha.', duracao: 2500 });
    } else if (this.lock.holder) {
      UIToast.notificar({ tipo: 'alerta', titulo: 'Prancha ainda em edição', mensagem: `${this.lock.holder} continua editando.`, duracao: 3500 });
    }
  }

  /** Troca de prancha: solta a anterior e tenta pegar a nova */
  async onActiveSheetChanged(previousId) {
    if (!this.enabled || !this.active) return;
    this.pushNow();
    if (previousId && this.lock.mine && this.lock.sheetId === previousId) {
      this.store.release(previousId).catch(() => {});
    }
    this.lock = { sheetId: null, mine: null, holder: null };
    await this.acquireActive();
  }

  // ------------------------------------------------------------------ envio
  /** Chamado após cada gravação local */
  onLocalChange() {
    if (!this.enabled || !this.active) return;
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => {
      this._pushTimer = null;
      this.pushNow();
    }, PrintCloudSync.PUSH_DELAY_MS);
  }

  pushNow() {
    const sm = this.sheetsManager;
    const sheet = sm.getCurrentSheet();
    if (!sheet || this.lock.mine === false || this.composer.readOnly || !this.canWrite()) return null;
    if (this.pushed.get(sheet.id) === JSON.stringify(sheet)) return null;
    this._pushing = this.pushSheet(sheet);
    return this._pushing;
  }

  async pushSheet(sheet, { releaseAfter = false } = {}) {
    const sm = this.sheetsManager;
    const json = JSON.stringify(sheet);
    const order = Math.max(0, sm.sheets.findIndex(s => s.id === sheet.id));
    let res;
    try {
      res = await this.store.saveSheet(sheet, order, this.sheetRevs.get(sheet.id) ?? 0);
    } catch (e) {
      return false; // sem conexão: o próximo salvamento tenta de novo (o JSON continua diferente)
    }
    if (res.ok) {
      this.sheetRevs.set(sheet.id, res.rev);
      this.pushed.set(sheet.id, json);
      const known = this.knownIds();
      known.add(sheet.id);
      this.saveKnownIds(known);
      if (releaseAfter) this.store.release(sheet.id).catch(() => {});
      return true;
    }
    if (res.locked) {
      if (sheet.id === sm.activeSheetId) {
        this.lock = { sheetId: sheet.id, mine: false, holder: res.locked };
        this.composer.setReadOnly(true, res.locked);
      }
      return false;
    }
    if (res.conflict) this.resolveConflict(sheet, res.conflict);
    return false;
  }

  /**
   * Outro operador gravou a prancha enquanto esta cópia estava desatualizada (ex.: sem
   * conexão por mais tempo que a trava): a versão do servidor fica, e a deste navegador
   * vira uma prancha "(sua versão)" para nada se perder.
   */
  resolveConflict(mine, serverRow) {
    const sm = this.sheetsManager;
    const copy = {
      ...JSON.parse(JSON.stringify(mine)),
      id: `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${mine.name} (sua versão)`
    };
    const idx = sm.sheets.findIndex(s => s.id === mine.id);
    if (serverRow?.sheet) {
      sm.sheets[idx] = { ...serverRow.sheet, id: mine.id };
      this.sheetRevs.set(mine.id, serverRow.rev);
      this.pushed.set(mine.id, JSON.stringify(sm.sheets[idx]));
    }
    sm.sheets.splice(idx + 1, 0, copy);
    sm.updateSheetNumbersInTitleBlocks();
    sm.saveToStorage({ skipCloud: true });
    if (mine.id === sm.activeSheetId) this.composer.loadActiveSheetIntoComposer();
    sm.renderSheetsSelectorDOM();
    this.pushSheet(copy, { releaseAfter: true });
    UIToast.notificar({
      tipo: 'alerta',
      titulo: 'Prancha alterada por outro operador',
      mensagem: `A versão da nuvem foi mantida e a sua foi salva como "${copy.name}".`,
      duracao: 7000
    });
  }

  /** Exclusão local de uma prancha (a trava é conferida no servidor) */
  async onSheetDeleted(sheetId) {
    if (!this.enabled) return true;
    try {
      const res = await this.store.deleteSheet(sheetId);
      if (res.locked) {
        UIToast.notificar({ tipo: 'alerta', titulo: 'Prancha não excluída na nuvem', mensagem: `${res.locked} está editando esta prancha.`, duracao: 4000 });
        return false;
      }
      this.sheetRevs.delete(sheetId);
      this.pushed.delete(sheetId);
      const known = this.knownIds();
      known.delete(sheetId);
      this.saveKnownIds(known);
      return true;
    } catch (e) {
      return true; // sem conexão: some daqui; a ausência na próxima carga não a recria (não está mais em "conhecidas")
    }
  }

  async pushLibrary() {
    if (!this.enabled || !this.canWrite()) return;
    try {
      const res = await this.store.saveLibrary(this.composer.library, this.libraryRev);
      if (res.ok) this.libraryRev = res.rev;
      else if (res.conflict?.data) {
        this.libraryRev = res.conflict.rev;
        this.composer.setLibrary(res.conflict.data, { fromCloud: true });
        UIToast.notificar({ tipo: 'alerta', titulo: 'Biblioteca atualizada por outro operador', mensagem: 'Os filtros e modelos foram recarregados. Refaça a última alteração.', duracao: 6000 });
      }
    } catch (e) { /* sem conexão: a próxima alteração tenta de novo */ }
  }

  // ------------------------------------------------------------------ leitura
  async poll() {
    if (!this.active || this._polling) return;
    this._polling = true;
    try {
      const data = await this.store.changes(this.lastRev);
      if (!this.active) return;
      this.applyRemote(data);
    } catch (e) {
      /* sem conexão: tenta de novo */
    } finally {
      this._polling = false;
    }
  }

  applyRemote(data) {
    const sm = this.sheetsManager;
    let listChanged = false;
    let activeChanged = false;
    let activeDeleted = false;

    (data.sheets || []).forEach(row => {
      if (row.clientId === this.clientId && !row.deleted) {
        this.sheetRevs.set(row.id, row.rev); // eco do próprio envio
        return;
      }
      const idx = sm.sheets.findIndex(s => s.id === row.id);
      if (row.deleted) {
        if (idx >= 0) {
          sm.sheets.splice(idx, 1);
          listChanged = true;
          if (row.id === sm.activeSheetId) activeDeleted = true;
        }
        this.sheetRevs.delete(row.id);
        this.pushed.delete(row.id);
        return;
      }
      if (!row.sheet) return;
      const incoming = { ...row.sheet, id: row.id };
      this.sheetRevs.set(row.id, row.rev);
      this.pushed.set(row.id, JSON.stringify(incoming));
      if (idx >= 0) {
        // A prancha que eu estou editando (trava minha) não é sobrescrita
        if (row.id === sm.activeSheetId && this.lock.mine) return;
        sm.sheets[idx] = incoming;
        if (row.id === sm.activeSheetId) activeChanged = true;
      } else {
        sm.sheets.splice(Math.min(row.order, sm.sheets.length), 0, incoming);
      }
      listChanged = true;
    });

    if (listChanged) {
      if (!sm.sheets.length) return; // nunca fica sem prancha: a próxima carga resolve
      if (activeDeleted) {
        sm.activeSheetId = sm.sheets[0].id;
        UIToast.notificar({ tipo: 'alerta', titulo: 'Prancha excluída', mensagem: 'Outro operador excluiu a prancha aberta.', duracao: 4000 });
      }
      sm.updateSheetNumbersInTitleBlocks();
      sm.saveToStorage({ skipCloud: true });
      sm.renderSheetsSelectorDOM();
      if (activeDeleted) {
        this.composer.loadActiveSheetIntoComposer();
        this.onActiveSheetChanged(null);
      } else if (activeChanged) {
        this.composer.loadActiveSheetIntoComposer({ keepSelection: true });
      }
    }

    // Travas: quem está só visualizando vê quando a prancha fica livre
    const activeLock = (data.locks || []).find(l => l.sheetId === sm.activeSheetId);
    if (this.lock.mine === false && this.canWrite()) {
      const holder = activeLock && activeLock.clientId !== this.clientId ? activeLock.userName : null;
      this.lock.holder = holder;
      this.composer.setReadOnly(true, holder, { free: !holder });
    }

    if (data.library && data.library.rev > this.libraryRev) {
      this.libraryRev = data.library.rev;
      if (data.library.clientId !== this.clientId && data.library.data) {
        this.composer.setLibrary(data.library.data, { fromCloud: true });
      }
    }
    this.lastRev = Math.max(this.lastRev, data.rev || 0);
  }
}
