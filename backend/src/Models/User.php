<?php
namespace App\Models;

class User extends BaseModel
{
    public static function findByEmail(string $email): ?array
    {
        $stmt = self::db()->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public static function findById(int $id): ?array
    {
        $stmt = self::db()->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public static function create(string $name, string $email, string $password): int
    {
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = self::db()->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
        $stmt->execute([$name, $email, $hash]);
        return (int)self::db()->lastInsertId();
    }
    
    // HÀM MỚI (Dùng cho verifyRegister)
    public static function createFromHash(string $name, string $email, string $hash): int
    {
        $stmt = self::db()->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
        $stmt->execute([$name, $email, $hash]);
        return (int)self::db()->lastInsertId();
    }

    // HÀM MỚI (Dùng cho resetPassword)
    public static function updatePasswordByEmail(string $email, string $password): bool
    {
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = self::db()->prepare('UPDATE users SET password_hash = ? WHERE email = ?');
        return $stmt->execute([$hash, $email]);
    }
    // 👇 HÀM MỚI: Cập nhật mật khẩu theo ID
    public static function updatePassword(int $id, string $newHash): bool
    {
        $stmt = self::db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        return $stmt->execute([$newHash, $id]);
    }
}