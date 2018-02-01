#!/usr/bin/python3
import json
import shapely.geometry


with open("gyms.json", "r") as f:
	gyms = json.load(f)

with open("boundaries.json", "r") as f:
	boundaries = json.load(f)

polygons = []
for boundary in boundaries["features"]:
	props = boundary["properties"]

	district = props["lad16nm"] if "lad16nm" in props else None

	locality = None

	if "wd16nm" in props and props["wd16nm"]:
		locality = props["wd16nm"]
	if "parncp16nm" in props and props["parncp16nm"]:
		locality = props["parncp16nm"]

	# GeoJSON is incorrectly formatted in some places
	# Such as Milton
	try:
		coords = boundary["geometry"]["coordinates"]
		try:
			coords[0][0][0][0]
			coords = coords[0]
		except:
			pass
		polygon = shapely.geometry.Polygon(*coords)
		polygons.append({
			"polygon": polygon,
			"locality": locality,
			"district": district,
		})
	except ValueError:
		print(locality)
		print(boundary["geometry"]["coordinates"])
		raise
		# Some fail parsing
		# ValueError: A LinearRing must have at least 3 coordinate tuples
		pass

new_gyms = []
for gym in gyms["features"]:
	found = False
	point = shapely.geometry.Point(*gym["geometry"]["coordinates"])
	for p in polygons:
		polygon = p["polygon"]
		if polygon.contains(point):
			gym["properties"].update({"locality": p["locality"], "district": p["district"]})
			new_gyms.append(gym)
			found = True
			break
	if not found:
		new_gyms.append(gym)

gyms["features"] = new_gyms


with open("gyms.json.new", "w") as f:
	json.dump(gyms, f)
