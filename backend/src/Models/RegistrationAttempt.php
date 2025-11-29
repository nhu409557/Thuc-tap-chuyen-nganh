<?php
namespace App\Models;

class RegistrationAttempt extends BaseModel
{
    // Tạo 1 bản lưu tạm
    public static function create(string $name, string $email, string $hash, string $code): void
    {
        // Xóa các bản lưu tạm cũ (quá 5 phút)
        self::db()->query('DELETE FROM registration_attempts WHERE created_at < NOW() - INTERVAL 5 MINUTE');
        // Xóa bản lưu tạm của email này nếu có
        $stmt = self::db()->prepare('DELETE FROM registration_attempts WHERE email = ?');
        $stmt->execute([$email]);
        // Tạo bản mới
        $stmt = self::db()->prepare('INSERT INTO registration_attempts (name, email, password_hash, code) VALUES (?, ?, ?, ?)');
        $stmt->execute([$name, $email, $hash, $code]);
    }

    // Tìm bản lưu tạm hợp lệ (trong 5 phút)
    public static function findByEmailAndCode(string $email, string $code): ?array
    {
        $stmt = self::db()->prepare(
            'SELECT * FROM registration_attempts WHERE email = ? AND code = ? AND created_at >= NOW() - INTERVAL 5 MINUTE'
        );
        $stmt->execute([$email, $code]);
        $req = $stmt->fetch();
        return $req ?: null;
    }

    public static function deleteByEmail(string $email): void
    {
        $stmt = self::db()->prepare('DELETE FROM registration_attempts WHERE email = ?');
        $stmt->execute([$email]);
    }

    // ===================================
    // ===== 2 HÀM MỚI ĐƯỢC THÊM VÀO =====
    // ===================================

    /**
     * HÀM MỚI
     * Tìm một bản lưu tạm chỉ bằng email
     */
    public static function findPendingByEmail(string $email): ?array
    {
        $stmt = self::db()->prepare('SELECT * FROM registration_attempts WHERE email = ?');
        $stmt->execute([$email]);
        $req = $stmt->fetch();
        return $req ?: null;
    }

    /**
     * HÀM MỚI
     * Cập nhật mã code và thời gian cho email
     */
    public static function updateCode(string $email, string $code): void
    {
        $stmt = self::db()->prepare('UPDATE registration_attempts SET code = ?, created_at = NOW() WHERE email = ?');
        $stmt->execute([$code, $email]);
    }
}