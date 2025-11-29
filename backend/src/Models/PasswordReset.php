<?php
namespace App\Models;

class PasswordReset extends BaseModel
{
    public static function create(string $email, string $code): void
    {
        // Xóa mã cũ nếu có
        $stmt = self::db()->prepare('DELETE FROM password_resets WHERE email = ?');
        $stmt->execute([$email]);
        // Tạo mã mới
        $stmt = self::db()->prepare('INSERT INTO password_resets (email, code) VALUES (?, ?)');
        $stmt->execute([$email, $code]);
    }

    // Tìm mã hợp lệ (trong 5 phút)
    public static function findByEmailAndCode(string $email, string $code): ?array
    {
        $stmt = self::db()->prepare(
            'SELECT * FROM password_resets WHERE email = ? AND code = ? AND created_at >= NOW() - INTERVAL 5 MINUTE'
        );
        $stmt->execute([$email, $code]);
        $req = $stmt->fetch();
        return $req ?: null;
    }

    public static function deleteByEmail(string $email): void
    {
        $stmt = self::db()->prepare('DELETE FROM password_resets WHERE email = ?');
        $stmt->execute([$email]);
    }
}