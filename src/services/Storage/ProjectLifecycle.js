/* ==========================================================================
   ConecteMapas - ProjectLifecycle
   Criar e excluir projetos. O projeto é escolhido pela URL (?project=<id>):
   - criar: gera um id seguro, deixa uma "semente" (nome, camadas, enquadramento)
     em localStorage e o app a consome ao abrir o novo id;
   - excluir: apaga na nuvem (só o dono) e depois os dados locais do projeto.
   ========================================================================== */

import { CLOUD_ENABLED } from './StorageConstants.js';
import { LocalStore } from './LocalStore.js';
import { IndexedDbStore } from './IndexedDbStore.js';
import { AccessManager } from './AccessManager.js';
import { AuthService } from './AuthService.js';

export const DEFAULT_PROJECT_ID = 'projeto_padrao';

const SEED_PREFIX = 'cm_project_seed_';
const PROJECT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const SLUG_MAX = 40;
const SUFFIX_LENGTH = 8;
const NAME_MAX = 120;
// Chaves locais por projeto além das do LocalStore (preferências que morrem com o projeto)
const EXTRA_KEY_PREFIXES = ['cm_layers_dirty_', 'cm_access_key_', 'cm-adv-search:', SEED_PREFIX];

function randomSuffix(length = SUFFIX_LENGTH) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

function storage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export class ProjectLifecycle {
  static isValidProjectId(id) {
    return typeof id === 'string' && PROJECT_ID_PATTERN.test(id);
  }

  static normalizeName(name) {
    return String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  }

  /** "Levantamento Área Norte" → "levantamento-area-norte" (só [a-z0-9-]). */
  static slugify(name) {
    return String(name ?? '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, SLUG_MAX)
      .replace(/^-+|-+$/g, '');
  }

  /** slug + sufixo aleatório: imprevisível e só com [a-zA-Z0-9_-] (o servidor descarta o resto). */
  static generateProjectId(name, suffix = randomSuffix()) {
    return `${this.slugify(name) || 'projeto'}_${suffix}`;
  }

  /**
   * Monta a semente do projeto novo. Ids de camada são globais na nuvem (cm_layers.id),
   * então cada projeto ganha ids próprios; reaproveitar os do modelo faria o servidor ignorá-las.
   */
  static buildSeed({ name, layers = [], center = null, zoom = null }, suffix = randomSuffix(6)) {
    return {
      name: this.normalizeName(name),
      layers: layers.map((l, i) => ({ ...l, id: `${l.id || 'layer'}-${suffix}`, order: i })),
      center: Array.isArray(center) && center.length === 2 && center.every(Number.isFinite) ? [...center] : null,
      zoom: Number.isFinite(zoom) ? zoom : null,
      createdAt: new Date().toISOString()
    };
  }

  static stageSeed(projectId, seed) {
    storage()?.setItem(SEED_PREFIX + projectId, JSON.stringify(seed));
  }

  /** Lê e remove a semente do projeto (null se não houver ou estiver corrompida). */
  static takeSeed(projectId) {
    const store = storage();
    if (!store) return null;
    try {
      const raw = store.getItem(SEED_PREFIX + projectId);
      if (!raw) return null;
      store.removeItem(SEED_PREFIX + projectId);
      const seed = JSON.parse(raw);
      if (!seed || typeof seed.name !== 'string' || !seed.name || !Array.isArray(seed.layers)) return null;
      return seed;
    } catch {
      return null;
    }
  }

  /**
   * Cria o projeto (sem navegar) e devolve o id. Com `claim` e login, já o reivindica como dono;
   * se a reivindicação falhar, nada fica para trás e o erro sobe (o usuário pode criar sem ser dono).
   * @returns {Promise<{id: string, claimed: boolean}>}
   */
  static async createProject({ name, layers = [], center = null, zoom = null, claim = false }, { cloudEnabled = CLOUD_ENABLED } = {}) {
    const cleanName = this.normalizeName(name);
    if (!cleanName) throw new Error('Informe o nome do projeto.');
    const id = this.generateProjectId(cleanName);
    this.stageSeed(id, this.buildSeed({ name: cleanName, layers, center, zoom }));

    if (!claim || !cloudEnabled || !AuthService.isLoggedIn()) return { id, claimed: false };
    try {
      await AccessManager.claimProject(id, 'Dono', cleanName);
      return { id, claimed: true };
    } catch (err) {
      this.takeSeed(id);
      throw new Error(`Não foi possível torná-lo dono: ${err.message}. Tente de novo ou desmarque a opção.`);
    }
  }

  /** Confirmação da exclusão: o nome digitado confere (espaços extras não contam; maiúsculas sim). */
  static deletionConfirmed(typed, projectName) {
    const squash = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
    const a = squash(typed);
    return a !== '' && a === squash(projectName);
  }

  /** Quem pode excluir: com nuvem, só o dono; no modo local, qualquer um (só há dados deste navegador). */
  static canDelete(projectId, role = AccessManager.getRole(projectId), cloudEnabled = CLOUD_ENABLED) {
    if (projectId === DEFAULT_PROJECT_ID) return { allowed: false, reason: 'O projeto padrão não pode ser excluído.' };
    if (!cloudEnabled) return { allowed: true, reason: '' };
    if (role === 'owner') return { allowed: true, reason: '' };
    if (role === 'deleted') return { allowed: false, reason: 'Este projeto já foi excluído.' };
    if (role === 'editor' || role === null) {
      return { allowed: false, reason: 'Somente o dono pode excluir. Se o projeto ainda não tem dono, proteja-o primeiro em Compartilhar.' };
    }
    return { allowed: false, reason: 'Somente o dono pode excluir este projeto.' };
  }

  /**
   * Exclui na nuvem (se houver) e depois apaga a cópia local. Erro da nuvem interrompe antes de apagar.
   * `beforePurge` roda entre as duas etapas: o app para de salvar ali, senão um salvamento agendado
   * recriaria a cópia local logo depois de apagada.
   */
  static async deleteProject(projectId, { cloudEnabled = CLOUD_ENABLED, beforePurge = null } = {}) {
    if (!this.isValidProjectId(projectId) || projectId === DEFAULT_PROJECT_ID) {
      throw new Error('Este projeto não pode ser excluído.');
    }
    if (cloudEnabled) {
      try {
        await AccessManager.deleteProject(projectId);
      } catch (err) {
        // Já excluído (outra aba/dispositivo): falta só limpar a cópia local
        if (err.code !== 'project_deleted') throw err;
      }
    }
    if (beforePurge) beforePurge();
    await this.purgeLocalProject(projectId);
  }

  /** Remove IndexedDB (projeto, camadas, feições, auditoria) e as chaves de localStorage do projeto. */
  static async purgeLocalProject(projectId) {
    LocalStore.purgeProject(projectId);
    const store = storage();
    if (store) {
      for (const prefix of EXTRA_KEY_PREFIXES) {
        try { store.removeItem(prefix + projectId); } catch {}
      }
    }
    await IndexedDbStore.deleteProjectData(projectId);
  }

  /** Para onde ir depois de excluir: outro projeto da conta, depois um local recente, por fim o padrão. */
  static async pickFallbackProject(deletedId) {
    const usable = (id) => this.isValidProjectId(id) && id !== deletedId;
    if (CLOUD_ENABLED && AuthService.isLoggedIn()) {
      try {
        const mine = await AuthService.listMyProjects();
        const next = mine.find(p => usable(p.id));
        if (next) return next.id;
      } catch {}
    }
    const local = LocalStore.listProjects().find(p => usable(p.id));
    return local ? local.id : DEFAULT_PROJECT_ID;
  }
}
