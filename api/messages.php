<?php
// api/messages.php



header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header("Content-Type: application/json");
include 'db.php';

$action = $_GET['action'] ?? '';

// Для action=get разрешаем chat_id из GET
if ($action === 'get') {
    $chat_id = $_GET['chat_id'] ?? null;
} else {
    // Для send — из JSON тела
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    $chat_id = $data['chat_id'] ?? null;
    $user_id = $data['user_id'] ?? null;
    $message_text = $data['text'] ?? '';
}

// === Получить сообщения ===
if ($action === 'get' && $chat_id) {
    try {
        $last_id = $_GET['last_id'] ?? 0;

        $stmt = $pdo->prepare("
    SELECT m.*, u.username 
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.chat_id = ? AND m.id > ?
    ORDER BY m.sent_at ASC
");
        $stmt->execute([$chat_id, $last_id]);

        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'messages' => $messages]);
    } catch (Exception $e) {
        http_response_code(500);
        error_log("Ошибка загрузки сообщений: " . $e->getMessage());
        echo json_encode(['error' => 'Не удалось загрузить сообщения']);
    }
    exit;
}

// === Отправить сообщение ===
if ($action === 'send' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!$chat_id || !$user_id || !$message_text) {
        http_response_code(400);
        echo json_encode(['error' => 'chat_id, user_id и text обязательны']);
        exit;
    }

    try {
        // Проверим, существует ли чат
        $stmt = $pdo->prepare("SELECT id FROM chats WHERE id = ?");
        $stmt->execute([$chat_id]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Чат не найден']);
            exit;
        }

        // Проверим, состоит ли пользователь в чате
        $stmt = $pdo->prepare("SELECT user_id FROM chat_participants WHERE chat_id = ? AND user_id = ?");
        $stmt->execute([$chat_id, $user_id]);
        if (!$stmt->fetch()) {
            http_response_code(403);
            echo json_encode(['error' => 'Доступ запрещён']);
            exit;
        }

        // Вставляем сообщение
        $stmt = $pdo->prepare("INSERT INTO messages (chat_id, sender_id, content) VALUES (?, ?, ?)");
        $stmt->execute([$chat_id, $user_id, $message_text]);

        $message_id = $pdo->lastInsertId();

        // Получаем имя отправителя
        $stmt = $pdo->prepare("SELECT username FROM users WHERE id = ?");
        $stmt->execute([$user_id]);
        $user = $stmt->fetch();

        // Ответ с новым сообщением
        echo json_encode([
            'success' => true,
            'message' => [
                'id' => $message_id,
                'chat_id' => $chat_id,
                'sender_id' => $user_id,
                'username' => $user['username'],
                'content' => $message_text,
                'sent_at' => date('Y-m-d H:i:s')
            ]
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        error_log("Ошибка отправки сообщения: " . $e->getMessage());
        echo json_encode([
            'error' => 'Не удалось отправить сообщение',
            'debug' => $e->getMessage()
        ]);
    }
    exit;
}

// Неизвестное действие
http_response_code(400);
echo json_encode(['error' => 'Неизвестное действие']);
?>