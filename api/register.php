<?php
// api/register.php

header("Access-Control-Allow-Origin: https://service-taxi31.ru");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

include 'db.php';

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

$username = trim($data['username'] ?? '');
$email = filter_var($data['email'] ?? '', FILTER_VALIDATE_EMAIL);
$phone = $data['phone'] ?? '';
$password = $data['password'] ?? '';

// Валидация
if (empty($username) || strlen($username) < 3) {
    http_response_code(400);
    echo json_encode(['error' => 'Логин должен быть не менее 3 символов'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!$email) {
    http_response_code(400);
    echo json_encode(['error' => 'Некорректный email'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Оставляем только цифры
$phoneDigits = preg_replace('/\D/', '', $phone);

// Проверяем: ровно 11 цифр и начинается с 7
if (strlen($phoneDigits) !== 11 || !str_starts_with($phoneDigits, '7')) {
    http_response_code(400);
    echo json_encode(['error' => 'Телефон должен быть формата +7 и содержать 11 цифр'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (strlen($password) < 6) {
    http_response_code(400);
    echo json_encode(['error' => 'Пароль должен быть не менее 6 символов'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Проверка на существование (по username, email или phone)
$stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? OR email = ? OR phone = ?");
$stmt->execute([$username, $email, $phoneDigits]);
if ($stmt->fetch()) {
    http_response_code(400);
    echo json_encode(['error' => 'Логин, email или телефон уже используются'], JSON_UNESCAPED_UNICODE);
    exit;
}

$password_hash = password_hash($password, PASSWORD_DEFAULT);

$stmt = $pdo->prepare("INSERT INTO users (username, email, phone, password_hash) VALUES (?, ?, ?, ?)");
if ($stmt->execute([$username, $email, $phoneDigits, $password_hash])) {
    $userId = $pdo->lastInsertId();
    echo json_encode([
        'success' => true,
        'message' => 'Регистрация успешна',
        'user' => [
            'id' => $userId,
            'username' => $username,
            'email' => $email,
            'phone' => $phoneDigits
        ]
    ], JSON_UNESCAPED_UNICODE);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка при регистрации'], JSON_UNESCAPED_UNICODE);
}
?>