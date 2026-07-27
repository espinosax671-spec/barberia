// ---------- Menú móvil ----------
const menuToggle = document.getElementById('menuToggle');
const mobileNav = document.getElementById('mobileNav');
menuToggle.addEventListener('click', () => {
  const isOpen = mobileNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', isOpen);
});
mobileNav.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => mobileNav.classList.remove('open'));
});

// ---------- Datos ----------
const SERVICES = [
  { id: 'corte', name: 'Corte clásico', price: 25000, duration: 30 },
  { id: 'barba', name: 'Arreglo de barba', price: 18000, duration: 20 },
  { id: 'combo', name: 'Combo corte + barba', price: 38000, duration: 50 },
  { id: 'afeitado', name: 'Afeitado clásico', price: 22000, duration: 25 },
  { id: 'nino', name: 'Corte niño', price: 18000, duration: 25 },
  { id: 'lineup', name: 'Diseño / Line up', price: 12000, duration: 15 },
];

// Horario de atención por día de la semana (0 = domingo)
const HOURS = {
  1: { open: 9 * 60, close: 19 * 60 },  // lunes
  2: { open: 9 * 60, close: 19 * 60 },
  3: { open: 9 * 60, close: 19 * 60 },
  4: { open: 9 * 60, close: 19 * 60 },
  5: { open: 9 * 60, close: 19 * 60 },
  6: { open: 9 * 60, close: 17 * 60 }, // sábado
  0: null, // domingo cerrado
};

const SLOT_STEP = 30; // minutos entre horarios ofrecidos

// ---------- Estado ----------
let selectedService = null;
let selectedDate = null; // objeto Date (medianoche local)
let selectedTime = null; // minutos desde medianoche

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

// ---------- Citas: ahora contra Supabase ----------
async function loadCitasDelDia(fecha) {
  const { data, error } = await supabaseClient
    .from('horarios_ocupados')
    .select('hora_inicio, duracion')
    .eq('fecha', fecha);

  if (error) {
    console.error('Error consultando citas:', error);
    return [];
  }
  return data.map(c => ({ start: c.hora_inicio, duration: c.duracion }));
}

async function guardarCita(cita) {
  const { error } = await supabaseClient.from('citas').insert({
    fecha: cita.dateKey,
    hora_inicio: cita.start,
    duracion: cita.duration,
    servicio: cita.service,
    precio: cita.price,
    nombre_cliente: cita.name,
    telefono: cita.phone,
  });
  return error;
}

// ---------- Render: servicios ----------
const serviceSelectEl = document.getElementById('serviceSelect');
function renderServices() {
  serviceSelectEl.innerHTML = '';
  SERVICES.forEach(s => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pill-option' + (selectedService?.id === s.id ? ' selected' : '');
    btn.innerHTML = `<strong>${s.name}</strong><span>${formatCOP(s.price)} · ${s.duration} min</span>`;
    btn.addEventListener('click', () => {
      selectedService = s;
      selectedTime = null;
      renderServices();
      renderTimes();
      updateSummary();
    });
    serviceSelectEl.appendChild(btn);
  });
}

// ---------- Render: fechas (próximos 14 días) ----------
const dateSelectEl = document.getElementById('dateSelect');
const DOW_LABELS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

function renderDates() {
  dateSelectEl.innerHTML = '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    if (HOURS[dow] === null) continue; // domingo, no se muestra

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'date-option' + (selectedDate && dateKey(selectedDate) === dateKey(d) ? ' selected' : '');
    btn.innerHTML = `<span class="dow">${DOW_LABELS[dow]}</span><span class="dnum">${d.getDate()}</span>`;
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

// ---------- Render: horas disponibles ----------
const timeSelectEl = document.getElementById('timeSelect');
async function renderTimes() {
  timeSelectEl.innerHTML = '';

  if (!selectedService || !selectedDate) {
    timeSelectEl.innerHTML = '<p class="hint">Elige primero un servicio y una fecha.</p>';
    return;
  }

  const dow = selectedDate.getDay();
  const hours = HOURS[dow];
  if (!hours) {
    timeSelectEl.innerHTML = '<p class="hint">Cerrado ese día.</p>';
    return;
  }

  timeSelectEl.innerHTML = '<p class="hint">Cargando horarios disponibles…</p>';
  const citas = await loadCitasDelDia(dateKey(selectedDate));
  timeSelectEl.innerHTML = '';
  const duration = selectedService.duration;

  let anySlot = false;
  for (let t = hours.open; t + duration <= hours.close; t += SLOT_STEP) {
    anySlot = true;
    // Ocupado si se solapa con alguna cita existente
    const taken = citas.some(c => t < c.start + c.duration && t + duration > c.start);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'time-option' + (taken ? ' taken' : '') + (selectedTime === t ? ' selected' : '');
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
    timeSelectEl.innerHTML = '<p class="hint">No hay horarios disponibles ese día para este servicio.</p>';
  }
}

// ---------- Resumen y envío ----------
const bookingSummaryEl = document.getElementById('bookingSummary');
function updateSummary() {
  if (!selectedService || !selectedDate || selectedTime === null) {
    bookingSummaryEl.textContent = '';
    return;
  }
  const dateLabel = selectedDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  bookingSummaryEl.textContent =
    `${selectedService.name} · ${dateLabel} · ${minutesToLabel(selectedTime)} · ${formatCOP(selectedService.price)}`;
}

const bookingForm = document.getElementById('bookingForm');
const formMsgEl = document.getElementById('formMsg');

bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsgEl.className = 'form-msg';
  formMsgEl.textContent = '';

  if (!selectedService || !selectedDate || selectedTime === null) {
    formMsgEl.textContent = 'Por favor elige servicio, fecha y hora antes de confirmar.';
    formMsgEl.classList.add('error');
    return;
  }

  const name = document.getElementById('clientName').value.trim();
  const phone = document.getElementById('clientPhone').value.trim();
  if (!name || !phone) {
    formMsgEl.textContent = 'Completa tu nombre y teléfono.';
    formMsgEl.classList.add('error');
    return;
  }

  const submitBtn = bookingForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  formMsgEl.textContent = 'Confirmando...';

  // Revalidar disponibilidad justo antes de guardar (evita doble reserva)
  const citas = await loadCitasDelDia(dateKey(selectedDate));
  const conflict = citas.some(c =>
    selectedTime < c.start + c.duration && selectedTime + selectedService.duration > c.start
  );
  if (conflict) {
    formMsgEl.textContent = 'Ese horario ya se acaba de ocupar. Elige otra hora.';
    formMsgEl.classList.add('error');
    submitBtn.disabled = false;
    renderTimes();
    return;
  }

  const error = await guardarCita({
    dateKey: dateKey(selectedDate),
    start: selectedTime,
    duration: selectedService.duration,
    service: selectedService.name,
    price: selectedService.price,
    name,
    phone,
  });

  submitBtn.disabled = false;

  if (error) {
    console.error('Error guardando cita:', error);
    formMsgEl.textContent = 'Hubo un problema guardando tu cita. Intenta de nuevo.';
    formMsgEl.classList.add('error');
    return;
  }

  formMsgEl.textContent = `¡Listo, ${name}! Tu cita de ${selectedService.name} quedó confirmada para el ${selectedDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })} a las ${minutesToLabel(selectedTime)}.`;
  formMsgEl.classList.add('ok');

  bookingForm.reset();
  selectedTime = null;
  renderTimes();
  updateSummary();
});

// ---------- Init ----------
renderServices();
renderDates();
renderTimes();
