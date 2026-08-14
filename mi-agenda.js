let barbero = null;
let negocio = null;
let citas = [];
let currentFilter = 'hoy';

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
function getInitials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
function endOfWeekStr() {
  const d = new Date();
  const diff = 7 - d.getDay();
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
function dateKey(d) {
  const yyyy = d.getFullYear();
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ============================================
// FESTIVOS COLOMBIA
// ============================================
function calcularPascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

function getFestivosColombiaAnio(anio) {
  const festivos = [];

  const fijos = [
    { mes: 1, dia: 1, nombre: 'Año Nuevo' },
    { mes: 5, dia: 1, nombre: 'Dia del Trabajo' },
    { mes: 7, dia: 20, nombre: 'Independencia' },
    { mes: 8, dia: 7, nombre: 'Batalla de Boyaca' },
    { mes: 12, dia: 8, nombre: 'Inmaculada Concepcion' },
    { mes: 12, dia: 25, nombre: 'Navidad' },
  ];
  fijos.forEach(f => {
    festivos.push({
      fecha: new Date(anio, f.mes - 1, f.dia),
      nombre: f.nombre,
    });
  });

  const emiliani = [
    { mes: 1, dia: 6, nombre: 'Reyes Magos' },
    { mes: 3, dia: 19, nombre: 'San Jose' },
    { mes: 6, dia: 29, nombre: 'San Pedro y San Pablo' },
    { mes: 8, dia: 15, nombre: 'Asuncion' },
    { mes: 10, dia: 12, nombre: 'Dia de la Raza' },
    { mes: 11, dia: 1, nombre: 'Todos los Santos' },
    { mes: 11, dia: 11, nombre: 'Independencia de Cartagena' },
  ];
  emiliani.forEach(f => {
    const fecha = new Date(anio, f.mes - 1, f.dia);
    const dow = fecha.getDay();
    if (dow !== 1) {
      const diff = dow === 0 ? 1 : 8 - dow;
      fecha.setDate(fecha.getDate() + diff);
    }
    festivos.push({ fecha, nombre: f.nombre });
  });

  const pascua = calcularPascua(anio);

  const juevesSanto = new Date(pascua);
  juevesSanto.setDate(pascua.getDate() - 3);
  festivos.push({ fecha: juevesSanto, nombre: 'Jueves Santo' });

  const viernesSanto = new Date(pascua);
  viernesSanto.setDate(pascua.getDate() - 2);
  festivos.push({ fecha: viernesSanto, nombre: 'Viernes Santo' });

  const pascuales = [
    { offset: 39, nombre: 'Ascension del Señor' },
    { offset: 60, nombre: 'Corpus Christi' },
    { offset: 68, nombre: 'Sagrado Corazon' },
  ];
  pascuales.forEach(p => {
    const f = new Date(pascua);
    f.setDate(pascua.getDate() + p.offset);
    const dow = f.getDay();
    if (dow !== 1) {
      const diff = dow === 0 ? 1 : 8 - dow;
      f.setDate(f.getDate() + diff);
    }
    festivos.push({ fecha: f, nombre: p.nombre });
  });

  return festivos;
}

// ============================================
// TOAST
// ============================================
function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = msg;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ============================================
// INIT
// ============================================
async function init() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) {
    window.location.href = 'login.html';
    return;
  }

  const userId = sessionData.session.user.id;
  const userEmail = sessionData.session.user.email;

  const { data: barberoData, error } = await supabaseClient
    .from('barberos')
    .select('*, negocios(nombre, subdominio)')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (error || !barberoData) {
    alert('No encontramos tu cuenta de barbero. Seras redirigido al login.');
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
    return;
  }

  barbero = barberoData;
  negocio = barberoData.negocios;

  document.getElementById('barberoNombre').textContent = barbero.nombre;
  document.getElementById('negocioNombreLabel').textContent = negocio.nombre;
  document.getElementById('userEmail').textContent = userEmail;

  const initials = getInitials(barbero.nombre);
  document.getElementById('avatarInitials').textContent = initials;
  if (barbero.foto_url) {
    const img = document.getElementById('avatarImg');
    img.src = barbero.foto_url;
    img.style.display = 'block';
    document.getElementById('avatarInitials').style.display = 'none';
  }

  loadPerfilForm();

  document.getElementById('loadingView').style.display = 'none';
  document.getElementById('agendaView').style.display = 'block';

  await loadCitas();
  initRealtime();
}

// ============================================
// REALTIME
// ============================================
function initRealtime() {
  supabaseClient
    .channel('mis-citas-' + barbero.id)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'citas', filter: `barbero_id=eq.${barbero.id}` },
      (payload) => {
        loadCitas();
        if (payload.eventType === 'INSERT') {
          showToast(`Nueva cita: ${payload.new.nombre_cliente}`);
          playNotifSound();
        }
      }
    )
    .subscribe();
}

function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).style.display = 'block';
  });
});

// ============================================
// CITAS
// ============================================
async function loadCitas() {
  const { data, error } = await supabaseClient
    .from('citas').select('*')
    .eq('barbero_id', barbero.id)
    .in('estado', ['confirmada', 'completada', 'cancelada'])
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (error) { console.error(error); return; }

  citas = data || [];
  renderCitas();
}

function renderCitas() {
  const list = document.getElementById('citasList');
  const hoy = todayStr();
  const manana = tomorrowStr();
  const finSemana = endOfWeekStr();

  const counts = {
    hoy: citas.filter(c => c.fecha === hoy && c.estado === 'confirmada').length,
    manana: citas.filter(c => c.fecha === manana && c.estado === 'confirmada').length,
    semana: citas.filter(c => c.fecha >= hoy && c.fecha <= finSemana && c.estado === 'confirmada').length,
    todas: citas.filter(c => c.estado === 'confirmada').length,
  };

  Object.keys(counts).forEach(k => {
    const el = document.getElementById('c-' + k);
    if (el) el.textContent = counts[k];
  });
  document.getElementById('citasCount').textContent = counts.hoy;

  let filtradas = citas;
  if (currentFilter === 'hoy') {
    filtradas = citas.filter(c => c.fecha === hoy);
  } else if (currentFilter === 'manana') {
    filtradas = citas.filter(c => c.fecha === manana);
  } else if (currentFilter === 'semana') {
    filtradas = citas.filter(c => c.fecha >= hoy && c.fecha <= finSemana);
  }

  if (!filtradas.length) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        <h3>No hay citas en esta vista</h3>
        <p>Cuando tengas citas confirmadas apareceran aqui.</p>
      </div>`;
    return;
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let siguienteId = null;
  const citasHoyConfirmadas = filtradas
    .filter(c => c.fecha === hoy && c.estado === 'confirmada' && c.hora_inicio >= nowMinutes)
    .sort((a, b) => a.hora_inicio - b.hora_inicio);
  if (citasHoyConfirmadas.length > 0) {
    siguienteId = citasHoyConfirmadas[0].id;
  }

  list.innerHTML = '';
  filtradas.forEach(cita => {
    const card = document.createElement('div');
    card.className = 'cita-card ' + (cita.estado || '');
    if (cita.id === siguienteId) card.classList.add('siguiente');

    const fechaLabel = new Date(cita.fecha + 'T00:00:00').toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long'
    });

    const telFormatted = cita.telefono.replace(/\s/g, '');
    const waLink = `https://wa.me/57${telFormatted}?text=${encodeURIComponent(`Hola ${cita.nombre_cliente}, te contacto de ${negocio.nombre}`)}`;

    card.innerHTML = `
      <div class="cita-hora-badge">${minutesToLabel(cita.hora_inicio)}</div>
      <div class="cita-info">
        <div class="cita-info-top">
          <strong>${cita.nombre_cliente}</strong>
          <span class="cita-badge ${cita.estado}">${cita.estado}</span>
        </div>
        <span>${cita.servicio_nombre} · ${formatCOP(cita.precio)} · ${cita.duracion} min</span>
        <span>${fechaLabel}</span>
        <span>Tel: <a href="${waLink}" target="_blank">${cita.telefono}</a></span>
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
    b.addEventListener('click', () => updateEstadoCita(b.dataset.id, 'completada')));
  list.querySelectorAll('.cancel-btn').forEach(b =>
    b.addEventListener('click', () => updateEstadoCita(b.dataset.id, 'cancelada')));
}

async function updateEstadoCita(id, estado) {
  const { error } = await supabaseClient.from('citas').update({ estado }).eq('id', id);
  if (error) return showToast('Error al actualizar', 'error');
  showToast(estado === 'completada' ? 'Cita completada' : 'Cita cancelada');
  loadCitas();
}

document.getElementById('filterBar').addEventListener('click', (e) => {
  if (!e.target.classList.contains('filter-chip')) return;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  e.target.classList.add('active');
  currentFilter = e.target.dataset.filter;
  renderCitas();
});

// ============================================
// PERFIL
// ============================================
function loadPerfilForm() {
  document.getElementById('perfilNombre').value = barbero.nombre || '';
  document.getElementById('perfilTelefono').value = barbero.telefono || '';
  document.getElementById('perfilEmail').value = barbero.email || '';

  const fotoImg = document.getElementById('fotoImg');
  const fotoPlaceholder = document.getElementById('fotoPlaceholder');
  const removeBtn = document.getElementById('removeFotoBtn');

  fotoPlaceholder.textContent = getInitials(barbero.nombre);

  if (barbero.foto_url) {
    fotoImg.src = barbero.foto_url;
    fotoImg.style.display = 'block';
    fotoPlaceholder.style.display = 'none';
    removeBtn.style.display = 'inline-flex';
  } else {
    fotoImg.style.display = 'none';
    fotoPlaceholder.style.display = 'block';
    removeBtn.style.display = 'none';
  }

  loadFestivosBarbero();
}

document.getElementById('perfilForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  const nombre = document.getElementById('perfilNombre').value.trim();
  const telefono = document.getElementById('perfilTelefono').value.trim();
  const email = document.getElementById('perfilEmail').value.trim().toLowerCase();

  try {
    const { error: updateError } = await supabaseClient
      .from('barberos')
      .update({ nombre, telefono })
      .eq('id', barbero.id);

    if (updateError) {
      showToast('Error al guardar datos', 'error');
      submitBtn.disabled = false;
      return;
    }

    barbero.nombre = nombre;
    barbero.telefono = telefono;
    document.getElementById('barberoNombre').textContent = nombre;
    document.getElementById('avatarInitials').textContent = getInitials(nombre);
    document.getElementById('fotoPlaceholder').textContent = getInitials(nombre);

    const emailAnterior = (barbero.email || '').toLowerCase();
    if (email !== emailAnterior) {
      const { error: authError } = await supabaseClient.auth.updateUser({ email });

      if (authError) {
        showToast('Error al cambiar email: ' + authError.message, 'error');
        submitBtn.disabled = false;
        return;
      }

      const { error: emailError } = await supabaseClient
        .from('barberos')
        .update({ email })
        .eq('id', barbero.id);

      if (emailError) {
        showToast('Error al guardar el email', 'error');
        submitBtn.disabled = false;
        return;
      }

      barbero.email = email;
      document.getElementById('userEmail').textContent = email;
    }

    showToast('Datos actualizados');
  } catch (err) {
    console.error(err);
    showToast('Error inesperado', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

document.getElementById('uploadFotoBtn').addEventListener('click', () => {
  document.getElementById('fotoInput').click();
});

document.getElementById('fotoInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('Max 2MB', 'error'); return; }
  if (!file.type.startsWith('image/')) { showToast('Solo imagenes', 'error'); return; }

  showToast('Subiendo foto...');

  const fileExt = file.name.split('.').pop();
  const fileName = `foto-${Date.now()}.${fileExt}`;
  const filePath = `${barbero.id}/${fileName}`;

  const { error: uploadError } = await supabaseClient.storage
    .from('barberos').upload(filePath, file, { cacheControl: '3600', upsert: true });

  if (uploadError) return showToast('Error: ' + uploadError.message, 'error');

  const { data: urlData } = supabaseClient.storage.from('barberos').getPublicUrl(filePath);
  const fotoUrl = urlData.publicUrl;

  const { error: updateError } = await supabaseClient
    .from('barberos').update({ foto_url: fotoUrl }).eq('id', barbero.id);

  if (updateError) return showToast('Error al guardar', 'error');

  barbero.foto_url = fotoUrl;

  document.getElementById('fotoImg').src = fotoUrl;
  document.getElementById('fotoImg').style.display = 'block';
  document.getElementById('fotoPlaceholder').style.display = 'none';
  document.getElementById('removeFotoBtn').style.display = 'inline-flex';

  const avatarImg = document.getElementById('avatarImg');
  avatarImg.src = fotoUrl;
  avatarImg.style.display = 'block';
  document.getElementById('avatarInitials').style.display = 'none';

  showToast('Foto actualizada');
});

document.getElementById('removeFotoBtn').addEventListener('click', async () => {
  if (!confirm('Quitar tu foto?')) return;
  const { error } = await supabaseClient
    .from('barberos').update({ foto_url: null }).eq('id', barbero.id);
  if (error) return showToast('Error', 'error');
  barbero.foto_url = null;
  document.getElementById('fotoImg').style.display = 'none';
  document.getElementById('fotoPlaceholder').style.display = 'block';
  document.getElementById('removeFotoBtn').style.display = 'none';
  document.getElementById('avatarImg').style.display = 'none';
  document.getElementById('avatarInitials').style.display = 'block';
  showToast('Foto eliminada');
});

document.getElementById('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass1 = document.getElementById('newPassword').value;
  const pass2 = document.getElementById('newPassword2').value;

  if (pass1 !== pass2) {
    showToast('Las contrasenas no coinciden', 'error');
    return;
  }
  if (pass1.length < 6) {
    showToast('Minimo 6 caracteres', 'error');
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({ password: pass1 });

  if (error) {
    showToast('Error: ' + error.message, 'error');
    return;
  }

  document.getElementById('newPassword').value = '';
  document.getElementById('newPassword2').value = '';
  showToast('Contrasena actualizada');
});

// ============================================
// FESTIVOS - AGENDA BARBERO
// ============================================
async function loadFestivosBarbero() {
  let contenedor = document.getElementById('festivosContainer');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'festivosContainer';
    const passSection = document.querySelector('.password-section');
    if (passSection) {
      passSection.insertAdjacentElement('afterend', contenedor);
    }
  }

  const anioActual = new Date().getFullYear();

  const { data: festivosGuardados } = await supabaseClient
    .from('barbero_festivos')
    .select('*')
    .eq('barbero_id', barbero.id);

  const festivosMap = {};
  (festivosGuardados || []).forEach(f => { festivosMap[f.fecha] = f; });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const festivosColombia = [
    ...getFestivosColombiaAnio(anioActual),
    ...getFestivosColombiaAnio(anioActual + 1),
  ]
  .filter(f => f.fecha >= hoy)
  .sort((a, b) => a.fecha - b.fecha);

  contenedor.innerHTML = `
    <div class="festivos-agenda-seccion">
      <h2>Mis festivos</h2>
      <p class="field-hint festivos-hint">
        Activa los festivos en los que si vas a trabajar.
        Por defecto todos los festivos estan cerrados y los clientes no podran reservar.
      </p>
      <div class="festivos-lista-agenda" id="festivosListaAgenda"></div>
      <button type="button" class="btn btn-primary festivos-guardar-btn" id="guardarFestivosAgendaBtn">
        Guardar mis festivos
      </button>
    </div>
  `;

  const lista = contenedor.querySelector('#festivosListaAgenda');

  festivosColombia.forEach(item => {
    const key = dateKey(item.fecha);
    const guardado = festivosMap[key];
    const cerrado = guardado ? guardado.cerrado : true;

    const fechaLabel = item.fecha.toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const row = document.createElement('div');
    row.className = 'festivo-agenda-row ' + (cerrado ? 'cerrado' : 'abierto');
    row.dataset.fecha = key;
    row.innerHTML = `
      <div class="festivo-agenda-info">
        <strong>${item.nombre}</strong>
        <span>${fechaLabel}</span>
      </div>
      <div class="festivo-agenda-toggle">
        <span class="festivo-estado-label ${cerrado ? 'label-cerrado' : 'label-abierto'}">
          ${cerrado ? 'Descansando' : 'Trabajo'}
        </span>
        <label class="toggle-switch">
          <input type="checkbox" class="festivo-check" ${cerrado ? '' : 'checked'}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;

    const check = row.querySelector('.festivo-check');
    const estadoLabel = row.querySelector('.festivo-estado-label');

    check.addEventListener('change', () => {
      const trabaja = check.checked;
      row.className = 'festivo-agenda-row ' + (trabaja ? 'abierto' : 'cerrado');
      estadoLabel.textContent = trabaja ? 'Trabajo' : 'Descansando';
      estadoLabel.className = 'festivo-estado-label ' + (trabaja ? 'label-abierto' : 'label-cerrado');
    });

    lista.appendChild(row);
  });

  contenedor.querySelector('#guardarFestivosAgendaBtn').addEventListener('click', async () => {
    const filas = lista.querySelectorAll('.festivo-agenda-row');
    const upserts = [];

    filas.forEach(row => {
      const fecha = row.dataset.fecha;
      const cerrado = !row.querySelector('.festivo-check').checked;
      upserts.push({ barbero_id: barbero.id, fecha, cerrado });
    });

    const { error } = await supabaseClient
      .from('barbero_festivos')
      .upsert(upserts, { onConflict: 'barbero_id,fecha' });

    if (error) {
      showToast('Error al guardar', 'error');
      console.error(error);
    } else {
      showToast('Festivos guardados');
    }
  });
}

init();
