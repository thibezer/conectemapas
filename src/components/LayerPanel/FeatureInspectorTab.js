/* ==========================================================================
   ConecteMapas - FeatureInspectorTab (SRP Facade)
   Responsabilidade Única: Ponto de entrada para a aba de Inspeção de Feições
   ========================================================================== */

import { FeatureInspectorRenderer } from './FeatureInspectorRenderer.js';
import { FeatureInspectorEvents } from './FeatureInspectorEvents.js';
import '@thibezer/ui-components-kit';

export class FeatureInspectorTab {
  /**
   * @param {Object} panel
   * @param {'sidebar'|'floating'} context
   */
  static render(panel, context = 'sidebar') {
    return FeatureInspectorRenderer.render(panel, context);
  }

  /**
   * @param {Object} panel
   * @param {ParentNode} root contêiner onde o inspetor foi desenhado (barra lateral ou janela flutuante)
   */
  static bindEvents(panel, root) {
    FeatureInspectorEvents.bind(panel, root || document);
  }
}
