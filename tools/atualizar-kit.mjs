#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', encoding: 'utf-8', ...opts });
}

function runCapture(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'], ...opts })?.trim();
  } catch {
    return '';
  }
}

const skipPush = process.argv.includes('--skip-push') || process.argv.includes('-SkipPush');

console.log('\n🔍 [1/5] Verificando repositório de origem em UI_Componentes...');
const uiPath = resolve('D:/Programação/UI_Componentes');
if (existsSync(uiPath)) {
  try {
    const currentBranch = runCapture('git rev-parse --abbrev-ref HEAD', { cwd: uiPath });
    const unpushed = runCapture('git log @{u}..HEAD --oneline', { cwd: uiPath });
    if (unpushed && currentBranch) {
      console.log(`🚀 Enviando commits pendentes da branch '${currentBranch}' em UI_Componentes...`);
      run(`git push origin ${currentBranch}`, { cwd: uiPath });
    } else {
      console.log(`✔ UI_Componentes (${currentBranch || 'HEAD'}) está sincronizado com o remote.`);
    }
  } catch (err) {
    console.warn(`⚠️ Não foi possível sincronizar UI_Componentes: ${err.message}`);
  }
}

console.log('📦 [2/5] Consultando versão mais recente no npm...');
const latestVer = runCapture('npm view @thibezer/ui-components-kit version');
const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const installedVer = (pkg.dependencies?.['@thibezer/ui-components-kit'] || '').replace('^', '').trim();

console.log(`   Instalada: ${installedVer || 'N/A'} | No NPM: ${latestVer}`);

if (!latestVer) {
  console.error('❌ Não foi possível obter a versão no npm.');
  process.exit(1);
}

console.log(`📥 [3/5] Instalando @thibezer/ui-components-kit@${latestVer}...`);
run(`npm install @thibezer/ui-components-kit@${latestVer}`);

console.log('🧪 [4/5] Executando suíte de testes...');
try {
  run('npm test');
} catch (err) {
  console.error('❌ Falha nos testes após atualizar o kit! Abortando commit.');
  process.exit(1);
}

console.log('🏗️ [4/5] Validando compilação (build)...');
try {
  run('npm run build');
} catch (err) {
  console.error('❌ Falha no build após atualizar o kit! Abortando commit.');
  process.exit(1);
}

console.log('💾 [5/5] Verificando alterações de dependências...');
const status = runCapture('git status --porcelain package.json package-lock.json');
if (status) {
  run('git add package.json package-lock.json');
  const commitMsg = `chore(deps): atualiza @thibezer/ui-components-kit para v${latestVer}`;
  run(`git commit -m "${commitMsg}"`);

  if (!skipPush) {
    console.log('🚀 Enviando para o GitHub (origin/main)...');
    run('git push origin main');
    console.log(`🎉 Atualizado com sucesso para v${latestVer} e enviado ao Git!\n`);
  } else {
    console.log(`✔ Commit criado localmente (${commitMsg}). Push ignorado (--skip-push).\n`);
  }
} else {
  console.log(`✔ O kit já está na versão mais recente (${latestVer}) e o repositório está limpo.\n`);
}
