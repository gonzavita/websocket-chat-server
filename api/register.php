<?php
// api/register.php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

include 'db.php';

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

$username = trim($data['username'] ?? '');
$email = filter_var($data['email'] ?? '', FILTER_VALIDATE_EMAIL);
$phone = preg_replace('/[^\d+]/', '', $data['phone'] ?? ''); // оставляем только цифры и +
$password = $data['password'] ?? '';

// Валидация
if (empty($username) || strlen($username) < 3) {
    http_response_code(400);
    echo json_encode(['error' => 'Логин должен быть не менее 3 символов']);
    exit;
}

if (!$email) {
    http_response_code(400);
    echo json_encode(['error' => 'Некорректный email']);
    exit;
}

if (!preg_match('/^\+?\d{10,15}$/', $phone)) {
    http_response_code(400);
    echo json_encode(['error' => 'Некорректный номер телефона']);
    exit;
}

if (strlen($password) < 6) {
    http_response_code(400);
    echo json_encode(['error' => 'Пароль должен быть не менее 6 символов']);
    exit;
}

// Проверка на существование
$stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? OR email = ? OR phone = ?");
$stmt->execute([$username, $email, $phone]);
if ($stmt->fetch()) {
    http_response_code(400);
    echo json_encode(['error' => 'Логин, email или телефон уже используются']);
    exit;
}

$password_hash = password_hash($password, PASSWORD_DEFAULT);

$stmt = $pdo->prepare("INSERT INTO users (username, email, phone, password_hash) VALUES (?, ?, ?, ?)");
if ($stmt->execute([$username, $email, $phone, $password_hash])) {
    $userId = $pdo->lastInsertId();
    echo json_encode([
        'success' => true,
        'message' => 'Регистрация успешна',
        'user' => [
            'id' => $userId,
            'username' => $username,
            'email' => $email,
            'phone' => $phone
        ]
    ]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка при регистрации']);
}
?>