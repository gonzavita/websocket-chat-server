<?php
// api/db.php

$host = 'mysql81.hostland.ru';
$db = 'host1874179_mess';
$user = 'host1874179_mess';
$pass = '111111';

try {
$pdo = new PDO("mysql:host=$host;dbname=$db", $user, $pass);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec("SET NAMES utf8");
} catch (Exception $e) {
http_response_code(500);
echo json_encode(['error' => 'База недоступна', 'details' => $e->getMessage()]);
exit;
}
?>