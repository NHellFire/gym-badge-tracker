<?php
// This regenerates gyms.csv from gyms.json

if (!$json=file_get_contents("gyms.json")) {
	die("gyms.json missing");
}
$gyms = json_decode($json, true);

$fp = fopen("gyms.csv", "w");

fputcsv($fp, array("Name", "Locality", "District", "Removed", "Latitude", "Longitude"));

foreach ($gyms["features"] as $gym) {
	fputcsv($fp, array($gym["properties"]["name"], $gym["properties"]["locality"], $gym["properties"]["district"], (int)@$gym["properties"]["removed"], $gym["geometry"]["coordinates"][1], $gym["geometry"]["coordinates"][0]));
}

fclose($fp);
