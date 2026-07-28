// ⚠️ Reemplaza con tus credenciales de Supabase
const SUPABASE_URL = 'https://gmoulnbrszgheajookcf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdtb3VsbmJyc3pnaGVham9va2NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNjU1NzcsImV4cCI6MjEwMDc0MTU3N30.COU_8svOgM-301oxLqqfmqSj3gwQ5Y2x9zz-cPWaSu4';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Config de la app
const APP_NAME = 'CitaBarber';
const APP_BASE_URL = window.location.origin;
const TRIAL_DAYS = 30;
