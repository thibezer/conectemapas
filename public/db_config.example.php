<?php
/**
 * ConecteMapas - Database Configuration (Modelo de Exemplo)
 * Copie este arquivo para db_config.php e preencha com as credenciais do seu banco MySQL.
 */

if (!defined('CONECTEMAPAS_API')) {
    http_response_code(403);
    exit('Acesso direto proibido.');
}

return [
    'driver'    => getenv('DB_DRIVER')   ?: 'mysql',
    'host'      => getenv('DB_HOST')     ?: 'localhost',
    'port'      => (int)(getenv('DB_PORT') ?: 3306),
    'database'  => getenv('DB_NAME')     ?: 'conectemapas_db',
    'username'  => getenv('DB_USER')     ?: 'usuario_mysql',
    'password'  => getenv('DB_PASS')     ?: 'sua_senha_segura_aqui',
    'charset'   => 'utf8mb4',
    'options'   => [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
    ]
];
