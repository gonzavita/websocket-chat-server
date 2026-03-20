<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

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

// === Отправить сообщение ===
if ($action === 'send' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    $chat_id = $data['chat_id'] ?? null;
    $user_id = $data['user_id'] ?? null;
    $text = $data['text'] ?? '';

    if (!$chat_id || !$user_id || !$text) {
        http_response_code(400);
        echo json_encode(['error' => 'chat_id, user_id и text обязательны']);
        exit;
    }

    // Обновляем last_seen
    $stmt = $pdo->prepare("UPDATE users SET last_seen = NOW() WHERE id = ?");
    $stmt->execute([(int) $user_id]);

    try {
        $stmt = $pdo->prepare("SELECT id FROM chats WHERE id = ?");
        $stmt->execute([(int) $chat_id]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Чат не найден']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT user_id FROM chat_participants WHERE chat_id = ? AND user_id = ?");
        $stmt->execute([(int) $chat_id, (int) $user_id]);
        if (!$stmt->fetch()) {
            http_response_code(403);
            echo json_encode(['error' => 'Доступ запрещён']);
            exit;
        }

        // Без sent_at — он по умолчанию
        $stmt = $pdo->prepare("INSERT INTO messages (chat_id, sender_id, content) VALUES (?, ?, ?)");
        $stmt->execute([(int) $chat_id, (int) $user_id, $text]);

        $message_id = $pdo->lastInsertId();

        $stmt = $pdo->prepare("SELECT username FROM users WHERE id = ?");
        $stmt->execute([(int) $user_id]);
        $user = $stmt->fetch();

        echo json_encode([
            'success' => true,
            'message' => [
                'id' => $message_id,
                'chat_id' => $chat_id,
                'sender_id' => $user_id,
                'username' => $user['username'],
                'content' => $text,
                'sent_at' => date('Y-m-d H:i:s')
            ]
        ]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        error_log("Send error: " . $e->getMessage());
        echo json_encode([
            'error' => 'Не удалось отправить сообщение',
            'debug' => $e->getMessage()
        ]);
        exit;
    }
}

// === Отметить как прочитанное ===
if ($action === 'read' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    $message_id = (int) ($data['message_id'] ?? 0);
    $user_id = (int) ($data['user_id'] ?? 0);

    if (!$message_id || !$user_id) {
        http_response_code(400);
        echo json_encode(['error' => 'message_id и user_id обязательны']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT id, chat_id FROM messages WHERE id = ?");
        $stmt->execute([$message_id]);
        $msg = $stmt->fetch();
        if (!$msg) {
            http_response_code(404);
            echo json_encode(['error' => 'Сообщение не найдено']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?");
        $stmt->execute([(int) $msg['chat_id'], $user_id]);
        if (!$stmt->fetch()) {
            http_response_code(403);
            echo json_encode(['error' => 'Доступ запрещён']);
            exit;
        }

        $stmt = $pdo->prepare("INSERT IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)");
        $stmt->execute([$message_id, $user_id]);

        echo json_encode(['success' => true]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Ошибка при отметке прочтения']);
        exit;
    }
}

// === Получить статус прочтения ===
if ($action === 'read_status' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $chat_id = (int) ($_GET['chat_id'] ?? 0);
    $ids_str = $_GET['message_ids'] ?? '';
    $message_ids = array_filter(array_map('intval', explode(',', $ids_str)));
    $current_user_id = (int) ($_GET['user_id'] ?? 0); // ← ДОБАВИЛИ

    if (!$chat_id || empty($message_ids) || !$current_user_id) {
        echo json_encode(['read_by' => []]);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?");
        $stmt->execute([$chat_id, $current_user_id]);
        if (!$stmt->fetch()) {
            http_response_code(403);
            echo json_encode(['read_by' => []]);
            exit;
        }

        $placeholders = str_repeat('?,', count($message_ids) - 1) . '?';
        $stmt = $pdo->prepare("
            SELECT mr.message_id, mr.user_id
            FROM message_reads mr
            JOIN messages m ON mr.message_id = m.id
            WHERE m.chat_id = ? AND mr.message_id IN ($placeholders)
        ");
        $stmt->execute(array_merge([$chat_id], $message_ids));
        $reads = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $readBy = [];
        foreach ($reads as $r) {
            $readBy[$r['message_id']][] = $r['user_id'];
        }

        echo json_encode(['read_by' => $readBy]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        error_log("Ошибка read_status: " . $e->getMessage());
        echo json_encode(['read_by' => []]);
        exit;
    }
}


// === Получить сообщения ===
if ($action === 'get' && isset($_GET['chat_id'])) {
    $chat_id = (int) $_GET['chat_id'];
    $last_id = (int) ($_GET['last_id'] ?? 0);
    $limit = max(1, min(100, (int) ($_GET['limit'] ?? 50)));

    try {
        $stmt = $pdo->prepare("
            SELECT m.*, u.username 
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ? AND m.id > ?
            ORDER BY m.sent_at ASC
            LIMIT $limit
        ");
        $stmt->execute([$chat_id, $last_id]);
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'messages' => $messages]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Не удалось загрузить сообщения',
            'debug' => $e->getMessage()
        ]);
        exit;
    }
}
// === Массовая отметка прочитанных (batch_read) ===
if ($action === 'batch_read' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    $message_ids = $data['message_ids'] ?? [];
    $user_id = (int) ($data['user_id'] ?? 0);

    if (empty($message_ids) || !$user_id) {
        http_response_code(400);
        echo json_encode(['error' => 'message_ids и user_id обязательны']);
        exit;
    }

    try {
        // Проверим, что все сообщения принадлежат чатам пользователя
        $placeholders = str_repeat('?,', count($message_ids) - 1) . '?';
        $stmt = $pdo->prepare("
            SELECT m.id, m.chat_id 
            FROM messages m
            INNER JOIN chat_participants cp ON m.chat_id = cp.chat_id 
            WHERE m.id IN ($placeholders) AND cp.user_id = ?
        ");
        $stmt->execute(array_merge($message_ids, [$user_id]));
        $validMessages = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (empty($validMessages)) {
            http_response_code(403);
            echo json_encode(['error' => 'Нет доступа к этим сообщениям']);
            exit;
        }

        // Вставляем только те, которых ещё нет
        $insertStmt = $pdo->prepare("INSERT IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)");
        foreach ($validMessages as $msgId) {
            $insertStmt->execute([$msgId, $user_id]);
        }

        echo json_encode(['success' => true, 'read_count' => count($validMessages)]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        error_log("Ошибка batch_read: " . $e->getMessage());
        echo json_encode(['error' => 'Ошибка сервера']);
        exit;
    }
}

http_response_code(400);
echo json_encode(['error' => 'Неизвестное действие']);
?>