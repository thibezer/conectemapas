<?php
/**
 * ConecteMapas - Backend REST API (Hostinger LiteSpeed / Apache)
 * Sincronização Relacional em Nuvem com MySQL (u941736878_conectemapas)
 */

define('CONECTEMAPAS_API', true);

// 1. Compressão HTTP GZIP e Headers
if (!ob_start('ob_gzhandler')) {
    ob_start();
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Project-Key, X-Auth-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// 2. Conexão PDO Singleton
function getDatabaseConnection() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $configFile = __DIR__ . '/db_config.php';
    if (file_exists($configFile)) {
        $config = require $configFile;
    } else {
        $config = [
            'driver'   => getenv('DB_DRIVER')   ?: 'mysql',
            'host'     => getenv('DB_HOST')     ?: 'localhost',
            'port'     => (int)(getenv('DB_PORT') ?: 3306),
            'database' => getenv('DB_NAME')     ?: 'u941736878_conectemapas',
            'username' => getenv('DB_USER')     ?: 'u941736878_conectemapas',
            'password' => getenv('DB_PASS')     ?: 'Conecte#Mapas2026$Db',
            'charset'  => 'utf8mb4',
            'options'  => [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
            ]
        ];
    }
    $dsn = sprintf(
        '%s:host=%s;port=%d;dbname=%s;charset=%s',
        $config['driver'],
        $config['host'],
        $config['port'],
        $config['database'],
        $config['charset']
    );

    try {
        $pdo = new PDO($dsn, $config['username'], $config['password'], $config['options']);
        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Falha ao conectar no MySQL da Hostinger',
            'detail' => $e->getMessage()
        ]);
        exit;
    }
}

// 3. Auto-Migração do Esquema Relacional (DDL Idempotente)
// A versão do esquema fica gravada em disco para que as requisições de alta frequência
// (pull_changes a cada ~1s por operador) não executem DDL/SHOW COLUMNS a cada chamada.
define('CM_SCHEMA_VERSION', 5);
define('CM_SCHEMA_MARKER', __DIR__ . '/.cm_schema_version');

function columnExists(PDO $pdo, $table, $column) {
    $stmt = $pdo->query("SHOW COLUMNS FROM `$table` LIKE " . $pdo->quote($column));
    return !empty($stmt->fetchAll());
}

function ensureDatabaseSchema(PDO $pdo) {
    static $schemaChecked = false;
    if ($schemaChecked) return;

    $marker = @file_get_contents(CM_SCHEMA_MARKER);
    if ($marker !== false && (int)$marker >= CM_SCHEMA_VERSION) {
        $schemaChecked = true;
        return;
    }

    $queries = [
        // Tabela de Projetos
        "CREATE TABLE IF NOT EXISTS cm_projects (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255) NOT NULL DEFAULT 'Levantamento Topográfico - Umuarama',
            description TEXT,
            basemap VARCHAR(64) DEFAULT 'google_satelite_puro',
            center_lat DOUBLE DEFAULT -23.7661,
            center_lng DOUBLE DEFAULT -53.3206,
            zoom INT DEFAULT 14,
            feature_count INT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;",

        // Tabela de Camadas
        "CREATE TABLE IF NOT EXISTS cm_layers (
            id VARCHAR(64) PRIMARY KEY,
            project_id VARCHAR(64) NOT NULL,
            name VARCHAR(128) NOT NULL,
            color VARCHAR(32) DEFAULT '#00E08A',
            type VARCHAR(32) DEFAULT 'custom',
            visible TINYINT(1) DEFAULT 1,
            opacity FLOAT DEFAULT 1.0,
            order_idx INT DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_layers_project (project_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;",

        // Tabela de Feições Geodésicas com Suporte a Tombstone (Soft-Delete)
        "CREATE TABLE IF NOT EXISTS cm_features (
            id VARCHAR(64) PRIMARY KEY,
            project_id VARCHAR(64) NOT NULL,
            layer_id VARCHAR(64) NOT NULL,
            name VARCHAR(255) NOT NULL,
            geom_type VARCHAR(32) NOT NULL,
            coordinates LONGTEXT NOT NULL,
            properties LONGTEXT,
            style LONGTEXT,
            color VARCHAR(32) DEFAULT '#00E08A',
            created_by VARCHAR(128) DEFAULT 'Operador',
            deleted TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_features_project_layer (project_id, layer_id),
            INDEX idx_features_deleted (project_id, deleted, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;",

        // Tabela de Auditoria
        "CREATE TABLE IF NOT EXISTS cm_audit (
            id VARCHAR(64) PRIMARY KEY,
            project_id VARCHAR(64) NOT NULL,
            action VARCHAR(255) NOT NULL,
            detail TEXT,
            user_name VARCHAR(128) DEFAULT 'Você',
            timestamp VARCHAR(64) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_audit_project (project_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
    ];

    foreach ($queries as $sql) {
        $pdo->exec($sql);
    }

    // Auto-migração retrocompatível: garante coluna 'deleted' e índices de concorrência
    try {
        $cols = $pdo->query("SHOW COLUMNS FROM cm_features LIKE 'deleted'")->fetchAll();
        if (empty($cols)) {
            $pdo->exec("ALTER TABLE cm_features ADD COLUMN deleted TINYINT(1) NOT NULL DEFAULT 0;");
            $pdo->exec("ALTER TABLE cm_features ADD INDEX idx_features_deleted (project_id, deleted, updated_at);");
        }
    } catch (Exception $e) {
        // Ignora caso índice ou coluna já existam
    }

    // v3: Revisão monotônica por projeto (cursor de sincronização sem dependência de relógio)
    // Cada escrita incrementa cm_projects.rev dentro da transação; as linhas gravadas recebem essa
    // revisão. O pull busca "rev > cursor", imune a empates de segundo, fuso horário PHP x MySQL e LIMIT.
    try {
        if (!columnExists($pdo, 'cm_projects', 'rev')) {
            $pdo->exec("ALTER TABLE cm_projects ADD COLUMN rev BIGINT NOT NULL DEFAULT 0;");
        }
        if (!columnExists($pdo, 'cm_features', 'rev')) {
            $pdo->exec("ALTER TABLE cm_features ADD COLUMN rev BIGINT NOT NULL DEFAULT 0, ADD COLUMN client_id VARCHAR(64) NULL;");
            $pdo->exec("ALTER TABLE cm_features ADD INDEX idx_features_rev (project_id, rev, id);");
            // Linhas legadas entram na revisão 1 (preserva updated_at para clientes antigos)
            $pdo->exec("UPDATE cm_features SET rev = 1, updated_at = updated_at WHERE rev = 0;");
        }
        if (!columnExists($pdo, 'cm_layers', 'rev')) {
            $pdo->exec("ALTER TABLE cm_layers ADD COLUMN rev BIGINT NOT NULL DEFAULT 0, ADD COLUMN client_id VARCHAR(64) NULL;");
            $pdo->exec("ALTER TABLE cm_layers ADD INDEX idx_layers_rev (project_id, rev);");
            $pdo->exec("UPDATE cm_layers SET rev = 1, updated_at = updated_at WHERE rev = 0;");
        }
        $pdo->exec("UPDATE cm_projects SET rev = 1, updated_at = updated_at WHERE rev = 0;");

        // Presença ao vivo (cursores e avatares entre dispositivos diferentes)
        $pdo->exec("CREATE TABLE IF NOT EXISTS cm_presence (
            project_id VARCHAR(64) NOT NULL,
            client_id VARCHAR(64) NOT NULL,
            user_name VARCHAR(128) NOT NULL DEFAULT 'Colaborador',
            color VARCHAR(32) DEFAULT '#00E08A',
            lat DOUBLE NULL,
            lng DOUBLE NULL,
            last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (project_id, client_id),
            INDEX idx_presence_seen (project_id, last_seen)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        // v4: Controle de acesso por chave (capability links). Só o hash SHA-256 da chave é guardado.
        // Projeto sem nenhuma linha aqui é "aberto" (legado); a primeira linha (owner) o protege.
        $pdo->exec("CREATE TABLE IF NOT EXISTS cm_access (
            id VARCHAR(32) PRIMARY KEY,
            project_id VARCHAR(64) NOT NULL,
            role VARCHAR(16) NOT NULL,
            key_hash CHAR(64) NOT NULL,
            label VARCHAR(128) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            revoked_at DATETIME NULL,
            UNIQUE KEY uq_access_key (key_hash),
            INDEX idx_access_project (project_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        // v5: Contas de usuário (login). Cadastro SOMENTE por convite de um dono de projeto;
        // a primeira conta e o reset forçado de senha são feitos por tools/cm_admin.php (CLI).
        $pdo->exec("CREATE TABLE IF NOT EXISTS cm_users (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(190) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            is_blocked TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_login_at DATETIME NULL,
            UNIQUE KEY uq_users_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
        $pdo->exec("CREATE TABLE IF NOT EXISTS cm_sessions (
            token_hash CHAR(64) NOT NULL PRIMARY KEY,
            user_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            INDEX idx_sessions_user (user_id),
            INDEX idx_sessions_expires (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
        $pdo->exec("CREATE TABLE IF NOT EXISTS cm_members (
            project_id VARCHAR(64) NOT NULL,
            user_id INT NOT NULL,
            role VARCHAR(16) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (project_id, user_id),
            INDEX idx_members_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
        $pdo->exec("CREATE TABLE IF NOT EXISTS cm_invites (
            id VARCHAR(32) NOT NULL PRIMARY KEY,
            project_id VARCHAR(64) NOT NULL,
            role VARCHAR(16) NOT NULL,
            email VARCHAR(190) NULL,
            code_hash CHAR(64) NOT NULL,
            created_by INT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            used_at DATETIME NULL,
            UNIQUE KEY uq_invite_code (code_hash),
            INDEX idx_invites_project (project_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
        $pdo->exec("CREATE TABLE IF NOT EXISTS cm_auth_attempts (
            id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            ip VARCHAR(45) NOT NULL,
            subject_hash CHAR(64) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_attempts (ip, subject_hash, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
        if (!columnExists($pdo, 'cm_presence', 'role')) {
            $pdo->exec("ALTER TABLE cm_presence ADD COLUMN role VARCHAR(16) NULL;");
        }
    } catch (Exception $e) {
        // Mantém a API operante; a migração será tentada novamente na próxima requisição
        return;
    }

    @file_put_contents(CM_SCHEMA_MARKER, (string)CM_SCHEMA_VERSION);
    $schemaChecked = true;
}

/**
 * Reserva a próxima revisão do projeto. Deve ser chamada DENTRO de uma transação:
 * o UPDATE trava a linha do projeto até o commit, então as revisões ficam visíveis
 * na mesma ordem em que são atribuídas (nenhum leitor vê rev N+1 sem ver rev N).
 */
function nextRevision(PDO $pdo, $projectId) {
    $pdo->prepare("INSERT IGNORE INTO cm_projects (id) VALUES (?)")->execute([$projectId]);
    $pdo->prepare("UPDATE cm_projects SET rev = rev + 1 WHERE id = ?")->execute([$projectId]);
    $stmt = $pdo->prepare("SELECT rev FROM cm_projects WHERE id = ?");
    $stmt->execute([$projectId]);
    return (int)$stmt->fetchColumn();
}

function sanitizeClientId($raw) {
    $clean = preg_replace('/[^a-zA-Z0-9_\-]/', '', (string)$raw);
    return $clean !== '' ? substr($clean, 0, 64) : null;
}

function decodeFeatureRow(array $f) {
    $coords = json_decode($f['coordinates'], true);
    $props = !empty($f['properties']) ? json_decode($f['properties'], true) : [];
    $style = !empty($f['style']) ? json_decode($f['style'], true) : [];
    if (!is_array($coords)) $coords = [];
    if (!is_array($props)) $props = [];
    if (!is_array($style)) $style = [];
    $radius = isset($props['radius']) ? (float)$props['radius'] : (isset($props['raio']) ? (float)$props['raio'] : null);
    $visible = isset($props['visible']) ? (bool)$props['visible'] : true;
    return [
        'id'          => $f['id'],
        'layerId'     => $f['layerId'],
        'name'        => $f['name'],
        'type'        => $f['type'],
        'coordinates' => $coords,
        'properties'  => $props,
        'style'       => $style,
        'color'       => $f['color'],
        'radius'      => $radius,
        'visible'     => $visible,
        'createdBy'   => $f['createdBy'],
        'updatedAt'   => $f['updatedAt']
    ];
}

/**
 * Grava somente as camadas alteradas, atribuindo-lhes uma nova revisão (dentro da transação ativa).
 */
function upsertChangedLayers(PDO $pdo, $projectId, array $layers, $clientId, $rev = null) {
    $stmtCheck = $pdo->prepare("SELECT project_id, name, color, type, visible, opacity, order_idx FROM cm_layers WHERE id = ?");
    $stmtUpdate = $pdo->prepare("
        UPDATE cm_layers
        SET project_id = ?, name = ?, color = ?, type = ?, visible = ?, opacity = ?, order_idx = ?, rev = ?, client_id = ?, updated_at = NOW()
        WHERE id = ?
    ");
    $stmtInsert = $pdo->prepare("
        INSERT INTO cm_layers (id, project_id, name, color, type, visible, opacity, order_idx, rev, client_id, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ");

    foreach ($layers as $idx => $layer) {
        if (empty($layer['id'])) continue;
        $lid = $layer['id'];
        $stmtOwner = $pdo->prepare("SELECT project_id FROM cm_layers WHERE id = ?");
        $stmtOwner->execute([$lid]);
        $ownerProject = $stmtOwner->fetchColumn();
        // Isolamento: id de camada de OUTRO projeto nunca é sobrescrito/sequestrado
        if ($ownerProject !== false && $ownerProject !== $projectId) continue;
        $lname = $layer['name'] ?? 'Camada';
        $lcolor = $layer['color'] ?? '#00E08A';
        $ltype = $layer['type'] ?? 'custom';
        $lvis = isset($layer['visible']) && !$layer['visible'] ? 0 : 1;
        $lopac = isset($layer['opacity']) ? (float)$layer['opacity'] : 1.0;
        $lord = (int)($layer['order'] ?? $idx);

        $stmtCheck->execute([$lid]);
        $existing = $stmtCheck->fetch();
        if ($existing) {
            $unchanged = $existing['project_id'] === $projectId
                && $existing['name'] === $lname
                && $existing['color'] === $lcolor
                && $existing['type'] === $ltype
                && (int)$existing['visible'] === $lvis
                && abs((float)$existing['opacity'] - $lopac) < 0.0001
                && (int)$existing['order_idx'] === $lord;
            if ($unchanged) continue;
            if ($rev === null) $rev = nextRevision($pdo, $projectId);
            $stmtUpdate->execute([$projectId, $lname, $lcolor, $ltype, $lvis, $lopac, $lord, $rev, $clientId, $lid]);
        } else {
            if ($rev === null) $rev = nextRevision($pdo, $projectId);
            $stmtInsert->execute([$lid, $projectId, $lname, $lcolor, $ltype, $lvis, $lopac, $lord, $rev, $clientId]);
        }
    }
    return $rev;
}

function prepareFeatureUpsert(PDO $pdo) {
    return $pdo->prepare("
        INSERT INTO cm_features (id, project_id, layer_id, name, geom_type, coordinates, properties, style, color, created_by, deleted, rev, client_id, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
            layer_id = ?,
            name = ?,
            geom_type = ?,
            coordinates = ?,
            properties = ?,
            style = ?,
            color = ?,
            deleted = 0,
            rev = ?,
            client_id = ?,
            updated_at = NOW()
    ");
}

function executeFeatureUpsert(PDOStatement $stmt, array $feat, $projectId, $rev, $clientId) {
    $props = !empty($feat['properties']) ? (is_array($feat['properties']) ? $feat['properties'] : json_decode($feat['properties'], true)) : [];
    if (!is_array($props)) $props = [];
    if (!empty($feat['radius'])) {
        $props['radius'] = (float)$feat['radius'];
    }
    if (isset($feat['visible'])) {
        $props['visible'] = (bool)$feat['visible'];
    }

    $layerId   = $feat['layerId'] ?? 'layer-default';
    $name      = $feat['name'] ?? 'Feição';
    $type      = $feat['type'] ?? 'Polygon';
    $coords    = json_encode($feat['coordinates'] ?? [], JSON_UNESCAPED_UNICODE);
    $propsJson = json_encode($props, JSON_UNESCAPED_UNICODE);
    $style     = json_encode($feat['style'] ?? [], JSON_UNESCAPED_UNICODE);
    $color     = $feat['color'] ?? '#00E08A';
    $createdBy = $feat['createdBy'] ?? 'Operador';

    return $stmt->execute([
        // INSERT
        $feat['id'], $projectId, $layerId, $name, $type, $coords, $propsJson, $style, $color, $createdBy, $rev, $clientId,
        // ON DUPLICATE KEY UPDATE (parâmetros posicionais: compatibilidade MariaDB 11.8)
        $layerId, $name, $type, $coords, $propsJson, $style, $color, $rev, $clientId
    ]);
}

// 3.1 Controle de acesso (papéis: viewer < editor < owner)
// Chave enviada no header X-Project-Key. Projeto sem registros em cm_access é "aberto" (legado):
// qualquer um age como editor até que alguém o reivindique (claim_project) e vire dono.
function roleRank($role) {
    $ranks = ['viewer' => 1, 'editor' => 2, 'owner' => 3];
    return $ranks[$role] ?? 0;
}

function cleanProjectId($raw) {
    $clean = preg_replace('/[^a-zA-Z0-9_\-]/', '', (string)$raw);
    return $clean !== '' ? $clean : 'projeto_padrao';
}

function requestAccessKey() {
    $key = $_SERVER['HTTP_X_PROJECT_KEY'] ?? '';
    return preg_match('/^cmk_[a-f0-9]{32}$/', $key) ? $key : '';
}

function isProjectProtected(PDO $pdo, $projectId) {
    $stmt = $pdo->prepare("SELECT 1 FROM cm_access WHERE project_id = ? UNION SELECT 1 FROM cm_members WHERE project_id = ? LIMIT 1");
    $stmt->execute([$projectId, $projectId]);
    return (bool)$stmt->fetchColumn();
}

// --- Contas e sessões (token opaco de 256 bits; só o hash SHA-256 fica no banco) ---
function requestAuthToken() {
    $token = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';
    return preg_match('/^cms_[a-f0-9]{64}$/', $token) ? $token : '';
}

/** Usuário da sessão atual ou null (conta bloqueada ou sessão expirada = null). */
function currentUser(PDO $pdo) {
    static $cache = false;
    if ($cache !== false) return $cache;
    $cache = null;
    $token = requestAuthToken();
    if ($token !== '') {
        $stmt = $pdo->prepare("
            SELECT u.id, u.name, u.email FROM cm_sessions s
            JOIN cm_users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > NOW() AND u.is_blocked = 0
        ");
        $stmt->execute([hash('sha256', $token)]);
        $row = $stmt->fetch();
        if ($row) $cache = ['id' => (int)$row['id'], 'name' => $row['name'], 'email' => $row['email']];
    }
    return $cache;
}

function requireUser(PDO $pdo) {
    $user = currentUser($pdo);
    if (!$user) denyAccess(401, 'login_required', 'Entre na sua conta para continuar.');
    return $user;
}

function createSession(PDO $pdo, $userId) {
    $token = 'cms_' . bin2hex(random_bytes(32));
    $pdo->prepare("INSERT INTO cm_sessions (token_hash, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL 30 DAY)")
        ->execute([hash('sha256', $token), $userId]);
    if (mt_rand(1, 50) === 1) {
        $pdo->exec("DELETE FROM cm_sessions WHERE expires_at < NOW()");
        $pdo->exec("DELETE FROM cm_auth_attempts WHERE created_at < NOW() - INTERVAL 1 DAY");
    }
    return $token;
}

function normalizeEmail($raw) {
    return strtolower(trim((string)$raw));
}

function validatePassword($password) {
    if (!is_string($password) || strlen($password) < 8 || strlen($password) > 72
        || !preg_match('/[A-Za-z]/', $password) || !preg_match('/[0-9]/', $password)) {
        denyAccess(400, 'weak_password', 'A senha precisa ter de 8 a 72 caracteres, com letras e números.');
    }
}

/** Limita tentativas por IP+assunto (15 min) e por IP (30 em 15 min). Chamar ANTES de verificar. */
function enforceAttemptLimit(PDO $pdo, $subject) {
    $ip = substr($_SERVER['REMOTE_ADDR'] ?? '0', 0, 45);
    $subjectHash = hash('sha256', $subject);
    $stmt = $pdo->prepare("SELECT COUNT(*), SUM(subject_hash = ?) FROM cm_auth_attempts WHERE ip = ? AND created_at > NOW() - INTERVAL 15 MINUTE");
    $stmt->execute([$subjectHash, $ip]);
    $row = $stmt->fetch(PDO::FETCH_NUM);
    if ((int)$row[0] >= 30 || (int)$row[1] >= 5) {
        denyAccess(429, 'too_many_attempts', 'Muitas tentativas. Aguarde alguns minutos.');
    }
    return [$ip, $subjectHash];
}

function recordFailedAttempt(PDO $pdo, array $attempt) {
    $pdo->prepare("INSERT INTO cm_auth_attempts (ip, subject_hash) VALUES (?, ?)")->execute($attempt);
}

/** @return string 'open' | 'viewer' | 'editor' | 'owner' | '' (sem acesso válido) */
function resolveRole(PDO $pdo, $projectId) {
    if (!isProjectProtected($pdo, $projectId)) return 'open';
    $best = '';

    $user = currentUser($pdo);
    if ($user) {
        $stmt = $pdo->prepare("SELECT role FROM cm_members WHERE project_id = ? AND user_id = ?");
        $stmt->execute([$projectId, $user['id']]);
        $memberRole = $stmt->fetchColumn();
        if ($memberRole !== false) $best = $memberRole;
    }

    $key = requestAccessKey();
    if ($key !== '') {
        $stmt = $pdo->prepare("SELECT role FROM cm_access WHERE project_id = ? AND key_hash = ? AND revoked_at IS NULL");
        $stmt->execute([$projectId, hash('sha256', $key)]);
        $keyRole = $stmt->fetchColumn();
        if ($keyRole !== false && roleRank($keyRole) > roleRank($best)) $best = $keyRole;
    }
    return $best;
}

function denyAccess($status, $code, $message, array $extra = []) {
    http_response_code($status);
    echo json_encode(array_merge(['error' => $message, 'code' => $code], $extra));
    exit;
}

/** Exige papel mínimo; projeto aberto equivale a editor. Devolve o papel efetivo. */
function requireRole(PDO $pdo, $projectId, $minRole) {
    $role = resolveRole($pdo, $projectId);
    if ($role === 'open') {
        if (roleRank($minRole) > roleRank('editor')) {
            denyAccess(403, 'claim_required', 'Projeto ainda sem dono: proteja-o primeiro.');
        }
        return 'editor';
    }
    if ($role === '') {
        if (currentUser($pdo)) denyAccess(403, 'not_a_member', 'Sua conta não tem acesso a este projeto.');
        $hasKey = requestAccessKey() !== '';
        denyAccess($hasKey ? 403 : 401, $hasKey ? 'invalid_key' : 'key_required', $hasKey ? 'Chave de acesso inválida ou revogada.' : 'Este projeto exige um link de acesso.');
    }
    if (roleRank($role) < roleRank($minRole)) {
        denyAccess(403, 'insufficient_role', 'Seu acesso (' . $role . ') não permite esta ação.', ['role' => $role, 'required' => $minRole]);
    }
    return $role;
}

function issueAccessKey(PDO $pdo, $projectId, $role, $label) {
    $key = 'cmk_' . bin2hex(random_bytes(16));
    $id = 'acc_' . bin2hex(random_bytes(6));
    $stmt = $pdo->prepare("INSERT INTO cm_access (id, project_id, role, key_hash, label) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$id, $projectId, $role, hash('sha256', $key), substr(trim((string)$label), 0, 128)]);
    return ['id' => $id, 'key' => $key];
}

/** Ids de feição que já pertencem a OUTRO projeto (o upsert por id não pode sobrescrevê-las). */
function foreignFeatureIds(PDO $pdo, $projectId, array $ids) {
    $foreign = [];
    foreach (array_chunk(array_values(array_unique($ids)), 500) as $chunk) {
        $ph = implode(',', array_fill(0, count($chunk), '?'));
        $stmt = $pdo->prepare("SELECT id FROM cm_features WHERE project_id <> ? AND id IN ($ph)");
        $stmt->execute(array_merge([$projectId], $chunk));
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $id) $foreign[$id] = true;
    }
    return $foreign;
}

// 4. Roteamento de Ações REST
$pdo = getDatabaseConnection();
ensureDatabaseSchema($pdo);

$action = isset($_GET['action']) ? trim($_GET['action']) : '';

// Helper para ler body JSON
function getJsonBody() {
    $raw = file_get_contents('php://input');
    if (empty($raw)) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

switch ($action) {

    // --------------------------------------------------------------------------
    // ACTION: STATUS (Diagnóstico do Banco de Dados)
    // --------------------------------------------------------------------------
    case 'status':
        $start = microtime(true);
        $stmtProjects = $pdo->query("SELECT COUNT(*) FROM cm_projects");
        $projectCount = (int)$stmtProjects->fetchColumn();

        $stmtFeatures = $pdo->query("SELECT COUNT(*) FROM cm_features WHERE deleted = 0");
        $featureCount = (int)$stmtFeatures->fetchColumn();

        $stmtLayers = $pdo->query("SELECT COUNT(*) FROM cm_layers");
        $layerCount = (int)$stmtLayers->fetchColumn();

        $latencyMs = round((microtime(true) - $start) * 1000, 2);

        echo json_encode([
            'status'        => 'connected',
            'database'      => 'u941736878_conectemapas',
            'server'        => 'srv1180.hstgr.io',
            'mysql_version' => $pdo->getAttribute(PDO::ATTR_SERVER_VERSION),
            'counts'        => [
                'projects'  => $projectCount,
                'layers'    => $layerCount,
                'features'  => $featureCount
            ],
            'latency_ms'    => $latencyMs,
            'timestamp'     => date('c')
        ]);
        exit;

    // --------------------------------------------------------------------------
    // ACTION: LIST_PROJECTS (Listar Projetos na Nuvem)
    // --------------------------------------------------------------------------
    case 'list_projects':
        // Projetos protegidos nunca são listados: só quem tem o link os alcança
        $stmt = $pdo->query("
            SELECT id, name, description, basemap, feature_count, updated_at
            FROM cm_projects
            WHERE NOT EXISTS (SELECT 1 FROM cm_access a WHERE a.project_id = cm_projects.id)
            ORDER BY updated_at DESC
        ");
        $list = $stmt->fetchAll();
        echo json_encode(['projects' => $list]);
        exit;

    case 'get_feature':
        $featId = isset($_GET['id']) ? trim($_GET['id']) : '';
        $stmtF = $pdo->prepare("SELECT * FROM cm_features WHERE id = ?");
        $stmtF->execute([$featId]);
        $featRow = $stmtF->fetch(PDO::FETCH_ASSOC);
        if ($featRow) requireRole($pdo, $featRow['project_id'], 'viewer');
        echo json_encode(['feature' => $featRow]);
        exit;

    // --------------------------------------------------------------------------
    // CONTROLE DE ACESSO
    // access_info (GET)     : papel efetivo da chave enviada (nunca falha por chave ruim)
    // claim_project (POST)  : torna o chamador dono de um projeto ainda aberto (devolve a chave 1x)
    // create_share (POST)   : dono gera chave de editor/leitor (devolvida 1x)
    // list_access (GET)     : dono lista chaves emitidas
    // revoke_access (POST)  : dono revoga uma chave (exceto a do dono)
    // --------------------------------------------------------------------------
    case 'access_info':
        $projectId = cleanProjectId($_GET['projectId'] ?? '');
        $protected = isProjectProtected($pdo, $projectId);
        $role = resolveRole($pdo, $projectId);
        echo json_encode([
            'success'   => true,
            'protected' => $protected,
            'role'      => $role === 'open' ? 'editor' : ($role !== '' ? $role : null),
            'canManage' => $role === 'owner',
            'canClaim'  => !$protected
        ]);
        exit;

    // --------------------------------------------------------------------------
    // CONTAS (login). Cadastro só com convite de dono; token em X-Auth-Token.
    // --------------------------------------------------------------------------
    case 'auth_login':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') denyAccess(405, 'bad_method', 'Método inválido');
        $body = getJsonBody();
        $email = normalizeEmail($body['email'] ?? '');
        $password = (string)($body['password'] ?? '');
        $attempt = enforceAttemptLimit($pdo, 'login:' . $email);

        $stmt = $pdo->prepare("SELECT id, name, email, password_hash, is_blocked FROM cm_users WHERE email = ?");
        $stmt->execute([$email]);
        $u = $stmt->fetch();
        // Compara sempre (hash fictício se o e-mail não existe): tempo igual, sem enumeração de contas
        $hash = $u ? $u['password_hash'] : '$2y$12$57VBjTB2DrO0dbFoU8Sz5.6yderDGBTrxyZOJexCU43BssVZF5EKK';
        $ok = password_verify($password, $hash) && $u && !(int)$u['is_blocked'];
        if (!$ok) {
            recordFailedAttempt($pdo, $attempt);
            denyAccess(401, 'bad_credentials', 'E-mail ou senha incorretos.');
        }
        $pdo->prepare("UPDATE cm_users SET last_login_at = NOW() WHERE id = ?")->execute([$u['id']]);
        echo json_encode(['success' => true, 'token' => createSession($pdo, $u['id']), 'user' => ['id' => (int)$u['id'], 'name' => $u['name'], 'email' => $u['email']]]);
        exit;

    case 'auth_register':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') denyAccess(405, 'bad_method', 'Método inválido');
        $body = getJsonBody();
        $code = trim((string)($body['code'] ?? ''));
        $name = trim((string)($body['name'] ?? ''));
        $email = normalizeEmail($body['email'] ?? '');
        $password = (string)($body['password'] ?? '');
        $attempt = enforceAttemptLimit($pdo, 'invite');
        if ($name === '' || strlen($name) > 100 || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) {
            denyAccess(400, 'bad_input', 'Informe nome e um e-mail válido.');
        }
        validatePassword($password);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("SELECT id, project_id, role, email FROM cm_invites WHERE code_hash = ? AND used_at IS NULL AND expires_at > NOW() FOR UPDATE");
            $stmt->execute([hash('sha256', $code)]);
            $invite = $stmt->fetch();
            if (!$invite || ($invite['email'] !== null && $invite['email'] !== $email)) {
                $pdo->rollBack();
                recordFailedAttempt($pdo, $attempt);
                denyAccess(403, 'invalid_invite', 'Convite inválido, expirado ou já usado.');
            }
            $stmt = $pdo->prepare("SELECT 1 FROM cm_users WHERE email = ?");
            $stmt->execute([$email]);
            if ($stmt->fetchColumn()) {
                $pdo->rollBack();
                denyAccess(409, 'email_taken', 'Este e-mail já tem conta: entre e aceite o convite logado.');
            }
            $pdo->prepare("INSERT INTO cm_users (name, email, password_hash, last_login_at) VALUES (?, ?, ?, NOW())")
                ->execute([$name, $email, password_hash($password, PASSWORD_BCRYPT, ['cost' => 12])]);
            $userId = (int)$pdo->lastInsertId();
            $pdo->prepare("INSERT INTO cm_members (project_id, user_id, role) VALUES (?, ?, ?)")->execute([$invite['project_id'], $userId, $invite['role']]);
            $pdo->prepare("UPDATE cm_invites SET used_at = NOW() WHERE id = ?")->execute([$invite['id']]);
            $token = createSession($pdo, $userId);
            $pdo->commit();
            echo json_encode(['success' => true, 'token' => $token, 'projectId' => $invite['project_id'], 'role' => $invite['role'],
                'user' => ['id' => $userId, 'name' => $name, 'email' => $email]]);
            exit;
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            denyAccess(500, 'register_failed', 'Falha ao criar a conta');
        }

    case 'auth_logout':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') denyAccess(405, 'bad_method', 'Método inválido');
        if (requestAuthToken() !== '') {
            $pdo->prepare("DELETE FROM cm_sessions WHERE token_hash = ?")->execute([hash('sha256', requestAuthToken())]);
        }
        echo json_encode(['success' => true]);
        exit;

    case 'auth_me':
        echo json_encode(['success' => true, 'user' => currentUser($pdo)]);
        exit;

    case 'auth_change_password':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') denyAccess(405, 'bad_method', 'Método inválido');
        $user = requireUser($pdo);
        $body = getJsonBody();
        $attempt = enforceAttemptLimit($pdo, 'pwd:' . $user['id']);
        $stmt = $pdo->prepare("SELECT password_hash FROM cm_users WHERE id = ?");
        $stmt->execute([$user['id']]);
        if (!password_verify((string)($body['current'] ?? ''), (string)$stmt->fetchColumn())) {
            recordFailedAttempt($pdo, $attempt);
            denyAccess(403, 'bad_credentials', 'Senha atual incorreta.');
        }
        validatePassword($body['new'] ?? '');
        $pdo->prepare("UPDATE cm_users SET password_hash = ? WHERE id = ?")->execute([password_hash($body['new'], PASSWORD_BCRYPT, ['cost' => 12]), $user['id']]);
        // Derruba as demais sessões (mantém só esta)
        $pdo->prepare("DELETE FROM cm_sessions WHERE user_id = ? AND token_hash <> ?")->execute([$user['id'], hash('sha256', requestAuthToken())]);
        echo json_encode(['success' => true]);
        exit;

    case 'create_invite':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') denyAccess(405, 'bad_method', 'Método inválido');
        $body = getJsonBody();
        $projectId = cleanProjectId($body['projectId'] ?? '');
        requireRole($pdo, $projectId, 'owner');
        $user = currentUser($pdo);
        $inviteRole = $body['role'] ?? '';
        if ($inviteRole !== 'editor' && $inviteRole !== 'viewer') denyAccess(400, 'bad_role', 'Papel deve ser editor ou viewer.');
        $inviteEmail = normalizeEmail($body['email'] ?? '');
        if ($inviteEmail !== '' && !filter_var($inviteEmail, FILTER_VALIDATE_EMAIL)) denyAccess(400, 'bad_input', 'E-mail do convite inválido.');
        $stmtCnt = $pdo->prepare("SELECT COUNT(*) FROM cm_invites WHERE project_id = ? AND used_at IS NULL AND expires_at > NOW()");
        $stmtCnt->execute([$projectId]);
        if ((int)$stmtCnt->fetchColumn() >= 50) denyAccess(409, 'too_many_invites', 'Limite de 50 convites pendentes.');
        $code = 'cmi_' . bin2hex(random_bytes(16));
        $inviteId = 'inv_' . bin2hex(random_bytes(6));
        $pdo->prepare("INSERT INTO cm_invites (id, project_id, role, email, code_hash, created_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, NOW() + INTERVAL 7 DAY)")
            ->execute([$inviteId, $projectId, $inviteRole, $inviteEmail !== '' ? $inviteEmail : null, hash('sha256', $code), $user ? $user['id'] : null]);
        echo json_encode(['success' => true, 'inviteId' => $inviteId, 'code' => $code, 'role' => $inviteRole]);
        exit;

    case 'accept_invite':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') denyAccess(405, 'bad_method', 'Método inválido');
        $user = requireUser($pdo);
        $body = getJsonBody();
        $attempt = enforceAttemptLimit($pdo, 'invite');
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("SELECT id, project_id, role, email FROM cm_invites WHERE code_hash = ? AND used_at IS NULL AND expires_at > NOW() FOR UPDATE");
            $stmt->execute([hash('sha256', trim((string)($body['code'] ?? '')))]);
            $invite = $stmt->fetch();
            if (!$invite || ($invite['email'] !== null && $invite['email'] !== $user['email'])) {
                $pdo->rollBack();
                recordFailedAttempt($pdo, $attempt);
                denyAccess(403, 'invalid_invite', 'Convite inválido, expirado, já usado ou de outro e-mail.');
            }
            // Nunca rebaixa quem já tem papel maior no projeto
            $pdo->prepare("INSERT INTO cm_members (project_id, user_id, role) VALUES (?, ?, ?)
                           ON DUPLICATE KEY UPDATE role = IF(? > (CASE role WHEN 'owner' THEN 3 WHEN 'editor' THEN 2 ELSE 1 END), VALUES(role), role)")
                ->execute([$invite['project_id'], $user['id'], $invite['role'], roleRank($invite['role'])]);
            $pdo->prepare("UPDATE cm_invites SET used_at = NOW() WHERE id = ?")->execute([$invite['id']]);
            $pdo->commit();
            echo json_encode(['success' => true, 'projectId' => $invite['project_id'], 'role' => $invite['role']]);
            exit;
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            denyAccess(500, 'invite_failed', 'Falha ao aceitar o convite');
        }

    case 'revoke_member':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') denyAccess(405, 'bad_method', 'Método inválido');
        $body = getJsonBody();
        $projectId = cleanProjectId($body['projectId'] ?? '');
        requireRole($pdo, $projectId, 'owner');
        $stmt = $pdo->prepare("DELETE FROM cm_members WHERE project_id = ? AND user_id = ? AND role <> 'owner'");
        $stmt->execute([$projectId, (int)($body['userId'] ?? 0)]);
        echo json_encode(['success' => true, 'revoked' => $stmt->rowCount()]);
        exit;

    case 'revoke_invite':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') denyAccess(405, 'bad_method', 'Método inválido');
        $body = getJsonBody();
        $projectId = cleanProjectId($body['projectId'] ?? '');
        requireRole($pdo, $projectId, 'owner');
        $stmt = $pdo->prepare("DELETE FROM cm_invites WHERE project_id = ? AND id = ? AND used_at IS NULL");
        $stmt->execute([$projectId, (string)($body['inviteId'] ?? '')]);
        echo json_encode(['success' => true, 'revoked' => $stmt->rowCount()]);
        exit;

    case 'claim_project':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') denyAccess(405, 'bad_method', 'Método inválido');
        $body = getJsonBody();
        $projectId = cleanProjectId($body['projectId'] ?? '');
        $pdo->beginTransaction();
        try {
            // Trava a linha do projeto: duas reivindicações simultâneas não geram dois donos
            $pdo->prepare("INSERT IGNORE INTO cm_projects (id) VALUES (?)")->execute([$projectId]);
            $pdo->prepare("SELECT id FROM cm_projects WHERE id = ? FOR UPDATE")->execute([$projectId]);
            if (isProjectProtected($pdo, $projectId)) {
                $pdo->rollBack();
                denyAccess(409, 'already_claimed', 'Este projeto já possui dono.');
            }
            $claimer = currentUser($pdo);
            if ($claimer) {
                $pdo->prepare("INSERT INTO cm_members (project_id, user_id, role) VALUES (?, ?, 'owner')")->execute([$projectId, $claimer['id']]);
                $pdo->commit();
                echo json_encode(['success' => true, 'role' => 'owner', 'key' => null]);
                exit;
            }
            $issued = issueAccessKey($pdo, $projectId, 'owner', $body['label'] ?? 'Dono');
            $pdo->commit();
            echo json_encode(['success' => true, 'role' => 'owner', 'accessId' => $issued['id'], 'key' => $issued['key']]);
            exit;
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            denyAccess(500, 'claim_failed', 'Falha ao proteger o projeto', ['detail' => $e->getMessage()]);
        }

    case 'create_share':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') denyAccess(405, 'bad_method', 'Método inválido');
        $body = getJsonBody();
        $projectId = cleanProjectId($body['projectId'] ?? '');
        requireRole($pdo, $projectId, 'owner');
        $shareRole = $body['role'] ?? '';
        if ($shareRole !== 'editor' && $shareRole !== 'viewer') {
            denyAccess(400, 'bad_role', 'Papel deve ser editor ou viewer.');
        }
        $stmtCnt = $pdo->prepare("SELECT COUNT(*) FROM cm_access WHERE project_id = ? AND revoked_at IS NULL");
        $stmtCnt->execute([$projectId]);
        if ((int)$stmtCnt->fetchColumn() >= 50) {
            denyAccess(409, 'too_many_keys', 'Limite de 50 acessos ativos. Revogue algum antes.');
        }
        $issued = issueAccessKey($pdo, $projectId, $shareRole, $body['label'] ?? '');
        echo json_encode(['success' => true, 'role' => $shareRole, 'accessId' => $issued['id'], 'key' => $issued['key']]);
        exit;

    case 'list_access':
        $projectId = cleanProjectId($_GET['projectId'] ?? '');
        requireRole($pdo, $projectId, 'owner');
        $stmt = $pdo->prepare("SELECT id, role, label, created_at AS createdAt, revoked_at AS revokedAt FROM cm_access WHERE project_id = ? ORDER BY created_at ASC");
        $stmt->execute([$projectId]);
        $access = $stmt->fetchAll();
        $stmtM = $pdo->prepare("SELECT u.id, u.name, u.email, m.role, m.created_at AS createdAt FROM cm_members m JOIN cm_users u ON u.id = m.user_id WHERE m.project_id = ? ORDER BY m.created_at ASC");
        $stmtM->execute([$projectId]);
        $stmtI = $pdo->prepare("SELECT id, role, email, created_at AS createdAt, expires_at AS expiresAt FROM cm_invites WHERE project_id = ? AND used_at IS NULL AND expires_at > NOW() ORDER BY created_at ASC");
        $stmtI->execute([$projectId]);
        echo json_encode(['success' => true, 'access' => $access, 'members' => $stmtM->fetchAll(), 'invites' => $stmtI->fetchAll()]);
        exit;

    case 'revoke_access':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') denyAccess(405, 'bad_method', 'Método inválido');
        $body = getJsonBody();
        $projectId = cleanProjectId($body['projectId'] ?? '');
        requireRole($pdo, $projectId, 'owner');
        $stmt = $pdo->prepare("UPDATE cm_access SET revoked_at = NOW() WHERE project_id = ? AND id = ? AND role <> 'owner' AND revoked_at IS NULL");
        $stmt->execute([$projectId, (string)($body['accessId'] ?? '')]);
        echo json_encode(['success' => true, 'revoked' => $stmt->rowCount()]);
        exit;

    // --------------------------------------------------------------------------
    // ACTION: LOAD (Carregar Projeto Completo)
    // --------------------------------------------------------------------------
    case 'load':
        $projectId = isset($_GET['projectId']) && !empty($_GET['projectId']) 
            ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $_GET['projectId']) 
            : 'projeto_padrao';
        requireRole($pdo, $projectId, 'viewer');

        // Snapshot consistente: a revisão devolvida corresponde exatamente às feições lidas
        $pdo->beginTransaction();

        // 1. Carrega metadados do projeto
        $stmtProj = $pdo->prepare("SELECT * FROM cm_projects WHERE id = ?");
        $stmtProj->execute([$projectId]);
        $project = $stmtProj->fetch();

        if (!$project) {
            $pdo->commit();
            echo json_encode([
                'exists'   => false,
                'project'  => null,
                'layers'   => [],
                'features' => [],
                'auditLog' => []
            ]);
            exit;
        }

        // 2. Carrega camadas
        $stmtLayers = $pdo->prepare("
            SELECT id, name, color, type, visible, opacity, order_idx AS `order`, updated_at
            FROM cm_layers
            WHERE project_id = ?
            ORDER BY order_idx ASC
        ");
        $stmtLayers->execute([$projectId]);
        $layers = $stmtLayers->fetchAll();
        foreach ($layers as &$l) {
            $l['visible'] = (bool)$l['visible'];
            $l['opacity'] = (float)$l['opacity'];
        }

        // 3. Carrega feições ativas (não deletadas)
        $stmtFeat = $pdo->prepare("
            SELECT id, layer_id AS layerId, name, geom_type AS type, coordinates, properties, style, color, created_by AS createdBy, created_at AS createdAt
            FROM cm_features
            WHERE project_id = ? AND deleted = 0
        ");
        $stmtFeat->execute([$projectId]);

        $features = [];
        // Otimização de Memória: Cursor iterativo em vez de carregar tudo duplicado com fetchAll()
        while ($f = $stmtFeat->fetch(PDO::FETCH_ASSOC)) {
            $coords = json_decode($f['coordinates'], true);
            $props = !empty($f['properties']) ? json_decode($f['properties'], true) : [];
            $style = !empty($f['style']) ? json_decode($f['style'], true) : [];
            if (!is_array($coords)) $coords = [];
            if (!is_array($props)) $props = [];
            if (!is_array($style)) $style = [];
            $radius = isset($props['radius']) ? (float)$props['radius'] : (isset($props['raio']) ? (float)$props['raio'] : null);
            $visible = isset($props['visible']) ? (bool)$props['visible'] : true;
            $features[] = [
                'id'          => $f['id'],
                'layerId'     => $f['layerId'],
                'name'        => $f['name'],
                'type'        => $f['type'],
                'coordinates' => $coords,
                'properties'  => $props,
                'style'       => $style,
                'color'       => $f['color'],
                'radius'      => $radius,
                'visible'     => $visible,
                'createdBy'   => $f['createdBy'],
                'createdAt'   => $f['createdAt']
            ];
        }

        // 4. Carrega log de auditoria (últimos 100)
        $stmtAudit = $pdo->prepare("
            SELECT id, action, detail, user_name AS user, timestamp
            FROM cm_audit
            WHERE project_id = ?
            ORDER BY created_at DESC
            LIMIT 100
        ");
        $stmtAudit->execute([$projectId]);
        $auditLog = $stmtAudit->fetchAll();
        $pdo->commit();

        echo json_encode([
            'exists'     => true,
            'serverTime' => date('Y-m-d H:i:s'),
            'rev'        => (int)($project['rev'] ?? 0),
            'project'    => [
                'id'           => $project['id'],
                'name'         => $project['name'],
                'description'  => $project['description'],
                'basemap'      => $project['basemap'],
                'center'       => [(float)$project['center_lat'], (float)$project['center_lng']],
                'zoom'         => (int)$project['zoom'],
                'featureCount' => count($features),
                'updatedAt'    => $project['updated_at']
            ],
            'layers'   => $layers,
            'features' => $features,
            'auditLog' => $auditLog
        ]);
        exit;

    // --------------------------------------------------------------------------
    // ACTION: SAVE_METADATA (Salva Metadados do Projeto e Camadas)
    // --------------------------------------------------------------------------
    case 'save_metadata':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Método inválido']);
            exit;
        }

        $body = getJsonBody();
        $projectId = !empty($body['id']) ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $body['id']) : 'projeto_padrao';
        $name = !empty($body['name']) ? $body['name'] : 'Levantamento Topográfico - Umuarama';
        $description = isset($body['description']) ? $body['description'] : '';
        $basemap = !empty($body['basemap']) ? $body['basemap'] : 'google_satelite_puro';
        $center = isset($body['center']) && is_array($body['center']) ? $body['center'] : [-23.7661, -53.3206];
        $zoom = isset($body['zoom']) ? (int)$body['zoom'] : 14;
        $featureCount = isset($body['featureCount']) ? (int)$body['featureCount'] : 0;
        requireRole($pdo, $projectId, 'editor');

        $pdo->beginTransaction();
        try {
            $stmtProj = $pdo->prepare("
                INSERT INTO cm_projects (id, name, description, basemap, center_lat, center_lng, zoom, feature_count, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    name = ?,
                    description = ?,
                    basemap = ?,
                    center_lat = ?,
                    center_lng = ?,
                    zoom = ?,
                    feature_count = ?,
                    updated_at = NOW()
            ");
            $latVal = $center[0] ?? -23.7661;
            $lngVal = $center[1] ?? -53.3206;
            $stmtProj->execute([
                $projectId,
                $name,
                $description,
                $basemap,
                $latVal,
                $lngVal,
                $zoom,
                $featureCount,
                // ON DUPLICATE KEY UPDATE (compatibilidade MariaDB 11.8)
                $name,
                $description,
                $basemap,
                $latVal,
                $lngVal,
                $zoom,
                $featureCount
            ]);

            // Se houver camadas, grava/atualiza apenas as que realmente mudaram
            // (evita que cada salvamento "acorde" todos os outros operadores à toa)
            if (isset($body['layers']) && is_array($body['layers'])) {
                $clientId = sanitizeClientId($body['clientId'] ?? '');
                upsertChangedLayers($pdo, $projectId, $body['layers'], $clientId);
            }

            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Metadados salvos no MySQL']);
            exit;
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Falha ao salvar metadados', 'detail' => $e->getMessage()]);
            exit;
        }

    // --------------------------------------------------------------------------
    // ACTION: SYNC_DELTAS (Sincronização Incremental de Feições)
    // --------------------------------------------------------------------------
    case 'sync_deltas':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Método inválido']);
            exit;
        }

        $body = getJsonBody();
        $projectId = !empty($body['projectId']) ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $body['projectId']) : 'projeto_padrao';
        $clientId = sanitizeClientId($body['clientId'] ?? '');
        requireRole($pdo, $projectId, 'editor');
        $toUpsert = isset($body['toUpsert']) && is_array($body['toUpsert']) ? $body['toUpsert'] : [];
        $rawDelete = isset($body['toDelete']) && is_array($body['toDelete']) ? $body['toDelete'] : [];
        $toDelete = [];
        foreach ($rawDelete as $delItem) {
            if (is_string($delItem) || is_numeric($delItem)) {
                $trimmed = trim((string)$delItem);
                if ($trimmed !== '') $toDelete[] = $trimmed;
            } elseif (is_array($delItem) && !empty($delItem['id'])) {
                $toDelete[] = trim((string)$delItem['id']);
            }
        }

        // Trava anti-exclusão em massa: protege contra bugs/clientes com estado vazio
        if (count($toDelete) > 50 && empty($body['allowMassDelete'])) {
            $stmtAct = $pdo->prepare("SELECT COUNT(*) FROM cm_features WHERE project_id = ? AND deleted = 0");
            $stmtAct->execute([$projectId]);
            $active = (int)$stmtAct->fetchColumn();
            if ($active > 0 && count($toDelete) > $active * 0.5) {
                http_response_code(409);
                echo json_encode(['error' => 'Exclusão em massa bloqueada', 'detail' => 'Tentativa de excluir ' . count($toDelete) . ' de ' . $active . ' feições ativas. Reenvie com allowMassDelete=true se for intencional.']);
                exit;
            }
        }

        $pdo->beginTransaction();
        try {
            // Revisão reservada primeiro: trava a linha do projeto até o commit (ordem total das escritas)
            $rev = nextRevision($pdo, $projectId);

            // 1. Exclusão Lógica com Tombstones em lotes seguros de até 500 itens
            if (!empty($toDelete)) {
                $chunks = array_chunk($toDelete, 500);
                foreach ($chunks as $chunk) {
                    $placeholders = implode(',', array_fill(0, count($chunk), '?'));
                    $stmtDel = $pdo->prepare("
                        UPDATE cm_features
                        SET deleted = 1, rev = ?, client_id = ?, updated_at = NOW()
                        WHERE project_id = ? AND id IN ($placeholders)
                    ");
                    $stmtDel->execute(array_merge([$rev, $clientId, $projectId], $chunk));
                }
            }

            // 2. Insere ou Atualiza feições modificadas (marca deleted = 0)
            $upsertCount = 0;
            $upsertErrors = [];
            if (!empty($toUpsert)) {
                $deletedSet = !empty($toDelete) ? array_flip($toDelete) : [];
                $stmtUpsert = prepareFeatureUpsert($pdo);
                $foreignIds = foreignFeatureIds($pdo, $projectId, array_column(array_filter($toUpsert, 'is_array'), 'id'));

                foreach ($toUpsert as $feat) {
                    if (empty($feat['id'])) continue;
                    if (isset($foreignIds[$feat['id']])) continue; // id pertence a outro projeto
                    // Salvaguarda Anti-Zumbi: Não ressuscita feição excluída no mesmo batch
                    if (isset($deletedSet[$feat['id']])) continue;

                    if (executeFeatureUpsert($stmtUpsert, $feat, $projectId, $rev, $clientId)) {
                        $upsertCount++;
                    } else {
                        $upsertErrors[] = ['id' => $feat['id'], 'error' => $stmtUpsert->errorInfo()];
                    }
                }
            }

            // 3. Atualiza contagem de feições ativas no projeto
            $stmtCount = $pdo->prepare("
                UPDATE cm_projects
                SET feature_count = (SELECT COUNT(*) FROM cm_features WHERE project_id = ? AND deleted = 0),
                    updated_at = NOW()
                WHERE id = ?
            ");
            $stmtCount->execute([$projectId, $projectId]);

            $pdo->commit();
            echo json_encode([
                'success'    => true,
                'serverTime' => date('Y-m-d H:i:s'),
                'rev'        => $rev,
                'synced'     => [
                    'upserted' => $upsertCount,
                    'deleted'  => count($toDelete),
                    'errors'   => $upsertErrors
                ]
            ]);
            exit;
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Falha ao sincronizar deltas', 'detail' => $e->getMessage()]);
            exit;
        }

    // --------------------------------------------------------------------------
    // ACTION: PULL_CHANGES (Sincronização Ativa Multi-Dispositivo)
    // Modo revisão (sinceRev): cursor monotônico + presença ao vivo. É o modo usado pelo app.
    // Modo legado (since=timestamp): mantido para clientes em cache durante o deploy.
    // --------------------------------------------------------------------------
    case 'pull_changes':
        $projectId = !empty($_GET['projectId']) ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $_GET['projectId']) : 'projeto_padrao';
        $accessRole = requireRole($pdo, $projectId, 'viewer');

        if (!isset($_GET['sinceRev'])) {
            $rawSince = isset($_GET['since']) ? trim($_GET['since']) : '';
            $since = (!empty($rawSince) && $rawSince !== 'undefined' && $rawSince !== 'null' && strtotime($rawSince) !== false)
                ? $rawSince
                : '1970-01-01 00:00:00';

            $stmtUpsert = $pdo->prepare("
                SELECT id, layer_id AS layerId, name, geom_type AS type, coordinates, properties, style, color, created_by AS createdBy, updated_at AS updatedAt
                FROM cm_features
                WHERE project_id = ? AND deleted = 0 AND updated_at > ?
                ORDER BY updated_at ASC
                LIMIT 500
            ");
            $stmtUpsert->execute([$projectId, $since]);
            $upserted = array_map('decodeFeatureRow', $stmtUpsert->fetchAll());

            $stmtDel = $pdo->prepare("
                SELECT id
                FROM cm_features
                WHERE project_id = ? AND deleted = 1 AND updated_at > ?
                LIMIT 500
            ");
            $stmtDel->execute([$projectId, $since]);
            $deletedIds = $stmtDel->fetchAll(PDO::FETCH_COLUMN);

            $stmtLayers = $pdo->prepare("
                SELECT id, name, color, type, visible, opacity, order_idx AS `order`, updated_at
                FROM cm_layers
                WHERE project_id = ?
                ORDER BY order_idx ASC
            ");
            $stmtLayers->execute([$projectId]);
            $layers = $stmtLayers->fetchAll();
            foreach ($layers as &$l) {
                $l['visible'] = (bool)$l['visible'];
                $l['opacity'] = (float)$l['opacity'];
            }
            unset($l);

            $stmtProj = $pdo->prepare("SELECT name, basemap, feature_count, updated_at FROM cm_projects WHERE id = ?");
            $stmtProj->execute([$projectId]);
            $projectMeta = $stmtProj->fetch();

            echo json_encode([
                'success'      => true,
                'serverTime'   => date('Y-m-d H:i:s'),
                'upserted'     => $upserted,
                'deleted'      => $deletedIds,
                'layers'       => $layers,
                'project'      => $projectMeta
            ]);
            exit;
        }

        $sinceRev = max(0, (int)$_GET['sinceRev']);
        $sinceId = isset($_GET['sinceId']) ? (string)$_GET['sinceId'] : '';
        $clientId = sanitizeClientId($_GET['clientId'] ?? '');
        $pageLimit = 500;

        // 1. Presença: heartbeat + posição do cursor deste operador, e lista dos demais ativos
        $presence = [];
        if ($clientId) {
            $rawName = trim((string)($_GET['userName'] ?? ''));
            $pName = $rawName !== '' ? (function_exists('mb_substr') ? mb_substr($rawName, 0, 128) : substr($rawName, 0, 128)) : 'Colaborador';
            $pColor = preg_match('/^#[0-9a-fA-F]{3,8}$/', (string)($_GET['userColor'] ?? '')) ? $_GET['userColor'] : '#00E08A';
            $pLat = isset($_GET['lat']) && is_numeric($_GET['lat']) ? (float)$_GET['lat'] : null;
            $pLng = isset($_GET['lng']) && is_numeric($_GET['lng']) ? (float)$_GET['lng'] : null;

            try {
                $stmtPres = $pdo->prepare("
                    INSERT INTO cm_presence (project_id, client_id, user_name, color, lat, lng, last_seen, role)
                    VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
                    ON DUPLICATE KEY UPDATE
                        role = VALUES(role),
                        user_name = ?,
                        color = ?,
                        lat = COALESCE(?, lat),
                        lng = COALESCE(?, lng),
                        last_seen = NOW()
                ");
                $stmtPres->execute([$projectId, $clientId, $pName, $pColor, $pLat, $pLng, $accessRole, $pName, $pColor, $pLat, $pLng]);

                if (mt_rand(1, 200) === 1) {
                    $pdo->exec("DELETE FROM cm_presence WHERE last_seen < NOW() - INTERVAL 1 HOUR");
                }

                $stmtOthers = $pdo->prepare("
                    SELECT client_id AS id, user_name AS name, color, lat, lng, role
                    FROM cm_presence
                    WHERE project_id = ? AND client_id <> ? AND last_seen >= NOW() - INTERVAL 12 SECOND
                ");
                $stmtOthers->execute([$projectId, $clientId]);
                foreach ($stmtOthers->fetchAll() as $p) {
                    $presence[] = [
                        'id'    => $p['id'],
                        'name'  => $p['name'],
                        'color' => $p['color'],
                        'role'  => $p['role'],
                        'lat'   => $p['lat'] !== null ? (float)$p['lat'] : null,
                        'lng'   => $p['lng'] !== null ? (float)$p['lng'] : null
                    ];
                }
            } catch (Exception $e) {
                // Presença é acessória: nunca bloqueia a sincronização de dados
            }
        }

        // 2. Leitura em snapshot consistente: tudo com rev <= projRev já está commitado
        $pdo->beginTransaction();
        $stmtRev = $pdo->prepare("SELECT rev, name, basemap, feature_count, updated_at FROM cm_projects WHERE id = ?");
        $stmtRev->execute([$projectId]);
        $projectRow = $stmtRev->fetch();
        $projRev = $projectRow ? (int)$projectRow['rev'] : 0;

        $reset = false;
        if ($sinceRev > $projRev) {
            // Cursor à frente do servidor (banco restaurado/recriado): refaz do zero
            $sinceRev = 0;
            $sinceId = '';
            $reset = true;
        }

        $echoFilter = $clientId ? ' AND (client_id IS NULL OR client_id <> ?)' : '';

        $sqlFeat = "
            SELECT id, layer_id AS layerId, name, geom_type AS type, coordinates, properties, style, color,
                   created_by AS createdBy, updated_at AS updatedAt, deleted, rev
            FROM cm_features
            WHERE project_id = ? AND rev >= ? AND rev <= ? AND (rev > ? OR id > ?)" . $echoFilter . "
            ORDER BY rev ASC, id ASC
            LIMIT " . ($pageLimit + 1);
        $paramsFeat = [$projectId, $sinceRev, $projRev, $sinceRev, $sinceId];
        if ($clientId) $paramsFeat[] = $clientId;
        $stmtFeat = $pdo->prepare($sqlFeat);
        $stmtFeat->execute($paramsFeat);
        $rows = $stmtFeat->fetchAll();

        $hasMore = count($rows) > $pageLimit;
        if ($hasMore) {
            $rows = array_slice($rows, 0, $pageLimit);
            $last = $rows[count($rows) - 1];
            $cursor = ['rev' => (int)$last['rev'], 'id' => $last['id']];
        } else {
            $cursor = ['rev' => $projRev, 'id' => ''];
        }

        $changes = [];
        $upserted = [];
        $deletedIds = [];
        foreach ($rows as $r) {
            $isDeleted = (int)$r['deleted'] === 1;
            if ($isDeleted) {
                $deletedIds[] = $r['id'];
                $changes[] = ['id' => $r['id'], 'rev' => (int)$r['rev'], 'deleted' => true];
            } else {
                $feat = decodeFeatureRow($r);
                $upserted[] = $feat;
                $changes[] = ['id' => $r['id'], 'rev' => (int)$r['rev'], 'deleted' => false, 'feature' => $feat];
            }
        }

        $sqlLayers = "
            SELECT id, name, color, type, visible, opacity, order_idx AS `order`, updated_at, rev
            FROM cm_layers
            WHERE project_id = ? AND rev > ? AND rev <= ?" . $echoFilter . "
            ORDER BY order_idx ASC";
        $paramsLayers = [$projectId, $sinceRev, $projRev];
        if ($clientId) $paramsLayers[] = $clientId;
        $stmtLayers = $pdo->prepare($sqlLayers);
        $stmtLayers->execute($paramsLayers);
        $layers = $stmtLayers->fetchAll();
        foreach ($layers as &$l) {
            $l['visible'] = (bool)$l['visible'];
            $l['opacity'] = (float)$l['opacity'];
            $l['rev'] = (int)$l['rev'];
        }
        unset($l);
        $pdo->commit();

        echo json_encode([
            'success'    => true,
            'serverTime' => date('Y-m-d H:i:s'),
            'rev'        => $projRev,
            'cursor'     => $cursor,
            'hasMore'    => $hasMore,
            'reset'      => $reset,
            'changes'    => $changes,
            'upserted'   => $upserted,
            'deleted'    => $deletedIds,
            'layers'     => $layers,
            'presence'   => $presence,
            'role'       => $accessRole,
            'project'    => $projectRow ? [
                'name'          => $projectRow['name'],
                'basemap'       => $projectRow['basemap'],
                'feature_count' => (int)$projectRow['feature_count'],
                'updated_at'    => $projectRow['updated_at']
            ] : null
        ]);
        exit;

    // --------------------------------------------------------------------------
    // ACTION: SAVE_ALL (Gravação com Upsert Não-Destrutivo)
    // Concorrência otimista: com 'baseRev', feições alteradas por OUTRO operador depois
    // dessa revisão não são sobrescritas pela cópia (possivelmente defasada) deste cliente.
    // A poda de feições ausentes só ocorre com 'prune' explícito.
    // --------------------------------------------------------------------------
    case 'save_all':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Método inválido']);
            exit;
        }

        $body = getJsonBody();
        $projectId = !empty($body['id']) ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $body['id']) : 'projeto_padrao';
        $clientId = sanitizeClientId($body['clientId'] ?? '');
        $baseRev = isset($body['baseRev']) && is_numeric($body['baseRev']) ? (int)$body['baseRev'] : null;
        $prune = !empty($body['prune']);
        requireRole($pdo, $projectId, 'editor');

        $pdo->beginTransaction();
        try {
            $rev = nextRevision($pdo, $projectId);

            // Salva projeto
            $stmtProj = $pdo->prepare("
                INSERT INTO cm_projects (id, name, description, basemap, center_lat, center_lng, zoom, feature_count, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    name = ?,
                    description = ?,
                    basemap = ?,
                    center_lat = ?,
                    center_lng = ?,
                    zoom = ?,
                    feature_count = ?,
                    updated_at = NOW()
            ");
            $center = $body['center'] ?? [-23.7661, -53.3206];
            $projName = $body['name'] ?? 'Levantamento Topográfico - Umuarama';
            $projDesc = $body['description'] ?? '';
            $projBase = $body['basemap'] ?? 'google_satelite_puro';
            $projLat  = $center[0] ?? -23.7661;
            $projLng  = $center[1] ?? -53.3206;
            $projZoom = $body['zoom'] ?? 14;
            $projCount = isset($body['features']) ? count($body['features']) : 0;

            $stmtProj->execute([
                $projectId,
                $projName,
                $projDesc,
                $projBase,
                $projLat,
                $projLng,
                $projZoom,
                $projCount,
                // ON DUPLICATE KEY UPDATE
                $projName,
                $projDesc,
                $projBase,
                $projLat,
                $projLng,
                $projZoom,
                $projCount
            ]);

            // Camadas (Upsert sem truncar, apenas as alteradas)
            if (isset($body['layers']) && is_array($body['layers'])) {
                upsertChangedLayers($pdo, $projectId, $body['layers'], $clientId, $rev);
            }

            $skipped = 0;
            if (isset($body['features']) && is_array($body['features'])) {
                // Feições alteradas por outro operador depois da revisão vista por este cliente
                $newerElsewhere = [];
                if ($baseRev !== null) {
                    $sqlNewer = "SELECT id FROM cm_features WHERE project_id = ? AND rev > ?" . ($clientId ? " AND (client_id IS NULL OR client_id <> ?)" : "");
                    $stmtNewer = $pdo->prepare($sqlNewer);
                    $stmtNewer->execute($clientId ? [$projectId, $baseRev, $clientId] : [$projectId, $baseRev]);
                    $newerElsewhere = array_flip($stmtNewer->fetchAll(PDO::FETCH_COLUMN));
                }

                $currentIds = [];
                $stmtFeat = prepareFeatureUpsert($pdo);
                $foreignIds = foreignFeatureIds($pdo, $projectId, array_column(array_filter($body['features'], 'is_array'), 'id'));
                foreach ($body['features'] as $f) {
                    if (empty($f['id'])) continue;
                    if (isset($foreignIds[$f['id']])) continue; // id pertence a outro projeto
                    $currentIds[] = $f['id'];
                    if (isset($newerElsewhere[$f['id']])) {
                        $skipped++;
                        continue;
                    }
                    executeFeatureUpsert($stmtFeat, $f, $projectId, $rev, $clientId);
                }

                if ($prune) {
                    $stmtExisting = $pdo->prepare("SELECT id FROM cm_features WHERE project_id = ? AND deleted = 0");
                    $stmtExisting->execute([$projectId]);
                    $existingActiveIds = $stmtExisting->fetchAll(PDO::FETCH_COLUMN);

                    $currentIdSet = array_flip($currentIds);
                    $idsToMarkDeleted = [];
                    foreach ($existingActiveIds as $existId) {
                        if (!isset($currentIdSet[$existId]) && !isset($newerElsewhere[$existId])) {
                            $idsToMarkDeleted[] = $existId;
                        }
                    }

                    if (count($idsToMarkDeleted) > 50 && empty($body['allowMassDelete'])
                        && count($idsToMarkDeleted) > count($existingActiveIds) * 0.5) {
                        $pdo->rollBack();
                        http_response_code(409);
                        echo json_encode(['error' => 'Prune em massa bloqueado', 'detail' => 'Apagaria ' . count($idsToMarkDeleted) . ' de ' . count($existingActiveIds) . ' feições ativas.']);
                        exit;
                    }
                    if (!empty($idsToMarkDeleted)) {
                        $delChunks = array_chunk($idsToMarkDeleted, 500);
                        foreach ($delChunks as $delBatch) {
                            $placeholders = implode(',', array_fill(0, count($delBatch), '?'));
                            $stmtDelMissing = $pdo->prepare("
                                UPDATE cm_features
                                SET deleted = 1, rev = ?, client_id = ?, updated_at = NOW()
                                WHERE project_id = ? AND deleted = 0 AND id IN ($placeholders)
                            ");
                            $stmtDelMissing->execute(array_merge([$rev, $clientId, $projectId], $delBatch));
                        }
                    }
                }
            }

            // Atualiza contagem real
            $stmtCount = $pdo->prepare("
                UPDATE cm_projects
                SET feature_count = (SELECT COUNT(*) FROM cm_features WHERE project_id = ? AND deleted = 0),
                    updated_at = NOW()
                WHERE id = ?
            ");
            $stmtCount->execute([$projectId, $projectId]);

            $pdo->commit();
            echo json_encode([
                'success'    => true,
                'serverTime' => date('Y-m-d H:i:s'),
                'rev'        => $rev,
                'skipped'    => $skipped,
                'message'    => 'Projeto completo persistido no MySQL com concorrência segura'
            ]);
            exit;
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Falha na gravação integral', 'detail' => $e->getMessage()]);
            exit;
        }

    // --------------------------------------------------------------------------
    // ACTION: RESTORE_FEATURES (Desfaz exclusões lógicas / tombstones)
    // GET  ?action=restore_features&projectId=X            -> dry-run: resumo por revisão
    // POST {projectId, confirm:true, revs?:[..], ids?:[..], namePrefixExclude?:[..]}
    // --------------------------------------------------------------------------
    case 'restore_features':
        $projectId = !empty($_REQUEST['projectId']) ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $_REQUEST['projectId']) : 'projeto_padrao';
        requireRole($pdo, $projectId, 'editor');

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $stmtSum = $pdo->prepare("
                SELECT rev, COUNT(*) AS total, MIN(name) AS exemploNome, MIN(id) AS exemploId, MAX(updated_at) AS quando
                FROM cm_features WHERE project_id = ? AND deleted = 1
                GROUP BY rev ORDER BY rev ASC
            ");
            $stmtSum->execute([$projectId]);
            echo json_encode(['success' => true, 'dryRun' => true, 'porRevisao' => $stmtSum->fetchAll()]);
            exit;
        }

        $body = getJsonBody();
        if (empty($body['confirm'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Envie confirm:true para restaurar']);
            exit;
        }
        $revs = isset($body['revs']) && is_array($body['revs']) ? array_map('intval', $body['revs']) : [];
        $ids = isset($body['ids']) && is_array($body['ids']) ? array_map('strval', $body['ids']) : [];
        if (empty($revs) && empty($ids)) {
            http_response_code(400);
            echo json_encode(['error' => 'Informe revs[] ou ids[] a restaurar']);
            exit;
        }

        $pdo->beginTransaction();
        try {
            $newRev = nextRevision($pdo, $projectId);
            $restored = 0;
            if (!empty($revs)) {
                $ph = implode(',', array_fill(0, count($revs), '?'));
                $st = $pdo->prepare("UPDATE cm_features SET deleted = 0, rev = ?, client_id = NULL, updated_at = NOW() WHERE project_id = ? AND deleted = 1 AND rev IN ($ph)");
                $st->execute(array_merge([$newRev, $projectId], $revs));
                $restored += $st->rowCount();
            }
            foreach (array_chunk($ids, 500) as $chunk) {
                $ph = implode(',', array_fill(0, count($chunk), '?'));
                $st = $pdo->prepare("UPDATE cm_features SET deleted = 0, rev = ?, client_id = NULL, updated_at = NOW() WHERE project_id = ? AND deleted = 1 AND id IN ($ph)");
                $st->execute(array_merge([$newRev, $projectId], $chunk));
                $restored += $st->rowCount();
            }
            $pdo->prepare("UPDATE cm_projects SET feature_count = (SELECT COUNT(*) FROM cm_features WHERE project_id = ? AND deleted = 0), updated_at = NOW() WHERE id = ?")->execute([$projectId, $projectId]);
            $pdo->commit();
            echo json_encode(['success' => true, 'restored' => $restored, 'rev' => $newRev]);
            exit;
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Falha ao restaurar', 'detail' => $e->getMessage()]);
            exit;
        }

    // --------------------------------------------------------------------------
    // ACTION: LOG_AUDIT (Registrar Auditoria)
    // --------------------------------------------------------------------------
    case 'log_audit':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Método inválido']);
            exit;
        }

        $body = getJsonBody();
        $projectId = !empty($body['projectId']) ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $body['projectId']) : 'projeto_padrao';
        $auditId = !empty($body['id']) ? $body['id'] : ('aud-' . time() . '-' . substr(md5(mt_rand()), 0, 5));
        requireRole($pdo, $projectId, 'editor');

        try {
            $stmt = $pdo->prepare("
                INSERT INTO cm_audit (id, project_id, action, detail, user_name, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    action = ?,
                    detail = ?,
                    user_name = ?,
                    timestamp = ?
            ");
            $actVal  = $body['action'] ?? '';
            $detVal  = $body['detail'] ?? '';
            $usrVal  = $body['user'] ?? 'Você';
            $timeVal = $body['timestamp'] ?? date('c');

            $stmt->execute([
                $auditId,
                $projectId,
                $actVal,
                $detVal,
                $usrVal,
                $timeVal,
                // ON DUPLICATE KEY UPDATE
                $actVal,
                $detVal,
                $usrVal,
                $timeVal
            ]);
            echo json_encode(['success' => true]);
            exit;
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Falha ao registrar auditoria', 'detail' => $e->getMessage()]);
            exit;
        }

    default:
        http_response_code(400);
        echo json_encode([
            'error'           => 'Ação não informada ou desconhecida.',
            'supported_actions' => ['status', 'list_projects', 'load', 'save_metadata', 'sync_deltas', 'pull_changes', 'save_all', 'restore_features', 'log_audit', 'access_info', 'claim_project', 'create_share', 'list_access', 'revoke_access', 'auth_login', 'auth_register', 'auth_logout', 'auth_me', 'auth_change_password', 'create_invite', 'accept_invite', 'revoke_member', 'revoke_invite']
        ]);
        exit;
}
