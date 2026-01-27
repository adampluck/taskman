// Cloudflare Worker for AssemblyAI token proxy
// Deploy to Cloudflare Workers and set ASSEMBLYAI_API_KEY as an environment secret

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const apiKey = env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    try {
      // Use v3 Universal Streaming token endpoint
      const response = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=60', {
        method: 'GET',
        headers: {
          'Authorization': apiKey,
        },
      });

      const data = await response.json();

      return new Response(JSON.stringify(data), {
        status: response.ok ? 200 : response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
