#!/usr/bin/env php
<?php
$script_dir = dirname(realpath(__FILE__));

// Used for hashing gym IDs
// Do not change
$secret = "ETmz2pG879uyo701wInfe8xJd87UNASs";

require_once("vendor/autoload.php");

chdir(__DIR__."/../docs") || die;

use Location\Coordinate;
use Location\Polygon;

$mysql = mysqli_init();
$mysql->options(MYSQLI_OPT_INT_AND_FLOAT_NATIVE, true);
$mysql->real_connect("localhost", "mad", "mad", "mad_rm");
if ($mysql->connect_errno) {
	printf("[%d] %s\n", $mysql->connect_errno, $mysql->connect_error);
	die;
}

// Load gyms from the database
$all_gyms = $mysql->query("SELECT name, latitude, longitude, gym.gym_id FROM gym INNER JOIN gymdetails ON gym.gym_id=gymdetails.gym_id")->fetch_all(MYSQLI_ASSOC);


// Then geofence them to our boundary
$geofence = load_geofence("/home/pogo/MAD/configs/geofences/Cambridgeshire.txt");

printf("Found %s gyms\n", number_format(count($all_gyms)));

$start = microtime(1);
$all_gyms = array_filter($all_gyms, function($gym) use($geofence) {
	return $geofence->contains(new Coordinate($gym["latitude"], $gym["longitude"]));
});
$end = microtime(1);
printf("Geofenced to %s gyms in %.4f seconds\n", number_format(count($all_gyms)), $end - $start);

// Hash gym IDs
foreach ($all_gyms as &$gym) {
	$gym["gym_id"] = hash_gym_id($gym["gym_id"]);
	unset($gym);
}


// Load known gyms from our data
$known_gyms = json_decode(file_get_contents("gyms.json"), true);
$known_coords = array();
$known_ids = array();
foreach ($known_gyms["features"] as &$gym) {
	$new_properties = array();

	$known_coords[] = $gym["geometry"]["coordinates"][1].",".$gym["geometry"]["coordinates"][0];
	$exact_match = false;
	if (@$gym["properties"]["id"]) {
		$results = fetch_gym_by_id($all_gyms, $gym["properties"]["id"]);
		$exact_match = true;
	} else {
		$results = fetch_gym($all_gyms, $gym["geometry"]["coordinates"][1], $gym["geometry"]["coordinates"][0]);
	}
	if (count($results) === 1) {
		$result = array_shift($results);
		if ($exact_match || name_matches($result["name"], $gym["properties"]["name"]) === true) {
			$new_properties["id"] = $result["gym_id"];
			$gym["geometry"]["coordinates"] = array($result["longitude"], $result["latitude"]);
			$gym["properties"]["name"] = $result["name"];
		}
	} elseif (!$results) {
// TEMP: Don't remove missing gyms
//		$gym["properties"]["removed"] = true;
	} else {
		print_r($results);
		//die;
	}

	$gym["properties"] = $new_properties + $gym["properties"];

	if (@$gym["properties"]["id"]) {
		$known_ids[] = $gym["properties"]["id"];
	}
	unset($gym, $new_properties);
}


foreach ($all_gyms as $arr) {
//	echo "Skipping adding new gyms\n";
//	break; // TEMP: Don't add new gyms. Convert old data first

	if (in_array($arr["gym_id"], $known_ids) ||
		in_array("$arr[latitude],$arr[longitude]", $known_coords)) {
		echo "Skipping known gym: $arr[name]\n";
		continue;
	}

	$gym = array(
		"type" => "Feature",
		"geometry" => array(
			"type" => "Point",
			"coordinates" => array((float)$arr["longitude"], (float)$arr["latitude"])
		),
		"properties" => array(
			"id" => $arr["gym_id"],
			"name" => $arr["name"],
			// TODO: Integrate this
			"locality" => @$arr["locality"],
			"district" => @$arr["district"]
		)
	);

	$known_gyms["features"][] = $gym;
}
file_put_contents("gyms.json", json_encode($known_gyms, JSON_PRETTY_PRINT));

// TEMP: This needs converting and integrating above
exec("$script_dir/add-gym-locations.py");
$known_gyms = json_decode(file_get_contents("gyms.json.new"), true);
file_put_contents("gyms.json", json_encode($known_gyms, JSON_PRETTY_PRINT));
unlink("gyms.json.new");


// Regenerate gyms.csv
/*
$fp = fopen("gyms.csv", "w");

fputcsv($fp, array("Name", "Locality", "District", "Removed", "Latitude", "Longitude"));

foreach ($known_gyms["features"] as $gym) {
	fputcsv($fp, array($gym["properties"]["name"], $gym["properties"]["locality"], $gym["properties"]["district"], (int)@$gym["properties"]["removed"], $gym["geometry"]["coordinates"][1], $gym["geometry"]["coordinates"][0]));
}

fclose($fp);
*/



function load_geofence ($file) {
	$fp = fopen($file, "r");
	if (!$fp) {
		throw new InvalidArgumentException("$file could not be opened for reading");
	}

	$points = array();
	$lineno = 0;
	$found_header = false;
	while (($line=fgets($fp)) !== false) {
		$line = trim($line);

		$lineno++;

		if ($line == "") continue;
		if (substr($line, 0, 1) == "[" && substr($line, -1) == "]") {
			if ($found_header) {
				break;
			}

			$found_header = true;
			continue;
		}

		$point = preg_split("#[\s+,]#", $line, -1, PREG_SPLIT_NO_EMPTY);
		if (count($point) != 2 || !is_numeric($point[0]) || !is_numeric($point[1])) {
			throw new InvalidArgumentException("$file contained an invalid point on line $lineno: $line");
		}
		$points[] = $point;
	}
	fclose($fp);

	if (count($points) < 3) {
		throw new InvalidArgumentException("$file did not contain enough points to create a geofence");
	}

	$polygon = new Polygon();
	foreach ($points as $point) {
		$polygon->addPoint(new Coordinate($point[0], $point[1]));
	}

	return $polygon;
}

function fetch_gym ($gyms, $lat, $lon) {
	foreach (array(0, 0.00002, 0.00005, 0.00010) as $distance) {
		$results = array_filter($gyms,
			function ($gym) use ($lat, $lon, $distance) {
			$lata = abs($lat);
			$latb = abs($gym["latitude"]);
			$lona = abs($lon);
			$lonb = abs($gym["longitude"]);

			$latdiff = abs($latb - $lata);
			$londiff = abs($lonb - $lona);

			if ($distance === 0) {
				if ($gym["latitude"] === $lat && $gym["longitude"] === $lon) {
					return true;
				}
				return false;
			}

			if ($latdiff <= $distance && $londiff <= $distance) {
				return true;
			}

			return false;
		});
		if ($results) {
			return $results;
		}
	}
	return [];
}

function fetch_gym_by_id ($gyms, $gymid) {
	return array_filter($gyms, function($gym) use($gymid) {
		return hash_equals($gym["gym_id"], $gymid);
	});
}

function hash_gym_id ($gymid) {
	return hash_hmac("sha1", $gymid, $GLOBALS["secret"]);
}

function name_matches($a, $b) {
	$a = trim($a);
	$b = trim($b);

	$patterns = array(
		'/[\!",\.\\/\+&\*-_]+/',
		"/'+/",
		'/\s+/'
	);
	$replacements = array(
		"",
		"",
		" "
	);

	$normalised_a = trim(preg_replace($patterns, $replacements, $a));
	$normalised_b = trim(preg_replace($patterns, $replacements, $b));
	if (strcasecmp($a, $b) === 0)
		return true;
	if (strcasecmp($normalised_a, $normalised_b) === 0)
		return true;

	return false;
}
