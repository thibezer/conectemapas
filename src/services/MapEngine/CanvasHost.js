/* ==========================================================================
   ConecteMapas - CanvasHost
   Hospeda o mapa dentro do <ui-canvas-cad> (ui-components-kit): o componente
   cria e é dono do L.Map; o CanvasMapEngine traduz o app para ele.

   O que este módulo neutraliza no componente (não são usados pelo ConecteMapas):
   - Camadas padrão: satélite Google, WMS SIGEF/INCRA (faz requisição ao clicar), grade etc.
     O CanvasMapEngine gerencia os mapas base e as camadas de feições.
   - Painel de camadas e barra rápida do componente (o app tem o próprio painel).
   Pan com a roda, caixa Window/Crossing, snap e menu de contexto do componente ficam LIGADOS.

   O componente usa Shadow DOM: o CSS do documento não chega até o mapa, então as
   folhas de estilo do app são espelhadas dentro do shadow root.
   ========================================================================== */

import '@thibezer/ui-components-kit/canvas';

// O mapa ocupa a área toda; a base dele é coberta pela barra de coordenadas e pela tabela de atributos.
// Os HUDs do componente (desenho e edição de vértices) vão para o topo, centralizados na área livre
// (margens em CanvasMapEngine._updatePopupMargins), em versão compacta: a dica longa some do HUD de edição.
const HIDE_KIT_UI_CSS = `
  .qgis-layer-panel, .cad-quick-toolbar { display: none !important; }
  .cad-root, .cad-map-container { width: 100%; height: 100%; }
  #cm-draw-hud, #cm-vertex-edit-hud {
    top: var(--cad-hud-topo, 44px) !important; bottom: auto !important;
    gap: 8px !important; padding: 4px 10px !important; font-size: 11px !important; border-radius: 6px !important;
  }
  #cm-draw-hud button, #cm-vertex-edit-hud button { padding: 2px 8px !important; font-size: 11px !important; }
  #cm-vertex-edit-hud [data-campo="dica"] { display: none !important; }
`;

export class CanvasHost {
  /**
   * Substitui o elemento #id por um <ui-canvas-cad> novo e devolve o mapa já inicializado.
   * @param {string} containerId
   * @returns {{ host: HTMLElement, map: import('leaflet').Map }}
   */
  static mount(containerId) {
    const placeholder = document.getElementById(containerId);
    if (!placeholder) throw new Error(`CanvasHost: elemento #${containerId} não encontrado`);

    let host = placeholder;
    if (placeholder.tagName.toLowerCase() !== 'ui-canvas-cad') {
      host = document.createElement('ui-canvas-cad');
      host.id = containerId;
      placeholder.replaceWith(host);
    } else if (placeholder.getMap?.()) {
      // Já inicializado (reinício do CanvasMapEngine): recria para começar sem listeners nem panes antigos
      const fresh = document.createElement('ui-canvas-cad');
      fresh.id = containerId;
      placeholder.replaceWith(fresh);
      host = fresh;
    }

    // O componente inicializa o mapa num setTimeout(0) do connectedCallback. O app precisa do mapa
    // de forma síncrona, então inicializa agora e cancela o agendamento para não criar um 2º mapa.
    if (!host.getMap()) {
      if (host.initTimeout) {
        window.clearTimeout(host.initTimeout);
        host.initTimeout = undefined;
      }
      host.initCAD();
    }

    const map = host.getMap();
    if (!map) throw new Error('CanvasHost: o <ui-canvas-cad> não criou o mapa');

    CanvasHost._neutralizeDefaults(host);
    CanvasHost._mirrorDocumentStyles(host);
    return { host, map };
  }

  static _neutralizeDefaults(host) {
    // Camadas padrão do componente: o ConecteMapas usa as próprias
    const layerIds = ['satelite', 'sigef', 'homologados', 'homologados-pontos', 'perimetro', 'vizinhos', 'vertices', 'grade'];
    layerIds.forEach(id => {
      try { host.setLayerVisibility(id, false); } catch { /* camada ausente nesta versão do kit */ }
    });

  }

  /** Espelha as folhas de estilo do documento no shadow root do componente. */
  static _mirrorDocumentStyles(host) {
    const shadow = host.shadowRoot;
    if (!shadow || !('adoptedStyleSheets' in shadow)) return;

    const kitOverrides = new CSSStyleSheet();
    kitOverrides.replaceSync(HIDE_KIT_UI_CSS);
    const mirrored = new CSSStyleSheet();
    shadow.adoptedStyleSheets = [mirrored, kitOverrides];

    const sync = () => {
      let css = '';
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) css += `${rule.cssText}\n`;
        } catch { /* folha de outra origem: inacessível */ }
      }
      try { mirrored.replaceSync(css); } catch { /* @import residual é ignorado */ }
    };

    sync();

    // Vite injeta/atualiza <style> em runtime (HMR): mantém o espelho em dia
    let raf = null;
    const observer = new MutationObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = null; sync(); });
    });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    host._cmStyleObserver = observer;
  }

  static dispose(host) {
    if (!host) return;
    if (host._cmStyleObserver) {
      host._cmStyleObserver.disconnect();
      host._cmStyleObserver = null;
    }
    try { host.destroy(); } catch { /* já destruído */ }
  }
}
