<?php
// api/check_user.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

include 'db.php';

$field = $_GET['field'] ?? '';
$value = trim($_GET['value'] ?? '');

if (!in_array($field, ['username', 'phone'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Некорректное поле']);
    exit;
}

if (empty($value)) {
    http_response_code(400);
    echo json_encode(['error' => 'Пустое значение']);
    exit;
}

$stmt = $pdo->prepare("SELECT id FROM users WHERE `$field` = ?");
$stmt->execute([$value]);

echo json_encode(['exists' => $stmt->fetch() ? true : false]);
?>