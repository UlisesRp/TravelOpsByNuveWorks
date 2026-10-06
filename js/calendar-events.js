/* ============================================================
   Travel Ops by Nuve Works · v1.10
   Agenda interna del calendario: notas, citas, recordatorios y tareas.
   Se monta sobre app.js sin alterar la operación de salidas.
   ============================================================ */

const TO_CALENDAR_STORAGE = "travelops_calendar_entries_v110";
const toCalendarState = {
  entries: [],
  profiles: new Map(),
  loaded: false,
  loading: false,
  error: "",
  selectedDate: "",
  editingId: ""
};

const TO_CALENDAR_TYPES = {
  nota: { label: "Nota", icon: "N" },
  cita: { label: "Cita", icon: "C" },
  recordatorio: { label: "Recordatorio", icon: "R" },
  tarea: { label: "Tarea", icon: "T" }
};

function toCalendarEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toCalendarDateLong(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(d);
}

function toCalendarTime(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function toCalendarActor(id) {
  return toCalendarState.profiles.get(id) || {
    id: id || "",
    name: id ? "Usuario" : "Sistema",
    avatar: ""
  };
}

function toCalendarCurrentActor() {
  try {
    if (typeof currentActor === "function") return currentActor();
  } catch (_) {}
  return {
    id: state?.user?.id || "demo-user",
    name: state?.user?.name || state?.user?.email || "Usuario",
    avatar: state?.user?.avatar || ""
  };
}

function toCalendarLocalLoad() {
  try {
    const raw = JSON.parse(localStorage.getItem(TO_CALENDAR_STORAGE) || "[]");
    toCalendarState.entries = Array.isArray(raw) ? raw : [];
  } catch (_) {
    toCalendarState.entries = [];
  }
  toCalendarState.loaded = true;
}

function toCalendarLocalSave() {
  try {
    localStorage.setItem(TO_CALENDAR_STORAGE, JSON.stringify(toCalendarState.entries));
  } catch (_) {}
}

async function hydrateCalendarEntries() {
  if (toCalendarState.loading) return;
  toCalendarState.loading = true;
  toCalendarState.error = "";
  try {
    if (!state.supabase) {
      toCalendarLocalLoad();
      renderCalendar();
      return;
    }

    const [{ data: entries, error }, { data: profiles }] = await Promise.all([
      state.supabase
        .from("calendar_entries")
        .select("*")
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true, nullsFirst: false }),
      state.supabase.from("profiles").select("id,full_name,avatar_data_url")
    ]);

    if (error) throw error;

    toCalendarState.profiles = new Map((profiles || []).map(p => [p.id, {
      id: p.id,
      name: p.full_name || "Usuario",
      avatar: p.avatar_data_url || ""
    }]));

    toCalendarState.entries = (entries || []).map(e => ({
      id: e.id,
      date: e.event_date,
      time: toCalendarTime(e.event_time),
      type: e.entry_type || "nota",
      title: e.title || "",
      description: e.description || "",
      brand: e.brand || "",
      status: e.status || "pendiente",
      createdBy: toCalendarActor(e.created_by),
      updatedBy: toCalendarActor(e.updated_by || e.created_by),
      createdAt: e.created_at,
      updatedAt: e.updated_at || e.created_at
    }));
    toCalendarState.loaded = true;
  } catch (err) {
    console.error("Travel Ops calendario:", err);
    toCalendarState.error = err?.message || "No se pudo cargar la agenda.";
  } finally {
    toCalendarState.loading = false;
    renderCalendar();
  }
}

function toCalendarEntriesForDate(date) {
  return toCalendarState.entries
    .filter(e => e.date === date)
    .sort((a, b) => {
      const ta = a.time || "99:99";
      const tb = b.time || "99:99";
      return ta.localeCompare(tb) || String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
}

function toCalendarEntryChip(entry) {
  const meta = TO_CALENDAR_TYPES[entry.type] || TO_CALENDAR_TYPES.nota;
  const brandClass = entry.brand ? ` brand-${entry.brand}` : "";
  const doneClass = entry.status === "hecho" ? " is-done" : "";
  const cancelledClass = entry.status === "cancelado" ? " is-cancelled" : "";
  const prefix = entry.time ? `${entry.time} · ` : "";
  return `<button type="button" class="calendar-note ${toCalendarEscape(entry.type)}${brandClass}${doneClass}${cancelledClass}" data-calendar-entry="${toCalendarEscape(entry.id)}" title="${toCalendarEscape(meta.label)}: ${toCalendarEscape(entry.title)}"><span class="calendar-note-icon">${meta.icon}</span><span>${toCalendarEscape(prefix + entry.title)}</span></button>`;
}

function toCalendarEnhanceGrid() {
  const grid = document.querySelector("#calendarGrid");
  if (!grid) return;

  if (!document.querySelector("#calendarClickHint")) {
    const toolbar = document.querySelector("#calendarView .calendar-toolbar");
    if (toolbar) {
      const hint = document.createElement("div");
      hint.id = "calendarClickHint";
      hint.className = "calendar-click-hint";
      hint.textContent = "Haz clic en cualquier fecha para agregar notas, citas, recordatorios o tareas.";
      toolbar.insertAdjacentElement("afterend", hint);
    }
  }

  const base = state.calendarDate;
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const mondayIndex = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(1 - mondayIndex);

  const cells = [...grid.querySelectorAll(".calendar-cell:not(.calendar-head)")];
  cells.forEach((cell, index) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + index);
    const iso = d.toISOString().slice(0, 10);
    cell.dataset.date = iso;
    cell.classList.add("calendar-date-clickable");

    const entries = toCalendarEntriesForDate(iso);
    if (entries.length) {
      const wrap = document.createElement("div");
      wrap.className = "calendar-notes";
      wrap.innerHTML = entries.map(toCalendarEntryChip).join("");
      cell.appendChild(wrap);
    }

    cell.addEventListener("click", e => {
      if (e.target.closest("[data-departure], [data-calendar-entry]")) return;
      openCalendarDay(iso);
    });
  });

  grid.querySelectorAll("[data-calendar-entry]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const entry = toCalendarState.entries.find(x => x.id === btn.dataset.calendarEntry);
      if (!entry) return;
      openCalendarDay(entry.date, entry.id);
    });
  });
}

function injectCalendarDialog() {
  if (document.querySelector("#calendarDayModal")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <dialog class="modal wide calendar-day-modal" id="calendarDayModal">
      <div class="detail-shell calendar-day-shell">
        <div class="modal-head">
          <div>
            <span class="eyebrow">AGENDA</span>
            <h3 id="calendarDayTitle">Fecha</h3>
          </div>
          <button class="icon-btn square" id="closeCalendarDay" type="button">×</button>
        </div>

        <div class="calendar-day-toolbar">
          <div>
            <strong id="calendarDayCount">0 elementos</strong>
            <small>Agenda compartida para todo el equipo.</small>
          </div>
          <button class="primary-btn compact" id="newCalendarEntryBtn" type="button">+ Agregar</button>
        </div>

        <div id="calendarDayEntries" class="calendar-day-entries"></div>

        <form id="calendarEntryForm" class="calendar-entry-form hidden">
          <input type="hidden" id="calendarEntryId" />
          <div class="calendar-entry-form-head">
            <div>
              <span class="eyebrow" id="calendarEntryEyebrow">NUEVO ELEMENTO</span>
              <h4 id="calendarEntryFormTitle">Agregar a la agenda</h4>
            </div>
            <button class="text-btn" id="cancelCalendarEntry" type="button">Cancelar</button>
          </div>

          <div class="form-grid">
            <label><span>Tipo</span><select id="calendarEntryType" required><option value="nota">Nota</option><option value="cita">Cita</option><option value="recordatorio">Recordatorio</option><option value="tarea">Tarea</option></select></label>
            <label><span>Hora (opcional)</span><input id="calendarEntryTime" type="time" /></label>
            <label class="full"><span>Título</span><input id="calendarEntryTitle" maxlength="120" placeholder="Ej. Llamar a agencia / Cita con cliente" required /></label>
            <label><span>Marca</span><select id="calendarEntryBrand"><option value="">General</option><option value="pink">Pink Sky Travel</option><option value="velora">Velora Travel</option></select></label>
            <label><span>Estatus</span><select id="calendarEntryStatus"><option value="pendiente">Pendiente</option><option value="hecho">Hecho</option><option value="cancelado">Cancelado</option></select></label>
            <label class="full"><span>Notas / detalle</span><textarea id="calendarEntryDescription" rows="4" placeholder="Detalles, teléfono, lugar, seguimiento, etc."></textarea></label>
          </div>

          <div class="modal-actions">
            <button class="ghost-btn" id="deleteCalendarEntry" type="button" hidden>Borrar</button>
            <button class="primary-btn" type="submit">Guardar</button>
          </div>
        </form>
      </div>
    </dialog>
  `);

  document.querySelector("#closeCalendarDay").addEventListener("click", () => document.querySelector("#calendarDayModal").close());
  document.querySelector("#newCalendarEntryBtn").addEventListener("click", () => openCalendarEntryForm());
  document.querySelector("#cancelCalendarEntry").addEventListener("click", () => closeCalendarEntryForm());
  document.querySelector("#calendarEntryForm").addEventListener("submit", saveCalendarEntry);
  document.querySelector("#deleteCalendarEntry").addEventListener("click", deleteCalendarEntry);
}

function openCalendarDay(date, editId = "") {
  injectCalendarDialog();
  toCalendarState.selectedDate = date;
  toCalendarState.editingId = "";
  document.querySelector("#calendarDayTitle").textContent = toCalendarDateLong(date);
  closeCalendarEntryForm();
  renderCalendarDayEntries();
  document.querySelector("#calendarDayModal").showModal();
  if (editId) openCalendarEntryForm(editId);
}

function renderCalendarDayEntries() {
  const wrap = document.querySelector("#calendarDayEntries");
  if (!wrap) return;
  const entries = toCalendarEntriesForDate(toCalendarState.selectedDate);
  document.querySelector("#calendarDayCount").textContent = `${entries.length} ${entries.length === 1 ? "elemento" : "elementos"}`;

  if (!entries.length) {
    wrap.innerHTML = `<div class="empty calendar-day-empty">No hay notas ni citas en esta fecha. Haz clic en <strong>+ Agregar</strong>.</div>`;
    return;
  }

  wrap.innerHTML = entries.map(entry => {
    const type = TO_CALENDAR_TYPES[entry.type] || TO_CALENDAR_TYPES.nota;
    const actor = entry.updatedBy || entry.createdBy || { name: "Usuario" };
    const statusLabel = entry.status === "hecho" ? "Hecho" : entry.status === "cancelado" ? "Cancelado" : "Pendiente";
    const brand = entry.brand === "pink" ? "Pink Sky Travel" : entry.brand === "velora" ? "Velora Travel" : "General";
    return `<article class="calendar-day-card ${toCalendarEscape(entry.type)} ${entry.status === "hecho" ? "is-done" : ""}">
      <button type="button" class="calendar-day-card-main" data-edit-calendar="${toCalendarEscape(entry.id)}">
        <div class="calendar-day-type">${type.icon}</div>
        <div class="calendar-day-copy">
          <div class="calendar-day-card-top"><strong>${toCalendarEscape(entry.title)}</strong><span>${entry.time ? toCalendarEscape(entry.time) : "Sin hora"}</span></div>
          ${entry.description ? `<p>${toCalendarEscape(entry.description)}</p>` : ""}
          <small>${toCalendarEscape(type.label)} · ${toCalendarEscape(brand)} · ${toCalendarEscape(statusLabel)} · ${toCalendarEscape(actor.name || "Usuario")}</small>
        </div>
      </button>
      <div class="calendar-day-card-actions">
        ${entry.status !== "hecho" ? `<button type="button" class="small-btn" data-complete-calendar="${toCalendarEscape(entry.id)}">Marcar hecho</button>` : ""}
        <button type="button" class="small-btn" data-edit-calendar="${toCalendarEscape(entry.id)}">Editar</button>
      </div>
    </article>`;
  }).join("");

  wrap.querySelectorAll("[data-edit-calendar]").forEach(btn => btn.addEventListener("click", () => openCalendarEntryForm(btn.dataset.editCalendar)));
  wrap.querySelectorAll("[data-complete-calendar]").forEach(btn => btn.addEventListener("click", () => completeCalendarEntry(btn.dataset.completeCalendar)));
}

function openCalendarEntryForm(id = "") {
  const form = document.querySelector("#calendarEntryForm");
  form.classList.remove("hidden");
  toCalendarState.editingId = id;
  const entry = id ? toCalendarState.entries.find(x => x.id === id) : null;

  document.querySelector("#calendarEntryId").value = entry?.id || "";
  document.querySelector("#calendarEntryType").value = entry?.type || "nota";
  document.querySelector("#calendarEntryTime").value = entry?.time || "";
  document.querySelector("#calendarEntryTitle").value = entry?.title || "";
  document.querySelector("#calendarEntryBrand").value = entry?.brand || "";
  document.querySelector("#calendarEntryStatus").value = entry?.status || "pendiente";
  document.querySelector("#calendarEntryDescription").value = entry?.description || "";
  document.querySelector("#calendarEntryEyebrow").textContent = entry ? "EDITAR ELEMENTO" : "NUEVO ELEMENTO";
  document.querySelector("#calendarEntryFormTitle").textContent = entry ? "Editar agenda" : "Agregar a la agenda";
  document.querySelector("#deleteCalendarEntry").hidden = !entry;
  setTimeout(() => document.querySelector("#calendarEntryTitle").focus(), 0);
}

function closeCalendarEntryForm() {
  toCalendarState.editingId = "";
  const form = document.querySelector("#calendarEntryForm");
  if (form) form.classList.add("hidden");
}

async function saveCalendarEntry(e) {
  e.preventDefault();
  const title = document.querySelector("#calendarEntryTitle").value.trim();
  if (!title) return;

  const actor = toCalendarCurrentActor();
  const payload = {
    event_date: toCalendarState.selectedDate,
    event_time: document.querySelector("#calendarEntryTime").value || null,
    entry_type: document.querySelector("#calendarEntryType").value,
    title,
    description: document.querySelector("#calendarEntryDescription").value.trim() || null,
    brand: document.querySelector("#calendarEntryBrand").value || null,
    status: document.querySelector("#calendarEntryStatus").value,
    updated_by: actor.id
  };

  try {
    if (state.supabase) {
      if (toCalendarState.editingId) {
        const { error } = await state.supabase.from("calendar_entries").update(payload).eq("id", toCalendarState.editingId);
        if (error) throw error;
      } else {
        const { data, error } = await state.supabase.from("calendar_entries").insert({ ...payload, created_by: actor.id }).select("id").single();
        if (error) throw error;
        toCalendarState.editingId = data?.id || "";
      }
    } else {
      const now = new Date().toISOString();
      if (toCalendarState.editingId) {
        const entry = toCalendarState.entries.find(x => x.id === toCalendarState.editingId);
        Object.assign(entry, {
          date: payload.event_date,
          time: toCalendarTime(payload.event_time),
          type: payload.entry_type,
          title: payload.title,
          description: payload.description || "",
          brand: payload.brand || "",
          status: payload.status,
          updatedBy: actor,
          updatedAt: now
        });
      } else {
        const id = `cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        toCalendarState.entries.push({
          id,
          date: payload.event_date,
          time: toCalendarTime(payload.event_time),
          type: payload.entry_type,
          title: payload.title,
          description: payload.description || "",
          brand: payload.brand || "",
          status: payload.status,
          createdBy: actor,
          updatedBy: actor,
          createdAt: now,
          updatedAt: now
        });
      }
      toCalendarLocalSave();
    }

    try {
      if (typeof logAction === "function") {
        await logAction("calendar_entry", toCalendarState.editingId || "", toCalendarState.editingId ? "updated" : "created", {
          date: payload.event_date,
          title: payload.title,
          type: payload.entry_type
        });
      }
    } catch (_) {}

    await hydrateCalendarEntries();
    closeCalendarEntryForm();
    renderCalendarDayEntries();
  } catch (err) {
    alert(err?.message || "No se pudo guardar el elemento de calendario.");
  }
}

async function completeCalendarEntry(id) {
  const entry = toCalendarState.entries.find(x => x.id === id);
  if (!entry) return;
  const actor = toCalendarCurrentActor();
  try {
    if (state.supabase) {
      const { error } = await state.supabase.from("calendar_entries").update({ status: "hecho", updated_by: actor.id }).eq("id", id);
      if (error) throw error;
    } else {
      entry.status = "hecho";
      entry.updatedBy = actor;
      entry.updatedAt = new Date().toISOString();
      toCalendarLocalSave();
    }
    try {
      if (typeof logAction === "function") await logAction("calendar_entry", id, "completed", { title: entry.title, date: entry.date });
    } catch (_) {}
    await hydrateCalendarEntries();
    renderCalendarDayEntries();
  } catch (err) {
    alert(err?.message || "No se pudo actualizar el elemento.");
  }
}

async function deleteCalendarEntry() {
  const id = toCalendarState.editingId;
  const entry = toCalendarState.entries.find(x => x.id === id);
  if (!id || !entry) return;
  if (!confirm(`¿Borrar "${entry.title}" de la agenda?`)) return;

  try {
    if (state.supabase) {
      const { error } = await state.supabase.from("calendar_entries").delete().eq("id", id);
      if (error) throw error;
    } else {
      toCalendarState.entries = toCalendarState.entries.filter(x => x.id !== id);
      toCalendarLocalSave();
    }
    try {
      if (typeof logAction === "function") await logAction("calendar_entry", id, "deleted", { title: entry.title, date: entry.date });
    } catch (_) {}
    await hydrateCalendarEntries();
    closeCalendarEntryForm();
    renderCalendarDayEntries();
  } catch (err) {
    alert(err?.message || "No se pudo borrar el elemento.");
  }
}

// Extiende renderCalendar sin tocar app.js.
const toCalendarBaseRender = renderCalendar;
renderCalendar = function () {
  toCalendarBaseRender();
  toCalendarEnhanceGrid();
};

// Carga la agenda cada vez que se abre la aplicación.
const toCalendarBaseShowMain = showMain;
showMain = function () {
  toCalendarBaseShowMain();
  hydrateCalendarEntries();
};

injectCalendarDialog();
