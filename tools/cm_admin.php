<?php
/**
 * ConecteMapas - Administração por linha de comando (somente CLI).
 *
 *   php tools/cm_admin.php create-user  <email> "<Nome>" [senha]
 *   php tools/cm_admin.php reset-password <email> [nova-senha]   (reset forçado; derruba as sessões)
 *   php tools/cm_admin.php block|unblock <email>
 *   php tools/cm_admin.php make-owner <email> <projectId>        (vincula a conta como dona do projeto)
 *   php tools/cm_admin.php list-users
 *
 * Sem senha informada, uma senha aleatória é gerada e mostrada UMA vez.
 * Conexão: public/db_config.php (ou --config=/caminho/db_config.php, ou variáveis DB_*).
 * As tabelas são criadas pela própria API na primeira requisição (abra o site uma vez antes).
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$args = array_slice($argv, 1);
$configPath = __DIR__ . '/../public/db_config.php';
foreach ($args as $i => $a) {
    if (strpos($a, '--config=') === 0) {
        $configPath = substr($a, 9);
        unset($args[$i]);
    }
}
$args = array_values($args);
$cmd = $args[0] ?? '';

function fail($msg) {
    fwrite(STDERR, "Erro: $msg\n");
    exit(1);
}

if (is_file($configPath)) {
    $config = require $configPath;
} elseif (getenv('DB_NAME')) {
    $config = [
        'driver' => getenv('DB_DRIVER') ?: 'mysql', 'host' => getenv('DB_HOST') ?: 'localhost',
        'port' => (int)(getenv('DB_PORT') ?: 3306), 'database' => getenv('DB_NAME'),
        'username' => getenv('DB_USER'), 'password' => getenv('DB_PASS'), 'charset' => 'utf8mb4', 'options' => []
    ];
} else {
    fail("db_config.php não encontrado em $configPath (use --config= ou defina DB_*).");
}

$pdo = new PDO(
    sprintf('%s:host=%s;port=%d;dbname=%s;charset=%s', $config['driver'], $config['host'], $config['port'], $config['database'], $config['charset']),
    $config['username'], $config['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);

try {
    $pdo->query('SELECT 1 FROM cm_users LIMIT 1');
} catch (PDOException $e) {
    fail('Tabelas ainda não existem: abra o site (ou chame api.php?action=status) uma vez para a API criá-las.');
}

function emailArg($raw) {
    $email = strtolower(trim((string)$raw));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('E-mail inválido.');
    return $email;
}

function passwordOrGenerate($given) {
    if ($given !== null && $given !== '') {
        if (strlen($given) < 8 || strlen($given) > 72 || !preg_match('/[A-Za-z]/', $given) || !preg_match('/[0-9]/', $given)) {
            fail('A senha precisa ter de 8 a 72 caracteres, com letras e números.');
        }
        return [$given, false];
    }
    return [substr(bin2hex(random_bytes(8)), 0, 6) . 'Ab' . random_int(10, 99) . substr(bin2hex(random_bytes(4)), 0, 4), true];
}

function hashPassword($plain) {
    return password_hash($plain, PASSWORD_BCRYPT, ['cost' => 12]);
}

function findUser(PDO $pdo, $email) {
    $stmt = $pdo->prepare('SELECT id, name, email, is_blocked FROM cm_users WHERE email = ?');
    $stmt->execute([$email]);
    $u = $stmt->fetch();
    if (!$u) fail("Usuário $email não encontrado.");
    return $u;
}

switch ($cmd) {
    case 'create-user':
        $email = emailArg($args[1] ?? '');
        $name = trim((string)($args[2] ?? ''));
        if ($name === '') fail('Informe o nome.');
        [$plain, $generated] = passwordOrGenerate($args[3] ?? null);
        try {
            $pdo->prepare('INSERT INTO cm_users (name, email, password_hash) VALUES (?, ?, ?)')->execute([$name, $email, hashPassword($plain)]);
        } catch (PDOException $e) {
            fail('Já existe conta com esse e-mail.');
        }
        echo "Conta criada: $email\n";
        if ($generated) echo "Senha gerada (anote, não será mostrada de novo): $plain\n";
        break;

    case 'reset-password':
        $u = findUser($pdo, emailArg($args[1] ?? ''));
        [$plain, $generated] = passwordOrGenerate($args[2] ?? null);
        $pdo->prepare('UPDATE cm_users SET password_hash = ? WHERE id = ?')->execute([hashPassword($plain), $u['id']]);
        $pdo->prepare('DELETE FROM cm_sessions WHERE user_id = ?')->execute([$u['id']]);
        echo "Senha redefinida e sessões encerradas para {$u['email']}.\n";
        if ($generated) echo "Nova senha (anote, não será mostrada de novo): $plain\n";
        break;

    case 'block':
    case 'unblock':
        $u = findUser($pdo, emailArg($args[1] ?? ''));
        $pdo->prepare('UPDATE cm_users SET is_blocked = ? WHERE id = ?')->execute([$cmd === 'block' ? 1 : 0, $u['id']]);
        if ($cmd === 'block') $pdo->prepare('DELETE FROM cm_sessions WHERE user_id = ?')->execute([$u['id']]);
        echo ($cmd === 'block' ? 'Bloqueada: ' : 'Desbloqueada: ') . $u['email'] . "\n";
        break;

    case 'make-owner':
        $u = findUser($pdo, emailArg($args[1] ?? ''));
        $projectId = preg_replace('/[^a-zA-Z0-9_\-]/', '', (string)($args[2] ?? ''));
        if ($projectId === '') fail('Informe o projectId.');
        $pdo->prepare('INSERT IGNORE INTO cm_projects (id) VALUES (?)')->execute([$projectId]);
        $pdo->prepare("INSERT INTO cm_members (project_id, user_id, role) VALUES (?, ?, 'owner') ON DUPLICATE KEY UPDATE role = 'owner'")->execute([$projectId, $u['id']]);
        echo "{$u['email']} agora é dono de $projectId (o projeto passa a exigir login ou link de acesso).\n";
        break;

    case 'list-users':
        foreach ($pdo->query('SELECT name, email, is_blocked, last_login_at FROM cm_users ORDER BY id') as $r) {
            printf("%-30s %-32s %s  último login: %s\n", $r['name'], $r['email'], $r['is_blocked'] ? '[BLOQUEADA]' : '[ativa]    ', $r['last_login_at'] ?: '—');
        }
        break;

    default:
        fwrite(STDERR, "Comandos: create-user | reset-password | block | unblock | make-owner | list-users\n");
        exit(1);
}
