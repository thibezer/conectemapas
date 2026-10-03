import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Iniciando Execução da Suíte Completa de Testes ConecteMapas...\n');

const testDir = __dirname;
const allFiles = fs.readdirSync(testDir)
  .filter(f => f.startsWith('test_') && f.endsWith('.js'))
  .sort();

let passed = 0;
let failed = 0;
const results = [];
const startTimeTotal = Date.now();

for (const file of allFiles) {
  const filePath = path.join(testDir, file);
  const start = Date.now();
  process.stdout.write(`▶ Executando ${file}... `);

  try {
    execSync(`node "${filePath}"`, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
      timeout: 30000
    });
    const elapsed = Date.now() - start;
    passed++;
    results.push({ file, status: 'PASS', elapsed });
    console.log(`\x1b[32m✔ PASS\x1b[0m (${elapsed}ms)`);
  } catch (err) {
    const elapsed = Date.now() - start;
    failed++;
    const stdout = err.stdout ? err.stdout.toString() : '';
    const stderr = err.stderr ? err.stderr.toString() : (err.message || '');
    results.push({ file, status: 'FAIL', elapsed, error: stderr || stdout });
    console.log(`\x1b[31m✖ FAIL\x1b[0m (${elapsed}ms)`);
    if (stdout) console.log(`  \x1b[90m[stdout]:\x1b[0m ${stdout.trim().slice(0, 300)}`);
    if (stderr) console.log(`  \x1b[31m[stderr]:\x1b[0m ${stderr.trim().slice(0, 300)}`);
  }
}

const totalElapsed = ((Date.now() - startTimeTotal) / 1000).toFixed(2);

console.log('\n======================================================');
console.log(`📊 Relatório Final: ${passed} passaram, ${failed} falharam (Total: ${allFiles.length}) em ${totalElapsed}s`);
console.log('======================================================');

if (failed > 0) {
  console.error(`\n❌ Falha na suíte: ${failed} teste(s) quebraram.`);
  process.exit(1);
} else {
  console.log('\n🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
  process.exit(0);
}
