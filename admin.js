let negocios = [];

function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = msg;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

async function loadData() {
  const { data, error } = await supabaseClient.rpc('obtener_negocios');

  if (error) {
    showToast('Error al cargar: ' + error.message, 'error');
    return;
  }

  negocios = (data || []).sort((a, b) => {
    if (a.aprobado !== b.aprobado) return a.aprobado ? 1 : -1;
    return (a.nombre || '').localeCompare(b.nombre || '');
  });
  renderStats();
  renderTable();
}

function renderStats() {
  const total = negocios.length;
  const pendientes = negocios.filter(n => !n.aprobado).length;
  const aprobadas = total - pendientes;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statPendientes').textContent = pendientes;
  document.getElementById('statAprobadas').textContent = aprobadas;
}

function formatTrial(fecha) {
  if (!fecha) return '—';
  const d = new Date(fecha);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderTable() {
  const tbody = document.getElementById('negociosTable');
  const empty = document.getElementById('emptyMsg');

  tbody.innerHTML = '';
  empty.style.display = negocios.length ? 'none' : 'block';

  negocios.forEach(n => {
    const tr = document.createElement('tr');

    const estadoChip = n.aprobado
      ? '<span class="badge aprobada">Aprobada</span>'
      : '<span class="badge pendiente">Pendiente</span>';

    const contacto = [
      n.email_contacto || '',
      n.telefono_whatsapp ? 'WhatsApp: ' + n.telefono_whatsapp : '',
    ].filter(Boolean).join('<br>');

    const acciones = n.aprobado
      ? `<button class="btn-action" data-action="bloquear" data-id="${n.id}">Bloquear</button>`
      : `<button class="btn-action primary" data-action="aprobar" data-id="${n.id}">Aprobar</button>`;

    tr.innerHTML = `
      <td><strong>${escapeHtml(n.nombre)}</strong></td>
      <td><a href="${APP_BASE_URL}/reservar.html?b=${n.subdominio}" target="_blank" class="admin-link">/${escapeHtml(n.subdominio)}</a></td>
      <td>${contacto}</td>
      <td>${formatTrial(n.trial_termina_en)}</td>
      <td>${estadoChip}</td>
      <td>${acciones}</td>
    `;

    const approveBtn = tr.querySelector('[data-action="aprobar"]');
    if (approveBtn) approveBtn.addEventListener('click', () => cambiarEstado(n.id, true));

    const blockBtn = tr.querySelector('[data-action="bloquear"]');
    if (blockBtn) blockBtn.addEventListener('click', () => cambiarEstado(n.id, false));

    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function cambiarEstado(id, aprobado) {
  const { error } = await supabaseClient.rpc('aprobar_negocio', {
    p_id: id,
    p_aprobado: aprobado,
  });

  if (error) {
    showToast('Error: ' + error.message, 'error');
    return;
  }

  showToast(aprobado ? 'Barberia aprobada' : 'Barberia bloqueada');
  loadData();
}

async function init() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) {
    window.location.href = 'login.html';
    return;
  }

  const { data: esAdmin } = await supabaseClient.rpc('es_admin');
  if (esAdmin !== true) {
    window.location.href = 'login.html';
    return;
  }

  document.getElementById('userEmail').textContent = sessionData.session.user.email;
  document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });
  document.getElementById('refreshBtn').addEventListener('click', loadData);

  document.getElementById('loadingView').style.display = 'none';
  document.getElementById('adminView').style.display = 'block';

  await loadData();
}

init();