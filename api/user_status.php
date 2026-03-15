<?php
// api/user_status.php
// api/user_status.php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header("Content-Type: application/json");
include 'db.php';

$user_id = $_GET['user_id'] ?? null;

if (!$user_id) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id обязателен']);
    exit;
}

$stmt = $pdo->prepare("SELECT username, last_seen FROM users WHERE id = ?");
$stmt->execute([$user_id]);
$user = $stmt->fetch();

if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'Пользователь не найден']);
    exit;
}

$lastSeen = new DateTime($user['last_seen']);
$now = new DateTime();
$diff = $now->getTimestamp() - $lastSeen->getTimestamp();
$online = $diff < 60; // онлайн, если был менее минуты назад

echo json_encode([
    'user_id' => $user_id,
    'username' => $user['username'],
    'last_seen' => $user['last_seen'],
    'online' => $online
]);
?>
