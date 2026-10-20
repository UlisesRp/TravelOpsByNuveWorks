// Travel Ops V3 · Reservas provenientes de cotizaciones.
// Incluye pagos/recibos, pasajeros, itinerario y confirmación imprimible.
(() => {
  let records = [];
  let passengersCount = new Map();
  let itineraryCache = new Map();
  let paymentRows = [];
  const el = id => document.getElementById(id);
  const esc = value => escapeHTML(String(value ?? ''));
  const fmt = value => value ? String(value).slice(0, 10).split('-').reverse().join('/') : '—';
  const peso = value => new Intl.NumberFormat('es-MX', {style:'currency',currency:'MXN'}).format(Number(value || 0));
  const flightDateText = value => {
    if (!value) return 'Fecha pendiente';
    const raw = String(value).replace(' ', 'T');
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
    if (!match) return raw;
    const [, y, m, d, h, min] = match;
    const date = new Date(Date.UTC(Number(y), Number(m)-1, Number(d)));
    if (Number.isNaN(date.getTime())) return raw;
    const nice = new Intl.DateTimeFormat('es-MX', {day:'numeric', month:'long',year:'numeric',timeZone:'UTC'}).format(date);
    // 00:00 puede ser el valor autocompletado, no un horario confirmado.
    return `${nice}${h && !(h === '00' && min === '00') ? ` · ${h}:${min} h` : ' · Horario por confirmar'}`;
  };
  const stateLabels = {por_confirmar:'Por confirmar',confirmada:'Confirmada',cancelada:'Cancelada'};

  function paymentsFor(r) { return paymentRows.filter(p => p.quote_id === r.v3_quote_id); }
  function paymentInfo(r) {
    const rows = paymentsFor(r);
    const total = Number(r.total_amount || 0);
    const paid = rows.reduce((sum,p)=>sum+Number(p.amount||0),0);
    return {rows,total,paid,balance:Math.max(0,total-paid)};
  }
  function paymentThrough(r,payment) {
    return paymentsFor(r)
      .filter(p => p.created_at < payment.created_at || (p.created_at === payment.created_at && p.id <= payment.id))
      .reduce((sum,p)=>sum+Number(p.amount||0),0);
  }
  function receiptPayload(r,p) {
    return {
      folio:p.receipt_number, brand:r.brand, customer:r.client_name, destination:r.destination,
      concept:`Reserva ${r.code}`, paidOn:p.paid_on, amount:Number(p.amount), total:Number(p.total_amount),
      paid:paymentThrough(r,p), method:p.method, reference:p.reference, notes:p.notes
    };
  }
  function receiptMessage(r,p) {
    const paid=paymentThrough(r,p), total=Number(p.total_amount||r.total_amount||0);
    return `Recibo ${p.receipt_number}\n${r.brand==='pink'?'Pink Sky Travel':'Velora Travel'}\nCliente: ${r.client_name}\nReserva: ${r.code}\nDestino: ${r.destination}\nAbono: ${peso(p.amount)}\nFecha: ${fmt(p.paid_on)}\nPagado acumulado: ${peso(paid)}\nSaldo: ${peso(Math.max(0,total-paid))}`;
  }
  async function downloadReceipt(r,p) {
    if (typeof createTravelReceiptPDF !== 'function' || typeof saveTravelReceipt !== 'function') return alert('El generador de recibos no está disponible.');
    const file=await createTravelReceiptPDF(receiptPayload(r,p)); if(file) saveTravelReceipt(file);
  }
  async function shareReceipt(r,p) {
    if (typeof createTravelReceiptPDF !== 'function' || typeof shareTravelReceiptFile !== 'function') return alert('El generador de recibos no está disponible.');
    const file=await createTravelReceiptPDF(receiptPayload(r,p)); if(file) await shareTravelReceiptFile(file,receiptMessage(r,p),'whatsapp');
  }
  function ensurePaymentDialog() {
    let dlg=el('v3ReservationPaymentDialog');
    if(dlg)return dlg;
    dlg=document.createElement('dialog');dlg.id='v3ReservationPaymentDialog';dlg.className='modal';
    dlg.style.cssText='width:min(760px,calc(100vw - 28px));max-height:90vh;overflow:auto;border:0;border-radius:18px;padding:0';
    dlg.innerHTML=`<div style="padding:23px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><span class="eyebrow">RESERVA V3 · COBRANZA</span><h2 style="margin:5px 0">Pagos y recibos</h2></div><button type="button" class="ghost-btn compact" id="v3PayClose">Cerrar</button></div><p id="v3PaySummary" class="muted"></p><form id="v3PayForm" style="display:grid;gap:12px;margin:16px 0;padding:16px;border:1px solid #dde3e9;border-radius:12px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><label>Monto recibido<input id="v3PayAmount" type="number" min="0.01" step="0.01" required></label><label>Fecha<input id="v3PayDate" type="date" required></label><label>Método<select id="v3PayMethod"><option>Transferencia</option><option>Efectivo</option><option>Tarjeta</option><option>Depósito</option><option>Otro</option></select></label><label>Referencia<input id="v3PayReference"></label></div><label>Notas<textarea id="v3PayNotes" rows="2"></textarea></label><div><button type="submit" class="primary-btn compact" id="v3PaySave">Registrar abono</button></div><p id="v3PayMessage" role="status" style="margin:0;color:#b42318"></p></form><section><h3>Historial de pagos</h3><div id="v3PayHistory"></div></section></div>`;
    document.body.appendChild(dlg);
    el('v3PayClose').addEventListener('click',()=>dlg.close());
    el('v3PayForm').addEventListener('submit',saveReservationPayment);
    el('v3PayHistory').addEventListener('click',async e=>{
      const btn=e.target.closest('[data-v3-pay-pdf],[data-v3-pay-share]');if(!btn)return;
      const r=records.find(x=>x.id===dlg.dataset.reservationId),p=paymentRows.find(x=>x.id===(btn.dataset.v3PayPdf||btn.dataset.v3PayShare));
      if(!r||!p)return;
      if(btn.dataset.v3PayPdf) await downloadReceipt(r,p); else await shareReceipt(r,p);
    });
    return dlg;
  }
  function renderPaymentDialog(r) {
    const info=paymentInfo(r), dlg=ensurePaymentDialog();
    el('v3PaySummary').textContent=`${r.code} · ${r.client_name} · Total ${peso(info.total)} · Pagado ${peso(info.paid)} · Saldo ${peso(info.balance)}`;
    const save=el('v3PaySave');save.disabled=info.balance<=0||r.status==='cancelada';
    el('v3PayAmount').disabled=save.disabled;el('v3PayMessage').textContent=info.balance<=0?'Reserva liquidada.':r.status==='cancelada'?'La reserva está cancelada.':'';
    const rows=[...info.rows].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
    el('v3PayHistory').innerHTML=rows.length?rows.map(p=>`<div style="padding:12px 0;border-top:1px solid #e6e9ef;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><strong>${esc(p.receipt_number)} · ${peso(p.amount)}</strong><div style="font-size:12px;color:#667085">${fmt(p.paid_on)} · ${esc(p.method||'—')}${p.reference?' · '+esc(p.reference):''}</div></div><div style="display:flex;gap:7px"><button type="button" class="ghost-btn compact" data-v3-pay-pdf="${esc(p.id)}">PDF</button><button type="button" class="ghost-btn compact" data-v3-pay-share="${esc(p.id)}">Enviar recibo</button></div></div>`).join(''):'<div class="empty">Sin pagos registrados.</div>';
  }
  function openPayments(id) {
    const r=records.find(x=>x.id===id);if(!r)return;
    const dlg=ensurePaymentDialog();dlg.dataset.reservationId=r.id;
    el('v3PayForm').reset();el('v3PayDate').value=new Date().toLocaleDateString('en-CA');
    renderPaymentDialog(r);dlg.showModal();
  }
  async function saveReservationPayment(event) {
    event.preventDefault();
    const dlg=ensurePaymentDialog(),r=records.find(x=>x.id===dlg.dataset.reservationId);if(!r)return;
    const info=paymentInfo(r),amount=Number(el('v3PayAmount').value),msg=el('v3PayMessage'),btn=el('v3PaySave');
    if(!r.v3_option_id){msg.textContent='La reserva no tiene opción de cotización vinculada.';return;}
    if(!Number.isFinite(amount)||amount<=0){msg.textContent='Captura un monto válido.';return;}
    if(amount>info.balance+0.001){msg.textContent='El abono supera el saldo pendiente.';return;}
    btn.disabled=true;msg.textContent='Guardando pago…';
    try{
      const sb=await window.getSupabase();if(!sb)throw new Error('Debes iniciar sesión.');
      const {data,error}=await sb.from('travelops_quote_payments').insert({quote_id:r.v3_quote_id,option_id:r.v3_option_id,total_amount:Number(r.total_amount),amount,paid_on:el('v3PayDate').value,method:el('v3PayMethod').value,reference:el('v3PayReference').value.trim(),notes:el('v3PayNotes').value.trim(),created_by:state.user.id}).select().single();
      if(error)throw error;
      paymentRows.push(data);el('v3PayAmount').value='';el('v3PayReference').value='';el('v3PayNotes').value='';
      renderPaymentDialog(r);render();
      if(typeof refreshQuotePayments==='function')await refreshQuotePayments();
      msg.style.color='#166534';msg.textContent=`Pago guardado · ${data.receipt_number}.`;
    }catch(err){msg.style.color='#b42318';msg.textContent='No se pudo guardar: '+(err.message||String(err));}
    finally{btn.disabled=paymentInfo(r).balance<=0||r.status==='cancelada';}
  }

  function render() {
    const list = el('v3ReservationList');
    if (!list) return;
    const search = (el('v3ReservationSearch')?.value || '').toLocaleLowerCase('es');
    const status = el('v3ReservationStatus')?.value || 'all';
    const brand = typeof state !== 'undefined' ? state.brand : 'all';
    const matches = records.filter(r =>
      (brand === 'all' || r.brand === brand) &&
      (status === 'all' || r.status === status) &&
      `${r.code} ${r.client_name} ${r.destination} ${r.hotel_service}`.toLocaleLowerCase('es').includes(search)
    );
    el('v3ReservationCount').textContent = `${matches.length} reserva(s) · ${brand === 'all' ? 'Pink + Velora' : brand === 'pink' ? 'Pink Sky' : 'Velora'}`;
    list.innerHTML = matches.length ? matches.map(r => {
      const count = passengersCount.get(r.id) || 0;
      const expected = Number(r.adults || 0) + Number(r.minors || 0);
      const pay = paymentInfo(r);
      return `<article style="border:1px solid #e0e4eb;border-radius:14px;padding:17px;background:white">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><small class="eyebrow">${esc(r.code)}</small><h3 style="margin:5px 0">${esc(r.destination)}</h3><p style="margin:3px 0">${esc(r.client_name)}</p></div><div style="text-align:right"><strong>${esc(stateLabels[r.status] || r.status)}</strong><div style="margin-top:6px">${esc(r.brand === 'pink' ? 'Pink Sky Travel' : 'Velora Travel')}</div></div></div>
        <div style="display:flex;flex-wrap:wrap;gap:10px 22px;margin:14px 0;font-size:13px"><span>Hotel: <strong>${esc(r.hotel_service || 'Sin hotel')}</strong></span><span>Viaje: <strong>${fmt(r.start_date)} – ${fmt(r.end_date)}</strong></span><span>Viajeros: <strong>${Number(r.adults||0)} adultos, ${Number(r.minors||0)} menores</strong></span><span>Total oficial: <strong>${peso(pay.total)}</strong></span><span>Pagado: <strong>${peso(pay.paid)}</strong></span><span>Saldo: <strong>${peso(pay.balance)}</strong></span><span>Pasajeros capturados: <strong>${count}/${expected}</strong></span></div>
        <div style="display:flex;gap:9px;flex-wrap:wrap"><button class="${pay.balance>0?'primary-btn':'ghost-btn'} compact" type="button" data-v3-res-payments="${esc(r.id)}">Pagos / recibos${pay.rows.length?` (${pay.rows.length})`:''}</button><button class="primary-btn compact" type="button" data-v3-res-pax="${esc(r.v3_quote_id)}">${count ? 'Ver / editar pasajeros' : 'Capturar pasajeros'}</button><button class="ghost-btn compact" type="button" data-v3-res-itinerary="${esc(r.id)}">Editar itinerario</button><button class="ghost-btn compact" type="button" data-v3-res-preview="${esc(r.id)}">Vista de confirmación</button><button class="${r.signed_at?'ghost-btn':'primary-btn'} compact" type="button" data-v3-res-sign="${esc(r.id)}">${r.signed_at?'Enlace firmado ✓':'Enviar a firma'}</button><button class="ghost-btn compact" type="button" data-v3-res-quote="${esc(r.v3_quote_id)}">Ver cotización</button></div>
      </article>`;
    }).join('') : `<div class="empty">No hay reservas V3 con estos filtros.</div>`;
    list.querySelectorAll('[data-v3-res-payments]').forEach(b => b.addEventListener('click', () => openPayments(b.dataset.v3ResPayments)));
    list.querySelectorAll('[data-v3-res-itinerary]').forEach(b => b.addEventListener('click', () => openItinerary(b.dataset.v3ResItinerary)));
    list.querySelectorAll('[data-v3-res-preview]').forEach(b => b.addEventListener('click', () => preview(b.dataset.v3ResPreview)));
    list.querySelectorAll('[data-v3-res-sign]').forEach(b => b.addEventListener('click', () => shareReservationForSignature(b.dataset.v3ResSign)));
    list.querySelectorAll('[data-v3-res-pax]').forEach(b => b.addEventListener('click', () => {
      if (typeof openV3Passengers !== 'function') return alert('El expediente de pasajeros no está disponible.');
      openV3Passengers(b.dataset.v3ResPax);
    }));
    list.querySelectorAll('[data-v3-res-quote]').forEach(b => b.addEventListener('click', () => {
      const q = typeof quotesStore !== 'undefined' && quotesStore.find(x => x.id === b.dataset.v3ResQuote);
      switchView('quotes');
      if (q && typeof openQuoteModal === 'function') openQuoteModal(q.id);
      else alert('Ve a Cotizaciones y busca el folio relacionado.');
    }));
  }


  function dayList(start, end) {
    const result = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end || '')) return result;
    let time = Date.parse(`${start}T12:00:00Z`), last = Date.parse(`${end}T12:00:00Z`);
    if (!Number.isFinite(time) || !Number.isFinite(last) || last < time) return result;
    for (; time <= last && result.length < 180; time += 86400000) result.push(new Date(time).toISOString().slice(0,10));
    return result;
  }
  function ensureItineraryDialog() {
    let dlg = el('v3ItineraryDialog');
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = 'v3ItineraryDialog'; dlg.className = 'modal';
    dlg.style.cssText = 'width:min(850px,calc(100vw - 28px));max-height:90vh;overflow:auto;border:0;border-radius:18px;padding:0';
    dlg.innerHTML = `<div style="padding:23px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><span class="eyebrow">RESERVA V3 · ITINERARIO</span><h2 style="margin:5px 0">Itinerario editable</h2></div><button type="button" class="ghost-btn compact" id="v3ItinClose">Cerrar</button></div><p id="v3ItinInfo" class="muted"></p><div id="v3ItinDays" style="display:grid;gap:13px"></div><form id="v3ItinForm" style="display:grid;gap:12px;margin-top:18px;padding:16px;border:1px solid #dde3e9;border-radius:12px"><h3 id="v3ItinFormTitle" style="margin:0">Nueva actividad</h3><input type="hidden" id="v3ItinEditId"><label>Fecha<input type="date" id="v3ItinDate" required></label><label>Hora (opcional)<input type="time" id="v3ItinTime"></label><label>Actividad<input id="v3ItinTitle" maxlength="180" required placeholder="Ej. Traslado aeropuerto–hotel"></label><label>Descripción / detalles<textarea id="v3ItinDescription" rows="3" maxlength="3000"></textarea></label><label>Punto / lugar (opcional)<input id="v3ItinMeeting" maxlength="500" placeholder="Ej. Lobby del hotel"></label><label>Ubicación / enlace (opcional)<input id="v3ItinLocation" type="url" maxlength="1200" placeholder="https://maps.google.com/... o enlace de Waze"></label><label>Notas internas o indicaciones (opcional)<textarea id="v3ItinNotes" rows="2" maxlength="2000"></textarea></label><p class="muted" style="margin:0">Solo agrega servicios realmente contratados o información autorizada. Los días vacíos no se guardan como actividades.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="submit" class="primary-btn compact" id="v3ItinSave">Guardar actividad</button><button type="button" class="ghost-btn compact" id="v3ItinCancel">Cancelar edición</button><button type="button" class="ghost-btn compact" id="v3ItinDelete" hidden>Eliminar actividad</button></div><p id="v3ItinError" role="status" style="color:#b42318;margin:0"></p></form></div>`;
    document.body.appendChild(dlg);
    el('v3ItinClose').addEventListener('click', () => dlg.close());
    el('v3ItinCancel').addEventListener('click', () => resetItineraryForm());
    el('v3ItinDelete').addEventListener('click', deleteItineraryActivity);
    el('v3ItinForm').addEventListener('submit', saveItineraryActivity);
    return dlg;
  }
  let itineraryReservationId = null;
  function resetItineraryForm(date = '') {
    el('v3ItinForm').reset(); el('v3ItinEditId').value = '';
    el('v3ItinFormTitle').textContent = 'Nueva actividad';
    const r=records.find(x=>x.id===itineraryReservationId);
    el('v3ItinDate').min=r?.start_date||''; el('v3ItinDate').max=r?.end_date||'';
    el('v3ItinDate').value=date||r?.start_date||'';
    el('v3ItinDelete').hidden=true;
    el('v3ItinError').style.color='#b42318';
    el('v3ItinError').textContent='';
  }
  async function getItinerary(id, refresh=false) {
    if (!refresh && itineraryCache.has(id)) return itineraryCache.get(id);
    const sb=await window.getSupabase();
    if(!sb) throw new Error('Debes iniciar sesión.');
    const {data,error}=await sb.from('v3_reservation_itinerary')
      .select('id,reservation_id,activity_date,activity_time,title,description,meeting_point,location_url,notes,sort_order')
      .eq('reservation_id',id).order('activity_date').order('activity_time').order('sort_order');
    if(error) throw error;
    itineraryCache.set(id,data||[]); return data||[];
  }
  function safeHttpUrl(value) {
    const raw=String(value||'').trim();
    if(!raw) return '';
    try {
      const u=new URL(raw);
      return ['http:','https:'].includes(u.protocol)?u.href:'';
    } catch { return ''; }
  }
  function renderItineraryDays(r, rows) {
    const dates=dayList(r.start_date,r.end_date);
    if(!dates.length) {el('v3ItinDays').textContent='Fechas de reserva inválidas o periodo superior a 180 días.';return;}
    el('v3ItinDays').innerHTML=dates.map((day,i)=>{
      const activities=rows.filter(x=>x.activity_date===day);
      return `<section style="padding:13px;border:1px solid #dce1e9;border-radius:12px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><strong>Día ${i+1} · ${fmt(day)}</strong><button class="ghost-btn compact" type="button" data-itin-add="${day}">+ Actividad</button></div>${activities.length?activities.map(a=>`<div style="padding:10px 0;border-top:1px solid #eee;margin-top:9px;display:flex;align-items:start;justify-content:space-between;gap:10px"><div><strong>${esc(a.activity_time?String(a.activity_time).slice(0,5)+' · ':'')}${esc(a.title)}</strong>${a.description?`<div>${esc(a.description)}</div>`:''}${a.meeting_point?`<small style="display:block">Lugar: ${esc(a.meeting_point)}</small>`:''}${safeHttpUrl(a.location_url)?`<a href="${esc(safeHttpUrl(a.location_url))}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:4px">Abrir ubicación ↗</a>`:''}${a.notes?`<small style="display:block;margin-top:4px;color:#667085">Notas: ${esc(a.notes)}</small>`:''}</div><button type="button" class="ghost-btn compact" data-itin-edit="${esc(a.id)}">Editar</button></div>`).join(''):'<p class="muted" style="margin:8px 0 0">Sin actividades capturadas</p>'}</section>`;
    }).join('');
    el('v3ItinDays').querySelectorAll('[data-itin-add]').forEach(b=>b.addEventListener('click',()=>{resetItineraryForm(b.dataset.itinAdd);el('v3ItinForm').scrollIntoView({block:'nearest',behavior:'smooth'});}));
    el('v3ItinDays').querySelectorAll('[data-itin-edit]').forEach(b=>b.addEventListener('click',()=>{
      const a=rows.find(x=>x.id===b.dataset.itinEdit);if(!a)return;
      resetItineraryForm(a.activity_date);el('v3ItinEditId').value=a.id;
      el('v3ItinDate').value=a.activity_date;el('v3ItinTime').value=String(a.activity_time||'').slice(0,5);
      el('v3ItinTitle').value=a.title||'';el('v3ItinDescription').value=a.description||'';
      el('v3ItinMeeting').value=a.meeting_point||'';el('v3ItinLocation').value=a.location_url||'';el('v3ItinNotes').value=a.notes||'';
      el('v3ItinFormTitle').textContent='Editar actividad';el('v3ItinDelete').hidden=false;
      el('v3ItinForm').scrollIntoView({block:'nearest',behavior:'smooth'});
    }));
  }
  async function openItinerary(id) {
    const r=records.find(x=>x.id===id);if(!r)return;
    itineraryReservationId=id;
    const dlg=ensureItineraryDialog();
    el('v3ItinInfo').textContent=`${r.code} · ${r.destination} · ${fmt(r.start_date)} al ${fmt(r.end_date)}`;
    el('v3ItinDays').textContent='Cargando itinerario…';resetItineraryForm();dlg.showModal();
    try {renderItineraryDays(r,await getItinerary(id,true));}
    catch(err){el('v3ItinDays').textContent='No se pudo cargar el itinerario: '+(err.message||String(err));}
  }
  async function saveItineraryActivity(event) {
    event.preventDefault();
    const r=records.find(x=>x.id===itineraryReservationId);if(!r)return;
    const date=el('v3ItinDate').value, id=el('v3ItinEditId').value;
    if(date<r.start_date||date>r.end_date){el('v3ItinError').textContent='La fecha debe estar dentro del periodo del viaje.';return;}
    const locationRaw=el('v3ItinLocation').value.trim();
    if(locationRaw && !safeHttpUrl(locationRaw)){el('v3ItinError').textContent='El enlace de ubicación debe comenzar con http:// o https://';return;}
    const payload={reservation_id:r.id,activity_date:date,activity_time:el('v3ItinTime').value||null,title:el('v3ItinTitle').value.trim(),description:el('v3ItinDescription').value.trim()||null,meeting_point:el('v3ItinMeeting').value.trim()||null,location_url:locationRaw||null,notes:el('v3ItinNotes').value.trim()||null};
    if(!payload.title){el('v3ItinError').textContent='Escribe el nombre de la actividad.';return;}
    const btn=el('v3ItinSave');btn.disabled=true;el('v3ItinError').textContent='Guardando…';
    try {
      const sb=await window.getSupabase();if(!sb)throw new Error('Debes iniciar sesión.');
      const query=id?sb.from('v3_reservation_itinerary').update(payload).eq('id',id).eq('reservation_id',r.id):sb.from('v3_reservation_itinerary').insert(payload);
      const {error}=await query;if(error)throw error;
      const rows=await getItinerary(r.id,true);renderItineraryDays(r,rows);resetItineraryForm(date);
      el('v3ItinError').style.color='#166534';el('v3ItinError').textContent='Actividad guardada.';
    }catch(err){el('v3ItinError').style.color='#b42318';el('v3ItinError').textContent='No se pudo guardar: '+(err.message||String(err));}
    finally{btn.disabled=false;}
  }

  async function deleteItineraryActivity() {
    const r=records.find(x=>x.id===itineraryReservationId);if(!r)return;
    const id=el('v3ItinEditId').value;if(!id)return;
    if(!confirm('¿Eliminar esta actividad del itinerario?')) return;
    const btn=el('v3ItinDelete');btn.disabled=true;el('v3ItinError').textContent='Eliminando…';
    try {
      const sb=await window.getSupabase();if(!sb)throw new Error('Debes iniciar sesión.');
      const {error}=await sb.from('v3_reservation_itinerary').delete().eq('id',id).eq('reservation_id',r.id);
      if(error)throw error;
      const rows=await getItinerary(r.id,true);renderItineraryDays(r,rows);resetItineraryForm();
      el('v3ItinError').style.color='#166534';el('v3ItinError').textContent='Actividad eliminada.';
    } catch(err) {
      el('v3ItinError').style.color='#b42318';el('v3ItinError').textContent='No se pudo eliminar: '+(err.message||String(err));
    } finally {btn.disabled=false;}
  }

  async function confirmationData(r) {
    const sb=await window.getSupabase();
    if(!sb) throw new Error('Debes iniciar sesión.');
    const {data:pax,error:pe}=await sb.from('passengers').select('first_name,last_name_1,last_name_2,birth_date').eq('reservation_id',r.id).order('created_at');
    if(pe) throw pe;
    const itinerary=await getItinerary(r.id,true);
    const snap=r.v3_services_snapshot||{};
    const flights=Array.isArray(snap.flights)?snap.flights:[];
    const services=Array.isArray(snap.services)?snap.services:[];
    return {people:pax||[],itinerary,flights,services};
  }

  function confirmationShareMessage(r) {
    const brandName=r.brand==='pink'?'Pink Sky Travel':'Velora Travel';
    return `Hola ${r.client_name||''}. Te compartimos la confirmación de tu reserva ${r.code}.\n\nDestino: ${r.destination}\nViaje: ${fmt(r.start_date)} al ${fmt(r.end_date)}\n\n${brandName}`;
  }

  async function createConfirmationPDF(r) {
    if(typeof loadReceiptPdfLibrary!=='function') throw new Error('No está disponible el generador PDF.');
    const PDF=await loadReceiptPdfLibrary();
    const pdf=new PDF({unit:'mm',format:'a4'});
    const brandName=r.brand==='pink'?'Pink Sky Travel':'Velora Travel';
    const accent=r.brand==='pink'?[98,35,112]:[29,83,70];
    const dark=[29,38,56],muted=[99,109,123];
    const {people,itinerary,flights,services}=await confirmationData(r);
    const logo=typeof receiptLogoData==='function'?await receiptLogoData(r.brand):null;
    const money=n=>Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
    let y=18;
    const left=17,right=193,width=176;
    const setText=(size=10,bold=false,color=dark)=>{pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(...color);};
    const ensure=(space=12)=>{if(y+space>278){pdf.addPage();y=18;}};
    const line=(txt,size=10,bold=false,indent=0,color=dark,maxWidth=width-indent)=>{
      ensure(8);
      setText(size,bold,color);
      const lines=pdf.splitTextToSize(String(txt??'—'),maxWidth);
      pdf.text(lines,left+indent,y);
      y+=lines.length*(size*0.38+1.6);
    };
    const section=title=>{ensure(14);y+=3;setText(11,true,accent);pdf.text(title,left,y);y+=3;pdf.setDrawColor(...accent);pdf.line(left,y,right,y);y+=6;};
    const field=(label,value)=>{ensure(9);setText(8,true,muted);pdf.text(label.toUpperCase(),left,y);setText(10,false,dark);const lines=pdf.splitTextToSize(String(value??'—'),118);pdf.text(lines,72,y);y+=Math.max(8,lines.length*5);};

    pdf.setFillColor(...accent);pdf.rect(0,0,210,7,'F');
    if(logo){
      try{
        const props=pdf.getImageProperties(logo),boxX=17,boxY=14,boxW=25,boxH=25,ratio=Math.min(boxW/props.width,boxH/props.height),imgW=props.width*ratio,imgH=props.height*ratio;
        pdf.addImage(logo,'PNG',boxX+(boxW-imgW)/2,boxY+(boxH-imgH)/2,imgW,imgH,undefined,'FAST');
      }catch(err){console.warn('Travel Ops confirmación: logo',err);}
    }
    setText(16,true,dark);pdf.text(brandName,50,23);
    setText(20,true,dark);pdf.text('CONFIRMACIÓN DE RESERVA',left,48);
    setText(10,false,muted);pdf.text(`Reserva ${r.code}`,left,57);
    pdf.setDrawColor(225,228,233);pdf.line(left,63,right,63);y=73;

    section('DATOS DE LA RESERVA');
    field('Cliente',r.client_name);
    field('Destino',r.destination);
    field('Fechas',`${fmt(r.start_date)} al ${fmt(r.end_date)}`);
    field('Hotel / plan',r.hotel_service||'—');
    field('Viajeros',`${Number(r.adults||0)} adultos y ${Number(r.minors||0)} menores`);
    field('Total contratado',money(r.total_amount));

    section(`PASAJEROS (${people.length}/${Number(r.adults||0)+Number(r.minors||0)})`);
    if(people.length) people.forEach((p,i)=>line(`${i+1}. ${[p.first_name,p.last_name_1,p.last_name_2].filter(Boolean).join(' ')} · Nacimiento: ${fmt(p.birth_date)}`,9,false));
    else line('Pasajeros pendientes de captura.',9,false,0,muted);

    section('VUELOS');
    if(flights.length){
      flights.forEach(f=>{
        line(f.route||'Vuelo',10,true);
        line(`Salida: ${f.departureText||'—'} · ${flightDateText(f.departureAt)}`,9,false,4);
        line(`Regreso: ${f.returnText||'—'} · ${flightDateText(f.returnAt)}`,9,false,4);
        line(`Equipaje: ${f.baggage||'—'}`,9,false,4);
        y+=2;
      });
    }else line('No se incluyeron vuelos en esta reserva.',9,false,0,muted);

    section('TOURS, TRASLADOS Y OTROS SERVICIOS');
    if(services.length){
      services.forEach(x=>{
        line(`${x.name||'Servicio'} · ${x.type||'Otro'}`,10,true);
        if(x.detail) line(x.detail,9,false,4);
        if(x.notes) line(`Notas: ${x.notes}`,8,false,4,muted);
        y+=2;
      });
    }else line('No se registraron servicios adicionales.',9,false,0,muted);

    section('ITINERARIO');
    if(itinerary.length){
      itinerary.forEach(a=>{
        line(`${fmt(a.activity_date)}${a.activity_time?' · '+String(a.activity_time).slice(0,5):''} — ${a.title}`,10,true);
        if(a.description) line(a.description,9,false,4);
        if(a.meeting_point) line(`Lugar: ${a.meeting_point}`,9,false,4);
        if(a.location_url) line(`Ubicación: ${a.location_url}`,8,false,4,[20,75,150]);
        if(a.notes) line(`Notas: ${a.notes}`,8,false,4,muted);
        y+=2;
      });
    }else line('Itinerario pendiente de elaboración.',9,false,0,muted);

    ensure(20);y+=5;pdf.setDrawColor(225,228,233);pdf.line(left,y,right,y);y+=7;
    setText(8,false,muted);pdf.text('Documento de confirmación generado por Travel Ops by Nuve Works. No sustituye un CFDI.',left,y);
    const filename=`CONFIRMACION-${String(r.code||'RESERVA').replace(/[^a-z0-9_-]/gi,'_')}.pdf`;
    return new File([pdf.output('blob')],filename,{type:'application/pdf'});
  }

  function saveConfirmationFile(file){
    const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
  }

  async function shareConfirmation(r) {
    const file=await createConfirmationPDF(r);
    const message=confirmationShareMessage(r);
    if(navigator.share&&navigator.canShare?.({files:[file]})){
      try{await navigator.share({files:[file],title:'Confirmación de reserva',text:message});return;}
      catch(err){if(err.name==='AbortError')return;console.warn('Travel Ops confirmación: compartir archivo',err);}
    }
    saveConfirmationFile(file);
    window.open('https://wa.me/?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
    alert(`La confirmación se descargó como ${file.name}. Adjunta ese PDF en WhatsApp antes de enviar.`);
  }

  function ensurePreview() {
    let dlg = el('v3ConfirmationPreview');
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = 'v3ConfirmationPreview';
    dlg.className = 'modal';
    dlg.style.cssText = 'width:min(850px,calc(100vw - 28px));max-height:90vh;overflow:auto;border:0;border-radius:18px;padding:0';
    dlg.innerHTML = `<div style="padding:22px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><span class="eyebrow">TRAVEL OPS V3 · VISTA PREVIA INTERNA</span><h2 style="margin:6px 0">Confirmación de reserva</h2></div><button type="button" class="ghost-btn compact" id="v3PreviewClose">Cerrar</button></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:14px"><button type="button" class="primary-btn compact" id="v3CustomerPreviewBtn" disabled>Ver como cliente (simulación)</button><button type="button" class="ghost-btn compact" id="v3PrintConfirmationBtn" disabled>Imprimir / PDF</button><button type="button" class="ghost-btn compact" id="v3ShareConfirmationBtn" disabled>Enviar PDF</button><button type="button" class="primary-btn compact" id="v3SendSignatureBtn" disabled>Enviar enlace para firma</button><small style="color:#667085">El PDF sirve como documento; el enlace permite que el cliente revise, acepte y firme electrónicamente la reserva.</small></div><div id="v3PreviewContent" aria-live="polite"></div><p style="margin:18px 0 4px;color:#667085;font-weight:700">Antes de mandar a firma verifica pasajeros, servicios, itinerario y total contratado.</p></div>`;
    document.body.appendChild(dlg);
    el('v3PreviewClose').addEventListener('click',()=>dlg.close());
    el('v3CustomerPreviewBtn').addEventListener('click', () => {
      const body=el('v3PreviewContent').innerHTML;
      if (!body) return;
      const win=window.open('', '_blank');
      if (!win) return alert('Permite ventanas emergentes para ver la simulación.');
      const page=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vista de cliente · Borrador de reserva</title><style>*{box-sizing:border-box}body{font-family:system-ui,-apple-system,Arial,sans-serif;background:#f2f4f8;color:#162033;margin:0;padding:28px 12px}.wrap{max-width:780px;margin:auto;background:white;border-radius:18px;padding:28px;box-shadow:0 10px 38px #15263b17}.banner{background:#fff5e7;border:1px solid #ffd18d;border-radius:12px;padding:13px;margin-bottom:18px;font-weight:700;color:#874400}h1{margin:0 0 16px;font-size:23px}h3{color:#273c51}ol{padding-left:25px}small{color:#667085}@media(max-width:600px){body{padding:0}.wrap{border-radius:0;padding:18px}}</style></head><body><main class="wrap"><div class="banner">VISTA DE PRUEBA · Documento no enviado, no aceptado y no firmado.</div><h1>Confirmación de reserva</h1>${body}<p style="border-top:1px solid #ddd;padding-top:15px;color:#667085">Vista de revisión. No incluye firma ni aceptación de términos.</p></main></body></html>`;
      win.document.open(); win.document.write(page); win.document.close();
    });
    el('v3PrintConfirmationBtn').addEventListener('click', () => {
      const id=dlg.dataset.reservationId;
      const r=records.find(x=>x.id===id);const body=el('v3PreviewContent').innerHTML;
      if(!r||!body)return;
      const logo=new URL(r.brand==='pink'?'assets/pink-logo.png':'assets/velora-logo.png',location.href).href;
      const brandName=r.brand==='pink'?'Pink Sky Travel':'Velora Travel';
      const win=window.open('', '_blank', 'width=900,height=760');
      if(!win)return alert('Permite ventanas emergentes para imprimir la confirmación.');
      const page=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirmación ${esc(r.code)}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;margin:0;background:#fff;font-size:11px}.sheet{max-width:780px;margin:auto}.head{display:flex;align-items:center;gap:18px;border-bottom:3px solid ${r.brand==='pink'?'#622370':'#1d5346'};padding-bottom:14px;margin-bottom:14px}.head img{width:72px;height:72px;object-fit:contain}.head h1{margin:0;font-size:23px}.head p{margin:4px 0 0;color:#667085}.sheet h3{font-size:13px;color:${r.brand==='pink'?'#622370':'#1d5346'};page-break-after:avoid}.sheet section{break-inside:avoid}.sheet a{color:#1457a6}.foot{margin-top:20px;padding-top:10px;border-top:1px solid #ddd;color:#667085;font-size:9px}.toolbar{position:sticky;top:0;background:#111827;color:white;padding:10px;display:flex;justify-content:center}.toolbar button{border:0;border-radius:8px;padding:9px 13px;font-weight:700;cursor:pointer}@media print{.toolbar{display:none}.sheet{max-width:none}}</style></head><body><div class="toolbar"><button onclick="window.print()">Imprimir / Guardar PDF</button></div><main class="sheet"><header class="head"><img src="${logo}" alt="${esc(brandName)}"><div><h1>CONFIRMACIÓN DE RESERVA</h1><p>${esc(brandName)} · ${esc(r.code)}</p></div></header>${body}<footer class="foot">Documento de confirmación generado por Travel Ops by Nuve Works. Revisa los datos antes de compartir con el cliente.</footer></main></body></html>`;
      win.document.open();win.document.write(page);win.document.close();
      setTimeout(()=>{win.focus();win.print();},350);
    });
    el('v3ShareConfirmationBtn').addEventListener('click', async () => {
      const id=dlg.dataset.reservationId;
      const r=records.find(x=>x.id===id);
      if(!r)return alert('No se encontró la reserva.');
      const btn=el('v3ShareConfirmationBtn');
      const original=btn.textContent;
      btn.disabled=true;btn.textContent='Preparando PDF…';
      try{await shareConfirmation(r);}
      catch(err){alert('No se pudo preparar la confirmación: '+(err.message||String(err)));}
      finally{btn.disabled=false;btn.textContent=original;}
    });
    el('v3SendSignatureBtn').addEventListener('click', async () => {
      const id=dlg.dataset.reservationId;
      dlg.close();
      await shareReservationForSignature(id);
    });
    return dlg;
  }
  async function preview(id) {
    const dlg=ensurePreview(), content=el('v3PreviewContent');
    content.textContent='Cargando confirmación…'; el('v3CustomerPreviewBtn').disabled=true;el('v3PrintConfirmationBtn').disabled=true;el('v3ShareConfirmationBtn').disabled=true;el('v3SendSignatureBtn').disabled=true;dlg.dataset.reservationId=id; dlg.showModal();
    try {
      const r=records.find(row=>row.id===id);
      if (!r) throw new Error('No se encontró la reserva.');
      const sb=await window.getSupabase();
      if (!sb) throw new Error('Debes iniciar sesión.');
      const {data:pax,error:pe}=await sb.from('passengers').select('first_name,last_name_1,last_name_2,birth_date').eq('reservation_id',r.id).order('created_at');
      if (pe) throw pe;
      const people=pax||[], total=Number(r.adults||0)+Number(r.minors||0);
      const itinerary=await getItinerary(r.id,true);
      const snap=r.v3_services_snapshot||{};
      const flights=Array.isArray(snap.flights)?snap.flights:[];
      const services=Array.isArray(snap.services)?snap.services:[];
      const age=(birth,at)=>{
        if(!birth||!at)return '—';
        const [y,m,d]=String(birth).slice(0,10).split('-').map(Number);
        const [yy,mm,dd]=String(at).slice(0,10).split('-').map(Number);
        if(!y||!m||!d||!yy)return '—';
        return String(yy-y-((mm<m||(mm===m&&dd<d))?1:0));
      };
      const group=(title,body)=>`<section style="margin:16px 0"><h3 style="font-size:15px;border-bottom:1px solid #ddd;padding-bottom:7px">${title}</h3>${body}</section>`;
      const row=(key,value)=>`<div style="padding:5px 0"><strong>${key}:</strong> ${esc(value||'—')}</div>`;
      content.innerHTML=`<div style="margin-top:16px;padding:16px;border:1px solid #dce1e9;border-radius:12px">
        <div style="font-weight:800">${esc(r.brand==='pink'?'PINK SKY TRAVEL':'VELORA TRAVEL')}</div>
        <div style="font-size:12px;color:#667085">${esc(r.code)} · Estado: ${esc(stateLabels[r.status]||r.status)}</div>
        ${group('Datos de la reserva',row('Cliente',r.client_name)+row('Destino',r.destination)+row('Fechas',`${fmt(r.start_date)} al ${fmt(r.end_date)}`)+row('Hotel y plan',r.hotel_service)+row('Total contratado',peso(r.total_amount))+row('Viajeros',`${r.adults} adultos y ${r.minors} menores`))}
        ${group(`Pasajeros (${people.length}/${total})`,people.length?`<ol>${people.map(p=>`<li style="margin:6px 0">${esc([p.first_name,p.last_name_1,p.last_name_2].filter(Boolean).join(' '))} · Nacimiento: ${esc(fmt(p.birth_date))} · Edad al viajar: ${esc(age(p.birth_date,r.start_date))} años</li>`).join('')}</ol>`:'<p>Falta capturar pasajeros.</p>')}
        ${group('Vuelos',flights.length?flights.map(f=>`<div style="padding:9px 0;border-bottom:1px solid #eee"><strong>${esc(f.route||'Vuelo')}</strong><div>Salida: ${esc(f.departureText||'—')} · ${esc(flightDateText(f.departureAt))}</div><div>Regreso: ${esc(f.returnText||'—')} · ${esc(flightDateText(f.returnAt))}</div><div>Equipaje: ${esc(f.baggage||'—')}</div></div>`).join(''):'<p>No se incluyeron vuelos en la reserva.</p>')}
        ${group('Tours, traslados y otros servicios',services.length?services.map(x=>`<div style="padding:8px 0;border-bottom:1px solid #eee"><strong>${esc(x.name||'Servicio')}</strong> · ${esc(x.type||'Otro')}<div>${esc(x.detail||'')}</div>${x.notes?`<small>${esc(x.notes)}</small>`:''}</div>`).join(''):'<p>No se registraron servicios adicionales.</p>')}
        ${group('Itinerario',itinerary.length?itinerary.map(a=>`<div style="padding:8px 0;border-bottom:1px solid #eee"><strong>${esc(fmt(a.activity_date))}${a.activity_time?' · '+esc(String(a.activity_time).slice(0,5)):''} — ${esc(a.title)}</strong>${a.description?`<div>${esc(a.description)}</div>`:''}${a.meeting_point?`<small style="display:block">Lugar: ${esc(a.meeting_point)}</small>`:''}${safeHttpUrl(a.location_url)?`<a href="${esc(safeHttpUrl(a.location_url))}" target="_blank" rel="noopener noreferrer">Abrir ubicación ↗</a>`:''}${a.notes?`<small style="display:block;color:#667085;margin-top:3px">Notas: ${esc(a.notes)}</small>`:''}</div>`).join(''):'<p>Itinerario pendiente de elaboración.</p>')}
        ${group('Aceptación del cliente',r.signed_at?`<p><strong>Firmada por ${esc(r.signed_by||'cliente')}</strong><br><small>${esc(new Date(r.signed_at).toLocaleString('es-MX'))}</small></p>`:'<p>Pendiente de firma y aceptación electrónica del cliente.</p>')}
      </div>`;
      el('v3CustomerPreviewBtn').disabled=false;el('v3PrintConfirmationBtn').disabled=false;el('v3ShareConfirmationBtn').disabled=false;el('v3SendSignatureBtn').disabled=false;
    } catch(err) {content.textContent='No se pudo preparar la confirmación: '+(err.message||String(err));}
  }


  function reservationShareURL(r) {
    const url=new URL(location.href);
    url.hash='';url.search='';
    url.searchParams.set('reservation',r.id);
    url.searchParams.set('token',r.share_token);
    return url.toString();
  }

  function ensureReservationShareDialog(){
    let dlg=el('v3ReservationShareDialog');
    if(dlg)return dlg;
    dlg=document.createElement('dialog');dlg.id='v3ReservationShareDialog';dlg.className='modal';
    dlg.style.cssText='width:min(700px,calc(100vw - 28px));border:0;border-radius:18px;padding:0';
    dlg.innerHTML=`<div style="padding:23px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><span class="eyebrow">RESERVA V3 · FIRMA DEL CLIENTE</span><h2 style="margin:5px 0">Compartir enlace de aceptación</h2></div><button type="button" class="ghost-btn compact" id="v3SignShareClose">Cerrar</button></div><p id="v3SignShareStatus" class="muted"></p><label style="display:grid;gap:6px;margin-top:15px"><span>Enlace del cliente</span><div style="display:flex;gap:8px"><input id="v3SignShareLink" readonly style="flex:1"><button type="button" class="ghost-btn compact" id="v3SignCopy">Copiar</button></div></label><div id="v3SignLocalWarning" style="display:none;margin-top:10px;padding:10px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;font-size:11px;color:#9a3412">Estás en localhost. Puedes probar el enlace aquí, pero para mandarlo al cliente usa la versión publicada en GitHub Pages.</div><div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:16px"><button type="button" class="ghost-btn" id="v3SignPreview">Abrir enlace</button><button type="button" class="primary-btn" id="v3SignWhatsapp">Enviar por WhatsApp</button></div></div>`;
    document.body.appendChild(dlg);
    el('v3SignShareClose').addEventListener('click',()=>dlg.close());
    return dlg;
  }

  async function shareReservationForSignature(id){
    const r=records.find(x=>x.id===id);if(!r)return alert('No se encontró la reserva.');
    try{
      const sb=await window.getSupabase();if(!sb)throw new Error('Debes iniciar sesión.');
      const {data,error}=await sb.from('reservations').update({share_enabled:true,updated_by:state.user.id}).eq('id',r.id).select('share_token,share_enabled,signed_by,signed_at,status').single();
      if(error)throw error;
      Object.assign(r,data||{});
      if(!r.share_token)throw new Error('No se pudo generar el token del enlace. Ejecuta SQL_V3_FIRMA_CLIENTE.sql.');
      const link=reservationShareURL(r),dlg=ensureReservationShareDialog();
      el('v3SignShareLink').value=link;
      el('v3SignShareStatus').textContent=r.signed_at?`Esta reserva ya fue firmada por ${r.signed_by||'el cliente'}. El enlace permanece disponible para consulta.`:'El cliente podrá revisar la reserva, aceptar los datos y firmar desde este enlace.';
      el('v3SignLocalWarning').style.display=['127.0.0.1','localhost'].includes(location.hostname)?'block':'none';
      el('v3SignCopy').onclick=async()=>{
        try{await navigator.clipboard.writeText(link);}catch{const input=el('v3SignShareLink');input.focus();input.select();document.execCommand('copy');}
        el('v3SignCopy').textContent='Copiado ✓';setTimeout(()=>el('v3SignCopy').textContent='Copiar',1300);
      };
      el('v3SignPreview').onclick=()=>window.open(link,'_blank');
      el('v3SignWhatsapp').onclick=()=>{
        const msg=`Hola ${r.client_name||''}, te compartimos la confirmación de tu reserva ${r.code} para ${r.destination}. Por favor revisa los datos y firma aquí: ${link}`;
        window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank','noopener,noreferrer');
      };
      dlg.showModal();render();
    }catch(err){alert('No se pudo preparar el enlace de firma: '+(err.message||String(err)));}
  }

  function publicDateTime(value){
    if(!value)return '—';
    try{return new Date(value).toLocaleString('es-MX',{dateStyle:'long',timeStyle:'short'});}catch{return String(value);}
  }

  function publicReservationMarkup(data){
    const r=data.reservation||{},people=data.passengers||[],payments=data.payments||[],itinerary=data.itinerary||[],snap=data.services_snapshot||{};
    const flights=Array.isArray(snap.flights)?snap.flights:[],services=Array.isArray(snap.services)?snap.services:[];
    const paid=payments.reduce((n,p)=>n+Number(p.amount||0),0),total=Number(r.total_amount||0),balance=Math.max(0,total-paid);
    const brandName=r.brand==='pink'?'Pink Sky Travel':'Velora Travel',accent=r.brand==='pink'?'#622370':'#1d5346',logo=r.brand==='pink'?'assets/pink-logo.png':'assets/velora-logo.png';
    const signed=Boolean(r.signed_at);
    const section=(title,body)=>`<section class="pub-section"><h2>${title}</h2>${body}</section>`;
    const row=(k,v)=>`<div class="pub-row"><span>${k}</span><strong>${esc(v??'—')}</strong></div>`;
    const safe=url=>{try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}};
    return `
      <style>
        *{box-sizing:border-box}body{margin:0;background:#f2f4f8;color:#172033;font-family:Inter,system-ui,-apple-system,Arial,sans-serif}.pub-shell{max-width:850px;margin:24px auto;background:#fff;border-radius:20px;box-shadow:0 16px 55px #18223518;overflow:hidden}.pub-head{padding:24px 28px;border-top:7px solid ${accent};display:flex;align-items:center;gap:18px;border-bottom:1px solid #e8ebef}.pub-head img{width:74px;height:74px;object-fit:contain}.pub-head h1{font-size:23px;margin:0}.pub-head p{margin:5px 0 0;color:#667085}.pub-body{padding:26px 28px}.pub-badge{display:inline-block;padding:7px 10px;border-radius:999px;background:${signed?'#eaf8f0':'#fff6e8'};color:${signed?'#166534':'#9a5b09'};font-size:12px;font-weight:800;margin-bottom:14px}.pub-section{margin:22px 0}.pub-section h2{font-size:16px;color:${accent};border-bottom:1px solid #e2e6eb;padding-bottom:8px}.pub-row{display:grid;grid-template-columns:180px 1fr;gap:14px;padding:7px 0}.pub-row span{color:#667085}.pub-list{display:grid;gap:10px}.pub-item{padding:12px;border:1px solid #e4e8ed;border-radius:12px;background:#fbfcfd}.pub-item strong{display:block;margin-bottom:4px}.pub-money{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.pub-money div{padding:14px;border-radius:12px;background:#f7f8fb}.pub-money span{display:block;color:#667085;font-size:12px}.pub-money strong{display:block;font-size:18px;margin-top:5px}.sign-card{margin-top:26px;padding:18px;border:1px solid #dce3eb;border-radius:16px;background:#fbfcfe}.sign-card label{display:grid;gap:6px;margin:12px 0}.sign-card input[type=text]{width:100%;padding:12px;border:1px solid #cfd7e2;border-radius:10px}.check-line{display:flex!important;grid-template-columns:none!important;align-items:flex-start;gap:9px!important;font-size:13px;line-height:1.45}.signature-box{border:1px solid #bfc9d6;border-radius:12px;background:white;overflow:hidden}.signature-box canvas{display:block;width:100%;height:210px;touch-action:none}.sign-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}.btn{border:0;border-radius:10px;padding:11px 15px;font-weight:800;cursor:pointer}.btn.primary{background:${accent};color:#fff}.btn.ghost{background:#e9edf2;color:#172033}.sign-message{margin-top:10px;font-weight:700}.signed-card{padding:18px;border-radius:14px;background:#eaf8f0;color:#14532d}.pub-foot{padding:18px 28px;border-top:1px solid #e8ebef;color:#667085;font-size:11px;text-align:center}@media(max-width:700px){.pub-shell{margin:0;border-radius:0;min-height:100vh}.pub-head,.pub-body{padding:20px}.pub-row{grid-template-columns:1fr;gap:2px}.pub-money{grid-template-columns:1fr}.signature-box canvas{height:180px}}
      </style>
      <main class="pub-shell">
        <header class="pub-head"><img src="${logo}" alt="${esc(brandName)}"><div><h1>Confirmación de reserva</h1><p>${esc(brandName)} · ${esc(r.code||'')}</p></div></header>
        <div class="pub-body">
          <span class="pub-badge">${signed?'RESERVA FIRMADA':'PENDIENTE DE FIRMA'}</span>
          ${section('Datos del viaje',row('Cliente',r.client_name)+row('Destino',r.destination)+row('Fechas',`${fmt(r.start_date)} al ${fmt(r.end_date)}`)+row('Hotel / plan',r.hotel_service)+row('Viajeros',`${r.adults||0} adultos y ${r.minors||0} menores`))}
          ${section('Pasajeros',people.length?`<div class="pub-list">${people.map((p,i)=>`<div class="pub-item"><strong>${i+1}. ${esc([p.first_name,p.last_name_1,p.last_name_2].filter(Boolean).join(' '))}</strong><span>Nacimiento: ${esc(fmt(p.birth_date))}</span></div>`).join('')}</div>`:'<p>Pasajeros pendientes de captura.</p>')}
          ${section('Vuelos',flights.length?`<div class="pub-list">${flights.map(f=>`<div class="pub-item"><strong>${esc(f.route||'Vuelo')}</strong><div>Salida: ${esc(f.departureText||'—')} · ${esc(flightDateText(f.departureAt))}</div><div>Regreso: ${esc(f.returnText||'—')} · ${esc(flightDateText(f.returnAt))}</div><div>Equipaje: ${esc(f.baggage||'—')}</div></div>`).join('')}</div>`:'<p>No se incluyeron vuelos.</p>')}
          ${section('Tours, traslados y otros servicios',services.length?`<div class="pub-list">${services.map(x=>`<div class="pub-item"><strong>${esc(x.name||'Servicio')}</strong><div>${esc(x.detail||'')}</div>${x.notes?`<small>${esc(x.notes)}</small>`:''}</div>`).join('')}</div>`:'<p>No se registraron servicios adicionales.</p>')}
          ${section('Itinerario',itinerary.length?`<div class="pub-list">${itinerary.map(a=>{const url=safe(a.location_url);return `<div class="pub-item"><strong>${esc(fmt(a.activity_date))}${a.activity_time?' · '+esc(String(a.activity_time).slice(0,5)):''} — ${esc(a.title)}</strong>${a.description?`<div>${esc(a.description)}</div>`:''}${a.meeting_point?`<div>Lugar: ${esc(a.meeting_point)}</div>`:''}${url?`<div><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir ubicación ↗</a></div>`:''}${a.notes?`<small>${esc(a.notes)}</small>`:''}</div>`}).join('')}</div>`:'<p>Itinerario pendiente de elaboración.</p>')}
          ${section('Estado de cuenta',`<div class="pub-money"><div><span>Total contratado</span><strong>${peso(total)}</strong></div><div><span>Pagado</span><strong>${peso(paid)}</strong></div><div><span>Saldo</span><strong>${peso(balance)}</strong></div></div>`)}
          ${signed?`<div class="signed-card"><strong>Reserva aceptada y firmada</strong><div>Firmó: ${esc(r.signed_by||'Cliente')}</div><div>${esc(publicDateTime(r.signed_at))}</div></div>`:`<section class="sign-card"><h2 style="margin-top:0;color:${accent}">Aceptación y firma</h2><p>Confirma que revisaste los datos de la reserva, pasajeros, servicios e itinerario antes de firmar.</p><label>Nombre completo de quien firma<input id="publicSignerName" type="text" value="${esc(r.client_name||'')}" autocomplete="name"></label><label class="check-line"><input id="publicConfirmData" type="checkbox"> <span>Confirmo que revisé los datos mostrados y corresponden a la reserva acordada.</span></label><label class="check-line"><input id="publicAcceptTerms" type="checkbox"> <span>Acepto la confirmación de los servicios mostrados y las políticas y condiciones que me fueron proporcionadas por la agencia.</span></label><div class="signature-box"><canvas id="publicSignatureCanvas" width="760" height="220"></canvas></div><div class="sign-actions"><button class="btn ghost" type="button" id="publicSignatureClear">Limpiar firma</button><button class="btn primary" type="button" id="publicSignatureSubmit">Aceptar y firmar reserva</button></div><div class="sign-message" id="publicSignatureMessage"></div></section>`}
        </div>
        <footer class="pub-foot">Confirmación electrónica de reserva · Travel Ops by Nuve Works</footer>
      </main>`;
  }

  function setupPublicSignature(reservationId,token){
    const canvas=el('publicSignatureCanvas');if(!canvas)return;
    const ctx=canvas.getContext('2d');ctx.lineWidth=2.2;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#172033';
    let drawing=false,hasInk=false;
    const point=e=>{const rect=canvas.getBoundingClientRect(),touch=e.touches?.[0]||e.changedTouches?.[0]||e;return {x:(touch.clientX-rect.left)*(canvas.width/rect.width),y:(touch.clientY-rect.top)*(canvas.height/rect.height)}};
    const start=e=>{e.preventDefault();drawing=true;const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y)};
    const move=e=>{if(!drawing)return;e.preventDefault();const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();hasInk=true};
    const end=e=>{if(!drawing)return;e.preventDefault();drawing=false};
    canvas.addEventListener('pointerdown',start);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('pointerleave',end);
    el('publicSignatureClear').addEventListener('click',()=>{ctx.clearRect(0,0,canvas.width,canvas.height);hasInk=false;});
    el('publicSignatureSubmit').addEventListener('click',async()=>{
      const btn=el('publicSignatureSubmit'),msg=el('publicSignatureMessage'),name=el('publicSignerName').value.trim();
      msg.style.color='#b42318';msg.textContent='';
      if(!name)return msg.textContent='Escribe el nombre de quien firma.';
      if(!el('publicConfirmData').checked)return msg.textContent='Confirma que revisaste los datos.';
      if(!el('publicAcceptTerms').checked)return msg.textContent='Debes aceptar las condiciones.';
      if(!hasInk)return msg.textContent='Firma dentro del recuadro.';
      btn.disabled=true;btn.textContent='Guardando firma…';
      try{
        const sb=await window.getSupabase();if(!sb)throw new Error('No se pudo conectar con el servicio.');
        const {error}=await sb.rpc('confirm_shared_travelops_v3_reservation',{p_reservation_id:reservationId,p_token:token,p_signed_by:name,p_signature_data:canvas.toDataURL('image/png'),p_accept_terms:true,p_confirm_data:true,p_terms_version:'TO-V3-2026-10'});
        if(error)throw error;
        msg.style.color='#166534';msg.textContent='Reserva firmada correctamente.';
        setTimeout(()=>renderSharedReservationPage(reservationId,token),700);
      }catch(err){msg.textContent=err.message||String(err);}
      finally{btn.disabled=false;btn.textContent='Aceptar y firmar reserva';}
    });
  }

  async function renderSharedReservationPage(reservationId,token){
    document.body.innerHTML='<div style="font-family:Arial,sans-serif;max-width:680px;margin:80px auto;text-align:center"><strong>Cargando reserva…</strong></div>';
    try{
      const sb=await window.getSupabase();if(!sb)throw new Error('No se pudo conectar con Travel Ops.');
      const {data,error}=await sb.rpc('get_shared_travelops_v3_reservation',{p_reservation_id:reservationId,p_token:token});
      if(error)throw error;if(!data)throw new Error('Enlace inválido, desactivado o reserva cancelada.');
      document.body.innerHTML=publicReservationMarkup(data);
      if(!data.reservation?.signed_at)setupPublicSignature(reservationId,token);
    }catch(err){document.body.innerHTML=`<div style="font-family:Arial,sans-serif;background:#f3f4f7;min-height:100vh;padding:40px"><div style="max-width:680px;margin:80px auto;background:#fff;border-radius:18px;padding:34px;text-align:center;box-shadow:0 16px 55px rgba(17,24,39,.12)"><h1>Reserva no disponible</h1><p style="color:#667085">${esc(err.message||String(err))}</p></div></div>`;}
  }

  async function load() {
    const info = el('v3ReservationMessage');
    if (!info) return;
    info.textContent = 'Cargando reservas…';
    try {
      const sb = await window.getSupabase();
      if (!sb) throw new Error('Inicia sesión para consultar reservas.');
      const {data, error} = await sb.from('reservations')
        .select('id,code,brand,client_name,destination,start_date,end_date,adults,minors,total_amount,status,hotel_service,v3_quote_id,v3_services_snapshot,v3_option_id,share_token,share_enabled,signed_by,signed_at,accepted_terms,client_confirmed_data')
        .not('v3_quote_id','is',null).order('created_at',{ascending:false});
      if (error) throw error;
      records = data || [];
      passengersCount = new Map();
      paymentRows = [];
      if (records.length) {
        const {data:people,error:pe} = await sb.from('passengers').select('reservation_id').in('reservation_id',records.map(r => r.id));
        if (pe) throw pe;
        (people || []).forEach(p => passengersCount.set(p.reservation_id,(passengersCount.get(p.reservation_id)||0)+1));
        const quoteIds=[...new Set(records.map(r=>r.v3_quote_id).filter(Boolean))];
        if(quoteIds.length){
          const {data:pays,error:payError}=await sb.from('travelops_quote_payments').select('*').in('quote_id',quoteIds).order('created_at',{ascending:true});
          if(payError) console.warn('No se pudieron cargar pagos V3',payError); else paymentRows=pays||[];
        }
      }
      info.textContent = '';
      render();
    } catch (error) {
      info.textContent = 'No se pudieron cargar las reservas: ' + (error.message || String(error));
      el('v3ReservationList').innerHTML = '';
    }
  }
  window.loadV3Reservations = load;
  const publicParams=new URLSearchParams(location.search);
  const publicReservationId=publicParams.get('reservation');
  const publicReservationToken=publicParams.get('token');
  if(publicReservationId&&publicReservationToken){
    renderSharedReservationPage(publicReservationId,publicReservationToken);
  }else{
    el('v3ReservationSearch')?.addEventListener('input',render);
    el('v3ReservationStatus')?.addEventListener('change',render);
    el('v3ReservationRefresh')?.addEventListener('click',load);
    window.addEventListener('focus', () => {
      if (el('reservationsView')?.classList.contains('active')) load();
    });
  }
})();
