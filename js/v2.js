/* ================================================================
   Travel Ops by Nuve Works · v2.0
   Capa operativa interna inspirada en AVRA.
   Mantiene intacto el núcleo v1.8 y agrega:
   clientes, cotizaciones, reservas/expedientes, portal público,
   firma, documentos, reportes, buscador y cobranza por expediente.
   ================================================================ */

(() => {
  const V2_STORE = "travelops_v2_internal_2026_09";
  const V2_VIEWS = new Set(["clients", "quotes", "reservations", "documents", "reports"]);
  let publicPortalActive = false;
  let quoteDraftOptions = [];
  let shareQuoteId = "";
  let convertQuoteId = "";
  let shareReservationId = "";
  let detailReservationId = "";
  let activeDocumentType = "";

  state.clients ||= [];
  state.quotes ||= [];
  state.reservations ||= [];

  const coreHydrateFromSupabase = hydrateFromSupabase;
  const coreRenderAll = renderAll;
  const coreSwitchView = switchView;
  const coreShowMain = showMain;
  const coreShowLogin = showLogin;

  hydrateFromSupabase = async function () {
    await coreHydrateFromSupabase();
    await hydrateV2FromSupabase();
  };

  renderAll = function () {
    coreRenderAll();
    renderV2Dashboard();
    renderClientsV2();
    renderQuotesV2();
    renderReservationsV2();
    renderReservationPaymentsPanel();
    renderReservationBillingPanel();
    renderReportsV2();
    populateClientDatalists();
  };

  switchView = function (name) {
    if (!V2_VIEWS.has(name)) {
      return coreSwitchView(name);
    }

    $("#brandFilter").disabled = false;
    $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === name));
    $$(".view").forEach(v => v.classList.remove("active"));
    const target = $(`#${name}View`);
    if (target) target.classList.add("active");

    const labels = {
      clients: ["BASE COMPARTIDA", "Clientes"],
      quotes: ["VENTAS", "Cotizaciones"],
      reservations: ["EXPEDIENTES", "Reservas"],
      documents: ["DOCUMENTOS", "Documentos"],
      reports: ["ANÁLISIS INTERNO", "Reportes"]
    };
    $("#pageEyebrow").textContent = labels[name][0];
    $("#pageTitle").textContent = labels[name][1];

    if (name === "clients") renderClientsV2();
    if (name === "quotes") renderQuotesV2();
    if (name === "reservations") renderReservationsV2();
    if (name === "reports") renderReportsV2();
  };

  showMain = function () {
    if (publicPortalActive) return;
    if (!state.supabase) loadV2Demo();
    return coreShowMain();
  };

  showLogin = function () {
    if (publicPortalActive) return;
    return coreShowLogin();
  };

  function toastV2(title, text = "") {
    let box = $("#v2Toast");
    if (!box) {
      box = document.createElement("div");
      box.id = "v2Toast";
      box.className = "v2-toast";
      document.body.appendChild(box);
    }
    box.innerHTML = `<strong>${escapeHTML(title)}</strong>${text ? `<span>${escapeHTML(text)}</span>` : ""}`;
    box.classList.add("show");
    clearTimeout(box._timer);
    box._timer = setTimeout(() => box.classList.remove("show"), 3200);
  }

  function uuidToken() {
    return (globalThis.crypto?.randomUUID?.() || uid("shr")).replace(/-/g, "").slice(0, 24);
  }

  function codeFor(prefix) {
    const n = new Date();
    const ym = `${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, "0")}`;
    const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}-${ym}-${tail}`;
  }

  function fmtMoney(v) {
    return money.format(Number(v || 0));
  }

  function fmtDateV2(value) {
    if (!value) return "N/A";
    try { return dateFmt.format(parseDate(String(value).slice(0, 10))); }
    catch { return String(value); }
  }

  function fmtDateTimeV2(value) {
    if (!value) return "N/A";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
  }

  function brandNameV2(brand) {
    return brand === "pink" ? "Pink Sky Travel" : "Velora Travel";
  }

  function brandLogoUrl(brand) {
    return new URL(brandAsset(brand), location.href).href;
  }

  function paxCountV2(item) {
    return Number(item?.adults || 0) + Number(item?.minors || 0);
  }

  function quoteFinalPrice(q, option) {
    return Number(option?.salePrice || 0) + Number(q?.tourPrice || 0) + Number(q?.msi || 0);
  }

  function reservationPaid(r) {
    return (r?.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }

  function reservationBalance(r) {
    return Math.max(0, Number(r?.total || 0) - reservationPaid(r));
  }

  function filteredClientsV2() {
    return state.clients.filter(c => state.brand === "all" || c.brand === state.brand);
  }

  function filteredQuotesV2() {
    return state.quotes.filter(q => state.brand === "all" || q.brand === state.brand);
  }

  function filteredReservationsV2() {
    return state.reservations.filter(r => state.brand === "all" || r.brand === state.brand);
  }

  function findClientV2(id) { return state.clients.find(c => c.id === id); }
  function findQuoteV2(id) { return state.quotes.find(q => q.id === id); }
  function findReservationV2(id) { return state.reservations.find(r => r.id === id); }

  function findClientByNameV2(name, brand = "") {
    const key = normalizeAgencyName(name);
    return state.clients.find(c => (!brand || c.brand === brand) && normalizeAgencyName(c.name) === key);
  }

  function uniqueById(items) {
    const map = new Map();
    (items || []).forEach(x => x?.id && map.set(x.id, x));
    return [...map.values()];
  }

  function expectedPassengerCount(r) {
    return Math.max(1, paxCountV2(r));
  }

  function reservationPassengersComplete(r) {
    const list = uniqueById(r?.passengers || []);
    const expected = expectedPassengerCount(r);
    return list.length >= expected && list.slice(0, expected).every(p => p.first && p.last1 && p.birth);
  }

  function quoteExpired(q) {
    if (["aceptada", "convertida", "cancelada"].includes(q.status)) return false;
    return q.validUntil ? new Date(q.validUntil).getTime() < Date.now() : false;
  }

  function quoteHistoryState(q) {
    if (q.status === "convertida") return "Convertida";
    if (q.status === "cancelada") return "Cancelada";
    if (quoteExpired(q)) return "Caducada";
    return "";
  }

  function quoteStatusLabel(status) {
    return ({ borrador: "Por preparar", enviada: "Enviada", aceptada: "Aceptada", convertida: "Convertida", cancelada: "Cancelada" })[status] || status;
  }

  function reservationStatusLabel(status) {
    return ({ por_confirmar: "Por confirmar", confirmada: "Confirmada", cancelada: "Cancelada" })[status] || status;
  }

  function saveV2Demo() {
    if (state.supabase) return;
    try {
      localStorage.setItem(V2_STORE, JSON.stringify({ clients: state.clients, quotes: state.quotes, reservations: state.reservations }));
    } catch (err) {
      console.warn("Travel Ops v2: no se pudo guardar demo", err);
    }
  }

  function loadV2Demo() {
    if (state.supabase) return;
    try {
      const raw = localStorage.getItem(V2_STORE);
      if (!raw) return;
      const data = JSON.parse(raw);
      state.clients = Array.isArray(data.clients) ? data.clients : [];
      state.quotes = Array.isArray(data.quotes) ? data.quotes : [];
      state.reservations = Array.isArray(data.reservations) ? data.reservations : [];
    } catch (err) {
      console.warn("Travel Ops v2: no se pudo leer demo", err);
    }
  }

  async function hydrateV2FromSupabase() {
    if (!state.supabase) {
      loadV2Demo();
      return;
    }

    const results = await Promise.all([
      state.supabase.from("profiles").select("*"),
      state.supabase.from("clients").select("*").order("name"),
      state.supabase.from("quotes").select("*").order("created_at", { ascending: false }),
      state.supabase.from("quote_options").select("*").order("sort_order"),
      state.supabase.from("reservations").select("*").order("start_date"),
      state.supabase.from("passengers").select("*"),
      state.supabase.from("payments").select("*")
    ]);

    const errors = results.map(r => r.error).filter(Boolean);
    if (errors.length) {
      console.warn("Travel Ops v2: ejecuta migration_v2_0_avra_ops.sql", errors[0]);
      return;
    }

    const [profilesRes, clientsRes, quotesRes, optionsRes, reservationsRes, paxRes, paymentsRes] = results;
    const profiles = profilesRes.data || [];
    const actorMap = new Map(profiles.map(p => [p.id, { id: p.id, name: p.full_name || "Usuario", avatar: p.avatar_data_url || "" }]));
    const actorFor = id => actorMap.get(id) || (id ? { id, name: "Usuario", avatar: "" } : SYSTEM_ACTOR);

    state.clients = (clientsRes.data || []).map(c => ({
      id: c.id,
      brand: c.brand,
      type: c.client_type || "cliente",
      agencyId: c.agency_id || "",
      name: c.name,
      phone: c.phone || "",
      email: c.email || "",
      status: c.status || "activo",
      notes: c.notes || "",
      createdBy: actorFor(c.created_by),
      updatedBy: actorFor(c.updated_by || c.created_by),
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));

    const optionsByQuote = new Map();
    (optionsRes.data || []).forEach(o => {
      if (!optionsByQuote.has(o.quote_id)) optionsByQuote.set(o.quote_id, []);
      optionsByQuote.get(o.quote_id).push({
        id: o.id,
        order: Number(o.sort_order || 1),
        hotel: o.hotel_service || "",
        detail: o.detail || "",
        internalCost: Number(o.internal_cost || 0),
        salePrice: Number(o.sale_price || 0)
      });
    });

    state.quotes = (quotesRes.data || []).map(q => ({
      id: q.id,
      code: q.code,
      brand: q.brand,
      clientId: q.client_id || "",
      clientName: q.client_name,
      destination: q.destination,
      start: q.start_date,
      end: q.end_date,
      adults: Number(q.adults || 1),
      minors: Number(q.minors || 0),
      airline: q.airline || "",
      flightOut: q.flight_out || "",
      flightIn: q.flight_in || "",
      transfer: q.transfer_service || "",
      tour: q.tour_service || "",
      tourPrice: Number(q.tour_price || 0),
      msi: Number(q.msi_amount || 0),
      status: q.status || "borrador",
      validityHours: Number(q.validity_hours || 48),
      validUntil: q.valid_until || "",
      notes: q.notes || "",
      shareToken: q.share_token || "",
      convertedAt: q.converted_at || "",
      convertedReservationId: q.converted_reservation_id || "",
      createdBy: actorFor(q.created_by),
      updatedBy: actorFor(q.updated_by || q.created_by),
      createdAt: q.created_at,
      updatedAt: q.updated_at,
      options: (optionsByQuote.get(q.id) || []).sort((a, b) => a.order - b.order)
    }));

    const paxRows = paxRes.data || [];
    const payRows = paymentsRes.data || [];

    state.reservations = (reservationsRes.data || []).map(r => {
      const pax = uniqueById(paxRows
        .filter(p => p.reservation_id === r.id || (r.booking_id && p.booking_id === r.booking_id))
        .map(p => ({
          id: p.id,
          first: p.first_name || "",
          last1: p.last_name_1 || "",
          last2: p.last_name_2 || "",
          birth: p.birth_date || "",
          reservationId: p.reservation_id || "",
          bookingId: p.booking_id || "",
          createdBy: actorFor(p.created_by),
          updatedBy: actorFor(p.updated_by || p.created_by)
        })));

      const payments = uniqueById(payRows
        .filter(p => p.reservation_id === r.id || (r.booking_id && p.booking_id === r.booking_id))
        .map(p => ({
          id: p.id,
          amount: Number(p.amount || 0),
          paidOn: p.paid_on,
          method: p.method || "",
          reference: p.reference || "",
          notes: p.notes || "",
          reservationId: p.reservation_id || "",
          bookingId: p.booking_id || "",
          createdBy: actorFor(p.created_by),
          updatedBy: actorFor(p.updated_by || p.created_by)
        })));

      return {
        id: r.id,
        code: r.code,
        brand: r.brand,
        clientId: r.client_id || "",
        clientName: r.client_name,
        quoteId: r.quote_id || "",
        quoteOptionId: r.quote_option_id || "",
        departureId: r.departure_id || "",
        bookingId: r.booking_id || "",
        destination: r.destination,
        start: r.start_date,
        end: r.end_date,
        adults: Number(r.adults || 1),
        minors: Number(r.minors || 0),
        hotel: r.hotel_service || "",
        airline: r.airline || "",
        flightOut: r.flight_out || "",
        flightIn: r.flight_in || "",
        transfer: r.transfer_service || "",
        tour: r.tour_service || "",
        tourPrice: Number(r.tour_price || 0),
        internalCost: Number(r.internal_cost || 0),
        msi: Number(r.msi_amount || 0),
        total: Number(r.total_amount || 0),
        status: r.status || "confirmada",
        invoiceRequired: Boolean(r.invoice_required),
        billingStatus: r.billing_status || "no_solicitada",
        notes: r.notes || "",
        shareToken: r.share_token || "",
        signedBy: r.signed_by || "",
        signedAt: r.signed_at || "",
        signatureData: r.signature_data || "",
        acceptedTerms: Boolean(r.accepted_terms),
        clientConfirmedData: Boolean(r.client_confirmed_data),
        createdBy: actorFor(r.created_by),
        updatedBy: actorFor(r.updated_by || r.created_by),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        passengers: pax,
        payments
      };
    });
  }

  function renderV2Dashboard() {
    const box = $("#v2DashboardStrip");
    if (!box) return;
    const qs = filteredQuotesV2().filter(q => !quoteHistoryState(q));
    const rs = filteredReservationsV2().filter(r => r.status !== "cancelada");
    const pending = rs.reduce((n, r) => n + reservationBalance(r), 0);
    const unsigned = rs.filter(r => reservationPassengersComplete(r) && !r.signedAt).length;
    box.innerHTML = `
      <article class="stat-card compact-v2"><span>Cotizaciones activas</span><strong>${qs.length}</strong><small>En venta / seguimiento</small></article>
      <article class="stat-card compact-v2"><span>Expedientes</span><strong>${rs.length}</strong><small>Reservas activas</small></article>
      <article class="stat-card warning compact-v2"><span>Saldo expedientes</span><strong>${fmtMoney(pending)}</strong><small>Por cobrar</small></article>
      <article class="stat-card compact-v2"><span>Pendientes de firma</span><strong>${unsigned}</strong><small>Con pax completos</small></article>`;
  }

  function populateClientDatalists() {
    const list = $("#quoteClientListV2");
    if (list) list.innerHTML = filteredClientsV2().map(c => `<option value="${escapeHTML(c.name)}"></option>`).join("");
    const resList = $("#reservationClientListV2");
    if (resList) resList.innerHTML = filteredClientsV2().map(c => `<option value="${escapeHTML(c.name)}"></option>`).join("");
  }

  function renderClientsV2() {
    const body = $("#clientsBodyV2");
    if (!body) return;
    const q = ($("#clientSearchV2")?.value || "").trim().toLowerCase();
    const list = filteredClientsV2().filter(c => `${c.name} ${c.phone} ${c.email} ${c.notes}`.toLowerCase().includes(q));
    $("#clientCountV2").textContent = `${list.length} cliente${list.length === 1 ? "" : "s"}`;
    body.innerHTML = list.length ? list.map(c => {
      const reservations = state.reservations.filter(r => r.clientId === c.id || normalizeAgencyName(r.clientName) === normalizeAgencyName(c.name));
      const value = reservations.reduce((n, r) => n + Number(r.total || 0), 0);
      const paid = reservations.reduce((n, r) => n + reservationPaid(r), 0);
      return `<tr>
        <td><strong>${escapeHTML(c.name)}</strong><br><small>${c.type === "agencia" ? "Agencia" : "Cliente"} · ${brandNameV2(c.brand)}</small></td>
        <td>${escapeHTML(c.phone || "—")}<br><small>${escapeHTML(c.email || "—")}</small></td>
        <td>${reservations.length}</td>
        <td>${fmtMoney(value)}</td>
        <td>${fmtMoney(paid)}</td>
        <td><span class="status-chip neutral">${escapeHTML(c.status)}</span></td>
        <td><div class="row-actions"><button class="small-btn" data-edit-client-v2="${c.id}">Editar</button><button class="small-btn danger" data-delete-client-v2="${c.id}">Borrar</button></div></td>
      </tr>`;
    }).join("") : `<tr><td colspan="7"><div class="empty">No hay clientes para este filtro.</div></td></tr>`;

    $$('[data-edit-client-v2]', body).forEach(btn => btn.addEventListener("click", () => openClientModalV2(findClientV2(btn.dataset.editClientV2))));
    $$('[data-delete-client-v2]', body).forEach(btn => btn.addEventListener("click", () => deleteClientV2(btn.dataset.deleteClientV2)));
  }

  function openClientModalV2(client = null) {
    const f = $("#clientFormV2");
    f.reset();
    $("#clientIdV2").value = client?.id || "";
    $("#clientModalTitleV2").textContent = client ? "Editar cliente" : "Nuevo cliente";
    $("#clientBrandV2").value = client?.brand || (state.brand === "all" ? "velora" : state.brand);
    $("#clientTypeV2").value = client?.type || "cliente";
    $("#clientNameV2").value = client?.name || "";
    $("#clientPhoneV2").value = client?.phone || "";
    $("#clientEmailV2").value = client?.email || "";
    $("#clientStatusV2").value = client?.status || "activo";
    $("#clientNotesV2").value = client?.notes || "";
    $("#clientModalV2").showModal();
  }

  async function ensureClientV2(name, brand) {
    const clean = String(name || "").trim();
    if (!clean) return null;
    const existing = findClientByNameV2(clean, brand);
    if (existing) return existing;
    const actor = currentActor();
    const item = { id: uid("client"), brand, type: "cliente", agencyId: "", name: clean, phone: "", email: "", status: "prospecto", notes: "", createdBy: actor, updatedBy: actor };
    if (state.supabase) {
      const { data, error } = await state.supabase.from("clients").insert({
        brand, client_type: "cliente", name: clean, status: "prospecto", created_by: actor.id, updated_by: actor.id
      }).select().single();
      if (error) throw error;
      item.id = data.id;
    }
    state.clients.push(item);
    saveV2Demo();
    return item;
  }

  async function deleteClientV2(id) {
    const c = findClientV2(id);
    if (!c || !confirm(`¿Borrar a ${c.name} de Clientes? Las reservas y cotizaciones conservarán el nombre, pero quedarán sin vínculo a la ficha.`)) return;
    if (state.supabase) {
      const { error } = await state.supabase.from("clients").delete().eq("id", id);
      if (error) return alert(error.message);
    }
    state.clients = state.clients.filter(x => x.id !== id);
    state.quotes.forEach(q => { if (q.clientId === id) q.clientId = ""; });
    state.reservations.forEach(r => { if (r.clientId === id) r.clientId = ""; });
    await logAction("client", id, "deleted", { name: c.name });
    saveV2Demo();
    renderAll();
  }

  function blankQuoteOptionV2() {
    return { id: uid("qo"), hotel: "", detail: "", internalCost: 0, salePrice: 0 };
  }

  function quoteOptionEditorHTML(o, index) {
    return `<article class="quote-option-editor-v2" data-option-id="${escapeHTML(o.id || uid("qo"))}">
      <div class="quote-option-editor-head"><strong>Opción ${index + 1}</strong>${index ? `<button type="button" class="small-btn danger" data-remove-option-v2>Quitar</button>` : ""}</div>
      <div class="form-grid compact-grid-v2">
        <label class="full"><span>Hotel / servicio</span><input data-qopt-v2="hotel" required value="${escapeHTML(o.hotel || "")}" placeholder="Ej. Hotel Xcaret México" /></label>
        <label><span>Costo interno</span><input data-qopt-v2="internalCost" type="number" min="0" step="0.01" value="${Number(o.internalCost) || ""}" placeholder="Solo equipo" /></label>
        <label><span>Precio de venta</span><input data-qopt-v2="salePrice" type="number" min="0" step="0.01" required value="${Number(o.salePrice) || ""}" /></label>
        <label class="full"><span>Diferencia / detalle</span><input data-qopt-v2="detail" value="${escapeHTML(o.detail || "")}" placeholder="Todo incluido, tipo de habitación, condiciones..." /></label>
      </div>
    </article>`;
  }

  function renderQuoteOptionsEditorV2(options = [blankQuoteOptionV2()]) {
    quoteDraftOptions = options.slice(0, 3).map(o => ({ ...blankQuoteOptionV2(), ...o, id: o.id || uid("qo") }));
    const wrap = $("#quoteOptionsEditorV2");
    wrap.innerHTML = quoteDraftOptions.map(quoteOptionEditorHTML).join("");
    $("#addQuoteOptionBtnV2").disabled = quoteDraftOptions.length >= 3;
    $$('[data-remove-option-v2]', wrap).forEach(btn => btn.addEventListener("click", () => {
      const card = btn.closest(".quote-option-editor-v2");
      const next = collectQuoteOptionsV2().filter(o => o.id !== card.dataset.optionId);
      renderQuoteOptionsEditorV2(next.length ? next : [blankQuoteOptionV2()]);
      updateQuoteInternalSummary();
    }));
    $$('[data-qopt-v2]', wrap).forEach(input => input.addEventListener("input", updateQuoteInternalSummary));
    updateQuoteInternalSummary();
  }

  function readQuoteOptionV2(card) {
    return {
      id: card.dataset.optionId || uid("qo"),
      hotel: card.querySelector('[data-qopt-v2="hotel"]').value.trim(),
      internalCost: Number(card.querySelector('[data-qopt-v2="internalCost"]').value || 0),
      salePrice: Number(card.querySelector('[data-qopt-v2="salePrice"]').value || 0),
      detail: card.querySelector('[data-qopt-v2="detail"]').value.trim()
    };
  }

  function collectQuoteOptionsV2() {
    return $$(".quote-option-editor-v2", $("#quoteOptionsEditorV2")).map(readQuoteOptionV2);
  }

  function updateQuoteInternalSummary() {
    const box = $("#quoteInternalSummaryV2");
    if (!box) return;
    const tour = Number($("#quoteTourPriceV2")?.value || 0);
    const msi = Number($("#quoteMsiV2")?.value || 0);
    const opts = collectQuoteOptionsV2();
    box.innerHTML = opts.map((o, i) => {
      const final = Number(o.salePrice || 0) + tour + msi;
      const margin = final - Number(o.internalCost || 0);
      return `<div><span>Opción ${i + 1}</span><strong>${fmtMoney(final)}</strong><small>Costo ${fmtMoney(o.internalCost)} · margen ${fmtMoney(margin)}</small></div>`;
    }).join("") || "";
  }

  function openQuoteModalV2(q = null) {
    const f = $("#quoteFormV2");
    f.reset();
    $("#quoteIdV2").value = q?.id || "";
    $("#quoteModalTitleV2").textContent = q ? "Editar cotización" : "Nueva cotización";
    $("#quoteBrandV2").value = q?.brand || (state.brand === "all" ? "velora" : state.brand);
    $("#quoteClientV2").value = q?.clientName || "";
    $("#quoteDestinationV2").value = q?.destination || "";
    $("#quoteStartV2").value = q?.start || "";
    $("#quoteEndV2").value = q?.end || "";
    $("#quoteAdultsV2").value = q?.adults ?? 2;
    $("#quoteMinorsV2").value = q?.minors ?? 0;
    $("#quoteAirlineV2").value = q?.airline || "";
    $("#quoteFlightOutV2").value = localDateTimeValue(q?.flightOut);
    $("#quoteFlightInV2").value = localDateTimeValue(q?.flightIn);
    $("#quoteTransferV2").value = q?.transfer || "";
    $("#quoteTourV2").value = q?.tour || "";
    $("#quoteTourPriceV2").value = q?.tourPrice || "";
    $("#quoteMsiV2").value = q?.msi || "";
    $("#quoteStatusV2").value = q?.status || "borrador";
    $("#quoteValidityV2").value = String(q?.validityHours || 48);
    $("#quoteNotesV2").value = q?.notes || "";
    $("#quoteEndV2").min = $("#quoteStartV2").value || "";
    renderQuoteOptionsEditorV2(q?.options?.length ? q.options : [blankQuoteOptionV2()]);
    $("#quoteModalV2").showModal();
  }

  function localDateTimeValue(value) {
    if (!value) return "";
    const s = String(value);
    return s.length >= 16 ? s.slice(0, 16) : s;
  }

  function renderQuotesV2() {
    const wrap = $("#quotesBoardV2");
    if (!wrap) return;
    const all = filteredQuotesV2();
    const active = all.filter(q => !quoteHistoryState(q));
    const history = all.filter(q => quoteHistoryState(q));
    const columns = ["borrador", "enviada", "aceptada"];
    wrap.innerHTML = columns.map(status => {
      const items = active.filter(q => q.status === status);
      return `<section class="quote-column-v2"><div class="quote-column-head"><strong>${quoteStatusLabel(status)}</strong><span>${items.length}</span></div>${items.length ? items.map(quoteCardHTML).join("") : `<div class="empty compact-empty">Sin cotizaciones</div>`}</section>`;
    }).join("");
    $("#quoteHistoryCountV2").textContent = history.length;
    $("#quoteHistoryBodyV2").innerHTML = history.length ? history.map(q => `<tr>
      <td><strong>${escapeHTML(q.clientName)}</strong></td><td>${escapeHTML(q.destination)}</td><td>${fmtDateV2(q.start)} → ${fmtDateV2(q.end)}</td><td>${quotePriceRange(q)}</td><td>${quoteHistoryState(q)}</td><td><div class="row-actions">${quoteHistoryState(q) === "Caducada" ? `<button class="small-btn" data-reactivate-quote-v2="${q.id}">Reactivar</button>` : ""}${q.convertedReservationId ? `<button class="small-btn" data-open-converted-res-v2="${q.convertedReservationId}">Ver reserva</button>` : ""}</div></td>
    </tr>`).join("") : `<tr><td colspan="6"><div class="empty">Historial vacío.</div></td></tr>`;

    bindQuoteActions(wrap);
    $$('[data-reactivate-quote-v2]', $("#quoteHistoryBodyV2")).forEach(btn => btn.addEventListener("click", () => reactivateQuoteV2(btn.dataset.reactivateQuoteV2)));
    $$('[data-open-converted-res-v2]', $("#quoteHistoryBodyV2")).forEach(btn => btn.addEventListener("click", () => { switchView("reservations"); openReservationDetailV2(btn.dataset.openConvertedResV2); }));
  }

  function quotePriceRange(q) {
    const prices = (q.options || []).map(o => quoteFinalPrice(q, o));
    if (!prices.length) return fmtMoney(0);
    const min = Math.min(...prices), max = Math.max(...prices);
    return min === max ? fmtMoney(min) : `${fmtMoney(min)} — ${fmtMoney(max)}`;
  }

  function quoteCardHTML(q) {
    return `<article class="quote-card-v2">
      <div class="quote-card-head"><span>${escapeHTML(q.code)}</span>${brandChipHTML(q.brand, true)}</div>
      <strong>${escapeHTML(q.clientName)}</strong>
      <h4>${escapeHTML(q.destination)}</h4>
      <small>${fmtDateV2(q.start)} → ${fmtDateV2(q.end)} · ${paxCountV2(q)} pax</small>
      <div class="quote-option-preview-v2">${(q.options || []).map((o, i) => `<div><span>${i + 1}. ${escapeHTML(o.hotel)}</span><b>${fmtMoney(quoteFinalPrice(q, o))}</b></div>`).join("")}</div>
      <div class="quote-card-foot"><strong>${quotePriceRange(q)}</strong><small>${q.validUntil ? `Vence ${new Date(q.validUntil).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}` : "Sin vigencia"}</small></div>
      <div class="row-actions quote-card-actions"><button class="small-btn" data-edit-quote-v2="${q.id}">Editar</button><button class="small-btn" data-share-quote-v2="${q.id}">Enviar</button><button class="small-btn" data-convert-quote-v2="${q.id}">Pasar a reserva</button></div>
    </article>`;
  }

  function bindQuoteActions(root) {
    $$('[data-edit-quote-v2]', root).forEach(btn => btn.addEventListener("click", () => openQuoteModalV2(findQuoteV2(btn.dataset.editQuoteV2))));
    $$('[data-share-quote-v2]', root).forEach(btn => btn.addEventListener("click", () => openShareQuoteV2(btn.dataset.shareQuoteV2)));
    $$('[data-convert-quote-v2]', root).forEach(btn => btn.addEventListener("click", () => startQuoteConversionV2(btn.dataset.convertQuoteV2)));
  }

  async function reactivateQuoteV2(id) {
    const q = findQuoteV2(id); if (!q) return;
    q.status = "borrador";
    q.validUntil = new Date(Date.now() + Number(q.validityHours || 48) * 3600000).toISOString();
    if (state.supabase) {
      const { error } = await state.supabase.from("quotes").update({ status: q.status, valid_until: q.validUntil, updated_by: state.user.id }).eq("id", id);
      if (error) return alert(error.message);
      await hydrateV2FromSupabase();
    } else saveV2Demo();
    renderAll();
  }

  async function openShareQuoteV2(id) {
    const q = findQuoteV2(id); if (!q) return;
    if (!state.supabase) return toastV2("Enlace no disponible en demo", "Los enlaces públicos requieren Supabase.");
    if (!q.shareToken) q.shareToken = uuidToken();
    if (q.status === "borrador") q.status = "enviada";
    const { error } = await state.supabase.from("quotes").update({ share_token: q.shareToken, status: q.status, updated_by: state.user.id }).eq("id", q.id);
    if (error) return alert(error.message);
    shareQuoteId = q.id;
    const url = publicLink("quote", q.id, q.shareToken);
    $("#shareQuoteLinkV2").value = url;
    $("#shareQuoteMetaV2").innerHTML = `<strong>${escapeHTML(q.clientName)} · ${escapeHTML(q.destination)}</strong><small>${q.options.length} opción${q.options.length === 1 ? "" : "es"} · el cliente solo verá el precio final.</small>`;
    $("#shareQuoteModalV2").showModal();
    renderQuotesV2();
  }

  function startQuoteConversionV2(id) {
    const q = findQuoteV2(id); if (!q || !q.options?.length) return;
    if (q.options.length === 1) return convertQuoteOptionV2(q, q.options[0]);
    convertQuoteId = q.id;
    $("#quoteConvertChoicesV2").innerHTML = q.options.map((o, i) => `<button type="button" class="quote-choice-v2" data-quote-option-choice-v2="${o.id}"><span>Opción ${i + 1}</span><strong>${escapeHTML(o.hotel)}</strong><small>${escapeHTML(o.detail || "Sin detalle adicional")}</small><b>${fmtMoney(quoteFinalPrice(q, o))}</b></button>`).join("");
    $("#quoteConvertModalV2").showModal();
  }

  function convertQuoteOptionV2(q, o) {
    $("#quoteConvertModalV2")?.close();
    openReservationModalV2(null, {
      quoteId: q.id,
      quoteOptionId: o.id,
      brand: q.brand,
      clientId: q.clientId,
      clientName: q.clientName,
      destination: q.destination,
      start: q.start,
      end: q.end,
      adults: q.adults,
      minors: q.minors,
      hotel: o.hotel,
      airline: q.airline,
      flightOut: q.flightOut,
      flightIn: q.flightIn,
      transfer: q.transfer,
      tour: q.tour,
      tourPrice: q.tourPrice,
      internalCost: Number(o.internalCost || 0),
      msi: Number(q.msi || 0),
      total: quoteFinalPrice(q, o),
      notes: [o.detail, q.notes].filter(Boolean).join(" · ")
    });
  }

  function populateDepartureSelectV2(brand, selected = "") {
    const select = $("#reservationDepartureV2");
    if (!select) return;
    const deps = state.departures.filter(d => d.brand === brand).sort((a, b) => a.start.localeCompare(b.start));
    select.innerHTML = `<option value="">Reserva independiente / sin salida grupal</option>${deps.map(d => `<option value="${d.id}" ${d.id === selected ? "selected" : ""}>${escapeHTML(d.destination)} · ${fmtDateV2(d.start)} → ${fmtDateV2(d.end)}</option>`).join("")}`;
  }

  function openReservationModalV2(r = null, draft = null) {
    const src = r || draft || {};
    const f = $("#reservationFormV2");
    f.reset();
    $("#reservationIdV2").value = r?.id || "";
    $("#reservationSourceQuoteV2").value = src.quoteId || "";
    $("#reservationSourceOptionV2").value = src.quoteOptionId || "";
    $("#reservationModalTitleV2").textContent = r ? "Editar reserva" : "Nueva reserva";
    $("#reservationBrandV2").value = src.brand || (state.brand === "all" ? "velora" : state.brand);
    $("#reservationClientV2").value = src.clientName || "";
    populateDepartureSelectV2($("#reservationBrandV2").value, src.departureId || "");
    $("#reservationDestinationV2").value = src.destination || "";
    $("#reservationStartV2").value = src.start || "";
    $("#reservationEndV2").value = src.end || "";
    $("#reservationAdultsV2").value = src.adults ?? 2;
    $("#reservationMinorsV2").value = src.minors ?? 0;
    $("#reservationHotelV2").value = src.hotel || "";
    $("#reservationAirlineV2").value = src.airline || "";
    $("#reservationFlightOutV2").value = localDateTimeValue(src.flightOut);
    $("#reservationFlightInV2").value = localDateTimeValue(src.flightIn);
    $("#reservationTransferV2").value = src.transfer || "";
    $("#reservationTourV2").value = src.tour || "";
    $("#reservationTourPriceV2").value = src.tourPrice || "";
    $("#reservationInternalCostV2").value = src.internalCost || "";
    $("#reservationMsiV2").value = src.msi || "";
    $("#reservationTotalV2").value = src.total || "";
    $("#reservationStatusV2").value = src.status || "confirmada";
    $("#reservationInvoiceRequiredV2").value = String(Boolean(src.invoiceRequired));
    $("#reservationBillingStatusV2").value = src.billingStatus || "no_solicitada";
    $("#reservationNotesV2").value = src.notes || "";
    $("#reservationEndV2").min = $("#reservationStartV2").value || "";
    $("#reservationModalV2").showModal();
  }

  function renderReservationsV2() {
    const wrap = $("#reservationsListV2");
    if (!wrap) return;
    const q = ($("#reservationSearchV2")?.value || "").trim().toLowerCase();
    const list = filteredReservationsV2().filter(r => `${r.code} ${r.clientName} ${r.destination} ${r.hotel}`.toLowerCase().includes(q)).sort((a, b) => String(a.start).localeCompare(String(b.start)));
    wrap.innerHTML = list.length ? list.map(r => {
      const paid = reservationPaid(r), balance = reservationBalance(r);
      const paxOk = reservationPassengersComplete(r);
      return `<button class="reservation-card-v2" type="button" data-reservation-v2="${r.id}">
        <div class="reservation-card-route-v2"><span class="reservation-plane-v2">✈</span><div><small>${escapeHTML(r.code)}</small><h3>${escapeHTML(r.destination)}</h3><span>${fmtDateV2(r.start)} → ${fmtDateV2(r.end)} · ${paxCountV2(r)} pax</span></div></div>
        <div class="reservation-card-meta-v2"><span>${escapeHTML(r.clientName)}</span><span>${escapeHTML(r.hotel || "Sin hotel")}</span><div class="reservation-flags-v2"><span class="status-chip ${r.status === "cancelada" ? "danger" : "paid"}">${reservationStatusLabel(r.status)}</span>${balance > 0 ? `<span class="status-chip pending">Saldo ${fmtMoney(balance)}</span>` : `<span class="status-chip paid">Pagada</span>`}${paxOk ? `<span class="status-chip neutral">Pax completos</span>` : `<span class="status-chip pending">Faltan pax</span>`}${r.signedAt ? `<span class="status-chip paid">Firmada</span>` : ""}</div></div>
      </button>`;
    }).join("") : `<div class="empty">No hay reservas / expedientes.</div>`;
    $$('[data-reservation-v2]', wrap).forEach(btn => btn.addEventListener("click", () => openReservationDetailV2(btn.dataset.reservationV2)));
  }

  function passengerListHTMLV2(r) {
    const list = uniqueById(r.passengers || []);
    return list.length ? `<div class="passenger-summary-v2">${list.map((p, i) => `<div><span><b>${i + 1}. ${escapeHTML(fullName(p))}</b><small>${fmtDateV2(p.birth)}</small></span></div>`).join("")}</div>` : `<div class="empty compact-empty">Todavía no hay pasajeros capturados.</div>`;
  }

  function paymentListHTMLV2(r) {
    const list = [...(r.payments || [])].sort((a, b) => String(b.paidOn).localeCompare(String(a.paidOn)));
    return list.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Referencia</th><th></th></tr></thead><tbody>${list.map(p => `<tr><td>${fmtDateV2(p.paidOn)}</td><td><strong>${fmtMoney(p.amount)}</strong></td><td>${escapeHTML(p.method || "—")}</td><td>${escapeHTML(p.reference || "—")}</td><td><div class="row-actions"><button class="small-btn" data-edit-res-payment-v2="${p.id}">Editar</button><button class="small-btn danger" data-delete-res-payment-v2="${p.id}">Borrar</button></div></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty compact-empty">Sin pagos registrados.</div>`;
  }

  function openReservationDetailV2(id) {
    const r = findReservationV2(id); if (!r) return;
    detailReservationId = id;
    const paid = reservationPaid(r), balance = reservationBalance(r);
    $("#reservationDetailTitleV2").textContent = `${r.code} · ${r.destination}`;
    $("#reservationDetailBrandV2").innerHTML = brandChipHTML(r.brand);
    $("#reservationDetailMetaV2").textContent = `${r.clientName} · ${fmtDateV2(r.start)} → ${fmtDateV2(r.end)}`;
    $("#reservationDetailContentV2").innerHTML = `
      <div class="detail-summary"><div class="summary-box"><span>Total</span><strong>${fmtMoney(r.total)}</strong></div><div class="summary-box"><span>Pagado</span><strong>${fmtMoney(paid)}</strong></div><div class="summary-box"><span>Saldo</span><strong>${fmtMoney(balance)}</strong></div><div class="summary-box"><span>Firma</span><strong>${r.signedAt ? "Confirmada" : "Pendiente"}</strong></div></div>
      <section class="reservation-detail-grid-v2">
        <article class="panel detail-block-v2"><div class="panel-head"><div><span class="eyebrow">SERVICIOS</span><h3>Viaje</h3></div></div><div class="service-grid-v2"><div><small>Hotel</small><strong>${escapeHTML(r.hotel || "N/A")}</strong></div><div><small>Aerolínea</small><strong>${escapeHTML(r.airline || "N/A")}</strong></div><div><small>Vuelo salida</small><strong>${escapeHTML(fmtDateTimeV2(r.flightOut))}</strong></div><div><small>Vuelo regreso</small><strong>${escapeHTML(fmtDateTimeV2(r.flightIn))}</strong></div><div><small>Traslado</small><strong>${escapeHTML(r.transfer || "N/A")}</strong></div><div><small>Tour / actividad</small><strong>${escapeHTML(r.tour || "N/A")}</strong></div><div><small>Salida asociada</small><strong>${r.departureId ? escapeHTML(findDeparture(r.departureId)?.destination || "Sí") : "Independiente"}</strong></div><div><small>Factura</small><strong>${r.invoiceRequired ? invoiceStatusLabel(r.billingStatus) : "No requerida"}</strong></div></div></article>
        <article class="panel detail-block-v2"><div class="panel-head"><div><span class="eyebrow">INTERNO</span><h3>Rentabilidad</h3></div></div><div class="service-grid-v2"><div><small>Costo interno</small><strong>${fmtMoney(r.internalCost)}</strong></div><div><small>MSI / cargo interno</small><strong>${fmtMoney(r.msi)}</strong></div><div><small>Venta final</small><strong>${fmtMoney(r.total)}</strong></div><div><small>Margen estimado</small><strong>${fmtMoney(Number(r.total) - Number(r.internalCost))}</strong></div></div><p class="muted-toolbar">Estos datos nunca aparecen en el link del cliente.</p></article>
      </section>
      <section class="panel detail-block-v2"><div class="panel-head"><div><span class="eyebrow">PASAJEROS</span><h3>${uniqueById(r.passengers).length}/${expectedPassengerCount(r)} capturados</h3></div><button class="small-btn" id="detailPaxBtnV2">${reservationPassengersComplete(r) ? "Editar pasajeros" : "Capturar pasajeros"}</button></div>${passengerListHTMLV2(r)}</section>
      <section class="panel detail-block-v2"><div class="panel-head"><div><span class="eyebrow">COBRANZA</span><h3>Pagos</h3></div><button class="small-btn" id="detailPaymentBtnV2">+ Registrar pago</button></div>${paymentListHTMLV2(r)}</section>
      <section class="panel detail-block-v2"><div class="panel-head"><div><span class="eyebrow">CONFIRMACIÓN</span><h3>${r.signedAt ? "Reserva firmada" : "Pendiente de firma"}</h3></div></div>${r.signedAt ? `<p>Firmada por <strong>${escapeHTML(r.signedBy)}</strong> el ${new Date(r.signedAt).toLocaleString("es-MX")}.</p>` : `<p class="muted-toolbar">Cuando los pasajeros estén completos puedes enviar el link para revisión, aceptación de términos y firma.</p>`}</section>`;

    $("#editReservationBtnV2").onclick = () => { $("#reservationDetailModalV2").close(); openReservationModalV2(r); };
    $("#deleteReservationBtnV2").onclick = () => deleteReservationV2(r.id);
    $("#shareReservationBtnV2").onclick = () => openShareReservationV2(r.id);
    $("#detailPaxBtnV2").onclick = () => openReservationPassengerModalV2(r.id);
    $("#detailPaymentBtnV2").onclick = () => openReservationPaymentModalV2(r.id);
    $$('[data-edit-res-payment-v2]', $("#reservationDetailContentV2")).forEach(btn => btn.addEventListener("click", () => openReservationPaymentModalV2(r.id, btn.dataset.editResPaymentV2)));
    $$('[data-delete-res-payment-v2]', $("#reservationDetailContentV2")).forEach(btn => btn.addEventListener("click", () => deleteReservationPaymentV2(r.id, btn.dataset.deleteResPaymentV2)));
    $("#reservationDetailModalV2").showModal();
  }

  async function deleteReservationV2(id) {
    const r = findReservationV2(id);
    if (!r || !confirm(`¿Borrar el expediente ${r.code} de ${r.clientName}? Esto elimina pasajeros y pagos vinculados al expediente. Si está asociado a una salida, la reserva operativa se conserva para no romper el rooming.`)) return;
    if (state.supabase) {
      const { error } = await state.supabase.from("reservations").delete().eq("id", id);
      if (error) return alert(error.message);
      await hydrateV2FromSupabase();
    } else {
      state.reservations = state.reservations.filter(x => x.id !== id);
      saveV2Demo();
    }
    await logAction("reservation", id, "deleted", { code: r.code, client: r.clientName });
    $("#reservationDetailModalV2")?.close();
    renderAll();
  }

  function openReservationPassengerModalV2(id) {
    const r = findReservationV2(id); if (!r) return;
    $("#reservationPassengerFormV2").dataset.reservationId = id;
    $("#reservationPassengerSubtitleV2").textContent = `${r.code} · ${r.clientName} · ${paxCountV2(r)} pax`;
    const existing = uniqueById(r.passengers || []);
    const total = expectedPassengerCount(r);
    const rows = [];
    for (let i = 0; i < total; i++) {
      const old = existing[i] || {};
      const type = i < Number(r.adults || 0) ? "Adulto" : "Menor";
      rows.push(`<div class="passenger-editor-row-v2" data-passenger-id="${escapeHTML(old.id || "")}"><span class="passenger-number-v2">${i + 1}</span><label><span>Tipo</span><input value="${type}" readonly /></label><label><span>Nombre(s)</span><input data-pax-v2="first" value="${escapeHTML(old.first || "")}" required /></label><label><span>Apellido paterno</span><input data-pax-v2="last1" value="${escapeHTML(old.last1 || "")}" required /></label><label><span>Apellido materno</span><input data-pax-v2="last2" value="${escapeHTML(old.last2 || "")}" /></label><label><span>Fecha de nacimiento</span><input data-pax-v2="birth" type="date" value="${escapeHTML(old.birth || "")}" required /></label></div>`);
    }
    $("#reservationPassengerEditorV2").innerHTML = rows.join("");
    $("#reservationPassengerModalV2").showModal();
  }

  function openReservationPaymentModalV2(reservationId, paymentId = "") {
    const r = findReservationV2(reservationId); if (!r) return;
    const p = (r.payments || []).find(x => x.id === paymentId);
    $("#reservationPaymentFormV2").dataset.reservationId = reservationId;
    $("#reservationPaymentIdV2").value = paymentId;
    $("#reservationPaymentTitleV2").textContent = p ? "Editar pago" : "Registrar pago";
    $("#reservationPaymentMetaV2").textContent = `${r.code} · ${r.clientName} · saldo ${fmtMoney(reservationBalance(r) + Number(p?.amount || 0))}`;
    $("#reservationPaymentAmountV2").value = p?.amount || "";
    $("#reservationPaymentDateV2").value = p?.paidOn || new Date().toISOString().slice(0, 10);
    $("#reservationPaymentMethodV2").value = p?.method || "Transferencia";
    $("#reservationPaymentReferenceV2").value = p?.reference || "";
    $("#reservationPaymentNotesV2").value = p?.notes || "";
    $("#reservationPaymentModalV2").showModal();
  }

  async function deleteReservationPaymentV2(reservationId, paymentId) {
    const r = findReservationV2(reservationId); const p = r?.payments.find(x => x.id === paymentId);
    if (!r || !p || !confirm(`¿Borrar el pago de ${fmtMoney(p.amount)}?`)) return;
    if (state.supabase) {
      const { error } = await state.supabase.from("payments").delete().eq("id", paymentId);
      if (error) return alert(error.message);
      if (r.bookingId) await syncBookingPaidAmount(r.bookingId);
      await hydrateFromSupabase();
    } else {
      r.payments = r.payments.filter(x => x.id !== paymentId);
      saveV2Demo();
    }
    await logAction("reservation_payment", paymentId, "deleted", { reservation: r.code, amount: p.amount });
    renderAll();
    openReservationDetailV2(reservationId);
  }

  async function syncBookingPaidAmount(bookingId) {
    if (!state.supabase || !bookingId) return;
    const { data } = await state.supabase.from("payments").select("amount").eq("booking_id", bookingId);
    const total = (data || []).reduce((n, p) => n + Number(p.amount || 0), 0);
    await state.supabase.from("bookings").update({ paid_amount: total, updated_by: state.user.id }).eq("id", bookingId);
  }

  function renderReservationPaymentsPanel() {
    const panel = $("#reservationPaymentsPanel");
    if (!panel) return;
    const rows = filteredReservationsV2().filter(r => r.status !== "cancelada");
    panel.innerHTML = `<div class="panel-head"><div><span class="eyebrow">EXPEDIENTES</span><h3>Cobranza por reserva</h3></div></div><div class="table-wrap"><table><thead><tr><th>Reserva</th><th>Cliente</th><th>Destino</th><th>Total</th><th>Pagado</th><th>Saldo</th><th></th></tr></thead><tbody>${rows.length ? rows.map(r => `<tr><td>${escapeHTML(r.code)}</td><td>${escapeHTML(r.clientName)}</td><td>${escapeHTML(r.destination)}</td><td>${fmtMoney(r.total)}</td><td>${fmtMoney(reservationPaid(r))}</td><td><strong>${fmtMoney(reservationBalance(r))}</strong></td><td><button class="small-btn" data-open-payment-res-v2="${r.id}">Gestionar</button></td></tr>`).join("") : `<tr><td colspan="7"><div class="empty">Sin expedientes.</div></td></tr>`}</tbody></table></div>`;
    $$('[data-open-payment-res-v2]', panel).forEach(btn => btn.addEventListener("click", () => openReservationDetailV2(btn.dataset.openPaymentResV2)));
  }

  function renderReservationBillingPanel() {
    const panel = $("#reservationBillingPanel");
    if (!panel) return;
    const rows = filteredReservationsV2().filter(r => r.status !== "cancelada" && !r.bookingId);
    panel.innerHTML = `<div class="panel-head"><div><span class="eyebrow">RESERVAS INDEPENDIENTES</span><h3>Facturación de expedientes sin salida</h3></div></div><div class="table-wrap"><table><thead><tr><th>Reserva</th><th>Cliente</th><th>Marca</th><th>¿Factura?</th><th>Estatus</th><th></th></tr></thead><tbody>${rows.length ? rows.map(r => `<tr><td>${escapeHTML(r.code)}</td><td>${escapeHTML(r.clientName)}</td><td>${brandChipHTML(r.brand, true)}</td><td>${r.invoiceRequired ? "Sí" : "No"}</td><td>${invoiceStatusLabel(r.billingStatus)}</td><td><button class="small-btn" data-edit-billing-res-v2="${r.id}">Editar</button></td></tr>`).join("") : `<tr><td colspan="6"><div class="empty">Sin reservas independientes.</div></td></tr>`}</tbody></table></div>`;
    $$('[data-edit-billing-res-v2]', panel).forEach(btn => btn.addEventListener("click", () => openReservationModalV2(findReservationV2(btn.dataset.editBillingResV2))));
  }

  async function openShareReservationV2(id) {
    const r = findReservationV2(id); if (!r) return;
    if (!reservationPassengersComplete(r)) return toastV2("Faltan pasajeros", "Captura nombre completo y fecha de nacimiento antes de compartir la confirmación.");
    if (!state.supabase) return toastV2("Enlace no disponible en demo", "Los enlaces públicos requieren Supabase.");
    if (!r.shareToken) r.shareToken = uuidToken();
    const { error } = await state.supabase.from("reservations").update({ share_token: r.shareToken, updated_by: state.user.id }).eq("id", r.id);
    if (error) return alert(error.message);
    shareReservationId = id;
    const url = publicLink("reservation", r.id, r.shareToken);
    $("#shareReservationLinkV2").value = url;
    const phase = r.signedAt ? "Estado de cuenta" : "Confirmación y firma";
    $("#shareReservationMetaV2").innerHTML = `<strong>${phase} · ${escapeHTML(r.clientName)}</strong><small>${escapeHTML(r.destination)} · saldo ${fmtMoney(reservationBalance(r))}</small>`;
    $("#shareReservationModalV2").showModal();
  }

  function publicLink(type, id, token) {
    const u = new URL(location.href);
    u.search = "";
    u.hash = "";
    u.searchParams.set(type === "quote" ? "quote" : "reservation", id);
    u.searchParams.set("token", token);
    return u.href;
  }

  async function copyInputValue(inputId) {
    const input = $(inputId);
    if (!input) return;
    try { await navigator.clipboard.writeText(input.value); }
    catch { input.select(); document.execCommand("copy"); }
    toastV2("Enlace copiado");
  }

  function whatsappUrl(phone, text) {
    let digits = String(phone || "").replace(/\D/g, "");
    if (digits.length === 10) digits = `52${digits}`;
    return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : "";
  }

  function openWhatsAppV2(client, text) {
    const url = whatsappUrl(client?.phone, text);
    if (!url) return toastV2("Sin WhatsApp", "Agrega un teléfono en la ficha del cliente.");
    window.open(url, "_blank", "noopener");
  }

  function openEmailV2(client, subject, body) {
    if (!client?.email) return toastV2("Sin correo", "Agrega un correo en la ficha del cliente.");
    location.href = `mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function brandTerms(brand) {
    const agency = brandNameV2(brand);
    return [
      `La disponibilidad y tarifas de los servicios quedan sujetas a confirmación de ${agency} y de cada proveedor.`,
      "Los nombres y fechas de nacimiento deben coincidir con la documentación oficial utilizada para viajar.",
      "Cambios, cancelaciones, no show y reembolsos se sujetan a las políticas de cada proveedor y a las condiciones informadas por la agencia.",
      "El cliente es responsable de contar con identificaciones, pasaporte, visas, permisos y demás documentación requerida para el viaje.",
      "Los pagos registrados en el estado de cuenta corresponden únicamente a movimientos confirmados por la agencia.",
      "La firma electrónica confirma la revisión de los datos del viaje, pasajeros, importes y condiciones mostradas en este enlace."
    ];
  }

  function renderReportsV2() {
    const root = $("#reportSummaryV2");
    if (!root) return;
    const month = $("#reportMonthV2")?.value || new Date().toISOString().slice(0, 7);
    const rs = filteredReservationsV2().filter(r => r.status !== "cancelada" && String(r.start || "").startsWith(month));
    const qs = filteredQuotesV2().filter(q => String(q.start || "").startsWith(month));
    const sales = rs.reduce((n, r) => n + Number(r.total || 0), 0);
    const paid = rs.reduce((n, r) => n + reservationPaid(r), 0);
    const cost = rs.reduce((n, r) => n + Number(r.internalCost || 0), 0);
    const converted = qs.filter(q => q.status === "convertida").length;
    const rate = qs.length ? converted / qs.length * 100 : 0;
    root.innerHTML = `<article class="report-card-v2 primary"><span>Ventas</span><strong>${fmtMoney(sales)}</strong><small>${rs.length} reservas en ${escapeHTML(month)}</small></article><article class="report-card-v2"><span>Cobrado</span><strong>${fmtMoney(paid)}</strong><small>Saldo ${fmtMoney(sales - paid)}</small></article><article class="report-card-v2"><span>Margen estimado</span><strong>${fmtMoney(sales - cost)}</strong><small>Costo interno ${fmtMoney(cost)}</small></article><article class="report-card-v2"><span>Conversión</span><strong>${rate.toFixed(1)}%</strong><small>${converted}/${qs.length} cotizaciones</small></article>`;

    const map = new Map();
    rs.forEach(r => {
      if (!map.has(r.destination)) map.set(r.destination, { destination: r.destination, count: 0, pax: 0, sales: 0, paid: 0 });
      const x = map.get(r.destination); x.count++; x.pax += paxCountV2(r); x.sales += Number(r.total || 0); x.paid += reservationPaid(r);
    });
    const rows = [...map.values()].sort((a, b) => b.sales - a.sales);
    $("#reportDestinationsBodyV2").innerHTML = rows.length ? rows.map(x => `<tr><td><strong>${escapeHTML(x.destination)}</strong></td><td>${x.count}</td><td>${x.pax}</td><td>${fmtMoney(x.sales)}</td><td>${fmtMoney(x.paid)}</td><td>${fmtMoney(x.sales - x.paid)}</td></tr>`).join("") : `<tr><td colspan="6"><div class="empty">Sin datos en el mes.</div></td></tr>`;
  }

  function openDocumentGeneratorV2(type) {
    activeDocumentType = type;
    const select = $("#documentReservationV2");
    const rs = filteredReservationsV2().filter(r => r.status !== "cancelada");
    select.innerHTML = rs.map(r => `<option value="${r.id}">${escapeHTML(r.code)} · ${escapeHTML(r.clientName)} · ${escapeHTML(r.destination)}</option>`).join("");
    if (!rs.length) return toastV2("No hay reservas", "Crea un expediente antes de generar documentos.");
    $("#documentModalTitleV2").textContent = type;
    $("#documentPaymentWrapV2").hidden = type !== "Recibo de pago";
    updateDocumentPaymentsV2();
    $("#documentModalV2").showModal();
  }

  function updateDocumentPaymentsV2() {
    const r = findReservationV2($("#documentReservationV2")?.value);
    const select = $("#documentPaymentV2");
    if (!select || !r) return;
    const items = [...(r.payments || [])].sort((a, b) => String(b.paidOn).localeCompare(String(a.paidOn)));
    select.innerHTML = items.map(p => `<option value="${p.id}">${fmtDateV2(p.paidOn)} · ${fmtMoney(p.amount)} · ${escapeHTML(p.method)}</option>`).join("");
    $("#documentPaymentEmptyV2").hidden = items.length > 0;
  }

  function generatePrintableDocumentV2(type, r, payment = null) {
    const w = window.open("", "_blank", "width=980,height=800");
    if (!w) return toastV2("Ventana bloqueada", "Permite ventanas emergentes para generar el documento.");
    const logo = brandLogoUrl(r.brand);
    const paid = reservationPaid(r), balance = reservationBalance(r);
    const paxRows = uniqueById(r.passengers).map((p, i) => `<tr><td>${i + 1}</td><td>${escapeHTML(fullName(p))}</td><td>${fmtDateV2(p.birth)}</td></tr>`).join("");
    const common = `<div class="grid"><div><small>Reserva</small><strong>${escapeHTML(r.code)}</strong></div><div><small>Cliente</small><strong>${escapeHTML(r.clientName)}</strong></div><div><small>Destino</small><strong>${escapeHTML(r.destination)}</strong></div><div><small>Fechas</small><strong>${fmtDateV2(r.start)} → ${fmtDateV2(r.end)}</strong></div><div><small>Hotel</small><strong>${escapeHTML(r.hotel || "N/A")}</strong></div><div><small>Estado</small><strong>${reservationStatusLabel(r.status)}</strong></div></div>`;
    const pax = `<h2>Pasajeros</h2><table><thead><tr><th>#</th><th>Nombre</th><th>Nacimiento</th></tr></thead><tbody>${paxRows || `<tr><td colspan="3">Sin pasajeros capturados</td></tr>`}</tbody></table>`;
    let body = "";
    if (type === "Voucher") body = `${common}${pax}<h2>Servicios confirmados</h2><div class="grid"><div><small>Aerolínea</small><strong>${escapeHTML(r.airline || "N/A")}</strong></div><div><small>Vuelo salida</small><strong>${escapeHTML(fmtDateTimeV2(r.flightOut))}</strong></div><div><small>Vuelo regreso</small><strong>${escapeHTML(fmtDateTimeV2(r.flightIn))}</strong></div><div><small>Traslado</small><strong>${escapeHTML(r.transfer || "N/A")}</strong></div><div><small>Tour / actividad</small><strong>${escapeHTML(r.tour || "N/A")}</strong></div><div><small>Confirmación</small><strong>${r.signedAt ? `Firmada por ${escapeHTML(r.signedBy)}` : "Pendiente de firma"}</strong></div></div>`;
    if (type === "Itinerario") body = `${common}${pax}<h2>Itinerario</h2><div class="timeline"><div><b>Salida</b><span>${escapeHTML(fmtDateTimeV2(r.flightOut))} · ${escapeHTML(r.airline || "N/A")}</span></div><div><b>Hospedaje</b><span>${escapeHTML(r.hotel || "N/A")} · ${fmtDateV2(r.start)} a ${fmtDateV2(r.end)}</span></div><div><b>Traslado</b><span>${escapeHTML(r.transfer || "N/A")}</span></div><div><b>Actividad</b><span>${escapeHTML(r.tour || "N/A")}</span></div><div><b>Regreso</b><span>${escapeHTML(fmtDateTimeV2(r.flightIn))} · ${escapeHTML(r.airline || "N/A")}</span></div></div>`;
    if (type === "Recibo de pago") body = `${common}<div class="receipt"><small>Pago recibido</small><strong>${fmtMoney(payment.amount)}</strong><p>${fmtDateV2(payment.paidOn)} · ${escapeHTML(payment.method || "")}</p>${payment.reference ? `<p>Ref. ${escapeHTML(payment.reference)}</p>` : ""}</div><div class="grid"><div><small>Total reserva</small><strong>${fmtMoney(r.total)}</strong></div><div><small>Pagado acumulado</small><strong>${fmtMoney(paid)}</strong></div><div><small>Saldo actual</small><strong>${fmtMoney(balance)}</strong></div></div>`;
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHTML(type)} · ${escapeHTML(r.code)}</title><style>body{font-family:Arial,sans-serif;color:#172033;margin:0;background:#eef1f5}.actions{max-width:900px;margin:14px auto;display:flex;justify-content:flex-end;gap:8px}.actions button{border:0;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer}.actions .print{background:#111827;color:#fff}.page{max-width:900px;margin:0 auto 28px;background:#fff;padding:42px;box-shadow:0 14px 45px #0002}.brand{display:flex;align-items:center;gap:18px;padding-bottom:20px;border-bottom:2px solid #eef0f4}.brand img{width:115px;height:65px;object-fit:contain}.brand h1{margin:0;font-size:24px}.brand span{color:#6c7482}.doc-title{margin:28px 0}.doc-title span{font-size:11px;letter-spacing:1.5px;color:#7a8290}.doc-title h2{font-size:32px;margin:5px 0}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:18px 0}.grid>div{border:1px solid #e5e7eb;border-radius:12px;padding:14px}.grid small{display:block;color:#7a8290;text-transform:uppercase;font-size:9px;letter-spacing:1px;margin-bottom:6px}table{width:100%;border-collapse:collapse;margin:12px 0 24px}th,td{border-bottom:1px solid #e5e7eb;padding:10px;text-align:left;font-size:12px}th{font-size:9px;text-transform:uppercase;color:#7a8290}.timeline{border-left:3px solid #111827;padding-left:20px}.timeline div{margin:16px 0}.timeline b,.timeline span{display:block}.receipt{text-align:center;padding:28px;background:#f7f8fa;border-radius:16px;margin:24px 0}.receipt strong{display:block;font-size:42px;margin:8px}.foot{margin-top:32px;padding-top:18px;border-top:1px solid #e5e7eb;color:#737b88;font-size:10px}@media print{body{background:#fff}.actions{display:none}.page{box-shadow:none;margin:0;max-width:none}}@media(max-width:650px){.page{padding:24px}.grid{grid-template-columns:1fr}}</style></head><body><div class="actions"><button onclick="window.close()">Cerrar</button><button class="print" onclick="window.print()">Imprimir / Guardar PDF</button></div><main class="page"><div class="brand"><img src="${logo}"><div><h1>${escapeHTML(brandNameV2(r.brand))}</h1><span>Travel Ops by Nuve Works</span></div></div><div class="doc-title"><span>${escapeHTML(r.code)}</span><h2>${escapeHTML(type)}</h2></div>${body}<div class="foot">Generado por ${escapeHTML(brandNameV2(r.brand))} desde Travel Ops · ${new Date().toLocaleString("es-MX")}</div></main></body></html>`);
    w.document.close();
    $("#documentModalV2").close();
  }

  function renderCalendarV2() {
    const base = state.calendarDate;
    const y = base.getUTCFullYear(), m = base.getUTCMonth();
    $("#calendarMonth").textContent = monthFmt.format(base);
    const first = new Date(Date.UTC(y, m, 1));
    const mondayIndex = (first.getUTCDay() + 6) % 7;
    const start = new Date(first); start.setUTCDate(1 - mondayIndex);
    const heads = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(h => `<div class="calendar-cell calendar-head">${h}</div>`).join("");
    let cells = "";
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setUTCDate(start.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const outside = d.getUTCMonth() !== m;
      const deps = filteredDepartures().filter(dep => dep.start <= iso && dep.end >= iso);
      const reservations = filteredReservationsV2().filter(r => r.status !== "cancelada" && r.start === iso);
      const followups = filteredLeads().filter(l => l.followup === iso && !["ganado", "perdido"].includes(l.status));
      cells += `<div class="calendar-cell ${outside ? "outside" : ""}" data-calendar-date-v2="${iso}"><div class="day-number">${d.getUTCDate()}</div>${deps.map(ev => `<button class="calendar-event ${ev.brand}" data-departure="${ev.id}" type="button">${escapeHTML(ev.destination)}</button>`).join("")}${reservations.map(r => `<button class="calendar-event reservation-event-v2 ${r.brand}" data-calendar-res-v2="${r.id}" type="button">R · ${escapeHTML(r.destination)}</button>`).join("")}${followups.map(l => `<button class="calendar-followup-v2" data-calendar-lead-v2="${l.id}" type="button">↗ ${escapeHTML(l.name)}</button>`).join("")}</div>`;
    }
    $("#calendarGrid").innerHTML = heads + cells;
    $$('[data-departure]', $("#calendarGrid")).forEach(btn => btn.addEventListener("click", () => openDeparture(btn.dataset.departure)));
    $$('[data-calendar-res-v2]', $("#calendarGrid")).forEach(btn => btn.addEventListener("click", () => openReservationDetailV2(btn.dataset.calendarResV2)));
    $$('[data-calendar-lead-v2]', $("#calendarGrid")).forEach(btn => btn.addEventListener("click", () => switchView("crm")));
  }

  renderCalendar = renderCalendarV2;

  function globalSearchV2(term) {
    const q = String(term || "").trim().toLowerCase();
    if (!q) return;
    const client = state.clients.find(c => `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q));
    if (client) { switchView("clients"); $("#clientSearchV2").value = term; renderClientsV2(); return; }
    const r = state.reservations.find(x => `${x.code} ${x.clientName} ${x.destination}`.toLowerCase().includes(q));
    if (r) { switchView("reservations"); openReservationDetailV2(r.id); return; }
    const qt = state.quotes.find(x => `${x.code} ${x.clientName} ${x.destination}`.toLowerCase().includes(q));
    if (qt) { switchView("quotes"); openQuoteModalV2(qt); return; }
    const dep = state.departures.find(x => x.destination.toLowerCase().includes(q));
    if (dep) { switchView("departures"); openDeparture(dep.id); return; }
    toastV2("Sin coincidencias", "Prueba con cliente, destino, código de reserva o cotización.");
  }

  async function resetReservationSignature(r) {
    if (!r?.signedAt) return;
    r.signedBy = ""; r.signedAt = ""; r.signatureData = ""; r.acceptedTerms = false; r.clientConfirmedData = false;
    if (state.supabase) {
      await state.supabase.from("reservations").update({ signed_by: null, signed_at: null, signature_data: null, accepted_terms: false, client_confirmed_data: false, accepted_terms_version: null, updated_by: state.user.id }).eq("id", r.id);
    }
  }

  async function maybeOpenPublicPortalV2() {
    const params = new URLSearchParams(location.search);
    const quoteId = params.get("quote"), reservationId = params.get("reservation"), token = params.get("token") || "";
    if (!quoteId && !reservationId) return false;
    publicPortalActive = true;
    $("#loginView")?.classList.add("hidden");
    $("#mainView")?.classList.add("hidden");
    const portal = $("#publicPortalV2");
    portal.classList.remove("hidden");
    portal.innerHTML = `<div class="public-shell-v2"><div class="public-loading-v2">Cargando información del viaje...</div></div>`;
    const sb = state.supabase || await window.getSupabase();
    if (!sb) {
      portal.innerHTML = invalidPublicLinkHTML("No hay conexión con la base de datos.");
      return true;
    }
    try {
      if (quoteId) {
        const { data, error } = await sb.rpc("get_shared_travelops_quote", { p_quote_id: quoteId, p_token: token });
        if (error) throw error;
        if (!data?.quote) throw new Error("Enlace no disponible");
        renderPublicQuoteV2(data.quote, data.options || []);
      } else {
        const { data, error } = await sb.rpc("get_shared_travelops_reservation", { p_reservation_id: reservationId, p_token: token });
        if (error) throw error;
        if (!data?.reservation) throw new Error("Enlace no disponible");
        renderPublicReservationV2(data.reservation, data.passengers || [], data.payments || [], token, sb);
      }
    } catch (err) {
      portal.innerHTML = invalidPublicLinkHTML(err.message || "El enlace no existe o ya no es válido.");
    }
    return true;
  }

  function invalidPublicLinkHTML(text) {
    return `<div class="public-shell-v2 invalid-public-v2"><img src="assets/travel-ops-logo.png" alt="Travel Ops"><h1>Enlace no disponible</h1><p>${escapeHTML(text)}</p></div>`;
  }

  function publicBrandHeader(brand, badge) {
    return `<header class="public-head-v2"><div class="public-brand-v2"><img src="${brandAsset(brand)}" alt="${escapeHTML(brandNameV2(brand))}"><div><strong>${escapeHTML(brandNameV2(brand))}</strong><span>Travel Ops by Nuve Works</span></div></div><span class="public-badge-v2">${escapeHTML(badge)}</span></header>`;
  }

  function renderPublicQuoteV2(q, options) {
    const portal = $("#publicPortalV2");
    const pax = Number(q.adults || 0) + Number(q.minors || 0);
    portal.innerHTML = `<div class="public-shell-v2">${publicBrandHeader(q.brand, "COTIZACIÓN")}<main class="public-main-v2"><section class="public-hero-v2"><span>Opciones preparadas para ti</span><h1>${escapeHTML(q.destination)}</h1><p>${escapeHTML(q.clientName)} · ${fmtDateV2(q.startDate)} → ${fmtDateV2(q.endDate)} · ${pax} pax</p></section>${q.expired ? `<div class="public-warning-v2"><strong>Esta cotización ya venció.</strong><span>Contacta a tu asesor para actualizar disponibilidad y tarifa.</span></div>` : ""}<section class="public-service-grid-v2"><div><small>Aerolínea</small><strong>${escapeHTML(q.airline || "N/A")}</strong></div><div><small>Vuelo salida</small><strong>${escapeHTML(fmtDateTimeV2(q.flightOut))}</strong></div><div><small>Vuelo regreso</small><strong>${escapeHTML(fmtDateTimeV2(q.flightIn))}</strong></div><div><small>Traslado</small><strong>${escapeHTML(q.transfer || "N/A")}</strong></div><div><small>Tour / actividad</small><strong>${escapeHTML(q.tour || "N/A")}</strong></div></section><section class="public-options-v2">${options.map((o, i) => `<article class="public-option-v2"><div class="public-option-head-v2"><span>OPCIÓN ${i + 1}</span><strong>${fmtMoney(o.finalPrice)}</strong></div><h2>${escapeHTML(o.hotel || "Alternativa")}</h2><p>${escapeHTML(o.detail || "Opción preparada por tu asesor de viajes.")}</p><div class="public-final-price-v2"><span>Precio final</span><strong>${fmtMoney(o.finalPrice)}</strong></div></article>`).join("")}</section>${q.notes ? `<section class="public-note-v2"><strong>Observaciones</strong><p>${escapeHTML(q.notes)}</p></section>` : ""}<p class="public-foot-v2">Precios sujetos a disponibilidad al momento de reservar. El cliente únicamente visualiza el precio final; los costos internos de la agencia no forman parte de esta cotización.</p></main></div>`;
  }

  function publicPassengerHTML(passengers) {
    return `<div class="public-passengers-v2">${passengers.map((p, i) => `<div><span><b>${i + 1}. ${escapeHTML([p.first, p.last1, p.last2].filter(Boolean).join(" "))}</b><small>${fmtDateV2(p.birthDate)}</small></span></div>`).join("")}</div>`;
  }

  function renderPublicReservationV2(r, passengers, payments, token, sb) {
    const portal = $("#publicPortalV2");
    const expected = Math.max(1, Number(r.adults || 0) + Number(r.minors || 0));
    const complete = passengers.length >= expected && passengers.slice(0, expected).every(p => p.first && p.last1 && p.birthDate);
    const paid = payments.reduce((n, p) => n + Number(p.amount || 0), 0), balance = Math.max(0, Number(r.total || 0) - paid);
    const signed = Boolean(r.signedAt);
    const services = `<section class="public-service-grid-v2"><div><small>Hotel</small><strong>${escapeHTML(r.hotel || "N/A")}</strong></div><div><small>Aerolínea</small><strong>${escapeHTML(r.airline || "N/A")}</strong></div><div><small>Vuelo salida</small><strong>${escapeHTML(fmtDateTimeV2(r.flightOut))}</strong></div><div><small>Vuelo regreso</small><strong>${escapeHTML(fmtDateTimeV2(r.flightIn))}</strong></div><div><small>Traslado</small><strong>${escapeHTML(r.transfer || "N/A")}</strong></div><div><small>Tour / actividad</small><strong>${escapeHTML(r.tour || "N/A")}</strong></div><div><small>Total de la reserva</small><strong>${fmtMoney(r.total)}</strong></div></section>`;
    let lower = "";
    if (!complete) {
      lower = `<div class="public-warning-v2"><strong>Datos de pasajeros pendientes</strong><span>La agencia todavía debe completar nombres y fechas de nacimiento antes de enviar esta reserva a firma.</span></div>`;
    } else if (!signed) {
      const terms = brandTerms(r.brand);
      lower = `<section class="public-section-v2"><span class="eyebrow">PASAJEROS</span><h2>Revisa los datos antes de firmar</h2>${publicPassengerHTML(passengers)}</section><section class="public-section-v2"><span class="eyebrow">TÉRMINOS Y CONDICIONES</span><h2>Aceptación de la reserva</h2><ol class="public-terms-v2">${terms.map(t => `<li>${escapeHTML(t)}</li>`).join("")}</ol><label class="public-check-v2"><input type="checkbox" id="publicAcceptTermsV2"><span>He leído y acepto los Términos y Condiciones mostrados arriba.</span></label><label class="public-check-v2"><input type="checkbox" id="publicConfirmDataV2"><span>Confirmo que revisé destino, fechas, servicios, importes y datos de todos los pasajeros.</span></label><label class="public-signer-v2"><span>Nombre de quien firma</span><input id="publicSignerNameV2" placeholder="Nombre completo"></label><div class="public-signature-v2"><canvas id="publicSignatureCanvasV2" width="760" height="210"></canvas><span>Firma aquí</span></div><div class="row-actions"><button type="button" class="ghost-btn" id="publicClearSignatureV2">Limpiar firma</button><button type="button" class="primary-btn" id="publicSignReservationV2">Aceptar términos y firmar reserva</button></div></section>`;
    } else {
      lower = `<section class="public-section-v2 public-success-v2"><span class="eyebrow">RESERVA CONFIRMADA</span><h2>Firma registrada</h2><p>Firmada por <strong>${escapeHTML(r.signedBy || "Cliente")}</strong> el ${new Date(r.signedAt).toLocaleString("es-MX")}.</p></section><section class="public-section-v2"><span class="eyebrow">ESTADO DE CUENTA</span><h2>Pagos de tu reserva</h2><div class="public-account-grid-v2"><div><small>Total</small><strong>${fmtMoney(r.total)}</strong></div><div><small>Pagado</small><strong>${fmtMoney(paid)}</strong></div><div><small>Saldo</small><strong>${fmtMoney(balance)}</strong></div></div><div class="public-payment-list-v2">${payments.length ? payments.map(p => `<div><span>${fmtDateV2(p.date)} · ${escapeHTML(p.method || "")}</span><strong>${fmtMoney(p.amount)}</strong></div>`).join("") : `<span>Sin movimientos registrados.</span>`}</div></section>`;
    }
    portal.innerHTML = `<div class="public-shell-v2">${publicBrandHeader(r.brand, signed ? "ESTADO DE CUENTA" : "CONFIRMACIÓN")}<main class="public-main-v2"><section class="public-hero-v2"><span>Tu viaje</span><h1>${escapeHTML(r.destination)}</h1><p>${escapeHTML(r.code)} · ${escapeHTML(r.clientName)} · ${fmtDateV2(r.startDate)} → ${fmtDateV2(r.endDate)}</p></section>${services}${lower}</main></div>`;
    if (complete && !signed) setupPublicSignatureV2(r, token, sb);
  }

  function setupPublicSignatureV2(r, token, sb) {
    const canvas = $("#publicSignatureCanvasV2"), ctx = canvas.getContext("2d");
    let drawing = false, hasInk = false;
    ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#111827";
    const pos = e => { const rect = canvas.getBoundingClientRect(), p = e.touches?.[0] || e; return { x: (p.clientX - rect.left) * (canvas.width / rect.width), y: (p.clientY - rect.top) * (canvas.height / rect.height) }; };
    canvas.onpointerdown = e => { e.preventDefault(); drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    canvas.onpointermove = e => { if (!drawing) return; e.preventDefault(); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); hasInk = true; };
    canvas.onpointerup = () => { drawing = false; };
    canvas.onpointerleave = () => { drawing = false; };
    $("#publicClearSignatureV2").onclick = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); hasInk = false; };
    $("#publicSignReservationV2").onclick = async () => {
      const name = $("#publicSignerNameV2").value.trim();
      if (!name) return alert("Escribe el nombre de quien firma.");
      if (!$("#publicAcceptTermsV2").checked) return alert("Debes aceptar los Términos y Condiciones.");
      if (!$("#publicConfirmDataV2").checked) return alert("Debes confirmar que revisaste los datos de la reserva y pasajeros.");
      if (!hasInk) return alert("Firma dentro del recuadro.");
      const btn = $("#publicSignReservationV2"); btn.disabled = true; btn.textContent = "Guardando firma...";
      const { error } = await sb.rpc("confirm_shared_travelops_reservation", {
        p_reservation_id: r.id,
        p_token: token,
        p_signed_by: name,
        p_signature_data: canvas.toDataURL("image/png"),
        p_accept_terms: true,
        p_confirm_data: true,
        p_terms_version: "TO-2026-09"
      });
      if (error) { btn.disabled = false; btn.textContent = "Aceptar términos y firmar reserva"; return alert(error.message); }
      const { data, error: refreshError } = await sb.rpc("get_shared_travelops_reservation", { p_reservation_id: r.id, p_token: token });
      if (refreshError) return alert(refreshError.message);
      renderPublicReservationV2(data.reservation, data.passengers || [], data.payments || [], token, sb);
    };
  }

  // --------------------------------------------------------------
  // Formularios y eventos
  // --------------------------------------------------------------

  $("#newClientBtnV2")?.addEventListener("click", () => openClientModalV2());
  $("#clientSearchV2")?.addEventListener("input", renderClientsV2);
  $("#newQuoteBtnV2")?.addEventListener("click", () => openQuoteModalV2());
  $("#newReservationBtnV2")?.addEventListener("click", () => openReservationModalV2());
  $("#reservationSearchV2")?.addEventListener("input", renderReservationsV2);
  $("#reportMonthV2")?.addEventListener("change", renderReportsV2);
  $("#documentReservationV2")?.addEventListener("change", updateDocumentPaymentsV2);
  $$('[data-doc-type-v2]').forEach(btn => btn.addEventListener("click", () => openDocumentGeneratorV2(btn.dataset.docTypeV2)));

  $("#quoteStartV2")?.addEventListener("change", () => {
    const start = $("#quoteStartV2").value, end = $("#quoteEndV2");
    end.min = start || ""; if (start && (!end.value || end.value < start)) end.value = start;
  });
  $("#reservationStartV2")?.addEventListener("change", () => {
    const start = $("#reservationStartV2").value, end = $("#reservationEndV2");
    end.min = start || ""; if (start && (!end.value || end.value < start)) end.value = start;
  });
  $("#quoteTourPriceV2")?.addEventListener("input", updateQuoteInternalSummary);
  $("#quoteMsiV2")?.addEventListener("input", updateQuoteInternalSummary);
  $("#addQuoteOptionBtnV2")?.addEventListener("click", () => {
    const opts = collectQuoteOptionsV2();
    if (opts.length >= 3) return;
    opts.push(blankQuoteOptionV2());
    renderQuoteOptionsEditorV2(opts);
  });
  $("#reservationBrandV2")?.addEventListener("change", e => populateDepartureSelectV2(e.target.value, ""));

  $("#clientFormV2")?.addEventListener("submit", async e => {
    e.preventDefault();
    const id = $("#clientIdV2").value;
    const actor = currentActor();
    const payload = {
      brand: $("#clientBrandV2").value,
      type: $("#clientTypeV2").value,
      name: $("#clientNameV2").value.trim(),
      phone: $("#clientPhoneV2").value.trim(),
      email: $("#clientEmailV2").value.trim(),
      status: $("#clientStatusV2").value,
      notes: $("#clientNotesV2").value.trim()
    };
    if (!payload.name) return;
    const agency = payload.type === "agencia" && payload.brand === "pink" ? findAgencyByName(payload.name) : null;
    if (state.supabase) {
      const db = { brand: payload.brand, client_type: payload.type, agency_id: agency?.id || null, name: payload.name, phone: payload.phone || null, email: payload.email || null, status: payload.status, notes: payload.notes || null, updated_by: actor.id };
      let result;
      if (id) result = await state.supabase.from("clients").update(db).eq("id", id);
      else result = await state.supabase.from("clients").insert({ ...db, created_by: actor.id });
      if (result.error) return alert(result.error.message);
      await hydrateV2FromSupabase();
    } else {
      if (id) Object.assign(findClientV2(id), payload, { agencyId: agency?.id || "", updatedBy: actor });
      else state.clients.push({ id: uid("client"), ...payload, agencyId: agency?.id || "", createdBy: actor, updatedBy: actor });
      saveV2Demo();
    }
    await logAction("client", id || payload.name, id ? "updated" : "created", { name: payload.name, brand: payload.brand });
    $("#clientModalV2").close(); renderAll();
  });

  $("#quoteFormV2")?.addEventListener("submit", async e => {
    e.preventDefault();
    const id = $("#quoteIdV2").value;
    const existing = findQuoteV2(id);
    const actor = currentActor();
    const brand = $("#quoteBrandV2").value;
    const clientName = $("#quoteClientV2").value.trim();
    const start = $("#quoteStartV2").value, end = $("#quoteEndV2").value;
    if (!clientName || !$("#quoteDestinationV2").value.trim() || !start || !end || end < start) return alert("Revisa cliente, destino y fechas.");
    const options = collectQuoteOptionsV2();
    if (!options.length || options.length > 3 || options.some(o => !o.hotel || o.salePrice <= 0)) return alert("Cada opción necesita hotel / servicio y un precio de venta mayor a cero.");
    const client = await ensureClientV2(clientName, brand);
    const validityHours = Number($("#quoteValidityV2").value || 48);
    const validUntil = existing?.validUntil && existing.validityHours === validityHours ? existing.validUntil : new Date(Date.now() + validityHours * 3600000).toISOString();
    const item = {
      id: id || uid("quote"), code: existing?.code || codeFor("COT"), brand, clientId: client?.id || "", clientName,
      destination: $("#quoteDestinationV2").value.trim(), start, end,
      adults: Number($("#quoteAdultsV2").value || 1), minors: Number($("#quoteMinorsV2").value || 0),
      airline: $("#quoteAirlineV2").value.trim(), flightOut: $("#quoteFlightOutV2").value, flightIn: $("#quoteFlightInV2").value,
      transfer: $("#quoteTransferV2").value.trim(), tour: $("#quoteTourV2").value.trim(), tourPrice: Number($("#quoteTourPriceV2").value || 0),
      msi: Number($("#quoteMsiV2").value || 0), status: $("#quoteStatusV2").value, validityHours, validUntil,
      notes: $("#quoteNotesV2").value.trim(), shareToken: existing?.shareToken || "", convertedAt: existing?.convertedAt || "", convertedReservationId: existing?.convertedReservationId || "", options
    };
    if (state.supabase) {
      const db = { code: item.code, brand: item.brand, client_id: item.clientId || null, client_name: item.clientName, destination: item.destination, start_date: item.start, end_date: item.end, adults: item.adults, minors: item.minors, airline: item.airline || null, flight_out: item.flightOut || null, flight_in: item.flightIn || null, transfer_service: item.transfer || null, tour_service: item.tour || null, tour_price: item.tourPrice, msi_amount: item.msi, status: item.status, validity_hours: item.validityHours, valid_until: item.validUntil, notes: item.notes || null, updated_by: actor.id };
      let quoteId = id;
      if (id) {
        const { error } = await state.supabase.from("quotes").update(db).eq("id", id); if (error) return alert(error.message);
      } else {
        const { data, error } = await state.supabase.from("quotes").insert({ ...db, created_by: actor.id }).select().single(); if (error) return alert(error.message); quoteId = data.id;
      }
      const del = await state.supabase.from("quote_options").delete().eq("quote_id", quoteId); if (del.error) return alert(del.error.message);
      const rows = options.map((o, index) => ({ quote_id: quoteId, sort_order: index + 1, hotel_service: o.hotel, detail: o.detail || null, internal_cost: o.internalCost, sale_price: o.salePrice }));
      const ins = await state.supabase.from("quote_options").insert(rows); if (ins.error) return alert(ins.error.message);
      await hydrateV2FromSupabase();
    } else {
      const idx = state.quotes.findIndex(q => q.id === item.id); if (idx >= 0) state.quotes[idx] = item; else state.quotes.unshift(item); saveV2Demo();
    }
    await logAction("quote", item.id, id ? "updated" : "created", { code: item.code, client: clientName, destination: item.destination });
    $("#quoteModalV2").close(); renderAll();
  });

  $("#quoteConvertChoicesV2")?.addEventListener("click", e => {
    const btn = e.target.closest('[data-quote-option-choice-v2]'); if (!btn) return;
    const q = findQuoteV2(convertQuoteId), option = q?.options.find(o => o.id === btn.dataset.quoteOptionChoiceV2);
    if (q && option) convertQuoteOptionV2(q, option);
  });

  $("#reservationFormV2")?.addEventListener("submit", async e => {
    e.preventDefault();
    const id = $("#reservationIdV2").value;
    const existing = findReservationV2(id);
    const actor = currentActor();
    const brand = $("#reservationBrandV2").value;
    const clientName = $("#reservationClientV2").value.trim();
    const start = $("#reservationStartV2").value, end = $("#reservationEndV2").value;
    const adults = Number($("#reservationAdultsV2").value || 1), minors = Number($("#reservationMinorsV2").value || 0);
    const expected = adults + minors;
    if (existing && uniqueById(existing.passengers).length > expected) return alert(`Este expediente ya tiene ${uniqueById(existing.passengers).length} pasajeros. Elimina los pasajeros sobrantes desde la salida antes de reducir la cantidad.`);
    if (!clientName || !$("#reservationDestinationV2").value.trim() || !start || !end || end < start) return alert("Revisa cliente, destino y fechas.");
    const client = await ensureClientV2(clientName, brand);
    let departureId = $("#reservationDepartureV2").value || "";
    if (existing?.bookingId && !departureId) departureId = existing.departureId;
    const item = {
      id: id || uid("reservation"), code: existing?.code || codeFor("RES"), brand, clientId: client?.id || "", clientName,
      quoteId: $("#reservationSourceQuoteV2").value || existing?.quoteId || "", quoteOptionId: $("#reservationSourceOptionV2").value || existing?.quoteOptionId || "",
      departureId, bookingId: existing?.bookingId || "", destination: $("#reservationDestinationV2").value.trim(), start, end, adults, minors,
      hotel: $("#reservationHotelV2").value.trim(), airline: $("#reservationAirlineV2").value.trim(), flightOut: $("#reservationFlightOutV2").value, flightIn: $("#reservationFlightInV2").value,
      transfer: $("#reservationTransferV2").value.trim(), tour: $("#reservationTourV2").value.trim(), tourPrice: Number($("#reservationTourPriceV2").value || 0),
      internalCost: Number($("#reservationInternalCostV2").value || 0), msi: Number($("#reservationMsiV2").value || 0), total: Number($("#reservationTotalV2").value || 0),
      status: $("#reservationStatusV2").value, invoiceRequired: $("#reservationInvoiceRequiredV2").value === "true", billingStatus: $("#reservationBillingStatusV2").value,
      notes: $("#reservationNotesV2").value.trim(), shareToken: existing?.shareToken || "", signedBy: "", signedAt: "", signatureData: "", acceptedTerms: false, clientConfirmedData: false,
      passengers: existing?.passengers || [], payments: existing?.payments || []
    };
    if (item.total < 0) return alert("El total no puede ser negativo.");
    if (state.supabase) {
      let bookingId = item.bookingId || "";
      if (departureId) {
        const agency = brand === "pink" ? findAgencyByName(clientName) : null;
        const bookingPayload = { departure_id: departureId, customer_name: clientName, agency_id: agency?.id || null, total_amount: item.total, invoice_required: item.invoiceRequired, billing_status: item.invoiceRequired ? item.billingStatus : "no_solicitada", notes: item.notes || null, updated_by: actor.id };
        if (bookingId) {
          const { error } = await state.supabase.from("bookings").update(bookingPayload).eq("id", bookingId); if (error) return alert(error.message);
        } else {
          const { data, error } = await state.supabase.from("bookings").insert({ ...bookingPayload, paid_amount: 0, created_by: actor.id }).select().single(); if (error) return alert(error.message); bookingId = data.id;
        }
      }
      item.bookingId = bookingId;
      const db = { code: item.code, brand: item.brand, client_id: item.clientId || null, client_name: item.clientName, quote_id: item.quoteId || null, quote_option_id: item.quoteOptionId || null, departure_id: item.departureId || null, booking_id: item.bookingId || null, destination: item.destination, start_date: item.start, end_date: item.end, adults: item.adults, minors: item.minors, hotel_service: item.hotel || null, airline: item.airline || null, flight_out: item.flightOut || null, flight_in: item.flightIn || null, transfer_service: item.transfer || null, tour_service: item.tour || null, tour_price: item.tourPrice, internal_cost: item.internalCost, msi_amount: item.msi, total_amount: item.total, status: item.status, invoice_required: item.invoiceRequired, billing_status: item.invoiceRequired ? item.billingStatus : "no_solicitada", notes: item.notes || null, signed_by: null, signed_at: null, signature_data: null, accepted_terms: false, client_confirmed_data: false, accepted_terms_version: null, updated_by: actor.id };
      let reservationId = id;
      if (id) {
        const { error } = await state.supabase.from("reservations").update(db).eq("id", id); if (error) return alert(error.message);
      } else {
        const { data, error } = await state.supabase.from("reservations").insert({ ...db, created_by: actor.id }).select().single(); if (error) return alert(error.message); reservationId = data.id;
      }
      if (item.quoteId) {
        await state.supabase.from("quotes").update({ status: "convertida", converted_at: nowISO(), converted_reservation_id: reservationId, updated_by: actor.id }).eq("id", item.quoteId);
      }
      await hydrateFromSupabase();
    } else {
      const idx = state.reservations.findIndex(r => r.id === item.id); if (idx >= 0) state.reservations[idx] = item; else state.reservations.unshift(item);
      if (item.quoteId) { const q = findQuoteV2(item.quoteId); if (q) { q.status = "convertida"; q.convertedAt = nowISO(); q.convertedReservationId = item.id; } }
      saveV2Demo();
    }
    await logAction("reservation", item.id, id ? "updated" : "created", { code: item.code, client: clientName, destination: item.destination });
    $("#reservationModalV2").close(); renderAll();
    toastV2(id && existing?.signedAt ? "Reserva actualizada" : "Reserva guardada", id && existing?.signedAt ? "La firma anterior se invalidó porque cambió el expediente." : "");
  });

  $("#reservationPassengerFormV2")?.addEventListener("submit", async e => {
    e.preventDefault();
    const r = findReservationV2(e.currentTarget.dataset.reservationId); if (!r) return;
    const actor = currentActor();
    const rows = $$(".passenger-editor-row-v2", $("#reservationPassengerEditorV2"));
    if (rows.some(row => !row.querySelector('[data-pax-v2="first"]').value.trim() || !row.querySelector('[data-pax-v2="last1"]').value.trim() || !row.querySelector('[data-pax-v2="birth"]').value)) return alert("Completa nombre, apellido paterno y fecha de nacimiento de todos los pasajeros.");
    if (state.supabase) {
      for (const row of rows) {
        const passengerId = row.dataset.passengerId;
        const payload = { booking_id: r.bookingId || null, reservation_id: r.id, first_name: row.querySelector('[data-pax-v2="first"]').value.trim(), last_name_1: row.querySelector('[data-pax-v2="last1"]').value.trim(), last_name_2: row.querySelector('[data-pax-v2="last2"]').value.trim() || null, birth_date: row.querySelector('[data-pax-v2="birth"]').value, updated_by: actor.id };
        if (passengerId) {
          const { error } = await state.supabase.from("passengers").update(payload).eq("id", passengerId); if (error) return alert(error.message);
        } else {
          const { error } = await state.supabase.from("passengers").insert({ ...payload, created_by: actor.id }); if (error) return alert(error.message);
        }
      }
      await resetReservationSignature(r);
      await hydrateFromSupabase();
    } else {
      r.passengers = rows.map(row => ({ id: row.dataset.passengerId || uid("pax"), first: row.querySelector('[data-pax-v2="first"]').value.trim(), last1: row.querySelector('[data-pax-v2="last1"]').value.trim(), last2: row.querySelector('[data-pax-v2="last2"]').value.trim(), birth: row.querySelector('[data-pax-v2="birth"]').value, createdBy: actor, updatedBy: actor }));
      r.signedAt = ""; r.signedBy = ""; r.signatureData = ""; saveV2Demo();
    }
    await logAction("reservation_passengers", r.id, "updated", { code: r.code, pax: rows.length });
    $("#reservationPassengerModalV2").close(); renderAll(); openReservationDetailV2(r.id); toastV2("Pasajeros guardados", "Ya puedes enviar la confirmación para firma cuando todos los datos estén completos.");
  });

  $("#reservationPaymentFormV2")?.addEventListener("submit", async e => {
    e.preventDefault();
    const r = findReservationV2(e.currentTarget.dataset.reservationId); if (!r) return;
    const id = $("#reservationPaymentIdV2").value;
    const old = r.payments.find(p => p.id === id);
    const amount = Number($("#reservationPaymentAmountV2").value || 0);
    const available = reservationBalance(r) + Number(old?.amount || 0);
    if (amount <= 0 || amount > available + 0.001) return alert(`El monto debe ser mayor a cero y no superar el saldo disponible de ${fmtMoney(available)}.`);
    const actor = currentActor();
    const item = { id: id || uid("pay"), amount, paidOn: $("#reservationPaymentDateV2").value, method: $("#reservationPaymentMethodV2").value, reference: $("#reservationPaymentReferenceV2").value.trim(), notes: $("#reservationPaymentNotesV2").value.trim(), reservationId: r.id, bookingId: r.bookingId || "", createdBy: old?.createdBy || actor, updatedBy: actor };
    if (state.supabase) {
      const db = { booking_id: r.bookingId || null, reservation_id: r.id, amount: item.amount, paid_on: item.paidOn, method: item.method, reference: item.reference || null, notes: item.notes || null, updated_by: actor.id, updated_at: nowISO() };
      let result;
      if (id) result = await state.supabase.from("payments").update(db).eq("id", id);
      else result = await state.supabase.from("payments").insert({ ...db, created_by: actor.id });
      if (result.error) return alert(result.error.message);
      if (r.bookingId) await syncBookingPaidAmount(r.bookingId);
      await hydrateFromSupabase();
    } else {
      const idx = r.payments.findIndex(p => p.id === item.id); if (idx >= 0) r.payments[idx] = item; else r.payments.unshift(item); saveV2Demo();
    }
    await logAction("reservation_payment", item.id, id ? "updated" : "created", { reservation: r.code, amount });
    $("#reservationPaymentModalV2").close(); renderAll(); openReservationDetailV2(r.id);
  });

  $("#documentFormV2")?.addEventListener("submit", e => {
    e.preventDefault();
    const r = findReservationV2($("#documentReservationV2").value); if (!r) return;
    if (activeDocumentType !== "Recibo de pago" && (!reservationPassengersComplete(r) || !r.signedAt)) return toastV2("Falta confirmación firmada", "Antes de generar Voucher o Itinerario captura pasajeros y pide al cliente firmar la reserva.");
    const payment = r.payments.find(p => p.id === $("#documentPaymentV2").value);
    if (activeDocumentType === "Recibo de pago" && !payment) return toastV2("No hay pago seleccionado", "Registra un pago antes de generar el recibo.");
    generatePrintableDocumentV2(activeDocumentType, r, payment);
  });

  $("#quoteHistoryBtnV2")?.addEventListener("click", () => {
    const panel = $("#quoteHistoryPanelV2"); panel.hidden = !panel.hidden; $("#quoteHistoryBtnV2").classList.toggle("active", !panel.hidden);
  });

  $("#copyQuoteLinkV2")?.addEventListener("click", () => copyInputValue("#shareQuoteLinkV2"));
  $("#openQuoteLinkV2")?.addEventListener("click", () => window.open($("#shareQuoteLinkV2").value, "_blank", "noopener"));
  $("#quoteWhatsAppV2")?.addEventListener("click", () => { const q = findQuoteV2(shareQuoteId), c = q && (findClientV2(q.clientId) || findClientByNameV2(q.clientName, q.brand)); if (q) openWhatsAppV2(c, `Hola ${q.clientName}, te comparto tu cotización para ${q.destination}. Puedes revisarla aquí: ${$("#shareQuoteLinkV2").value}`); });
  $("#quoteEmailV2")?.addEventListener("click", () => { const q = findQuoteV2(shareQuoteId), c = q && (findClientV2(q.clientId) || findClientByNameV2(q.clientName, q.brand)); if (q) openEmailV2(c, `Cotización ${q.destination} · ${brandNameV2(q.brand)}`, `Hola ${q.clientName},\n\nTe compartimos tu cotización para ${q.destination}:\n${$("#shareQuoteLinkV2").value}\n\nSaludos,\n${brandNameV2(q.brand)}`); });

  $("#copyReservationLinkV2")?.addEventListener("click", () => copyInputValue("#shareReservationLinkV2"));
  $("#openReservationLinkV2")?.addEventListener("click", () => window.open($("#shareReservationLinkV2").value, "_blank", "noopener"));
  $("#reservationWhatsAppV2")?.addEventListener("click", () => { const r = findReservationV2(shareReservationId), c = r && (findClientV2(r.clientId) || findClientByNameV2(r.clientName, r.brand)); if (!r) return; const msg = r.signedAt ? `Hola ${r.clientName}, te comparto el estado de cuenta de tu reserva para ${r.destination}. Saldo actual: ${fmtMoney(reservationBalance(r))}. ${$("#shareReservationLinkV2").value}` : `Hola ${r.clientName}, te comparto la confirmación de tu reserva para ${r.destination}. Revisa los datos de todos los pasajeros, acepta los términos y firma aquí: ${$("#shareReservationLinkV2").value}`; openWhatsAppV2(c, msg); });
  $("#reservationEmailV2")?.addEventListener("click", () => { const r = findReservationV2(shareReservationId), c = r && (findClientV2(r.clientId) || findClientByNameV2(r.clientName, r.brand)); if (!r) return; const subject = r.signedAt ? `Estado de cuenta · ${r.destination}` : `Confirmación de reserva · ${r.destination}`; const body = r.signedAt ? `Hola ${r.clientName},\n\nSaldo pendiente: ${fmtMoney(reservationBalance(r))}\n${$("#shareReservationLinkV2").value}\n\n${brandNameV2(r.brand)}` : `Hola ${r.clientName},\n\nRevisa tu reserva y los datos de pasajeros. Si todo es correcto acepta los términos y firma aquí:\n${$("#shareReservationLinkV2").value}\n\n${brandNameV2(r.brand)}`; openEmailV2(c, subject, body); });

  $("#globalSearchV2")?.addEventListener("keydown", e => { if (e.key === "Enter") globalSearchV2(e.target.value); });
  document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#globalSearchV2")?.focus(); } });

  // Public portal must be checked immediately. If auth finishes later,
  // the overridden showMain/showLogin functions keep the portal visible.
  maybeOpenPublicPortalV2();

  // If app.js finished auth before this layer was attached, hydrate once more.
  setTimeout(async () => {
    if (publicPortalActive) return;
    if (state.supabase && !$("#mainView").classList.contains("hidden")) {
      await hydrateV2FromSupabase();
      renderAll();
    } else if (!state.supabase && !$("#mainView").classList.contains("hidden")) {
      loadV2Demo();
      renderAll();
    }
  }, 800);
})();
