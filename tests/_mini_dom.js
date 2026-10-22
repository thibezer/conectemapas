/* Mini DOMParser para testes em Node puro: elementos com localName, children e textContent,
   getElementsByTagName no documento e querySelector que não encontra nada (sem parsererror). */

export function parseMiniXml(text) {
  const root = { localName: '#doc', children: [], _text: '' };
  const stack = [root];
  const re = /<\?[^>]*\?>|<!--[\s\S]*?-->|<(\/?)([A-Za-z0-9_:]+)[^>]*?(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[4] !== undefined) { stack[stack.length - 1]._text += m[4]; continue; }
    if (!m[2]) continue;
    if (m[1]) { stack.pop(); continue; }
    const node = { localName: m[2].split(':').pop(), children: [], _text: '' };
    stack[stack.length - 1].children.push(node);
    if (!m[3]) stack.push(node);
  }
  const fill = (n) => {
    Object.defineProperty(n, 'textContent', { get: () => n._text + n.children.map(c => c.textContent).join('') });
    n.children.forEach(fill);
  };
  fill(root);
  const all = (n, name, out = []) => {
    n.children.forEach(c => { if (c.localName === name) out.push(c); all(c, name, out); });
    return out;
  };
  return { querySelector: () => null, getElementsByTagName: (name) => all(root, name) };
}

/** Instala o DOMParser global (se ainda não existir) e devolve uma função que o remove. */
export function installMiniDom() {
  const previous = globalThis.DOMParser;
  globalThis.DOMParser = class { parseFromString(t) { return parseMiniXml(t); } };
  return () => {
    if (previous === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previous;
  };
}
