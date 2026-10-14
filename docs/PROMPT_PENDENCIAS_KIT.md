Você está no repositório do kit `@thibezer/ui-components-kit` (D:\Programação\UI_Componentes). O app ConecteMapas já usa o `<ui-canvas-cad>` no lugar do antigo MapEngine, por meio de um adaptador (`CanvasMapEngine`). Ao integrar, apareceram pendências que só se resolvem aqui. Resolva todas, nesta ordem, sem quebrar a API existente (tudo novo é opt-in) e sem fazer commit nem publicar no npm (isso fica comigo).

## Regras de trabalho
- A cada item: implemente, escreva testes (vitest) e atualize `docs/` (guia de migração e eventos), `README` e `CHANGELOG` (seção "Não lançado").
- Antes de dar um item por concluído: `npx tsc --noEmit` limpo e `npx vitest run` inteiro verde. Ao final: `npm run build`.
- Siga o estilo do código vizinho (português, `CustomEvent` com prefixo `cad-`, módulos `feature_*.ts` puros + `cad-*.ts` de orquestração).
- Se uma decisão mudar comportamento existente, liste em "Mudanças de comportamento" no CHANGELOG.
- No fim, me entregue um relatório curto: o que mudou por item, testes novos e qualquer decisão que você tomou sozinho.

## Contexto do que o app faz hoje (para você não quebrar)
O app sincroniza feições com `definirFeicoes/adicionarFeicao/removerFeicao`, escuta `cad-selecao`, `cad-feicao-selecionada`, `cad-feicao-criada`, `cad-feicao-atualizada`, `cad-feicao-acao`, `cad-feicao-menu`, `cad-feicao-hover`, `cad-medicao`, `cad-feicao-dividida`, `cad-divisao-falhou`, `cad-conta-gotas`, `cad-ferramenta`, `cad-snap`, `cad-edicao-*`, `cad-desenho-recusado`, e chama `definirFerramenta`, `definirCamadaDesenho`, `definirEstiloDesenho`, `definirSnap`, `definirAtalhoSnap`, `editarVertices`, `zoomPara*`, `ajustar*`, `*Previa*`, `atualizarCursorRemoto`, `definirMargensPopup`, `nosDesenho`, `desfazerVerticeDesenho`. Nada disso pode mudar de assinatura.

## Pendência 1 — Inicialização síncrona e esconder padrões do kit (hoje o app usa membros privados)
O app precisa do `L.Map` de forma síncrona e desliga coisas que o kit liga por padrão. Hoje faz isso com `host.initCAD()`, `host.initTimeout` (privados) e escondendo o painel por CSS. Torne isso API pública e estável:
- Método público `inicializarAgora(): L.Map | null` (idempotente, cancela o agendamento do `connectedCallback`, nunca cria um 2º mapa).
- Atributos booleanos: `sem-camadas-padrao` (não cria/plota satélite Google, SIGEF/INCRA, homologados, perímetro, vizinhos, vértices, grade; e **nunca** consulta o INCRA no clique quando o SIGEF não existe), `sem-painel-camadas`, `sem-barra-rapida`, `sem-atalho-snap` (equivale a `definirAtalhoSnap(false)` desde o início, para não haver janela com a tecla S ativa).
- Documente como o consumidor injeta CSS no shadow root: método `definirEstilosExternos(css: string | CSSStyleSheet[])` que mantém as folhas atualizadas (o app hoje espelha `document.styleSheets` por MutationObserver). Teste que funciona com `adoptedStyleSheets` e que `destroy()` limpa.
- Critério: o app consegue montar o componente só com atributos e métodos públicos; nenhuma referência a `initCAD`/`initTimeout`.

## Pendência 2 — Posição dos HUDs (desenho e edição de vértices)
Os HUDs `#cm-draw-hud` e `#cm-vertex-edit-hud` ficam em `bottom:16px; left:50%` do mapa inteiro. No app, uma barra de tabela cobre a base do mapa e um painel lateral cobre a direita, então o HUD fica parcialmente escondido (hoje sobrescrevo com `bottom:56px !important` por CSS).
- Crie `definirMargensHud({ topo, base, esquerda, direita })` (px), no mesmo espírito de `definirMargensPopup`, e centralize o HUD na área visível (descontando as margens). Padrões = comportamento atual.
- Expor também custom properties `--cad-hud-base`, `--cad-hud-esquerda`, `--cad-hud-direita` para quem preferir CSS.
- Testes: posição calculada com margens, HUD de desenho e de edição usam a mesma regra, e o HUD não passa dos limites com margens grandes (`max-width`, quebra de linha).

## Pendência 3 — Linha multiparte (MultiLineString)
Hoje `LineString` só aceita uma lista de vértices; uma feição multiparte do app mostra só a primeira parte (perda de dados na tela).
- Adicione suporte a multiparte em `LineString` (`coordenadas` simples OU `partes: LatLonPar[][]`) ou um tipo `MultiLineString`; escolha o que quebra menos e justifique no CHANGELOG. Cubra: normalização, renderizador, hit-test (tolerância por parte), caixa Window/Crossing, laço, snap (vértices de todas as partes), métricas/rótulo (extensão = soma), popup, `obterFeicoes`, `dividir`/`juntar` (recusar com motivo claro) e `editarVertices` (recusar com `cad-edicao-recusada` motivo `multiparte`, como já ocorre com polígono com furos).
- Teste: round-trip de normalização, seleção por clique em qualquer parte, extensão somada.

## Pendência 4 — Operações em lote e ordem das feições (desempenho e fidelidade)
- `adicionarFeicao`, `atualizarFeicao` e `removerFeicao` regravam a lista inteira da camada (O(N)) e `setLayerData` re-renderiza. O adaptador teve de limitar o modo incremental a 20 mudanças. Crie `aplicarLote(camadaId, { adicionar?, atualizar?, remover? }, opcoes?)` que faz **uma** regravação e **um** `aposDados`, devolvendo `{ adicionadas, atualizadas, removidas, recusadas }`.
- `adicionarFeicao` com id existente substitui **e move a feição para o fim da lista** (muda a ordem de empilhamento dentro da camada). Faça a substituição manter a posição original (e o `aplicarLote` também).
- `atualizarFeicao` mescla `propriedades`, então atributos apagados no consumidor ficam para trás. Ofereça `opcoes.substituirPropriedades` (ou um método `substituirFeicao`) para troca total, e documente a diferença.
- Medição de desempenho: 100 mil feições em uma camada, 1 edição = tempo constante aceitável (documente o número em `docs/`). Teste de regressão com `aplicarLote` de 5 mil mudanças em < 1 s no ambiente de testes (ajuste o limite se a CI for lenta).

## Pendência 5 — Feição oculta ≠ feição excluída
O app tem `visible:false` (oculta, mas existe, pode ser editada pela tabela, entra em pares oficial×prévia) e `is_deleted`. Hoje mapeio `visible:false` para `excluida:true`, o que dispara efeitos de exclusão (encerra edição, tira da seleção, some do snap).
- Adicione `oculta?: boolean` em `Feicao`: não desenha, não seleciona, não entra em hit-test, snap, caixa ou laço, mas **não** encerra edição, não conta como excluída e participa da regra oficial×prévia como as demais. `excluida` mantém o significado atual.
- Testes para cada consumidor (renderizador, hit-test, snap, caixa, laço, versões, câmera `ajustarTudo` ignora ocultas).

## Pendência 6 — Estilo do texto e do ponto no paridade com o app
O app desenha texto com selo (fundo e borda) e ponto circular com contorno branco; o kit só usa `corTraco`, `tamanhoFonte` e `halo` no texto.
- Em `EstiloFeicao` adicione, só para `Text`: `corFundo`, `corBorda`, `opacidadeFundo`, `raioBorda` e `tamanhoFonte` (já existe). O selo substitui o halo quando `corFundo` existe. Valide cores com `corSegura`.
- Ponto sem ícone: aceite `corContorno` e `espessuraContorno` distintos de `corTraco`/`espessuraTraco` (hoje o contorno e o preenchimento se confundem). Padrões atuais preservados.
- Testes de renderização (HTML do `divIcon`, atributos `style` seguros, sem injeção).

## Pendência 7 — Ferramentas: lacunas de comportamento
- **Medição**: o app mostra a área enquanto há 3+ pontos na régua de distância. Faça `medir-distancia` exibir também área e perímetro no HUD quando `pontos >= 3` (sem criar feição), e inclua `areaM2`/`perimetroM` no `cad-medicao` nesse caso (já existe para `medir-area`). Mantenha `medir-area` como está.
- **Círculo**: raio mínimo 2 m (hoje aceita qualquer raio > 0); abaixo disso ignore o clique como o motor antigo.
- **Auditoria de ordem de eventos**: em TODAS as ferramentas (ponto, linha, polígono, retângulo, elipse, hexágono, estrela, círculo, texto, caneta, medir, dividir, laço, conta-gotas) a ferramenta deve poder ser desativada por quem escuta o evento de conclusão sem efeitos colaterais, e `cad-selecao` nunca deve ser emitido com a ferramenta ainda ativa quando a seleção é consequência dela (já corrigido no laço). Escreva um teste parametrizado que verifica isso para cada ferramenta.
- **Popup, ação "copiar"**: o kit já grava na área de transferência e também emite `cad-feicao-acao`; deixe a escrita opcional (`opcoes.copiarParaAreaDeTransferencia`, padrão `true`) para o app poder controlar o toast sem escrever duas vezes.
- **Texto**: permita ao consumidor interceptar a criação (evento cancelável `cad-texto-solicitado` com a coordenada e `preventDefault()` para abrir um modal próprio); sem `preventDefault`, mantém o campo inline atual.

## Pendência 8 — Coordenada (0, 0)
`normalizarFeicaoEntrada` herda a rejeição de (0, 0) exato ("Null Island"). Adicione a opção `aceitarOrigem?: boolean` (atributo `aceitar-origem`, padrão `false`) para quem tem dados reais ali, e teste os dois modos.

## Pendência 9 — Versão e entrega
- Suba a versão para **2.1.0** (`package.json`, lockfile) e feche a seção do CHANGELOG com a data de hoje; liste as "Mudanças de comportamento" já existentes (Ctrl/Cmd/Shift+clique no vazio, marcador DOM, `magnetSnap` obsoleto) mais as novas.
- Garanta que `npm run build` gera `dist` com `canvas.d.ts` incluindo todos os métodos novos e que `custom-elements.json` foi regenerado.
- Rode `npm pack` e confirme que o tarball contém `dist/` e não contém `privado/`, `coverage/`, segredos nem `node_modules`.
- NÃO publique. Entregue os comandos exatos de publicação e de atualização da dependência no app (`npm install @thibezer/ui-components-kit@2.1.0`), e uma checklist de verificação manual no playground (feições, laço, medição, edição de vértices com HUD em tela pequena, multilinha).

## Entrega esperada
1. Código + testes + docs de todas as pendências, `tsc` e `vitest` verdes, `npm run build` ok.
2. Relatório final (por pendência: o que mudou, arquivos principais, testes novos, decisões tomadas).
3. Lista de qualquer coisa que você NÃO conseguiu resolver, com o motivo.
