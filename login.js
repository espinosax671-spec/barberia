let negocio = null;

function minutesToLabel(mins) {
  if (mins === null || mins === undefined) return '';
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? 'p.m.' : 'a.m.';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}
function formatCOP(n) {
  return '$' + n.toLocaleString('es-CO');
}
function minutesToHHMM(mins) {
  if (mins === null || mins === undefined) return '';
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
function hhmmToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ---------- Sesión y carga inicial ----------
async function init() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) {
    window.location.href = 'login.html';
    return;
  }

  const userId = sessionData.session.user.id;
  const { data: negocioData, error } = await supabaseClient
    .from('negocios')
    .select('*')
    .eq('dueno_id', userId)
    .maybeSingle();

  if (error || !negocioData) {
    window.location.href = 'login.html';
    return;
  }

  negocio = negocioData;

  document.getElementById('negocioNombre').innerHTML = negocio.nombre;
  const link = document.getElementById('negocioLink');
  link.textContent = `${negocio.subdominio}.tuapp.com`;
  link.href = `https://${negocio.subdominio}.tuapp.com`;

  const badge = document.getElementById('planBadge');
  const estadoLabels = { trial: 'Prueba gratis', activa: 'Suscripción activa', vencida: 'Pago vencido', cancelada: 'Cancelada' };
  badge.textContent = estadoLabels[negocio.estado_suscripcion] || negocio.estado_suscripcion;
  badge.className = 'plan-badge ' + negocio.estado_suscripcion;

  document.getElementById('loadingView').style.display = 'none';
  document.getElementById('panelView').style.display = 'block';

  loadCitas();
  loadServicios();
  loadHorarios();
  loadNegocioForm();
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
});

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).style.display = 'block';
  });
});

// ---------- CITAS ----------
const citasListEl = document.getElementById('citasList');
const filterDateEl = document.getElementById('filterDate');

async function loadCitas() {
  citasListEl.innerHTML = '<p class="hint">Cargando citas…</p>';

  let query = supabaseClient
    .from('citas')
    .select('*')
    .eq('negocio_id', negocio.id)
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (filterDateEl.value) query = query.eq('fecha', filterDateEl.value);

  const { data, error } = await query;

  if (error) {
    citasListEl.innerHTML = '<p class="hint">Error cargando las citas.</p>';
    return;
  }
  if (!data.length) {
    citasListEl.innerHTML = '<p class="hint">No hay citas para mostrar.</p>';
    return;
  }

  citasListEl.innerHTML = '';
  data.forEach(cita => {
    const card = document.createElement('div');
    card.className = 'cita-card ' + (cita.estado || '');
    const fechaLabel = new Date(cita.fecha + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    card.innerHTML = `
      <div class="cita-info">
        <strong>${cita.nombre_cliente} · ${cita.servicio_nombre}</strong>
        <span>${fechaLabel} · ${minutesToLabel(cita.hora_inicio)} · ${formatCOP(cita.precio)}</span>
        <span>Tel: ${cita.telefono} · Estado: ${cita.estado}</span>
      </div>
      <div class="cita-actions">
        ${cita.estado === 'confirmada' ? `
          <button class="complete-btn" data-id="${cita.id}">Marcar completada</button>
          <button class="cancel-btn" data-id="${cita.id}">Cancelar</button>` : ''}
      </div>`;
    citasListEl.appendChild(card);
  });

  citasListEl.querySelectorAll('.complete-btn').forEach(b => b.addEventListener('click', () => updateEstadoCita(b.dataset.id, 'completada')));
  citasListEl.querySelectorAll('.cancel-btn').forEach(b => b.addEventListener('click', () => updateEstadoCita(b.dataset.id, 'cancelada')));
}

async function updateEstadoCita(id, estado) {
  await supabaseClient.from('citas').update({ estado }).eq('id', id);
  loadCitas();
}

filterDateEl.addEventListener('change', loadCitas);
document.getElementById('clearFilter').addEventListener('click', () => { filterDateEl.value = ''; loadCitas(); });

// ---------- SERVICIOS ----------
const serviciosListEl = document.getElementById('serviciosList');

async function loadServicios() {
  serviciosListEl.innerHTML = '<p class="hint">Cargando servicios…</p>';
  const { data, error } = await supabaseClient
    .from('servicios')
    .select('*')
    .eq('negocio_id', negocio.id)
    .order('orden', { ascending: true });

  if (error) { serviciosListEl.innerHTML = '<p class="hint">Error cargando servicios.</p>'; return; }

  serviciosListEl.innerHTML = '';
  if (!data.length) {
    serviciosListEl.innerHTML = '<p class="hint">Aún no tienes servicios. Agrega el primero.</p>';
    return;
  }
  data.forEach(s => serviciosListEl.appendChild(renderServicioRow(s)));
}

function renderServicioRow(s) {
  const row = document.createElement('div');
  row.className = 'servicio-row' + (s.activo ? '' : ' inactivo');
  row.innerHTML = `
    <input type="text" value="${s.nombre}" data-field="nombre" placeholder="Nombre del servicio">
    <input type="number" value="${s.precio}" data-field="precio" placeholder="Precio">
    <input type="number" value="${s.duracion_min}" data-field="duracion_min" placeholder="Minutos">
    <div class="servicio-actions">
      <button class="save-btn">Guardar</button>
      <button class="toggle-btn">${s.activo ? 'Desactivar' : 'Activar'}</button>
    </div>
  `;
  row.querySelector('.save-btn').addEventListener('click', async () => {
    const nombre = row.querySelector('[data-field="nombre"]').value.trim();
    const precio = parseInt(row.querySelector('[data-field="precio"]').value, 10);
    const duracion_min = parseInt(row.querySelector('[data-field="duracion_min"]').value, 10);
    await supabaseClient.from('servicios').update({ nombre, precio, duracion_min }).eq('id', s.id);
    loadServicios();
  });
  row.querySelector('.toggle-btn').addEventListener('click', async () => {
    await supabaseClient.from('servicios').update({ activo: !s.activo }).eq('id', s.id);
    loadServicios();
  });
  return row;
}

document.getElementById('addServicioBtn').addEventListener('click', async () => {
  await supabaseClient.from('servicios').insert({
    negocio_id: negocio.id,
    nombre: 'Nuevo servicio',
    precio: 0,
    duracion_min: 30,
  });
  loadServicios();
});

// ---------- HORARIOS ----------
const horariosListEl = document.getElementById('horariosList');
let horariosState = [];

async function loadHorarios() {
  horariosListEl.innerHTML = '<p class="hint">Cargando horario…</p>';
  const { data, error } = await supabaseClient
    .from('horarios')
    .select('*')
    .eq('negocio_id', negocio.id)
    .order('dia_semana', { ascending: true });

  if (error) { horariosListEl.innerHTML = '<p class="hint">Error cargando el horario.</p>'; return; }

  horariosState = data;
  horariosListEl.innerHTML = '';
  data.forEach(h => {
    const abierto = h.abre_minuto !== null;
    const row = document.createElement('div');
    row.className = 'horario-row';
    row.dataset.id = h.id;
    row.innerHTML = `
      <span class="dia-nombre">${DIAS[h.dia_semana]}</span>
      <label><input type="checkbox" class="abierto-check" ${abierto ? 'checked' : ''}> Abierto</label>
      <label>Desde <input type="time" class="abre-input" value="${minutesToHHMM(h.abre_minuto) || '09:00'}" ${abierto ? '' : 'disabled'}></label>
      <label>Hasta <input type="time" class="cierra-input" value="${minutesToHHMM(h.cierra_minuto) || '19:00'}" ${abierto ? '' : 'disabled'}></label>
    `;
    const check = row.querySelector('.abierto-check');
    const abreInput = row.querySelector('.abre-input');
    const cierraInput = row.querySelector('.cierra-input');
    check.addEventListener('change', () => {
      abreInput.disabled = !check.checked;
      cierraInput.disabled = !check.checked;
    });
    horariosListEl.appendChild(row);
  });
}

document.getElementById('guardarHorariosBtn').addEventListener('click', async () => {
  const msg = document.getElementById('horarioMsg');
  msg.textContent = 'Guardando…';
  msg.className = 'form-msg';

  const filas = horariosListEl.querySelectorAll('.horario-row');
  const actualizaciones = [];
  filas.forEach(row => {
    const abierto = row.querySelector('.abierto-check').checked;
    const abre = abierto ? hhmmToMinutes(row.querySelector('.abre-input').value) : null;
    const cierra = abierto ? hhmmToMinutes(row.querySelector('.cierra-input').value) : null;
    actualizaciones.push(
      supabaseClient.from('horarios').update({ abre_minuto: abre, cierra_minuto: cierra }).eq('id', row.dataset.id)
    );
  });

  const resultados = await Promise.all(actualizaciones);
  const huboError = resultados.some(r => r.error);

  msg.textContent = huboError ? 'Hubo un problema guardando el horario.' : 'Horario actualizado.';
  msg.classList.add(huboError ? 'error' : 'ok');
});

// ---------- MI NEGOCIO ----------
function loadNegocioForm() {
  document.getElementById('campoNombre').value = negocio.nombre || '';
  document.getElementById('campoDireccion').value = negocio.direccion || '';
  document.getElementById('campoTelefono').value = negocio.telefono_whatsapp || '';
}

document.getElementById('negocioForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('negocioMsg');
  msg.textContent = 'Guardando…';
  msg.className = 'form-msg';

  const nombre = document.getElementById('campoNombre').value.trim();
  const direccion = document.getElementById('campoDireccion').value.trim();
  const telefono_whatsapp = document.getElementById('campoTelefono').value.trim();

  const { error } = await supabaseClient
    .from('negocios')
    .update({ nombre, direccion, telefono_whatsapp })
    .eq('id', negocio.id);

  if (error) {
    msg.textContent = 'No se pudo guardar: ' + error.message;
    msg.classList.add('error');
    return;
  }

  negocio.nombre = nombre;
  document.getElementById('negocioNombre').innerHTML = nombre;
  msg.textContent = 'Guardado correctamente.';
  msg.classList.add('ok');
});

init();
