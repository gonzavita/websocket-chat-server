<?php
// api/login.php

header("Access-Control-Allow-Origin: https://service-taxi31.ru");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

include 'db.php';
include 'jwt.php'; // Подключаем генератор токена

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

$phone_or_username = trim($data['username'] ?? '');
$password = $data['password'] ?? '';

if (empty($phone_or_username) || empty($password)) {
    http_response_code(400);
    echo json_encode(['error' => 'Логин/телефон и пароль обязательны']);
    exit;
}

$phone_clean = preg_replace('/[^\d]/', '', $phone_or_username);
if (strlen($phone_clean) >= 10 && strlen($phone_clean) <= 15) {
    $phone_pattern = "%{$phone_clean}%";
    $stmt = $pdo->prepare("SELECT id, username, email, phone, password_hash FROM users WHERE phone LIKE ?");
    $stmt->execute([$phone_pattern]);
} else {
    $stmt = $pdo->prepare("SELECT id, username, email, phone, password_hash FROM users WHERE username = ?");
    $stmt->execute([$phone_or_username]);
}

$user = $stmt->fetch();

if ($user && password_verify($password, $user['password_hash'])) {
    unset($user['password_hash']);

    // Обновляем last_seen
    $stmt = $pdo->prepare("UPDATE users SET last_seen = NOW() WHERE id = ?");
    $stmt->execute([$user['id']]);

    // Генерируем JWT
    $token = generateJWT($user['id']);

    // Возвращаем токен
    echo json_encode([
        'success' => true,
        'token' => $token,
        'user' => $user
    ]);
} else {
    http_response_code(401);
    echo json_encode(['error' => 'Неверный логин/телефон или пароль']);
}
?>