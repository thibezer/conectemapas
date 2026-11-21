Você está no repositório do kit `@thibezer/ui-components-kit` (`D:\Programação\UI_Componentes`, `main`, versão publicada 2.22.0). O ConecteMapas (app) acabou de migrar a "Moldura" do layout de impressão para o `<ui-canvas-prancha>` (item "Desenho"). A migração funcionou, mas ela mostrou **falhas do kit, lacunas de API e cola que o app teve de escrever e que pertence ao kit**. Esta é a lista completa do que fazer, corrigir e melhorar.

> **Princípio mestre do dono do kit:** *os componentes são a base sólida de tudo; os programas são só o subproduto, assim como o queijo é subproduto do leite.* Tudo o que é reutilizável vive no kit; o app só consome. Cada item abaixo diz **o que o app teve de fazer por falta disso** e **o que o app apaga quando o kit entregar**.

## 0. Regras de trabalho (obrigatórias)
1. **Leia `AGENTS.md` inteiro** e siga-o: camadas L0→L5 (`npm run check:layers`), Regras #0 a #5, testes nas 5 camadas, loop Orient → Test-First → Implement → Verify → Record, DoD. Zero `any`, JSDoc para o manifesto, entrada hostil, SSR-safety, `ListenerBag`.
2. Leia antes: `docs/canvas-prancha.md`, `docs/canvas-prancha-eventos.md`, `docs/guia-migracao-prancha.md`, `src/components/ui-canvas-prancha/README.md`, `pagina_prancha.ts`, `docs/protocolo-de-release-e-sincronizacao.md`.
3. **Não faça commit, push, mudança de versão nem `npm publish`.** O release é do dono. Registre no `CHANGELOG.md` sob `## Não publicado` (com "Mudanças de comportamento" quando houver) e sugira a versão (provavelmente **minor**, 2.23.0, por APIs novas; o item 1 sozinho seria patch).
4. Trabalhe **um bloco por vez, na ordem de prioridade (P0 → P3)**. Ao fim de cada bloco: `npm run check:layers`, `npx tsc --noEmit`, `tests/ssr-safety.test.ts`, `npx vitest run` e `npm run test:tipos` verdes; ao final, `npm run gate:full`. Se algo falhar por outra frente, diga qual.
5. Nada que o app usa hoje pode mudar de assinatura (lista no fim). Tudo novo é **aditivo**.
6. Sem dependências novas. Se achar que precisa de uma, pare e peça aprovação.
7. Relatório curto por bloco: o que mudou, arquivos, decisões tomadas sozinho, o que ficou pendente e por quê.

---

## P0 — Defeitos do contrato com o contexto de desenho (PDF)

### 1. O guia do kit afirma algo falso sobre o PDF do app e o pintor falha em silêncio
**O que aconteceu:** `docs/guia-migracao-prancha.md` (seção 2.3) diz que o `PdfVectorContext` do app "já cumpre o contrato `ContextoPrancha2D` (`save/restore/setTransform`…)". **Não cumpria:** não tinha `setTransform` (só `translate/scale/rotate/transform`, relativos). Como o pintor chama `setTransform` e `desenharElementos` **engole a exceção de cada item** (`try/catch` em `pintura_canvas.ts`), o resultado seria um PDF **em branco, sem nenhum erro**. O app corrigiu o próprio adaptador, mas o kit deixou a armadilha.
**Pedido:**
- **Corrigir o guia** (e qualquer outro texto com essa afirmação): o contrato **exige** `setTransform` **absoluto** (relativo ao espaço de exportação do contexto, não ao transform corrente), e mostrar um exemplo de implementação para contextos que só têm `transform` relativo (`setTransform(a..f) = transform(inverse(M_atual) · (M_base · T))`).
- **O pintor não pode falhar em silêncio.** Em `desenharElementos`: (a) detectar `typeof ctx.setTransform !== 'function'` **antes** de pintar; (b) **degradar**: se houver `transform` (e `save/restore`), usar o modo relativo documentado (opção `transformacao: 'absoluta' | 'relativa'`, padrão detectado); (c) se não houver como pintar, devolver nas estatísticas `falhas: number` e `primeiraFalha?: string` e emitir um aviso único (`console.warn` guardado por flag de módulo, SSR-safe) em vez de zero itens pintados sem explicação. O `try/catch` por item deve contar em `falhas`, não só restaurar o contexto.
- **Verificador de contexto exportado:** `diagnosticarContexto(ctx): { obrigatorios: string[] /*faltando*/, opcionais: string[] /*ausentes: gradiente, texto, mesclagem, filtro, miterLimit*/ }`, no entrypoint `./prancha`, para o app afirmar em teste que o contexto de PDF dele está completo.
**Testes:** contexto falso **sem** `setTransform` (modo relativo funciona e pinta o mesmo que o absoluto, comparando as chamadas gravadas), contexto sem `transform` nem `setTransform` (devolve `falhas > 0` e o aviso, sem lançar), `diagnosticarContexto` com contextos completos/incompletos, e um **contexto "estilo PDF vetorial"** de verdade (com `translate/scale/rotate/transform`, sem `setTransform`, sem gradiente/sombra/mesclagem) como fixture reutilizável em `tests/fixtures/`.
**O app apaga:** o `setTransform` que acrescentou ao `PdfVectorContext` (fica como otimização, não como requisito).

### 2. Conformidade do texto no PDF vetorial
O `PdfVectorContext` do app **tem** `fillText`, `font`, `textAlign`, `textBaseline`, `measureText`, então o pintor vai usar o caminho de texto. Verifique e documente: (a) o formato exato de `ctx.font` que o pintor escreve e se contextos reais (canvas e PDF) o interpretam igual; (b) `textBaseline`/entrelinha; (c) texto girado/cisalhado pela matriz do elemento num contexto que só tem `fillText` simples; (d) o que acontece com `texto.largura` (quebra) sem `measureText`. Adicione teste de paridade com contexto falso que grava `font`/`fillText`. Se houver divergência, corrija no pintor, não no app.

---

## P1 — Cola que o app escreveu e pertence ao kit

Para cada item: **API proposta** (ajuste o nome se o padrão do kit pedir), **por quê**, **critério de aceite**.

### 3. Composição pronta do editor (paleta + camadas + propriedades)
**Hoje:** o app copiou ~80 linhas do `pagina_prancha.ts` (ligar `<ui-paleta-ferramentas>`, `<ui-camadas>` e `<ui-tabela-propriedades>` à prancha, com 20 listeners de eventos de camadas). Cada app vai reescrever isso e errar de um jeito diferente.
**Pedido:** uma função **`ligarPaineisPrancha({ prancha, paleta?, camadas?, propriedades? }): () => void`** (retorna o desligador) em módulo próprio exportado de `./prancha`, que faz **toda** a cola do playground, usando só eventos e propriedades públicas (a prancha **continua não importando** os outros componentes; respeite o DAG: pode viver em L5/entrypoint ou num micro-módulo sem import de componente, decida e justifique). Alternativa aceitável: um componente **`<ui-editor-prancha>`** (L4, thin shell) que compõe os quatro e expõe `elementos`, `camadas`, eventos `editor-concluir` / `editor-cancelar`, atributos `largura`, `altura`, `margens`. Escolha e justifique; a recomendada é o componente, porque também facilita os itens 4, 9 e 10.
**Aceite:** o playground (`pagina_prancha.ts`) passa a usar a função/componente (apague a cola duplicada dali); teste B: conectar/desconectar/reconectar sem vazar listeners (Regra #2); `pagina_prancha.ts` e o app terminam sem lógica própria de ligação.
**O app apaga:** `wirePanels()` inteiro de `PrintDrawingEditor.js`.

### 4. Pré-definições: rótulos, menu e posicionamento
**Hoje:** o app escreveu a lista `PRESETS` com rótulos em português ("Retângulo arredondado", "Moldura dupla (ABNT)"…) e a regra "moldura = quadro das margens; as outras = caixa 60 × 40 mm perto do desenho".
**Pedido:** exportar `ROTULOS_PREDEFINICOES: Record<Predefinicao, string>` (pt-BR) e `ITENS_PREDEFINICOES` (lista ordenada `{ valor, rotulo, grupo, usaQuadro: boolean }`), e dar a `inserirPredefinicao` um **padrão sensato quando `caixa` é omitida**: hoje cai no **centro da folha**, que pode estar **fora da vista**; deve ser o **centro da área visível** (`obterVista()`), tamanho proporcional ao zoom, com a forma **selecionada e à vista**. As pré-definições de "quadro" (`retangulo`, `moldura-dupla`) devem aceitar `opcoes.quadro: 'margens'` e usar o quadro das margens (ver item 13).
**Aceite:** teste com vista deslocada (a forma nasce dentro da vista); `docs/canvas-prancha-eventos.md` atualizado.
**O app apaga:** `PrintDrawing.PRESETS`, `FRAME_PRESETS` e `insertPreset()`.

### 5. Envelope visual real dos elementos (caixa do desenho)
**Hoje:** o app calcula a caixa do item como `limitesNaFolha(el)` + `meiaEspessura(el)` + uma folga de sombra, num `contentBounds()` próprio. Isso **ignora**: pontas de seta (podem ultrapassar a geometria), junção angular (`limitePonta` pode projetar para fora), traço `alinhamento: 'fora'`, hachura, e o desfoque real da sombra. Resultado: o canvas do item pode **cortar** essas partes.
**Pedido:** `envelopeVisual(el | els, opcoes?): CaixaMm | null` (L2, puro) que inclui **tudo o que o pintor desenha** (traço pelo alinhamento, junção/limite de ponta, pontas de seta pelo estilo e escala, sombra com desfoque, texto medido). Fonte única: o pintor e o envelope têm de concordar (teste de propriedade: nenhum pixel/ponto planejado fora do envelope; use `planejarElementos`).
**Aceite:** testes com seta dupla grossa, junção angular em ângulo agudo, sombra com desfoque, traço fora, texto girado; entrada hostil (`NaN`, sem geometria) devolve `null` sem lançar.
**O app apaga:** `PrintDrawing.contentBounds`.

### 6. Esticar elementos mantendo o traço, e ajustar a uma caixa nova
**Hoje:** o app guarda os elementos em mm com origem no canto do item e a "caixa-base"; ao redimensionar o item aplica `transformarElemento(el, escala(sx, sy))` em cada elemento (`PrintDrawing.elementsFor`). Funciona porque o traço é em mm na **folha**, mas isso **não está documentado como garantia**, o `transformarElementos` (plural) **pula elementos `bloqueado`** (surpresa em lote), e o texto esticado de forma não uniforme distorce.
**Pedido:** `ajustarElementosACaixa(elementos, caixaOrigem, caixaDestino, opcoes?: { manterProporcao?: boolean; escalarTexto?: 'distorcer' | 'tamanho' | 'nao'; incluirBloqueados?: boolean }): ElementoGrafico[]` e `normalizarParaOrigem(elementos, opcoes?: { minimo?: number }): { elementos; caixa }` (translada para que o envelope visual comece em 0,0, com tamanho mínimo centrado). Documente **como garantia testada** que a espessura/tracejado/pontas **não mudam** com a escala.
**Aceite:** testes (traço constante sob escala não uniforme; bloqueados respeitados conforme a opção; ida e volta aproximadamente idempotente; matriz singular recusa).
**O app apaga:** `PrintDrawing.elementsFor` (a parte de escala) e a lógica de `commit` que re-origina elementos.

### 7. Aparência em lote e leitura resumida (painel do item)
**Hoje:** o painel do item do app edita **todos** os elementos de um desenho de uma vez (cor do contorno, espessura, estilo, cor e opacidade do preenchimento). O app escreveu `applyStyle` (espessura por **proporção**, para a moldura dupla manter a razão entre as linhas; criar traço onde não há; criar preenchimento só em formas fechadas) e `styleOf` (lê o 1º traço/preenchimento).
**Pedido:** 
- `ajustarAparenciaEmLote(elementos, ajuste, opcoes?: { espessura?: 'absoluta' | 'proporcional' }): ElementoGrafico[]` com `ajuste = { corTraco?, espessura?, estiloTraco?, corPreenchimento?, opacidadePreenchimento?, semTraco?, semPreenchimento? }` (acrescente o que for natural; `espessura` proporcional usa o 1º traço como referência). Regras: só formas fechadas ganham preenchimento novo; elementos `mascara` ficam intactos; `semTraco` vira `traco: null`.
- `resumirAparencia(elementos): { traco: { cor, espessura, estilo } | 'misto' | null; preenchimento: { cor, opacidade } | 'misto' | null }` (o painel precisa distinguir "misto"). O `styleOf` do app lê só o primeiro e mente quando há diferença.
- Exportar o inverso de `TIPO_LINHA_DO_ESTILO`: **`ESTILO_DO_TIPO_LINHA`** (o app montou o inverso à mão).
**Aceite:** testes com moldura dupla (razão mantida), mistos, sem traço → com traço, entrada hostil.
**O app apaga:** `PrintDrawing.applyStyle`, `styleOf`, `nudgeStroke` (vira chamada de uma linha).

### 8. Opções de pré-definição que o app teve de contornar com pós-processamento
`gerarPredefinicao` + `OpcoesPredefinicao` não cobrem, e o app corrige **depois** de gerar:
- **Preenchimento como cor + opacidade separadas** (`corPreenchimento` aceita CSS com alfa embutido, mas o painel e o kit editam `preenchimento.opacidade`): adicionar `opacidadePreenchimento` e `opacidadeTraco`.
- **Sem traço** (`semTraco: true`): hoje `espessura` inválida cai no padrão 0,35 mm; o app força `traco = null` depois.
- **Moldura dupla com o preenchimento na EXTERNA** (fundo cobrindo o espaço entre as linhas): o kit põe na **interna**. Adicionar `opcoes.preenchimentoNa: 'externa' | 'interna'` (padrão atual mantido) ou `fundo: true`.
- **Contorno por dentro da caixa:** o app recuou a geometria em meia espessura para a borda **externa** do traço encostar na caixa (a borda CSS antiga). Já existe `TracoElemento.alinhamento: 'centro' | 'dentro' | 'fora'`: **verifique se o pintor o implementa** e se o envelope do item 5 o respeita; se sim, adicionar `opcoes.alinhamentoTraco` às pré-definições e o app não recua mais; se não implementa, implemente ou remova do tipo (não pode existir campo que não faz nada).
- **Seta e linhas com recuo mínimo** (as linhas antigas começavam a `max(1 px, espessura)` da borda): `opcoes.recuo?: number` em mm.
**Aceite:** testes por opção; as pré-definições antigas continuam idênticas sem as opções novas.
**O app apaga:** o pós-processamento em `PrintDrawing.buildPreset` e `migrateShape`.

### 9. Sinal de "modificado" e ciclo de vida no editor
**Hoje:** o app compara `JSON.stringify(obterElementos())` antes e depois para saber se houve mudança, e usa `requestAnimationFrame` duplo + `selecionarTudo/ajustarSelecao/limparSelecao` para enquadrar ao abrir.
**Pedido:**
- `modificado: boolean`, `revisao: number` (incrementa a cada mudança no documento) e `marcarComoSalvo()`; evento `prancha-modificado` (`{ modificado }`) só nas transições.
- `pronto: Promise<void>` (ou evento `prancha-pronta`) que resolve quando o componente mediu o layout e consegue enquadrar (o `ajustarFolha()` logo após `connectedCallback` hoje depende de timing).
- **`ajustarElementos(ids?, opcoes?: { margem?: number; zoomMaximo?: number })`**: enquadra os elementos (ou todos) **sem alterar a seleção**, com teto de zoom (o `ajustarSelecao` num elemento pequeno pode ampliar absurdamente).
- Atributo `ajustar-ao-abrir="folha" | "conteudo" | "nenhum"`.
- Confirme que `focus()` do host entrega o foco ao viewport (o app chama `prancha.focus?.()`; se não for garantido, garanta).
**Aceite:** testes B/C; zoom máximo respeitado; sem seleção alterada.
**O app apaga:** a comparação por JSON, o rAF duplo e o truque de seleção.

### 10. Teclado em hospedeiro com atalhos globais, e Esc
**Hoje:** o layout do app tem um `keydown` global (Delete apaga item, Ctrl+Z desfaz o layout, setas movem item). O guia diz que o teclado da prancha "tem prioridade sobre os atalhos globais da página", mas **o app não pôde confiar nisso** e bloqueou as teclas dele por uma flag enquanto o editor está aberto.
**Pedido:** (a) quando a prancha **trata** uma tecla, `stopPropagation()` + `preventDefault()` e marcar o evento (ex.: `e.pranchaTratou = true` via `WeakSet` exportado `eventoTratadoPelaPrancha(e)`), documentando a garantia; (b) atributo **`teclado="exclusivo"`** para uso em modal: a prancha captura as teclas da página inteira enquanto montada e foco/ponteiro estão nela ou no host; (c) evento **`prancha-esc-sem-efeito`** quando Esc é pressionado e não havia gesto/seleção/âncora a cancelar, para o hospedeiro fechar o modal (hoje o app só consegue tratar Esc **fora** do canvas).
**Aceite:** teste com `keydown` global registrado **antes** da prancha, verificando que não dispara; Esc em cadeia (gesto → âncoras → seleção → `prancha-esc-sem-efeito`).
**O app apaga:** a flag `drawingEditor.isOpen()` dentro do `keydown` global e o tratador de Esc do overlay.

---

## P2 — Desempenho e empacotamento

### 11. Entrypoint de núcleo (sem o componente) para quem só pinta
**Hoje:** `import … from '@thibezer/ui-components-kit/prancha'` traz **o componente inteiro** (chunk compartilhado de ~226 kB) mesmo quando o app só precisa de `desenharElementos`, `gerarPredefinicao` e `normalizarElementos` para **pintar o item na tela e no PDF**. O editor (componente + camadas + propriedades) só é necessário ao editar.
**Pedido:** novo entrypoint **`./prancha/nucleo`** (L5) que exporta **só o L2 puro** (`espaco/`, `prancha/`, sem custom element, sem CSS, sem DOM), seguro em Node/SSR/Worker, e manter `./prancha` como está (componente + núcleo). Adicione ao `package.json` `exports`, `vite.config.ts`, `scripts/check-layers.mjs` (`ENTRYPOINTS_L5`), `tests/ssr-safety.test.ts` e `tests/tipos/`. Medir e registrar o tamanho dos dois no `CHANGELOG`.
**Aceite:** `tests/check-layers.test.ts` garante que nada de `components/` é alcançável a partir do núcleo; o build gera o chunk separado.
**O app muda:** `PrintDrawing` passa a importar do núcleo; o editor importa o componente sob demanda (`import()`).

### 12. Planejar uma vez, pintar várias (repintura barata)
**Hoje:** o layout repinta **todos** os itens em canvas a cada mudança de zoom da prancheta e a cada mudança de resolução. `desenharElementos` chama `planejarElementos` em toda repintura, recalculando contornos, hachuras e pontas que **não dependem da matriz do dispositivo** (o plano está em mm da folha).
**Pedido:** exportar `planejar(elementos, opcoes?): PlanoPintura` (resultado de `planejarElementos`, congelado) e `desenharPlano(ctx, plano, opcoes: { matriz, fundo? }): EstatisticasPintura`; `desenharElementos` passa a ser `desenharPlano(ctx, planejar(...))`. Documente o que invalida o plano (qualquer mudança em elementos/camadas; **não** a matriz). Inclua cache opcional por referência do array de elementos (WeakMap) com teste.
**Aceite:** teste de equivalência (as mesmas chamadas gravadas); benchmark em `tests/prancha-desempenho.test.ts` (repintar 200 elementos com 20 matrizes distintas é ≥ 3× mais rápido que replanejar); entrada hostil.
**O app muda:** guarda o plano por item e só replaneja ao editar.

### 13. `margensDaFolha` e quadro por formato
O app usa `PrintItemsManager.sheetMargins` (margens ABNT ou personalizadas) e passou as margens ao editor como guias, e como caixa das pré-definições de moldura, **sem** poder usar `caixaDoQuadroAbnt` (que só conhece `A0…A4` retrato/paisagem e margens padrão). Exportar `caixaDoQuadro(largura, altura, margens: { esquerda, direita, superior, inferior })` genérica (folhas fora do A0–A4, margens personalizadas) e fazer `caixaDoQuadroAbnt` chamá-la. Atributo `margens="e d s i"` na prancha (guias das margens automáticas, com estilo próprio).
**Aceite:** testes (folha A3 paisagem com margem 25/10/10/10; margens que somam ≥ folha devolvem `null`).

---

## P3 — Interface e experiência (polimento)

### 14. `<ui-camadas>` sem a pseudo-camada "Sem camada" no modo simples
No editor aparece o grupo **"Sem camada"** sempre que o desenho não usa camadas, poluindo a lista (o app usa 1 camada implícita). `dadosParaPainelDeCamadas()` deve aceitar `{ ocultarSemCamada: true }` (ou `modo: 'simples'`) quando não há camadas definidas, listando os elementos direto na raiz; e `ui-camadas` precisa aceitar lista plana sem inventar cabeçalho.

### 15. Painel de propriedades sem seleção
Sem seleção, o painel mostra "Nenhuma propriedade disponível". Mostrar o que fizer sentido sem seleção (folha: tamanho, unidade, grade, snap, margens, camada ativa, opções das próximas formas: espessura, cores, pontas), **ou** uma dica "Selecione um elemento". O app já tem painel de folha próprio, mas o editor do kit precisa se bastar.

### 16. Nome do componente de propriedades
O app usa a tag **`<ui-painel-propriedades>`** (GEMINI.md e `PrintPropertiesPanel.js`) e o editor novo usa **`<ui-tabela-propriedades>`** (a do `AGENTS.md` e do playground). Confirme se uma é **alias** da outra no kit; documente (README, `AGENTS.md`, manifesto) qual é a oficial e se o alias é suportado por contrato, para os apps não divergirem.

### 17. Gradiente no PDF vetorial (melhoria opcional)
Hoje, sem `createLinearGradient/createRadialGradient`, o gradiente degrada para **cor sólida**. Para a prancha técnica isso é aceitável, mas um gradiente linear no PDF pode ser aproximado vetorialmente por **N faixas** (recortadas por `clip`, N configurável, padrão 24). Capacidade **opcional** `opcoes.gradienteEmFaixas?: number`, desligada por padrão; as estatísticas dizem quando usou. Só faça se couber sem inflar o pintor (arquivo novo `pintura_gradiente_faixas.ts`).

### 18. Texto da documentação do guia de migração (reescrever)
Reescreva `docs/guia-migracao-prancha.md` com o que a migração real ensinou:
- **Padrão recomendado de hospedagem num layout:** item guarda `elementos` em mm **locais ao item** + `caixaBase`; o canvas do item pinta com `desenharPlano` e matriz `escala(pxPorMm)`; **editor em modal** com `<ui-editor-prancha>` (ou a função do item 3); ao concluir, normalizar para a origem (item 6) e reajustar a caixa do item ao envelope (item 5), num único passo de histórico do host.
- **Valores reais do formato antigo do ConecteMapas** (use no exemplo, tirando o "provável"): `shapeType` ∈ `rect, rounded_rect, double_frame, ellipse, triangle, diamond, line_h, line_v, line_diag, arrow`; `strokeStyle` ∈ `solid, dashed, dotted, dash_dot`; `arrowHead` ∈ `end, both`; `strokeWidth` e `borderRadius` em **px a 96 dpi** (mm = px ÷ 3,78, o app usa 3,78 para não mudar a aparência; o kit usa `MM_POR_PX = 25,4/96`); `fillColor` em `rgba()`; `rotation` em graus em torno do centro da caixa, **sem alterar a caixa** (a migração gira os elementos e reajusta a caixa).
- **Contrato do contexto de pintura** (item 1), incluindo o aviso sobre `setTransform` e o exemplo de implementação.
- **Armadilhas encontradas:** `transformarElementos` pula bloqueados; `inserirPredefinicao` sem caixa; `moldura-dupla` põe o preenchimento na interna; teclado em hospedeiro (item 10).
- **Dados vindos de fora:** sempre passar por `normalizarElementos` ao carregar JSON salvo (nuvem/localStorage); mostrar o exemplo de `{ aceitos, recusados }`.

---

## Testes obrigatórios (resumo)
- **Camada A (puro, Node):** envelope visual, ajuste a caixa, normalização à origem, aparência em lote/resumo, opções novas de pré-definição, plano/`desenharPlano`, `diagnosticarContexto`, modo relativo do pintor.
- **Camada B:** `<ui-editor-prancha>`/`ligarPaineisPrancha` (conectar → desconectar → reconectar sem vazar listener), `modificado`/`revisao`/`pronto`, `ajustarElementos` sem mexer na seleção.
- **Camada C (`*.regressao.test.ts`):** o **PDF em branco silencioso** (contexto sem `setTransform`); `transformarElementos` com bloqueados; `inserirPredefinicao` fora da vista; Esc em cadeia; entradas adversárias em tudo (`NaN`, `null`, ids duplicados, matriz singular, textos com HTML).
- **Camada D:** `ssr-safety` do novo entrypoint `./prancha/nucleo`; `check-layers` (núcleo não alcança `components/`); `tests/tipos/react.tsx` e `vue.ts` para as APIs/eventos novos; teclado/ARIA do editor.
- **Camada E:** orçamento do item 12 e ≤ 16 ms para arrasto/hover/zoom com 2 mil elementos (já existente; não pode regredir).

## O que o app usa hoje (não pode mudar de assinatura)
Componente `<ui-canvas-prancha>` (atributos `largura`, `altura`, `mostrar-grade`, `grade`, `rotulo`) e os métodos `definirElementos`, `obterElementos`, `definirGuias`, `inserirPredefinicao`, `selecionarTudo`, `ajustarSelecao`, `limparSelecao`, `ajustarFolha`, `definirFerramenta`, `categoriasDePropriedades`, `aplicarPropriedade`, `dadosParaPainelDeCamadas`, `definirCamadas`, `obterCamadas`, `definirCamadaAtiva`, `alterarElementos`, `selecionarElementos`, `selecao`, `focus`; eventos `prancha-ferramenta`, `prancha-selecao`, `prancha-elemento-criado|atualizado|removido`, `prancha-ordem`, `prancha-camadas`; núcleo `desenharElementos`, `gerarPredefinicao`, `PREDEFINICOES`, `TIPO_LINHA_DO_ESTILO`, `transformarElemento`, `girarElementos`, `escala`, `translacao`, `compor`, `limitesNaFolha`, `meiaEspessura`; auxiliares `FERRAMENTAS_PALETA_PRANCHA`, `ferramentaDaPaleta`, `CAMADA_SEM_CAMADA`, `camadaDoPainel`, `camadasComMudanca`, `camadasNaOrdemDoPainel`.

## Entrega esperada
1. Código, testes e docs por bloco, todos os gates verdes, **sem commit nem publicação**.
2. `CHANGELOG.md` em "Não publicado", com a **versão sugerida** e os **comandos exatos** de release (do protocolo) e de atualização no app (`npm install @thibezer/ui-components-kit@<versão>`), sem executá-los.
3. Relatório final com, para cada item numerado acima: **feito / parcial / não feito**, a API final e **o que o app pode apagar** (confirme ou corrija a coluna "O app apaga" de cada item).

---

### Anexo (não é para o kit): pendências do lado do app, que ficam comigo
1. Validar `elements` ao carregar (`normalizarElementos`, com teto de elementos) para dados hostis vindos da nuvem.
2. Exportar um PDF e um PNG reais no navegador com um Desenho e conferir (hoje só testado em Node).
3. Trocar para `./prancha/nucleo` e carregar o editor sob demanda quando os itens 3 e 11 saírem.
4. Guardar o plano de pintura por item (item 12).
5. Apagar a cola listada em cada "O app apaga".
