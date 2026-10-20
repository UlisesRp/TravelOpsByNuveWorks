// Travel Ops V3 · Listado separado de reservas provenientes de cotizaciones.
// Solo lectura de reservas; captura de pasajeros reutiliza el expediente existente.
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
        <div style="display:flex;gap:9px;flex-wrap:wrap"><button class="${pay.balance>0?'primary-btn':'ghost-btn'} compact" type="button" data-v3-res-payments="${esc(r.id)}">Pagos / recibos${pay.rows.length?` (${pay.rows.length})`:''}</button><button class="primary-btn compact" type="button" data-v3-res-pax="${esc(r.v3_quote_id)}">${count ? 'Ver / editar pasajeros' : 'Capturar pasajeros'}</button><button class="ghost-btn compact" type="button" data-v3-res-itinerary="${esc(r.id)}">Editar itinerario</button><button class="ghost-btn compact" type="button" data-v3-res-preview="${esc(r.id)}">Vista de confirmación</button><button class="ghost-btn compact" type="button" data-v3-res-quote="${esc(r.v3_quote_id)}">Ver cotización</button></div>
      </article>`;
    }).join('') : `<div class="empty">No hay reservas V3 con estos filtros.</div>`;
    list.querySelectorAll('[data-v3-res-payments]').forEach(b => b.addEventListener('click', () => openPayments(b.dataset.v3ResPayments)));
    list.querySelectorAll('[data-v3-res-itinerary]').forEach(b => b.addEventListener('click', () => openItinerary(b.dataset.v3ResItinerary)));
    list.querySelectorAll('[data-v3-res-preview]').forEach(b => b.addEventListener('click', () => preview(b.dataset.v3ResPreview)));
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
    dlg.innerHTML = `<div style="padding:23px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><span class="eyebrow">RESERVA V3 · ITINERARIO</span><h2 style="margin:5px 0">Itinerario editable</h2></div><button type="button" class="ghost-btn compact" id="v3ItinClose">Cerrar</button></div><p id="v3ItinInfo" class="muted"></p><div id="v3ItinDays" style="display:grid;gap:13px"></div><form id="v3ItinForm" style="display:grid;gap:12px;margin-top:18px;padding:16px;border:1px solid #dde3e9;border-radius:12px"><h3 id="v3ItinFormTitle" style="margin:0">Nueva actividad</h3><input type="hidden" id="v3ItinEditId"><label>Fecha<input type="date" id="v3ItinDate" required></label><label>Hora (opcional)<input type="time" id="v3ItinTime"></label><label>Actividad<input id="v3ItinTitle" maxlength="180" required placeholder="Ej. Traslado aeropuerto–hotel"></label><label>Descripción / detalles<textarea id="v3ItinDescription" rows="3" maxlength="3000"></textarea></label><label>Punto de encuentro (opcional)<input id="v3ItinMeeting" maxlength="500"></label><p class="muted" style="margin:0">Solo agrega servicios realmente contratados o información autorizada. Los días vacíos no se guardan como actividades.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="submit" class="primary-btn compact" id="v3ItinSave">Guardar actividad</button><button type="button" class="ghost-btn compact" id="v3ItinCancel">Cancelar edición</button></div><p id="v3ItinError" role="status" style="color:#b42318;margin:0"></p></form></div>`;
    document.body.appendChild(dlg);
    el('v3ItinClose').addEventListener('click', () => dlg.close());
    el('v3ItinCancel').addEventListener('click', () => resetItineraryForm());
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
    el('v3ItinError').textContent='';
  }
  async function getItinerary(id, refresh=false) {
    if (!refresh && itineraryCache.has(id)) return itineraryCache.get(id);
    const sb=await window.getSupabase();
    if(!sb) throw new Error('Debes iniciar sesión.');
    const {data,error}=await sb.from('v3_reservation_itinerary')
      .select('id,reservation_id,activity_date,activity_time,title,description,meeting_point,sort_order')
      .eq('reservation_id',id).order('activity_date').order('activity_time').order('sort_order');
    if(error) throw error;
    itineraryCache.set(id,data||[]); return data||[];
  }
  function renderItineraryDays(r, rows) {
    const dates=dayList(r.start_date,r.end_date);
    if(!dates.length) {el('v3ItinDays').textContent='Fechas de reserva inválidas o periodo superior a 180 días.';return;}
    el('v3ItinDays').innerHTML=dates.map((day,i)=>{
      const activities=rows.filter(x=>x.activity_date===day);
      return `<section style="padding:13px;border:1px solid #dce1e9;border-radius:12px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><strong>Día ${i+1} · ${fmt(day)}</strong><button class="ghost-btn compact" type="button" data-itin-add="${day}">+ Actividad</button></div>${activities.length?activities.map(a=>`<div style="padding:10px 0;border-top:1px solid #eee;margin-top:9px;display:flex;align-items:start;justify-content:space-between;gap:10px"><div><strong>${esc(a.activity_time?String(a.activity_time).slice(0,5)+' · ':'')}${esc(a.title)}</strong>${a.description?`<div>${esc(a.description)}</div>`:''}${a.meeting_point?`<small>Punto de encuentro: ${esc(a.meeting_point)}</small>`:''}</div><button type="button" class="ghost-btn compact" data-itin-edit="${esc(a.id)}">Editar</button></div>`).join(''):'<p class="muted" style="margin:8px 0 0">Sin actividades capturadas</p>'}</section>`;
    }).join('');
    el('v3ItinDays').querySelectorAll('[data-itin-add]').forEach(b=>b.addEventListener('click',()=>{resetItineraryForm(b.dataset.itinAdd);el('v3ItinForm').scrollIntoView({block:'nearest',behavior:'smooth'});}));
    el('v3ItinDays').querySelectorAll('[data-itin-edit]').forEach(b=>b.addEventListener('click',()=>{
      const a=rows.find(x=>x.id===b.dataset.itinEdit);if(!a)return;
      resetItineraryForm(a.activity_date);el('v3ItinEditId').value=a.id;
      el('v3ItinDate').value=a.activity_date;el('v3ItinTime').value=String(a.activity_time||'').slice(0,5);
      el('v3ItinTitle').value=a.title||'';el('v3ItinDescription').value=a.description||'';
      el('v3ItinMeeting').value=a.meeting_point||'';el('v3ItinFormTitle').textContent='Editar actividad';
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
    const payload={reservation_id:r.id,activity_date:date,activity_time:el('v3ItinTime').value||null,title:el('v3ItinTitle').value.trim(),description:el('v3ItinDescription').value.trim()||null,meeting_point:el('v3ItinMeeting').value.trim()||null};
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

  function ensurePreview() {
    let dlg = el('v3ConfirmationPreview');
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = 'v3ConfirmationPreview';
    dlg.className = 'modal';
    dlg.style.cssText = 'width:min(850px,calc(100vw - 28px));max-height:90vh;overflow:auto;border:0;border-radius:18px;padding:0';
    dlg.innerHTML = `<div style="padding:22px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><span class="eyebrow">TRAVEL OPS V3 · VISTA PREVIA INTERNA</span><h2 style="margin:6px 0">Confirmación de reserva</h2></div><button type="button" class="ghost-btn compact" id="v3PreviewClose">Cerrar</button></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:14px"><button type="button" class="primary-btn compact" id="v3CustomerPreviewBtn" disabled>Ver como cliente (simulación)</button><small style="color:#667085">No genera enlace público ni envía información.</small></div><div id="v3PreviewContent" aria-live="polite"></div><p style="margin:18px 0 4px;color:#a34b17;font-weight:700">Borrador interno: no se ha enviado, aceptado ni firmado. Verifica el itinerario y las condiciones antes de compartir.</p></div>`;
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
    return dlg;
  }
  async function preview(id) {
    const dlg=ensurePreview(), content=el('v3PreviewContent');
    content.textContent='Cargando confirmación…'; el('v3CustomerPreviewBtn').disabled=true; dlg.showModal();
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
        ${group('Itinerario',itinerary.length?itinerary.map(a=>`<div style="padding:8px 0;border-bottom:1px solid #eee"><strong>${esc(fmt(a.activity_date))}${a.activity_time?' · '+esc(String(a.activity_time).slice(0,5)):''} — ${esc(a.title)}</strong>${a.description?`<div>${esc(a.description)}</div>`:''}${a.meeting_point?`<small>Punto de encuentro: ${esc(a.meeting_point)}</small>`:''}</div>`).join(''):'<p>Itinerario pendiente de elaboración.</p>')}
        ${group('Políticas y aceptación','<p>Pendiente de revisión. La firma y aceptación se implementarán en el siguiente módulo.</p>')}
      </div>`;
      el('v3CustomerPreviewBtn').disabled=false;
    } catch(err) {content.textContent='No se pudo preparar la confirmación: '+(err.message||String(err));}
  }

  async function load() {
    const info = el('v3ReservationMessage');
    if (!info) return;
    info.textContent = 'Cargando reservas…';
    try {
      const sb = await window.getSupabase();
      if (!sb) throw new Error('Inicia sesión para consultar reservas.');
      const {data, error} = await sb.from('reservations')
        .select('id,code,brand,client_name,destination,start_date,end_date,adults,minors,total_amount,status,hotel_service,v3_quote_id,v3_services_snapshot,v3_option_id')
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
  el('v3ReservationSearch')?.addEventListener('input',render);
  el('v3ReservationStatus')?.addEventListener('change',render);
  el('v3ReservationRefresh')?.addEventListener('click',load);
  window.addEventListener('focus', () => {
    if (el('reservationsView')?.classList.contains('active')) load();
  });
})();
