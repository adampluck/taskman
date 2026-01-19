const SpeechInput = (function() {
    let recognition = null;
    let isListening = false;
    let onResultCallback = null;
    let onErrorCallback = null;
    let onEndCallback = null;

    function isSupported() {
        return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    }

    function init() {
        if (!isSupported()) {
            console.warn('Speech recognition not supported in this browser');
            return false;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            if (onResultCallback) {
                onResultCallback(transcript);
            }
        };

        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            isListening = false;
            if (onErrorCallback) {
                onErrorCallback(event.error);
            }
        };

        recognition.onend = function() {
            isListening = false;
            if (onEndCallback) {
                onEndCallback();
            }
        };

        return true;
    }

    function startListening() {
        if (!recognition) {
            if (!init()) {
                return false;
            }
        }

        if (isListening) {
            stopListening();
            return false;
        }

        try {
            recognition.start();
            isListening = true;
            return true;
        } catch (e) {
            console.error('Error starting speech recognition:', e);
            return false;
        }
    }

    function stopListening() {
        if (recognition && isListening) {
            recognition.stop();
            isListening = false;
        }
    }

    function onResult(callback) {
        onResultCallback = callback;
    }

    function onError(callback) {
        onErrorCallback = callback;
    }

    function onEnd(callback) {
        onEndCallback = callback;
    }

    function getIsListening() {
        return isListening;
    }

    return {
        isSupported,
        init,
        startListening,
        stopListening,
        onResult,
        onError,
        onEnd,
        getIsListening
    };
})();
