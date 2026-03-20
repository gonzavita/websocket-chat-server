<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

include 'db.php';

try {
    // Пользователи, которые были активны за последние 60 секунд
    $stmt = $pdo->query("
        SELECT user_id FROM user_activity 
        WHERE last_active > DATE_SUB(NOW(), INTERVAL 60 SECOND)
    ");
    $online = array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN));

    echo json_encode(['online' => $online]);
} catch (Exception $e) {
    http_response_code(500);
    error_log("Ошибка online.php: " . $e->getMessage());
    echo json_encode(['online' => []]);
}
?>