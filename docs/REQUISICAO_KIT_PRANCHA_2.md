Você está no repositório do kit `@thibezer/ui-components-kit` (`D:\Programação\UI_Componentes`, `main`, versão publicada 2.23.0). O ConecteMapas adotou o 2.23.0 no item "Desenho" do layout de impressão (editor `<ui-editor-prancha>`, núcleo `/prancha/nucleo`, plano de pintura) e verificou no navegador: editor, PNG e PDF vetorial reais funcionam. Sobraram **quatro ressalvas que são do kit**. Esta é a lista para resolvê-las.

> **Princípio mestre do dono do kit:** *os componentes são a base sólida de tudo; os programas são só o subproduto, assim como o queijo é subproduto do leite.* Resolva no kit; o app só consome.

## 0. Regras de trabalho (obrigatórias)
1. Leia `AGENTS.md` inteiro e siga-o (camadas L0→L5 com `npm run check:layers`, Regras #0 a #5, testes nas 5 camadas, loop Orient → Test-First → Implement → Verify → Record, DoD; zero `any`, JSDoc para o manifesto, `ListenerBag`, SSR-safety, tokens, `::part()`).
2. Leia antes: `docs/canvas-prancha.md`, `docs/canvas-prancha-eventos.md`, `docs/guia-migracao-prancha.md`, o README de `ui-editor-prancha` e `ui-canvas-prancha`, `vite.config.ts`, `package.json` (`exports`, `files`) e `docs/protocolo-de-release-e-sincronizacao.md`.
3. **Não faça commit, push, mudança de versão nem `npm publish`.** Registre no `CHANGELOG.md` sob `## Não publicado` (com "Mudanças de comportamento" se houver) e sugira a versão (provavelmente **minor**, 2.24.0, por APIs novas; só o item 4 seria patch).
4. Um item por vez, na ordem. Ao fim de cada um: `npm run check:layers`, `npx tsc --noEmit`, `tests/ssr-safety.test.ts`, `npx vitest run` e `npm run test:tipos` verdes; ao final `npm run gate:full`.
5. Tudo **aditivo**: nada que o app usa muda de assinatura (lista no fim). Sem dependências novas.
6. Relatório curto por item: o que mudou, arquivos, decisões tomadas sozinho, pendências. No fim, para cada item: **feito / parcial / não feito** e **o que o app pode apagar ou mudar**.

---

## 1. (P1) O editor deve ser responsivo: a barra de formas quebra em duas linhas e a lateral come o canvas
**O que foi visto:** numa janela de 800 px, o `<ui-editor-prancha>` mostra a barra de pré-definições (12 botões de texto: "Retângulo", "Moldura dupla (ABNT)", "Retângulo arredondado"…) **quebrada em duas linhas**, que gasta altura do canvas, e a coluna lateral (camadas + propriedades) ocupa ~300 px fixos, deixando ~450 px para desenhar. O editor é pensado para modal, onde o espaço varia muito (celular, tablet, janela pequena).
**Pedido:**
- **Barra de formas compacta por container query** (não por `@media`: o editor vive dentro de um modal de largura qualquer): acima de uma largura, os botões como hoje; abaixo, **um único botão "Formas ▾"** que abre um menu (usar o padrão `<ui-lista-flutuante>`/menu do kit, com os grupos do `ITENS_PREDEFINICOES`: molduras, formas, linhas, setas). Atributo `barra-formas="auto" | "botoes" | "menu"` (padrão `auto`) e `::part(barra)` mantido.
- **Lateral recolhível:** abaixo de uma largura (container query), a coluna lateral vira uma **gaveta** recolhida por padrão, com botão "Propriedades" na barra (e `Alt+P`), que abre sobre o canvas; acima, fica fixa. Atributo `lateral="auto" | "fixa" | "gaveta"` e propriedade `lateralAberta`. Largura da lateral via variável CSS `--ui-editor-prancha-lateral` (padrão 300 px).
- O rodapé (Cancelar/Concluir) não pode sumir nem quebrar em nenhuma largura; alvo de toque ≥ 38 px.
- **Painel "Folha" sem seleção:** a linha "Seleção" corta o texto ("Selecione um elemento para e…"). Deixe quebrar em até 2 linhas ou use o texto curto "Nada selecionado" com a dica no `title`.
**Aceite:** testes B/D (atributos, gaveta abre/fecha por teclado e foco, ARIA `aria-expanded`/`aria-controls`, `disconnectedCallback` sem vazar `ResizeObserver`), playground (`prancha.html`) com o editor em contêineres de 480, 800 e 1200 px; `docs/canvas-prancha-eventos.md` e README atualizados.
**O app muda:** nada (o editor já é o do kit); só deixa de ver a barra em duas linhas.

## 2. (P1) Teclado "isolado": o editor não pode vazar teclas para os atalhos do hospedeiro
**O que foi visto:** com `teclado="exclusivo"` (padrão do editor) as teclas que a prancha **trata** não chegam ao hospedeiro, mas as que ela **não** trata chegam: no layout do app, a tecla `F` (inserir desenho na folha de trás), `[`/`]` (espessura), `Ctrl+D`, `Delete` quando nada está selecionado etc. disparavam a prancheta **por trás do editor**. O app teve de manter uma flag (`composer.drawingEditor.isOpen()`) que bloqueia o `keydown` global dele inteiro enquanto o editor está aberto.
**Pedido:** um modo **`teclado="isolado"`** (e a opção equivalente em `<ui-editor-prancha>`, que passa a usá-lo como padrão em vez de `exclusivo`, ou documente a diferença e deixe o app escolher):
- Todo `keydown`/`keyup`/`keypress` **cujo `composedPath()` passa pelo editor** (foco ou ponteiro dentro) recebe `stopPropagation()` **na fase de bolha do próprio editor**, ou seja, **nenhum listener de `window`/`document` do hospedeiro o vê**, tratado ou não. O que a prancha trata continua com `preventDefault()` + marca (`eventoTratadoPelaPrancha`).
- **Exceções que nunca isolam** (atalhos do navegador/sistema): `F5`, `F11`, `F12`, `Ctrl/Cmd+R`, `Ctrl/Cmd+L`, `Ctrl/Cmd+W`, `Ctrl/Cmd+T`, `Ctrl/Cmd+Shift+I`, `Ctrl/Cmd+Shift+J`, `Ctrl/Cmd++/-/0` (zoom do navegador, **não** os `Ctrl+=`/`Ctrl+-`/`Ctrl+0` da prancha: documente o conflito e decida: a prancha já usa esses para o zoom dela; o isolado deve preferir a prancha dentro do canvas), `Tab` (foco). Teclas com o foco em campos de texto continuam não roubadas.
- O isolamento vale **só enquanto o foco/ponteiro está no editor**; com `teclado="isolado"` num modal, clicar fora do modal não isola.
- Documentar em `docs/canvas-prancha-eventos.md` (tabela dos três modos: `local`, `exclusivo`, `isolado`) e no guia (`docs/guia-migracao-prancha.md`, §6): "hospedeiro com atalhos globais".
**Aceite (Camada C, `*.regressao.test.ts`):** `keydown` global registrado **antes** do editor: nenhuma tecla (tratada ou não, em amostra de 30: letras, `[`, `]`, `Delete`, setas, `Ctrl+D`, `F`) chega ao global com o foco no editor; `F5`/`F12`/`Ctrl+R` chegam; com o foco **fora** do editor tudo chega; sem vazar listeners ao reconectar (Regra #2).
**O app apaga:** a flag que bloqueia o `keydown` global enquanto o editor está aberto (`PrintCanvasEngine.bindKeyboardShortcuts`) e a nota de "atalhos como F não são do kit" no `GEMINI.md`.

## 3. (P2) Empacotamento: o editor e o componente não podem ficar presos ao código comum
**O que foi visto:** `/prancha/nucleo` está enxuto (187 kB, 5 arquivos), mas o **componente e o editor não se separam** na hora de empacotar o app:
- O maior arquivo compartilhado do `dist` chama-se **`prancha-paleta-*.js` (226 kB)** e contém o código **comum a vários entrypoints** (base, `UIToast`, etc.); o nome é enganoso e atrapalha quem quer agrupar chunks por nome.
- `ui-editor-prancha-*.js` (133 kB), `ui-camadas-*`, `ui-tabela-propriedades-*` (3 variantes, 133 a 207 kB!) e `ui-paleta-ferramentas-*` (3 variantes de 80 a 99 kB) aparecem em **vários arquivos com hashes diferentes** (confirme se é código repetido entre entrypoints em vez de um chunk compartilhado).
- O app importa `UIToast` do entrypoint principal e põe todo `@thibezer/ui-components-kit` num chunk (`vendor-ui`, 1,25 MB). Tentar separar o editor por `manualChunks` pelo nome do arquivo **quebrou o carregamento inicial** (o chunk "prancha" era o comum), então foi revertido. Hoje não há como o app carregar o editor só ao editar.
- `package.json` **não tem o campo `sideEffects`**, então os empacotadores assumem que todo módulo tem efeito colateral e não eliminam o que não é usado.
**Pedido:**
- **Auditar o build** (`vite.config.ts`, `rollupOptions.output.manualChunks`/`chunkFileNames`) e deixar uma **estrutura de chunks previsível**: um chunk comum de base com nome próprio (`kit-base-*.js`, não `prancha-paleta-*`), e os pesados (`ui-editor-prancha`, `ui-tabela-propriedades`, `ui-camadas`, `ui-paleta-ferramentas`) **uma única cópia cada**, compartilhada entre entrypoints. Explique a causa dos arquivos múltiplos (`ui-tabela-propriedades-*` x3, `ui-paleta-ferramentas-*` x3) e, se for duplicação, elimine.
- **`"sideEffects"` correto no `package.json`:** `false` com a lista exata dos arquivos que registram custom elements/CSS (`**/*.css`, `register`, `index` se for o caso). Teste de empacotamento (script `scripts/check-bundle.mjs` ou teste) que importa **só** `@thibezer/ui-components-kit/prancha/nucleo` num bundle mínimo (esbuild, já é devDependency) e **falha** se o resultado incluir `HTMLElement`/Custom Elements/CSS, ou passar de um orçamento (hoje ~190 kB, margem de 10%).
- **Garantir que `import('@thibezer/ui-components-kit/prancha')` é de fato carregável sob demanda**: documentar no guia o padrão para o app (chunk comum + chunk do editor) e um **exemplo de `manualChunks` seguro** para Vite/Rollup (o app o testará) em `docs/` (nova seção "Empacotando: carregar o editor só ao editar").
- Medir e registrar no `CHANGELOG` os tamanhos antes/depois: núcleo, entrypoint principal, `/prancha`, e o chunk do editor.
**Aceite:** o teste de empacotamento passa; `docs/` tem o exemplo; no relatório, a tabela de chunks antes/depois.
**O app muda:** configura `manualChunks` com o exemplo do kit e o editor passa a ser um download separado (hoje 0 ganho de tamanho inicial).

## 4. (P3) Guia: o app mantém o `setTransform` no seu `PdfVectorContext`, e o guia deve dizer que isso é opcional
Com o 2.23.0 o pintor usa o modo relativo sozinho quando falta `setTransform`; o app mantém o seu `setTransform` absoluto **por desempenho** e já passa em `diagnosticarContexto(...).obrigatorios === []`. Adicione ao `docs/guia-migracao-prancha.md` (§3) a recomendação final: "implementar `setTransform` absoluto é opcional, mas **evita** recalcular a matriz inversa a cada chamada; teste de uma linha com `diagnosticarContexto`" e um exemplo **real** de implementação (a do app: `setTransform(a..f) = transform(inverse(M_atual) · (M_base · T))` com `M_base` guardada ao criar o contexto). Sem mudança de código.

---

## Testes obrigatórios (resumo)
- **A:** nada novo de núcleo puro (os itens são de componente/empacotamento).
- **B:** `<ui-editor-prancha>`: `barra-formas`, `lateral`, gaveta, `teclado="isolado"`, reconexão sem vazar listener/observer.
- **C (`*.regressao.test.ts`):** o vazamento de teclas para o hospedeiro (item 2), com o global registrado antes; as teclas reservadas do navegador.
- **D:** SSR-safety (nenhum acesso a `window` no escopo do módulo), ARIA da gaveta e do menu de formas, `tests/tipos/react.tsx` e `vue.ts` para os atributos/propriedades novos, `check-layers`.
- **E:** o teste de orçamento do núcleo (item 3) e o de desempenho existente (≤ 16 ms) sem regressão.

## O que o app usa hoje (não pode mudar de assinatura)
`<ui-editor-prancha>` (atributos `largura`, `altura`, `margens`, `grade`, `mostrar-grade`, `ajustar-ao-abrir`; propriedades `elementos`, `camadas`, `pronto`, `modificado`; método `focus`; eventos `editor-concluir` e `editor-cancelar`); núcleo `/prancha/nucleo` (`planejar`, `desenharPlano`, `gerarPredefinicao`, `ITENS_PREDEFINICOES`, `envelopeVisual`, `normalizarParaOrigem`, `ajustarElementosACaixa`, `ajustarAparenciaEmLote`, `resumirAparencia`, `normalizarElementos`, `diagnosticarContexto`, `girarElementos`, `transformarElemento`, `escala`, `translacao`, `compor`) e o entrypoint `/prancha` carregado por `import()`.

### Anexo (não é para o kit; fica com o app)
- Configurar `manualChunks` com o exemplo do item 3 e carregar o editor só ao editar.
- Apagar a flag do `keydown` global quando o item 2 sair.
- Manter o `setTransform` do `PdfVectorContext` (item 4) e a verificação `diagnosticarContexto` no teste.
