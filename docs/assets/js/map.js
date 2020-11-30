var map;
var layerGroups = [];
var layerControl;
var gymList;
var geoJSONLayer;
var markers = [];
var markerIcons = []
var badgeLevels = [ "Basic", "Bronze", "Silver", "Gold" ];

if (location.search.length > 1) {
    var ids = location.search.substr(1);
    if (/^[0-3]+$/.test(ids)) {
        for (var i = 0; i < ids.length; i++) {
            localStorage.setItem("gym" + i, ids.substr(i, 1));
        }
    }
    location.replace("?");
}

function exportLevels () {
    var levels = "";
    for (var id = 0; id < gymList.items.length; id++) {
        levels = levels + getBadgeLevel(id);
    }

    return levels.replace(/0+$/, "");
}

function getMarker(gym) {
    var latlng = L.latLng(gym.values().lat, gym.values().lon);
    for (var k in markers) {
        var marker = markers[k];
        if (latlng.equals(marker.getLatLng())) {
            return marker
        }
    }
}

function getLevelString (level) {
    return badgeLevels[level];
}

function getBadgeLevel (id) {
    var level = parseInt(localStorage.getItem("gym" + id));
    if (isNaN(level)) return 0;
    return level;
}

function nameOnClick() {
    var gymID = $(this).closest("tr").find(".id").text();
    var gym = gymList.get("id", gymID)[0];
    var district = gym.values().district;
    var locality = gym.values().locality;
    var marker = getMarker(gym);

    $("#tabs").tabs({"active": 0});

    layerGroups[district][locality].zoomToShowLayer(marker, function(){marker.openPopup();})
}

function badgeOnClick() {
    var newLevel = 0;
    var gymID = $(this).closest("tr").find(".id").text();
    var gym = gymList.get("id", gymID)[0];
    var oldLevel = gym.values().levelInt;
    if (oldLevel < 3) {
        newLevel = oldLevel + 1;
    }
    var levelString = getLevelString(newLevel);
    var levelClass = levelString.toLowerCase();
    var marker = getMarker(gym);
    gym.values({
        levelString: levelString,
        levelInt: newLevel
    });
    var badge = $("td.id").filter(function(){return $(this).text() == gymID;}).closest("tr").find(".badge");
    badge.attr("class", "badge badge-" + levelClass);
    marker.setIcon(markerIcons[newLevel]);
    localStorage.setItem("gym" + gymID, newLevel);
    gymList.update();
}

$(window).on("load", function () {
    var preload = ["basic.png", "bronze.png", "silver.png", "gold.png"];

    var markerDims = [34, 50];
    var markerAnchor = [markerDims[0]/2, markerDims[1]];
    var markerPopupAnchor = [0, -markerDims[1]];

    markerIcons.push(L.icon({
        iconUrl: "assets/img/basic.png",
        iconSize: markerDims,
        iconAnchor: markerAnchor,
        popupAnchor: markerPopupAnchor
    }));

    markerIcons.push(L.icon({
        iconUrl: "assets/img/bronze.png",
        iconSize: markerDims,
        iconAnchor: markerAnchor,
        popupAnchor: markerPopupAnchor
    }));

    markerIcons.push(L.icon({
        iconUrl: "assets/img/silver.png",
        iconSize: markerDims,
        iconAnchor: markerAnchor,
        popupAnchor: markerPopupAnchor
    }));

    markerIcons.push(L.icon({
        iconUrl: "assets/img/gold.png",
        iconSize: markerDims,
        iconAnchor: markerAnchor,
        popupAnchor: markerPopupAnchor
    }));


    // Initialize tabs
    $("#tabs").tabs({
        beforeActivate: function (e, ui) {
            return ui.newTab[0].id != "tab-export" && ui.newTab[0].id != "tab-import";
        },
        heightStyle: "fill"
    });

    // Open dialog for export
    $("#export").on("click", function(e) {
       e.preventDefault();
       var exportURL = location.protocol + "//" + location.host + location.pathname + "?" + exportLevels();
       $("#export-data").text(exportURL);
       $("#dialog-export").dialog("open");
    });

    $("#dialog-export").dialog({
        modal: true,
        autoOpen: false,
        width: 400,
        buttons: {
            OK: function() {
                $(this).dialog("close");
            }
        }
    });


    // Open dialog for import
    $("#import").on("click", function(e) {
        e.preventDefault();
        $("#dialog-import").dialog("open");
    });

    $("#dialog-import").dialog({
        modal: true,
        autoOpen: false,
        width: 400,
        open: function () {$("#import-data").trigger("focus")},
        buttons: {
            Import: function() {
                var text = $("#import-data").val();
                var re = new RegExp("\\?(\\d+)$");
                if (re.test(text)) {
                    var levels = re.exec(text)[1]
                    var url = [location.protocol, '//', location.host, location.pathname].join('');
                    url += "?" + levels;
                    $(this).dialog("close");
                    window.location = url.substring(0, 164);
                } else {
                    $("<div title='Error'>Invalid import URL</div>").dialog({
                        modal: true,
                        draggable: false,
                        resizable: false,
                        buttons: {
                            "OK": function() {
                                $(this).dialog("close")
                            }
                        }
                    })
                }
            }
        }
    });
    // Initialize gym table
    var listOptions = {
        valueNames: [
            "id",
            "name",
            "levelString",
            {attr: "data-level", name: "levelInt"},
            {attr: "data-lat", name: "lat"},
            {attr: "data-lon", name: "lon"},
            "locality",
            "district"
        ],
        searchColumns: [
            "name",
            "levelString",
            "locality",
            "district"
        ],
        item: '<tr><td class="id"></td><td class="lat lon"><a href="#" class="name" title="Show on map"></a></td><td class="level levelInt"><div class="badge"></div><span class="levelString"></span></td><td class="locality"></td><td class="district"></td></tr>'
    };
    gymList = new List("gyms-list", listOptions);
    gymList.on("updated", function() {
        // total gyms
        var total = gymList.items.length

        // basic gyms
        var basic = gymList.get("levelInt", 0).length

        // bronze gyms
        var bronze = gymList.get("levelInt", 1).length

        // silver gyms
        var silver = gymList.get("levelInt", 2).length

        // gold gyms
        var gold = gymList.get("levelInt", 3).length

        $(".badge-summary .summary-basic").text(basic);
        $(".badge-summary .summary-bronze").text(bronze);
        $(".badge-summary .summary-silver").text(silver);
        $(".badge-summary .summary-gold").text(gold);
        $(".badge-summary .summary-total").text(total);
    });
    map = L.map("map").setView([52.2, 0.12], 12);
    var osm = new L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "Map data &copy; <a href=\"http://openstreetmap.org\">OpenStreetMap</a> contributors",
        maxZoom: 19
    });
    map.addLayer(osm);

    // Load gym list
    $.getJSON("gyms.json", function (data) {
        var gyms = []
        $.each(data.features, function(k, feature) {
            var badgeLevel = getBadgeLevel(k);

            var key = feature.properties.locality;

            if (! (feature.properties.district in layerGroups)) {
                layerGroups[feature.properties.district] = {};
            }

            if (! (key in layerGroups[feature.properties.district])) {
                layerGroups[feature.properties.district][key] = L.markerClusterGroup({
                    chunkedLoading: true,
                    disableClusteringAtZoom: 15,
                    spiderfyOnMaxZoom: false,
                }).addTo(map);
            }
            geoJSONLayer = L.geoJSON(feature, {
                filter: function (feature, layer) {
                    return (! "removed" in feature.properties) || (! feature.properties.removed);
                },
                onEachFeature: function (feature, layer) {
                    layer.setIcon(markerIcons[badgeLevel]);
                    layer.bindPopup("<h2>" + feature.properties.name + "</h2>" +
                        "<a target='_blank' href='https://maps.google.com/maps/dir//" + feature.geometry.coordinates[1] + "," + feature.geometry.coordinates[0] + "'>Get directions</a>");
                    markers.push(layer);
                }
            });
            geoJSONLayer.addTo(layerGroups[feature.properties.district][key]);

            if ((! "removed" in feature.properties) || (! feature.properties.removed)) {
                gyms.push({
                    id: k,
                    name: feature.properties.name,
                    levelString: getLevelString(badgeLevel),
                    levelInt: badgeLevel,
                    locality: feature.properties.locality,
                    district: feature.properties.district,
                    lat: feature.geometry.coordinates[1],
                    lon: feature.geometry.coordinates[0]
                });
            }
        });
        gymList.add(gyms, function (items) {
            $("#gyms-list .badge").on("click", badgeOnClick);
            $("#gyms-list .name").on("click", nameOnClick);
            $(items).each(function (key, item) {
                var badge = $("td.id").filter(function(){return $(this).text() == item.values().id;}).closest("tr").find(".badge");
                var levelClass = item.values().levelString.toLowerCase();
                badge.addClass("badge-" + levelClass);
            });
            gymList.sort("name", { order: "asc"});
        });


		// Group layers by district and sort boundaries first
        layerControlOptions = {
            groupCheckboxes: true,
            noGroupCheckbox: ["Basemap"],
            noCollapse: ["Basemap"],
            groupsExpandedClass: "glyphicon glyphicon-chevron-down",
            groupsCollapsedClass: "glyphicon glyphicon-chevron-right",
            groupsCollapsable: true,
            sortLayers: true,
            sortFunction: function(layerA, layerB, nameA, nameB, groupA, groupB) {
                if (groupA != groupB && (groupA == "Basemap" || groupB == "Basemap")) {
                    return groupA == "Basemap" ? -1 : 1;
                }

                return groupA.localeCompare(groupA) || nameA.localeCompare(nameB);
            }
        };
        layerControl = L.control.groupedLayers({}, layerGroups, layerControlOptions);
        layerControl.addTo(map);

        // Load boundaries
        $.getJSON("boundaries.json", function (data) {
            var boundaries = L.geoJSON(data, {style: function(feature) {
                    return {
                        fillOpacity: 0.15,
                        weight: 1
                    }
                }});
            layerControl.addOverlay(boundaries, "Boundaries", "Basemap");
        });

        gymList.update();
    });

    // preload badge images
    $(preload).each(function () {
        $("<img/>").attr("src", "assets/img/" + this);
    });

    // tooltip for search box
    $("input.search").tooltip();

    // Resize tabs on window resize
    $(window).on("resize", function() {
        $("#tabs").tabs("refresh");
    });
});
