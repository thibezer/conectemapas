<?php
/**
 * ConecteMapas - Database Configuration (Hostinger MySQL)
 * Credenciais e Parâmetros de Conexão PDO
 */

// Salvaguarda: Impede execução direta via URL no navegador
if (!defined('CONECTEMAPAS_API')) {
    http_response_code(403);
    exit('Acesso direto proibido.');
}

return [
    'driver'    => 'mysql',
    'host'      => 'localhost', // Dentro da hospedagem CloudLinux Hostinger, localhost é o socket mais rápido
    'port'      => 3306,
    'database'  => 'u941736878_conectemapas',
    'username'  => 'u941736878_conectemapas',
    'password'  => 'Conecte#Mapas2026$Db',
    'charset'   => 'utf8mb4',
    'options'   => [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
    ]
];
