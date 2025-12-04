import { OpenAI } from "openai";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- 1. CORS SETTINGS (Allow Frontend Access) ---
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // Change "*" to your domain in production
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle Preflight Request
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- 2. HEALTH CHECK (/health) ---
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "online", system: "Arsynox Backend" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // --- 3. CHAT ENDPOINT (/api/chat) ---
    if (url.pathname === "/api/chat") {
      
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
      }

      try {
        // A. Parse Body
        const body = await request.json();
        const { messages, model } = body;

        // B. Model Switching Logic
        // Checks URL param (?model=kimik2) OR Body ({ model: "kimik2" })
        const urlModelParam = url.searchParams.get("model");
        const requestedModel = urlModelParam || model; 

        let targetModel = "deepseek-ai/DeepSeek-V3.2:novita"; // Default

        if (requestedModel && requestedModel.includes("Kimi")) {
           targetModel = "moonshotai/Kimi-K2-Thinking:novita";
        } else if (requestedModel === "kimik2") {
           targetModel = "moonshotai/Kimi-K2-Thinking:novita";
        }

        // C. Initialize OpenAI with Hugging Face Router
        const client = new OpenAI({
          baseURL: "https://router.huggingface.co/v1",
          apiKey: env.HF_TOKEN, // Gets secret from Cloudflare
        });

        // D. Generate AI Response
        const chatCompletion = await client.chat.completions.create({
          model: targetModel,
          messages: messages || [{ role: "user", content: "Hello" }],
          max_tokens: 1024,
          temperature: 0.7,
        });

        // E. Return Success
        return new Response(JSON.stringify(chatCompletion.choices[0].message), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // --- 4. 404 Not Found ---
    return new Response("Endpoint Not Found. Use /api/chat", { 
      status: 404, 
      headers: corsHeaders 
    });
  },
};
