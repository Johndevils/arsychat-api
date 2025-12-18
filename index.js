// index.js

// Map specific URL slugs to the full Hugging Face Model IDs
const MODELS = {
  "glm": "zai-org/GLM-4.6",
  "deepseek": "deepseek-ai/DeepSeek-V3.2",
  "kimi": "moonshotai/Kimi-K2-Thinking",
  "qwen": "Qwen/Qwen3-VL-8B-Instruct"
};

// Define CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS", // Changed to allow GET
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", // Prevent browser caching
};

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight (OPTIONS request)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    // Only allow GET requests now
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method Not Allowed. Use GET." }), { 
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const url = new URL(request.url);

    try {
      // 2. ROUTING LOGIC
      // Expected URL pattern: /api/<model_slug>/v1/chat/completions
      const pathRegex = /^\/api\/([a-zA-Z0-9-]+)\/v1/;
      const match = url.pathname.match(pathRegex);

      if (!match || !match[1]) {
        return new Response(JSON.stringify({ error: "Invalid API Endpoint format. Use /api/<model>/v1" }), { 
            status: 404, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const modelSlug = match[1]; 
      const targetModelId = MODELS[modelSlug];

      if (!targetModelId) {
        return new Response(JSON.stringify({ error: `Model '${modelSlug}' not found.` }), { 
            status: 404, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 3. GET INPUT FROM URL (Query Params)
      // Example: .../chat/completions?prompt=Hello%20World
      const userPrompt = url.searchParams.get("prompt") || url.searchParams.get("q") || url.searchParams.get("message");

      if (!userPrompt) {
        return new Response(JSON.stringify({ error: "Missing 'prompt' parameter in URL" }), { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Check for Token
      if (!env.HF_TOKEN) {
        throw new Error("Server Error: HF_TOKEN is missing in Worker Secrets.");
      }

      // 4. CONSTRUCT THE BODY FOR HUGGING FACE
      // Even though we received a GET, Hugging Face requires a POST with JSON
      const requestBody = {
        model: targetModelId,
        messages: [
            { role: "user", content: userPrompt }
        ],
        stream: false, // Recommended false for GET requests to keep it simple
        max_tokens: 1024
      };

      // 5. FORWARD TO HUGGING FACE (Must remain POST)
      const upstreamResponse = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST", // Internal request is still POST
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.HF_TOKEN}`
        },
        body: JSON.stringify(requestBody)
      });

      // 6. RETURN RESPONSE
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: {
          ...Object.fromEntries(upstreamResponse.headers),
          ...corsHeaders
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
        }
      });
    }
  }
};
