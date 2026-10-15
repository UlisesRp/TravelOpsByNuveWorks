// Travel Ops V3: CRM compartido; aislado de crm_leads de V2.
(() => {
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let clients = [];
  let editId = null;
  let busy = false;
  const fields = ['client_type','name','commercial_name','contact_name','phone','whatsapp','email','rfc','fiscal_address','notes'];
  const message = () => byId('v3ClientMessage');
  const modal = () => byId('v3ClientModal');
  const form = () => byId('v3ClientForm');
  function loggedInClient() { return state?.supabase && state.user?.id !== 'demo-user' ? state.supabase : null; }
  function render() {
    const list = byId('v3ClientList');
    if (!list) return;
    list.innerHTML = clients.length ? `<div style="display:grid;gap:10px">${clients.map(c => `<div style="border:1px solid #dce1e9;border-radius:12px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><strong>${esc(c.name)}</strong><div class="muted">${c.client_type === 'agencia' ? 'Agencia' : 'Cliente directo'} · ${esc(c.contact_name || c.commercial_name || c.phone || c.email || 'Sin contacto')}</div></div><button type="button" class="small-btn" data-v3-edit="${esc(c.id)}">Editar</button></div>`).join('')}</div>` : '<p class="muted">Todavía no hay clientes V3 registrados.</p>';
    list.querySelectorAll('[data-v3-edit]').forEach(b => b.addEventListener('click', () => open(clients.find(c => c.id === b.dataset.v3Edit))));
  }
  async function load() {
    const sb = loggedInClient();
    if (!sb) { message().textContent = 'Inicia sesión con tu cuenta para usar Clientes V3. El modo demo no guarda datos.'; byId('v3NewClient').disabled = true; return; }
    byId('v3NewClient').disabled = false;
    message().textContent = 'Consultando clientes V3...';
    const {data,error} = await sb.from('v3_clients').select('*').order('name');
    if (error) { message().textContent = 'No se pudo consultar Clientes V3: ' + error.message; return; }
    clients = data || [];
    message().textContent = `${clients.length} cliente(s) en CRM V3`;
    render();
  }
  function open(client) {
    if (!loggedInClient()) { alert('Inicia sesión para guardar clientes.'); return; }
    editId = client?.id || null;
    form().reset();
    byId('v3ClientFormError').textContent = '';
    byId('v3ClientModalTitle').textContent = editId ? 'Editar cliente' : 'Nuevo cliente';
    for (const name of fields) form().elements.namedItem(name).value = client?.[name] || (name === 'client_type' ? 'directo' : '');
    modal().showModal();
  }
  byId('v3NewClient').addEventListener('click', () => open(null));
  byId('v3ClientClose').addEventListener('click', () => modal().close());
  byId('v3ClientCancel').addEventListener('click', () => modal().close());
  form().addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;
    const sb = loggedInClient(); if (!sb) return;
    const payload = Object.fromEntries(fields.map(key => [key, form().elements.namedItem(key).value.trim()]));
    if (!payload.name) return;
    for (const key of fields) if (key !== 'name' && key !== 'client_type' && !payload[key]) payload[key] = null;
    busy = true;
    byId('v3ClientSave').disabled = true;
    byId('v3ClientFormError').textContent = '';
    try {
      const op = editId ? sb.from('v3_clients').update(payload).eq('id', editId).select().single() : sb.from('v3_clients').insert(payload).select().single();
      const {error} = await op;
      if (error) throw error;
      modal().close();
      await load();
    } catch (err) { byId('v3ClientFormError').textContent = 'No se guardó el cliente: ' + (err.message || err); }
    finally { busy = false; byId('v3ClientSave').disabled = false; }
  });
  window.v3LoadClients = load;
})();
