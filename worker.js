import { OpenAI } from "openai";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- 1. GLOBAL CORS CONFIGURATION ---
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS", // Added GET for health check
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle Preflight (OPTIONS)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- 2. HEALTH ENDPOINT (/health) ---
    // Simple check to see if server is alive
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ 
        status: "online", 
        service: "Arsynox API", 
        timestamp: new Date().toISOString() 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // --- 3. CHAT ENDPOINT (/api/chat) ---
    if (url.pathname === "/api/chat") {
      
      // Ensure Method is POST
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
      }

      try {
        // --- A. MODEL SELECTION LOGIC ---
        // Usage: /api/chat?model=kimik2
        const modelParam = url.searchParams.get("model");
        let targetModel;

        if (modelParam === "kimik2") {
          targetModel = "moonshotai/Kimi-K2-Thinking:novita";
        } else {
          // Default to DeepSeek
          targetModel = "deepseek-ai/DeepSeek-V3.2:novita";
        }

        // --- B. INITIALIZE OPENAI CLIENT ---
        const client = new OpenAI({
          baseURL: "https://router.huggingface.co/v1",
          apiKey: env.HF_TOKEN,
        });

        // --- C. PARSE BODY ---
        const body = await request.json();
        const { messages } = body;

        // --- D. GENERATE AI RESPONSE ---
        const chatCompletion = await client.chat.completions.create({
          model: targetModel,
          messages: messages || [{ role: "user", content: "Hello" }],
          max_tokens: 1024,
        });

        // --- E. RETURN RESULT ---
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

    // --- 4. 404 NOT FOUND ---
    return new Response(JSON.stringify({ error: "Endpoint not found" }), { 
      status: 404, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  },
};
