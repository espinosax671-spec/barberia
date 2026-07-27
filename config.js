// Reemplaza estos dos valores con los de tu proyecto de Supabase
// (Settings → API → Project URL / anon public key)
// La "anon key" está diseñada para ser pública: la seguridad real
// la dan las políticas de Row Level Security que creaste en la tabla.

const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU-ANON-KEY-AQUI';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
