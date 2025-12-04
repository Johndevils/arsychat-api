import { OpenAI } from "openai";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

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

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      try {
        const modelParam = url.searchParams.get("model");
        const targetModel = modelParam === "kimik2"
          ? "moonshotai/Kimi-K2-Thinking:novita"
          : "deepseek-ai/DeepSeek-V3.2:novita";

        // init client (bundling required)
        const client = new OpenAI({
          baseURL: "https://router.huggingface.co/v1",
          apiKey: env.HF_TOKEN,
        });

        // parse body safely
        let body;
        try {
          body = await request.json();
        } catch (err) {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { messages } = body;
        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response(JSON.stringify({ error: "messages must be a non-empty array" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const chatCompletion = await client.chat.completions.create({
          model: targetModel,
          messages,
          max_tokens: 1024,
        });

        // return the whole completion object (or pick what you want)
        return new Response(JSON.stringify(chatCompletion), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } catch (error) {
        const safe = {
          message: error?.message || String(error),
          stack: error?.stack ? error.stack.split("\n").slice(0,3).join("\n") : undefined
        };
        return new Response(JSON.stringify({ error: safe }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Endpoint not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  },
};
