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

    async function sendOtp(email, captchaToken) {
        const client = getSupabase();
        if (!client) throw new Error('Supabase not configured');

        const options = {
            shouldCreateUser: true
        };

        // Add captcha token if provided
        if (captchaToken) {
            options.captchaToken = captchaToken;
        }

        const { error } = await client.auth.signInWithOtp({
            email: email,
            options: options
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

    function isWalletAvailable() {
        // AppKit supports all wallets via WalletConnect, always available if configured
        return !!Config.REOWN_PROJECT_ID;
    }

    async function signInWithWallet() {
        const client = getSupabase();
        if (!client) throw new Error('Supabase not configured');

        if (!window.WalletKit) {
            throw new Error('Wallet module not loaded');
        }

        // Initialize wallet if not already done
        const modal = window.WalletKit.getModal() || window.WalletKit.initWallet(Config.REOWN_PROJECT_ID);
        if (!modal) {
            throw new Error('WalletConnect not configured. Please set REOWN_PROJECT_ID in config.');
        }

        // Open the wallet modal and wait for connection
        return new Promise(function(resolve, reject) {
            let unsubscribe = null;
            let resolved = false;

            // Subscribe to state changes to detect connection
            unsubscribe = modal.subscribeState(async function(state) {
                if (resolved) return;

                if (state.address && state.selectedNetworkId) {
                    resolved = true;
                    if (unsubscribe) unsubscribe();

                    try {
                        // Get the provider from AppKit
                        const provider = modal.getWalletProvider();
                        if (!provider) {
                            throw new Error('No wallet provider available');
                        }

                        const address = state.address;

                        // Get nonce from server
                        const nonceResponse = await fetch(
                            Config.SUPABASE_URL + '/functions/v1/siwe-nonce',
                            {
                                method: 'POST',
                                headers: {
                                    'Authorization': 'Bearer ' + Config.SUPABASE_ANON_KEY,
                                    'apikey': Config.SUPABASE_ANON_KEY,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ address: address })
                            }
                        );

                        if (!nonceResponse.ok) {
                            throw new Error('Failed to get nonce');
                        }

                        const { nonce } = await nonceResponse.json();

                        // Create SIWE message
                        const domain = window.location.host;
                        const origin = window.location.origin;
                        const statement = 'Sign in to Taskman with your Ethereum wallet.';
                        const issuedAt = new Date().toISOString();

                        const message = [
                            domain + ' wants you to sign in with your Ethereum account:',
                            address,
                            '',
                            statement,
                            '',
                            'URI: ' + origin,
                            'Version: 1',
                            'Chain ID: 1',
                            'Nonce: ' + nonce,
                            'Issued At: ' + issuedAt
                        ].join('\n');

                        // Sign the message using the provider
                        const signature = await provider.request({
                            method: 'personal_sign',
                            params: [message, address]
                        });

                        // Verify signature and get session
                        const verifyResponse = await fetch(
                            Config.SUPABASE_URL + '/functions/v1/siwe-verify',
                            {
                                method: 'POST',
                                headers: {
                                    'Authorization': 'Bearer ' + Config.SUPABASE_ANON_KEY,
                                    'apikey': Config.SUPABASE_ANON_KEY,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    message: message,
                                    signature: signature,
                                    address: address
                                })
                            }
                        );

                        if (!verifyResponse.ok) {
                            const error = await verifyResponse.json();
                            throw new Error(error.error || 'Failed to verify signature');
                        }

                        const { token_hash } = await verifyResponse.json();

                        // Use the token hash to verify and create session
                        const { error } = await client.auth.verifyOtp({
                            token_hash: token_hash,
                            type: 'magiclink'
                        });

                        if (error) throw error;
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                }
            });

            // Open the modal
            modal.open();
        });
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
        signInWithWallet: signInWithWallet,
        isWalletAvailable: isWalletAvailable,
        signOut: signOut,
        onAuthStateChange: onAuthStateChange,
        getUser: getUser,
        isAuthenticated: isAuthenticated
    };
})();
