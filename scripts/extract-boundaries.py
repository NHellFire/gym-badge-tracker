#!/usr/bin/python3
import json

output = {}
output["type"] = "FeatureCollection"
output["features"] = []

def parse (filename, wards=False):
	global output

	with open(filename, "r") as f:
		data = json.load(f)

	for f in data["features"]:
		la = f["properties"]["lad16nm"]
		parish = f["properties"]["parncp16nm"] if "parncp16nm" in f["properties"] else None
		if ((not wards and "unparished area" not in parish and ("Cambridge" in la or "Huntingdon" in la or la == "Fenland")) or
			(wards and la == "Cambridge")):
			output["features"].append(f)


parse("Wards_December_2016_Full_Extent_Boundaries_in_Great_Britain.geojson", wards=True)
parse("Parishes_and_Non_Civil_Parished_Areas_December_2016_Full_Extent_Boundaries_in_England_and_Wales.geojson", wards=False)

with open("boundaries.json", "w") as f:
		json.dump(output, f)


