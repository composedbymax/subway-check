<?php
header("Content-Type: application/json");
header("Cache-Control: no-store");
$cacheDir = __DIR__ . '/mapcache';
if (!file_exists($cacheDir)) {
    mkdir($cacheDir, 0755, true);
}
$mappingFile = $cacheDir . '/station-mapping.json';
$cacheExpiry = 43200;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    if (isset($data['mapping'])) {
        $cacheData = [
            'timestamp' => time(),
            'mapping' => $data['mapping']
        ];
        file_put_contents($mappingFile, json_encode($cacheData));
        echo json_encode(['success' => true]);
        exit;
    }
    http_response_code(400);
    echo json_encode(['error' => 'Invalid data']);
    exit;
}
if (file_exists($mappingFile)) {
    $cacheData = json_decode(file_get_contents($mappingFile), true);
    $cacheAge = time() - $cacheData['timestamp'];
    if ($cacheAge < $cacheExpiry) {
        echo json_encode(['mapping' => $cacheData['mapping']]);
        exit;
    }
    echo json_encode(['mapping' => null]);
    exit;
}
echo json_encode(['mapping' => null]);
?>