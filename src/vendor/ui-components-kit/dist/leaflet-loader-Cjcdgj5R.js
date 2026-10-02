let e = null, n = null;
async function o() {
  return typeof window < "u" && window.L ? (n = window.L, n) : n || e || (e = (async () => {
    try {
      const t = await import("leaflet");
      return n = t.default || t, typeof window < "u" && !window.L && (window.L = n), n;
    } catch {
      return e = null, console.warn(
        `[UI Components Kit] O Leaflet não foi encontrado no ambiente.
Para utilizar componentes de mapa ou CAD (<ui-mapa>, <ui-canvas-cad>), instale o pacote "leaflet" (npm i leaflet) ou inclua o script no HTML: <script src=".../leaflet.js"><\/script>.`
      ), null;
    }
  })(), e);
}
function i() {
  return typeof window < "u" && window.L ? window.L : n;
}
export {
  o as c,
  i as o
};
