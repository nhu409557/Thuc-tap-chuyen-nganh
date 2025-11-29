<?php
namespace App\Helpers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class JwtHelper
{
    public static function encode(array $payload): string
    {
        $now = time();
        $exp = $now + (int)($_ENV['JWT_EXPIRE_HOURS'] ?? 24) * 3600;

        $payload['iat'] = $now;
        $payload['exp'] = $exp;

        return JWT::encode($payload, $_ENV['JWT_SECRET'], 'HS256');
    }

    public static function decode(string $token): ?array
    {
        try {
            $decoded = JWT::decode($token, new Key($_ENV['JWT_SECRET'], 'HS256'));
            return (array)$decoded;
        } catch (\Throwable $e) {
            return null;
        }
    }
}
