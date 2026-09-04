<?php
/**
 * ConecteMapas - Backend REST API (Hostinger LiteSpeed / Apache)
 * Sincronização Relacional em Nuvem com MySQL (u941736878_conectemapas)
 */

define('CONECTEMAPAS_API', true);

// 1. Headers e Tratamento de CORS
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

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
    if (!file_exists($configFile)) {
        http_response_code(500);
        echo json_encode(['error' => 'Arquivo de configuração db_config.php não localizado.']);
        exit;
    }

    $config = require $configFile;
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
function ensureDatabaseSchema(PDO $pdo) {
    static $schemaChecked = false;
    if ($schemaChecked) return;

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

    $schemaChecked = true;
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
        $stmt = $pdo->query("
            SELECT id, name, description, basemap, feature_count, updated_at
            FROM cm_projects
            ORDER BY updated_at DESC
        ");
        $list = $stmt->fetchAll();
        echo json_encode(['projects' => $list]);
        exit;

    // --------------------------------------------------------------------------
    // ACTION: LOAD (Carregar Projeto Completo)
    // --------------------------------------------------------------------------
    case 'load':
        $projectId = isset($_GET['projectId']) && !empty($_GET['projectId']) 
            ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $_GET['projectId']) 
            : 'projeto_padrao';

        // 1. Carrega metadados do projeto
        $stmtProj = $pdo->prepare("SELECT * FROM cm_projects WHERE id = ?");
        $stmtProj->execute([$projectId]);
        $project = $stmtProj->fetch();

        if (!$project) {
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
        $rawFeatures = $stmtFeat->fetchAll();

        $features = [];
        foreach ($rawFeatures as $f) {
            $coords = json_decode($f['coordinates'], true);
            $props = !empty($f['properties']) ? json_decode($f['properties'], true) : [];
            $style = !empty($f['style']) ? json_decode($f['style'], true) : [];
            $features[] = [
                'id'          => $f['id'],
                'layerId'     => $f['layerId'],
                'name'        => $f['name'],
                'type'        => $f['type'],
                'coordinates' => $coords,
                'properties'  => $props,
                'style'       => $style,
                'color'       => $f['color'],
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

        echo json_encode([
            'exists'     => true,
            'serverTime' => date('Y-m-d H:i:s'),
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

        $pdo->beginTransaction();
        try {
            $stmtProj = $pdo->prepare("
                INSERT INTO cm_projects (id, name, description, basemap, center_lat, center_lng, zoom, feature_count, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    description = VALUES(description),
                    basemap = VALUES(basemap),
                    center_lat = VALUES(center_lat),
                    center_lng = VALUES(center_lng),
                    zoom = VALUES(zoom),
                    feature_count = VALUES(feature_count),
                    updated_at = NOW()
            ");
            $stmtProj->execute([
                $projectId,
                $name,
                $description,
                $basemap,
                $center[0] ?? -23.7661,
                $center[1] ?? -53.3206,
                $zoom,
                $featureCount
            ]);

            // Se houver camadas, grava/atualiza
            if (isset($body['layers']) && is_array($body['layers'])) {
                $stmtLayer = $pdo->prepare("
                    INSERT INTO cm_layers (id, project_id, name, color, type, visible, opacity, order_idx, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                        name = VALUES(name),
                        color = VALUES(color),
                        type = VALUES(type),
                        visible = VALUES(visible),
                        opacity = VALUES(opacity),
                        order_idx = VALUES(order_idx),
                        updated_at = NOW()
                ");

                foreach ($body['layers'] as $idx => $layer) {
                    if (empty($layer['id'])) continue;
                    $stmtLayer->execute([
                        $layer['id'],
                        $projectId,
                        $layer['name'] ?? 'Camada',
                        $layer['color'] ?? '#00E08A',
                        $layer['type'] ?? 'custom',
                        isset($layer['visible']) && !$layer['visible'] ? 0 : 1,
                        isset($layer['opacity']) ? (float)$layer['opacity'] : 1.0,
                        $layer['order'] ?? $idx
                    ]);
                }
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
        $toUpsert = isset($body['toUpsert']) && is_array($body['toUpsert']) ? $body['toUpsert'] : [];
        $toDelete = isset($body['toDelete']) && is_array($body['toDelete']) ? $body['toDelete'] : [];

        $pdo->beginTransaction();
        try {
            // 1. Exclusão Lógica com Tombstones (Soft-Delete com registro de updated_at para outros clientes)
            if (!empty($toDelete)) {
                $placeholders = implode(',', array_fill(0, count($toDelete), '?'));
                $stmtDel = $pdo->prepare("
                    UPDATE cm_features 
                    SET deleted = 1, updated_at = NOW() 
                    WHERE project_id = ? AND id IN ($placeholders)
                ");
                $stmtDel->execute(array_merge([$projectId], $toDelete));
            }

            // 2. Insere ou Atualiza feições modificadas (marca deleted = 0)
            if (!empty($toUpsert)) {
                $stmtUpsert = $pdo->prepare("
                    INSERT INTO cm_features (id, project_id, layer_id, name, geom_type, coordinates, properties, style, color, created_by, deleted, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())
                    ON DUPLICATE KEY UPDATE
                        layer_id = VALUES(layer_id),
                        name = VALUES(name),
                        geom_type = VALUES(geom_type),
                        coordinates = VALUES(coordinates),
                        properties = VALUES(properties),
                        style = VALUES(style),
                        color = VALUES(color),
                        deleted = 0,
                        updated_at = NOW()
                ");

                foreach ($toUpsert as $feat) {
                    if (empty($feat['id'])) continue;
                    $stmtUpsert->execute([
                        $feat['id'],
                        $projectId,
                        $feat['layerId'] ?? 'layer-default',
                        $feat['name'] ?? 'Feição',
                        $feat['type'] ?? 'Polygon',
                        json_encode($feat['coordinates'] ?? [], JSON_UNESCAPED_UNICODE),
                        json_encode($feat['properties'] ?? [], JSON_UNESCAPED_UNICODE),
                        json_encode($feat['style'] ?? [], JSON_UNESCAPED_UNICODE),
                        $feat['color'] ?? '#00E08A',
                        $feat['createdBy'] ?? 'Operador'
                    ]);
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
                'synced'     => [
                    'upserted' => count($toUpsert),
                    'deleted'  => count($toDelete)
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
    // --------------------------------------------------------------------------
    case 'pull_changes':
        $projectId = !empty($_GET['projectId']) ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $_GET['projectId']) : 'projeto_padrao';
        $since = !empty($_GET['since']) ? trim($_GET['since']) : '1970-01-01 00:00:00';

        // 1. Feições adicionadas ou alteradas por outros clientes
        $stmtUpsert = $pdo->prepare("
            SELECT id, layer_id AS layerId, name, geom_type AS type, coordinates, properties, style, color, created_by AS createdBy, updated_at AS updatedAt
            FROM cm_features
            WHERE project_id = ? AND deleted = 0 AND updated_at > ?
            ORDER BY updated_at ASC
            LIMIT 500
        ");
        $stmtUpsert->execute([$projectId, $since]);
        $rawUpserted = $stmtUpsert->fetchAll();
        $upserted = [];
        foreach ($rawUpserted as $f) {
            $upserted[] = [
                'id'          => $f['id'],
                'layerId'     => $f['layerId'],
                'name'        => $f['name'],
                'type'        => $f['type'],
                'coordinates' => json_decode($f['coordinates'], true),
                'properties'  => !empty($f['properties']) ? json_decode($f['properties'], true) : [],
                'style'       => !empty($f['style']) ? json_decode($f['style'], true) : [],
                'color'       => $f['color'],
                'createdBy'   => $f['createdBy'],
                'updatedAt'   => $f['updatedAt']
            ];
        }

        // 2. Feições deletadas por outros clientes (Tombstones)
        $stmtDel = $pdo->prepare("
            SELECT id
            FROM cm_features
            WHERE project_id = ? AND deleted = 1 AND updated_at > ?
            LIMIT 500
        ");
        $stmtDel->execute([$projectId, $since]);
        $deletedIds = $stmtDel->fetchAll(PDO::FETCH_COLUMN);

        // 3. Metadados do projeto
        $stmtProj = $pdo->prepare("SELECT name, basemap, feature_count, updated_at FROM cm_projects WHERE id = ?");
        $stmtProj->execute([$projectId]);
        $projectMeta = $stmtProj->fetch();

        echo json_encode([
            'success'      => true,
            'serverTime'   => date('Y-m-d H:i:s'),
            'upserted'     => $upserted,
            'deleted'      => $deletedIds,
            'project'      => $projectMeta
        ]);
        exit;

    // --------------------------------------------------------------------------
    // ACTION: SAVE_ALL (Gravação com Upsert Não-Destrutivo)
    // --------------------------------------------------------------------------
    case 'save_all':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Método inválido']);
            exit;
        }

        $body = getJsonBody();
        $projectId = !empty($body['id']) ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $body['id']) : 'projeto_padrao';

        $pdo->beginTransaction();
        try {
            // Salva projeto
            $stmtProj = $pdo->prepare("
                INSERT INTO cm_projects (id, name, description, basemap, center_lat, center_lng, zoom, feature_count, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    description = VALUES(description),
                    basemap = VALUES(basemap),
                    center_lat = VALUES(center_lat),
                    center_lng = VALUES(center_lng),
                    zoom = VALUES(zoom),
                    feature_count = VALUES(feature_count),
                    updated_at = NOW()
            ");
            $center = $body['center'] ?? [-23.7661, -53.3206];
            $stmtProj->execute([
                $projectId,
                $body['name'] ?? 'Levantamento Topográfico - Umuarama',
                $body['description'] ?? '',
                $body['basemap'] ?? 'google_satelite_puro',
                $center[0] ?? -23.7661,
                $center[1] ?? -53.3206,
                $body['zoom'] ?? 14,
                isset($body['features']) ? count($body['features']) : 0
            ]);

            // Camadas (Upsert sem truncar)
            if (isset($body['layers']) && is_array($body['layers'])) {
                $stmtLayer = $pdo->prepare("
                    INSERT INTO cm_layers (id, project_id, name, color, type, visible, opacity, order_idx, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                        name = VALUES(name),
                        color = VALUES(color),
                        type = VALUES(type),
                        visible = VALUES(visible),
                        opacity = VALUES(opacity),
                        order_idx = VALUES(order_idx),
                        updated_at = NOW()
                ");
                foreach ($body['layers'] as $idx => $l) {
                    if (empty($l['id'])) continue;
                    $stmtLayer->execute([
                        $l['id'],
                        $projectId,
                        $l['name'] ?? 'Camada',
                        $l['color'] ?? '#00E08A',
                        $l['type'] ?? 'custom',
                        isset($l['visible']) && !$l['visible'] ? 0 : 1,
                        isset($l['opacity']) ? (float)$l['opacity'] : 1.0,
                        $l['order'] ?? $idx
                    ]);
                }
            }

            // Feições - Upsert Não-Destrutivo (Blindagem contra Lost Update de outros operadores)
            if (isset($body['features']) && is_array($body['features'])) {
                $stmtFeat = $pdo->prepare("
                    INSERT INTO cm_features (id, project_id, layer_id, name, geom_type, coordinates, properties, style, color, created_by, deleted, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())
                    ON DUPLICATE KEY UPDATE
                        layer_id = VALUES(layer_id),
                        name = VALUES(name),
                        geom_type = VALUES(geom_type),
                        coordinates = VALUES(coordinates),
                        properties = VALUES(properties),
                        style = VALUES(style),
                        color = VALUES(color),
                        deleted = 0,
                        updated_at = NOW()
                ");
                foreach ($body['features'] as $f) {
                    if (empty($f['id'])) continue;
                    $stmtFeat->execute([
                        $f['id'],
                        $projectId,
                        $f['layerId'] ?? 'layer-default',
                        $f['name'] ?? 'Feição',
                        $f['type'] ?? 'Polygon',
                        json_encode($f['coordinates'] ?? [], JSON_UNESCAPED_UNICODE),
                        json_encode($f['properties'] ?? [], JSON_UNESCAPED_UNICODE),
                        json_encode($f['style'] ?? [], JSON_UNESCAPED_UNICODE),
                        $f['color'] ?? '#00E08A',
                        $f['createdBy'] ?? 'Operador'
                    ]);
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

        try {
            $stmt = $pdo->prepare("
                INSERT INTO cm_audit (id, project_id, action, detail, user_name, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $auditId,
                $projectId,
                $body['action'] ?? '',
                $body['detail'] ?? '',
                $body['user'] ?? 'Você',
                $body['timestamp'] ?? date('c')
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
            'supported_actions' => ['status', 'list_projects', 'load', 'save_metadata', 'sync_deltas', 'save_all', 'log_audit']
        ]);
        exit;
}
