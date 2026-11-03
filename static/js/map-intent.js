/*
 * js/map-intent.js
 * Map page only. Other pages send people here with ?map=<action> and this script does the action
 * once the person is inside the map view:
 *   ?map=locate&lon=..&lat=..    zoom to a point and flash it
 *   ?map=state&si=<index>        show one state
 *   ?map=reshape&road=<code>     edit the line of a road
 *   ?map=add&kind=site|city|town|airport|county&name=..   click on the map to place a new item
 *   ?map=road                    draw a new road
 * The links are built by the map_link tag in core/templatetags/map_links.py.
 */

(function () {
  var params = new URLSearchParams(location.search);
  var action = params.get("map");
  if (!action) return;

  var ADD_TYPES = { site: "s", city: "c", town: "t", airport: "a", county: "cty" };

  function runAction() {
    if (action === "locate") {
      var lon = parseFloat(params.get("lon")),
        lat = parseFloat(params.get("lat"));
      if (!isNaN(lon) && !isNaN(lat)) locate(lon, lat, stAt(lon, lat));
    } else if (action === "state") {
      var si = parseInt(params.get("si"), 10);
      if (si >= 0 && DATA[si]) {
        pick(si);
        zoomState(si);
        document.getElementById("mapsec").scrollIntoView({ behavior: "smooth" });
      }
    } else if (action === "reshape") {
      var road = ROADS.find(function (r) {
        return r.id === params.get("road");
      });
      if (!road) return toast("This road is not on the map yet");
      setMode("edit");
      selRoad = road;
      drawHandles();
      var xs = road.pts.map(function (p) {
          return X(p[0]);
        }),
        ys = road.pts.map(function (p) {
          return Y(p[1]);
        });
      tv = adj(fit([Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)]));
      document.getElementById("mapsec").scrollIntoView({ behavior: "smooth" });
    } else if (action === "add") {
      var name = params.get("name");
      PEND = name ? { name: name } : null;
      setMode("add:" + (ADD_TYPES[params.get("kind")] || "t"));
      document.getElementById("mapsec").scrollIntoView({ behavior: "smooth" });
    } else if (action === "road") {
      setMode("road");
      document.getElementById("mapsec").scrollIntoView({ behavior: "smooth" });
    }
  }

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var gate = document.getElementById("gate");
    var insideMap = !gate || gate.hidden;
    if (!insideMap) {
      // Choose the Map Overview card for the person (the same way #overview does)
      var overview = gate.querySelector('[data-g="nat"]');
      if (overview && tries % 5 === 1) overview.click();
    } else if (typeof ROADS !== "undefined" && ROADS.length && typeof locate === "function") {
      clearInterval(timer);
      history.replaceState(null, "", location.pathname + location.hash);
      setTimeout(runAction, 400);
    }
    if (tries > 400) clearInterval(timer);
  }, 300);
})();
