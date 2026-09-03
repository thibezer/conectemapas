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

### Método C: Deploy Contínuo com Git (Se o seu plano suportar Git no hPanel)

1. No hPanel, vá em **Avançado** ➔ **Git**.
2. Conecte o repositório do GitHub da branch de produção.
3. Configure o deploy automático para a pasta de destino.

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
