# Regras Arquiteturais e Padrões ConecteMapas (GEMINI.md)

Este documento registra as decisões de engenharia, arquitetura e salvaguardas contra regressões no projeto **ConecteMapas**.

---

## 1. Persistência de Dados e Ciclo de Vida do Estado (StorageService)
- **Nunca fazer fallback para mock quando o array estiver vazio (`[]`)**:
  - `Array.isArray(saved.features)` deve ser respeitado diretamente. Se o usuário apagou tudo ou carregou um projeto limpo, o estado deve permanecer `[]`, e não voltar aos `DEFAULT_FEATURES`.
- **Persistência Dupla Local**:
  - Manter gravação síncrona no `LocalStorage` para velocidade e assíncrona no `IndexedDB` para resiliência de grandes volumes geodésicos.
- **Normalização de Coordenadas Leaflet**:
  - O Leaflet (`L.polygon`, `L.polyline`) exige tuplas de números `[lat, lng]`.
  - Ao desserializar ou carregar dados, sempre normalizar objetos `{lat, lng}` para `[lat, lng]`.

---

## 2. Ciclo de Ferramentas CAD e Desenho Vetorial (MapEngine)
- **Ordem de Limpeza vs Renderização**:
  - Ao finalizar qualquer forma com <kbd>Enter</kbd>, <kbd>Espaço</kbd>, duplo clique ou botão *"Concluir"*:
    1. Limpar buffers e camadas temporárias primeiro (`resetDrawingState()`).
    2. Retornar a ferramenta ativa para `'select'`.
    3. Só então invocar o callback `onFeatureCreated(feature)`.
  - Isso evita condições de corrida (*race condition*) onde a limpeza tardia apagava a feição definitiva recém-renderizada.
- **Visibilidade de Camadas**:
  - Grupos de camadas (`L.featureGroup`) devem ser anexados ao mapa quando `layer.visible !== false`.

---

## 3. Gestão de Teclas e Atalhos de Teclado
- **Proteção contra Modificadores Globais**:
  - Listeners de atalhos de ferramentas simples (`A`, `L`, `P`, `V`, `Z`, `S`) **NUNCA** devem interceptar teclas se `e.ctrlKey`, `e.metaKey` ou `e.altKey` estiverem ativos:
    ```javascript
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    ```
  - Preservar sempre os comandos do sistema e da aplicação:
    - <kbd>Ctrl+Z</kbd>: Desfazer vértice (durante desenho) ou desfazer feição (mapa geral).
    - <kbd>Ctrl+Y</kbd> / <kbd>Ctrl+Shift+Z</kbd>: Refazer ação.
    - <kbd>Ctrl+S</kbd>: Salvar projeto no banco local.
    - <kbd>Ctrl+K</kbd>: Focar na busca da tabela de atributos.

---

## 4. UI e Web Components (`ui-components-kit`)
- **Arquitetura SRP**:
  - Cada modal, toolbar, header e painel possui seu respectivo arquivo `.js` e `.css` isolados (ex: `HeaderBar.js` + `HeaderBar.css`, `LayerPanel.js` + `LayerPanel.css`).
- **Botões e Modais**:
  - Em barras, tabelas e cabeçalhos, sempre usar `<ui-botao-primario inline>`.
- **Acessibilidade**:
  - Evitar `<label>` solto sem vínculo `for="id"`. Usar `<span class="...">` ou os atributos embutidos dos Web Components (`label="..."`).
