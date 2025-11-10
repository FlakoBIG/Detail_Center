// router.js — Carga vistas dentro de <main> según el hash (incluye rutas dinámicas + import de scripts por vista)

document.addEventListener("DOMContentLoaded", () => {
  const main = document.querySelector("main");

  // Rutas estáticas
  const staticRoutes = {
    "#inicio":  "assets/views/inicio.html",
    "#clientes": "assets/views/clientes.html",
    // "#lavados": "assets/views/lavados.html",
    // "#horario": "assets/views/horario.html",
  };

  // Scripts asociados (se importan dinámicamente tras inyectar la vista)
  const routeScripts = {
    // "#inicio": "assets/js/inicio.js",
    // "#clientes": "assets/js/clientes.js", // si tienes uno, actívalo
  };

  // Rutas dinámicas: patrón -> archivo
  // Ej: #cliente/<id>
  const dynamicRoutes = [
    { pattern: /^#cliente\/([\w-]+)$/i, view: "assets/views/detalle_cliente.html", key: "#cliente" },
  ];

  function resolveRoute(hash) {
    if (staticRoutes[hash]) {
      return { key: hash, view: staticRoutes[hash], params: {} };
    }
    for (const r of dynamicRoutes) {
      const m = hash.match(r.pattern);
      if (m) return { key: r.key, view: r.view, params: { id: m[1] } };
    }
    // Fallback a inicio
    return { key: "#inicio", view: staticRoutes["#inicio"], params: {} };
  }

  async function loadView(hash) {
    const { key, view, params } = resolveRoute(hash);

    try {
      const res = await fetch(view, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      main.innerHTML = html;

      // Importa el script (si existe) y llama a su init
      const scriptPath = routeScripts[key];
      if (scriptPath) {
        try {
          const mod = await import(`./${scriptPath}`);
          if (typeof mod.init === "function") {
            await mod.init({ hash: key, params });
          } else if (typeof mod.initInicioView === "function") {
            await mod.initInicioView({ hash: key, params });
          }
        } catch (e) {
          console.warn(`No se pudo importar script para ${key}:`, e);
        }
      }

      // Notifica que la vista está lista + pasa params (por ej. {id})
      document.dispatchEvent(new CustomEvent("view:loaded", { detail: { hash: key, params } }));
    } catch (err) {
      main.innerHTML = `<p style="color:red;padding:1em">Error al cargar vista (${hash}): ${err.message}</p>`;
    }
  }

  window.addEventListener("hashchange", () => loadView(location.hash || "#inicio"));
  loadView(location.hash || "#inicio");
});
