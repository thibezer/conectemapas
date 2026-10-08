/* ==========================================================================
   Alvo dos testes de integração com a nuvem (opt-in).
   Esses testes ESCREVEM no backend (renomeiam projeto/camada, criam e apagam feições),
   por isso NUNCA apontam para a produção: precisam de um backend de testes explícito.

     CM_TEST_API_URL=http://localhost:8080/api.php npm test

   Sem a variável, cada teste se pula com exit 0 e nada de rede é feito.
   ========================================================================== */

const PRODUCTION_HOSTS = ['hostingersite.com', 'hstgr.io'];

export function requireTestApiUrl() {
  const url = (process.env.CM_TEST_API_URL || '').trim();
  if (!url) {
    console.log('⏭  Pulado: teste de integração com backend. Defina CM_TEST_API_URL com um backend de TESTES.');
    process.exit(0);
  }
  if (PRODUCTION_HOSTS.some(h => url.includes(h))) {
    console.error(`⛔ Recusado: CM_TEST_API_URL aponta para produção (${url}). Use um backend de testes separado.`);
    process.exit(1);
  }
  return url;
}
