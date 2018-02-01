<?php
// This regenerates gyms.json from gyms.csv

if (!$json = file_get_contents("gyms.json")) {
	die("gyms.json missing");
}
$gyms = json_decode($json, true);
$known_coords = array();
foreach ($gyms["features"] as $gym) {
	$known_coords[] = $gym["geometry"]["coordinates"][1].",".$gym["geometry"]["coordinates"][0];
}

$fp = fopen("gyms.csv", "r");
$fields = fgetcsv($fp) ?? die("Invalid csv");

// Name,Locality,District,Removed,Latitude,Longitude
while (($a=fgetcsv($fp)) !== false) {
	$arr = array();
	foreach ($a as $k => $v) {
		$arr[$fields[$k]] = $v;
	}

	if (in_array("$arr[Latitude],$arr[Longitude]", $known_coords)) {
		echo "Skipping known gym: $arr[Name]\n";
		continue;
	}

	$gym = array(
		"type" => "Feature",
		"geometry" => array(
			"type" => "Point",
			"coordinates" => array((float)$arr["Longitude"], (float)$arr["Latitude"])
		),
		"properties" => array(
			"name" => $arr["Name"],
			"locality" => $arr["Locality"],
			"district" => $arr["District"]
		)
	);

	if ($arr["Removed"]) {
		$gym["properties"]["removed"] = $arr["Removed"];
	}

	$gyms["features"][] = $gym;
}

$fp = fopen("gyms.json.new", "w");
fwrite($fp, json_encode($gyms, JSON_PRETTY_PRINT));
fclose($fp);
