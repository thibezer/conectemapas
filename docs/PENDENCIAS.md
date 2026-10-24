# Pendências do ConecteMapas

Problemas conhecidos que ainda não foram corrigidos.

## Layout de Impressão

### Painel lateral: itens restantes da revisão de 23/10/2026

- **Frente/Trás quase sem efeito:** o `z-index` fixo por tipo em `PrintComposer.css` (mapa 2, forma 5, demais 10–12) prevalece sobre a ordem de `composer.items`.
- **Logotipo grande para o salvamento sem aviso:** a imagem vai inteira (data URL) para o localStorage; quando a cota estoura, `PrintSheetsManager.saveToStorage` só registra no console.
- **Barra de escala e legenda** não têm propriedades no painel.
- **Tamanho mínimo diferente:** 10 mm digitando no painel, 15 mm arrastando as alças; o campo não impede o item de sair da folha.
- **Menores:** cor de preenchimento da forma é texto livre (vai ao `style` sem sanitização); o estado aberto/fechado das seções é guardado pelo índice; estilos quase todos inline.
