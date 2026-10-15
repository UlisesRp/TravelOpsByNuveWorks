// Travel Ops V3 · Listado separado de reservas provenientes de cotizaciones.
// Solo lectura de reservas; captura de pasajeros reutiliza el expediente existente.
(() => {
  let records = [];
  let passengersCount = new Map();
  const el = id => document.getElementById(id);
  const esc = value => escapeHTML(String(value ?? ''));
  const fmt = value => value ? String(value).slice(0, 10).split('-').reverse().join('/') : '—';
  const peso = value => new Intl.NumberFormat('es-MX', {style:'currency',currency:'MXN'}).format(Number(value || 0));
  const stateLabels = {por_confirmar:'Por confirmar',confirmada:'Confirmada',cancelada:'Cancelada'};

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
      return `<article style="border:1px solid #e0e4eb;border-radius:14px;padding:17px;background:white">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><small class="eyebrow">${esc(r.code)}</small><h3 style="margin:5px 0">${esc(r.destination)}</h3><p style="margin:3px 0">${esc(r.client_name)}</p></div><div style="text-align:right"><strong>${esc(stateLabels[r.status] || r.status)}</strong><div style="margin-top:6px">${esc(r.brand === 'pink' ? 'Pink Sky Travel' : 'Velora Travel')}</div></div></div>
        <div style="display:flex;flex-wrap:wrap;gap:10px 22px;margin:14px 0;font-size:13px"><span>Hotel: <strong>${esc(r.hotel_service || 'Sin hotel')}</strong></span><span>Viaje: <strong>${fmt(r.start_date)} – ${fmt(r.end_date)}</strong></span><span>Viajeros: <strong>${Number(r.adults||0)} adultos, ${Number(r.minors||0)} menores</strong></span><span>Importe: <strong>${peso(r.total_amount)}</strong></span><span>Pasajeros capturados: <strong>${count}/${expected}</strong></span></div>
        <div style="display:flex;gap:9px;flex-wrap:wrap"><button class="primary-btn compact" type="button" data-v3-res-pax="${esc(r.v3_quote_id)}">${count ? 'Ver / editar pasajeros' : 'Capturar pasajeros'}</button><button class="ghost-btn compact" type="button" data-v3-res-preview="${esc(r.id)}">Vista de confirmación</button><button class="ghost-btn compact" type="button" data-v3-res-quote="${esc(r.v3_quote_id)}">Ver cotización</button></div>
      </article>`;
    }).join('') : `<div class="empty">No hay reservas V3 con estos filtros.</div>`;
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


  function ensurePreview() {
    let dlg = el('v3ConfirmationPreview');
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = 'v3ConfirmationPreview';
    dlg.className = 'modal';
    dlg.style.cssText = 'width:min(850px,calc(100vw - 28px));max-height:90vh;overflow:auto;border:0;border-radius:18px;padding:0';
    dlg.innerHTML = `<div style="padding:22px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><span class="eyebrow">TRAVEL OPS V3 · VISTA PREVIA INTERNA</span><h2 style="margin:6px 0">Confirmación de reserva</h2></div><button type="button" class="ghost-btn compact" id="v3PreviewClose">Cerrar</button></div><div id="v3PreviewContent" aria-live="polite"></div><p style="margin:18px 0 4px;color:#a34b17;font-weight:700">Borrador interno: no se ha enviado, aceptado ni firmado. Verifica el itinerario y las condiciones antes de compartir.</p></div>`;
    document.body.appendChild(dlg);
    el('v3PreviewClose').addEventListener('click',()=>dlg.close());
    return dlg;
  }
  async function preview(id) {
    const dlg=ensurePreview(), content=el('v3PreviewContent');
    content.textContent='Cargando confirmación…'; dlg.showModal();
    try {
      const r=records.find(row=>row.id===id);
      if (!r) throw new Error('No se encontró la reserva.');
      const sb=await window.getSupabase();
      if (!sb) throw new Error('Debes iniciar sesión.');
      const {data:pax,error:pe}=await sb.from('passengers').select('first_name,last_name_1,last_name_2,birth_date').eq('reservation_id',r.id).order('created_at');
      if (pe) throw pe;
      const people=pax||[], total=Number(r.adults||0)+Number(r.minors||0);
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
        ${group('Vuelos',flights.length?flights.map(f=>`<div style="padding:9px 0;border-bottom:1px solid #eee"><strong>${esc(f.route||'Vuelo')}</strong><div>Salida: ${esc(f.departureText||'—')} · ${esc(f.departureAt||'—')}</div><div>Regreso: ${esc(f.returnText||'—')} · ${esc(f.returnAt||'—')}</div><div>Equipaje: ${esc(f.baggage||'—')}</div></div>`).join(''):'<p>No se incluyeron vuelos en la reserva.</p>')}
        ${group('Tours, traslados y otros servicios',services.length?services.map(x=>`<div style="padding:8px 0;border-bottom:1px solid #eee"><strong>${esc(x.name||'Servicio')}</strong> · ${esc(x.type||'Otro')}<div>${esc(x.detail||'')}</div>${x.notes?`<small>${esc(x.notes)}</small>`:''}</div>`).join(''):'<p>No se registraron servicios adicionales.</p>')}
        ${group('Itinerario, políticas y aceptación','<p>Pendiente de elaboración y revisión. La firma y la aceptación de términos se implementarán en el siguiente módulo.</p>')}
      </div>`;
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
      if (records.length) {
        const {data:people,error:pe} = await sb.from('passengers').select('reservation_id').in('reservation_id',records.map(r => r.id));
        if (pe) throw pe;
        (people || []).forEach(p => passengersCount.set(p.reservation_id,(passengersCount.get(p.reservation_id)||0)+1));
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
