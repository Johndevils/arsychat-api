/**
 * Cloudflare Worker for Chat Backend
 */

// Define available models
const MODELS = {
	kimi: "moonshotai/Kimi-K2-Thinking:novita",
	deepseek: "deepseek-ai/DeepSeek-V3.2:novita",
};

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// 1. CORS Headers (Allow frontend to connect)
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*", // Change '*' to your frontend domain in production
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		};

		// 2. Handle Preflight Requests (OPTIONS)
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		// 3. Endpoint: /health
		if (url.pathname === "/health") {
			return new Response(JSON.stringify({ status: "ok", service: "chat-backend" }), {
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			});
		}

		// 4. Endpoint: /api/chat
		// Usage: POST /api/chat?model=kimi OR /api/chat?model=deepseek
		if (url.pathname === "/api/chat" && request.method === "POST") {
			try {
				// Get model from query param (default to deepseek if missing)
				const modelKey = url.searchParams.get("model");
				
				// Validate model
				let selectedModel = MODELS[modelKey];
				
				// If the user passed the full raw string instead of the short key, use that
				if (!selectedModel && Object.values(MODELS).includes(modelKey)) {
					selectedModel = modelKey;
				}

				if (!selectedModel) {
					return new Response(JSON.stringify({ 
						error: "Invalid model. Use 'kimi' or 'deepseek'" 
					}), {
						status: 400,
						headers: { ...corsHeaders, "Content-Type": "application/json" }
					});
				}

				// Check if HF_TOKEN is set
				if (!env.HF_TOKEN) {
					return new Response(JSON.stringify({ error: "Server misconfiguration: HF_TOKEN missing" }), {
						status: 500,
						headers: corsHeaders
					});
				}

				// Parse user request body
				const reqBody = await request.json();

				// Construct payload for Hugging Face
				const payload = {
					model: selectedModel,
					messages: reqBody.messages,
					stream: false, // Set to true if you implement streaming later
					max_tokens: reqBody.max_tokens || 1024,
					temperature: reqBody.temperature || 0.7
				};

				// Call Hugging Face API
				const hfResponse = await fetch("https://router.huggingface.co/v1/chat/completions", {
					method: "POST",
					headers: {
						"Authorization": `Bearer ${env.HF_TOKEN}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				});

				// Return the HF response directly to the user
				const data = await hfResponse.json();
				
				return new Response(JSON.stringify(data), {
					status: hfResponse.status,
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});

			} catch (err) {
				return new Response(JSON.stringify({ error: err.message }), {
					status: 500,
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}
		}

		// 404 for any other route
		return new Response("Not Found", { status: 404, headers: corsHeaders });
	},
};
