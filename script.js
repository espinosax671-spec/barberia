// ---------- Menú móvil ----------
const menuToggle = document.getElementById('menuToggle');
const mobileNav  = document.getElementById('mobileNav');
menuToggle.addEventListener('click', () => {
  const isOpen = mobileNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', isOpen);
});
mobileNav.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => mobileNav.classList.remove('open'));
});

// ---------- Utilidades ----------
function formatCOP(n) {
  return '$' + n.toLocaleString('es-CO');
}
function minutesToLabel(mins) {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? 'p.m.' : 'a.m.';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}
function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

// ---------- Estado global ----------
let SERVICES  = [];
let HOURS     = {};
let negocioId = null;

const SLOT_STEP = 30;

let selectedService = null;
let selectedDate    = null;
let selectedTime    = null;

// ---------- Inicializar página ----------
async function initPage() {
  // Cargar negocio
  const { data: negocioData, error: negError } = await supabaseClient
    .from('negocios')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (negError || !negocioData) {
    console.error('No se encontró el negocio:', negError);
    return;
  }

  negocioId = negocioData.id;

  // Cargar servicios activos
  const { data: serviciosData } = await supabaseClient
    .from('servicios')
    .select('*')
    .eq('negocio_id', negocioId)
    .eq('activo', true)
    .order('orden', { ascending: true });

  SERVICES = (serviciosData || []).map(s => ({
    id:       s.id,
    name:     s.nombre,
    price:    s.precio,
    duration: s.duracion_min,
  }));

  // Cargar horarios
  const { data: horariosData } = await supabaseClient
    .from('horarios')
    .select('*')
    .eq('negocio_id', negocioId);

  HOURS = {};
  (horariosData || []).forEach(h => {
    HOURS[h.dia_semana] = h.abre_minuto !== null
      ? { open: h.abre_minuto, close: h.cierra_minuto }
      : null;
  });

  // Renderizar
  renderServices();
  renderDates();
  renderTimes();
}

// ---------- Disponibilidad ----------
async function loadCitasDelDia(fecha) {
  const { data, error } = await supabaseClient
    .from('citas')
    .select('hora_inicio, duracion')
    .eq('negocio_id', negocioId)
    .eq('fecha', fecha)
    .eq('estado', 'confirmada');

  if (error) {
    console.error('Error consultando citas:', error);
    return [];
  }
  return data.map(c => ({
    start:    c.hora_inicio,
    duration: c.duracion,
  }));
}

// ---------- Guardar cita ----------
async function guardarCita(cita) {
  const { error } = await supabaseClient.from('citas').insert({
    negocio_id:      negocioId,
    fecha:           cita.dateKey,
    hora_inicio:     cita.start,
    duracion:        cita.duration,
    servicio_nombre: cita.service,
    precio:          cita.price,
    nombre_cliente:  cita.name,
    telefono:        cita.phone,
    estado:          'confirmada',
  });
  return error;
}

// ---------- Render servicios ----------
const serviceSelectEl = document.getElementById('serviceSelect');
function renderServices() {
  serviceSelectEl.innerHTML = '';

  if (!SERVICES.length) {
    serviceSelectEl.innerHTML =
      '<p class="hint">No hay servicios disponibles.</p>';
    return;
  }

  SERVICES.forEach(s => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pill-option' +
      (selectedService?.id === s.id ? ' selected' : '');
    btn.innerHTML = `
      <strong>${s.name}</strong>
      <span>${formatCOP(s.price)} · ${s.duration} min</span>
    `;
    btn.addEventListener('click', () => {
      selectedService = s;
      selectedTime    = null;
      renderServices();
      renderTimes();
      updateSummary();
    });
    serviceSelectEl.appendChild(btn);
  });
}

// ---------- Render fechas ----------
const dateSelectEl = document.getElementById('dateSelect');
const DOW_LABELS   = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

function renderDates() {
  dateSelectEl.innerHTML = '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();

    if (HOURS[dow] === null || HOURS[dow] === undefined) continue;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'date-option' +
      (selectedDate && dateKey(selectedDate) === dateKey(d) ? ' selected' : '');
    btn.innerHTML = `
      <span class="dow">${DOW_LABELS[dow]}</span>
      <span class="dnum">${d.getDate()}</span>
    `;
    btn.addEventListener('click', () => {
      selectedDate = d;
      selectedTime = null;
      renderDates();
      renderTimes();
      updateSummary();
    });
    dateSelectEl.appendChild(btn);
  }
}

// ---------- Render horas ----------
const timeSelectEl = document.getElementById('timeSelect');

async function renderTimes() {
  timeSelectEl.innerHTML = '';

  if (!selectedService || !selectedDate) {
    timeSelectEl.innerHTML =
      '<p class="hint">Elige primero un servicio y una fecha.</p>';
    return;
  }

  const dow   = selectedDate.getDay();
  const hours = HOURS[dow];

  if (!hours) {
    timeSelectEl.innerHTML = '<p class="hint">Cerrado ese día.</p>';
    return;
  }

  timeSelectEl.innerHTML =
    '<p class="hint">Cargando horarios disponibles…</p>';

  const citas    = await loadCitasDelDia(dateKey(selectedDate));
  const duration = selectedService.duration;

  timeSelectEl.innerHTML = '';
  let anySlot = false;

  for (let t = hours.open; t + duration <= hours.close; t += SLOT_STEP) {
    anySlot = true;

    const taken = citas.some(c =>
      t < c.start + c.duration && t + duration > c.start
    );

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'time-option' +
      (taken ? ' taken' : '') +
      (selectedTime === t ? ' selected' : '');
    btn.textContent = minutesToLabel(t);
    btn.disabled = taken;

    if (!taken) {
      btn.addEventListener('click', () => {
        selectedTime = t;
        renderTimes();
        updateSummary();
      });
    }
    timeSelectEl.appendChild(btn);
  }

  if (!anySlot) {
    timeSelectEl.innerHTML =
      '<p class="hint">No hay horarios disponibles ese día.</p>';
  }
}

// ---------- Resumen ----------
const bookingSummaryEl = document.getElementById('bookingSummary');

function updateSummary() {
  if (!selectedService || !selectedDate || selectedTime === null) {
    bookingSummaryEl.textContent = '';
    return;
  }
  const dateLabel = selectedDate.toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  bookingSummaryEl.innerHTML = `
    <strong>${selectedService.name}</strong> · 
    ${dateLabel} · 
    ${minutesToLabel(selectedTime)} · 
    ${formatCOP(selectedService.price)}
  `;
}

// ---------- Envío ----------
const bookingForm = document.getElementById('bookingForm');
const formMsgEl   = document.getElementById('formMsg');

bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsgEl.className = 'form-msg';
  formMsgEl.textContent = '';

  if (!selectedService || !selectedDate || selectedTime === null) {
    formMsgEl.textContent =
      'Por favor elige servicio, fecha y hora antes de confirmar.';
    formMsgEl.classList.add('error');
    return;
  }

  const name  = document.getElementById('clientName').value.trim();
  const phone = document.getElementById('clientPhone').value.trim();

  if (!name || !phone) {
    formMsgEl.textContent = 'Completa tu nombre y teléfono.';
    formMsgEl.classList.add('error');
    return;
  }

  const submitBtn = bookingForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  formMsgEl.textContent = 'Confirmando...';

  // Revalidar antes de guardar
  const citas    = await loadCitasDelDia(dateKey(selectedDate));
  const conflict = citas.some(c =>
    selectedTime < c.start + c.duration &&
    selectedTime + selectedService.duration > c.start
  );

  if (conflict) {
    formMsgEl.textContent =
      'Ese horario ya se acaba de ocupar. Elige otra hora.';
    formMsgEl.classList.add('error');
    submitBtn.disabled = false;
    selectedTime = null;
    renderTimes();
    updateSummary();
    return;
  }

  const error = await guardarCita({
    dateKey:  dateKey(selectedDate),
    start:    selectedTime,
    duration: selectedService.duration,
    service:  selectedService.name,
    price:    selectedService.price,
    name,
    phone,
  });

  submitBtn.disabled = false;

  if (error) {
    console.error('Error guardando cita:', error);
    formMsgEl.textContent =
      'Hubo un problema guardando tu cita. Intenta de nuevo.';
    formMsgEl.classList.add('error');
    return;
  }

  const dateLabel = selectedDate.toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long',
  });
  formMsgEl.textContent =
    `¡Listo, ${name}! Tu cita de ${selectedService.name} quedó confirmada ` +
    `para el ${dateLabel} a las ${minutesToLabel(selectedTime)}.`;
  formMsgEl.classList.add('ok');

  // Resetear todo
  bookingForm.reset();
  selectedService = null;
  selectedDate    = null;
  selectedTime    = null;
  renderServices();
  renderDates();
  renderTimes();
  updateSummary();
});

// ---------- Arrancar ----------
initPage();
