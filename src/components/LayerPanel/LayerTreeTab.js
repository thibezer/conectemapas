/* ==========================================================================
   ConecteMapas - LayerTreeTab (SRP Facade)
   Responsabilidade Única: Ponto de entrada para a aba de Árvore de Camadas
   ========================================================================== */

import { LayerTreeRenderer } from './LayerTreeRenderer.js';
import { LayerTreeEvents } from './LayerTreeEvents.js';

export class LayerTreeTab {
  static render(panel) {
    return LayerTreeRenderer.render(panel);
  }

  static bindEvents(panel) {
    LayerTreeEvents.bind(panel);
  }
}
