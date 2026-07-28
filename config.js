// ⚠️ Reemplaza con tus credenciales de Supabase
const SUPABASE_URL = 'https://XXXXX.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGc...';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Config de la app
const APP_NAME = 'CitaBarber';
const APP_BASE_URL = window.location.origin;
const TRIAL_DAYS = 30;
