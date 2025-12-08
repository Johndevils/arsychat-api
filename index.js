// index.js

// Map specific URL slugs to the full Hugging Face Model IDs
const MODELS = {
  "glm": "zai-org/GLM-4.6",
  "deepseek": "deepseek-ai/DeepSeek-V3.2",
  "kimi": "moonshotai/Kimi-K2-Thinking",
  "qwen": "Qwen/Qwen3-VL-8B-Instruct"
};

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS (Allow access from any website)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Only allow POST requests
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);

    try {
      // 2. ROUTING LOGIC
      // Expected URL pattern: /api/<model_slug>/v1/chat/completions
      // Regex to capture the word between /api/ and /v1
      const pathRegex = /^\/api\/([a-zA-Z0-9-]+)\/v1/;
      const match = url.pathname.match(pathRegex);

      if (!match || !match[1]) {
        return new Response("Invalid API Endpoint format. Use /api/<model>/v1", { status: 404 });
      }

      const modelSlug = match[1]; // e.g., "kimi", "deepseek"
      const targetModelId = MODELS[modelSlug];

      if (!targetModelId) {
        return new Response(`Model '${modelSlug}' not found. Available: ${Object.keys(MODELS).join(", ")}`, { status: 404 });
      }

      // 3. Prepare the Request
      const requestBody = await request.json();

      // FORCE the model ID based on the URL
      requestBody.model = targetModelId;

      // 4. Forward to Hugging Face
      const upstreamResponse = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Use the token stored in Cloudflare Secrets
          "Authorization": `Bearer ${env.HF_TOKEN}`
        },
        body: JSON.stringify(requestBody)
      });

      // 5. Stream the response back
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: {
          ...Object.fromEntries(upstreamResponse.headers),
          "Access-Control-Allow-Origin": "*"
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
