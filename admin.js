const loginView = document.getElementById('loginView');
const panelView = document.getElementById('panelView');
const loginForm = document.getElementById('loginForm');
const loginMsg = document.getElementById('loginMsg');
const userEmailEl = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const citasListEl = document.getElementById('citasList');
const filterDateEl = document.getElementById('filterDate');
const clearFilterBtn = document.getElementById('clearFilter');

function minutesToLabel(mins) {
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

// ---------- Sesión ----------
async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    showPanel(data.session.user.email);
  } else {
    showLogin();
  }
}

function showLogin() {
  loginView.style.display = 'flex';
  panelView.style.display = 'none';
}

function showPanel(email) {
  loginView.style.display = 'none';
  panelView.style.display = 'block';
  userEmailEl.textContent = email;
  loadCitas();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginMsg.textContent = '';
  loginMsg.className = 'form-msg';

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    loginMsg.textContent = 'Correo o contraseña incorrectos.';
    loginMsg.classList.add('error');
    return;
  }
  showPanel(data.user.email);
});

logoutBtn.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  showLogin();
});

// ---------- Listado de citas ----------
async function loadCitas() {
  citasListEl.innerHTML = '<p class="hint">Cargando citas…</p>';

  let query = supabaseClient
    .from('citas')
    .select('*')
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (filterDateEl.value) {
    query = query.eq('fecha', filterDateEl.value);
  }

  const { data, error } = await query;

  if (error) {
    citasListEl.innerHTML = '<p class="hint">Error cargando las citas. Verifica tu sesión.</p>';
    console.error(error);
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
    const fechaLabel = new Date(cita.fecha + 'T00:00:00').toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    card.innerHTML = `
      <div class="cita-info">
        <strong>${cita.nombre_cliente} · ${cita.servicio}</strong>
        <span>${fechaLabel} · ${minutesToLabel(cita.hora_inicio)} · ${formatCOP(cita.precio)}</span>
        <span>Tel: ${cita.telefono} · Estado: ${cita.estado}</span>
      </div>
      <div class="cita-actions">
        ${cita.estado === 'confirmada' ? `
          <button class="complete-btn" data-id="${cita.id}">Marcar completada</button>
          <button class="cancel-btn" data-id="${cita.id}">Cancelar</button>
        ` : ''}
      </div>
    `;
    citasListEl.appendChild(card);
  });

  citasListEl.querySelectorAll('.complete-btn').forEach(btn => {
    btn.addEventListener('click', () => updateEstado(btn.dataset.id, 'completada'));
  });
  citasListEl.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => updateEstado(btn.dataset.id, 'cancelada'));
  });
}

async function updateEstado(id, estado) {
  const { error } = await supabaseClient.from('citas').update({ estado }).eq('id', id);
  if (error) {
    alert('No se pudo actualizar la cita.');
    console.error(error);
    return;
  }
  loadCitas();
}

filterDateEl.addEventListener('change', loadCitas);
clearFilterBtn.addEventListener('click', () => {
  filterDateEl.value = '';
  loadCitas();
});

checkSession();
