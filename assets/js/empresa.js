// empresa.js — Estado "abierto/cerrado" dentro del sidebar + LED en topbar
import { db } from "./firebase.js";
import {
  doc, getDoc, onSnapshot, setDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Documento: empresa/config
const EMPRESA_DOC = doc(db, "empresa", "config");
const ESTADO_ABIERTO = "abierto";
const ESTADO_CERRADO = "cerrado";

const $ = (s, r=document) => r.querySelector(s);

// ======== UI ========
function setEstadoUI(estado) {
  // Cambia atributo en <body> para que el CSS pinte led y botón
  document.body.setAttribute("data-estado", estado);

  // Texto del chip
  const t = $("#estadoTexto");
  if (t) t.textContent = `Estado: ${estado === ESTADO_ABIERTO ? "Abierto" : "Cerrado"}`;

  // Botón
  const btn = $("#btnToggleEstado");
  if (btn) {
    const abrir = estado !== ESTADO_ABIERTO;
    btn.textContent = abrir ? "🟢 Abrir autolavado" : "🔴 Cerrar autolavado";
    btn.setAttribute("aria-pressed", String(!abrir));
  }
}

// ======== Firestore ========
async function ensureDoc() {
  const snap = await getDoc(EMPRESA_DOC);
  if (!snap.exists()) {
    // 👇 solo crea el campo estado, sin "actualizado"
    await setDoc(EMPRESA_DOC, { estado: ESTADO_CERRADO });
  }
}

async function toggleEstado() {
  const btn = $("#btnToggleEstado");
  btn?.setAttribute("disabled", "true");

  try {
    const snap = await getDoc(EMPRESA_DOC);
    const actual = (snap.exists() ? snap.data().estado : ESTADO_CERRADO) || ESTADO_CERRADO;
    const nuevo = actual === ESTADO_ABIERTO ? ESTADO_CERRADO : ESTADO_ABIERTO;

    // Cambia visualmente al tiro
    setEstadoUI(nuevo);

    // 👇 actualiza solo el campo "estado", sin "actualizado"
    await updateDoc(EMPRESA_DOC, { estado: nuevo });
  } catch (e) {
    console.error("Error al cambiar estado:", e);
  } finally {
    btn?.removeAttribute("disabled");
  }
}

// ======== Inicializar ========
document.addEventListener("DOMContentLoaded", async () => {
  try { await ensureDoc(); } catch (e) { console.warn(e); }

  // Escucha en tiempo real el cambio de estado
  onSnapshot(
    EMPRESA_DOC,
    (snap) => {
      const estado = (snap.exists() ? snap.data().estado : ESTADO_CERRADO) || ESTADO_CERRADO;
      setEstadoUI(estado);
    },
    (err) => {
      console.error("onSnapshot empresa/config:", err);
      setEstadoUI(ESTADO_CERRADO);
    }
  );

  // Click del botón
  $("#btnToggleEstado")?.addEventListener("click", toggleEstado);
});
