/* ==========================================================================
   ConecteMapas - DrawingPenHelper
   Responsabilidade Única: Matemática da ferramenta Caneta (estilo Illustrator).
   Um traçado é uma lista de âncoras { p, hIn, hOut } (todas em [lat, lng]):
   - âncora sem alças  => segmento reto
   - âncora com alças  => segmento curvo (Bézier cúbica) com o vizinho
   A geometria final é "achatada" em vértices comuns, então todo o resto do app
   (medição, junção, exportação) continua trabalhando com linhas/polígonos simples.
   Os cálculos rodam em coordenadas projetadas (Web Mercator, em metros) para que
   as curvas sejam fiéis na tela.
   ========================================================================== */

const R = 6378137;

/** Projeção Web Mercator padrão (equivale ao L.CRS.EPSG3857), sem depender do Leaflet. */
export const MercatorProjection = {
  to([lat, lng]) {
    const clamped = Math.max(Math.min(lat, 85.05112878), -85.05112878);
    const sin = Math.sin((clamped * Math.PI) / 180);
    return {
      x: (R * lng * Math.PI) / 180,
      y: (R * Math.log((1 + sin) / (1 - sin))) / 2
    };
  },
  from({ x, y }) {
    return [
      ((2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180) / Math.PI,
      (x * 180) / (Math.PI * R)
    ];
  }
};

export class DrawingPenHelper {
  /**
   * Alça espelhada em relação à âncora (alça simétrica, como ao arrastar a caneta).
   * @param {[number, number]} anchor
   * @param {[number, number]} handle
   * @param {Object} [proj]
   * @returns {[number, number]}
   */
  static mirror(anchor, handle, proj = MercatorProjection) {
    const a = proj.to(anchor);
    const h = proj.to(handle);
    return proj.from({ x: 2 * a.x - h.x, y: 2 * a.y - h.y });
  }

  /**
   * Uma âncora tem curva no lado dado?
   */
  static hasHandle(anchor, side) {
    return Boolean(side === 'out' ? anchor.hOut : anchor.hIn);
  }

  /**
   * O segmento entre duas âncoras consecutivas é curvo?
   */
  static isCurved(a, b) {
    return Boolean(a.hOut || b.hIn);
  }

  /**
   * Amostra uma Bézier cúbica (sem incluir p0, incluindo p1).
   * @returns {Array<[number, number]>}
   */
  static sampleCubic(p0, c1, c2, p1, steps, proj = MercatorProjection) {
    const P0 = proj.to(p0), C1 = proj.to(c1), C2 = proj.to(c2), P1 = proj.to(p1);
    const out = [];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const w0 = u * u * u;
      const w1 = 3 * u * u * t;
      const w2 = 3 * u * t * t;
      const w3 = t * t * t;
      out.push(proj.from({
        x: w0 * P0.x + w1 * C1.x + w2 * C2.x + w3 * P1.x,
        y: w0 * P0.y + w1 * C1.y + w2 * C2.y + w3 * P1.y
      }));
    }
    out[out.length - 1] = [p1[0], p1[1]]; // extremidade exata, sem erro de ida-e-volta da projeção
    return out;
  }

  /**
   * Número de amostras de um segmento curvo, proporcional ao comprimento do polígono de controle.
   * ~1 vértice a cada `metersPerStep` metros (limitado entre 8 e 64).
   */
  static autoSteps(a, b, proj = MercatorProjection, metersPerStep = 1.5) {
    const pts = [a.p, a.hOut || a.p, b.hIn || b.p, b.p].map(p => proj.to(p));
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    // Em Mercator o metro "real" é menor que o projetado; a diferença só aumenta a densidade (seguro)
    return Math.max(8, Math.min(64, Math.ceil(len / metersPerStep)));
  }

  /**
   * Achata o traçado em uma lista de vértices.
   * @param {Array<{p: [number, number], hIn?: [number, number]|null, hOut?: [number, number]|null}>} anchors
   * @param {boolean} [closed=false] fecha o traçado (último -> primeiro); o 1º vértice NÃO é repetido no fim
   * @param {{ proj?: Object, steps?: number|Function }} [options]
   * @returns {Array<[number, number]>}
   */
  static flattenPath(anchors, closed = false, { proj = MercatorProjection, steps } = {}) {
    if (!Array.isArray(anchors) || anchors.length === 0) return [];
    const result = [[anchors[0].p[0], anchors[0].p[1]]];
    const segCount = closed ? anchors.length : anchors.length - 1;

    for (let i = 0; i < segCount; i++) {
      const a = anchors[i];
      const b = anchors[(i + 1) % anchors.length];
      if (this.isCurved(a, b)) {
        const n = typeof steps === 'function' ? steps(a, b)
          : (typeof steps === 'number' ? steps : this.autoSteps(a, b, proj));
        result.push(...this.sampleCubic(a.p, a.hOut || a.p, b.hIn || b.p, b.p, n, proj));
      } else {
        result.push([b.p[0], b.p[1]]);
      }
    }

    // Fechamento: o último ponto gerado coincide com o primeiro; remove a repetição
    if (closed && result.length > 1) result.pop();
    return result;
  }
}
