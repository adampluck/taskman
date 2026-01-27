// Voice Input Module - AssemblyAI streaming transcription
const VoiceInput = (function() {
    let ws = null;
    let mediaStream = null;
    let audioContext = null;
    let workletNode = null;
    let isListening = false;

    const callbacks = {
        onResult: null,
        onStart: null,
        onEnd: null,
        onError: null
    };

    function isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    function getTokenEndpoint() {
        if (typeof Config !== 'undefined' && Config.VOICE_TOKEN_ENDPOINT) {
            return Config.VOICE_TOKEN_ENDPOINT;
        }
        return '/api/assemblyai-token'; // Default for local dev
    }

    async function getTemporaryToken() {
        const endpoint = getTokenEndpoint();
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error('Failed to get token: ' + response.status);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        return data.token;
    }

    async function start() {
        if (!isSupported()) {
            if (callbacks.onError) callbacks.onError('not-supported');
            return false;
        }

        try {
            // Get temporary token from server proxy
            const token = await getTemporaryToken();

            // Get microphone access
            mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            // Create audio context at 16kHz
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });

            const source = audioContext.createMediaStreamSource(mediaStream);

            // Connect WebSocket with token (v3 Universal Streaming)
            const wsUrl = `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&encoding=pcm_s16le&token=${token}`;
            ws = new WebSocket(wsUrl);

            ws.onopen = function() {
                isListening = true;
                if (callbacks.onStart) callbacks.onStart();
                startAudioProcessing(source);
            };

            ws.onmessage = function(event) {
                const data = JSON.parse(event.data);

                // v3 Universal Streaming message types
                if (data.type === 'Turn') {
                    const transcript = data.transcript || '';
                    const isFinal = data.end_of_turn === true;

                    if (transcript && callbacks.onResult) {
                        callbacks.onResult(transcript, isFinal);
                    }
                } else if (data.type === 'Begin') {
                    console.log('AssemblyAI session started');
                } else if (data.type === 'Termination') {
                    cleanup();
                } else if (data.error) {
                    console.error('AssemblyAI error:', data.error);
                    if (callbacks.onError) callbacks.onError('transcription-error');
                    cleanup();
                }
            };

            ws.onerror = function(err) {
                console.error('WebSocket error:', err);
                if (callbacks.onError) callbacks.onError('connection-error');
                cleanup();
            };

            ws.onclose = function() {
                if (isListening) {
                    cleanup();
                }
            };

            return true;
        } catch (err) {
            console.error('Voice start error:', err);
            if (err.name === 'NotAllowedError') {
                if (callbacks.onError) callbacks.onError('not-allowed');
            } else if (err.name === 'NotFoundError') {
                if (callbacks.onError) callbacks.onError('no-microphone');
            } else if (err.message && err.message.includes('token')) {
                if (callbacks.onError) callbacks.onError('token-error');
            } else {
                if (callbacks.onError) callbacks.onError('start-error');
            }
            cleanup();
            return false;
        }
    }

    function startAudioProcessing(source) {
        // Use ScriptProcessorNode (deprecated but widely supported)
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = function(e) {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;

            const inputData = e.inputBuffer.getChannelData(0);

            // Convert float32 to int16 PCM
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Send as raw binary (v3 API expects binary frames)
            ws.send(pcm16.buffer);
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
        workletNode = processor;
    }

    function stop() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'Terminate' }));
        }
        cleanup();
    }

    function cleanup() {
        isListening = false;

        if (workletNode) {
            workletNode.disconnect();
            workletNode = null;
        }

        if (audioContext) {
            audioContext.close().catch(() => {});
            audioContext = null;
        }

        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }

        if (ws) {
            ws.close();
            ws = null;
        }

        if (callbacks.onEnd) callbacks.onEnd();
    }

    function toggle() {
        if (isListening) {
            stop();
            return false;
        } else {
            start();
            return true;
        }
    }

    function onResult(callback) { callbacks.onResult = callback; }
    function onStart(callback) { callbacks.onStart = callback; }
    function onEnd(callback) { callbacks.onEnd = callback; }
    function onError(callback) { callbacks.onError = callback; }
    function getIsListening() { return isListening; }

    return {
        isSupported: isSupported,
        start: start,
        stop: stop,
        toggle: toggle,
        onResult: onResult,
        onStart: onStart,
        onEnd: onEnd,
        onError: onError,
        isListening: getIsListening
    };
})();

// Task Parser Module - Extract tasks from transcript
const TaskParser = (function() {
    const categoryKeywords = {
        work: ['work', 'office', 'meeting', 'email', 'report', 'project', 'deadline', 'client', 'boss', 'colleague', 'presentation', 'call', 'schedule', 'task', 'job', 'send', 'review', 'prepare'],
        shopping: ['buy', 'purchase', 'shop', 'store', 'grocery', 'groceries', 'market', 'order', 'pick up', 'get some', 'need to get', 'milk', 'bread', 'eggs', 'amazon', 'order'],
        health: ['gym', 'exercise', 'workout', 'run', 'jog', 'walk', 'doctor', 'dentist', 'medicine', 'vitamin', 'health', 'meditate', 'yoga', 'stretch', 'sleep', 'water', 'diet', 'appointment'],
        personal: ['call mom', 'call dad', 'family', 'friend', 'birthday', 'anniversary', 'home', 'clean', 'laundry', 'dishes', 'cook', 'dinner', 'lunch', 'breakfast', 'fix', 'organize']
    };

    // Time patterns to detect duration mentions
    const timePatterns = [
        { pattern: /(\d+)\s*(?:hour|hr|h)s?/i, multiplier: 60 },
        { pattern: /(\d+)\s*(?:minute|min|m)s?/i, multiplier: 1 },
        { pattern: /half\s*(?:an?\s*)?hour/i, value: 30 },
        { pattern: /quarter\s*(?:of\s*an?\s*)?hour/i, value: 15 },
    ];

    const delimiters = /\s+(?:and|then|next|also|plus)\s+|[,;.!?]\s+/i;

    // Phrases that signal the user is done speaking
    const stopPhrases = [
        'stop now',
        'stop recording',
        'and that\'s it',
        'that\'s it',
        'and i\'m done',
        'i\'m done',
        'and that\'s all',
        'that\'s all',
        'done now',
        'finish recording',
        'end recording',
        'and stop'
    ];

    function isStopPhrase(text) {
        const lowerText = text.toLowerCase().trim();
        return stopPhrases.some(phrase => lowerText.includes(phrase));
    }

    function removeStopPhrase(text) {
        let cleaned = text;
        for (const phrase of stopPhrases) {
            // Escape special regex chars and handle apostrophes
            const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['\u2019]");
            const regex = new RegExp('[,.]?\\s*' + escaped + '[,.]?\\s*', 'gi');
            cleaned = cleaned.replace(regex, ' ');
        }
        return cleaned.trim();
    }

    function detectCategory(text) {
        const lowerText = text.toLowerCase();
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            for (const keyword of keywords) {
                if (lowerText.includes(keyword)) {
                    return category;
                }
            }
        }
        return 'other';
    }

    function detectTime(text) {
        const lowerText = text.toLowerCase();

        for (const { pattern, multiplier, value } of timePatterns) {
            const match = lowerText.match(pattern);
            if (match) {
                if (value) return value;
                const num = parseInt(match[1], 10);
                if (!isNaN(num)) {
                    const minutes = num * multiplier;
                    // Clamp to valid options: 15, 30, 60, 120, or 0 (unlimited)
                    if (minutes <= 15) return 15;
                    if (minutes <= 30) return 30;
                    if (minutes <= 60) return 60;
                    if (minutes <= 120) return 120;
                    return 0; // Unlimited for very long tasks
                }
            }
        }
        return 15; // Default
    }

    // Leading filler words to remove from task titles
    const leadingFillers = /^(?:and\s+then\s+|and\s+also\s+|then\s+|and\s+|also\s+|next\s+|plus\s+|oh\s+and\s+|um\s+|uh\s+|like\s+|so\s+)+/i;

    function cleanTitle(text) {
        // Remove time mentions from title for cleaner display
        let cleaned = text
            .replace(/\s*(?:for\s+)?(\d+)\s*(?:hour|hr|h|minute|min|m)s?\s*/gi, ' ')
            .replace(/\s*(?:for\s+)?(?:half|quarter)\s*(?:an?\s*)?(?:of\s*an?\s*)?hour\s*/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Remove leading filler words like "and", "and then", etc.
        cleaned = cleaned.replace(leadingFillers, '').trim();

        if (cleaned.length === 0) return '';
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    function isValidTask(title) {
        if (!title || title.length < 3) return false;

        // Count actual words (not just contractions)
        const words = title.split(/\s+/).filter(w => w.length > 0);
        if (words.length < 2) {
            // Single word - only valid if it's a substantial word (5+ chars, not a contraction)
            const word = words[0] || '';
            if (word.length < 5 || word.includes("'") || word.includes("'")) {
                return false;
            }
        }

        // Filter out common noise phrases
        const noisePhrases = ['that\'s', 'thats', 'it\'s', 'its', 'i\'m', 'im', 'and', 'the', 'a', 'an', 'oh', 'um', 'uh', 'like', 'so', 'yeah', 'yes', 'no', 'okay', 'ok'];
        const lowerTitle = title.toLowerCase();
        if (noisePhrases.includes(lowerTitle)) return false;

        return true;
    }

    function parseTranscript(transcript) {
        if (!transcript || typeof transcript !== 'string') return [];

        const rawTasks = transcript.split(delimiters);
        return rawTasks
            .map(text => text.trim())
            .filter(text => text.length > 2)
            .map(text => ({
                title: cleanTitle(text),
                category: detectCategory(text),
                timeEstimate: detectTime(text)
            }))
            .filter(task => isValidTask(task.title));
    }

    function parseSingleTask(transcript) {
        if (!transcript || typeof transcript !== 'string') return null;
        const text = transcript.trim();
        if (text.length < 3) return null;

        return {
            title: cleanTitle(text),
            category: detectCategory(text),
            timeEstimate: detectTime(text)
        };
    }

    return {
        parseTranscript: parseTranscript,
        parseSingleTask: parseSingleTask,
        detectCategory: detectCategory,
        detectTime: detectTime,
        isStopPhrase: isStopPhrase,
        removeStopPhrase: removeStopPhrase
    };
})();
