<?php
header("Content-Type: application/octet-stream");
header("Cache-Control: no-store");
$cacheDir = __DIR__ . '/cache';
if (!file_exists($cacheDir)) {
    mkdir($cacheDir, 0755, true);
}
function cleanOldCache($dir) {
    $now = time();
    $files = glob($dir . '/*.json');
    foreach ($files as $file) {
        if (is_file($file)) {
            $cacheData = json_decode(file_get_contents($file), true);
            if ($cacheData && isset($cacheData['timestamp'])) {
                if ($now - $cacheData['timestamp'] > 60) {
                    unlink($file);
                }
            }
        }
    }
}
cleanOldCache($cacheDir);
$feedUrls = [
    'ace' => 'nyct%2Fgtfs-ace',
    'g' => 'nyct%2Fgtfs-g',
    'nqrw' => 'nyct%2Fgtfs-nqrw',
    '1234567s' => 'nyct%2Fgtfs',
    'bdfm' => 'nyct%2Fgtfs-bdfm',
    'jz' => 'nyct%2Fgtfs-jz',
    'l' => 'nyct%2Fgtfs-l'
];
$group = isset($_GET['group']) ? $_GET['group'] : 'l';
if (!isset($feedUrls[$group])) {
    http_response_code(400);
    die("Invalid group");
}
$feedPath = $feedUrls[$group];
$cacheFile = $cacheDir . '/' . $group . '.json';
$cacheExpiry = 30;
if (file_exists($cacheFile)) {
    $cacheData = json_decode(file_get_contents($cacheFile), true);
    $cacheAge = time() - $cacheData['timestamp'];
    if ($cacheAge < $cacheExpiry) {
        echo base64_decode($cacheData['data']);
        exit;
    }
}
$url = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/" . $feedPath;
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Accept: application/x-protobuf"
]);
$data = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if ($httpCode !== 200 || $data === false) {
    if (file_exists($cacheFile)) {
        $cacheData = json_decode(file_get_contents($cacheFile), true);
        echo base64_decode($cacheData['data']);
        exit;
    }
    http_response_code(503);
    die("Failed to fetch feed data");
}
$cacheData = [
    'timestamp' => time(),
    'data' => base64_encode($data)
];
file_put_contents($cacheFile, json_encode($cacheData));
echo $data;
?>