/* ==========================================================================
   ConecteMapas - GeometryVersionManager
   Responsabilidade Única: Gerenciamento e resolução de visibilidade entre
   Geometrias Oficiais e Geometrias Prévias de feições no mapa.
   
   Regras de Negócio:
   1. Se TEM geometria oficial: a geometria prévia aparece SÓ se o usuário solicitar.
      Quando solicitada, a renderização alterna (troca a oficial pela prévia).
   2. Se NÃO TEM geometria oficial: a geometria prévia aparece como PADRÃO.
   3. Suporte a solicitação global (mapa todo) e individual (inspetor / contexto).
   ========================================================================== */

export class GeometryVersionManager {
  /**
   * Identifica o status geodésico da feição ('oficial', 'previa' ou null)
   * @param {Object} feat
   * @returns {'oficial'|'previa'|null}
   */
  static getFeatureStatus(feat) {
    if (!feat) return null;
    const raw = (
      feat.status ||
      feat.properties?.status ||
      feat.properties?.tipo_geometria ||
      feat.properties?.geometry_status ||
      ''
    ).toString().trim().toLowerCase();

    if (raw === 'oficial' || raw === 'official' || raw === 'homologado' || raw === 'definitivo') {
      return 'oficial';
    }
    if (raw === 'previa' || raw === 'prévia' || raw === 'preview' || raw === 'proposta' || raw === 'rascunho') {
      return 'previa';
    }
    return null;
  }

  /**
   * Verifica se a feição é oficial
   * @param {Object} feat
   * @returns {boolean}
   */
  static isOfficial(feat) {
    return this.getFeatureStatus(feat) === 'oficial';
  }

  /**
   * Verifica se a feição é prévia
   * @param {Object} feat
   * @returns {boolean}
   */
  static isPreview(feat) {
    return this.getFeatureStatus(feat) === 'previa';
  }

  /**
   * Localiza a feição oposta correspondente (se oficial busca a prévia; se prévia busca a oficial)
   * @param {Object} feat
   * @param {Array<Object>} allFeatures
   * @returns {Object|null}
   */
  static findLinkedFeature(feat, allFeatures = []) {
    if (!feat || !Array.isArray(allFeatures) || allFeatures.length === 0) return null;

    const featStatus = this.getFeatureStatus(feat);
    const targetStatus = featStatus === 'oficial' ? 'previa' : (featStatus === 'previa' ? 'oficial' : null);

    const featProps = feat.properties || {};
    const featLinkedId = featProps.linkedId || featProps.officialId || featProps.previaId || featProps.parentId;

    for (let i = 0; i < allFeatures.length; i++) {
      const candidate = allFeatures[i];
      if (!candidate || candidate.id === feat.id) continue;

      const candProps = candidate.properties || {};
      const candStatus = this.getFeatureStatus(candidate);

      // Se temos targetStatus esperado, filtra candidatos
      if (targetStatus && candStatus !== targetStatus) {
        continue;
      }

      // 1. Vínculo direto por ID
      if (
        (featLinkedId && featLinkedId === candidate.id) ||
        (candProps.linkedId && candProps.linkedId === feat.id) ||
        (candProps.officialId && candProps.officialId === feat.id) ||
        (candProps.previaId && candProps.previaId === feat.id) ||
        (candProps.parentId && candProps.parentId === feat.id)
      ) {
        return candidate;
      }

      // 2. Vínculo por código de referência / imóvel / matrícula
      if (
        (featProps.codigo && featProps.codigo === candProps.codigo) ||
        (featProps.id_imovel && featProps.id_imovel === candProps.id_imovel) ||
        (featProps.matricula && featProps.matricula === candProps.matricula) ||
        (featProps.refId && featProps.refId === candProps.refId)
      ) {
        return candidate;
      }

      // 3. Vínculo por mesmo nome (se possuírem status opostos)
      if (
        feat.name &&
        candidate.name &&
        feat.name.trim().toLowerCase() === candidate.name.trim().toLowerCase() &&
        featStatus &&
        candStatus &&
        featStatus !== candStatus
      ) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Verifica se a feição possui versão oficial existente no projeto
   * @param {Object} feat
   * @param {Array<Object>} allFeatures
   * @returns {boolean}
   */
  static hasOfficialGeometry(feat, allFeatures = []) {
    if (!feat) return false;
    if (this.isOfficial(feat)) return true;
    if (this.isPreview(feat)) {
      const linked = this.findLinkedFeature(feat, allFeatures);
      return Boolean(linked && this.isOfficial(linked));
    }
    return false;
  }

  /**
   * Verifica se a geometria prévia foi solicitada individualmente para esta feição ou par
   * @param {Object} feat
   * @param {Set<string>} individualPreviewToggles
   * @param {Array<Object>} allFeatures
   * @returns {boolean}
   */
  static isIndividualPreviewRequested(feat, individualPreviewToggles, allFeatures = []) {
    if (!feat || !individualPreviewToggles || individualPreviewToggles.size === 0) return false;

    if (individualPreviewToggles.has(feat.id)) return true;

    const linked = this.findLinkedFeature(feat, allFeatures);
    if (linked && individualPreviewToggles.has(linked.id)) return true;

    return false;
  }

  /**
   * Determina se a feição deve ser renderizada na tela com base nas regras de negócio:
   * 1. Temos geometria oficial: a prévia aparece só se o usuário solicitar (global ou individualmente).
   *    Quando a prévia aparece, a oficial é ocultada (alternância).
   * 2. NÃO temos geometria oficial: a prévia aparece como padrão.
   * @param {Object} feat
   * @param {Array<Object>} allFeatures
   * @param {boolean} globalShowPreviews
   * @param {Set<string>} individualPreviewToggles
   * @returns {boolean}
   */
  static shouldRenderFeature(feat, allFeatures = [], globalShowPreviews = false, individualPreviewToggles = new Set()) {
    if (!feat) return false;
    if (feat.visible === false) return false;

    const status = this.getFeatureStatus(feat);

    // Feições sem status geodésico de versão seguem a visibilidade comum
    if (status !== 'oficial' && status !== 'previa') {
      return true;
    }

    // Caso 1: Feição é Prévia
    if (status === 'previa') {
      const hasOfficial = this.hasOfficialGeometry(feat, allFeatures);

      // Se NÃO temos oficial: a prévia aparece como padrão!
      if (!hasOfficial) {
        return true;
      }

      // Se TEM oficial: a prévia só aparece se solicitada (global ou individualmente)
      const requested = globalShowPreviews || this.isIndividualPreviewRequested(feat, individualPreviewToggles, allFeatures);
      return requested;
    }

    // Caso 2: Feição é Oficial
    if (status === 'oficial') {
      const linkedPreview = this.findLinkedFeature(feat, allFeatures);

      // Se possui prévia vinculada, verifica se a prévia foi solicitada
      if (linkedPreview && this.isPreview(linkedPreview)) {
        const previewRequested = globalShowPreviews || this.isIndividualPreviewRequested(feat, individualPreviewToggles, allFeatures);
        // Se a prévia foi solicitada, a oficial é alternada (fica oculta para ceder espaço à prévia)
        if (previewRequested) {
          return false;
        }
      }

      // Caso contrário, a oficial aparece como padrão
      return true;
    }

    return true;
  }
}
