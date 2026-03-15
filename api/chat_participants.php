<?php
// api/chat_participants.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
include 'db.php';

$chat_id = $_GET['chat_id'] ?? null;

if (!$chat_id) {
http_response_code(400);
echo json_encode(['error' => 'chat_id обязателен']);
exit;
}

$stmt = $pdo->prepare("
SELECT u.id, u.username
FROM users u
JOIN chat_participants cp ON u.id = cp.user_id
WHERE cp.chat_id = ?
");
$stmt->execute([$chat_id]);
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(['success' => true, 'users' => $users]);
?>