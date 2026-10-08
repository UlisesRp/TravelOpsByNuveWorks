// =========================================================
// Travel Ops v1.12 - Cotizaciones con hasta 5 opciones
// Pink Sky Travel + Velora Travel
// =========================================================

const QUOTES_DEMO_KEY = "travelops_demo_quotes_v19";
const QUOTE_TABLE = "travelops_quotes";
const QUOTE_OPTIONS_TABLE = "travelops_quote_options";
const QUOTE_FOLIO_RPC = "next_travelops_v19_quote_folio";
const QUOTE_SHARE_RPC = "get_shared_travelops_quote";
const MAX_QUOTE_OPTIONS = 5;
let quotesSupabase = null;
let quotesStore = [];
let quoteOptionsDraft = [];
let quoteProfiles = new Map();
let quoteContacts = [];

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
function quoteFinalTotal(q, baseTotal) {
  const base = Number(baseTotal || 0);
  const commission = Number(q?.commissionPercent || 0);
  return base * (1 + commission / 100);
}
function quoteBestTotal(q) {
  const vals = (q.options || []).map(o => quoteFinalTotal(q, o.total)).filter(n => n > 0);
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
    customer: q.customer || q.customer_name || "",
    customerPhone: q.customerPhone || q.customer_phone || "",
    destination: q.destination || "",
    start: q.start || q.start_date || "",
    end: q.end || q.end_date || "",
    passengers: q.passengers || q.passengers_text || "",
    rooms: q.rooms || q.rooms_text || "",
    depositPercent: Number(q.depositPercent ?? q.deposit_percent ?? 30),
    liquidationDate: q.liquidationDate || q.liquidation_date || "",
    commissionPercent: Number(q.commissionPercent ?? q.commission_percent ?? 15),
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
    options: Array.isArray(q.options) ? q.options.map((o, i) => ({ id: o.id || uid("qopt"), hotel: o.hotel || "", plan: o.plan || "", total: Number(o.total ?? o.total_amount ?? 0), sortOrder: Number(o.sortOrder ?? o.sort_order ?? i) })) : []
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
    { data: agencies, error: ae },
    { data: bookings, error: be },
    { data: departures, error: de },
    { data: crmLeads, error: ce }
  ] = await Promise.all([
    quotesSupabase.from("profiles").select("id,full_name,avatar_data_url"),
    quotesSupabase.from(QUOTE_TABLE).select("*").order("created_at", { ascending: false }),
    quotesSupabase.from(QUOTE_OPTIONS_TABLE).select("*").order("sort_order", { ascending: true }),
    quotesSupabase.from("agencies").select("id,name").order("name"),
    quotesSupabase.from("bookings").select("id,departure_id,customer_name,agency_id"),
    quotesSupabase.from("departures").select("id,brand"),
    quotesSupabase.from("crm_leads").select("id,name,phone,brand,interest,status,notes").order("created_at", { ascending: false })
  ]);

  if (qe || oe) {
    console.warn("Travel Ops cotizaciones:", qe || oe);
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
    normalizeQuote({ ...row, options: (opts || []).filter(o => o.quote_id === row.id) })
  );

  buildQuoteContacts(agencies || [], bookings || [], departures || [], crmLeads || []);
  renderQuoteCustomerList();
  renderQuotes();
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
}

function quoteCardHTML(q) {
  const best = quoteBestTotal(q);
  const creator = q.createdBy || SYSTEM_ACTOR;
  return `<article class="quote-card">
    <div class="quote-card-top"><div><span class="quote-folio">${escapeHTML(q.folio)}</span><h4>${escapeHTML(q.destination)}</h4><p>${escapeHTML(q.customer || "Sin agencia / cliente")}${q.customerPhone ? ` · ${escapeHTML(q.customerPhone)}` : ""}${q.crmLeadId ? " · CRM" : ""}</p></div>${brandChipHTML(q.brand, true)}</div>
    <div class="quote-card-meta"><span>${q.start ? dateFmt.format(parseDate(q.start)) : "—"} → ${q.end ? dateFmt.format(parseDate(q.end)) : "—"}</span><span>${q.options.length} ${q.options.length === 1 ? "opción" : "opciones"}</span></div>
    <div class="quote-card-options">${q.options.map((o, i) => `<div><span>${i + 1}. ${escapeHTML(o.hotel)}</span><strong>${quoteMoney.format(quoteFinalTotal(q, o.total))}</strong></div>`).join("") || `<span>Sin opciones capturadas</span>`}</div>
    <div class="quote-card-bottom"><div><span class="status-chip ${quoteStatusClass(q.status)}">${quoteStatusLabel(q.status)}</span>${best ? `<strong>Desde ${quoteMoney.format(best)}</strong>` : ""}</div><small>Creó ${escapeHTML(creator.name)} · ${quoteDateTime.format(new Date(q.createdAt))}</small></div>
    <div class="quote-card-actions"><button class="small-btn" data-quote-share="${q.id}">Enviar al cliente</button><button class="small-btn" data-quote-print="${q.id}">Imprimir / PDF</button><button class="small-btn" data-quote-edit="${q.id}">Editar</button><button class="small-btn" data-quote-duplicate="${q.id}">Duplicar</button><button class="small-btn danger" data-quote-delete="${q.id}">Borrar</button></div>
  </article>`;
}

function blankQuoteOption() { return { id: uid("qopt"), hotel: "", plan: "", total: 0 }; }
function renderQuoteOptionsEditor(options = quoteOptionsDraft) {
  quoteOptionsDraft = (options.length ? options : [blankQuoteOption()]).slice(0, MAX_QUOTE_OPTIONS).map(o => ({ ...blankQuoteOption(), ...o }));
  $("#quoteOptionsEditor").innerHTML = quoteOptionsDraft.map((o, i) => `<article class="quote-option-editor" data-option-id="${escapeHTML(o.id)}"><div class="quote-option-title"><strong>Opción ${i + 1}</strong>${i ? `<button class="mini-remove" type="button" data-remove-qopt="${escapeHTML(o.id)}">×</button>` : ""}</div><div class="quote-option-fields"><label><span>Hotel</span><input data-qopt="hotel" value="${escapeHTML(o.hotel)}" placeholder="Ej. Royal Villas" required /></label><label><span>Plan</span><input data-qopt="plan" value="${escapeHTML(o.plan)}" placeholder="Ej. Todo incluido" required /></label><label><span>Total base</span><input data-qopt="total" type="number" min="0.01" step="0.01" value="${o.total || ""}" placeholder="0.00" required /><small class="quote-option-help">Se agregará la comisión al precio final.</small></label></div></article>`).join("");
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
    total: Number(card.querySelector('[data-qopt="total"]').value || 0)
  }));
  return quoteOptionsDraft;
}
function openQuoteModal(id = "") {
  const q = id ? quotesStore.find(x => x.id === id) : null;
  $("#quoteForm").reset();
  $("#quoteId").value = q?.id || "";
  $("#quoteModalTitle").textContent = q ? "Editar cotización" : "Nueva cotización";
  $("#quoteBrand").value = q?.brand || (state.brand === "velora" ? "velora" : "pink");
  renderQuoteCustomerList();
  $("#quoteCrmLeadId").value = q?.crmLeadId || "";
  $("#quoteCustomer").value = q?.customer || "";
  $("#quoteCustomerPhone").value = q?.customerPhone || "";
  $("#quoteDestination").value = q?.destination || "";
  $("#quoteStart").value = q?.start || "";
  $("#quoteEnd").value = q?.end || "";
  $("#quotePassengers").value = q?.passengers || "";
  $("#quoteRooms").value = q?.rooms || "";
  $("#quoteDepositPercent").value = q?.depositPercent ?? 30;
  $("#quoteLiquidationDate").value = q?.liquidationDate || "";
  $("#quoteCommissionPercent").value = q?.commissionPercent ?? 15;
  $("#quoteStatus").value = q?.status || "borrador";
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
  if (!quoteOptionsDraft.length || quoteOptionsDraft.some(o => !o.hotel || !o.plan || o.total <= 0)) { alert("Completa hotel, plan y total de cada opción."); return; }
  const start = $("#quoteStart").value, end = $("#quoteEnd").value;
  if (end < start) { alert("La fecha de regreso no puede ser anterior a la salida."); return; }
  const id = $("#quoteId").value;
  const old = id ? quotesStore.find(q => q.id === id) : null;
  const actor = currentActor();
  const brand = $("#quoteBrand").value;
  const quote = normalizeQuote({
    id: id || uid("quote"),
    folio: old?.folio || await nextQuoteFolio(brand),
    brand,
    crmLeadId: $("#quoteCrmLeadId").value || "",
    customer: $("#quoteCustomer").value.trim(),
    customerPhone: $("#quoteCustomerPhone").value.trim(),
    destination: $("#quoteDestination").value.trim(),
    start, end,
    passengers: $("#quotePassengers").value.trim(),
    rooms: $("#quoteRooms").value.trim(),
    depositPercent: Number($("#quoteDepositPercent").value || 0),
    liquidationDate: $("#quoteLiquidationDate").value,
    commissionPercent: Number($("#quoteCommissionPercent").value || 0),
    status: $("#quoteStatus").value,
    includes: quoteLines($("#quoteIncludes").value),
    extraConditions: quoteLines($("#quoteExtraConditions").value),
    options: quoteOptionsDraft,
    createdBy: old?.createdBy || actor,
    updatedBy: actor,
    createdAt: old?.createdAt || nowISO(),
    updatedAt: nowISO()
  });

  if (quotesSupabase) {
    const payload = {
      id: quote.id, folio: quote.folio, brand: quote.brand, crm_lead_id: quote.crmLeadId || null, customer_name: quote.customer, customer_phone: quote.customerPhone || null, destination: quote.destination,
      start_date: quote.start, end_date: quote.end, passengers_text: quote.passengers, rooms_text: quote.rooms,
      deposit_percent: quote.depositPercent, liquidation_date: quote.liquidationDate || null, commission_percent: quote.commissionPercent,
      status: quote.status, include_items: quote.includes, extra_conditions: quote.extraConditions,
      created_by: old?.createdBy?.id || actor.id, updated_by: actor.id
    };
    const { data: saved, error } = await quotesSupabase.from(QUOTE_TABLE).upsert(payload, { onConflict: "id" }).select().single();
    if (error) { alert(error.message); return; }
    quote.id = saved.id; quote.createdAt = saved.created_at || quote.createdAt; quote.updatedAt = saved.updated_at || quote.updatedAt;
    quote.shareToken = saved.share_token || quote.shareToken || "";
    quote.shareEnabled = Boolean(saved.share_enabled ?? quote.shareEnabled);
    quote.sharedAt = saved.shared_at || quote.sharedAt || "";
    const { error: delErr } = await quotesSupabase.from(QUOTE_OPTIONS_TABLE).delete().eq("quote_id", quote.id);
    if (delErr) { alert(delErr.message); return; }
    const rows = quote.options.map((o, i) => ({ quote_id: quote.id, sort_order: i, hotel: o.hotel, plan: o.plan, total_amount: o.total }));
    const { data: savedOpts, error: optErr } = await quotesSupabase.from(QUOTE_OPTIONS_TABLE).insert(rows).select();
    if (optErr) { alert(optErr.message); return; }
    quote.options = (savedOpts || []).map(o => ({ id: o.id, hotel: o.hotel, plan: o.plan, total: Number(o.total_amount || 0), sortOrder: o.sort_order }));
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
  await logAction("quote", quote.id, old ? "updated" : "created", { folio: quote.folio, customer: quote.customer, destination: quote.destination, brand: quote.brand, crm_lead_id: quote.crmLeadId || null });
  $("#quoteModal").close();
  renderQuotes();
  if (typeof renderCRM === "function") renderCRM();
}

async function duplicateQuote(id) {
  const source = quotesStore.find(q => q.id === id); if (!source) return;
  const actor = currentActor();
  const copy = normalizeQuote({ ...structuredClone(source), id: uid("quote"), folio: await nextQuoteFolio(source.brand), status: "borrador", createdBy: actor, updatedBy: actor, createdAt: nowISO(), updatedAt: nowISO(), options: source.options.map(o => ({ ...o, id: uid("qopt") })) });
  if (quotesSupabase) {
    const { data, error } = await quotesSupabase.from(QUOTE_TABLE).insert({ id: copy.id, folio: copy.folio, brand: copy.brand, crm_lead_id: copy.crmLeadId || null, customer_name: copy.customer, customer_phone: copy.customerPhone || null, destination: copy.destination, start_date: copy.start, end_date: copy.end, passengers_text: copy.passengers, rooms_text: copy.rooms, deposit_percent: copy.depositPercent, liquidation_date: copy.liquidationDate || null, commission_percent: copy.commissionPercent, status: copy.status, include_items: copy.includes, extra_conditions: copy.extraConditions, created_by: actor.id, updated_by: actor.id }).select().single();
    if (error) { alert(error.message); return; }
    copy.id = data.id; copy.createdAt = data.created_at; copy.updatedAt = data.updated_at;
    const { data: opts, error: oe } = await quotesSupabase.from(QUOTE_OPTIONS_TABLE).insert(copy.options.map((o, i) => ({ quote_id: copy.id, sort_order: i, hotel: o.hotel, plan: o.plan, total_amount: o.total }))).select();
    if (oe) { alert(oe.message); return; }
    copy.options = opts.map(o => ({ id: o.id, hotel: o.hotel, plan: o.plan, total: Number(o.total_amount), sortOrder: o.sort_order }));
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
  const depositLabel = `APARTADO ${Number(q.depositPercent || 0).toLocaleString("es-MX", { maximumFractionDigits: 2 })}%`;
  const logo = new URL(brandAsset(q.brand), location.href).href;
  const conditions = [
    q.depositPercent > 0 ? `La reservación se aparta con el ${q.depositPercent}% del valor total de la opción seleccionada.` : "La reservación se confirma de acuerdo con las condiciones indicadas por la agencia.",
    q.liquidationDate ? `Fecha límite para liquidar el hospedaje: ${quoteDateLong.format(parseDate(q.liquidationDate))}.` : "",
    q.commissionPercent > 0 ? `Tarifas comisionables al ${q.commissionPercent}% para agencias de viajes.` : "",
    ...q.extraConditions
  ].filter(Boolean);
  const optionsRows = q.options.map(o => { const finalTotal = quoteFinalTotal(q, o.total); const deposit = finalTotal * Number(q.depositPercent || 0) / 100; return `<tr><td><strong>${escapeHTML(o.hotel)}</strong></td><td>${escapeHTML(o.plan)}</td><td><strong>${quoteMoney.format(finalTotal)}</strong></td><td><strong>${quoteMoney.format(deposit)}</strong></td></tr>`; }).join("");
  const summaryRows = q.options.map(o => { const finalTotal = quoteFinalTotal(q, o.total); const deposit = finalTotal * Number(q.depositPercent || 0) / 100; return `<tr><td><strong>${escapeHTML(o.hotel)}</strong></td><td><strong>${quoteMoney.format(finalTotal)}</strong></td><td><strong>${quoteMoney.format(deposit)}</strong></td><td>${quoteMoney.format(finalTotal - deposit)}</td></tr>`; }).join("");
  const created = new Date(q.createdAt || nowISO());
  const brandFooter = q.brand === "pink" ? "PINK SKY TRAVEL · Mayorista de viajes" : "VELORA TRAVEL";
  const toolbar = publicView ? `<div class="client-toolbar"><span>Cotización ${escapeHTML(q.folio)}</span><button type="button" onclick="window.print()">Imprimir / Guardar PDF</button></div>` : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(q.folio)} · Cotización</title><style>
    @page{size:A4;margin:11mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#241529;margin:0;background:${publicView ? "#f3f4f7" : "white"};font-size:11px}.client-toolbar{position:sticky;top:0;z-index:10;display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px 18px;background:#111827;color:#fff;font-size:12px}.client-toolbar button{border:0;border-radius:9px;background:#fff;color:#111827;font-weight:800;padding:9px 12px;cursor:pointer}.sheet{max-width:794px;margin:${publicView ? "24px auto" : "auto"};background:#fff;${publicView ? "padding:24px;box-shadow:0 16px 55px rgba(17,24,39,.12);border-radius:16px" : ""}}.logo-wrap{text-align:center;margin:2px 0 8px}.logo{width:118px;height:76px;object-fit:contain}.title{text-align:center;color:${t.primary};font-size:27px;font-weight:800;margin:0}.subtitle{text-align:center;color:${t.accent};font-size:12px;font-weight:800;margin:2px 0 14px;text-transform:uppercase}.info{width:100%;border-collapse:collapse;margin-bottom:10px}.info th{width:21%;background:${t.primary};color:white;text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase}.info td{background:${t.pale};padding:8px 10px;border:1px solid #dfd6df}.section-title{font-size:14px;color:${t.primary};font-weight:900;margin:12px 0 6px}.options,.summary{width:100%;border-collapse:collapse}.options th{background:${t.primary};color:#fff;padding:8px 10px;text-align:left;font-size:10px}.options td,.summary td{background:${t.pale};padding:9px 10px;border:1px solid #dfd6df}.summary th{background:${t.accent};color:#fff;padding:8px 10px;text-align:left;font-size:10px}.bullets{list-style:none;padding:0;margin:6px 0}.bullets li{margin:8px 0;line-height:1.45;padding-left:15px;position:relative}.bullets.check li:before{content:"✓";position:absolute;left:0;font-weight:900;color:${t.primary}}.bullets.dot li:before{content:"•";position:absolute;left:2px;color:${t.primary}}.footer{text-align:center;margin-top:18px;color:${t.primary};font-weight:900;font-size:11px}.footer-note{text-align:center;margin-top:10px;color:#796c7c;font-size:8.5px}.invalid-share{max-width:680px;margin:80px auto;background:#fff;border-radius:18px;padding:34px;text-align:center;box-shadow:0 16px 55px rgba(17,24,39,.12)}@media(max-width:820px){.sheet{margin:0;border-radius:0;box-shadow:none;padding:18px}.client-toolbar{position:static}.options,.summary{font-size:9px}.options th,.options td,.summary th,.summary td{padding:7px 5px}}@media print{body{background:#fff;font-size:10.5px}.client-toolbar{display:none!important}.sheet{max-width:none;margin:0;padding:0;box-shadow:none;border-radius:0}.title{font-size:24px}.section-title{margin-top:10px}.logo{height:66px}.options td,.summary td,.info td,.info th{padding:7px 9px}}
  </style></head><body>${toolbar}<main class="sheet"><div class="logo-wrap"><img class="logo" src="${logo}" alt="${escapeHTML(brandLabel(q.brand))}"></div><h1 class="title">COTIZACIÓN</h1><div class="subtitle">${escapeHTML(q.destination.toUpperCase())} · ${escapeHTML(quoteDateRangeUpper(q))}</div><table class="info"><tr><th>Destino</th><td>${escapeHTML(q.destination)}</td></tr><tr><th>Estancia</th><td>${escapeHTML(quoteStayText(q))}</td></tr><tr><th>Pasajeros</th><td>${escapeHTML(q.passengers)}</td></tr><tr><th>Habitaciones</th><td>${escapeHTML(q.rooms)}</td></tr></table><div class="section-title">OPCIONES DE HOSPEDAJE</div><table class="options"><thead><tr><th>HOTEL</th><th>PLAN</th><th>${escapeHTML(totalHead)}</th><th>${escapeHTML(depositLabel)}</th></tr></thead><tbody>${optionsRows}</tbody></table><div class="section-title">INCLUYE</div><ul class="bullets check">${q.includes.map(x => `<li>${escapeHTML(x)}</li>`).join("") || "<li>Servicios de acuerdo con la opción seleccionada.</li>"}</ul><div class="section-title">CONDICIONES DE RESERVACIÓN</div><ul class="bullets dot">${conditions.map(x => `<li>${escapeHTML(x)}</li>`).join("")}</ul><div class="section-title">RESUMEN DE INVERSIÓN</div><table class="summary"><thead><tr><th>OPCIÓN</th><th>TOTAL</th><th>${escapeHTML(depositLabel)}</th><th>SALDO</th></tr></thead><tbody>${summaryRows}</tbody></table><div class="footer">${escapeHTML(brandFooter)}</div><div class="footer-note">Cotización elaborada el ${escapeHTML(quoteDateLong.format(created))} · Precios sujetos a disponibilidad al momento de reservar.<br>${escapeHTML(q.folio)}</div></main></body></html>`;
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
  $("#newQuoteBtn")?.addEventListener("click", () => openQuoteModal());
  $("#quoteSearch")?.addEventListener("input", renderQuotes);
  $("#quoteStatusFilter")?.addEventListener("change", renderQuotes);
  $("#quoteForm")?.addEventListener("submit", saveQuoteFromForm);
  $("#addQuoteOptionBtn")?.addEventListener("click", () => { syncQuoteOptionDraft(); if (quoteOptionsDraft.length >= MAX_QUOTE_OPTIONS) return; quoteOptionsDraft.push(blankQuoteOption()); renderQuoteOptionsEditor(quoteOptionsDraft); });
  $("#quoteStart")?.addEventListener("change", () => { const start = $("#quoteStart").value; $("#quoteEnd").min = start || ""; if (start && (!$("#quoteEnd").value || $("#quoteEnd").value < start)) $("#quoteEnd").value = start; });
  $("#quoteBrand")?.addEventListener("change", () => {
    $("#quoteCrmLeadId").value = "";
    $("#quoteCustomerPhone").value = "";
    renderQuoteCustomerList();
  });
  $("#quoteCustomer")?.addEventListener("focus", renderQuoteCustomerList);
  $("#quoteCustomer")?.addEventListener("change", () => applyQuoteCustomerSelection());
  $("#quoteCustomer")?.addEventListener("input", () => {
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
