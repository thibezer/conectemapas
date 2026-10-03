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

---

## 5. Colaboração em Tempo Real (Nuvem PHP/MySQL)
- **Cursor por revisão, nunca por relógio**:
  - Toda escrita (`sync_deltas`, `save_all`, camadas alteradas em `save_metadata`) chama `nextRevision()` dentro da transação; as linhas gravadas recebem essa `rev`.
  - `pull_changes` usa `sinceRev`/`sinceId` (cursor `(rev, id)` persistido em `cm_sync_cursor_<projeto>`). Não reintroduzir `updated_at > since`: empata no mesmo segundo, depende do fuso PHP x MySQL e perde linhas após o `LIMIT`.
- **Edição local vence enquanto não confirmada**:
  - `StorageService.hasPendingLocalChange(id)` (fila de debounce, envio em andamento ou pendência offline) impede que um pull sobrescreva a feição; o cursor fica retido antes dela.
  - Nunca limpar `_dirtyFeatures` ao aplicar alterações remotas.
- **Envio serializado**: toda escrita em nuvem passa por `_enqueuePush` (um POST por vez, na ordem). Falhas vão para `cm_pending_deltas_<projeto>` e são mescladas no próximo envio.
- **`keepalive` só abaixo de 64 KB** (`_postJson`); acima disso o navegador rejeita a requisição.
- **`save_all` não poda por padrão**: só marca ausentes como excluídas com `prune: true`, e respeita `baseRev` para não sobrescrever edições de outros operadores.
- **Presença**: o pull (≈1 s, aba visível) envia nome/cor/cursor e recebe os demais operadores ativos (`cm_presence`). Nomes remotos são sempre escapados antes de ir ao DOM.
- **Esquema**: ao alterar o DDL, incrementar `CM_SCHEMA_VERSION` em `api.php` (o marcador `.cm_schema_version` evita DDL a cada requisição).

---

## 6. Deploy e Servidor de Produção (Hostinger LiteSpeed / Node.js & Vite)
- **`entry_file: null` e `app_type: "vite"` nas configurações de build Node.js**:
  - Aplicações Vite são frontends SPA estáticos. Nas configurações de build do Node.js na Hostinger, o `entry_file` **NUNCA** deve ser configurado (deve ser mantido `null` / `none`).
  - Se `entry_file` for preenchido (ex: `index.js`), a Hostinger assume tratar-se de um servidor Node contínuo (Express/Nest) e o sincronizador interno não copia os arquivos compilados de `dist/` para a `public_html/`, resultando em `403 Forbidden` por ausência de `index.html`.
- **Configurações Mandatórias do `.htaccess`**:
  - `DirectoryIndex index.html index.php` deve sempre constar no início do `.htaccess` para que o LiteSpeed sirva o SPA na raiz sem tentar listagem de diretório.
  - `Options -Indexes +FollowSymLinks` para segurança e resolução correta de caminhos.
  - Proteção de arquivos (`db_config.php`, `.env`, `.cm_schema_version`) deve usar sintaxe Apache 2.4 / LiteSpeed (`<IfModule mod_authz_core.c> Require all denied </IfModule>`), evitando diretivas 2.2 isoladas (`Order allow,deny`) que causam comportamentos anômalos.
  - Regra SPA Rewrite: `RewriteRule ^ index.html [L]`.
- **Higiene Rígida da Pasta `public/`**:
  - O Vite copia integralmente o conteúdo da pasta `public/` para a raiz de `dist/`.
  - **NUNCA** versionar `public/index.html` ou pastas `public/assets/`. O entrypoint do Vite é exclusivamente o `index.html` da raiz do repositório.
- **Resiliência do Banco de Dados no Deploy (`api.php`)**:
  - `db_config.php` é ignorado no Git (`.gitignore`). O backend `api.php` deve conter fallback automático para variáveis de ambiente e parâmetros padrão do banco MySQL da Hostinger, impedindo que novas publicações quebrem o backend.

