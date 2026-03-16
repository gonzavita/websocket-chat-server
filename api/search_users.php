<?php
// api/search_users.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

include 'db.php';

$current_user_id = $_GET['user_id'] ?? 0;
$q = trim($_GET['q'] ?? '');

if (strlen($q) < 2) {
    echo json_encode(['users' => []]);
    exit;
}

// Очищаем запрос для поиска по телефону
$phone_query = preg_replace('/[^\d]/', '', $q);

$stmt = $pdo->prepare("
    SELECT u.id, u.username, u.phone, 
           IF(u.last_seen > DATE_SUB(NOW(), INTERVAL 5 MINUTE), 1, 0) as online
    FROM users u
    WHERE u.id != ?
      AND (
          u.username LIKE ? 
          OR u.phone LIKE ?
      )
    ORDER BY u.username
    LIMIT 10
");

$searchTerm = "%$q%";
$phoneTerm = "%$phone_query%";

$stmt->execute([$current_user_id, $searchTerm, $phoneTerm]);
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(['users' => $users]);
?>