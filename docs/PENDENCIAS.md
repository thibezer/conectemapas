# Pendências do ConecteMapas

Problemas conhecidos que ainda não foram corrigidos.

## Layout de Impressão

### Painel lateral: itens menores da revisão de 23/10/2026

- **Cor de preenchimento da forma** é texto livre e vai ao `style` (tela e exportação) sem validação; a cor da borda usa o seletor de cor.
- **Seções abertas/fechadas** são guardadas pelo índice em `updatePropertiesPanel`; quando a seção do item aparece ou some, outra seção pode abrir ou fechar.
- **Estilos inline** em quase todo o `PrintPropertiesPanel` (contra a regra de `.css` próprio do `GEMINI.md`).
- **Itens antigos acima de tudo:** pranchas salvas antes da ordem de empilhamento por lista podem ter uma moldura (`shape`) no fim da lista, cobrindo os demais elementos; "Trás" resolve.
