/*
 * js/apex-charts-bridge.js
 * Draws every bar, area, donut, pie and gauge chart with ApexCharts (reads data-apx attributes).
 */

/* ApexCharts bridge: chart functions return a placeholder, this script draws the chart when it becomes visible */
(function () {
  var live = [],
    GREY = "rgba(127,127,160,.25)";
  function res(c) {
    var p = document.createElement("i");
    p.style.color = c;
    document.body.appendChild(p);
    var r = getComputedStyle(p).color;
    p.remove();
    return r;
  }
  function num(v) {
    return Number(v || 0).toLocaleString("en-US");
  }
  window.apxEl = function (c, h, w) {
    return (
      '<div class="apx" data-apx="' +
      JSON.stringify(c).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;") +
      '" style="min-height:' +
      h +
      "px;" +
      (w ? "width:" + w + "px;max-width:100%" : "") +
      '" data-h="' +
      h +
      '"></div>'
    );
  };
  function base(el, c) {
    var fg = getComputedStyle(el).color,
      h = +el.dataset.h || 220;
    return {
      chart: {
        type: "bar",
        height: h,
        width: "100%",
        toolbar: { show: false },
        fontFamily: "inherit",
        foreColor: fg,
        background: "transparent",
        animations: { enabled: true, speed: 350 },
        zoom: { enabled: false },
      },
      grid: { borderColor: GREY, strokeDashArray: 3 },
      dataLabels: { enabled: false },
      legend: { show: false },
      tooltip: {
        theme: "dark",
        y: {
          title: {
            formatter: function () {
              return "";
            },
          },
        },
      },
    };
  }
  function axes(o, c, fg) {
    o.xaxis = {
      categories: c.cats,
      labels: { style: { fontSize: "10px", colors: fg }, rotate: 0, hideOverlappingLabels: true },
      axisBorder: { color: GREY },
      axisTicks: { show: false },
      tooltip: { enabled: false },
    };
    if (c.cats.length > 12) o.xaxis.tickAmount = 12;
    o.yaxis = {
      min: 0,
      forceNiceScale: true,
      labels: {
        style: { fontSize: "10px", colors: fg },
        formatter: function (v) {
          return num(Math.round(v));
        },
      },
    };
    o.tooltip.x = {
      formatter: function (v, x) {
        return (c.tt && c.tt[x.dataPointIndex]) || v;
      },
    };
    o.tooltip.y.formatter = function (v) {
      return num(v);
    };
  }
  function build(el, c) {
    var fg = getComputedStyle(el).color,
      o = base(el, c),
      col = c.col ? res(c.col) : res("var(--v)");
    if (c.t === "bar") {
      o.chart.type = "bar";
      o.series = [{ name: "Registrations", data: c.data }];
      o.colors = [col];
      o.plotOptions = {
        bar: { borderRadius: 3, columnWidth: "68%", dataLabels: { position: "top" } },
      };
      if (c.click) {
        o.plotOptions.bar.distributed = true;
        o.colors = c.data.map(function (_, i) {
          return i === c.sel ? res("var(--g)") : col;
        });
        o.states = { active: { filter: { type: "none" } } };
        o.chart.events = {
          dataPointSelection: function (e, ch, cfg) {
            document.dispatchEvent(
              new CustomEvent("apx-pick", {
                detail: { kind: c.click, key: c.keys[cfg.dataPointIndex] },
              }),
            );
          },
        };
      }
      o.dataLabels = {
        enabled: !!c.dl,
        offsetY: -18,
        style: { fontSize: "10px", colors: [fg] },
        formatter: function (v) {
          return v ? num(v) : "";
        },
      };
      axes(o, c, fg);
    } else if (c.t === "area") {
      o.chart.type = "area";
      o.series = [{ name: "Registrations", data: c.data }];
      o.colors = [col];
      o.stroke = { width: 2.5, curve: "straight" };
      o.fill = { type: "solid", opacity: 0.18 };
      o.markers = { size: 0, hover: { size: 5 } };
      axes(o, c, fg);
    } else if (c.t === "donut" || c.t === "pie") {
      var vals = c.vals.map(Number),
        tot = vals.reduce(function (a, b) {
          return a + b;
        }, 0),
        labels = c.labels,
        cols = c.cols.map(res);
      if (!labels) {
        var dn = el.closest(".dn"),
          rows = dn ? dn.querySelectorAll(".hb") : [],
          nz = 0;
        labels = vals.map(function (v, i) {
          var r = rows.length === vals.length ? rows[i] : rows[nz];
          if (v) nz++;
          var sp = r && r.querySelector("span:not(.ht)");
          return sp ? sp.textContent.trim() : "Item " + (i + 1);
        });
      }
      if (!tot) {
        vals = [1];
        cols = [GREY];
        labels = ["No data"];
      }
      o.chart.type = "donut";
      o.series = vals;
      o.labels = labels;
      o.colors = cols;
      o.stroke = {
        width: 1.5,
        colors: [getComputedStyle(document.body).backgroundColor || "#fff"],
      };
      o.plotOptions = {
        pie: {
          donut: {
            size: c.t === "pie" ? "45%" : "68%",
            labels: {
              show: c.t === "donut" && !!tot,
              name: { show: true, fontSize: "10px", offsetY: 14, color: fg },
              value: {
                show: true,
                fontSize: "22px",
                fontWeight: 800,
                offsetY: -16,
                color: fg,
                formatter: function () {
                  return c.ctr;
                },
              },
              total: {
                show: true,
                showAlways: true,
                label: c.sub || "",
                fontSize: "10px",
                color: fg,
                formatter: function () {
                  return c.ctr;
                },
              },
            },
          },
        },
      };
      o.dataLabels = {
        enabled: c.t === "pie" && !!tot,
        dropShadow: { enabled: false },
        style: { fontSize: "13px", fontWeight: 700 },
        formatter: function (p, x) {
          return x.w.config.series[x.seriesIndex];
        },
      };
      o.tooltip = {
        theme: "dark",
        y: {
          formatter: function (v, x) {
            var p = tot ? Math.round((v / tot) * 100) : 0;
            return tot ? num(v) + (c.unit || "") + " (" + p + "%)" : "";
          },
        },
      };
      o.chart.height = +el.dataset.h;
    } else if (c.t === "gauge") {
      o.chart.type = "radialBar";
      o.series = [Math.max(0, Math.min(100, c.v))];
      o.colors = [col];
      o.labels = [c.label || ""];
      o.plotOptions = {
        radialBar: {
          startAngle: -90,
          endAngle: 90,
          hollow: { size: "60%" },
          track: { background: GREY, strokeWidth: "100%" },
          dataLabels: {
            name: { show: !!c.label, offsetY: 8, fontSize: "11px", fontWeight: 700, color: col },
            value: {
              show: !!c.show,
              offsetY: -22,
              fontSize: "30px",
              fontWeight: 800,
              color: fg,
              formatter: function () {
                return String(c.text != null ? c.text : Math.round(c.v));
              },
            },
          },
        },
      };
      o.stroke = { lineCap: "round" };
      o.chart.height = +el.dataset.h;
      o.tooltip = { enabled: false };
    }
    return o;
  }
  function draw(el) {
    if (el.dataset.done) return;
    el.dataset.done = 1;
    live = live.filter(function (ch) {
      if (ch.el.isConnected) return true;
      try {
        ch.destroy();
      } catch (e) {}
      return false;
    });
    try {
      var c = JSON.parse(el.dataset.apx);
      if (c.click) el.classList.add("clk");
      if (c.hint) el.title = c.hint;
      var ch = new ApexCharts(el, build(el, c));
      ch.render();
      live.push(ch);
    } catch (e) {
      console.warn("apex", e);
      el.dataset.done = "";
    }
  }
  var io = new IntersectionObserver(
    function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          io.unobserve(e.target);
          draw(e.target);
        }
      });
    },
    { rootMargin: "100px" },
  );
  function scan() {
    document.querySelectorAll(".apx:not([data-done]):not([data-q])").forEach(function (el) {
      el.dataset.q = 1;
      io.observe(el);
    });
  }
  var t = 0;
  new MutationObserver(function () {
    cancelAnimationFrame(t);
    t = requestAnimationFrame(scan);
  }).observe(document.documentElement, { childList: true, subtree: true });
  new MutationObserver(function () {
    setTimeout(function () {
      live.forEach(function (ch) {
        var el = ch.el;
        try {
          ch.destroy();
        } catch (e) {}
        if (el.isConnected) {
          el.innerHTML = "";
          delete el.dataset.done;
          delete el.dataset.q;
        }
      });
      live = [];
      scan();
    }, 200);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  document.addEventListener("DOMContentLoaded", scan);
  scan();
})();
