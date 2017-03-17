var map, table, editing, videoSrc, trackJSON, trackPoints, trackPath = [];

var marker = new google.maps.Marker({
  clickable: false
});

var viewport = new google.maps.Marker({
  clickable: false
});

var notes = new google.maps.Data();
notes.setStyle(function(feature) {
  return {
    title: feature.getProperty("feature") || null
  };
});

notes.addListener("click", function(e) {
  /*e.feature.forEachProperty(function(value, property) {
    console.log(property + ": " + value);
  });*/
  // Sync video and center map
  video.currentTime = getTime(trackPoints[0][0], Number(e.feature.getId()));
});

var track = new google.maps.Polyline({
  geodesic: true,
  strokeColor: "#FF0000",
  strokeOpacity: 1.0,
  strokeWeight: 3
});

track.addListener("click", function(e) {
  // find closest point on the track (http://stackoverflow.com/a/9777980)
  var latlng = e.latLng;
  var needle = {
    minDistance: 9999999999,
    index: -1,
    latlng: null
  };
  track.getPath().forEach(function(routePoint, index) {
    var dist = google.maps.geometry.spherical.computeDistanceBetween(latlng, routePoint);
    if (dist < needle.minDistance) {
      needle.minDistance = dist;
      needle.index = index;
      needle.latlng = routePoint;
    }
  });
  // jump video to nearest second of closest point
  //video.currentTime = Math.round(getTime(trackPoints[0][0], trackPoints[needle.index][0]));
  video.currentTime = getTime(trackPoints[0][0], trackPoints[needle.index][0]);
});

google.maps.Polyline.prototype.getBounds = function() {
  var bounds = new google.maps.LatLngBounds();
  this.getPath().forEach(function(item, index) {
    bounds.extend(new google.maps.LatLng(item.lat(), item.lng()));
  });
  return bounds;
};

function getTime(begin, next) {
  var startTime = moment(begin);
  var endTime = moment(next);
  var duration = moment.duration(endTime.diff(startTime));
  return duration.asSeconds();
}

function getGeoJSON() {
  var rows = table.datagrid("getData").rows;
  var fc = {
    "type": "FeatureCollection",
    "features": []
  };
  $.each(rows, function(index, row) {
    fc.features.push({
      "type": "Feature",
      "id": row.timestamp.toString(),
      "properties": {
        "timestamp": Number(row.timestamp),
        "elapsed": Number(row.elapsed),
        "feature": row.feature
      },
      "geometry": {
        "type": "Point",
        "coordinates": [
          Number(row.longitude),
          Number(row.latitude)
        ]
      }
    });
  });
  return fc;
}

function loadFeatures(geojson) {
  //geojson = Lockr.get("geojson");
  if (geojson.features) {
    // Clear any existing features
    table.datagrid("loadData", []);
    // Add features to map
    notes.addGeoJson(geojson);
    $.each(geojson.features, function(index, feature) {
      // Add features to table
      table.datagrid("appendRow", {
        timestamp: feature.properties.timestamp,
        elapsed: feature.properties.elapsed,
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
        feature: feature.properties.feature
      });
      // Add captionTrack cues
      captionTrack.addCue(new VTTCue(getTime(trackPoints[0][0], feature.properties.timestamp) - 0.75, getTime(trackPoints[0][0], feature.properties.timestamp) + 0.5, feature.properties.feature));
      captionTrack.cues[0].id = feature.properties.timestamp;
    });
  }
}

$(document).ready(function() {
  // Get URL parameters
  var urlParams = {};

  if (location.search.length > 0) {
    var parts = location.search.substring(1).split("&");
    for (var i = 0; i < parts.length; i++) {
      var nv = parts[i].split("=");
      if (!nv[0]) continue;
      urlParams[nv[0]] = nv[1] || true;
    }
  }

  var video = $("#video")[0];

  if (urlParams && urlParams.id && urlParams.token) {
    videoSrc = "https://web.fulcrumapp.com/api/v2/videos/" + urlParams.id + ".mp4?token=" + urlParams.token;
    $.getJSON("https://web.fulcrumapp.com/api/v2/videos/" + urlParams.id + "/track.json?download=1&token=" + urlParams.token, function(data) {
      trackJSON = data;
    });
    video.src = videoSrc;
  }

  video.addEventListener("play", function() {
    table.datagrid("unselectAll");
    $("#toggle-video-btn").linkbutton({
      iconCls: "icon-fa-pause"
    });
  });

  video.addEventListener("pause", function() {
    $("#toggle-video-btn").linkbutton({
      iconCls: "icon-fa-play"
    });
  });

  video.addEventListener("loadedmetadata", function() {
    metadataTrack = this.addTextTrack("metadata", "English", "en");
    captionTrack = this.addTextTrack("captions", "English", "en");
    captionTrack.mode = "showing";
    trackPath = []; // clear track path array
    trackPoints = trackJSON.tracks[0].track;
    $.each(trackPoints, function(index, point) {
      var begin = trackPoints[0][0];
      if (index > 0) {
        var next = trackPoints[index][0];
        var previous = trackPoints[index - 1][0];
        metadataTrack.addCue(new VTTCue(getTime(begin, previous), getTime(begin, next), JSON.stringify({
          "timestamp": point[0],
          "latitude": point[1],
          "longitude": point[2],
          "altitude": point[3],
          "horizontal_accuracy": point[4],
          "vertical_accuracy": point[5],
          "course": point[6],
          "speed": point[7],
          "heading": point[8],
          "inclination": point[9]
        })));
        //captionTrack.addCue(new VTTCue(getTime(begin, previous), getTime(begin, next), point[1].toFixed(6) + ", " + point[2].toFixed(6)));
        trackPath.push({
          lat: point[1],
          lng: point[2]
        });
      }
    });
    track.setPath(trackPath);
    map.fitBounds(track.getBounds());
    marker.setPosition({
      lat: trackPath[0].lat,
      lng: trackPath[0].lng
    });

    metadataTrack.oncuechange = function() {
      var cue = this.activeCues[0]; // assuming there is only one active cue
      if (cue && cue.text) {
        var obj = JSON.parse(cue.text);
        map.setCenter({
          lat: obj.latitude,
          lng: obj.longitude
        });
        marker.setPosition({
          lat: obj.latitude,
          lng: obj.longitude
        });
        viewport.setPosition({
          lat: obj.latitude,
          lng: obj.longitude
        });
        marker.setIcon({
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          anchor: new google.maps.Point(0, 2.6),
          strokeWeight: 1,
          strokeColor: "white",
          fillColor: "black",
          fillOpacity: 1,
          scale: 8,
          rotation: obj.course
        });
        viewport.setIcon({
          path: google.maps.SymbolPath.BACKWARD_OPEN_ARROW,
          anchor: new google.maps.Point(0, 0),
          strokeWeight: 1,
          strokeColor: "red",
          fillColor: "red",
          fillOpacity: 0.4,
          scale: 9,
          rotation: obj.heading
        });
        $("#meta-latitude").html(obj.latitude.toFixed(6));
        $("#meta-longitude").html(obj.longitude.toFixed(6));
        $("#meta-direction").html(obj.course.toFixed(0) + "°");
        $("#meta-viewport").html(obj.heading.toFixed(0) + "°");
        $("#meta-speed").html((obj.speed * 2.23694).toFixed(1) + " m/h");
        $("#meta-altitude").html(obj.altitude.toFixed(1) + " m");
        $("#meta-horizontal-accuracy").html(obj.horizontal_accuracy.toFixed(0) + " m");
        $("#meta-vertical-accuracy").html(obj.vertical_accuracy.toFixed(0) + " m");
      }
    };

    captionTrack.oncuechange = function() {
      var cue = this.activeCues[0]; // assuming there is only one active cue
      if (cue && cue.id) {
        table.datagrid("selectRecord", cue.id);
        table.datagrid("scrollTo", table.datagrid("getRowIndex", table.datagrid("getSelected")));
      } else {
        table.datagrid("unselectAll");
      }
    };
  });

  map = new google.maps.Map($("#map")[0], {});
  marker.setMap(map);
  viewport.setMap(map);
  track.setMap(map);
  notes.setMap(map);

  $("body").layout("panel", "east").panel({
    onResize: function(height, width) {
      google.maps.event.trigger(map, "resize");
    }
  });

  table = $("#feature-grid").datagrid({
    striped: true,
    border: false,
    fit: true,
    fitColumns: true,
    singleSelect: true,
    idField: "timestamp",
    remoteSort: false,
    sortName: "elapsed",
    sortOrder: "asc",
    columns: [
      [{
        field: "timestamp",
        title: "Timestamp",
        hidden: true
      }, {
        field: "elapsed",
        title: "Time",
        sortable: true,
        width: "5%"
      }, {
        field: "latitude",
        title: "Latitude",
        width: "10%"
      }, {
        field: "longitude",
        title: "Longitude",
        width: "10%"
      }, {
        field: "altitude",
        title: "Altitude",
        hidden: true
      }, {
        field: "horizontal_accuracy",
        title: "Horizontal Accuracy",
        hidden: true
      }, {
        field: "vertical_accuracy",
        title: "Vertical Accuracy",
        hidden: true
      }, {
        field: "course",
        title: "Course",
        hidden: true
      }, {
        field: "speed",
        title: "Speed",
        hidden: true
      }, {
        field: "heading",
        title: "Heading",
        hidden: true
      }, {
        field: "inclination",
        title: "Hnclination",
        hidden: true
      }, {
        field: "feature",
        title: "Feature",
        sortable: true,
        width: "75%",
        editor: "text"
      }]
    ],
    onClickRow: function(index, row) {
      video.currentTime = getTime(trackPoints[0][0], row.timestamp);
      var rows = $(this).datagrid("getData").rows;
      $.each(rows, function(idx, rw) {
        if (index !== idx) {
          table.datagrid("endEdit", idx);
        }
      });
    },
    onDblClickRow: function(index, row) {
      $(this).datagrid("beginEdit", index);
    },
    onBeginEdit: function(index, row) {
      editing = index;
      var rows = $(this).datagrid("getData").rows;
      $.each(rows, function(idx, rw) {
        if (index !== idx) {
          table.datagrid("endEdit", idx);
        }
      });
    },
    onAfterEdit: function(index, row, changes) {
      notes.getFeatureById(row.timestamp).setProperty("feature", row.feature);
      Lockr.set("geojson", getGeoJSON());
      if (captionTrack.activeCues && captionTrack.activeCues.length > 0) {
        captionTrack.removeCue(captionTrack.activeCues[0]);
      }
      captionTrack.addCue(new VTTCue(getTime(trackPoints[0][0], row.timestamp) - 0.75, getTime(trackPoints[0][0], row.timestamp) + 0.75, row.feature));
      captionTrack.activeCues[0].id = row.timestamp;
      //captionTrack.cues[captionTrack.cues.length-1].id = row.timestamp;
    },
    toolbar: "#tb"
  });
});

$("#toggle-video-btn").click(function() {
  if (video.paused) {
    video.play();
    $(this).linkbutton({
      iconCls: "icon-fa-pause"
    });
  } else {
    video.pause();
    $(this).linkbutton({
      iconCls: "icon-fa-play"
    });
  }
  return false;
});

$("#add-feature-btn").click(function() {
  var metadata = JSON.parse(metadataTrack.activeCues[0].text);
  video.pause();

  table.datagrid("insertRow", {
    index: 0,
    row: {
      timestamp: metadata.timestamp,
      //elapsed: getTime(trackPoints[0][0], metadata.timestamp).toFixed(0),
      elapsed: getTime(trackPoints[0][0], metadata.timestamp),
      latitude: metadata.latitude.toFixed(6),
      longitude: metadata.longitude.toFixed(6)
    }
  });
  table.datagrid("beginEdit", 0);
  Lockr.set("geojson", getGeoJSON());

  notes.addGeoJson({
    "type": "Feature",
    "id": metadata.timestamp,
    "geometry": {
      "type": "Point",
      "coordinates": [
        metadata.longitude,
        metadata.latitude
      ]
    }
  });
  return false;
});

$("#remove-feature-btn").click(function() {
  var selected = table.datagrid("getSelected");
  var index = table.datagrid("getRowIndex", selected);
  if (selected) {
    if (confirm("Are you sure you want to delete this feature?")) {
      table.datagrid("deleteRow", index);
      if (captionTrack.activeCues && captionTrack.activeCues.length > 0) {
        captionTrack.removeCue(captionTrack.activeCues[0]);
      }
      notes.remove(notes.getFeatureById(selected.timestamp));
      Lockr.set("geojson", getGeoJSON());
    }
  } else {
    alert("No features seleced!");
  }
  return false;
});

$("#controls-checkbox").click(function() {
  if (this.checked) {
    video.controls = true;
  } else {
    video.controls = false;
  }
});

$("#captions-checkbox").click(function() {
  if (this.checked) {
    captionTrack.mode = "showing";
  } else {
    captionTrack.mode = "hidden";
  }
});

$("#export-geojson-btn").click(function() {
  var geojson = getGeoJSON();
  var blob = new Blob([JSON.stringify(geojson)], {
    type: "application/json"
  });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  document.body.appendChild(a);
  a.style = "display: none";
  a.href = url;
  a.download = "features.geojson";
  a.click();
  URL.revokeObjectURL(url);
  return false;
});

$("#import-geojson-btn").click(function() {
  $("#geojson-file").trigger("click");
  return false;
});

$("#local-files-btn").click(function() {
  $("#local-files").trigger("click");
  return false;
});

$("#geojson-file").change(function(e) {
  var file = e.target.files[0];
  var reader = new FileReader();
  reader.onload = function(e) {
    loadFeatures(JSON.parse(reader.result));
  };
  reader.readAsText(file);
});

$("#local-files").change(function(e) {
  var files = e.target.files;
  if (files.length < 2) {
    alert("Please select one video (.mp4) and one track (.json) file.");
  } else {
    $.each(files, function(index, file) {
      if (file.type == "application/json" || (file.name && file.name.endsWith('.json'))) {
        var reader = new FileReader();
        reader.onload = function(e) {
          trackJSON = JSON.parse(reader.result);
        };
        reader.readAsText(file);
      }
      if (file.type == "video/mp4") {
        video.src = URL.createObjectURL(file);
      }
    });
  }
});

$(document).on("keyup", ".datagrid-editable-input", function(e) {
  if (e.keyCode == 13) {
    table.datagrid("endEdit", editing);
  }
});
