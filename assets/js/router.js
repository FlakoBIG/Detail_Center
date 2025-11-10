// router.js — Carga vistas dentro de <main> según el hash (incluye rutas dinámicas)

document.addEventListener("DOMContentLoaded", () => {
  const main = document.querySelector("main");

  // Rutas estáticas
  const staticRoutes = {
    "#clientes": "assets/views/clientes.html",
    // "#lavados": "assets/views/lavados.html",
    // "#horario": "assets/views/horario.html",
  };

  // Rutas dinámicas: patrón -> archivo
  // Ej: #cliente/<id>
  const dynamicRoutes = [
    { pattern: /^#cliente\/([\w-]+)$/i, view: "assets/views/detalle_cliente.html", key: "#cliente" },
  ];

  function resolveRoute(hash) {
    if (staticRoutes[hash]) return { key: hash, view: staticRoutes[hash], params: {} };
    for (const r of dynamicRoutes) {
      const m = hash.match(r.pattern);
      if (m) return { key: r.key, view: r.view, params: { id: m[1] } };
    }
    return { key: "#inicio", view: null, params: {} };
  }

  async function loadView(hash) {
    const { key, view, params } = resolveRoute(hash);
    if (!view) {
      main.innerHTML = "";
      document.dispatchEvent(new CustomEvent("view:loaded", { detail: { hash: key, params } }));
      return;
    }

    try {
      const res = await fetch(view, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      main.innerHTML = html;

      // Notifica que la vista está lista + pasa params (por ej. {id})
      document.dispatchEvent(new CustomEvent("view:loaded", { detail: { hash: key, params } }));
    } catch (err) {
      main.innerHTML = `<p style="color:red;padding:1em">Error al cargar vista (${hash}): ${err.message}</p>`;
    }
  }

  window.addEventListener("hashchange", () => loadView(location.hash || "#inicio"));
  loadView(location.hash || "#inicio");
});
