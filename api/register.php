<?php
// api/register.php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Временная отладка — что пришло
$raw = file_get_contents('php://input');
if (empty($raw)) {
echo json_encode(['error' => 'Пустой запрос']);
exit;
}

$data = json_decode($raw, true);

if (json_last_error() !== JSON_ERROR_NONE) {
echo json_encode([
'error' => 'Некорректный JSON',
'details' => json_last_error_msg(),
'received' => base64_encode($raw) // Покажет, что реально пришло
]);
exit;
}

include 'db.php';

$username = trim($data['username'] ?? '');
$email = filter_var($data['email'] ?? '', FILTER_VALIDATE_EMAIL);
$password = $data['password'] ?? '';

if (empty($username) || empty($email) || empty($password)) {
http_response_code(400);
echo json_encode(['error' => 'Логин, email и пароль обязательны']);
exit;
}

$stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
$stmt->execute([$username, $email]);

if ($stmt->fetch()) {
http_response_code(400);
echo json_encode(['error' => 'Пользователь с таким логином или email уже существует']);
exit;
}

$password_hash = password_hash($password, PASSWORD_DEFAULT);

$stmt = $pdo->prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)");
if ($stmt->execute([$username, $email, $password_hash])) {
echo json_encode([
'success' => true,
'message' => 'Регистрация успешна',
'user' => [
'id' => $pdo->lastInsertId(),
'username' => $username,
'email' => $email
]
]);
} else {
http_response_code(500);
echo json_encode(['error' => 'Ошибка при регистрации']);
}
?>