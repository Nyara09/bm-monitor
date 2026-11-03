/*
 * js/map-app.js
 * MAIN APP: map, states, counties, sites, roads, tooltips, sign-in and admin helpers.

  SHORT NAMES USED IN THIS FILE (they are globals shared by the other scripts)
    $            document.querySelector shortcut           esc(s)     escape text for HTML
    fmt(n)       number with thousands separators         toast(m)   small message at the bottom
    DATA         the 13 states (name, region, polygon, counties list)
    COUNTIES     all counties with polygon and HQ point   SITES      registration sites
    ROADS        road lines                                SUMMARY    national totals
    PL           places (cities and towns)                 XS         Excel export column map
    ADM          admin screen state (current tab, search, state filter)
    admRender()  draws the current admin tab               view       current map view
    TOOL         active map tool (edit, add road ...)     DRAW       road being drawn
    stAt(lon,lat)  which state holds this point           cntyNear(lon,lat,si)  nearest county
    inPoly(x,y,p)  point in polygon                        toGeo(lo,la)  map x/y to longitude/latitude
    X(lon) Y(lat)  longitude/latitude to map x/y           K(n)  colour key of a state name
    SF           site filter (search, county, MDA, status) REP  report header fields
    mv(id) pv(id)  read value of a form input (admin / profile)
    mf, fld      build a labelled input                    rKpi  small KPI box
 */

var CTYL = [],
  CVER = 0,
  HRV = 0,
  vq = 0,
  mvT = 0,
  lastU = 0,
  KC = {};
function mvMark() {
  svg.classList.add("mv");
  clearTimeout(mvT);
  mvT = setTimeout(function () {
    svg.classList.remove("mv");
  }, 160);
}
function schedV() {
  mvMark();
  if (!vq)
    vq = requestAnimationFrame(function () {
      vq = 0;
      setV();
    });
}
function setH(t, h) {
  if (t._h !== h) {
    t._h = h;
    t.innerHTML = h;
  }
}
var GC1 = [1.00662, -0.00227, -0.17001, 0.00439, 1.01383, -0.10104];
function toGeo(lo, la) {
  var g = GC1;
  return [+(g[0] * lo + g[1] * la + g[2]).toFixed(5), +(g[3] * lo + g[4] * la + g[5]).toFixed(5)];
}
function fromGeo(lo, la) {
  var g = GC1,
    x = lo - g[2],
    y = la - g[5],
    d = g[0] * g[4] - g[1] * g[3];
  return [+((g[4] * x - g[1] * y) / d).toFixed(4), +((g[0] * y - g[3] * x) / d).toFixed(4)];
}
var SCL = [];
var AR = 470 / 600;
function adj(b) {
  var cx = b[0] + b[2] / 2,
    cy = b[1] + b[3] / 2,
    w = b[2],
    h = b[3];
  if (h / w < AR) h = w * AR;
  else w = h / AR;
  return [cx - w / 2, cy - h / 2, w, h];
}
function cl2(x, y, w, h) {
  return [
    w >= 600 ? (600 - w) / 2 : Math.max(0, Math.min(600 - w, x)),
    h >= 470 ? (470 - h) / 2 : Math.max(0, Math.min(470 - h, y)),
  ];
}
var SHOWST = false;
var SITES = [],
  ROADS = [],
  TOOL = null,
  GS = [],
  GSP = [],
  HND = [],
  RDL = [],
  SAVEKEY = "bioreg.v2";
var ALIAS = {
  kuacjok: "kuajok",
  nasser: "luakpinynasir",
  terakeka: "terekeka",
  kapoetasouth: "kapoeta",
};
function K(n) {
  var c = KC[n];
  if (c !== undefined) return c;
  var k = String(n)
    .toLowerCase()
    .replace(/administrative area|\btown\b|\btc\b|\bcentre\b|\bcenter\b|\briver\b/g, "")
    .replace(/[^a-z]/g, "");
  return (KC[n] = ALIAS[k] || k);
}
var FLT = "all",
  BBW = [],
  SH = {
    "Northern Bahr el Ghazal": "N. Bahr el Ghazal",
    "Western Bahr el Ghazal": "W. Bahr el Ghazal",
    "Abyei Administrative Area": "Abyei",
    "Greater Pibor Administrative Area": "Pibor",
    "Ruweng Administrative Area": "Ruweng",
  },
  PLANE =
    "M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z";
// ===== REPLACE THESE FIGURES WITH REAL BIOMETRIC DATA =====
// poly: approximate [lon,lat] outline (schematic, replace with official boundaries if needed)
const DATA = [
  {
    n: "Central Equatoria",
    rg: "Equatoria",
    hq: "Juba",
    ph: 1,
    ss: "Low Risk",
    sf: "Safer",
    ac: "Easily Accessible",
    cty: [
      [
        "Juba",
        11277,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible all the time",
        "Road transport recommended",
        "Road",
      ],
      [
        "Lainya",
        68,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by road but not all times due to insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Morobo",
        184,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by road but not all times due to insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Kajo-Keji",
        100,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Terekeka",
        467,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by road from Juba using Bahr Ghazal Highway",
        "Road transport recommended",
        "Road",
      ],
      [
        "Yei River",
        821,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by air from Juba",
        "Air transport recommended",
        "Air",
      ],
    ],
    t: 12917,
    nc: 6,
    poly: [
      [29.714, 4.454],
      [29.729, 4.452],
      [29.92, 4.56],
      [30.051, 4.551],
      [30.18, 4.61],
      [30.27, 4.59],
      [30.37, 4.526],
      [30.386, 4.524],
      [30.479, 4.572],
      [30.51, 4.7],
      [30.823, 4.827],
      [30.832, 4.836],
      [30.869, 4.919],
      [30.86, 5.01],
      [30.928, 5.101],
      [30.89, 5.25],
      [30.96, 5.285],
      [30.986, 5.457],
      [30.976, 5.466],
      [30.63, 5.62],
      [30.32, 5.93],
      [30.32, 5.96],
      [30.5, 5.972],
      [30.546, 6.034],
      [30.59, 6.11],
      [31.002, 5.78],
      [31.595, 5.75],
      [31.62, 5.769],
      [31.626, 5.784],
      [31.591, 5.85],
      [31.597, 5.887],
      [31.645, 5.77],
      [31.657, 5.76],
      [32.069, 5.75],
      [32.087, 5.733],
      [32.099, 5.73],
      [32.07, 5.101],
      [32.15, 4.84],
      [32.11, 4.46],
      [32.029, 4.42],
      [32.021, 4.409],
      [32.022, 4.394],
      [32.04, 4.37],
      [32.05, 4.17],
      [32.02, 4.13],
      [31.983, 4.13],
      [31.97, 4.121],
      [31.95, 4.0],
      [31.719, 3.908],
      [31.709, 3.898],
      [31.708, 3.881],
      [31.78, 3.711],
      [31.799, 3.686],
      [31.777, 3.683],
      [31.691, 3.6],
      [31.654, 3.589],
      [31.611, 3.607],
      [31.598, 3.607],
      [31.541, 3.567],
      [31.5, 3.527],
      [31.482, 3.523],
      [31.466, 3.531],
      [31.451, 3.555],
      [31.264, 3.668],
      [31.248, 3.673],
      [31.153, 3.672],
      [31.009, 3.578],
      [30.969, 3.579],
      [30.957, 3.573],
      [30.947, 3.557],
      [30.941, 3.528],
      [30.886, 3.459],
      [30.855, 3.383],
      [30.836, 3.37],
      [30.819, 3.371],
      [30.8, 3.382],
      [30.793, 3.404],
      [30.795, 3.455],
      [30.762, 3.473],
      [30.729, 3.51],
      [30.692, 3.503],
      [30.646, 3.517],
      [30.573, 3.48],
      [30.531, 3.478],
      [30.51, 3.492],
      [30.502, 3.508],
      [30.531, 3.593],
      [30.504, 3.735],
      [30.488, 3.743],
      [30.451, 3.737],
      [30.41, 3.758],
      [30.386, 3.76],
      [30.345, 3.794],
      [30.277, 3.815],
      [30.247, 3.831],
      [30.195, 3.818],
      [30.163, 3.84],
      [30.15, 3.862],
      [30.15, 3.901],
      [30.111, 3.947],
      [30.102, 3.986],
      [30.047, 3.996],
      [30.019, 4.014],
      [29.988, 4.08],
      [29.961, 4.099],
      [29.92, 4.114],
      [29.898, 4.13],
      [29.893, 4.15],
      [29.907, 4.182],
      [29.902, 4.197],
      [29.866, 4.217],
      [29.807, 4.217],
      [29.756, 4.253],
      [29.747, 4.283],
      [29.752, 4.373],
      [29.745, 4.407],
      [29.747, 4.433],
      [29.736, 4.444],
      [29.696, 4.455],
      [29.679, 4.48],
    ],
  },
  {
    n: "Western Equatoria",
    rg: "Equatoria",
    hq: "Yambio",
    ph: 2,
    ss: "Risk",
    sf: "Safe",
    ac: "Accessible",
    cty: [
      [
        "Yambio",
        8134,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Tambura",
        80,
        3,
        "High Risk",
        "Unsafe",
        "In Accessible",
        "Unsafe and inaccessible due to insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Nzara",
        10,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accesible by road from Yambio town",
        "Road transport recommended",
        "Road",
      ],
      [
        "Maridi",
        339,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Mundri East",
        69,
        3,
        "High Risk",
        "Unsafe",
        "",
        "Unsafe and inaccessible due to insecurity and bad road conditions",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Mundri West",
        138,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Mundri",
        47,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Mvolo",
        41,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Nagero",
        20,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Ibba",
        23,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by road from Maridi",
        "Road transport recommended",
        "Road",
      ],
      [
        "Ezo",
        38,
        3,
        "High Risk",
        "Unsafe",
        "",
        "Unsafe and inaccessible due to insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
    ],
    t: 8939,
    nc: 11,
    poly: [
      [26.27, 6.404],
      [26.297, 6.429],
      [26.309, 6.459],
      [26.327, 6.476],
      [26.336, 6.508],
      [26.361, 6.522],
      [26.373, 6.538],
      [26.373, 6.557],
      [26.356, 6.571],
      [26.496, 6.57],
      [26.88, 6.61],
      [27.919, 6.7],
      [28.082, 6.63],
      [28.123, 6.632],
      [28.14, 6.65],
      [28.47, 6.66],
      [28.5, 6.63],
      [28.479, 6.326],
      [28.481, 6.166],
      [28.515, 6.081],
      [28.53, 6.07],
      [28.559, 5.976],
      [28.569, 5.968],
      [28.64, 5.95],
      [28.803, 5.699],
      [29.002, 5.6],
      [29.543, 5.563],
      [29.554, 5.576],
      [29.62, 5.85],
      [29.779, 5.974],
      [29.79, 6.18],
      [29.87, 6.18],
      [29.96, 6.24],
      [30.03, 6.23],
      [30.12, 6.14],
      [30.169, 6.07],
      [30.27, 5.97],
      [30.3, 5.96],
      [30.629, 5.621],
      [30.99, 5.46],
      [30.96, 5.28],
      [30.904, 5.256],
      [30.894, 5.241],
      [30.93, 5.1],
      [30.871, 5.024],
      [30.87, 4.92],
      [30.83, 4.83],
      [30.516, 4.702],
      [30.508, 4.69],
      [30.48, 4.57],
      [30.38, 4.52],
      [30.27, 4.59],
      [30.181, 4.609],
      [30.05, 4.55],
      [29.919, 4.559],
      [29.79, 4.47],
      [29.72, 4.45],
      [29.631, 4.514],
      [29.591, 4.534],
      [29.489, 4.543],
      [29.476, 4.532],
      [29.475, 4.486],
      [29.447, 4.454],
      [29.439, 4.414],
      [29.405, 4.369],
      [29.355, 4.341],
      [29.335, 4.287],
      [29.311, 4.266],
      [29.291, 4.257],
      [29.26, 4.257],
      [29.238, 4.23],
      [29.197, 4.217],
      [29.164, 4.227],
      [29.083, 4.308],
      [29.044, 4.319],
      [28.991, 4.358],
      [28.883, 4.351],
      [28.851, 4.361],
      [28.804, 4.354],
      [28.764, 4.383],
      [28.752, 4.416],
      [28.734, 4.421],
      [28.706, 4.409],
      [28.7, 4.381],
      [28.656, 4.307],
      [28.601, 4.292],
      [28.568, 4.26],
      [28.53, 4.261],
      [28.504, 4.254],
      [28.475, 4.201],
      [28.429, 4.171],
      [28.41, 4.164],
      [28.351, 4.161],
      [28.324, 4.184],
      [28.322, 4.223],
      [28.312, 4.235],
      [28.264, 4.239],
      [28.234, 4.228],
      [28.172, 4.236],
      [28.137, 4.268],
      [28.101, 4.282],
      [28.079, 4.313],
      [28.035, 4.325],
      [28.006, 4.345],
      [27.988, 4.383],
      [27.988, 4.422],
      [27.978, 4.435],
      [27.955, 4.44],
      [27.878, 4.433],
      [27.842, 4.436],
      [27.784, 4.477],
      [27.746, 4.492],
      [27.737, 4.51],
      [27.742, 4.536],
      [27.73, 4.593],
      [27.731, 4.613],
      [27.742, 4.636],
      [27.736, 4.664],
      [27.723, 4.672],
      [27.691, 4.672],
      [27.679, 4.68],
      [27.661, 4.703],
      [27.66, 4.735],
      [27.635, 4.775],
      [27.567, 4.776],
      [27.51, 4.807],
      [27.487, 4.842],
      [27.478, 4.873],
      [27.409, 4.913],
      [27.402, 4.931],
      [27.414, 4.957],
      [27.411, 4.972],
      [27.372, 5.014],
      [27.36, 5.04],
      [27.321, 5.079],
      [27.295, 5.09],
      [27.268, 5.124],
      [27.259, 5.156],
      [27.214, 5.225],
      [27.196, 5.341],
      [27.239, 5.453],
      [27.233, 5.465],
      [27.205, 5.487],
      [27.196, 5.513],
      [27.197, 5.536],
      [27.176, 5.599],
      [27.159, 5.617],
      [27.123, 5.634],
      [27.109, 5.655],
      [27.088, 5.67],
      [27.029, 5.677],
      [27.0, 5.709],
      [26.981, 5.739],
      [26.94, 5.749],
      [26.903, 5.773],
      [26.861, 5.782],
      [26.843, 5.792],
      [26.825, 5.816],
      [26.819, 5.852],
      [26.804, 5.876],
      [26.787, 5.889],
      [26.723, 5.893],
      [26.69, 5.88],
      [26.66, 5.878],
      [26.606, 5.906],
      [26.563, 5.914],
      [26.537, 5.927],
      [26.498, 5.977],
      [26.483, 5.977],
      [26.457, 5.959],
      [26.431, 5.965],
      [26.415, 5.988],
      [26.415, 6.006],
      [26.436, 6.043],
      [26.469, 6.073],
      [26.474, 6.086],
      [26.471, 6.099],
      [26.45, 6.12],
      [26.446, 6.175],
      [26.431, 6.187],
      [26.379, 6.195],
      [26.318, 6.262],
      [26.289, 6.277],
      [26.273, 6.314],
      [26.275, 6.339],
      [26.262, 6.364],
    ],
  },
  {
    n: "Eastern Equatoria",
    rg: "Equatoria",
    hq: "Torit",
    ph: 1,
    ss: "Low Risk",
    sf: "Safer",
    ac: "Easily Accessible",
    cty: [
      [
        "Torit",
        6617,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Torit town Safer and easily accessible by air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Magwi",
        182,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Magwi town Safer and easily accessible by road from Juba",
        "Road transport recommended.",
        "Road",
      ],
      [
        "Kapoeta East",
        14,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Narus town safe and accessible but not all times due to insecurity",
        "Road transport recommended with approval from Security focal person at state level",
        "Road",
      ],
      [
        "Kapoeta South",
        84,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Kapoeta North",
        11,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Ruwato town safe and accessible by road from Kapoeta South",
        "Road transport recommended",
        "Road",
      ],
      [
        "Ikotos",
        31,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Ikotos town safe and accessible by road from Torit but not all times sue to insecurity",
        "Road transport recommended with approval from Security focal person at state level",
        "Road",
      ],
      [
        "Lafon",
        25,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Lafon town Safer and easily accessible by air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Budi",
        36,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Chukudum Safer and easily accessible by air from Juba",
        "Air transport recommended",
        "Air",
      ],
    ],
    t: 7000,
    nc: 8,
    poly: [
      [31.944, 3.999],
      [31.952, 4.011],
      [31.97, 4.13],
      [32.02, 4.133],
      [32.049, 4.171],
      [32.04, 4.366],
      [32.01, 4.41],
      [32.102, 4.456],
      [32.11, 4.467],
      [32.15, 4.838],
      [32.07, 5.1],
      [32.1, 5.73],
      [32.6, 5.739],
      [33.269, 5.73],
      [34.11, 5.62],
      [34.954, 5.895],
      [34.966, 5.913],
      [34.952, 5.982],
      [34.97, 5.967],
      [34.976, 5.955],
      [34.972, 5.92],
      [34.985, 5.878],
      [34.972, 5.824],
      [34.994, 5.761],
      [35.105, 5.584],
      [35.105, 5.519],
      [35.271, 5.407],
      [35.284, 5.393],
      [35.295, 5.349],
      [35.274, 5.292],
      [35.272, 5.27],
      [35.279, 5.258],
      [35.301, 5.254],
      [35.39, 5.296],
      [35.417, 5.318],
      [35.465, 5.33],
      [35.533, 5.328],
      [35.557, 5.319],
      [35.584, 5.294],
      [35.678, 5.302],
      [35.753, 5.256],
      [35.804, 5.241],
      [35.829, 5.221],
      [35.837, 5.205],
      [35.834, 5.167],
      [35.812, 5.148],
      [35.806, 5.133],
      [35.832, 5.089],
      [35.838, 5.051],
      [35.83, 5.031],
      [35.791, 4.979],
      [35.793, 4.688],
      [35.921, 4.531],
      [35.924, 4.513],
      [35.914, 4.497],
      [35.9, 4.493],
      [35.569, 4.49],
      [34.354, 4.487],
      [34.069, 4.187],
      [33.983, 4.117],
      [33.831, 3.976],
      [33.51, 3.651],
      [33.48, 3.632],
      [33.136, 3.655],
      [33.001, 3.753],
      [32.986, 3.757],
      [32.877, 3.692],
      [32.713, 3.649],
      [32.391, 3.621],
      [32.213, 3.503],
      [32.207, 3.49],
      [32.21, 3.463],
      [32.2, 3.441],
      [32.193, 3.401],
      [32.181, 3.388],
      [32.164, 3.386],
      [32.045, 3.419],
      [32.013, 3.463],
      [31.965, 3.459],
      [31.92, 3.468],
      [31.907, 3.478],
      [31.896, 3.513],
      [31.896, 3.561],
      [31.78, 3.71],
      [31.7, 3.9],
    ],
  },
  {
    n: "Lakes",
    rg: "Bahr el Ghazal",
    hq: "Rumbek",
    ph: 1,
    ss: "Low Risk",
    sf: "Safer",
    ac: "Easily Accessible",
    cty: [
      [
        "Rumbek Centre",
        16146,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible both linked to Juba by air and road",
        "Ait transport Recommended",
        "",
      ],
      [
        "Rumbek East",
        279,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible from Juba via Yirol west by road",
        "Road transport recommended",
        "Road",
      ],
      [
        "Rumbek North",
        107,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to bad road condition and insecurity",
        "Road transport recommended in consultation with Security focal person.",
        "Road",
      ],
      [
        "Cueibet",
        308,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible from Rumbek Center by road",
        "Road transport recommended",
        "Road",
      ],
      ["Gok", 42, 0, "?", "?", "?", "Exist in old 32 states", "Not Sure", ""],
      [
        "Wulu",
        122,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible from Rumbek town by road",
        "Road transport recommended",
        "Road",
      ],
      [
        "Yirol",
        355,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by road from Juba using Bahr Ghazal Highway",
        "Road transport recommended",
        "Road",
      ],
      [
        "Yirol East",
        69,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by road from Juba using Bahr Ghazal Highway",
        "Road transport recommended",
        "Road",
      ],
      [
        "Yirol West",
        4,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by road from Juba using Bahr Ghazal Highway",
        "Staff requested to travel and get registered in Yirol town",
        "",
      ],
      [
        "Awerial",
        131,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by road from Juba using Bahr Ghazal Highway",
        "Road transport recommended",
        "Road",
      ],
    ],
    t: 17563,
    nc: 10,
    poly: [
      [28.5, 6.623],
      [28.482, 6.649],
      [28.882, 6.64],
      [28.895, 6.644],
      [28.953, 6.702],
      [28.957, 6.716],
      [28.87, 6.94],
      [29.09, 7.29],
      [29.33, 7.53],
      [29.54, 7.57],
      [29.693, 7.713],
      [29.7, 7.73],
      [29.732, 7.7],
      [29.92, 7.65],
      [30.174, 7.083],
      [30.68, 7.08],
      [31.18, 6.68],
      [31.46, 6.219],
      [31.6, 5.91],
      [31.591, 5.849],
      [31.63, 5.78],
      [31.6, 5.75],
      [31.0, 5.78],
      [30.603, 6.096],
      [30.586, 6.09],
      [30.5, 5.97],
      [30.336, 5.961],
      [30.324, 5.955],
      [30.319, 5.941],
      [30.3, 5.959],
      [30.28, 5.96],
      [30.14, 6.1],
      [30.12, 6.14],
      [30.034, 6.226],
      [29.963, 6.239],
      [29.87, 6.18],
      [29.807, 6.18],
      [29.792, 6.17],
      [29.78, 5.97],
      [29.621, 5.848],
      [29.55, 5.56],
      [29.0, 5.6],
      [28.8, 5.7],
      [28.642, 5.946],
      [28.56, 5.97],
      [28.48, 6.17],
      [28.48, 6.36],
    ],
  },
  {
    n: "Warrap",
    rg: "Bahr el Ghazal",
    hq: "Kuajok",
    ph: 2,
    ss: "Risk",
    sf: "Safe",
    ac: "Accessible",
    cty: [
      [
        "Kuajok",
        10765,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by road from Wau town",
        "Air transport recommended from Juba to Wau and road from Wau to Kuajok",
        "Air",
      ],
      [
        "Twic",
        240,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by road from Kuajok",
        "Road transport recommended",
        "Road",
      ],
      [
        "Gogrial West",
        181,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by road from Wau town",
        "Road transport recommended",
        "Road",
      ],
      [
        "Gogrial East",
        181,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by road from Gogrial West or Kuajok",
        "Road transport recommended",
        "Road",
      ],
      [
        "Tonj North",
        145,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to persistent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Tonj South",
        4224,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to persistent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Tonj East",
        81,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to persistent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
    ],
    t: 15817,
    nc: 7,
    poly: [
      [27.89, 8.16],
      [27.92, 8.214],
      [27.92, 8.36],
      [27.968, 8.439],
      [27.94, 8.53],
      [28.001, 8.574],
      [28.008, 8.588],
      [27.979, 8.75],
      [27.89, 8.85],
      [28.08, 9.21],
      [28.79, 9.2],
      [28.82, 9.17],
      [28.8, 8.98],
      [28.768, 8.937],
      [28.764, 8.917],
      [28.77, 8.905],
      [28.784, 8.899],
      [29.11, 8.89],
      [29.281, 8.55],
      [29.65, 8.26],
      [29.7, 7.72],
      [29.54, 7.57],
      [29.329, 7.528],
      [29.09, 7.29],
      [28.873, 6.943],
      [28.96, 6.71],
      [28.89, 6.64],
      [28.49, 6.65],
      [28.48, 7.06],
      [28.527, 7.311],
      [28.3, 7.53],
      [28.308, 7.662],
      [28.162, 7.887],
      [27.87, 7.97],
    ],
  },
  {
    n: "Northern Bahr el Ghazal",
    rg: "Bahr el Ghazal",
    hq: "Aweil",
    ph: 1,
    ss: "Low Risk",
    sf: "Safer",
    ac: "Easily Accessible",
    cty: [
      [
        "Aweil Centre",
        10012,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Aweil town safer and easily accessible by air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Aweil East",
        302,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by road from Aweil town",
        "Road transport recommended",
        "Road",
      ],
      [
        "Aweil North",
        213,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by road from Aweil town",
        "Road transport recommended",
        "Road",
      ],
      [
        "Aweil South",
        166,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by road from Aweil town",
        "Road transport recommended",
        "Road",
      ],
      [
        "Aweil West",
        180,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by road from Aweil town",
        "Road transport recommended",
        "Road",
      ],
    ],
    t: 10873,
    nc: 5,
    poly: [
      [26.29, 9.79],
      [26.397, 9.53],
      [26.416, 9.505],
      [26.444, 9.489],
      [26.643, 9.422],
      [26.745, 9.401],
      [26.786, 9.405],
      [26.881, 9.434],
      [27.037, 9.499],
      [27.18, 9.527],
      [27.361, 9.525],
      [27.83, 9.5],
      [27.83, 9.28],
      [27.83, 9.26],
      [27.85, 9.26],
      [28.1, 9.26],
      [28.089, 9.233],
      [28.102, 9.21],
      [28.084, 9.209],
      [28.074, 9.2],
      [27.897, 8.852],
      [27.9, 8.838],
      [27.98, 8.75],
      [28.009, 8.58],
      [27.944, 8.528],
      [27.969, 8.44],
      [27.92, 8.358],
      [27.919, 8.224],
      [27.913, 8.313],
      [27.903, 8.325],
      [27.888, 8.327],
      [27.72, 8.17],
      [27.37, 8.08],
      [26.83, 7.79],
      [26.3, 8.11],
      [26.17, 8.97],
    ],
  },
  {
    n: "Western Bahr el Ghazal",
    rg: "Bahr el Ghazal",
    hq: "Wau",
    ph: 1,
    ss: "Low Risk",
    sf: "Safer",
    ac: "Easily Accessible",
    cty: [
      [
        "Wau",
        10827,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessisble by air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Jur River",
        0,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and Accessible by road from Wau town",
        "No need for the team to travel to the location",
        "",
      ],
      [
        "Raja",
        0,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due bad road condition, farness and Insecurity",
        "No need for the team to travel to the location",
        "",
      ],
    ],
    t: 10827,
    nc: 3,
    poly: [
      [24.185, 8.419],
      [24.256, 8.528],
      [24.24, 8.579],
      [24.246, 8.598],
      [24.278, 8.614],
      [24.411, 8.744],
      [24.555, 8.798],
      [24.6, 8.859],
      [24.598, 8.897],
      [24.57, 8.996],
      [24.596, 9.117],
      [24.623, 9.19],
      [24.652, 9.245],
      [24.631, 9.294],
      [24.631, 9.315],
      [24.644, 9.332],
      [24.697, 9.363],
      [24.75, 9.406],
      [24.791, 9.449],
      [24.791, 9.505],
      [24.772, 9.549],
      [24.781, 9.594],
      [24.776, 9.633],
      [24.763, 9.662],
      [24.765, 9.681],
      [24.793, 9.709],
      [24.817, 9.718],
      [24.857, 9.749],
      [24.876, 9.787],
      [24.907, 9.819],
      [24.999, 9.873],
      [25.104, 10.025],
      [25.106, 10.044],
      [25.082, 10.077],
      [25.08, 10.097],
      [25.096, 10.135],
      [25.159, 10.242],
      [25.216, 10.271],
      [25.261, 10.271],
      [25.285, 10.283],
      [25.41, 10.276],
      [25.452, 10.294],
      [25.539, 10.305],
      [25.614, 10.293],
      [25.683, 10.317],
      [25.769, 10.336],
      [25.846, 10.334],
      [25.88, 10.358],
      [25.948, 10.356],
      [26.001, 10.327],
      [26.02, 10.307],
      [26.03, 10.272],
      [26.027, 10.103],
      [26.092, 10.067],
      [26.134, 10.028],
      [26.161, 9.979],
      [26.258, 9.851],
      [26.291, 9.82],
      [26.343, 9.663],
      [26.315, 9.729],
      [26.301, 9.737],
      [26.287, 9.732],
      [26.279, 9.719],
      [26.182, 8.89],
      [26.312, 8.104],
      [26.815, 7.798],
      [26.829, 7.796],
      [27.37, 8.08],
      [27.719, 8.17],
      [27.91, 8.35],
      [27.92, 8.21],
      [27.89, 8.158],
      [27.874, 7.975],
      [27.886, 7.965],
      [28.16, 7.89],
      [28.31, 7.66],
      [28.301, 7.539],
      [28.304, 7.526],
      [28.53, 7.31],
      [28.48, 7.06],
      [28.49, 6.65],
      [28.08, 6.63],
      [27.897, 6.698],
      [26.966, 6.618],
      [26.391, 6.56],
      [26.304, 6.588],
      [26.27, 6.587],
      [26.246, 6.601],
      [26.227, 6.628],
      [26.195, 6.641],
      [26.155, 6.701],
      [26.107, 6.699],
      [26.056, 6.727],
      [26.05, 6.745],
      [26.061, 6.794],
      [26.035, 6.827],
      [26.025, 6.88],
      [26.018, 6.891],
      [25.995, 6.9],
      [25.971, 6.921],
      [25.937, 6.934],
      [25.907, 6.971],
      [25.875, 6.969],
      [25.857, 6.978],
      [25.817, 7.018],
      [25.802, 7.043],
      [25.747, 7.072],
      [25.711, 7.085],
      [25.684, 7.085],
      [25.642, 7.111],
      [25.621, 7.115],
      [25.513, 7.19],
      [25.49, 7.2],
      [25.455, 7.202],
      [25.423, 7.224],
      [25.398, 7.226],
      [25.358, 7.248],
      [25.336, 7.287],
      [25.328, 7.323],
      [25.286, 7.359],
      [25.201, 7.399],
      [25.187, 7.436],
      [25.181, 7.471],
      [25.161, 7.495],
      [25.161, 7.513],
      [25.237, 7.575],
      [25.276, 7.589],
      [25.283, 7.605],
      [25.275, 7.659],
      [25.28, 7.691],
      [25.256, 7.72],
      [25.241, 7.759],
      [25.209, 7.796],
      [25.186, 7.809],
      [25.126, 7.798],
      [25.093, 7.806],
      [25.057, 7.839],
      [24.989, 7.863],
      [24.958, 7.936],
      [24.908, 7.965],
      [24.888, 8.051],
      [24.873, 8.07],
      [24.788, 8.086],
      [24.746, 8.113],
      [24.673, 8.127],
      [24.636, 8.124],
      [24.595, 8.111],
      [24.564, 8.119],
      [24.512, 8.151],
      [24.496, 8.182],
      [24.483, 8.19],
      [24.446, 8.185],
      [24.391, 8.164],
      [24.251, 8.209],
      [24.219, 8.23],
      [24.166, 8.307],
      [24.163, 8.344],
      [24.179, 8.374],
    ],
  },
  {
    n: "Abyei Administrative Area",
    rg: "Bahr el Ghazal",
    hq: "Abyei",
    ph: 2,
    ss: "Risk",
    sf: "Safe",
    ac: "Accessible",
    cty: [
      [
        "Abyei",
        2145,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible from Juba or Wau by flight",
        "Air transport recommended",
        "Air",
      ],
      [
        "Alal",
        35,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to insecurity",
        "Require futher discussion with security focal person at state level",
        "",
      ],
      [
        "Majak",
        49,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by road from Abyei town",
        "Road transport recommended",
        "Road",
      ],
      [
        "Rumameer",
        50,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by road from Abyei town",
        "Road transport recommended",
        "Road",
      ],
      [
        "Amethaguok",
        30,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by air from Juba and Wau and by road from Abyei town",
        "Road transport recommended",
        "Road",
      ],
    ],
    t: 2309,
    nc: 5,
    poly: [
      [27.83, 10.06],
      [29.0, 10.06],
      [29.0, 9.26],
      [27.83, 9.26],
    ],
    admin: 1,
  },
  {
    n: "Upper Nile",
    rg: "Upper Nile",
    hq: "Malakal",
    ph: 3,
    ss: "High Risk",
    sf: "Unsafe",
    ac: "Inaccessible",
    cty: [
      [
        "Malakal",
        14671,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by air from Juba",
        "Air transport Recommended",
        "Air",
      ],
      [
        "Fashoda",
        65,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by river from Malakal town",
        "River transport recommended with approval from Security focal person",
        "River",
      ],
      [
        "Manyo",
        236,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by river from Malakal town",
        "River transport recommended with approval from Security focal person",
        "River",
      ],
      [
        "Renk",
        209,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by air from Juba",
        "Air transport Recommended",
        "Air",
      ],
      [
        "Melut",
        39,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by both air and river transports",
        "Air transport recommended",
        "Air",
      ],
      [
        "Baliet",
        101,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to recurent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Panyikang",
        79,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to recurent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Longochuk",
        64,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to recurent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Maiwut",
        730,
        3,
        "High Risk",
        "Undafe",
        "Inccessible",
        "Unsafe and inaccessible due to recurent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Luakpiny/Nasir",
        117,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to recurent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Nasir/Malual Gahoth",
        0,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to recurent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Ulang",
        80,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to recurent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Akoka",
        14,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by river using speed motor boat from Malakal town",
        "River transport recommended with approval from Security focal person",
        "River",
      ],
      [
        "Maban",
        56,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by using flights from Juba",
        "Air transport recommended",
        "Air",
      ],
    ],
    t: 16461,
    nc: 14,
    poly: [
      [30.75, 9.45],
      [30.826, 9.5],
      [30.82, 9.57],
      [30.89, 9.6],
      [31.262, 9.615],
      [31.292, 9.625],
      [31.325, 9.65],
      [31.482, 9.847],
      [31.693, 10.083],
      [31.754, 10.14],
      [31.819, 10.239],
      [31.92, 10.431],
      [31.958, 10.486],
      [32.118, 10.579],
      [32.401, 10.86],
      [32.402, 10.877],
      [32.354, 10.975],
      [32.344, 11.025],
      [32.341, 11.484],
      [32.321, 11.509],
      [32.074, 11.727],
      [32.067, 11.744],
      [32.073, 11.761],
      [32.092, 11.769],
      [32.687, 11.773],
      [32.7, 11.792],
      [32.7, 11.867],
      [32.685, 11.945],
      [32.69, 11.992],
      [32.679, 12.033],
      [32.686, 12.048],
      [32.703, 12.058],
      [33.255, 12.036],
      [33.271, 12.029],
      [33.28, 12.001],
      [33.254, 11.961],
      [33.202, 11.763],
      [33.161, 11.536],
      [33.123, 11.424],
      [33.25, 10.645],
      [33.223, 10.572],
      [33.235, 10.558],
      [33.453, 10.493],
      [33.72, 10.211],
      [33.765, 10.173],
      [33.859, 10.018],
      [33.909, 10.007],
      [33.942, 9.98],
      [33.943, 9.928],
      [33.968, 9.888],
      [33.968, 9.811],
      [33.961, 9.787],
      [33.968, 9.743],
      [33.944, 9.664],
      [33.937, 9.62],
      [33.918, 9.589],
      [33.891, 9.565],
      [33.87, 9.478],
      [33.864, 9.379],
      [33.87, 9.362],
      [33.883, 9.355],
      [34.066, 9.354],
      [34.08, 9.345],
      [34.087, 9.326],
      [34.116, 8.89],
      [34.119, 8.465],
      [34.111, 8.427],
      [34.072, 8.379],
      [33.98, 8.307],
      [33.963, 8.303],
      [33.893, 8.31],
      [33.87, 8.304],
      [33.835, 8.258],
      [33.804, 8.248],
      [33.784, 8.223],
      [33.727, 8.182],
      [33.668, 8.182],
      [33.634, 8.199],
      [33.625, 8.21],
      [33.613, 8.246],
      [33.586, 8.272],
      [33.558, 8.261],
      [33.527, 8.264],
      [33.495, 8.282],
      [33.463, 8.287],
      [33.419, 8.259],
      [33.385, 8.255],
      [33.356, 8.239],
      [33.29, 8.261],
      [33.229, 8.262],
      [33.198, 8.229],
      [33.203, 8.185],
      [33.177, 8.12],
      [33.19, 8.078],
      [33.181, 8.05],
      [33.165, 8.027],
      [33.179, 7.978],
      [33.172, 7.958],
      [33.155, 7.945],
      [33.131, 7.945],
      [33.103, 7.933],
      [33.073, 7.893],
      [33.06, 7.856],
      [33.02, 7.83],
      [32.82, 7.83],
      [32.8, 7.87],
      [32.804, 7.901],
      [32.869, 8.086],
      [32.875, 8.118],
      [32.866, 8.128],
      [32.6, 8.28],
      [32.492, 8.721],
      [32.482, 8.733],
      [32.38, 8.77],
      [32.366, 8.875],
      [32.359, 8.887],
      [32.346, 8.891],
      [32.332, 8.885],
      [32.24, 8.77],
      [31.94, 8.56],
      [31.82, 8.67],
      [31.75, 8.86],
      [31.73, 8.93],
      [31.783, 8.984],
      [31.788, 8.995],
      [31.764, 9.096],
      [31.755, 9.108],
      [31.61, 9.12],
      [31.529, 9.206],
      [31.43, 9.17],
      [31.171, 9.25],
      [31.159, 9.259],
      [31.016, 9.306],
      [30.75, 9.34],
    ],
  },
  {
    n: "Jonglei",
    rg: "Upper Nile",
    hq: "Bor",
    ph: 3,
    ss: "High Risk",
    sf: "Unsafe",
    ac: "Inaccessible",
    cty: [
      [
        "Bor Town",
        1131,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by Air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Bor South",
        13475,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by Air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Twic East",
        427,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Duk",
        265,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to persistent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Nyirol",
        11,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to persistent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Uror",
        11,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to persistent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Akobo",
        125,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to persistent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Ayod",
        29,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to persistent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Fangak",
        219,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to persistent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Canal/Pigi",
        91,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to persistent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Pochalla",
        0,
        0,
        "?",
        "?",
        "?",
        "Pascolla is currently under GPAA",
        "No need for the team to travel to the location",
        "",
      ],
    ],
    t: 15784,
    nc: 11,
    poly: [
      [30.387, 9.017],
      [30.37, 9.18],
      [30.45, 9.289],
      [30.464, 9.295],
      [30.5, 9.34],
      [30.94, 9.33],
      [31.425, 9.172],
      [31.53, 9.21],
      [31.611, 9.121],
      [31.76, 9.11],
      [31.79, 8.99],
      [31.733, 8.93],
      [31.75, 8.859],
      [31.82, 8.671],
      [31.943, 8.569],
      [31.958, 8.572],
      [32.239, 8.77],
      [32.36, 8.92],
      [32.382, 8.773],
      [32.49, 8.73],
      [32.6, 8.283],
      [32.88, 8.12],
      [32.8, 7.89],
      [32.818, 7.843],
      [32.834, 7.83],
      [33.024, 7.834],
      [33.022, 7.804],
      [32.999, 7.781],
      [32.995, 7.768],
      [33.004, 7.74],
      [33.001, 7.711],
      [33.035, 7.672],
      [33.058, 7.671],
      [33.088, 7.658],
      [33.12, 7.665],
      [33.05, 7.42],
      [32.6, 7.42],
      [32.6, 5.74],
      [32.091, 5.73],
      [32.062, 5.75],
      [31.65, 5.76],
      [31.46, 6.22],
      [31.18, 6.679],
      [30.68, 7.08],
      [30.659, 7.242],
      [30.5, 7.52],
      [30.538, 7.713],
      [30.393, 7.955],
      [30.33, 7.98],
      [30.33, 8.16],
      [30.366, 8.312],
      [30.29, 8.42],
      [30.314, 8.492],
      [30.25, 8.56],
      [30.269, 8.614],
      [30.22, 8.81],
    ],
  },
  {
    n: "Unity",
    rg: "Upper Nile",
    hq: "Bentiu",
    ph: 3,
    ss: "High Risk",
    sf: "Unsafe",
    ac: "Inaccessible",
    cty: [
      [
        "Bentiu",
        5588,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by road fom Rubkona",
        "Road transport recommended",
        "Road",
      ],
      [
        "Bentiu TC",
        548,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by road fom Rubkona",
        "Road transport recommended",
        "Road",
      ],
      [
        "Rubkona",
        3188,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by Air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Koch",
        51,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to recurent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Leer",
        50,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to recurent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Mayendit",
        102,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to recurent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Panyijiar",
        12,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to recurent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Abiemnhom",
        17,
        0,
        "?",
        "?",
        "?",
        "Abiemnhom is currently under Ruweng Administrative area",
        "Staff to be registered in RAA",
        "",
      ],
      [
        "Guit",
        34,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to recurent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Mayom",
        300,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to recurent insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
    ],
    t: 9890,
    nc: 10,
    poly: [
      [28.091, 9.26],
      [29.0, 9.26],
      [29.0, 9.293],
      [29.0, 9.3],
      [30.46, 9.3],
      [30.46, 9.29],
      [30.444, 9.282],
      [30.371, 9.18],
      [30.39, 9.02],
      [30.226, 8.818],
      [30.222, 8.802],
      [30.27, 8.61],
      [30.254, 8.559],
      [30.32, 8.49],
      [30.293, 8.418],
      [30.37, 8.31],
      [30.33, 8.16],
      [30.33, 7.99],
      [30.341, 7.976],
      [30.39, 7.96],
      [30.54, 7.71],
      [30.502, 7.519],
      [30.66, 7.24],
      [30.68, 7.08],
      [30.16, 7.08],
      [29.922, 7.643],
      [29.909, 7.652],
      [29.75, 7.68],
      [29.69, 7.74],
      [29.647, 8.261],
      [29.28, 8.55],
      [29.109, 8.887],
      [28.76, 8.9],
      [28.818, 9.161],
      [28.815, 9.175],
      [28.794, 9.195],
      [28.782, 9.2],
      [28.11, 9.2],
      [28.08, 9.24],
    ],
  },
  {
    n: "Greater Pibor Administrative Area",
    rg: "Upper Nile",
    hq: "Pibor",
    ph: 3,
    ss: "High Risk",
    sf: "Unsafe",
    ac: "Inaccessible",
    cty: [
      [
        "Pibor",
        6079,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and Easily accessible by fligts from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Lekuangole",
        203,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to bad roads and insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Jebel Boma",
        42,
        2,
        "Risk",
        "Unsafe",
        "Inaccessible",
        "Safe and accessible by air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Pashal South",
        205,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Pashal North",
        232,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Verteth",
        127,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to bad roads and insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Gumuruk",
        23,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccessible due to bad roads and insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
    ],
    t: 6911,
    nc: 7,
    poly: [
      [32.6, 7.42],
      [33.05, 7.42],
      [33.12, 7.665],
      [33.208, 7.649],
      [33.299, 7.589],
      [33.387, 7.621],
      [33.482, 7.601],
      [33.508, 7.584],
      [33.536, 7.578],
      [33.558, 7.584],
      [33.586, 7.581],
      [33.613, 7.571],
      [33.636, 7.569],
      [33.659, 7.556],
      [33.718, 7.495],
      [33.769, 7.476],
      [33.824, 7.424],
      [33.838, 7.402],
      [33.895, 7.391],
      [33.922, 7.374],
      [33.928, 7.361],
      [33.927, 7.329],
      [33.96, 7.305],
      [34.011, 7.228],
      [34.014, 7.108],
      [34.061, 7.078],
      [34.081, 7.053],
      [34.157, 7.011],
      [34.171, 6.987],
      [34.179, 6.922],
      [34.205, 6.887],
      [34.315, 6.843],
      [34.433, 6.805],
      [34.498, 6.731],
      [34.513, 6.694],
      [34.508, 6.64],
      [34.516, 6.625],
      [34.551, 6.62],
      [34.581, 6.631],
      [34.603, 6.625],
      [34.674, 6.573],
      [34.688, 6.535],
      [34.734, 6.493],
      [34.81, 6.499],
      [34.847, 6.488],
      [34.867, 6.458],
      [34.906, 6.44],
      [34.927, 6.402],
      [34.982, 6.35],
      [34.993, 6.325],
      [34.993, 6.3],
      [34.967, 6.229],
      [34.958, 6.158],
      [34.934, 6.125],
      [34.949, 6.074],
      [34.943, 6.024],
      [34.97, 5.89],
      [34.11, 5.62],
      [33.271, 5.73],
      [32.6, 5.74],
    ],
    admin: 1,
  },
  {
    n: "Ruweng Administrative Area",
    rg: "Upper Nile",
    hq: "Pariang",
    ph: 2,
    ss: "Risk",
    sf: "Safe",
    ac: "Accessible",
    cty: [
      [
        "Pariang",
        4519,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by Air from Juba",
        "Air transport recommended",
        "Air",
      ],
      [
        "Jamjang",
        22,
        1,
        "Low Risk",
        "Safer",
        "Easily Accessible",
        "Safer and easily accessible by air from Juba and by road from Pariang",
        "Road transport from Pariang recommended",
        "Road",
      ],
      [
        "Lake NO",
        19,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by road",
        "Road transport recommended with approval from Security focal person at state level",
        "Road",
      ],
      [
        "Tuoch",
        15,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by road",
        "Road transport recommended with approval from Security focal person at state level",
        "Road",
      ],
      [
        "Aliny",
        9,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by road",
        "Road transport recommended with approval from Security focal person at state level",
        "Road",
      ],
      [
        "Jau",
        14,
        2,
        "Risk",
        "Safe",
        "Accessible",
        "Safe and accessible by road",
        "Road transport recommended with approval from Security focal person at state level",
        "Road",
      ],
      [
        "Blemnhom",
        94,
        0,
        "?",
        "?",
        "?",
        "Not Sure",
        "Require further discussions about the location with Public personel at State level",
        "",
      ],
      [
        "Wunkur",
        12,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccesible due to insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
      [
        "Abiemnom",
        0,
        3,
        "High Risk",
        "Unsafe",
        "Inaccessible",
        "Unsafe and inaccesible due to insecurity",
        "Require further discussions with Security focal person at state level",
        "",
      ],
    ],
    t: 4704,
    nc: 9,
    poly: [
      [29.0, 9.47],
      [29.03, 9.475],
      [30.713, 9.435],
      [30.727, 9.441],
      [30.747, 9.473],
      [30.805, 9.505],
      [30.808, 9.517],
      [30.802, 9.559],
      [30.823, 9.58],
      [30.887, 9.606],
      [31.098, 9.606],
      [30.892, 9.6],
      [30.828, 9.573],
      [30.821, 9.557],
      [30.829, 9.5],
      [30.757, 9.455],
      [30.75, 9.441],
      [30.751, 9.35],
      [30.763, 9.338],
      [30.794, 9.334],
      [30.508, 9.34],
      [30.495, 9.334],
      [30.46, 9.292],
      [30.445, 9.3],
      [29.0, 9.3],
    ],
    admin: 1,
  },
];
DATA.forEach((d) => {
  d.r = 0;
  d.s = 0;
  d.p = 0;
  d.o = d.ss;
  d.cty = d.cty.map((a) => ({
    n: a[0],
    e: a[1],
    ph: a[2],
    st: a[3],
    sf: a[4],
    ac: a[5],
    rm: a[6],
    rc: a[7],
    md: a[8],
  }));
});
const SUMMARY = {
  emp: 139995,
  states: 13,
  cty: 106,
  ok: 72,
  bad: 34,
  air: 29,
  road: 29,
  river: 9,
};
const MAXT = Math.max(...DATA.map((d) => d.t));
const $ = (s) => document.querySelector(s),
  fmt = (n) => n.toLocaleString("en-US"),
  NS = "http://www.w3.org/2000/svg";
const pct = (d) => (d.t / MAXT) * 100,
  col = (d) => (d.ph == 1 ? "var(--g)" : d.ph == 2 ? "var(--a)" : "var(--r)");
const stat = (d) => d.ss;
const X = (l) => (l - 24) * 47 + 15,
  Y = (l) => (12.4 - l) * 50 + 10;
let sel = null,
  yest = 0;
function totals() {
  const T = DATA.reduce((a, d) => ((a.t += d.t), (a.r += d.r), (a.s += d.s), a), {
    t: 0,
    r: 0,
    s: 0,
  });
  T.rem = T.t - T.r;
  return T;
}
const day0 = 1;
// map
DATA.forEach((d, i) => {
  const pts = d.poly.map((p) => X(p[0]) + "," + Y(p[1])).join(" ");
  const g = document.createElementNS(NS, "polygon");
  g.setAttribute("points", pts);
  g.setAttribute("class", "reg" + (d.admin ? " admin" : ""));
  g.style.fill = col(d);
  g.style.fillOpacity = d.admin ? 0.35 : 0.78;
  g.style.color = col(d);
  g.dataset.i = i;
  d.el = g;
  g.onmousemove = (e) => tip(e, d);
  g.onmouseleave = () => ($("#tip").style.display = "none");
  g.onclick = () => {
    pick(i);
    zoomState(i);
  };
  $("#regs").append(g);
  const cx = d.poly.reduce((a, p) => a + X(p[0]), 0) / d.poly.length,
    cy = d.poly.reduce((a, p) => a + Y(p[1]), 0) / d.poly.length;
  d.c = [cx, cy];
});
DATA.forEach((d) => {
  const t = document.createElementNS(NS, "text");
  t.setAttribute("class", "lbl");
  t.setAttribute("x", d.c[0]);
  t.setAttribute("y", d.c[1]);
  t.textContent = d.n
    .replace(" Administrative Area", " AA")
    .replace("Northern Bahr el Ghazal", "N. Bahr el Ghazal")
    .replace("Western Bahr el Ghazal", "W. Bahr el Ghazal");
  $("#marks").append(t);
  if (d.s >= 20 || d.admin) {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("class", "pulse");
    c.setAttribute("cx", d.c[0]);
    c.setAttribute("cy", d.c[1] + 12);
    c.style.animationDelay = Math.random() * 2 + "s";
    $("#marks").append(c);
  }
});
function tip(e, d) {
  const t = $("#tip");
  t.style.display = "block";
  t.style.left = Math.min(e.clientX + 16, innerWidth - 240) + "px";
  t.style.top = e.clientY + 16 + "px";
  t.innerHTML = `<h4>${d.n}</h4><div>Target <span>${fmt(d.t)}</span></div><div>Registered <span>${fmt(d.r)}</span></div><div>Remaining <span>${fmt(d.t - d.r)}</span></div><div>Completion <span>${pct(d).toFixed(1)}%</span></div><div>Active sites <span>${d.s}</span></div><div>Status <span>${d.o}</span></div>`;
}
function pick(i) {
  sel = i;
  DATA.forEach((d, j) => d.el.classList.toggle("sel", j === i));
  if (DATA[i].el) DATA[i].el.parentNode.append(DATA[i].el);
  render();
}
function render() {
  const T = totals(),
    p = (T.r / T.t) * 100,
    gain = (((T.r - day0) / day0) * 100 + 6.8).toFixed(1);
  const k = [
    [
      "bx-group",
      "Total Registered",
      fmt(T.r),
      '<i class="bx bx-trending-up"></i> ' + gain + "% today",
      p,
    ],
    ["bx-target-lock", "National Target", fmt(T.t), "Registration goal", 100],
    ["bx-hourglass", "Remaining", fmt(T.rem), (100 - p).toFixed(1) + "% outstanding", 100 - p],
    ["bx-map-pin", "Active Sites", fmt(T.s), DATA.length + " regions reporting", T.s / 3],
    ["bx-check-circle", "Completion", p.toFixed(1) + "%", "National progress", p],
  ];
  $("#kpis").innerHTML = k
    .map(
      (x) =>
        `<div class="panel kpi"><div class="t"><span class="ic"><i class="bx ${x[0]}"></i></span>${x[1]}</div><div class="v">${x[2]}</div><div class="s">${x[3]}</div><div class="bar"><i style="width:${Math.min(x[4], 100)}%"></i></div></div>`,
    )
    .join("");
  const sorted = DATA.map((d, i) => [d, i]).sort((a, b) => pct(b[0]) - pct(a[0]));
  $("#list").innerHTML = sorted
    .filter(
      ([d]) =>
        FLT == "all" ||
        (FLT == "state" && !d.admin) ||
        (FLT == "admin" && d.admin) ||
        (FLT == "high" && d.ph == 3),
    )
    .map(
      ([d, i]) =>
        `<div class="row ${i === sel ? "sel" : ""}" data-i="${i}" style="--cl:${col(d)}"><div class="h"><span>${d.n}</span><b>${pct(d).toFixed(0)}%</b></div><div class="bar"><i style="width:${pct(d)}%"></i></div></div>`,
    )
    .join("");
  document.querySelectorAll(".row").forEach(
    (r) =>
      (r.onclick = () => {
        pick(+r.dataset.i);
        zoomState(+r.dataset.i);
      }),
  );
  DATA.forEach((d) => {
    d.el.style.fill = col(d);
    d.el.style.color = col(d);
  });
  const d = DATA[sel ?? sorted[0][1]];
  if (sel === null) (sel = sorted[0][1]), d.el.classList.add("sel");
  const rk = DATA.slice().sort((a, b) => pct(a) - pct(b)),
    big = DATA.slice().sort((a, b) => b.t - b.r - (a.t - a.r))[0],
    low = DATA.filter((d) => !d.admin && pct(d) < 40);
  $("#ai").innerHTML =
    `<p><b>${rk[0].n}</b> is furthest behind at ${pct(rk[0]).toFixed(0)}% and needs attention first.</p><p><b>${big.n}</b> has the largest backlog: ${fmt(big.t - big.r)} people still to register.</p><p><b>${low.length}</b> state${low.length == 1 ? "" : "s"} below 40%${low.length ? ": " + low.map((d) => d.n).join(", ") : ""}. Best performer: <b>${rk[rk.length - 1].n}</b> (${pct(rk[rk.length - 1]).toFixed(0)}%).</p>`;
  $("#dn").innerHTML =
    `${d.n} <span class="badge" style="color:${col(d)};float:right">${stat(d)}</span>`;
  $("#dd").innerHTML = [
    ["Target", fmt(d.t)],
    ["Registered", fmt(d.r)],
    ["Remaining", fmt(d.t - d.r)],
    ["Completion", pct(d).toFixed(1) + "%"],
    ["Active sites", d.s],
    ["Pending", fmt(d.p)],
    ["Operations", d.o],
    ["Type", d.admin ? "Admin area" : "State"],
  ]
    .map((x) => `<div><small>${x[0]}</small><b>${x[1]}</b></div>`)
    .join("");
}
// ===== PLACES (positions traced from UN map no. 4450, Jul 2020) =====
// [name, lon, lat, type c=city/admin capital t=town, airport 1/0]
const PL = [
  ["Juba", 31.55, 4.76, "c", 1],
  ["Wau", 28.0, 7.58, "c", 1],
  ["Malakal", 31.64, 9.37, "c", 1],
  ["Rumbek", 29.68, 6.68, "c", 1],
  ["Bor", 31.53, 6.08, "c", 1],
  ["Yambio", 28.4, 4.48, "c", 1],
  ["Torit", 32.53, 4.31, "c", 1],
  ["Bentiu", 29.83, 9.08, "c", 1],
  ["Aweil", 27.42, 8.64, "c", 1],
  ["Kuacjok", 28.4, 8.06, "c", 0],
  ["Renk", 32.77, 11.54, "t", 1],
  ["Paloich", 32.84, 10.36, "t", 1],
  ["Pibor", 33.1, 6.66, "t", 1],
  ["Kapoeta", 33.55, 4.66, "t", 1],
  ["Yei", 30.65, 4.0, "t", 1],
  ["Akobo", 32.98, 7.63, "t", 1],
  ["Nasser", 33.03, 8.46, "t", 1],
  ["Maridi", 29.46, 4.81, "t", 1],
  ["Tambura", 27.47, 5.21, "t", 1],
  ["Lafon", 32.44, 4.92, "t", 0],
  ["Nagishot", 33.52, 4.17, "t", 0],
  ["Lofusa", 33.17, 3.76, "t", 0],
  ["Terakeka", 31.73, 5.33, "t", 0],
  ["Jerbar", 31.06, 5.53, "t", 0],
  ["Kajo-Keji", 31.64, 3.79, "t", 1],
  ["Opari", 32.03, 3.83, "t", 0],
  ["Ezo", 27.45, 4.99, "t", 0],
  ["Li Yubu", 27.24, 5.29, "t", 0],
  ["Madreggi", 28.93, 5.2, "t", 0],
  ["Amadi", 30.32, 5.4, "t", 0],
  ["Lanya", 30.5, 5.13, "t", 0],
  ["Mvolo", 29.92, 5.94, "t", 0],
  ["Lol", 29.6, 6.32, "t", 0],
  ["Akot", 30.03, 6.42, "t", 0],
  ["Yirol", 30.48, 6.42, "t", 0],
  ["Boli", 28.71, 5.9, "t", 0],
  ["Khogali", 27.78, 6.03, "t", 0],
  ["Bo River Post", 27.14, 6.8, "t", 0],
  ["Rafili", 27.97, 6.77, "t", 0],
  ["Wakela", 28.24, 7.28, "t", 0],
  ["Bisellia", 27.72, 7.65, "t", 0],
  ["Deim Zubeir", 25.65, 7.5, "t", 0],
  ["Tonj", 28.82, 7.44, "t", 0],
  ["Atum", 29.12, 7.24, "t", 0],
  ["Madeir", 29.18, 7.71, "t", 0],
  ["Bir Di", 28.82, 7.44, "t", 0],
  ["Akop", 29.09, 8.21, "t", 0],
  ["Gogrial", 28.12, 8.41, "t", 1],
  ["Yida", 30.08, 10.12, "t", 1],
  ["War-Awar", 27.68, 9.04, "t", 0],
  ["Wun Rog", 28.32, 8.86, "t", 0],
  ["Malek", 26.64, 8.96, "t", 0],
  ["Gossinga", 26.02, 8.55, "t", 0],
  ["Raga", 25.71, 8.38, "t", 0],
  ["Radom", 25.26, 9.67, "t", 0],
  ["Mayom", 29.18, 9.08, "t", 0],
  ["Wang", 29.47, 8.94, "t", 0],
  ["Fagwir", 30.42, 9.39, "t", 0],
  ["Riangnom", 30.42, 9.39, "t", 0],
  ["Leer", 30.13, 8.15, "t", 0],
  ["Adok", 30.31, 8.04, "t", 0],
  ["Gumbiel", 30.13, 8.15, "t", 0],
  ["Fangak", 30.88, 8.91, "t", 0],
  ["Kan", 32.18, 8.95, "t", 0],
  ["Abwong", 32.49, 9.07, "t", 0],
  ["Kodok", 32.09, 9.71, "t", 0],
  ["Junguls", 33.31, 9.95, "t", 0],
  ["Boing", 33.67, 9.78, "t", 0],
  ["Daga Post", 33.41, 9.02, "t", 0],
  ["Kigille", 33.96, 8.53, "t", 0],
  ["Fathai", 31.78, 7.93, "t", 0],
  ["Waat", 32.09, 8.01, "t", 0],
  ["Duk Fadiat", 31.4, 7.6, "t", 0],
  ["Kongor", 31.33, 7.03, "t", 0],
  ["Peper", 32.96, 6.93, "t", 0],
  ["Akelo", 33.63, 6.7, "t", 0],
  ["Ukwaa", 34.52, 6.63, "t", 0],
  ["Towot", 34.37, 6.07, "t", 0],
  ["Lowelli", 33.62, 5.87, "t", 0],
  ["Pap", 31.18, 5.98, "t", 0],
];
// ===== COUNTIES: add official admin-2 boundaries here =====
// [{n:"Juba",st:"Central Equatoria",poly:[[lon,lat],...]}]  (e.g. from an OCHA/HDX South Sudan admin2 file)
const COUNTIES = [
  {
    n: "Juba",
    si: 0,
    hq: [31.58, 4.85],
    poly: [
      [31.513, 4.341],
      [30.832, 4.836],
      [30.869, 4.919],
      [30.86, 5.01],
      [30.928, 5.101],
      [30.89, 5.25],
      [30.96, 5.285],
      [30.971, 5.358],
      [32.096, 5.015],
      [32.15, 4.84],
      [32.11, 4.46],
      [32.029, 4.42],
      [32.021, 4.409],
      [32.022, 4.394],
      [32.03, 4.383],
    ],
  },
  {
    n: "Lainya",
    si: 0,
    hq: [31.05, 4.12],
    poly: [
      [30.881, 3.913],
      [30.807, 4.821],
      [30.832, 4.836],
      [31.513, 4.341],
      [31.221, 3.681],
    ],
  },
  {
    n: "Morobo",
    si: 0,
    hq: [30.75, 3.68],
    poly: [
      [30.881, 3.913],
      [31.221, 3.681],
      [31.222, 3.673],
      [31.153, 3.672],
      [31.009, 3.578],
      [30.969, 3.579],
      [30.957, 3.573],
      [30.947, 3.557],
      [30.941, 3.528],
      [30.886, 3.459],
      [30.855, 3.383],
      [30.836, 3.37],
      [30.819, 3.371],
      [30.8, 3.382],
      [30.793, 3.404],
      [30.795, 3.455],
      [30.762, 3.473],
      [30.729, 3.51],
      [30.692, 3.503],
      [30.646, 3.517],
      [30.573, 3.48],
      [30.531, 3.478],
      [30.51, 3.492],
      [30.502, 3.508],
      [30.531, 3.593],
      [30.504, 3.735],
      [30.488, 3.743],
      [30.451, 3.737],
      [30.41, 3.758],
      [30.386, 3.76],
      [30.345, 3.794],
      [30.287, 3.812],
    ],
  },
  {
    n: "Kajo-Keji",
    si: 0,
    hq: [31.66, 3.85],
    poly: [
      [31.221, 3.681],
      [31.513, 4.341],
      [32.03, 4.383],
      [32.04, 4.37],
      [32.05, 4.17],
      [32.02, 4.13],
      [31.983, 4.13],
      [31.97, 4.121],
      [31.95, 4.0],
      [31.719, 3.908],
      [31.709, 3.898],
      [31.708, 3.881],
      [31.78, 3.711],
      [31.799, 3.686],
      [31.777, 3.683],
      [31.691, 3.6],
      [31.654, 3.589],
      [31.598, 3.607],
      [31.541, 3.567],
      [31.5, 3.527],
      [31.482, 3.523],
      [31.466, 3.531],
      [31.451, 3.555],
      [31.264, 3.668],
      [31.222, 3.673],
    ],
  },
  {
    n: "Terekeka",
    si: 0,
    hq: [31.76, 5.44],
    poly: [
      [30.971, 5.358],
      [30.986, 5.457],
      [30.976, 5.466],
      [30.63, 5.62],
      [30.32, 5.93],
      [30.32, 5.96],
      [30.5, 5.972],
      [30.546, 6.034],
      [30.59, 6.11],
      [31.002, 5.78],
      [31.595, 5.75],
      [31.62, 5.769],
      [31.626, 5.784],
      [31.591, 5.85],
      [31.597, 5.887],
      [31.645, 5.77],
      [31.657, 5.76],
      [32.069, 5.75],
      [32.087, 5.733],
      [32.099, 5.73],
      [32.07, 5.101],
      [32.096, 5.015],
    ],
  },
  {
    n: "Yei River",
    si: 0,
    hq: [30.68, 4.09],
    poly: [
      [30.881, 3.913],
      [30.287, 3.812],
      [30.247, 3.831],
      [30.195, 3.818],
      [30.163, 3.84],
      [30.15, 3.862],
      [30.15, 3.901],
      [30.111, 3.947],
      [30.102, 3.986],
      [30.047, 3.996],
      [30.019, 4.014],
      [29.988, 4.08],
      [29.898, 4.13],
      [29.893, 4.15],
      [29.907, 4.182],
      [29.902, 4.197],
      [29.866, 4.217],
      [29.807, 4.217],
      [29.756, 4.253],
      [29.747, 4.283],
      [29.752, 4.373],
      [29.745, 4.407],
      [29.747, 4.433],
      [29.736, 4.444],
      [29.696, 4.455],
      [29.679, 4.48],
      [29.714, 4.454],
      [29.729, 4.452],
      [29.92, 4.56],
      [30.051, 4.551],
      [30.18, 4.61],
      [30.27, 4.59],
      [30.37, 4.526],
      [30.386, 4.524],
      [30.479, 4.572],
      [30.51, 4.7],
      [30.807, 4.821],
    ],
  },
  {
    n: "Yambio",
    si: 1,
    hq: [28.4, 4.57],
    poly: [
      [28.545, 4.919],
      [29.043, 4.401],
      [29.071, 4.311],
      [29.044, 4.319],
      [28.991, 4.358],
      [28.883, 4.351],
      [28.851, 4.361],
      [28.804, 4.354],
      [28.764, 4.383],
      [28.752, 4.416],
      [28.734, 4.421],
      [28.706, 4.409],
      [28.7, 4.381],
      [28.656, 4.307],
      [28.601, 4.292],
      [28.568, 4.26],
      [28.53, 4.261],
      [28.504, 4.254],
      [28.475, 4.201],
      [28.429, 4.171],
      [28.41, 4.164],
      [28.351, 4.161],
      [28.324, 4.184],
      [28.322, 4.223],
      [28.312, 4.235],
      [28.264, 4.239],
      [28.234, 4.228],
      [28.172, 4.236],
      [28.137, 4.268],
      [28.104, 4.281],
    ],
  },
  {
    n: "Tambura",
    si: 1,
    hq: [27.46, 5.3],
    poly: [
      [27.623, 4.912],
      [27.482, 4.858],
      [27.478, 4.873],
      [27.409, 4.913],
      [27.402, 4.931],
      [27.414, 4.957],
      [27.411, 4.972],
      [27.372, 5.014],
      [27.36, 5.04],
      [27.321, 5.079],
      [27.295, 5.09],
      [27.268, 5.124],
      [27.259, 5.156],
      [27.214, 5.225],
      [27.196, 5.341],
      [27.239, 5.453],
      [27.233, 5.465],
      [27.205, 5.487],
      [27.196, 5.513],
      [27.197, 5.536],
      [27.176, 5.599],
      [27.159, 5.617],
      [27.123, 5.634],
      [27.109, 5.655],
      [27.088, 5.67],
      [27.029, 5.677],
      [26.981, 5.739],
      [26.94, 5.749],
      [26.903, 5.773],
      [26.861, 5.782],
      [26.843, 5.792],
      [26.825, 5.816],
      [26.819, 5.852],
      [26.804, 5.876],
      [26.787, 5.889],
      [26.723, 5.893],
      [26.69, 5.88],
      [26.66, 5.878],
      [26.606, 5.906],
      [26.563, 5.914],
      [26.537, 5.927],
      [26.498, 5.977],
      [26.483, 5.977],
      [26.457, 5.959],
      [26.431, 5.965],
      [26.415, 5.988],
      [26.415, 6.006],
      [26.436, 6.043],
      [26.469, 6.073],
      [26.474, 6.086],
      [26.471, 6.099],
      [26.45, 6.12],
      [26.446, 6.175],
      [26.431, 6.187],
      [26.379, 6.195],
      [26.318, 6.262],
      [26.289, 6.277],
      [26.273, 6.314],
      [26.275, 6.339],
      [26.262, 6.364],
      [26.27, 6.404],
      [26.297, 6.429],
      [26.309, 6.459],
      [26.327, 6.476],
      [26.336, 6.508],
      [26.361, 6.522],
      [26.373, 6.538],
      [26.373, 6.557],
      [26.356, 6.571],
      [26.496, 6.57],
      [26.88, 6.61],
      [27.919, 6.7],
      [28.082, 6.63],
      [28.123, 6.632],
      [28.14, 6.65],
      [28.268, 6.654],
    ],
  },
  {
    n: "Nzara",
    si: 1,
    hq: [28.27, 4.66],
    poly: [
      [28.545, 4.919],
      [28.104, 4.281],
      [28.101, 4.282],
      [27.96, 4.773],
      [28.45, 5.073],
    ],
  },
  {
    n: "Maridi",
    si: 1,
    hq: [29.47, 4.91],
    poly: [
      [29.043, 4.401],
      [29.325, 5.55],
      [30.012, 4.8],
      [30.121, 4.582],
      [30.05, 4.55],
      [29.919, 4.559],
      [29.79, 4.47],
      [29.72, 4.45],
      [29.631, 4.514],
      [29.591, 4.534],
      [29.489, 4.543],
      [29.476, 4.532],
      [29.475, 4.486],
      [29.447, 4.454],
      [29.439, 4.414],
      [29.405, 4.369],
      [29.355, 4.341],
      [29.335, 4.287],
      [29.311, 4.266],
      [29.291, 4.257],
      [29.26, 4.257],
      [29.238, 4.23],
      [29.197, 4.217],
      [29.164, 4.227],
      [29.083, 4.308],
      [29.071, 4.311],
    ],
  },
  {
    n: "Mundri East",
    si: 1,
    hq: [30.55, 5.3],
    poly: [
      [30.4, 5.785],
      [30.439, 5.817],
      [30.629, 5.621],
      [30.99, 5.46],
      [30.96, 5.28],
      [30.904, 5.256],
      [30.894, 5.241],
      [30.93, 5.1],
      [30.871, 5.024],
      [30.87, 4.92],
      [30.83, 4.83],
      [30.516, 4.702],
      [30.508, 4.69],
      [30.48, 4.57],
      [30.4, 4.53],
    ],
  },
  {
    n: "Mundri West",
    si: 1,
    hq: [29.95, 5.35],
    poly: [
      [29.317, 5.578],
      [29.543, 5.563],
      [29.554, 5.576],
      [29.58, 5.685],
      [30.16, 5.685],
      [30.012, 4.8],
      [29.325, 5.55],
    ],
  },
  {
    n: "Mundri",
    si: 1,
    hq: [30.25, 5.3],
    poly: [
      [30.012, 4.8],
      [30.16, 5.685],
      [30.4, 5.785],
      [30.4, 4.53],
      [30.38, 4.52],
      [30.27, 4.59],
      [30.181, 4.609],
      [30.121, 4.582],
    ],
  },
  {
    n: "Mvolo",
    si: 1,
    hq: [29.95, 6.02],
    poly: [
      [30.4, 5.785],
      [30.16, 5.685],
      [29.58, 5.685],
      [29.62, 5.85],
      [29.779, 5.974],
      [29.79, 6.18],
      [29.87, 6.18],
      [29.96, 6.24],
      [30.03, 6.23],
      [30.12, 6.14],
      [30.169, 6.07],
      [30.27, 5.97],
      [30.3, 5.96],
      [30.439, 5.817],
    ],
  },
  {
    n: "Nagero",
    si: 1,
    hq: [28.0, 5.1],
    poly: [
      [28.268, 6.654],
      [28.456, 6.66],
      [28.496, 6.575],
      [28.479, 6.326],
      [28.481, 6.166],
      [28.507, 6.101],
      [28.45, 5.073],
      [27.96, 4.773],
      [27.623, 4.912],
    ],
  },
  {
    n: "Ibba",
    si: 1,
    hq: [28.9, 5.05],
    poly: [
      [28.45, 5.073],
      [28.507, 6.101],
      [28.515, 6.081],
      [28.53, 6.07],
      [28.559, 5.976],
      [28.569, 5.968],
      [28.64, 5.95],
      [28.803, 5.699],
      [29.002, 5.6],
      [29.317, 5.578],
      [29.325, 5.55],
      [29.043, 4.401],
      [28.545, 4.919],
    ],
  },
  {
    n: "Ezo",
    si: 1,
    hq: [27.758, 4.513],
    poly: [
      [27.623, 4.912],
      [27.96, 4.773],
      [28.101, 4.282],
      [28.079, 4.313],
      [28.035, 4.325],
      [28.006, 4.345],
      [27.988, 4.383],
      [27.988, 4.422],
      [27.978, 4.435],
      [27.955, 4.44],
      [27.878, 4.433],
      [27.842, 4.436],
      [27.784, 4.477],
      [27.746, 4.492],
      [27.737, 4.51],
      [27.742, 4.536],
      [27.73, 4.593],
      [27.731, 4.613],
      [27.742, 4.636],
      [27.736, 4.664],
      [27.723, 4.672],
      [27.691, 4.672],
      [27.679, 4.68],
      [27.661, 4.703],
      [27.66, 4.735],
      [27.635, 4.775],
      [27.567, 4.776],
      [27.51, 4.807],
      [27.487, 4.842],
      [27.482, 4.858],
    ],
  },
  {
    n: "Torit",
    si: 2,
    hq: [32.57, 4.41],
    poly: [
      [33.088, 4.554],
      [32.585, 4.092],
      [32.028, 4.419],
      [32.102, 4.456],
      [32.11, 4.467],
      [32.116, 4.523],
      [33.012, 4.767],
    ],
  },
  {
    n: "Magwi",
    si: 2,
    hq: [32.3, 3.95],
    poly: [
      [32.585, 4.092],
      [32.659, 3.644],
      [32.391, 3.621],
      [32.213, 3.503],
      [32.207, 3.49],
      [32.21, 3.463],
      [32.193, 3.401],
      [32.181, 3.388],
      [32.164, 3.386],
      [32.045, 3.419],
      [32.013, 3.463],
      [31.965, 3.459],
      [31.92, 3.468],
      [31.907, 3.478],
      [31.896, 3.513],
      [31.896, 3.561],
      [31.78, 3.71],
      [31.7, 3.9],
      [31.944, 3.999],
      [31.952, 4.011],
      [31.97, 4.13],
      [32.02, 4.133],
      [32.049, 4.171],
      [32.04, 4.366],
      [32.01, 4.41],
      [32.028, 4.419],
    ],
  },
  {
    n: "Kapoeta East",
    si: 2,
    hq: [34.3, 4.6],
    poly: [
      [33.869, 4.386],
      [34.001, 4.944],
      [35.258, 5.416],
      [35.284, 5.393],
      [35.295, 5.349],
      [35.274, 5.292],
      [35.272, 5.27],
      [35.279, 5.258],
      [35.301, 5.254],
      [35.39, 5.296],
      [35.417, 5.318],
      [35.465, 5.33],
      [35.533, 5.328],
      [35.557, 5.319],
      [35.584, 5.294],
      [35.678, 5.302],
      [35.753, 5.256],
      [35.804, 5.241],
      [35.829, 5.221],
      [35.837, 5.205],
      [35.834, 5.167],
      [35.812, 5.148],
      [35.806, 5.133],
      [35.832, 5.089],
      [35.838, 5.051],
      [35.83, 5.031],
      [35.791, 4.979],
      [35.793, 4.688],
      [35.921, 4.531],
      [35.924, 4.513],
      [35.914, 4.497],
      [35.569, 4.49],
      [34.354, 4.487],
      [34.069, 4.187],
      [34.003, 4.133],
    ],
  },
  {
    n: "Kapoeta South",
    si: 2,
    hq: [33.58, 4.77],
    poly: [
      [33.012, 4.767],
      [33.069, 5.566],
      [34.001, 4.944],
      [33.869, 4.386],
      [33.093, 4.548],
    ],
  },
  {
    n: "Kapoeta North",
    si: 2,
    hq: [34.0, 5.4],
    poly: [
      [34.001, 4.944],
      [33.069, 5.566],
      [33.009, 5.733],
      [33.269, 5.73],
      [34.11, 5.62],
      [34.954, 5.895],
      [34.966, 5.913],
      [34.952, 5.982],
      [34.97, 5.967],
      [34.976, 5.955],
      [34.972, 5.92],
      [34.985, 5.878],
      [34.972, 5.824],
      [34.994, 5.761],
      [35.105, 5.584],
      [35.105, 5.519],
      [35.258, 5.416],
    ],
  },
  {
    n: "Ikotos",
    si: 2,
    hq: [32.9, 4.05],
    poly: [
      [32.585, 4.092],
      [33.088, 4.554],
      [33.093, 4.548],
      [33.257, 3.647],
      [33.136, 3.655],
      [33.001, 3.753],
      [32.986, 3.757],
      [32.877, 3.692],
      [32.713, 3.649],
      [32.659, 3.644],
    ],
  },
  {
    n: "Lafon",
    si: 2,
    hq: [32.45, 4.85],
    poly: [
      [33.069, 5.566],
      [33.012, 4.767],
      [32.116, 4.523],
      [32.15, 4.838],
      [32.07, 5.1],
      [32.1, 5.73],
      [32.6, 5.739],
      [33.009, 5.733],
    ],
  },
  {
    n: "Budi",
    si: 2,
    hq: [33.45, 4.15],
    poly: [
      [33.093, 4.548],
      [33.869, 4.386],
      [34.003, 4.133],
      [33.831, 3.976],
      [33.51, 3.651],
      [33.48, 3.632],
      [33.257, 3.647],
    ],
  },
  {
    n: "Rumbek Centre",
    si: 3,
    hq: [29.68, 6.8],
    poly: [
      [29.397, 7.011],
      [29.887, 7.089],
      [29.946, 6.529],
      [29.8, 6.362],
      [29.318, 6.68],
    ],
  },
  {
    n: "Rumbek East",
    si: 3,
    hq: [30.15, 6.85],
    poly: [
      [30.169, 6.569],
      [29.946, 6.529],
      [29.887, 7.089],
      [30.071, 7.314],
      [30.174, 7.083],
      [30.68, 7.08],
    ],
  },
  {
    n: "Rumbek North",
    si: 3,
    hq: [29.6, 7.3],
    poly: [
      [29.887, 7.089],
      [29.397, 7.011],
      [29.169, 7.369],
      [29.33, 7.53],
      [29.54, 7.57],
      [29.693, 7.713],
      [29.7, 7.73],
      [29.732, 7.7],
      [29.92, 7.65],
      [30.071, 7.314],
    ],
  },
  {
    n: "Cueibet",
    si: 3,
    hq: [29.05, 6.95],
    poly: [
      [29.397, 7.011],
      [29.318, 6.68],
      [29.221, 6.635],
      [28.937, 6.686],
      [28.953, 6.702],
      [28.957, 6.716],
      [28.87, 6.94],
      [29.09, 7.29],
      [29.169, 7.369],
    ],
  },
  {
    n: "Gok",
    si: 3,
    hq: [29.35, 6.3],
    poly: [
      [29.221, 6.635],
      [29.318, 6.68],
      [29.8, 6.362],
      [29.8, 6.175],
      [29.792, 6.17],
      [29.78, 5.97],
      [29.621, 5.848],
      [29.55, 5.56],
      [29.0, 5.6],
      [28.967, 5.617],
    ],
  },
  {
    n: "Wulu",
    si: 3,
    hq: [28.95, 6.4],
    poly: [
      [29.221, 6.635],
      [28.967, 5.617],
      [28.8, 5.7],
      [28.642, 5.946],
      [28.56, 5.97],
      [28.48, 6.17],
      [28.48, 6.36],
      [28.5, 6.623],
      [28.482, 6.649],
      [28.882, 6.64],
      [28.895, 6.644],
      [28.937, 6.686],
    ],
  },
  {
    n: "Yirol",
    si: 3,
    hq: [30.45, 6.55],
    poly: [
      [30.68, 7.08],
      [30.716, 7.051],
      [30.611, 6.216],
      [30.169, 6.569],
    ],
  },
  {
    n: "Yirol East",
    si: 3,
    hq: [30.85, 6.5],
    poly: [
      [30.702, 6.017],
      [30.669, 6.044],
      [30.611, 6.216],
      [30.716, 7.051],
      [31.18, 6.68],
      [31.277, 6.52],
    ],
  },
  {
    n: "Yirol West",
    si: 3,
    hq: [30.25, 6.3],
    poly: [
      [29.8, 6.362],
      [29.946, 6.529],
      [30.169, 6.569],
      [30.611, 6.216],
      [30.669, 6.044],
      [30.603, 6.096],
      [30.586, 6.09],
      [30.5, 5.97],
      [30.336, 5.961],
      [30.324, 5.955],
      [30.319, 5.941],
      [30.3, 5.959],
      [30.28, 5.96],
      [30.14, 6.1],
      [30.12, 6.14],
      [30.034, 6.226],
      [29.963, 6.239],
      [29.87, 6.18],
      [29.807, 6.18],
      [29.8, 6.175],
    ],
  },
  {
    n: "Awerial",
    si: 3,
    hq: [31.2, 6.1],
    poly: [
      [31.277, 6.52],
      [31.46, 6.219],
      [31.6, 5.91],
      [31.591, 5.849],
      [31.63, 5.78],
      [31.6, 5.75],
      [31.0, 5.78],
      [30.702, 6.017],
    ],
  },
  {
    n: "Kuajok",
    si: 4,
    hq: [28.2, 8.3],
    poly: [
      [28.283, 8.609],
      [28.504, 8.356],
      [28.165, 7.882],
      [28.162, 7.887],
      [27.87, 7.97],
      [27.89, 8.16],
      [27.92, 8.214],
      [27.92, 8.36],
      [27.968, 8.439],
      [27.96, 8.465],
    ],
  },
  {
    n: "Twic",
    si: 4,
    hq: [28.55, 8.05],
    poly: [
      [28.504, 8.356],
      [28.653, 8.343],
      [28.903, 7.844],
      [28.857, 7.73],
      [28.303, 7.583],
      [28.308, 7.662],
      [28.165, 7.882],
    ],
  },
  {
    n: "Gogrial West",
    si: 4,
    hq: [27.999, 8.754],
    poly: [
      [28.283, 8.609],
      [27.96, 8.465],
      [27.94, 8.53],
      [28.001, 8.574],
      [28.008, 8.588],
      [27.979, 8.75],
      [27.89, 8.85],
      [28.08, 9.21],
      [28.387, 9.206],
    ],
  },
  {
    n: "Gogrial East",
    si: 4,
    hq: [28.6, 8.65],
    poly: [
      [28.653, 8.343],
      [28.504, 8.356],
      [28.283, 8.609],
      [28.387, 9.206],
      [28.79, 9.2],
      [28.82, 9.17],
      [28.8, 8.98],
      [28.768, 8.937],
      [28.764, 8.917],
      [28.77, 8.905],
      [28.784, 8.899],
      [29.11, 8.89],
      [29.161, 8.788],
    ],
  },
  {
    n: "Tonj North",
    si: 4,
    hq: [28.95, 8.25],
    poly: [
      [28.903, 7.844],
      [28.653, 8.343],
      [29.161, 8.788],
      [29.281, 8.55],
      [29.578, 8.317],
    ],
  },
  {
    n: "Tonj South",
    si: 4,
    hq: [28.75, 7.3],
    poly: [
      [28.857, 7.73],
      [29.16, 7.36],
      [29.09, 7.29],
      [28.873, 6.943],
      [28.96, 6.71],
      [28.89, 6.64],
      [28.49, 6.65],
      [28.48, 7.06],
      [28.527, 7.311],
      [28.3, 7.53],
      [28.303, 7.583],
    ],
  },
  {
    n: "Tonj East",
    si: 4,
    hq: [29.3, 7.75],
    poly: [
      [28.857, 7.73],
      [28.903, 7.844],
      [29.578, 8.317],
      [29.65, 8.26],
      [29.7, 7.72],
      [29.54, 7.57],
      [29.329, 7.528],
      [29.16, 7.36],
    ],
  },
  {
    n: "Aweil Centre",
    si: 5,
    hq: [27.4, 8.76],
    poly: [
      [27.033, 8.931],
      [27.904, 9.254],
      [27.537, 8.466],
      [27.069, 8.507],
    ],
  },
  {
    n: "Aweil East",
    si: 5,
    hq: [27.85, 8.55],
    poly: [
      [27.537, 8.466],
      [27.904, 9.254],
      [27.912, 9.26],
      [28.1, 9.26],
      [28.089, 9.233],
      [28.102, 9.21],
      [28.084, 9.209],
      [28.074, 9.2],
      [27.897, 8.852],
      [27.9, 8.838],
      [27.98, 8.75],
      [28.009, 8.58],
      [27.944, 8.528],
      [27.969, 8.44],
      [27.92, 8.358],
      [27.919, 8.224],
      [27.913, 8.313],
      [27.903, 8.325],
      [27.888, 8.327],
      [27.734, 8.183],
    ],
  },
  {
    n: "Aweil North",
    si: 5,
    hq: [27.2, 9.3],
    poly: [
      [27.912, 9.26],
      [27.033, 8.931],
      [26.259, 9.576],
      [26.29, 9.79],
      [26.397, 9.53],
      [26.416, 9.505],
      [26.444, 9.489],
      [26.643, 9.422],
      [26.745, 9.401],
      [26.786, 9.405],
      [26.881, 9.434],
      [27.037, 9.499],
      [27.18, 9.527],
      [27.361, 9.525],
      [27.83, 9.5],
      [27.83, 9.26],
    ],
  },
  {
    n: "Aweil South",
    si: 5,
    hq: [27.35, 8.2],
    poly: [
      [27.069, 8.507],
      [27.537, 8.466],
      [27.734, 8.183],
      [27.72, 8.17],
      [27.37, 8.08],
      [26.83, 7.79],
      [26.616, 7.919],
    ],
  },
  {
    n: "Aweil West",
    si: 5,
    hq: [26.7, 8.7],
    poly: [
      [27.033, 8.931],
      [27.069, 8.507],
      [26.616, 7.919],
      [26.3, 8.11],
      [26.17, 8.97],
      [26.259, 9.576],
    ],
  },
  {
    n: "Wau",
    si: 6,
    hq: [28.0, 7.7],
    poly: [
      [27.642, 8.15],
      [27.719, 8.17],
      [27.91, 8.35],
      [27.92, 8.21],
      [27.89, 8.158],
      [27.874, 7.975],
      [27.886, 7.965],
      [28.16, 7.89],
      [28.31, 7.66],
      [28.304, 7.526],
      [28.53, 7.31],
      [28.48, 7.06],
      [28.49, 6.65],
      [28.08, 6.63],
      [27.897, 6.698],
      [27.263, 6.644],
    ],
  },
  {
    n: "Jur River",
    si: 6,
    hq: [27.114, 7.923],
    poly: [
      [26.355, 8.078],
      [26.815, 7.798],
      [26.829, 7.796],
      [27.37, 8.08],
      [27.642, 8.15],
      [27.263, 6.644],
      [26.391, 6.56],
      [26.304, 6.588],
      [26.27, 6.587],
      [26.246, 6.601],
      [26.227, 6.628],
      [26.195, 6.641],
      [26.155, 6.701],
      [26.107, 6.699],
      [26.056, 6.727],
      [26.05, 6.745],
      [26.061, 6.794],
      [26.035, 6.827],
      [26.025, 6.88],
      [26.018, 6.891],
      [25.995, 6.9],
      [25.971, 6.921],
      [25.937, 6.934],
      [25.93, 6.943],
    ],
  },
  {
    n: "Raja",
    si: 6,
    hq: [25.68, 8.46],
    poly: [
      [25.93, 6.943],
      [25.907, 6.971],
      [25.875, 6.969],
      [25.857, 6.978],
      [25.817, 7.018],
      [25.802, 7.043],
      [25.747, 7.072],
      [25.711, 7.085],
      [25.684, 7.085],
      [25.642, 7.111],
      [25.621, 7.115],
      [25.513, 7.19],
      [25.49, 7.2],
      [25.455, 7.202],
      [25.423, 7.224],
      [25.398, 7.226],
      [25.358, 7.248],
      [25.336, 7.287],
      [25.328, 7.323],
      [25.286, 7.359],
      [25.201, 7.399],
      [25.181, 7.471],
      [25.161, 7.495],
      [25.161, 7.513],
      [25.237, 7.575],
      [25.276, 7.589],
      [25.283, 7.605],
      [25.275, 7.659],
      [25.28, 7.691],
      [25.256, 7.72],
      [25.241, 7.759],
      [25.209, 7.796],
      [25.186, 7.809],
      [25.126, 7.798],
      [25.093, 7.806],
      [25.057, 7.839],
      [24.989, 7.863],
      [24.958, 7.936],
      [24.908, 7.965],
      [24.888, 8.051],
      [24.873, 8.07],
      [24.788, 8.086],
      [24.746, 8.113],
      [24.673, 8.127],
      [24.636, 8.124],
      [24.595, 8.111],
      [24.564, 8.119],
      [24.512, 8.151],
      [24.496, 8.182],
      [24.483, 8.19],
      [24.446, 8.185],
      [24.391, 8.164],
      [24.251, 8.209],
      [24.219, 8.23],
      [24.166, 8.307],
      [24.163, 8.344],
      [24.179, 8.374],
      [24.185, 8.419],
      [24.256, 8.528],
      [24.24, 8.579],
      [24.246, 8.598],
      [24.278, 8.614],
      [24.411, 8.744],
      [24.555, 8.798],
      [24.6, 8.859],
      [24.598, 8.897],
      [24.57, 8.996],
      [24.596, 9.117],
      [24.623, 9.19],
      [24.652, 9.245],
      [24.631, 9.294],
      [24.631, 9.315],
      [24.644, 9.332],
      [24.697, 9.363],
      [24.75, 9.406],
      [24.791, 9.449],
      [24.791, 9.505],
      [24.772, 9.549],
      [24.781, 9.594],
      [24.776, 9.633],
      [24.763, 9.662],
      [24.765, 9.681],
      [24.793, 9.709],
      [24.817, 9.718],
      [24.857, 9.749],
      [24.876, 9.787],
      [24.907, 9.819],
      [24.999, 9.873],
      [25.104, 10.025],
      [25.106, 10.044],
      [25.082, 10.077],
      [25.08, 10.097],
      [25.096, 10.135],
      [25.159, 10.242],
      [25.216, 10.271],
      [25.261, 10.271],
      [25.285, 10.283],
      [25.41, 10.276],
      [25.452, 10.294],
      [25.539, 10.305],
      [25.614, 10.293],
      [25.683, 10.317],
      [25.769, 10.336],
      [25.846, 10.334],
      [25.88, 10.358],
      [25.948, 10.356],
      [26.001, 10.327],
      [26.02, 10.307],
      [26.03, 10.272],
      [26.027, 10.103],
      [26.092, 10.067],
      [26.134, 10.028],
      [26.161, 9.979],
      [26.258, 9.851],
      [26.291, 9.82],
      [26.343, 9.663],
      [26.315, 9.729],
      [26.301, 9.737],
      [26.287, 9.732],
      [26.279, 9.719],
      [26.182, 8.89],
      [26.312, 8.104],
      [26.355, 8.078],
    ],
  },
  {
    n: "Abyei",
    si: 7,
    hq: [28.43, 9.6],
    poly: [
      [28.174, 9.65],
      [28.45, 9.953],
      [28.689, 9.659],
      [28.44, 9.26],
      [28.41, 9.26],
    ],
  },
  {
    n: "Alal",
    si: 7,
    hq: [28.1, 9.9],
    poly: [
      [28.45, 9.953],
      [28.174, 9.65],
      [27.83, 9.65],
      [27.83, 10.06],
      [28.45, 10.06],
    ],
  },
  {
    n: "Majak",
    si: 7,
    hq: [28.8, 9.9],
    poly: [
      [28.689, 9.659],
      [28.45, 9.953],
      [28.45, 10.06],
      [29.0, 10.06],
      [29.0, 9.627],
    ],
  },
  {
    n: "Rumameer",
    si: 7,
    hq: [28.1, 9.4],
    poly: [
      [28.174, 9.65],
      [28.41, 9.26],
      [27.83, 9.26],
      [27.83, 9.65],
    ],
  },
  {
    n: "Amethaguok",
    si: 7,
    hq: [28.75, 9.4],
    poly: [
      [28.689, 9.659],
      [29.0, 9.627],
      [29.0, 9.26],
      [28.44, 9.26],
    ],
  },
  {
    n: "Malakal",
    si: 8,
    hq: [31.66, 9.53],
    poly: [
      [31.437, 9.791],
      [31.582, 9.959],
      [31.71, 9.924],
      [32.083, 9.411],
      [32.1, 8.707],
      [31.77, 9.07],
      [31.755, 9.108],
      [31.734, 9.11],
      [31.399, 9.479],
    ],
  },
  {
    n: "Fashoda",
    si: 8,
    hq: [32.1, 9.85],
    poly: [
      [32.161, 10.163],
      [32.55, 10.033],
      [32.083, 9.411],
      [31.71, 9.924],
    ],
  },
  {
    n: "Manyo",
    si: 8,
    hq: [31.867, 10.288],
    poly: [
      [32.161, 10.163],
      [31.71, 9.924],
      [31.582, 9.959],
      [31.693, 10.083],
      [31.754, 10.14],
      [31.819, 10.239],
      [31.92, 10.431],
      [31.958, 10.486],
      [32.025, 10.525],
    ],
  },
  {
    n: "Renk",
    si: 8,
    hq: [32.8, 11.55],
    poly: [
      [32.344, 11.094],
      [32.341, 11.484],
      [32.321, 11.509],
      [32.074, 11.727],
      [32.067, 11.744],
      [32.073, 11.761],
      [32.092, 11.769],
      [32.687, 11.773],
      [32.7, 11.792],
      [32.7, 11.867],
      [32.685, 11.945],
      [32.69, 11.992],
      [32.679, 12.033],
      [32.686, 12.048],
      [32.703, 12.058],
      [33.255, 12.036],
      [33.271, 12.029],
      [33.28, 12.001],
      [33.254, 11.961],
      [33.202, 11.763],
      [33.161, 11.536],
      [33.123, 11.424],
      [33.244, 10.685],
    ],
  },
  {
    n: "Melut",
    si: 8,
    hq: [32.3, 10.45],
    poly: [
      [32.025, 10.525],
      [32.118, 10.579],
      [32.401, 10.86],
      [32.402, 10.877],
      [32.354, 10.975],
      [32.344, 11.025],
      [32.344, 11.094],
      [33.244, 10.685],
      [33.25, 10.645],
      [33.223, 10.572],
      [33.235, 10.558],
      [33.269, 10.548],
      [33.178, 10.299],
      [33.043, 10.143],
      [32.55, 10.033],
      [32.161, 10.163],
    ],
  },
  {
    n: "Baliet",
    si: 8,
    hq: [32.5, 9.55],
    poly: [
      [32.083, 9.411],
      [32.55, 10.033],
      [33.043, 10.143],
      [32.957, 9.326],
      [32.764, 9.069],
      [32.371, 8.841],
      [32.359, 8.887],
      [32.346, 8.891],
      [32.332, 8.885],
      [32.24, 8.77],
      [32.105, 8.687],
      [32.1, 8.707],
    ],
  },
  {
    n: "Panyikang",
    si: 8,
    hq: [31.158, 9.591],
    poly: [
      [31.399, 9.479],
      [31.015, 9.306],
      [30.75, 9.34],
      [30.75, 9.45],
      [30.826, 9.5],
      [30.82, 9.57],
      [30.89, 9.6],
      [31.262, 9.615],
      [31.292, 9.625],
      [31.325, 9.65],
      [31.437, 9.791],
    ],
  },
  {
    n: "Longochuk",
    si: 8,
    hq: [33.45, 9.45],
    poly: [
      [33.043, 10.143],
      [33.178, 10.299],
      [33.835, 9.481],
      [33.571, 9.141],
      [32.957, 9.326],
    ],
  },
  {
    n: "Maiwut",
    si: 8,
    hq: [33.9, 9.1],
    poly: [
      [33.724, 8.53],
      [33.571, 9.141],
      [33.835, 9.481],
      [33.87, 9.478],
      [33.864, 9.379],
      [33.87, 9.362],
      [33.883, 9.355],
      [34.066, 9.354],
      [34.08, 9.345],
      [34.087, 9.326],
      [34.116, 8.89],
      [34.119, 8.465],
      [34.111, 8.427],
      [34.072, 8.379],
      [33.986, 8.312],
    ],
  },
  {
    n: "Luakpiny/Nasir",
    si: 8,
    hq: [33.05, 8.6],
    poly: [
      [33.462, 8.57],
      [32.672, 8.239],
      [32.6, 8.28],
      [32.492, 8.721],
      [32.482, 8.733],
      [32.38, 8.77],
      [32.371, 8.841],
      [32.764, 9.069],
    ],
  },
  {
    n: "Nasir/Malual Gahoth",
    si: 8,
    hq: [33.3, 8.95],
    poly: [
      [32.957, 9.326],
      [33.571, 9.141],
      [33.724, 8.53],
      [33.462, 8.57],
      [32.764, 9.069],
    ],
  },
  {
    n: "Ulang",
    si: 8,
    hq: [33.195, 8.255],
    poly: [
      [33.462, 8.57],
      [33.724, 8.53],
      [33.986, 8.312],
      [33.963, 8.303],
      [33.893, 8.31],
      [33.87, 8.304],
      [33.835, 8.258],
      [33.804, 8.248],
      [33.784, 8.223],
      [33.727, 8.182],
      [33.668, 8.182],
      [33.634, 8.199],
      [33.613, 8.246],
      [33.586, 8.272],
      [33.558, 8.261],
      [33.527, 8.264],
      [33.495, 8.282],
      [33.463, 8.287],
      [33.419, 8.259],
      [33.385, 8.255],
      [33.356, 8.239],
      [33.29, 8.261],
      [33.229, 8.262],
      [33.198, 8.229],
      [33.203, 8.185],
      [33.177, 8.12],
      [33.19, 8.078],
      [33.181, 8.05],
      [33.165, 8.027],
      [33.179, 7.978],
      [33.172, 7.958],
      [33.155, 7.945],
      [33.131, 7.945],
      [33.103, 7.933],
      [33.073, 7.893],
      [33.06, 7.856],
      [33.02, 7.83],
      [32.82, 7.83],
      [32.8, 7.87],
      [32.804, 7.901],
      [32.869, 8.086],
      [32.875, 8.118],
      [32.672, 8.239],
    ],
  },
  {
    n: "Akoka",
    si: 8,
    hq: [31.323, 9.224],
    poly: [
      [31.399, 9.479],
      [31.734, 9.11],
      [31.61, 9.12],
      [31.529, 9.206],
      [31.43, 9.17],
      [31.171, 9.25],
      [31.159, 9.259],
      [31.015, 9.306],
    ],
  },
  {
    n: "Maban",
    si: 8,
    hq: [33.948, 9.85],
    poly: [
      [33.835, 9.481],
      [33.178, 10.299],
      [33.269, 10.548],
      [33.453, 10.493],
      [33.72, 10.211],
      [33.765, 10.173],
      [33.859, 10.018],
      [33.909, 10.007],
      [33.942, 9.98],
      [33.943, 9.928],
      [33.968, 9.888],
      [33.968, 9.811],
      [33.961, 9.787],
      [33.968, 9.743],
      [33.937, 9.62],
      [33.918, 9.589],
      [33.891, 9.565],
      [33.87, 9.478],
    ],
  },
  {
    n: "Bor Town",
    si: 9,
    hq: [31.55, 6.2],
    poly: [
      [32.239, 6.743],
      [32.316, 6.716],
      [31.565, 5.965],
      [31.46, 6.22],
      [31.254, 6.558],
    ],
  },
  {
    n: "Bor South",
    si: 9,
    hq: [31.8, 5.95],
    poly: [
      [32.316, 6.716],
      [32.6, 6.673],
      [32.6, 5.74],
      [32.091, 5.73],
      [32.062, 5.75],
      [31.65, 5.76],
      [31.565, 5.965],
    ],
  },
  {
    n: "Twic East",
    si: 9,
    hq: [31.4, 7.0],
    poly: [
      [31.75, 7.273],
      [32.239, 6.743],
      [31.254, 6.558],
      [31.18, 6.679],
      [30.68, 7.08],
      [30.659, 7.242],
      [30.586, 7.37],
    ],
  },
  {
    n: "Duk",
    si: 9,
    hq: [31.45, 7.6],
    poly: [
      [30.629, 7.975],
      [31.625, 7.975],
      [31.75, 7.85],
      [31.75, 7.273],
      [30.586, 7.37],
      [30.5, 7.52],
      [30.538, 7.713],
      [30.436, 7.882],
    ],
  },
  {
    n: "Nyirol",
    si: 9,
    hq: [32.0, 8.15],
    poly: [
      [32.343, 8.063],
      [32.242, 7.895],
      [31.75, 7.85],
      [31.625, 7.975],
      [31.865, 8.634],
      [31.943, 8.569],
      [31.958, 8.572],
      [32.239, 8.77],
      [32.258, 8.794],
    ],
  },
  {
    n: "Uror",
    si: 9,
    hq: [32.05, 7.6],
    poly: [
      [32.239, 6.743],
      [31.75, 7.273],
      [31.75, 7.85],
      [32.242, 7.895],
      [32.6, 6.945],
      [32.6, 6.673],
      [32.316, 6.716],
    ],
  },
  {
    n: "Akobo",
    si: 9,
    hq: [32.58, 7.8],
    poly: [
      [32.242, 7.895],
      [32.343, 8.063],
      [32.83, 7.975],
      [32.8, 7.89],
      [32.619, 7.899],
      [32.607, 7.894],
      [32.6, 7.881],
      [32.6, 6.945],
    ],
  },
  {
    n: "Ayod",
    si: 9,
    hq: [31.45, 8.35],
    poly: [
      [31.211, 8.673],
      [31.789, 8.756],
      [31.82, 8.671],
      [31.865, 8.634],
      [31.625, 7.975],
      [30.629, 7.975],
    ],
  },
  {
    n: "Fangak",
    si: 9,
    hq: [30.85, 8.85],
    poly: [
      [31.211, 8.673],
      [30.629, 7.975],
      [30.436, 7.882],
      [30.393, 7.955],
      [30.33, 7.98],
      [30.33, 8.16],
      [30.366, 8.312],
      [30.29, 8.42],
      [30.314, 8.492],
      [30.25, 8.56],
      [30.269, 8.614],
      [30.22, 8.81],
      [30.387, 9.017],
      [30.37, 9.18],
      [30.45, 9.289],
      [30.464, 9.295],
      [30.5, 9.34],
      [30.949, 9.327],
    ],
  },
  {
    n: "Canal/Pigi",
    si: 9,
    hq: [31.35, 9.05],
    poly: [
      [31.211, 8.673],
      [30.949, 9.327],
      [31.425, 9.172],
      [31.53, 9.21],
      [31.611, 9.121],
      [31.76, 9.11],
      [31.79, 8.99],
      [31.733, 8.93],
      [31.75, 8.859],
      [31.789, 8.756],
    ],
  },
  {
    n: "Pochalla",
    si: 9,
    hq: [32.657, 8.227],
    poly: [
      [32.343, 8.063],
      [32.258, 8.794],
      [32.36, 8.92],
      [32.382, 8.773],
      [32.49, 8.73],
      [32.6, 8.283],
      [32.88, 8.12],
      [32.83, 7.975],
    ],
  },
  {
    n: "Bentiu",
    si: 10,
    hq: [29.85, 9.18],
    poly: [
      [29.681, 9.089],
      [29.822, 9.3],
      [29.861, 9.3],
      [30.083, 9.012],
      [29.872, 8.841],
    ],
  },
  {
    n: "Bentiu TC",
    si: 10,
    hq: [29.98, 9.28],
    poly: [
      [30.083, 9.012],
      [29.861, 9.3],
      [30.46, 9.3],
      [30.46, 9.29],
      [30.444, 9.282],
      [30.371, 9.18],
      [30.376, 9.134],
    ],
  },
  {
    n: "Rubkona",
    si: 10,
    hq: [29.7, 9.28],
    poly: [
      [29.681, 9.089],
      [29.35, 9.24],
      [29.314, 9.3],
      [29.822, 9.3],
    ],
  },
  {
    n: "Koch",
    si: 10,
    hq: [30.2, 8.75],
    poly: [
      [29.788, 8.568],
      [29.872, 8.841],
      [30.083, 9.012],
      [30.376, 9.134],
      [30.39, 9.02],
      [30.226, 8.818],
      [30.222, 8.802],
      [30.27, 8.61],
      [30.254, 8.559],
      [30.3, 8.511],
    ],
  },
  {
    n: "Leer",
    si: 10,
    hq: [30.15, 8.3],
    poly: [
      [29.682, 8.47],
      [29.788, 8.568],
      [30.3, 8.511],
      [30.32, 8.49],
      [30.293, 8.418],
      [30.37, 8.31],
      [30.33, 8.16],
      [30.33, 7.99],
      [30.341, 7.976],
      [30.39, 7.96],
      [30.456, 7.85],
    ],
  },
  {
    n: "Mayendit",
    si: 10,
    hq: [29.95, 8.05],
    poly: [
      [29.682, 8.47],
      [30.456, 7.85],
      [30.466, 7.834],
      [29.686, 7.785],
      [29.647, 8.261],
      [29.49, 8.385],
    ],
  },
  {
    n: "Panyijiar",
    si: 10,
    hq: [29.981, 7.555],
    poly: [
      [30.466, 7.834],
      [30.54, 7.71],
      [30.502, 7.519],
      [30.66, 7.24],
      [30.68, 7.08],
      [30.16, 7.08],
      [29.922, 7.643],
      [29.909, 7.652],
      [29.75, 7.68],
      [29.69, 7.74],
      [29.686, 7.785],
    ],
  },
  {
    n: "Abiemnhom",
    si: 10,
    hq: [28.6, 9.22],
    poly: [
      [28.784, 8.899],
      [28.76, 8.9],
      [28.818, 9.161],
      [28.815, 9.175],
      [28.794, 9.195],
      [28.782, 9.2],
      [28.11, 9.2],
      [28.08, 9.24],
      [28.091, 9.26],
      [28.961, 9.26],
    ],
  },
  {
    n: "Guit",
    si: 10,
    hq: [29.55, 8.95],
    poly: [
      [29.35, 9.24],
      [29.681, 9.089],
      [29.872, 8.841],
      [29.788, 8.568],
      [29.682, 8.47],
      [29.49, 8.385],
      [29.35, 8.495],
    ],
  },
  {
    n: "Mayom",
    si: 10,
    hq: [29.15, 8.95],
    poly: [
      [28.961, 9.26],
      [29.0, 9.26],
      [29.0, 9.3],
      [29.314, 9.3],
      [29.35, 9.24],
      [29.35, 8.495],
      [29.28, 8.55],
      [29.109, 8.887],
      [28.784, 8.899],
    ],
  },
  {
    n: "Pibor",
    si: 11,
    hq: [33.1, 6.8],
    poly: [
      [33.3, 7.15],
      [33.546, 6.659],
      [33.543, 6.65],
      [32.6, 6.307],
      [32.6, 6.959],
    ],
  },
  {
    n: "Lekuangole",
    si: 11,
    hq: [33.3, 6.25],
    poly: [
      [33.543, 6.65],
      [33.861, 5.907],
      [33.85, 5.654],
      [33.271, 5.73],
      [32.6, 5.74],
      [32.6, 6.307],
    ],
  },
  {
    n: "Jebel Boma",
    si: 11,
    hq: [34.45, 6.2],
    poly: [
      [33.861, 5.907],
      [34.499, 6.728],
      [34.513, 6.694],
      [34.508, 6.64],
      [34.516, 6.625],
      [34.551, 6.62],
      [34.581, 6.631],
      [34.603, 6.625],
      [34.674, 6.573],
      [34.688, 6.535],
      [34.734, 6.493],
      [34.81, 6.499],
      [34.847, 6.488],
      [34.867, 6.458],
      [34.906, 6.44],
      [34.927, 6.402],
      [34.982, 6.35],
      [34.993, 6.325],
      [34.993, 6.3],
      [34.967, 6.229],
      [34.958, 6.158],
      [34.934, 6.125],
      [34.949, 6.074],
      [34.943, 6.024],
      [34.97, 5.89],
      [34.11, 5.62],
      [33.85, 5.654],
    ],
  },
  {
    n: "Pashal South",
    si: 11,
    hq: [33.7, 7.1],
    poly: [
      [33.546, 6.659],
      [33.3, 7.15],
      [33.314, 7.193],
      [33.733, 7.49],
      [33.769, 7.476],
      [33.824, 7.424],
      [33.838, 7.402],
      [33.895, 7.391],
      [33.922, 7.374],
      [33.928, 7.361],
      [33.927, 7.329],
      [33.96, 7.305],
      [34.011, 7.228],
      [34.014, 7.108],
      [34.061, 7.078],
      [34.081, 7.053],
      [34.157, 7.011],
      [34.165, 6.997],
    ],
  },
  {
    n: "Pashal North",
    si: 11,
    hq: [33.354, 7.588],
    poly: [
      [33.314, 7.193],
      [33.028, 7.68],
      [33.035, 7.672],
      [33.058, 7.671],
      [33.088, 7.658],
      [33.12, 7.665],
      [33.208, 7.649],
      [33.299, 7.589],
      [33.387, 7.621],
      [33.482, 7.601],
      [33.508, 7.584],
      [33.536, 7.578],
      [33.558, 7.584],
      [33.636, 7.569],
      [33.659, 7.556],
      [33.718, 7.495],
      [33.733, 7.49],
    ],
  },
  {
    n: "Verteth",
    si: 11,
    hq: [32.95, 7.35],
    poly: [
      [33.002, 7.724],
      [33.001, 7.711],
      [33.028, 7.68],
      [33.314, 7.193],
      [33.3, 7.15],
      [32.6, 6.959],
      [32.6, 7.9],
      [32.81, 7.9],
      [32.818, 7.843],
      [32.834, 7.83],
      [32.939, 7.832],
    ],
  },
  {
    n: "Gumuruk",
    si: 11,
    hq: [34.0, 6.55],
    poly: [
      [33.546, 6.659],
      [34.165, 6.997],
      [34.179, 6.922],
      [34.205, 6.887],
      [34.315, 6.843],
      [34.433, 6.805],
      [34.499, 6.728],
      [33.861, 5.907],
      [33.543, 6.65],
    ],
  },
  {
    n: "Pariang",
    si: 12,
    hq: [30.41, 9.38],
    poly: [
      [30.32, 9.444],
      [30.505, 9.44],
      [30.505, 9.339],
      [30.46, 9.292],
      [30.445, 9.3],
      [30.32, 9.3],
    ],
  },
  {
    n: "Jamjang",
    si: 12,
    hq: [30.05, 9.38],
    poly: [
      [29.96, 9.453],
      [30.14, 9.449],
      [30.14, 9.3],
      [29.96, 9.3],
    ],
  },
  {
    n: "Lake NO",
    si: 12,
    hq: [29.87, 9.38],
    poly: [
      [29.78, 9.457],
      [29.96, 9.453],
      [29.96, 9.3],
      [29.78, 9.3],
    ],
  },
  {
    n: "Tuoch",
    si: 12,
    hq: [30.6, 9.38],
    poly: [
      [30.505, 9.44],
      [30.713, 9.435],
      [30.727, 9.441],
      [30.747, 9.473],
      [30.805, 9.505],
      [30.802, 9.559],
      [30.823, 9.58],
      [30.887, 9.606],
      [31.098, 9.606],
      [30.892, 9.6],
      [30.828, 9.573],
      [30.821, 9.557],
      [30.829, 9.5],
      [30.757, 9.455],
      [30.75, 9.441],
      [30.751, 9.35],
      [30.763, 9.338],
      [30.794, 9.334],
      [30.505, 9.339],
    ],
  },
  {
    n: "Aliny",
    si: 12,
    hq: [30.23, 9.38],
    poly: [
      [30.14, 9.449],
      [30.32, 9.444],
      [30.32, 9.3],
      [30.14, 9.3],
    ],
  },
  {
    n: "Jau",
    si: 12,
    hq: [29.51, 9.38],
    poly: [
      [29.42, 9.466],
      [29.6, 9.461],
      [29.6, 9.3],
      [29.42, 9.3],
    ],
  },
  {
    n: "Blemnhom",
    si: 12,
    hq: [29.33, 9.38],
    poly: [
      [29.24, 9.47],
      [29.42, 9.466],
      [29.42, 9.3],
      [29.24, 9.3],
    ],
  },
  {
    n: "Wunkur",
    si: 12,
    hq: [29.69, 9.38],
    poly: [
      [29.6, 9.461],
      [29.78, 9.457],
      [29.78, 9.3],
      [29.6, 9.3],
    ],
  },
  {
    n: "Abiemnom",
    si: 12,
    hq: [29.15, 9.38],
    poly: [
      [29.24, 9.3],
      [29.0, 9.3],
      [29.0, 9.47],
      [29.03, 9.475],
      [29.24, 9.47],
    ],
  },
];
const mk = (t, a, tx) => {
  const e = document.createElementNS(NS, t);
  for (const k in a) e.setAttribute(k, a[k]);
  if (tx) e.textContent = tx;
  return e;
};
PL.forEach(([n, lon, lat, ty, ap]) => {
  const x = X(lon),
    y = Y(lat),
    c = ty == "c";
  const g = $(c ? "#gc" : "#gt");
  g.append(
    mk("circle", {
      cx: x,
      cy: y,
      r: c ? 3.2 : 1.8,
      fill: c ? "#fff" : "#e6dfcc",
      stroke: "#000000",
      "stroke-width": 0.8,
    }),
    mk(
      "text",
      {
        x: x + (c ? 5 : 3.5),
        y: y + 3,
        class: c ? "cw" : "tw",
      },
      n,
    ),
  );
  if (ap) {
    const q = mk("path", {
      d: PLANE,
      class: "apl",
    });
    q.dataset.x = x;
    q.dataset.y = y;
    $("#ga").append(q);
  }
});
const cs = PL.filter((p) => p[3] == "c");
cs.forEach((a, i) =>
  cs
    .map((b) => [b, (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2])
    .filter((q) => q[1] > 0)
    .sort((p, q) => p[1] - q[1])
    .slice(0, 2)
    .forEach(([b]) =>
      $("#gm").append(
        mk("line", {
          x1: X(a[1]),
          y1: Y(a[2]),
          x2: X(b[1]),
          y2: Y(b[2]),
          class: "mesh",
        }),
      ),
    ),
);
document
  .querySelectorAll(".legend input")
  .forEach((i) => (i.onchange = () => $("#" + i.dataset.g).classList.toggle("hide", !i.checked)));
// zoom & pan
const svg = $("#map"),
  V0 = [0, 0, 600, 470];
let V = V0.slice(),
  drag = null;
const setV = () => {
  svg.setAttribute("viewBox", V.join(" "));
  svg.classList.toggle("z", V[2] < 400);
};
svg.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const r = svg.getBoundingClientRect(),
      f = e.deltaY < 0 ? 0.8 : 1.25,
      w = Math.min(V0[2], Math.max(110, V[2] * f)),
      h = w * AR,
      mx = V[0] + ((e.clientX - r.left) / r.width) * V[2],
      my = V[1] + ((e.clientY - r.top) / r.height) * V[3];
    V = [...cl2(mx - ((mx - V[0]) * w) / V[2], my - ((my - V[1]) * w) / V[2], w, h), w, h];
    schedV();
  },
  {
    passive: false,
  },
);
svg.onmousedown = (e) => (drag = [e.clientX, e.clientY, V[0], V[1]]);
addEventListener("mouseup", () => (drag = null));
addEventListener("mousemove", (e) => {
  if (!drag) return;
  const r = svg.getBoundingClientRect();
  {
    const c = cl2(
      drag[2] - ((e.clientX - drag[0]) / r.width) * V[2],
      drag[3] - ((e.clientY - drag[1]) / r.width) * V[2],
      V[2],
      V[3],
    );
    V[0] = c[0];
    V[1] = c[1];
  }
  schedV();
});
svg.ondblclick = () => {
  V = V0.slice();
  setV();
};
// ===== SCROLL STORY: zooms state by state =====
const sv = $("#smap"),
  N = DATA.length + 1,
  ST = $("#story");
const bb = (d) => {
  const xs = d.poly.map((p) => X(p[0])),
    ys = d.poly.map((p) => Y(p[1]));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
const fit = (b) => {
  let w = (b[2] - b[0]) * 1.5,
    h = (b[3] - b[1]) * 1.5;
  if (w / h > 600 / 470) h = (w * 470) / 600;
  else w = (h * 600) / 470;
  const cx = (b[0] + b[2]) / 2,
    cy = (b[1] + b[3]) / 2;
  return [cx - w / 2, cy - h / 2, w, h];
};
const T = [[0, 0, 600, 470], ...DATA.map((d) => fit(bb(d)))];
DATA.forEach((d) => {
  const p = mk("polygon", {
    points: d.poly.map((q) => X(q[0]) + "," + Y(q[1])).join(" "),
    class: "reg" + (d.admin ? " admin" : ""),
  });
  p.style.cursor = "pointer";
  p.onclick = () => go(DATA.indexOf(d) + 1);
  p.onmousemove = (ev) => tip(ev, d);
  p.onmouseleave = () => ($("#tip").style.display = "none");
  d.sp = p;
  sv.append(p);
});
let sTx = [];
function buildSP() {
  document.querySelectorAll("#smap .spl").forEach((e) => e.remove());
  sTx = [];
  PL.forEach(([n, lo, la, ty, ap]) => {
    if (ty == "t" && !ap) return;
    const g = mk("g", {
      class: "spl",
    });
    if (ty != "a")
      g.append(
        mk("circle", {
          cx: X(lo),
          cy: Y(la),
          r: 1.6,
          fill: "#fff",
        }),
      );
    const t = mk(
      "text",
      {
        x: X(lo),
        y: Y(la) - 3,
        class: "sl",
      },
      n,
    );
    g.append(t);
    sv.append(g);
    sTx.push(t);
  });
  sKick();
}
buildSP();
const lab = DATA.map((d) => {
  const t = mk(
    "text",
    {
      x: d.c[0],
      y: d.c[1],
      class: "sl",
    },
    "",
  );
  t.style.opacity = 0;
  sv.append(t);
  return t;
});
$("#sbar").innerHTML = ["Overview", ...DATA.map((d) => d.n)]
  .map((n, i) => `<button data-i="${i}">${n}</button>`)
  .join("");
$("#sbar").onclick = (e) => {
  const b = e.target.closest("button");
  if (b) go(+b.dataset.i);
};
let cur = T[0].slice(),
  tgt = T[0],
  step = -1,
  gt = 0;
function paint() {
  DATA.forEach((d, i) => {
    const on = step < 1 || step - 1 === i;
    d.sp.style.fill = col(d);
    d.sp.style.fillOpacity = on ? (step < 1 ? 0.75 : 0.9) : 0.12;
    d.sp.style.stroke = on && step > 0 ? "#fff" : "#000000";
    d.sp.style.strokeWidth = on && step > 0 ? "2px" : "1px";
  });
  card();
}
function card() {
  const k = $("#sk");
  if (step < 1) {
    const t = totals();
    $("#sn").textContent = "South Sudan";
    $("#sp").textContent = ((t.r / t.t) * 100).toFixed(1) + "%";
    k.innerHTML = [
      ["Registered", fmt(t.r)],
      ["Target", fmt(t.t)],
      ["Remaining", fmt(t.rem)],
      ["Active sites", t.s],
    ]
      .map((x) => `<div><small>${x[0]}</small><b>${x[1]}</b></div>`)
      .join("");
    return;
  }
  const d = DATA[step - 1];
  $("#sn").textContent = d.n;
  $("#sp").textContent = pct(d).toFixed(1) + "%";
  k.innerHTML = [
    ["Registered", fmt(d.r)],
    ["Target", fmt(d.t)],
    ["Remaining", fmt(d.t - d.r)],
    ["Active sites", d.s],
    ["Pending", fmt(d.p)],
    ["Status", d.o],
  ]
    .map((x) => `<div><small>${x[0]}</small><b>${x[1]}</b></div>`)
    .join("");
}
function go(i) {
  step = i;
  tgt = T[i];
  document.querySelectorAll("#sdots i").forEach((e, j) => e.classList.toggle("on", j === i));
  paint();
  clearTimeout(gt);
  gt = setTimeout(() => {
    let la = 10.2,
      lo = 30,
      z = 6;
    if (i > 0) {
      const p = DATA[i - 1].poly;
      lo = p.reduce((a, q) => a + q[0], 0) / p.length;
      la = p.reduce((a, q) => a + q[1], 0) / p.length;
      z = DATA[i - 1].admin ? 9 : 7;
    } else {
      la = 7.3;
      lo = 30;
    }
    $("#gf").src =
      `https://maps.google.com/maps?q=${la.toFixed(3)},${lo.toFixed(3)}&z=${z}&t=k&output=embed`;
  }, 500);
}
function onS() {
  const r = ST.getBoundingClientRect(),
    p = Math.max(0, Math.min(0.999, -r.top / (r.height - innerHeight)));
  const i = Math.floor(p * N);
  if (i !== step) go(i);
}
var sRun = 0,
  sDn = 0;
function sKick() {
  if (!sRun) {
    sRun = 1;
    sDn = 0;
    requestAnimationFrame(storyF);
  }
}
function storyF() {
  const dl = Math.abs(tgt[0] - cur[0]) + Math.abs(tgt[1] - cur[1]) + Math.abs(tgt[2] - cur[2]);
  for (let k = 0; k < 4; k++) cur[k] += (tgt[k] - cur[k]) * 0.09;
  sv.setAttribute("viewBox", cur.map((v) => v.toFixed(2)).join(" "));
  const s = cur[2] / 600;
  {
    const ks = new Set();
    lab.forEach((t) => {
      if (+t.style.opacity > 0) ks.add(K(t.textContent));
    });
    sTx.forEach((t) => {
      t.style.fontSize = 9 * s + "px";
      t.style.opacity = s < 0.55 && step < 1 && !ks.has(K(t.textContent)) ? 1 : 0;
    });
    SCL.forEach((t) => {
      t.style.fontSize = 7.2 * s + "px";
      t.style.strokeWidth = 2 * s + "px";
    });
  }
  lab.forEach((t, i) => {
    const nm = step - 1 === i || s < 0.6 ? DATA[i].n : SH[DATA[i].n] || DATA[i].n;
    t.textContent = nm;
    t.style.fontSize =
      Math.min(11 * Math.pow(s, 0.6), ((BBW[i] || 60) * 0.9) / (nm.length * 0.62)) + "px";
    t.style.opacity = 0; /* hide state names in the “Dig deeper into each state” explorer */
  });
  if (dl < 0.05 && sDn) {
    sRun = 0;
    sDn = 0;
  } else {
    sDn = dl < 0.05;
    requestAnimationFrame(storyF);
  }
}
sKick();

// ===== STATE VIEW + COUNTIES =====
// County names listed from general knowledge (verify against your official list). Load a boundary GeoJSON to replace them with real data.
const CN = {
  "Central Equatoria": ["Juba", "Kajo-Keji", "Lainya", "Morobo", "Terekeka", "Yei"],
  "Eastern Equatoria": [
    "Budi",
    "Ikotos",
    "Kapoeta East",
    "Kapoeta North",
    "Kapoeta South",
    "Lafon",
    "Magwi",
    "Torit",
  ],
  "Western Equatoria": [
    "Ezo",
    "Ibba",
    "Maridi",
    "Mundri East",
    "Mundri West",
    "Mvolo",
    "Nagero",
    "Nzara",
    "Tambura",
    "Yambio",
  ],
  Jonglei: [
    "Akobo",
    "Ayod",
    "Bor South",
    "Duk",
    "Fangak",
    "Nyirol",
    "Pigi/Canal",
    "Twic East",
    "Uror",
  ],
  Lakes: [
    "Awerial",
    "Cueibet",
    "Rumbek Centre",
    "Rumbek East",
    "Rumbek North",
    "Wulu",
    "Yirol East",
    "Yirol West",
  ],
  Unity: ["Guit", "Koch", "Leer", "Mayendit", "Mayom", "Panyijiar", "Rubkona"],
  "Upper Nile": [
    "Akoka",
    "Baliet",
    "Fashoda",
    "Longochuk",
    "Maban",
    "Maiwut",
    "Malakal",
    "Manyo",
    "Melut",
    "Nasir",
    "Panyikang",
    "Renk",
    "Ulang",
  ],
  Warrap: ["Gogrial East", "Gogrial West", "Tonj East", "Tonj North", "Tonj South", "Twic"],
  "Northern Bahr el Ghazal": [
    "Aweil Centre",
    "Aweil East",
    "Aweil North",
    "Aweil South",
    "Aweil West",
  ],
  "Western Bahr el Ghazal": ["Jur River", "Raja", "Wau"],
  "Abyei Administrative Area": ["Abyei"],
  "Pibor Administrative Area": ["Boma", "Lekuangole", "Pibor", "Pochalla", "Vertet"],
  "Ruweng Administrative Area": ["Abiemnhom", "Pariang"],
};
const hh = (t) => {
  let x = 0;
  for (const c of t) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return x;
};
function buildC(d, names) {
  return;
  const w = names.map((n) => 0.6 + (hh(n) % 80) / 100),
    W = w.reduce((a, b) => a + b, 0);
  d.cty = names.map((n, j) => ({
    n,
    w: w[j] / W,
    f: ((hh(n + "x") % 30) - 15) / 100,
  }));
}
const cnty = (d, c) => {
  const t = Math.round(d.t * c.w),
    r = Math.min(t, Math.max(0, Math.round(((t * pct(d)) / 100) * (1 + c.f))));
  return {
    t,
    r,
    s: Math.max(1, Math.round(d.s * c.w)),
    p: Math.round(d.p * c.w),
  };
};
let view = null,
  selC = null,
  tv = null;
const inPoly = (x, y, p) => {
  let o = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if (
      p[i][1] > y != p[j][1] > y &&
      x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]
    )
      o = !o;
  return o;
};
let CL = [];
function syncCounties() {
  CTYL.forEach((o) => {
    const c = o.c;
    o.e.classList.toggle("on", selC === c.n && view === c.si);
    o.e.classList.toggle("off", view !== null && view !== c.si);
    o.d.classList.toggle("off", view !== c.si);
  });
  lk = "";
  hiRoads();
}
function drawCounties() {
  const g = $("#gy"),
    gl = $("#gcl");
  if (drawCounties._v === CVER && CTYL.length && g.children.length === COUNTIES.length) {
    syncCounties();
    return;
  }
  drawCounties._v = CVER;
  g.innerHTML = "";
  gl.innerHTML = "";
  CL = [];
  CTYL = [];
  COUNTIES.forEach((c) => {
    const m = DATA[c.si].cty.find((x) => x.n === c.n),
      on = selC === c.n && view === c.si,
      off = view !== null && view !== c.si;
    const e = mk("polygon", {
      points: c.poly.map((p) => X(p[0]) + "," + Y(p[1])).join(" "),
      class: "cty p" + (m && m.ph ? m.ph : 0) + (on ? " on" : "") + (off ? " off" : ""),
    });
    e.dataset.c = c.n;
    e.onclick = (ev) => {
      ev.stopPropagation();
      if (TOOL === "edit" && view === c.si && c.hq) {
        openPop("cty", c, ev);
        return;
      }
      if (view !== c.si) {
        pick(c.si);
        zoomState(c.si);
      }
      selC = c.n;
      cview();
      drawCounties();
    };
    e.onmousemove = (ev) => tip(ev, DATA[c.si], c.n);
    e.onmouseleave = () => ($("#tip").style.display = "none");
    g.append(e);
    if (c.lx === undefined) {
      const q = c.hq || [
        c.poly.reduce((a, p) => a + p[0], 0) / c.poly.length,
        c.poly.reduce((a, p) => a + p[1], 0) / c.poly.length,
      ];
      c.lx = X(q[0]);
      c.ly = Y(q[1]);
    }
    const t = mk(
      "text",
      {
        x: c.lx,
        y: c.ly,
        class: "ccl",
      },
      c.n,
    );
    t._c = c;
    const dt = mk("circle", {
      cx: c.lx,
      cy: c.ly,
      r: 1.1,
      class: "cdot" + (view === c.si ? "" : " off"),
    });
    gl.append(dt, t);
    CL.push(t);
    CTYL.push({
      e,
      d: dt,
      c,
    });
  });
  lk = "";
  hiRoads();
}
function zoomState(i) {
  window.gSync && gSync(i);
  $("#mchip").innerHTML = "<b>" + DATA[i].n + "</b> · " + DATA[i].cty.length + " counties";
  view = i;
  selC = null;
  tv = adj(fit(bb(DATA[i])));
  svg.classList.add("zs");
  $("#bk").hidden = false;
  $("#dd2").hidden = false;
  cview();
  drawCounties();
}
function reset() {
  window.gReset && gReset();
  $("#mchip").textContent = "Hover a state · click to zoom";
  view = null;
  selC = null;
  tv = V0.slice();
  svg.classList.remove("zs");
  $("#bk").hidden = true;
  $("#dd2").hidden = true;
  cview();
  drawCounties();
}
$("#bk").onclick = reset;
svg.ondblclick = reset;
svg.addEventListener("mousedown", () => (tv = null));
svg.addEventListener("wheel", () => (tv = null));
BBW = DATA.map((d) => {
  const x = d.poly.map((p) => X(p[0]));
  return Math.max(...x) - Math.min(...x);
});
let LB = [...document.querySelectorAll("#marks .lbl")],
  GC = [...document.querySelectorAll("#gc text")],
  GT = [...document.querySelectorAll("#gt text")],
  GA = [...document.querySelectorAll("#ga .apl")];
let lk = "";
function updLabels() {
  const z = V[2] / 600,
    zp = Math.pow(z, 0.6),
    obs = [],
    used = new Set(),
    hit = (a) => obs.some((o) => a[0] < o[2] && a[2] > o[0] && a[1] < o[3] && a[3] > o[1]);
  LB.forEach((t, i) => {
    const d = DATA[i],
      on = view === i,
      txt = on || z < 0.6 ? d.n : SH[d.n] || d.n;
    if (t.textContent !== txt) t.textContent = txt;
    const fs = Math.min((on ? 12 : 8.2) * zp, ((BBW[i] || 60) * 0.9) / (txt.length * 0.74));
    t.style.fontSize = fs + "px";
    t.style.strokeWidth = Math.max(0.6, fs * 0.3) + "px";
    const vis = view === null && SHOWST;
    t.style.opacity = vis ? 1 : 0;
    if (vis) {
      used.add(K(txt));
      const w = txt.length * fs * 0.74;
      obs.push([d.c[0] - w / 2, d.c[1] - fs, d.c[0] + w / 2, d.c[1] + fs * 0.3]);
    }
  });
  const put = (t, b, fs, k) => {
    const ok = !(k && used.has(k)) && !hit(b);
    t.style.fontSize = fs + "px";
    t.style.strokeWidth = Math.max(0.5, fs * 0.28) + "px";
    t.style.opacity = ok ? 1 : 0;
    if (ok) {
      obs.push(b);
      if (k) used.add(k);
    }
    return ok;
  };
  const left = (t, f0) => {
    const fs = f0 * zp,
      x = +t.getAttribute("x"),
      y = +t.getAttribute("y");
    put(t, [x, y - fs, x + t.textContent.length * fs * 0.56, y + fs * 0.2], fs, K(t.textContent));
  };
  const mid = (t, x, y, fs, k) => {
    const w = t.textContent.length * fs * 0.56;
    t.setAttribute("x", x);
    t.setAttribute("y", y);
    return put(t, [x - w / 2, y - fs, x + w / 2, y + fs * 0.25], fs, k);
  };
  const doCL = () =>
    CL.forEach((t) => {
      const c = t._c,
        fs = 6.6 * zp;
      if (view !== c.si) {
        t.style.opacity = 0;
        return;
      }
      const k = K(c.n),
        w = t.textContent.length * fs * 0.56,
        cand = [
          [0, 1.25 * fs],
          [0, -0.75 * fs],
          [w / 2 + fs * 0.5, 0.35 * fs],
          [-w / 2 - fs * 0.5, 0.35 * fs],
          [0, 2.5 * fs],
          [0, -2 * fs],
        ];
      let ok = false;
      for (const [dx, dy] of cand) {
        if (mid(t, c.lx + dx, c.ly + dy, fs, k)) {
          ok = true;
          break;
        }
      }
      if (!ok && !used.has(k)) {
        const f2 = fs * 0.85;
        t.setAttribute("x", c.lx);
        t.setAttribute("y", c.ly + 1.25 * fs);
        t.style.fontSize = f2 + "px";
        t.style.opacity = 1;
        used.add(k);
        obs.push([
          c.lx - t.textContent.length * f2 * 0.28,
          c.ly + 0.2 * fs,
          c.lx + t.textContent.length * f2 * 0.28,
          c.ly + 1.5 * fs,
        ]);
      }
    });
  if (view !== null) doCL();
  GC.forEach((t) => left(t, 8.5));
  if (view === null) doCL();
  RDL.forEach((t) => {
    const fs = 6 * zp;
    mid(t, t._x, t._y - fs * 0.6, fs, "rd" + K(t._r.name));
  });
  GSP.forEach((p) => {
    const sz = 9 * zp,
      x = +p.dataset.x,
      y = +p.dataset.y;
    p.setAttribute("transform", `translate(${x - sz / 2},${y - sz}) scale(${sz / 24})`);
  });
  GS.forEach((t) => {
    const s = t._s,
      fs = 6 * zp;
    if (!svg.classList.contains("z") && view === null) {
      t.style.opacity = 0;
      return;
    }
    mid(t, X(s.lon), Y(s.lat) + fs * 1.3, fs, "s" + K(s.name));
  });
  if (svg.classList.contains("z")) GT.forEach((t) => left(t, 6.5));
  GA.forEach((p) => {
    const sz = 8.5 * zp,
      x = +p.dataset.x,
      y = +p.dataset.y;
    p.setAttribute("transform", `translate(${x - sz / 2},${y - sz - 2 * zp}) scale(${sz / 24})`);
  });
  HND.forEach((c) => c.setAttribute("r", 4.2 * zp + 1 + (c._ring ? 4 : 0)));
}
(function an(now) {
  const k = V[2].toFixed(1) + "|" + view + "|" + svg.classList.contains("z");
  if (k !== lk && now - lastU > 90) {
    lk = k;
    lastU = now;
    updLabels();
  }
  if (tv) {
    mvMark();
    for (let k = 0; k < 4; k++) V[k] += (tv[k] - V[k]) * 0.12;
    setV();
    if (Math.abs(tv[2] - V[2]) < 0.3 && Math.abs(tv[0] - V[0]) < 0.3) tv = null;
  }
  requestAnimationFrame(an);
})(0);
function cview() {
  const L = $("#cl");
  if (view === null) {
    $("#cn").textContent = "";
    L.innerHTML = '<p class="m">Click a state on the map to see all its counties.</p>';
    return;
  }
  const d = DATA[view];
  $("#cn").textContent = "· " + d.n + " (" + d.cty.length + ")";
  L.innerHTML =
    d.cty
      .map((c) => ({
        c,
        v: cnty(d, c),
      }))
      .sort((a, b) => b.v.r / b.v.t - a.v.r / a.v.t)
      .map(({ c, v }) => {
        const p = (v.r / v.t) * 100,
          cl = p >= 70 ? "var(--g)" : p >= 40 ? "var(--a)" : "var(--r)";
        return `<div class="cr ${selC === c.n ? "on" : ""}" data-c="${c.n}" style="--cl:${cl}"><div class="h"><span>${c.n}</span><b>${p.toFixed(0)}%</b></div><div class="bar"><i style="width:${p}%"></i></div><div class="dt"><span>Target <b>${fmt(v.t)}</b></span><span>Registered <b>${fmt(v.r)}</b></span><span>Remaining <b>${fmt(v.t - v.r)}</b></span><span>Active sites <b>${v.s}</b></span></div></div>`;
      })
      .join("") +
    '<p class="m" style="margin-top:8px">County figures are sample splits of the state totals until real county data is connected.</p>';
  L.querySelectorAll(".cr").forEach(
    (r) =>
      (r.onclick = () => {
        selC = selC === r.dataset.c ? null : r.dataset.c;
        cview();
        drawCounties();
      }),
  );
}
$("#gj").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const J = JSON.parse(await f.text());
    COUNTIES.length = 0;
    const by = {};
    (J.features || []).forEach((ft) => {
      const pr = ft.properties || {},
        n =
          pr.ADM2_EN ||
          pr.admin2Name ||
          pr.shapeName ||
          pr.NAME_2 ||
          pr.name ||
          pr.county ||
          pr.COUNTY ||
          pr.Admin2 ||
          "County";
      const g = ft.geometry;
      if (!g) return;
      const rings =
        g.type == "Polygon"
          ? [g.coordinates[0]]
          : g.type == "MultiPolygon"
            ? g.coordinates.map((p) => p[0])
            : [];
      if (!rings.length) return;
      const ring = rings.sort((a, b) => b.length - a.length)[0].map((p) => [p[0], p[1]]),
        cx = ring.reduce((a, p) => a + p[0], 0) / ring.length,
        cy = ring.reduce((a, p) => a + p[1], 0) / ring.length;
      const si = DATA.findIndex((d) => inPoly(cx, cy, d.poly));
      if (si < 0) return;
      COUNTIES.push({
        n: (() => {
          const q = (x) => x.toLowerCase().replace(/[^a-z]/g, ""),
            m = DATA[si].cty.find(
              (c) => q(c.n) == q(n) || q(c.n).includes(q(n)) || q(n).includes(q(c.n)),
            );
          return m ? m.n : n;
        })(),
        si,
        poly: ring.filter((_, i) => i % 2 == 0 || ring.length < 80),
      });
      (by[si] = by[si] || []).push(n);
    });
    Object.keys(by).forEach((i) => buildC(DATA[i], by[i]));
    drawCounties();
    cview();
  } catch (x) {
    $("#cl").innerHTML =
      '<p class="m">Could not read that file. Use a GeoJSON with lon/lat county polygons.</p>';
  }
};
cview();

// ===== REAL DATA VIEWS (from Distribution of States and Administrative Areas by Regions) =====
const phTxt = (p) =>
  p == 1
    ? "Phase 1 · Low risk"
    : p == 2
      ? "Phase 2 · Risk"
      : p == 3
        ? "Phase 3 · High risk"
        : "Not classified";
const phCol = (p) =>
  p == 1 ? "var(--g)" : p == 2 ? "var(--a)" : p == 3 ? "var(--r)" : "var(--mu)";
const cstat = (d) => ({
  ok: d.cty.filter((c) => c.ph == 1 || c.ph == 2).length,
  bad: d.cty.filter((c) => c.ph == 3).length,
  unk: d.cty.filter((c) => !c.ph).length,
  air: d.cty.filter((c) => c.md == "Air").length,
  road: d.cty.filter((c) => c.md == "Road").length,
  river: d.cty.filter((c) => c.md == "River").length,
});
function totals() {
  return {
    t: SUMMARY.emp,
    r: 0,
    s: 0,
    rem: 0,
  };
}
function tip(e, d, cn) {
  const t = $("#tip");
  t.style.display = "block";
  t.style.left = Math.min(e.clientX + 16, innerWidth - 270) + "px";
  t.style.top = Math.min(e.clientY + 16, innerHeight - 230) + "px";
  const c = cn && d.cty.find((x) => x.n === cn);
  if (c) {
    setH(
      t,
      `<h4>${c.n}</h4><div>State <span>${d.n}</span></div><div>Govt employees <span>${fmt(c.e)}</span></div><div>Security <span style="color:${phCol(c.ph)}">${c.ph ? "Phase " + c.ph + " · " + c.st : "Not classified"}</span></div><div>Safety <span>${c.sf || "—"}</span></div><div>Access <span>${c.ac || "—"}</span></div><div>Transport <span>${c.md || "—"}</span></div>`,
    );
    return;
  }
  const k = cstat(d);
  setH(
    t,
    `<h4>${d.n}</h4><div>HQ <span>${d.hq}</span></div><div>Region <span>${d.rg}</span></div><div>Security <span style="color:${phCol(d.ph)}">${phTxt(d.ph)}</span></div><div>Safety / Access <span>${d.sf} · ${d.ac}</span></div><div>Govt employees <span>${fmt(d.t)}</span></div><div>Total registered <span>${fmt(window.__stReg(d))}</span></div><div>Counties / locations <span>${d.nc}</span></div><div>Safe &amp; accessible <span>${k.ok}</span></div><div>Unsafe / inaccessible <span>${k.bad}</span></div>`,
  );
}
function render() {
  const T = SUMMARY,
    k = [
      ["bx-group", "Govt Employees", fmt(T.emp), "to be registered", 100],
      ["bx-buildings", "States & Admin Areas", T.states, "10 states · 3 admin areas", 100],
      ["bx-map-pin", "Counties / Locations", T.cty, "earmarked for head count / BMR", 100],
      [
        "bx-shield-alt-2",
        "Safe & Accessible",
        T.ok,
        Math.round((T.ok / T.cty) * 100) + "% of locations",
        (T.ok / T.cty) * 100,
      ],
      [
        "bx-error",
        "Unsafe / Inaccessible",
        T.bad,
        "≈" + T.air + " air · " + T.road + " road · " + T.river + " river access",
        (T.bad / T.cty) * 100,
      ],
    ];
  $("#kpis").innerHTML = k
    .map(
      (x) =>
        `<div class="panel kpi"><div class="t"><span class="ic"><i class="bx ${x[0]}"></i></span>${x[1]}</div><div class="v">${x[2]}</div><div class="s">${x[3]}</div><div class="bar"><i style="width:${x[4]}%"></i></div></div>`,
    )
    .join("");
  const sorted = DATA.map((d, i) => [d, i]).sort((a, b) => b[0].t - a[0].t);
  $("#list").innerHTML = sorted
    .filter(
      ([d]) =>
        FLT == "all" ||
        (FLT == "state" && !d.admin) ||
        (FLT == "admin" && d.admin) ||
        (FLT == "high" && d.ph == 3),
    )
    .map(
      ([d, i]) =>
        `<div class="row ${i === sel ? "sel" : ""}" data-i="${i}" style="--cl:${col(d)}"><div class="h"><span>${d.n}</span><b>${fmt(d.t)}</b></div><div class="bar"><i style="width:${pct(d)}%"></i></div></div>`,
    )
    .join("");
  document.querySelectorAll(".row").forEach(
    (r) =>
      (r.onclick = () => {
        pick(+r.dataset.i);
        zoomState(+r.dataset.i);
      }),
  );
  DATA.forEach((d) => {
    d.el.style.fill = col(d);
    d.el.style.color = col(d);
  });
  if (sel === null) {
    sel = sorted[0][1];
    DATA[sel].el.classList.add("sel");
  }
  const d = DATA[sel],
    c = cstat(d);
  $("#dn").innerHTML =
    `${d.n} <span class="badge" style="color:${phCol(d.ph)};float:right">${phTxt(d.ph)}</span>`;
  $("#dd").innerHTML = [
    ["HQ", d.hq],
    ["Region", d.rg],
    ["Govt employees", fmt(d.t)],
    ["Counties / locations", d.nc],
    ["Safety", d.sf],
    ["Accessibility", d.ac],
    ["Safe & accessible", c.ok],
    ["Unsafe / inaccessible", c.bad],
    ["By air", c.air],
    ["By road", c.road],
    ["By river", c.river],
    ["Type", d.admin ? "Admin area" : "State"],
  ]
    .filter((x) => x[1] !== 0 || x[0].startsWith("By") || x[0].startsWith("Unsafe"))
    .map((x) => `<div><small>${x[0]}</small><b>${x[1] || "—"}</b></div>`)
    .join("");
  const hi = DATA.filter((x) => x.ph == 3),
    bigC = DATA.map((x) => [x, x.cty.slice().sort((a, b) => b.e - a.e)[0]]).sort(
      (a, b) => b[0].t - a[0].t,
    )[0],
    worst = DATA.map((x) => [x, cstat(x).bad]).sort((a, b) => b[1] - a[1])[0];
  $("#ai").innerHTML =
    `<p><b>${hi.length}</b> areas are Phase 3 high risk: ${hi.map((x) => x.n.replace("Administrative Area", "Admin Area")).join(", ")}.</p><p><b>${bigC[0].n}</b> has the largest workforce (${fmt(bigC[0].t)}), and <b>${bigC[1].n}</b> alone holds ${fmt(bigC[1].e)} of them.</p><p><b>${worst[0].n}</b> has the most unsafe or inaccessible locations: ${worst[1]} of ${worst[0].nc}.</p>`;
}
function cview() {
  const L = $("#cl");
  if (view === null) {
    $("#cn").textContent = "";
    L.innerHTML =
      '<p class="m">Click a state on the map to see all its counties and locations.</p>';
    return;
  }
  const d = DATA[view];
  $("#cn").textContent = "· " + d.n + " (" + d.cty.length + ")";
  L.innerHTML = d.cty
    .slice()
    .sort((a, b) => b.e - a.e)
    .map(
      (c) =>
        `<div class="cr ${selC === c.n ? "on" : ""}" data-c="${c.n}" style="--cl:${phCol(c.ph)}"><div class="h"><span>${c.n}</span><b>${fmt(c.e)}</b></div><div class="bar"><i style="width:${Math.max(3, (c.e / d.cty.reduce((a, x) => Math.max(a, x.e), 1)) * 100)}%"></i></div><div class="dt" style="grid-template-columns:1fr"><span>Security <b style="color:${phCol(c.ph)}">${c.ph ? "Phase " + c.ph + " · " + c.st : "Not classified"}</b></span><span>Safety · Access <b>${c.sf || "—"} · ${c.ac || "—"}</b></span><span>Remarks <b>${c.rm || "—"}</b></span><span>Recommendation <b>${c.rc || "—"}</b></span></div></div>`,
    )
    .join("");
  L.querySelectorAll(".cr").forEach((r) => {
    r.onclick = () => {
      selC = selC === r.dataset.c ? null : r.dataset.c;
      cview();
      drawCounties();
    };
    r.onmousemove = (ev) => tip(ev, d, r.dataset.c);
    r.onmouseleave = () => ($("#tip").style.display = "none");
  });
}
function card() {
  const k = $("#sk");
  if (step < 1) {
    $("#sn").textContent = "South Sudan";
    $("#sp").textContent = fmt(SUMMARY.emp);
    k.innerHTML = [
      ["Govt employees", "to be registered"],
      ["Locations", SUMMARY.cty],
      ["Safe & accessible", SUMMARY.ok],
      ["Unsafe / inaccessible", SUMMARY.bad],
    ]
      .map((x) => `<div><small>${x[0]}</small><b>${x[1]}</b></div>`)
      .join("");
    return;
  }
  const d = DATA[step - 1],
    c = cstat(d);
  $("#sn").textContent = d.n;
  $("#sp").textContent = fmt(d.t);
  k.innerHTML = [
    ["HQ", d.hq],
    ["Security", phTxt(d.ph)],
    ["Safety", d.sf],
    ["Access", d.ac],
    ["Locations", d.nc],
    ["Unsafe", c.bad],
  ]
    .map((x) => `<div><small>${x[0]}</small><b>${x[1]}</b></div>`)
    .join("");
}
render();
paint();
cview();
// ===== RIVERS & ROADS (traced from UN map no. 4450) =====
const RIV = [
    "30.27,8.66 30.29,8.67 30.28,8.64 30.27,8.64 30.27,8.66",
    "29.48,8.92 29.39,8.84 29.39,8.62 29.37,8.58",
    "29.33,8.55 29.37,8.58",
    "31.68,9.14 31.76,9.12 31.79,9.15 31.83,9.15 31.87,9.19 32.07,9.12 32.14,9.07 32.15,9.02 32.19,8.99 32.22,8.92 32.36,8.92 32.41,8.86 32.42,8.76 32.50,8.75 32.51,8.68 32.56,8.71 32.63,8.65 32.70,8.62 32.73,8.59 32.71,8.54 32.69,8.51",
    "32.71,12.07 32.69,11.93 32.70,11.66 32.75,11.56",
    "30.59,7.66 30.60,7.65 30.57,7.63 30.56,7.65 30.59,7.66",
    "30.66,7.62 30.68,7.64 30.67,7.60 30.66,7.61 30.66,7.62",
    "31.48,6.38 31.47,6.43 31.47,6.43 31.50,6.39 31.48,6.38",
    "31.45,6.39 31.47,6.38 31.47,6.36 31.46,6.36 31.45,6.39",
    "30.51,9.33 30.41,9.27 30.37,9.21 30.35,9.16 30.38,9.12 30.38,9.01 30.25,8.82 30.23,8.76 30.26,8.51 30.32,8.46 30.30,8.39 30.37,8.28 30.34,8.17 30.35,8.08 30.32,7.98 30.39,7.95 30.45,7.83 30.52,7.79 30.52,7.71 30.55,7.67 30.52,7.51 30.57,7.42 30.57,7.35 30.67,7.23 30.67,7.16 30.74,7.05 30.81,7.01 30.84,6.89 30.89,6.84 31.01,6.82 31.08,6.75 31.15,6.71 31.22,6.61 31.30,6.56 31.33,6.44 31.39,6.40 31.42,6.36 31.42,6.30",
    "30.53,6.33 30.59,6.34 30.59,6.32 30.54,6.27",
    "30.54,6.27 30.53,6.33",
    "29.74,9.08 29.71,9.03 29.60,8.97 29.56,8.92 29.48,8.92",
    "29.35,8.45 29.33,8.34",
    "30.63,7.56 30.64,7.56 30.63,7.53 30.62,7.54 30.63,7.56",
    "30.47,7.55 30.50,7.61 30.52,7.62 30.48,7.52 30.47,7.55",
    "30.57,7.48 30.57,7.50 30.58,7.50 30.59,7.49 30.57,7.48",
    "30.47,7.45 30.45,7.46 30.47,7.47 30.48,7.46 30.47,7.45",
    "29.33,8.28 29.33,8.34",
    "29.33,8.28 29.29,8.29 29.33,8.34",
    "30.69,7.77 30.71,7.77 30.70,7.74 30.69,7.75 30.69,7.77",
    "30.48,7.74 30.50,7.73 30.49,7.70 30.48,7.71 30.48,7.74",
    "25.12,9.98 25.12,10.10 25.18,10.22 25.27,10.25 25.37,10.24 25.45,10.27",
    "32.75,11.56 32.74,11.51 32.66,11.36 32.62,11.16 32.64,10.93 32.62,10.82 32.52,10.76 32.46,10.66 32.41,10.63",
    "25.57,10.26 25.45,10.27",
    "32.41,10.63 32.34,10.61 32.30,10.54 32.10,10.31 32.12,10.24 32.22,10.23 32.23,10.22 32.22,10.11 32.25,9.94 32.23,9.87 32.11,9.72",
    "24.90,9.80 25.00,9.87 25.12,9.98",
    "30.35,9.37 30.36,9.35 30.33,9.34 30.32,9.36 30.35,9.37",
    "30.96,9.32 30.87,9.30 30.62,9.35 30.55,9.35 30.51,9.33",
    "31.15,9.28 30.96,9.32",
    "32.11,9.72 31.97,9.65 31.93,9.61 31.86,9.58 31.75,9.51 31.67,9.47 31.65,9.44 31.64,9.32 31.58,9.23",
    "30.41,9.21 30.41,9.23 30.43,9.24 30.43,9.23 30.41,9.21",
    "31.58,9.23 31.53,9.21 31.42,9.21 31.15,9.28",
    "31.68,9.14 31.61,9.18 31.58,9.23",
    "29.79,9.11 29.83,9.12 30.00,9.24 30.07,9.26 30.23,9.26 30.39,9.33 30.51,9.33",
    "29.74,9.08 29.68,9.07 29.67,9.10 29.73,9.12 29.74,9.08",
    "31.79,8.75 31.81,8.74 31.82,8.70",
    "31.82,8.70 31.79,8.72 31.79,8.75",
    "29.37,8.58 29.37,8.47 29.35,8.45",
    "29.35,8.45 29.32,8.52 29.33,8.55",
    "30.35,8.44 30.35,8.46 30.35,8.47 30.37,8.44 30.35,8.44",
    "30.72,8.39 30.77,8.42 30.78,8.50 30.84,8.61 30.87,8.77 30.82,8.83 30.82,8.88 30.89,8.93 30.93,9.04 30.97,9.04 31.04,9.13 31.09,9.16 31.10,9.23 31.15,9.28",
    "30.72,8.39 30.73,8.33 30.70,8.30 30.71,8.25 30.68,8.16",
    "30.72,8.39 30.64,8.29 30.64,8.22 30.68,8.16",
    "30.68,8.16 30.66,8.09 30.67,7.98 30.59,7.73 30.59,7.66",
    "30.55,7.26 30.54,7.30 30.55,7.30 30.57,7.24 30.55,7.26",
    "30.24,6.73 30.27,6.79 30.29,6.79 30.26,6.73 30.24,6.73",
    "31.39,6.45 31.39,6.47 31.41,6.47 31.41,6.44 31.39,6.45",
    "31.45,6.23 31.43,6.20 31.41,6.21 31.42,6.30",
    "31.42,6.30 31.46,6.25 31.47,6.18 31.50,6.15 31.54,6.15 31.55,6.03 31.60,5.99 31.61,5.92 31.71,5.80 31.78,5.47 31.74,5.32 31.74,5.09 31.62,4.86 31.57,4.73 31.56,4.60 31.49,4.51 31.52,4.43 31.48,4.21 31.61,3.98 31.72,3.88 31.86,3.79 31.91,3.70",
    "32.04,3.50 31.91,3.70",
    "32.04,3.50 31.96,3.45",
    "33.11,6.71 33.13,6.63 33.25,6.53",
    "33.00,7.67 33.02,7.64 33.05,7.65 33.07,7.63 33.12,7.65 33.18,7.62 33.20,7.62 33.26,7.59 33.28,7.56 33.39,7.60 33.48,7.58 33.53,7.54 33.56,7.56 33.65,7.53 33.70,7.48 33.75,7.46 33.83,7.37 33.90,7.36 33.91,7.30 33.94,7.29 33.99,7.22 33.99,7.14 33.97,7.12 34.04,7.06 34.06,7.03 34.14,6.99 34.15,6.90 34.19,6.87 34.22,6.86 34.22,6.85 34.26,6.82 34.41,6.79 34.49,6.69 34.48,6.61 34.57,6.59 34.59,6.60 34.66,6.56 34.67,6.52 34.72,6.46 34.76,6.47",
    "34.76,6.47 34.83,6.48 34.93,6.41",
    "33.25,6.53 33.27,6.41 33.35,6.26",
    "32.96,8.44 33.01,8.45 33.06,8.42 33.11,8.41 33.10,8.36 33.13,8.35 33.13,8.30 33.18,8.27",
    "33.00,7.67 32.99,7.62 33.01,7.53 32.99,7.50",
    "33.16,8.20 33.16,8.22 33.18,8.27",
    "33.00,7.67 32.97,7.72 32.98,7.74 32.96,7.79 33.00,7.81 33.01,7.86 33.04,7.87 33.05,7.92 33.07,7.92 33.08,7.91 33.08,7.95 33.15,7.98 33.13,8.04 33.16,8.08 33.14,8.09 33.13,8.14 33.16,8.15 33.16,8.20",
    "32.69,8.51 32.75,8.45 32.82,8.46 32.92,8.41 32.96,8.44",
    "32.99,7.50 32.97,7.46 32.98,7.40 32.95,7.32 32.97,7.27 32.98,7.14 33.04,7.11 33.05,7.00 33.04,6.96 32.97,6.93 33.01,6.90 33.02,6.83 33.11,6.71",
    "33.35,6.26 33.45,6.11 33.51,6.06 33.61,6.03 33.68,5.92 33.74,5.94 33.83,5.94 33.90,5.97 34.03,5.94 34.20,5.93 34.25,5.95 34.28,5.99",
    "29.48,8.92 29.46,8.95 29.35,8.99 29.31,9.05 29.21,9.05 29.08,9.13",
    "25.57,10.26 25.74,10.30 25.83,10.29 25.92,10.31 26.04,10.25",
    "29.08,9.13 29.02,9.13 28.98,9.16 28.87,9.18 28.85,9.20 28.84,9.24 28.80,9.23 28.76,9.29 28.72,9.27 28.67,9.30 28.63,9.31 28.61,9.36 28.46,9.39 28.45,9.43 28.40,9.43 28.37,9.46 28.33,9.46 28.31,9.50",
  ],
  RDS = [
    "32.73,12.07 32.75,11.94 32.72,11.75 32.76,11.67 32.77,11.55",
    "32.77,11.55 33.18,11.56",
    "32.68,11.78 32.67,11.73 32.71,11.54 32.63,11.31 32.62,11.17 32.58,11.06 32.58,10.89 32.60,10.84 32.59,10.82 32.50,10.77 32.44,10.70 32.31,10.64 32.27,10.58 32.13,10.44",
    "32.13,10.44 32.12,10.59",
    "33.43,10.51 33.21,10.39",
    "32.77,11.55 32.87,11.46 32.99,11.30 33.09,10.81 33.21,10.39",
    "32.77,11.55 32.77,11.44 32.70,11.22 32.66,11.19 32.64,11.11 32.66,11.05 32.66,10.89 32.68,10.75 32.61,10.67 32.58,10.61 32.55,10.41 32.55,10.36 32.54,10.30 32.51,10.28",
    "32.51,10.28 32.28,10.30 32.21,10.27 32.17,10.28",
    "33.21,10.39 33.28,10.16",
    "33.28,10.16 33.04,10.19 33.00,10.19 32.91,10.14 32.85,10.14 32.72,10.17 32.64,10.27 32.51,10.28",
    "33.57,9.80 33.73,9.91 33.80,9.93 33.91,10.02",
    "33.57,9.80 33.48,9.80 33.41,9.88 33.34,9.91 33.31,9.94 33.28,10.16",
    "32.13,10.44 32.06,10.37 32.05,10.25 32.17,10.24 32.17,10.13 32.21,10.02 32.21,9.95 32.07,9.75",
    "25.08,10.01 25.09,9.99 25.08,9.94 25.04,9.88 24.90,9.77",
    "28.47,9.50 28.49,9.40",
    "32.51,10.28 32.49,10.14 32.39,10.06 32.37,10.02 32.25,9.91 32.22,9.81 32.21,9.69 32.16,9.61 31.92,9.56 31.82,9.49 31.75,9.48 31.67,9.42 31.65,9.34",
    "32.07,9.75 31.79,9.54 31.68,9.50 31.63,9.46 31.56,9.29",
    "31.65,9.34 31.64,9.28 31.62,9.26",
    "31.56,9.29 31.50,9.23 31.40,9.21 31.18,9.29 31.04,9.32 30.92,9.44 30.81,9.58",
    "31.62,9.26 31.59,9.21 31.60,9.12",
    "29.81,8.99 29.83,9.06 29.82,9.09",
    "26.92,9.46 26.92,9.30 26.94,9.23 26.92,9.13 27.02,9.05 27.02,9.02",
    "29.81,8.99 30.00,9.03 30.10,8.95 30.40,8.98 30.66,9.04 30.79,8.92 30.90,8.88 30.96,8.87 31.04,8.89 31.16,8.89 31.22,8.87 31.23,8.88 31.17,9.01 31.17,9.05 31.18,9.08 31.26,9.13 31.60,9.12",
    "27.73,9.51 27.74,9.45 27.60,9.15 27.60,9.09 27.62,9.01 27.59,8.89",
    "27.59,8.89 27.49,8.80 27.47,8.70 27.42,8.65",
    "27.42,8.65 27.28,8.79 27.23,8.84 27.23,8.88 27.20,8.90 27.16,8.96 27.02,9.02",
    "32.97,8.48 32.77,8.50 32.71,8.61 32.60,8.70 32.62,8.77 32.48,8.80 32.36,8.94 32.20,9.00 32.13,9.09 31.95,9.18 31.82,9.21 31.65,9.34",
    "28.49,9.40 28.51,9.37 28.46,9.29 28.52,9.21 28.52,9.12 28.47,9.11 28.46,9.01 28.42,8.97 28.41,8.91 28.31,8.74 28.21,8.64 28.11,8.39",
    "28.11,8.39 27.99,8.42 27.98,8.47 28.00,8.55 27.99,8.71 28.00,8.76 27.91,8.80 27.78,8.80 27.76,8.89 27.59,8.89",
    "24.90,9.77 24.83,9.71 24.77,9.59",
    "24.58,8.85 24.67,8.67 24.71,8.61 24.73,8.50 24.75,8.45 24.77,8.43 24.85,8.39 24.97,8.38 25.07,8.35 25.31,8.41 25.42,8.39 25.64,8.40 25.73,8.37",
    "33.73,8.23 33.77,8.41 33.83,8.46 33.88,8.45 33.98,8.53 33.97,8.61 33.99,8.76 33.95,8.88 33.96,8.91 33.91,9.01 33.91,9.12 33.87,9.17 33.89,9.23 33.85,9.34 33.87,9.38",
    "33.73,8.23 33.66,8.26 33.65,8.30 33.57,8.33 33.46,8.34 33.33,8.32 33.28,8.33 33.17,8.31 33.02,8.47 32.97,8.48",
    "29.20,8.22 29.17,8.23 29.09,8.21",
    "30.24,8.07 30.22,8.11 30.07,8.18 30.03,8.32 29.97,8.36 29.95,8.40 29.92,8.62 29.84,8.76 29.81,8.99",
    "31.62,9.09 31.73,8.90 31.75,8.82 31.86,8.66 31.97,8.55 31.98,8.41 32.04,8.36 32.11,8.13 32.12,8.03",
    "33.77,8.20 33.73,8.23",
    "29.09,8.21 29.02,8.22 28.89,8.18 28.74,8.04",
    "28.11,8.39 28.22,8.37 28.40,8.27 28.46,8.20 28.53,8.19 28.63,8.07 28.74,8.04",
    "31.39,7.98 31.35,8.07 31.32,8.29 31.35,8.34 31.35,8.40 31.39,8.51 31.40,8.64 31.47,8.77 31.57,8.86 31.62,9.09",
    "30.24,8.07 30.10,8.03 29.43,7.99",
    "29.43,7.99 29.40,7.98 29.32,8.04 29.20,8.22",
    "28.74,8.04 28.65,7.96 28.58,7.93 28.50,7.84 28.46,7.77 28.41,7.73",
    "28.11,8.39 28.03,8.28 28.00,8.20 28.00,8.11 28.03,8.02 27.98,7.74 28.00,7.58",
    "27.42,8.65 27.42,8.58 27.51,8.47 27.56,8.32 27.64,8.23 27.69,8.03 27.74,7.96 27.80,7.92 27.89,7.81 27.97,7.61 28.00,7.58",
    "28.41,7.73 28.30,7.68 28.28,7.67 28.23,7.70 28.17,7.69 28.05,7.58 28.01,7.58",
    "25.73,8.37 25.77,8.26 25.86,8.20 25.91,8.09 26.07,7.96 26.13,7.84 26.16,7.70 26.23,7.62 26.32,7.58 26.46,7.61 26.62,7.59 26.74,7.62 26.83,7.59 26.89,7.62 27.04,7.61 27.17,7.68 27.31,7.68 27.37,7.69 27.68,7.64 27.72,7.65 27.91,7.58 28.01,7.58",
    "31.47,7.36 31.39,7.59 31.41,7.82 31.39,7.98",
    "28.01,7.58 28.11,7.55 28.14,7.50 28.25,7.46 28.36,7.29 28.46,7.25 28.50,7.25 28.63,7.16 28.75,7.14",
    "31.47,7.36 31.39,7.32 31.35,7.23 31.35,7.14 31.32,7.03 31.32,6.91 31.31,6.88 31.33,6.77",
    "28.75,7.14 29.15,6.93 29.47,6.82 29.54,6.76 29.64,6.72 29.69,6.67",
    "32.12,8.03 32.28,7.98 32.61,7.77 32.64,7.71 32.67,7.62 32.72,7.58 32.84,7.55 32.97,7.62 32.91,7.42 32.80,7.29 32.82,7.23 32.77,7.15 32.77,7.07 32.80,7.03 32.95,6.92 32.95,6.84 33.07,6.66",
    "33.07,6.66 33.03,6.63",
    "29.69,6.67 29.62,6.40",
    "29.69,6.67 29.74,6.64 29.76,6.59 30.02,6.43 30.06,6.36 30.09,6.35",
    "30.09,6.35 30.38,6.36 30.47,6.41",
    "30.47,6.41 30.56,6.39 30.60,6.22 30.65,6.19",
    "31.33,6.77 31.36,6.67 31.47,6.51 31.50,6.37 31.53,6.32 31.55,6.07",
    "30.65,6.19 30.74,6.11 30.91,6.06",
    "33.03,6.63 32.79,6.51 32.70,6.42 32.49,6.30 32.45,6.24 32.38,6.20 31.97,6.05 31.87,6.04 31.76,6.05 31.67,6.01 31.59,5.94",
    "31.55,6.07 31.59,5.94",
    "29.62,6.40 29.60,6.32 29.63,6.18 29.60,6.13 29.60,6.10 29.69,6.05 29.80,5.91 29.87,5.90 29.91,5.94",
    "30.91,6.06 31.02,6.02 31.10,6.02 31.25,5.93 31.29,5.94 31.41,5.89 31.44,5.89 31.49,5.91",
    "33.03,6.63 33.00,6.57 33.00,6.54 33.09,6.59 33.20,6.50 33.22,6.46 33.20,6.41 33.35,6.12 33.44,6.01 33.56,5.97 33.62,5.91 33.76,5.73 33.77,5.67 33.82,5.59 33.83,5.55 33.87,5.52",
    "28.01,7.58 28.05,7.47 27.95,7.17 27.96,7.14 27.93,7.01 27.94,6.93 27.89,6.84 27.92,6.72 27.90,6.69 27.80,6.61 27.75,6.54 27.75,6.47 27.69,6.38 27.70,6.22 27.66,5.96 27.60,5.78 27.45,5.49",
    "27.45,5.49 27.41,5.41 27.35,5.40 27.31,5.34 27.24,5.31",
    "30.23,5.20 30.29,5.22 30.37,5.29",
    "29.92,5.94 30.05,5.82 30.04,5.78 30.08,5.67 30.06,5.63 30.12,5.47 30.09,5.38 30.10,5.27 30.13,5.22 30.23,5.20",
    "27.24,5.31 27.19,5.30",
    "30.67,4.97 30.81,5.03 30.84,5.03 30.86,5.00 30.90,5.02",
    "30.37,5.29 30.46,5.19 30.49,5.13 30.67,4.97",
    "30.23,5.20 30.19,5.14 30.10,5.05 29.76,4.96 29.69,4.91",
    "27.24,5.31 27.31,5.15 27.41,5.08 27.47,4.97 27.56,4.96 27.69,4.89 27.71,4.86 27.81,4.90 27.85,4.88 28.00,4.88",
    "28.00,4.88 28.02,4.84",
    "29.69,4.91 29.62,4.86 29.43,4.80",
    "30.90,5.02 30.94,5.05 31.04,5.07 31.14,5.01 31.18,5.04 31.28,5.05 31.42,4.98 31.48,4.84 31.56,4.78 31.59,4.73",
    "31.60,5.92 31.75,5.67 31.80,5.51 31.81,5.31 31.78,5.25 31.79,5.18 31.70,4.91 31.70,4.85 31.64,4.80 31.63,4.74 31.59,4.73",
    "33.87,5.52 33.81,5.43 33.83,5.35 33.73,5.14 33.74,5.01 33.67,4.89 33.67,4.77 33.60,4.69 33.55,4.67",
    "27.67,4.67 27.72,4.75 27.78,4.71 27.84,4.75 27.97,4.80 28.02,4.84",
    "31.65,4.58 31.62,4.62 31.59,4.73",
    "33.61,4.55 33.55,4.67",
    "35.89,4.52 35.91,4.56",
    "35.82,5.14 35.79,5.17 35.82,5.19 35.82,5.23 35.79,5.26 35.72,5.27 35.67,5.31",
    "28.38,4.48 28.29,4.50 28.23,4.58 28.18,4.66 28.16,4.71 28.18,4.76 28.15,4.84 28.02,4.84",
    "29.43,4.80 29.32,4.81 29.17,4.70 29.09,4.67 28.85,4.69 28.80,4.68 28.75,4.70 28.58,4.60 28.48,4.53 28.44,4.53 28.41,4.48 28.38,4.48",
    "33.54,4.67 33.45,4.63 33.39,4.52 33.27,4.42",
    "33.01,4.32 32.91,4.40 32.83,4.36",
    "32.49,4.31 32.27,4.39 32.06,4.53 32.02,4.53 32.00,4.56 31.89,4.60 31.86,4.60 31.82,4.55 31.78,4.53 31.65,4.58",
    "32.83,4.36 32.75,4.40 32.62,4.35 32.60,4.32 32.53,4.30 32.49,4.31",
    "33.27,4.42 33.30,4.27",
    "31.59,4.73 31.56,4.74 31.54,4.71 31.51,4.71 31.37,4.60 31.35,4.53 31.32,4.53 31.30,4.51 31.28,4.42 31.23,4.40 31.13,4.29 31.04,4.24",
    "33.30,4.27 33.11,4.19 33.07,4.22 33.01,4.32",
    "34.25,4.35 34.01,4.50 33.94,4.48 33.85,4.53 33.73,4.51 33.61,4.55",
    "31.04,4.24 30.97,4.14 30.83,4.06",
    "30.83,4.06 30.77,4.03 30.64,3.99",
    "29.69,4.91 29.82,4.75 29.82,4.68 29.87,4.60 29.99,4.47 30.03,4.46 30.12,4.40 30.20,4.23 30.38,4.10 30.64,3.99",
    "30.64,3.99 30.56,3.94 30.49,3.86 30.29,3.83 30.26,3.81",
    "31.93,3.76 31.89,3.79 31.87,3.84 31.95,4.03 31.98,4.20 31.94,4.25 31.84,4.29 31.82,4.32 31.83,4.39 31.65,4.58",
    "31.67,3.58 31.62,3.65 31.64,3.77 31.53,3.86 31.40,3.85 31.29,3.87 31.12,3.97 30.95,3.94 30.90,4.02 30.83,4.06",
    "32.83,4.36 32.86,4.30 32.86,4.24 32.95,4.09 33.10,3.91 33.18,3.71 33.12,3.65",
    "32.02,3.50 32.01,3.54 31.96,3.59 31.93,3.76",
    "30.64,3.99 30.68,3.89 30.68,3.81 30.82,3.59 30.86,3.45 30.89,3.43",
    "32.05,3.41 32.02,3.50",
  ];
function mkLines(a, cls, id) {
  const g = mk("g", {
    id,
  });
  a.forEach((l) =>
    g.append(
      mk("polyline", {
        class: cls,
        points: l
          .split(" ")
          .map((q) => {
            const [o, t] = q.split(",");
            return X(+o).toFixed(1) + "," + Y(+t).toFixed(1);
          })
          .join(" "),
      }),
    ),
  );
  return g;
}
const gR = mkLines(RIV, "rv", "grv"),
  gD = mkLines(RDS, "rd", "grd");
$("#regs").after(gD);
gD.after(gR);
DATA[DATA.length - 1].sp.after(gD.cloneNode(true), gR.cloneNode(true));
[
  ["grv", "Rivers"],
  ["grd", "Main roads"],
].forEach(([id, t]) => {
  const l = document.createElement("label");
  l.innerHTML = `<input type="checkbox" checked> ${t}`;
  l.firstChild.onchange = (e) =>
    document
      .querySelectorAll("#" + id)
      .forEach((g) => g.classList.toggle("hide", !e.target.checked));
  document.querySelector(".legend").append(l);
});
// ===== MODERN UI BEHAVIOUR =====
const zb = (f) => {
  const w = Math.min(V0[2], Math.max(110, V[2] * f)),
    h = w * AR,
    cx = V[0] + V[2] / 2,
    cy = V[1] + V[3] / 2;
  tv = [...cl2(cx - w / 2, cy - h / 2, w, h), w, h];
};
$("#zi").onclick = () => zb(0.65);
$("#zo").onclick = () => zb(1.5);
$("#zr").onclick = reset;
document.querySelectorAll("#chips button").forEach(
  (b) =>
    (b.onclick = () => {
      FLT = b.dataset.f;
      document.querySelectorAll("#chips button").forEach((x) => x.classList.toggle("on", x === b));
      render();
    }),
);
const io = window.IntersectionObserver
  ? new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      {
        threshold: 0.08,
      },
    )
  : {
      observe: (e) => e.classList.add("in"),
      unobserve() {},
    };
document.querySelectorAll(".kpi,.mapbox,.side .panel").forEach((e, i) => {
  e.classList.add("pre");
  e.style.transitionDelay = Math.min(i * 60, 360) + "ms";
  io.observe(e);
});
document.querySelectorAll(".kpi .v").forEach((el) => {
  const raw = el.textContent,
    n = parseInt(raw.replace(/,/g, ""));
  if (!n) return;
  const t0 = performance.now();
  (function f(t) {
    const k = Math.min(1, (t - t0) / 1200),
      v = Math.round(n * (1 - Math.pow(1 - k, 3)));
    el.textContent = v.toLocaleString("en-US");
    if (k < 1) requestAnimationFrame(f);
    else el.textContent = raw;
  })(t0);
});
// ===== INTERACTIVE STATE EXPLORER (offline) =====
const kmx = (a, b) => {
  const m = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  return Math.hypot((b[0] - a[0]) * 111.32 * Math.cos(m), (b[1] - a[1]) * 110.57);
};
const parseL = (a) => a.map((l) => l.split(" ").map((q) => q.split(",").map(Number))),
  RV = parseL(RIV),
  RD = parseL(RDS);
const lenIn = (L, poly) => {
  let k = 0;
  L.forEach((l) => {
    for (let i = 1; i < l.length; i++) {
      const a = l[i - 1],
        b = l[i];
      if (inPoly((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, poly)) k += kmx(a, b);
    }
  });
  return k;
};
const areaKm = (poly) => {
  const m = ((poly.reduce((a, p) => a + p[1], 0) / poly.length) * Math.PI) / 180;
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return (Math.abs(s) / 2) * 111.32 * Math.cos(m) * 110.57;
};
function metr(d) {
  if (d.m) return d.m;
  const t = PL.filter((p) => inPoly(p[1], p[2], d.poly));
  return (d.m = {
    area: areaKm(d.poly),
    rd: lenIn(
      ROADS.map((r) => r.pts),
      d.poly,
    ),
    rv: lenIn(RV, d.poly),
    cities: t.filter((p) => p[3] == "c").map((p) => p[0]),
    air: t.filter((p) => p[4]).map((p) => p[0]),
    towns: t.filter((p) => p[3] != "c" && !p[4]).map((p) => p[0]),
  });
}
const pi = '<i class="pi bx bxs-plane-alt"></i>';
const stack = (p) => {
  const t = p[0] + p[1] + p[2] + p[3] || 1,
    c = ["var(--mu)", "var(--g)", "var(--a)", "var(--r)"],
    n = ["Not classified", "Phase 1", "Phase 2", "Phase 3"];
  return `<div class="stk">${p.map((v, i) => `<i style="width:${(v / t) * 100}%;background:${c[i]}"></i>`).join("")}</div><div class="lg">${p.map((v, i) => (v ? `<span><i style="background:${c[i]}"></i>${v} ${n[i]}</span>` : "")).join("")}</div>`;
};
function deep(i) {
  const el = $("#dv");
  if (i < 1) {
    const G = {};
    DATA.forEach((d) => {
      const r = (G[d.rg] = G[d.rg] || {
        e: 0,
        c: 0,
        p: [0, 0, 0, 0],
        n: [],
      });
      r.e += d.t;
      r.c += d.cty.length;
      d.cty.forEach((c) => r.p[c.ph]++);
      r.n.push(d.n);
    });
    el.innerHTML =
      "<h2>National overview</h2>" +
      Object.entries(G)
        .map(
          ([k, r]) =>
            `<div class="rg"><div class="h"><b>${k} region</b><span>${fmt(r.e)} employees \u00b7 ${r.c} locations</span></div><div class="bar"><i style="width:${(r.e / SUMMARY.emp) * 100}%"></i></div><small>${r.n.join(" \u00b7 ")}</small>${stack(r.p)}</div>`,
        )
        .join("") +
      '<p class="m">Pick a state to see its security split, workforce by county, access routes, key towns, airports and every county in detail.</p>';
    return;
  }
  const d = DATA[i - 1],
    m = metr(d),
    c = cstat(d),
    mx = Math.max(...d.cty.map((x) => x.e), 1),
    p = [0, 0, 0, 0];
  d.cty.forEach((x) => p[x.ph]++);
  el.innerHTML = `<div><h2>${d.n}</h2><span class="badge" style="color:${phCol(d.ph)}">${phTxt(d.ph)}</span></div>
 <div class="fg"><div><small>HQ</small><b>${d.hq}</b></div><div><small>Region</small><b>${d.rg}</b></div><div><small>Govt employees</small><b>${fmt(d.t)}</b></div><div><small>Counties / locations</small><b>${d.cty.length}</b></div><div><small>Area (approx.)</small><b>${fmt(Math.round(m.area / 100) * 100)} km\u00b2</b></div><div><small>Safety \u00b7 Access</small><b>${d.sf} \u00b7 ${d.ac}</b></div><div><small>Main roads (approx.)</small><b>${fmt(Math.round(m.rd / 10) * 10)} km</b></div><div><small>Rivers on map (approx.)</small><b>${fmt(Math.round(m.rv / 10) * 10)} km</b></div></div>
 <div><h3>Security across counties</h3>${stack(p)}</div>
 <div><h3>Workforce by county</h3>${d.cty
   .slice()
   .sort((a, b) => b.e - a.e)
   .slice(0, 7)
   .map(
     (x) =>
       `<div class="wb" style="--cl:${phCol(x.ph)}"><span>${x.n}</span><div class="bar"><i style="width:${Math.max(3, (x.e / mx) * 100)}%"></i></div><b>${fmt(x.e)}</b></div>`,
   )
   .join("")}</div>
 <div><h3>Registration sites</h3>${siteTags(d)}</div>
 <div><h3>Access routes</h3><span class="tag">By air: ${c.air}</span><span class="tag">By road: ${c.road}</span><span class="tag">By river: ${c.river}</span></div>
 <div><h3>Key places on the map</h3>${m.cities.map((n) => `<span class="tag">${m.air.includes(n) ? pi : ""}<b>${n}</b></span>`).join("")}${m.air
   .filter((n) => !m.cities.includes(n))
   .map((n) => `<span class="tag">${pi}${n}</span>`)
   .join("")}${m.towns
   .slice(0, 14)
   .map((n) => `<span class="tag">${n}</span>`)
   .join("")}</div>
 <div><h3>All counties \u00b7 tap to expand</h3>${d.cty
   .slice()
   .sort((a, b) => b.e - a.e)
   .map(
     (x) =>
       `<details><summary><span><i class="dot2" style="background:${phCol(x.ph)}"></i>${x.n}</span><b>${fmt(x.e)}</b></summary><p><b>Security:</b> ${x.ph ? "Phase " + x.ph + " \u00b7 " + x.st : "Not classified"}<br><b>Safety / access:</b> ${x.sf || "\u2014"} \u00b7 ${x.ac || "\u2014"}<br><b>Remarks:</b> ${x.rm || "\u2014"}<br><b>Recommendation:</b> ${x.rc || "\u2014"}</p></details>`,
   )
   .join("")}</div>`;
}
function go(i) {
  step = i;
  tgt = T[i];
  document.querySelectorAll("#sbar button").forEach((b, j) => b.classList.toggle("on", j === i));
  const on = document.querySelector("#sbar button.on");
  if (on) on.parentNode.scrollLeft = on.offsetLeft - 70;
  paint();
  deep(i);
  hiStory();
  hiStoryCty();
  sKick();
  $("#dv").scrollTop = 0;
}
$("#sp1").onclick = () => go((step + N - 1) % N);
$("#sn1").onclick = () => go((step + 1) % N);
ST.addEventListener("keydown", (e) => {
  if (e.key == "ArrowRight") go((step + 1) % N);
  if (e.key == "ArrowLeft") go((step + N - 1) % N);
});
$("#dd2").onclick = () => {
  go(view + 1);
  ST.scrollIntoView({
    behavior: "smooth",
  });
};
go(0);
lk = "";
// ===== GOOGLE MAPS (online) =====
const GHEX = {
    0: "#aab0b6",
    1: "#5fcf9a",
    2: "#d9a441",
    3: "#e5594f",
  },
  SCOL = {
    Active: "#16c784",
    Planned: "#ffb020",
    Closed: "#aab0b6",
  };
const PINP =
  "M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z";
const GL = [
  ["cty", "Counties", "local", "#C5A059"],
  ["site", "Registration sites", "local", "#5fcf9a"],
  ["town", "Towns & cities", "local", "#e6dfcc"],
  ["airport", "Airports", "airport", "#c9744a"],
  ["hospital", "Hospitals & clinics", "hospital", "#e5594f"],
  ["bank", "Banks", "bank", "#d9a441"],
  ["gov", "Government offices", "local_government_office", "#C5A059"],
  ["school", "Schools", "school", "#5fcf9a"],
  ["fuel", "Fuel stations", "gas_station", "#ff9f5e"],
  ["hotel", "Hotels", "lodging", "#8fa1b3"],
];
const isLoc = (k) => k === "cty" || k === "site" || k === "town";
let gmap = null,
  gInfo = null,
  gPolys = [],
  gLoc = {},
  gLay = {},
  gOn = {
    cty: true,
    site: false,
  },
  gSel = null,
  gOk = false,
  gKey = "",
  gAdd = false,
  gPin = null,
  gQ = Promise.resolve();
try {
  gKey = localStorage.getItem("gmkey") || "";
} catch (e) {}
const gErr = (m) => {
  $("#gmsg").textContent = m;
};
const cGeo = (c) => c.g || toGeo(c.hq[0], c.hq[1]),
  sGeo = (s) => s.g || toGeo(s.lon, s.lat);
const gLL = (g) => ({
  lat: g[1],
  lng: g[0],
});
const gTip = (d) => {
  const k = cstat(d);
  return `<div style="color:#111;font:13px system-ui;min-width:210px;line-height:1.5"><b style="font-size:14px">${d.n}</b><br>HQ: ${d.hq} \u00b7 ${d.rg}<br>Security: ${phTxt(d.ph)}<br>Employees: ${fmt(d.t)} \u00b7 ${d.cty.length} counties<br>Safe &amp; accessible: ${k.ok} \u00b7 Unsafe: ${k.bad}</div>`;
};
const gCtyTip = (c, d, ll) =>
  `<div style="color:#111;font:13px system-ui;min-width:220px;line-height:1.5"><b style="font-size:14px">${esc(c.n)}</b> <span style="color:#666">${esc(d.n)}</span><br>Employees: <b>${fmt(c.e || 0)}</b><br>Security: ${c.ph ? "Phase " + c.ph + " \u00b7 " + c.st : "Not classified"}<br>Safety / access: ${c.sf || "\u2014"} \u00b7 ${c.ac || "\u2014"}<br>${c.rm ? "Remarks: " + esc(c.rm) + "<br>" : ""}${c.rc ? "Recommendation: " + esc(c.rc) + "<br>" : ""}<a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${ll.lat()},${ll.lng()}">Open in Google Maps</a></div>`;
window.__dly = function () {
  let R = [];
  try {
    R = JSON.parse(localStorage.getItem("bioreg.reports") || "[]");
  } catch (e) {}
  const m = new Map();
  R.forEach((r) => {
    if (r.rs === "Rejected") return;
    let a = m.get(r.site);
    if (!a) {
      a = {
        n: 0,
        ok: 0,
        pend: 0,
        fail: 0,
        d: 0,
      };
      m.set(r.site, a);
    }
    const n = (r.dcas || []).reduce((t, x) => t + (+x.n || 0), 0),
      z = (r.mdas || []).reduce(
        (t, x) => ({
          ok: t.ok + (+x.ok || 0),
          pend: t.pend + (+x.pend || 0),
          fail: t.fail + (+x.fail || 0),
        }),
        {
          ok: 0,
          pend: 0,
          fail: 0,
        },
      );
    a.n += n;
    a.d++;
    if (z.ok + z.pend + z.fail) {
      a.ok += z.ok;
      a.pend += z.pend;
      a.fail += z.fail;
    } else a.ok += n;
  });
  return m;
};
window.__stReg = function (d) {
  const m = window.__dly(),
    i = DATA.indexOf(d);
  let t = 0;
  SITES.forEach((x) => {
    const a = m.get(x.id);
    if (a && (stAt(x.lon, x.lat) === i || inPoly(x.lon, x.lat, d.poly))) t += a.n;
  });
  return t;
};
function gSiteTip(s) {
  const g = sGeo(s),
    si = stAt(s.lon, s.lat),
    c = si >= 0 ? cntyNear(s.lon, s.lat, si) : null,
    i = SITES.indexOf(s);
  return `<div style="color:#111;font:13px system-ui;min-width:220px;line-height:1.5"><b style="font-size:14px">${esc(s.name)}</b><br><span style="display:inline-block;padding:1px 9px;border-radius:10px;background:${SCOL[s.status] || "#ffb020"};color:#111;font-weight:700;font-size:11px">${esc(s.status)}</span><br>${si >= 0 ? esc(DATA[si].n) : ""}${c ? " \u00b7 " + esc(c.n) + " county" : ""}<br>${s._excelKey ? `Govt Employees: ${s.cap ? fmt(s.cap) : "\u2014"}<br>Capacity / Day: \u2014<br>` : `Capacity / Day: ${s.cap ? fmt(s.cap) : "\u2014"}<br>`}${!s._excelKey && s.note ? esc(s.note) + "<br>" : ""}${(() => {
    const a = window.__dly().get(s.id);
    if (!a) return "";
    const t = s._excelKey ? +s.cap || 0 : 0;
    return `<b>Registered (daily reports): ${fmt(a.n)}${t ? " of " + fmt(t) + " (" + Math.round((a.n / t) * 100) + "%)" : ""}</b><br><span style=\"color:#16a56d\">${fmt(a.ok)} completed</span> \u00b7 <span style=\"color:#C5A059\">${fmt(a.pend)} pending</span> \u00b7 <span style=\"color:#e5484d\">${fmt(a.fail)} failed</span><br>`;
  })()}${g[1]}, ${g[0]}<br><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${g[1]},${g[0]}">Open in Google Maps</a> \u00b7 <a href="#" onclick="gEditSite(${i});return false">Edit</a></div>`;
}
function gEditSite(i) {
  if (SITES[i]) needAuth(() => amodal("site", SITES[i]));
}
function gLoad(key) {
  return new Promise((res, rej) => {
    if (window.google && google.maps) return res();
    window.gm_authFailure = () =>
      gErr(
        "Google rejected the key. Check that Maps JavaScript API and Places API (New) are enabled, billing is on, and the key allows this site.",
      );
    window.__gmcb = () => res();
    const s = document.createElement("script");
    s.src =
      "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(key) +
      "&libraries=places&callback=__gmcb";
    s.async = true;
    s.onerror = () => rej(new Error("offline"));
    document.head.append(s);
  });
}
function gInit() {
  gmap = new google.maps.Map($("#gcan"), {
    center: {
      lat: 7.4,
      lng: 30.2,
    },
    zoom: 6,
    mapTypeId: "hybrid",
    streetViewControl: false,
    mapTypeControl: true,
    mapTypeControlOptions: {
      mapTypeIds: ["hybrid", "roadmap", "terrain"],
    },
  });
  gInfo = new google.maps.InfoWindow({
    disableAutoPan: true,
  });
  DATA.forEach((d, i) => {
    const p = new google.maps.Polygon({
      paths: d.poly.map((q) => gLL(toGeo(q[0], q[1]))),
      strokeColor: GHEX[d.ph],
      strokeWeight: 1.6,
      fillColor: GHEX[d.ph],
      fillOpacity: 0.14,
      map: gmap,
      clickable: true,
    });
    p.addListener("mouseover", (e) => {
      p.setOptions({
        fillOpacity: 0.3,
      });
      gInfo.setContent(gTip(d));
      gInfo.setPosition(e.latLng);
      gInfo.open(gmap);
    });
    p.addListener("mouseout", () => {
      p.setOptions({
        fillOpacity: gSel === null ? 0.14 : gSel === i ? 0.1 : 0.04,
      });
      gInfo.close();
    });
    p.addListener("click", (e) => {
      if (gAdd) {
        gAddAt(e.latLng);
        return;
      }
      pick(i);
      zoomState(i);
    });
    gPolys.push(p);
  });
  gmap.addListener("click", (e) => {
    if (gAdd) gAddAt(e.latLng);
  });
  gOk = true;
  $("#gkey").hidden = true;
  $("#gif").hidden = true;
  $("#gsl").hidden = true;
  $("#gcan").hidden = false;
  gErr("");
}
function gIframe(q, z) {
  $("#gif").src =
    "https://maps.google.com/maps?q=" +
    encodeURIComponent(q) +
    "&z=" +
    (z || 7) +
    "&t=k&output=embed";
}
function gIframeState(i) {
  gIframe(i == null ? "South Sudan" : DATA[i].n + ", South Sudan", i == null ? 6 : 7);
}
function gClear() {
  Object.values(gLoc).forEach((a) => a.forEach((m) => m.setMap(null)));
  gLoc = {};
  Object.values(gLay).forEach((a) => a.forEach((m) => m.setMap(null)));
  gLay = {};
  GL.forEach((l) => cnt(l[0], ""));
}
const cnt = (k, n) => {
  const b = document.querySelector(`#glay [data-k=${k}] span`);
  if (b) b.textContent = n;
};
function gSync(i) {
  gSel = i;
  if (!gOk) {
    gIframeState(i);
    gSiteList();
    return;
  }
  const d = DATA[i],
    b = new google.maps.LatLngBounds();
  d.poly.forEach((q) => b.extend(gLL(toGeo(q[0], q[1]))));
  gPolys.forEach((p, j) =>
    p.setOptions({
      fillOpacity: j === i ? 0.1 : 0.04,
      strokeWeight: j === i ? 2.6 : 1,
    }),
  );
  gmap.fitBounds(b, 40);
  gClear();
  gDrawLocal(i);
  Object.keys(gOn).forEach((k) => gOn[k] && !isLoc(k) && gFetch(k, d, i));
}
function gReset() {
  gSel = null;
  if (!gOk) {
    gIframeState(null);
    gSiteList();
    return;
  }
  gPolys.forEach((p) =>
    p.setOptions({
      fillOpacity: 0.14,
      strokeWeight: 1.6,
    }),
  );
  gClear();
  gDrawLocal(null);
  gmap.setCenter({
    lat: 7.4,
    lng: 30.2,
  });
  gmap.setZoom(6);
  Object.keys(gOn).forEach((k) => gOn[k] && !isLoc(k) && gFetch(k, null, null));
}
function gRedraw() {
  if (gOk) gDrawLocal(gSel);
  gSiteList();
}
/* our own data on Google Maps: counties, registration sites, towns and cities */
function gDrawLocal(i) {
  Object.values(gLoc).forEach((a) => a.forEach((m) => m.setMap(null)));
  gLoc = {};
  if (!gOk) return;
  const sel = i == null ? null : DATA[i];
  if (gOn.cty) {
    gLoc.cty = [];
    let n = 0;
    COUNTIES.forEach((c) => {
      if (sel && c.si !== i) return;
      const d = DATA[c.si],
        m0 = d.cty.find((x) => x.n === c.n),
        ph = m0 ? m0.ph || 0 : 0,
        g = cGeo(c);
      n++;
      const m = new google.maps.Marker({
        position: gLL(g),
        map: gmap,
        title: c.n,
        label: sel
          ? {
              text: c.n,
              color: "#fff",
              fontSize: "11px",
              fontWeight: "600",
            }
          : null,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: sel ? 9 : 5.5,
          fillColor: GHEX[ph],
          fillOpacity: 0.95,
          strokeColor: "#000000",
          strokeWeight: 2,
          labelOrigin: new google.maps.Point(0, 2.6),
        },
        zIndex: 5,
      });
      m.addListener("click", () => {
        const p = m.getPosition();
        gInfo.setContent(
          gCtyTip(
            m0 || {
              n: c.n,
            },
            d,
            p,
          ),
        );
        gInfo.open(gmap, m);
      });
      gLoc.cty.push(m);
      if (sel && gKey) gRefine(c, m, g);
    });
    cnt("cty", " \u00b7 " + n);
  }
  if (gOn.site) {
    gLoc.site = [];
    let n = 0;
    SITES.forEach((s) => {
      if (sel && !inPoly(s.lon, s.lat, sel.poly)) return;
      n++;
      const g = sGeo(s),
        col = SCOL[s.status] || "#ffb020";
      const m = new google.maps.Marker({
        position: gLL(g),
        map: gmap,
        title: s.name,
        label:
          sel || SITES.length <= 25
            ? {
                text: s.name,
                color: "#fff",
                fontSize: "11px",
                fontWeight: "600",
              }
            : null,
        icon: {
          path: PINP,
          fillColor: col,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 1.6,
          scale: 1.5,
          anchor: new google.maps.Point(12, 22),
          labelOrigin: new google.maps.Point(12, 32),
        },
        zIndex: 9,
      });
      m.addListener("click", () => {
        gInfo.setContent(gSiteTip(s));
        gInfo.open(gmap, m);
      });
      gLoc.site.push(m);
    });
    cnt("site", " \u00b7 " + n);
  }
  if (gOn.town) {
    gLoc.town = [];
    let n = 0;
    PL.forEach((p) => {
      if (sel && !inPoly(p[1], p[2], sel.poly)) return;
      if (p[3] === "t" && !sel) return;
      n++;
      const g = toGeo(p[1], p[2]),
        city = p[3] === "c";
      const m = new google.maps.Marker({
        position: gLL(g),
        map: gmap,
        title: p[0],
        label:
          city || sel
            ? {
                text: p[0],
                color: "#f1f2f4",
                fontSize: city ? "11px" : "10px",
              }
            : null,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: city ? 4.5 : 3,
          fillColor: "#fff",
          fillOpacity: 0.95,
          strokeColor: "#000000",
          strokeWeight: 1.2,
          labelOrigin: new google.maps.Point(0, -1.8 * (city ? 4.5 : 3)),
        },
        zIndex: 3,
      });
      m.addListener("click", () => {
        gInfo.setContent(
          `<div style="color:#111;font:13px system-ui"><b>${esc(p[0])}</b><br>${city ? "City" : p[3] === "a" ? "Airport" : "Town"}${p[4] ? " \u00b7 airport" : ""}<br>${g[1]}, ${g[0]}</div>`,
        );
        gInfo.open(gmap, m);
      });
      gLoc.town.push(m);
    });
    cnt("town", " \u00b7 " + n);
  }
}
/* refine a county pin with Google's own geocoder (only accepted when it agrees with our calibrated position) */
function gRefine(c, m, g) {
  const st = gSel;
  gQ = gQ.then(async () => {
    if (gSel !== st || !gOk) return;
    try {
      const r = await new google.maps.Geocoder().geocode({
        address: c.n + ", " + DATA[c.si].n + ", South Sudan",
        region: "SS",
      });
      const l = r.results.find((x) => {
        const p = x.geometry.location;
        return Math.abs(p.lng() - g[0]) < 0.4 && Math.abs(p.lat() - g[1]) < 0.4;
      });
      if (l && gSel === st) {
        m.setPosition(l.geometry.location);
        c.gv = [+l.geometry.location.lng().toFixed(5), +l.geometry.location.lat().toFixed(5)];
      }
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 110));
  });
}
async function gFetch(k, d, i, view) {
  const L = GL.find((x) => x[0] === k);
  try {
    const { Place } = await google.maps.importLibrary("places");
    let b = view;
    if (!b) {
      b = new google.maps.LatLngBounds();
      (d
        ? d.poly.map((q) => toGeo(q[0], q[1]))
        : [
            [24, 3.5],
            [36, 12.3],
          ]
      ).forEach((q) =>
        b.extend({
          lat: q[1],
          lng: q[0],
        }),
      );
    }
    const { places } = await Place.searchByText({
      textQuery: L[1] + " in " + (d ? d.n + ", " : "") + "South Sudan",
      includedType: L[2],
      useStrictTypeFiltering: true,
      locationRestriction: b,
      fields: [
        "displayName",
        "location",
        "formattedAddress",
        "rating",
        "userRatingCount",
        "googleMapsURI",
        "nationalPhoneNumber",
      ],
      maxResultCount: 20,
      language: "en",
    });
    if (d && !view && gSel !== i) return;
    if (!d && !view && gSel !== null) return;
    const arr = (gLay[k] = gLay[k] || []);
    let n = 0;
    places.forEach((p) => {
      const ll = p.location;
      const m = new google.maps.Marker({
        position: ll,
        map: gmap,
        title: p.displayName,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6.5,
          fillColor: L[3],
          fillOpacity: 0.95,
          strokeColor: "#000000",
          strokeWeight: 1.5,
        },
        zIndex: 4,
      });
      m.addListener("click", () => {
        gInfo.setContent(
          `<div style="color:#111;font:13px system-ui;min-width:200px;line-height:1.5"><b>${p.displayName}</b><br>${p.formattedAddress || ""}<br>${p.rating ? '<i class="bx bxs-star"></i> ' + p.rating + " (" + (p.userRatingCount || 0) + ")<br>" : ""}${p.nationalPhoneNumber ? p.nationalPhoneNumber + "<br>" : ""}<a target="_blank" rel="noopener" href="${p.googleMapsURI}">Open in Google Maps</a></div>`,
        );
        gInfo.open(gmap, m);
      });
      arr.push(m);
      n++;
    });
    cnt(k, n ? " \u00b7 " + n : " \u00b7 0");
  } catch (e) {
    gErr("Could not load " + L[1] + ": " + (e.message || e));
  }
}
/* ---- search: counties, towns, cities, airports, registration sites ---- */
const GT_ICON = {
  State: '<i class="bx bx-map-alt"></i>',
  County: '<i class="bx bx-buildings"></i>',
  City: '<i class="bx bx-building"></i>',
  Town: '<i class="bx bx-building-house"></i>',
  Airport: '<i class="bx bxs-plane-alt"></i>',
  "Registration site": '<i class="bx bx-map-pin"></i>',
};
function gIndex() {
  const L = [];
  DATA.forEach((d, i) =>
    L.push({
      t: "State",
      n: d.n,
      sub: d.admin ? "Administrative area" : "State",
      si: i,
    }),
  );
  COUNTIES.forEach((c) =>
    L.push({
      t: "County",
      n: c.n,
      sub: DATA[c.si].n,
      si: c.si,
      c,
    }),
  );
  const ck = new Set(COUNTIES.map((c) => c.si + "|" + K(c.n)));
  PL.forEach((p) => {
    const si = stAt(p[1], p[2]);
    if (ck.has(si + "|" + K(p[0]))) return;
    L.push({
      t: p[3] === "c" ? "City" : p[3] === "a" ? "Airport" : "Town",
      n: p[0],
      sub: si >= 0 ? DATA[si].n : "South Sudan",
      si,
      p,
    });
  });
  SITES.forEach((s) => {
    const si = stAt(s.lon, s.lat);
    L.push({
      t: "Registration site",
      n: s.name,
      sub: si >= 0 ? DATA[si].n : "",
      si,
      s,
    });
  });
  return L;
}
function gSearch(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const sc = (x) => {
    const n = x.n.toLowerCase();
    return n === q
      ? 0
      : n.startsWith(q)
        ? 1
        : n.split(/[\s\/-]+/).some((w) => w.startsWith(q))
          ? 2
          : n.includes(q)
            ? 3
            : 99;
  };
  return gIndex()
    .map((x) => [sc(x), x])
    .filter((a) => a[0] < 99)
    .sort((a, b) => a[0] - b[0] || a[1].n.localeCompare(b[1].n))
    .slice(0, 14)
    .map((a) => a[1]);
}
let gRes = [];
function gShowRes() {
  const q = $("#gq").value,
    box = $("#gres");
  gRes = gSearch(q);
  if (!q.trim()) {
    box.hidden = true;
    return;
  }
  box.innerHTML = gRes.length
    ? gRes
        .map(
          (x, i) =>
            `<button data-i="${i}"><span>${GT_ICON[x.t]}</span><b>${esc(x.n)}</b><small>${x.t}${x.sub ? " \u00b7 " + esc(x.sub) : ""}</small></button>`,
        )
        .join("")
    : '<div class="gnone">No match in counties, towns, cities, airports or registration sites.</div>';
  box.hidden = false;
}
$("#gq").oninput = gShowRes;
$("#gq").onfocus = gShowRes;
$("#gq").onkeydown = (e) => {
  if (e.key === "Enter" && gRes[0]) gGoto(gRes[0]);
  if (e.key === "Escape") $("#gres").hidden = true;
};
$("#gres").onclick = (e) => {
  const b = e.target.closest("button");
  if (b) gGoto(gRes[+b.dataset.i]);
};
document.addEventListener("click", (e) => {
  if (!e.target.closest(".gsearch")) $("#gres").hidden = true;
});
function gGoto(x) {
  $("#gres").hidden = true;
  $("#gq").value = x.n;
  if (x.si != null && x.si >= 0 && view !== x.si) {
    pick(x.si);
    zoomState(x.si);
  }
  if (x.t === "County") {
    selC = x.n;
    cview();
    drawCounties();
  }
  let g,
    z = 12;
  if (x.t === "State") {
    if (gOk) {
      const b = new google.maps.LatLngBounds();
      DATA[x.si].poly.forEach((q) => b.extend(gLL(toGeo(q[0], q[1]))));
      gmap.fitBounds(b, 40);
    } else gIframeState(x.si);
    return;
  }
  if (x.t === "County") g = cGeo(x.c);
  else if (x.s) g = sGeo(x.s);
  else g = toGeo(x.p[1], x.p[2]);
  if (gOk) {
    gmap.setCenter(gLL(g));
    gmap.setZoom(z);
    if (gPin) gPin.setMap(null);
    gPin = new google.maps.Marker({
      position: gLL(g),
      map: gmap,
      animation: google.maps.Animation.DROP,
      zIndex: 99,
      icon: {
        path: PINP,
        fillColor: "#ff3b6b",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
        scale: 1.9,
        anchor: new google.maps.Point(12, 22),
      },
      title: x.n,
    });
    gInfo.setContent(
      x.t === "Registration site"
        ? gSiteTip(x.s)
        : x.t === "County"
          ? gCtyTip(
              DATA[x.si].cty.find((c) => c.n === x.n) || {
                n: x.n,
              },
              DATA[x.si],
              {
                lat: () => g[1],
                lng: () => g[0],
              },
            )
          : `<div style="color:#111;font:13px system-ui"><b>${esc(x.n)}</b><br>${x.t} \u00b7 ${esc(x.sub || "")}<br>${g[1]}, ${g[0]}</div>`,
    );
    gInfo.open(gmap, gPin);
  } else {
    if (x.t === "Registration site") gIframe(g[1] + "," + g[0] + "(" + x.n + ")", 13);
    else
      gIframe(
        x.n + ", " + (x.sub && x.sub !== "South Sudan" ? x.sub + ", " : "") + "South Sudan",
        x.t === "County" ? 10 : 12,
      );
  }
}
/* ---- no-key mode: list of registration sites with one-click pins ---- */
function gSiteList() {
  const b = $("#gsl");
  if (!b) return;
  const L = SITES.filter((x) => gSel == null || inPoly(x.lon, x.lat, DATA[gSel].poly));
  if (gOk || !L.length) {
    b.hidden = true;
    return;
  }
  const open = b.classList.contains("open");
  b.innerHTML =
    `<button class="gsh" data-t="1"><i class="bx bx-map-pin"></i> ${L.length} registration site${L.length > 1 ? "s" : ""} <i class="bx bx-chevron-down"></i></button>` +
    (open
      ? L.slice(0, 12)
          .map(
            (x) =>
              `<button data-i="${SITES.indexOf(x)}"><i style="background:${SCOL[x.status] || "#ffb020"}"></i>${esc(x.name)}<small>${esc(x.status)}</small></button>`,
          )
          .join("")
      : "");
  b.hidden = false;
}
$("#gsl").onclick = (e) => {
  const h = e.target.closest("[data-t]");
  if (h) {
    $("#gsl").classList.toggle("open");
    gSiteList();
    return;
  }
  const b = e.target.closest("button[data-i]");
  if (b) {
    const s = SITES[+b.dataset.i],
      g = sGeo(s);
    gIframe(g[1] + "," + g[0] + "(" + s.name + ")", 13);
  }
};
/* ---- pin a registration site by clicking the Google map ---- */
function gAddAt(ll) {
  const g = [ll.lng(), ll.lat()],
    t = fromGeo(g[0], g[1]);
  if (stAt(t[0], t[1]) < 0) {
    toast("That point is outside South Sudan");
    return;
  }
  const s = {
    id: uid("s"),
    name: "New registration site",
    lon: R3(t[0]),
    lat: R3(t[1]),
    g: [+g[0].toFixed(5), +g[1].toFixed(5)],
    status: "Planned",
    cap: 0,
    note: "",
  };
  SITES.push(s);
  gSetAdd(false);
  refresh();
  amodal("site", s);
}
function gSetAdd(on) {
  gAdd = on;
  $("#gadd").classList.toggle("on", on);
  if (gOk)
    gmap.setOptions({
      draggableCursor: on ? "crosshair" : null,
    });
  gErr(on ? "Click the map where the registration site is located." : "");
}
$("#gadd").onclick = () =>
  needAuth(() => {
    if (!gOk) {
      toast(
        "Add a Google Maps API key to pin by clicking. Opening the site form so you can type its coordinates.",
      );
      amodal("site", null);
      return;
    }
    gSetAdd(!gAdd);
  });
$("#gkt").onclick = () => {
  $("#gkey").hidden = !$("#gkey").hidden;
};
$("#glb").onclick = (e) => {
  e.stopPropagation();
  $("#glay").hidden = !$("#glay").hidden;
};
document.addEventListener("click", (e) => {
  if (!e.target.closest(".glwrap")) $("#glay").hidden = true;
  if (
    !e.target.closest("#gkey") &&
    e.target.id !== "gkt" &&
    !$("#gkey").hidden &&
    e.target.closest("#gm")
  )
    $("#gkey").hidden = true;
});
function buildLay() {
  $("#glay").innerHTML =
    GL.map(
      (l) =>
        `<button data-k="${l[0]}" style="--cl:${l[3]}" class="${gOn[l[0]] ? "on" : ""}"><i></i>${l[1]}<span></span></button>`,
    ).join("") + '<button id="gview">Search this view</button>';
  $("#glay").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.id === "gview") {
      if (!gOk) return;
      const v = gmap.getBounds();
      Object.keys(gOn)
        .filter((k) => gOn[k] && !isLoc(k))
        .forEach((k) => gFetch(k, null, null, v));
      return;
    }
    const k = b.dataset.k;
    gOn[k] = !gOn[k];
    b.classList.toggle("on", gOn[k]);
    if (!gOk) return;
    if (isLoc(k)) gDrawLocal(gSel);
    else if (gOn[k]) gFetch(k, gSel == null ? null : DATA[gSel], gSel);
    else {
      (gLay[k] || []).forEach((m) => m.setMap(null));
      gLay[k] = [];
      cnt(k, "");
    }
  };
}
function startG(key) {
  gErr("Loading Google Maps\u2026");
  gLoad(key)
    .then(() => {
      gInit();
      if (view !== null) gSync(view);
      else {
        gDrawLocal(null);
        Object.keys(gOn).forEach((k) => gOn[k] && !isLoc(k) && gFetch(k, null, null));
      }
    })
    .catch(() => gErr("Could not reach Google Maps. Check your internet connection."));
}
buildLay();
document.querySelectorAll(".mtabs button").forEach(
  (b) =>
    (b.onclick = () => {
      const g = b.dataset.m === "g";
      document.querySelectorAll(".mtabs button").forEach((x) => x.classList.toggle("on", x === b));
      $("#gm").hidden = !g;
      if (g && !gOk) {
        if (gKey) {
          $("#gki").value = gKey;
          $("#gkey").hidden = true;
          startG(gKey);
        } else {
          gIframeState(view);
          gSiteList();
        }
      }
    }),
);
$("#gkb").onclick = () => {
  const k = $("#gki").value.trim();
  if (!k) {
    gErr("Paste a Google Maps API key first.");
    return;
  }
  gKey = k;
  try {
    localStorage.setItem("gmkey", k);
  } catch (e) {}
  startG(k);
};

// live simulation (remove when connected to real data)

setInterval(() => ($("#clock").textContent = new Date().toTimeString().slice(0, 8)), 1000);
$("#clock").textContent = new Date().toTimeString().slice(0, 8);
/* ===================== ADDON A: store, layers, editing tools ===================== */
const PIN =
  "M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z";
const uid = (p) => p + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
const R3 = (v) => Math.round(v * 1000) / 1000;
const lonOf = (x) => (x - 15) / 47 + 24,
  latOf = (y) => 12.4 - (y - 10) / 50;
const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"]/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      })[c],
  );
const PHD = {
  0: ["?", "?", "?"],
  1: ["Low Risk", "Safer", "Easily Accessible"],
  2: ["Risk", "Safe", "Accessible"],
  3: ["High Risk", "Unsafe", "Inaccessible"],
};
const PHN = ["Not classified", "Phase 1 · Low risk", "Phase 2 · Risk", "Phase 3 · High risk"];
const TYN = {
  c: "City",
  t: "Town",
  a: "Airport only",
};
let dirty = false,
  saveT = 0,
  selRoad = null,
  DRAW = null,
  PEND = null,
  dn = null;
const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
const stAt = (lon, lat) => DATA.findIndex((d) => inPoly(lon, lat, d.poly));
function toast(m) {
  const t = $("#toast");
  t.textContent = m;
  t.classList.add("on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("on"), 3200);
}
function repPoint(si) {
  const P = DATA[si].poly,
    xs = P.map((p) => p[0]),
    ys = P.map((p) => p[1]),
    a = Math.min(...xs),
    b = Math.max(...xs),
    c = Math.min(...ys),
    e = Math.max(...ys),
    cx = (a + b) / 2,
    cy = (c + e) / 2;
  let best = null,
    bd = 1e9;
  for (let i = 0; i <= 30; i++)
    for (let j = 0; j <= 30; j++) {
      const x = a + ((b - a) * i) / 30,
        y = c + ((e - c) * j) / 30;
      if (inPoly(x, y, P)) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < bd) {
          bd = d;
          best = [R3(x), R3(y)];
        }
      }
    }
  return best || [R3(cx), R3(cy)];
}
function cntyNear(lon, lat, si) {
  const L = COUNTIES.filter((c) => c.si === si && c.hq);
  if (!L.length) return null;
  const h = L.find((c) => c.poly.length > 2 && inPoly(lon, lat, c.poly));
  if (h) return h;
  return L.reduce((a, c) =>
    Math.hypot(c.hq[0] - lon, c.hq[1] - lat) < Math.hypot(a.hq[0] - lon, a.hq[1] - lat) ? c : a,
  );
}
const lenKm = (pts) => {
  let k = 0;
  for (let i = 1; i < pts.length; i++) k += kmx(pts[i - 1], pts[i]);
  return k;
};
function runsIn(pts, poly) {
  const runs = [];
  let cur = null;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i];
    if (inPoly((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, poly)) {
      if (!cur) {
        cur = [a];
        runs.push(cur);
      }
      cur.push(b);
    } else cur = null;
  }
  return runs;
}
const ptsStr = (a) => a.map((p) => X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join(" ");

/* ---- county cells (Voronoi of county HQs, clipped to the state outline) ---- */
function clipHP(poly, a, b, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length],
      fp = a * p[0] + b * p[1] - c,
      fq = a * q[0] + b * q[1] - c;
    if (fp <= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}
function thin(poly) {
  const o = [];
  poly.forEach((p) => {
    const q = [R3(p[0]), R3(p[1])],
      l = o[o.length - 1];
    if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) >= 0.004) o.push(q);
  });
  return o.length > 2 ? o : [];
}
function rebuildCells(si) {
  const L = COUNTIES.filter((c) => c.si === si && !c.geo && c.hq);
  if (!L.length) return;
  L.forEach((c, i) => {
    L.forEach((o, j) => {
      if (j > i && same(o.hq, c.hq)) o.hq = [R3(o.hq[0] + 0.03 * (j - i)), o.hq[1]];
    });
  });
  const P = DATA[si].poly;
  L.forEach((c) => {
    let poly = P.map((p) => p.slice());
    const [sx, sy] = c.hq;
    L.forEach((o) => {
      if (o === c || poly.length < 3) return;
      const [ox, oy] = o.hq;
      poly = clipHP(poly, 2 * (ox - sx), 2 * (oy - sy), ox * ox + oy * oy - sx * sx - sy * sy);
    });
    c.poly = thin(poly);
  });
}
function snapInit() {
  const used = new Set();
  COUNTIES.forEach((c) => {
    if (c.geo) return;
    c.g = c.hq.slice();
    const k = K(c.n);
    if (!used.has(k)) {
      const p = PL.find((q) => K(q[0]) === k && stAt(q[1], q[2]) === c.si);
      if (p) {
        c.hq = [p[1], p[2]];
        c.g = toGeo(p[1], p[2]);
        used.add(k);
        return;
      }
    }
    const h = fromGeo(c.g[0], c.g[1]);
    if (inPoly(h[0], h[1], DATA[c.si].poly)) c.hq = h;
  });
  DATA.forEach((d, i) => rebuildCells(i));
}

/* ---- places (cities, towns, airports) ---- */
function buildPlaces() {
  ["#gc", "#gt", "#ga"].forEach((s) => ($(s).innerHTML = ""));
  PL.forEach(([n, lon, lat, ty, ap], i) => {
    const x = X(lon),
      y = Y(lat),
      c = ty == "c",
      g = $(c ? "#gc" : "#gt");
    if (ty != "a")
      g.append(
        mk("circle", {
          cx: x,
          cy: y,
          r: c ? 3.2 : 1.8,
          fill: c ? "#fff" : "#e6dfcc",
          stroke: "#000000",
          "stroke-width": 0.8,
          class: "pt",
        }),
      );
    const t = mk(
      "text",
      {
        x: x + (c ? 5 : 3.5),
        y: y + 3,
        class: c ? "cw" : "tw",
      },
      n,
    );
    t._i = i;
    g.append(t);
    if (ap) {
      const q = mk("path", {
        d: PLANE,
        class: "apl",
      });
      q.dataset.x = x;
      q.dataset.y = y;
      $("#ga").append(q);
    }
  });
  GC = [...document.querySelectorAll("#gc text")];
  GT = [...document.querySelectorAll("#gt text")];
  GA = [...document.querySelectorAll("#ga .apl")];
}
function siteTip(e, s) {
  const t = $("#tip"),
    si = stAt(s.lon, s.lat),
    c = si >= 0 ? cntyNear(s.lon, s.lat, si) : null;
  t.style.display = "block";
  t.style.left = Math.min(e.clientX + 16, innerWidth - 250) + "px";
  t.style.top = Math.min(e.clientY + 16, innerHeight - 190) + "px";
  t.innerHTML = `<h4>${esc(s.name)}</h4><div>Type <span>Registration site</span></div><div>Status <span>${esc(s.status)}</span></div><div>State <span>${si >= 0 ? esc(DATA[si].n) : "—"}</span></div><div>County <span>${c ? esc(c.n) : "—"}</span></div>${s._excelKey ? `<div>Govt Employees <span>${s.cap ? fmt(s.cap) : "—"}</span></div><div>Capacity / Day <span>—</span></div>` : `<div>Capacity / Day <span>${s.cap ? fmt(s.cap) : "—"}</span></div>`}${!s._excelKey && s.note ? `<div>Note <span>${esc(s.note)}</span></div>` : ""}`;
}
function drawSites() {
  const g = $("#gs");
  g.innerHTML = "";
  GS = [];
  GSP = [];
  SITES.forEach((s) => {
    const x = X(s.lon),
      y = Y(s.lat),
      p = mk("path", {
        d: PIN,
        class: "spin s-" + String(s.status || "Planned").toLowerCase(),
      });
    p.dataset.x = x;
    p.dataset.y = y;
    p.onmousemove = (e) => siteTip(e, s);
    p.onmouseleave = () => ($("#tip").style.display = "none");
    const t = mk(
      "text",
      {
        x,
        y,
        class: "stl",
      },
      s.name,
    );
    t._s = s;
    g.append(p, t);
    GSP.push(p);
    GS.push(t);
  });
}

/* ---- roads ---- */
function drawRoads() {
  HRV++;
  document.querySelectorAll("#grd").forEach((g) => {
    g.innerHTML = "";
    ROADS.forEach((r, i) => {
      const e = mk("polyline", {
        class: "rd t-" + r.type + (r.src == "UN" ? " un" : ""),
        points: ptsStr(r.pts),
      });
      e.dataset.i = i;
      g.append(e);
    });
  });
}
function focusPoly() {
  if (view === null) return null;
  if (selC) {
    const c = COUNTIES.find((x) => x.n === selC && x.si === view);
    if (c && c.poly.length > 2)
      return {
        poly: c.poly,
        hq: c.hq,
      };
  }
  return {
    poly: DATA[view].poly,
  };
}
function hiRoads() {
  const g = $("#grh");
  if (!g) return;
  const hk = view + "|" + selC + "|" + HRV + "|" + COUNTIES.length;
  if (g._hk === hk) {
    lk = "";
    return;
  }
  g._hk = hk;
  g.innerHTML = "";
  RDL = [];
  const f = focusPoly();
  svg.classList.toggle("hr", !!f);
  if (!f) return;
  ROADS.forEach((r) => {
    let runs = runsIn(r.pts, f.poly);
    if (
      f.hq &&
      !runs.length &&
      r.pts.some((p) => Math.hypot(p[0] - f.hq[0], p[1] - f.hq[1]) < 0.12)
    )
      runs = [r.pts];
    let best = null;
    runs.forEach((run) => {
      const pts = ptsStr(run);
      g.append(
        mk("polyline", {
          class: "rdh-c",
          points: pts,
        }),
        mk("polyline", {
          class: "rdh t-" + r.type,
          points: pts,
        }),
      );
      if (!best || run.length > best.length) best = run;
    });
    if (best && r.src != "UN" && r.name) {
      const m = best[Math.floor(best.length / 2)],
        t = mk(
          "text",
          {
            x: X(m[0]),
            y: Y(m[1]),
            class: "rdl",
          },
          r.name,
        );
      t._r = r;
      t._x = X(m[0]);
      t._y = Y(m[1]);
      g.append(t);
      RDL.push(t);
    }
  });
  lk = "";
}
function hiStory() {
  const o = $("#shg");
  if (o) o.remove();
  if (typeof step === "undefined" || step < 1) return;
  const d = DATA[step - 1],
    g = mk("g", {
      id: "shg",
    });
  ROADS.forEach((r) =>
    runsIn(r.pts, d.poly).forEach((run) => {
      const p = ptsStr(run);
      g.append(
        mk("polyline", {
          class: "rdh-c",
          points: p,
        }),
        mk("polyline", {
          class: "rdh t-" + r.type,
          points: p,
        }),
      );
    }),
  );
  const f = sv.querySelector(".spl");
  f ? sv.insertBefore(g, f) : sv.append(g);
}

/* ---- map <-> screen ---- */
function evMap(e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const m = svg.getScreenCTM();
  if (!m) return null;
  const q = pt.matrixTransform(m.inverse());
  return [lonOf(q.x), latOf(q.y), q.x, q.y];
}
function snapPt(m, e) {
  const th = (11 * V[2]) / Math.max(300, svg.getBoundingClientRect().width || 600);
  let best = null,
    bd = th;
  const C = [];
  PL.forEach((p) => C.push([p[0], p[1], p[2]]));
  COUNTIES.forEach((c) => c.hq && C.push([c.n, c.hq[0], c.hq[1]]));
  SITES.forEach((s) => C.push([s.name, s.lon, s.lat]));
  C.forEach((c) => {
    const d = Math.hypot(X(c[1]) - m[2], Y(c[2]) - m[3]);
    if (d < bd) {
      bd = d;
      best = c;
    }
  });
  if (best)
    return {
      lon: best[1],
      lat: best[2],
      ref: best[0],
    };
  let lon = m[0],
    lat = m[1];
  const L = DRAW && DRAW.pts[DRAW.pts.length - 1];
  if (L && e && e.shiftKey) {
    const b = bearing(L, [lon, lat]),
      dk = kmx(L, [lon, lat]),
      bb = (Math.round(b / 15) * 15 * Math.PI) / 180,
      mid = (L[1] * Math.PI) / 180;
    lon = L[0] + (dk * Math.sin(bb)) / (111.32 * Math.cos(mid));
    lat = L[1] + (dk * Math.cos(bb)) / 110.57;
  }
  return {
    lon: R3(lon),
    lat: R3(lat),
    ref: null,
  };
}
const bearing = (a, b) => {
  const m = (((a[1] + b[1]) / 2) * Math.PI) / 180,
    dx = (b[0] - a[0]) * 111.32 * Math.cos(m),
    dy = (b[1] - a[1]) * 110.57;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
};
const compassTxt = (b) =>
  [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ][Math.round(b / 22.5) % 16];

/* ---- modes ---- */
const MODE_TXT = {
  edit: "<b>Edit mode</b> — drag a point to move it · click it to rename, edit or delete · click a road to edit its line",
  road: "<b>Compass road tool</b> — click a start (snaps to cities, towns, counties, sites), add waypoints, then Finish · Shift = 15° angle · Backspace = undo · Esc = cancel",
};
const ADD_TXT = {
  c: "city",
  t: "town",
  a: "airport",
  s: "registration site",
  cty: "county",
};
function setMode(m) {
  if (m && !isAuthed()) {
    needAuth(function () {
      setMode(m);
    });
    return;
  }
  TOOL = m;
  selRoad = null;
  DRAW =
    m === "road"
      ? {
          pts: [],
          from: null,
          to: null,
          cur: null,
        }
      : null;
  svg.classList.toggle("edit", m === "edit");
  svg.classList.toggle("drawing", m === "road" || (m || "").startsWith("add:"));
  document
    .querySelectorAll("#tEd,#tRd,#tAd")
    .forEach((b) =>
      b.classList.toggle(
        "on",
        (b.id == "tEd" && m === "edit") ||
          (b.id == "tRd" && m === "road") ||
          (b.id == "tAd" && (m || "").startsWith("add:")),
      ),
    );
  const b = $("#tbn");
  if (!m) {
    b.hidden = true;
    b.innerHTML = "";
  } else {
    b.hidden = false;
    const txt = m.startsWith("add:")
      ? `<b>Add ${ADD_TXT[m.slice(4)]}</b> — click on the map to place it`
      : MODE_TXT[m];
    b.innerHTML = `<span>${txt}</span>${m === "road" ? '<button class="btn" data-a="undo">Undo point</button><button class="btn pri" data-a="fin">Finish road</button>' : ""}<button class="btn" data-a="x">${m === "edit" ? "Done" : "Cancel"}</button>`;
  }
  closePop();
  drawHandles();
  compassSet(null);
}
$("#tbn").onclick = (e) => {
  const a = e.target.dataset && e.target.dataset.a;
  if (a === "x") setMode(null);
  if (a === "undo") undoPt();
  if (a === "fin") finishRoad();
};

/* ---- handles (edit mode) and road drawing overlay ---- */
function mkH(kind, ref, lon, lat, title) {
  const c = mk("circle", {
    cx: X(lon),
    cy: Y(lat),
    r: 5,
    class: "hnd " + kind,
  });
  c.append(mk("title", {}, title));
  c._k = kind;
  c._r = ref;
  c.addEventListener("pointerdown", (ev) => startDrag(ev, c));
  c.addEventListener("mousedown", (ev) => ev.stopPropagation());
  $("#ged").append(c);
  HND.push(c);
  return c;
}
function drawHandles() {
  const g = $("#ged");
  g.innerHTML = "";
  HND = [];
  if (TOOL === "edit") {
    ROADS.forEach((r) => {
      const l = mk("polyline", {
        class: "rdhit" + (r === selRoad ? " on" : ""),
        points: ptsStr(r.pts),
      });
      l.onclick = (ev) => {
        ev.stopPropagation();
        selRoad = r;
        drawHandles();
        openPop("road", r, ev);
      };
      g.append(l);
    });
    COUNTIES.forEach((c) => {
      if (!c.hq) return;
      const ring =
          PL.some((p) => same([p[1], p[2]], c.hq)) || SITES.some((x) => same([x.lon, x.lat], c.hq)),
        h = mkH("cty", c, c.hq[0], c.hq[1], c.n + " — county HQ · click to edit or delete");
      if (ring) {
        h._ring = 1;
        h.classList.add("ring");
        h.setAttribute("r", 9);
      }
    });
    PL.forEach((p, i) => mkH("pl", i, p[1], p[2], p[0]));
    SITES.forEach((s) => mkH("site", s, s.lon, s.lat, s.name));
    if (selRoad && ROADS.includes(selRoad)) {
      const r = selRoad;
      r.pts.forEach((p, i) => {
        mkH(
          "rv",
          {
            r,
            i,
          },
          p[0],
          p[1],
          "Vertex " + (i + 1) + " — drag to move · Shift+click to delete",
        );
        if (i < r.pts.length - 1) {
          const q = r.pts[i + 1];
          mkH(
            "rm",
            {
              r,
              i,
            },
            (p[0] + q[0]) / 2,
            (p[1] + q[1]) / 2,
            "Drag to add a bend",
          );
        }
      });
    }
  }
  drawDrawing();
  lk = "";
}
function drawDrawing() {
  const g = $("#ged");
  if (!DRAW) return;
  g.querySelectorAll(".rdprev,.dpt,.snapr").forEach((e) => e.remove());
  const pts = DRAW.pts.slice();
  if (DRAW.cur) pts.push([DRAW.cur.lon, DRAW.cur.lat]);
  if (pts.length > 1)
    g.append(
      mk("polyline", {
        class: "rdprev",
        points: ptsStr(pts),
      }),
    );
  DRAW.pts.forEach((p) =>
    g.append(
      mk("circle", {
        cx: X(p[0]),
        cy: Y(p[1]),
        r: 2.4,
        class: "dpt",
      }),
    ),
  );
  if (DRAW.cur && DRAW.cur.ref)
    g.append(
      mk("circle", {
        cx: X(DRAW.cur.lon),
        cy: Y(DRAW.cur.lat),
        r: 6,
        class: "snapr",
      }),
    );
}
function startDrag(ev, c) {
  ev.preventDefault();
  ev.stopPropagation();
  try {
    c.setPointerCapture(ev.pointerId);
  } catch (x) {}
  const s0 = [ev.clientX, ev.clientY];
  let moved = false;
  const mv = (e) => {
    if (!moved && Math.hypot(e.clientX - s0[0], e.clientY - s0[1]) < 4) return;
    moved = true;
    const m = evMap(e);
    if (!m) return;
    c.setAttribute("cx", m[2]);
    c.setAttribute("cy", m[3]);
    c._pos = [R3(m[0]), R3(m[1])];
  };
  const up = (e) => {
    c.removeEventListener("pointermove", mv);
    c.removeEventListener("pointerup", up);
    if (moved && c._pos) commitMove(c, c._pos);
    else clickHandle(c, e);
  };
  c.addEventListener("pointermove", mv);
  c.addEventListener("pointerup", up);
}
function clickHandle(c, e) {
  if (c._k === "rv" && e.shiftKey) {
    const { r, i } = c._r;
    if (r.pts.length > 2) {
      r.pts.splice(i, 1);
      refresh();
      drawHandles();
    } else toast("A road needs at least 2 points");
    return;
  }
  if (c._k === "rm") return;
  openPop(c._k, c._r, e);
}
function commitMove(c, pos) {
  const k = c._k,
    ref = c._r,
    [lon, lat] = pos;
  if (k === "rv") {
    ref.r.pts[ref.i] = [lon, lat];
    refresh();
    drawHandles();
    return;
  }
  if (k === "rm") {
    ref.r.pts.splice(ref.i + 1, 0, [lon, lat]);
    refresh();
    drawHandles();
    return;
  }
  if (k === "site") {
    ref.lon = lon;
    ref.lat = lat;
    refresh();
    return;
  }
  if (k === "cty") {
    if (stAt(lon, lat) !== ref.si) {
      toast("A county HQ must stay inside " + DATA[ref.si].n);
      drawHandles();
      return;
    }
    ref.hq = [lon, lat];
    rebuildCells(ref.si);
    dirty = true;
    refresh();
    return;
  }
  if (k === "pl") {
    const p = PL[ref],
      old = [p[1], p[2]],
      lk2 = COUNTIES.filter((x) => x.hq && same(x.hq, old));
    if (stAt(lon, lat) < 0) {
      toast("Place the point inside South Sudan");
      drawHandles();
      return;
    }
    if (lk2.some((x) => stAt(lon, lat) !== x.si)) {
      toast("This place is a county HQ — keep it inside " + DATA[lk2[0].si].n);
      drawHandles();
      return;
    }
    p[1] = lon;
    p[2] = lat;
    lk2.forEach((x) => (x.hq = [lon, lat]));
    new Set(lk2.map((x) => x.si)).forEach(rebuildCells);
    refresh();
  }
}

/* ---- compass widget ---- */
function compassSet(b, txt) {
  const n = $("#cmn");
  if (!n) return;
  n.style.transform = `rotate(${b == null ? 0 : b}deg)`;
  n.classList.toggle("act", b != null);
  $("#cmb").textContent = txt || "N";
}

/* ---- map clicks, cursor, keys ---- */
svg.addEventListener(
  "pointerdown",
  (e) => {
    dn = [e.clientX, e.clientY];
  },
  true,
);
svg.addEventListener(
  "click",
  (e) => {
    if (!TOOL || TOOL === "edit") return;
    e.stopPropagation();
    e.preventDefault();
    if (dn && Math.hypot(e.clientX - dn[0], e.clientY - dn[1]) > 5) return;
    const m = evMap(e);
    if (!m) return;
    if (TOOL === "road") addRoadPt(snapPt(m, e));
    else if (TOOL.startsWith("add:")) addAt(TOOL.slice(4), m, e);
  },
  true,
);
svg.addEventListener("pointermove", (e) => {
  if (TOOL !== "road" || !DRAW) return;
  const m = evMap(e);
  if (!m) return;
  const p = snapPt(m, e);
  DRAW.cur = p;
  drawDrawing();
  const L = DRAW.pts[DRAW.pts.length - 1];
  if (L) {
    const b = bearing(L, [p.lon, p.lat]),
      d = kmx(L, [p.lon, p.lat]),
      tot = lenKm(DRAW.pts) + d;
    compassSet(
      b,
      compassTxt(b) +
        " " +
        Math.round(b) +
        "° · " +
        d.toFixed(1) +
        " km · total " +
        tot.toFixed(1) +
        " km",
    );
  } else compassSet(0, "Click a start point");
});
const _dbl = svg.ondblclick;
svg.ondblclick = (e) => {
  if (TOOL && TOOL !== "edit") {
    e.preventDefault();
    return;
  }
  _dbl && _dbl.call(svg, e);
};
document.addEventListener("keydown", (e) => {
  if (/INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || "")) return;
  if (e.key === "Escape") {
    if (!$("#rep").hidden) return;
    closePop();
    if (TOOL) setMode(null);
  }
  if (TOOL === "road") {
    if (e.key === "Enter") finishRoad();
    if (e.key === "Backspace") {
      e.preventDefault();
      undoPt();
    }
  }
});
function addRoadPt(p) {
  if (!DRAW) return;
  const L = DRAW.pts[DRAW.pts.length - 1];
  if (L && same(L, [p.lon, p.lat])) return;
  if (!DRAW.pts.length) DRAW.from = p.ref;
  else DRAW.to = p.ref;
  DRAW.pts.push([p.lon, p.lat]);
  if (DRAW.pts.length === 2 && !DRAW.hinted) {
    DRAW.hinted = 1;
    toast("Keep clicking to add bends, then press Enter or Finish road");
  }
  drawDrawing();
}
function undoPt() {
  if (DRAW && DRAW.pts.length) {
    DRAW.pts.pop();
    drawDrawing();
  }
}
function finishRoad() {
  if (!DRAW || DRAW.pts.length < 2) {
    toast("Add at least two points first");
    return;
  }
  const n = ROADS.filter((r) => r.src != "UN").length + 1;
  const r = {
    id: uid("r"),
    name: DRAW.from && DRAW.to && DRAW.from !== DRAW.to ? DRAW.from + " – " + DRAW.to : "Road " + n,
    type: "main",
    src: "user",
    from: DRAW.from || "",
    to: DRAW.to || "",
    pts: DRAW.pts.slice(),
  };
  ROADS.push(r);
  const c = DRAW.cur;
  setMode(null);
  refresh();
  openPop(
    "road",
    r,
    {
      clientX: innerWidth / 2 - 150,
      clientY: innerHeight / 3,
    },
    true,
  );
}
function addAt(t, m, e) {
  const lon = R3(m[0]),
    lat = R3(m[1]),
    si = stAt(lon, lat);
  if (si < 0) {
    toast("Click inside South Sudan");
    return;
  }
  const nm = (PEND && PEND.name) || "New " + ADD_TXT[t];
  PEND = null;
  let ref, kind;
  if (t === "s") {
    ref = {
      id: uid("s"),
      name: nm,
      lon,
      lat,
      status: "Planned",
      cap: 0,
      note: "",
    };
    SITES.push(ref);
    kind = "site";
  } else if (t === "cty") {
    const nn = uniqCounty(nm);
    DATA[si].cty.push({
      n: nn,
      e: 0,
      ph: 0,
      st: "?",
      sf: "?",
      ac: "?",
      rm: "",
      rc: "",
      md: "",
    });
    ref = {
      n: nn,
      si,
      hq: [lon, lat],
      poly: [],
    };
    COUNTIES.push(ref);
    rebuildCells(si);
    dirty = true;
    kind = "cty";
  } else {
    PL.push([nm, lon, lat, t, t === "a" ? 1 : 0]);
    ref = PL.length - 1;
    kind = "pl";
  }
  setMode(null);
  refresh();
  openPop(kind, ref, e, true);
}
const uniqCounty = (n) => {
  let k = n,
    i = 2;
  while (COUNTIES.some((c) => c.n === k) || DATA.some((d) => d.cty.some((c) => c.n === k)))
    k = n + " (" + i++ + ")";
  return k;
};

/* ---- popover editor ---- */
const opt = (arr, v) =>
  arr
    .map(
      ([k, t]) => `<option value="${k}"${String(k) === String(v) ? " selected" : ""}>${t}</option>`,
    )
    .join("");
const fld = (id, l, v, t, ex) =>
  `<label>${l}<input id="pf-${id}" type="${t || "text"}" value="${esc(v)}" ${ex || ""}></label>`;
let POP = null;
function closePop() {
  const p = $("#pop");
  p.hidden = true;
  POP = null;
}
function openPop(kind, ref, ev, isNew) {
  const el = $("#pop");
  let h = "",
    title = "";
  if (kind === "pl") {
    const p = PL[ref];
    title = (isNew ? "New " : "") + TYN[p[3]];
    const si = stAt(p[1], p[2]),
      c = si >= 0 ? cntyNear(p[1], p[2], si) : null,
      lk2 = COUNTIES.filter((x) => x.hq && same(x.hq, [p[1], p[2]]));
    h =
      fld("n", "Name", p[0]) +
      `<label>Type<select id="pf-t">${opt(Object.entries(TYN), p[3])}</select></label><label class="ck"><input id="pf-ap" type="checkbox"${p[4] ? " checked" : ""}> Has an airport</label><div class="g2">${fld("lo", "Longitude", p[1], "number", 'step="0.001"')}${fld("la", "Latitude", p[2], "number", 'step="0.001"')}</div><p class="pm">${si >= 0 ? esc(DATA[si].n) : "—"}${c ? " · near " + esc(c.n) + " county" : ""}${lk2.length ? "<br>County HQ of: <b>" + lk2.map((x) => esc(x.n)).join(", ") + "</b> <a href='#' data-a='cedit' data-q='" + esc(lk2[0].n) + "'>edit / delete county here <i class='bx bx-right-arrow-alt'></i></a> · <a href='#' data-a='adm' data-q='" + esc(lk2[0].n) + "'>full record <i class='bx bx-right-arrow-alt'></i></a>" : ""}</p>`;
  }
  if (kind === "cty") {
    const c = ref,
      m = DATA[c.si].cty.find((x) => x.n === c.n) || {};
    title = (isNew ? "New " : "") + "County · " + DATA[c.si].n;
    h =
      fld("n", "County name", c.n) +
      `<div class="g2">${fld("e", "Govt employees", m.e || 0, "number", 'min="0"')}<label>Security phase<select id="pf-ph">${opt(
        [
          [0, "Not classified"],
          [1, "Phase 1"],
          [2, "Phase 2"],
          [3, "Phase 3"],
        ],
        m.ph || 0,
      )}</select></label></div><label>Transport<select id="pf-md">${opt(
        [
          ["", "—"],
          ["Air", "Air"],
          ["Road", "Road"],
          ["River", "River"],
        ],
        m.md || "",
      )}</select></label><div class="g2">${fld("lo", "HQ longitude", c.hq[0], "number", 'step="0.001"')}${fld("la", "HQ latitude", c.hq[1], "number", 'step="0.001"')}</div><p class="pm"><a href='#' data-a='adm' data-q='${esc(c.n)}'>Open full record in Admin <i class='bx bx-right-arrow-alt'></i></a></p>`;
  }
  if (kind === "site") {
    const s = ref,
      si = stAt(s.lon, s.lat),
      c = si >= 0 ? cntyNear(s.lon, s.lat, si) : null;
    title = (isNew ? "New " : "") + "Registration site";
    h =
      fld("n", "Site name", s.name) +
      fld("mda", "MDA (ministry)", s.mda || "") +
      `<div class="g2"><label>Status<select id="pf-st">${opt(
        [
          ["Planned", "Planned"],
          ["Active", "Active"],
          ["Closed", "Closed"],
        ],
        s.status,
      )}</select></label>${fld("cap", "Capacity / day", s.cap || 0, "number", 'min="0"')}</div>${fld("note", "Note", s.note || "")}<div class="g2">${fld("lo", "Longitude", s.lon, "number", 'step="0.001"')}${fld("la", "Latitude", s.lat, "number", 'step="0.001"')}</div><p class="pm">${si >= 0 ? esc(DATA[si].n) : "—"}${c ? " · " + esc(c.n) + " county" : ""}${COUNTIES.some((x) => x.hq && same(x.hq, [s.lon, s.lat])) ? "<br>County HQ here: <a href='#' data-a='cedit' data-q='" + esc(COUNTIES.find((x) => x.hq && same(x.hq, [s.lon, s.lat])).n) + "'>edit / delete county <i class='bx bx-right-arrow-alt'></i></a>" : ""}</p>`;
  }
  if (kind === "road") {
    const r = ref;
    title = (isNew ? "New " : "") + "Road";
    h =
      fld("n", "Road name", r.name) +
      `<div class="g2"><label>Type<select id="pf-t">${opt(
        [
          ["main", "Main road"],
          ["secondary", "Secondary road"],
          ["track", "Track / seasonal"],
        ],
        r.type,
      )}</select></label>${fld("len", "Length (km)", lenKm(r.pts).toFixed(1), "text", "disabled")}</div><div class="g2">${fld("fr", "From", r.from)}${fld("to", "To", r.to)}</div><p class="pm">${r.pts.length} points · ${r.src == "UN" ? "traced from UN map" : "drawn by you"}<br>In Edit mode drag the white handles to reshape the line.</p>`;
  }
  el.innerHTML = `<div class="box"><h4>${title}</h4>${h}<div class="pa"><button class="btn pri" data-a="save">Save</button><button class="btn dng" data-a="del">Delete</button><button class="btn" data-a="x">Close</button></div></div>`;
  el.hidden = false;
  POP = {
    kind,
    ref,
    isNew,
  };
  const f = el.querySelector("#pf-n");
  if (f) {
    f.focus();
    f.select();
  }
}
$("#pop").onclick = (e) => {
  const a = e.target.dataset && e.target.dataset.a;
  if (!a) return;
  e.preventDefault();
  if (a === "x") closePop();
  if (a === "save") popSave();
  if (a === "del") popDel();
  if (a === "adm") {
    const q = e.target.dataset.q;
    closePop();
    openAdminCounty(q);
  }
  if (a === "cedit") {
    const c = COUNTIES.find((x) => x.n === e.target.dataset.q);
    if (c && c.hq) openPop("cty", c, e);
  }
};
$("#pop").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.tagName === "INPUT") popSave();
  if (e.key === "Escape") closePop();
});
const pv = (id) => {
  const e = $("#pf-" + id);
  return e ? e.value.trim() : "";
};
function popSave() {
  if (!POP) return;
  const { kind, ref } = POP,
    nm = pv("n");
  if (!nm) {
    toast("Please enter a name");
    return;
  }
  if (kind === "pl") {
    const p = PL[ref],
      lon = +pv("lo"),
      lat = +pv("la"),
      old = [p[1], p[2]],
      lk2 = COUNTIES.filter((x) => x.hq && same(x.hq, old));
    if (isNaN(lon) || isNaN(lat) || stAt(lon, lat) < 0) {
      toast("Coordinates must be inside South Sudan");
      return;
    }
    if (lk2.some((x) => stAt(lon, lat) !== x.si)) {
      toast("County HQ must stay inside its state");
      return;
    }
    p[0] = nm;
    p[3] = pv("t");
    p[4] = p[3] === "a" || $("#pf-ap").checked ? 1 : 0;
    p[1] = R3(lon);
    p[2] = R3(lat);
    lk2.forEach((x) => (x.hq = [p[1], p[2]]));
    new Set(lk2.map((x) => x.si)).forEach(rebuildCells);
  }
  if (kind === "site") {
    const s = ref,
      lon = +pv("lo"),
      lat = +pv("la");
    if (isNaN(lon) || isNaN(lat) || stAt(lon, lat) < 0) {
      toast("Coordinates must be inside South Sudan");
      return;
    }
    s.name = nm;
    s.mda = pv("mda").trim();
    s.status = pv("st");
    s.cap = Math.max(0, +pv("cap") || 0);
    s.note = pv("note");
    s.lon = R3(lon);
    s.lat = R3(lat);
  }
  if (kind === "road") {
    ref.name = nm;
    ref.type = pv("t");
    ref.from = pv("fr");
    ref.to = pv("to");
  }
  if (kind === "cty") {
    const c = ref,
      lon = +pv("lo"),
      lat = +pv("la");
    if (
      nm !== c.n &&
      (COUNTIES.some((x) => x.n === nm) || DATA.some((d) => d.cty.some((x) => x.n === nm)))
    ) {
      toast("Another county already uses that name");
      return;
    }
    if (isNaN(lon) || isNaN(lat) || stAt(lon, lat) !== c.si) {
      toast("HQ must be inside " + DATA[c.si].n);
      return;
    }
    const m = DATA[c.si].cty.find((x) => x.n === c.n);
    if (m) {
      m.n = nm;
      m.e = Math.max(0, +pv("e") || 0);
      const ph = +pv("ph");
      if (ph !== m.ph) {
        m.ph = ph;
        [m.st, m.sf, m.ac] = PHD[ph];
      }
      m.md = pv("md");
    }
    if (selC === c.n) selC = nm;
    c.n = nm;
    c.hq = [R3(lon), R3(lat)];
    rebuildCells(c.si);
    dirty = true;
  }
  closePop();
  refresh();
  if (TOOL === "edit") drawHandles();
}
async function popDel() {
  if (!POP) return;
  const { kind, ref } = POP;
  if (
    !(await askConfirm(
      "Delete this " +
        {
          pl: "place",
          site: "registration site",
          road: "road",
          cty: "county",
        }[kind] +
        "?",
    ))
  )
    return;
  if (kind === "pl") PL.splice(ref, 1);
  if (kind === "site") SITES.splice(SITES.indexOf(ref), 1);
  if (kind === "road") {
    ROADS.splice(ROADS.indexOf(ref), 1);
    selRoad = null;
  }
  if (kind === "cty") delCounty(ref);
  closePop();
  refresh();
  if (TOOL === "edit") drawHandles();
}
function delCounty(c) {
  const d = DATA[c.si];
  d.cty = d.cty.filter((x) => x.n !== c.n);
  COUNTIES.splice(COUNTIES.indexOf(c), 1);
  if (selC === c.n) selC = null;
  rebuildCells(c.si);
  dirty = true;
}

/* ---- toolbar ---- */
$("#tEd").onclick = () => setMode(TOOL === "edit" ? null : "edit");
$("#tRd").onclick = () => setMode(TOOL === "road" ? null : "road");
$("#tAd").onclick = (e) => {
  e.stopPropagation();
  const m = $("#amenu");
  if ((TOOL || "").startsWith("add:")) {
    setMode(null);
    return;
  }
  m.hidden = !m.hidden;
};
$("#amenu").onclick = (e) => {
  const t = e.target.dataset && e.target.dataset.t;
  if (!t) return;
  $("#amenu").hidden = true;
  setMode("add:" + t);
};
document.addEventListener("click", (e) => {
  if (!e.target.closest("#amenu") && e.target.id !== "tAd") $("#amenu").hidden = true;
});
$("#tAm").onclick = () => openAdmin("dash");
$("#tRp").onclick = () => openRepDlg();

/* ===================== ADDON B2: administrator page (tables + modal editors) ===================== */
const ADM = {
  tab: "dash",
  q: "",
  st: "",
};
const ATABS = [
  ["counties", "Counties"],
  ["places", "Cities & towns"],
  ["airports", "Airports"],
  ["sites", "Registration sites"],
  ["roads", "Roads"],
];
const aopt = (arr, v) =>
  arr
    .map(([k, t]) =>
      __tpl(
        "map:aopt.1",
        `<option value="{{s1: esc(k)}}"{{s2: String(k) === String(v) ? ' selec…}}>{{s3: esc(t)}}</option>`,
        [() => esc(k), () => (String(k) === String(v) ? " selected" : ""), () => esc(t)],
      ),
    )
    .join("");
const STOPT = () => DATA.map((d, i) => [i, d.n]);
function openAdmin(tab, q) {
  if (!tab) tab = "dash";
  needAuth(() => openAdminNow(tab, q));
}
function openAdminNow(tab, q) {
  if (tab) ADM.tab = tab;
  ADM.q = q || "";
  $("#aqs").value = ADM.q;
  ADM.st = "";
  $("#aqst").innerHTML = aopt([["", "All states"], ...STOPT()], "");
  $("#adm").hidden = false;
  document.body.classList.add("noscroll");
  closePop();
  if (typeof admUser === "function") admUser();
  admRender();
}
function openAdminCounty(name) {
  needAuth(() => {
    openAdminNow("counties", name);
    const c = COUNTIES.find((x) => x.n === name);
    if (c) amodal("cty", c);
  });
}
function closeAdmin() {
  closeAmod();
  $("#adm").hidden = true;
  document.body.classList.remove("noscroll");
}
$("#nAdm").onclick = (e) => {
  e.preventDefault();
  openAdmin("dash");
};
$("#acl").onclick = closeAdmin;
$("#aqs").oninput = (e) => {
  ADM.q = e.target.value;
  admRender(true);
};
$("#aqst").onchange = (e) => {
  ADM.st = e.target.value;
  admRender(true);
};
$("#atabs").onclick = (e) => {
  const t = e.target.closest("button");
  if (t) {
    ADM.tab = t.dataset.t;
    admRender();
  }
};
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (AM) {
    closeAmod();
    return;
  }
  if (!$("#adm").hidden && !/INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || ""))
    closeAdmin();
});
const admMatch = (n, si) =>
  (!ADM.q || String(n).toLowerCase().includes(ADM.q.toLowerCase())) &&
  (ADM.st === "" || +ADM.st === si);
function admCount(k) {
  return k == "counties"
    ? COUNTIES.length
    : k == "places"
      ? PL.filter((p) => p[3] != "a").length
      : k == "airports"
        ? PL.filter((p) => p[4]).length
        : k == "sites"
          ? SITES.length
          : ROADS.length;
}
const pill = (ph) =>
  __tpl(
    "map:pill.1",
    `<span class="pp p{{s1: ph || 0}}">{{s2: ['Not classified', 'Phase 1', 'Ph…}}</span>`,
    [() => ph || 0, () => ["Not classified", "Phase 1", "Phase 2", "Phase 3"][ph || 0]],
  );
const locBtn = (lon, lat, si) =>
  `<button class="ib loc-icon" title="Show on map" aria-label="Show on map" data-a="loc" data-lo="${lon}" data-la="${lat}" data-s="${si}"><i class="bx bx-map-pin"></i></button>`;
const acts = (lon, lat, si) =>
  __tpl(
    "map:acts.1",
    `<td class="ac">{{s1: lon != null ? locBtn(lon, lat, si…}}<button class="ib" data-a="edit" title="Edit" aria-label="Edit"><i class="bx bx-edit-alt"></i></button><button class="ib dg" data-a="del" title="Delete" aria-label="Delete"><i class="bx bx-trash"></i></button></td>`,
    [() => (lon != null ? locBtn(lon, lat, si) : "")],
  );
const head = (t, btn, note) =>
  __tpl(
    "map:head.1",
    `<div class="card mapcard"><div class="aadd"><h3>{{s1: t}}</h3>{{s2: btn}}<button class="btn" data-a="exp" title="Download what is listed below (respects the search, state and sorting)"><i class="bx bx-export"></i> Export CSV</button><span class="am" style="margin:0">{{s3: note || ''}}</span></div>`,
    [() => t, () => btn, () => note || ""],
  );
const SORT = {};
const cmpv = (a, b) => {
  if (a == null || a === "") return b == null || b === "" ? 0 : 1;
  if (b == null || b === "") return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
};
function table(cols, rows, empty, tab) {
  const so = SORT[tab] || {};
  let R = rows;
  if (so.i != null) {
    R = rows.slice().sort((a, b) => cmpv(a.k[so.i], b.k[so.i]) * so.d);
  }
  window.__MEXP = {
    tab,
    cols: cols.slice(),
    rows: R.map((r) => r.k),
  };
  return __tpl(
    "map:table.3",
    `<div class="tw2 mapt"><table class="at" data-tab="{{s1: tab}}"><thead><tr>{{s2: cols.map(…)}}<th></th></tr></thead><tbody>{{s3: R.length ? R.map(…)}}</tbody></table></div></div>`,
    [
      () => tab,
      () => cols.map((c, i) => __tpl("map:table.1", `<th>{{s1: c}}</th>`, [() => c])).join(""),
      () =>
        R.length
          ? R.map((r) => r.h).join("")
          : __tpl(
              "map:table.2",
              `<tr><td colspan="{{s1: cols.length + 1}}" class="em">{{s2: empty || 'Nothing matches.'}}</td></tr>`,
              [() => cols.length + 1, () => empty || "Nothing matches."],
            ),
    ],
  );
}
function sortClick(th) {
  const tab = th.closest("table").dataset.tab,
    i = +th.dataset.c,
    o = SORT[tab] || {};
  if (o.i !== i)
    SORT[tab] = {
      i,
      d: 1,
    };
  else if (o.d === 1)
    SORT[tab] = {
      i,
      d: -1,
    };
  else delete SORT[tab];
  admRender(true);
}
$("#abody").addEventListener("click", (e) => {
  const th = e.target.closest("th.sortable");
  if (th) sortClick(th);
});
$("#abody").addEventListener("input", (e) => {
  if (e.target.id === "af-q") {
    AF[ADM.tab].q = e.target.value;
    const p = e.target.selectionStart;
    admRender(true);
    const n = $("#af-q");
    if (n) {
      n.focus();
      n.setSelectionRange(p, p);
    }
  }
});
$("#abody").addEventListener("change", (e) => {
  const k = e.target.dataset && e.target.dataset.af;
  if (!k || !AF[ADM.tab]) return;
  if (k === "st") {
    ADM.st = e.target.value;
    $("#aqst").value = ADM.st;
  } else AF[ADM.tab][k] = e.target.value;
  admRender(true);
});
$("#abody").addEventListener("click", (e) => {
  if (e.target.closest("#af-clr")) {
    AF[ADM.tab] = {};
    ADM.st = "";
    ADM.q = "";
    $("#aqs").value = "";
    $("#aqst").value = "";
    admRender(true);
  }
});
$("#abody").addEventListener("input", (e) => {
  if (e.target.id === "sf-q") {
    SF.q = e.target.value;
    const p = e.target.selectionStart;
    admRender(true);
    const n = $("#sf-q");
    if (n) {
      n.focus();
      n.setSelectionRange(p, p);
    }
  }
});
$("#abody").addEventListener("change", (e) => {
  const id = e.target.id;
  if (id === "sf-st") {
    ADM.st = e.target.value;
    SF.co = "";
    $("#aqst").value = ADM.st;
  } else if (id === "sf-co") SF.co = e.target.value;
  else if (id === "sf-mda") SF.mda = e.target.value;
  else if (id === "sf-stt") SF.stt = e.target.value;
  else return;
  admRender(true);
});
$("#abody").addEventListener("click", (e) => {
  if (e.target.closest("#sf-clr")) {
    SF.q = SF.co = SF.mda = SF.stt = "";
    ADM.st = "";
    ADM.q = "";
    $("#aqs").value = "";
    $("#aqst").value = "";
    admRender(true);
  }
});
$("#abody").addEventListener("keydown", (e) => {
  const th = e.target.closest && e.target.closest("th.sortable");
  if (th && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    sortClick(th);
  }
});
function admRender(keep) {
  const sc = keep ? $("#abody").scrollTop : 0;
  $("#atabs").innerHTML = ATABS.map(
    ([k, t]) =>
      `<button data-t="${k}" class="${ADM.tab == k ? "on" : ""}">${t} <i>${admCount(k)}</i></button>`,
  ).join("");
  $("#abody").innerHTML = {
    counties: admCounties,
    places: admPlaces,
    airports: admAirports,
    sites: admSites,
    roads: admRoads,
  }[ADM.tab]();
  $("#abody").scrollTop = sc;
}
function admCounties() {
  const R = [];
  DATA.forEach((d, si) =>
    d.cty.forEach((c) => {
      if (
        !admMatch(c.n, si) ||
        !afOk("counties", {
          hay: c.n + " " + d.n,
          ph: c.ph || 0,
          sf: c.sf || "",
          ac: c.ac || "",
          md: c.md || "",
        })
      )
        return;
      const C = COUNTIES.find((x) => x.si === si && x.n === c.n),
        g = C ? cGeo(C) : null;
      R.push({
        k: [
          c.n,
          d.n,
          c.e || 0,
          c.ph || 0,
          c.sf || "",
          c.ac || "",
          c.md || "",
          c.rm || "",
          g ? g[1] + ", " + g[0] : null,
        ],
        h: __tpl(
          "map:admCounties.1",
          `<tr class="clk" data-k="cty" data-s="{{s1: si}}" data-n="{{s2: esc(c.n)}}"><td><b>{{s3: esc(c.n)}}</b></td><td>{{s4: esc(d.n)}}</td><td class="n">{{s5: fmt(c.e || 0)}}</td><td>{{s6: pill(c.ph)}}</td><td>{{s7: esc(c.sf || '—')}}</td><td>{{s8: esc(c.ac || '—')}}</td><td>{{s9: esc(c.md || '—')}}</td><td class="tr" title="{{s10: esc(c.rm || '')}}">{{s11: esc(c.rm || '')}}</td><td class="mono">{{s12: g ? g[1] + ', ' + g[0] : '—'}}</td>{{s13: acts(C ? C.hq[0] : null, C ? C.hq…}}</tr>`,
          [
            () => si,
            () => esc(c.n),
            () => esc(c.n),
            () => esc(d.n),
            () => fmt(c.e || 0),
            () => pill(c.ph),
            () => esc(c.sf || "—"),
            () => esc(c.ac || "—"),
            () => esc(c.md || "—"),
            () => esc(c.rm || ""),
            () => esc(c.rm || ""),
            () => (g ? g[1] + ", " + g[0] : "—"),
            () => acts(C ? C.hq[0] : null, C ? C.hq[1] : null, si),
          ],
        ),
      });
    }),
  );
  return (
    head(
      "Counties / locations",
      '<button class="btn pri" data-a="add">+ Add county</button>',
      `${COUNTIES.length} counties · click a column heading to sort, a row or the Edit button to edit in a pop-up.`,
    ) +
    afBar("counties") +
    table(
      [
        "County / location",
        "State",
        "Employees",
        "Security",
        "Safety",
        "Access",
        "Transport",
        "Remarks",
        "Google lat, lng",
      ],
      R,
      "",
      ADM.tab,
    )
  );
}
function admPlaces() {
  const R = [];
  PL.forEach((p, i) => {
    if (p[3] == "a") return;
    const si = stAt(p[1], p[2]);
    if (
      !admMatch(p[0], si) ||
      !afOk("places", {
        hay: p[0] + " " + (si >= 0 ? DATA[si].n : ""),
        ty: TYN[p[3]],
        ap: p[4] ? "Yes" : "No",
      })
    )
      return;
    const g = toGeo(p[1], p[2]);
    R.push({
      k: [p[0], TYN[p[3]], p[4] ? "Yes" : "", si >= 0 ? DATA[si].n : "", g[1] + ", " + g[0]],
      h: __tpl(
        "map:admPlaces.1",
        `<tr class="clk" data-k="pl" data-i="{{s1: i}}"><td><b>{{s2: esc(p[0])}}</b></td><td>{{s3: TYN[p[3]]}}</td><td>{{s4: p[4] ? ' i class='bx bxs-plane-al…}}</td><td>{{s5: si = 0 ? esc(DATA[si].n) : '—'}}</td><td class="mono">{{s6: g[1]}}, {{s7: g[0]}}</td>{{s8: acts(p[1], p[2], si)}}</tr>`,
        [
          () => i,
          () => esc(p[0]),
          () => TYN[p[3]],
          () => (p[4] ? '<i class="bx bxs-plane-alt"></i> Yes' : "—"),
          () => (si >= 0 ? esc(DATA[si].n) : "—"),
          () => g[1],
          () => g[0],
          () => acts(p[1], p[2], si),
        ],
      ),
    });
  });
  return (
    head(
      "Cities & towns",
      '<button class="btn pri" data-a="add">+ Add city / town</button>',
      "Each name appears once on the map. A county whose HQ sits on a place moves with it.",
    ) +
    afBar("places") +
    table(["Name", "Type", "Airport", "State", "Google lat, lng"], R, "", ADM.tab)
  );
}
function admAirports() {
  const R = [];
  PL.forEach((p, i) => {
    if (!p[4]) return;
    const si = stAt(p[1], p[2]);
    if (
      !admMatch(p[0], si) ||
      !afOk("airports", {
        hay: p[0] + " " + (si >= 0 ? DATA[si].n : ""),
        kind: p[3] == "a" ? "Airport only" : TYN[p[3]] + " airport",
      })
    )
      return;
    const g = toGeo(p[1], p[2]);
    R.push({
      k: [
        p[0],
        p[3] == "a" ? "Airport only" : TYN[p[3]] + " airport",
        si >= 0 ? DATA[si].n : "",
        g[1] + ", " + g[0],
      ],
      h: __tpl(
        "map:admAirports.1",
        `<tr class="clk" data-k="pl" data-i="{{s1: i}}"><td><b>{{s2: esc(p[0])}}</b></td><td>{{s3: p[3] == 'a' ? 'Airport only' : TY…}}</td><td>{{s4: si = 0 ? esc(DATA[si].n) : '—'}}</td><td class="mono">{{s5: g[1]}}, {{s6: g[0]}}</td>{{s7: acts(p[1], p[2], si)}}</tr>`,
        [
          () => i,
          () => esc(p[0]),
          () => (p[3] == "a" ? "Airport only" : TYN[p[3]] + " airport"),
          () => (si >= 0 ? esc(DATA[si].n) : "—"),
          () => g[1],
          () => g[0],
          () => acts(p[1], p[2], si),
        ],
      ),
    });
  });
  return (
    head(
      "Airports",
      '<button class="btn pri" data-a="add">+ Add airport</button>',
      "Airports that belong to a city or town are listed too.",
    ) +
    afBar("airports") +
    table(["Name", "Kind", "State", "Google lat, lng"], R, "", ADM.tab)
  );
}
const AF = {
  counties: {},
  places: {},
  airports: {},
};
const afUniq = (a) =>
  [...new Set(a.filter((x) => x !== "" && x != null))].sort((x, y) =>
    String(x).localeCompare(String(y), undefined, {
      numeric: true,
    }),
  );
function afOk(tab, r) {
  const f = AF[tab] || {};
  if (f.q && !(r.hay + "").toLowerCase().includes(f.q.trim().toLowerCase())) return false;
  return Object.keys(r).every((k) => k == "hay" || !f[k] || String(r[k]) === String(f[k]));
}
function afBar(tab) {
  const f = AF[tab] || {},
    sel = (k, l, all, arr) =>
      `<label>${l}<select id="af-${k}" data-af="${k}">${aopt([["", all]].concat(arr), f[k] || "")}</select></label>`,
    pairs = (a) => afUniq(a).map((x) => [x, x]);
  let x = "";
  const st = __tpl(
    "map:afBar.1",
    `<label>State<select id="af-st" data-af="st">{{s1: aopt([['', 'All states']].concat(…}}</select></label>`,
    [() => aopt([["", "All states"]].concat(STOPT()), ADM.st)],
  );
  if (tab == "counties")
    x =
      st +
      sel("ph", "Security phase", "All phases", [
        [0, "Not classified"],
        [1, "Phase 1"],
        [2, "Phase 2"],
        [3, "Phase 3"],
      ]) +
      sel("sf", "Safety", "All", pairs(DATA.flatMap((d) => d.cty.map((c) => c.sf || "")))) +
      sel("ac", "Access", "All", pairs(DATA.flatMap((d) => d.cty.map((c) => c.ac || "")))) +
      sel("md", "Transport", "All", pairs(DATA.flatMap((d) => d.cty.map((c) => c.md || ""))));
  if (tab == "places")
    x =
      st +
      sel("ty", "Type", "All types", pairs(PL.filter((p) => p[3] != "a").map((p) => TYN[p[3]]))) +
      sel("ap", "Airport", "Any", [
        ["Yes", "Has airport"],
        ["No", "No airport"],
      ]);
  if (tab == "airports")
    x =
      st +
      sel(
        "kind",
        "Kind",
        "All kinds",
        pairs(
          PL.filter((p) => p[4]).map((p) =>
            p[3] == "a" ? "Airport only" : TYN[p[3]] + " airport",
          ),
        ),
      );
  return __tpl(
    "map:afBar.2",
    `<div class="flt sfbar"><label>Search<input id="af-q" value="{{s1: esc(f.q || '')}}" placeholder="Name"></label>{{s2: x}}<label>&nbsp;<button class="btn" id="af-clr" type="button">Clear filters</button></label></div>`,
    [() => esc(f.q || ""), () => x],
  );
}
const SF = {
  q: "",
  co: "",
  mda: "",
  stt: "",
};
function sitesBar() {
  const mdas = [...new Set(SITES.map((x) => x.mda).filter(Boolean))].sort(),
    cos = ADM.st === "" ? [] : DATA[+ADM.st].cty.map((c) => c.n).sort();
  return `<div class="flt sfbar"><label>Search<input id="sf-q" value="${esc(SF.q)}" placeholder="Site, MDA, state or county"></label><label>State<select id="sf-st">${aopt([["", "All states"]].concat(STOPT()), ADM.st)}</select></label><label>County<select id="sf-co">${aopt([["", ADM.st === "" ? "Select a state first" : "All counties"]].concat(cos.map((c) => [c, c])), SF.co)}</select></label><label>MDA<select id="sf-mda">${aopt([["", "All MDAs"]].concat(mdas.map((m) => [m, m])), SF.mda)}</select></label><label>Status<select id="sf-stt">${aopt(
    [
      ["", "All statuses"],
      ["Planned", "Planned"],
      ["Active", "Active"],
      ["Closed", "Closed"],
    ],
    SF.stt,
  )}</select></label><label>&nbsp;<button class="btn" id="sf-clr" type="button">Clear filters</button></label></div>`;
}
function admSites() {
  const R = [];
  SITES.forEach((s, i) => {
    const si = stAt(s.lon, s.lat),
      c = cntyNear(s.lon, s.lat, si >= 0 ? si : 0),
      g = sGeo(s);
    if (ADM.st !== "" && +ADM.st !== si) return;
    if (SF.co && (c ? c.n : "") !== SF.co) return;
    if (SF.mda && (s.mda || "") !== SF.mda) return;
    if (SF.stt && s.status !== SF.stt) return;
    const hay = (
      s.name +
      " " +
      (s.mda || "") +
      " " +
      (si >= 0 ? DATA[si].n : "") +
      " " +
      (c ? c.n : "")
    ).toLowerCase();
    if (![SF.q, ADM.q].every((t) => !t || hay.includes(t.trim().toLowerCase()))) return;
    R.push({
      k: [
        s.name,
        s.mda || "",
        s.status,
        s._excelKey ? s.cap || 0 : "",
        s._excelKey ? "" : s.cap || 0,
        si >= 0 ? DATA[si].n : "",
        c ? c.n : "",
        g[1] + ", " + g[0],
        s._excelKey ? "" : s.note || "",
      ],
      h: __tpl(
        "map:admSites.1",
        `<tr class="clk" data-k="site" data-i="{{s1: i}}"><td>{{s2: esc(s.name)}}</td><td>{{s3: esc(s.mda || '—')}}</td><td><span class="pp st-{{s4: String(s.status).toLowerCase()}}">{{s5: esc(s.status)}}</span></td><td class="n">{{s6: s._excelKey s.cap ? fmt(s.cap) :…}}</td><td class="n">{{s7: !s._excelKey s.cap ? fmt(s.cap) :…}}</td><td>{{s8: si = 0 ? esc(DATA[si].n) : '—'}}</td><td>{{s9: c ? esc(c.n) : '—'}}</td><td class="mono">{{s10: g[1]}}, {{s11: g[0]}}</td><td class="tr" title="{{s12: esc(s._excelKey ? '' : s.note ||…}}">{{s13: esc(s._excelKey ? '' : s.note ||…}}</td>{{s14: acts(s.lon, s.lat, si)}}</tr>`,
        [
          () => i,
          () => esc(s.name),
          () => esc(s.mda || "—"),
          () => String(s.status).toLowerCase(),
          () => esc(s.status),
          () => (s._excelKey && s.cap ? fmt(s.cap) : "—"),
          () => (!s._excelKey && s.cap ? fmt(s.cap) : "—"),
          () => (si >= 0 ? esc(DATA[si].n) : "—"),
          () => (c ? esc(c.n) : "—"),
          () => g[1],
          () => g[0],
          () => esc(s._excelKey ? "" : s.note || ""),
          () => esc(s._excelKey ? "" : s.note || ""),
          () => acts(s.lon, s.lat, si),
        ],
      ),
    });
  });
  const act = SITES.filter((s) => s.status == "Active").length;
  return (
    head(
      "Registration sites",
      '<button class="btn pri" data-a="add">+ Add registration site</button>',
      `${R.length === SITES.length ? SITES.length : R.length + " of " + SITES.length} registration sites · ${act} active. County coordinates are used for imported locations.`,
    ) +
    sitesBar() +
    table(
      [
        "Site",
        "MDA",
        "Status",
        "Govt Employees",
        "Capacity/Day",
        "State",
        "County",
        "Google lat, lng",
        "Note",
      ],
      R,
      "No registration sites yet.",
      ADM.tab,
    )
  );
}
function admRoads() {
  const R = [];
  ROADS.forEach((r, i) => {
    if (ADM.q && !(r.name + " " + r.from + " " + r.to).toLowerCase().includes(ADM.q.toLowerCase()))
      return;
    if (ADM.st !== "") {
      const m = r.pts[Math.floor(r.pts.length / 2)];
      if (stAt(m[0], m[1]) !== +ADM.st) return;
    }
    const km = lenKm(r.pts);
    R.push({
      k: [r.name, r.type, r.from || "", r.to || "", km, r.src],
      h: __tpl(
        "map:admRoads.1",
        `<tr class="clk" data-k="road" data-i="{{s1: i}}"><td><b>{{s2: esc(r.name)}}</b></td><td>{{s3: main: 'Main road', secondary: 'Se…}}</td><td>{{s4: esc(r.from || '—')}}</td><td>{{s5: esc(r.to || '—')}}</td><td class="n">{{s6: km.toFixed(1)}} km</td><td>{{s7: r.src == 'UN' ? 'UN map' : 'Drawn'}}</td>{{s8: acts(r.pts[0][0], r.pts[0][1], st…}}</tr>`,
        [
          () => i,
          () => esc(r.name),
          () =>
            ({
              main: "Main road",
              secondary: "Secondary",
              track: "Track / seasonal",
            })[r.type] || r.type,
          () => esc(r.from || "—"),
          () => esc(r.to || "—"),
          () => km.toFixed(1),
          () => (r.src == "UN" ? "UN map" : "Drawn"),
          () => acts(r.pts[0][0], r.pts[0][1], stAt(r.pts[0][0], r.pts[0][1])),
        ],
      ),
    });
  });
  return (
    head(
      "Roads",
      '<button class="btn pri" data-a="draw">Draw a new road on the map</button>',
      `${ROADS.length} roads · ${fmt(Math.round(ROADS.reduce((a, r) => a + lenKm(r.pts), 0)))} km in total. Use the Edit button to rename; reshape lines with Edit mode on the map.`,
    ) + table(["Road", "Type", "From", "To", "Length", "Source"], R, "", ADM.tab)
  );
}

/* ---- locate on map ---- */
function locate(lon, lat, si) {
  closeAdmin();
  if (si >= 0 && si !== view) {
    pick(si);
    zoomState(si);
  }
  const w = 140,
    h = w * AR,
    x = X(lon),
    y = Y(lat);
  tv = [...cl2(x - w / 2, y - h / 2, w, h), w, h];
  flash(lon, lat);
  $("#mapsec").scrollIntoView({
    behavior: "smooth",
  });
}
function flash(lon, lat) {
  const g = $("#gfl");
  g.innerHTML = "";
  g.append(
    mk("circle", {
      cx: X(lon),
      cy: Y(lat),
      r: 4,
      class: "flash",
    }),
  );
  setTimeout(() => (g.innerHTML = ""), 3600);
}

/* ---- table clicks ---- */
$("#abody").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-a]"),
    tr = e.target.closest("tr");
  const a = b ? b.dataset.a : tr && tr.classList.contains("clk") ? "edit" : null;
  if (!a) return;
  if (a === "loc") return locate(+b.dataset.lo, +b.dataset.la, +b.dataset.s);
  if (a === "exp") {
    const X = window.__MEXP;
    if (!X || !X.rows.length) return toast("Nothing to export");
    const q = (v) => {
        v =
          v == null
            ? ""
            : typeof v == "number" && v % 1
              ? String(+v.toFixed(2))
              : String(v).replace(/<[^>]*>/g, "");
        return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      },
      n = X.cols.length,
      csv = [X.cols.map(q).join(",")]
        .concat(X.rows.map((r) => r.slice(0, Math.max(n, r.length)).map(q).join(",")))
        .join("\r\n"),
      a2 = document.createElement("a");
    a2.href = URL.createObjectURL(
      new Blob(["\ufeff" + csv], {
        type: "text/csv;charset=utf-8",
      }),
    );
    a2.download = "map-data-" + X.tab + "-" + new Date().toISOString().slice(0, 10) + ".csv";
    a2.click();
    setTimeout(() => URL.revokeObjectURL(a2.href), 2000);
    return toast("Exported " + X.rows.length + " rows");
  }
  if (a === "draw") {
    closeAdmin();
    return setMode("road");
  }
  if (a === "add")
    return amodal(
      {
        counties: "cty",
        places: "pl",
        airports: "ap",
        sites: "site",
      }[ADM.tab],
      null,
    );
  if (!tr) return;
  const k = tr.dataset.k;
  if (a === "edit") {
    if (k === "cty")
      amodal(
        "cty",
        COUNTIES.find((x) => x.si === +tr.dataset.s && x.n === tr.dataset.n) || {
          n: tr.dataset.n,
          si: +tr.dataset.s,
          hq: repPoint(+tr.dataset.s),
          poly: [],
        },
      );
    if (k === "pl") amodal("pl", +tr.dataset.i);
    if (k === "site") amodal("site", SITES[+tr.dataset.i]);
    if (k === "road") amodal("road", ROADS[+tr.dataset.i]);
    return;
  }
  if (a === "del") {
    if (!(await askConfirm("Delete this entry? This cannot be undone."))) return;
    if (k === "pl") PL.splice(+tr.dataset.i, 1);
    if (k === "site") SITES.splice(+tr.dataset.i, 1);
    if (k === "road") ROADS.splice(+tr.dataset.i, 1);
    if (k === "cty") {
      const c = COUNTIES.find((x) => x.si === +tr.dataset.s && x.n === tr.dataset.n);
      if (c) delCounty(c);
      else {
        const d = DATA[+tr.dataset.s];
        d.cty = d.cty.filter((x) => x.n !== tr.dataset.n);
        dirty = true;
      }
    }
    refresh();
    admRender(true);
    toast("Deleted");
  }
});

/* ---- modal editor ---- */
let AM = null;
function closeAmod() {
  $("#amod").hidden = true;
  AM = null;
}
const mv = (id) => {
  const e = $("#am-" + id);
  return e ? (e.type === "checkbox" ? e.checked : e.value.trim()) : "";
};
const mf = (id, l, v, t, ex) =>
  `<label>${l}<input id="am-${id}" type="${t || "text"}" value="${esc(v)}" ${ex || ""}></label>`;
const mta = (id, l, v) =>
  `<label class="w2">${l}<textarea id="am-${id}" rows="2">${esc(v)}</textarea></label>`;
const msel = (id, l, arr, v) => `<label>${l}<select id="am-${id}">${aopt(arr, v)}</select></label>`;
function amInfo() {
  const e = $("#am-info");
  if (!e) return;
  let lo, la, gg;
  if ($("#am-glo")) {
    const g1 = parseFloat(mv("glo")),
      g2 = parseFloat(mv("gla"));
    if (isNaN(g1) || isNaN(g2)) {
      e.textContent =
        "Enter the Google Maps longitude and latitude (in Google Maps, right-click a spot and click the numbers to copy them: latitude first).";
      return;
    }
    gg = [g1, g2];
    [lo, la] = fromGeo(g1, g2);
  } else {
    lo = parseFloat(mv("lo"));
    la = parseFloat(mv("la"));
    if (isNaN(lo) || isNaN(la)) {
      e.textContent = "Enter coordinates, or use “Pick on map”.";
      return;
    }
    gg = toGeo(lo, la);
  }
  const si = stAt(lo, la);
  if (si < 0) {
    e.innerHTML = '<i class="bx bx-error"></i> This point is outside South Sudan.';
    return;
  }
  const c = cntyNear(lo, la, si);
  e.innerHTML =
    esc("In " + DATA[si].n + (c ? " · nearest county: " + c.n : "")) +
    ` · <a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${gg[1]},${gg[0]}">Google Maps ${gg[1]}, ${gg[0]}</a>`;
}
function amodal(kind, ref, preset) {
  const isNew = ref == null;
  AM = {
    kind,
    ref,
    isNew,
  };
  let t = "",
    h = "",
    extra = "";
  if (kind === "cty") {
    const c = ref,
      m = c ? DATA[c.si].cty.find((x) => x.n === c.n) || {} : {},
      si = c ? c.si : ADM.st !== "" ? +ADM.st : 0,
      hq = c ? c.hq : repPoint(si);
    t = isNew ? "Add county / location" : "Edit county · " + c.n;
    h = `<div class="mg">${mf("n", "County / location name", c ? c.n : "")}${msel("s", "State / area", STOPT(), si)}${mf("e", "Govt employees", m.e || 0, "number", 'min="0"')}${msel(
      "ph",
      "Security phase",
      [
        [0, "Not classified"],
        [1, "Phase 1 · Low risk"],
        [2, "Phase 2 · Risk"],
        [3, "Phase 3 · High risk"],
      ],
      m.ph || 0,
    )}${mf("sf", "Safety", m.sf || "")}${mf("ac", "Accessibility", m.ac || "")}${msel(
      "md",
      "Transport",
      [
        ["", "—"],
        ["Air", "Air"],
        ["Road", "Road"],
        ["River", "River"],
      ],
      m.md || "",
    )}<span></span>${mta("rm", "Remarks", m.rm || "")}${mta("rc", "Recommendation", m.rc || "")}${mf("lo", "HQ longitude", hq[0], "number", 'step="0.001"')}${mf("la", "HQ latitude", hq[1], "number", 'step="0.001"')}</div>`;
  }
  if (kind === "pl" || kind === "ap") {
    const p =
      kind === "pl" && ref != null
        ? PL[ref]
        : ["", "", "", kind === "ap" ? "a" : "t", kind === "ap" ? 1 : 0];
    const lk2 =
      kind === "pl" && ref != null ? COUNTIES.filter((x) => x.hq && same(x.hq, [p[1], p[2]])) : [];
    t = isNew ? (kind === "ap" ? "Add airport" : "Add city / town") : "Edit · " + p[0];
    h = `<div class="mg">${mf("n", "Name", p[0])}${msel("t", "Type", kind === "ap" ? [["a", "Airport only"]] : Object.entries(TYN), p[3])}<label class="ck w2"><input id="am-ap" type="checkbox"${p[4] ? " checked" : ""}${p[3] == "a" ? " disabled" : ""}> This place has an airport</label>${mf("lo", "Longitude", p[1], "number", 'step="0.001"')}${mf("la", "Latitude", p[2], "number", 'step="0.001"')}</div>${lk2.length ? `<p class="pm">County HQ of <b>${lk2.map((x) => esc(x.n)).join(", ")}</b> — moving this place moves the county HQ.</p>` : ""}`;
  }
  if (kind === "site") {
    const s = ref || {
        name: "",
        status: "Planned",
        cap: 0,
        note: "",
      },
      g = ref ? sGeo(s) : ["", ""];
    t =
      isNew || s.name === "New registration site"
        ? "Add registration site"
        : "Edit site · " + s.name;
    h = `<div class="mg">${((lc) => msel("ss", "State", [["", "Select state"]].concat(DATA.map((d) => [d.n, d.n])), lc[0]) + msel("sc", "County", window.frCnty(lc[0]), lc[1]))(s.lon != null ? window.frLoc(s) : ["", ""])}${mf("n", "Site name", s.name)}${mf("mda", "MDA (ministry)", s.mda || "", "text", 'list="mdal" autocomplete="off" placeholder="Type or pick an MDA"')}${window.frMdaDL()}${msel(
      "st",
      "Status",
      [
        ["Planned", "Planned"],
        ["Active", "Active"],
        ["Closed", "Closed"],
      ],
      s.status || "Planned",
    )}${mf("cap", "Capacity per day", s.cap || 0, "number", 'min="0"')}${mf("fte", "Total number to register", s.fte || (s._excelKey ? s.cap : "") || "", "number", 'min="0"')}${mf("glo", "Longitude (Google Maps) · optional", g[0], "number", 'step="0.00001" placeholder="Auto: county HQ"')}${mf("gla", "Latitude (Google Maps) · optional", g[1], "number", 'step="0.00001" placeholder="Auto: county HQ"')}${mta("note", "Note", s.note || "")}</div>`;
  }
  if (kind === "road") {
    const r = ref;
    t = "Edit road · " + r.name;
    h = `<div class="mg">${mf("n", "Road name", r.name)}${msel(
      "t",
      "Type",
      [
        ["main", "Main road"],
        ["secondary", "Secondary road"],
        ["track", "Track / seasonal"],
      ],
      r.type,
    )}${mf("fr", "From", r.from)}${mf("to", "To", r.to)}</div><p class="pm">${lenKm(r.pts).toFixed(1)} km · ${r.pts.length} points · ${r.src == "UN" ? "traced from the UN map" : "drawn by you"}</p>`;
  }
  const left =
    kind === "road"
      ? '<button class="btn" data-m="reshape">Reshape on map</button>'
      : isNew
        ? '<button class="btn" data-m="pick">Pick on map</button>'
        : '<button class="btn" data-m="show">Show on map</button>';
  $("#amb").innerHTML =
    `<h3>${esc(t)}</h3>${h}<p class="pm" id="am-info"></p><div class="row2 sp">${left}<span style="flex:1"></span>${isNew ? "" : '<button class="btn dng" data-m="del">Delete</button>'}<button class="btn" data-m="x">Cancel</button><button class="btn pri" data-m="save">${isNew ? "Add" : "Save changes"}</button></div>`;
  $("#amod").hidden = false;
  amInfo();
  ["lo", "la", "glo", "gla"].forEach((i) => {
    const e = $("#am-" + i);
    if (e) e.oninput = amInfo;
  });
  const ph = $("#am-ph");
  if (ph)
    ph.onchange = () => {
      const d = PHD[+ph.value];
      [
        ["sf", 1],
        ["ac", 2],
      ].forEach(([f, ix]) => {
        const e = $("#am-" + f);
        if (!e.value || Object.values(PHD).some((a) => a[ix] === e.value)) e.value = d[ix];
      });
    };
  const sS = $("#am-ss"),
    sC = $("#am-sc"),
    gO = $("#am-glo"),
    gA = $("#am-gla");
  if (kind === "site" && sS && sC && gO && gA) {
    const hq = () => {
      const si = DATA.findIndex((d) => d.n === sS.value),
        C = COUNTIES.find((c) => c.si === si && c.n === sC.value);
      return C && C.hq ? toGeo(C.hq[0], C.hq[1]) : null;
    };
    const mark = () => {
      delete gO.dataset.auto;
      delete gA.dataset.auto;
    };
    gO.addEventListener("input", mark);
    gA.addEventListener("input", mark);
    const fill = () => {
      const p = hq();
      if (p && ((!gO.value && !gA.value) || gO.dataset.auto)) {
        gO.value = p[0];
        gA.value = p[1];
        gO.dataset.auto = gA.dataset.auto = "1";
        amInfo();
      }
    };
    sS.addEventListener("change", () => {
      sC.innerHTML = window
        .frCnty(sS.value)
        .map((x) => `<option value="${esc(x[0])}">${esc(x[1])}</option>`)
        .join("");
      if (gO.dataset.auto) {
        gO.value = gA.value = "";
        delete gO.dataset.auto;
        delete gA.dataset.auto;
        amInfo();
      }
    });
    sC.addEventListener("change", fill);
  }
  const ss = $("#am-s");
  if (ss && isNew)
    ss.onchange = () => {
      const p = repPoint(+ss.value);
      $("#am-lo").value = p[0];
      $("#am-la").value = p[1];
      amInfo();
    };
  const ty = $("#am-t");
  if (ty && (kind === "pl" || kind === "ap"))
    ty.onchange = () => {
      const a = $("#am-ap");
      if (ty.value === "a") {
        a.checked = true;
        a.disabled = true;
      } else a.disabled = false;
    };
  const f = $("#am-n");
  if (f) {
    f.focus();
    f.select();
  }
}
$("#amod").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.tagName === "INPUT") amSave();
});
$("#amod").addEventListener("mousedown", (e) => {
  if (e.target.id === "amod") closeAmod();
});
$("#amod").onclick = (e) => {
  const m = e.target.dataset && e.target.dataset.m;
  if (!m) return;
  if (m === "x") closeAmod();
  if (m === "save") amSave();
  if (m === "del") amDel();
  if (m === "show") {
    let lo, la;
    if ($("#am-glo")) {
      [lo, la] = fromGeo(parseFloat(mv("glo")), parseFloat(mv("gla")));
    } else {
      lo = parseFloat(mv("lo"));
      la = parseFloat(mv("la"));
    }
    closeAmod();
    locate(lo, la, stAt(lo, la));
  }
  if (m === "pick") {
    const k = AM.kind,
      nm = mv("n");
    PEND = nm
      ? {
          name: nm,
        }
      : null;
    const ty = k === "cty" ? "cty" : k === "site" ? "s" : k === "ap" ? "a" : mv("t") || "t";
    closeAmod();
    closeAdmin();
    setMode("add:" + ty);
  }
  if (m === "reshape") {
    const r = AM.ref;
    closeAmod();
    closeAdmin();
    setMode("edit");
    selRoad = r;
    drawHandles();
    const xs = r.pts.map((p) => X(p[0])),
      ys = r.pts.map((p) => Y(p[1]));
    tv = adj(fit([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]));
    $("#mapsec").scrollIntoView({
      behavior: "smooth",
    });
  }
};
const dupCounty = (n) =>
  COUNTIES.some((x) => x.n === n) || DATA.some((d) => d.cty.some((x) => x.n === n));
function amSave() {
  if (!AM) return;
  const { kind, ref, isNew } = AM,
    nm = mv("n");
  if (!nm) {
    toast("Please enter a name");
    return;
  }
  const lo = parseFloat(mv("lo")),
    la = parseFloat(mv("la"));
  if (kind === "cty") {
    const ns = +mv("s");
    if (isNaN(lo) || isNaN(la) || !inPoly(lo, la, DATA[ns].poly)) {
      toast("The HQ must be inside " + DATA[ns].n);
      return;
    }
    const ph = +mv("ph"),
      vals = {
        e: Math.max(0, +mv("e") || 0),
        sf: mv("sf"),
        ac: mv("ac"),
        rm: mv("rm"),
        rc: mv("rc"),
        md: mv("md"),
      };
    if (isNew) {
      if (dupCounty(nm)) {
        toast("A county with that name already exists");
        return;
      }
      DATA[ns].cty.push(
        Object.assign(
          {
            n: nm,
            ph,
            st: PHD[ph][0],
          },
          vals,
        ),
      );
      COUNTIES.push({
        n: nm,
        si: ns,
        hq: [R3(lo), R3(la)],
        poly: [],
      });
      rebuildCells(ns);
    } else {
      const c = ref,
        old = c.si,
        m = DATA[old].cty.find((x) => x.n === c.n);
      if (nm !== c.n && dupCounty(nm)) {
        toast("Another county already uses that name");
        return;
      }
      if (m) {
        if (ph !== m.ph) m.st = PHD[ph][0];
        m.ph = ph;
        m.n = nm;
        Object.assign(m, vals);
        if (ns !== old) {
          DATA[old].cty = DATA[old].cty.filter((x) => x !== m);
          DATA[ns].cty.push(m);
        }
      }
      if (selC === c.n) selC = nm;
      c.n = nm;
      c.si = ns;
      c.hq = [R3(lo), R3(la)];
      rebuildCells(ns);
      if (ns !== old) rebuildCells(old);
    }
    dirty = true;
  }
  if (kind === "pl" || kind === "ap") {
    if (isNaN(lo) || isNaN(la) || stAt(lo, la) < 0) {
      toast("Coordinates must be inside South Sudan");
      return;
    }
    const ty = mv("t") || "t",
      ap = ty === "a" || mv("ap") ? 1 : 0;
    if (isNew) PL.push([nm, R3(lo), R3(la), ty, ap]);
    else {
      const p = PL[ref],
        old = [p[1], p[2]],
        lk2 = COUNTIES.filter((x) => x.hq && same(x.hq, old));
      if (lk2.some((x) => stAt(lo, la) !== x.si)) {
        toast("This place is a county HQ — keep it inside its state");
        return;
      }
      p[0] = nm;
      p[3] = ty;
      p[4] = ap;
      p[1] = R3(lo);
      p[2] = R3(la);
      lk2.forEach((x) => (x.hq = [p[1], p[2]]));
      new Set(lk2.map((x) => x.si)).forEach(rebuildCells);
    }
  }
  if (kind === "site") {
    let gl = parseFloat(mv("glo")),
      ga = parseFloat(mv("gla"));
    if (!mv("ss") || !mv("sc")) {
      toast("Select the state and the county");
      return;
    }
    if (isNaN(gl) !== isNaN(ga)) {
      toast(
        "Enter both longitude and latitude, or leave both empty to use the county headquarters",
      );
      return;
    }
    let t2;
    if (isNaN(gl)) {
      const C = COUNTIES.find(
        (c) => c.si === DATA.findIndex((d) => d.n === mv("ss")) && c.n === mv("sc"),
      );
      if (!C || !C.hq) {
        toast("That county has no headquarters point — enter the Google Maps coordinates");
        return;
      }
      t2 = [C.hq[0], C.hq[1]];
      [gl, ga] = toGeo(t2[0], t2[1]);
    } else t2 = fromGeo(gl, ga);
    if (stAt(t2[0], t2[1]) < 0) {
      toast("That location is outside South Sudan");
      return;
    }
    const o = {
      name: nm,
      mda: mv("mda").trim(),
      status: mv("st"),
      cap: Math.max(0, +mv("cap") || 0),
      _st: mv("ss") || "",
      _cn: mv("sc") || "",
      fte: Math.max(0, Math.floor(+mv("fte") || 0)),
      note: mv("note"),
      lon: R3(t2[0]),
      lat: R3(t2[1]),
      g: [+gl.toFixed(5), +ga.toFixed(5)],
      _h: [R3(t2[0]), R3(t2[1])],
    };
    if (!ref)
      SITES.push(
        Object.assign(
          {
            id: uid("s"),
            open: "",
            deadline: "",
            sup: "",
            dcaN: 0,
            cmt: "",
          },
          o,
        ),
      );
    else Object.assign(ref, o);
  }
  if (kind === "road") {
    ref.name = nm;
    ref.type = mv("t");
    ref.from = mv("fr");
    ref.to = mv("to");
  }
  closeAmod();
  refresh();
  admRender(true);
  toast(isNew ? "Added " + nm : "Saved " + nm);
}
async function amDel() {
  if (!AM) return;
  const { kind, ref } = AM;
  if (!(await askConfirm("Delete this entry? This cannot be undone."))) return;
  if (kind === "pl") PL.splice(ref, 1);
  if (kind === "site") SITES.splice(SITES.indexOf(ref), 1);
  if (kind === "road") ROADS.splice(ROADS.indexOf(ref), 1);
  if (kind === "cty") delCounty(ref);
  closeAmod();
  refresh();
  admRender(true);
  toast("Deleted");
}

/* ---- backup ---- */
function snapshot() {
  return {
    v: 2,
    saved: new Date().toISOString(),
    dirty,
    PL,
    SITES,
    ROADS,
    COUNTIES: COUNTIES.map((c) => ({
      n: c.n,
      si: c.si,
      hq: c.hq,
      g: c.g,
      poly: c.poly,
      geo: c.geo,
    })),
    CTY: DATA.map((d) => d.cty.map((c) => Object.assign({}, c))),
  };
}
function restore(s) {
  if (!s || s.v !== 2 || !Array.isArray(s.PL)) throw new Error("bad file");
  PL.length = 0;
  s.PL.forEach((p) => PL.push(p));
  SITES.length = 0;
  s.SITES.forEach((p) => SITES.push(p));
  ROADS.length = 0;
  s.ROADS.forEach((p) => ROADS.push(p));
  COUNTIES.length = 0;
  s.COUNTIES.forEach((c) => COUNTIES.push(c));
  s.CTY.forEach((l, i) => {
    if (DATA[i]) DATA[i].cty = l;
  });
  dirty = !!s.dirty;
}
$("#aex").onclick = () => {
  const b = new Blob([JSON.stringify(snapshot(), null, 1)], {
      type: "application/json",
    }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = "bioreg-data-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$("#aim").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    restore(JSON.parse(await f.text()));
    refresh();
    admRender();
    toast("Data imported");
  } catch (x) {
    toast("That file is not a BioReg backup");
  }
  e.target.value = "";
};
$("#ars").onclick = async () => {
  if (
    await askConfirm(
      "Reset everything (counties, places, sites, roads) to the original data? Your administrator login is kept.",
      "Reset",
    )
  ) {
    try {
      localStorage.removeItem(SAVEKEY);
    } catch (x) {}
    location.reload();
  }
};

/* ===================== ADDON: administrator sign-in ===================== */
const AUTHK = "bioreg.auth",
  SESSK = "bioreg.sess";
let AUTHED = false,
  AUSER = "",
  lastAct = Date.now(),
  failN = 0,
  lockUntil = 0,
  LGCB = null;
const getAcc = () => {
  try {
    return JSON.parse(localStorage.getItem(AUTHK) || "null");
  } catch (x) {
    return null;
  }
};
function isAuthed() {
  return AUTHED;
}
function sha256(str) {
  const r = (n, x) => (x >>> n) | (x << (32 - n)),
    K2 = [],
    H = [];
  let pc = 0;
  const isP = {};
  for (let c = 2; pc < 64; c++) {
    if (!isP[c]) {
      for (let i = 0; i < 313; i += c) isP[i] = c;
      H[pc] = (Math.pow(c, 0.5) * 4294967296) | 0;
      K2[pc++] = (Math.pow(c, 1 / 3) * 4294967296) | 0;
    }
  }
  const u = unescape(encodeURIComponent(str)),
    L = u.length * 8,
    w = [];
  let s = u + "\x80";
  while ((s.length % 64) - 56) s += "\x00";
  for (let i = 0; i < s.length; i++) {
    const j = i >> 2;
    w[j] = (w[j] || 0) | (s.charCodeAt(i) << (24 - (i % 4) * 8));
  }
  w[w.length] = (L / 4294967296) | 0;
  w[w.length] = L | 0;
  let h = H.slice(0, 8);
  for (let j = 0; j < w.length; ) {
    const W = w.slice(j, (j += 16)),
      o = h.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = W[i - 15],
        w2 = W[i - 2],
        a = h[0],
        e = h[4],
        t1 =
          h[7] +
          (r(6, e) ^ r(11, e) ^ r(25, e)) +
          ((e & h[5]) ^ (~e & h[6])) +
          K2[i] +
          (W[i] =
            i < 16
              ? W[i]
              : (W[i - 16] +
                  (r(7, w15) ^ r(18, w15) ^ (w15 >>> 3)) +
                  W[i - 7] +
                  (r(17, w2) ^ r(19, w2) ^ (w2 >>> 10))) |
                0),
        t2 = (r(2, a) ^ r(13, a) ^ r(22, a)) + ((a & h[1]) ^ (a & h[2]) ^ (h[1] & h[2]));
      h = [(t1 + t2) | 0].concat(h);
      h[4] = (h[4] + t1) | 0;
      h.pop();
    }
    for (let i = 0; i < 8; i++) h[i] = (h[i] + o[i]) | 0;
  }
  return h.map((x) => ("00000000" + (x >>> 0).toString(16)).slice(-8)).join("");
}
const hex = (u8) => [...u8].map((x) => x.toString(16).padStart(2, "0")).join("");
async function hashPw(pw, salt, it, alg) {
  if (alg === "pbkdf2") {
    const enc = new TextEncoder(),
      k = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]),
      b = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          hash: "SHA-256",
          salt: enc.encode(salt),
          iterations: it,
        },
        k,
        256,
      );
    return hex(new Uint8Array(b));
  }
  let h = salt + pw;
  for (let i = 0; i < it; i++) h = sha256(h + salt);
  return h;
}
const newAlg = () =>
  window.crypto && crypto.subtle && window.TextEncoder
    ? {
        alg: "pbkdf2",
        it: 150000,
      }
    : {
        alg: "sha",
        it: 3000,
      };
const rndSalt = () => {
  const a = new Uint8Array(16);
  (
    window.crypto || {
      getRandomValues: (x) => x.forEach((_, i) => (x[i] = Math.random() * 256)),
    }
  ).getRandomValues(a);
  return hex(a);
};
async function mkAcc(u, pw) {
  const g = newAlg(),
    salt = rndSalt();
  return {
    u,
    salt,
    alg: g.alg,
    it: g.it,
    h: await hashPw(pw, salt, g.it, g.alg),
  };
}
async function checkPw(acc, pw) {
  try {
    return (await hashPw(pw, acc.salt, acc.it, acc.alg)) === acc.h;
  } catch (x) {
    return false;
  }
}
function lockUi() {
  const on = !AUTHED;
  ["tEd", "tRd", "tAd", "tAm"].forEach((id) => {
    const b = $("#" + id);
    b && b.classList.toggle("lock", on);
  });
  $("#nAdm").classList.toggle("lock", on);
}
function admUser() {
  const e = $("#asu");
  if (e) e.textContent = "Signed in as " + AUSER;
}
function needAuth(cb) {
  if (AUTHED) {
    lastAct = Date.now();
    cb();
    return;
  }
  openLogin(cb);
}
function openLogin(cb) {
  LGCB = cb;
  const acc = getAcc(),
    setup = !acc;
  $("#lg-t").textContent = setup ? "Create the administrator account" : "Administrator sign in";
  $("#lg-p").textContent = setup
    ? "No account exists yet. Choose a username and a password (at least 8 characters). They are stored in this browser only."
    : "Sign in to edit counties, places, roads and registration sites, or to open the admin page.";
  $("#lg-c").hidden = !setup;
  $("#lg-go").textContent = setup ? "Create account" : "Sign in";
  $("#lg-e").textContent = "";
  $("#lg-u").value = setup || acc.u === "__django__" ? "" : acc.u;
  $("#lg-pw").value = "";
  $("#lg-pw2").value = "";
  $("#lg-show").checked = false;
  $("#lg-pw").type = $("#lg-pw2").type = "password";
  $("#login").hidden = false;
  document.body.classList.add("noscroll");
  ($("#lg-u").value ? $("#lg-pw") : $("#lg-u")).focus();
}
function closeLogin() {
  if (window.__gate && !AUTHED) return;
  $("#login").hidden = true;
  LGCB = null;
  if ($("#adm").hidden && $("#rep").hidden) document.body.classList.remove("noscroll");
}
$("#lg-show").onchange = (e) => {
  $("#lg-pw").type = $("#lg-pw2").type = e.target.checked ? "text" : "password";
};
function signedIn(u) {
  AUTHED = true;
  AUSER = u;
  try {
    sessionStorage.setItem(SESSK, u);
  } catch (x) {}
  lastAct = Date.now();
  failN = 0;
  lockUi();
  admUser();
  const cb = LGCB;
  closeLogin();
  cb && cb();
}
$("#lg-x").onclick = closeLogin;
$("#lg-go").onclick = async () => {
  const err = (m) => ($("#lg-e").textContent = m),
    acc = getAcc(),
    u = $("#lg-u").value.trim(),
    pw = $("#lg-pw").value;
  if (!acc) {
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(u))
      return err("Username: 3–32 letters, digits, dot, dash or underscore.");
    if (pw.length < 8) return err("Password must be at least 8 characters.");
    if (pw !== $("#lg-pw2").value) return err("The two passwords do not match.");
    $("#lg-go").disabled = true;
    try {
      const a = await mkAcc(u, pw);
      localStorage.setItem(AUTHK, JSON.stringify(a));
      signedIn(u);
      toast("Administrator account created");
    } catch (x) {
      err("Could not save the account in this browser.");
    }
    $("#lg-go").disabled = false;
    return;
  }
  const now = Date.now();
  if (now < lockUntil)
    return err("Too many attempts. Try again in " + Math.ceil((lockUntil - now) / 1000) + " s.");
  $("#lg-go").disabled = true;
  const ok = u.toLowerCase() === acc.u.toLowerCase() && (await checkPw(acc, pw));
  $("#lg-go").disabled = false;
  if (ok) return signedIn(acc.u);
  failN++;
  if (failN >= 5) {
    lockUntil = Date.now() + 30000;
    failN = 0;
    err("Too many attempts. Locked for 30 seconds.");
  } else err("Incorrect username or password.");
  $("#lg-pw").value = "";
};
$("#login").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#lg-go").click();
  if (e.key === "Escape") closeLogin();
});
function logout() {
  AUTHED = false;
  AUSER = "";
  try {
    sessionStorage.removeItem(SESSK);
  } catch (x) {}
  if (TOOL) setMode(null);
  closeAdmin();
  lockUi();
  toast("Signed out");
}
$("#alo").onclick = logout;
/* change username / password */
$("#aac").onclick = () => {
  const acc = getAcc();
  $("#ac-u").value = acc ? acc.u : "";
  ["ac-cur", "ac-new", "ac-new2"].forEach((i) => ($("#" + i).value = ""));
  $("#ac-e").textContent = "";
  $("#acct").hidden = false;
  $("#ac-cur").focus();
};
$("#ac-x").onclick = () => ($("#acct").hidden = true);
$("#ac-go").onclick = async () => {
  const err = (m) => ($("#ac-e").textContent = m),
    acc = getAcc(),
    u = $("#ac-u").value.trim(),
    np = $("#ac-new").value;
  if (!(await checkPw(acc, $("#ac-cur").value))) return err("Current password is incorrect.");
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(u))
    return err("Username: 3–32 letters, digits, dot, dash or underscore.");
  if (np && np.length < 8) return err("New password must be at least 8 characters.");
  const a = np
    ? await mkAcc(u, np)
    : Object.assign({}, acc, {
        u,
      });
  localStorage.setItem(AUTHK, JSON.stringify(a));
  AUSER = u;
  try {
    sessionStorage.setItem(SESSK, u);
  } catch (x) {}
  admUser();
  $("#acct").hidden = true;
  toast("Account updated");
};
/* idle lock + restore session */
["mousedown", "keydown", "touchstart"].forEach((t) =>
  document.addEventListener(
    t,
    () => {
      lastAct = Date.now();
    },
    true,
  ),
);
setInterval(() => {
  if (AUTHED && Date.now() - lastAct > 20 * 60000) {
    logout();
    toast("Signed out after 20 minutes of inactivity");
  }
}, 30000);
(function () {
  try {
    const u = sessionStorage.getItem(SESSK),
      a = getAcc();
    if (u && a && a.u === u) {
      AUTHED = true;
      AUSER = u;
    }
  } catch (x) {}
  lockUi();
})();

/* ===================== ADDON: Excel export (report sheets with map + charts; no libraries, works offline) ===================== */
function crc32(u8) {
  if (!crc32.t) {
    crc32.t = [];
    for (let n = 0, c; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc32.t[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < u8.length; i++) c = crc32.t[(c ^ u8[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zipStore(files) {
  const enc = new TextEncoder(),
    parts = [],
    cd = [];
  let off = 0;
  const d = new Date(),
    dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  files.forEach((f) => {
    const nm = enc.encode(f.name),
      data = typeof f.data === "string" ? enc.encode(f.data) : f.data,
      crc = crc32(data),
      lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, 0, true);
    lh.setUint16(10, tm, true);
    lh.setUint16(12, dt, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true);
    lh.setUint16(26, nm.length, true);
    lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), nm, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, tm, true);
    ch.setUint16(14, dt, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true);
    ch.setUint16(28, nm.length, true);
    ch.setUint32(42, off, true);
    cd.push(new Uint8Array(ch.buffer), nm);
    off += 30 + nm.length + data.length;
  });
  let cdSize = 0;
  cd.forEach((p) => (cdSize += p.length));
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, off, true);
  const all = parts.concat(cd, [new Uint8Array(end.buffer)]);
  let n = 0;
  all.forEach((p) => (n += p.length));
  const out = new Uint8Array(n);
  let o = 0;
  all.forEach((p) => {
    out.set(p, o);
    o += p.length;
  });
  return out;
}
const xe = (s) =>
  String(s == null ? "" : s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const colL = (i) => {
  let s = "";
  i++;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
};
const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
/* cell styles: 0 normal,1 header,2 integer,3 title,4 coordinate,5 percent,6 wrap,
   7 banner,8 subtitle,9 section,10 kpi label,11 kpi value,12 kpi value (#,##0),13 note,14 text+border,15 integer+border,16 percent+border,
   17-20 phase pill (n/c, 1, 2, 3),21 total label,22 total integer,23 wrap+border,24 total blank */
const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="' +
  NS_MAIN +
  '"><numFmts count="2"><numFmt numFmtId="164" formatCode="0.000"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts>' +
  '<fonts count="13"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="15"/><name val="Calibri"/></font><font><b/><sz val="20"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF4A5575"/><name val="Calibri"/></font><font><b/><sz val="12"/><color rgb="FF4B5FD6"/><name val="Calibri"/></font><font><b/><sz val="9"/><color rgb="FF6B7592"/><name val="Calibri"/></font><font><b/><sz val="20"/><color rgb="FF16213E"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF16A56D"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFB97800"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFD62F58"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF6B7592"/><name val="Calibri"/></font><font><i/><sz val="9"/><color rgb="FF6B7592"/><name val="Calibri"/></font></fonts>' +
  '<fills count="9"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF16213E"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF7F9FD"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD3F0E3"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFBEBC7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF9D3DC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EBF1"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF1F8"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="4"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="medium"><color rgb="FF4B5FD6"/></bottom><diagonal/></border><border><left style="thin"><color rgb="FFDFE4EF"/></left><right style="thin"><color rgb="FFDFE4EF"/></right><top style="thin"><color rgb="FFDFE4EF"/></top><bottom style="thin"><color rgb="FFDFE4EF"/></bottom><diagonal/></border><border><left/><right/><top style="medium"><color rgb="FF16213E"/></top><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="25">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>' +
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="bottom"/></xf>' +
  '<xf numFmtId="0" fontId="6" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="7" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
  '<xf numFmtId="3" fontId="7" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="12" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
  '<xf numFmtId="3" fontId="0" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="11" fillId="7" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="8" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="9" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="10" fillId="6" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
  '<xf numFmtId="3" fontId="1" fillId="2" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
const XS = {
  ban: 7,
  sub: 8,
  sec: 9,
  kl: 10,
  kv: 11,
  kvn: 12,
  note: 13,
  tx: 14,
  int: 15,
  pct: 16,
  ph: [17, 18, 19, 20],
  tl: 21,
  ti: 22,
  wr: 23,
  tb: 24,
};
/* ---- worksheet xml ---- */
function sheetXml(sh, first) {
  const rows = sh.head ? [sh.head].concat(sh.rows) : sh.rows,
    fm = sh.fmt || [],
    rh = sh.rowH || {};
  let x =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="' +
    NS_MAIN +
    '" xmlns:r="' +
    NS_R +
    '">';
  if (sh.fit) x += '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';
  x += `<sheetViews><sheetView workbookViewId="0"${first ? ' tabSelected="1"' : ""}${sh.head ? "" : ' showGridLines="0"'}>${sh.head ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ""}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>`;
  if (sh.cols)
    x +=
      "<cols>" +
      sh.cols
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join("") +
      "</cols>";
  x += "<sheetData>";
  const nR = Math.max(rows.length, ...Object.keys(rh).map((k) => +k + 1), 0);
  for (let ri = 0; ri < nR; ri++) {
    const r = rows[ri] || [],
      h = rh[ri] != null ? rh[ri] : sh.head && ri === 0 ? 29 : null;
    if (!r.length && h == null) continue;
    x += `<row r="${ri + 1}"${h != null ? ` ht="${(h * 0.75).toFixed(2)}" customHeight="1"` : ""}>`;
    for (let ci = 0; ci < r.length; ci++) {
      const v = r[ci],
        isH = sh.head && ri === 0,
        sty = isH
          ? 1
          : sh.styles && sh.styles[ri] && sh.styles[ri][ci] != null
            ? sh.styles[ri][ci]
            : fm[ci] || 0,
        ref = colL(ci) + (ri + 1);
      if (v === null || v === undefined || v === "") {
        if (sty && sh.styles && sh.styles[ri] && sh.styles[ri][ci] != null)
          x += `<c r="${ref}" s="${sty}"/>`;
        continue;
      }
      if (typeof v === "number" && isFinite(v)) x += `<c r="${ref}" s="${sty}"><v>${v}</v></c>`;
      else
        x += `<c r="${ref}" s="${sty}" t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
    }
    x += "</row>";
  }
  x += "</sheetData>";
  if (sh.head && sh.rows.length)
    x += `<autoFilter ref="A1:${colL(sh.head.length - 1)}${rows.length}"/>`;
  if (sh.merges && sh.merges.length)
    x +=
      `<mergeCells count="${sh.merges.length}">` +
      sh.merges
        .map((m) => `<mergeCell ref="${colL(m[1])}${m[0] + 1}:${colL(m[3])}${m[2] + 1}"/>`)
        .join("") +
      "</mergeCells>";
  x += '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>';
  if (sh.fit)
    x += '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>';
  if (sh.hasDrawing) x += '<drawing r:id="rId1"/>';
  return x + "</worksheet>";
}
/* ---- native charts (DrawingML) ---- */
const sref = (sheet, c, r1, r2) =>
  `'${sheet.replace(/'/g, "''")}'!$${colL(c)}$${r1 + 1}:$${colL(c)}$${r2 + 1}`;
const strC = (a) =>
    `<c:strCache><c:ptCount val="${a.length}"/>${a.map((v, i) => `<c:pt idx="${i}"><c:v>${xe(v)}</c:v></c:pt>`).join("")}</c:strCache>`,
  numC = (a) =>
    `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${a.length}"/>${a.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join("")}</c:numCache>`;
function chartXml(o) {
  const n = o.cats.length,
    dpt = o.cols
      .map(
        (c, i) =>
          `<c:dPt><c:idx val="${i}"/>${o.type === "bar" ? '<c:invertIfNegative val="0"/>' : ""}<c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${c}"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`,
      )
      .join("");
  const lbl = `<c:dLbls><c:numFmt formatCode="${o.type === "bar" ? "#,##0" : "0;;;"}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900" b="1"/></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>${o.type === "bar" ? '<c:dLblPos val="outEnd"/>' : ""}<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`;
  const cat = `<c:cat><c:strRef><c:f>${xe(sref(o.sheet, o.cc, o.r1, o.r2))}</c:f>${strC(o.cats)}</c:strRef></c:cat>`,
    val = `<c:val><c:numRef><c:f>${xe(sref(o.sheet, o.vc, o.r1, o.r2))}</c:f>${numC(o.vals)}</c:numRef></c:val>`;
  const ser = `<c:ser><c:idx val="0"/><c:order val="0"/><c:spPr><a:solidFill><a:srgbClr val="4B5FD6"/></a:solidFill></c:spPr>${o.type === "bar" ? '<c:invertIfNegative val="0"/>' : ""}${dpt}${lbl}${cat}${val}</c:ser>`;
  const plot =
    o.type === "bar"
      ? `<c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/><c:varyColors val="0"/>${ser}<c:gapWidth val="60"/><c:axId val="111111"/><c:axId val="222222"/></c:barChart><c:catAx><c:axId val="111111"/><c:scaling><c:orientation val="maxMin"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="C3CADA"/></a:solidFill></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"/></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr><c:crossAx val="222222"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx><c:valAx><c:axId val="222222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="1"/><c:axPos val="t"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="111111"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`
      : `<c:doughnutChart><c:varyColors val="1"/>${ser}<c:firstSliceAng val="0"/><c:holeSize val="58"/></c:doughnutChart>`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="' +
    NS_R +
    '"><c:roundedCorners val="0"/><c:chart>' +
    `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100" b="1"/></a:pPr><a:r><a:rPr lang="en-US" sz="1100" b="1"/><a:t>${xe(o.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot}</c:plotArea>` +
    (o.type === "bar" ? "" : '<c:legend><c:legendPos val="r"/><c:overlay val="0"/></c:legend>') +
    '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="DFE4EF"/></a:solidFill></a:ln></c:spPr></c:chartSpace>'
  );
}
const EMU = 9525,
  anchor = (col, row, w, h, inner) =>
    `<xdr:oneCellAnchor><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="${Math.round(w * EMU)}" cy="${Math.round(h * EMU)}"/>${inner}<xdr:clientData/></xdr:oneCellAnchor>`;
/* ---- package ---- */
function xlsxBytes(sheets) {
  const f = [],
    charts = [],
    media = [],
    ct = [];
  let drN = 0;
  sheets.forEach((s, i) => {
    const items = [],
      rels = [];
    let id = 1;
    (s.imgs || []).forEach((m) => {
      if (!m.png) return;
      media.push(m.png);
      const mi = media.length,
        rid = "rId" + (rels.length + 1);
      rels.push(
        `<Relationship Id="${rid}" Type="${NS_R}/image" Target="../media/image${mi}.png"/>`,
      );
      id++;
      items.push(
        anchor(
          m.col,
          m.row,
          m.w,
          m.h,
          `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id}" name="Map ${mi}" descr="Map"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="${NS_R}" r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${Math.round(m.w * EMU)}" cy="${Math.round(m.h * EMU)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>`,
        ),
      );
    });
    (s.charts || []).forEach((c) => {
      charts.push(
        chartXml(
          Object.assign(
            {
              sheet: s.name,
            },
            c,
          ),
        ),
      );
      const ci = charts.length,
        rid = "rId" + (rels.length + 1);
      rels.push(
        `<Relationship Id="${rid}" Type="${NS_R}/chart" Target="../charts/chart${ci}.xml"/>`,
      );
      id++;
      items.push(
        anchor(
          c.col,
          c.row,
          c.w,
          c.h,
          `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id}" name="Chart ${ci}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="${NS_R}" r:id="${rid}"/></a:graphicData></a:graphic></xdr:graphicFrame>`,
        ),
      );
    });
    s.hasDrawing = items.length > 0;
    if (s.hasDrawing) {
      drN++;
      s._dr = drN;
      f.push(
        {
          name: `xl/drawings/drawing${drN}.xml`,
          data:
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
            items.join("") +
            "</xdr:wsDr>",
        },
        {
          name: `xl/drawings/_rels/drawing${drN}.xml.rels`,
          data:
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            rels.join("") +
            "</Relationships>",
        },
        {
          name: `xl/worksheets/_rels/sheet${i + 1}.xml.rels`,
          data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_R}/drawing" Target="../drawings/drawing${drN}.xml"/></Relationships>`,
        },
      );
      ct.push(
        `<Override PartName="/xl/drawings/drawing${drN}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
      );
    }
  });
  charts.forEach((c, i) => {
    f.push({
      name: `xl/charts/chart${i + 1}.xml`,
      data: c,
    });
    ct.push(
      `<Override PartName="/xl/charts/chart${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
    );
  });
  media.forEach((m, i) =>
    f.push({
      name: `xl/media/image${i + 1}.png`,
      data: m,
    }),
  );
  const head = [
    {
      name: "[Content_Types].xml",
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets
          .map(
            (s, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join("") +
        ct.join("") +
        "</Types>",
    },
    {
      name: "_rels/.rels",
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' +
        NS_R +
        '/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: "xl/workbook.xml",
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="' +
        NS_MAIN +
        '" xmlns:r="' +
        NS_R +
        '"><sheets>' +
        sheets
          .map((s, i) => `<sheet name="${xe(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join("") +
        "</sheets></workbook>",
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets
          .map(
            (s, i) =>
              `<Relationship Id="rId${i + 1}" Type="${NS_R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join("") +
        `<Relationship Id="rId${sheets.length + 1}" Type="${NS_R}/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: "xl/styles.xml",
      data: STYLES,
    },
  ];
  sheets.forEach((s, i) =>
    head.push({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: sheetXml(s, i === 0),
    }),
  );
  return zipStore(head.concat(f));
}
/* ---- report sheet builder ---- */
const plain = (t) =>
  String(t)
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&");
const snm = (n, used) => {
  let b = n.replace(/[\\\/\?\*\[\]:]/g, "-").slice(0, 31),
    k = b,
    i = 2;
  while (used.has(k.toLowerCase())) k = b.slice(0, 28) + " " + i++;
  used.add(k.toLowerCase());
  return k;
};
function mkSheet(name, cols) {
  const S = {
    name,
    cols,
    rows: [],
    styles: {},
    merges: [],
    rowH: {},
    imgs: [],
    charts: [],
    fit: true,
    hasDrawing: false,
  };
  S.put = (r, c, v, st) => {
    (S.rows[r] = S.rows[r] || [])[c] = v == null ? "" : v;
    if (st != null) (S.styles[r] = S.styles[r] || [])[c] = st;
  };
  S.span = (r, c1, c2, v, st, h) => {
    for (let c = c1; c <= c2; c++) S.put(r, c, c === c1 ? v : "", st);
    if (c2 > c1) S.merges.push([r, c1, r, c2]);
    if (h) S.rowH[r] = h;
  };
  S.rh = (r, h) => {
    S.rows[r] = S.rows[r] || [];
    S.rowH[r] = h;
  };
  return S;
}
const LINE = 20;
function xlFill(S, r, svgInfo, opts) {
  /* picture placeholder rows */ const rows = Math.ceil(svgInfo.h / LINE) + 1;
  return r + rows;
}
function repHead(S, r, title, sub, meta, last) {
  S.span(r, 0, last, title, XS.ban, 38);
  S.span(r + 1, 0, last, sub, XS.sub, 22);
  S.span(r + 2, 0, last, meta, XS.note, 18);
  return r + 4;
}
function repKpis(S, r, items) {
  S.rh(r, 26);
  S.rh(r + 1, 40);
  items.forEach(([l, v], i) => {
    S.put(r, i, l, XS.kl);
    S.put(r + 1, i, v, typeof v === "number" ? XS.kvn : XS.kv);
  });
  return r + 3;
}
function repSec(S, r, t, last) {
  S.span(r, 0, last, t, XS.sec, 26);
  return r + 1;
}
function repBullets(S, r, list, last, w) {
  list.forEach((t) => {
    const tx = "•  " + plain(t),
      lines = Math.max(1, Math.ceil(tx.length / (w || 175)));
    S.span(r, 0, last, tx, XS.wr === undefined ? 6 : 6, lines * 18 + 6);
    r++;
  });
  return r;
}
function repMapImg(S, r, svg, wpx) {
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/),
    W = +m[1],
    H = +m[2],
    h = Math.round((wpx * H) / W);
  S.imgs.push({
    svg,
    col: 0,
    row: r,
    w: wpx,
    h,
    k: Math.min(2, 2400 / W),
  });
  return r + Math.ceil(h / LINE) + 1;
}
function metaLine() {
  return (
    "Report date " +
    new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }) +
    (REP.by ? " · Prepared by " + REP.by : "") +
    (REP.org ? " · " + REP.org : "") +
    " · " +
    REP.cls
  );
}
function xlNational(used) {
  const S = mkSheet(snm("National", used), [28, 16, 16, 20, 18, 22, 14, 40]),
    L = 7;
  let r = repHead(
    S,
    0,
    "BM Monitor — National Registration Report",
    "South Sudan · security, access and workforce across all states and administrative areas",
    metaLine(),
    L,
  );
  const ph = [0, 0, 0, 0];
  DATA.forEach((d) => d.cty.forEach((c) => ph[c.ph || 0]++));
  const srt = DATA.map((d, i) => ({
    d,
    i,
  })).sort((a, b) => b.d.t - a.d.t);
  r = repKpis(S, r, [
    ["GOVT EMPLOYEES", SUMMARY.emp],
    ["STATES & AREAS", DATA.length],
    ["COUNTIES / LOCATIONS", SUMMARY.cty],
    ["SAFE & ACCESSIBLE", SUMMARY.ok],
    ["UNSAFE / INACCESSIBLE", SUMMARY.bad],
    ["REGISTRATION SITES", SITES.length],
  ]);
  r = repSec(S, r, "Key findings", L);
  r =
    repBullets(
      S,
      r,
      [
        `<b>${SUMMARY.emp.toLocaleString("en-US")}</b> government employees are to be registered across <b>${SUMMARY.cty}</b> counties / locations in ${DATA.length} states and administrative areas.`,
        `${SUMMARY.ok} locations (${Math.round((SUMMARY.ok / SUMMARY.cty) * 100)}%) are safe and accessible; ${SUMMARY.bad} are unsafe or inaccessible.`,
        `Phase 3 high-risk areas: ${
          DATA.filter((d) => d.ph == 3)
            .map((d) => d.n)
            .join(", ") || "none"
        }. Largest workforce: ${srt[0].d.n} (${srt[0].d.t.toLocaleString("en-US")}).`,
      ],
      L,
    ) + 1;
  r = repSec(S, r, "Map", L);
  S.imgs.length;
  r = repMapImg(
    S,
    r,
    repMap(null, {
      w: 900,
    }),
    980,
  );
  r = repSec(S, r, "Security phase of locations", L);
  const pr = r;
  S.put(r, 0, "Security phase", 1);
  S.put(r, 1, "Locations", 1);
  [
    ["Phase 1 · Low risk", ph[1]],
    ["Phase 2 · Risk", ph[2]],
    ["Phase 3 · High risk", ph[3]],
    ["Not classified", ph[0]],
  ].forEach((x, i) => {
    S.put(r + 1 + i, 0, x[0], XS.tx);
    S.put(r + 1 + i, 1, x[1], XS.int);
  });
  S.charts.push({
    type: "donut",
    title: "Security phase of locations",
    col: 3,
    row: pr,
    w: 420,
    h: 240,
    cc: 0,
    vc: 1,
    r1: pr + 1,
    r2: pr + 4,
    cats: ["Phase 1 · Low risk", "Phase 2 · Risk", "Phase 3 · High risk", "Not classified"],
    vals: [ph[1], ph[2], ph[3], ph[0]],
    cols: ["16A56D", "E29A0B", "D62F58", "8B95A7"],
  });
  r = pr + 13;
  r = repSec(S, r, "States and administrative areas", L);
  const tr = r;
  [
    "State / area",
    "Region",
    "Employees",
    "Counties",
    "Safe & accessible",
    "Unsafe",
    "Security phase",
  ].forEach((h, i) => S.put(r, i, h, 1));
  S.rh(r, 28);
  srt.forEach(({ d }, i) => {
    const c = cstat(d),
      y = r + 1 + i;
    S.put(y, 0, d.n, XS.tx);
    S.put(y, 1, d.rg, XS.tx);
    S.put(y, 2, d.t, XS.int);
    S.put(y, 3, d.cty.length, XS.int);
    S.put(y, 4, c.ok, XS.int);
    S.put(y, 5, c.bad, XS.int);
    S.put(y, 6, PHN[d.ph || 0].replace(/ ·.*/, ""), XS.ph[d.ph || 0]);
  });
  const y = r + 1 + srt.length;
  S.put(y, 0, "Total", XS.tl);
  S.put(y, 1, "", XS.tb);
  S.put(y, 2, SUMMARY.emp, XS.ti);
  S.put(y, 3, SUMMARY.cty, XS.ti);
  S.put(y, 4, SUMMARY.ok, XS.ti);
  S.put(y, 5, SUMMARY.bad, XS.ti);
  S.put(y, 6, "", XS.tb);
  S.charts.push({
    type: "bar",
    title: "Govt employees by state",
    col: 0,
    row: y + 2,
    w: 760,
    h: 340,
    cc: 0,
    vc: 2,
    r1: tr + 1,
    r2: tr + srt.length,
    cats: srt.map((x) => SH[x.d.n] || x.d.n),
    vals: srt.map((x) => x.d.t),
    cols: srt.map((x) => RC[x.d.ph || 0].slice(1)),
  });
  S.rows[y + 2 + Math.ceil(340 / LINE) + 1] = [];
  return S;
}
function xlState(si, used, sec) {
  const F = stFacts(si),
    { d, c, n, ph, roads, sites, air, top } = F,
    S = mkSheet(snm(used.has("report") ? d.n : d.n, used), [28, 16, 14, 20, 18, 22, 12, 58]),
    L = 7;
  let r = repHead(
    S,
    0,
    "BM Monitor — " + d.n,
    (d.admin ? "Administrative area" : "State") +
      " registration report · " +
      d.rg +
      " region · HQ " +
      d.hq +
      " · " +
      PHN[d.ph || 0],
    metaLine(),
    L,
  );
  r = repKpis(S, r, [
    ["GOVT EMPLOYEES", d.t],
    ["COUNTIES / LOCATIONS", n],
    ["SAFE & ACCESSIBLE", c.ok],
    ["UNSAFE / INACCESSIBLE", c.bad],
    ["REGISTRATION SITES", sites.length],
    ["AIRPORTS", air.length],
  ]);
  r = repSec(S, r, "Key findings", L);
  r = repBullets(S, r, stNarr(si), L);
  const rc = recoList(d);
  if (rc.length) {
    r++;
    r = repSec(S, r, "Main recommendations", L);
    r = repBullets(
      S,
      r,
      rc.map(([t, k]) => t + " (" + k + " location" + (k > 1 ? "s" : "") + ")"),
      L,
    );
  }
  r++;
  r = repSec(S, r, "Map — counties shaded by security phase", L);
  r = repMapImg(
    S,
    r,
    repMap(si, {
      w: 900,
    }),
    980,
  );
  r = repSec(S, r, "Charts", L);
  const tp = r;
  S.put(r, 0, "Security phase", 1);
  S.put(r, 1, "Locations", 1);
  [
    ["Phase 1 · Low risk", ph[1]],
    ["Phase 2 · Risk", ph[2]],
    ["Phase 3 · High risk", ph[3]],
    ["Not classified", ph[0]],
  ].forEach((x, i) => {
    S.put(r + 1 + i, 0, x[0], XS.tx);
    S.put(r + 1 + i, 1, x[1], XS.int);
  });
  S.put(r, 3, "Planned access", 1);
  S.put(r, 4, "Locations", 1);
  [
    ["By air", c.air],
    ["By road", c.road],
    ["By river", c.river],
    ["Needs further discussion", c.bad],
  ].forEach((x, i) => {
    S.put(r + 1 + i, 3, x[0], XS.tx);
    S.put(r + 1 + i, 4, x[1], XS.int);
  });
  const ch = r + 6;
  S.charts.push({
    type: "donut",
    title: "Security phase of locations",
    col: 0,
    row: ch,
    w: 420,
    h: 260,
    cc: 0,
    vc: 1,
    r1: tp + 1,
    r2: tp + 4,
    cats: ["Phase 1 · Low risk", "Phase 2 · Risk", "Phase 3 · High risk", "Not classified"],
    vals: [ph[1], ph[2], ph[3], ph[0]],
    cols: ["16A56D", "E29A0B", "D62F58", "8B95A7"],
  });
  S.charts.push({
    type: "bar",
    title: "Planned access",
    col: 3,
    row: ch,
    w: 430,
    h: 260,
    cc: 3,
    vc: 4,
    r1: tp + 1,
    r2: tp + 4,
    cats: ["By air", "By road", "By river", "Needs further discussion"],
    vals: [c.air, c.road, c.river, c.bad],
    cols: ["0B5ED7", "B45309", "3A9AD0", "D62F58"],
  });
  r = ch + Math.ceil(260 / LINE) + 2;
  r = repSec(S, r, "County data", L);
  const hr = r;
  [
    "County / location",
    "Employees",
    "% of state",
    "Security",
    "Safety",
    "Access",
    "Transport",
    "Remarks / recommendation",
  ].forEach((h, i) => S.put(r, i, h, 1));
  S.rh(r, 28);
  top.forEach((x, i) => {
    const y = r + 1 + i,
      tx = [x.rm, x.rc].filter(Boolean).join(" — ");
    S.put(y, 0, x.n, XS.tx);
    S.put(y, 1, x.e || 0, XS.int);
    S.put(y, 2, d.t ? (x.e || 0) / d.t : 0, XS.pct);
    S.put(y, 3, x.ph ? "Phase " + x.ph : "n/c", XS.ph[x.ph || 0]);
    S.put(y, 4, x.sf || "—", XS.tx);
    S.put(y, 5, x.ac || "—", XS.tx);
    S.put(y, 6, x.md || "—", XS.tx);
    S.put(y, 7, tx, XS.wr);
    if (tx.length > 62) S.rh(y, Math.ceil(tx.length / 62) * 17 + 4);
  });
  let y = r + 1 + top.length;
  S.put(y, 0, "Total", XS.tl);
  S.put(y, 1, d.t, XS.ti);
  S.put(y, 2, "100%", XS.tb);
  for (let k = 3; k <= 7; k++) S.put(y, k, "", XS.tb);
  const nb = Math.min(8, top.length),
    t8 = top.slice(0, nb);
  S.charts.push({
    type: "bar",
    title: "Largest workforces",
    col: 6,
    row: ch,
    w: 520,
    h: 260,
    cc: 0,
    vc: 1,
    r1: hr + 1,
    r2: hr + nb,
    cats: t8.map((x) => x.n),
    vals: t8.map((x) => x.e || 0),
    cols: t8.map((x) => RC[x.ph || 0].slice(1)),
  });
  r = y + 2;
  r = repSec(S, r, "Roads, airports and key places", L);
  S.put(r, 0, "Airports", 1);
  S.put(r, 1, "", 1);
  air.forEach((p, i) => S.put(r + 1 + i, 0, p[0], XS.tx));
  if (!air.length) S.put(r + 1, 0, "None recorded on the map", XS.note);
  S.put(r, 3, "Road", 1);
  S.put(r, 4, "Type", 1);
  S.put(r, 5, "km in area", 1);
  const rl = roads
    .filter((x) => x.r.src != "UN")
    .concat(roads.filter((x) => x.r.src == "UN").slice(0, 8))
    .slice(0, 14);
  rl.forEach((x, i) => {
    S.put(r + 1 + i, 3, x.r.name, XS.tx);
    S.put(
      r + 1 + i,
      4,
      {
        main: "Main",
        secondary: "Secondary",
        track: "Track",
      }[x.r.type] || "",
      XS.tx,
    );
    S.put(r + 1 + i, 5, Math.round(x.km), XS.int);
  });
  r += Math.max(air.length, rl.length, 1) + 2;
  const places = F.m.cities.concat(F.m.towns.slice(0, 18)).join(", ");
  if (places) {
    S.span(r, 0, L, "Cities and towns: " + places, XS.wr, Math.ceil(places.length / 170) * 18 + 10);
    r += 2;
  }
  r = repSec(S, r, "Registration sites", L);
  ["Site", "County", "Status", "Govt Employees", "Note"].forEach((h, i) => S.put(r, i, h, 1));
  S.rh(r, 26);
  sites.forEach((s, i) => {
    const cc = cntyNear(s.lon, s.lat, si),
      yy = r + 1 + i;
    S.put(yy, 0, s.name, XS.tx);
    S.put(yy, 1, cc ? cc.n : "—", XS.tx);
    S.put(yy, 2, s.status, XS.tx);
    S.put(yy, 3, s.cap || 0, XS.int);
    S.put(yy, 4, s.note || "", XS.tx);
  });
  if (!sites.length)
    S.put(r + 1, 0, "No registration sites have been added for this area yet.", XS.note);
  r += Math.max(sites.length, 1) + 2;
  r = repSec(S, r, "Notes", L);
  r = repBullets(
    S,
    r,
    [
      "Source: Distribution of States and Administrative Areas by Regions (government employees, security phase, safety and accessibility by county / location).",
      "Map: state outlines, rivers, roads and towns are traced from UN Geospatial map no. 4450 (July 2020). County areas are indicative zones around each county headquarters, not official boundaries.",
      "Security phases: Phase 1 low risk, Phase 2 risk, Phase 3 high risk. “Safe & accessible” counts Phase 1 and 2 locations.",
    ],
    L,
  );
  S.rows[r] = [];
  return S;
}
/* ---- data sheets ---- */
function xlData(scope) {
  const nat = scope === "nat" || scope === "all",
    si = nat ? null : +scope,
    list = nat ? DATA.map((d, i) => i) : [si],
    inS = (lo, la) => (nat ? stAt(lo, la) >= 0 : inPoly(lo, la, DATA[si].poly)),
    cts = list.flatMap((i) =>
      DATA[i].cty.map((c) => ({
        c,
        d: DATA[i],
        i,
      })),
    ),
    sites = SITES.filter((s) => inS(s.lon, s.lat)),
    places = PL.filter((p) => inS(p[1], p[2])),
    S = [];
  if (nat)
    S.push({
      name: "States",
      head: [
        "State / area",
        "Type",
        "Region",
        "HQ",
        "Govt employees",
        "Counties",
        "Safe & accessible",
        "Unsafe",
        "Security phase",
        "Safety",
        "Access",
      ],
      cols: [28, 16, 16, 16, 16, 11, 16, 10, 24, 18, 20],
      fmt: [0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0],
      rows: DATA.map((d) => {
        const c = cstat(d);
        return [
          d.n,
          d.admin ? "Administrative area" : "State",
          d.rg,
          d.hq,
          d.t,
          d.cty.length,
          c.ok,
          c.bad,
          PHN[d.ph || 0],
          d.sf,
          d.ac,
        ];
      }),
    });
  S.push({
    name: "Counties",
    head: [
      "State / area",
      "County / location",
      "Govt employees",
      "% of state",
      "Security phase",
      "Safety",
      "Access",
      "Transport",
      "Remarks",
      "Recommendation",
      "HQ longitude (WGS84)",
      "HQ latitude (WGS84)",
    ],
    cols: [24, 24, 16, 11, 22, 16, 20, 12, 48, 48, 13, 13],
    fmt: [0, 0, 2, 5, 0, 0, 0, 0, 6, 6, 4, 4],
    rows: cts
      .slice()
      .sort((a, b) => a.i - b.i || b.c.e - a.c.e)
      .map(({ c, d, i }) => {
        const C = COUNTIES.find((x) => x.si === i && x.n === c.n);
        return [
          d.n,
          c.n,
          c.e || 0,
          d.t ? (c.e || 0) / d.t : 0,
          PHN[c.ph || 0],
          c.sf || "",
          c.ac || "",
          c.md || "",
          c.rm || "",
          c.rc || "",
          C ? cGeo(C)[0] : "",
          C ? cGeo(C)[1] : "",
        ];
      }),
  });
  S.push({
    name: "Cities & airports",
    head: ["Name", "Type", "Airport", "State / area", "Nearest county", "Longitude", "Latitude"],
    cols: [26, 16, 10, 26, 24, 12, 12],
    fmt: [0, 0, 0, 0, 0, 4, 4],
    rows: places.map((p) => {
      const s2 = stAt(p[1], p[2]),
        c = s2 >= 0 ? cntyNear(p[1], p[2], s2) : null;
      return [
        p[0],
        TYN[p[3]],
        p[4] ? "Yes" : "",
        s2 >= 0 ? DATA[s2].n : "",
        c ? c.n : "",
        toGeo(p[1], p[2])[0],
        toGeo(p[1], p[2])[1],
      ];
    }),
  });
  S.push({
    name: "Registration sites",
    head: [
      "Site",
      "Reports",
      "Status",
      "Govt Employees",
      "Capacity/Day",
      "State / area",
      "County",
      "Note",
      "Longitude",
      "Latitude",
    ],
    cols: [28, 24, 12, 16, 14, 26, 24, 12, 12, 12],
    fmt: [0, 0, 0, 2, 2, 0, 0, 0, 4, 4],
    rows: sites.map((s) => {
      const s2 = stAt(s.lon, s.lat),
        c = s2 >= 0 ? cntyNear(s.lon, s.lat, s2) : null;
      return [
        s.name,
        s.mda || "",
        s.status,
        s._excelKey ? s.cap || 0 : "",
        s._excelKey ? "" : s.cap || 0,
        s2 >= 0 ? DATA[s2].n : "",
        c ? c.n : "",
        s._excelKey ? "-" : s.note || "-",
        sGeo(s)[0],
        sGeo(s)[1],
      ];
    }),
  });
  const rd = ROADS.map((r) => ({
    r,
    km: nat ? lenKm(r.pts) : lenIn([r.pts], DATA[si].poly),
  })).filter((x) => x.km > 0.5);
  S.push({
    name: "Roads",
    head: ["Road", "Type", "From", "To", nat ? "Length (km)" : "Length in area (km)", "Source"],
    cols: [34, 18, 20, 20, 18, 12],
    fmt: [0, 0, 0, 0, 2, 0],
    rows: rd.map(({ r, km }) => [
      r.name,
      {
        main: "Main road",
        secondary: "Secondary",
        track: "Track / seasonal",
      }[r.type] || r.type,
      r.from || "",
      r.to || "",
      Math.round(km),
      r.src == "UN" ? "UN map" : "Drawn",
    ]),
  });
  return S;
}
function xlSheets(scope) {
  const used = new Set(),
    out = [];
  const picked = countyScopeParts(scope);
  if (picked) {
    const sites = countySites(picked.si, picked.county),
      rows = sites.map((site) => [
        site.name || "",
        site.mda || "",
        site.status || "",
        site.cap == null ? "" : site.cap,
        picked.state.n,
        picked.county.n,
        site.note || "-",
        sGeo(site)[0],
        sGeo(site)[1],
      ]);
    out.push({
      name: snm(picked.county.n + " Report", used),
      head: [
        "Registration site",
        "Institution / MDA",
        "Status",
        "Government employees",
        "State / area",
        "County",
        "Note",
        "Longitude",
        "Latitude",
      ],
      cols: [30, 30, 16, 22, 28, 22, 36, 14, 14],
      fmt: [0, 0, 0, 2, 0, 0, 0, 4, 4],
      rows,
    });
    return out;
  }
  if (scope === "nat") out.push(xlNational(used));
  else if (scope === "all") {
    out.push(xlNational(used));
    DATA.forEach((d, i) => out.push(xlState(i, used)));
  } else out.push(xlState(+scope, used));
  xlData(scope).forEach((s) => {
    s.name = snm(s.name, used);
    out.push(s);
  });
  return out;
}
/* ---- svg -> png for the map picture ---- */
function svgToPng(svg, k) {
  return new Promise((res) => {
    try {
      const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/),
        W = +m[1],
        H = +m[2],
        s2 = svg.replace('width="100%"', `width="${W}" height="${H}"`),
        im = new Image();
      im.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = Math.round(W * k);
          c.height = Math.round(H * k);
          const g = c.getContext("2d");
          g.fillStyle = "#fff";
          g.fillRect(0, 0, c.width, c.height);
          g.drawImage(im, 0, 0, c.width, c.height);
          c.toBlob(
            (b) => (b ? b.arrayBuffer().then((a) => res(new Uint8Array(a))) : res(null)),
            "image/png",
          );
        } catch (e) {
          res(null);
        }
      };
      im.onerror = () => res(null);
      im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s2);
    } catch (e) {
      res(null);
    }
  });
}
async function xlBuild(scope) {
  const sheets = xlSheets(scope);
  for (const s of sheets) for (const m of s.imgs || []) m.png = await svgToPng(m.svg, m.k);
  return xlsxBytes(sheets);
}
async function exportXlsx(scope) {
  toast("Preparing the Excel report…");
  try {
    const bytes = await xlBuild(scope),
      b = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      a = document.createElement("a"),
      picked = countyScopeParts(scope),
      nm =
        scope === "nat"
          ? "National"
          : scope === "all"
            ? "All-states"
            : picked
              ? picked.county.n.replace(/[^A-Za-z0-9]+/g, "-") + "-County"
              : DATA[+scope].n.replace(/[^A-Za-z0-9]+/g, "-");
    a.href = URL.createObjectURL(b);
    a.download = "BioReg-" + nm + "-" + new Date().toISOString().slice(0, 10) + ".xlsx";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast("Excel report downloaded");
  } catch (x) {
    console.error(x);
    toast("Could not create the Excel file");
  }
}

/* ===================== ADDON C: professional report / PDF ===================== */
const RC = ["#C5A059", "#16a56d", "#e29a0b", "#d62f58"],
  RTINT = ["#eaecef", "#d3f0e3", "#fbebc7", "#f9d3dc"],
  RINK = "#2F353B";
const REP = {
  by: "",
  org: "",
  cls: "Internal",
  title: "",
};
try {
  Object.assign(REP, JSON.parse(localStorage.getItem("bioreg.rep") || "{}"));
} catch (x) {}
const rep$ = (s) => document.querySelector(s);
function openRepDlg() {
  const sel = rep$("#rd-sc");
  sel.innerHTML =
    `<option value="nat">National overview</option>` +
    DATA.map((d, i) => `<option value="${i}">${esc(d.n)}</option>`).join("") +
    `<option value="all">All states — full report (one chapter each)</option><optgroup label="County reports">` +
    DATA.flatMap((d, si) =>
      d.cty.map(
        (c, ci) => `<option value="county:${si}:${ci}">${esc(c.n)} County — ${esc(d.n)}</option>`,
      ),
    ).join("") +
    `</optgroup>`;
  sel.value =
    selC && view !== null
      ? (() => {
          const si = view,
            ci = DATA[si].cty.findIndex((c) => K(c.n) === K(selC));
          return ci >= 0 ? `county:${si}:${ci}` : String(view);
        })()
      : view !== null
        ? String(view)
        : "nat";
  rep$("#rd-by").value = REP.by;
  rep$("#rd-org").value = REP.org;
  rep$("#rd-cls").value = REP.cls;
  rep$("#rd-ti").value = "";
  rep$("#rdlg").hidden = false;
}
document.querySelectorAll("#rdlg [data-pre]").forEach(
  (b) =>
    (b.onclick = () => {
      const p = b.dataset.pre,
        on =
          p == "full"
            ? ["cover", "sum", "map", "chart", "table", "infra", "sites", "analysis", "notes"]
            : p == "an"
              ? ["cover", "analysis"]
              : p == "map"
                ? ["map"]
                : ["sum", "table", "infra", "sites"];
      document.querySelectorAll("#rdlg .rs").forEach((c) => (c.checked = on.includes(c.value)));
    }),
);
rep$("#rd-x").onclick = () => (rep$("#rdlg").hidden = true);
rep$("#rd-xl").onclick = () => {
  rep$("#rdlg").hidden = true;
  exportXlsx(rep$("#rd-sc").value);
};
rep$("#rd-go").onclick = () => {
  const sec = {};
  document.querySelectorAll("#rdlg .rs").forEach((c) => (sec[c.value] = c.checked));
  Object.assign(REP, {
    by: rep$("#rd-by").value.trim(),
    org: rep$("#rd-org").value.trim(),
    cls: rep$("#rd-cls").value,
    title: rep$("#rd-ti").value.trim(),
  });
  try {
    localStorage.setItem(
      "bioreg.rep",
      JSON.stringify({
        by: REP.by,
        org: REP.org,
        cls: REP.cls,
      }),
    );
  } catch (x) {}
  if (!Object.values(sec).some(Boolean)) {
    toast("Tick at least one section");
    return;
  }
  rep$("#rdlg").hidden = true;
  showReport(rep$("#rd-sc").value, sec);
};
rep$("#nRep").onclick = (e) => {
  e.preventDefault();
  openRepDlg();
};
const cpRep = rep$("#rpt");
if (cpRep) cpRep.onclick = () => openRepDlg();

/* ---- map figure (vector SVG, print safe) ---- */
function mkLab(W, H) {
  const B = [],
    hit = (b) => B.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  return {
    res(x, y, r) {
      B.push([x - r, y - r, x + r, y + r]);
    },
    put(x, y, txt, fs, wt, off, col) {
      const w = txt.length * fs * 0.56;
      const cand = [
        [x + off, y + fs * 0.35, "start"],
        [x - off, y + fs * 0.35, "end"],
        [x, y - off - 2, "middle"],
        [x, y + off + fs, "middle"],
      ];
      for (const [tx, ty, an] of cand) {
        const bx = an == "start" ? tx : an == "end" ? tx - w : tx - w / 2,
          b = [bx - 1, ty - fs, bx + w + 1, ty + 3];
        if (b[0] < 2 || b[2] > W - 2 || b[1] < 2 || b[3] > H - 2 || hit(b)) continue;
        B.push(b);
        return `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${an}" font-size="${fs}" font-weight="${wt}" fill="${col || RINK}" stroke="#fff" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${esc(txt)}</text>`;
      }
      return "";
    },
  };
}
function repMap(si, o) {
  o = o || {};
  const W = o.w || 740,
    st = si == null ? null : DATA[si],
    src = st ? st.poly : DATA.flatMap((d) => d.poly),
    xs = src.map((p) => X(p[0])),
    ys = src.map((p) => Y(p[1])),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys),
    pad = st ? 24 : 14,
    s = (W - 2 * pad) / (x1 - x0),
    MH = Math.round((y1 - y0) * s + 2 * pad),
    LG = 46,
    H = MH + LG;
  const P = (lo, la) => [(X(lo) - x0) * s + pad, (Y(la) - y0) * s + pad],
    f1 = (v) => v.toFixed(1),
    pts = (poly) =>
      poly
        .map((p) => {
          const q = P(p[0], p[1]);
          return f1(q[0]) + "," + f1(q[1]);
        })
        .join(" ");
  const lab = mkLab(W, MH),
    used = new Set(),
    out = [];
  const inside = (lo, la) => (st ? inPoly(lo, la, st.poly) : stAt(lo, la) >= 0);
  out.push(`<rect width="${W}" height="${MH}" fill="#f0f2f4"/>`);
  if (st) {
    DATA.forEach((d, i) => {
      if (i !== si)
        out.push(
          `<polygon points="${pts(d.poly)}" fill="#e2e0ee" stroke="#c5c0dd" stroke-width=".8"/>`,
        );
    });
    COUNTIES.filter((c) => c.si === si && c.poly.length > 2).forEach((c) => {
      const m = st.cty.find((x) => x.n === c.n);
      out.push(
        `<polygon points="${pts(c.poly)}" fill="${RC[m ? m.ph || 0 : 0]}" fill-opacity=".42" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`,
      );
    });
  } else
    DATA.forEach((d) =>
      out.push(
        `<polygon points="${pts(d.poly)}" fill="${RC[d.ph || 0]}" fill-opacity=".55" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>`,
      ),
    );
  const clipRuns = (L) => (st ? L.flatMap((p) => runsIn(p, st.poly)) : L);
  clipRuns(RV).forEach((l) =>
    out.push(
      `<polyline points="${pts(l)}" fill="none" stroke="#3a9ad0" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>`,
    ),
  );
  ROADS.forEach((r) => {
    const runs = clipRuns([r.pts]),
      sty =
        r.src == "UN"
          ? 'stroke="#a8620a" stroke-width="1.2" stroke-dasharray="5 3"'
          : r.type == "track"
            ? 'stroke="#a98055" stroke-width="1.4" stroke-dasharray="1.5 3"'
            : r.type == "secondary"
              ? 'stroke="#d97706" stroke-width="1.6"'
              : 'stroke="#b45309" stroke-width="2.2"';
    runs.forEach((l) =>
      out.push(
        `<polyline points="${pts(l)}" fill="none" ${sty} stroke-linecap="round" stroke-linejoin="round"/>`,
      ),
    );
  });
  out.push(
    st
      ? `<polygon points="${pts(st.poly)}" fill="none" stroke="${RINK}" stroke-width="2.4" stroke-linejoin="round"/>`
      : DATA.map(
          (d) =>
            `<polygon points="${pts(d.poly)}" fill="none" stroke="${RINK}" stroke-width="1" opacity=".6"/>`,
        ).join(""),
  );
  const marks = [],
    labs = [],
    airportMarks = [];
  if (st) {
    COUNTIES.filter((c) => c.si === si && c.hq).forEach((c) => {
      const m = st.cty.find((x) => x.n === c.n),
        q = P(c.hq[0], c.hq[1]);
      marks.push(
        `<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="3.6" fill="${RC[m ? m.ph || 0 : 0]}" stroke="${RINK}" stroke-width="1.1"/>`,
      );
      lab.res(q[0], q[1], 5);
    });
  }
  const city = PL.filter((p) => p[3] == "c" && inside(p[1], p[2]));
  city.forEach((p) => {
    const q = P(p[1], p[2]);
    marks.push(
      `<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="6" fill="none" stroke="${RINK}" stroke-width="1.6"/>`,
    );
    lab.res(q[0], q[1], 7);
  });
  PL.filter((p) => (p[3] === "a" || p[4]) && inside(p[1], p[2])).forEach((p) => {
    const q = P(p[1], p[2]),
      ax = q[0] - 13,
      ay = q[1] - 13;
    /* Airport badges are offset up-left and drawn after registration-site pins; a connector ties the badge to the true location. */
    airportMarks.push(
      `<line x1="${f1(q[0] - 1.5)}" y1="${f1(q[1] - 1.5)}" x2="${f1(ax + 5.5)}" y2="${f1(ay + 5.5)}" stroke="#4b417e" stroke-width="1.6" stroke-linecap="round"/><circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="2.6" fill="#fff" stroke="#4b417e" stroke-width="1.3"/><circle cx="${f1(ax)}" cy="${f1(ay)}" r="8.5" fill="#4b417e" stroke="#fff" stroke-width="1.6"/><path d="${PLANE}" transform="translate(${f1(ax - 5.2)},${f1(ay - 5.2)}) scale(.46)" fill="#fff" stroke="#fff" stroke-width=".35" stroke-linejoin="round"/>`,
    );
    lab.res(ax, ay, 11);
  });
  (st ? SITES : [])
    .filter((s) => inside(s.lon, s.lat))
    .forEach((sx) => {
      const q = P(sx.lon, sx.lat),
        c =
          {
            Active: "#16a56d",
            Planned: "#e29a0b",
            Closed: "#C5A059",
          }[sx.status] || "#e29a0b";
      marks.push(
        `<path d="${PIN}" transform="translate(${f1(q[0] - 8)},${f1(q[1] - 17)}) scale(.68)" fill="${c}" stroke="#fff" stroke-width="1.8" paint-order="stroke" fill-rule="evenodd"/>`,
      );
      lab.res(q[0], q[1] - 8, 8);
    });
  if (st) {
    const tw = PL.filter((p) => p[3] == "t" && !p[4] && inside(p[1], p[2]));
    tw.forEach((p) => {
      const q = P(p[1], p[2]);
      marks.push(
        `<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="1.8" fill="#fff" stroke="${RINK}" stroke-width=".8"/>`,
      );
      lab.res(q[0], q[1], 3);
    });
  }
  /* labels: cities, counties, sites, airports, towns — each name only once */
  const put = (k, fn) => {
    if (used.has(k)) return;
    const t = fn();
    if (t) {
      used.add(k);
      labs.push(t);
    }
  };
  if (st) {
    COUNTIES.filter((c) => c.si === si && c.hq).forEach((c) => {
      const ci = city.find((p) => K(p[0]) === K(c.n));
      if (ci) return;
      const q = P(c.hq[0], c.hq[1]);
      put(K(c.n), () => lab.put(q[0], q[1], c.n, 10.5, 700, 6, RINK));
    });
  }
  city.forEach((p) => {
    const q = P(p[1], p[2]);
    put(K(p[0]), () => lab.put(q[0], q[1], p[0], st ? 12.5 : 9.5, 800, 8, "#000"));
  });
  (st ? SITES : [])
    .filter((s) => inside(s.lon, s.lat))
    .forEach((sx) => {
      const q = P(sx.lon, sx.lat);
      put("s" + K(sx.name), () => lab.put(q[0], q[1] - 6, sx.name, 9, 600, 8, "#7a4a00"));
    });
  PL.filter((p) => (p[3] == "a" || p[4]) && p[3] != "c" && inside(p[1], p[2])).forEach((p) => {
    const q = P(p[1], p[2]);
    put(K(p[0]), () => lab.put(q[0], q[1] - 6, p[0], 9, 600, 9, "#4b417d"));
  });
  if (st)
    PL.filter((p) => p[3] == "t" && !p[4] && inside(p[1], p[2]))
      .slice(0, 22)
      .forEach((p) => {
        const q = P(p[1], p[2]);
        put(K(p[0]), () => lab.put(q[0], q[1], p[0], 8.5, 500, 4, "#40376c"));
      });
  if (!st)
    DATA.forEach((d) => {
      const q = P(
          d.poly.reduce((a, p) => a + p[0], 0) / d.poly.length,
          d.poly.reduce((a, p) => a + p[1], 0) / d.poly.length,
        ),
        n = SH[d.n] || d.n;
      labs.push(
        `<text x="${f1(q[0])}" y="${f1(q[1])}" text-anchor="middle" font-size="9.5" font-weight="800" fill="#fff" stroke="${RINK}" stroke-width="2.6" paint-order="stroke" letter-spacing=".04em">${esc(n.toUpperCase())}</text>`,
      );
    });
  /* north arrow + scale bar */
  const nx = W - 34,
    ny = 40;
  out.push(...marks, ...airportMarks, ...labs);
  out.push(
    `<g transform="translate(${nx},${ny})"><circle r="19" fill="#fff" fill-opacity=".85" stroke="#c5c0dd"/><polygon points="0,-14 5,6 0,2 -5,6" fill="${RINK}"/><text y="-17" text-anchor="middle" font-size="9" font-weight="800" fill="${RINK}" transform="translate(0,-4)">N</text></g>`,
  );
  const kmU = (111.32 * Math.cos(((((y0 + y1) / 2 / 50) * 0 + 7) * Math.PI) / 180)) / 47 / s,
    nice =
      [10, 20, 25, 50, 100, 150, 200, 250, 300, 500].find((k) => k / kmU >= (st ? 90 : 110)) || 500,
    bl = nice / kmU,
    by = MH - 18;
  out.push(
    `<g transform="translate(${pad},${by})"><rect x="-6" y="-14" width="${f1(bl + 54)}" height="28" rx="5" fill="#fff" fill-opacity=".85"/><line x1="0" y1="0" x2="${f1(bl)}" y2="0" stroke="${RINK}" stroke-width="2.4"/><line x1="0" y1="-5" x2="0" y2="5" stroke="${RINK}" stroke-width="1.6"/><line x1="${f1(bl)}" y1="-5" x2="${f1(bl)}" y2="5" stroke="${RINK}" stroke-width="1.6"/><text x="${f1(bl + 8)}" y="4" font-size="10" font-weight="600" fill="${RINK}">${nice} km</text></g>`,
  );
  /* legend band */
  let lx = pad;
  const lg = [];
  const item = (sw, t, w) => {
    lg.push(
      `<g transform="translate(${lx},${MH + 28})">${sw}<text x="${sw.includes("rect") ? 16 : 20}" y="4" font-size="10" fill="${RINK}">${t}</text></g>`,
    );
    lx += w;
  };
  [
    ["Phase 1 · Low risk", 1],
    ["Phase 2 · Risk", 2],
    ["Phase 3 · High risk", 3],
    ["Not classified", 0],
  ].forEach(([t, i]) =>
    item(
      `<rect x="0" y="-5" width="11" height="11" rx="2" fill="${RC[i]}" fill-opacity=".6" stroke="${RC[i]}"/>`,
      t,
      i == 1 ? 112 : i == 2 ? 96 : i == 3 ? 112 : 96,
    ),
  );
  if (st)
    item(
      `<path d="${PIN}" transform="translate(0,-9) scale(.6)" fill="#16a56d"/>`,
      "Registration site",
      116,
    );
  item(`<path d="${PLANE}" transform="translate(0,-9) scale(.6)" fill="#2F353B"/>`, "Airport", 70);
  item(`<line x1="0" y1="0" x2="14" y2="0" stroke="#b45309" stroke-width="2.2"/>`, "Road", 52);
  item(`<line x1="0" y1="0" x2="14" y2="0" stroke="#3a9ad0" stroke-width="1.4"/>`, "River", 0);
  return `<svg class="rmap" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" font-family="Inter,Segoe UI,Arial,sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>${out.join("")}<rect width="${W}" height="${MH}" fill="none" stroke="#b9b3d6"/>${lg.join("")}</svg>`;
}

/* ---- charts ---- */
function chDonut(vals, cols, size) {
  const S = size || 170,
    r = S / 2 - 8,
    ir = r * 0.62,
    cx = S / 2,
    cy = S / 2,
    tot = vals.reduce((a, b) => a + b, 0);
  let a0 = -Math.PI / 2,
    o = `<svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" font-family="Inter,Segoe UI,Arial,sans-serif">`;
  if (!tot)
    return (
      o +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e2e6e9" stroke-width="${r - ir}"/></svg>`
    );
  vals.forEach((v, i) => {
    if (!v) return;
    let a1 = a0 + (v / tot) * Math.PI * 2;
    if (v === tot) a1 -= 0.0001;
    const la = a1 - a0 > Math.PI ? 1 : 0,
      p = (a, q) => [(cx + q * Math.cos(a)).toFixed(2), (cy + q * Math.sin(a)).toFixed(2)],
      [x1, y1] = p(a0, r),
      [x2, y2] = p(a1, r),
      [x3, y3] = p(a1, ir),
      [x4, y4] = p(a0, ir);
    o += `<path d="M${x1} ${y1}A${r} ${r} 0 ${la} 1 ${x2} ${y2}L${x3} ${y3}A${ir} ${ir} 0 ${la} 0 ${x4} ${y4}Z" fill="${cols[i]}" stroke="#fff" stroke-width="1.5"/>`;
    a0 = a1;
  });
  return (
    o +
    `<text x="${cx}" y="${cy + 2}" text-anchor="middle" font-size="26" font-weight="800" fill="${RINK}">${tot}</text><text x="${cx}" y="${cy + 17}" text-anchor="middle" font-size="9" fill="#6b7592">locations</text></svg>`
  );
}
function chBars(items, w, fmtv) {
  w = w || 520;
  const rh = 22,
    lw = 150,
    vw = 64,
    bw = w - lw - vw,
    mx = Math.max(...items.map((i) => i.v), 1);
  fmtv = fmtv || fmt;
  return `<svg viewBox="0 0 ${w} ${items.length * rh + 4}" width="100%" font-family="Inter,Segoe UI,Arial,sans-serif">${items
    .map((it, i) => {
      const y = i * rh + 2,
        bl = Math.max(2, (it.v / mx) * bw);
      return `<text x="0" y="${y + 14}" font-size="10.5" fill="${RINK}">${esc(it.l.length > 24 ? it.l.slice(0, 23) + "…" : it.l)}</text><rect x="${lw}" y="${y + 3}" width="${bw}" height="12" rx="6" fill="#f0f2f4"/><rect x="${lw}" y="${y + 3}" width="${bl.toFixed(1)}" height="12" rx="6" fill="${it.c || "#c9744a"}"/><text x="${w}" y="${y + 14}" text-anchor="end" font-size="10.5" font-weight="700" fill="${RINK}">${fmtv(it.v)}</text>`;
    })
    .join("")}</svg>`;
}
const legendDots = (labels, cols, vals) =>
  `<div class="r-lg">${labels.map((l, i) => `<span><i style="background:${cols[i]}"></i>${l} <b>${vals[i]}</b></span>`).join("")}</div>`;

/* ---- numbers & narrative ---- */
function stFacts(si) {
  const d = DATA[si],
    c = cstat(d),
    m = metr(d),
    n = d.cty.length,
    ph = [0, 0, 0, 0];
  d.cty.forEach((x) => ph[x.ph || 0]++);
  const roads = ROADS.map((r) => ({
      r,
      km: lenIn([r.pts], d.poly),
    }))
      .filter((x) => x.km > 0.5)
      .sort((a, b) => b.km - a.km),
    sites = SITES.filter((s) => inPoly(s.lon, s.lat, d.poly)),
    air = PL.filter((p) => p[4] && inPoly(p[1], p[2], d.poly));
  return {
    d,
    c,
    m,
    n,
    ph,
    roads,
    sites,
    air,
    top: d.cty.slice().sort((a, b) => b.e - a.e),
  };
}
function stNarr(si) {
  const F = stFacts(si),
    { d, c, n, ph, top, m, sites, air, roads } = F,
    tot = DATA.reduce((a, x) => a + x.t, 0) || 1,
    L = [];
  L.push(
    `<b>${esc(d.n)}</b> (${d.admin ? "administrative area" : "state"}, ${esc(d.rg)} region) has <b>${n}</b> counties / locations earmarked for registration and <b>${fmt(d.t)}</b> government employees to register — <b>${((d.t / tot) * 100).toFixed(1)}%</b> of the national total.`,
  );
  L.push(
    `Overall security is rated <b>${PHN[d.ph || 0]}</b>. <b>${c.ok}</b> of ${n} locations (${n ? Math.round((c.ok / n) * 100) : 0}%) are safe and accessible; <b>${c.bad}</b> are unsafe or inaccessible${c.unk ? `; ${c.unk} not yet classified` : ""}.`,
  );
  if (top.length && d.t) {
    const t3 = top.slice(0, 3),
      s3 = t3.reduce((a, x) => a + x.e, 0);
    L.push(
      `The largest workforces are in ${t3.map((x) => `<b>${esc(x.n)}</b> (${fmt(x.e)})`).join(", ")} — together ${Math.round((s3 / d.t) * 100)}% of the state total.`,
    );
  }
  L.push(
    `Planned access: <b>${c.air}</b> by air, <b>${c.road}</b> by road and <b>${c.river}</b> by river; <b>${c.bad}</b> locations need further discussion with the state security focal person.`,
  );
  L.push(
    `Infrastructure on the map: about <b>${fmt(Math.round(m.rd / 10) * 10)} km</b> of main road, <b>${air.length}</b> airport${air.length == 1 ? "" : "s"}${air.length ? " (" + air.map((p) => esc(p[0])).join(", ") + ")" : ""} and <b>${sites.length}</b> registration site${sites.length == 1 ? "" : "s"}${sites.length ? " (" + sites.filter((s) => s.status == "Active").length + " active)" : ""}.`,
  );
  return L;
}
function recoList(d) {
  const mp = {};
  d.cty.forEach((x) => {
    if (x.rc) {
      mp[x.rc] = (mp[x.rc] || 0) + 1;
    }
  });
  return Object.entries(mp)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
}

/* ---- sections ---- */
const rKpi = (l, v, s) =>
  `<div class="r-k"><small>${l}</small><b>${v}</b>${s ? `<em>${s}</em>` : ""}</div>`;
const rFig = (svg, cap) => `<figure class="r-fig">${svg}<figcaption>${cap}</figcaption></figure>`;
function secNational(o) {
  let h = `<section class="r-sec pb"><h2>National overview</h2><p class="r-lead">Deployment, security and workforce across ${DATA.length} states and administrative areas and ${SUMMARY.cty} counties / locations.</p>`;
  const ph = [0, 0, 0, 0];
  DATA.forEach((d) => d.cty.forEach((c) => ph[c.ph || 0]++));
  if (o.sum)
    h += `<div class="r-kg">${rKpi("Govt employees", fmt(SUMMARY.emp), "to be registered")}${rKpi("States & admin areas", DATA.length, "")}${rKpi("Counties / locations", SUMMARY.cty, "")}${rKpi("Safe & accessible", SUMMARY.ok, Math.round((SUMMARY.ok / SUMMARY.cty) * 100) + "% of locations")}${rKpi("Unsafe / inaccessible", SUMMARY.bad, "")}${rKpi("Registration sites", SITES.length, SITES.filter((s) => s.status == "Active").length + " active")}</div>
 <ul class="r-ul"><li><b>${DATA.filter((d) => d.ph == 3).length}</b> areas are Phase 3 high risk: ${
   DATA.filter((d) => d.ph == 3)
     .map((d) => esc(d.n))
     .join(", ") || "none"
 }.</li><li><b>${esc(DATA.slice().sort((a, b) => b.t - a.t)[0].n)}</b> holds the largest workforce (${fmt(DATA.slice().sort((a, b) => b.t - a.t)[0].t)}).</li><li>Across all locations: ${ph[1]} Phase 1, ${ph[2]} Phase 2, ${ph[3]} Phase 3${ph[0] ? `, ${ph[0]} not classified` : ""}.</li></ul>`;
  if (o.map)
    h += rFig(
      repMap(null, {
        w: 740,
      }),
      "Figure — South Sudan: states and administrative areas shaded by security phase, with roads, rivers, cities and airports.",
    );
  if (o.chart)
    h += `<div class="r-2"><div><h3>Security phase of locations</h3><div class="r-dn">${chDonut(ph.slice(1).concat(ph[0]), [RC[1], RC[2], RC[3], RC[0]])}${legendDots(["Phase 1", "Phase 2", "Phase 3", "Not classified"], [RC[1], RC[2], RC[3], RC[0]], ph.slice(1).concat(ph[0]))}</div></div><div><h3>Govt employees by state</h3>${chBars(
      DATA.slice()
        .sort((a, b) => b.t - a.t)
        .map((d) => ({
          l: SH[d.n] || d.n,
          v: d.t,
          c: RC[d.ph || 0],
        })),
      420,
    )}</div></div>`;
  if (o.table)
    h += `<h3>States and administrative areas</h3><table class="r-t"><thead><tr><th>State / area</th><th>Region</th><th class="n">Employees</th><th class="n">Counties</th><th class="n">Safe &amp; acc.</th><th class="n">Unsafe</th><th>Security</th></tr></thead><tbody>${DATA.slice()
      .sort((a, b) => b.t - a.t)
      .map((d) => {
        const c = cstat(d);
        return `<tr><td><b>${esc(d.n)}</b></td><td>${esc(d.rg)}</td><td class="n">${fmt(d.t)}</td><td class="n">${d.cty.length}</td><td class="n">${c.ok}</td><td class="n">${c.bad}</td><td><span class="r-ph" style="background:${RTINT[d.ph || 0]};color:${RC[d.ph || 0]}">${PHN[d.ph || 0]}</span></td></tr>`;
      })
      .join(
        "",
      )}</tbody><tfoot><tr><td colspan="2">Total</td><td class="n">${fmt(SUMMARY.emp)}</td><td class="n">${SUMMARY.cty}</td><td class="n">${SUMMARY.ok}</td><td class="n">${SUMMARY.bad}</td><td></td></tr></tfoot></table>`;
  return h + "</section>";
}
function secState(si, o, first) {
  const F = stFacts(si),
    { d, c, n, ph, roads, sites, air, top } = F,
    pre = first ? "" : " pb";
  let h = `<section class="r-sec${pre}"><h2>${esc(d.n)}</h2><div class="r-sub"><span class="r-ph" style="background:${RTINT[d.ph || 0]};color:${RC[d.ph || 0]}">${PHN[d.ph || 0]}</span> ${esc(d.rg)} region · HQ ${esc(d.hq)} · ${d.admin ? "Administrative area" : "State"}</div>`;
  if (o.sum) {
    h += `<div class="r-kg">${rKpi("Govt employees", fmt(d.t), "to be registered")}${rKpi("Counties / locations", n, "")}${rKpi("Safe & accessible", c.ok, n ? Math.round((c.ok / n) * 100) + "%" : "")}${rKpi("Unsafe / inaccessible", c.bad, "")}${rKpi("Registration sites", sites.length, sites.filter((s) => s.status == "Active").length + " active")}${rKpi("Area (approx.)", fmt(Math.round(F.m.area / 100) * 100) + " km²", "")}</div><h3>Key findings</h3><ul class="r-ul">${stNarr(
      si,
    )
      .map((t) => `<li>${t}</li>`)
      .join("")}</ul>`;
    const rc = recoList(d);
    if (rc.length)
      h += `<h3>Main recommendations</h3><ul class="r-ul">${rc.map(([t, k]) => `<li>${esc(t)} <span class="r-mu">(${k} location${k > 1 ? "s" : ""})</span></li>`).join("")}</ul>`;
  }
  if (o.map)
    h += rFig(
      repMap(si, {
        w: 740,
      }),
      `Figure — ${esc(d.n)}: counties shaded by security phase, with county headquarters, cities, airports, registration sites, roads and rivers. Boundaries are indicative.`,
    );
  if (o.chart) {
    const pv = ph.slice(1).concat(ph[0]),
      cols = [RC[1], RC[2], RC[3], RC[0]];
    h += `<div class="r-2"><div><h3>Security phase of locations</h3><div class="r-dn">${chDonut(pv, cols)}${legendDots(["Phase 1", "Phase 2", "Phase 3", "Not classified"], cols, pv)}</div></div><div><h3>Planned access</h3>${chBars(
      [
        {
          l: "By air",
          v: c.air,
          c: "#2F353B",
        },
        {
          l: "By road",
          v: c.road,
          c: "#b45309",
        },
        {
          l: "By river",
          v: c.river,
          c: "#3a9ad0",
        },
        {
          l: "Needs further discussion",
          v: c.bad,
          c: RC[3],
        },
      ],
      380,
    )}<h3 style="margin-top:14px">Largest workforces</h3>${chBars(
      top.slice(0, 6).map((x) => ({
        l: x.n,
        v: x.e,
        c: RC[x.ph || 0],
      })),
      380,
    )}</div></div>`;
  }
  if (o.table)
    h += `<h3>County data</h3><table class="r-t sm"><thead><tr><th>County / location</th><th class="n">Employees</th><th class="n">% of state</th><th>Security</th><th>Safety · Access</th><th>Transport</th><th>Remarks / recommendation</th></tr></thead><tbody>${top.map((x) => `<tr><td><b>${esc(x.n)}</b></td><td class="n">${fmt(x.e)}</td><td class="n">${d.t ? ((x.e / d.t) * 100).toFixed(1) : "0.0"}%</td><td><span class="r-ph" style="background:${RTINT[x.ph || 0]};color:${RC[x.ph || 0]}">${x.ph ? "Phase " + x.ph : "n/c"}</span></td><td>${esc(x.sf || "—")} · ${esc(x.ac || "—")}</td><td>${esc(x.md || "—")}</td><td>${esc(x.rm || "")}${x.rm && x.rc ? "<br>" : ""}${x.rc ? `<span class="r-mu">${esc(x.rc)}</span>` : ""}</td></tr>`).join("")}</tbody><tfoot><tr><td>Total</td><td class="n">${fmt(d.t)}</td><td class="n">100%</td><td colspan="4"></td></tr></tfoot></table>`;
  if (o.infra) {
    h += `<h3>Roads, airports and key places</h3><div class="r-2"><div><h4>Airports</h4>${air.length ? `<ul class="r-ul sm">${air.map((p) => `<li>${esc(p[0])}</li>`).join("")}</ul>` : '<p class="r-mu">None recorded on the map.</p>'}<h4>Cities and towns</h4><p class="r-tags">${
      F.m.cities
        .concat(F.m.towns.slice(0, 18))
        .map((t) => `<span>${esc(t)}</span>`)
        .join("") || '<span class="r-mu">—</span>'
    }</p></div><div><h4>Roads in this area (${fmt(Math.round(F.m.rd / 10) * 10)} km)</h4>${
      roads.length
        ? `<table class="r-t sm"><thead><tr><th>Road</th><th>Type</th><th class="n">km</th></tr></thead><tbody>${roads
            .filter((x) => x.r.src != "UN")
            .concat(roads.filter((x) => x.r.src == "UN").slice(0, 8))
            .slice(0, 14)
            .map(
              (x) =>
                `<tr><td>${esc(x.r.name)}</td><td>${
                  {
                    main: "Main",
                    secondary: "Secondary",
                    track: "Track",
                  }[x.r.type] || ""
                }</td><td class="n">${x.km.toFixed(0)}</td></tr>`,
            )
            .join("")}</tbody></table>`
        : '<p class="r-mu">No roads recorded.</p>'
    }</div></div>`;
  }
  if (o.sites) {
    h +=
      `<h3>Registration sites</h3>` +
      (sites.length
        ? `<table class="r-t sm"><thead><tr><th>Site</th><th>County</th><th>Status</th><th class="n">Govt Employees</th><th>Note</th></tr></thead><tbody>${sites
            .map((s) => {
              const cc = cntyNear(s.lon, s.lat, si);
              return `<tr><td><b>${esc(s.name)}</b></td><td>${cc ? esc(cc.n) : "—"}</td><td>${esc(s.status)}</td><td class="n">${s.cap ? fmt(s.cap) : "—"}</td><td>${esc(s.note || "")}</td></tr>`;
            })
            .join(
              "",
            )}</tbody><tfoot><tr><td colspan="3">Total</td><td class="n">${fmt(sites.reduce((a, s) => a + (+s.cap || 0), 0))}</td><td></td></tr></tfoot></table>`
        : '<p class="r-mu">No registration sites have been added for this area yet.</p>');
  }
  return h + "</section>";
}
function secNotes() {
  return `<section class="r-sec pb"><h2>Notes and methodology</h2><ul class="r-ul"><li><b>Source.</b> Distribution of States and Administrative Areas by Regions (government employees, security phase, safety and accessibility by county / location).</li><li><b>Map.</b> State outlines, rivers, roads and towns are traced from UN Geospatial map no. 4450 (July 2020). County areas are indicative zones drawn around each county headquarters — they are not official boundaries.</li><li><b>Security phases.</b> Phase 1 — low risk, Phase 2 — risk, Phase 3 — high risk. “Safe &amp; accessible” counts Phase 1 and 2 locations.</li><li><b>Distances.</b> Road lengths are approximate great-circle sums along the traced lines.</li><li>Figures reflect the data held in the dashboard at the time of printing and should be verified against the latest field reports.</li></ul></section>`;
}
function secCover(title, sub, o, toc, when) {
  return `<section class="r-cover"><div class="r-band"><span class="r-logo"></span><div><b>BM Monitor</b><small>National biometric registration · South Sudan</small></div></div><div class="r-ct"><small>${esc(REP.cls)}</small><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><table class="r-meta"><tr><td>Report date</td><td>${when}</td></tr>${REP.by ? `<tr><td>Prepared by</td><td>${esc(REP.by)}</td></tr>` : ""}${REP.org ? `<tr><td>Organisation</td><td>${esc(REP.org)}</td></tr>` : ""}<tr><td>Classification</td><td>${esc(REP.cls)}</td></tr><tr><td>Data</td><td>${fmt(SUMMARY.emp)} govt employees · ${SUMMARY.cty} counties / locations · ${SITES.length} registration sites</td></tr></table>${toc.length ? `<div class="r-toc"><h3>Contents</h3><ol>${toc.map((t) => `<li>${esc(t)}</li>`).join("")}</ol></div>` : ""}</section>`;
}

/* County-level report: summarizes the selected county and its mapped registration sites. */
function countyScopeParts(scope) {
  if (typeof scope !== "string" || !scope.startsWith("county:")) return null;
  const parts = scope.split(":");
  const si = Number(parts[1]),
    ci = Number(parts[2]);
  if (!Number.isInteger(si) || !Number.isInteger(ci) || !DATA[si] || !DATA[si].cty[ci]) return null;
  return {
    si,
    ci,
    state: DATA[si],
    county: DATA[si].cty[ci],
  };
}
function countySites(si, county) {
  const boundary = COUNTIES.find((c) => c.si === si && K(c.n) === K(county.n));
  if (boundary && boundary.poly && boundary.poly.length > 2) {
    return SITES.filter((site) => inPoly(site.lon, site.lat, boundary.poly));
  }
  return SITES.filter((site) => {
    const nearest = cntyNear(site.lon, site.lat, si);
    return nearest && K(nearest.n) === K(county.n);
  });
}
function secCounty(scope, options) {
  const picked = countyScopeParts(scope);
  if (!picked)
    return `<section class="r-sec"><h2>County report unavailable</h2><p>No county was selected.</p></section>`;
  const { si, state, county } = picked;
  const sites = countySites(si, county);
  const target = Number(county.e || county.t || 0);
  const registered = Number(county.r || county.registered || 0);
  let html = `<section class="r-sec"><h2>${esc(county.n)} County Registration Report</h2>
    <p class="r-lead">${esc(state.n)} · County-level registration summary and registration sites.</p>`;
  if (options.sum) {
    html += `<div class="r-kg">
      ${rKpi("Government employees", fmt(target), "County target")}
      ${rKpi("Registered", fmt(registered), "Recorded county total")}
      ${rKpi("Remaining", fmt(Math.max(0, target - registered)), "Based on available figures")}
      ${rKpi("Registration sites", sites.length, sites.filter((site) => site.status === "Active").length + " active")}
    </div>`;
  }
  if (options.table) {
    html += `<h3>Registration sites in ${esc(county.n)}</h3>
      <table class="r-t"><thead><tr><th>#</th><th>Registration site</th><th>Institution / MDA</th><th>Status</th><th>Government employees</th><th>Note</th></tr></thead><tbody>`;
    if (sites.length) {
      html += sites
        .map(
          (
            site,
            index,
          ) => `<tr><td>${index + 1}</td><td><b>${esc(site.name || "Unnamed site")}</b></td>
        <td>${esc(site.mda || "—")}</td><td>${esc(site.status || "Not specified")}</td>
        <td class="n">${site.cap == null ? "—" : fmt(site.cap)}</td><td>${esc(site.note || "—")}</td></tr>`,
        )
        .join("");
    } else {
      html += `<tr><td colspan="6">No registration sites are mapped to this county yet.</td></tr>`;
    }
    html += `</tbody><tfoot><tr><td colspan="4">Total mapped sites</td><td class="n">${sites.length}</td><td></td></tr></tfoot></table>`;
  }
  html += `<p class="r-mu">County: ${esc(county.n)} · State / administrative area: ${esc(state.n)}. Figures are limited to data currently available in the dashboard.</p></section>`;
  return html;
}
function showReport(scope, sec) {
  const when = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  let title,
    sub,
    body = "",
    toc = [];
  if (scope === "nat") {
    title = REP.title || "National Registration Report";
    sub = "Security, access and workforce — all states and administrative areas";
    toc = ["National overview"];
    body = secNational(sec);
  } else if (scope === "all") {
    title = REP.title || "National Registration Report — All States";
    sub = "National overview and a chapter for each state and administrative area";
    toc = ["National overview"].concat(DATA.map((d) => d.n));
    body = secNational(sec) + DATA.map((d, i) => secState(i, sec)).join("");
  } else if (countyScopeParts(scope)) {
    const picked = countyScopeParts(scope);
    title = REP.title || picked.county.n + " County — Registration Report";
    sub = "County-level registration report · " + picked.state.n;
    body = secCounty(scope, sec);
    toc = [picked.county.n + " County"];
  } else {
    const si = +scope,
      d = DATA[si];
    title = REP.title || d.n + " — Registration Report";
    sub =
      (d.admin ? "Administrative area" : "State") +
      " report · security, access, workforce and infrastructure";
    body = secState(si, sec, !sec.cover);
  }
  if (sec.notes) body += secNotes();
  const countyPick = countyScopeParts(scope);
  const ref =
    "BR-" +
    (scope === "nat"
      ? "NAT"
      : scope === "all"
        ? "ALL"
        : countyPick
          ? countyPick.county.n
              .replace(/[^A-Za-z]/g, "")
              .slice(0, 8)
              .toUpperCase()
          : DATA[+scope].n
              .replace(/[^A-Za-z]/g, "")
              .slice(0, 8)
              .toUpperCase()) +
    "-" +
    new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const R = rep$("#rep");
  R.innerHTML = `<div class="rbar"><b>Report preview · ${esc(ref)}</b><button class="btn" id="rb-xl">Export Excel</button><button class="btn" id="rb-dx">Export Word</button><button class="btn" id="rb-png">Map image (PNG)</button><button class="btn pri" id="rb-pr">Print / Save as PDF</button><button class="btn" id="rb-x"><i class="bx bx-x"></i> Close</button></div><div class="paper"><div class="r-foot">${esc(REP.cls)} · ${esc(ref)} · BM Monitor</div>${sec.cover ? secCover(title, sub, sec, toc, when) : ""}${body}</div>`;
  R.hidden = false;
  document.body.classList.add("noscroll");
  R.scrollTop = 0;
  rep$("#rb-x").onclick = () => {
    R.hidden = true;
    document.body.classList.remove("noscroll");
  };
  rep$("#rb-pr").onclick = () => window.print();
  rep$("#rb-xl").onclick = () => exportXlsx(scope);
  rep$("#rb-png").onclick = () => {
    const s = R.querySelector("svg.rmap");
    if (!s) {
      toast("This report has no map figure");
      return;
    }
    const xml = new XMLSerializer().serializeToString(s),
      im = new Image(),
      vb = s.viewBox.baseVal;
    im.onload = () => {
      const k = 2.4,
        c = document.createElement("canvas");
      c.width = vb.width * k;
      c.height = vb.height * k;
      const g = c.getContext("2d");
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(im, 0, 0, c.width, c.height);
      c.toBlob((b) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = ref + "-map.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      });
    };
    im.onerror = () => toast("Could not render the image in this browser");
    im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  };
}
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    !rep$("#rep").hidden &&
    !/INPUT|SELECT/.test((e.target || {}).tagName || "")
  ) {
    rep$("#rep").hidden = true;
    document.body.classList.remove("noscroll");
  }
});

/* ===================== ADDON E: confirm dialog, story-map counties ===================== */
function askConfirm(msg, ok) {
  return new Promise((res) => {
    $("#cfm-m").textContent = msg;
    $("#cfm-ok").textContent = ok || "Delete";
    $("#cfm").hidden = false;
    const done = (v) => {
        $("#cfm").hidden = true;
        $("#cfm-ok").onclick = $("#cfm-no").onclick = null;
        document.removeEventListener("keydown", kd, true);
        res(v);
      },
      kd = (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          done(false);
        }
      };
    document.addEventListener("keydown", kd, true);
    $("#cfm-ok").onclick = () => done(true);
    $("#cfm-no").onclick = () => done(false);
    $("#cfm-no").focus();
  });
}
function hiStoryCty() {
  const o = $("#scg");
  if (o) o.remove();
  SCL = [];
  if (typeof step === "undefined" || step < 1) return;
  const si = step - 1,
    d = DATA[si],
    g = mk("g", {
      id: "scg",
    });
  COUNTIES.filter((c) => c.si === si && c.poly.length > 2).forEach((c) => {
    const m = d.cty.find((x) => x.n === c.n);
    g.append(
      mk("polygon", {
        points: ptsStr(c.poly),
        class: "sct p" + (m && m.ph ? m.ph : 0),
      }),
    );
  });
  COUNTIES.filter((c) => c.si === si && c.hq)
    .slice()
    .sort((a, b) => a.hq[0] - b.hq[0])
    .forEach((c, i) => {
      const x = X(c.hq[0]),
        y = Y(c.hq[1]);
      g.append(
        mk("circle", {
          cx: x,
          cy: y,
          r: 1.2,
          class: "scd",
        }),
      );
      const t = mk(
        "text",
        {
          x,
          y: y + (i % 2 ? -2.4 : 3.4),
          class: "scl",
        },
        c.n,
      );
      t._c = c;
      g.append(t);
      SCL.push(t);
    });
  const f = sv.querySelector(".spl");
  f ? sv.insertBefore(g, f) : sv.append(g);
  sKick();
}

/* ===================== ADDON F: icons, nav, responsive helpers ===================== */
(function () {
  const M = {
    zi: "bx-plus",
    zo: "bx-minus",
    zr: "bx-fullscreen",
    tEd: "bx-edit-alt",
    tRd: "bx-compass",
    tAd: "bx-map-pin",
    tAm: "bx-cog",
    tRp: "bx-printer",
  };
  Object.keys(M).forEach((id) => {
    const b = $("#" + id);
    if (b) b.innerHTML = '<i class="bx ' + M[id] + '"></i>';
  });
  const am = $("#amenu"),
    ad = $("#tAd");
  ad.addEventListener(
    "click",
    () => {
      const t = $(".tools");
      am.style.top = t.offsetTop + ad.offsetTop + "px";
      am.style.right = t.offsetWidth + t.clientWidth * 0 + 22 + "px";
    },
    true,
  );
  const ids = ["overview", "mapsec", "story"],
    ls = [...document.querySelectorAll(".links a")].filter((a) =>
      ids.includes((a.getAttribute("href") || "").slice(1)),
    );
  if (window.IntersectionObserver) {
    const vis = {};
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => (vis[e.target.id] = e.isIntersecting ? e.intersectionRatio : 0));
        let best = null,
          bv = 0;
        ids.forEach((i) => {
          if ((vis[i] || 0) > bv) {
            bv = vis[i];
            best = i;
          }
        });
        ls.forEach((a) => a.classList.toggle("on", best && a.getAttribute("href") === "#" + best));
      },
      {
        threshold: [0, 0.15, 0.3, 0.5, 0.75],
      },
    );
    ids.forEach((i) => {
      const e = $("#" + i);
      e && io.observe(e);
    });
  }
  ls.forEach((a) =>
    a.addEventListener("click", (e) => {
      const t = $(a.getAttribute("href"));
      if (t) {
        e.preventDefault();
        t.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        history.replaceState(null, "", a.getAttribute("href"));
      }
    }),
  );
})();
/* ===================== ADDON D: theme, refresh pipeline, persistence, boot ===================== */
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  const b = $("#thm");
  b.innerHTML = t === "light" ? '<i class="bx bx-moon"></i>' : '<i class="bx bx-sun"></i>';
  b.title = t === "light" ? "Switch to dark mode" : "Switch to light mode";
  try {
    localStorage.setItem("bioreg.theme2", t);
  } catch (x) {}
}
let _t0 = "light";
try {
  _t0 = localStorage.getItem("bioreg.theme2") || "light";
} catch (x) {}
setTheme(_t0);
$("#thm").onclick = () =>
  setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
function siteTags(d) {
  const stateName = String(d.n || "")
    .trim()
    .toLowerCase();
  const counties = (d.cty || []).map((c) =>
    typeof c === "object"
      ? c
      : {
          n: c[0],
          e: c[1],
        },
  );
  const norm = (v) =>
    String(v || "")
      .trim()
      .toLowerCase()
      .replace(/\s+county$/, "");
  const sites = SITES.filter(
    (s) => stAt(s.lon, s.lat) === DATA.indexOf(d) || inPoly(s.lon, s.lat, d.poly),
  );
  const external = Array.isArray(window.REGISTRATION_SITES) ? window.REGISTRATION_SITES : [];
  const groups = counties
    .map((c) => {
      const name = c.n || c.name || "";
      const hits = sites.filter((s) => {
        const near = cntyNear(s.lon, s.lat, DATA.indexOf(d));
        return near && norm(near.n) === norm(name);
      });
      const imported = external.filter(
        (x) => norm(x.state) === norm(d.n) && norm(x.county) === norm(name),
      );
      const rows = hits.length
        ? hits
        : imported.map((x) => ({
            name: x.site || x.name || "Registration site",
            mda: x.mda || "",
            status: x.status || "Listed",
            cap: x.cap || x.employees || 0,
            note: x.note || "",
            county: name,
            _imported: true,
            registrations: x.registrations || x.registered || x.registration_count || null,
          }));
      return {
        name,
        rows,
        employees: c.e || c.emp || 0,
      };
    })
    .filter((g) => g.rows.length || counties.length);
  if (!groups.length) return '<span class="muted">No counties are listed for this state.</span>';
  return `<div class="county-site-list">${groups.map((g, i) => `<details class="county-site-group" ${g.rows.length ? "" : 'data-empty="1"'}><summary><span><b>${esc(g.name)} County</b><small>${g.rows.length} registration site${g.rows.length === 1 ? "" : "s"}</small></span><b class="county-site-count">${g.rows.length}</b></summary><div class="county-site-items">${g.rows.length ? g.rows.map((site, j) => `<button type="button" class="site-select" onclick="showStorySite(${esc(JSON.stringify(String(d.n)))},${esc(JSON.stringify(String(g.name)))},${j},this)"><span><b>${esc(site.name || site.site || "Registration site")}</b><small>${esc(site.mda || site.status || "Registration site")}</small></span><span class="site-chevron">›</span></button>`).join("") : '<p class="muted county-empty">No registration sites recorded for this county.</p>'}</div><div class="story-site-detail" hidden></div></details>`).join("")}</div>`;
}
function showStorySite(stateName, countyName, index, button) {
  const group = button.closest(".county-site-group");
  const detail = group.querySelector(".story-site-detail");
  const state = DATA.find((d) => String(d.n) === stateName);
  if (!state) return;
  const nearSites = SITES.filter(
    (s) => stAt(s.lon, s.lat) === DATA.indexOf(state) || inPoly(s.lon, s.lat, state.poly),
  );
  const county = cntyNearForName(countyName, state);
  const hits = nearSites.filter((s) => {
    const n = cntyNear(s.lon, s.lat, DATA.indexOf(state));
    return n && String(n.n).toLowerCase() === countyName.toLowerCase();
  });
  const imported = (Array.isArray(window.REGISTRATION_SITES) ? window.REGISTRATION_SITES : [])
    .filter(
      (x) =>
        String(x.state || "").toLowerCase() === stateName.toLowerCase() &&
        String(x.county || "").toLowerCase() === countyName.toLowerCase(),
    )
    .map((x) => ({
      name: x.site || x.name,
      mda: x.mda,
      status: x.status || "Listed",
      cap: x.cap || x.employees || 0,
      note: x.note,
      registrations: x.registrations || x.registered || x.registration_count || null,
      _imported: true,
    }));
  const site = (hits.length ? hits : imported)[index];
  if (!site) return;
  group
    .querySelectorAll(".site-select")
    .forEach((b) => b.classList.toggle("selected", b === button));
  const _sid =
    site.id ||
    (
      SITES.find(
        (x) =>
          String(x.name).trim().toLowerCase() ===
          String(site.name || site.site || "")
            .trim()
            .toLowerCase(),
      ) || {}
    ).id;
  const dl = _sid != null ? window.__dly().get(_sid) : null;
  site._dl = dl;
  site._sid = _sid;
  const regCount = dl
    ? dl.n
    : (site.registrations ?? site.registered ?? site.registration_count ?? site.regCount);
  const status = site.status || "Not specified";
  const was = detail.previousElementSibling === button && !detail.hidden;
  if (was) {
    detail.hidden = true;
    button.classList.remove("selected");
    return;
  }
  button.after(detail);
  detail.hidden = false;
  detail.innerHTML = `<div class="story-site-tabs" role="tablist"><button class="active" role="tab" aria-selected="true" onclick="storySiteTab(this,'summary')">Site overview</button><button role="tab" aria-selected="false" onclick="storySiteTab(this,'registrations')">Registrations</button></div><div class="story-site-pane" data-pane="summary"><h4>${esc(site.name || site.site || "Registration site")}</h4><div class="story-site-metrics"><div><small>County</small><b>${esc(countyName)}</b></div><div><small>Status</small><b>${esc(status)}</b></div><div><small>Registered so far</small><b>${regCount == null ? "Not available" : fmt(Number(regCount) || 0)}</b></div></div><p>${esc(site.note || site.description || "No additional site notes have been provided.")}</p>${site.mda ? `<small>Institution / MDA: <b>${esc(site.mda)}</b></small>` : ""}</div><div class="story-site-pane" data-pane="registrations" hidden><h4>Registration details</h4>${site._dl ? `<div class="story-site-metrics"><div><small>Completed</small><b>${fmt(site._dl.ok)}</b></div><div><small>Pending</small><b>${fmt(site._dl.pend)}</b></div><div><small>Failed</small><b>${fmt(site._dl.fail)}</b></div><div><small>Daily reports</small><b>${fmt(site._dl.d)}</b></div></div>` : '<p class="muted">No daily reports submitted for this site yet.</p>'}${renderStoryRegistrations(site, stateName, countyName)}</div>`;
}
function cntyNearForName(name, state) {
  return (
    (state.cty || []).find((c) => String(c.n || "").toLowerCase() === String(name).toLowerCase()) ||
    null
  );
}
function storySiteTab(btn, which) {
  const detail = btn.closest(".story-site-detail");
  detail.querySelectorAll(".story-site-tabs button").forEach((b) => {
    const active = b === btn;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", String(active));
  });
  detail.querySelectorAll(".story-site-pane").forEach((p) => (p.hidden = p.dataset.pane !== which));
}
function renderStoryRegistrations(site, stateName, countyName) {
  const sources = [
    window.REGISTRATIONS,
    window.REGISTRATION_RECORDS,
    window.REGISTRATION_DATA,
    window.registrations,
  ]
    .filter(Array.isArray)
    .flat();
  const name = String(site.name || site.site || "").toLowerCase();
  const rows = sources.filter((r) => {
    const sn = String(r.site || r.site_name || r.registration_site || "").toLowerCase();
    return (
      sn === name &&
      (!r.state || String(r.state).toLowerCase() === stateName.toLowerCase()) &&
      (!r.county || String(r.county).toLowerCase() === countyName.toLowerCase())
    );
  });
  if (!rows.length)
    return `<p class="muted">Individual registration records are not present in the current dashboard data for this site. Connect the registration database or provide a registration export to display names, dates, and registration status here.</p>`;
  const cols = [
    ["Registrant", "name", "full_name", "employee_name"],
    ["Reference", "reference", "ref", "employee_id"],
    ["Date", "date", "registration_date", "created_at"],
    ["Status", "status", "registration_status"],
  ];
  return `<div class="story-reg-table-wrap"><table class="story-reg-table"><thead><tr>${cols.map((c) => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr>${cols
          .map(
            (c) =>
              `<td>${esc(
                c
                  .slice(1)
                  .map((k) => r[k])
                  .find((v) => v != null && v !== "") || "—",
              )}</td>`,
          )
          .join("")}</tr>`,
    )
    .join(
      "",
    )}</tbody></table></div><small>${rows.length} registration record${rows.length === 1 ? "" : "s"} available</small>`;
}
function recalc() {
  const all = DATA.flatMap((d) => d.cty);
  Object.assign(SUMMARY, {
    emp: DATA.reduce((a, d) => a + d.t, 0),
    cty: all.length,
    ok: all.filter((c) => c.ph == 1 || c.ph == 2).length,
    bad: all.filter((c) => c.ph == 3).length,
    air: all.filter((c) => c.md == "Air").length,
    road: all.filter((c) => c.md == "Road").length,
    river: all.filter((c) => c.md == "River").length,
  });
}
window.addEventListener("beforeunload", () => {
  try {
    localStorage.setItem(SAVEKEY, JSON.stringify(snapshot()));
  } catch (x) {}
});
window.addEventListener("pagehide", () => {
  try {
    localStorage.setItem(SAVEKEY, JSON.stringify(snapshot()));
  } catch (x) {}
});
function scheduleSave() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try {
      localStorage.setItem(SAVEKEY, JSON.stringify(snapshot()));
    } catch (x) {}
  }, 400);
}
function refresh(nosave) {
  DATA.forEach((d) => {
    d.nc = d.cty.length;
    delete d.m;
    if (dirty) d.t = d.cty.reduce((a, c) => a + (+c.e || 0), 0);
  });
  if (dirty) {
    recalc();
    const h = $("#hN");
    if (h) h.textContent = SUMMARY.cty;
  }
  COUNTIES.forEach((c) => {
    if (!c.hq) return;
    if (!c._h) {
      if (!c.g) c.g = toGeo(c.hq[0], c.hq[1]);
    } else if (c._h[0] !== c.hq[0] || c._h[1] !== c.hq[1]) c.g = toGeo(c.hq[0], c.hq[1]);
    c._h = c.hq.slice();
  });
  SITES.forEach((x) => {
    if (!x._h) {
      if (!x.g) x.g = toGeo(x.lon, x.lat);
    } else if (x._h[0] !== x.lon || x._h[1] !== x.lat) x.g = toGeo(x.lon, x.lat);
    x._h = [x.lon, x.lat];
  });
  CVER++;
  buildPlaces();
  buildSP();
  drawSites();
  drawRoads();
  drawCounties();
  if (TOOL === "edit") drawHandles();
  try {
    render();
    cview();
    card();
    deep(step);
    hiStory();
    hiStoryCty();
  } catch (x) {
    console.error(x);
  }
  try {
    gRedraw();
  } catch (x) {}
  if (view !== null)
    $("#mchip").innerHTML = "<b>" + DATA[view].n + "</b> · " + DATA[view].cty.length + " counties";
  lk = "";
  if (!nosave) scheduleSave();
}
(function boot() {
  ROADS = RDS.map((l, i) => ({
    id: "un" + i,
    name: "UN road " + (i + 1),
    type: "main",
    src: "UN",
    from: "",
    to: "",
    pts: l.split(" ").map((q) => q.split(",").map(Number)),
  }));
  snapInit();
  try {
    const s = JSON.parse(localStorage.getItem(SAVEKEY) || "null");
    if (s) restore(s);
  } catch (x) {
    console.warn("saved data ignored", x);
  }
  // Merge filtered Excel records into the main Registration sites dataset.
  const importedRegistrationSites = [
    {
      mda: "Ministry of Trade and Industry",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "Nimule",
      target: 15,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Trade and Industry",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "Yambio - Anzara Agro Industry",
      target: 9,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Trade and Industry",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "Aweil Center",
      target: 41,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Water Resources and Irrigation",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "Torit",
      target: 1,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Water Resources and Irrigation",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "Yambio",
      target: 1,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Water Resources and Irrigation",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Renk",
      site: "Renk",
      target: 30,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Higher Education, Science and Technology",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Juba",
      site: "University of Juba",
      target: 0,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Higher Education, Science and Technology",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "Torit Polytechnic",
      target: 0,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Higher Education, Science and Technology",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "Yambio Polytechnic",
      target: 0,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Higher Education, Science and Technology",
      state: "Jonglei",
      hq: "Bor",
      county: "Bor South",
      site: "Dr. John Garang University",
      target: 0,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Higher Education, Science and Technology",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "Rumbek University",
      target: 0,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Higher Education, Science and Technology",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil West",
      site: "Northern Bahr-el-Ghazal Polytechnic",
      target: 0,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Higher Education, Science and Technology",
      state: "Unity",
      hq: "Bentiu",
      county: "Rubkona",
      site: "Bentiou Polytechnic",
      target: 0,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Higher Education, Science and Technology",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Upper Nile University",
      target: 0,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Higher Education, Science and Technology",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "University of Bahr-el-Ghazal",
      target: 0,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Juba",
      site: "Dr. John Garang National Secondary School",
      target: 52,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Juba",
      site: "Rombur National Teachers Training Institute",
      target: 43,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Juba",
      site: "Yapa National Secondary School",
      target: 44,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Lainya",
      site: "Loka National Secondary School",
      target: 68,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Magwi",
      site: "Arapi National Teachers Training Institute",
      target: 34,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Maridi",
      site: "Maridi National Teachers Training Institute",
      target: 43,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Mundri East",
      site: "Lui Girls National Secondary School",
      target: 38,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Jonglei",
      hq: "Bor",
      county: "Fangak",
      site: "Atar National Secondary School",
      target: 27,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "Rumbek National Secondary School",
      target: 114,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "Rumbek National Teachers Training Institute",
      target: 39,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Lakes",
      hq: "Rumbek",
      county: "Gok",
      site: "Maper National Teachers Training Institute",
      target: 42,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "Aweil National Secondary School",
      target: 29,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Unity",
      hq: "Bentiu",
      county: "Rubkona",
      site: "Bentiu National Secondary School",
      target: 18,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Malakal El Shabia Girls National Secondary School",
      target: 40,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Malakal National Teachers Training Institute",
      target: 13,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Warrap",
      hq: "Kuajok",
      county: "Gogrial West",
      site: "Kuajok National Secondary School",
      target: 33,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "Bussere National Secondary School",
      target: 36,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of General Education and Instruction",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "Mbili Girls National Teachers Training Institute",
      target: 39,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Health",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Juba",
      site: "Al-Cardinal Kidney Hospital",
      target: 4,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Health",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "Kiir Mayardit Women's Hospital",
      target: 133,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Health",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Malakal Hospital",
      target: 635,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Health",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "Wau Hospital",
      target: 508,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Livestock and Fisheries",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "Marial Lou",
      target: 14,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Environment and Forestry",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Yei River",
      site: "Kagelu",
      target: 270,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Environment and Forestry",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "Torit town",
      target: 22,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Environment and Forestry",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Maridi",
      site: "Mardi Town",
      target: 109,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Labour",
      state: "Jonglei",
      hq: "Bor",
      county: "Bor",
      site: "Bor Vocational Training Center",
      target: 15,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Labour",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "Rumbek Vocational Training Center",
      target: 16,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Labour",
      state: "Lakes",
      hq: "Rumbek",
      county: "Yirol West",
      site: "Yirol Vocational Training Center",
      target: 4,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Labour",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Malakal Vocational Training Center",
      target: 42,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Labour",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Maban",
      site: "Maban Vocational Training Center",
      target: 5,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Labour",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "Wau Vocational Training Center",
      target: 38,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Justice and Constitutional Affairs",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "State Office Torit - Non Legal",
      target: 8,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Justice and Constitutional Affairs",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "State Office Yambio",
      target: 13,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Justice and Constitutional Affairs",
      state: "Jonglei",
      hq: "Bor",
      county: "Bor South",
      site: "State Office Bor",
      target: 17,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Justice and Constitutional Affairs",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "State Office Rumbek",
      target: 14,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Justice and Constitutional Affairs",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "State Office Aweil",
      target: 22,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Justice and Constitutional Affairs",
      state: "Unity",
      hq: "Bentiu",
      county: "Mayendit",
      site: "State Office Bentiu",
      target: 4,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Justice and Constitutional Affairs",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "State Office Malakal",
      target: 14,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Justice and Constitutional Affairs",
      state: "Warrap",
      hq: "Kuajok",
      county: "Gogrial West",
      site: "State Office Kuajok",
      target: 22,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Justice and Constitutional Affairs",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "State Office Wau",
      target: 16,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Prisons Service",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Juba",
      site: "Juba Central Prison / NPS HQ",
      target: 4072,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Prisons Service",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Kajo-Keji",
      site: "Kajo-Keji Prison",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Prisons Service",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Terekeka",
      site: "Terekeka Prison",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Prisons Service",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Yei River",
      site: "Yei County Prison",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Prisons Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "Torit State Prison",
      target: 1845,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Prisons Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Magwi",
      site: "Magwi Prison",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Prisons Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Kapoeta South",
      site: "Kapoeta Prison",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Prisons Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "Yambio Central Prison",
      target: 2032,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Prisons Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Bor South",
      site: "Bor Prison",
      target: 4891,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Prisons Service",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "Rumbek Prison",
      target: 4326,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Prisons Service",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "Aweil Central Prison",
      target: 2998,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Prisons Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Rubkona",
      site: "Bentiu Prison",
      target: 3094,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Prisons Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Malakal Central Prison",
      target: 3268,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Prisons Service",
      state: "Warrap",
      hq: "Kuajok",
      county: "Tonj South",
      site: "Tonj Prison",
      target: 4050,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Prisons Service",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "Wau Central Prison",
      target: 2105,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Prisons Service",
      state: "Ruweng Administrative Area",
      hq: "Pariang",
      county: "Pariang",
      site: "Pariang Prison",
      target: 725,
      registered: null,
      completion: null,
    },
    {
      mda: "National Prisons Service",
      state: "Pibor Administrative Area",
      hq: "Pibor",
      county: "Pibor",
      site: "Pibor Prison",
      target: 1588,
      registered: null,
      completion: null,
    },
    {
      mda: "National Prisons Service",
      state: "Abyei Administrative Area",
      hq: "Abyei",
      county: "Abyei",
      site: "Abyei Prison",
      target: 613,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Juba",
      site: "County HQ",
      target: 26,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Civil Defense Service",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Lainya",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Morobo",
      site: "County HQ",
      target: 25,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Civil Defense Service",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Kajo-Keji",
      site: "County HQ",
      target: 49,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Civil Defense Service",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Terekeka",
      site: "County HQ",
      target: 192,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Civil Defense Service",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Yei River",
      site: "County HQ",
      target: 95,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Civil Defense Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Magwi",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Kapoeta East",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Kapoeta South",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Kapoeta North",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Ikotos",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Lafon",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Budi",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Tambura",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Nzara",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Maridi",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Mundri East",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Mundri West",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Mvolo",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Nagero",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Ibba",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Ezo",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Bor South",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Twic East",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Duk",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Nyirol",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Uror",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Akobo",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Ayod",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Fangak",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Canal/Pigi",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Pochalla",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Pibor",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek East",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek North",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Lakes",
      hq: "Rumbek",
      county: "Cueibet",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Lakes",
      hq: "Rumbek",
      county: "Wulu",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Lakes",
      hq: "Rumbek",
      county: "Yirol East",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Lakes",
      hq: "Rumbek",
      county: "Yirol West",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Lakes",
      hq: "Rumbek",
      county: "Awerial",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil East",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil North",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil South",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil West",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Rubkona",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Koch",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Leer",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Mayendit",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Panyijiar",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Abiemnhom",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Guit",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Mayom",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "County HQ",
      target: 1009,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Civil Defense Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Fashoda",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Manyo",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Renk",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Melut",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Baliet",
      site: "County HQ - Akoka",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Panyikang",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Longochuk",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Nasir/Malual Gahoth",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Maiwut",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Luakpiny/Nasir",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Ulang",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Maban",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Warrap",
      hq: "Kuajok",
      county: "Twic",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Warrap",
      hq: "Kuajok",
      county: "Gogrial West",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Warrap",
      hq: "Kuajok",
      county: "Gogrial East",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Warrap",
      hq: "Kuajok",
      county: "Tonj North",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Warrap",
      hq: "Kuajok",
      county: "Tonj South",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Warrap",
      hq: "Kuajok",
      county: "Tonj East",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "County HQ",
      target: 1166,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Civil Defense Service",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Jur River",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Raja",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Ruweng Administrative Area",
      hq: "Pariang",
      county: "Pariang",
      site: "County HQ",
      target: 535,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Ruweng Administrative Area",
      hq: "Pariang",
      county: "Abiemnom",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Pibor Administrative Area",
      hq: "Pibor",
      county: "Pibor",
      site: "County HQ",
      target: 1325,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Pibor Administrative Area",
      hq: "Pibor",
      county: "Lekuangole",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Pibor Administrative Area",
      hq: "Pibor",
      county: "Verteth",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Pibor Administrative Area",
      hq: "Pibor",
      county: "Gumuruk",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Civil Defense Service",
      state: "Abyei Administrative Area",
      hq: "Abyei",
      county: "Abyei",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Juba",
      site: "County Office",
      target: 117,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Morobo",
      site: "County Office",
      target: 159,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Kajo-Keji",
      site: "County Office",
      target: 51,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Terekeka",
      site: "County Office",
      target: 275,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Yei River",
      site: "County Office",
      target: 445,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "HQ",
      target: 585,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "County Office",
      target: 24,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Magwi",
      site: "County Office",
      target: 95,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Kapoeta East",
      site: "County Office",
      target: 14,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Kapoeta South",
      site: "County Office",
      target: 84,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Kapoeta North",
      site: "County Office",
      target: 11,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Ikotos",
      site: "County Office",
      target: 31,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Lafon",
      site: "County Office",
      target: 25,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Budi",
      site: "County Office",
      target: 36,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "HQ",
      target: 581,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "County Office",
      target: 59,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Tambura",
      site: "County Office",
      target: 80,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Nzara",
      site: "County Office",
      target: 10,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Maridi",
      site: "County Office",
      target: 181,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Mundri",
      site: "Mundri County HQ",
      target: 138,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Mundri East",
      site: "County Office - Kediba",
      target: 31,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Mundri West",
      site: "County Office - Mundri",
      target: 47,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Mvolo",
      site: "County Office",
      target: 41,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Nagero",
      site: "County Office",
      target: 20,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Ibba",
      site: "County Office",
      target: 23,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Ezo",
      site: "County Office",
      target: 38,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Jonglei",
      hq: "Bor",
      county: "Bor",
      site: "Bor HQ",
      target: 662,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Jonglei",
      hq: "Bor",
      county: "Bor",
      site: "Bor",
      target: 454,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Jonglei",
      hq: "Bor",
      county: "Twic East",
      site: "Panyakoor",
      target: 422,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Jonglei",
      hq: "Bor",
      county: "Duk",
      site: "Duk",
      target: 265,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Jonglei",
      hq: "Bor",
      county: "Nyirol",
      site: "Nyirol",
      target: 11,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Jonglei",
      hq: "Bor",
      county: "Uror",
      site: "Uror",
      target: 11,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Jonglei",
      hq: "Bor",
      county: "Akobo",
      site: "Akobo",
      target: 124,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Jonglei",
      hq: "Bor",
      county: "Ayod",
      site: "Ayod",
      target: 29,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Jonglei",
      hq: "Bor",
      county: "Fangak",
      site: "Old Fangak",
      target: 192,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Jonglei",
      hq: "Bor",
      county: "Canal/Pigi",
      site: "Wutlam",
      target: 91,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "HQ",
      target: 421,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "County Office",
      target: 321,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek East",
      site: "County Office",
      target: 279,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek North",
      site: "County Office",
      target: 107,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Lakes",
      hq: "Rumbek",
      county: "Cueibet",
      site: "County Office",
      target: 308,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Lakes",
      hq: "Rumbek",
      county: "Wulu",
      site: "County Office",
      target: 122,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Lakes",
      hq: "Rumbek",
      county: "Yirol East",
      site: "County Office",
      target: 69,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Lakes",
      hq: "Rumbek",
      county: "Yirol",
      site: "County Office",
      target: 355,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Lakes",
      hq: "Rumbek",
      county: "Awerial",
      site: "County Office",
      target: 131,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "HQ - Aweil and Aroyo",
      target: 460,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil East",
      site: "County Office - Wanyjok",
      target: 302,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil North",
      site: "County Office - Gokmachar",
      target: 213,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil South",
      site: "County Office -Malekalel",
      target: 166,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil West",
      site: "County Office - Nyamliel",
      target: 180,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Unity",
      hq: "Bentiu",
      county: "Bentiu TC",
      site: "HQ",
      target: 548,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Unity",
      hq: "Bentiu",
      county: "Rubkona",
      site: "County Office",
      target: 76,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Unity",
      hq: "Bentiu",
      county: "Koch",
      site: "County Office",
      target: 51,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Unity",
      hq: "Bentiu",
      county: "Leer",
      site: "County Office",
      target: 50,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Unity",
      hq: "Bentiu",
      county: "Mayendit",
      site: "County Office",
      target: 66,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Unity",
      hq: "Bentiu",
      county: "Panyijiar",
      site: "County Office",
      target: 6,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Unity",
      hq: "Bentiu",
      county: "Guit",
      site: "County Office",
      target: 34,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Unity",
      hq: "Bentiu",
      county: "Mayom",
      site: "County Office",
      target: 300,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Town Council HQ",
      target: 845,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "County Office - Malakal",
      target: 73,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Fashoda",
      site: "County Office - Kodok",
      target: 65,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Manyo",
      site: "County Office - Wadakona",
      target: 236,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Renk",
      site: "County Office - Renk",
      target: 110,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Melut",
      site: "County Office - Melut",
      target: 39,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Baliet",
      site: "County Office - Baliet",
      target: 101,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Panyikang",
      site: "County Office - Tonga",
      target: 79,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Longochuk",
      site: "County Office - Mathiang",
      target: 64,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Maiwut",
      site: "County Office - Maiwut",
      target: 730,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Luakpiny/Nasir",
      site: "County Office - Nasir",
      target: 117,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Ulang",
      site: "County Office - Ulang",
      target: 80,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Akoko",
      site: "County Office - Akoko",
      target: 14,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Maban",
      site: "County Office - Maban",
      target: 48,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Warrap",
      hq: "Kuajok",
      county: "Kuajok",
      site: "HQ",
      target: 332,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Warrap",
      hq: "Kuajok",
      county: "Twic",
      site: "County Office - Turalei",
      target: 193,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Warrap",
      hq: "Kuajok",
      county: "Gogrial West",
      site: "County Office - Gogrial",
      target: 126,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Warrap",
      hq: "Kuajok",
      county: "Gogrial East",
      site: "County Office - Lietnhom",
      target: 172,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Warrap",
      hq: "Kuajok",
      county: "Tonj North",
      site: "County Office - Warrap",
      target: 145,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Warrap",
      hq: "Kuajok",
      county: "Tonj South",
      site: "County Office - Tonji",
      target: 174,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Warrap",
      hq: "Kuajok",
      county: "Tonj East",
      site: "County Office - Romic",
      target: 81,
      registered: null,
      completion: 0,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Ruweng Administrative Area",
      hq: "Pariang",
      county: "Pariang",
      site: "HQ",
      target: 493,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Ruweng Administrative Area",
      hq: "Pariang",
      county: "Blemnhom",
      site: "County Office",
      target: 94,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Ruweng Administrative Area",
      hq: "Pariang",
      county: "Jamjang",
      site: "County Office",
      target: 22,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Ruweng Administrative Area",
      hq: "Pariang",
      county: "Lake NO",
      site: "County Office",
      target: 19,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Ruweng Administrative Area",
      hq: "Pariang",
      county: "Tuoch",
      site: "County Office",
      target: 15,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Ruweng Administrative Area",
      hq: "Pariang",
      county: "Aliny",
      site: "County Office",
      target: 9,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Ruweng Administrative Area",
      hq: "Pariang",
      county: "Jau",
      site: "County Office",
      target: 14,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Ruweng Administrative Area",
      hq: "Pariang",
      county: "Wunkur",
      site: "County Office",
      target: 12,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Pibor Administrative Area",
      hq: "Pibor",
      county: "Pibor",
      site: "HQ",
      target: 689,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Pibor Administrative Area",
      hq: "Pibor",
      county: "Pibor",
      site: "County Office",
      target: 103,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Pibor Administrative Area",
      hq: "Pibor",
      county: "Lekuangole",
      site: "County Office",
      target: 203,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Pibor Administrative Area",
      hq: "Pibor",
      county: "Jebel Boma",
      site: "County Office",
      target: 42,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Pibor Administrative Area",
      hq: "Pibor",
      county: "Pashal South",
      site: "County Office - Pashala",
      target: 205,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Pibor Administrative Area",
      hq: "Pibor",
      county: "Pashal North",
      site: "County Office - Opotalo",
      target: 232,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Pibor Administrative Area",
      hq: "Pibor",
      county: "Verteth",
      site: "County Office",
      target: 127,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Pibor Administrative Area",
      hq: "Pibor",
      county: "Gumuruk",
      site: "County Office",
      target: 23,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Abyei Administrative Area",
      hq: "Abyei",
      county: "Abyei",
      site: "HQ - Abyei",
      target: 157,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Abyei Administrative Area",
      hq: "Abyei",
      county: "Alal",
      site: "County Office - Alal",
      target: 35,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Abyei Administrative Area",
      hq: "Abyei",
      county: "Majak",
      site: "County Office - Majak",
      target: 49,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Abyei Administrative Area",
      hq: "Abyei",
      county: "Rumameer",
      site: "County Office - Awal",
      target: 50,
      registered: null,
      completion: null,
    },
    {
      mda: "Ministry of Wildlife Conservation and Tourism",
      state: "Abyei Administrative Area",
      hq: "Abyei",
      county: "Amethaguok",
      site: "Country Office- Abyei",
      target: 30,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Juba",
      site: "County HQ",
      target: 6377,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Police Service",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Lainya",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Morobo",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Kajo-Keji",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Terekeka",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Yei River",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "County HQ",
      target: 4067,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Police Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Magwi",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Kapoeta East",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Kapoeta South",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Kapoeta North",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Ikotos",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Lafon",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Budi",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "County HQ",
      target: 5355,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Police Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Tambura",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Nzara",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Maridi",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Mundri East",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Mundri West",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Mvolo",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Nagero",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Ibba",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Ezo",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Bor South",
      site: "County HQ",
      target: 8483,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Police Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Twic East",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Duk",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Nyirol",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Uror",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Akobo",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Ayod",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Fangak",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Canal/Pigi",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Pochalla",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Jonglei",
      hq: "Bor",
      county: "Pibor",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "County HQ",
      target: 10689,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Police Service",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek East",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek North",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Lakes",
      hq: "Rumbek",
      county: "Cueibet",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Lakes",
      hq: "Rumbek",
      county: "Wulu",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Lakes",
      hq: "Rumbek",
      county: "Yirol East",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Lakes",
      hq: "Rumbek",
      county: "Yirol West",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Lakes",
      hq: "Rumbek",
      county: "Awerial",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "County HQ",
      target: 6385,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Police Service",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil East",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil North",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil South",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil West",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Bentiu",
      site: "HQ",
      target: 5588,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Police Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Rubkona",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Koch",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Leer",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Mayendit",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Panyijiar",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Abiemnhom",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Guit",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Unity",
      hq: "Bentiu",
      county: "Mayom",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "County HQ",
      target: 8303,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Police Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Fashoda",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Manyo",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Renk",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Melut",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Baliet",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Panyikang",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Longochuk",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Maiwut",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Luakpiny/Nasir",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Ulang",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Maban",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Warrap",
      hq: "Kuajok",
      county: "Kuajok",
      site: "County HQ",
      target: 10433,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Police Service",
      state: "Warrap",
      hq: "Kuajok",
      county: "Twic",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Warrap",
      hq: "Kuajok",
      county: "Gogrial West",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Warrap",
      hq: "Kuajok",
      county: "Gogrial East",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Warrap",
      hq: "Kuajok",
      county: "Tonj North",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Warrap",
      hq: "Kuajok",
      county: "Tonj South",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Warrap",
      hq: "Kuajok",
      county: "Tonj East",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "County HQ",
      target: 6292,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Police Service",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Jur River",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Raja",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Ruweng Administrative Area",
      hq: "Pariang",
      county: "Pariang",
      site: "County HQ",
      target: 2763,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Ruweng Administrative Area",
      hq: "Pariang",
      county: "Abiemnom",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Pibor Administrative Area",
      hq: "Pibor",
      county: "Pibor",
      site: "County HQ",
      target: 2374,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Pibor Administrative Area",
      hq: "Pibor",
      county: "Lekuangole",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Pibor Administrative Area",
      hq: "Pibor",
      county: "Verteth",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Pibor Administrative Area",
      hq: "Pibor",
      county: "Gumuruk",
      site: "County HQ",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "National Police Service",
      state: "Abyei Administrative Area",
      hq: "Abyei",
      county: "Abyei",
      site: "County HQ",
      target: 1370,
      registered: null,
      completion: null,
    },
    {
      mda: "National Bureau of Statistics",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "Ten State Office Torit",
      target: 11,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Bureau of Statistics",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "Ten State Office Yambio",
      target: 10,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Bureau of Statistics",
      state: "Jonglei",
      hq: "Bor",
      county: "Bor South",
      site: "Ten State Office  Bor Town",
      target: 9,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Bureau of Statistics",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "Ten State Office Rumbek",
      target: 14,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Bureau of Statistics",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "Ten State Office Aweil",
      target: 10,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Bureau of Statistics",
      state: "Unity",
      hq: "Bentiu",
      county: "Abiemnhom",
      site: "Ten State Office Unity",
      target: 12,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Bureau of Statistics",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Malakal Center",
      target: 12,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Bureau of Statistics",
      state: "Warrap",
      hq: "Kuajok",
      county: "Twic",
      site: "Ten state office Kaujok",
      target: 11,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Bureau of Statistics",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "Ten State Office Wau",
      target: 11,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Bureau of Statistics",
      state: "Ruweng Administrative Area",
      hq: "Pariang",
      county: "Abiemnhom",
      site: "Ruweng headquater",
      target: 5,
      registered: null,
      completion: null,
    },
    {
      mda: "National Bureau of Statistics",
      state: "Abyei Administrative Area",
      hq: "Abyei",
      county: "Abyei",
      site: "Abyei Center",
      target: 5,
      registered: null,
      completion: null,
    },
    {
      mda: "National Bureau of Standards",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Magwi",
      site: "Nimule",
      target: 53,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Bureau of Standards",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Malakal Center",
      target: 15,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Bureau of Standards",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Renk",
      site: "Renk Town",
      target: 15,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Bureau of Standards",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "Wau Center",
      target: 50,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Electricity Corporation",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "Power Station",
      target: 18,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Electricity Corporation",
      state: "Jonglei",
      hq: "Bor",
      county: "Bor South",
      site: "Power Station",
      target: 38,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Electricity Corporation",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "Power Station",
      target: 19,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Electricity Corporation",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Power Staion",
      target: 91,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Electricity Corporation",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Renk",
      site: "Power Station",
      target: 27,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Electricity Corporation",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "Power Station",
      target: 94,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Urban Water Corporation",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Maridi",
      site: "Water Station Maridi Town",
      target: 6,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Urban Water Corporation",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Water Station Malakal Town",
      target: 20,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Urban Water Corporation",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Renk",
      site: "Water Station  Labarotti",
      target: 24,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Urban Water Corporation",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "Water Station Town",
      target: 36,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS HIV/AIDS Commission",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "State office torit Town",
      target: 4,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS HIV/AIDS Commission",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "Yambio Town",
      target: 13,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS HIV/AIDS Commission",
      state: "Jonglei",
      hq: "Bor",
      county: "Bor South",
      site: "Bor Town",
      target: 11,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS HIV/AIDS Commission",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "State office Rumbek",
      target: 8,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS HIV/AIDS Commission",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "State office Aweil",
      target: 13,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS HIV/AIDS Commission",
      state: "Unity",
      hq: "Bentiu",
      county: "Mayendit",
      site: "State office Bentiu",
      target: 7,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS HIV/AIDS Commission",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "State office Malakal",
      target: 6,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS HIV/AIDS Commission",
      state: "Warrap",
      hq: "Kuajok",
      county: "Twic",
      site: "State office Kaujok",
      target: 13,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS HIV/AIDS Commission",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "State office Wau",
      target: 8,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Peace Commission",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "State Coordination office Torit",
      target: 1,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Peace Commission",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "State Coordination office Yambio",
      target: 5,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Peace Commission",
      state: "Jonglei",
      hq: "Bor",
      county: "Twic East",
      site: "State Coordination office Bor Town",
      target: 5,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Peace Commission",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "State Coordination office Rumbek",
      target: 4,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Peace Commission",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "State Coordination office Aweil",
      target: 4,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Peace Commission",
      state: "Unity",
      hq: "Bentiu",
      county: "Panyijiar",
      site: "State Coordination office Bentiu",
      target: 3,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Peace Commission",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "State Coordination office Malakal",
      target: 4,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Peace Commission",
      state: "Warrap",
      hq: "Kuajok",
      county: "Twic",
      site: "State Coordination office Kaujok",
      target: 2,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Peace Commission",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "State Coordination office Wau",
      target: 3,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Broadcasting Commission",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Malakal Center",
      target: 49,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Broadcasting Commission",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "Wau Center",
      target: 57,
      registered: null,
      completion: 0,
    },
    {
      mda: "Judiciary of South Sudan",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Juba",
      site: "Supreme Court Headquarters",
      target: 170,
      registered: null,
      completion: 0,
    },
    {
      mda: "Judiciary of South Sudan",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Juba",
      site: "Greater Equatoria Circuit",
      target: 372,
      registered: null,
      completion: null,
    },
    {
      mda: "Judiciary of South Sudan",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Greater Upper Nile Circuit",
      target: 194,
      registered: null,
      completion: 0,
    },
    {
      mda: "Judiciary of South Sudan",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "Greater Bahr-El-Ghazal Circuit",
      target: 321,
      registered: null,
      completion: 0,
    },
    {
      mda: "Human Rights Commission",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "State Office Torit Town",
      target: 4,
      registered: null,
      completion: 0,
    },
    {
      mda: "Human Rights Commission",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "State Office Yambio",
      target: 3,
      registered: null,
      completion: 0,
    },
    {
      mda: "Human Rights Commission",
      state: "Jonglei",
      hq: "Bor",
      county: "Bor South",
      site: "State Office Bor Town",
      target: 3,
      registered: null,
      completion: 0,
    },
    {
      mda: "Human Rights Commission",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "State Office Rumbek",
      target: 3,
      registered: null,
      completion: 0,
    },
    {
      mda: "Human Rights Commission",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "State Office  Aweil Center",
      target: 3,
      registered: null,
      completion: 0,
    },
    {
      mda: "Human Rights Commission",
      state: "Unity",
      hq: "Bentiu",
      county: "Panyijiar",
      site: "State Office  Bebtiu",
      target: 3,
      registered: null,
      completion: 0,
    },
    {
      mda: "Human Rights Commission",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "State Offic Malakal",
      target: 3,
      registered: null,
      completion: 0,
    },
    {
      mda: "Human Rights Commission",
      state: "Warrap",
      hq: "Kuajok",
      county: "Twic",
      site: "State Office Center",
      target: 3,
      registered: null,
      completion: 0,
    },
    {
      mda: "Human Rights Commission",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "State Office Wau",
      target: 4,
      registered: null,
      completion: 0,
    },
    {
      mda: "Commission for Refugee Affairs",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Yei River",
      site: "State Office Yei",
      target: 6,
      registered: null,
      completion: 0,
    },
    {
      mda: "Commission for Refugee Affairs",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "State Office Yambio",
      target: 7,
      registered: null,
      completion: 0,
    },
    {
      mda: "Commission for Refugee Affairs",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "State Office Aweil",
      target: 3,
      registered: null,
      completion: 0,
    },
    {
      mda: "Commission for Refugee Affairs",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Renk",
      site: "State Office Renk",
      target: 3,
      registered: null,
      completion: 0,
    },
    {
      mda: "Commission for Refugee Affairs",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Maban",
      site: "State office Maban",
      target: 3,
      registered: null,
      completion: 0,
    },
    {
      mda: "Commission for Refugee Affairs",
      state: "Ruweng Administrative Area",
      hq: "Pariang",
      county: "Pariang",
      site: "Ruweng Center",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "SS Disarmament, Demobilization and Reintegration Commission",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "State Office Torit",
      target: 9,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Disarmament, Demobilization and Reintegration Commission",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "State Office Yambio",
      target: 11,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Disarmament, Demobilization and Reintegration Commission",
      state: "Jonglei",
      hq: "Bor",
      county: "Bor South",
      site: "State Office Bor Town",
      target: 8,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Disarmament, Demobilization and Reintegration Commission",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "State Office Rumbek",
      target: 8,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Disarmament, Demobilization and Reintegration Commission",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "State Office  Aweil",
      target: 11,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Disarmament, Demobilization and Reintegration Commission",
      state: "Unity",
      hq: "Bentiu",
      county: "Mayendit",
      site: "State Office Bentiu",
      target: 9,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Disarmament, Demobilization and Reintegration Commission",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "State Office Malakal",
      target: 8,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Disarmament, Demobilization and Reintegration Commission",
      state: "Warrap",
      hq: "Kuajok",
      county: "Twic",
      site: "State Office Kaujok",
      target: 9,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Disarmament, Demobilization and Reintegration Commission",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "State Office Wau Toewn",
      target: 11,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Disarmament, Demobilization and Reintegration Commission",
      state: "Ruweng Administrative Area",
      hq: "Pariang",
      county: "Pariang",
      site: "Ruweng Center",
      target: 3,
      registered: null,
      completion: null,
    },
    {
      mda: "SS Relief and Rehabilitation Commission",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "Torit Town",
      target: 7,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Relief and Rehabilitation Commission",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "Yambion Town",
      target: 7,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Relief and Rehabilitation Commission",
      state: "Jonglei",
      hq: "Bor",
      county: "Bor South",
      site: "Bor Town",
      target: 7,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Relief and Rehabilitation Commission",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "Rumbek Town",
      target: 7,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Relief and Rehabilitation Commission",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "Aweil",
      target: 7,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Relief and Rehabilitation Commission",
      state: "Unity",
      hq: "Bentiu",
      county: "Mayendit",
      site: "Bentiu Town",
      target: 7,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Relief and Rehabilitation Commission",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Malakal Town",
      target: 7,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Relief and Rehabilitation Commission",
      state: "Warrap",
      hq: "Kuajok",
      county: "Gogrial East",
      site: "kaujok",
      target: 7,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Relief and Rehabilitation Commission",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "Wau Town",
      target: 7,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS War Disabled and Orphan Commission",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "Torit Town",
      target: 2,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS War Disabled and Orphan Commission",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "Yambion Town",
      target: 2,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS War Disabled and Orphan Commission",
      state: "Jonglei",
      hq: "Bor",
      county: "Akobo",
      site: "Bor Town",
      target: 1,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS War Disabled and Orphan Commission",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "Rumbek Town",
      target: 1,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS War Disabled and Orphan Commission",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Malalkal Town",
      target: 1,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS War Disabled and Orphan Commission",
      state: "Warrap",
      hq: "Kuajok",
      county: "Gogrial East",
      site: "kaujok",
      target: 2,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS War Disabled and Orphan Commission",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "Wau Town",
      target: 2,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Mine Action Authority",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Yei River",
      site: "Logobero",
      target: 5,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Mine Action Authority",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Malakal  IDPS Camp",
      target: 4,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Mine Action Authority",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "Wau Town",
      target: 17,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Elections Commission",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "Torit Center",
      target: 10,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Elections Commission",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "Yambio center",
      target: 8,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Elections Commission",
      state: "Jonglei",
      hq: "Bor",
      county: "Bor South",
      site: "Bor Center",
      target: 8,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Elections Commission",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "Rumbek Center",
      target: 9,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Elections Commission",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "Aweil Center",
      target: 7,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Elections Commission",
      state: "Unity",
      hq: "Bentiu",
      county: "Mayendit",
      site: "Bentiu Center",
      target: 9,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Elections Commission",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Malakal Center",
      target: 15,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Elections Commission",
      state: "Warrap",
      hq: "Kuajok",
      county: "Twic",
      site: "Kuajok",
      target: 9,
      registered: null,
      completion: 0,
    },
    {
      mda: "National Elections Commission",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "Wau Center",
      target: 6,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Revenue Authority",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Juba",
      site: "Juba International Airport Customs",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "SS Revenue Authority",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Morobo",
      site: "Kaya Border Post",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "SS Revenue Authority",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Yei River",
      site: "Yei Customs Office",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "SS Revenue Authority",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "Torit Customs Office",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "SS Revenue Authority",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Magwi",
      site: "Nimule One Stop Border Post",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "SS Revenue Authority",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Kapoeta East",
      site: "Nadapal Border Post",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "SS Revenue Authority",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "Yambio Customs Office",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "SS Revenue Authority",
      state: "Jonglei",
      hq: "Bor",
      county: "Bor South",
      site: "Bor Customs Office",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "SS Revenue Authority",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "Rumbek Customs Office",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "SS Revenue Authority",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Renk",
      site: "Renk Customs Office",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "SS Revenue Authority",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "Wau Customs Office",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "SS Anti-Corruption Commission",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "Sate Coordination Officer",
      target: 2,
      registered: null,
      completion: 0,
    },
    {
      mda: "SS Anti-Corruption Commission",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "State Coordination Officer",
      target: 5,
      registered: null,
      completion: 0,
    },
    {
      mda: "Directorate of Civil Registry, Nationality, Passport and Immigration",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Juba",
      site: "Juba International Airport Immigration",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "Directorate of Civil Registry, Nationality, Passport and Immigration",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Morobo",
      site: "Kaya Border Immigration Post",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "Directorate of Civil Registry, Nationality, Passport and Immigration",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Kajo-Keji",
      site: "Kajo Keji Immigration Point",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "Directorate of Civil Registry, Nationality, Passport and Immigration",
      state: "Central Equatoria",
      hq: "Juba",
      county: "Yei River",
      site: "Yei Immigration Office",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "Directorate of Civil Registry, Nationality, Passport and Immigration",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Torit",
      site: "Torit Immigration Office",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "Directorate of Civil Registry, Nationality, Passport and Immigration",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Magwi",
      site: "Nimule Border Immigration Post",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "Directorate of Civil Registry, Nationality, Passport and Immigration",
      state: "Eastern Equatoria",
      hq: "Torit",
      county: "Kapoeta East",
      site: "Nadapal Border Immigration Post",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "Directorate of Civil Registry, Nationality, Passport and Immigration",
      state: "Western Equatoria",
      hq: "Yambio",
      county: "Yambio",
      site: "Yambio Immigration Office",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "Directorate of Civil Registry, Nationality, Passport and Immigration",
      state: "Jonglei",
      hq: "Bor",
      county: "Bor South",
      site: "Bor Immigration Office",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "Directorate of Civil Registry, Nationality, Passport and Immigration",
      state: "Lakes",
      hq: "Rumbek",
      county: "Rumbek Centre",
      site: "Rumbek Immigration Office",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "Directorate of Civil Registry, Nationality, Passport and Immigration",
      state: "Northern Bahr el Ghazal",
      hq: "Aweil",
      county: "Aweil Centre",
      site: "Aweil Immigration Office",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "Directorate of Civil Registry, Nationality, Passport and Immigration",
      state: "Unity",
      hq: "Bentiu",
      county: "Rubkona",
      site: "Bentiu Immigration Office",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "Directorate of Civil Registry, Nationality, Passport and Immigration",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Malakal",
      site: "Malakal Immigration Office",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "Directorate of Civil Registry, Nationality, Passport and Immigration",
      state: "Upper Nile",
      hq: "Malakal",
      county: "Renk",
      site: "Renk Immigration Office",
      target: null,
      registered: null,
      completion: null,
    },
    {
      mda: "Directorate of Civil Registry, Nationality, Passport and Immigration",
      state: "Western Bahr el Ghazal",
      hq: "Wau",
      county: "Wau",
      site: "Wau Immigration Office",
      target: null,
      registered: null,
      completion: null,
    },
  ];
  const normSiteName = (v) =>
    String(v || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  {
    const _ks = new Set(
      importedRegistrationSites.map((r) =>
        [String(r.site || "").trim(), r.mda, r.state, r.county].map(normSiteName).join("|"),
      ),
    );
    for (let j = SITES.length - 1; j >= 0; j--)
      if (SITES[j]._excelKey && !_ks.has(SITES[j]._excelKey)) SITES.splice(j, 1);
  }
  importedRegistrationSites.forEach((r, idx) => {
    const countyName = String(r.county || r.hq || "").trim();
    const stateName = String(r.state || "").trim();
    const stateIndex = DATA.findIndex((d) => K(d.n) === K(stateName));
    const countyObj = COUNTIES.find(
      (c) => K(c.n) === K(countyName) && (stateIndex < 0 || c.si === stateIndex),
    );
    const stateObj = stateIndex >= 0 ? DATA[stateIndex] : DATA.find((d) => K(d.n) === K(stateName));
    const fallbackCounty = COUNTIES.find((c) => stateObj && c.si === DATA.indexOf(stateObj));
    const geo = (countyObj && countyObj.hq) ||
      (fallbackCounty && fallbackCounty.hq) || [31.6, 4.85];
    const siteName = String(r.site || "").trim();
    if (!siteName) return;
    const key = [siteName, r.mda, r.state, r.county].map(normSiteName).join("|");
    if (SITES.some((x) => x._excelKey === key)) return;
    SITES.push({
      id: "excel-site-" + idx,
      name: siteName,
      mda: String(r.mda || ""),
      status: "Planned",
      cap: Number(r.target) || 0,
      lon: Number(geo[0]),
      lat: Number(geo[1]),
      note: "",
      _excelKey: key,
      registered: r.registered,
      completion: r.completion,
      _st: stateName,
      _cn: countyObj ? countyObj.n : countyName,
    });
  });
  const lg = document.querySelector(".legend");
  SHOWST = false;
  [["gs", "Registration sites"]].forEach(([id, t]) => {
    const l = document.createElement("label");
    l.innerHTML = `<input type="checkbox"> ${t}`;
    $("#" + id).classList.add("hide");
    l.firstChild.onchange = (e) => $("#" + id).classList.toggle("hide", !e.target.checked);
    lg.append(l);
  });
  {
    const l = document.createElement("label");
    l.innerHTML = `<input type="checkbox" id="showStNames"> State names`;
    const cb = l.firstChild;
    cb.checked = false;
    cb.onchange = () => {
      SHOWST = cb.checked;
      lk = "";
      updLabels();
    };
    lg.append(l);
  }
  const og = $("#gj").onchange;
  $("#gj").onchange = async (e) => {
    await og(e);
    CVER++;
    COUNTIES.forEach((c) => {
      c.geo = 1;
      if (!c.hq && c.poly.length)
        c.hq = [
          c.poly.reduce((a, q) => a + q[0], 0) / c.poly.length,
          c.poly.reduce((a, q) => a + q[1], 0) / c.poly.length,
        ];
    });
    drawCounties();
    if (TOOL === "edit") drawHandles();
  };
  refresh(true);
})();
function fitAR() {
  const r = svg.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const ar = r.height / r.width;
  if (Math.abs(ar - AR) < 0.004 && !fitAR.i) return;
  fitAR.i = 0;
  const full = Math.abs(V[2] - V0[2]) < 1.5;
  AR = ar;
  V0.splice(0, 4, ...adj([0, 0, 600, 470]));
  if (full || V[2] > V0[2]) {
    V = V0.slice();
  } else {
    const cx = V[0] + V[2] / 2,
      cy = V[1] + V[3] / 2,
      w = V[2],
      h = w * AR,
      c = cl2(cx - w / 2, cy - h / 2, w, h);
    V = [c[0], c[1], w, h];
  }
  if (tv) tv = view !== null ? adj(fit(bb(DATA[view]))) : V0.slice();
  setV();
  lk = "";
}
fitAR.i = 1;
if (window.ResizeObserver) new ResizeObserver(fitAR).observe(svg);
addEventListener("resize", fitAR);
fitAR();
drawCounties();
document
  .querySelector('.legend input[data-g="gy"]')
  .addEventListener("change", (e) => $("#gcl").classList.toggle("hide", !e.target.checked));
render();

/* Navigation reliability: make Overview/Map/Explorer links and hero links consistently respond. */
document.querySelectorAll('.links a[href^="#"], .cta a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const hr = a.getAttribute("href");
    const target = hr && hr.length > 1 ? document.querySelector(hr) : null;
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    if (a.closest(".links"))
      document.querySelectorAll(".links a").forEach((x) => x.classList.toggle("on", x === a));
    history.replaceState(null, "", a.getAttribute("href"));
  });
});
