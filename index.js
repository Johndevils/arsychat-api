/**
 * Arsychat Ai - Cloudflare Worker
 * Supports BOTH GET and POST requests.
 * 
 * GET Example:  /api/glm/v1/chat/completions?prompt=Hello
 * POST Example: /api/glm/v1/chat/completions with body {"prompt": "Hello"}
 */

const MODELS = {
  "glm": "zai-org/GLM-4.6",
  "deepseek": "deepseek-ai/DeepSeek-V3.2",
  "kimi": "moonshotai/Kimi-K2-Thinking",
  "qwen": "Qwen/Qwen3-VL-8B-Instruct"
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json"
};

export default {
  async fetch(request, env) {
    // 1. Handle Preflight OPTIONS (Important for Frontend)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    
    // Path structure: /api/[modelSlug]/v1/chat/completions
    const modelSlug = pathSegments[2]; 
    const targetModelId = MODELS[modelSlug];

    try {
      // 2. Initial Validations
      if (!targetModelId) {
        return new Response(JSON.stringify({ error: `Model '${modelSlug}' invalid.` }), { 
          status: 404, 
          headers: corsHeaders 
        });
      }

      if (!env.HF_TOKEN) {
        throw new Error("Server secret HF_TOKEN is missing.");
      }

      let userPrompt = "";

      // 3. Handle GET Request Logic
      if (request.method === "GET") {
        userPrompt = url.searchParams.get("prompt") || url.searchParams.get("q");
      } 
      
      // 4. Handle POST Request Logic
      else if (request.method === "POST") {
        try {
          const body = await request.json();
          // Support both OpenAI format {messages: [{...}]} and simple {prompt: "..."}
          if (body.messages && Array.isArray(body.messages)) {
            userPrompt = body.messages[body.messages.length - 1].content;
          } else {
            userPrompt = body.prompt;
          }
        } catch (e) {
          throw new Error("Invalid JSON body in POST request.");
        }
      } 
      
      else {
        throw new Error("Only GET and POST methods are supported.");
      }

      // Final check if prompt exists
      if (!userPrompt) {
        throw new Error("No prompt found. For GET use ?prompt=... and for POST use body {'prompt': '...'}");
      }

      // 5. Forward to Hugging Face Router
      const hfResponse = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.HF_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: targetModelId,
          messages: [{ role: "user", content: userPrompt }],
          max_tokens: 2048,
          stream: false
        })
      });

      // 6. Return Clean Response (Avoid header conflicts)
      const data = await hfResponse.json();
      
      return new Response(JSON.stringify(data), {
        status: hfResponse.status,
        headers: corsHeaders
      });

    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error.message,
        method_used: request.method
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
  }
};
