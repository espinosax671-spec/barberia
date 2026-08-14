let negocio = null;
let barberos = [];
let servicios = [];
let horarios = [];
let barberoFestivosActivos = [];

let selectedBarbero = null;
let selectedServicio = null;
let selectedDate = null;
let selectedTime = null;

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
const DOW_LABELS = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
const SLOT_STEP = 30;

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

// Diccionario global de festivos: { 'YYYY-MM-DD': 'Nombre del festivo' }
const FESTIVOS_INFO = {};
[new Date().getFullYear(), new Date().getFullYear() + 1].forEach(anio => {
  getFestivosColombiaAnio(anio).forEach(item => {
    FESTIVOS_INFO[dateKey(item.fecha)] = item.nombre;
  });
});

// ============================================
// INIT
// ============================================
async function init() {
  const params = new URLSearchParams(window.location.search);
  const subdominio = params.get('b');

  if (!subdominio) { showNotFound(); return; }

  const { data: negocioData, error } = await supabaseClient
    .from('negocios').select('*').eq('subdominio', subdominio).maybeSingle();

  if (error || !negocioData) { showNotFound(); return; }

  negocio = negocioData;
  document.title = `Agendar cita - ${negocio.nombre}`;

  document.getElementById('heroNombre').textContent = negocio.nombre;
  document.getElementById('heroCiudad').textContent = negocio.ciudad || 'Barberia';
  document.getElementById('heroDescripcion').textContent =
    negocio.descripcion || 'Reserva tu cita en pocos clics.';
  document.getElementById('successNombreNegocio').textContent = negocio.nombre;

  if (negocio.logo_url) {
    const heroLogo = document.getElementById('heroLogo');
    heroLogo.src = negocio.logo_url;
    heroLogo.style.display = 'block';
  }

  document.getElementById('infoDireccion').textContent =
    negocio.direccion || 'Sin direccion registrada';
  document.getElementById('infoCiudad').textContent = negocio.ciudad || '';
  if (negocio.telefono_whatsapp) {
    document.getElementById('infoTelefono').innerHTML =
      `WhatsApp: <a href="https://wa.me/57${negocio.telefono_whatsapp}" target="_blank">${negocio.telefono_whatsapp}</a>`;
  }

  const { data: barberosData } = await supabaseClient
    .from('barberos').select('*')
    .eq('negocio_id', negocio.id).eq('activo', true)
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

// ============================================
// BARBEROS
// ============================================
function renderBarberos() {
  const grid = document.getElementById('barberosGrid');
  if (!barberos.length) {
    grid.innerHTML = '<p class="hint">Esta barberia aun no tiene barberos disponibles.</p>';
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

  // Traer TODOS los festivos guardados del barbero (para saber cuales estan abiertos)
  const [serviciosRes, horariosRes, festivosRes] = await Promise.all([
    supabaseClient.from('servicios').select('*')
      .eq('negocio_id', negocio.id).eq('barbero_id', b.id).eq('activo', true)
      .order('orden', { ascending: true }),
    supabaseClient.from('horarios').select('*')
      .eq('negocio_id', negocio.id).eq('barbero_id', b.id),
    supabaseClient.from('barbero_festivos').select('*')
      .eq('barbero_id', b.id)
      .gte('fecha', dateKey(new Date())),
  ]);

  servicios = serviciosRes.data || [];
  horarios = horariosRes.data || [];
  barberoFestivosActivos = festivosRes.data || [];

  renderServicios();
  renderFechas();
  renderHoras();
  renderHorarioLista();
  updateSummary();
}

// ============================================
// SERVICIOS
// ============================================
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

// ============================================
// FECHAS
// ============================================
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

  // Mapa de festivos con estado explicito guardado por el barbero
  const festivosBarberoMap = {};
  (barberoFestivosActivos || []).forEach(f => {
    festivosBarberoMap[f.fecha] = f;
  });

  let diasMostrados = 0;

  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    const hDia = horariosPorDia[dow];

    if (!hDia || hDia.abre_minuto === null) continue;

    const keyFecha = dateKey(d);
    const esFestivoColombia = !!FESTIVOS_INFO[keyFecha];
    const registroFestivo = festivosBarberoMap[keyFecha];

    // Logica de bloqueo:
    // - Si NO es festivo colombiano -> se muestra normal
    // - Si es festivo colombiano y el barbero NO ha guardado nada -> CERRADO (por defecto)
    // - Si es festivo colombiano y el barbero guardo cerrado=true -> CERRADO
    // - Si es festivo colombiano y el barbero guardo cerrado=false -> ABIERTO
    let estaCerradoPorFestivo = false;
    if (esFestivoColombia) {
      if (!registroFestivo) {
        estaCerradoPorFestivo = true; // Por defecto cerrado
      } else {
        estaCerradoPorFestivo = registroFestivo.cerrado;
      }
    }

    const btn = document.createElement('button');
    btn.type = 'button';

    if (estaCerradoPorFestivo) {
      btn.className = 'fecha-option festivo-cerrado';
      btn.disabled = true;
      btn.innerHTML = `
        <span class="dow">${DOW_LABELS[dow]}</span>
        <span class="dnum">${d.getDate()}</span>
        <span class="festivo-tag">Cerrado</span>
      `;
      btn.title = FESTIVOS_INFO[keyFecha] + ' - Cerrado';
      scroll.appendChild(btn);
      diasMostrados++;
    } else {
      btn.className = 'fecha-option' +
        (selectedDate && dateKey(selectedDate) === keyFecha ? ' selected' : '') +
        (esFestivoColombia ? ' es-festivo' : '');

      btn.innerHTML = `
        <span class="dow">${DOW_LABELS[dow]}</span>
        <span class="dnum">${d.getDate()}</span>
        ${esFestivoColombia ? '<span class="festivo-tag">Festivo</span>' : ''}
      `;

      if (esFestivoColombia) {
        btn.title = FESTIVOS_INFO[keyFecha] + ' - Abierto';
      }

      btn.addEventListener('click', () => {
        selectedDate = d;
        selectedTime = null;
        renderFechas();
        renderHoras();
        updateSummary();
      });
      scroll.appendChild(btn);
      diasMostrados++;
    }

    if (diasMostrados >= 14) break;
  }

  if (!scroll.children.length) {
    scroll.innerHTML = '<p class="hint">Este barbero no tiene dias disponibles.</p>';
  }
}

// ============================================
// HORAS
// ============================================
async function renderHoras() {
  const grid = document.getElementById('horasGrid');
  if (!selectedServicio || !selectedDate) {
    grid.innerHTML = '<p class="hint">Elige un servicio y una fecha para ver los horarios.</p>';
    return;
  }
  const dow = selectedDate.getDay();
  const hDia = horarios.find(h => h.dia_semana === dow);
  if (!hDia || hDia.abre_minuto === null) {
    grid.innerHTML = '<p class="hint">Cerrado ese dia.</p>';
    return;
  }

  grid.innerHTML = '<p class="hint">Cargando horarios...</p>';

  const { data: citasData } = await supabaseClient
    .from('citas').select('hora_inicio, duracion')
    .eq('barbero_id', selectedBarbero.id)
    .eq('fecha', dateKey(selectedDate))
    .eq('estado', 'confirmada');

  const citas = citasData || [];
  const duration = selectedServicio.duracion_min;

  grid.innerHTML = '';
  let anySlot = false;
  const isToday = dateKey(selectedDate) === dateKey(new Date());
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (let t = hDia.abre_minuto; t + duration <= hDia.cierra_minuto; t += SLOT_STEP) {
    anySlot = true;
    grid.appendChild(crearBotonHora(t, duration, citas, isToday, nowMinutes));
  }

  if (hDia.abre_minuto_tarde !== null && hDia.cierra_minuto_tarde !== null) {
    const sep = document.createElement('div');
    sep.className = 'turno-separator';
    sep.innerHTML = '<span>Tarde</span>';
    grid.appendChild(sep);

    for (let t = hDia.abre_minuto_tarde; t + duration <= hDia.cierra_minuto_tarde; t += SLOT_STEP) {
      anySlot = true;
      grid.appendChild(crearBotonHora(t, duration, citas, isToday, nowMinutes));
    }
  }

  if (!anySlot) grid.innerHTML = '<p class="hint">No hay horarios disponibles.</p>';
}

function crearBotonHora(t, duration, citas, isToday, nowMinutes) {
  const taken = citas.some(c =>
    t < c.hora_inicio + c.duracion && t + duration > c.hora_inicio
  );
  const pasada = isToday && t <= nowMinutes;

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
  return btn;
}

// ============================================
// HORARIO LISTA
// ============================================
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
      let horarioTxt = `${minutesToLabel(h.abre_minuto)} - ${minutesToLabel(h.cierra_minuto)}`;
      if (h.abre_minuto_tarde !== null && h.cierra_minuto_tarde !== null) {
        horarioTxt += ` · ${minutesToLabel(h.abre_minuto_tarde)} - ${minutesToLabel(h.cierra_minuto_tarde)}`;
      }
      li.innerHTML = `<span>${DIAS[dow]}</span><span>${horarioTxt}</span>`;
    }
    list.appendChild(li);
  });
}

// ============================================
// RESUMEN
// ============================================
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

// ============================================
// FORMULARIO RESERVA
// ============================================
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
    msg.textContent = 'Completa tu nombre y telefono.';
    msg.className = 'form-msg error';
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  msg.textContent = 'Confirmando...';
  msg.className = 'form-msg info';

  // Validacion extra: verificar que la fecha no sea festivo cerrado
  const keyFechaSel = dateKey(selectedDate);
  if (FESTIVOS_INFO[keyFechaSel]) {
    const { data: festivoCheck } = await supabaseClient
      .from('barbero_festivos')
      .select('cerrado')
      .eq('barbero_id', selectedBarbero.id)
      .eq('fecha', keyFechaSel)
      .maybeSingle();

    const estaCerrado = !festivoCheck || festivoCheck.cerrado === true;

    if (estaCerrado) {
      msg.textContent = 'Ese dia el barbero no atiende (festivo). Elige otra fecha.';
      msg.className = 'form-msg error';
      submitBtn.disabled = false;
      selectedDate = null;
      selectedTime = null;
      renderFechas();
      renderHoras();
      updateSummary();
      return;
    }
  }

  const { data: citasData } = await supabaseClient
    .from('citas').select('hora_inicio, duracion')
    .eq('barbero_id', selectedBarbero.id)
    .eq('fecha', dateKey(selectedDate))
    .eq('estado', 'confirmada');

  const conflict = (citasData || []).some(c =>
    selectedTime < c.hora_inicio + c.duracion &&
    selectedTime + selectedServicio.duracion_min > c.hora_inicio
  );

  if (conflict) {
    msg.textContent = 'Ese horario ya no esta disponible. Elige otro.';
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

  document.getElementById('successTitulo').textContent = `Listo ${name}, tu cita esta confirmada!`;
  document.getElementById('successDetail').innerHTML = `
    <div class="success-detail-row"><span>Barbero</span><span>${selectedBarbero.nombre}</span></div>
    <div class="success-detail-row"><span>Servicio</span><span>${selectedServicio.nombre}</span></div>
    <div class="success-detail-row"><span>Fecha</span><span>${fechaLabel}</span></div>
    <div class="success-detail-row"><span>Hora</span><span>${minutesToLabel(selectedTime)}</span></div>
    <div class="success-detail-row"><span>Precio</span><span>${formatCOP(selectedServicio.precio)}</span></div>
  `;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

init();
