<?php
// api/search_users.php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header("Content-Type: application/json");
include 'db.php';

$search = trim($_GET['q'] ?? '');
$user_id = $_GET['user_id'] ?? null;

if (!$user_id) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id обязателен']);
    exit;
}

if (strlen($search) < 2) {
    echo json_encode(['users' => []]);
    exit;
}

$stmt = $pdo->prepare("
    SELECT id, username, last_seen
    FROM users
    WHERE id != ?
    AND (username LIKE ? OR email LIKE ?)
    ORDER BY username LIMIT 10
    ");
$stmt->execute([$user_id, "%$search%", "%$search%"]);
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Добавим online статус
foreach ($users as &$user) {
    $lastSeen = new DateTime($user['last_seen']);
    $now = new DateTime();
    $diff = $now->getTimestamp() - $lastSeen->getTimestamp();
    $user['online'] = $diff < 60;
}
echo json_encode(['users' => $users]);
?>