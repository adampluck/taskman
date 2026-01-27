const Config = {
    // Supabase credentials (publishable keys - safe to commit)
    // Get from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key',

    // HCaptcha site key (public - safe to commit)
    // Get from: https://dashboard.hcaptcha.com
    HCAPTCHA_SITE_KEY: '',  // Leave empty to disable captcha

    // Voice input token endpoint
    // Local development: '/api/assemblyai-token' (requires server.js + .env)
    // Production: Your Cloudflare Worker URL (see worker/assemblyai-token.js)
    VOICE_TOKEN_ENDPOINT: '/api/assemblyai-token',

    // Sync settings
    SYNC_DEBOUNCE_MS: 2000,
    SYNC_RETRY_DELAY_MS: 5000,
    MAX_SYNC_RETRIES: 3,

    // Storage keys
    STORAGE_KEYS: {
        TASKS: 'task-manager-tasks',
        SYNC_QUEUE: 'task-manager-sync-queue',
        LAST_SYNC: 'task-manager-last-sync'
    }
};
