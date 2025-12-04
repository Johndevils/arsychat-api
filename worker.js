export default {
  async fetch(request, env, ctx) {
    // --- 1. HANDLE CORS (Crucial for Frontend connection) ---
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // Allow any domain (Change to your specific domain for production)
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle "Preflight" OPTIONS request
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST requests
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    // --- 2. MAIN LOGIC ---
    try {
      // Parse the incoming JSON from your Frontend
      const { messages, model } = await request.json();

      if (!messages || !Array.isArray(messages)) {
        return new Response(JSON.stringify({ error: "Invalid messages format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Default model if none provided
      const selectedModel = model || "deepseek-ai/DeepSeek-V3.2:novita";
      const hfToken = env.HF_TOKEN; // Get Token from Environment Variables

      if (!hfToken) {
        throw new Error("HF_TOKEN is missing in Cloudflare Environment Variables");
      }

      // --- 3. CALL HUGGING FACE API ---
      // We use raw fetch here because it's lighter than the OpenAI SDK for Workers
      const hfResponse = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: messages,
          max_tokens: 1024,
          temperature: 0.7
        }),
      });

      // Handle HF Errors
      if (!hfResponse.ok) {
        const errorText = await hfResponse.text();
        throw new Error(`Hugging Face Error: ${errorText}`);
      }

      const data = await hfResponse.json();

      // --- 4. RETURN RESPONSE TO FRONTEND ---
      // We return just the message object to match your frontend code
      // (data.choices[0].message)
      const responseMessage = data.choices?.[0]?.message || { role: "assistant", content: "No response." };

      return new Response(JSON.stringify(responseMessage), {
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
