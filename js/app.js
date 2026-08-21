const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const money = new Intl.NumberFormat("es-MX", { style:"currency", currency:"MXN", maximumFractionDigits:0 });
const dateFmt = new Intl.DateTimeFormat("es-MX", { day:"2-digit", month:"short", year:"numeric", timeZone:"UTC" });
const monthFmt = new Intl.DateTimeFormat("es-MX", { month:"long", year:"numeric", timeZone:"UTC" });

const state = {
  supabase: null,
  user: { id:"demo-user", name:"Ulises", email:"demo@local" },
  brand:"all",
  calendarDate: new Date(Date.UTC(2026, 10, 1)),
  departures: [
    {id:"d1",brand:"pink",destination:"Cancún",start:"2026-11-02",end:"2026-11-06",capacity:45,notes:"Salida grupal",bookings:[
      {id:"b1",name:"Turismo Rosario",total:85000,paid:70000,billing:"pendiente",notes:"Factura solicitada",passengers:[
        {first:"Luz María",last1:"Guerrero",last2:"",birth:"1960-06-01"},
        {first:"Elsa Icela",last1:"González",last2:"Guerrero",birth:"1969-10-30"},
        {first:"Metztli Ameyalli",last1:"Domínguez",last2:"Arias",birth:"2016-10-14"}
      ]},
      {id:"b2",name:"Viajes Micky",total:42000,paid:42000,billing:"facturada",notes:"",passengers:[
        {first:"Andrea",last1:"Santos",last2:"López",birth:"1988-03-12"},
        {first:"Miguel",last1:"Santos",last2:"López",birth:"2010-08-09"}
      ]}
    ]},
    {id:"d2",brand:"velora",destination:"Bacalar",start:"2026-12-12",end:"2026-12-16",capacity:20,notes:"Experiencia premium",bookings:[
      {id:"b3",name:"Familia Hernández",total:32000,paid:12000,billing:"no_solicitada",notes:"Pendiente segundo abono",passengers:[
        {first:"Carlos",last1:"Hernández",last2:"Mora",birth:"1985-02-05"},
        {first:"Paola",last1:"Ruiz",last2:"Vega",birth:"1987-09-21"},
        {first:"Regina",last1:"Hernández",last2:"Ruiz",birth:"2014-05-11"}
      ]}
    ]},
    {id:"d3",brand:"pink",destination:"Mazatlán",start:"2026-08-26",end:"2026-08-31",capacity:40,notes:"",bookings:[]}
  ],
  leads:[
    {id:"l1",owner_id:"demo-user",name:"Agencia Sol",phone:"",brand:"pink",interest:"Bacalar",followup:"2026-08-21",status:"seguimiento",notes:"Pedir confirmación de lugares"},
    {id:"l2",owner_id:"demo-user",name:"Mariana Pérez",phone:"",brand:"velora",interest:"Cancún",followup:"2026-08-20",status:"cotizando",notes:"Enviar propuesta final"},
    {id:"l3",owner_id:"otro-user",name:"Oculto",brand:"pink",interest:"",followup:"2026-08-20",status:"nuevo",notes:""}
  ]
};

function parseDate(s){ const [y,m,d]=s.split("-").map(Number); return new Date(Date.UTC(y,m-1,d)); }
function daysBetween(a,b){ return Math.round((parseDate(b)-parseDate(a))/86400000)+1; }
function ageAt(birth, ref=new Date()){
  const b=parseDate(birth); let age=ref.getUTCFullYear()-b.getUTCFullYear();
  const m=ref.getUTCMonth()-b.getUTCMonth();
  if(m<0 || (m===0 && ref.getUTCDate()<b.getUTCDate())) age--;
  return age;
}
function fullName(p){ return [p.first,p.last1,p.last2].filter(Boolean).join(" ").replace(/\s+/g," ").trim(); }
function brandLabel(b){ return b==="pink" ? "Pink Sky Travel" : "Velora Travel"; }
function bookingPax(d){ return d.bookings.reduce((n,b)=>n+b.passengers.length,0); }
function departureTotal(d){ return d.bookings.reduce((n,b)=>n+b.total,0); }
function departurePaid(d){ return d.bookings.reduce((n,b)=>n+b.paid,0); }
function filteredDepartures(){
  return state.departures.filter(d=>state.brand==="all" || d.brand===state.brand);
}

function showMain(){
  $("#loginView").classList.add("hidden");
  $("#mainView").classList.remove("hidden");
  $("#userName").textContent = state.user.name || state.user.email?.split("@")[0] || "Usuario";
  $("#userAvatar").textContent = ($("#userName").textContent[0] || "U").toUpperCase();
  renderAll();
}
function showLogin(){
  $("#mainView").classList.add("hidden");
  $("#loginView").classList.remove("hidden");
}

async function initAuth(){
  state.supabase = await window.getSupabase();
  if(!state.supabase) return;
  const { data:{ session } } = await state.supabase.auth.getSession();
  if(session?.user){
    state.user={id:session.user.id,name:session.user.user_metadata?.name || session.user.email,email:session.user.email};
    await hydrateFromSupabase();
    showMain();
  }
}

async function hydrateFromSupabase(){
  if(!state.supabase) return;
  const {data: deps} = await state.supabase.from("departures").select("*").order("start_date");
  if(Array.isArray(deps) && deps.length){
    const {data: bookings} = await state.supabase.from("bookings").select("*");
    const {data: pax} = await state.supabase.from("passengers").select("*");
    state.departures = deps.map(d=>({
      id:d.id,brand:d.brand,destination:d.destination,start:d.start_date,end:d.end_date,capacity:d.capacity,notes:d.notes || "",
      bookings:(bookings||[]).filter(b=>b.departure_id===d.id).map(b=>({
        id:b.id,name:b.customer_name,total:Number(b.total_amount||0),paid:Number(b.paid_amount||0),billing:b.billing_status,notes:b.notes||"",
        passengers:(pax||[]).filter(p=>p.booking_id===b.id).map(p=>({first:p.first_name,last1:p.last_name_1,last2:p.last_name_2,birth:p.birth_date}))
      }))
    }));
  }
  const {data: leads} = await state.supabase.from("crm_leads").select("*").order("created_at");
  if(Array.isArray(leads)) state.leads=leads.map(l=>({
    id:l.id,owner_id:l.owner_id,name:l.name,phone:l.phone,brand:l.brand,interest:l.interest,followup:l.next_followup,status:l.status,notes:l.notes
  }));
}

$("#loginForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const email=$("#loginEmail").value.trim(), password=$("#loginPassword").value;
  if(!state.supabase){
    $("#loginMessage").textContent="Supabase todavía no está configurado. Usa modo demo o activa js/supabase.js.";
    return;
  }
  $("#loginMessage").textContent="Entrando...";
  const {data,error}=await state.supabase.auth.signInWithPassword({email,password});
  if(error){ $("#loginMessage").textContent=error.message; return; }
  state.user={id:data.user.id,name:data.user.user_metadata?.name || data.user.email,email:data.user.email};
  await hydrateFromSupabase(); showMain();
});
$("#demoAccess").addEventListener("click", showMain);
$("#logoutBtn").addEventListener("click", async()=>{
  if(state.supabase) await state.supabase.auth.signOut();
  showLogin();
});
$("#togglePassword").addEventListener("click",()=>{
  const input=$("#loginPassword"); input.type=input.type==="password"?"text":"password";
});

$$(".nav-item").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.view)));
$$("[data-jump]").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.jump)));

function switchView(name){
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  $$(".view").forEach(v=>v.classList.remove("active"));
  $(`#${name}View`).classList.add("active");
  const labels={
    dashboard:["OPERACIÓN GENERAL","Inicio"],calendar:["AGENDA DE VIAJES","Calendario"],
    departures:["OPERACIÓN","Salidas"],crm:["PRIVADO POR USUARIO","Mi CRM"],
    passengers:["BASE OPERATIVA","Pasajeros"],payments:["COBRANZA","Pagos"],billing:["FACTURACIÓN","Facturación"]
  };
  $("#pageEyebrow").textContent=labels[name][0]; $("#pageTitle").textContent=labels[name][1];
  if(name==="calendar") renderCalendar();
}

$("#brandFilter").addEventListener("change",e=>{state.brand=e.target.value;renderAll();});
$("#departureSearch").addEventListener("input",renderDepartureCards);
$("#passengerSearch").addEventListener("input",renderPassengers);

function renderAll(){
  renderDashboard();renderCalendar();renderDepartureCards();renderCRM();renderPassengers();renderPayments();renderBilling();
}

function renderDashboard(){
  const deps=filteredDepartures();
  $("#statDepartures").textContent=deps.length;
  $("#statPax").textContent=deps.reduce((n,d)=>n+bookingPax(d),0);
  $("#statPending").textContent=money.format(deps.reduce((n,d)=>n+departureTotal(d)-departurePaid(d),0));
  $("#statBilling").textContent=deps.reduce((n,d)=>n+d.bookings.filter(b=>b.billing==="pendiente").length,0);
  const sorted=[...deps].sort((a,b)=>a.start.localeCompare(b.start));
  $("#upcomingDepartures").innerHTML=sorted.length?sorted.map(d=>`
    <button class="departure-row" data-departure="${d.id}" type="button">
      <div><strong>${d.destination}</strong><small>${dateFmt.format(parseDate(d.start))} · ${bookingPax(d)}/${d.capacity} pax</small></div>
      <span class="brand-chip ${d.brand}">${d.brand==="pink"?"PINK":"VELORA"}</span>
    </button>`).join(""):`<div class="empty">No hay salidas registradas.</div>`;
  $$("[data-departure]",$("#upcomingDepartures")).forEach(b=>b.addEventListener("click",()=>openDeparture(b.dataset.departure)));

  const today="2026-08-20";
  const mine=state.leads.filter(l=>l.owner_id===state.user.id && l.followup<=today && !["ganado","perdido"].includes(l.status));
  $("#todayFollowups").innerHTML=mine.length?mine.map(l=>`
    <div class="task-row"><div><strong>${l.name}</strong><small>${l.interest || "Sin interés definido"} · ${brandLabel(l.brand)}</small></div><span class="status-chip pending">${l.status}</span></div>
  `).join(""):`<div class="empty">No tienes seguimientos vencidos.</div>`;
}

function renderCalendar(){
  const base=state.calendarDate; const y=base.getUTCFullYear(), m=base.getUTCMonth();
  $("#calendarMonth").textContent=monthFmt.format(base);
  const first=new Date(Date.UTC(y,m,1)); const mondayIndex=(first.getUTCDay()+6)%7;
  const start=new Date(first); start.setUTCDate(1-mondayIndex);
  const heads=["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(h=>`<div class="calendar-cell calendar-head">${h}</div>`).join("");
  let cells="";
  for(let i=0;i<42;i++){
    const d=new Date(start); d.setUTCDate(start.getUTCDate()+i);
    const iso=d.toISOString().slice(0,10); const outside=d.getUTCMonth()!==m;
    const events=filteredDepartures().filter(dep=>dep.start<=iso && dep.end>=iso);
    cells+=`<div class="calendar-cell ${outside?"outside":""}" data-date="${iso}">
      <div class="day-number">${d.getUTCDate()}</div>
      ${events.map(ev=>`<button class="calendar-event ${ev.brand}" data-departure="${ev.id}" type="button">${ev.destination}</button>`).join("")}
    </div>`;
  }
  $("#calendarGrid").innerHTML=heads+cells;
  $$("[data-departure]",$("#calendarGrid")).forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();openDeparture(b.dataset.departure);}));
}
$("#prevMonth").addEventListener("click",()=>{state.calendarDate=new Date(Date.UTC(state.calendarDate.getUTCFullYear(),state.calendarDate.getUTCMonth()-1,1));renderCalendar();});
$("#nextMonth").addEventListener("click",()=>{state.calendarDate=new Date(Date.UTC(state.calendarDate.getUTCFullYear(),state.calendarDate.getUTCMonth()+1,1));renderCalendar();});
$("#todayBtn").addEventListener("click",()=>{const n=new Date();state.calendarDate=new Date(Date.UTC(n.getFullYear(),n.getMonth(),1));renderCalendar();});

function renderDepartureCards(){
  const q=$("#departureSearch").value?.trim().toLowerCase()||"";
  const deps=filteredDepartures().filter(d=>d.destination.toLowerCase().includes(q));
  $("#departureCards").innerHTML=deps.length?deps.map(d=>{
    const pax=bookingPax(d), pending=departureTotal(d)-departurePaid(d);
    return `<article class="departure-card" data-departure="${d.id}">
      <span class="brand-chip ${d.brand}">${brandLabel(d.brand)}</span>
      <h4>${d.destination}</h4>
      <p>${dateFmt.format(parseDate(d.start))} → ${dateFmt.format(parseDate(d.end))}<br>${daysBetween(d.start,d.end)} días</p>
      <div class="card-metrics">
        <div class="metric"><strong>${pax}/${d.capacity}</strong><span>Pax</span></div>
        <div class="metric"><strong>${d.bookings.length}</strong><span>Reservas</span></div>
        <div class="metric"><strong>${money.format(pending)}</strong><span>Pendiente</span></div>
      </div>
    </article>`;
  }).join(""):`<div class="empty">No se encontraron salidas.</div>`;
  $$("[data-departure]",$("#departureCards")).forEach(c=>c.addEventListener("click",()=>openDeparture(c.dataset.departure)));
}

function renderCRM(){
  const statuses=[["nuevo","Nuevo"],["contactado","Contactado"],["cotizando","Cotizando"],["seguimiento","Seguimiento"],["ganado","Ganado"],["perdido","Perdido"]];
  const mine=state.leads.filter(l=>l.owner_id===state.user.id);
  $("#crmPipeline").innerHTML=statuses.map(([key,label])=>`
    <section class="pipeline-col"><h4>${label} · ${mine.filter(l=>l.status===key).length}</h4>
      ${mine.filter(l=>l.status===key).map(l=>`<article class="lead-card">
        <strong>${l.name}</strong><small>${l.interest||"Sin interés"} · ${brandLabel(l.brand)}</small>
        <small>${l.followup?`Seguimiento: ${dateFmt.format(parseDate(l.followup))}`:"Sin fecha"}</small>
      </article>`).join("") || `<div class="empty">Sin prospectos</div>`}
    </section>`).join("");
}

function allPassengers(){
  return filteredDepartures().flatMap(d=>d.bookings.flatMap(b=>b.passengers.map(p=>({p,d,b}))));
}
function renderPassengers(){
  const q=$("#passengerSearch").value?.trim().toLowerCase()||"";
  const rows=allPassengers().filter(x=>fullName(x.p).toLowerCase().includes(q));
  $("#passengerTable").innerHTML=rows.length?rows.map(({p,d,b})=>`<tr>
    <td><strong>${fullName(p)}</strong></td><td>${dateFmt.format(parseDate(p.birth))}</td><td>${ageAt(p.birth)}</td>
    <td>${d.destination}</td><td>${b.name}</td><td><span class="brand-chip ${d.brand}">${d.brand==="pink"?"Pink":"Velora"}</span></td></tr>`).join(""):`<tr><td colspan="6">Sin pasajeros.</td></tr>`;
}
function renderPayments(){
  const rows=filteredDepartures().flatMap(d=>d.bookings.map(b=>({d,b})));
  $("#paymentsTable").innerHTML=rows.length?rows.map(({d,b})=>{
    const saldo=b.total-b.paid, cls=saldo<=0?"paid":b.paid>0?"pending":"danger";
    return `<tr><td>${d.destination}</td><td>${b.name}</td><td>${money.format(b.total)}</td><td>${money.format(b.paid)}</td><td>${money.format(saldo)}</td><td><span class="status-chip ${cls}">${saldo<=0?"Liquidado":"Pendiente"}</span></td></tr>`;
  }).join(""):`<tr><td colspan="6">Sin pagos.</td></tr>`;
}
function billingLabel(s){ return s==="facturada"?"Facturada":s==="pendiente"?"Pendiente":"No solicitada"; }
function renderBilling(){
  const rows=filteredDepartures().flatMap(d=>d.bookings.map(b=>({d,b})));
  $("#billingTable").innerHTML=rows.length?rows.map(({d,b})=>`<tr>
    <td>${d.destination}</td><td>${b.name}</td><td><span class="brand-chip ${d.brand}">${d.brand==="pink"?"Pink":"Velora"}</span></td>
    <td>${billingLabel(b.billing)}</td><td>${b.notes||"—"}</td></tr>`).join(""):`<tr><td colspan="5">Sin registros.</td></tr>`;
}

$("#newDepartureBtn").addEventListener("click",()=>$("#departureModal").showModal());
$("#newLeadBtn").addEventListener("click",()=>$("#leadModal").showModal());
$$("[data-close]").forEach(b=>b.addEventListener("click",()=>$("#"+b.dataset.close).close()));

$("#departureForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const dep={
    id:crypto.randomUUID(),brand:$("#departureBrand").value,destination:$("#departureDestination").value.trim(),
    start:$("#departureStart").value,end:$("#departureEnd").value,capacity:Number($("#departureCapacity").value),notes:$("#departureNotes").value.trim(),bookings:[]
  };
  if(!dep.destination||!dep.start||!dep.end||dep.end<dep.start){alert("Revisa destino y fechas.");return;}
  if(state.supabase){
    const {data,error}=await state.supabase.from("departures").insert({
      brand:dep.brand,destination:dep.destination,start_date:dep.start,end_date:dep.end,capacity:dep.capacity,notes:dep.notes,created_by:state.user.id
    }).select().single();
    if(error){alert(error.message);return;} dep.id=data.id;
  }
  state.departures.push(dep);$("#departureModal").close();e.target.reset();renderAll();
});

$("#leadForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const lead={
    id:crypto.randomUUID(),owner_id:state.user.id,name:$("#leadName").value.trim(),phone:$("#leadPhone").value.trim(),
    brand:$("#leadBrand").value,interest:$("#leadInterest").value.trim(),followup:$("#leadFollowup").value,status:$("#leadStatus").value,notes:$("#leadNotes").value.trim()
  };
  if(state.supabase){
    const {data,error}=await state.supabase.from("crm_leads").insert({
      owner_id:lead.owner_id,name:lead.name,phone:lead.phone,brand:lead.brand,interest:lead.interest,next_followup:lead.followup||null,status:lead.status,notes:lead.notes
    }).select().single();
    if(error){alert(error.message);return;} lead.id=data.id;
  }
  state.leads.push(lead);$("#leadModal").close();e.target.reset();renderAll();
});

function openDeparture(id){
  const d=state.departures.find(x=>x.id===id); if(!d)return;
  $("#detailBrand").textContent=brandLabel(d.brand); $("#detailTitle").textContent=d.destination;
  $("#detailMeta").textContent=`${dateFmt.format(parseDate(d.start))} → ${dateFmt.format(parseDate(d.end))} · ${bookingPax(d)}/${d.capacity} pax`;
  $("#departureDetailModal").dataset.departureId=d.id;
  $$("#detailTabs button").forEach(b=>b.classList.toggle("active",b.dataset.detailTab==="summary"));
  renderDetail("summary");$("#departureDetailModal").showModal();
}
$("#detailTabs").addEventListener("click",e=>{
  const b=e.target.closest("[data-detail-tab]");if(!b)return;
  $$("#detailTabs button").forEach(x=>x.classList.toggle("active",x===b));renderDetail(b.dataset.detailTab);
});
function renderDetail(tab){
  const d=state.departures.find(x=>x.id===$("#departureDetailModal").dataset.departureId); if(!d)return;
  if(tab==="summary"){
    const total=departureTotal(d),paid=departurePaid(d);
    $("#detailContent").innerHTML=`<div class="detail-summary">
      <div class="summary-box"><span>Pasajeros</span><strong>${bookingPax(d)} / ${d.capacity}</strong></div>
      <div class="summary-box"><span>Reservas</span><strong>${d.bookings.length}</strong></div>
      <div class="summary-box"><span>Cobrado</span><strong>${money.format(paid)}</strong></div>
      <div class="summary-box"><span>Saldo</span><strong>${money.format(total-paid)}</strong></div>
    </div><p class="muted" style="margin-top:16px">${d.notes||"Sin notas."}</p>`;
  } else if(tab==="bookings"){
    $("#detailContent").innerHTML=d.bookings.length?d.bookings.map(b=>`<div class="departure-row"><div><strong>${b.name}</strong><small>${b.passengers.length} pax · ${billingLabel(b.billing)}</small></div><strong>${money.format(b.total-b.paid)} saldo</strong></div>`).join(""):`<div class="empty">Todavía no hay agencias o clientes en esta salida.</div>`;
  } else if(tab==="pax"){
    const rows=d.bookings.flatMap(b=>b.passengers.map(p=>({b,p})));
    $("#detailContent").innerHTML=rows.length?`<div class="table-wrap"><table><thead><tr><th>Nombre completo</th><th>Nacimiento</th><th>Agencia / cliente</th></tr></thead><tbody>${rows.map(({b,p})=>`<tr><td>${fullName(p)}</td><td>${dateFmt.format(parseDate(p.birth))}</td><td>${b.name}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">Todavía no hay pasajeros capturados.</div>`;
  } else if(tab==="rooming"){
    $("#detailContent").innerHTML=`<div class="empty"><strong>Rooming List</strong><br><br>La estructura está lista para asignar pasajeros a SGL / DBL / TPL / CPL y exportar la lista por salida o por agencia.</div>`;
  } else if(tab==="payments"){
    $("#detailContent").innerHTML=d.bookings.length?d.bookings.map(b=>`<div class="departure-row"><div><strong>${b.name}</strong><small>Total ${money.format(b.total)} · Pagado ${money.format(b.paid)}</small></div><span class="status-chip ${b.total-b.paid<=0?"paid":"pending"}">${money.format(b.total-b.paid)} saldo</span></div>`).join(""):`<div class="empty">Sin pagos registrados.</div>`;
  } else if(tab==="billing"){
    $("#detailContent").innerHTML=d.bookings.length?d.bookings.map(b=>`<div class="departure-row"><div><strong>${b.name}</strong><small>${b.notes||"Sin notas"}</small></div><span class="status-chip ${b.billing==="facturada"?"paid":"pending"}">${billingLabel(b.billing)}</span></div>`).join(""):`<div class="empty">Sin datos de facturación.</div>`;
  }
}

initAuth();
