/*
 * js/road-visibility.js
 * Show or hide road lines on the map.
 */

(function () {
  const all = (sel) => Array.from(document.querySelectorAll(sel));
  function syncLayer(id, visible) {
    all('[id="' + id + '"], [id="grh"]').forEach((g) => {
      if (id === "grd" && g.id !== "grd" && g.id !== "grh") return;
      g.classList.toggle("hide", !visible);
    });
  }
  // Show cities by default; keep towns hidden until zoomed in and enabled.
  all('input[data-g="gc"], input[data-g="gt"]').forEach((input) => {
    if (input.dataset.g === "gc") {
      input.checked = true;
      const group = document.getElementById(input.dataset.g);
      if (group) group.classList.remove("hide");
    } else {
      input.checked = false;
      const group = document.getElementById(input.dataset.g);
      if (group) group.classList.add("hide");
    }
    input.addEventListener("change", () => {
      const g = document.getElementById(input.dataset.g);
      if (g) g.classList.toggle("hide", !input.checked);
    });
  });
  // The state selection creates a road-highlight overlay. Keep the Main roads
  // control connected to both the base roads and that overlay.
  all(".legend label").forEach((label) => {
    if (!label.textContent.trim().includes("Main roads")) return;
    const input = label.querySelector("input");
    if (!input) return;
    const apply = () => {
      all('[id="grd"], #grh').forEach((g) => g.classList.toggle("hide", !input.checked));
    };
    input.addEventListener("change", apply);
    apply();
  });
})();
