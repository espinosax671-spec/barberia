// Reemplaza estos dos valores con los de tu proyecto de Supabase
// (Settings → API → Project URL / anon public key)
// La "anon key" está diseñada para ser pública: la seguridad real
// la dan las políticas de Row Level Security que creaste en la tabla.

const SUPABASE_URL = 'https://gmoulnbrszgheajookcf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdtb3VsbmJyc3pnaGVham9va2NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNjU1NzcsImV4cCI6MjEwMDc0MTU3N30.COU_8svOgM-301oxLqqfmqSj3gwQ5Y2x9zz-cPWaSu4';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
