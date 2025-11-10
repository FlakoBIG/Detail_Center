// ✅ Controla el menú lateral del autolavado (sin cerrar al hacer clic en links)
document.addEventListener("DOMContentLoaded", () => {
  const cb = document.getElementById("navToggle");   // checkbox oculto (abre/cierra)
  const overlay = document.getElementById("overlay"); // fondo oscuro
  const main = document.getElementById("main");       // contenido principal
  const links = Array.from(document.querySelectorAll(".nav-link"));

  console.log("inicio.js cargado ✅");

  if (!cb || !overlay) {
    console.error("⚠️ Falta #navToggle u #overlay en el DOM.");
    return;
  }

  // --- 1) NUNCA cerrar por click en links ---
  // (Antes cerrábamos aquí. Lo quitamos.)

  // --- 2) Cerrar con Escape y al hacer click fuera (overlay) ---
  overlay.addEventListener("click", () => { cb.checked = false; });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cb.checked = false;
  });

  // --- 3) Activo dinámico según hash ---
  function normalizeHash(h) {
    if (!h || h === "#") return "#inicio";
    return h.toLowerCase();
  }

  function markActiveLink() {
    const current = normalizeHash(location.hash);
    links.forEach(a => {
      const ah = (a.getAttribute("href") || "").toLowerCase();
      a.classList.toggle("active", ah === current);
    });
  }

  // Marca activo al cargar y cuando cambia el hash
  markActiveLink();
  window.addEventListener("hashchange", markActiveLink);

  // Si haces clic en un link, actualizamos el activo al tiro (sin esperar hashchange)
  links.forEach(a => {
    a.addEventListener("click", () => {
      // No cerramos el menú
      // Sólo movemos el "active" inmediatamente
      links.forEach(x => x.classList.remove("active"));
      a.classList.add("active");
    });
  });

  // --- 4) Accesibilidad: si el usuario salta al main con teclado, cerramos ---
  main?.addEventListener("focus", () => { cb.checked = false; });

  // Log útil para depurar
  cb.addEventListener("change", () => {
    console.log(cb.checked ? "📂 Menú abierto" : "🔒 Menú cerrado");
  });
});
