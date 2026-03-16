<?php
header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: https://service-taxi31.ru");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Credentials: true");

// Включаем отображение ошибок в лог, но не на экране
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once 'db.php';

$user_id = $_GET['user_id'] ?? null;

if (!$user_id) {
    http_response_code(400);
    echo json_encode(['error' => 'User ID required']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT last_seen FROM users WHERE id = ?");
    $stmt->execute([$user_id]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        exit;
    }

    $lastSeen = new DateTime($user['last_seen']);
    $now = new DateTime();
    $secondsAgo = $now->getTimestamp() - $lastSeen->getTimestamp();

    // Онлайн, если был активен < 2 минут назад
    $isOnline = $secondsAgo < 120;

    // Форматируем время
    function formatLastSeen($datetime)
    {
        $now = new DateTime();
        $interval = $now->diff($datetime);

        if ($interval->days >= 7)
            return 'на этой неделе';
        if ($interval->days > 1)
            return 'в этом месяце';
        if ($interval->days == 1)
            return 'вчера';
        if ($interval->h > 0)
            return 'сегодня';
        return 'недавно';
    }

    $statusText = $isOnline
        ? 'online'
        : 'был в сети ' . formatLastSeen($lastSeen);

    echo json_encode([
        'online' => $isOnline,
        'last_seen' => $user['last_seen'],
        'status_text' => $statusText
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error', 'details' => $e->getMessage()]);
}
