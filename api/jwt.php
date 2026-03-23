<?php
// api/jwt.php

function generateJWT($userId)
{
    $secretKey = '5360b6fe464be54e44c16f179d61df095c8bbdf45fcda4fc98db490922b9aa25'; // ← Замените на свой ключ!
    $payload = [
        'user_id' => $userId,
        'exp' => time() + 3600 * 24 * 7, // срок действия — 7 дней
        'iat' => time()
    ];

    $header = json_encode(['alg' => 'HS256', 'typ' => 'JWT']);
    $payload = json_encode($payload);

    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));

    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secretKey, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}
