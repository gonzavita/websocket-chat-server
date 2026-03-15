<?php

header("Content-Type: application/json");

$host = 'mysql81.hostland.ru';
$db = 'host1874179_mess';
$user = 'host1874179_mess';
$pass = '111111';

try {
$pdo = new PDO("mysql:host=$host;dbname=$db", $user, $pass);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$stmt = $pdo->query("SELECT NOW() as now");
$row = $stmt->fetch();

echo json_encode(["success" => true, "time" => $row['now']]);
} catch (Exception $e) {
http_response_code(500);
echo json_encode(["error" => $e->getMessage()]);
}
