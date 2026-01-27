const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json'
};

// Read API key from environment variable or .env file
function getApiKey() {
    // First check environment variable
    if (process.env.ASSEMBLYAI_API_KEY) {
        return process.env.ASSEMBLYAI_API_KEY;
    }

    // Fall back to .env file
    try {
        const envPath = path.join(__dirname, '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/ASSEMBLYAI_API_KEY=(.+)/);
        return match ? match[1].trim() : null;
    } catch (e) {
        return null;
    }
}

const server = http.createServer(async (req, res) => {
    // Handle token endpoint
    if (req.method === 'POST' && req.url === '/api/assemblyai-token') {
        const apiKey = getApiKey();
        if (!apiKey) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'API key not configured' }));
            return;
        }

        try {
            // Use v3 Universal Streaming token endpoint (GET request)
            const response = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=60', {
                method: 'GET',
                headers: {
                    'Authorization': apiKey
                }
            });

            const data = await response.json();

            res.writeHead(response.ok ? 200 : response.status, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify(data));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    // Serve static files
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log('Press Ctrl+C to stop');
});
