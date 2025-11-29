<?php
namespace App\Core;

class Request
{
    public string $method;
    public string $path;
    public array $query;
    public array $body;
    public array $headers;

    public function __construct()
    {
        $this->method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        // 1. Xử lý URI
        $rawUri = $_SERVER['REQUEST_URI'] ?? '/';
        $uri = parse_url($rawUri, PHP_URL_PATH);
        $uri = rawurldecode($uri);

        // 2. Xác định Base Path để loại bỏ
        $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
        $scriptName = rawurldecode($scriptName);
        $basePath = str_replace('/index.php', '', $scriptName);

        if ($basePath !== '' && strpos($uri, $basePath) === 0) {
            $uri = substr($uri, strlen($basePath));
        }

        $uri = preg_replace('#^/index\.php#', '', $uri);
        $uri = rtrim($uri, '/');
        $this->path = $uri === '' ? '/' : $uri;

        // ==================================================================
        // 3. LẤY DỮ LIỆU VÀ LÀM SẠCH (SANITIZE INPUT)
        // ==================================================================
        
        // Làm sạch Query Params ($_GET)
        $this->query = $this->clean($_GET);

        // Lấy JSON Body và làm sạch
        $inputJSON = json_decode(file_get_contents('php://input'), true) ?? [];
        $this->body = $this->clean($inputJSON);
        
        // 4. Headers
        if (function_exists('getallheaders')) {
            $this->headers = getallheaders();
        } else {
            $this->headers = [];
            foreach ($_SERVER as $name => $value) {
                if (substr($name, 0, 5) == 'HTTP_') {
                    $this->headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
                }
            }
        }
    }

    /**
     * Hàm làm sạch dữ liệu đệ quy (Recursive Sanitize)
     * Giúp lọc cả mảng đa chiều
     */
    private function clean($data)
    {
        if (is_array($data)) {
            // Nếu là mảng, gọi đệ quy cho từng phần tử
            return array_map([$this, 'clean'], $data);
        }

        if (is_string($data)) {
            // 1. Trim: Cắt khoảng trắng thừa đầu đuôi
            $data = trim($data);

            // 2. htmlspecialchars: Chuyển ký tự đặc biệt thành HTML Entities
            // <script> -> &lt;script&gt;
            // ' -> &#039;
            // " -> &quot;
            // Ngăn chặn XSS hiệu quả nhất khi lưu text thuần
            return htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
        }

        // Giữ nguyên số (int/float), null, boolean
        return $data;
    }

    public function bearerToken(): ?string
    {
        $auth = $this->headers['Authorization'] ?? $this->headers['authorization'] ?? '';
        if (str_starts_with($auth, 'Bearer ')) {
            return substr($auth, 7);
        }
        return null;
    }
}