// detalle_cliente.js — Ver, editar y eliminar clientes (Firestore + modales)
import { db } from "./firebase.js";
import {
  doc, getDoc, onSnapshot, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

(function () {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  function getClienteIdFromHash() {
    const m = (location.hash || "").match(/^#cliente\/([\w-]+)$/i);
    return m ? m[1] : null;
  }

  function renderDetalle(data) {
    $("#detTitulo").textContent = `${data.nombre || ""} ${data.apellido || ""}`.trim() || "Cliente";
    $("#detNombre").textContent = data.nombre || "—";
    $("#detApellido").textContent = data.apellido || "—";
    $("#detNumero").textContent = data.numero || "—";
    $("#detCorreo").textContent = data.correo || "—";

    const ul = $("#detVehiculos");
    ul.innerHTML = "";
    const vehs = Array.isArray(data.vehiculos) ? data.vehiculos : [];
    if (!vehs.length) {
      const li = document.createElement("li");
      li.textContent = "Sin vehículos registrados";
      ul.appendChild(li);
      return;
    }
    vehs.forEach(v => {
      const li = document.createElement("li");
      li.textContent = `${v.marca || "—"} / ${v.modelo || "—"}`;
      ul.appendChild(li);
    });
  }

  function addVehiculoRowEd(values = { marca: "", modelo: "" }) {
    const list = $("#vehiculosListEd");
    const row = document.createElement("div");
    row.className = "veh-row entering";

    const marca = document.createElement("input");
    marca.placeholder = "Marca";
    marca.className = "veh-input";
    marca.value = values.marca || "";

    const modelo = document.createElement("input");
    modelo.placeholder = "Modelo";
    modelo.className = "veh-input";
    modelo.value = values.modelo || "";

    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn-icon";
    del.title = "Quitar";
    del.textContent = "🗑️";
    del.addEventListener("click", () => {
      row.classList.add("leaving");
      row.addEventListener("animationend", () => row.remove(), { once: true });
    });

    row.append(marca, modelo, del);
    list.appendChild(row);
    row.addEventListener("animationend", () => row.classList.remove("entering"), { once: true });
  }

  function clearVehiculosEd() {
    $("#vehiculosListEd").innerHTML = "";
  }

  function openEditarModal(data) {
    $("#edNombre").value = data.nombre || "";
    $("#edApellido").value = data.apellido || "";
    $("#edNumero").value = data.numero || "";
    $("#edCorreo").value = data.correo || "";

    clearVehiculosEd();
    const vehs = Array.isArray(data.vehiculos) ? data.vehiculos : [];
    if (!vehs.length) addVehiculoRowEd();
    else vehs.forEach(v => addVehiculoRowEd(v));

    const dlg = $("#dlgEditarCliente");
    dlg.classList.remove("closing");
    dlg.showModal?.();
    dlg.classList.add("opening");
    dlg.addEventListener("animationend", () => dlg.classList.remove("opening"), { once: true });
  }

  function closeEditarModal() {
    const dlg = $("#dlgEditarCliente");
    dlg.classList.add("closing");
    dlg.addEventListener("animationend", () => {
      dlg.classList.remove("closing");
      dlg.close?.();
    }, { once: true });
  }

  function openEliminarModal(nombreCompleto) {
    $("#confNombre").textContent = nombreCompleto || "este cliente";
    const dlg = $("#dlgConfirmEliminar");
    dlg.classList.remove("closing");
    dlg.showModal?.();
    dlg.classList.add("opening");
    dlg.addEventListener("animationend", () => dlg.classList.remove("opening"), { once: true });
  }

  function closeEliminarModal() {
    const dlg = $("#dlgConfirmEliminar");
    dlg.classList.add("closing");
    dlg.addEventListener("animationend", () => {
      dlg.classList.remove("closing");
      dlg.close?.();
    }, { once: true });
  }

  function toast(msg="Listo") {
    const host = $("#view-detalle-cliente") || document.body;
    const el = document.createElement("div");
    el.className = "mini-toast";
    el.textContent = msg;
    host.appendChild(el);
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }

  document.addEventListener("view:loaded", (e) => {
    if ((e.detail?.hash || "") !== "#cliente") return;
    const id = getClienteIdFromHash();
    if (!id) { location.hash = "#clientes"; return; }

    const ref = doc(db, "clientes", id);

    // -------- Botón volver --------
    const backBtn = document.getElementById("btnVolverClientes");
    if (backBtn) {
      backBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (history.length > 1) {
          history.back();
          setTimeout(() => {
            if (!location.hash || /^#cliente\//i.test(location.hash)) {
              location.hash = "#clientes";
            }
          }, 150);
        } else {
          location.hash = "#clientes";
        }
      });
    }

    // -------- Suscripción realtime --------
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) { location.hash = "#clientes"; return; }
      const data = snap.data();
      const cliente = {
        id: snap.id,
        nombre: data.nombre || "",
        apellido: data.apellido || "",
        numero: data.numero || "",
        correo: data.correo || "",
        vehiculos: Array.isArray(data.vehiculos) ? data.vehiculos : [],
      };
      renderDetalle(cliente);

      $("#btnEditarCliente").onclick = () => openEditarModal(cliente);
      $("#btnEliminarCliente").onclick = () =>
        openEliminarModal(`${cliente.nombre} ${cliente.apellido}`.trim());

      $("#formEditarCliente").onsubmit = async (ev) => {
        ev.preventDefault();
        const nombre = $("#edNombre").value.trim();
        const apellido = $("#edApellido").value.trim();
        const numero = $("#edNumero").value.trim();
        const correo = $("#edCorreo").value.trim();
        if (!nombre || !apellido) { alert("Completa Nombre y Apellido."); return; }

        const vehiculos = $$(".veh-row", $("#vehiculosListEd")).map(row => {
          const [marca, modelo] = $$(".veh-input", row);
          return { marca: (marca?.value || "").trim(), modelo: (modelo?.value || "").trim() };
        }).filter(v => v.marca || v.modelo);

        try {
          await updateDoc(ref, { nombre, apellido, numero, correo, vehiculos });
          toast("Cliente actualizado");
          closeEditarModal();
        } catch (err) {
          console.error(err);
          alert("No se pudo actualizar el cliente.");
        }
      };

      $("#btnAddVehiculoEd").onclick = () => addVehiculoRowEd();
      $("#btnCancelarEditar").onclick = (ev) => { ev.preventDefault(); closeEditarModal(); };
      $("#btnCerrarEditar").onclick = () => closeEditarModal();

      $("#formEliminar").onsubmit = async (ev) => {
        ev.preventDefault();
        try {
          await deleteDoc(ref);
          closeEliminarModal();
          location.hash = "#clientes";
        } catch (err) {
          console.error(err);
          alert("No se pudo eliminar el cliente.");
        }
      };
      $("#btnCancelarEliminar").onclick = (ev) => { ev.preventDefault(); closeEliminarModal(); };
      $("#btnCerrarEliminar").onclick = () => closeEliminarModal();

    }, (err) => {
      console.error("onSnapshot(cliente) error:", err);
      location.hash = "#clientes";
    });

    window.addEventListener("hashchange", () => unsub(), { once: true });
  });
})();
