# Pendências do ConecteMapas

Problemas conhecidos que ainda não foram corrigidos.

## Layout de Impressão

### Erro `_leaflet_pos` ao recriar os mapas da prancha

- **Onde:** `PrintComposerModal.mountLeafletMaps`, função `updateGridAndScale` (`src/components/PrintComposer/PrintComposerModal.js`).
- **Sintoma:** `Uncaught TypeError: Cannot read properties of undefined (reading '_leaflet_pos')` no console, vindo de `map.getCenter()`.
- **Como reproduzir:** recriar os mapas em sequência rápida, por exemplo inserir dois elementos seguidos em menos de 150 ms ou trocar de prancha logo depois de inserir.
- **Causa:** `renderAllItems` chama `destroyLeafletMaps` (`map.remove()`), mas o `setTimeout(updateGridAndScale, 150)` agendado para o mapa anterior ainda dispara sobre o mapa removido.
- **Correção sugerida:** no início de `updateGridAndScale`, sair se `this.leafletMaps.get(item.id) !== map` (o mapa já foi substituído ou removido). Também guardar e limpar o timeout em `destroyLeafletMaps`.
- **Registrado em:** 23/10/2026, durante o redesenho da barra do layout de impressão.
