<?php
// bootstrap.php

// XÓA DÒNG "require __DIR__ . '/vendor/autoload.php';" ĐI

use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

// error display
if ($_ENV['APP_DEBUG'] ?? false) {
    ini_set('display_errors', 1);
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', 0);
}