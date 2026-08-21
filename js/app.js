const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });

const STORAGE_KEYS = {
  departures: "travelops_demo_departures_v30",
  leads: "travelops_demo_leads_v30",
  profile: "travelops_demo_profile_v30",
  audit: "travelops_demo_audit_v30"
};

const SYSTEM_ACTOR = { id: "system", name: "Sistema", avatar: "" };

const seedDepartures = [
  {
    id: "d1", brand: "pink", destination: "Cancún", start: "2026-11-02", end: "2026-11-06", capacity: 45, notes: "Salida grupal",
    bookings: [
      {
        id: "b1", name: "Turismo Rosario", total: 85000, paid: 70000, billing: "pendiente", notes: "Factura solicitada",
        createdBy: { id: "demo-user", name: "Ulises", avatar: "" }, updatedBy: { id: "demo-user", name: "Ulises", avatar: "" },
        invoice: { required: true, status: "en_proceso", rfc: "", businessName: "", regime: "", zip: "", cfdi: "", email: "", folio: "", date: "", notes: "Factura solicitada", updatedBy: { id: "demo-user", name: "Ulises", avatar: "" }, updatedAt: "2026-08-20T12:00:00Z" },
        passengers: [
          { id: "p1", first: "Luz María", last1: "Guerrero", last2: "", birth: "1960-06-01", createdBy: { id: "demo-user", name: "Ulises", avatar: "" } },
          { id: "p2", first: "Elsa Icela", last1: "González", last2: "Guerrero", birth: "1969-10-30", createdBy: { id: "demo-user", name: "Ulises", avatar: "" } },
          { id: "p3", first: "Metztli Ameyalli", last1: "Domínguez", last2: "Arias", birth: "2016-10-14", createdBy: { id: "demo-user", name: "Ulises", avatar: "" } }
        ],
        payments: [
          { id: "pay1", amount: 70000, paidOn: "2026-08-20", method: "Transferencia", reference: "Pago acumulado", notes: "Saldo inicial de demo", createdBy: { id: "demo-user", name: "Ulises", avatar: "" }, createdAt: "2026-08-20T12:00:00Z" }
        ]
      },
      {
        id: "b2", name: "Viajes Micky", total: 42000, paid: 42000, billing: "facturada", notes: "",
        createdBy: { id: "demo-user", name: "Ulises", avatar: "" }, updatedBy: { id: "demo-user", name: "Ulises", avatar: "" },
        invoice: { required: true, status: "facturada", rfc: "", businessName: "", regime: "", zip: "", cfdi: "", email: "", folio: "DEMO-001", date: "2026-08-20", notes: "", updatedBy: { id: "demo-user", name: "Ulises", avatar: "" }, updatedAt: "2026-08-20T12:00:00Z" },
        passengers: [
          { id: "p4", first: "Andrea", last1: "Santos", last2: "López", birth: "1988-03-12", createdBy: { id: "demo-user", name: "Ulises", avatar: "" } },
          { id: "p5", first: "Miguel", last1: "Santos", last2: "López", birth: "2010-08-09", createdBy: { id: "demo-user", name: "Ulises", avatar: "" } }
        ],
        payments: [
          { id: "pay2", amount: 42000, paidOn: "2026-08-20", method: "Transferencia", reference: "Liquidación", notes: "", createdBy: { id: "demo-user", name: "Ulises", avatar: "" }, createdAt: "2026-08-20T12:00:00Z" }
        ]
      }
    ],
    rooms: []
  },
  {
    id: "d2", brand: "velora", destination: "Bacalar", start: "2026-12-12", end: "2026-12-16", capacity: 20, notes: "Experiencia premium",
    bookings: [
      {
        id: "b3", name: "Familia Hernández", total: 32000, paid: 12000, billing: "no_solicitada", notes: "Pendiente segundo abono",
        createdBy: { id: "demo-user", name: "Ulises", avatar: "" }, updatedBy: { id: "demo-user", name: "Ulises", avatar: "" },
        invoice: { required: false, status: "no_solicitada", rfc: "", businessName: "", regime: "", zip: "", cfdi: "", email: "", folio: "", date: "", notes: "Pendiente segundo abono", updatedBy: { id: "demo-user", name: "Ulises", avatar: "" }, updatedAt: "2026-08-20T12:00:00Z" },
        passengers: [
          { id: "p6", first: "Carlos", last1: "Hernández", last2: "Mora", birth: "1985-02-05", createdBy: { id: "demo-user", name: "Ulises", avatar: "" } },
          { id: "p7", first: "Paola", last1: "Ruiz", last2: "Vega", birth: "1987-09-21", createdBy: { id: "demo-user", name: "Ulises", avatar: "" } },
          { id: "p8", first: "Regina", last1: "Hernández", last2: "Ruiz", birth: "2014-05-11", createdBy: { id: "demo-user", name: "Ulises", avatar: "" } }
        ],
        payments: [
          { id: "pay3", amount: 12000, paidOn: "2026-08-20", method: "Transferencia", reference: "Anticipo", notes: "Primer abono", createdBy: { id: "demo-user", name: "Ulises", avatar: "" }, createdAt: "2026-08-20T12:00:00Z" }
        ]
      }
    ],
    rooms: [
      { id: "r1", number: "Hab. 1", type: "TPL", bookingId: "b3", passengerIds: ["p6", "p7", "p8"], notes: "", updatedBy: { id: "demo-user", name: "Ulises", avatar: "" }, updatedAt: "2026-08-20T12:00:00Z" }
    ]
  },
  { id: "d3", brand: "pink", destination: "Mazatlán", start: "2026-08-26", end: "2026-08-31", capacity: 40, notes: "", bookings: [], rooms: [] }
];

const seedLeads = [
  { id: "l1", owner_id: "demo-user", owner_name: "Ulises", owner_avatar: "", name: "Agencia Sol", phone: "", brand: "pink", interest: "Bacalar", followup: "2026-08-21", status: "seguimiento", notes: "Pedir confirmación de lugares" },
  { id: "l2", owner_id: "demo-user", owner_name: "Ulises", owner_avatar: "", name: "Mariana Pérez", phone: "", brand: "velora", interest: "Cancún", followup: "2026-08-20", status: "cotizando", notes: "Enviar propuesta final" },
  { id: "l3", owner_id: "otro-user", owner_name: "Karen", owner_avatar: "", name: "Turismo del Centro", phone: "", brand: "pink", interest: "Mazatlán", followup: "2026-08-23", status: "contactado", notes: "Esperando cantidad de pax" }
];

const state = {
  supabase: null,
  user: { id: "demo-user", name: "Ulises", email: "demo@local", avatar: "" },
  brand: "all",
  calendarDate: new Date(Date.UTC(2026, 10, 1)),
  departures: structuredClone(seedDepartures),
  leads: structuredClone(seedLeads),
  audit: []
};

function uid(prefix = "id") {
  return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
}
function parseDate(s) { const [y, m, d] = String(s).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000) + 1; }
function ageAt(birth, ref = new Date()) {
  const b = parseDate(birth); let age = ref.getUTCFullYear() - b.getUTCFullYear();
  const m = ref.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && ref.getUTCDate() < b.getUTCDate())) age--;
  return age;
}
function fullName(p) { return [p.first, p.last1, p.last2].filter(Boolean).join(" ").replace(/\s+/g, " ").trim(); }
function brandLabel(b) { return b === "pink" ? "Pink Sky Travel" : "Velora Travel"; }
function brandAsset(b) { return b === "pink" ? "assets/pink-logo.png" : "assets/velora-logo.png"; }
function bookingPax(d) { return d.bookings.reduce((n, b) => n + b.passengers.length, 0); }
function departureTotal(d) { return d.bookings.reduce((n, b) => n + Number(b.total || 0), 0); }
function recalcBookingPaid(booking) { booking.paid = (booking.payments || []).reduce((n, p) => n + Number(p.amount || 0), 0); return booking.paid; }
function departurePaid(d) { return d.bookings.reduce((n, b) => n + recalcBookingPaid(b), 0); }
function filteredDepartures() { return state.departures.filter(d => state.brand === "all" || d.brand === state.brand); }
function filteredLeads() { return state.leads.filter(l => state.brand === "all" || l.brand === state.brand); }
function currentActor() { return { id: state.user.id, name: state.user.name || state.user.email || "Usuario", avatar: state.user.avatar || "" }; }
function nowISO() { return new Date().toISOString(); }
function actorLetter(actor) { return (actor?.name || "U").trim().charAt(0).toUpperCase() || "U"; }
function actorHTML(actor, compact = true) {
  const a = actor || SYSTEM_ACTOR;
  const avatar = a.avatar ? `<img src="${escapeHTML(a.avatar)}" alt="${escapeHTML(a.name)}">` : `<span>${escapeHTML(actorLetter(a))}</span>`;
  return `<span class="actor-stamp ${compact ? "compact" : ""}"><span class="actor-avatar">${avatar}</span><span class="actor-name">${escapeHTML(a.name || "Sistema")}</span></span>`;
}
function brandChipHTML(brand, short = false) {
  const label = short ? (brand === "pink" ? "Pink" : "Velora") : brandLabel(brand);
  return `<span class="brand-chip with-logo ${brand}"><img src="${brandAsset(brand)}" alt="${escapeHTML(label)}"><span>${escapeHTML(label)}</span></span>`;
}
function invoiceStatusLabel(s) {
  return ({ no_solicitada: "No solicitada", solicitada: "Solicitada", datos_pendientes: "Datos pendientes", en_proceso: "En proceso", facturada: "Facturada", cancelada: "Cancelada" })[s] || "No solicitada";
}
function invoiceStatusClass(s) { return s === "facturada" ? "paid" : s === "cancelada" ? "danger" : s === "no_solicitada" ? "neutral" : "pending"; }
function findDeparture(id) { return state.departures.find(d => d.id === id); }
function findBooking(dep, bookingId) { return dep?.bookings.find(b => b.id === bookingId); }
function findPassengerRecord(dep, passengerId) {
  for (const booking of dep?.bookings || []) {
    const index = booking.passengers.findIndex(p => p.id === passengerId);
    if (index >= 0) return { booking, passenger: booking.passengers[index], index };
  }
  return null;
}
function findPaymentRecord(dep, paymentId) {
  for (const booking of dep?.bookings || []) {
    const index = (booking.payments || []).findIndex(p => p.id === paymentId);
    if (index >= 0) return { booking, payment: booking.payments[index], index };
  }
  return null;
}
function findRoom(dep, roomId) { return dep?.rooms?.find(r => r.id === roomId); }
function bookingLastActor(booking) {
  const lastPayment = [...(booking.payments || [])].sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0];
  return lastPayment?.updatedBy || lastPayment?.createdBy || booking.updatedBy || booking.createdBy || SYSTEM_ACTOR;
}

function normalizeStateData() {
  state.departures.forEach(dep => {
    dep.id ||= uid("dep"); dep.bookings ||= []; dep.rooms ||= [];
    dep.bookings.forEach(booking => {
      booking.id ||= uid("booking"); booking.passengers ||= []; booking.payments ||= [];
      booking.createdBy ||= SYSTEM_ACTOR; booking.updatedBy ||= booking.createdBy;
      if (!booking.payments.length && Number(booking.paid || 0) > 0) {
        booking.payments.push({ id: uid("payment"), amount: Number(booking.paid), paidOn: new Date().toISOString().slice(0, 10), method: "Saldo anterior", reference: "", notes: "Importado de versión anterior", createdBy: booking.createdBy, createdAt: nowISO() });
      }
      recalcBookingPaid(booking);
      booking.invoice ||= {
        required: booking.billing && booking.billing !== "no_solicitada",
        status: booking.billing || "no_solicitada",
        rfc: "", businessName: "", regime: "", zip: "", cfdi: "", email: "", folio: "", date: "", notes: booking.notes || "", updatedBy: booking.updatedBy, updatedAt: nowISO()
      };
      booking.billing = booking.invoice.status;
      booking.passengers.forEach(p => { p.id ||= uid("pax"); p.createdBy ||= booking.createdBy; p.updatedBy ||= p.createdBy; });
      booking.payments.forEach(p => { p.id ||= uid("pay"); p.createdBy ||= booking.createdBy; p.updatedBy ||= p.createdBy; p.createdAt ||= nowISO(); p.updatedAt ||= p.createdAt; });
    });
    dep.rooms.forEach(r => { r.id ||= uid("room"); r.passengerIds ||= []; r.updatedBy ||= SYSTEM_ACTOR; r.updatedAt ||= nowISO(); });
  });
  state.leads.forEach(l => { l.id ||= uid("lead"); l.owner_name ||= "Equipo"; l.owner_avatar ||= ""; });
}

function loadDemoData() {
  if (state.supabase) return;
  try {
    const deps = localStorage.getItem(STORAGE_KEYS.departures) || localStorage.getItem("travelops_demo_departures_v20") || localStorage.getItem("travelops_demo_departures_v12");
    const leads = localStorage.getItem(STORAGE_KEYS.leads) || localStorage.getItem("travelops_demo_leads_v20") || localStorage.getItem("travelops_demo_leads_v12");
    const profile = localStorage.getItem(STORAGE_KEYS.profile);
    const audit = localStorage.getItem(STORAGE_KEYS.audit);
    if (deps) state.departures = JSON.parse(deps);
    if (leads) state.leads = JSON.parse(leads);
    if (profile) Object.assign(state.user, JSON.parse(profile));
    if (audit) state.audit = JSON.parse(audit);
  } catch (err) { console.warn("No se pudo leer localStorage", err); }
  normalizeStateData();
}
function saveDemoData() {
  if (state.supabase) return;
  try {
    localStorage.setItem(STORAGE_KEYS.departures, JSON.stringify(state.departures));
    localStorage.setItem(STORAGE_KEYS.leads, JSON.stringify(state.leads));
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify({ name: state.user.name, avatar: state.user.avatar || "" }));
    localStorage.setItem(STORAGE_KEYS.audit, JSON.stringify(state.audit.slice(-500)));
  } catch (err) { console.warn("No se pudo guardar localStorage", err); }
}
async function logAction(entityType, entityId, action, detail = {}) {
  const actor = currentActor();
  const entry = { id: uid("audit"), user_id: actor.id, actor, entity_type: entityType, entity_id: entityId, action, detail, created_at: nowISO() };
  state.audit.push(entry); saveDemoData();
  if (state.supabase) {
    await state.supabase.from("audit_log").insert({ user_id: actor.id, entity_type: entityType, entity_id: String(entityId || ""), action, detail: { ...detail, actor_name: actor.name, actor_avatar: actor.avatar || "" } });
  }
}


function propagateActorProfile(actor) {
  const patch = target => { if (target && target.id === actor.id) { target.name = actor.name; target.avatar = actor.avatar; } };
  state.departures.forEach(dep => dep.bookings.forEach(b => {
    patch(b.createdBy); patch(b.updatedBy); patch(b.invoice?.updatedBy);
    b.passengers.forEach(p => { patch(p.createdBy); patch(p.updatedBy); });
    b.payments.forEach(pay => { patch(pay.createdBy); patch(pay.updatedBy); });
  }));
  state.departures.forEach(dep => dep.rooms.forEach(r => patch(r.updatedBy)));
  state.leads.forEach(l => { if (l.owner_id === actor.id) { l.owner_name = actor.name; l.owner_avatar = actor.avatar; } });
}

function renderUser() {
  $("#userName").textContent = state.user.name || state.user.email?.split("@")[0] || "Usuario";
  const target = $("#userAvatar");
  if (state.user.avatar) target.innerHTML = `<img src="${state.user.avatar}" alt="${escapeHTML(state.user.name)}">`;
  else target.textContent = actorLetter(currentActor());
}
function showMain() { $("#loginView").classList.add("hidden"); $("#mainView").classList.remove("hidden"); renderUser(); syncBrandFilterUI(); renderAll(); }
function showLogin() { $("#mainView").classList.add("hidden"); $("#loginView").classList.remove("hidden"); }

async function initAuth() {
  state.supabase = await window.getSupabase();
  if (!state.supabase) { loadDemoData(); return; }
  const { data: { session } } = await state.supabase.auth.getSession();
  if (session?.user) {
    state.user = { id: session.user.id, name: session.user.user_metadata?.name || session.user.email, email: session.user.email, avatar: "" };
    await hydrateFromSupabase(); showMain();
  }
}
async function hydrateFromSupabase() {
  if (!state.supabase) return;
  const [{ data: profiles }, { data: deps }, { data: bookings }, { data: pax }, { data: payments }, { data: rooms }, { data: roomPax }, { data: leads }] = await Promise.all([
    state.supabase.from("profiles").select("*"),
    state.supabase.from("departures").select("*").order("start_date"),
    state.supabase.from("bookings").select("*"),
    state.supabase.from("passengers").select("*"),
    state.supabase.from("payments").select("*"),
    state.supabase.from("rooms").select("*"),
    state.supabase.from("room_passengers").select("*"),
    state.supabase.from("crm_leads").select("*").order("created_at")
  ]);
  const profileMap = new Map((profiles || []).map(p => [p.id, { id: p.id, name: p.full_name || "Usuario", avatar: p.avatar_data_url || "" }]));
  const me = profileMap.get(state.user.id);
  if (me) { state.user.name = me.name; state.user.avatar = me.avatar; }
  const actorFor = id => profileMap.get(id) || (id ? { id, name: "Usuario", avatar: "" } : SYSTEM_ACTOR);

  state.departures = (deps || []).map(d => ({
    id: d.id, brand: d.brand, destination: d.destination, start: d.start_date, end: d.end_date, capacity: d.capacity, notes: d.notes || "",
    bookings: (bookings || []).filter(b => b.departure_id === d.id).map(b => {
      const bPayments = (payments || []).filter(p => p.booking_id === b.id).map(p => ({
        id: p.id, amount: Number(p.amount || 0), paidOn: p.paid_on, method: p.method || "", reference: p.reference || "", notes: p.notes || "",
        createdBy: actorFor(p.created_by), updatedBy: actorFor(p.updated_by || p.created_by), createdAt: p.created_at, updatedAt: p.updated_at || p.created_at
      }));
      return {
        id: b.id, name: b.customer_name, total: Number(b.total_amount || 0), paid: bPayments.reduce((n, p) => n + p.amount, 0), notes: b.notes || "",
        createdBy: actorFor(b.created_by), updatedBy: actorFor(b.updated_by || b.created_by), payments: bPayments,
        invoice: {
          required: Boolean(b.invoice_required), status: b.billing_status || "no_solicitada", rfc: b.invoice_rfc || "", businessName: b.invoice_business_name || "",
          regime: b.invoice_tax_regime || "", zip: b.invoice_zip || "", cfdi: b.invoice_cfdi_use || "", email: b.invoice_email || "", folio: b.invoice_folio || "",
          date: b.invoice_date || "", notes: b.billing_notes || b.notes || "", updatedBy: actorFor(b.billing_updated_by || b.updated_by || b.created_by), updatedAt: b.billing_updated_at || b.updated_at || b.created_at
        },
        billing: b.billing_status || "no_solicitada",
        passengers: (pax || []).filter(p => p.booking_id === b.id).map(p => ({
          id: p.id, first: p.first_name, last1: p.last_name_1, last2: p.last_name_2 || "", birth: p.birth_date,
          createdBy: actorFor(p.created_by), updatedBy: actorFor(p.updated_by || p.created_by)
        }))
      };
    }),
    rooms: (rooms || []).filter(r => r.departure_id === d.id).map(r => ({
      id: r.id, number: r.room_number || "", type: r.room_type, bookingId: r.booking_id || "", notes: r.notes || "",
      passengerIds: (roomPax || []).filter(x => x.room_id === r.id).map(x => x.passenger_id), updatedBy: actorFor(r.updated_by || r.created_by), updatedAt: r.updated_at || r.created_at
    }))
  }));
  state.leads = (leads || []).map(l => ({ id: l.id, owner_id: l.owner_id, owner_name: l.owner_name || actorFor(l.owner_id).name, owner_avatar: l.owner_avatar || actorFor(l.owner_id).avatar, name: l.name, phone: l.phone, brand: l.brand, interest: l.interest, followup: l.next_followup, status: l.status, notes: l.notes }));
  normalizeStateData();
}

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault(); const email = $("#loginEmail").value.trim(); const password = $("#loginPassword").value;
  if (!state.supabase) { $("#loginMessage").textContent = "Supabase todavía no está configurado. Usa modo demo o activa js/supabase.js."; return; }
  $("#loginMessage").textContent = "Entrando...";
  const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
  if (error) { $("#loginMessage").textContent = error.message; return; }
  state.user = { id: data.user.id, name: data.user.user_metadata?.name || data.user.email, email: data.user.email, avatar: "" };
  await hydrateFromSupabase(); showMain();
});
$("#demoAccess").addEventListener("click", () => { loadDemoData(); showMain(); });
$("#logoutBtn").addEventListener("click", async () => { if (state.supabase) await state.supabase.auth.signOut(); showLogin(); });
$("#togglePassword").addEventListener("click", () => { const input = $("#loginPassword"); input.type = input.type === "password" ? "text" : "password"; });
$$('[data-close]').forEach(btn => btn.addEventListener("click", () => $("#" + btn.dataset.close).close()));

$$(".nav-item").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
$$('[data-jump]').forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.jump)));
$$('.brand-switch').forEach(btn => btn.addEventListener("click", () => setBrand(btn.dataset.brandTarget, "dashboard")));
$("#brandFilter").addEventListener("change", e => setBrand(e.target.value));
$("#departureSearch").addEventListener("input", renderDepartureCards);
$("#newDepartureBtn").addEventListener("click", () => $("#departureModal").showModal());
$("#newLeadBtn").addEventListener("click", () => $("#leadModal").showModal());
$("#profileBtn").addEventListener("click", openProfileModal);
$("#agencyPeriodMode").addEventListener("change", () => { renderAgencyFilterVisibility(); renderAgencies(); });
$("#agencyMonth").addEventListener("change", renderAgencies);
$("#agencyYear").addEventListener("input", renderAgencies);
$("#agencyStart").addEventListener("change", renderAgencies);
$("#agencyEnd").addEventListener("change", renderAgencies);
$("#agencySearch").addEventListener("input", renderAgencies);
$("#downloadAgencyReportBtn").addEventListener("click", downloadAgencyReportCSV);

function syncBrandFilterUI() { $("#brandFilter").value = state.brand; $$(".brand-switch").forEach(btn => btn.classList.toggle("active", btn.dataset.brandTarget === state.brand)); }
function setBrand(brand, targetView = null) {
  state.brand = brand; syncBrandFilterUI(); renderAll();
  const activeView = targetView || ($('.view.active')?.id || "dashboardView").replace("View", ""); switchView(activeView);
}
function switchView(name) {
  if (name === "agencies") {
    state.brand = "pink";
    syncBrandFilterUI();
  }
  $("#brandFilter").disabled = name === "agencies";
  $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  $$(".view").forEach(v => v.classList.remove("active")); $(`#${name}View`).classList.add("active");
  const labels = {
    dashboard: [state.brand === "all" ? "OPERACIÓN GENERAL" : `OPERACIÓN ${brandLabel(state.brand).toUpperCase()}`, "Inicio"],
    calendar: ["AGENDA DE VIAJES", "Calendario"],
    departures: ["OPERACIÓN", "Salidas"],
    crm: ["VISIBLE PARA TODO EL EQUIPO", "CRM Global"],
    agencies: ["PINK SKY TRAVEL", "Agencias"],
    payments: ["COBRANZA", "Pagos"],
    billing: ["FACTURACIÓN", "Facturación"]
  };
  $("#pageEyebrow").textContent = labels[name][0];
  $("#pageTitle").textContent = labels[name][1];
  if (name === "calendar") renderCalendar();
  if (name === "agencies") { renderAgencyFilterVisibility(); renderAgencies(); }
}

function renderAll() { renderDashboard(); renderCalendar(); renderDepartureCards(); renderCRM(); renderAgencies(); renderPayments(); renderBilling(); }
function renderDashboard() {
  const deps = filteredDepartures(); const leads = filteredLeads();
  $("#statDepartures").textContent = deps.length; $("#statPax").textContent = deps.reduce((n, d) => n + bookingPax(d), 0);
  $("#statPending").textContent = money.format(deps.reduce((n, d) => n + departureTotal(d) - departurePaid(d), 0));
  $("#statBilling").textContent = deps.reduce((n, d) => n + d.bookings.filter(b => b.invoice.required && b.invoice.status !== "facturada").length, 0);
  const sorted = [...deps].sort((a, b) => a.start.localeCompare(b.start));
  $("#upcomingDepartures").innerHTML = sorted.length ? sorted.map(d => `<button class="departure-row" data-departure="${d.id}" type="button"><div><strong>${escapeHTML(d.destination)}</strong><small>${dateFmt.format(parseDate(d.start))} · ${bookingPax(d)}/${d.capacity} pax</small></div>${brandChipHTML(d.brand, true)}</button>`).join("") : `<div class="empty">No hay salidas registradas.</div>`;
  $$('[data-departure]', $("#upcomingDepartures")).forEach(b => b.addEventListener("click", () => openDeparture(b.dataset.departure)));
  const followups = leads.filter(l => !["ganado", "perdido"].includes(l.status)).sort((a, b) => (a.followup || "9999-12-31").localeCompare(b.followup || "9999-12-31")).slice(0, 6);
  $("#todayFollowups").innerHTML = followups.length ? followups.map(l => `<div class="task-row"><div><strong>${escapeHTML(l.name)}</strong><small>${escapeHTML(l.interest || "Sin interés definido")} · ${brandLabel(l.brand)}</small></div>${actorHTML({ id: l.owner_id, name: l.owner_name, avatar: l.owner_avatar }, true)}</div>`).join("") : `<div class="empty">No hay seguimientos registrados.</div>`;
}
function renderCalendar() {
  const base = state.calendarDate; const y = base.getUTCFullYear(), m = base.getUTCMonth(); $("#calendarMonth").textContent = monthFmt.format(base);
  const first = new Date(Date.UTC(y, m, 1)); const mondayIndex = (first.getUTCDay() + 6) % 7; const start = new Date(first); start.setUTCDate(1 - mondayIndex);
  const heads = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(h => `<div class="calendar-cell calendar-head">${h}</div>`).join(""); let cells = "";
  for (let i = 0; i < 42; i++) { const d = new Date(start); d.setUTCDate(start.getUTCDate() + i); const iso = d.toISOString().slice(0, 10); const outside = d.getUTCMonth() !== m; const events = filteredDepartures().filter(dep => dep.start <= iso && dep.end >= iso); cells += `<div class="calendar-cell ${outside ? "outside" : ""}"><div class="day-number">${d.getUTCDate()}</div>${events.map(ev => `<button class="calendar-event ${ev.brand}" data-departure="${ev.id}" type="button">${escapeHTML(ev.destination)}</button>`).join("")}</div>`; }
  $("#calendarGrid").innerHTML = heads + cells; $$('[data-departure]', $("#calendarGrid")).forEach(b => b.addEventListener("click", () => openDeparture(b.dataset.departure)));
}
$("#prevMonth").addEventListener("click", () => { state.calendarDate = new Date(Date.UTC(state.calendarDate.getUTCFullYear(), state.calendarDate.getUTCMonth() - 1, 1)); renderCalendar(); });
$("#nextMonth").addEventListener("click", () => { state.calendarDate = new Date(Date.UTC(state.calendarDate.getUTCFullYear(), state.calendarDate.getUTCMonth() + 1, 1)); renderCalendar(); });
$("#todayBtn").addEventListener("click", () => { const n = new Date(); state.calendarDate = new Date(Date.UTC(n.getFullYear(), n.getMonth(), 1)); renderCalendar(); });
function renderDepartureCards() {
  const q = $("#departureSearch").value?.trim().toLowerCase() || ""; const deps = filteredDepartures().filter(d => d.destination.toLowerCase().includes(q));
  $("#departureCards").innerHTML = deps.length ? deps.map(d => { const pax = bookingPax(d), pending = departureTotal(d) - departurePaid(d); return `<article class="departure-card" data-departure="${d.id}">${brandChipHTML(d.brand)}<h4>${escapeHTML(d.destination)}</h4><p>${dateFmt.format(parseDate(d.start))} → ${dateFmt.format(parseDate(d.end))}<br>${daysBetween(d.start, d.end)} días</p><div class="card-metrics"><div class="metric"><strong>${pax}/${d.capacity}</strong><span>Pax</span></div><div class="metric"><strong>${d.bookings.length}</strong><span>Reservas</span></div><div class="metric"><strong>${money.format(pending)}</strong><span>Pendiente</span></div></div></article>`; }).join("") : `<div class="empty">No se encontraron salidas.</div>`;
  $$('[data-departure]', $("#departureCards")).forEach(c => c.addEventListener("click", () => openDeparture(c.dataset.departure)));
}
function renderCRM() {
  const statuses = [["nuevo", "Nuevo"], ["contactado", "Contactado"], ["cotizando", "Cotizando"], ["seguimiento", "Seguimiento"], ["ganado", "Ganado"], ["perdido", "Perdido"]]; const leads = filteredLeads();
  $("#crmPipeline").innerHTML = statuses.map(([key, label]) => `<section class="pipeline-col"><h4>${label} · ${leads.filter(l => l.status === key).length}</h4>${leads.filter(l => l.status === key).map(l => `<article class="lead-card"><strong>${escapeHTML(l.name)}</strong><small>${escapeHTML(l.interest || "Sin interés")} · ${brandLabel(l.brand)}</small><small>${l.followup ? `Seguimiento: ${dateFmt.format(parseDate(l.followup))}` : "Sin fecha"}</small>${actorHTML({ id: l.owner_id, name: l.owner_name, avatar: l.owner_avatar }, true)}</article>`).join("") || `<div class="empty">Sin prospectos</div>`}</section>`).join("");
}
function renderAgencyFilterVisibility() {
  const mode = $("#agencyPeriodMode").value;
  $("#agencyMonthWrap").classList.toggle("hidden", mode !== "month");
  $("#agencyYearWrap").classList.toggle("hidden", mode !== "year");
  $("#agencyStartWrap").classList.toggle("hidden", mode !== "custom");
  $("#agencyEndWrap").classList.toggle("hidden", mode !== "custom");
}
function agencyPeriodInfo() {
  const mode = $("#agencyPeriodMode").value;
  if (mode === "month") {
    const value = $("#agencyMonth").value || "2026-08";
    const [year, month] = value.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthName = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
    return { mode, start: `${value}-01`, end: `${value}-${String(lastDay).padStart(2, "0")}`, label: monthName.charAt(0).toUpperCase() + monthName.slice(1) };
  }
  if (mode === "year") {
    const year = Math.max(2020, Math.min(2100, Number($("#agencyYear").value) || 2026));
    return { mode, start: `${year}-01-01`, end: `${year}-12-31`, label: `Año ${year}` };
  }
  if (mode === "custom") {
    const start = $("#agencyStart").value || "0000-01-01";
    const end = $("#agencyEnd").value || "9999-12-31";
    const startLabel = $("#agencyStart").value ? dateFmt.format(parseDate(start)) : "inicio";
    const endLabel = $("#agencyEnd").value ? dateFmt.format(parseDate(end)) : "hoy";
    return { mode, start, end, label: `${startLabel} → ${endLabel}` };
  }
  return { mode: "all", start: "0000-01-01", end: "9999-12-31", label: "Todo el historial" };
}
function pinkAgencyRows(applySearch = true) {
  const period = agencyPeriodInfo();
  const search = applySearch ? ($("#agencySearch").value || "").trim().toLowerCase() : "";
  return state.departures
    .filter(d => d.brand === "pink" && d.start >= period.start && d.start <= period.end)
    .flatMap(d => d.bookings.map(b => {
      const paid = recalcBookingPaid(b);
      return {
        departureId: d.id,
        destination: d.destination,
        start: d.start,
        end: d.end,
        agency: b.name,
        bookingId: b.id,
        sales: Number(b.total || 0),
        paid,
        balance: Number(b.total || 0) - paid,
        pax: b.passengers.length,
        invoice: b.invoice,
        actor: bookingLastActor(b)
      };
    }))
    .filter(r => !search || r.agency.toLowerCase().includes(search));
}
function aggregatePinkAgencies(rows) {
  const map = new Map();
  rows.forEach(r => {
    const key = r.agency.trim().toLowerCase();
    if (!map.has(key)) map.set(key, { key, agency: r.agency, bookings: 0, pax: 0, sales: 0, paid: 0, balance: 0, destinations: new Set(), departures: new Set() });
    const a = map.get(key);
    a.bookings += 1; a.pax += r.pax; a.sales += r.sales; a.paid += r.paid; a.balance += r.balance; a.destinations.add(r.destination); a.departures.add(r.departureId);
  });
  return [...map.values()].map(a => ({ ...a, destinationCount: a.destinations.size, departureCount: a.departures.size, collectionPct: a.sales > 0 ? (a.paid / a.sales) * 100 : 0, avgTicket: a.bookings ? a.sales / a.bookings : 0 })).sort((a, b) => b.sales - a.sales || b.pax - a.pax);
}
function renderAgencies() {
  if (!$("#agenciesView")) return;
  renderAgencyFilterVisibility();
  const period = agencyPeriodInfo();
  const rows = pinkAgencyRows(true);
  const agencies = aggregatePinkAgencies(rows);
  const sales = rows.reduce((n, r) => n + r.sales, 0);
  const paid = rows.reduce((n, r) => n + r.paid, 0);
  const pending = rows.reduce((n, r) => n + r.balance, 0);
  const pax = rows.reduce((n, r) => n + r.pax, 0);

  $("#agencyStatCount").textContent = agencies.length;
  $("#agencyStatSales").textContent = money.format(sales);
  $("#agencyStatPaid").textContent = money.format(paid);
  $("#agencyStatPending").textContent = money.format(pending);
  $("#agencyStatPax").textContent = pax;
  $("#agencyStatBookings").textContent = rows.length;
  $("#agencyPeriodBadge").textContent = period.label;
  $("#agencyPeriodNote").textContent = `Periodo: ${period.label}. Las ventas se agrupan por la fecha de inicio de cada salida.`;

  $("#agencyRankingTable").innerHTML = agencies.length ? agencies.map((a, index) => `
    <tr>
      <td><div class="agency-name-cell"><span class="agency-rank">${index + 1}</span><img src="assets/pink-logo.png" alt=""><div><strong>${escapeHTML(a.agency)}</strong><small>${a.destinationCount} destino(s)</small></div></div></td>
      <td>${a.bookings}</td>
      <td>${a.pax}</td>
      <td><strong>${money.format(a.sales)}</strong></td>
      <td>${money.format(a.paid)}</td>
      <td class="${a.balance > 0 ? "agency-balance-pending" : ""}">${money.format(a.balance)}</td>
      <td><div class="agency-progress"><span style="width:${Math.max(0, Math.min(100, a.collectionPct)).toFixed(1)}%"></span></div><small>${a.collectionPct.toFixed(0)}%</small></td>
      <td>${money.format(a.avgTicket)}</td>
      <td><button class="small-btn" data-agency-detail="${escapeHTML(a.key)}">Ver</button></td>
    </tr>`).join("") : `<tr><td colspan="9"><div class="empty">No hay ventas de agencias Pink en este periodo.</div></td></tr>`;
  $$('[data-agency-detail]', $("#agencyRankingTable")).forEach(btn => btn.addEventListener("click", () => openAgencyDetail(btn.dataset.agencyDetail)));

  const destinationMap = new Map();
  rows.forEach(r => {
    if (!destinationMap.has(r.destination)) destinationMap.set(r.destination, { destination: r.destination, agencies: new Set(), sales: 0, paid: 0, pax: 0, bookings: 0 });
    const d = destinationMap.get(r.destination); d.agencies.add(r.agency.toLowerCase()); d.sales += r.sales; d.paid += r.paid; d.pax += r.pax; d.bookings += 1;
  });
  const destinations = [...destinationMap.values()].sort((a, b) => b.sales - a.sales);
  const maxDestinationSales = Math.max(...destinations.map(d => d.sales), 1);
  $("#agencyDestinationStats").innerHTML = destinations.length ? destinations.map(d => `
    <div class="agency-destination-row">
      <div class="agency-destination-title"><strong>${escapeHTML(d.destination)}</strong><span>${d.agencies.size} agencia(s) · ${d.pax} pax</span></div>
      <div class="agency-destination-bar"><span style="width:${(d.sales / maxDestinationSales * 100).toFixed(1)}%"></span></div>
      <div class="agency-destination-money"><strong>${money.format(d.sales)}</strong><span>${money.format(d.paid)} cobrado</span></div>
    </div>`).join("") : `<div class="empty">Sin destinos para mostrar.</div>`;
}
function openAgencyDetail(agencyKey) {
  const period = agencyPeriodInfo();
  const rows = pinkAgencyRows(false).filter(r => r.agency.trim().toLowerCase() === agencyKey);
  if (!rows.length) return;
  const a = aggregatePinkAgencies(rows)[0];
  $("#agencyDetailTitle").textContent = a.agency;
  $("#agencyDetailMeta").textContent = `${period.label} · ${a.bookings} reserva(s) · ${a.pax} pax`;
  $("#agencyDetailContent").innerHTML = `
    <div class="detail-summary agency-detail-summary">
      <div class="summary-box"><span>Ventas</span><strong>${money.format(a.sales)}</strong></div>
      <div class="summary-box"><span>Cobrado</span><strong>${money.format(a.paid)}</strong></div>
      <div class="summary-box"><span>Saldo</span><strong>${money.format(a.balance)}</strong></div>
      <div class="summary-box"><span>% cobrado</span><strong>${a.collectionPct.toFixed(0)}%</strong></div>
    </div>
    <div class="table-wrap agency-detail-table"><table><thead><tr><th>Salida</th><th>Fecha</th><th>Pax</th><th>Venta</th><th>Cobrado</th><th>Saldo</th><th>Último movimiento</th></tr></thead><tbody>
      ${rows.sort((x, y) => x.start.localeCompare(y.start)).map(r => `<tr><td><strong>${escapeHTML(r.destination)}</strong></td><td>${dateFmt.format(parseDate(r.start))}</td><td>${r.pax}</td><td>${money.format(r.sales)}</td><td>${money.format(r.paid)}</td><td>${money.format(r.balance)}</td><td>${actorHTML(r.actor, true)}</td></tr>`).join("")}
    </tbody></table></div>`;
  $("#agencyDetailModal").showModal();
}
async function downloadAgencyReportCSV() {
  const period = agencyPeriodInfo();
  const rows = pinkAgencyRows(true);
  const agencies = aggregatePinkAgencies(rows);
  const actor = currentActor();
  const meta = [["Reporte", "Agencias Pink Sky Travel"], ["Periodo", period.label], ["Exportado por", actor.name], ["Fecha", new Date().toLocaleString("es-MX")], []];
  const header = ["Agencia", "Reservas", "Pax", "Destinos", "Ventas", "Cobrado", "Saldo", "% cobrado", "Ticket promedio"];
  const body = agencies.map(a => [a.agency, a.bookings, a.pax, [...a.destinations].join(" / "), a.sales, a.paid, a.balance, a.collectionPct.toFixed(2), a.avgTicket.toFixed(2)]);
  const csv = [...meta, header, ...body].map(row => row.map(csvEscape).join(",")).join("\n");
  downloadText(`reporte-agencias-pink-${period.mode}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  await logAction("agency_report", "pink", "downloaded", { period: period.label, agencies: agencies.length, sales: rows.reduce((n, r) => n + r.sales, 0) });
}

function renderPayments() {
  const rows = filteredDepartures().flatMap(d => d.bookings.map(b => ({ d, b })));
  $("#paymentsTable").innerHTML = rows.length ? rows.map(({ d, b }) => { const paid = recalcBookingPaid(b), saldo = Number(b.total || 0) - paid; return `<tr><td>${escapeHTML(d.destination)}</td><td>${escapeHTML(b.name)}</td><td>${money.format(b.total || 0)}</td><td>${money.format(paid)}</td><td>${money.format(saldo)}</td><td>${actorHTML(bookingLastActor(b), true)}</td><td><button class="small-btn" data-manage-payment="${d.id}|${b.id}">Gestionar</button></td></tr>`; }).join("") : `<tr><td colspan="7">Sin pagos.</td></tr>`;
  $$('[data-manage-payment]', $("#paymentsTable")).forEach(btn => btn.addEventListener("click", () => { const [depId, bookingId] = btn.dataset.managePayment.split("|"); openDeparture(depId, "payments", bookingId); }));
}
function renderBilling() {
  const rows = filteredDepartures().flatMap(d => d.bookings.map(b => ({ d, b })));
  $("#billingTable").innerHTML = rows.length ? rows.map(({ d, b }) => `<tr><td>${escapeHTML(d.destination)}</td><td>${escapeHTML(b.name)}</td><td>${brandChipHTML(d.brand, true)}</td><td>${b.invoice.required ? "Sí" : "No"}</td><td><span class="status-chip ${invoiceStatusClass(b.invoice.status)}">${invoiceStatusLabel(b.invoice.status)}</span></td><td>${actorHTML(b.invoice.updatedBy || b.updatedBy, true)}</td><td><button class="small-btn" data-manage-billing="${d.id}|${b.id}">Editar</button></td></tr>`).join("") : `<tr><td colspan="7">Sin registros.</td></tr>`;
  $$('[data-manage-billing]', $("#billingTable")).forEach(btn => btn.addEventListener("click", () => { const [depId, bookingId] = btn.dataset.manageBilling.split("|"); openDeparture(depId, "billing", bookingId); }));
}

$("#departureForm").addEventListener("submit", async e => {
  e.preventDefault(); const dep = { id: uid("dep"), brand: $("#departureBrand").value, destination: $("#departureDestination").value.trim(), start: $("#departureStart").value, end: $("#departureEnd").value, capacity: Number($("#departureCapacity").value), notes: $("#departureNotes").value.trim(), bookings: [], rooms: [] };
  if (!dep.destination || !dep.start || !dep.end || dep.end < dep.start) { alert("Revisa destino y fechas."); return; }
  if (state.supabase) { const { data, error } = await state.supabase.from("departures").insert({ brand: dep.brand, destination: dep.destination, start_date: dep.start, end_date: dep.end, capacity: dep.capacity, notes: dep.notes, created_by: state.user.id }).select().single(); if (error) { alert(error.message); return; } dep.id = data.id; }
  state.departures.push(dep); await logAction("departure", dep.id, "created", { destination: dep.destination, brand: dep.brand }); saveDemoData(); $("#departureModal").close(); e.target.reset(); renderAll();
});
$("#leadForm").addEventListener("submit", async e => {
  e.preventDefault(); const actor = currentActor(); const lead = { id: uid("lead"), owner_id: actor.id, owner_name: actor.name, owner_avatar: actor.avatar, name: $("#leadName").value.trim(), phone: $("#leadPhone").value.trim(), brand: $("#leadBrand").value, interest: $("#leadInterest").value.trim(), followup: $("#leadFollowup").value, status: $("#leadStatus").value, notes: $("#leadNotes").value.trim() };
  if (state.supabase) { const { data, error } = await state.supabase.from("crm_leads").insert({ owner_id: lead.owner_id, owner_name: lead.owner_name, owner_avatar: lead.owner_avatar, name: lead.name, phone: lead.phone, brand: lead.brand, interest: lead.interest, next_followup: lead.followup || null, status: lead.status, notes: lead.notes }).select().single(); if (error) { alert(error.message); return; } lead.id = data.id; }
  state.leads.push(lead); await logAction("crm_lead", lead.id, "created", { name: lead.name }); saveDemoData(); $("#leadModal").close(); e.target.reset(); renderAll();
});

function openDeparture(id, tab = "summary", bookingId = "") {
  const d = findDeparture(id); if (!d) return;
  $("#detailBrand").innerHTML = brandChipHTML(d.brand); $("#detailTitle").textContent = d.destination; refreshDetailHeader(d);
  $("#departureDetailModal").dataset.departureId = d.id; $("#departureDetailModal").dataset.bookingId = bookingId || "";
  $$("#detailTabs button").forEach(b => b.classList.toggle("active", b.dataset.detailTab === tab)); renderDetail(tab); $("#departureDetailModal").showModal();
}
function refreshDetailHeader(dep) { $("#detailMeta").textContent = `${dateFmt.format(parseDate(dep.start))} → ${dateFmt.format(parseDate(dep.end))} · ${bookingPax(dep)}/${dep.capacity} pax`; }
$("#detailTabs").addEventListener("click", e => { const b = e.target.closest("[data-detail-tab]"); if (!b) return; $$("#detailTabs button").forEach(x => x.classList.toggle("active", x === b)); renderDetail(b.dataset.detailTab); });
function renderDetail(tab) { const d = findDeparture($("#departureDetailModal").dataset.departureId); if (!d) return; ({ summary: renderDetailSummary, bookings: renderDetailBookings, pax: renderDetailPassengers, rooming: renderDetailRooming, payments: renderDetailPayments, billing: renderDetailBilling })[tab]?.(d); }
function renderDetailSummary(d) {
  const total = departureTotal(d), paid = departurePaid(d); $("#detailContent").innerHTML = `<div class="detail-summary"><div class="summary-box"><span>Pasajeros</span><strong>${bookingPax(d)} / ${d.capacity}</strong></div><div class="summary-box"><span>Reservas</span><strong>${d.bookings.length}</strong></div><div class="summary-box"><span>Cobrado</span><strong>${money.format(paid)}</strong></div><div class="summary-box"><span>Saldo</span><strong>${money.format(total - paid)}</strong></div></div><div class="summary-note">${escapeHTML(d.notes || "Sin notas.")}</div>`;
}
function renderDetailBookings(d) {
  $("#detailContent").innerHTML = `<div class="detail-toolbar"><div><strong>Agencias / clientes de esta salida</strong><p class="muted-toolbar">Cada reserva concentra pasajeros, pagos y facturación.</p></div><button class="primary-btn compact" id="addBookingBtn">+ Agregar</button></div>${d.bookings.length ? d.bookings.map(b => `<div class="manage-row"><div><strong>${escapeHTML(b.name)}</strong><small>${b.passengers.length} pax · Total ${money.format(b.total || 0)} · Pagado ${money.format(recalcBookingPaid(b))}</small>${actorHTML(b.updatedBy || b.createdBy, true)}</div><button class="small-btn" data-edit-booking="${b.id}">Editar</button></div>`).join("") : `<div class="empty">Todavía no hay agencias o clientes.</div>`}`;
  $("#addBookingBtn").addEventListener("click", () => openBookingModal(d.id)); $$('[data-edit-booking]', $("#detailContent")).forEach(btn => btn.addEventListener("click", () => openBookingModal(d.id, btn.dataset.editBooking)));
}
function passengerRows(d) { return d.bookings.flatMap(b => b.passengers.map(p => ({ b, p }))); }
function renderDetailPassengers(d) {
  const rows = passengerRows(d);
  $("#detailContent").innerHTML = `<div class="detail-toolbar"><div><strong>Listado de pasajeros</strong><p class="muted-toolbar">Captura y edita desde una pantalla separada.</p></div><div class="inline-actions"><button class="primary-btn compact" id="addPassengerBtn">+ Agregar pasajero</button><button class="ghost-btn compact" id="downloadPassengerListBtn">Descargar CSV</button><button class="ghost-btn compact" id="printPassengerListBtn">Imprimir</button></div></div>${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Nombre completo</th><th>Nacimiento</th><th>Edad</th><th>Agencia / cliente</th><th>Capturó</th><th>Acciones</th></tr></thead><tbody>${rows.map(({ b, p }) => `<tr><td><strong>${escapeHTML(fullName(p))}</strong></td><td>${dateFmt.format(parseDate(p.birth))}</td><td>${ageAt(p.birth)}</td><td>${escapeHTML(b.name)}</td><td>${actorHTML(p.updatedBy || p.createdBy, true)}</td><td><div class="row-actions"><button class="small-btn" data-edit-passenger="${p.id}">Editar</button><button class="small-btn danger" data-delete-passenger="${p.id}">Borrar</button></div></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Todavía no hay pasajeros capturados.</div>`}`;
  $("#addPassengerBtn").addEventListener("click", () => openPassengerModal(d.id)); $("#downloadPassengerListBtn").addEventListener("click", () => downloadPassengerCSV(d.id)); $("#printPassengerListBtn").addEventListener("click", () => printPassengerList(d.id));
  $$('[data-edit-passenger]', $("#detailContent")).forEach(btn => btn.addEventListener("click", () => openPassengerModal(d.id, btn.dataset.editPassenger))); $$('[data-delete-passenger]', $("#detailContent")).forEach(btn => btn.addEventListener("click", () => deletePassenger(d.id, btn.dataset.deletePassenger)));
}
function renderDetailRooming(d) {
  const rooms = d.rooms || [];
  $("#detailContent").innerHTML = `<div class="detail-toolbar"><div><strong>Rooming List</strong><p class="muted-toolbar">Crea habitaciones, asigna pasajeros y edita la distribución.</p></div><div class="inline-actions"><button class="primary-btn compact" id="addRoomBtn">+ Nueva habitación</button><button class="ghost-btn compact" id="downloadRoomingBtn">Descargar CSV</button><button class="ghost-btn compact" id="printRoomingBtn">Imprimir</button></div></div>${rooms.length ? `<div class="room-grid">${rooms.map(r => roomCardHTML(d, r)).join("")}</div>` : `<div class="empty">Todavía no hay habitaciones asignadas.</div>`}`;
  $("#addRoomBtn").addEventListener("click", () => openRoomModal(d.id)); $("#downloadRoomingBtn").addEventListener("click", () => downloadRoomingCSV(d.id)); $("#printRoomingBtn").addEventListener("click", () => printRooming(d.id));
  $$('[data-edit-room]', $("#detailContent")).forEach(btn => btn.addEventListener("click", () => openRoomModal(d.id, btn.dataset.editRoom))); $$('[data-delete-room]', $("#detailContent")).forEach(btn => btn.addEventListener("click", () => deleteRoom(d.id, btn.dataset.deleteRoom)));
}
function roomCardHTML(d, room) {
  const booking = findBooking(d, room.bookingId); const names = (room.passengerIds || []).map(id => findPassengerRecord(d, id)?.passenger).filter(Boolean).map(fullName);
  return `<article class="room-card"><div class="room-card-head"><div><span class="room-type">${escapeHTML(room.type)}</span><h4>${escapeHTML(room.number || "Habitación")}</h4></div><div class="row-actions"><button class="small-btn" data-edit-room="${room.id}">Editar</button><button class="small-btn danger" data-delete-room="${room.id}">Borrar</button></div></div><p><strong>${escapeHTML(booking?.name || "Sin agencia / cliente")}</strong></p><ul>${names.length ? names.map(n => `<li>${escapeHTML(n)}</li>`).join("") : `<li>Sin pasajeros</li>`}</ul>${room.notes ? `<p class="room-notes">${escapeHTML(room.notes)}</p>` : ""}<div class="movement-line">Actualizó ${actorHTML(room.updatedBy, true)}</div></article>`;
}
function renderDetailPayments(d) {
  const selectedBooking = $("#departureDetailModal").dataset.bookingId || "";
  $("#detailContent").innerHTML = `<div class="detail-toolbar"><div><strong>Pagos y saldos</strong><p class="muted-toolbar">Registra abonos, edita movimientos y conserva quién los capturó.</p></div><button class="primary-btn compact" id="addPaymentBtn">+ Registrar pago</button></div>${d.bookings.length ? d.bookings.map(b => paymentBookingCardHTML(d, b, selectedBooking === b.id)).join("") : `<div class="empty">Primero agrega una agencia / cliente.</div>`}`;
  $("#addPaymentBtn").addEventListener("click", () => openPaymentModal(d.id, "", selectedBooking));
  $$('[data-add-payment-booking]', $("#detailContent")).forEach(btn => btn.addEventListener("click", () => openPaymentModal(d.id, "", btn.dataset.addPaymentBooking)));
  $$('[data-edit-payment]', $("#detailContent")).forEach(btn => btn.addEventListener("click", () => openPaymentModal(d.id, btn.dataset.editPayment)));
  $$('[data-delete-payment]', $("#detailContent")).forEach(btn => btn.addEventListener("click", () => deletePayment(d.id, btn.dataset.deletePayment)));
  $$('[data-edit-booking-total]', $("#detailContent")).forEach(btn => btn.addEventListener("click", () => openBookingModal(d.id, btn.dataset.editBookingTotal)));
}
function paymentBookingCardHTML(d, b, highlight) {
  const paid = recalcBookingPaid(b), saldo = Number(b.total || 0) - paid; const payments = [...(b.payments || [])].sort((a, z) => String(z.paidOn).localeCompare(String(a.paidOn)));
  return `<section class="finance-card ${highlight ? "highlight" : ""}"><div class="finance-head"><div><strong>${escapeHTML(b.name)}</strong><small>Total ${money.format(b.total || 0)} · Pagado ${money.format(paid)} · Saldo ${money.format(saldo)}</small></div><div class="inline-actions"><button class="small-btn" data-edit-booking-total="${b.id}">Editar total</button><button class="primary-btn compact" data-add-payment-booking="${b.id}">+ Abono</button></div></div>${payments.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Referencia</th><th>Capturó</th><th>Acciones</th></tr></thead><tbody>${payments.map(p => `<tr><td>${dateFmt.format(parseDate(p.paidOn))}</td><td><strong>${money.format(p.amount)}</strong></td><td>${escapeHTML(p.method || "—")}</td><td>${escapeHTML(p.reference || "—")}</td><td>${actorHTML(p.updatedBy || p.createdBy, true)}</td><td><div class="row-actions"><button class="small-btn" data-edit-payment="${p.id}">Editar</button><button class="small-btn danger" data-delete-payment="${p.id}">Borrar</button></div></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty compact-empty">Sin pagos registrados.</div>`}</section>`;
}
function renderDetailBilling(d) {
  const selectedBooking = $("#departureDetailModal").dataset.bookingId || "";
  $("#detailContent").innerHTML = `<div class="detail-toolbar"><div><strong>Facturación</strong><p class="muted-toolbar">Define si requiere factura, estatus, datos fiscales, folio y fecha.</p></div></div>${d.bookings.length ? `<div class="billing-grid">${d.bookings.map(b => billingCardHTML(b, selectedBooking === b.id)).join("")}</div>` : `<div class="empty">Primero agrega una agencia / cliente.</div>`}`;
  $$('[data-edit-billing]', $("#detailContent")).forEach(btn => btn.addEventListener("click", () => openBillingModal(d.id, btn.dataset.editBilling)));
}
function billingCardHTML(b, highlight) {
  const i = b.invoice; return `<article class="billing-card ${highlight ? "highlight" : ""}"><div class="billing-card-head"><div><strong>${escapeHTML(b.name)}</strong><small>${i.required ? "Requiere factura" : "No requiere factura"}</small></div><span class="status-chip ${invoiceStatusClass(i.status)}">${invoiceStatusLabel(i.status)}</span></div><div class="billing-meta"><span>RFC: <strong>${escapeHTML(i.rfc || "—")}</strong></span><span>Folio: <strong>${escapeHTML(i.folio || "—")}</strong></span><span>Correo: <strong>${escapeHTML(i.email || "—")}</strong></span></div><p>${escapeHTML(i.notes || "Sin notas")}</p><div class="billing-card-foot"><span>Actualizó ${actorHTML(i.updatedBy || b.updatedBy, true)}</span><button class="small-btn" data-edit-billing="${b.id}">Editar facturación</button></div></article>`;
}

function openBookingModal(depId, bookingId = "") {
  const dep = findDeparture(depId); const b = findBooking(dep, bookingId); $("#bookingForm").dataset.departureId = depId; $("#bookingId").value = bookingId;
  $("#bookingModalTitle").textContent = b ? "Editar agencia / cliente" : "Agregar agencia / cliente"; $("#bookingName").value = b?.name || ""; $("#bookingTotal").value = b?.total ?? ""; $("#bookingNotes").value = b?.notes || ""; $("#bookingModal").showModal();
}
$("#bookingForm").addEventListener("submit", async e => {
  e.preventDefault(); const dep = findDeparture(e.currentTarget.dataset.departureId); if (!dep) return; const id = $("#bookingId").value; const existing = findBooking(dep, id); const actor = currentActor();
  const payload = { name: $("#bookingName").value.trim(), total: Number($("#bookingTotal").value || 0), notes: $("#bookingNotes").value.trim() }; if (!payload.name) return;
  if (existing) { existing.name = payload.name; existing.total = payload.total; existing.notes = payload.notes; existing.updatedBy = actor; if (state.supabase) { const { error } = await state.supabase.from("bookings").update({ customer_name: existing.name, total_amount: existing.total, notes: existing.notes, updated_by: actor.id, updated_at: nowISO() }).eq("id", existing.id); if (error) { alert(error.message); return; } } await logAction("booking", existing.id, "updated", { name: existing.name, total: existing.total }); }
  else { const b = { id: uid("booking"), name: payload.name, total: payload.total, paid: 0, notes: payload.notes, passengers: [], payments: [], createdBy: actor, updatedBy: actor, invoice: { required: false, status: "no_solicitada", rfc: "", businessName: "", regime: "", zip: "", cfdi: "", email: "", folio: "", date: "", notes: "", updatedBy: actor, updatedAt: nowISO() }, billing: "no_solicitada" }; if (state.supabase) { const { data, error } = await state.supabase.from("bookings").insert({ departure_id: dep.id, customer_name: b.name, total_amount: b.total, paid_amount: 0, billing_status: "no_solicitada", notes: b.notes, created_by: actor.id, updated_by: actor.id }).select().single(); if (error) { alert(error.message); return; } b.id = data.id; } dep.bookings.push(b); await logAction("booking", b.id, "created", { name: b.name, total: b.total }); }
  saveDemoData(); $("#bookingModal").close(); renderAll(); renderDetail("bookings"); refreshDetailHeader(dep);
});

function fillBookingSelect(select, dep, selected = "") { select.innerHTML = dep.bookings.map(b => `<option value="${b.id}" ${b.id === selected ? "selected" : ""}>${escapeHTML(b.name)}</option>`).join(""); }
function openPassengerModal(depId, passengerId = "") {
  const dep = findDeparture(depId); if (!dep) return; if (!dep.bookings.length) { alert("Primero agrega una agencia / cliente en esta salida."); return; }
  $("#passengerForm").dataset.departureId = depId; $("#passengerId").value = passengerId; const record = passengerId ? findPassengerRecord(dep, passengerId) : null;
  $("#passengerModalTitle").textContent = record ? "Editar pasajero" : "Agregar pasajero"; fillBookingSelect($("#passengerBooking"), dep, record?.booking.id || dep.bookings[0].id);
  $("#passengerFirst").value = record?.passenger.first || ""; $("#passengerLast1").value = record?.passenger.last1 || ""; $("#passengerLast2").value = record?.passenger.last2 || ""; $("#passengerBirth").value = record?.passenger.birth || ""; $("#passengerModal").showModal();
}
$("#passengerForm").addEventListener("submit", async e => {
  e.preventDefault(); const dep = findDeparture(e.currentTarget.dataset.departureId); if (!dep) return; const passengerId = $("#passengerId").value; const targetBooking = findBooking(dep, $("#passengerBooking").value); if (!targetBooking) return; const actor = currentActor();
  const payload = { first: $("#passengerFirst").value.trim(), last1: $("#passengerLast1").value.trim(), last2: $("#passengerLast2").value.trim(), birth: $("#passengerBirth").value }; if (!payload.first || !payload.last1 || !payload.birth) return;
  if (passengerId) { const record = findPassengerRecord(dep, passengerId); if (!record) return; record.booking.passengers.splice(record.index, 1); const p = { ...record.passenger, ...payload, updatedBy: actor }; targetBooking.passengers.push(p); if (state.supabase) { const { error } = await state.supabase.from("passengers").update({ booking_id: targetBooking.id, first_name: p.first, last_name_1: p.last1, last_name_2: p.last2 || null, birth_date: p.birth, updated_by: actor.id, updated_at: nowISO() }).eq("id", p.id); if (error) { alert(error.message); return; } } await logAction("passenger", p.id, "updated", { name: fullName(p) }); }
  else { const p = { id: uid("pax"), ...payload, createdBy: actor, updatedBy: actor }; if (state.supabase) { const { data, error } = await state.supabase.from("passengers").insert({ booking_id: targetBooking.id, first_name: p.first, last_name_1: p.last1, last_name_2: p.last2 || null, birth_date: p.birth, created_by: actor.id, updated_by: actor.id }).select().single(); if (error) { alert(error.message); return; } p.id = data.id; } targetBooking.passengers.push(p); await logAction("passenger", p.id, "created", { name: fullName(p) }); }
  saveDemoData(); $("#passengerModal").close(); renderAll(); renderDetail("pax"); refreshDetailHeader(dep);
});
async function deletePassenger(depId, passengerId) {
  const dep = findDeparture(depId); const record = findPassengerRecord(dep, passengerId); if (!record || !confirm(`¿Borrar a ${fullName(record.passenger)}?`)) return;
  record.booking.passengers.splice(record.index, 1); dep.rooms.forEach(r => r.passengerIds = (r.passengerIds || []).filter(id => id !== passengerId)); if (state.supabase) { const { error } = await state.supabase.from("passengers").delete().eq("id", passengerId); if (error) { alert(error.message); return; } }
  await logAction("passenger", passengerId, "deleted", { name: fullName(record.passenger) }); saveDemoData(); renderAll(); renderDetail("pax"); refreshDetailHeader(dep);
}

function openRoomModal(depId, roomId = "") {
  const dep = findDeparture(depId); if (!dep) return; if (!passengerRows(dep).length) { alert("Primero captura pasajeros."); return; }
  const room = findRoom(dep, roomId); $("#roomForm").dataset.departureId = depId; $("#roomId").value = roomId; $("#roomModalTitle").textContent = room ? "Editar habitación" : "Nueva habitación"; $("#roomNumber").value = room?.number || ""; $("#roomType").value = room?.type || "DBL"; fillBookingSelect($("#roomBooking"), dep, room?.bookingId || dep.bookings[0]?.id || ""); $("#roomNotes").value = room?.notes || "";
  renderRoomPassengerChecks(dep, $("#roomBooking").value, room?.passengerIds || []); $("#roomBooking").onchange = () => renderRoomPassengerChecks(dep, $("#roomBooking").value, room?.passengerIds || []); $("#roomModal").showModal();
}
function renderRoomPassengerChecks(dep, bookingId, selectedIds = []) {
  const booking = findBooking(dep, bookingId); $("#roomPassengerChecks").innerHTML = booking?.passengers.length ? booking.passengers.map(p => `<label class="check-card"><input type="checkbox" value="${p.id}" ${selectedIds.includes(p.id) ? "checked" : ""}><span>${escapeHTML(fullName(p))}</span></label>`).join("") : `<div class="empty compact-empty">Sin pasajeros en esta reserva.</div>`;
}
$("#roomForm").addEventListener("submit", async e => {
  e.preventDefault(); const dep = findDeparture(e.currentTarget.dataset.departureId); if (!dep) return; const id = $("#roomId").value; const existing = findRoom(dep, id); const actor = currentActor(); const passengerIds = $$('#roomPassengerChecks input:checked').map(x => x.value); const payload = { number: $("#roomNumber").value.trim(), type: $("#roomType").value, bookingId: $("#roomBooking").value, passengerIds, notes: $("#roomNotes").value.trim(), updatedBy: actor, updatedAt: nowISO() };
  if (existing) { Object.assign(existing, payload); if (state.supabase) { const { error } = await state.supabase.from("rooms").update({ room_number: existing.number, room_type: existing.type, booking_id: existing.bookingId || null, notes: existing.notes, updated_by: actor.id, updated_at: existing.updatedAt }).eq("id", existing.id); if (error) { alert(error.message); return; } await state.supabase.from("room_passengers").delete().eq("room_id", existing.id); if (passengerIds.length) await state.supabase.from("room_passengers").insert(passengerIds.map(pid => ({ room_id: existing.id, passenger_id: pid }))); } await logAction("room", existing.id, "updated", { room: existing.number, type: existing.type }); }
  else { const room = { id: uid("room"), ...payload }; if (state.supabase) { const { data, error } = await state.supabase.from("rooms").insert({ departure_id: dep.id, booking_id: room.bookingId || null, room_number: room.number, room_type: room.type, notes: room.notes, created_by: actor.id, updated_by: actor.id }).select().single(); if (error) { alert(error.message); return; } room.id = data.id; if (passengerIds.length) await state.supabase.from("room_passengers").insert(passengerIds.map(pid => ({ room_id: room.id, passenger_id: pid }))); } dep.rooms.push(room); await logAction("room", room.id, "created", { room: room.number, type: room.type }); }
  saveDemoData(); $("#roomModal").close(); renderDetail("rooming");
});
async function deleteRoom(depId, roomId) { const dep = findDeparture(depId); const room = findRoom(dep, roomId); if (!room || !confirm(`¿Borrar ${room.number || "esta habitación"}?`)) return; dep.rooms = dep.rooms.filter(r => r.id !== roomId); if (state.supabase) { const { error } = await state.supabase.from("rooms").delete().eq("id", roomId); if (error) { alert(error.message); return; } } await logAction("room", roomId, "deleted", { room: room.number }); saveDemoData(); renderDetail("rooming"); }

function openPaymentModal(depId, paymentId = "", bookingId = "") {
  const dep = findDeparture(depId); if (!dep) return; if (!dep.bookings.length) { alert("Primero agrega una agencia / cliente."); return; }
  const record = paymentId ? findPaymentRecord(dep, paymentId) : null; $("#paymentForm").dataset.departureId = depId; $("#paymentId").value = paymentId; $("#paymentModalTitle").textContent = record ? "Editar pago" : "Registrar pago"; fillBookingSelect($("#paymentBooking"), dep, record?.booking.id || bookingId || dep.bookings[0].id);
  $("#paymentAmount").value = record?.payment.amount ?? ""; $("#paymentDate").value = record?.payment.paidOn || new Date().toISOString().slice(0, 10); $("#paymentMethod").value = record?.payment.method || "Transferencia"; $("#paymentReference").value = record?.payment.reference || ""; $("#paymentNotes").value = record?.payment.notes || ""; $("#paymentModal").showModal();
}
$("#paymentForm").addEventListener("submit", async e => {
  e.preventDefault(); const dep = findDeparture(e.currentTarget.dataset.departureId); if (!dep) return; const paymentId = $("#paymentId").value; const targetBooking = findBooking(dep, $("#paymentBooking").value); if (!targetBooking) return; const actor = currentActor(); const payload = { amount: Number($("#paymentAmount").value), paidOn: $("#paymentDate").value, method: $("#paymentMethod").value, reference: $("#paymentReference").value.trim(), notes: $("#paymentNotes").value.trim(), updatedBy: actor, updatedAt: nowISO() }; if (!payload.amount || payload.amount <= 0) return;
  if (paymentId) { const record = findPaymentRecord(dep, paymentId); if (!record) return; record.booking.payments.splice(record.index, 1); const p = { ...record.payment, ...payload }; targetBooking.payments.push(p); if (state.supabase) { const { error } = await state.supabase.from("payments").update({ booking_id: targetBooking.id, amount: p.amount, paid_on: p.paidOn, method: p.method, reference: p.reference, notes: p.notes, updated_by: actor.id, updated_at: p.updatedAt }).eq("id", p.id); if (error) { alert(error.message); return; } } await logAction("payment", p.id, "updated", { amount: p.amount, customer: targetBooking.name }); }
  else { const p = { id: uid("pay"), ...payload, createdBy: actor, createdAt: nowISO() }; if (state.supabase) { const { data, error } = await state.supabase.from("payments").insert({ booking_id: targetBooking.id, amount: p.amount, paid_on: p.paidOn, method: p.method, reference: p.reference, notes: p.notes, created_by: actor.id, updated_by: actor.id }).select().single(); if (error) { alert(error.message); return; } p.id = data.id; } targetBooking.payments.push(p); await logAction("payment", p.id, "created", { amount: p.amount, customer: targetBooking.name }); }
  dep.bookings.forEach(b => recalcBookingPaid(b)); if (state.supabase) for (const b of dep.bookings) await state.supabase.from("bookings").update({ paid_amount: b.paid }).eq("id", b.id);
  saveDemoData(); $("#paymentModal").close(); renderAll(); renderDetail("payments");
});
async function deletePayment(depId, paymentId) { const dep = findDeparture(depId); const record = findPaymentRecord(dep, paymentId); if (!record || !confirm(`¿Borrar el pago de ${money.format(record.payment.amount)}?`)) return; record.booking.payments.splice(record.index, 1); recalcBookingPaid(record.booking); if (state.supabase) { const { error } = await state.supabase.from("payments").delete().eq("id", paymentId); if (error) { alert(error.message); return; } await state.supabase.from("bookings").update({ paid_amount: record.booking.paid }).eq("id", record.booking.id); } await logAction("payment", paymentId, "deleted", { amount: record.payment.amount, customer: record.booking.name }); saveDemoData(); renderAll(); renderDetail("payments"); }

function openBillingModal(depId, bookingId) {
  const dep = findDeparture(depId); const b = findBooking(dep, bookingId); if (!b) return; const i = b.invoice; $("#billingForm").dataset.departureId = depId; $("#billingBookingId").value = bookingId; $("#billingBookingName").value = b.name; $("#invoiceRequired").value = String(Boolean(i.required)); $("#invoiceStatus").value = i.status || "no_solicitada"; $("#invoiceRFC").value = i.rfc || ""; $("#invoiceBusinessName").value = i.businessName || ""; $("#invoiceRegime").value = i.regime || ""; $("#invoiceZip").value = i.zip || ""; $("#invoiceCFDI").value = i.cfdi || ""; $("#invoiceEmail").value = i.email || ""; $("#invoiceFolio").value = i.folio || ""; $("#invoiceDate").value = i.date || ""; $("#invoiceNotes").value = i.notes || ""; $("#billingModal").showModal();
}
$("#billingForm").addEventListener("submit", async e => {
  e.preventDefault(); const dep = findDeparture(e.currentTarget.dataset.departureId); const b = findBooking(dep, $("#billingBookingId").value); if (!b) return; const actor = currentActor(); const i = { required: $("#invoiceRequired").value === "true", status: $("#invoiceStatus").value, rfc: $("#invoiceRFC").value.trim(), businessName: $("#invoiceBusinessName").value.trim(), regime: $("#invoiceRegime").value.trim(), zip: $("#invoiceZip").value.trim(), cfdi: $("#invoiceCFDI").value.trim(), email: $("#invoiceEmail").value.trim(), folio: $("#invoiceFolio").value.trim(), date: $("#invoiceDate").value, notes: $("#invoiceNotes").value.trim(), updatedBy: actor, updatedAt: nowISO() }; if (!i.required) i.status = "no_solicitada"; b.invoice = i; b.billing = i.status; b.updatedBy = actor;
  if (state.supabase) { const { error } = await state.supabase.from("bookings").update({ invoice_required: i.required, billing_status: i.status, invoice_rfc: i.rfc || null, invoice_business_name: i.businessName || null, invoice_tax_regime: i.regime || null, invoice_zip: i.zip || null, invoice_cfdi_use: i.cfdi || null, invoice_email: i.email || null, invoice_folio: i.folio || null, invoice_date: i.date || null, billing_notes: i.notes || null, billing_updated_by: actor.id, billing_updated_at: i.updatedAt, updated_by: actor.id, updated_at: i.updatedAt }).eq("id", b.id); if (error) { alert(error.message); return; } }
  await logAction("billing", b.id, "updated", { customer: b.name, required: i.required, status: i.status }); saveDemoData(); $("#billingModal").close(); renderAll(); renderDetail("billing");
});

function csvEscape(v) { return `"${String(v ?? "").replace(/"/g, '""')}"`; }
function downloadText(filename, text, type = "text/csv;charset=utf-8;") { const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
async function downloadPassengerCSV(depId) {
  const dep = findDeparture(depId); if (!dep) return; const actor = currentActor(); const header = ["Salida", "Marca", "Agencia/Cliente", "Nombre(s)", "Apellido paterno", "Apellido materno", "Fecha de nacimiento", "Nombre completo", "Edad", "Capturado por"];
  const body = passengerRows(dep).map(({ b, p }) => [dep.destination, brandLabel(dep.brand), b.name, p.first, p.last1, p.last2 || "", p.birth, fullName(p), ageAt(p.birth), (p.updatedBy || p.createdBy || SYSTEM_ACTOR).name]);
  const meta = [["Exportado por", actor.name], ["Fecha de exportación", new Date().toLocaleString("es-MX")], []]; const csv = [...meta, header, ...body].map(r => r.map(csvEscape).join(",")).join("\n"); downloadText(`listado-pasajeros-${dep.destination.toLowerCase().replace(/\s+/g, "-")}.csv`, csv); await logAction("passenger_list", dep.id, "downloaded", { destination: dep.destination });
}
async function downloadRoomingCSV(depId) {
  const dep = findDeparture(depId); if (!dep) return; const actor = currentActor(); const header = ["Habitación", "Tipo", "Agencia/Cliente", "Pasajeros", "Notas", "Última actualización"];
  const body = (dep.rooms || []).map(r => { const b = findBooking(dep, r.bookingId); const names = (r.passengerIds || []).map(id => findPassengerRecord(dep, id)?.passenger).filter(Boolean).map(fullName).join(" / "); return [r.number || "Habitación", r.type, b?.name || "", names, r.notes || "", r.updatedBy?.name || ""]; });
  const meta = [["Exportado por", actor.name], ["Fecha de exportación", new Date().toLocaleString("es-MX")], []]; downloadText(`rooming-${dep.destination.toLowerCase().replace(/\s+/g, "-")}.csv`, [...meta, header, ...body].map(r => r.map(csvEscape).join(",")).join("\n")); await logAction("rooming", dep.id, "downloaded", { destination: dep.destination });
}
function printHeaderHTML(title, dep) {
  const actor = currentActor(); const actorAvatar = actor.avatar ? `<img src="${actor.avatar}" class="print-avatar">` : `<span class="print-avatar fallback">${escapeHTML(actorLetter(actor))}</span>`;
  const brandLogo = new URL(brandAsset(dep.brand), location.href).href; const opsLogo = new URL("assets/travel-ops-logo.png", location.href).href;
  return `<div class="print-head"><img src="${opsLogo}" class="print-logo"><div><h1>${escapeHTML(title)}</h1><p>${escapeHTML(dep.destination)} · ${dateFmt.format(parseDate(dep.start))} → ${dateFmt.format(parseDate(dep.end))}</p><div class="print-brand"><img src="${brandLogo}">${escapeHTML(brandLabel(dep.brand))}</div></div></div><div class="printed-by">${actorAvatar}<div><strong>Impreso por ${escapeHTML(actor.name)}</strong><span>${new Date().toLocaleString("es-MX")}</span></div></div>`;
}
async function openPrintWindow(dep, title, bodyHTML, auditAction) {
  const win = window.open("", "_blank", "width=1000,height=760"); if (!win) { alert("El navegador bloqueó la ventana de impresión."); return; }
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(title)}</title><style>body{font-family:Arial,sans-serif;color:#161b22;padding:28px}.print-head{display:flex;gap:24px;align-items:center;border-bottom:2px solid #111827;padding-bottom:16px}.print-logo{width:180px;max-height:90px;object-fit:contain}.print-brand{display:flex;gap:8px;align-items:center;font-size:12px}.print-brand img{width:24px;height:24px;object-fit:contain}.printed-by{display:flex;gap:10px;align-items:center;margin:18px 0;padding:10px 12px;background:#f3f4f6;border-radius:12px}.printed-by span{display:block;font-size:11px;color:#667085;margin-top:3px}.print-avatar{width:38px;height:38px;border-radius:50%;object-fit:cover}.print-avatar.fallback{display:grid;place-items:center;background:#111827;color:white}.print-table{width:100%;border-collapse:collapse;margin-top:18px}.print-table th,.print-table td{border-bottom:1px solid #ddd;padding:9px;text-align:left;font-size:12px}.print-table th{font-size:10px;text-transform:uppercase;color:#667085}.room-block{border:1px solid #ddd;border-radius:10px;padding:12px;margin:10px 0}.room-block h3{margin:0 0 6px}</style></head><body>${printHeaderHTML(title, dep)}${bodyHTML}</body></html>`); win.document.close(); await logAction(auditAction, dep.id, "printed", { destination: dep.destination }); setTimeout(() => { win.focus(); win.print(); }, 250);
}
function printPassengerList(depId) {
  const dep = findDeparture(depId); if (!dep) return; const rows = passengerRows(dep); const body = `<table class="print-table"><thead><tr><th>Nombre completo</th><th>Nacimiento</th><th>Agencia / cliente</th></tr></thead><tbody>${rows.map(({ b, p }) => `<tr><td>${escapeHTML(fullName(p))}</td><td>${escapeHTML(p.birth)}</td><td>${escapeHTML(b.name)}</td></tr>`).join("")}</tbody></table>`; openPrintWindow(dep, "Lista de pasajeros", body, "passenger_list");
}
function printRooming(depId) {
  const dep = findDeparture(depId); if (!dep) return; const body = (dep.rooms || []).map(r => { const b = findBooking(dep, r.bookingId); const names = (r.passengerIds || []).map(id => findPassengerRecord(dep, id)?.passenger).filter(Boolean).map(fullName); return `<div class="room-block"><h3>${escapeHTML(r.number || "Habitación")} · ${escapeHTML(r.type)}</h3><p><strong>${escapeHTML(b?.name || "")}</strong></p><p>${names.map(escapeHTML).join(" / ") || "Sin pasajeros"}</p>${r.notes ? `<p>${escapeHTML(r.notes)}</p>` : ""}</div>`; }).join("") || `<p>Sin habitaciones registradas.</p>`; openPrintWindow(dep, "Rooming List", body, "rooming");
}

function openProfileModal() {
  $("#profileName").value = state.user.name || ""; $("#profileImage").value = ""; renderProfilePreview(state.user.avatar || ""); $("#profileModal").showModal();
}
function renderProfilePreview(dataUrl) { const target = $("#profileAvatarPreview"); target.innerHTML = dataUrl ? `<img src="${dataUrl}" alt="Vista previa">` : escapeHTML(actorLetter(currentActor())); }
$("#profileImage").addEventListener("change", async e => { const file = e.target.files?.[0]; if (!file) return; const dataUrl = await resizeImage(file); $("#profileForm").dataset.pendingAvatar = dataUrl; renderProfilePreview(dataUrl); });
function resizeImage(file) {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => { const img = new Image(); img.onload = () => { const size = 180; const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size; const ctx = canvas.getContext("2d"); const scale = Math.max(size / img.width, size / img.height); const w = img.width * scale, h = img.height * scale; ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h); resolve(canvas.toDataURL("image/jpeg", 0.82)); }; img.onerror = reject; img.src = reader.result; }; reader.onerror = reject; reader.readAsDataURL(file); });
}
$("#profileForm").addEventListener("submit", async e => {
  e.preventDefault(); const oldActor = currentActor(); const newName = $("#profileName").value.trim() || oldActor.name; const avatar = e.currentTarget.dataset.pendingAvatar || state.user.avatar || ""; state.user.name = newName; state.user.avatar = avatar; delete e.currentTarget.dataset.pendingAvatar;
  if (state.supabase) { const { error } = await state.supabase.from("profiles").upsert({ id: state.user.id, full_name: newName, avatar_data_url: avatar }, { onConflict: "id" }); if (error) { alert(error.message); return; } }
  propagateActorProfile(currentActor());
  await logAction("profile", state.user.id, "updated", { name: newName }); saveDemoData(); renderUser(); $("#profileModal").close(); renderAll();
});

normalizeStateData();
initAuth();
