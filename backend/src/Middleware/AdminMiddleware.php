<?php
namespace App\Middleware;

use App\Core\Request;
use App\Core\Response;
use App\Models\User;
use App\Helpers\JwtHelper;

class AdminMiddleware
{
    public static function guard(Request $req, Response $res)
    {
        $token = $req->bearerToken();
        if (!$token) {
            $res->json(['error' => 'Unauthorized'], 401);
        }

        $payload = JwtHelper::decode($token);
        if (!$payload || !isset($payload['user_id'])) {
            $res->json(['error' => 'Invalid token'], 401);
        }

        $user = User::findById($payload['user_id']);
        
        // Kiểm tra Role
        if (!$user || $user['role'] !== 'admin') {
            $res->json(['error' => 'Forbidden: Admin access only'], 403);
        }
    }
}