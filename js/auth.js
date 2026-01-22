const Auth = (function() {
    let currentUser = null;
    let authStateListeners = [];

    async function init() {
        const client = getSupabase();
        if (!client) return;

        // Set up listener FIRST so we catch auth from URL hash
        client.auth.onAuthStateChange(function(event, session) {
            if (event === 'SIGNED_IN' && session) {
                currentUser = session.user;
                notifyListeners('SIGNED_IN', currentUser);
                // Clean up URL hash after successful auth
                if (window.location.hash.includes('access_token')) {
                    history.replaceState(null, '', window.location.pathname);
                }
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                notifyListeners('SIGNED_OUT', null);
            }
        });

        // Now check for existing session (triggers listener if found)
        const { data: { session } } = await client.auth.getSession();
        if (session && !currentUser) {
            currentUser = session.user;
            notifyListeners('SIGNED_IN', currentUser);
        }
    }

    async function sendOtp(email) {
        const client = getSupabase();
        if (!client) throw new Error('Supabase not configured');

        const { error } = await client.auth.signInWithOtp({
            email: email,
            options: {
                shouldCreateUser: true
            }
        });

        if (error) throw error;
        return { success: true };
    }

    async function verifyOtp(email, token) {
        const client = getSupabase();
        if (!client) throw new Error('Supabase not configured');

        const { data, error } = await client.auth.verifyOtp({
            email: email,
            token: token,
            type: 'email'
        });

        if (error) throw error;
        return data;
    }

    async function signInWithPasskey() {
        const client = getSupabase();
        if (!client) throw new Error('Supabase not configured');

        if (!window.PublicKeyCredential) {
            throw new Error('Passkeys not supported on this device');
        }

        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!available) {
            throw new Error('No passkey authenticator available');
        }

        const { data, error } = await client.auth.signInWithPasskey();
        if (error) throw error;
        return data;
    }

    async function registerPasskey() {
        const client = getSupabase();
        if (!client) throw new Error('Supabase not configured');
        if (!currentUser) throw new Error('Must be signed in to register passkey');

        const { error } = await client.auth.enrollPasskey({
            friendlyName: 'Taskman Passkey'
        });

        if (error) throw error;
    }

    async function signInWithGoogle() {
        const client = getSupabase();
        if (!client) throw new Error('Supabase not configured');

        const { error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });

        if (error) throw error;
    }

    async function signOut() {
        const client = getSupabase();
        if (!client) return;

        const { error } = await client.auth.signOut();
        if (error) throw error;
    }

    function onAuthStateChange(callback) {
        authStateListeners.push(callback);
        return function() {
            authStateListeners = authStateListeners.filter(function(cb) {
                return cb !== callback;
            });
        };
    }

    function notifyListeners(event, user) {
        authStateListeners.forEach(function(cb) {
            cb(event, user);
        });
    }

    function getUser() {
        return currentUser;
    }

    function isAuthenticated() {
        return currentUser !== null;
    }

    function isPasskeySupported() {
        return window.PublicKeyCredential !== undefined;
    }

    async function checkPasskeyAvailable() {
        if (!isPasskeySupported()) return false;
        try {
            return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch (e) {
            return false;
        }
    }

    return {
        init: init,
        sendOtp: sendOtp,
        verifyOtp: verifyOtp,
        signInWithGoogle: signInWithGoogle,
        signOut: signOut,
        onAuthStateChange: onAuthStateChange,
        getUser: getUser,
        isAuthenticated: isAuthenticated
    };
})();
