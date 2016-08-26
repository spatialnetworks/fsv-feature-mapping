if (window.location.host === "web.fulcrumapp.com") {
  var aTags = document.getElementsByTagName("a");
  for (var i = 0; i < aTags.length; i++) {
    if (aTags[i].textContent == "GeoJSON") {
      label = aTags[i];
      href = label.href;
      break;
    }
  }

  token = href.split("=")[1];
  id = href.match("videos/(.*)/track")[1];
  window.open("https://spatialnetworks.github.io/fsv-feature-mapping/?id="+id+"&token="+token);
}
else {
  alert("This only works from the Fulcrum Video viewer screen!");
}
