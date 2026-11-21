# ConecteMapas — instruções para o Claude

Regras de arquitetura e salvaguardas contra regressões estão em `GEMINI.md`; siga-as também.

## Princípio mestre: os componentes são a base de tudo

> **OS COMPONENTES SÃO A BASE SÓLIDA DE TUDO. Os programas são só o subproduto, assim como o queijo é subproduto do leite.**

O ConecteMapas é um consumidor do kit `@thibezer/ui-components-kit` (fonte em `D:\Programação\UI_Componentes`, regras próprias no `AGENTS.md` de lá). Esta regra também está no `CLAUDE.md` global e vale para todos os projetos.
- Recurso reutilizável (desenho, formas, edição de vértices, snap, tabelas, painéis, canvas...) pertence ao **kit**, não ao app. Antes de escrever lógica própria aqui, **leia o código e a documentação do kit** (`src/`, `docs/`, `AGENTS.md`, testes). Nunca conclua "o kit não tem" sem essa leitura.
- Faltou algo? Corrija ou crie **no kit** (ou um componente novo, se for um domínio novo) e o app só consome. Nada de contornar, duplicar ou remendar no app: a correção tem de chegar a todos os projetos.
- No app fica só o específico do produto: dados, regras de negócio e a cola com o componente (`CanvasMapEngine`, `PrintComposer`...).
- Ao propor soluções, a que fortalece o kit é a recomendada. Mudança no kit: sem commit nem publicação no npm sem o usuário pedir; depois o app atualiza a versão (`npm run update:kit`, ver `docs/ATUALIZAR_UI_KIT.md`).

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
