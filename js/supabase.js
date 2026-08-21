// Configuración de Supabase.
// La demo funciona aunque Supabase esté desactivado.

window.SUPABASE_ENABLED = false;
window.SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
window.SUPABASE_ANON_KEY = "TU-ANON-KEY";

window.getSupabase = async function () {
  if (!window.SUPABASE_ENABLED) return null;
  const mod = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  return mod.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
};
