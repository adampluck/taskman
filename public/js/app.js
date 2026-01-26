const App = (function() {
    // Views
    const promptView = document.getElementById('prompt-view');
    const taskView = document.getElementById('task-view');
    const emptyView = document.getElementById('empty-view');

    // Prompt elements
    const pickBtn = document.getElementById('pick-btn');
    const pickerCategory = document.getElementById('picker-category');
    const pickerTime = document.getElementById('picker-time');

    // Task elements
    const taskTitle = document.getElementById('task-title');
    const taskCategoryIcon = document.getElementById('task-category-icon');
    const taskTimeLimit = document.getElementById('task-time-limit');
    const taskTimer = document.getElementById('task-timer');
    const timerDisplay = document.getElementById('timer-display');
    const startBtn = document.getElementById('start-btn');
    const resetBtn = document.getElementById('reset-btn');
    const doneBtn = document.getElementById('done-btn');
    const skipBtn = document.getElementById('skip-btn');
    const closeTaskBtn = document.getElementById('close-task');

    // Category icons SVG
    const categoryIcons = {
        work: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3"/></svg>',
        personal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        shopping: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
        health: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
        other: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>'
    };

    // Timer state
    let timerInterval = null;
    let timerStartTime = null;
    let timerLimit = 0;

    // Add modal elements
    const addToggle = document.getElementById('add-toggle');
    const addModal = document.getElementById('add-modal');
    const closeModal = document.getElementById('close-modal');
    const showAddBtn = document.getElementById('show-add-btn');
    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const addCategory = document.getElementById('add-category');
    const addTime = document.getElementById('add-time');

    // Manage modal elements
    const manageToggle = document.getElementById('manage-toggle');
    const manageModal = document.getElementById('manage-modal');
    const closeManage = document.getElementById('close-manage');
    const manageCategoryFilter = document.getElementById('manage-category-filter');
    const manageStatusFilter = document.getElementById('manage-status-filter');
    const manageList = document.getElementById('manage-list');
    const manageEmpty = document.getElementById('manage-empty');

    let currentTask = null;
    let manageCategoryValue = 'all';
    let manageStatusValue = 'all';
    let addFocusArea = 'category'; // For add modal keyboard nav
    let analyticsPeriod = 'daily';
    let analyticsCategory = 'all';

    // Swipe detection helper
    function addSwipeListener(element, onSwipeLeft, onSwipeRight) {
        let touchStartX = 0;
        let touchEndX = 0;
        const minSwipeDistance = 50;

        element.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        element.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            const distance = touchEndX - touchStartX;
            if (Math.abs(distance) >= minSwipeDistance) {
                if (distance > 0) {
                    onSwipeRight();
                } else {
                    onSwipeLeft();
                }
            }
        }, { passive: true });
    }

    // Audio context for UI sounds
    let audioCtx = null;
    let soundEnabled = true;

    function initSound() {
        const saved = localStorage.getItem('taskman-sound');
        soundEnabled = saved !== 'off';
        if (!soundEnabled) {
            document.body.classList.add('sound-off');
        }
    }

    function initAnalytics() {
        // Period tabs
        var periodTabs = document.querySelectorAll('.period-tab');
        periodTabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                periodTabs.forEach(function(t) { t.classList.remove('selected'); });
                tab.classList.add('selected');
                analyticsPeriod = tab.dataset.period;
                updateAnalyticsUI();
                playSound('tick');
            });
        });

        // Category filter
        var categoryChips = document.querySelectorAll('#analytics-category .analytics-chip');
        categoryChips.forEach(function(chip) {
            chip.addEventListener('click', function() {
                categoryChips.forEach(function(c) { c.classList.remove('selected'); });
                chip.classList.add('selected');
                analyticsCategory = chip.dataset.value;
                document.getElementById('analytics-category').dataset.value = chip.dataset.value;
                updateAnalyticsUI();
                playSound('tick');
            });
        });
    }

    function toggleSound() {
        soundEnabled = !soundEnabled;
        document.body.classList.toggle('sound-off', !soundEnabled);
        localStorage.setItem('taskman-sound', soundEnabled ? 'on' : 'off');
    }

    function getAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    function playSound(type) {
        if (!soundEnabled) return;

        const ctx = getAudioContext();
        const now = ctx.currentTime;

        if (type === 'tick') {
            // Soft tick for scrolling - very short noise burst
            const bufferSize = ctx.sampleRate * 0.015; // 15ms
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 2000;
            filter.Q.value = 1;

            const gain = ctx.createGain();
            gain.gain.value = 0.08;

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            noise.start(now);

        } else if (type === 'click') {
            // Soft click for buttons
            const bufferSize = ctx.sampleRate * 0.025; // 25ms
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 4);
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1500;

            const gain = ctx.createGain();
            gain.gain.value = 0.12;

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            noise.start(now);

        } else if (type === 'success') {
            // Gentle two-tone chime for completion
            [520, 780].forEach(function(freq, i) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0, now + i * 0.08);
                gain.gain.linearRampToValueAtTime(0.06, now + i * 0.08 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + i * 0.08);
                osc.stop(now + i * 0.08 + 0.25);
            });

        } else if (type === 'open') {
            // Soft pop for opening modals
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(500, now + 0.04);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.1);

        } else if (type === 'close') {
            // Soft thud for closing
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.08);

        } else if (type === 'delete') {
            // Soft low thump for delete
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.12);
        }
    }

    // Legacy alias for existing code
    function playClick(type) {
        if (type === 'scroll') playSound('tick');
        else if (type === 'select') playSound('success');
        else if (type === 'toggle') playSound('tick');
        else playSound('click');
    }

    function init() {
        bindEvents();
        registerServiceWorker();
        updatePickButton();
        initTheme();
        initSound();
        initAuth();
        initAnalytics();
    }

    // Auth Modal elements
    const authModal = document.getElementById('auth-modal');
    const authToggle = document.getElementById('auth-toggle');
    const syncStatus = document.getElementById('sync-status');

    function initAuth() {
        // Initialize Supabase client
        initSupabase();

        // Initialize auth if Supabase is configured
        if (isSupabaseConfigured()) {
            Auth.init().then(function() {
                if (Auth.isAuthenticated()) {
                    document.body.classList.add('authenticated');
                    SyncEngine.init();
                    SyncEngine.processQueue();
                    // Fetch payments status
                    Payments.fetchStatus().then(function() {
                        updateAuthUI();
                        updatePaymentUI();
                    });
                }
            });

            // Listen for auth state changes
            Auth.onAuthStateChange(handleAuthChange);

            // Listen for sync status changes
            SyncEngine.onStatusChange(updateSyncStatusUI);

            // Listen for payment status changes
            Payments.onStatusChange(updatePaymentUI);

            // Handle payment redirect result
            var paymentResult = Payments.handlePaymentResult();
            if (paymentResult === 'success') {
                showToast('Payment successful! Welcome to Pro');
            } else if (paymentResult === 'cancelled') {
                showToast('Payment cancelled');
            }
        }

    }

    function handleAuthChange(event, user) {
        if (event === 'SIGNED_IN') {
            document.body.classList.add('authenticated');

            // Fetch payments status first
            Payments.fetchStatus().then(function() {
                // Check for guest data to migrate
                const guestTasks = TaskStorage.getUnsyncedTasks();
                if (guestTasks.length > 0) {
                    showMigrationPrompt(guestTasks.length);
                } else {
                    SyncEngine.init();
                    SyncEngine.fullSync();
                    closeAuthModal();
                }

                updateAuthUI();
                updatePaymentUI();
            });

            showToast('Signed in');
        } else if (event === 'SIGNED_OUT') {
            document.body.classList.remove('authenticated');
            TaskStorage.clearSyncData();
            showToast('Signed out');
            closeAuthModal();
            updatePickButton();
            updatePaymentUI();
        }
    }

    function openAuthModal() {
        authModal.classList.remove('hidden');
        playSound('open');
        window._authFocusArea = 'input';

        if (Auth.isAuthenticated()) {
            showAuthView('account');
            updateAuthUI();
            window._authFocusArea = 'button';
        } else {
            showAuthView('signin');
            document.getElementById('auth-email').focus();
            // Initialize HCaptcha if configured
            setTimeout(initHCaptcha, 100);
        }
    }

    function closeAuthModal() {
        authModal.classList.add('hidden');
        playSound('close');
    }

    function showAuthView(view) {
        const views = authModal.querySelectorAll('.auth-view');
        views.forEach(function(v) {
            v.classList.add('hidden');
        });

        const targetView = document.getElementById('auth-' + view);
        if (targetView) {
            targetView.classList.remove('hidden');
        }
    }

    function showMigrationPrompt(count) {
        document.getElementById('migrate-count').textContent = count;
        showAuthView('migrate');
    }

    let pendingOtpEmail = null;
    let hcaptchaWidgetId = null;

    function initHCaptcha() {
        // Only initialize if site key is configured and hcaptcha is loaded
        if (!Config.HCAPTCHA_SITE_KEY || !window.hcaptcha) return;

        const container = document.getElementById('hcaptcha-container');
        if (!container || container.hasChildNodes()) return;

        hcaptchaWidgetId = window.hcaptcha.render(container, {
            sitekey: Config.HCAPTCHA_SITE_KEY,
            theme: document.body.classList.contains('light-mode') ? 'light' : 'dark'
        });
    }

    function getHCaptchaToken() {
        if (hcaptchaWidgetId === null || !window.hcaptcha) return null;
        return window.hcaptcha.getResponse(hcaptchaWidgetId);
    }

    function resetHCaptcha() {
        if (hcaptchaWidgetId === null || !window.hcaptcha) return;
        window.hcaptcha.reset(hcaptchaWidgetId);
    }

    function isValidEmail(email) {
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    async function handleOtpEmailSubmit(e) {
        e.preventDefault();
        const email = document.getElementById('auth-email').value.trim();

        if (!email) {
            showToast('Please enter an email');
            return;
        }

        if (!isValidEmail(email)) {
            showToast('Please enter a valid email');
            return;
        }

        // Get captcha token if HCaptcha is enabled
        let captchaToken = null;
        if (Config.HCAPTCHA_SITE_KEY) {
            captchaToken = getHCaptchaToken();
            if (!captchaToken) {
                showToast('Please complete the captcha');
                return;
            }
        }

        try {
            await Auth.sendOtp(email, captchaToken);
            pendingOtpEmail = email;
            document.getElementById('sent-email').textContent = email;
            showAuthView('otp');
            document.getElementById('otp-code').focus();
            showToast('Code sent');
            // Reset captcha for next use
            resetHCaptcha();
        } catch (error) {
            console.error('OTP send error:', error);
            showToast('Failed to send code');
            resetHCaptcha();
        }
    }

    async function handleOtpVerifySubmit(e) {
        e.preventDefault();
        const code = document.getElementById('otp-code').value;

        if (!pendingOtpEmail) {
            showAuthView('signin');
            return;
        }

        try {
            await Auth.verifyOtp(pendingOtpEmail, code);
            pendingOtpEmail = null;
            showToast('Signed in');
        } catch (error) {
            console.error('OTP verify error:', error);
            showToast('Invalid code');
        }
    }

    async function handleGoogleSignIn() {
        try {
            await Auth.signInWithGoogle();
        } catch (error) {
            console.error('Google sign in error:', error);
            showToast('Failed to sign in with Google');
        }
    }

    async function handleSignOut() {
        try {
            await Auth.signOut();
        } catch (error) {
            console.error('Sign out error:', error);
            showToast('Failed to sign out');
        }
    }

    async function handleMigrate() {
        showToast('Syncing tasks...');
        try {
            SyncEngine.init();
            const result = await SyncEngine.migrateGuestData();
            showToast(result.migrated + ' tasks synced');
            closeAuthModal();
            updatePickButton();
        } catch (error) {
            console.error('Migration error:', error);
            showToast('Failed to sync tasks');
        }
    }

    function handleSkipMigrate() {
        SyncEngine.init();
        SyncEngine.fullSync();
        closeAuthModal();
    }

    function calculateAnalytics(period, category) {
        var tasks = TaskStorage.getTasks();
        var now = new Date();

        // Filter by completion status
        var completedTasks = tasks.filter(function(t) {
            return t.completed && t.completedAt;
        });

        // Filter by time period
        completedTasks = completedTasks.filter(function(t) {
            var completedDate = new Date(t.completedAt);

            if (period === 'daily') {
                return completedDate.toDateString() === now.toDateString();
            } else if (period === 'weekly') {
                var weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                return completedDate >= weekAgo;
            } else if (period === 'monthly') {
                var monthAgo = new Date(now);
                monthAgo.setDate(monthAgo.getDate() - 30);
                return completedDate >= monthAgo;
            }
            return true;
        });

        // Filter by category
        if (category !== 'all') {
            completedTasks = completedTasks.filter(function(t) {
                return t.category === category;
            });
        }

        return { completed: completedTasks.length };
    }

    function updateAnalyticsUI() {
        var stats = calculateAnalytics(analyticsPeriod, analyticsCategory);
        var completedEl = document.getElementById('analytics-completed');
        if (completedEl) {
            completedEl.textContent = stats.completed;
        }
    }

    function updateAuthUI() {
        const user = Auth.getUser();
        if (!user) return;

        const emailEl = document.getElementById('account-email');
        if (emailEl) {
            emailEl.textContent = user.email;
        }

        const syncedCountEl = document.getElementById('tasks-synced');
        if (syncedCountEl) {
            const tasks = TaskStorage.getTasks();
            const synced = tasks.filter(function(t) {
                return t._remoteId;
            }).length;
            syncedCountEl.textContent = synced;
        }

        const lastSyncEl = document.getElementById('last-sync');
        if (lastSyncEl) {
            const lastSync = localStorage.getItem(Config.STORAGE_KEYS.LAST_SYNC);
            if (lastSync) {
                const date = new Date(lastSync);
                lastSyncEl.textContent = formatRelativeTime(date);
            } else {
                lastSyncEl.textContent = 'Never';
            }
        }

        // Update analytics
        updateAnalyticsUI();
    }

    function formatRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return minutes + 'm ago';
        if (hours < 24) return hours + 'h ago';
        return days + 'd ago';
    }

    function updateSyncStatusUI(status) {
        if (!syncStatus) return;

        syncStatus.className = 'sync-status ' + status;
        const text = syncStatus.querySelector('.sync-text');

        switch (status) {
            case 'syncing':
                text.textContent = 'Syncing...';
                syncStatus.classList.remove('hidden');
                break;
            case 'synced':
                text.textContent = 'Synced';
                setTimeout(function() {
                    syncStatus.classList.add('hidden');
                }, 2000);
                break;
            case 'offline':
                text.textContent = 'Offline';
                syncStatus.classList.remove('hidden');
                break;
            case 'error':
                text.textContent = 'Sync failed';
                syncStatus.classList.remove('hidden');
                break;
            case 'online':
                syncStatus.classList.add('hidden');
                break;
            case 'limit_reached':
                text.textContent = 'Task limit reached';
                syncStatus.classList.remove('hidden');
                openPaywallModal();
                break;
        }
    }

    // Paywall modal functions
    function openPaywallModal() {
        var paywallModal = document.getElementById('paywall-modal');
        if (!paywallModal) return;

        // Update limit in modal text
        var limit = Payments.getTaskLimit();
        var limitEl = document.getElementById('paywall-limit');
        if (limitEl && limit) {
            limitEl.textContent = limit;
        }

        paywallModal.classList.remove('hidden');
        playSound('open');
    }

    function closePaywallModal() {
        var paywallModal = document.getElementById('paywall-modal');
        if (paywallModal) {
            paywallModal.classList.add('hidden');
            playSound('close');
        }
    }

    async function handleUpgrade() {
        try {
            showToast('Redirecting to checkout...');
            await Payments.initiateCheckout();
        } catch (error) {
            console.error('Checkout error:', error);
            showToast('Failed to start checkout');
        }
    }

    async function handleCryptoPayment(e) {
        e.preventDefault();
        try {
            showToast('Redirecting to crypto checkout...');
            await Payments.initiateCryptoCheckout();
        } catch (error) {
            console.error('Crypto checkout error:', error);
            showToast('Failed to start crypto checkout');
        }
    }

    function updatePaymentUI() {
        var paymentSection = document.getElementById('payment-section');
        var tierBadge = document.getElementById('tier-badge');
        var tasksRemaining = document.getElementById('tasks-remaining');
        var upgradeBtn = document.getElementById('upgrade-btn');

        if (!paymentSection) return;

        // Hide payment section if payments not enabled
        if (!Payments.isPaymentsEnabled()) {
            paymentSection.classList.add('hidden');
            return;
        }

        paymentSection.classList.remove('hidden');

        // Update tier badge
        if (tierBadge) {
            if (Payments.isProUser()) {
                tierBadge.textContent = 'Pro';
                tierBadge.className = 'tier-badge tier-pro';
            } else {
                tierBadge.textContent = 'Free';
                tierBadge.className = 'tier-badge tier-free';
            }
        }

        // Update remaining tasks text
        if (tasksRemaining) {
            var remaining = Payments.getRemainingTasks();
            if (remaining !== null) {
                tasksRemaining.textContent = remaining + ' of ' + Payments.getTaskLimit() + ' synced tasks remaining';
                tasksRemaining.classList.remove('hidden');
            } else {
                tasksRemaining.textContent = 'Unlimited synced tasks';
                tasksRemaining.classList.remove('hidden');
            }
        }

        // Show/hide upgrade button and crypto links
        if (upgradeBtn) {
            if (Payments.isProUser()) {
                upgradeBtn.classList.add('hidden');
            } else {
                upgradeBtn.classList.remove('hidden');
            }
        }

        // Show/hide crypto payment links
        document.querySelectorAll('.crypto-link').forEach(function(link) {
            if (Payments.isProUser()) {
                link.classList.add('hidden');
            } else {
                link.classList.remove('hidden');
            }
        });
    }

    function initTheme() {
        const savedTheme = localStorage.getItem('taskman-theme') || 'dark';
        applyTheme(savedTheme);

        // If rainbow mode, restore or generate colors
        if (savedTheme === 'rainbow') {
            const savedHue = localStorage.getItem('taskman-rainbow-hue');
            if (savedHue) {
                setRainbowHue(parseInt(savedHue, 10));
            } else {
                randomizeRainbow();
            }
        }
    }

    function applyTheme(theme) {
        document.body.classList.remove('light-mode', 'rainbow-mode');
        if (theme === 'light') {
            document.body.classList.add('light-mode');
        } else if (theme === 'rainbow') {
            document.body.classList.add('rainbow-mode');
        }
    }

    function toggleTheme() {
        const currentTheme = getCurrentTheme();
        let newTheme;

        // Cycle: dark → light → rainbow → dark
        if (currentTheme === 'dark') {
            newTheme = 'light';
        } else if (currentTheme === 'light') {
            newTheme = 'rainbow';
            randomizeRainbow();
        } else {
            newTheme = 'dark';
        }

        applyTheme(newTheme);
        localStorage.setItem('taskman-theme', newTheme);
        playSound('tick');
    }

    function getCurrentTheme() {
        if (document.body.classList.contains('rainbow-mode')) return 'rainbow';
        if (document.body.classList.contains('light-mode')) return 'light';
        return 'dark';
    }

    function randomizeRainbow() {
        // Generate random pastel hue (0-360)
        const hue = Math.floor(Math.random() * 360);
        setRainbowHue(hue);

        // Randomize pattern offset
        const offset = Math.floor(Math.random() * 100);
        document.body.style.setProperty('--pattern-offset', offset);
    }

    function setRainbowHue(hue) {
        document.body.style.setProperty('--rainbow-hue', hue);
        localStorage.setItem('taskman-rainbow-hue', hue);
    }

    function updatePickButton() {
        const category = pickerCategory.dataset.value;
        const maxTime = parseInt(pickerTime.dataset.value, 10);

        const allTasks = TaskStorage.getTasks();
        const addHint = document.getElementById('add-hint');

        // Handle empty state - dim view and disable controls
        if (allTasks.length === 0) {
            promptView.classList.remove('hidden');
            pickBtn.classList.add('hidden');
            promptView.classList.add('empty-state');
            pickerCategory.classList.add('disabled');
            pickerTime.classList.add('disabled');
            addToggle.classList.add('pulsing');
            if (addHint) addHint.classList.remove('hidden');
            return;
        }

        // Remove empty state when tasks exist
        promptView.classList.remove('hidden');
        pickBtn.classList.remove('hidden');
        promptView.classList.remove('empty-state');
        pickerCategory.classList.remove('disabled');
        pickerTime.classList.remove('disabled');
        addToggle.classList.remove('pulsing');
        if (addHint) addHint.classList.add('hidden');

        let tasks = allTasks.filter(t => !t.completed);

        if (category !== 'all') {
            tasks = tasks.filter(t => t.category === category);
        }

        if (maxTime > 0) {
            tasks = tasks.filter(t => t.timeEstimate <= maxTime);
        }

        if (tasks.length === 0) {
            pickBtn.classList.add('is-disabled');
        } else {
            pickBtn.classList.remove('is-disabled');
        }
    }

    function bindEvents() {
        pickBtn.addEventListener('click', pickTask);
        document.getElementById('close-task').addEventListener('click', closeTask);
        startBtn.addEventListener('click', startTimer);
        resetBtn.addEventListener('click', resetTimer);
        doneBtn.addEventListener('click', completeTask);
        skipBtn.addEventListener('click', skipTask);
        addToggle.addEventListener('click', openAddModal);
        closeModal.addEventListener('click', closeAddModal);
        showAddBtn.addEventListener('click', openAddModal);
        taskForm.addEventListener('submit', addTask);

        // Category wheel
        const categories = ['work', 'personal', 'shopping', 'health', 'other'];
        const wheelItems = pickerCategory.querySelectorAll('.wheel-item');

        function updateWheel(newIndex) {
            // Wrap around for infinite scroll
            newIndex = ((newIndex % categories.length) + categories.length) % categories.length;
            pickerCategory.dataset.index = newIndex;
            pickerCategory.dataset.value = categories[newIndex];

            // Update offsets and active states
            wheelItems.forEach((item, i) => {
                let offset = i - newIndex;
                // Wrap offset for infinite feel
                if (offset > 2) offset -= categories.length;
                if (offset < -2) offset += categories.length;
                item.dataset.offset = offset;
                item.classList.toggle('active', offset === 0);
            });

            // Update pick button state
            updatePickButton();
        }

        // Click on wheel item
        pickerCategory.addEventListener('click', function(e) {
            const item = e.target.closest('.wheel-item');
            if (!item) return;
            const clickedIndex = categories.indexOf(item.dataset.category);
            if (clickedIndex !== -1) {
                updateWheel(clickedIndex);
                playClick('scroll');
            }
        });

        // Swipe on category wheel (main screen)
        addSwipeListener(pickerCategory,
            function() { // swipe left = next
                const currentIndex = parseInt(pickerCategory.dataset.index, 10);
                updateWheel(currentIndex + 1);
                playClick('scroll');
            },
            function() { // swipe right = prev
                const currentIndex = parseInt(pickerCategory.dataset.index, 10);
                updateWheel(currentIndex - 1);
                playClick('scroll');
            }
        );

        // Time chip selection
        pickerTime.addEventListener('click', function(e) {
            const chip = e.target.closest('.time-chip');
            if (!chip) return;
            pickerTime.querySelectorAll('.time-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            pickerTime.dataset.value = chip.dataset.value;
            playClick('scroll');
            updatePickButton();
        });

        // Swipe on time options (main screen)
        addSwipeListener(pickerTime,
            function() { // swipe left = next
                const idx = getSelectedTimeIndex();
                selectTimeChip(idx + 1);
                playClick('scroll');
            },
            function() { // swipe right = prev
                const idx = getSelectedTimeIndex();
                selectTimeChip(idx - 1);
                playClick('scroll');
            }
        );

        // Keyboard navigation for main screen
        // Areas: null (no focus), 'header', 'category', 'time', 'button', 'footer'
        let focusArea = null; // Start with no focus indicator
        let headerFocus = 0; // 0=auth, 1=theme, 2=sound
        let footerFocus = 0; // 0=manage, 1=add
        const timeChips = Array.from(pickerTime.querySelectorAll('.time-chip'));
        const themeToggleBtn = document.getElementById('theme-toggle');
        const soundToggleBtn = document.getElementById('sound-toggle');

        function updateFocusIndicators() {
            // Clear all focus states
            pickerCategory.dataset.focused = focusArea === 'category';
            pickerTime.dataset.focused = focusArea === 'time';
            pickBtn.classList.toggle('focused', focusArea === 'button');
            authToggle.classList.toggle('focused', focusArea === 'header' && headerFocus === 0);
            themeToggleBtn.classList.toggle('focused', focusArea === 'header' && headerFocus === 1);
            soundToggleBtn.classList.toggle('focused', focusArea === 'header' && headerFocus === 2);
            manageToggle.classList.toggle('focused', focusArea === 'footer' && footerFocus === 0);
            addToggle.classList.toggle('focused', focusArea === 'footer' && footerFocus === 1);
        }

        function getSelectedTimeIndex() {
            return timeChips.findIndex(c => c.classList.contains('selected'));
        }

        function selectTimeChip(index) {
            index = ((index % timeChips.length) + timeChips.length) % timeChips.length;
            timeChips.forEach(c => c.classList.remove('selected'));
            timeChips[index].classList.add('selected');
            pickerTime.dataset.value = timeChips[index].dataset.value;
            updatePickButton();
        }

        // Initialize focus - if user has 0 tasks, focus add button
        const tasks = TaskStorage.getTasks();
        const incompleteTasks = tasks.filter(function(t) { return !t.completed; });
        if (incompleteTasks.length === 0) {
            focusArea = 'footer';
            footerFocus = 1; // add button
        }
        updateFocusIndicators();

        // Hover to focus (main screen) - only for buttons, not category/time
        pickBtn.addEventListener('mouseenter', function() {
            focusArea = 'button';
            updateFocusIndicators();
        });
        authToggle.addEventListener('mouseenter', function() {
            focusArea = 'header';
            headerFocus = 0;
            updateFocusIndicators();
        });
        themeToggleBtn.addEventListener('mouseenter', function() {
            focusArea = 'header';
            headerFocus = 1;
            updateFocusIndicators();
        });
        soundToggleBtn.addEventListener('mouseenter', function() {
            focusArea = 'header';
            headerFocus = 2;
            updateFocusIndicators();
        });
        manageToggle.addEventListener('mouseenter', function() {
            focusArea = 'footer';
            footerFocus = 0;
            updateFocusIndicators();
        });
        addToggle.addEventListener('mouseenter', function() {
            focusArea = 'footer';
            footerFocus = 1;
            updateFocusIndicators();
        });

        document.addEventListener('keydown', function(e) {
            // Only handle when prompt view is visible
            if (promptView.classList.contains('hidden')) return;
            if (addModal && !addModal.classList.contains('hidden')) return;
            if (manageModal && !manageModal.classList.contains('hidden')) return;

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (focusArea === null) {
                    focusArea = 'category';
                } else if (focusArea === 'footer') {
                    focusArea = 'button';
                } else if (focusArea === 'button') {
                    focusArea = 'time';
                } else if (focusArea === 'time') {
                    focusArea = 'category';
                } else if (focusArea === 'category') {
                    focusArea = 'header';
                }
                updateFocusIndicators();
                playSound('tick');
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (focusArea === null) {
                    focusArea = 'category';
                } else if (focusArea === 'header') {
                    focusArea = 'category';
                } else if (focusArea === 'category') {
                    focusArea = 'time';
                } else if (focusArea === 'time') {
                    focusArea = 'button';
                } else if (focusArea === 'button') {
                    focusArea = 'footer';
                }
                updateFocusIndicators();
                playSound('tick');
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (focusArea === null) {
                    focusArea = 'category';
                    updateFocusIndicators();
                    playSound('tick');
                } else if (focusArea === 'category') {
                    const currentIndex = parseInt(pickerCategory.dataset.index, 10);
                    updateWheel(currentIndex - 1);
                    playClick('scroll');
                } else if (focusArea === 'time') {
                    const idx = getSelectedTimeIndex();
                    selectTimeChip(idx - 1);
                    playClick('scroll');
                } else if (focusArea === 'header') {
                    headerFocus = headerFocus > 0 ? headerFocus - 1 : 2;
                    updateFocusIndicators();
                    playSound('tick');
                } else if (focusArea === 'footer') {
                    footerFocus = footerFocus === 0 ? 1 : 0;
                    updateFocusIndicators();
                    playSound('tick');
                }
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (focusArea === null) {
                    focusArea = 'category';
                    updateFocusIndicators();
                    playSound('tick');
                } else if (focusArea === 'category') {
                    const currentIndex = parseInt(pickerCategory.dataset.index, 10);
                    updateWheel(currentIndex + 1);
                    playClick('scroll');
                } else if (focusArea === 'time') {
                    const idx = getSelectedTimeIndex();
                    selectTimeChip(idx + 1);
                    playClick('scroll');
                } else if (focusArea === 'header') {
                    headerFocus = headerFocus < 2 ? headerFocus + 1 : 0;
                    updateFocusIndicators();
                    playSound('tick');
                } else if (focusArea === 'footer') {
                    footerFocus = footerFocus === 0 ? 1 : 0;
                    updateFocusIndicators();
                    playSound('tick');
                }
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (focusArea === 'button' && !pickBtn.disabled) {
                    playClick('select');
                    pickBtn.click();
                } else if (focusArea === 'header') {
                    playClick('select');
                    if (headerFocus === 0) authToggle.click();
                    else if (headerFocus === 1) themeToggleBtn.click();
                    else soundToggleBtn.click();
                } else if (focusArea === 'footer') {
                    playClick('select');
                    if (footerFocus === 0) manageToggle.click();
                    else addToggle.click();
                }
            }
        });

        // Task view keyboard navigation - simplified DOM-based approach
        function getVisibleTaskButtons() {
            var btns = [];
            btns.push(closeTaskBtn); // Close button always first
            if (!startBtn.classList.contains('hidden')) btns.push(startBtn);
            if (!doneBtn.classList.contains('hidden')) btns.push(doneBtn);
            if (!skipBtn.classList.contains('hidden')) btns.push(skipBtn);
            if (!resetBtn.classList.contains('hidden')) btns.push(resetBtn);
            return btns;
        }

        function getTaskFocusedButton() {
            var btns = getVisibleTaskButtons();
            for (var i = 0; i < btns.length; i++) {
                if (btns[i].classList.contains('focused')) {
                    return { btn: btns[i], index: i, btns: btns };
                }
            }
            return { btn: null, index: -1, btns: btns };
        }

        function clearAllTaskFocus() {
            closeTaskBtn.classList.remove('focused');
            startBtn.classList.remove('focused');
            doneBtn.classList.remove('focused');
            skipBtn.classList.remove('focused');
            resetBtn.classList.remove('focused');
        }

        function setTaskFocus(index) {
            var btns = getVisibleTaskButtons();
            clearAllTaskFocus();
            // Set focus on target
            if (btns[index]) {
                btns[index].classList.add('focused');
            }
        }

        document.addEventListener('keydown', function(e) {
            // Only handle when task view is visible
            if (taskView.classList.contains('hidden')) return;
            // Defer to modals when they're open
            if (!authModal.classList.contains('hidden')) return;
            if (!addModal.classList.contains('hidden')) return;
            if (!manageModal.classList.contains('hidden')) return;
            if (!document.getElementById('signup-prompt').classList.contains('hidden')) return;

            var state = getTaskFocusedButton();
            if (state.btns.length === 0) return;

            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                var newIndex = state.index <= 0 ? state.btns.length - 1 : state.index - 1;
                setTaskFocus(newIndex);
                playSound('tick');
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                var newIndex = state.index >= state.btns.length - 1 ? 0 : state.index + 1;
                setTaskFocus(newIndex);
                playSound('tick');
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopImmediatePropagation();
                // Click the focused button, or first button if none focused
                var targetBtn = state.btn || state.btns[0];
                if (targetBtn) {
                    playClick('select');
                    targetBtn.click();
                }
                return;
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeTask();
            }
        });

        // Reset focus when task view opens - Start button on desktop, none on mobile
        window._taskViewFocusReset = function() {
            var isMobile = window.matchMedia('(hover: none)').matches;
            if (isMobile) {
                clearAllTaskFocus();
            } else {
                setTaskFocus(1); // Start button is index 1 (after close)
            }
        };

        // Add modal - category wheel
        const addWheelItems = addCategory.querySelectorAll('.wheel-item');

        function updateAddWheel(newIndex) {
            newIndex = ((newIndex % categories.length) + categories.length) % categories.length;
            addCategory.dataset.index = newIndex;
            addCategory.dataset.value = categories[newIndex];

            addWheelItems.forEach((item, i) => {
                let offset = i - newIndex;
                if (offset > 2) offset -= categories.length;
                if (offset < -2) offset += categories.length;
                item.dataset.offset = offset;
                item.classList.toggle('active', offset === 0);
            });
        }

        addCategory.addEventListener('click', function(e) {
            const item = e.target.closest('.wheel-item');
            if (!item) return;
            const clickedIndex = categories.indexOf(item.dataset.category);
            if (clickedIndex !== -1) {
                updateAddWheel(clickedIndex);
                playClick('scroll');
            }
        });

        // Swipe on category wheel (add modal)
        addSwipeListener(addCategory,
            function() { // swipe left = next
                const currentIndex = parseInt(addCategory.dataset.index, 10);
                updateAddWheel(currentIndex + 1);
                playClick('scroll');
            },
            function() { // swipe right = prev
                const currentIndex = parseInt(addCategory.dataset.index, 10);
                updateAddWheel(currentIndex - 1);
                playClick('scroll');
            }
        );

        // Add modal - time chip selection
        addTime.addEventListener('click', function(e) {
            const chip = e.target.closest('.time-chip');
            if (!chip) return;
            addTime.querySelectorAll('.time-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            addTime.dataset.value = chip.dataset.value;
            playClick('scroll');
        });

        // Swipe on time options (add modal)
        addSwipeListener(addTime,
            function() { // swipe left = next
                const idx = getAddSelectedTimeIndex();
                selectAddTimeChip(idx + 1);
                playClick('scroll');
            },
            function() { // swipe right = prev
                const idx = getAddSelectedTimeIndex();
                selectAddTimeChip(idx - 1);
                playClick('scroll');
            }
        );

        // Add modal keyboard navigation
        const addTimeChips = Array.from(addTime.querySelectorAll('.time-chip'));
        const addBtn = taskForm.querySelector('.btn-add');

        function updateAddFocusIndicators() {
            closeModal.classList.toggle('focused', addFocusArea === 'close');
            addCategory.dataset.focused = addFocusArea === 'category';
            taskInput.classList.toggle('focused', addFocusArea === 'input');
            addTime.dataset.focused = addFocusArea === 'time';
            addBtn.classList.toggle('focused', addFocusArea === 'button');
        }

        function getAddSelectedTimeIndex() {
            return addTimeChips.findIndex(c => c.classList.contains('selected'));
        }

        function selectAddTimeChip(index) {
            index = ((index % addTimeChips.length) + addTimeChips.length) % addTimeChips.length;
            addTimeChips.forEach(c => c.classList.remove('selected'));
            addTimeChips[index].classList.add('selected');
            addTime.dataset.value = addTimeChips[index].dataset.value;
        }

        // Hover to focus (add modal)
        closeModal.addEventListener('mouseenter', function() {
            addFocusArea = 'close';
            taskInput.blur();
            updateAddFocusIndicators();
        });
        addCategory.addEventListener('mouseenter', function() {
            addFocusArea = 'category';
            taskInput.blur();
            updateAddFocusIndicators();
        });
        taskInput.addEventListener('mouseenter', function() {
            addFocusArea = 'input';
            updateAddFocusIndicators();
        });
        taskInput.addEventListener('focus', function() {
            addFocusArea = 'input';
            updateAddFocusIndicators();
        });
        addTime.addEventListener('mouseenter', function() {
            addFocusArea = 'time';
            taskInput.blur();
            updateAddFocusIndicators();
        });
        addBtn.addEventListener('mouseenter', function() {
            addFocusArea = 'button';
            taskInput.blur();
            updateAddFocusIndicators();
        });

        // Manage modal
        manageToggle.addEventListener('click', openManageModal);
        closeManage.addEventListener('click', closeManageModal);
        document.getElementById('manage-add-btn').addEventListener('click', function() {
            closeManageModal();
            openAddModal();
        });

        // Category filter
        manageCategoryFilter.addEventListener('click', function(e) {
            const chip = e.target.closest('.filter-chip');
            if (!chip) return;
            manageCategoryFilter.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            manageCategoryFilter.dataset.value = chip.dataset.value;
            manageCategoryValue = chip.dataset.value;
            renderManageList();
            playClick('scroll');
        });

        // Status filter
        manageStatusFilter.addEventListener('click', function(e) {
            const chip = e.target.closest('.filter-chip');
            if (!chip) return;
            manageStatusFilter.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            manageStatusFilter.dataset.value = chip.dataset.value;
            manageStatusValue = chip.dataset.value;
            renderManageList();
            playClick('scroll');
        });

        manageList.addEventListener('click', handleManageAction);
        document.getElementById('delete-all-btn').addEventListener('click', deleteAllCompleted);

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

        // Sound toggle
        document.getElementById('sound-toggle').addEventListener('click', toggleSound);

        // Auth toggle and events
        document.getElementById('auth-toggle').addEventListener('click', openAuthModal);
        document.getElementById('close-auth').addEventListener('click', closeAuthModal);
        document.getElementById('otp-email-form').addEventListener('submit', handleOtpEmailSubmit);
        document.getElementById('auth-email').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const btn = document.querySelector('#otp-email-form .btn-add');
                btn.classList.add('active');
                playSound('click');
                setTimeout(function() { btn.classList.remove('active'); }, 150);
                document.getElementById('otp-email-form').requestSubmit();
            }
        });
        document.getElementById('google-signin').addEventListener('click', handleGoogleSignIn);
        document.getElementById('otp-verify-form').addEventListener('submit', handleOtpVerifySubmit);
        document.getElementById('otp-code').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const btn = document.querySelector('#otp-verify-form .btn-add');
                btn.classList.add('active');
                playSound('click');
                setTimeout(function() { btn.classList.remove('active'); }, 150);
                document.getElementById('otp-verify-form').requestSubmit();
            }
        });
        document.getElementById('sign-out').addEventListener('click', handleSignOut);
        document.getElementById('auth-back').addEventListener('click', function() {
            showAuthView('signin');
            document.getElementById('otp-code').value = '';
        });
        document.getElementById('migrate-yes').addEventListener('click', handleMigrate);
        document.getElementById('migrate-no').addEventListener('click', handleSkipMigrate);

        // Signup prompt events
        document.getElementById('close-signup-prompt').addEventListener('click', dismissSignupPrompt);
        document.getElementById('signup-prompt-later').addEventListener('click', dismissSignupPrompt);
        document.getElementById('signup-prompt-yes').addEventListener('click', function() {
            closeSignupPrompt();
            openAuthModal();
        });

        // Paywall modal events
        document.getElementById('close-paywall').addEventListener('click', closePaywallModal);
        document.getElementById('paywall-later').addEventListener('click', closePaywallModal);
        document.getElementById('paywall-upgrade').addEventListener('click', handleUpgrade);
        var upgradeBtn = document.getElementById('upgrade-btn');
        if (upgradeBtn) {
            upgradeBtn.addEventListener('click', handleUpgrade);
        }

        // Crypto payment links
        document.querySelectorAll('.crypto-link').forEach(function(link) {
            link.addEventListener('click', handleCryptoPayment);
        });

        // Keyboard handler for modals
        document.addEventListener('keydown', function(e) {
            // Escape closes modals
            if (e.key === 'Escape') {
                if (!addModal.classList.contains('hidden')) closeAddModal();
                if (!manageModal.classList.contains('hidden')) closeManageModal();
                if (!authModal.classList.contains('hidden')) closeAuthModal();
                if (!document.getElementById('signup-prompt').classList.contains('hidden')) dismissSignupPrompt();
                var paywallModal = document.getElementById('paywall-modal');
                if (paywallModal && !paywallModal.classList.contains('hidden')) closePaywallModal();
                return;
            }

            // Signup prompt keyboard navigation
            var signupPrompt = document.getElementById('signup-prompt');
            if (!signupPrompt.classList.contains('hidden')) {
                var closeSignupBtn = document.getElementById('close-signup-prompt');
                var yesBtn = document.getElementById('signup-prompt-yes');
                var laterBtn = document.getElementById('signup-prompt-later');

                if (!window._signupFocusArea) window._signupFocusArea = 'yes';

                function updateSignupFocusIndicators() {
                    closeSignupBtn.classList.toggle('focused', window._signupFocusArea === 'close');
                    yesBtn.classList.toggle('focused', window._signupFocusArea === 'yes');
                    laterBtn.classList.toggle('focused', window._signupFocusArea === 'later');
                }

                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (window._signupFocusArea === 'yes') {
                        window._signupFocusArea = 'close';
                    } else if (window._signupFocusArea === 'later') {
                        window._signupFocusArea = 'yes';
                    }
                    updateSignupFocusIndicators();
                    playSound('tick');
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (window._signupFocusArea === 'close') {
                        window._signupFocusArea = 'yes';
                    } else if (window._signupFocusArea === 'yes') {
                        window._signupFocusArea = 'later';
                    }
                    updateSignupFocusIndicators();
                    playSound('tick');
                } else if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (window._signupFocusArea === 'close') {
                        dismissSignupPrompt();
                    } else if (window._signupFocusArea === 'yes') {
                        yesBtn.click();
                    } else if (window._signupFocusArea === 'later') {
                        laterBtn.click();
                    }
                    playClick('select');
                }
                return;
            }

            // Add modal keyboard navigation
            if (!addModal.classList.contains('hidden')) {
                // Don't intercept when typing in input (check both DOM focus and focus area)
                if ((document.activeElement === taskInput || addFocusArea === 'input') &&
                    e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Escape') {
                    // Ensure input has actual focus for typing
                    if (document.activeElement !== taskInput) {
                        taskInput.focus();
                    }
                    return;
                }

                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (addFocusArea === 'category') {
                        addFocusArea = 'close';
                        taskInput.blur();
                    } else if (addFocusArea === 'input') {
                        addFocusArea = 'category';
                        taskInput.blur();
                    } else if (addFocusArea === 'time') {
                        addFocusArea = 'input';
                        taskInput.focus();
                    } else if (addFocusArea === 'button') {
                        addFocusArea = 'time';
                    }
                    updateAddFocusIndicators();
                    playSound('tick');
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (addFocusArea === 'close') {
                        addFocusArea = 'category';
                    } else if (addFocusArea === 'category') {
                        addFocusArea = 'input';
                        taskInput.focus();
                    } else if (addFocusArea === 'input') {
                        addFocusArea = 'time';
                        taskInput.blur();
                    } else if (addFocusArea === 'time') {
                        addFocusArea = 'button';
                    }
                    updateAddFocusIndicators();
                    playSound('tick');
                } else if (e.key === 'ArrowLeft') {
                    if (addFocusArea === 'category') {
                        e.preventDefault();
                        const currentIndex = parseInt(addCategory.dataset.index, 10);
                        updateAddWheel(currentIndex - 1);
                        playClick('scroll');
                    } else if (addFocusArea === 'time') {
                        e.preventDefault();
                        const idx = getAddSelectedTimeIndex();
                        selectAddTimeChip(idx - 1);
                        playClick('scroll');
                    }
                } else if (e.key === 'ArrowRight') {
                    if (addFocusArea === 'category') {
                        e.preventDefault();
                        const currentIndex = parseInt(addCategory.dataset.index, 10);
                        updateAddWheel(currentIndex + 1);
                        playClick('scroll');
                    } else if (addFocusArea === 'time') {
                        e.preventDefault();
                        const idx = getAddSelectedTimeIndex();
                        selectAddTimeChip(idx + 1);
                        playClick('scroll');
                    }
                } else if (e.key === 'Enter' || e.key === ' ') {
                    if (addFocusArea === 'close') {
                        e.preventDefault();
                        closeModal.click();
                    } else if (addFocusArea === 'button') {
                        e.preventDefault();
                        playClick('select');
                        taskForm.querySelector('.btn-add').click();
                    } else if (addFocusArea === 'input' && e.key === 'Enter') {
                        // Let Enter submit when in input
                    } else if (e.key === ' ' && addFocusArea !== 'input') {
                        e.preventDefault();
                    }
                }
                return;
            }

            // Manage modal keyboard navigation
            if (!manageModal.classList.contains('hidden')) {
                const categoryChips = Array.from(manageCategoryFilter.querySelectorAll('.filter-chip'));
                const statusChips = Array.from(manageStatusFilter.querySelectorAll('.filter-chip'));
                const taskItems = Array.from(manageList.querySelectorAll('.manage-item'));

                // Track manage modal focus area: 'close', 'category', 'status', 'list'
                if (!window._manageFocusArea) window._manageFocusArea = 'category';
                if (window._manageTaskIndex === undefined) window._manageTaskIndex = 0;
                if (!window._manageTaskBtn) window._manageTaskBtn = 'open';

                function clearTaskFocus() {
                    taskItems.forEach(function(item) {
                        item.classList.remove('focused');
                        item.querySelectorAll('.manage-item-btn').forEach(function(btn) {
                            btn.classList.remove('focused');
                        });
                    });
                }

                function updateManageFocusIndicators() {
                    closeManage.classList.toggle('focused', window._manageFocusArea === 'close');
                    manageCategoryFilter.dataset.focused = window._manageFocusArea === 'category';
                    manageStatusFilter.dataset.focused = window._manageFocusArea === 'status';

                    clearTaskFocus();
                    if (window._manageFocusArea === 'list' && taskItems.length > 0) {
                        var idx = Math.min(window._manageTaskIndex, taskItems.length - 1);
                        window._manageTaskIndex = idx;
                        var item = taskItems[idx];
                        item.classList.add('focused');
                        var btn = item.querySelector('.manage-item-btn.' + window._manageTaskBtn);
                        if (btn) btn.classList.add('focused');
                        item.scrollIntoView({ block: 'nearest' });
                    }
                }

                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (window._manageFocusArea === 'category') {
                        window._manageFocusArea = 'close';
                    } else if (window._manageFocusArea === 'status') {
                        window._manageFocusArea = 'category';
                    } else if (window._manageFocusArea === 'list') {
                        if (window._manageTaskIndex > 0) {
                            window._manageTaskIndex--;
                        } else {
                            window._manageFocusArea = 'status';
                        }
                    }
                    updateManageFocusIndicators();
                    playSound('tick');
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (window._manageFocusArea === 'close') {
                        window._manageFocusArea = 'category';
                    } else if (window._manageFocusArea === 'category') {
                        window._manageFocusArea = 'status';
                    } else if (window._manageFocusArea === 'status') {
                        if (taskItems.length > 0) {
                            window._manageFocusArea = 'list';
                            window._manageTaskIndex = 0;
                        }
                    } else if (window._manageFocusArea === 'list') {
                        if (window._manageTaskIndex < taskItems.length - 1) {
                            window._manageTaskIndex++;
                        }
                    }
                    updateManageFocusIndicators();
                    playSound('tick');
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    if (window._manageFocusArea === 'category') {
                        const currentCat = categoryChips.findIndex(c => c.classList.contains('selected'));
                        const newCat = (currentCat - 1 + categoryChips.length) % categoryChips.length;
                        categoryChips[newCat].click();
                    } else if (window._manageFocusArea === 'status') {
                        const currentStatus = statusChips.findIndex(c => c.classList.contains('selected'));
                        const newStatus = (currentStatus - 1 + statusChips.length) % statusChips.length;
                        statusChips[newStatus].click();
                    } else if (window._manageFocusArea === 'list') {
                        // Cycle left: delete → edit → open
                        if (window._manageTaskBtn === 'delete') window._manageTaskBtn = 'edit';
                        else if (window._manageTaskBtn === 'edit') window._manageTaskBtn = 'open';
                        else window._manageTaskBtn = 'delete';
                        updateManageFocusIndicators();
                        playSound('tick');
                    }
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    if (window._manageFocusArea === 'category') {
                        const currentCat = categoryChips.findIndex(c => c.classList.contains('selected'));
                        const newCat = (currentCat + 1) % categoryChips.length;
                        categoryChips[newCat].click();
                    } else if (window._manageFocusArea === 'status') {
                        const currentStatus = statusChips.findIndex(c => c.classList.contains('selected'));
                        const newStatus = (currentStatus + 1) % statusChips.length;
                        statusChips[newStatus].click();
                    } else if (window._manageFocusArea === 'list') {
                        // Cycle right: open → edit → delete
                        if (window._manageTaskBtn === 'open') window._manageTaskBtn = 'edit';
                        else if (window._manageTaskBtn === 'edit') window._manageTaskBtn = 'delete';
                        else window._manageTaskBtn = 'open';
                        updateManageFocusIndicators();
                        playSound('tick');
                    }
                } else if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (window._manageFocusArea === 'close') {
                        closeManage.click();
                    } else if (window._manageFocusArea === 'list' && taskItems.length > 0) {
                        var idx = Math.min(window._manageTaskIndex, taskItems.length - 1);
                        var item = taskItems[idx];
                        var btn = item.querySelector('.manage-item-btn.' + window._manageTaskBtn);
                        if (btn) {
                            btn.click();
                            playSound('click');
                        }
                    }
                }
                return;
            }

            // Auth modal keyboard navigation
            if (!authModal.classList.contains('hidden')) {
                const authEmail = document.getElementById('auth-email');
                const otpCode = document.getElementById('otp-code');
                const closeAuth = document.getElementById('close-auth');
                const signinView = document.getElementById('auth-signin');
                const otpView = document.getElementById('auth-otp');
                const accountView = document.getElementById('auth-account');
                const migrateView = document.getElementById('auth-migrate');

                // Don't intercept when typing in inputs (except arrows)
                if ((document.activeElement === authEmail || document.activeElement === otpCode) && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
                    return;
                }

                if (!window._authFocusArea) window._authFocusArea = 'input';

                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (!signinView.classList.contains('hidden')) {
                        if (window._authFocusArea === 'input') {
                            window._authFocusArea = 'close';
                            authEmail.blur();
                        } else if (window._authFocusArea === 'button') {
                            window._authFocusArea = 'input';
                            authEmail.focus();
                        }
                    } else if (!otpView.classList.contains('hidden')) {
                        if (window._authFocusArea === 'input') {
                            window._authFocusArea = 'close';
                            otpCode.blur();
                        } else if (window._authFocusArea === 'button') {
                            window._authFocusArea = 'input';
                            otpCode.focus();
                        } else if (window._authFocusArea === 'button2') {
                            window._authFocusArea = 'button';
                        }
                    } else if (!accountView.classList.contains('hidden')) {
                        if (window._authFocusArea === 'button') {
                            window._authFocusArea = 'category';
                        } else if (window._authFocusArea === 'category') {
                            window._authFocusArea = 'period';
                        } else if (window._authFocusArea === 'period') {
                            window._authFocusArea = 'close';
                        }
                    } else if (!migrateView.classList.contains('hidden')) {
                        if (window._authFocusArea === 'button') {
                            window._authFocusArea = 'close';
                        } else if (window._authFocusArea === 'button2') {
                            window._authFocusArea = 'button';
                        }
                    }
                    updateAuthFocusIndicators();
                    playSound('tick');
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (!signinView.classList.contains('hidden')) {
                        if (window._authFocusArea === 'close') {
                            window._authFocusArea = 'input';
                            authEmail.focus();
                        } else if (window._authFocusArea === 'input') {
                            window._authFocusArea = 'button';
                            authEmail.blur();
                        }
                    } else if (!otpView.classList.contains('hidden')) {
                        if (window._authFocusArea === 'close') {
                            window._authFocusArea = 'input';
                            otpCode.focus();
                        } else if (window._authFocusArea === 'input') {
                            window._authFocusArea = 'button';
                            otpCode.blur();
                        } else if (window._authFocusArea === 'button') {
                            window._authFocusArea = 'button2';
                        }
                    } else if (!accountView.classList.contains('hidden')) {
                        if (window._authFocusArea === 'close') {
                            window._authFocusArea = 'period';
                        } else if (window._authFocusArea === 'period') {
                            window._authFocusArea = 'category';
                        } else if (window._authFocusArea === 'category') {
                            window._authFocusArea = 'button';
                        }
                    } else if (!migrateView.classList.contains('hidden')) {
                        if (window._authFocusArea === 'close') {
                            window._authFocusArea = 'button';
                        } else if (window._authFocusArea === 'button') {
                            window._authFocusArea = 'button2';
                        }
                    }
                    updateAuthFocusIndicators();
                    playSound('tick');
                } else if (e.key === 'ArrowLeft') {
                    if (!accountView.classList.contains('hidden')) {
                        e.preventDefault();
                        if (window._authFocusArea === 'period') {
                            var periodTabs = Array.from(document.querySelectorAll('.period-tab'));
                            var currentIdx = periodTabs.findIndex(function(t) { return t.classList.contains('selected'); });
                            var newIdx = (currentIdx - 1 + periodTabs.length) % periodTabs.length;
                            periodTabs[newIdx].click();
                        } else if (window._authFocusArea === 'category') {
                            var categoryChips = Array.from(document.querySelectorAll('#analytics-category .analytics-chip'));
                            var currentIdx = categoryChips.findIndex(function(c) { return c.classList.contains('selected'); });
                            var newIdx = (currentIdx - 1 + categoryChips.length) % categoryChips.length;
                            categoryChips[newIdx].click();
                        }
                    }
                } else if (e.key === 'ArrowRight') {
                    if (!accountView.classList.contains('hidden')) {
                        e.preventDefault();
                        if (window._authFocusArea === 'period') {
                            var periodTabs = Array.from(document.querySelectorAll('.period-tab'));
                            var currentIdx = periodTabs.findIndex(function(t) { return t.classList.contains('selected'); });
                            var newIdx = (currentIdx + 1) % periodTabs.length;
                            periodTabs[newIdx].click();
                        } else if (window._authFocusArea === 'category') {
                            var categoryChips = Array.from(document.querySelectorAll('#analytics-category .analytics-chip'));
                            var currentIdx = categoryChips.findIndex(function(c) { return c.classList.contains('selected'); });
                            var newIdx = (currentIdx + 1) % categoryChips.length;
                            categoryChips[newIdx].click();
                        }
                    }
                } else if (e.key === 'Enter' || e.key === ' ') {
                    if (window._authFocusArea === 'close') {
                        e.preventDefault();
                        playClick('select');
                        closeAuth.click();
                    } else if (window._authFocusArea === 'button') {
                        if (!signinView.classList.contains('hidden')) {
                            e.preventDefault();
                            playClick('select');
                            const btn = document.querySelector('#otp-email-form .btn-add');
                            btn.classList.add('active');
                            setTimeout(function() { btn.classList.remove('active'); }, 150);
                            document.getElementById('otp-email-form').requestSubmit();
                        } else if (!otpView.classList.contains('hidden')) {
                            e.preventDefault();
                            playClick('select');
                            const btn = document.querySelector('#otp-verify-form .btn-add');
                            btn.classList.add('active');
                            setTimeout(function() { btn.classList.remove('active'); }, 150);
                            document.getElementById('otp-verify-form').requestSubmit();
                        } else if (!accountView.classList.contains('hidden')) {
                            e.preventDefault();
                            playClick('select');
                            document.getElementById('sign-out').click();
                        } else if (!migrateView.classList.contains('hidden')) {
                            e.preventDefault();
                            playClick('select');
                            document.getElementById('migrate-yes').click();
                        }
                    } else if (window._authFocusArea === 'button2') {
                        if (!otpView.classList.contains('hidden')) {
                            e.preventDefault();
                            playClick('select');
                            document.getElementById('auth-back').click();
                        } else {
                            e.preventDefault();
                            playClick('select');
                            document.getElementById('migrate-no').click();
                        }
                    }
                }
                return;
            }
        });

        function updateAuthFocusIndicators() {
            const closeAuth = document.getElementById('close-auth');
            const authEmail = document.getElementById('auth-email');
            const otpCode = document.getElementById('otp-code');
            const emailSubmitBtn = document.querySelector('#otp-email-form .btn-add');
            const otpSubmitBtn = document.querySelector('#otp-verify-form .btn-add');
            const backBtn = document.getElementById('auth-back');
            const signOutBtn = document.getElementById('sign-out');
            const migrateYes = document.getElementById('migrate-yes');
            const migrateNo = document.getElementById('migrate-no');
            const analyticsPeriodTabs = document.querySelector('.analytics-period-tabs');
            const analyticsCategoryFilter = document.getElementById('analytics-category');

            // Clear all
            closeAuth.classList.remove('focused');
            if (authEmail) authEmail.classList.remove('focused');
            if (otpCode) otpCode.classList.remove('focused');
            if (emailSubmitBtn) emailSubmitBtn.classList.remove('focused');
            if (otpSubmitBtn) otpSubmitBtn.classList.remove('focused');
            if (backBtn) backBtn.classList.remove('focused');
            if (signOutBtn) signOutBtn.classList.remove('focused');
            if (migrateYes) migrateYes.classList.remove('focused');
            if (migrateNo) migrateNo.classList.remove('focused');
            if (analyticsPeriodTabs) analyticsPeriodTabs.dataset.focused = 'false';
            if (analyticsCategoryFilter) analyticsCategoryFilter.dataset.focused = 'false';

            if (window._authFocusArea === 'close') {
                closeAuth.classList.add('focused');
            } else if (window._authFocusArea === 'input') {
                const signinView = document.getElementById('auth-signin');
                const otpView = document.getElementById('auth-otp');
                if (!signinView.classList.contains('hidden') && authEmail) {
                    authEmail.classList.add('focused');
                } else if (!otpView.classList.contains('hidden') && otpCode) {
                    otpCode.classList.add('focused');
                }
            } else if (window._authFocusArea === 'button') {
                const signinView = document.getElementById('auth-signin');
                const otpView = document.getElementById('auth-otp');
                const accountView = document.getElementById('auth-account');
                const migrateView = document.getElementById('auth-migrate');

                if (!signinView.classList.contains('hidden') && emailSubmitBtn) {
                    emailSubmitBtn.classList.add('focused');
                } else if (!otpView.classList.contains('hidden') && otpSubmitBtn) {
                    otpSubmitBtn.classList.add('focused');
                } else if (!accountView.classList.contains('hidden') && signOutBtn) {
                    signOutBtn.classList.add('focused');
                } else if (!migrateView.classList.contains('hidden') && migrateYes) {
                    migrateYes.classList.add('focused');
                }
            } else if (window._authFocusArea === 'button2') {
                const otpView = document.getElementById('auth-otp');
                if (!otpView.classList.contains('hidden') && backBtn) {
                    backBtn.classList.add('focused');
                } else if (migrateNo) {
                    migrateNo.classList.add('focused');
                }
            } else if (window._authFocusArea === 'period') {
                if (analyticsPeriodTabs) analyticsPeriodTabs.dataset.focused = 'true';
            } else if (window._authFocusArea === 'category') {
                if (analyticsCategoryFilter) analyticsCategoryFilter.dataset.focused = 'true';
            }
        }

        // Reset manage modal focus when opening
        const originalOpenManageModal = openManageModal;
        openManageModal = function() {
            window._manageFocusArea = 'category';
            window._manageTaskIndex = 0;
            window._manageTaskBtn = 'open';
            closeManage.classList.remove('focused');
            originalOpenManageModal();
        };

        // Global fallback: click any focused button/element on Enter
        // (but not when task view is visible - that has its own handler)
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                // Skip if task view is handling this
                if (!taskView.classList.contains('hidden')) return;
                const focused = document.querySelector('.focused');
                if (focused && focused.tagName === 'BUTTON') {
                    e.preventDefault();
                    playClick('select');
                    focused.click();
                }
            }
        });

        // Clear keyboard focus indicators when mouse clicks
        document.addEventListener('mousedown', function() {
            document.querySelectorAll('.focused').forEach(function(el) {
                el.classList.remove('focused');
            });
        }, { passive: true });

        // Clear any lingering focus/selection states when arrow keys are used
        document.addEventListener('keydown', function(e) {
            if (e.key.startsWith('Arrow')) {
                // Blur any focused element to remove native focus outline
                if (document.activeElement && document.activeElement !== document.body) {
                    document.activeElement.blur();
                }
            }
        }, { passive: true });

        // Clear focus when hovering over corner buttons
        [authToggle, themeToggleBtn, soundToggleBtn, manageToggle, addToggle].forEach(function(btn) {
            if (btn) {
                btn.addEventListener('mouseenter', function() {
                    this.classList.remove('focused');
                });
            }
        });

        // Clear data-focused on category wheels when hovering
        document.querySelectorAll('.wheel-item').forEach(function(item) {
            item.addEventListener('mouseenter', function() {
                var wheel = this.closest('.category-wheel, .add-category-wheel');
                if (wheel) {
                    wheel.dataset.focused = 'false';
                }
            });
        });

        // Clear data-focused on time options when hovering
        document.querySelectorAll('.time-chip').forEach(function(chip) {
            chip.addEventListener('mouseenter', function() {
                var wrap = this.closest('.time-options-wrap');
                if (wrap) {
                    wrap.dataset.focused = 'false';
                }
            });
        });

        // Clear manage list keyboard focus when hovering over items
        manageList.addEventListener('mouseover', function(e) {
            var item = e.target.closest('.manage-item');
            if (item) {
                manageList.querySelectorAll('.manage-item').forEach(function(i) {
                    i.classList.remove('focused');
                    i.querySelectorAll('.manage-item-btn').forEach(function(btn) {
                        btn.classList.remove('focused');
                    });
                });
            }
        });
    }

    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(function() {});
        }
    }

    function showView(view) {
        promptView.classList.add('hidden');
        taskView.classList.add('hidden');
        emptyView.classList.add('hidden');
        view.classList.remove('hidden');

        // Hide add hint when not on prompt view
        const addHint = document.getElementById('add-hint');
        if (addHint && view !== promptView) {
            addHint.classList.add('hidden');
        }
    }

    function pickTask() {
        // Stop any running timer
        stopTimer();

        const category = pickerCategory.dataset.value;
        const maxTime = parseInt(pickerTime.dataset.value, 10);

        let tasks = TaskStorage.getTasks().filter(t => !t.completed);

        if (category !== 'all') {
            tasks = tasks.filter(t => t.category === category);
        }

        if (maxTime > 0) {
            tasks = tasks.filter(t => t.timeEstimate <= maxTime);
        }

        if (tasks.length === 0) {
            playSound('delete');
            showToast('No tasks match. Try a different category or time.', 'info');
            return;
        }

        const randomIndex = Math.floor(Math.random() * tasks.length);
        currentTask = tasks[randomIndex];

        // Show category icon
        taskCategoryIcon.innerHTML = categoryIcons[currentTask.category] || categoryIcons.other;

        // Show time limit if applicable
        if (currentTask.timeEstimate > 0) {
            taskTimeLimit.textContent = formatTime(currentTask.timeEstimate);
            timerLimit = currentTask.timeEstimate * 60; // Convert to seconds
            startBtn.classList.remove('hidden');
        } else {
            taskTimeLimit.textContent = '';
            timerLimit = 0;
            startBtn.classList.add('hidden');
        }

        // Reset timer display
        timerStartTime = null;
        timerDisplay.textContent = '00:00';
        taskTimer.classList.add('hidden');
        taskTimer.classList.remove('running', 'warning', 'overtime');

        taskTitle.textContent = currentTask.title;

        playSound('click');
        showView(taskView);

        // Reset keyboard focus for task view
        if (window._taskViewFocusReset) {
            window._taskViewFocusReset();
        }
    }

    function openTaskById(taskId) {
        // Stop any running timer
        stopTimer();

        // Find the task
        const task = TaskStorage.getTasks().find(function(t) { return t.id === taskId; });
        if (!task) return;

        currentTask = task;

        // Close manage modal
        closeManageModal();

        // Show category icon
        taskCategoryIcon.innerHTML = categoryIcons[currentTask.category] || categoryIcons.other;

        // Show time limit if applicable
        if (currentTask.timeEstimate > 0) {
            taskTimeLimit.textContent = formatTime(currentTask.timeEstimate);
            timerLimit = currentTask.timeEstimate * 60;
            startBtn.classList.remove('hidden');
        } else {
            taskTimeLimit.textContent = '';
            timerLimit = 0;
            startBtn.classList.add('hidden');
        }

        // Reset timer display
        timerStartTime = null;
        timerDisplay.textContent = '00:00';
        taskTimer.classList.add('hidden');
        taskTimer.classList.remove('running', 'warning', 'overtime');

        taskTitle.textContent = currentTask.title;

        // Show/hide buttons based on completion status
        if (currentTask.completed) {
            doneBtn.classList.add('hidden');
            skipBtn.classList.add('hidden');
            resetBtn.classList.remove('hidden');
            startBtn.classList.add('hidden');
        } else {
            doneBtn.classList.remove('hidden');
            skipBtn.classList.remove('hidden');
            resetBtn.classList.add('hidden');
        }

        playSound('click');
        showView(taskView);

        // Reset keyboard focus for task view
        if (window._taskViewFocusReset) {
            window._taskViewFocusReset();
        }
    }

    function skipTask() {
        stopTimer();
        playSound('tick');
        pickTask();
    }

    function closeTask() {
        stopTimer();
        currentTask = null;
        playSound('close');
        showView(promptView);
    }

    function completeTask() {
        stopTimer();
        if (currentTask) {
            TaskStorage.toggleComplete(currentTask.id);
            currentTask = null;
        }
        celebrate();
        showView(promptView);
        updatePickButton();
        checkSignupPrompt();
    }

    function checkSignupPrompt() {
        // Don't show if already authenticated
        if (typeof Auth !== 'undefined' && Auth.isAuthenticated()) return;

        // Count completed tasks
        const tasks = TaskStorage.getTasks();
        const completedCount = tasks.filter(function(t) { return t.completed; }).length;

        // Get thresholds from config (fallback to defaults)
        var thresholds = (typeof Payments !== 'undefined')
            ? Payments.getNudgeCompletedThresholds()
            : [3, 10];

        // Check thresholds (highest first)
        var threshold = null;
        for (var i = thresholds.length - 1; i >= 0; i--) {
            var t = thresholds[i];
            if (completedCount >= t && !localStorage.getItem('taskman-signup-dismissed-completed-' + t)) {
                threshold = t;
                break;
            }
        }

        if (threshold) {
            setTimeout(function() {
                showSignupPrompt(completedCount, 'completed', threshold);
            }, 1500); // Delay to let celebration finish
        }
    }

    function showSignupPrompt(count, type, threshold) {
        // Re-check conditions after delay
        if (typeof Auth !== 'undefined' && Auth.isAuthenticated()) return;
        var dismissKey = 'taskman-signup-dismissed-' + type + '-' + threshold;
        if (localStorage.getItem(dismissKey)) return;

        const prompt = document.getElementById('signup-prompt');
        if (!prompt || !prompt.classList.contains('hidden')) return;

        // Store current type and threshold for dismissal
        prompt.dataset.promptType = type;
        prompt.dataset.promptThreshold = threshold;

        const verbEl = document.getElementById('signup-prompt-verb');
        const countEl = document.getElementById('signup-prompt-count');
        if (verbEl) verbEl.textContent = type === 'added' ? 'added' : 'completed';
        if (countEl) countEl.textContent = count;
        prompt.classList.remove('hidden');
        window._signupFocusArea = 'yes'; // Reset focus to Yes button
        playSound('open');
    }

    function closeSignupPrompt() {
        document.getElementById('signup-prompt').classList.add('hidden');
        playSound('close');
    }

    function dismissSignupPrompt() {
        var prompt = document.getElementById('signup-prompt');
        var type = prompt.dataset.promptType || 'completed';
        var threshold = prompt.dataset.promptThreshold || '3';
        localStorage.setItem('taskman-signup-dismissed-' + type + '-' + threshold, 'true');
        closeSignupPrompt();
    }

    function celebrate() {
        // Change rainbow colors on task completion
        if (getCurrentTheme() === 'rainbow') {
            randomizeRainbow();
        }

        // Create burst effect
        const burst = document.createElement('div');
        burst.className = 'celebration-burst';
        document.body.appendChild(burst);

        // Create confetti
        const colors = ['#22c55e', '#4ade80', '#86efac', '#fbbf24', '#60a5fa'];
        const celebration = document.createElement('div');
        celebration.className = 'celebration';

        for (let i = 0; i < 30; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.top = '-10px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            confetti.style.animation = `confetti-fall ${1 + Math.random() * 1}s ease-out forwards`;
            confetti.style.animationDelay = Math.random() * 0.3 + 's';
            celebration.appendChild(confetti);
        }

        document.body.appendChild(celebration);

        // Play celebration sound
        playClick('select');

        // Clean up after animation
        setTimeout(function() {
            burst.remove();
            celebration.remove();
        }, 2000);
    }

    // Timer functions
    function startTimer() {
        if (timerInterval) return; // Already running

        // Store start time
        timerStartTime = Date.now();

        // Hide start button, show timer
        startBtn.classList.add('hidden');
        taskTimer.classList.remove('hidden');
        taskTimer.classList.add('running');

        playSound('click');

        timerInterval = setInterval(function() {
            updateTimerDisplay();
        }, 1000);
    }

    function getElapsedSeconds() {
        if (!timerStartTime) return 0;
        return Math.floor((Date.now() - timerStartTime) / 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function resetTimer() {
        stopTimer();
        timerStartTime = Date.now();
        updateTimerDisplay();
        taskTimer.classList.remove('warning', 'overtime');
        taskTimer.classList.add('running');

        playSound('click');

        // Restart the timer
        timerInterval = setInterval(function() {
            updateTimerDisplay();
        }, 1000);
    }

    function updateTimerDisplay() {
        const elapsed = getElapsedSeconds();
        const hours = Math.floor(elapsed / 3600);
        const mins = Math.floor((elapsed % 3600) / 60);
        const secs = elapsed % 60;

        if (hours > 0) {
            timerDisplay.textContent = String(hours).padStart(2, '0') + ':' +
                                        String(mins).padStart(2, '0') + ':' +
                                        String(secs).padStart(2, '0');
        } else {
            timerDisplay.textContent = String(mins).padStart(2, '0') + ':' +
                                        String(secs).padStart(2, '0');
        }

        // Check for warning (80% of time limit) and overtime
        if (timerLimit > 0) {
            const warningThreshold = timerLimit * 0.8;
            if (elapsed >= timerLimit) {
                taskTimer.classList.remove('warning');
                taskTimer.classList.add('overtime');
            } else if (elapsed >= warningThreshold) {
                taskTimer.classList.add('warning');
            }
        }
    }

    // Add Modal
    function openAddModal() {
        addModal.classList.remove('hidden');
        // Focus the text input
        addFocusArea = 'input';
        addCategory.dataset.focused = 'false';
        taskInput.classList.add('focused');
        taskInput.focus();
        addTime.dataset.focused = 'false';
        const addBtnEl = taskForm.querySelector('.btn-add');
        if (addBtnEl) addBtnEl.classList.remove('focused');
        playSound('open');
    }

    function closeAddModal() {
        addModal.classList.add('hidden');
        taskForm.reset();
        playSound('close');
        // If we were on empty view, go back to prompt view since we may have added tasks
        if (!emptyView.classList.contains('hidden')) {
            showView(promptView);
        }
    }

    function addTask(e) {
        e.preventDefault();
        const title = taskInput.value.trim();
        if (!title) return;

        TaskStorage.saveTask({
            title: title,
            category: addCategory.dataset.value,
            timeEstimate: parseInt(addTime.dataset.value, 10)
        });

        taskInput.value = '';
        // Keep category selected for adding multiple tasks

        // Show toast
        showToast('Task added');
        playSound('success');

        // Update pick button state
        updatePickButton();

        // Show signup prompt after tasks added (if not logged in)
        if (typeof Auth === 'undefined' || !Auth.isAuthenticated()) {
            const totalTasks = TaskStorage.getTasks().length;

            // Get thresholds from config (fallback to defaults)
            var thresholds = (typeof Payments !== 'undefined')
                ? Payments.getNudgeAddedThresholds()
                : [5, 15];

            // Check thresholds (highest first)
            var threshold = null;
            for (var i = thresholds.length - 1; i >= 0; i--) {
                var t = thresholds[i];
                if (totalTasks >= t && !localStorage.getItem('taskman-signup-dismissed-added-' + t)) {
                    threshold = t;
                    break;
                }
            }

            if (threshold) {
                setTimeout(function() {
                    showSignupPrompt(totalTasks, 'added', threshold);
                }, 500);
            }
        }
    }

    function showToast(message, type) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('info');
        if (type === 'info') {
            toast.classList.add('info');
        }
        toast.classList.add('show');
        setTimeout(function() {
            toast.classList.remove('show');
        }, 1500);
    }

    // Manage Modal
    function openManageModal() {
        manageModal.classList.remove('hidden');
        renderManageList();
        playSound('open');
    }

    function closeManageModal() {
        manageModal.classList.add('hidden');
        playSound('close');
    }

    function renderManageList() {
        let tasks = TaskStorage.getTasks();

        // Filter by category
        if (manageCategoryValue !== 'all') {
            tasks = tasks.filter(t => t.category === manageCategoryValue);
        }

        // Filter by status
        if (manageStatusValue === 'active') {
            tasks = tasks.filter(t => !t.completed);
        } else if (manageStatusValue === 'completed') {
            tasks = tasks.filter(t => t.completed);
        }

        // Sort: active tasks first, then completed
        tasks.sort(function(a, b) {
            if (a.completed === b.completed) return 0;
            return a.completed ? 1 : -1;
        });

        // Check if there are completed tasks to show delete all button
        const allTasks = TaskStorage.getTasks();
        const completedCount = allTasks.filter(t => t.completed).length;
        updateDeleteAllButton(completedCount);

        if (tasks.length === 0) {
            manageList.innerHTML = '';
            manageEmpty.classList.remove('hidden');
            return;
        }

        manageEmpty.classList.add('hidden');
        manageList.innerHTML = tasks.map(renderManageItem).join('');
    }

    function updateDeleteAllButton(completedCount) {
        const deleteAllBtn = document.getElementById('delete-all-btn');
        if (completedCount > 0) {
            deleteAllBtn.classList.remove('hidden');
            deleteAllBtn.textContent = 'Delete ' + completedCount + ' completed';
        } else {
            deleteAllBtn.classList.add('hidden');
        }
    }

    function deleteAllCompleted() {
        const tasks = TaskStorage.getTasks();
        const completedIds = tasks.filter(t => t.completed).map(t => t.id);
        completedIds.forEach(function(id) {
            TaskStorage.deleteTask(id);
        });
        playSound('delete');
        renderManageList();
        updatePickButton();
    }

    function renderManageItem(task) {
        return `
            <div class="manage-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <div class="manage-item-content">
                    <div class="manage-item-title">${escapeHtml(task.title)}</div>
                    <div class="manage-item-meta">${task.category} · ${formatTime(task.timeEstimate)}</div>
                </div>
                <div class="manage-item-actions">
                    <button class="manage-item-btn open" title="Open">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                    </button>
                    <button class="manage-item-btn edit" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="manage-item-btn delete" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    function handleManageAction(e) {
        const btn = e.target.closest('.manage-item-btn');
        if (!btn) return;

        const item = btn.closest('.manage-item');
        const taskId = item.dataset.id;

        if (btn.classList.contains('open')) {
            openTaskById(taskId);
        } else if (btn.classList.contains('edit')) {
            startEdit(item, taskId);
        } else if (btn.classList.contains('delete')) {
            deleteTaskById(taskId);
        }
    }

    function startEdit(item, taskId) {
        const titleEl = item.querySelector('.manage-item-title');
        const currentTitle = titleEl.textContent;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-input';
        input.value = currentTitle;

        titleEl.style.display = 'none';
        titleEl.parentNode.insertBefore(input, titleEl);
        input.focus();
        input.select();

        function saveEdit() {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== currentTitle) {
                TaskStorage.updateTask(taskId, { title: newTitle });
            }
            renderManageList();
        }

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                renderManageList();
            }
        });
    }

    function deleteTaskById(taskId) {
        TaskStorage.deleteTask(taskId);
        playSound('delete');
        renderManageList();
        updatePickButton();
    }

    function formatTime(minutes) {
        if (minutes < 60) return minutes + ' min';
        if (minutes === 60) return '1 hour';
        if (minutes < 240) return (minutes / 60) + ' hours';
        return '4+ hours';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
