
const SURPABASE_URL = "https://nkzacobvrzrzjoflhcks.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5remFjb2J2cnpyempvZmxoY2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMzA3MzcsImV4cCI6MjA4NTgwNjczN30.ZGr34_f-skUUaeq8xzwzMTlKTTbceQrd4Qy5ZYFQTyU";

async function run() {
    console.log("Calling list-models...");
    try {
        const resp = await fetch(`${SURPABASE_URL}/functions/v1/process-image`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${ANON_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ action: "list-models" })
        });

        const data = await resp.json();
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

run();


// Get from env or args
const apiKey = process.env.GEMINI_API_KEY || "AIzaSy..."; // User key will be injected via env in run_command

if (!apiKey || apiKey.startsWith("AIzaSy...")) {
    console.error("Please provide GEMINI_API_KEY env var");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Dummy init to get client
        // Actually SDK doesn't have listModels on client directly in some versions, but let's try the direct API fetch if SDK fails, 
        // or use the model's own method if available. 
        // Wait, the node SDK usually exposes listModels via the GoogleGenerativeAI instance or similar? 
        // Actually, it's not directly on the instance in 0.1.x. 
        // Let's use a direct fetch to be 100% sure of what the API sees.

        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => {
                if (m.name.includes("gemini") || m.name.includes("imagen")) {
                    console.log(`- ${m.name.replace('models/', '')} (${m.supportedGenerationMethods.join(', ')})`);
                }
            });
        } else {
            console.error("No models found or error:", data);
        }

    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
