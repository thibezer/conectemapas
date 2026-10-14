# ConecteMapas — instruções para o Claude

Regras de arquitetura e salvaguardas contra regressões estão em `GEMINI.md`; siga-as também.

## Deploy e push

- O projeto está hospedado na Hostinger e **um push para a `main` dispara o deploy automático** em produção.
- Quando uma mudança significativa estiver pronta, ou tudo já estiver corrigido e verificado (testes passando, sintaxe checada), **faça o commit e o push para a `main` sem perguntar**.
- Antes de cada push:
  - rode `npm test` e só envie se passar;
  - inclua no commit apenas as mudanças da tarefa atual: trabalho em andamento de outras frentes (arquivos modificados ou não rastreados que não são seus) fica de fora;
  - nunca envie `public/db_config.php`, `.env*` nem senhas ou tokens.
- Não faça push de código quebrado, pela metade ou não verificado, nem de mudança experimental. Nesses casos, avise o usuário em vez de enviar.
- Depois do push, diga em uma linha que o deploy foi disparado. Mudanças em `public/api.php` também seguem esse deploy.
- `git push --force`, reescrita de histórico e deleção de branches continuam exigindo confirmação.
