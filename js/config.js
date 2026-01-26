const Config = {
    // Replace with your Supabase project credentials
    SUPABASE_URL: 'https://uirtbrwqpcalqbtyapbm.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_2p6pkgw4Jg2yXWmn5B6Hug_qnUm_1UQ',

    // HCaptcha - get your site key from https://dashboard.hcaptcha.com
    HCAPTCHA_SITE_KEY: '4238aadc-8170-4d34-bcce-e2aa7de66e0e',  // Leave empty to disable captcha

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
