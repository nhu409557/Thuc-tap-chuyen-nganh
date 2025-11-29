<?php
namespace App\Middleware;

use App\Core\Request;
use App\Core\Response;
use App\Helpers\JwtHelper;

class AuthMiddleware
{
    public static function userIdOrFail(Request $req, Response $res): int
    {
        $token = $req->bearerToken();
        if (!$token) {
            $res->json(['error' => 'Unauthorized'], 401);
        }
        $payload = JwtHelper::decode($token);
        if (!$payload || !isset($payload['user_id'])) {
            $res->json(['error' => 'Invalid token'], 401);
        }
        return (int)$payload['user_id'];
    }
}
