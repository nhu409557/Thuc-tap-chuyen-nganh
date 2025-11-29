<?php
namespace App\Models;

use PDO;

class Category extends BaseModel
{
    public static function all(): array
    {
        $stmt = self::db()->query("SELECT * FROM categories ORDER BY id ASC");
        return $stmt->fetchAll();
    }

    public static function find(int $id): ?array
    {
        $stmt = self::db()->prepare("SELECT * FROM categories WHERE id = ?");
        $stmt->execute([$id]);
        $cat = $stmt->fetch();
        return $cat ?: null;
    }

    public static function create(string $name, string $slug, $specsTemplate = null, $icon = null): int
    {
        if ($specsTemplate && is_array($specsTemplate)) {
            $specsTemplate = json_encode($specsTemplate, JSON_UNESCAPED_UNICODE);
        } else {
            $specsTemplate = null;
        }

        // 👇 THÊM ICON
        $stmt = self::db()->prepare("INSERT INTO categories (name, slug, specs_template, icon) VALUES (?, ?, ?, ?)");
        $stmt->execute([$name, $slug, $specsTemplate, $icon]);
        return (int)self::db()->lastInsertId();
    }

    public static function update(int $id, string $name, string $slug, $specsTemplate = null, $icon = null): bool
    {
        if ($specsTemplate && is_array($specsTemplate)) {
            $specsTemplate = json_encode($specsTemplate, JSON_UNESCAPED_UNICODE);
        } else {
            $specsTemplate = null;
        }

        // 👇 THÊM ICON
        $stmt = self::db()->prepare("UPDATE categories SET name = ?, slug = ?, specs_template = ?, icon = ? WHERE id = ?");
        return $stmt->execute([$name, $slug, $specsTemplate, $icon, $id]);
    }
    public static function delete(int $id): bool
    {
        $stmt = self::db()->prepare("DELETE FROM categories WHERE id = ?");
        return $stmt->execute([$id]);
    }
}