const Config = {
    // Replace with your Supabase project credentials
    SUPABASE_URL: 'YOUR_SUPABASE_URL',
    SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',

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
