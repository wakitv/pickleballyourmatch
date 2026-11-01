/*
  theme.js — the dark / light switch.

  The theme itself is chosen by a few lines inline in each page's <head>,
  before anything is painted; a stylesheet cannot be waited on here, because
  a page that renders dark and then turns white is worse than either. This
  file only wires the button up to what that already decided.

  The choice is per browser, in localStorage. Without one, the page follows
  the device: someone whose phone is in dark mode gets dark, and the switch
  is there for whoever disagrees.
*/
(function () {
  const KEY = "buenas_theme";
  const root = document.documentElement;
  const btn = document.getElementById("themeBtn");
  if (!btn) return;

  function paint() {
    const light = root.dataset.theme === "light";
    btn.textContent = light ? "🌙" : "☀️";
    // The label says what pressing it will do, not what is showing.
    const label = light ? "Switch to dark mode" : "Switch to light mode";
    btn.title = label;
    btn.setAttribute("aria-label", label);
  }

  btn.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
    try { localStorage.setItem(KEY, root.dataset.theme); } catch { /* private window */ }
    paint();
  });

  // Someone who has never pressed the button keeps following their device.
  try {
    const mq = matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", e => {
      if (localStorage.getItem(KEY)) return;
      root.dataset.theme = e.matches ? "light" : "dark";
      paint();
    });
  } catch { /* older browser: the button still works */ }

  paint();
})();
