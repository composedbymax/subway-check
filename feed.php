<?php
header("Content-Type: application/octet-stream");
header("Cache-Control: no-store");
$url = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l";
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Accept: application/x-protobuf"
]);
$data = curl_exec($ch);
curl_close($ch);
echo $data;