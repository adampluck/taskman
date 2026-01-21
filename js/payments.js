/**
 * Payments Module
 * Handles subscription status, payment limits, and Stripe checkout
 */
const Payments = (function() {
    let subscriptionStatus = null;
    let statusListeners = [];

    /**
     * Fetch subscription status from Supabase
     */
    async function fetchStatus() {
        const client = getSupabase();
        if (!client) {
            subscriptionStatus = { payments_enabled: false, tier: 'pro' };
            return subscriptionStatus;
        }

        // Check if user is authenticated
        if (typeof Auth === 'undefined' || !Auth.isAuthenticated()) {
            subscriptionStatus = { payments_enabled: false, tier: 'pro' };
            return subscriptionStatus;
        }

        try {
            const { data, error } = await client.rpc('get_user_subscription_status');
            if (error) throw error;
            subscriptionStatus = data;
            notifyListeners();
            return subscriptionStatus;
        } catch (e) {
            console.error('Failed to fetch subscription status:', e);
            // Default to allowing access on error (fail open)
            subscriptionStatus = { payments_enabled: false, tier: 'pro' };
            return subscriptionStatus;
        }
    }

    /**
     * Get current subscription status
     */
    function getStatus() {
        return subscriptionStatus;
    }

    /**
     * Check if payments feature is enabled
     */
    function isPaymentsEnabled() {
        if (!subscriptionStatus) return false;
        return subscriptionStatus.payments_enabled === true;
    }

    /**
     * Check if user has Pro tier
     */
    function isProUser() {
        if (!subscriptionStatus) return true; // Fail open
        if (!subscriptionStatus.payments_enabled) return true;
        return subscriptionStatus.tier === 'pro';
    }

    /**
     * Check if user can sync more tasks
     */
    function canSyncMoreTasks() {
        if (!subscriptionStatus) return true;
        if (!subscriptionStatus.payments_enabled) return true;
        if (subscriptionStatus.tier === 'pro') return true;
        return subscriptionStatus.tasks_synced < subscriptionStatus.task_limit;
    }

    /**
     * Get number of remaining sync slots
     */
    function getRemainingTasks() {
        if (!subscriptionStatus || !subscriptionStatus.payments_enabled) return null;
        if (subscriptionStatus.tier === 'pro') return null;
        return Math.max(0, subscriptionStatus.task_limit - subscriptionStatus.tasks_synced);
    }

    /**
     * Get task limit for free tier
     */
    function getTaskLimit() {
        if (!subscriptionStatus || !subscriptionStatus.payments_enabled) return null;
        return subscriptionStatus.task_limit;
    }

    /**
     * Get number of synced tasks
     */
    function getSyncedTaskCount() {
        if (!subscriptionStatus) return 0;
        return subscriptionStatus.tasks_synced || 0;
    }

    /**
     * Initiate Stripe checkout
     */
    async function initiateCheckout() {
        const client = getSupabase();
        if (!client) throw new Error('Supabase not configured');

        const { data: { session } } = await client.auth.getSession();
        if (!session) throw new Error('Must be signed in');

        const response = await fetch(
            Config.SUPABASE_URL + '/functions/v1/create-checkout-session',
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + session.access_token,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ origin: window.location.origin }),
            }
        );

        const data = await response.json();
        if (data.error) throw new Error(data.error);
        if (data.url) {
            window.location.href = data.url;
        }
    }

    /**
     * Register a listener for subscription status changes
     */
    function onStatusChange(callback) {
        statusListeners.push(callback);
        return function() {
            statusListeners = statusListeners.filter(function(cb) {
                return cb !== callback;
            });
        };
    }

    /**
     * Notify all listeners of status change
     */
    function notifyListeners() {
        statusListeners.forEach(function(cb) {
            cb(subscriptionStatus);
        });
    }

    /**
     * Handle payment result from URL params (after Stripe redirect)
     */
    function handlePaymentResult() {
        var params = new URLSearchParams(window.location.search);
        var paymentResult = params.get('payment');

        if (paymentResult) {
            // Clean URL
            history.replaceState(null, '', window.location.pathname);

            if (paymentResult === 'success') {
                // Refresh status
                fetchStatus();
                return 'success';
            } else if (paymentResult === 'cancelled') {
                return 'cancelled';
            }
        }
        return null;
    }

    /**
     * Increment local task count (used after syncing a new task)
     */
    function incrementTaskCount() {
        if (subscriptionStatus && typeof subscriptionStatus.tasks_synced === 'number') {
            subscriptionStatus.tasks_synced++;
            notifyListeners();
        }
    }

    /**
     * Decrement local task count (used after deleting a synced task)
     */
    function decrementTaskCount() {
        if (subscriptionStatus && typeof subscriptionStatus.tasks_synced === 'number') {
            subscriptionStatus.tasks_synced = Math.max(0, subscriptionStatus.tasks_synced - 1);
            notifyListeners();
        }
    }

    return {
        fetchStatus: fetchStatus,
        getStatus: getStatus,
        isPaymentsEnabled: isPaymentsEnabled,
        isProUser: isProUser,
        canSyncMoreTasks: canSyncMoreTasks,
        getRemainingTasks: getRemainingTasks,
        getTaskLimit: getTaskLimit,
        getSyncedTaskCount: getSyncedTaskCount,
        initiateCheckout: initiateCheckout,
        onStatusChange: onStatusChange,
        handlePaymentResult: handlePaymentResult,
        incrementTaskCount: incrementTaskCount,
        decrementTaskCount: decrementTaskCount
    };
})();
