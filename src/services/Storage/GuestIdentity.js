/* ==========================================================================
   ConecteMapas - GuestIdentity
   Nome do convidado (sem conta): guardado no dispositivo até ele criar/entrar
   numa conta. Só lê/grava localStorage; quem pergunta o nome é o GuestNameModal.
   ========================================================================== */

export const GUEST_NAME_KEY = 'cm_guest_name';
export const GUEST_NAME_MIN = 2;
export const GUEST_NAME_MAX = 40;

export class GuestIdentity {
  /** Espaços colapsados, sem caracteres de controle, limitado a GUEST_NAME_MAX. */
  static sanitize(name) {
    return String(name ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, GUEST_NAME_MAX);
  }

  static getName() {
    try {
      return GuestIdentity.sanitize(localStorage.getItem(GUEST_NAME_KEY));
    } catch (e) {
      return '';
    }
  }

  /** @returns {string} nome gravado ('' se inválido) */
  static setName(name) {
    const clean = GuestIdentity.sanitize(name);
    if (clean.length < GUEST_NAME_MIN) return '';
    try {
      localStorage.setItem(GUEST_NAME_KEY, clean);
    } catch (e) { /* sem armazenamento: vale só nesta sessão */ }
    return clean;
  }

  static clear() {
    try {
      localStorage.removeItem(GUEST_NAME_KEY);
    } catch (e) { /* ignore */ }
  }
}
