// ===== Imports Firebase =====
import { db } from "./firebase.js";
import {
  collection, doc, getDoc, getDocs, addDoc,
  query, where, onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ===== Helpers =====
const $id = (id) => document.getElementById(id);
const ymd = (d) => d.toISOString().slice(0,10); // "YYYY-MM-DD"

// ===== Estado =====
let current = new Date();
let eventosCache = [];
let unsubscribeMonth = null;

// ===== Referencias (se asignan en init) =====
let calGrid, calMonth, calYear, calPrev, calNext, fabAddEvento;
let dlg, form, btnCloseEvt, btnCancelEvt, selCliente, selVehiculo, inpFecha, inpHora, inicioMsg, evtMsg;

// ===== Utilidades fecha =====
function startOfMonth(d){ const x=new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x; }
function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999); }
function addMonths(d, n){ return new Date(d.getFullYear(), d.getMonth()+n, 1); }
function isToday(d){ const t=new Date(); t.setHours(0,0,0,0); const x=new Date(d); x.setHours(0,0,0,0); return t.getTime()===x.getTime(); }

// ===== Render calendario =====
function renderCalendar(){
  if (!calGrid || !calMonth || !calYear) return;

  const locale = "es-ES";
  calMonth.textContent = current.toLocaleDateString(locale, { month:"long" }).replace(/^./, m => m.toUpperCase());
  calYear.textContent = String(current.getFullYear());

  calGrid.innerHTML = "";

  const first = startOfMonth(current);
  const last = endOfMonth(current);
  const startWeekday = (first.getDay() || 7);
  const daysInMonth = last.getDate();

  const prevMonth = addMonths(current, -1);
  const daysPrevMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth()+1, 0).getDate();
  for(let i=1;i<startWeekday;i++){
    const dayNum = daysPrevMonth - (startWeekday - 1 - i);
    calGrid.appendChild(dayCell(new Date(prevMonth.getFullYear(), prevMonth.getMonth(), dayNum), true));
  }
  for(let d=1; d<=daysInMonth; d++){
    calGrid.appendChild(dayCell(new Date(current.getFullYear(), current.getMonth(), d), false));
  }
  while(calGrid.children.length % 7 !== 0){
    const idx = calGrid.children.length - (startWeekday - 1) - daysInMonth + 1;
    const dayNum = idx;
    const nextMonth = addMonths(current, +1);
    calGrid.appendChild(dayCell(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), dayNum), true));
  }
}

function dayCell(date, isOut){
  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = "day" + (isOut ? " out": "") + (isToday(date) ? " today" : "");
  cell.setAttribute("aria-label", date.toDateString());

  const num = document.createElement("div");
  num.className = "num";
  num.textContent = String(date.getDate());
  cell.appendChild(num);

  const ul = document.createElement("div"); ul.className = "events";
  const list = eventosCache.filter(e => e.dateStr === ymd(date));
  list.forEach(() => {
    const dot = document.createElement("span"); dot.className = "dot";
    ul.appendChild(dot);
  });
  cell.appendChild(ul);

  cell.addEventListener("click", () => openEventoModal(date));
  return cell;
}

// ===== Cargar clientes/vehículos =====
async function loadClientes(){
  if (!selCliente) return;
  selCliente.innerHTML = `<option value="" selected disabled>Seleccione un cliente…</option>`;
  try{
    const snap = await getDocs(collection(db, "clientes"));
    snap.forEach(docu => {
      const c = docu.data();
      const opt = document.createElement("option");
      opt.value = docu.id;
      opt.textContent = c.nombre || c.nombreCompleto || c.email || ("Cliente " + docu.id.slice(0,6));
      selCliente.appendChild(opt);
    });
  }catch(err){ console.error(err); }
}

async function loadVehiculos(clienteId){
  if (!selVehiculo) return;
  selVehiculo.innerHTML = `<option value="" selected disabled>Seleccione un vehículo…</option>`;
  selVehiculo.disabled = true;
  if(!clienteId) return;

  try{
    const sub = collection(db, "clientes", clienteId, "vehiculos");
    const subSnap = await getDocs(sub);
    const vehiculos = [];
    subSnap.forEach(v => vehiculos.push({ id:v.id, ...v.data() }));

    if(vehiculos.length === 0){
      const cliDoc = await getDoc(doc(db, "clientes", clienteId));
      if (cliDoc.exists()){
        const arr = cliDoc.data().vehiculos || [];
        arr.forEach((v, idx) => vehiculos.push({ id:String(idx), ...v }));
      }
    }

    vehiculos.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.id;
      const label = v.alias || v.patente || v.placa || v.modelo || v.marca || "Vehículo";
      opt.textContent = [label, v.patente || v.placa ? `(${v.patente || v.placa})` : "", v.color ? `• ${v.color}` : ""].filter(Boolean).join(" ");
      opt.dataset.desc = JSON.stringify({ alias:v.alias, marca:v.marca, modelo:v.modelo, color:v.color, patente:v.patente || v.placa });
      selVehiculo.appendChild(opt);
    });

    selVehiculo.disabled = false;
  }catch(err){ console.error(err); }
}

// ===== Eventos (Firestore) =====
function monthRange(d){
  const a = startOfMonth(d);
  const b = endOfMonth(d);
  return { from: Timestamp.fromDate(a), to: Timestamp.fromDate(b) };
}

function watchMonthEvents(){
  if (unsubscribeMonth) { try{ unsubscribeMonth(); }catch{} unsubscribeMonth = null; }
  const { from, to } = monthRange(current);

  const q = query(
    collection(db, "eventos"),
    where("fechaHora", ">=", from),
    where("fechaHora", "<=", to)
  );

  unsubscribeMonth = onSnapshot(q, (snap) => {
    eventosCache = [];
    snap.forEach(d => {
      const e = d.data();
      const dt = e.fechaHora?.toDate?.() || new Date(e.fechaHora);
      eventosCache.push({ id: d.id, ...e, dateStr: ymd(dt) });
    });
    renderCalendar();
  }, async (err) => {
    console.warn("onSnapshot falló, usando carga única:", err);
    await loadMonthOnce();
  });
}

async function loadMonthOnce(){
  try{
    const { from, to } = monthRange(current);
    const qy = query(collection(db, "eventos"), where("fechaHora", ">=", from), where("fechaHora", "<=", to));
    const snap = await getDocs(qy);
    eventosCache = [];
    snap.forEach(d => {
      const e = d.data();
      const dt = e.fechaHora?.toDate?.() || new Date(e.fechaHora);
      eventosCache.push({ id:d.id, ...e, dateStr: ymd(dt) });
    });
    renderCalendar();
  }catch(err){
    console.warn("Rango sin índice. Cargando todo y filtrando local:", err);
    const all = await getDocs(collection(db, "eventos"));
    const a = startOfMonth(current), b = endOfMonth(current);
    eventosCache = [];
    all.forEach(d => {
      const e = d.data();
      const dt = e.fechaHora?.toDate?.() || new Date(e.fechaHora);
      if (dt >= a && dt <= b) eventosCache.push({ id:d.id, ...e, dateStr: ymd(dt) });
    });
    renderCalendar();
  }
}

// ===== Abrir / cerrar modal (con fallback) =====
function ensureDialogButtonsClose(){
  if (!dlg) return;
  // Si existen, aseguro que cierren el dialog por HTML nativo
  if (btnCloseEvt) {
    btnCloseEvt.setAttribute("type","submit");
    btnCloseEvt.setAttribute("formmethod","dialog");
    btnCloseEvt.setAttribute("value","close");
  }
  if (btnCancelEvt) {
    btnCancelEvt.setAttribute("type","submit");
    btnCancelEvt.setAttribute("formmethod","dialog");
    btnCancelEvt.setAttribute("value","cancel");
  }
}

function openEventoModal(prefillDate){
  if (!dlg) return;
  evtMsg && (evtMsg.textContent = "");
  form?.reset();
  if (selVehiculo) selVehiculo.disabled = true;

  if (prefillDate instanceof Date && inpFecha) {
    inpFecha.value = ymd(prefillDate);
  }

  ensureDialogButtonsClose();

  try{
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  }catch{
    dlg.setAttribute("open", "");
  }
}
function closeEventoModal(){
  if (!dlg) return;
  try{
    if (typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
  }catch{
    dlg.removeAttribute("open");
  }
}

// ===== Listeners (se atan en init) =====
function bindListeners(){
  calPrev?.addEventListener("click", () => { current = addMonths(current, -1); watchMonthEvents(); });
  calNext?.addEventListener("click", () => { current = addMonths(current, +1); watchMonthEvents(); });

  fabAddEvento?.addEventListener("click", () => openEventoModal());
  // Por si el CSS/HTML cambió, aseguro cierre también por JS:
  btnCloseEvt?.addEventListener("click", (e) => { e.preventDefault(); closeEventoModal(); });
  btnCancelEvt?.addEventListener("click", (e) => { e.preventDefault(); closeEventoModal(); });

  selCliente?.addEventListener("change", (e) => loadVehiculos(e.target.value));

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!evtMsg) return;
    evtMsg.className = "form-msg";
    evtMsg.textContent = "";

    const clienteId = selCliente?.value;
    const vehiculoId = selVehiculo?.value;
    const fecha = inpFecha?.value;
    const hora = inpHora?.value;
    const nota = (document.getElementById("inpNota")?.value || "").trim();

    // Si el botón presionado fue Cancelar (formmethod="dialog"), no guardes
    const submitter = e.submitter;
    if (submitter && submitter.id === "btnCancelEvt") {
      return;
    }

    if(!clienteId || !vehiculoId || !fecha || !hora){
      evtMsg.textContent = "Completa cliente, vehículo, fecha y hora.";
      evtMsg.classList.add("err");
      return;
    }

    try{
      const cliDoc = await getDoc(doc(db, "clientes", clienteId));
      const cliente = cliDoc.exists() ? (cliDoc.data().nombre || cliDoc.data().nombreCompleto || "Cliente") : "Cliente";

      const vehOption = selVehiculo.options[selVehiculo.selectedIndex];
      let vehDesc = "Vehículo";
      try{
        const meta = JSON.parse(vehOption.dataset.desc || "{}");
        vehDesc = [meta.alias, meta.marca, meta.modelo, meta.patente].filter(Boolean).join(" ");
      }catch{}

      const [y,m,d] = fecha.split("-").map(Number);
      const [hh,mm] = hora.split(":").map(Number);
      const dt = new Date(y, m-1, d, hh, mm, 0, 0);

      await addDoc(collection(db, "eventos"), {
        clienteId,
        clienteNombre: cliente,
        vehiculoId,
        vehiculoDesc: vehDesc,
        fechaHora: Timestamp.fromDate(dt),
        nota: nota || null,
        creadoEn: Timestamp.now(),
        estado: "agendado"
      });

      evtMsg.textContent = "Evento guardado ✅";
      evtMsg.classList.add("ok");
      setTimeout(() => closeEventoModal(), 300);
    }catch(err){
      console.error(err);
      evtMsg.textContent = "No se pudo guardar el evento.";
      evtMsg.classList.add("err");
    }
  });



  // Delegación de eventos como respaldo (por si el script se carga antes)
  document.addEventListener("click", (e) => {
    if (e.target.closest?.("#fabAddEvento")) openEventoModal();
    if (e.target.closest?.("#btnCloseEvt")) closeEventoModal();
    if (e.target.closest?.("#btnCancelEvt")) closeEventoModal();
  });
}

// ===== Init (la llama el router tras inyectar la vista) =====
export async function init(){
  calGrid = $id("calGrid");
  calMonth = $id("calMonth");
  calYear = $id("calYear");
  calPrev = $id("calPrev");
  calNext = $id("calNext");
  fabAddEvento = $id("fabAddEvento");

  dlg = $id("dlgEvento");
  form = $id("formEvento");
  btnCloseEvt = $id("btnCloseEvt");
  btnCancelEvt = $id("btnCancelEvt");
  selCliente = $id("selCliente");
  selVehiculo = $id("selVehiculo");
  inpFecha = $id("inpFecha");
  inpHora = $id("inpHora");
  inicioMsg = $id("inicioMsg");
  evtMsg = $id("evtMsg");

  if (!calGrid || !dlg) {
    console.warn("Vista Inicio aún no está en el DOM.");
    return;
  }

  await loadClientes();
  renderCalendar();
  watchMonthEvents();
  bindListeners();
  ensureDialogButtonsClose();
}

// Compat por si el router llama initInicioView
export const initInicioView = init;

// Auto-rewiring cuando el router anuncie que cargó una vista
document.addEventListener("view:loaded", (e) => {
  const h = (e.detail?.hash || "").toLowerCase();
  if (!h || h === "#inicio") {
    try { init(); } catch (err) { console.error("init() error tras view:loaded:", err); }
  }
});
