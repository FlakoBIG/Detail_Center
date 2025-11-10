import { db } from "./firebase.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

(function () {
  const SEL = {
    view: "#view-clientes",
    search: "#cliSearch",
    msg: "#cliMsg",
    list: "#clientesList",
    fab: "#fabAddCliente",
    dlg: "#dlgCliente",
    form: "#formCliente",
    btnClose: "#btnCerrarDlg",
    btnCancel: "#btnCancelar",
    btnAddVeh: "#btnAddVehiculo",
    btnGuardar: "#btnGuardar",
    vehList: "#vehiculosList",
    inputs: { nombre: "#cliNombre", apellido: "#cliApellido", numero: "#cliNumero", correo: "#cliCorreo" }
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const norm = (s) => (s || "").toString().toLowerCase().trim();

  const clientesRef = collection(db, "clientes");
  const clientesQuery = query(clientesRef, orderBy("createdAt", "desc"));

  let clientes = [];
  let filtro = "";
  let ultimoAgregadoId = null;
  let unsub = null;

  const reNombre = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü'\-\s]{2,40}$/;
  const reEmailSoft = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function renderList() {
    const cont = $(SEL.list);
    const msg = $(SEL.msg);
    if (!cont) return;
    const q = norm(filtro);
    let data = clientes;
    if (q) {
      data = clientes.filter(c => {
        const base = `${c.nombre} ${c.apellido} ${c.numero} ${c.correo}`.toLowerCase();
        const vehs = (c.vehiculos || []).map(v => `${v.marca} ${v.modelo}`.toLowerCase()).join(" ");
        return base.includes(q) || vehs.includes(q);
      });
    }
    cont.innerHTML = "";
    if (!data.length) {
      msg.textContent = q ? "No se encontraron clientes para tu búsqueda." : "Aún no hay clientes registrados. Usa el botón + para agregar.";
      return;
    } else {
      msg.textContent = "";
    }
    const frag = document.createDocumentFragment();
    data.forEach(c => {
      const card = document.createElement("article");
      card.className = "cliente-card";
      card.style.cursor = "pointer";
      card.addEventListener("click", () => { if (c._id) location.hash = `#cliente/${c._id}`; });
      const titulo = document.createElement("h3");
      titulo.className = "cliente-nombre";
      titulo.textContent = `${c.nombre || ""} ${c.apellido || ""}`.trim() || "Sin nombre";
      const meta = document.createElement("p");
      meta.className = "cliente-meta";
      const correo = c.correo ? ` • 📧 ${c.correo}` : "";
      const numero = c.numero ? ` • 📞 ${c.numero}` : "";
      meta.textContent = `${numero}${correo}`.replace(/^ • /, "");
      const vehWrap = document.createElement("div");
      vehWrap.className = "cliente-vehiculos";
      const vh = document.createElement("h4");
      vh.textContent = "Vehículos";
      const vlist = document.createElement("ul");
      vlist.className = "veh-list";
      (c.vehiculos || []).forEach(v => {
        const li = document.createElement("li");
        li.textContent = `${v.marca || "—"} / ${v.modelo || "—"}`;
        vlist.appendChild(li);
      });
      if (!c.vehiculos || !c.vehiculos.length) {
        const li = document.createElement("li");
        li.textContent = "Sin vehículos registrados";
        vlist.appendChild(li);
      }
      vehWrap.append(vh, vlist);
      card.append(titulo, meta, vehWrap);
      if (ultimoAgregadoId && c._id === ultimoAgregadoId) {
        card.classList.add("just-added");
        setTimeout(() => card.classList.remove("just-added"), 800);
      }
      frag.appendChild(card);
    });
    cont.appendChild(frag);
  }

  function addVehiculoRow(values = { marca: "", modelo: "" }) {
    const list = $(SEL.vehList);
    if (!list) return;
    const row = document.createElement("div");
    row.className = "veh-row entering";
    const marca = document.createElement("input");
    marca.placeholder = "Marca";
    marca.className = "veh-input";
    marca.maxLength = 40;
    marca.value = values.marca || "";
    const modelo = document.createElement("input");
    modelo.placeholder = "Modelo";
    modelo.className = "veh-input";
    modelo.maxLength = 40;
    modelo.value = values.modelo || "";
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn-icon";
    del.title = "Quitar";
    del.setAttribute("aria-label", "Quitar vehículo");
    del.textContent = "🗑️";
    del.addEventListener("click", () => {
      row.classList.add("leaving");
      row.addEventListener("animationend", () => row.remove(), { once: true });
    });
    row.append(marca, modelo, del);
    list.appendChild(row);
    row.addEventListener("animationend", () => row.classList.remove("entering"), { once: true });
  }

  function clearVehiculos() {
    const list = $(SEL.vehList);
    if (list) list.innerHTML = "";
  }

  function setMsg(input, msg) {
    input.setCustomValidity(msg || "");
    input.reportValidity();
  }

  function validateInputs() {
    const iNom = $(SEL.inputs.nombre);
    const iApe = $(SEL.inputs.apellido);
    const iTel = $(SEL.inputs.numero);
    const iMail = $(SEL.inputs.correo);
    iNom.setCustomValidity("");
    iApe.setCustomValidity("");
    iTel.setCustomValidity("");
    iMail.setCustomValidity("");
    if (!iNom.value.trim() || !reNombre.test(iNom.value.trim())) {
      setMsg(iNom, "Nombre inválido. Usa solo letras y mínimo 2 caracteres.");
      iNom.focus();
      return false;
    }
    if (!iApe.value.trim() || !reNombre.test(iApe.value.trim())) {
      setMsg(iApe, "Apellido inválido. Usa solo letras y mínimo 2 caracteres.");
      iApe.focus();
      return false;
    }
    if (iTel.value.trim() && !/^\d+$/.test(iTel.value.trim())) {
      setMsg(iTel, "El número debe contener solo dígitos 0-9.");
      iTel.focus();
      return false;
    }
    if (iMail.value.trim() && !reEmailSoft.test(iMail.value.trim())) {
      setMsg(iMail, "Correo inválido. Revisa el formato.");
      iMail.focus();
      return false;
    }
    return true;
  }

  function wireRealtimeValidation() {
    const iNom = $(SEL.inputs.nombre);
    const iApe = $(SEL.inputs.apellido);
    const iTel = $(SEL.inputs.numero);
    const iMail = $(SEL.inputs.correo);
    iNom?.addEventListener("input", () => iNom.setCustomValidity(""));
    iApe?.addEventListener("input", () => iApe.setCustomValidity(""));
    iMail?.addEventListener("input", () => iMail.setCustomValidity(""));
    iTel?.addEventListener("input", () => {
      iTel.setCustomValidity("");
      iTel.value = iTel.value.replace(/\D+/g, "");
    });
  }

  function openModalAgregar() {
    const dlg = $(SEL.dlg);
    const form = $(SEL.form);
    if (!dlg || !form) return;
    const title = $("#dlgTitle");
    if (title) title.textContent = "Agregar cliente";
    form.reset?.();
    $(SEL.inputs.nombre).value = "";
    $(SEL.inputs.apellido).value = "";
    $(SEL.inputs.numero).value = "";
    $(SEL.inputs.correo).value = "";
    clearVehiculos();
    addVehiculoRow();
    if (dlg.showModal) {
      dlg.classList.remove("closing");
      dlg.showModal();
      dlg.classList.add("opening");
      dlg.addEventListener("animationend", () => dlg.classList.remove("opening"), { once: true });
    } else {
      dlg.setAttribute("open", "");
    }
    wireRealtimeValidation();
  }

  function closeModal() {
    const dlg = $(SEL.dlg);
    if (!dlg) return;
    if (dlg.open && dlg.close) {
      dlg.classList.add("closing");
      dlg.addEventListener("animationend", () => {
        dlg.classList.remove("closing");
        dlg.close();
      }, { once: true });
    } else {
      dlg.removeAttribute("open");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateInputs()) return;
    const nombre = $(SEL.inputs.nombre).value.trim();
    const apellido = $(SEL.inputs.apellido).value.trim();
    const numero = $(SEL.inputs.numero).value.trim();
    const correo = $(SEL.inputs.correo).value.trim();
    const vehiculos = $$(".veh-row", $(SEL.vehList)).map(row => {
      const [marca, modelo] = $$(".veh-input", row);
      return { marca: (marca?.value || "").trim(), modelo: (modelo?.value || "").trim() };
    }).filter(v => v.marca || v.modelo);
    const nuevo = { nombre, apellido, numero, correo, vehiculos, createdAt: serverTimestamp() };
    try {
      const ref = await addDoc(clientesRef, nuevo);
      ultimoAgregadoId = ref.id;
      closeModal();
      showMiniToast("Cliente guardado");
    } catch (err) {
      alert("No se pudo guardar el cliente.");
      console.error(err);
    }
  }

  function attachSearch() {
    const input = $(SEL.search);
    if (!input) return;
    input.addEventListener("input", () => {
      filtro = input.value || "";
      renderList();
    });
  }

  function ensureSubscription(active) {
    if (active && !unsub) {
      unsub = onSnapshot(clientesQuery, (snap) => {
        clientes = snap.docs.map(d => {
          const data = d.data();
          return {
            _id: d.id,
            nombre: data.nombre || "",
            apellido: data.apellido || "",
            numero: data.numero || "",
            correo: data.correo || "",
            vehiculos: Array.isArray(data.vehiculos) ? data.vehiculos : [],
            createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0
          };
        });
        renderList();
      }, (err) => {
        console.error("onSnapshot error:", err);
        const msg = $(SEL.msg);
        if (msg) msg.textContent = "Error al conectar con la base de datos.";
      });
    }
    if (!active && unsub) {
      unsub();
      unsub = null;
    }
  }

  function showIfActive() {
    const view = $(SEL.view);
    if (!view) return;
    const active = (location.hash || "#inicio").toLowerCase() === "#clientes";
    view.classList.toggle("hidden", !active);
    ensureSubscription(active);
    if (clientes.length && active) renderList();
  }

  function showMiniToast(texto = "Listo") {
    const host = document.querySelector("#view-clientes") || document.body;
    const el = document.createElement("div");
    el.className = "mini-toast";
    el.textContent = texto;
    host.appendChild(el);
    const D = 1800;
    let removed = false;
    function rm() { if (!removed) { removed = true; el.remove(); } }
    el.addEventListener("animationend", rm, { once: true });
    setTimeout(rm, D + 150);
  }

  document.addEventListener("view:loaded", (e) => {
    const h = (e.detail?.hash || "").toLowerCase();
    if (h === "#clientes") {
      attachSearch();
      $(SEL.fab)?.addEventListener("click", openModalAgregar);
      $(SEL.btnAddVeh)?.addEventListener("click", () => addVehiculoRow());
      $(SEL.btnClose)?.addEventListener("click", closeModal);
      $(SEL.btnCancel)?.addEventListener("click", (ev) => { ev.preventDefault(); closeModal(); });
      $(SEL.form)?.addEventListener("submit", handleSubmit);
      $(SEL.dlg)?.addEventListener("cancel", (ev) => { ev.preventDefault(); closeModal(); });
      showIfActive();
    } else {
      ensureSubscription(false);
    }
  });

  if ((location.hash || "#inicio").toLowerCase() === "#clientes") {}
})();
