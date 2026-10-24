# Plano: vistas de prancha no padrão Revit

Objetivo: cada mapa de cada prancha é uma **vista** do projeto, com camadas visíveis, gráficos (cor, traço, preenchimento, meio-tom), filtros por atributo, rótulos e mapa de fundo próprios. Nada disso altera o mapa principal nem as outras pranchas.

Decisões já tomadas:
- "Rios, ruas, construções" são camadas comuns do projeto, sem relação com o fundo.
- Camada nova fica **visível até ser desligada** (padrão Revit).
- Pranchas existentes continuam espelhando o mapa principal até a primeira edição.
- Pranchas vão para a nuvem.
- Bing Mapas entra no catálogo de fundos.
- Filtros e demais recursos seguem o modelo de vistas do Revit.

---

## 1. Como está hoje

| Ponto | Situação | Consequência |
|---|---|---|
| Visibilidade no mapa da prancha | Lê `layer.visible` / `feature.visible` do projeto | Ocultar no mapa principal some da prancha |
| Estilo na tela da prancha | Só `layer.color`; preenchimento 0,35 e traço 2 fixos | Ignora `feature.style`, que o mapa principal usa |
| Estilo no PDF | `feat.color` antes de `layer.color` (ordem inversa da tela) | **Tela e PDF podem sair com cores diferentes** |
| Polígonos no PDF | Só o 1º anel | Furos somem; multipolígono sai só com a 1ª parte |
| Rótulos | Não aparecem na prancha | — |
| Mapa de fundo | Duas listas com nomes diferentes (app × prancha) | Difícil manter |
| Legenda | Camadas do projeto + `hiddenLayerIds` próprio | Não acompanha o mapa |
| Pranchas | Só `localStorage` | Não vão para outro computador nem para outro operador; limite de ~5 MB |

---

## 2. O modelo do Revit e a tradução para o ConecteMapas

| Revit | ConecteMapas | Observação |
|---|---|---|
| Folha (Sheet) | Prancha | Já existe |
| Vista posicionada na folha (Viewport) | Item `map` / `inset_map` | Cada item guarda a sua vista |
| Estilos de objeto (Object Styles) | Estilo da camada e da feição no projeto | Nível base: o que o mapa principal mostra |
| Visibilidade/Gráficos por categoria (VV) | Ajuste por **camada** na vista | Visível, traço, preenchimento, meio-tom, transparência, rótulo |
| Filtros de vista (regras por parâmetro) | **Filtros por atributo** (motor `FeatureQuery` existente) | Ex.: "Área > 1 ha", "Categoria = APP" |
| Ordem dos filtros: o do topo vence | Igual | Prioridade explícita e arrastável |
| Sobrepor gráficos na vista por elemento | Ajuste por **feição** na vista | Ex.: destacar o lote do cliente |
| Meio-tom (Halftone) | Meio-tom | Contexto apagado sem sumir |
| Ocultar/Isolar temporário | Isolar temporário na prancha | Não é salvo; aviso de borda enquanto ativo |
| Revelar ocultos (lâmpada) | Mostrar ocultos em magenta | Para religar o que foi desligado |
| Modelo de vista (View Template) com "Incluir" | **Modelo de vista** com seções incluídas | Vínculo vivo: mudar o modelo atualiza todas as vistas |
| Aplicar propriedades do modelo | Cópia única | Sem vínculo |
| Etiquetas (Tags) | Rótulos por camada | Com modelo de texto: `Lote {name}\n{area} m²` |
| Espessuras de linha por pena | Série ISO de penas em mm (0,13 · 0,18 · 0,25 · 0,35 · 0,5 · 0,7 · 1,0) | Igual em qualquer DPI |
| Padrões de linha / de preenchimento | Contínuo, tracejado, pontilhado, traço-ponto; sólido e hachuras | Hachuras na fase final |
| Nível de detalhe e escala da vista | **Faixa de escala** por camada (mín./máx.) | Ex.: lotes só abaixo de 1:5.000 |
| Duplicar vista / dependente | Duplicar mapa com a vista / copiar vista para outro mapa | — |

### Hierarquia de resolução (do mais forte ao mais fraco)

**Gráficos**, campo a campo (cor do traço pode vir de um nível e espessura de outro):
1. Ajuste por feição na vista
2. Filtros ativos que casam com a feição, do topo para baixo (o de cima vence)
3. Ajuste da camada na vista
4. Estilo da feição no projeto (`feature.style`, `feature.color`)
5. Estilo da camada no projeto (`layer.color`)
6. Padrão

**Visibilidade:** qualquer nível que oculta, oculta (camada desligada, filtro com "visível" desmarcado, feição ocultada na vista ou fora da faixa de escala). O ajuste por feição pode reexibir uma feição escondida por um filtro, como no Revit. Camada desligada não pode ser religada por filtro.

**Meio-tom** é aplicado por último, sobre a cor final: mistura de 50% com branco.

---

## 3. Modelo de dados

### 3.1 Formato comum de ajuste (igual em todos os níveis)

```js
// OverrideGraphics — todos os campos opcionais; ausente = herda do nível de baixo
{
  visible: false,
  stroke: { color: '#6b7280', widthMm: 0.25, pattern: 'tracejado' },
  fill:   { color: '#9ca3af', opacity: 0.5, pattern: 'solido' },
  halftone: true,
  label:  { show: true, text: '{name}', sizePt: 7, color: '#111827', halo: true }
}
```

### 3.2 Biblioteca do projeto (nuvem, compartilhada entre pranchas)

```js
printLibrary: {
  filters: [
    { id, name: 'APP', layerIds: ['...'] /* vazio = todas */, query: { /* critérios FeatureQuery */ } }
  ],
  viewTemplates: [
    {
      id, name: 'Planta de situação',
      include: { layers: true, filters: true, labels: true, basemap: false, scaleRanges: true },
      view: { /* mesmo formato de 3.3 */ }
    }
  ]
}
```

### 3.3 Vista do item de mapa

```js
{
  type: 'map',
  view: {
    templateId: null,                // com modelo, as seções incluídas vêm dele e ficam travadas no painel
    followProject: false,            // true só em pranchas migradas que ainda não foram editadas
    basemap: 'google_satelite',
    layers:   { '<layerId>': { /* OverrideGraphics */, minScale: 0, maxScale: 5000 } },
    filters:  [ { filterId, enabled: true, /* OverrideGraphics */ } ],   // ordem = prioridade
    elements: { '<featureId>': { /* OverrideGraphics */ } }
  }
}
```

- Ajustes **esparsos**: só o que difere. Camada sem entrada segue o projeto e fica visível.
- Camada ou filtro excluído do projeto: a entrada órfã é ignorada na leitura e limpa ao salvar.
- **Migração:** itens antigos ganham `view` com `followProject: true`. Na primeira edição, a visibilidade atual do projeto é fotografada como ajustes e `followProject` vira `false`.

---

## 4. Arquitetura

```
           FeatureStyle (puro)              BasemapCatalog (puro)
   base do projeto → OverrideGraphics      id, nome, provedor, exportável,
   resolve(feat, layer)                    exige chave, atribuição
                 │                                  │
           PrintViewResolver (puro)                 │
   resolve(feat, layer, view, library, scale)       │
   → { visible, stroke, fill, halftone, label }     │
       │ cache por (vista, versão das feições)      │
   ┌───┴───────────────┬────────────────────┬───────┴──────┐
CanvasMapEngine   Tela da prancha       PrintExporter   Legenda
(usa FeatureStyle) (Leaflet)            (canvas)        (lê a vista)
```

- **`FeatureStyle`** substitui `CanvasMapEngine._styleOf` e as duas versões da impressão: o mapa principal e a prancha passam a ler o projeto do mesmo jeito.
- **`PrintViewResolver`** aplica a hierarquia da seção 2 e reaproveita `FeatureQuery` para os filtros. Calcula o casamento de cada filtro uma vez por vista (cache invalidado quando as feições mudam), não por desenho.
- **`PrintLibrary`** guarda filtros e modelos de vista, com histórico e sincronização.
- **Exportador:** todos os anéis (furos com `evenodd`), todas as partes, padrões de linha, meio-tom e rótulos. Teste de paridade: mesma vista na tela e no canvas de exportação gera os mesmos estilos resolvidos.
- **Legenda:** ganha `mapItemId` (padrão: mapa principal). Lista as camadas visíveis daquela vista com os gráficos da vista e, abaixo, os filtros ativos que alteram aparência (ex.: "APP — hachura verde").

---

## 5. Interface

### 5.1 Painel lateral (mapa selecionado)
Resumo da vista: modelo aplicado (ou "Nenhum"), mapa de fundo, nº de camadas ocultas, nº de filtros ativos, e o botão **Visibilidade/Gráficos (VV)**.

### 5.2 Janela Visibilidade/Gráficos (atalho `V V`, como no Revit)
Janela larga, não cabe no painel lateral. Abas:

- **Camadas:** tabela com Visível · Traço · Preenchimento · Meio-tom · Rótulo · Faixa de escala · ↺ (voltar ao projeto). Inclui "Mostrar todas", "Ocultar todas" e "Copiar do mapa principal".
- **Filtros:** lista ordenável (arrastar = prioridade) com Ativo · Visível · Traço · Preenchimento · Meio-tom. Botões "Adicionar filtro" (escolhe da biblioteca) e "Editar filtros…", que reaproveita o editor de critérios da Busca Avançada.
- **Feições:** ajustes por feição já feitos nesta vista, com remover. Ajuste novo pelo clique no mapa da prancha ou pela busca.
- **Rótulos:** atalho para várias camadas de uma vez (texto, tamanho, halo).

Com modelo de vista aplicado, as abas incluídas ficam travadas, com o aviso "Controlado pelo modelo X" e o link "Desvincular".

### 5.3 Na prancha
- **Isolar/Ocultar temporário:** camada ou feição, com borda colorida no mapa enquanto ativo (não é salvo nem exportado).
- **Revelar ocultos:** feições ocultas aparecem em magenta; clique religa.

### 5.4 Kit
- A tabela de Visibilidade/Gráficos pede uma grade editável. Avaliar `<ui-tabela>` (células com cor, número e caixa de seleção); se não atender, cria-se um componente no kit.
- O `<ui-camadas>` em modo enxuto (sem feições, enquadrar, alvo, "+ Camada") serve à lista "Elementos da Prancha" e a um resumo rápido de camadas no painel.
- Seletor de fundo: `<ui-seletor-mapa-base>`.
- Toda mudança no kit exige publicar no npm antes do push do app.

---

## 6. Mapa de fundo

Catálogo único (`BasemapCatalog`) para o app e a prancha:

| Fundo | Provedor | Observação |
|---|---|---|
| Vazio (branco) | — | Sempre exportável |
| Google Satélite / Híbrido | Google | URLs não oficiais; termos de uso restritivos e CORS instável na exportação |
| Esri Satélite, Claro, Escuro, Relevo | Esri | Exportáveis |
| OpenStreetMap | OSM | Exportável; política de uso justo |
| **Bing / Microsoft** | Azure Maps | Ver abaixo |

**Bing:** a conta gratuita (Basic) do Bing Maps foi encerrada em 30/06/2025; só contas Enterprise seguem até 2028, e a Microsoft orienta migrar para o **Azure Maps**, que exige conta, chave e cobrança. As URLs de tile do Bing não podem ser fixadas no código: vêm de um serviço de metadados.
Proposta: um provedor "Microsoft (Azure Maps)" servido por um **proxy de tiles no `api.php`**. A chave fica no servidor (`db_config.php`/`.env`), nunca no JavaScript. O mesmo proxy resolve o CORS na exportação.
Chaves antigas (`satelite`, `branco`, `cartodb_positron`…) são convertidas na leitura.

---

## 7. Nuvem

- Tabela `cm_print_sheets` (projeto, id, nome, ordem, dados JSON, `rev`, autor, excluída) e biblioteca (`cm_print_library` ou campo nos metadados do projeto), seguindo as regras do GEMINI.md §5: escrita com `nextRevision()`, pull por cursor `(rev, id)`, envio serializado e fila offline.
- **Conflito:** granularidade por prancha. Quem salva com `baseRev` desatualizado recebe aviso e escolhe entre recarregar e sobrescrever. Presença mostra "Fulano está editando esta prancha".
- **Imagens (logotipos):** sair do JSON (data URL) para upload próprio, para não inflar a sincronização.
- **Migração:** na primeira abertura com a nuvem disponível, as pranchas do `localStorage` sobem e a cópia local vira cache.
- `CM_SCHEMA_VERSION` incrementado.

---

## 8. Fases

| Fase | Entrega |
|---|---|
| **0. Fundação** | `FeatureStyle`, `BasemapCatalog`, exportador com furos/partes, tela = PDF, testes de paridade. Nada novo na tela, só correções |
| **1. Camadas na vista** | `view.layers` (visível, traço, preenchimento, meio-tom), migração `followProject`, janela VV (aba Camadas), seletor de fundo, legenda ligada ao mapa |
| **2. Nuvem** | Pranchas e biblioteca no backend, conflito por prancha, imagens fora do JSON |
| **3. Rótulos** | Por camada, com modelo de texto, pt, halo; tela e PDF iguais |
| **4. Filtros** | Biblioteca de filtros (editor da Busca Avançada), prioridade, aba Filtros, legenda dos filtros |
| **5. Modelos de vista** | Biblioteca, seções incluídas, vínculo vivo e cópia única, travamento no painel |
| **6. Feições e temporários** | Ajuste por feição, isolar/ocultar temporário, revelar ocultos, clique no mapa da prancha |
| **7. Escala e padrões** | Faixa de escala por camada, padrões de linha completos, hachuras de preenchimento |
| **8. Microsoft (Azure Maps)** | Proxy de tiles no `api.php` com chave no servidor (depende de conta Azure) |

Cada fase fecha com testes em `tests/` e verificação no navegador, e é publicada sozinha. As fases 2 e 3 podem andar em paralelo depois da 1.

---

## 9. Riscos

- **Desempenho:** muitos filtros × muitas feições. O resolvedor calcula os casamentos uma vez por vista e guarda em cache; o desenho usa recorte pela área do mapa e `GeometrySimplifier` por escala.
- **Rótulos sobrepostos:** a 1ª versão não evita colisão; o modelo já prevê `label.priority`.
- **Complexidade para o usuário:** os modelos de vista são o atalho. O sistema traz 2 ou 3 modelos prontos (Situação, Planta topográfica, Localização).
- **Termos de uso dos fundos:** Google e Bing têm restrições; o catálogo informa e o proxy respeita.
- **Limite do `localStorage`** até a fase 2.

---

## 10. Decisões finais

1. **Fase 8 (Microsoft/Azure Maps) parada** até haver uma opção gratuita viável de satélite comercial.
2. **Modelos de fábrica** voltados a trabalhos acadêmicos e projetos urbanos: "Acadêmico — mapa temático", "Urbano — planta de situação" e "Urbano — uso do solo".
3. **Edição exclusiva por prancha:** quem abre uma prancha para editar a trava; os demais só visualizam até ela ser liberada (fechar, trocar de prancha ou expirar por inatividade).

Referências:
[Propriedades do modelo de vista (Autodesk)](https://help.autodesk.com/cloudhelp/2024/ENU/RevitLT-Customize/files/GUID-66D789A8-AB92-4AF0-B884-DF3A3302E117.htm) ·
[Sobre filtros de vista (Autodesk)](https://help.autodesk.com/cloudhelp/2021/ENU/Revit-DocumentPresent/files/GUID-87A63C25-99A6-428D-A0FF-112E4FC9C3D7.htm) ·
[Aplicar um filtro e prioridade (Autodesk)](https://help.autodesk.com/cloudhelp/2018/ENU/Revit-DocumentPresent/files/GUID-FA7B0AD9-4F0F-4405-9DF7-35D30D7CBE7B.htm) ·
[Hierarquia de sobreposição de visibilidade (Arkance)](https://ukcommunity.arkance.world/hc/en-us/articles/25798334622738-Revit-Tip-Element-Visibility-Override-Priority-List) ·
[Bing Maps Imagery API e encerramento (Microsoft)](https://learn.microsoft.com/en-us/bingmaps/rest-services/imagery) ·
[Acesso direto aos tiles do Bing (Microsoft)](https://learn.microsoft.com/zh-tw/BingMaps/rest-services/directly-accessing-the-bing-maps-tiles)
