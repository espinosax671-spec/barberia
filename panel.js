let negocio = null;
let barberos = [];
let citas = [];
let currentBarberoServicios = null;
let currentBarberoHorarios = null;
let currentFilter = 'todas';

// ---------- Utilidades ----------
function minutesToLabel(mins) {
  if (mins === null || mins === undefined) return '';
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? 'p.m.' : 'a.m.';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}
function formatCOP(n) { return '$' + n.toLocaleString('es-CO'); }
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
function getInitials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ---------- Toast ----------
function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = msg;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ---------- Init ----------
async function init() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) {
    window.location.href = 'login.html';
    return;
  }

  const userId = sessionData.session.user.id;
  const userEmail = sessionData.session.user.email;

  const { data: negocioData, error } = await supabaseClient
    .from('negocios')
    .select('*')
    .eq('dueno_id', userId)
    .maybeSingle();

  if (error || !negocioData) {
    alert('No encontramos tu negocio. Serás redirigido al login.');
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
    return;
  }

  negocio = negocioData;

  // Header
  document.getElementById('negocioNombre').textContent = negocio.nombre;
  document.getElementById('userEmail').textContent = userEmail;

  // Plan badge
  const badge = document.getElementById('planBadge');
  const estadoLabels = {
    trial: '🎁 Prueba gratis',
    activa: '✓ Activa',
    vencida: 'Pago vencido',
    cancelada: 'Cancelada'
  };
  badge.textContent = estadoLabels[negocio.estado_suscripcion] || negocio.estado_suscripcion;
  badge.className = 'plan-badge ' + negocio.estado_suscripcion;

  // URL
  const tiendaUrl = `${APP_BASE_URL}/reservar.html?b=${negocio.subdominio}`;
  document.getElementById('tiendaUrl').textContent = tiendaUrl.replace(/^https?:\/\//, '');
  document.getElementById('viewShopBtn').href = tiendaUrl;
  const shareMsg = encodeURIComponent(`¡Agenda tu cita en ${negocio.nombre}! 💈\n${tiendaUrl}`);
  document.getElementById('shareWhatsappBtn').href = `https://wa.me/?text=${shareMsg}`;

  document.getElementById('copyUrlBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(tiendaUrl);
    showToast('URL copiada');
  });

  document.getElementById('loadingView').style.display = 'none';
  document.getElementById('panelView').style.display = 'block';

  await loadBarberos();
  await loadCitas();
  loadNegocioForm();
  loadNotificaciones();
}

// ---------- Logout ----------
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

    // Cargar contenido específico de la tab
    if (btn.dataset.tab === 'servicios') loadServicios();
    if (btn.dataset.tab === 'horarios') loadHorarios();
  });
});

// ---------- BARBEROS ----------
async function loadBarberos() {
  const { data, error } = await supabaseClient
    .from('barberos')
    .select('*')
    .eq('negocio_id', negocio.id)
    .order('orden', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  barberos = data || [];

  // Setear el primero como seleccionado por defecto
  if (barberos.length > 0) {
    if (!currentBarberoServicios) currentBarberoServicios = barberos[0].id;
    if (!currentBarberoHorarios) currentBarberoHorarios = barberos[0].id;
  }

  renderBarberosList();
  renderBarberosSelectors();
}

function renderBarberosList() {
  const list = document.getElementById('barberosList');
  if (!barberos.length) {
    list.innerHTML = `
      <div class="empty-state">
        <h3>No hay barberos</h3>
        <p>Agrega tu primer barbero para empezar a recibir citas.</p>
      </div>`;
    return;
  }
  list.innerHTML = '';
  barberos.forEach(b => {
    const card = document.createElement('div');
    card.className = 'barbero-card' + (b.activo ? '' : ' inactivo');
    card.innerHTML = `
      <div class="barbero-avatar">${getInitials(b.nombre)}</div>
      <div class="barbero-card-info">
        <strong>${b.nombre}</strong>
        <span>${b.telefono || 'Sin teléfono'}</span>
      </div>
      <div class="barbero-card-actions">
        <button class="edit-btn">Editar</button>
        <button class="toggle-btn">${b.activo ? 'Desactivar' : 'Activar'}</button>
        <button class="delete-btn">Eliminar</button>
      </div>
    `;
    card.querySelector('.edit-btn').addEventListener('click', () => openBarberoModal(b));
    card.querySelector('.toggle-btn').addEventListener('click', async () => {
      await supabaseClient.from('barberos').update({ activo: !b.activo }).eq('id', b.id);
      loadBarberos();
    });
    card.querySelector('.delete-btn').addEventListener('click', async () => {
      if (!confirm(`¿Eliminar al barbero "${b.nombre}"? Se borrarán también sus horarios y servicios.`)) return;
      await supabaseClient.from('barberos').delete().eq('id', b.id);
      showToast('Barbero eliminado');
      loadBarberos();
    });
    list.appendChild(card);
  });
}

function renderBarberosSelectors() {
  ['serviciosBarberoSelector', 'horariosBarberoSelector'].forEach(selectorId => {
    const container = document.getElementById(selectorId);
    container.innerHTML = '';
    barberos.forEach(b => {
      const chip = document.createElement('button');
      chip.className = 'barbero-chip';
      chip.textContent = b.nombre;
      const activeId = selectorId === 'serviciosBarberoSelector' ? currentBarberoServicios : currentBarberoHorarios;
      if (b.id === activeId) chip.classList.add('active');
      chip.addEventListener('click', () => {
        if (selectorId === 'serviciosBarberoSelector') {
          currentBarberoServicios = b.id;
          loadServicios();
        } else {
          currentBarberoHorarios = b.id;
          loadHorarios();
        }
      });
      container.appendChild(chip);
    });
  });
}

// Modal barbero
let editingBarberoId = null;

document.getElementById('addBarberoBtn').addEventListener('click', () => openBarberoModal(null));

function openBarberoModal(barbero) {
  editingBarberoId = barbero ? barbero.id : null;
  document.getElementById('barberoModalTitle').textContent = barbero ? 'Editar barbero' : 'Nuevo barbero';
  document.getElementById('modalBarberoNombre').value = barbero ? barbero.nombre : '';
  document.getElementById('modalBarberoTel').value = barbero ? barbero.telefono || '' : '';
  document.getElementById('barberoModal').style.display = 'flex';
}

document.getElementById('cancelBarberoBtn').addEventListener('click', () => {
  document.getElementById('barberoModal').style.display = 'none';
});

document.getElementById('barberoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.getElementById('modalBarberoNombre').value.trim();
  const telefono = document.getElementById('modalBarberoTel').value.trim();

  if (editingBarberoId) {
    await supabaseClient.from('barberos').update({ nombre, telefono }).eq('id', editingBarberoId);
    showToast('Barbero actualizado');
  } else {
    const { data: nuevoBarbero } = await supabaseClient
      .from('barberos')
      .insert({
        negocio_id: negocio.id,
        nombre,
        telefono,
        activo: true,
        orden: barberos.length + 1,
      })
      .select()
      .single();

    // Crear horarios por defecto
    if (nuevoBarbero) {
      const horarios = [
        { dia_semana: 0, abre_minuto: null, cierra_minuto: null },
        { dia_semana: 1, abre_minuto: 540, cierra_minuto: 1140 },
        { dia_semana: 2, abre_minuto: 540, cierra_minuto: 1140 },
        { dia_semana: 3, abre_minuto: 540, cierra_minuto: 1140 },
        { dia_semana: 4, abre_minuto: 540, cierra_minuto: 1140 },
        { dia_semana: 5, abre_minuto: 540, cierra_minuto: 1140 },
        { dia_semana: 6, abre_minuto: 540, cierra_minuto: 1020 },
      ].map(h => ({ ...h, negocio_id: negocio.id, barbero_id: nuevoBarbero.id }));
      await supabaseClient.from('horarios').insert(horarios);
    }
    showToast('Barbero creado');
  }
  document.getElementById('barberoModal').style.display = 'none';
  loadBarberos();
});

// ---------- CITAS ----------
async function loadCitas() {
  const { data, error } = await supabaseClient
    .from('citas')
    .select('*, barberos(nombre)')
    .eq('negocio_id', negocio.id)
    .order('fecha', { ascending: false })
    .order('hora_inicio', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  citas = data || [];
  renderCitas();
}

function renderCitas() {
  const list = document.getElementById('citasList');
  const hoy = todayStr();

  // Contadores
  const counts = {
    todas: citas.length,
    hoy: citas.filter(c => c.fecha === hoy).length,
    confirmada: citas.filter(c => c.estado === 'confirmada').length,
    completada: citas.filter(c => c.estado === 'completada').length,
    cancelada: citas.filter(c => c.estado === 'cancelada').length,
  };

  Object.keys(counts).forEach(k => {
    const el = document.getElementById('c-' + k);
    if (el) el.textContent = counts[k];
  });
  document.getElementById('citasCount').textContent = counts.confirmada;

  // Filtrar
  let filtradas = citas;
  if (currentFilter === 'hoy') filtradas = citas.filter(c => c.fecha === hoy);
  else if (currentFilter !== 'todas') filtradas = citas.filter(c => c.estado === currentFilter);

  if (!filtradas.length) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        <h3>No hay citas en esta vista</h3>
        <p>Cuando alguien reserve una cita, aparecerá aquí.</p>
      </div>`;
    return;
  }

  list.innerHTML = '';
  filtradas.forEach(cita => {
    const card = document.createElement('div');
    card.className = 'cita-card ' + (cita.estado || '');
    const fechaLabel = new Date(cita.fecha + 'T00:00:00').toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    const barberoNombre = cita.barberos ? cita.barberos.nombre : 'Sin barbero';
    card.innerHTML = `
      <div class="cita-info">
        <div class="cita-info-top">
          <strong>${cita.nombre_cliente}</strong>
          <span class="cita-badge ${cita.estado}">${cita.estado}</span>
        </div>
        <span>${cita.servicio_nombre} · ${formatCOP(cita.precio)} · con ${barberoNombre}</span>
        <span>${fechaLabel} · ${minutesToLabel(cita.hora_inicio)}</span>
        <span>Tel: ${cita.telefono}</span>
      </div>
      <div class="cita-actions">
        ${cita.estado === 'confirmada' ? `
          <button class="complete-btn" data-id="${cita.id}">Completar</button>
          <button class="cancel-btn" data-id="${cita.id}">Cancelar</button>
        ` : ''}
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('.complete-btn').forEach(b =>
    b.addEventListener('click', () => updateEstadoCita(b.dataset.id, 'completada'))
  );
  list.querySelectorAll('.cancel-btn').forEach(b =>
    b.addEventListener('click', () => updateEstadoCita(b.dataset.id, 'cancelada'))
  );
}

async function updateEstadoCita(id, estado) {
  const { error } = await supabaseClient.from('citas').update({ estado }).eq('id', id);
  if (error) return showToast('Error al actualizar', 'error');
  showToast(estado === 'completada' ? 'Cita completada' : 'Cita cancelada');
  loadCitas();
}

// Filtros
document.getElementById('citasFilterBar').addEventListener('click', (e) => {
  if (!e.target.classList.contains('filter-chip')) return;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  e.target.classList.add('active');
  currentFilter = e.target.dataset.filter;
  renderCitas();
});

// ---------- SERVICIOS ----------
async function loadServicios() {
  if (!currentBarberoServicios) return;
  renderBarberosSelectors();

  const { data, error } = await supabaseClient
    .from('servicios')
    .select('*')
    .eq('negocio_id', negocio.id)
    .eq('barbero_id', currentBarberoServicios)
    .order('orden', { ascending: true });

  const list = document.getElementById('serviciosList');
  if (error) {
    list.innerHTML = '<p class="hint">Error cargando servicios.</p>';
    return;
  }

  if (!data.length) {
    list.innerHTML = `
      <div class="empty-state">
        <h3>Este barbero no tiene servicios</h3>
        <p>Agrega servicios para que los clientes puedan reservar.</p>
      </div>`;
    return;
  }

  list.innerHTML = '';
  data.forEach(s => list.appendChild(renderServicioRow(s)));
}

function renderServicioRow(s) {
  const row = document.createElement('div');
  row.className = 'servicio-row' + (s.activo ? '' : ' inactivo');
  row.innerHTML = `
    <input type="text" value="${s.nombre}" data-field="nombre" placeholder="Nombre">
    <input type="number" value="${s.precio}" data-field="precio" placeholder="Precio">
    <input type="number" value="${s.duracion_min}" data-field="duracion_min" placeholder="Minutos">
    <div class="row-actions">
      <button class="save-btn">Guardar</button>
      <button class="toggle-btn">${s.activo ? 'Ocultar' : 'Mostrar'}</button>
      <button class="delete-btn">Eliminar</button>
    </div>
  `;

  row.querySelector('.save-btn').addEventListener('click', async () => {
    const nombre = row.querySelector('[data-field="nombre"]').value.trim();
    const precio = parseInt(row.querySelector('[data-field="precio"]').value, 10);
    const duracion_min = parseInt(row.querySelector('[data-field="duracion_min"]').value, 10);
    await supabaseClient.from('servicios').update({ nombre, precio, duracion_min }).eq('id', s.id);
    showToast('Servicio actualizado');
    loadServicios();
  });

  row.querySelector('.toggle-btn').addEventListener('click', async () => {
    await supabaseClient.from('servicios').update({ activo: !s.activo }).eq('id', s.id);
    loadServicios();
  });

  row.querySelector('.delete-btn').addEventListener('click', async () => {
    if (!confirm(`¿Eliminar "${s.nombre}"?`)) return;
    await supabaseClient.from('servicios').delete().eq('id', s.id);
    showToast('Servicio eliminado');
    loadServicios();
  });

  return row;
}

document.getElementById('addServicioBtn').addEventListener('click', async () => {
  if (!currentBarberoServicios) {
    showToast('Selecciona un barbero primero', 'error');
    return;
  }
  await supabaseClient.from('servicios').insert({
    negocio_id: negocio.id,
    barbero_id: currentBarberoServicios,
    nombre: 'Nuevo servicio',
    precio: 0,
    duracion_min: 30,
    activo: true,
    orden: 999,
  });
  loadServicios();
});

// ---------- HORARIOS ----------
async function loadHorarios() {
  if (!currentBarberoHorarios) return;
  renderBarberosSelectors();

  const { data, error } = await supabaseClient
    .from('horarios')
    .select('*')
    .eq('negocio_id', negocio.id)
    .eq('barbero_id', currentBarberoHorarios)
    .order('dia_semana', { ascending: true });

  const list = document.getElementById('horariosList');
  if (error) {
    list.innerHTML = '<p class="hint">Error cargando horarios.</p>';
    return;
  }

  list.innerHTML = '';
  data.forEach(h => {
    const abierto = h.abre_minuto !== null;
    const row = document.createElement('div');
    row.className = 'horario-row';
    row.dataset.id = h.id;
    row.innerHTML = `
      <span class="dia-nombre">${DIAS[h.dia_semana]}</span>
      <label>
        <input type="checkbox" class="abierto-check" ${abierto ? 'checked' : ''}>
        Abierto
      </label>
      <label>Desde
        <input type="time" class="abre-input" value="${minutesToHHMM(h.abre_minuto) || '09:00'}" ${abierto ? '' : 'disabled'}>
      </label>
      <label>Hasta
        <input type="time" class="cierra-input" value="${minutesToHHMM(h.cierra_minuto) || '19:00'}" ${abierto ? '' : 'disabled'}>
      </label>
    `;
    const check = row.querySelector('.abierto-check');
    const abreInput = row.querySelector('.abre-input');
    const cierraInput = row.querySelector('.cierra-input');
    check.addEventListener('change', () => {
      abreInput.disabled = !check.checked;
      cierraInput.disabled = !check.checked;
    });
    list.appendChild(row);
  });
}

document.getElementById('guardarHorariosBtn').addEventListener('click', async () => {
  const filas = document.querySelectorAll('#horariosList .horario-row');
  const actualizaciones = [];
  filas.forEach(row => {
    const abierto = row.querySelector('.abierto-check').checked;
    const abre = abierto ? hhmmToMinutes(row.querySelector('.abre-input').value) : null;
    const cierra = abierto ? hhmmToMinutes(row.querySelector('.cierra-input').value) : null;
    actualizaciones.push(
      supabaseClient.from('horarios').update({
        abre_minuto: abre,
        cierra_minuto: cierra
      }).eq('id', row.dataset.id)
    );
  });

  const resultados = await Promise.all(actualizaciones);
  const huboError = resultados.some(r => r.error);
  showToast(huboError ? 'Error al guardar' : 'Horarios actualizados', huboError ? 'error' : 'success');
});

// ---------- DISEÑO / NEGOCIO ----------
function loadNegocioForm() {
  document.getElementById('campoNombre').value = negocio.nombre || '';
  document.getElementById('campoDescripcion').value = negocio.descripcion || '';
  document.getElementById('campoDireccion').value = negocio.direccion || '';
  document.getElementById('campoCiudad').value = negocio.ciudad || '';
  document.getElementById('campoTelefono').value = negocio.telefono_whatsapp || '';
}

document.getElementById('negocioForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const nombre = document.getElementById('campoNombre').value.trim();
  const descripcion = document.getElementById('campoDescripcion').value.trim();
  const direccion = document.getElementById('campoDireccion').value.trim();
  const ciudad = document.getElementById('campoCiudad').value.trim();
  const telefono_whatsapp = document.getElementById('campoTelefono').value.trim();

  const { error } = await supabaseClient
    .from('negocios')
    .update({ nombre, descripcion, direccion, ciudad, telefono_whatsapp })
    .eq('id', negocio.id);

  if (error) return showToast('Error al guardar', 'error');

  negocio.nombre = nombre;
  document.getElementById('negocioNombre').textContent = nombre;
  showToast('Datos actualizados');
});

// ---------- NOTIFICACIONES ----------
async function loadNotificaciones() {
  const { data } = await supabaseClient
    .from('notificaciones')
    .select('*')
    .eq('negocio_id', negocio.id)
    .order('creado_en', { ascending: false })
    .limit(20);

  const noLeidas = (data || []).filter(n => !n.leida).length;
  const badge = document.getElementById('notifBadge');
  if (noLeidas > 0) {
    badge.textContent = noLeidas;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }

  renderNotifDropdown(data || []);
}

function renderNotifDropdown(notifs) {
  const dropdown = document.getElementById('notifDropdown');
  dropdown.innerHTML = `
    <div class="notif-dropdown-header">
      <strong>Notificaciones</strong>
      ${notifs.some(n => !n.leida) ? '<button class="notif-mark-read" id="markAllReadBtn">Marcar leídas</button>' : ''}
    </div>
  `;
  if (!notifs.length) {
    dropdown.innerHTML += '<div class="notif-empty">No tienes notificaciones</div>';
    return;
  }
  notifs.forEach(n => {
    const item = document.createElement('div');
    item.className = 'notif-item' + (n.leida ? '' : ' no-leida');
    const fecha = new Date(n.creado_en).toLocaleString('es-CO', {
      day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'
    });
    item.innerHTML = `
      <strong>${n.titulo}</strong>
      <p>${n.mensaje || ''}</p>
      <time>${fecha}</time>
    `;
    dropdown.appendChild(item);
  });

  const markAllBtn = document.getElementById('markAllReadBtn');
  if (markAllBtn) {
    markAllBtn.addEventListener('click', async () => {
      await supabaseClient
        .from('notificaciones')
        .update({ leida: true })
        .eq('negocio_id', negocio.id)
        .eq('leida', false);
      loadNotificaciones();
    });
  }
}

document.getElementById('notifBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  const dd = document.getElementById('notifDropdown');
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#notifBtn') && !e.target.closest('#notifDropdown')) {
    document.getElementById('notifDropdown').style.display = 'none';
  }
});

// Auto-refresh notificaciones cada 30 segundos
setInterval(loadNotificaciones, 30000);

// Arrancar
init();
