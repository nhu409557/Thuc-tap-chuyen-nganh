<?php
namespace App\Core;

class Controller
{
    protected Request $request;
    protected Response $response;

    public function __construct(Request $req, Response $res)
    {
        $this->request = $req;
        $this->response = $res;
    }

    protected function json($data, int $status = 200)
    {
        $this->response->json($data, $status);
    }

    protected function error(string $message, int $status = 400)
    {
        $this->json(['error' => $message], $status);
    }
}
