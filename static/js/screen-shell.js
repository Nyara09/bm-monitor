// The small script every Django page uses: dark/light mode and the sidebar button.
const shell = document.getElementById("adm");

document.getElementById("snth").onclick = () => {
  const next =
    document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("bioreg.theme2", next);
  } catch (error) {}
};

document.getElementById("snt").onclick = () => {
  shell.classList.toggle(innerWidth < 992 ? "menu-open" : "menu-off");
};
document.getElementById("snbd").onclick = () =>
  shell.classList.remove("menu-open");

// Ask before a delete button submits.
document.querySelectorAll("form[data-confirm]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    if (!confirm(form.dataset.confirm)) event.preventDefault();
  });
});
