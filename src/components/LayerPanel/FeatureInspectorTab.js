/* ==========================================================================
   ConecteMapas - FeatureInspectorTab (SRP Facade)
   Responsabilidade Única: Ponto de entrada para a aba de Inspeção de Feições
   ========================================================================== */

import { FeatureInspectorRenderer } from './FeatureInspectorRenderer.js';
import { FeatureInspectorEvents } from './FeatureInspectorEvents.js';

export class FeatureInspectorTab {
  static render(panel) {
    return FeatureInspectorRenderer.render(panel);
  }

  static bindEvents(panel) {
    FeatureInspectorEvents.bind(panel);
  }
}
