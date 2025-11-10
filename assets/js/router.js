// router.js — Carga vistas parciales dentro de <main> según el hash

document.addEventListener("DOMContentLoaded", () => {
  const main = document.querySelector("main");

  // Hash -> archivo HTML de la vista
  const routes = {
    "#clientes": "assets/views/clientes.html",
    // "#lavados": "assets/views/lavados.html",
    // "#horario": "assets/views/horario.html",
  };

  async function loadView(hash) {
    const url = routes[hash];
    if (!url) {
      main.innerHTML = "";
      // Notifica que la vista (inicio) está lista
      document.dispatchEvent(new CustomEvent("view:loaded", { detail: { hash: "#inicio" }}));
      return;
    }

    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      main.innerHTML = html;

      // Notifica que la vista inyectada está lista en el DOM
      document.dispatchEvent(new CustomEvent("view:loaded", { detail: { hash } }));
    } catch (err) {
      main.innerHTML = `<p style="color:red;padding:1em">Error al cargar vista (${hash}): ${err.message}</p>`;
    }
  }

  // Navegación
  window.addEventListener("hashchange", () => loadView(location.hash || "#inicio"));
  loadView(location.hash || "#inicio");
});
