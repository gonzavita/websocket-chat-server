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

// === Действие: список чатов (с последним сообщением и именем собеседника) ===
if ($action === 'list') {
    try {
        $stmt = $pdo->prepare("
    SELECT 
        c.id,
        c.type,
        c.name,
        u.username AS interlocutor_name,
        u.id AS interlocutor_id,
        m.content AS last_message_content,
        m.sender_id AS last_sender_id,
        m.sent_at AS last_sent_at
    FROM chats c
    -- Найти участника, который НЕ текущий пользователь
    JOIN chat_participants cp1 ON c.id = cp1.chat_id AND cp1.user_id = ?
    JOIN chat_participants cp2 ON c.id = cp2.chat_id AND cp2.user_id != ?
    JOIN users u ON cp2.user_id = u.id
    -- Подтянуть последнее сообщение
    LEFT JOIN messages m ON m.id = (
        SELECT id FROM messages 
        WHERE chat_id = c.id 
        ORDER BY sent_at DESC 
        LIMIT 1
    )
    WHERE c.type = 'private'
    ORDER BY m.sent_at IS NULL, m.sent_at DESC, c.id DESC
");

        $stmt->execute([$user_id, $user_id]);
        $chats = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $result = [];
        foreach ($chats as $chat) {
            // Формируем имя чата
            $displayName = $chat['interlocutor_name'] ?: 'Пользователь';
            $firstChar = mb_strtoupper(mb_substr($displayName, 0, 1));

            // Формируем текст последнего сообщения
            $lastMessageText = '';
            if ($chat['last_message_content']) {
                if ((int) $chat['last_sender_id'] === (int) $user_id) {
                    $lastMessageText = 'Вы: ' . $chat['last_message_content'];
                } else {
                    $lastMessageText = $chat['last_message_content'];
                }
            } else {
                $lastMessageText = 'Нет сообщений';
            }

            $result[] = [
                'id' => (int) $chat['id'],
                'type' => $chat['type'],
                'name' => $chat['name'], // может быть NULL
                'display_name' => $displayName,
                'avatar_char' => $firstChar,
                'last_message' => $lastMessageText,
                'last_sent_at' => $chat['last_sent_at'],
                'interlocutor_id' => (int) $chat['interlocutor_id']
            ];
        }

        echo json_encode([
            'success' => true,
            'chats' => $result
        ]);
        exit;

    } catch (Exception $e) {
        http_response_code(500);
        error_log("Ошибка списка чатов: " . $e->getMessage());
        echo json_encode(['error' => 'Не удалось загрузить чаты']);
        exit;
    }
}

// === Действие: создать личный чат ===
if ($action === 'create' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $interlocutor_id = $data['interlocutor_id'] ?? null;

    if (!$interlocutor_id || (int) $interlocutor_id == (int) $user_id) {
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
        echo json_encode([
            'success' => true,
            'chat_id' => (int) $existing['id'],
            'message' => 'Чат уже существует'
        ]);
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

        echo json_encode([
            'success' => true,
            'chat_id' => (int) $chat_id
        ]);
    } catch (Exception $e) {
        $pdo->rollback();
        http_response_code(500);
        error_log("Ошибка создания чата: " . $e->getMessage());
        echo json_encode(['error' => 'Ошибка создания чата']);
    }
    exit;
}

// === Неизвестное действие ===
http_response_code(400);
echo json_encode(['error' => 'Неизвестное действие']);
?>