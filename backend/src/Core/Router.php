<?php
namespace App\Core;

class Router
{
    private array $routes = [];
    private Request $request;
    private Response $response;

    public function __construct(Request $req, Response $res)
    {
        $this->request = $req;
        $this->response = $res;
    }

    public function add(string $method, string $path, callable|array $handler)
    {
        $this->routes[] = [$method, $path, $handler];
    }

    public function get(string $path, $handler)    { $this->add('GET',    $path, $handler); }
    public function post(string $path, $handler)   { $this->add('POST',   $path, $handler); }
    public function put(string $path, $handler)    { $this->add('PUT',    $path, $handler); }
    public function delete(string $path, $handler) { $this->add('DELETE', $path, $handler); }

    public function dispatch()
    {
        // preflight
        if ($this->request->method === 'OPTIONS') {
            $this->response->json(['ok' => true], 200);
        }

        $reqMethod = $this->request->method;
        $reqPath = rtrim($this->request->path, '/') ?: '/';
        $reqMethod = $this->request->method;
    // 🔍 THÊM DÒNG NÀY:
        foreach ($this->routes as [$method, $path, $handler]) {
            $pattern = preg_replace('#\{[^/]+}#', '([^/]+)', rtrim($path, '/') ?: '/');
            if ($method === $reqMethod && preg_match('#^' . $pattern . '$#', $reqPath, $matches)) {
                array_shift($matches);
                $params = [];

                if (preg_match_all('#\{([^/]+)}#', $path, $paramNames)) {
                    foreach ($paramNames[1] as $index => $name) {
                        $params[$name] = $matches[$index] ?? null;
                    }
                }

                if (is_array($handler)) {
                    [$class, $action] = $handler;
                    $controller = new $class($this->request, $this->response);
                    return $controller->$action($params);
                }

                return call_user_func($handler, $this->request, $this->response, $params);
            }
        }

        $this->response->json(['error' => 'Not Found'], 404);
    }
}
