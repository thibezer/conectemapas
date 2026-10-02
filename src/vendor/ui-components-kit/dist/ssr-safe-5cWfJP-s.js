const t = typeof window < "u" && typeof document < "u", s = typeof HTMLElement < "u" ? HTMLElement : class {
};
function o(e, n) {
  typeof customElements < "u" && !customElements.get(e) && customElements.define(e, n);
}
export {
  s as S,
  o as d,
  t as i
};
