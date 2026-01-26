// Supabase client instance
let supabaseClient = null;

function initSupabase() {
    if (supabaseClient) return supabaseClient;

    if (Config.SUPABASE_URL === 'YOUR_SUPABASE_URL') {
        console.warn('Supabase not configured. Running in local-only mode.');
        return null;
    }

    supabaseClient = window.supabase.createClient(
        Config.SUPABASE_URL,
        Config.SUPABASE_ANON_KEY
    );

    return supabaseClient;
}

function getSupabase() {
    return supabaseClient;
}

function isSupabaseConfigured() {
    return Config.SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
           Config.SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
}
