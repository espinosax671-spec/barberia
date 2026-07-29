let negocio = null;
let barberos = [];
let servicios = [];
let horarios = [];

let selectedBarbero = null;
let selectedServicio = null;
let selectedDate = null;
let selectedTime = null;

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DOW_LABELS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const SLOT_STEP = 30;

// ---------- Utilidades ----------
function formatCOP(n) { return '$' + n.toLocaleString('es-CO'); }
function minutesToLabel(mins) {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? 'p.m.' : 'a.m.';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}
function dateKey(d) {
  const yyyy = d.getFullYear();
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function getInitials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

// ---------- Init ----------
async function init() {
  const params = new URLSearchParams(window.location.search);
  const subdominio = params.get('b');

  if (!subdominio) {
    showNotFound();
    return;
  }

  const { data: negocioData, error } = await supabaseClient
    .from('negocios')
    .select('*')
    .eq('subdominio', subdominio)
    .maybeSingle();

  if (error || !negocioData) {
    showNotFound();
    return;
  }

  negocio = negocioData;
  document.title = `Agendar cita — ${negocio.nombre}`;

  document.getElementById('heroNombre').textContent = negocio.nombre;
  document.getElementById('heroCiudad').textContent = negocio.ciudad || 'Barbería';
  document.getElementById('heroDescripcion').textContent =
    negocio.descripcion || 'Reserva tu cita en pocos clics.';
  document.getElementById('successNombreNegocio').textContent = negocio.nombre;

  document.getElementById('infoDireccion').textContent =
    negocio.direccion || 'Sin dirección registrada';
  document.getElementById('infoCiudad').textContent = negocio.ciudad || '';
  if (negocio.telefono_whatsapp) {
    document.getElementById('infoTelefono').innerHTML =
      `WhatsApp: <a href="https://wa.me/57${negocio.telefono_whatsapp}" target="_blank">${negocio.telefono_whatsapp}</a>`;
  }

  const { data: barberosData } = await supabaseClient
    .from('barberos')
    .select('*')
    .eq('negocio_id', negocio.id)
    .eq('activo', true)
    .order('orden', { ascending: true });

  barberos = barberosData || [];

  document.getElementById('loadingView').style.display = 'none';
  document.getElementById('mainView').style.display = 'block';

  renderBarberos();
}

function showNotFound() {
  document.getElementById('loadingView').style.display = 'none';
  document.getElementById('notFoundView').style.display = 'flex';
}

// ---------- BARBEROS ----------
function renderBarberos() {
  const grid = document.getElementById('barberosGrid');
  if (!barberos.length) {
    grid.innerHTML = '<p class="hint">Esta barbería aún no tiene barberos disponibles.</p>';
    return;
  }
  grid.innerHTML = '';
  barberos.forEach(b => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'barbero-option' + (selectedBarbero?.id === b.id ? ' selected' : '');
    btn.innerHTML = `
      <div class="barbero-option-avatar">${getInitials(b.nombre)}</div>
      <strong>${b.nombre}</strong>
    `;
    btn.addEventListener('click', () => selectBarbero(b));
    grid.appendChild(btn);
  });
}

async function selectBarbero(b) {
  selectedBarbero = b;
  selectedServicio = null;
  selectedDate = null;
  selectedTime = null;

  renderBarberos();

  const [serviciosRes, horariosRes] = await Promise.all([
    supabaseClient
      .from('servicios')
      .select('*')
      .eq('negocio_id', negocio.id)
      .eq('barbero_id', b.id)
      .eq('activo', true)
      .order('orden', { ascending: true }),
    supabaseClient
      .from('horarios')
      .select('*')
      .eq('negocio_id', negocio.id)
      .eq('barbero_id', b.id),
  ]);

  servicios = serviciosRes.data || [];
  horarios = horariosRes.data || [];

  renderServicios();
  renderFechas();
  renderHoras();
  renderHorarioLista();
  updateSummary();
}

// ---------- SERVICIOS ----------
function renderServicios() {
  const grid = document.getElementById('serviciosGrid');
  if (!selectedBarbero) {
    grid.innerHTML = '<p class="hint">Selecciona primero un barbero.</p>';
    return;
  }
  if (!servicios.length) {
    grid.innerHTML = '<p class="hint">Este barbero no tiene servicios disponibles.</p>';
    return;
  }
  grid.innerHTML = '';
  servicios.forEach(s => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'servicio-option' + (selectedServicio?.id === s.id ? ' selected' : '');
    btn.innerHTML = `
      <div class="servicio-option-top">
        <strong>${s.nombre}</strong>
        <span class="price">${formatCOP(s.precio)}</span>
      </div>
      <span>${s.duracion_min} min</span>
    `;
    btn.addEventListener('click', () => {
      selectedServicio = s;
      selectedTime = null;
      renderServicios();
      renderHoras();
      updateSummary();
    });
    grid.appendChild(btn);
  });
}

// ---------- FECHAS ----------
function renderFechas() {
  const scroll = document.getElementById('fechasScroll');
  if (!selectedBarbero) {
    scroll.innerHTML = '<p class="hint">Selecciona primero un barbero.</p>';
    return;
  }

  scroll.innerHTML = '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const horariosPorDia = {};
  horarios.forEach(h => { horariosPorDia[h.dia_semana] = h; });

  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    const hDia = horariosPorDia[dow];

    if (!hDia || hDia.abre_minuto === null) continue;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fecha-option' +
      (selectedDate && dateKey(selectedDate) === dateKey(d) ? ' selected' : '');
    btn.innerHTML = `
      <span class="dow">${DOW_LABELS[dow]}</span>
      <span class="dnum">${d.getDate()}</span>
    `;
    btn.addEventListener('click', () => {
      selectedDate = d;
      selectedTime = null;
      renderFechas();
      renderHoras();
      updateSummary();
    });
    scroll.appendChild(btn);
  }

  if (!scroll.children.length) {
    scroll.innerHTML = '<p class="hint">Este barbero no tiene días disponibles.</p>';
  }
}

// ---------- HORAS ----------
async function renderHoras() {
  const grid = document.getElementById('horasGrid');

  if (!selectedServicio || !selectedDate) {
    grid.innerHTML = '<p class="hint">Elige un servicio y una fecha para ver los horarios.</p>';
    return;
  }

  const dow = selectedDate.getDay();
  const hDia = horarios.find(h => h.dia_semana === dow);

  if (!hDia || hDia.abre_minuto === null) {
    grid.innerHTML = '<p class="hint">Cerrado ese día.</p>';
    return;
  }

  grid.innerHTML = '<p class="hint">Cargando horarios...</p>';

  const { data: citasData } = await supabaseClient
    .from('citas')
    .select('hora_inicio, duracion')
    .eq('barbero_id', selectedBarbero.id)
    .eq('fecha', dateKey(selectedDate))
    .eq('estado', 'confirmada');

  const citas = citasData || [];
  const duration = selectedServicio.duracion_min;

  grid.innerHTML = '';
  let anySlot = false;

  for (let t = hDia.abre_minuto; t + duration <= hDia.cierra_minuto; t += SLOT_STEP) {
    anySlot = true;
    const taken = citas.some(c =>
      t < c.hora_inicio + c.duracion && t + duration > c.hora_inicio
    );

    const isToday = dateKey(selectedDate) === dateKey(new Date());
    let pasada = false;
    if (isToday) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      pasada = t <= nowMinutes;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hora-option' + (selectedTime === t ? ' selected' : '');
    btn.textContent = minutesToLabel(t);
    btn.disabled = taken || pasada;

    if (!taken && !pasada) {
      btn.addEventListener('click', () => {
        selectedTime = t;
        renderHoras();
        updateSummary();
      });
    }
    grid.appendChild(btn);
  }

  if (!anySlot) {
    grid.innerHTML = '<p class="hint">No hay horarios disponibles.</p>';
  }
}

// ---------- HORARIO LISTA ----------
function renderHorarioLista() {
  const list = document.getElementById('horarioLista');
  if (!horarios.length) {
    list.innerHTML = '<li>Sin horario configurado</li>';
    return;
  }
  const orden = [1, 2, 3, 4, 5, 6, 0];
  list.innerHTML = '';
  orden.forEach(dow => {
    const h = horarios.find(x => x.dia_semana === dow);
    if (!h) return;
    const li = document.createElement('li');
    if (h.abre_minuto === null) {
      li.className = 'cerrado';
      li.innerHTML = `<span>${DIAS[dow]}</span><span>Cerrado</span>`;
    } else {
      li.innerHTML = `<span>${DIAS[dow]}</span><span>${minutesToLabel(h.abre_minuto)} – ${minutesToLabel(h.cierra_minuto)}</span>`;
    }
    list.appendChild(li);
  });
}

// ---------- RESUMEN ----------
function updateSummary() {
  const box = document.getElementById('bookingSummary');
  if (!selectedBarbero || !selectedServicio || !selectedDate || selectedTime === null) {
    box.style.display = 'none';
    return;
  }
  const fechaLabel = selectedDate.toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  box.style.display = 'block';
  box.innerHTML = `
    <strong>Resumen de tu cita:</strong>
    ${selectedServicio.nombre} con ${selectedBarbero.nombre}<br>
    ${fechaLabel} · ${minutesToLabel(selectedTime)} · ${formatCOP(selectedServicio.precio)}
  `;
}

// ---------- CONFIRMAR CITA ----------
document.getElementById('reservaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('formMsg');
  msg.className = 'form-msg';
  msg.textContent = '';

  if (!selectedBarbero || !selectedServicio || !selectedDate || selectedTime === null) {
    msg.textContent = 'Por favor completa todos los pasos.';
    msg.className = 'form-msg error';
    return;
  }

  const name = document.getElementById('clientName').value.trim();
  const phone = document.getElementById('clientPhone').value.trim();

  if (!name || !phone) {
    msg.textContent = 'Completa tu nombre y teléfono.';
    msg.className = 'form-msg error';
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  msg.textContent = 'Confirmando...';
  msg.className = 'form-msg info';

  const { data: citasData } = await supabaseClient
    .from('citas')
    .select('hora_inicio, duracion')
    .eq('barbero_id', selectedBarbero.id)
    .eq('fecha', dateKey(selectedDate))
    .eq('estado', 'confirmada');

  const conflict = (citasData || []).some(c =>
    selectedTime < c.hora_inicio + c.duracion &&
    selectedTime + selectedServicio.duracion_min > c.hora_inicio
  );

  if (conflict) {
    msg.textContent = 'Ese horario ya no está disponible. Elige otro.';
    msg.className = 'form-msg error';
    submitBtn.disabled = false;
    selectedTime = null;
    renderHoras();
    updateSummary();
    return;
  }

  const { error } = await supabaseClient.from('citas').insert({
    negocio_id: negocio.id,
    barbero_id: selectedBarbero.id,
    servicio_id: selectedServicio.id,
    fecha: dateKey(selectedDate),
    hora_inicio: selectedTime,
    duracion: selectedServicio.duracion_min,
    servicio_nombre: selectedServicio.nombre,
    precio: selectedServicio.precio,
    nombre_cliente: name,
    telefono: phone,
    estado: 'confirmada',
  });

  submitBtn.disabled = false;

  if (error) {
    console.error(error);
    msg.textContent = 'Error al guardar la cita: ' + error.message;
    msg.className = 'form-msg error';
    return;
  }

  showSuccess(name);
});

function showSuccess(name) {
  document.getElementById('mainView').style.display = 'none';
  document.getElementById('successView').style.display = 'block';

  const fechaLabel = selectedDate.toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  document.getElementById('successTitulo').textContent = `¡Listo ${name}, tu cita está confirmada!`;
  document.getElementById('successDetail').innerHTML = `
    <div class="success-detail-row">
      <span>Barbero</span>
      <span>${selectedBarbero.nombre}</span>
    </div>
    <div class="success-detail-row">
      <span>Servicio</span>
      <span>${selectedServicio.nombre}</span>
    </div>
    <div class="success-detail-row">
      <span>Fecha</span>
      <span>${fechaLabel}</span>
    </div>
    <div class="success-detail-row">
      <span>Hora</span>
      <span>${minutesToLabel(selectedTime)}</span>
    </div>
    <div class="success-detail-row">
      <span>Precio</span>
      <span>${formatCOP(selectedServicio.precio)}</span>
    </div>
  `;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

init();
