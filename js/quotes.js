// =========================================================
// Travel Ops v2.0 - Cotizaciones manuales + vuelos
// Pink Sky Travel + Velora Travel
// =========================================================

const QUOTES_DEMO_KEY = "travelops_demo_quotes_v19";
const QUOTE_TABLE = "travelops_quotes";
const QUOTE_OPTIONS_TABLE = "travelops_quote_options";
const QUOTE_FLIGHTS_TABLE = "travelops_quote_flights";
const QUOTE_SERVICES_TABLE = "travelops_quote_services";
const QUOTE_FOLIO_RPC = "next_travelops_v19_quote_folio";
const QUOTE_SHARE_RPC = "get_shared_travelops_quote_v2";
const MAX_QUOTE_OPTIONS = 5;
let quotesSupabase = null;
let quotesStore = [];
let quoteOptionsDraft = [];
let quoteServicesDraft = [];
let quoteProfiles = new Map();
let quoteContacts = [];
let quoteV3Clients = [];

const quoteMoney = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });
const quoteDateLong = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const quoteDateTime = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });

function quoteLines(value = "") {
  return String(value).split(/\r?\n/).map(x => x.trim()).filter(Boolean);
}
function quoteArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return [];
}
function quoteStatusLabel(value) {
  return ({ borrador: "Borrador", enviada: "Enviada", aceptada: "Aceptada", caducada: "Caducada" })[value] || "Borrador";
}
function quoteStatusClass(value) {
  return value === "aceptada" ? "paid" : value === "caducada" ? "danger" : value === "enviada" ? "pending" : "neutral";
}
function quoteActor(id) {
  if (!id) return SYSTEM_ACTOR;
  return quoteProfiles.get(id) || { id, name: "Usuario", avatar: "" };
}
function quoteNights(start, end) {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((parseDate(end) - parseDate(start)) / 86400000));
}
function quoteRoomCount(text = "") {
  const m = String(text).match(/\b(\d+)\b/);
  return m ? Number(m[1]) : 0;
}
function quoteBestTotal(q) {
  const vals = (q.options || []).map(o => Number(o.total || 0)).filter(n => n > 0);
  return vals.length ? Math.min(...vals) : 0;
}

function quoteDateRangeUpper(q) {
  if (!q.start || !q.end) return "";
  return `${quoteDateLong.format(parseDate(q.start)).toUpperCase()} — ${quoteDateLong.format(parseDate(q.end)).toUpperCase()}`;
}
function quoteStayText(q) {
  const nights = quoteNights(q.start, q.end);
  return `${quoteDateLong.format(parseDate(q.start))} al ${quoteDateLong.format(parseDate(q.end))} · ${nights} ${nights === 1 ? "noche" : "noches"}`;
}
function loadDemoQuotes() {
  if (quotesSupabase) return;
  try { quotesStore = JSON.parse(localStorage.getItem(QUOTES_DEMO_KEY) || "[]"); }
  catch { quotesStore = []; }
}
function saveDemoQuotes() {
  if (!quotesSupabase) localStorage.setItem(QUOTES_DEMO_KEY, JSON.stringify(quotesStore));
}
function normalizeQuote(q) {
  return {
    id: q.id,
    folio: q.folio || "SIN FOLIO",
    brand: q.brand || "pink",
    crmLeadId: q.crmLeadId || q.crm_lead_id || "",
    v3ClientId: q.v3ClientId || q.v3_client_id || "",
    customer: q.customer || q.customer_name || "",
    customerPhone: q.customerPhone || q.customer_phone || "",
    destination: q.destination || "",
    start: q.start || q.start_date || "",
    end: q.end || q.end_date || "",
    passengers: q.passengers || q.passengers_text || "",
    adultsCount: q.adultsCount ?? q.adults_count ?? null,
    minorsCount: q.minorsCount ?? q.minors_count ?? null,
    minorAges: Array.isArray(q.minorAges ?? q.minor_ages) ? [...(q.minorAges ?? q.minor_ages)] : [],
    rooms: q.rooms || q.rooms_text || "",
    liquidationDate: q.liquidationDate || q.liquidation_date || "",
    declaredCommissionPercent: Number(q.declaredCommissionPercent ?? q.declared_commission_percent ?? 0),
    status: q.status || "borrador",
    includes: quoteArray(q.includes || q.include_items),
    extraConditions: quoteArray(q.extraConditions || q.extra_conditions),
    createdBy: q.createdBy || quoteActor(q.created_by),
    updatedBy: q.updatedBy || quoteActor(q.updated_by || q.created_by),
    createdAt: q.createdAt || q.created_at || nowISO(),
    updatedAt: q.updatedAt || q.updated_at || q.created_at || nowISO(),
    shareToken: q.shareToken || q.share_token || "",
    shareEnabled: Boolean(q.shareEnabled ?? q.share_enabled ?? false),
    sharedAt: q.sharedAt || q.shared_at || "",
    flights: Array.isArray(q.flights) ? q.flights.map((f, i) => ({
      id: f.id || uid("qflight"),
      route: f.route || "",
      departureText: f.departureText || f.departure_text || "",
      departureAt: f.departureAt || f.departure_at || "",
      returnText: f.returnText || f.return_text || "",
      returnAt: f.returnAt || f.return_at || "",
      amount: Number(f.amount ?? f.display_amount ?? 0),
      baggage: f.baggage || "",
      notes: f.notes || "",
      sortOrder: Number(f.sortOrder ?? f.sort_order ?? i)
    })) : [],
    services: Array.isArray(q.services) ? q.services.map((svc, i) => ({
      id: svc.id || uid("qsvc"),
      type: svc.type || svc.service_type || "otro",
      name: svc.name || svc.service_name || "",
      detail: svc.detail || "",
      amount: svc.amount == null && svc.display_amount == null ? null : Number(svc.amount ?? svc.display_amount),
      notes: svc.notes || "",
      sortOrder: Number(svc.sortOrder ?? svc.sort_order ?? i)
    })) : [],
    options: Array.isArray(q.options) ? q.options.map((o, i) => ({
      id: o.id || uid("qopt"),
      hotel: o.hotel || "",
      plan: o.plan || "",
      total: Number(o.total ?? o.display_total_amount ?? o.total_amount ?? 0),
      deposit: Number(o.deposit ?? o.deposit_amount ?? 0),
      balance: Number(o.balance ?? o.balance_amount ?? 0),
      sortOrder: Number(o.sortOrder ?? o.sort_order ?? i)
    })) : []
  };
}

async function hydrateQuotes() {
  quotesSupabase ||= await window.getSupabase();
  if (!quotesSupabase) {
    loadDemoQuotes();
    quotesStore = quotesStore.map(normalizeQuote);
    buildQuoteContactsFromState();
    renderQuoteCustomerList();
    renderQuotes();
    return;
  }

  const [
    { data: profiles },
    { data: quotes, error: qe },
    { data: opts, error: oe },
    { data: flights, error: fe },
    { data: services, error: se },
    { data: agencies, error: ae },
    { data: bookings, error: be },
    { data: departures, error: de },
    { data: crmLeads, error: ce },
    { data: v3Clients, error: v3e }
  ] = await Promise.all([
    quotesSupabase.from("profiles").select("id,full_name,avatar_data_url"),
    quotesSupabase.from(QUOTE_TABLE).select("*").order("created_at", { ascending: false }),
    quotesSupabase.from(QUOTE_OPTIONS_TABLE).select("*").order("sort_order", { ascending: true }),
    quotesSupabase.from(QUOTE_FLIGHTS_TABLE).select("*").order("sort_order", { ascending: true }),
    quotesSupabase.from(QUOTE_SERVICES_TABLE).select("*").order("sort_order", { ascending: true }),
    quotesSupabase.from("agencies").select("id,name").order("name"),
    quotesSupabase.from("bookings").select("id,departure_id,customer_name,agency_id"),
    quotesSupabase.from("departures").select("id,brand"),
    quotesSupabase.from("crm_leads").select("id,name,phone,brand,interest,status,notes").order("created_at", { ascending: false }),
    quotesSupabase.from("v3_clients").select("id,name,client_type,commercial_name,phone,whatsapp,email").order("name")
  ]);

  if (qe || oe || fe || se) {
    console.warn("Travel Ops cotizaciones:", qe || oe || fe || se);
    $("#quoteCards").innerHTML = `<div class="empty">No se pudieron cargar las cotizaciones. Ejecuta <strong>migration_v1_9_1_quotes_fix.sql</strong> en Supabase.</div>`;
    return;
  }

  if (ae || be || de || ce) console.warn("Travel Ops catálogo de clientes/agencias/CRM:", ae || be || de || ce);

  quoteProfiles = new Map((profiles || []).map(p => [p.id, {
    id: p.id,
    name: p.full_name || "Usuario",
    avatar: p.avatar_data_url || ""
  }]));

  quotesStore = (quotes || []).map(row =>
    normalizeQuote({
      ...row,
      options: (opts || []).filter(o => o.quote_id === row.id),
      flights: (flights || []).filter(f => f.quote_id === row.id),
      services: (services || []).filter(svc => svc.quote_id === row.id)
    })
  );

  if (v3e) console.warn("CRM V3 no disponible en cotizaciones:", v3e);
  quoteV3Clients = v3e ? [] : (v3Clients || []);
  buildQuoteContacts(agencies || [], bookings || [], departures || [], crmLeads || []);
  renderQuoteV3ClientList();
  renderQuoteCustomerList();
  renderQuotes();
  void refreshQuotePayments();
}

function buildQuoteContacts(agencies = [], bookings = [], departures = [], crmLeads = []) {
  const depBrand = new Map(departures.map(d => [d.id, d.brand]));
  const map = new Map();

  const add = ({ name, brand, type, phone = "", interest = "", crmLeadId = "", source = "operacion" }) => {
    const clean = String(name || "").trim();
    if (!clean || !brand) return;
    const key = `${brand}|${normalizeAgencyName(clean)}`;
    const current = map.get(key);
    // CRM tiene prioridad porque trae teléfono, interés e ID de origen.
    if (!current || source === "crm") {
      map.set(key, { name: clean, brand, type, phone: String(phone || "").trim(), interest: String(interest || "").trim(), crmLeadId: crmLeadId || "", source });
    }
  };

  agencies.forEach(a => add({ name: a.name, brand: "pink", type: "Agencia", source: "agencia" }));

  bookings.forEach(b => {
    const brand = depBrand.get(b.departure_id) || (b.agency_id ? "pink" : "velora");
    add({ name: b.customer_name, brand, type: brand === "pink" ? "Agencia" : "Cliente", source: "operacion" });
  });

  crmLeads.forEach(l => add({
    name: l.name,
    brand: l.brand,
    type: "CRM",
    phone: l.phone,
    interest: l.interest,
    crmLeadId: l.id,
    source: "crm"
  }));

  quoteContacts = [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" })
  );
}

function buildQuoteContactsFromState() {
  const map = new Map();
  const add = ({ name, brand, type, phone = "", interest = "", crmLeadId = "", source = "operacion" }) => {
    const clean = String(name || "").trim();
    if (!clean || !brand) return;
    const key = `${brand}|${normalizeAgencyName(clean)}`;
    const current = map.get(key);
    if (!current || source === "crm") map.set(key, { name: clean, brand, type, phone: String(phone || "").trim(), interest: String(interest || "").trim(), crmLeadId: crmLeadId || "", source });
  };

  (state.agencies || []).forEach(a => add({ name: a.name, brand: "pink", type: "Agencia", source: "agencia" }));
  (state.departures || []).forEach(dep =>
    (dep.bookings || []).forEach(b => add({ name: b.name, brand: dep.brand, type: dep.brand === "pink" ? "Agencia" : "Cliente", source: "operacion" }))
  );
  (state.leads || []).forEach(l => add({ name: l.name, brand: l.brand, type: "CRM", phone: l.phone, interest: l.interest, crmLeadId: l.id, source: "crm" }));

  quoteContacts = [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" })
  );
}

function renderQuoteV3ClientList() {
  const select = $("#quoteV3ClientId");
  if (!select) return;
  const selected = select.value;
  select.innerHTML = '<option value="">Sin vincular (cotización anterior / captura manual)</option>' +
    quoteV3Clients.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)} · ${c.client_type === "agencia" ? "Agencia" : "Cliente directo"}</option>`).join("");
  if (quoteV3Clients.some(c => c.id === selected)) select.value = selected;
}
function applyQuoteV3ClientSelection() {
  const id = $("#quoteV3ClientId")?.value;
  if (!id) return;
  const c = quoteV3Clients.find(x => x.id === id);
  if (!c) return;
  $("#quoteCustomer").value = c.name;
  $("#quoteCustomerPhone").value = c.whatsapp || c.phone || "";
  $("#quoteCrmLeadId").value = "";
}

function renderQuoteCustomerList() {
  const list = $("#quoteCustomerList");
  if (!list) return;
  const brand = $("#quoteBrand")?.value || (state.brand === "velora" ? "velora" : "pink");
  const rows = quoteContacts.filter(c => c.brand === brand);
  list.innerHTML = rows.map(c => {
    const extra = c.source === "crm"
      ? `CRM${c.phone ? ` · ${c.phone}` : ""}${c.interest ? ` · ${c.interest}` : ""}`
      : `${c.type} · ${brandLabel(c.brand)}`;
    return `<option value="${escapeHTML(c.name)}" label="${escapeHTML(extra)}"></option>`;
  }).join("");
}

function findQuoteContactExact(name, brand) {
  const key = normalizeAgencyName(name || "");
  if (!key) return null;
  return quoteContacts.find(c => c.brand === brand && normalizeAgencyName(c.name) === key) || null;
}

function applyQuoteCustomerSelection({ forceDestination = false } = {}) {
  const brand = $("#quoteBrand")?.value || "pink";
  const contact = findQuoteContactExact($("#quoteCustomer")?.value || "", brand);
  if (!contact || contact.source !== "crm") {
    $("#quoteCrmLeadId").value = "";
    return;
  }
  $("#quoteCrmLeadId").value = contact.crmLeadId || "";
  $("#quoteCustomerPhone").value = contact.phone || "";
  if (contact.interest && (forceDestination || !$("#quoteDestination").value.trim())) $("#quoteDestination").value = contact.interest;
}

function filteredQuotes() {
  const query = normalizeAgencyName($("#quoteSearch")?.value || "");
  const status = $("#quoteStatusFilter")?.value || "all";
  return quotesStore.filter(q => {
    if (state.brand !== "all" && q.brand !== state.brand) return false;
    if (status !== "all" && q.status !== status) return false;
    if (!query) return true;
    return normalizeAgencyName(`${q.folio} ${q.customer} ${q.destination}`).includes(query);
  });
}

function renderQuotes() {
  if (!$("#quoteCards")) return;
  const rows = filteredQuotes();
  $("#quoteStatCount").textContent = rows.length;
  $("#quoteStatSent").textContent = rows.filter(q => q.status === "enviada").length;
  $("#quoteStatAccepted").textContent = rows.filter(q => q.status === "aceptada").length;
  $("#quoteStatValue").textContent = quoteMoney.format(rows.reduce((n, q) => n + quoteBestTotal(q), 0));
  $("#quoteCards").innerHTML = rows.length ? rows.map(quoteCardHTML).join("") : `<div class="empty quote-empty">No hay cotizaciones con estos filtros.</div>`;
  $$('[data-quote-edit]', $("#quoteCards")).forEach(b => b.addEventListener("click", () => openQuoteModal(b.dataset.quoteEdit)));
  $$('[data-quote-print]', $("#quoteCards")).forEach(b => b.addEventListener("click", () => printQuote(b.dataset.quotePrint)));
  $$('[data-quote-share]', $("#quoteCards")).forEach(b => b.addEventListener("click", () => shareQuote(b.dataset.quoteShare)));
  $$('[data-quote-duplicate]', $("#quoteCards")).forEach(b => b.addEventListener("click", () => duplicateQuote(b.dataset.quoteDuplicate)));
  $$('[data-quote-delete]', $("#quoteCards")).forEach(b => b.addEventListener("click", () => deleteQuote(b.dataset.quoteDelete)));
  $$('[data-v3-convert]', $("#quoteCards")).forEach(b => b.addEventListener("click", () => openV3Conversion(b.dataset.v3Convert)));
  $$('[data-v3-passengers]', $("#quoteCards")).forEach(b => b.addEventListener("click", () => openV3Passengers(b.dataset.v3Passengers)));
}

function quoteCardHTML(q) {
  const best = quoteBestTotal(q);
  const creator = q.createdBy || SYSTEM_ACTOR;
  return `<article class="quote-card">
    <div class="quote-card-top"><div><span class="quote-folio">${escapeHTML(q.folio)}</span><h4>${escapeHTML(q.destination)}</h4><p>${escapeHTML(q.customer || "Sin agencia / cliente")}${q.customerPhone ? ` · ${escapeHTML(q.customerPhone)}` : ""}${q.crmLeadId ? " · CRM" : ""}</p></div>${brandChipHTML(q.brand, true)}</div>
    <div class="quote-card-meta"><span>${q.start ? dateFmt.format(parseDate(q.start)) : "—"} → ${q.end ? dateFmt.format(parseDate(q.end)) : "—"}</span><span>${q.options.length} ${q.options.length === 1 ? "opción" : "opciones"}</span></div>
    <div class="quote-card-options">${q.options.map((o, i) => `<div><span>${i + 1}. ${escapeHTML(o.hotel)}</span><strong>${quoteMoney.format(o.total)}</strong></div>`).join("") || `<span>Sin opciones capturadas</span>`}</div>
    <div class="quote-card-bottom"><div><span class="status-chip ${quoteStatusClass(q.status)}">${quoteStatusLabel(q.status)}</span>${best ? `<strong>Desde ${quoteMoney.format(best)}</strong>` : ""}</div><small>Creó ${escapeHTML(creator.name)} · ${quoteDateTime.format(new Date(q.createdAt))}</small></div>
    <div class="quote-card-actions"><button class="small-btn" data-quote-share="${q.id}">Enviar al cliente</button><button class="small-btn" data-quote-print="${q.id}">Imprimir / PDF</button><button class="small-btn" data-quote-edit="${q.id}">Editar</button><button class="small-btn" data-quote-duplicate="${q.id}">Duplicar</button><button class="small-btn danger" data-quote-delete="${q.id}">Borrar</button>${["enviada", "aceptada"].includes(q.status) ? `<button class="primary-btn" type="button" data-v3-convert="${q.id}">Convertir a reserva</button>` : ""}${["enviada", "aceptada"].includes(q.status) ? `<button class="small-btn" type="button" data-v3-passengers="${q.id}">Pasajeros de reserva</button>` : ""}</div>
  </article>`;
}

// V3: Conversion explicita a reserva; no afecta pagos ni la salida grupal.
function ensureV3ConversionDialog() {
  let modal = document.getElementById("v3ConversionModal");
  if (modal) return modal;
  modal = document.createElement("dialog");
  modal.id = "v3ConversionModal";
  modal.className = "modal";
  modal.innerHTML = `<form id="v3ConversionForm" style="padding:24px;min-width:min(550px,calc(100vw - 48px))">
    <div class="modal-head"><div><span class="eyebrow">RESERVA V3</span><h3>Convertir cotización</h3></div><button class="icon-btn square" type="button" id="v3ConversionClose">×</button></div>
    <p id="v3ConversionSummary" class="muted"></p>
    <label style="display:block;margin:16px 0"><span>Opción contratada</span><select id="v3ConversionOption" required style="width:100%;padding:12px"></select></label>
    <label style="display:flex;gap:10px;align-items:start;font-size:13px;margin:16px 0"><input type="checkbox" id="v3ConversionAccepted" required style="margin-top:3px"><span>Confirmo que el cliente seleccionó esta opción y autorizó iniciar la reserva. La firma de términos se solicitará después.</span></label>
    <div id="v3ConversionMessage" role="status" style="margin-bottom:12px;color:#9a3412"></div>
    <div class="modal-actions"><button class="ghost-btn" type="button" id="v3ConversionCancel">Cancelar</button><button class="primary-btn" id="v3ConversionSave" type="submit">Crear reserva por confirmar</button></div>
  </form>`;
  document.body.appendChild(modal);
  modal.querySelector("#v3ConversionClose").onclick = () => modal.close();
  modal.querySelector("#v3ConversionCancel").onclick = () => modal.close();
  modal.querySelector("#v3ConversionForm").addEventListener("submit", saveV3ConvertedReservation);
  return modal;
}

async function openV3Conversion(id) {
  const q = quotesStore.find(row => row.id === id);
  if (!q || !["enviada", "aceptada"].includes(q.status)) return;
  if (!quotesSupabase) { alert("Para convertir una cotización necesitas conexión con Supabase."); return; }
  const { data: existing, error } = await quotesSupabase.from("reservations")
    .select("id,code").eq("v3_quote_id", q.id).limit(1);
  if (error) { alert(`No se pudo revisar si ya existe la reserva: ${error.message}`); return; }
  if (existing?.length) { alert(`Esta cotización ya tiene una reserva: ${existing[0].code}. No se creó otra.`); return; }
  if (!q.v3ClientId) { alert("Primero vincula esta cotización con un cliente del CRM V3."); return; }
  if (!q.options?.length) { alert("Esta cotización no contiene opciones de hotel."); return; }
  const modal = ensureV3ConversionDialog();
  modal.dataset.quoteId = q.id;
  modal.querySelector("#v3ConversionSummary").textContent = `${q.folio} · ${q.customer} · ${q.destination}`;
  modal.querySelector("#v3ConversionOption").innerHTML = q.options.map(o => `<option value="${escapeHTML(o.id)}">${escapeHTML(o.hotel)} · ${escapeHTML(o.plan)} · ${quoteMoney.format(o.total)}</option>`).join("");
  modal.querySelector("#v3ConversionAccepted").checked = false;
  modal.querySelector("#v3ConversionMessage").textContent = "";
  modal.showModal();
}

async function saveV3ConvertedReservation(event) {
  event.preventDefault();
  const modal = document.getElementById("v3ConversionModal");
  const q = quotesStore.find(row => row.id === modal?.dataset.quoteId);
  if (!q || !quotesSupabase) return;
  const option = q.options.find(o => o.id === modal.querySelector("#v3ConversionOption").value);
  const message = modal.querySelector("#v3ConversionMessage");
  const btn = modal.querySelector("#v3ConversionSave");
  if (!option || !modal.querySelector("#v3ConversionAccepted").checked) return;
  const adults = Number(q.adultsCount), minors = Number(q.minorsCount);
  if (!Number.isInteger(adults) || adults < 1 || !Number.isInteger(minors) || minors < 0) {
    message.textContent = "Confirma primero los adultos y menores en la cotización (mínimo un adulto)."; return;
  }
  if (!q.start || !q.end || !q.v3ClientId) { message.textContent = "Faltan fechas o cliente del CRM V3."; return; }
  btn.disabled = true;
  message.textContent = "Guardando reserva…";
  try {
    const { data: prior, error: lookupError } = await quotesSupabase.from("reservations").select("id,code").eq("v3_quote_id", q.id).limit(1);
    if (lookupError) throw lookupError;
    if (prior?.length) throw new Error(`Ya existe la reserva ${prior[0].code}.`);
    const actor = currentActor();
    const code = `RES-V3-${q.brand === "pink" ? "PINK" : "VEL"}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const snapshot = { hotel: option.hotel, plan: option.plan, total: option.total, flights: q.flights, services: q.services, rooms: q.rooms, minorAges: q.minorAges };
    const payload = {
      code, brand: q.brand, v3_quote_id: q.id, v3_client_id: q.v3ClientId,
      v3_option_id: option.id, v3_services_snapshot: snapshot,
      client_name: q.customer, destination: q.destination,
      start_date: q.start, end_date: q.end,
      adults, minors, hotel_service: `${option.hotel} · ${option.plan}`,
      total_amount: Number(option.total), status: "por_confirmar",
      notes: `Generada desde ${q.folio}. Pendiente de confirmación, itinerario y firma.`,
      created_by: actor.id, updated_by: actor.id
    };
    const { data: saved, error } = await quotesSupabase.from("reservations").insert(payload).select("id,code").single();
    if (error) throw error;
    modal.close();
    alert(`Reserva ${saved.code} creada como POR CONFIRMAR. No se registró ningún pago ni firma. El expediente de pasajeros e itinerario es el siguiente módulo.`);
  } catch (err) {
    message.textContent = err?.message || "No se pudo guardar la reserva.";
  } finally { btn.disabled = false; }
}

// Expediente V3 por reserva. No toca pasajeros de salidas (booking_id).
function v3AgeAtDate(birth, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth || '') || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  const [by,bm,bd] = birth.split('-').map(Number), [dy,dm,dd] = date.split('-').map(Number);
  const born = new Date(Date.UTC(by,bm-1,bd)), travel = new Date(Date.UTC(dy,dm-1,dd));
  if (born.toISOString().slice(0,10) !== birth || travel.toISOString().slice(0,10) !== date || born > travel) return null;
  return dy-by-((dm<bm || (dm===bm && dd<bd)) ? 1 : 0);
}
function ensureV3PassengerDialog() {
  let d = document.getElementById('v3PassengersModal');
  if (d) return d;
  d = document.createElement('dialog'); d.id='v3PassengersModal'; d.className='modal wide';
  d.innerHTML=`<form id="v3PassengersForm" style="padding:24px;max-width:870px;width:min(870px,calc(100vw - 48px));max-height:85vh;overflow-y:auto">
    <div class="modal-head"><div><span class="eyebrow">RESERVA V3 · PASAJEROS</span><h3 id="v3PassengerTitle">Expediente</h3></div><button class="icon-btn square" type="button" id="v3PassengerClose">×</button></div>
    <p id="v3PassengerInfo" class="muted"></p><div id="v3PassengerRows" style="display:grid;gap:12px;margin:16px 0"></div>
    <p id="v3PassengerMessage" role="status" style="color:#9a3412;white-space:pre-wrap"></p>
    <div class="modal-actions"><button type="button" class="ghost-btn" id="v3PassengerCancel">Cancelar</button><button type="submit" class="primary-btn" id="v3PassengerSave">Guardar pasajeros</button></div></form>`;
  document.body.appendChild(d);
  d.querySelector('#v3PassengerClose').onclick=()=>d.close();
  d.querySelector('#v3PassengerCancel').onclick=()=>d.close();
  d.querySelector('#v3PassengersForm').addEventListener('submit',saveV3Passengers);
  d.querySelector('#v3PassengerRows').addEventListener('input',v3RefreshPassengerAges);
  return d;
}
function v3RefreshPassengerAges() {
  const d=document.getElementById('v3PassengersModal'); if(!d)return;
  d.querySelectorAll('[data-v3-passenger-row]').forEach(card=>{
    const age=v3AgeAtDate(card.querySelector('[data-birth]').value,d.dataset.travelDate);
    card.querySelector('[data-age]').textContent= age===null ? 'Edad al viajar: —' : `Edad al viajar: ${age} años`;
  });
}
async function openV3Passengers(quoteId) {
  if(!quotesSupabase)return alert('Debes iniciar sesión para consultar pasajeros.');
  const q=quotesStore.find(x=>x.id===quoteId);if(!q)return;
  const {data:reservations,error:re}=await quotesSupabase.from('reservations')
    .select('id,code,client_name,start_date,adults,minors,status').eq('v3_quote_id',quoteId).limit(1);
  if(re)return alert('Error al buscar la reserva: '+re.message);
  if(!reservations?.length)return alert('Primero convierte esta cotización en reserva.');
  const r=reservations[0];
  const {data:existing,error:pe}=await quotesSupabase.from('passengers')
    .select('id,first_name,last_name_1,last_name_2,birth_date,created_at').eq('reservation_id',r.id).order('created_at',{ascending:true});
  if(pe)return alert('Error al leer pasajeros: '+pe.message);
  const expected=Number(r.adults)+Number(r.minors);
  if((existing||[]).length>expected)return alert('La reserva tiene más pasajeros registrados que su ocupación. Hay que revisarla antes de editar.');
  const d=ensureV3PassengerDialog();d.dataset.reservationId=r.id;d.dataset.travelDate=r.start_date;
  d.querySelector('#v3PassengerTitle').textContent=`${r.code} · ${r.client_name}`;
  d.querySelector('#v3PassengerInfo').textContent=`${r.adults} adultos · ${r.minors} menores · Fecha de viaje: ${r.start_date}. La edad se calcula automáticamente.`;
  d.querySelector('#v3PassengerMessage').textContent='';
  d.querySelector('#v3PassengerRows').innerHTML=Array.from({length:expected},(_,i)=>{
    const p=existing?.[i]||{},minor=i>=r.adults;
    return `<section data-v3-passenger-row data-id="${escapeHTML(p.id||'')}" data-type="${minor?'menor':'adulto'}" style="border:1px solid #dfe4eb;border-radius:12px;padding:14px">
      <strong>${minor?'Menor '+(i-r.adults+1):'Adulto '+(i+1)}</strong>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:10px">
        <label><span>Nombre(s)</span><input data-first required value="${escapeHTML(p.first_name||'')}"></label>
        <label><span>Primer apellido</span><input data-last1 required value="${escapeHTML(p.last_name_1||'')}"></label>
        <label><span>Segundo apellido</span><input data-last2 value="${escapeHTML(p.last_name_2||'')}"></label>
        <label><span>Fecha de nacimiento</span><input data-birth type="date" required value="${escapeHTML(p.birth_date||'')}"></label>
      </div><small data-age style="display:block;margin-top:8px">Edad al viajar: —</small>
    </section>`;
  }).join('');
  v3RefreshPassengerAges();d.showModal();
}
async function saveV3Passengers(event) {
  event.preventDefault();
  const d=document.getElementById('v3PassengersModal'),message=d.querySelector('#v3PassengerMessage'),button=d.querySelector('#v3PassengerSave');
  const rows=[...d.querySelectorAll('[data-v3-passenger-row]')];
  const prepared=[];
  for(const [i,card] of rows.entries()){
    const first=card.querySelector('[data-first]').value.trim(),last1=card.querySelector('[data-last1]').value.trim();
    const last2=card.querySelector('[data-last2]').value.trim(),birth=card.querySelector('[data-birth]').value;
    const age=v3AgeAtDate(birth,d.dataset.travelDate),minor=card.dataset.type==='menor';
    if(!first||!last1||age===null){message.textContent=`Revisa el nombre y fecha de nacimiento del pasajero ${i+1}.`;return;}
    if((minor&&age>=18)||(!minor&&age<18)){message.textContent=`Pasajero ${i+1}: su edad al viajar (${age}) no coincide con ${minor?'menor':'adulto'}. Revisa la cotización antes de continuar.`;return;}
    prepared.push({id:card.dataset.id||'',first_name:first,last_name_1:last1,last_name_2:last2||null,birth_date:birth});
  }
  button.disabled=true;message.textContent='Guardando pasajeros…';
  try{
    for(const p of prepared){
      const {id,...fields}=p;
      const query=id ? quotesSupabase.from('passengers').update(fields).eq('id',id).eq('reservation_id',d.dataset.reservationId)
        : quotesSupabase.from('passengers').insert({...fields,reservation_id:d.dataset.reservationId});
      const {error}=await query;if(error)throw error;
    }
    d.close();alert('Pasajeros guardados correctamente. Puedes volver a abrir el expediente para editarlos.');
  }catch(err){message.textContent='No se pudieron guardar todos los pasajeros: '+(err.message||err)+'. Reabre el expediente antes de reintentar para evitar duplicados.';}
  finally{button.disabled=false;}
}

function blankQuoteOption() {
  return { id: uid("qopt"), hotel: "", plan: "", total: 0, deposit: 0, balance: 0 };
}

function quoteFlightFromForm() {
  const flight = {
    id: uid("qflight"),
    route: $("#quoteFlightRoute")?.value.trim() || "",
    departureText: $("#quoteFlightDepartureText")?.value.trim() || "",
    departureAt: $("#quoteFlightDepartureAt")?.value || "",
    returnText: $("#quoteFlightReturnText")?.value.trim() || "",
    returnAt: $("#quoteFlightReturnAt")?.value || "",
    amount: Number($("#quoteFlightAmount")?.value || 0),
    baggage: $("#quoteFlightBaggage")?.value.trim() || "",
    notes: $("#quoteFlightNotes")?.value.trim() || "",
    sortOrder: 0
  };
  const hasData = flight.route || flight.departureText || flight.departureAt || flight.returnText || flight.returnAt || flight.amount > 0 || flight.baggage || flight.notes;
  return hasData ? [flight] : [];
}

function quoteDateTimeLocalValue(value) {
  if (!value) return "";
  return String(value).replace(" ", "T").slice(0, 16);
}

// V3: sugerir las fechas del viaje en vuelos, respetando cualquier ajuste manual.
function syncQuoteFlightDates() {
  for (const [tripId, flightId] of [["quoteStart", "quoteFlightDepartureAt"], ["quoteEnd", "quoteFlightReturnAt"]]) {
    const trip = document.getElementById(tripId);
    const flight = document.getElementById(flightId);
    if (!trip || !flight) continue;
    const previousSuggestion = flight.dataset.suggestedDate || "";
    const changedManually = flight.dataset.manualDate === "true";
    if (changedManually) continue;
    // Mantener la hora previamente capturada si la fecha había sido automática.
    const canSync = !flight.value || (previousSuggestion && flight.value.slice(0, 10) === previousSuggestion);
    if (!canSync) continue;
    if (!trip.value) {
      if (previousSuggestion) flight.value = "";
      flight.dataset.suggestedDate = "";
    } else {
      const time = flight.value.slice(11, 16) || "00:00";
      flight.value = `${trip.value}T${time}`;
      flight.dataset.suggestedDate = trip.value;
    }
  }
}
function resetQuoteFlightDateTracking() {
  for (const id of ["quoteFlightDepartureAt", "quoteFlightReturnAt"]) {
    const field = document.getElementById(id);
    if (field) { field.dataset.manualDate = "false"; field.dataset.suggestedDate = ""; }
  }
}

function blankQuoteService() {
  return { id: uid("qsvc"), type: "traslado", name: "", detail: "", amount: null, notes: "" };
}
function quoteServiceTypeLabel(value) {
  return ({ traslado: "Traslado", tour: "Tour / actividad", seguro: "Seguro", entrada: "Entrada", otro: "Otro" })[value] || "Otro";
}
function renderQuoteServicesEditor(services = quoteServicesDraft) {
  quoteServicesDraft = (services || []).map(svc => ({ ...blankQuoteService(), ...svc }));
  const root = $("#quoteServicesEditor");
  if (!root) return;
  root.innerHTML = quoteServicesDraft.length ? quoteServicesDraft.map((svc, i) => `<article class="quote-service-editor" data-service-id="${escapeHTML(svc.id)}">
    <div class="quote-option-title"><strong>Servicio ${i + 1}</strong><button class="mini-remove" type="button" data-remove-qsvc="${escapeHTML(svc.id)}">×</button></div>
    <div class="quote-service-fields">
      <label><span>Tipo</span><select data-qsvc="type">
        <option value="traslado" ${svc.type === "traslado" ? "selected" : ""}>Traslado</option>
        <option value="tour" ${svc.type === "tour" ? "selected" : ""}>Tour / actividad</option>
        <option value="seguro" ${svc.type === "seguro" ? "selected" : ""}>Seguro</option>
        <option value="entrada" ${svc.type === "entrada" ? "selected" : ""}>Entrada</option>
        <option value="otro" ${svc.type === "otro" ? "selected" : ""}>Otro</option>
      </select></label>
      <label><span>Servicio</span><input data-qsvc="name" value="${escapeHTML(svc.name)}" placeholder="Ej. Traslado aeropuerto - hotel" required /></label>
      <label><span>Precio / total</span><input data-qsvc="amount" type="number" min="0" step="0.01" value="${svc.amount ?? ""}" placeholder="Opcional" /></label>
      <label class="wide"><span>Detalle</span><input data-qsvc="detail" value="${escapeHTML(svc.detail)}" placeholder="Ej. Redondo, privado, 4 pasajeros" /></label>
      <label class="wide"><span>Notas</span><input data-qsvc="notes" value="${escapeHTML(svc.notes)}" placeholder="Opcional" /></label>
    </div>
  </article>`).join("") : `<div class="quote-services-empty">Sin servicios adicionales. Agrégalos solo cuando la cotización los necesite.</div>`;
  $$('[data-remove-qsvc]', root).forEach(btn => btn.addEventListener("click", () => {
    syncQuoteServicesDraft();
    quoteServicesDraft = quoteServicesDraft.filter(svc => svc.id !== btn.dataset.removeQsvc);
    renderQuoteServicesEditor(quoteServicesDraft);
  }));
}
function syncQuoteServicesDraft() {
  const root = $("#quoteServicesEditor");
  if (!root) return [];
  quoteServicesDraft = $$(".quote-service-editor", root).map(card => {
    const amountValue = card.querySelector('[data-qsvc="amount"]').value;
    return {
      id: card.dataset.serviceId || uid("qsvc"),
      type: card.querySelector('[data-qsvc="type"]').value || "otro",
      name: card.querySelector('[data-qsvc="name"]').value.trim(),
      detail: card.querySelector('[data-qsvc="detail"]').value.trim(),
      amount: amountValue === "" ? null : Number(amountValue),
      notes: card.querySelector('[data-qsvc="notes"]').value.trim()
    };
  });
  return quoteServicesDraft;
}
function refreshQuotePricingPreview() {
  // Cotizaciones v2 manuales: no se realizan cálculos automáticos.
}

function renderQuoteOptionsEditor(options = quoteOptionsDraft) {
  quoteOptionsDraft = (options.length ? options : [blankQuoteOption()]).slice(0, MAX_QUOTE_OPTIONS).map(o => ({ ...blankQuoteOption(), ...o }));
  $("#quoteOptionsEditor").innerHTML = quoteOptionsDraft.map((o, i) => `<article class="quote-option-editor" data-option-id="${escapeHTML(o.id)}">
    <div class="quote-option-title"><strong>Opción ${i + 1}</strong>${i ? `<button class="mini-remove" type="button" data-remove-qopt="${escapeHTML(o.id)}">×</button>` : ""}</div>
    <div class="quote-option-fields">
      <label><span>Hotel</span><input data-qopt="hotel" value="${escapeHTML(o.hotel)}" placeholder="Ej. Royal Villas" required /></label>
      <label><span>Plan</span><input data-qopt="plan" value="${escapeHTML(o.plan)}" placeholder="Ej. Todo incluido" required /></label>
      <label><span>Total final</span><input data-qopt="total" type="number" min="0.01" step="0.01" value="${o.total || ""}" placeholder="0.00" required /></label>
      <label><span>Apartado</span><input data-qopt="deposit" type="number" min="0" step="0.01" value="${o.deposit || ""}" placeholder="0.00" /></label>
      <label><span>Saldo</span><input data-qopt="balance" type="number" min="0" step="0.01" value="${o.balance || ""}" placeholder="0.00" /></label>
    </div>
  </article>`).join("");
  $("#addQuoteOptionBtn").disabled = quoteOptionsDraft.length >= MAX_QUOTE_OPTIONS;
  $$('[data-remove-qopt]', $("#quoteOptionsEditor")).forEach(btn => btn.addEventListener("click", () => {
    syncQuoteOptionDraft();
    quoteOptionsDraft = quoteOptionsDraft.filter(o => o.id !== btn.dataset.removeQopt);
    renderQuoteOptionsEditor(quoteOptionsDraft);
  }));
}

function syncQuoteOptionDraft() {
  quoteOptionsDraft = $$(".quote-option-editor", $("#quoteOptionsEditor")).map(card => ({
    id: card.dataset.optionId || uid("qopt"),
    hotel: card.querySelector('[data-qopt="hotel"]').value.trim(),
    plan: card.querySelector('[data-qopt="plan"]').value.trim(),
    total: Number(card.querySelector('[data-qopt="total"]').value || 0),
    deposit: Number(card.querySelector('[data-qopt="deposit"]').value || 0),
    balance: Number(card.querySelector('[data-qopt="balance"]').value || 0)
  }));
  return quoteOptionsDraft;
}

// V3: captura estructurada; la descripción histórica se conserva en passengers_text.
function renderQuotePassengerEditor(ages = null) {
  const root = $("#quoteMinorAges");
  if (!root) return;
  const adults = Number($("#quoteAdultsCount").value);
  const minors = Number($("#quoteMinorsCount").value);
  const count = Number.isInteger(minors) && minors >= 0 && minors <= 100 ? minors : 0;
  const previous = ages ?? [...root.querySelectorAll("[data-quote-minor-age]")].map(x => x.value);
  root.innerHTML = Array.from({ length: count }, (_, i) => `<label><span>Edad menor ${i+1} al viajar</span><input type="number" min="0" max="17" step="1" required data-quote-minor-age value="${/^(?:[0-9]|1[0-7])$/.test(String(previous[i] ?? "")) ? previous[i] : ""}" placeholder="Años" /></label>`).join("");
  $("#quotePassengersSummary").textContent = `${adults} adulto(s) · ${minors} menor(es) · ${Number.isFinite(adults+minors) ? adults+minors : "—"} pasajeros`;
}
function readQuotePassengers() {
  const adults = Number($("#quoteAdultsCount").value);
  const minors = Number($("#quoteMinorsCount").value);
  if (!Number.isInteger(adults) || !Number.isInteger(minors) || adults < 0 || minors < 0 || adults + minors < 1 || adults > 100 || minors > 100) {
    alert("Indica cantidades válidas de adultos y menores (al menos un pasajero).");
    return null;
  }
  const ages = [...document.querySelectorAll("#quoteMinorAges [data-quote-minor-age]")].map(input => Number(input.value));
  if (ages.length !== minors || ages.some((age,i) => !document.querySelectorAll("#quoteMinorAges [data-quote-minor-age]")[i].value.trim() || !Number.isInteger(age) || age < 0 || age > 17)) {
    alert("Captura la edad de cada menor al momento del viaje (0 a 17 años).");
    return null;
  }
  const label = `${adults} adulto(s)${minors ? ` + ${minors} menor(es) (${ages.map(a => `${a} año(s)`).join(", ")})` : ""}`;
  return { adults, minors, ages, label };
}

function openQuoteModal(id = "") {
  const q = id ? quotesStore.find(x => x.id === id) : null;
  $("#quoteForm").reset();
  $("#quoteId").value = q?.id || "";
  $("#quoteModalTitle").textContent = q ? "Editar cotización" : "Nueva cotización";
  $("#quoteBrand").value = q?.brand || (state.brand === "velora" ? "velora" : "pink");
  renderQuoteCustomerList();
  renderQuoteV3ClientList();
  $("#quoteV3ClientId").value = q?.v3ClientId || "";
  $("#quoteCrmLeadId").value = q?.crmLeadId || "";
  $("#quoteCustomer").value = q?.customer || "";
  $("#quoteCustomerPhone").value = q?.customerPhone || "";
  $("#quoteDestination").value = q?.destination || "";
  $("#quoteStart").value = q?.start || "";
  $("#quoteEnd").value = q?.end || "";
  $("#quoteAdultsCount").value = q?.adultsCount ?? 2;
  $("#quoteMinorsCount").value = q?.minorsCount ?? 0;
  renderQuotePassengerEditor(q?.minorAges || []);
  $("#quotePassengers").value = q?.passengers || "";
  $("#quotePassengersLegacyNote").hidden = !q || q.adultsCount !== null;
  $("#quoteRooms").value = q?.rooms || "";
  $("#quoteLiquidationDate").value = q?.liquidationDate || "";
  $("#quoteDeclaredCommissionPercent").value = q?.declaredCommissionPercent ?? 0;
  $("#quoteStatus").value = q?.status || "borrador";
  const flight = q?.flights?.[0] || {};
  $("#quoteFlightRoute").value = flight.route || "";
  $("#quoteFlightDepartureText").value = flight.departureText || "";
  $("#quoteFlightDepartureAt").value = quoteDateTimeLocalValue(flight.departureAt);
  $("#quoteFlightReturnText").value = flight.returnText || "";
  $("#quoteFlightReturnAt").value = quoteDateTimeLocalValue(flight.returnAt);
  resetQuoteFlightDateTracking();
  syncQuoteFlightDates();
  $("#quoteFlightAmount").value = Number(flight.amount || 0) || "";
  $("#quoteFlightBaggage").value = flight.baggage || "";
  $("#quoteFlightNotes").value = flight.notes || "";
  renderQuoteServicesEditor(q?.services || []);
  $("#quoteIncludes").value = (q?.includes || ["Hospedaje durante la estancia indicada."]).join("\n");
  $("#quoteExtraConditions").value = (q?.extraConditions || []).join("\n");
  renderQuoteOptionsEditor(q?.options?.length ? q.options : [blankQuoteOption()]);
  if ($("#quoteStart").value) $("#quoteEnd").min = $("#quoteStart").value;
  $("#quoteModal").showModal();
}

async function nextQuoteFolio(brand) {
  if (quotesSupabase) {
    const { data, error } = await quotesSupabase.rpc(QUOTE_FOLIO_RPC, { p_brand: brand });
    if (!error && data) return data;
  }
  const period = new Date().toISOString().slice(0, 7).replace("-", "");
  const code = brand === "pink" ? "PINK" : "VEL";
  const numbers = quotesStore.map(q => q.folio).filter(f => f.includes(`-${code}-${period}-`)).map(f => Number(f.split("-").at(-1)) || 0);
  return `COT-${code}-${period}-${String(Math.max(0, ...numbers) + 1).padStart(4, "0")}`;
}

async function saveQuoteFromForm(e) {
  e.preventDefault();
  syncQuoteOptionDraft();
  syncQuoteServicesDraft();
  if (!quoteOptionsDraft.length || quoteOptionsDraft.some(o => !o.hotel || !o.plan || o.total <= 0)) {
    alert("Completa hotel, plan y total final de cada opción.");
    return;
  }
  const passengerData = readQuotePassengers();
  if (!passengerData) return;
  const start = $("#quoteStart").value, end = $("#quoteEnd").value;
  if (end < start) { alert("La fecha de regreso no puede ser anterior a la salida."); return; }
  const selectedV3 = quoteV3Clients.find(c => c.id === $("#quoteV3ClientId")?.value);
  if (selectedV3 && $("#quoteCustomer").value.trim() !== selectedV3.name) { alert("El nombre ya no coincide con el cliente CRM V3. Selecciónalo otra vez o deja el vínculo vacío."); return; }
  const id = $("#quoteId").value;
  const old = id ? quotesStore.find(q => q.id === id) : null;
  const actor = currentActor();
  const brand = $("#quoteBrand").value;
  const quote = normalizeQuote({
    id: id || uid("quote"),
    folio: old?.folio || await nextQuoteFolio(brand),
    brand,
    crmLeadId: $("#quoteCrmLeadId").value || "",
    v3ClientId: $("#quoteV3ClientId").value || "",
    customer: $("#quoteCustomer").value.trim(),
    customerPhone: $("#quoteCustomerPhone").value.trim(),
    destination: $("#quoteDestination").value.trim(),
    start, end,
    passengers: passengerData.label,
    adultsCount: passengerData.adults,
    minorsCount: passengerData.minors,
    minorAges: passengerData.ages,
    rooms: $("#quoteRooms").value.trim(),
    liquidationDate: $("#quoteLiquidationDate").value,
    declaredCommissionPercent: Number($("#quoteDeclaredCommissionPercent").value || 0),
    status: $("#quoteStatus").value,
    includes: quoteLines($("#quoteIncludes").value),
    extraConditions: quoteLines($("#quoteExtraConditions").value),
    options: quoteOptionsDraft,
    flights: quoteFlightFromForm(),
    services: quoteServicesDraft.filter(svc => svc.name),
    createdBy: old?.createdBy || actor,
    updatedBy: actor,
    createdAt: old?.createdAt || nowISO(),
    updatedAt: nowISO()
  });

  if (quotesSupabase) {
    const payload = {
       id: quote.id, folio: quote.folio, brand: quote.brand, crm_lead_id: quote.crmLeadId || null, v3_client_id: quote.v3ClientId || null,
      customer_name: quote.customer, customer_phone: quote.customerPhone || null, destination: quote.destination,
      start_date: quote.start, end_date: quote.end, passengers_text: quote.passengers, adults_count: quote.adultsCount, minors_count: quote.minorsCount, minor_ages: quote.minorAges, rooms_text: quote.rooms,
      deposit_percent: 0, liquidation_date: quote.liquidationDate || null,
      internal_markup_percent: 0,
      declared_commission_percent: quote.declaredCommissionPercent,
      commission_percent: 0,
      status: quote.status, include_items: quote.includes, extra_conditions: quote.extraConditions,
      created_by: old?.createdBy?.id || actor.id, updated_by: actor.id
    };
    const { data: saved, error } = await quotesSupabase.from(QUOTE_TABLE).upsert(payload, { onConflict: "id" }).select().single();
    if (error) { alert(error.message); return; }
    quote.id = saved.id;
    quote.createdAt = saved.created_at || quote.createdAt;
    quote.updatedAt = saved.updated_at || quote.updatedAt;
    quote.shareToken = saved.share_token || quote.shareToken || "";
    quote.shareEnabled = Boolean(saved.share_enabled ?? quote.shareEnabled);
    quote.sharedAt = saved.shared_at || quote.sharedAt || "";

    const { error: delErr } = await quotesSupabase.from(QUOTE_OPTIONS_TABLE).delete().eq("quote_id", quote.id);
    if (delErr) { alert(delErr.message); return; }
    const rows = quote.options.map((o, i) => ({
      quote_id: quote.id,
      sort_order: i,
      hotel: o.hotel,
      plan: o.plan,
      total_amount: o.total,
      display_total_amount: o.total,
      deposit_amount: o.deposit,
      balance_amount: o.balance
    }));
    const { data: savedOpts, error: optErr } = await quotesSupabase.from(QUOTE_OPTIONS_TABLE).insert(rows).select();
    if (optErr) { alert(optErr.message); return; }
    quote.options = (savedOpts || []).map(o => ({
      id: o.id, hotel: o.hotel, plan: o.plan,
      total: Number(o.display_total_amount ?? o.total_amount ?? 0),
      deposit: Number(o.deposit_amount || 0),
      balance: Number(o.balance_amount || 0),
      sortOrder: o.sort_order
    }));

    const { error: delFlightErr } = await quotesSupabase.from(QUOTE_FLIGHTS_TABLE).delete().eq("quote_id", quote.id);
    if (delFlightErr) { alert(delFlightErr.message); return; }
    if (quote.flights.length) {
      const flightRows = quote.flights.map((f, i) => ({
        quote_id: quote.id,
        sort_order: i,
        route: f.route || null,
        departure_text: f.departureText || null,
        departure_at: f.departureAt || null,
        return_text: f.returnText || null,
        return_at: f.returnAt || null,
        cost_amount: 0,
        display_amount: Number(f.amount || 0),
        baggage: f.baggage || null,
        notes: f.notes || null,
        created_by: actor.id,
        updated_by: actor.id
      }));
      const { data: savedFlights, error: flightErr } = await quotesSupabase.from(QUOTE_FLIGHTS_TABLE).insert(flightRows).select();
      if (flightErr) { alert(flightErr.message); return; }
      quote.flights = (savedFlights || []).map(f => ({
        id: f.id, route: f.route || "", departureText: f.departure_text || "", departureAt: f.departure_at || "",
        returnText: f.return_text || "", returnAt: f.return_at || "", amount: Number(f.display_amount || 0),
        baggage: f.baggage || "", notes: f.notes || "", sortOrder: Number(f.sort_order || 0)
      }));
    }

    const { error: delServiceErr } = await quotesSupabase.from(QUOTE_SERVICES_TABLE).delete().eq("quote_id", quote.id);
    if (delServiceErr) { alert(delServiceErr.message); return; }
    if (quote.services.length) {
      const serviceRows = quote.services.map((svc, i) => ({
        quote_id: quote.id,
        sort_order: i,
        service_type: svc.type || "otro",
        service_name: svc.name,
        detail: svc.detail || null,
        display_amount: svc.amount == null ? null : Number(svc.amount),
        notes: svc.notes || null,
        created_by: actor.id,
        updated_by: actor.id
      }));
      const { data: savedServices, error: serviceErr } = await quotesSupabase.from(QUOTE_SERVICES_TABLE).insert(serviceRows).select();
      if (serviceErr) { alert(serviceErr.message); return; }
      quote.services = (savedServices || []).map(svc => ({
        id: svc.id, type: svc.service_type || "otro", name: svc.service_name || "", detail: svc.detail || "",
        amount: svc.display_amount == null ? null : Number(svc.display_amount), notes: svc.notes || "",
        sortOrder: Number(svc.sort_order || 0)
      }));
    }
  }

  if (old) quotesStore.splice(quotesStore.indexOf(old), 1, quote); else quotesStore.unshift(quote);
  saveDemoQuotes();

  if (quote.crmLeadId) {
    const lead = (state.leads || []).find(l => String(l.id) === String(quote.crmLeadId));
    if (lead && !["cotizando", "ganado", "perdido"].includes(lead.status)) {
      lead.status = "cotizando";
      if (state.supabase) await state.supabase.from("crm_leads").update({ status: "cotizando" }).eq("id", lead.id);
      await logAction("crm_lead", lead.id, "moved_to_quote", { quote_id: quote.id, folio: quote.folio });
    }
  }

  buildQuoteContactsFromState();
  await logAction("quote", quote.id, old ? "updated" : "created", {
    folio: quote.folio, customer: quote.customer, destination: quote.destination,
    brand: quote.brand, crm_lead_id: quote.crmLeadId || null
  });
  $("#quoteModal").close();
  renderQuotes();
  if (typeof renderCRM === "function") renderCRM();
}

async function duplicateQuote(id) {
  const source = quotesStore.find(q => q.id === id); if (!source) return;
  const actor = currentActor();
  const copy = normalizeQuote({
    ...structuredClone(source),
    id: uid("quote"),
    folio: await nextQuoteFolio(source.brand),
    status: "borrador",
    shareToken: "",
    shareEnabled: false,
    sharedAt: "",
    createdBy: actor,
    updatedBy: actor,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    options: source.options.map(o => ({ ...o, id: uid("qopt") })),
    flights: (source.flights || []).map(f => ({ ...f, id: uid("qflight") })),
    services: (source.services || []).map(svc => ({ ...svc, id: uid("qsvc") }))
  });
  if (quotesSupabase) {
    const { data, error } = await quotesSupabase.from(QUOTE_TABLE).insert({
       id: copy.id, folio: copy.folio, brand: copy.brand, crm_lead_id: copy.crmLeadId || null, v3_client_id: copy.v3ClientId || null,
      customer_name: copy.customer, customer_phone: copy.customerPhone || null, destination: copy.destination,
      start_date: copy.start, end_date: copy.end, passengers_text: copy.passengers, adults_count: copy.adultsCount, minors_count: copy.minorsCount, minor_ages: copy.minorAges, rooms_text: copy.rooms,
      deposit_percent: 0, liquidation_date: copy.liquidationDate || null,
      internal_markup_percent: 0, declared_commission_percent: copy.declaredCommissionPercent, commission_percent: 0,
      status: copy.status, include_items: copy.includes, extra_conditions: copy.extraConditions,
      created_by: actor.id, updated_by: actor.id
    }).select().single();
    if (error) { alert(error.message); return; }

    copy.id = data.id;
    copy.createdAt = data.created_at;
    copy.updatedAt = data.updated_at;
    copy.shareToken = data.share_token || "";
    copy.shareEnabled = Boolean(data.share_enabled);
    copy.sharedAt = data.shared_at || "";

    const { data: opts, error: oe } = await quotesSupabase.from(QUOTE_OPTIONS_TABLE).insert(
      copy.options.map((o, i) => ({
        quote_id: copy.id, sort_order: i, hotel: o.hotel, plan: o.plan,
        total_amount: o.total, display_total_amount: o.total,
        deposit_amount: o.deposit, balance_amount: o.balance
      }))
    ).select();
    if (oe) { alert(oe.message); return; }
    copy.options = (opts || []).map(o => ({
      id: o.id, hotel: o.hotel, plan: o.plan,
      total: Number(o.display_total_amount ?? o.total_amount ?? 0),
      deposit: Number(o.deposit_amount || 0),
      balance: Number(o.balance_amount || 0),
      sortOrder: o.sort_order
    }));

    if (copy.flights.length) {
      const { data: fl, error: fe } = await quotesSupabase.from(QUOTE_FLIGHTS_TABLE).insert(
        copy.flights.map((f, i) => ({
          quote_id: copy.id, sort_order: i, route: f.route || null, departure_text: f.departureText || null,
          departure_at: f.departureAt || null, return_text: f.returnText || null, return_at: f.returnAt || null,
          cost_amount: 0, display_amount: Number(f.amount || 0),
          baggage: f.baggage || null, notes: f.notes || null,
          created_by: actor.id, updated_by: actor.id
        }))
      ).select();
      if (fe) { alert(fe.message); return; }
      copy.flights = (fl || []).map(f => ({
        id: f.id, route: f.route || "", departureText: f.departure_text || "", departureAt: f.departure_at || "",
        returnText: f.return_text || "", returnAt: f.return_at || "", amount: Number(f.display_amount || 0),
        baggage: f.baggage || "", notes: f.notes || "", sortOrder: Number(f.sort_order || 0)
      }));
    }

    if (copy.services.length) {
      const { data: svcs, error: se } = await quotesSupabase.from(QUOTE_SERVICES_TABLE).insert(
        copy.services.map((svc, i) => ({
          quote_id: copy.id, sort_order: i, service_type: svc.type || "otro", service_name: svc.name,
          detail: svc.detail || null, display_amount: svc.amount == null ? null : Number(svc.amount), notes: svc.notes || null,
          created_by: actor.id, updated_by: actor.id
        }))
      ).select();
      if (se) { alert(se.message); return; }
      copy.services = (svcs || []).map(svc => ({
        id: svc.id, type: svc.service_type || "otro", name: svc.service_name || "", detail: svc.detail || "",
        amount: svc.display_amount == null ? null : Number(svc.display_amount), notes: svc.notes || "",
        sortOrder: Number(svc.sort_order || 0)
      }));
    }
  }
  quotesStore.unshift(copy); saveDemoQuotes(); renderQuotes();
  await logAction("quote", copy.id, "duplicated", { from: source.folio, folio: copy.folio });
}

async function deleteQuote(id) {
  const q = quotesStore.find(x => x.id === id); if (!q || !confirm(`¿Borrar la cotización ${q.folio}?`)) return;
  if (quotesSupabase) { const { error } = await quotesSupabase.from(QUOTE_TABLE).delete().eq("id", id); if (error) { alert(error.message); return; } }
  quotesStore = quotesStore.filter(x => x.id !== id); saveDemoQuotes(); renderQuotes();
  await logAction("quote", id, "deleted", { folio: q.folio, customer: q.customer });
}

function quotePrintTheme(brand) {
  return brand === "pink" ? { primary: "#4b1359", accent: "#b77f93", pale: "#f5f1f4" } : { primary: "#173f35", accent: "#b89c59", pale: "#f2f6f4" };
}
function quoteDocumentHTML(q, { publicView = false } = {}) {
  const t = quotePrintTheme(q.brand), roomCount = quoteRoomCount(q.rooms), totalHead = roomCount ? `TOTAL ${roomCount} HAB.` : "TOTAL";
  const logo = new URL(brandAsset(q.brand), location.href).href;
  const conditions = [
    q.liquidationDate ? `Fecha límite para liquidar: ${quoteDateLong.format(parseDate(q.liquidationDate))}.` : "",
    q.declaredCommissionPercent > 0 ? `Comisión para agencia: ${q.declaredCommissionPercent}%.` : "",
    ...q.extraConditions
  ].filter(Boolean);

  const optionsRows = q.options.map(o => `<tr>
    <td><strong>${escapeHTML(o.hotel)}</strong></td>
    <td>${escapeHTML(o.plan)}</td>
    <td><strong>${quoteMoney.format(o.total)}</strong></td>
    <td><strong>${quoteMoney.format(o.deposit)}</strong></td>
  </tr>`).join("");

  const summaryRows = q.options.map(o => `<tr>
    <td><strong>${escapeHTML(o.hotel)}</strong></td>
    <td><strong>${quoteMoney.format(o.total)}</strong></td>
    <td><strong>${quoteMoney.format(o.deposit)}</strong></td>
    <td>${quoteMoney.format(o.balance)}</td>
  </tr>`).join("");

  const flightDate = value => value ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(value).replace(" ", "T"))) : "—";
  const flightsHTML = (q.flights || []).length ? `<div class="section-title">VUELOS</div>${q.flights.map(f => `<table class="info flight-info">
    <tr><th>Ruta</th><td>${escapeHTML(f.route || "—")}</td></tr>
    <tr><th>Salida</th><td>${escapeHTML(f.departureText || "—")} · ${escapeHTML(flightDate(f.departureAt))}</td></tr>
    <tr><th>Regreso</th><td>${escapeHTML(f.returnText || "—")} · ${escapeHTML(flightDate(f.returnAt))}</td></tr>
    ${Number(f.amount || 0) > 0 ? `<tr><th>Precio / total</th><td><strong>${quoteMoney.format(f.amount)}</strong></td></tr>` : ""}
    <tr><th>Equipaje</th><td>${escapeHTML(f.baggage || "—")}</td></tr>
    ${f.notes ? `<tr><th>Notas</th><td>${escapeHTML(f.notes)}</td></tr>` : ""}
  </table>`).join("")}` : "";

  const servicesHTML = (q.services || []).length ? `<div class="section-title">SERVICIOS ADICIONALES</div><table class="services-table"><thead><tr><th>TIPO</th><th>SERVICIO</th><th>DETALLE</th><th>PRECIO / TOTAL</th></tr></thead><tbody>${q.services.map(svc => `<tr><td>${escapeHTML(quoteServiceTypeLabel(svc.type))}</td><td><strong>${escapeHTML(svc.name)}</strong>${svc.notes ? `<br><small>${escapeHTML(svc.notes)}</small>` : ""}</td><td>${escapeHTML(svc.detail || "—")}</td><td>${svc.amount == null ? "—" : `<strong>${quoteMoney.format(svc.amount)}</strong>`}</td></tr>`).join("")}</tbody></table>` : "";

  const created = new Date(q.createdAt || nowISO());
  const brandFooter = q.brand === "pink" ? "PINK SKY TRAVEL · Mayorista de viajes" : "VELORA TRAVEL";
  const toolbar = publicView ? `<div class="client-toolbar"><span>Cotización ${escapeHTML(q.folio)}</span><button type="button" onclick="window.print()">Imprimir / Guardar PDF</button></div>` : "";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(q.folio)} · Cotización</title><style>
    @page{size:A4;margin:11mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#241529;margin:0;background:${publicView ? "#f3f4f7" : "white"};font-size:11px}.client-toolbar{position:sticky;top:0;z-index:10;display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px 18px;background:#111827;color:#fff;font-size:12px}.client-toolbar button{border:0;border-radius:9px;background:#fff;color:#111827;font-weight:800;padding:9px 12px;cursor:pointer}.sheet{max-width:794px;margin:${publicView ? "24px auto" : "auto"};background:#fff;${publicView ? "padding:24px;box-shadow:0 16px 55px rgba(17,24,39,.12);border-radius:16px" : ""}}.logo-wrap{text-align:center;margin:2px 0 8px}.logo{width:118px;height:76px;object-fit:contain}.title{text-align:center;color:${t.primary};font-size:27px;font-weight:800;margin:0}.subtitle{text-align:center;color:${t.accent};font-size:12px;font-weight:800;margin:2px 0 14px;text-transform:uppercase}.info{width:100%;border-collapse:collapse;margin-bottom:10px}.info th{width:21%;background:${t.primary};color:white;text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase}.info td{background:${t.pale};padding:8px 10px;border:1px solid #dfd6df}.section-title{font-size:14px;color:${t.primary};font-weight:900;margin:12px 0 6px}.options,.summary,.services-table{width:100%;border-collapse:collapse}.options th{background:${t.primary};color:#fff;padding:8px 10px;text-align:left;font-size:10px}.options td,.summary td,.services-table td{background:${t.pale};padding:9px 10px;border:1px solid #dfd6df}.services-table th{background:${t.primary};color:#fff;padding:8px 10px;text-align:left;font-size:10px}.services-table small{color:#796c7c}.summary th{background:${t.accent};color:#fff;padding:8px 10px;text-align:left;font-size:10px}.bullets{list-style:none;padding:0;margin:6px 0}.bullets li{margin:8px 0;line-height:1.45;padding-left:15px;position:relative}.bullets.check li:before{content:"✓";position:absolute;left:0;font-weight:900;color:${t.primary}}.bullets.dot li:before{content:"•";position:absolute;left:2px;color:${t.primary}}.footer{text-align:center;margin-top:18px;color:${t.primary};font-weight:900;font-size:11px}.footer-note{text-align:center;margin-top:10px;color:#796c7c;font-size:8.5px}.invalid-share{max-width:680px;margin:80px auto;background:#fff;border-radius:18px;padding:34px;text-align:center;box-shadow:0 16px 55px rgba(17,24,39,.12)}@media(max-width:820px){.sheet{margin:0;border-radius:0;box-shadow:none;padding:18px}.client-toolbar{position:static}.options,.summary{font-size:9px}.options th,.options td,.summary th,.summary td{padding:7px 5px}}@media print{body{background:#fff;font-size:10.5px}.client-toolbar{display:none!important}.sheet{max-width:none;margin:0;padding:0;box-shadow:none;border-radius:0}.title{font-size:24px}.section-title{margin-top:10px}.logo{height:66px}.options td,.summary td,.info td,.info th{padding:7px 9px}}
  </style></head><body>${toolbar}<main class="sheet"><div class="logo-wrap"><img class="logo" src="${logo}" alt="${escapeHTML(brandLabel(q.brand))}"></div><h1 class="title">COTIZACIÓN</h1><div class="subtitle">${escapeHTML(q.destination.toUpperCase())} · ${escapeHTML(quoteDateRangeUpper(q))}</div><table class="info"><tr><th>Destino</th><td>${escapeHTML(q.destination)}</td></tr><tr><th>Estancia</th><td>${escapeHTML(quoteStayText(q))}</td></tr><tr><th>Pasajeros</th><td>${escapeHTML(q.passengers)}</td></tr><tr><th>Habitaciones</th><td>${escapeHTML(q.rooms)}</td></tr></table><div class="section-title">OPCIONES DE HOSPEDAJE</div><table class="options"><thead><tr><th>HOTEL</th><th>PLAN</th><th>${escapeHTML(totalHead)}</th><th>APARTADO</th></tr></thead><tbody>${optionsRows}</tbody></table>${flightsHTML}${servicesHTML}<div class="section-title">INCLUYE</div><ul class="bullets check">${q.includes.map(x => `<li>${escapeHTML(x)}</li>`).join("") || "<li>Servicios de acuerdo con la opción seleccionada.</li>"}</ul><div class="section-title">CONDICIONES DE RESERVACIÓN</div><ul class="bullets dot">${conditions.map(x => `<li>${escapeHTML(x)}</li>`).join("") || "<li>Precios sujetos a disponibilidad al momento de reservar.</li>"}</ul><div class="section-title">RESUMEN DE INVERSIÓN</div><table class="summary"><thead><tr><th>OPCIÓN</th><th>TOTAL</th><th>APARTADO</th><th>SALDO</th></tr></thead><tbody>${summaryRows}</tbody></table><div class="footer">${escapeHTML(brandFooter)}</div><div class="footer-note">Cotización elaborada el ${escapeHTML(quoteDateLong.format(created))} · Precios sujetos a disponibilidad al momento de reservar.<br>${escapeHTML(q.folio)}</div></main></body></html>`;
}

async function printQuote(id) {
  const q = quotesStore.find(x => x.id === id); if (!q) return;
  const win = window.open("", "_blank", "width=950,height=900"); if (!win) { alert("El navegador bloqueó la ventana de impresión."); return; }
  win.document.write(quoteDocumentHTML(q));
  win.document.close();
  await logAction("quote", q.id, "printed", { folio: q.folio, customer: q.customer, destination: q.destination });
  setTimeout(() => { win.focus(); win.print(); }, 350);
}
function quoteShareToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}
function quoteShareURL(q) {
  const url = new URL(location.href);
  url.hash = "";
  url.search = "";
  url.searchParams.set("quote", q.id);
  url.searchParams.set("token", q.shareToken);
  return url.toString();
}
function ensureQuoteShareDialog() {
  let dialog = document.getElementById("quoteShareModal");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "quoteShareModal";
  dialog.className = "modal";
  dialog.innerHTML = `<form method="dialog" style="padding:24px;min-width:min(620px,calc(100vw - 48px))"><div class="modal-head"><div><span class="eyebrow">ENVIAR COTIZACIÓN</span><h3>Compartir con el cliente</h3></div><button class="icon-btn square" value="cancel" aria-label="Cerrar">×</button></div><div style="display:grid;gap:12px;margin-top:18px"><label><span>Enlace</span><div style="display:flex;gap:8px"><input id="quoteShareLink" readonly style="flex:1"><button class="ghost-btn compact" id="copyQuoteShareBtn" type="button">Copiar</button></div></label><div id="quoteLocalShareWarning" style="display:none;padding:10px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;font-size:11px;color:#9a3412">Estás en localhost. Este enlace sirve para probar en esta computadora; para enviarlo a un cliente primero sube esta versión a GitHub Pages.</div><div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button class="ghost-btn" id="previewQuoteShareBtn" type="button">Vista del cliente</button><button class="primary-btn" id="whatsAppQuoteShareBtn" type="button">Enviar por WhatsApp</button></div></div></form>`;
  document.body.appendChild(dialog);
  return dialog;
}
async function copyQuoteShareLink(link) {
  try { await navigator.clipboard.writeText(link); }
  catch {
    const input = document.getElementById("quoteShareLink");
    input.focus(); input.select(); document.execCommand("copy");
  }
}
async function shareQuote(id) {
  const q = quotesStore.find(x => x.id === id); if (!q) return;
  const actor = currentActor();
  if (quotesSupabase) {
    const payload = { share_enabled: true, shared_at: nowISO(), updated_by: actor.id };
    if (q.status === "borrador") payload.status = "enviada";
    const { data, error } = await quotesSupabase.from(QUOTE_TABLE).update(payload).eq("id", q.id).select("share_token,share_enabled,shared_at,status,updated_at").single();
    if (error) { alert(error.message); return; }
    q.shareToken = data.share_token || q.shareToken;
    q.shareEnabled = Boolean(data.share_enabled);
    q.sharedAt = data.shared_at || nowISO();
    q.status = data.status || q.status;
    q.updatedAt = data.updated_at || q.updatedAt;
  } else {
    q.shareToken ||= quoteShareToken();
    q.shareEnabled = true;
    q.sharedAt = nowISO();
    if (q.status === "borrador") q.status = "enviada";
    saveDemoQuotes();
  }
  if (!q.shareToken) { alert("No se pudo generar el enlace de la cotización."); return; }
  const link = quoteShareURL(q);
  const dialog = ensureQuoteShareDialog();
  document.getElementById("quoteShareLink").value = link;
  document.getElementById("quoteLocalShareWarning").style.display = ["127.0.0.1", "localhost"].includes(location.hostname) ? "block" : "none";
  document.getElementById("copyQuoteShareBtn").onclick = async () => { await copyQuoteShareLink(link); document.getElementById("copyQuoteShareBtn").textContent = "Copiado ✓"; setTimeout(() => document.getElementById("copyQuoteShareBtn").textContent = "Copiar", 1400); };
  document.getElementById("previewQuoteShareBtn").onclick = () => window.open(link, "_blank");
  document.getElementById("whatsAppQuoteShareBtn").onclick = () => {
    const text = `Hola, te comparto la cotización para ${q.destination}: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };
  dialog.showModal();
  renderQuotes();
  await logAction("quote", q.id, "shared", { folio: q.folio, customer: q.customer, destination: q.destination, shared_at: q.sharedAt });
}
async function renderSharedQuotePage(quoteId, token) {
  document.getElementById("app")?.setAttribute("hidden", "");
  document.body.innerHTML = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:80px auto;text-align:center"><strong>Cargando cotización…</strong></div>`;
  try {
    const sb = await window.getSupabase();
    let raw = null;
    if (sb) {
      const { data, error } = await sb.rpc(QUOTE_SHARE_RPC, { p_quote_id: quoteId, p_token: token });
      if (error) throw error;
      raw = data;
    } else {
      loadDemoQuotes();
      raw = quotesStore.find(x => String(x.id) === String(quoteId) && x.shareEnabled && x.shareToken === token) || null;
    }
    if (!raw) throw new Error("Enlace inválido o desactivado.");
    const q = normalizeQuote(raw);
    document.open();
    document.write(quoteDocumentHTML(q, { publicView: true }));
    document.close();
  } catch (err) {
    document.body.innerHTML = `<div style="font-family:Arial,sans-serif;background:#f3f4f7;min-height:100vh;padding:40px"><div class="invalid-share" style="max-width:680px;margin:80px auto;background:#fff;border-radius:18px;padding:34px;text-align:center;box-shadow:0 16px 55px rgba(17,24,39,.12)"><h1 style="margin-top:0">Cotización no disponible</h1><p style="color:#667085">${escapeHTML(err?.message || "El enlace no es válido.")}</p></div></div>`;
  }
}

function bindQuoteModule() {
  $("#quoteAdultsCount")?.addEventListener("input", () => renderQuotePassengerEditor());
  $("#quoteMinorsCount")?.addEventListener("input", () => renderQuotePassengerEditor());

  $("#newQuoteBtn")?.addEventListener("click", () => openQuoteModal());
  $("#quoteSearch")?.addEventListener("input", renderQuotes);
  $("#quoteStatusFilter")?.addEventListener("change", renderQuotes);
  $("#quoteForm")?.addEventListener("submit", saveQuoteFromForm);
  $("#addQuoteOptionBtn")?.addEventListener("click", () => { syncQuoteOptionDraft(); if (quoteOptionsDraft.length >= MAX_QUOTE_OPTIONS) return; quoteOptionsDraft.push(blankQuoteOption()); renderQuoteOptionsEditor(quoteOptionsDraft); });
  $("#addQuoteServiceBtn")?.addEventListener("click", () => { syncQuoteServicesDraft(); quoteServicesDraft.push(blankQuoteService()); renderQuoteServicesEditor(quoteServicesDraft); });
  $("#quoteStart")?.addEventListener("change", () => { const start = $("#quoteStart").value; $("#quoteEnd").min = start || ""; if (start && (!$("#quoteEnd").value || $("#quoteEnd").value < start)) $("#quoteEnd").value = start; syncQuoteFlightDates(); });
  $("#quoteEnd")?.addEventListener("change", syncQuoteFlightDates);
  for (const id of ["quoteFlightDepartureAt", "quoteFlightReturnAt"]) {
    document.getElementById(id)?.addEventListener("input", e => { e.target.dataset.manualDate = "true"; });
  }
  $("#quoteBrand")?.addEventListener("change", () => {
    $("#quoteCrmLeadId").value = "";
    $("#quoteCustomerPhone").value = "";
    renderQuoteCustomerList();
  });
  $("#quoteV3ClientId")?.addEventListener("change", applyQuoteV3ClientSelection);
  $("#quoteCustomer")?.addEventListener("focus", renderQuoteCustomerList);
  $("#quoteCustomer")?.addEventListener("change", () => applyQuoteCustomerSelection());
  $("#quoteCustomer")?.addEventListener("input", () => {
    const v3 = quoteV3Clients.find(c => c.id === $("#quoteV3ClientId")?.value);
    if (v3 && $("#quoteCustomer").value.trim() !== v3.name) $("#quoteV3ClientId").value = "";
    const contact = findQuoteContactExact($("#quoteCustomer").value, $("#quoteBrand").value);
    if (contact?.source === "crm") applyQuoteCustomerSelection();
    else $("#quoteCrmLeadId").value = "";
  });
  $("#brandFilter")?.addEventListener("change", () => setTimeout(renderQuotes, 0));
  $$('.brand-switch').forEach(btn => btn.addEventListener("click", () => setTimeout(renderQuotes, 0)));
  const quoteNav = $('.nav-item[data-view="quotes"]');
  quoteNav?.addEventListener("click", () => hydrateQuotes());
  $("#demoAccess")?.addEventListener("click", () => setTimeout(() => { loadDemoQuotes(); renderQuotes(); }, 0));
  window.addEventListener("focus", () => { if ($("#quotesView")?.classList.contains("active")) hydrateQuotes(); });
}

window.openQuoteFromCRMLead = function (leadId) {
  const lead = (state.leads || []).find(l => String(l.id) === String(leadId));
  if (!lead) { alert("No encontré ese prospecto en el CRM."); return; }
  buildQuoteContactsFromState();
  switchView("quotes");
  openQuoteModal();
  $("#quoteBrand").value = lead.brand || "pink";
  renderQuoteCustomerList();
  $("#quoteCrmLeadId").value = lead.id || "";
  $("#quoteCustomer").value = lead.name || "";
  $("#quoteCustomerPhone").value = lead.phone || "";
  $("#quoteDestination").value = lead.interest || "";
  $("#quoteModalTitle").textContent = "Cotización desde CRM";
};

const quotePublicParams = new URLSearchParams(location.search);
const publicQuoteId = quotePublicParams.get("quote");
const publicQuoteToken = quotePublicParams.get("token");
if (publicQuoteId && publicQuoteToken) renderSharedQuotePage(publicQuoteId, publicQuoteToken);
else { bindQuoteModule(); hydrateQuotes(); }

// Cobros directos de cotizaciones aceptadas: independientes de salidas y bookings.
let quotePaymentRows = [];
async function refreshQuotePayments() {
  if (!quotesSupabase) return;
  const {data,error} = await quotesSupabase.from('travelops_quote_payments').select('*').order('created_at',{ascending:true});
  if (error) { console.warn('Cobros de cotizaciones (ver SQL_COTIZACIONES_PAGOS.sql)',error); return; }
  quotePaymentRows = data || [];
  renderQuotes(); renderPayments();
}
function quotePaymentsFor(q) { return quotePaymentRows.filter(p => p.quote_id === q.id); }
function quotePaymentInfo(q) {
  const rows = quotePaymentsFor(q);
  const opt = q.options.find(o => o.id === rows[0]?.option_id);
  const total = rows.length ? Number(rows[0].total_amount) : quoteBestTotal(q);
  const paid = rows.reduce((n,p)=>n+Number(p.amount),0);
  return {rows,opt,total,paid,balance:Math.max(0,total-paid)};
}
function quotePaymentActions(q) {
  const info = quotePaymentInfo(q);
  return `<div class="quote-card-actions"><button class="primary-btn compact" type="button" data-quote-collect="${q.id}">+ Registrar pago</button><small>${info.rows.length ? `Pagado ${quoteMoney.format(info.paid)} · Saldo ${quoteMoney.format(info.balance)}` : 'Sin abonos registrados'}</small></div>`;
}
function wireQuoteCollectButtons(root=document) {
  $$('[data-quote-collect]',root).forEach(btn=>btn.addEventListener('click',()=>openQuotePaymentModal(btn.dataset.quoteCollect)));
  $$('[data-quote-receipt]',root).forEach(btn=>btn.addEventListener('click',()=>printQuotePaymentReceipt(btn.dataset.quoteReceipt)));
  $$('[data-quote-wa]',root).forEach(btn=>btn.addEventListener('click',()=>shareQuotePayment(btn.dataset.quoteWa)));
}
function renderQuotePaymentRows() {
  const rows = quotesStore.filter(q=>q.status==='aceptada' && (state.brand==='all'||state.brand===q.brand));
  const html = rows.map(q=>{
    const {rows:movements,total,paid,balance} = quotePaymentInfo(q);
    const last=movements.at(-1);
    const actions=`<button class="small-btn" data-quote-collect="${q.id}">+ Abono</button> ${last?`<button class="small-btn" data-quote-receipt="${last.id}">Último recibo</button> <button class="small-btn" data-quote-wa="${last.id}">Enviar recibo</button>`:''}`;
    return `<tr><td>${escapeHTML(q.destination)}<small style="display:block">${escapeHTML(q.folio)} · Cotización</small></td><td>${escapeHTML(q.customer)}</td><td>${quoteMoney.format(total)}</td><td>${quoteMoney.format(paid)}</td><td>${quoteMoney.format(balance)}</td><td>${last?escapeHTML(last.paid_on):'—'}</td><td>${actions}</td></tr>`;
  }).join('');
  const table=$('#paymentsTable');
  if (!table) return;
  if (html) { if (table.querySelector('td[colspan="7"]')) table.innerHTML=''; table.insertAdjacentHTML('beforeend',html); }
  wireQuoteCollectButtons(table);
}
function openQuotePaymentModal(id) {
  const q=quotesStore.find(item=>item.id===id);
  if (!q||q.status!=='aceptada') return alert('La cotización debe estar aceptada.');
  if (!quotesSupabase) return alert('Debes iniciar sesión con Supabase para registrar pagos.');
  const info=quotePaymentInfo(q);
  $('#quotePaymentForm').dataset.quoteId=q.id;
  $('#quotePaymentSummary').textContent=`${q.folio} · ${q.customer} · Saldo: ${quoteMoney.format(info.balance)}`;
  $('#quotePaymentOption').innerHTML=q.options.filter(o=>Number(o.total)>0).map(o=>`<option value="${o.id}">${escapeHTML(o.hotel)} — ${quoteMoney.format(o.total)}</option>`).join('');
  if(info.rows.length) {$('#quotePaymentOption').value=info.rows[0].option_id;$('#quotePaymentOption').disabled=true;}
  else $('#quotePaymentOption').disabled=false;
  $('#quotePaymentAmount').value='';
  $('#quotePaymentDate').value=new Date().toLocaleDateString('en-CA');
  $('#quotePaymentReference').value=''; $('#quotePaymentNotes').value='';
  if(!info.balance && info.rows.length) return alert('Esta cotización ya está liquidada.');
  $('#quotePaymentModal').showModal();
}
async function saveQuotePayment(e) {
  e.preventDefault();
  const button=e.currentTarget.querySelector('[type="submit"]'); if(button.disabled) return;
  const q=quotesStore.find(item=>item.id===e.currentTarget.dataset.quoteId);
  if(!q||!quotesSupabase)return;
  const opt=q.options.find(o=>o.id===$('#quotePaymentOption').value);
  const info=quotePaymentInfo(q);
  const amount=Number($('#quotePaymentAmount').value);
  if(!opt||!Number.isFinite(amount)||amount<=0)return alert('Selecciona una opción y un importe válido.');
  const total=info.rows.length?info.total:Number(opt.total);
  if(amount>total-info.paid+0.001)return alert('El abono supera el saldo pendiente.');
  button.disabled=true;
  try {
    const {data,error}=await quotesSupabase.from('travelops_quote_payments').insert({quote_id:q.id,option_id:opt.id,total_amount:total,amount,paid_on:$('#quotePaymentDate').value,method:$('#quotePaymentMethod').value,reference:$('#quotePaymentReference').value.trim(),notes:$('#quotePaymentNotes').value.trim(),created_by:state.user.id}).select().single();
    if(error)throw error;
    quotePaymentRows.push(data);
    $('#quotePaymentModal').close(); renderQuotes();renderPayments();
    alert('Pago guardado. Folio: '+data.receipt_number+'\nPuedes imprimir el recibo desde Pagos.');
  }catch(err){alert('No se pudo guardar el pago: '+err.message);}
  finally{button.disabled=false;}
}
function findQuotePayment(id){const payment=quotePaymentRows.find(p=>p.id===id);return payment?{payment,q:quotesStore.find(q=>q.id===payment.quote_id)}:null;}
function quoteReceiptMessage(q,p){
  const info=quotePaymentInfo(q);
  const chronological=info.rows.filter(r=>r.created_at < p.created_at || (r.created_at === p.created_at && r.id <= p.id));
  const paid=chronological.reduce((n,r)=>n+Number(r.amount),0);
  return `Recibo ${p.receipt_number}\n${brandLabel(q.brand)}\nCliente: ${q.customer}\nCotización: ${q.folio}\nDestino: ${q.destination}\nAbono: ${quoteMoney.format(p.amount)}\nFecha: ${p.paid_on}\nSaldo al emitir: ${quoteMoney.format(Math.max(0,Number(p.total_amount)-paid))}`;
}
async function shareQuotePayment(id){
  const x=findQuotePayment(id);if(!x||!x.q)return;
  const {q,payment:p}=x;
  const message=quoteReceiptMessage(q,p);
  const throughPayment=quotePaymentsFor(q).filter(r=>r.created_at<p.created_at||(r.created_at===p.created_at&&r.id<=p.id)).reduce((n,r)=>n+Number(r.amount||0),0);
  const file=await createTravelReceiptPDF({folio:p.receipt_number,brand:q.brand,customer:q.customer,destination:q.destination,concept:'Cotización '+q.folio,paidOn:p.paid_on,amount:Number(p.amount),total:Number(p.total_amount),paid:throughPayment,method:p.method,reference:p.reference,notes:p.notes});
  if(!file)return; // Error de generación: no afirmar que se envió.
  await shareTravelReceiptFile(file,message);
}
function printQuotePaymentReceipt(id){
  const x=findQuotePayment(id);if(!x||!x.q)return;
  const {q,payment:p}=x;
  const win=window.open('','_blank','width=850,height=730');if(!win)return alert('Permite las ventanas emergentes para imprimir el recibo.');
  const logo=new URL(brandAsset(q.brand),location.href).href;
  const message=quoteReceiptMessage(q,p).split('\n').map(line=>`<p>${escapeHTML(line)}</p>`).join('');
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHTML(p.receipt_number)}</title><style>body{font:16px Arial;color:#172033;max-width:720px;margin:45px auto;padding:20px}header{display:flex;gap:20px;align-items:center;border-bottom:2px solid #172033;padding-bottom:24px}img{width:90px;max-height:90px;object-fit:contain}h1{font-size:25px}p{padding:9px;border-bottom:1px solid #eee}small{color:#666}</style></head><body><header><img src="${logo}"><div><h1>Recibo de pago</h1><strong>${escapeHTML(brandLabel(q.brand))}</strong></div></header>${message}<small>Documento de control de pagos. No sustituye un CFDI.</small></body></html>`);
  win.document.close();setTimeout(()=>{win.focus();win.print()},350);
}
$('#quotePaymentForm')?.addEventListener('submit',saveQuotePayment);
// Se ejecuta tras la carga inicial y cada regreso a Cotizaciones.
const originalRenderQuotes=renderQuotes;
renderQuotes=function(){originalRenderQuotes();const cards=$('#quoteCards');if(cards){quotesStore.filter(q=>q.status==='aceptada').forEach(q=>{const card=cards.querySelector(`[data-quote-edit="${q.id}"]`)?.closest('.quote-card');if(card&&!card.querySelector('[data-quote-collect]'))card.insertAdjacentHTML('beforeend',quotePaymentActions(q));});wireQuoteCollectButtons(cards);}};
const originalRenderPayments=renderPayments;
renderPayments=function(){originalRenderPayments();renderQuotePaymentRows();};
const originalHydrateQuotes=hydrateQuotes;
hydrateQuotes=async function(){await originalHydrateQuotes();await refreshQuotePayments();};
// La primera hidratación fue llamada antes de declarar estos complementos.
refreshQuotePayments();
