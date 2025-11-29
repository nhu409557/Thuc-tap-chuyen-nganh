<?php
namespace App\Models;

use App\Config\Database;
use PDO;

abstract class BaseModel
{
    protected static function db(): PDO
    {
        return Database::getConnection();
    }
}
