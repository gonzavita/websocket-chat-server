<?php
// api/login.php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header("Content-Type: application/json");
include 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Метод не поддерживается']);
    exit;
}

$raw = file_get_contents('php://input');
if (!$raw) {
    http_response_code(400);
    echo json_encode(['error' => 'Пустой запрос']);
    exit;
}

$data = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['error' => 'Некорректный JSON']);
    exit;
}

$username_or_email = trim($data['username'] ?? '');
$password = $data['password'] ?? '';

if (empty($username_or_email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['error' => 'Логин и пароль обязательны']);
    exit;
}

$stmt = $pdo->prepare("SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ?");
$stmt->execute([$username_or_email, $username_or_email]);
$user = $stmt->fetch();

if ($user && password_verify($password, $user['password_hash'])) {
    $stmt = $pdo->prepare("UPDATE users SET last_seen = NOW() WHERE id = ?");
    $stmt->execute([$user['id']]);

    unset($user['password_hash']);
    $token = bin2hex(random_bytes(32));

    echo json_encode([
        'success' => true,
        'token' => $token,
        'user' => $user
    ]);
} else {
    http_response_code(401);
    echo json_encode(['error' => 'Неверный логин или пароль']);
}
?>
