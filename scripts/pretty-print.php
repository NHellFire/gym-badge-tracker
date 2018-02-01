<?php
// This just pretty prints gyms.json so we don't get a huge diff

$file = "gyms.json";
file_put_contents($file, json_encode(json_decode(file_get_contents($file), true), JSON_PRETTY_PRINT));
