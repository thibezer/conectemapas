# Procedimento de Atualização Rápida do Kit de UI

Este documento estabelece o protocolo de execução imediata sempre que o usuário solicitar:
> **"atualize o kit de ui"**, **"atualize o kit"**, **"sincronize o kit"** ou similar.

O assistente (ou desenvolvedor) deve executar o fluxo do início ao fim o mais rápido possível.

---

## ⚡ Execução Automática em 1 Passo (Recomendado)

Basta executar o comando:

```bash
npm run update:kit
```
*(ou `node tools/atualizar-kit.mjs`)*

Para rodar tudo localmente sem enviar ao remoto:
```bash
npm run update:kit -- --skip-push
```

### O que o comando faz automaticamente:
1. **Origem**: Verifica se há commits pendentes no repositório de desenvolvimento da biblioteca (`D:\Programação\UI_Componentes`) e os envia ao Git.
2. **NPM**: Consulta a versão mais recente de `@thibezer/ui-components-kit` publicada no NPM.
3. **Instalação**: Instala a versão mais recente no projeto `conectemapas`.
4. **Testes**: Executa a suíte completa de testes (`npm test`). Se falhar, interrompe sem alterar o histórico.
5. **Build**: Executa `npm run build` para garantir que o bundle Vite compila 100%.
6. **Commit**: Faz commit semântico isolando apenas `package.json` e `package-lock.json` (`chore(deps): atualiza @thibezer/ui-components-kit para vX.Y.Z`).
7. **Deploy Git**: Envia as alterações diretamente para `origin/main`.

---

## 🛠️ Passo a Passo Manual (Alternativo)

Caso prefira rodar os comandos avulsos:

```bash
# 1. Instalar versão mais recente do npm
npm install @thibezer/ui-components-kit@latest

# 2. Validar integridade
npm test
npm run build

# 3. Commitar e enviar
git add package.json package-lock.json
git commit -m "chore(deps): atualiza @thibezer/ui-components-kit para v$(node -p "require('./package.json').dependencies['@thibezer/ui-components-kit']")"
git push origin main
```

---

## 🛡️ Regras e Salvaguardas
- **Isolamento**: Se houver arquivos de outras funcionalidades modificados na working tree, **nunca use `git add .`**. O script adiciona exclusivamente `package.json` e `package-lock.json`.
- **Barreira de Testes**: Se `npm test` falhar, o script aborta e não cria commit.
- **Transparência**: Ao final, informe a versão instalada, confirmação dos testes e o hash do commit gerado.
