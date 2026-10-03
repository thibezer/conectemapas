# 🚀 Guia de Publicação do ConecteMapas na Hostinger

Este guia descreve o passo a passo completo para hospedar o **ConecteMapas** no seu plano de hospedagem da **Hostinger** (hPanel / Apache / LiteSpeed) com máxima velocidade, segurança e suporte PWA.

---

## 1. O que foi preparado e configurado

O ConecteMapas está 100% otimizado para produção web com:
- ✅ **Base Relativa (`./`)**: Funciona tanto no domínio principal (`seudominio.com.br`) quanto em subdomínio (`mapas.seudominio.com.br`) ou subpasta (`seudominio.com.br/conectemapas`).
- ✅ **Code-Splitting Inteligente**: O código foi dividido em chunks modulares (`vendor-gis`, `vendor-ui`, `vendor-export`), reduzindo o tempo de carregamento inicial em mais de 70%.
- ✅ **Arquivo `.htaccess` Pré-configurado**:
  - Força HTTPS automaticamente.
  - SPA Fallback (impede erros 404 ao recarregar a página).
  - Compressão Gzip/Deflate ativa.
  - Caching agressivo de 1 ano para arquivos estáticos (`/assets/*`).
  - **Content-Security-Policy (CSP) permissivo para GIS** (Google Maps, Esri Satélite, OpenStreetMap, OpenTopoMap e Google Fonts).
- ✅ **PWA Pronto**: Arquivo `manifest.webmanifest` e metatags para que o operador possa "Instalar como Aplicativo" no desktop ou celular.
- ✅ **Salvaguarda de CORS**: Tratamento gracioso no exportador cartográfico para evitar travamentos de canvas.

---

## 2. Passo a Passo de Publicação

### Método A: Pelo Gerenciador de Arquivos do hPanel (Mais Rápido e Fácil)

1. **Gere o build de produção no seu computador**:
   No terminal do projeto, execute:
   ```bash
   npm run build
   ```
   Isso criará/atualizará a pasta `dist/` com todos os arquivos prontos.

2. **Compacte os arquivos da pasta `dist`**:
   - Abra a pasta `dist/` no seu computador.
   - Selecione **todos os arquivos e pastas de dentro dela** (`.htaccess`, `index.html`, `manifest.webmanifest`, `favicon.svg` e a pasta `assets`).
   - Clique com o botão direito e compacte em um arquivo `.zip` (ex: `conectemapas_dist.zip`).
   > ⚠️ **Atenção:** Compacte o *conteúdo* interno de `dist/`, e não a pasta `dist` em si.

3. **Acesse o painel da Hostinger (hPanel)**:
   - Faça login na sua conta Hostinger e selecione a sua hospedagem.
   - No menu lateral, acesse **Arquivos** ➔ **Gerenciador de Arquivos** (File Manager).
   - Clique em **Acessar arquivos de [Seu Domínio]**.

4. **Envie os arquivos para o servidor**:
   - Navegue até a pasta `public_html/` (se for o site principal do domínio) ou para a subpasta do seu subdomínio (ex: `public_html/conectemapas/`).
   - Clique no botão **Upload** (ícone de seta para cima no canto superior direito).
   - Selecione o arquivo `conectemapas_dist.zip`.
   - Após o upload, clique com o botão direito sobre o arquivo `.zip` e selecione **Extrair** (Extract).
   - Verifique se os arquivos (especialmente `.htaccess` e `index.html`) ficaram diretamente dentro de `public_html`.
   - Você já pode deletar o arquivo `.zip` temporário do servidor.

---

### Método B: Via FTP (FileZilla)

1. No hPanel da Hostinger, vá em **Arquivos** ➔ **Contas de FTP** para obter o host FTP, usuário e senha.
2. Conecte-se usando o FileZilla ou cliente FTP de sua preferência.
3. No painel local (esquerda), acesse a pasta `conectemapas/dist/`.
4. No painel remoto (direita), abra a pasta `public_html/`.
5. Arraste todos os itens de dentro de `dist/` para dentro de `public_html/`.
   > Certifique-se de que a opção de mostrar arquivos ocultos esteja ativada no seu cliente FTP para que o arquivo `.htaccess` seja enviado.

---

### Método C: Deploy Contínuo com Git (Node.js / Vite no hPanel)

1. No hPanel da Hostinger, conecte o repositório GitHub (`conectemapas`) na branch `main`.
2. Nas configurações de **Node.js Web App / Build Settings**:
   - **Framework / App Type**: `vite`
   - **Versão do Node.js**: `24` (ou `20`)
   - **Diretório Raiz (Root Directory)**: deixar em branco (ou `.`)
   - **Diretório de Saída (Output Directory)**: `dist`
   - **Script de Build**: `build` (executa `vite build`)
   - **Arquivo de Entrada (Entry File)**: **DEIXAR EM BRANCO / NULL** (⚠️ Não defina `index.js`, pois o Vite é um SPA estático. Se preenchido, a Hostinger tenta rodar como servidor Node e não copia os arquivos de `dist/` para a `public_html/`).
3. Com essas configurações, a cada `git push origin main` a Hostinger compila o projeto e sincroniza automaticamente `index.html`, `api.php`, `.htaccess` e `assets/` para a raiz `public_html/`.

---

### Método D: Deploy Direto via Linha de Comando (MCP / Script)

Para efetuar deploy pontual instantâneo sem passar pelo Git:
```bash
node pack.js
```
O arquivo gerado `dist_YYYYMMDD_HHMMSS.zip` pode ser publicado diretamente via ferramenta MCP `hosting_deploy-static-website` ou enviado pelo Gerenciador de Arquivos.

---

## 3. Checklist de Verificação Pós-Deploy

Após subir os arquivos, abra o site no seu navegador e valide:
- [ ] O endereço carrega automaticamente em `https://` (cadeado verde/seguro).
- [ ] As camadas de satélite (Google, Esri, OSM) carregam os blocos do mapa normalmente.
- [ ] As ferramentas de desenho (Ponto, Linha, Polígono, Medição) funcionam e os dados persistem ao recarregar a página (<kbd>F5</kbd>).
- [ ] Teste de SPA: Acesse ou recarregue a página com <kbd>Ctrl+F5</kbd> e confira se não ocorre erro 404.
- [ ] PWA: Verifique se aparece o botão "Instalar aplicativo" na barra de endereços do Chrome/Edge.

---

## 4. Dicas de Otimização no hPanel da Hostinger

Para obter a máxima velocidade de resposta no Brasil:
1. **Ativar LiteSpeed Cache**: No hPanel, vá em **Sites** ➔ selecione seu domínio e certifique-se de que o recurso **LiteSpeed** ou **Cache Automático** esteja ativado.
2. **Versão do SSL**: Verifique se o SSL gratuito da Let's Encrypt / Hostinger está ativo para o seu domínio.

---

## 5. 🛡️ Prevenção do Erro 403 Forbidden e Diagnóstico

Se em qualquer momento o site ou deploy retornar `403 Forbidden`, consulte este checklist:

1. **`entry_file` preenchido no build Node.js**:
   - No hPanel ou via API, o `entry_file` deve ser sempre **null / vazio**.
   - Se estiver com `index.js`, o sincronizador da Hostinger não copia `dist/` para `public_html/`. O servidor fica sem `index.html` e o LiteSpeed dispara 403.
2. **`DirectoryIndex` ausente no `.htaccess`**:
   - O arquivo `public/.htaccess` deve sempre conter:
     ```apache
     DirectoryIndex index.html index.php
     Options -Indexes +FollowSymLinks
     ```
3. **Sintaxe do Apache 2.4 / LiteSpeed**:
   - Proteger arquivos confidenciais usando `<IfModule mod_authz_core.c> Require all denied </IfModule>`, nunca apenas `Order allow,deny`.
4. **Nunca colocar arquivos compilados em `public/`**:
   - A pasta `public/` deve conter apenas `api.php`, `.htaccess`, `manifest.webmanifest`, `favicon.svg` e `db_config.example.php`.
   - Arquivos `index.html` ou `assets/` dentro de `public/` colidem com o Vite e geram hashes quebrados.
5. **Fallback do Banco em Nuvem**:
   - `api.php` possui fallback automático para variáveis de ambiente e banco padrão da Hostinger caso o arquivo local `db_config.php` (ignorado no Git) não esteja presente no servidor.

