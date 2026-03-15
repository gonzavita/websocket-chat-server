<?php
// api/chats.php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header("Content-Type: application/json");
include 'db.php';

$action = $_GET['action'] ?? 'list';

// Для action=list разрешаем user_id из GET
if ($action === 'list') {
    $user_id = $_GET['user_id'] ?? null;
} else {
    // Для других действий — из JSON тела
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    $user_id = $data['user_id'] ?? null;
}

if (!$user_id) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id обязателен']);
    exit;
}
// Проверим, существует ли пользователь
$stmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
$stmt->execute([$user_id]);
if (!$stmt->fetch()) {
    http_response_code(404);
    echo json_encode(['error' => 'Пользователь не найден']);
    exit;
}

// === Действие: список чатов ===
if ($action === 'list') {
    $stmt = $pdo->prepare("
        SELECT c.*, GROUP_CONCAT(u.username) as members
        FROM chats c
        JOIN chat_participants cp ON c.id = cp.chat_id
        JOIN users u ON cp.user_id = u.id
        WHERE cp.user_id = ?
        GROUP BY c.id
        ORDER BY c.updated_at DESC
    ");
    $stmt->execute([$user_id]);
    $chats = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Добавим имя чата (первый собеседник или название)
    foreach ($chats as &$chat) {
        if ($chat['type'] === 'private') {
            $members = explode(',', $chat['members']);
            $other = array_filter($members, function($m) use ($chat) {
                return $m !== $chat['name']; // Здесь нужно имя текущего пользователя
            });
            $chat['display_name'] = implode(', ', $other) ?: 'Чат';
        } else {
            $chat['display_name'] = $chat['name'] ?: 'Группа';
        }
    }

    echo json_encode(['success' => true, 'chats' => $chats]);
    exit;
}

// === Действие: создать личный чат ===
if ($action === 'create' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $interlocutor_id = $data['interlocutor_id'] ?? null;

    if (!$interlocutor_id || $interlocutor_id == $user_id) {
        http_response_code(400);
        echo json_encode(['error' => 'Неверный собеседник']);
        exit;
    }

    // Проверим, существует ли собеседник
    $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
    $stmt->execute([$interlocutor_id]);
    if (!$stmt->fetch()) {
        http_response_code(404);
        echo json_encode(['error' => 'Собеседник не найден']);
        exit;
    }

    // Проверим, есть ли уже чат между ними
    $stmt = $pdo->prepare("
        SELECT c.id FROM chats c
        JOIN chat_participants cp1 ON c.id = cp1.chat_id AND cp1.user_id = ?
        JOIN chat_participants cp2 ON c.id = cp2.chat_id AND cp2.user_id = ?
        WHERE c.type = 'private'
    ");
    $stmt->execute([$user_id, $interlocutor_id]);
    $existing = $stmt->fetch();

    if ($existing) {
        echo json_encode(['success' => true, 'chat_id' => $existing['id'], 'message' => 'Чат уже существует']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        // Создаём чат
        $stmt = $pdo->prepare("INSERT INTO chats (type, creator_id) VALUES ('private', ?)");
        $stmt->execute([$user_id]);
        $chat_id = $pdo->lastInsertId();

        // Добавляем оба пользователя
        $stmt = $pdo->prepare("INSERT INTO chat_participants (user_id, chat_id) VALUES (?, ?), (?, ?)");
        $stmt->execute([$user_id, $chat_id, $interlocutor_id, $chat_id]);

        $pdo->commit();

        echo json_encode(['success' => true, 'chat_id' => $chat_id]);
    } catch (Exception $e) {
        $pdo->rollback();
        http_response_code(500);
        echo json_encode(['error' => 'Ошибка создания чата']);
    }
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Неизвестное действие']);
?>
