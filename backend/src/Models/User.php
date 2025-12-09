<?php
namespace App\Models;

class User extends BaseModel
{
    // 1. Tìm user theo Email (Dùng cho Login/Forgot Password)
    public static function findByEmail(string $email): ?array
    {
        $stmt = self::db()->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    // 2. Tìm user theo ID (Dùng cho Middleware/Order)
    public static function findById(int $id): ?array
    {
        $stmt = self::db()->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    // Chỉ lấy danh sách KHÁCH HÀNG (role = 'customer') + phân trang
    public static function getCustomersOnly(int $limit = 10, int $offset = 0): array
    {
        $stmt = self::db()->prepare(
            "SELECT id, name, email, role, is_locked, created_at
             FROM users
             WHERE role = 'customer'
             ORDER BY id DESC
             LIMIT ? OFFSET ?"
        );

        // PDO yêu cầu bind param LIMIT/OFFSET là INT
        $stmt->bindValue(1, $limit, \PDO::PARAM_INT);
        $stmt->bindValue(2, $offset, \PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll();
    }

    // Đếm tổng số khách hàng (để biết có bao nhiêu trang)
    public static function countCustomers(): int
    {
        $stmt   = self::db()->query("SELECT COUNT(*) as total FROM users WHERE role = 'customer'");
        $result = $stmt->fetch();
        return (int)($result['total'] ?? 0);
    }

    // Cập nhật trạng thái khóa (0: Active, 1: Locked)
    public static function toggleLock(int $id, int $status): bool
    {
        $stmt = self::db()->prepare("UPDATE users SET is_locked = ? WHERE id = ?");
        return $stmt->execute([$status, $id]);
    }

    // Xóa tài khoản
    public static function delete(int $id): bool
    {
        // Lưu ý: Các bảng liên quan (orders, cart_items...) cần thiết lập
        // Foreign Key ON DELETE CASCADE trong Database thì mới xóa sạch được.
        $stmt = self::db()->prepare("DELETE FROM users WHERE id = ?");
        return $stmt->execute([$id]);
    }

    // 3. Tạo User mới (Đăng ký thường)
    public static function create(string $name, string $email, string $password): int
    {
        $hash = password_hash($password, PASSWORD_BCRYPT);

        // Mặc định role là 'customer' và is_locked là 0
        $stmt = self::db()->prepare(
            'INSERT INTO users (name, email, password_hash, role, is_locked)
             VALUES (?, ?, ?, "customer", 0)'
        );
        $stmt->execute([$name, $email, $hash]);

        return (int)self::db()->lastInsertId();
    }

    // 4. Tạo User từ mã Hash (Dùng cho Verify Register / Google Login nếu cần)
    public static function createFromHash(string $name, string $email, string $hash): int
    {
        $stmt = self::db()->prepare(
            'INSERT INTO users (name, email, password_hash, role, is_locked)
             VALUES (?, ?, ?, "customer", 0)'
        );
        $stmt->execute([$name, $email, $hash]);

        return (int)self::db()->lastInsertId();
    }

    // 5. Cập nhật mật khẩu theo Email (Reset Password)
    public static function updatePasswordByEmail(string $email, string $password): bool
    {
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = self::db()->prepare('UPDATE users SET password_hash = ? WHERE email = ?');
        return $stmt->execute([$hash, $email]);
    }

    // 6. Cập nhật mật khẩu theo ID (Đổi mật khẩu trong trang cá nhân)
    public static function updatePassword(int $id, string $newHash): bool
    {
        $stmt = self::db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        return $stmt->execute([$newHash, $id]);
    }
}
