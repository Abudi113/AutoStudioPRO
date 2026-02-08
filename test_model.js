
const API_KEY = "AIzaSyBdECB9kHctHwf7wgzjZU-FYNY5tmXrS_A";
const MODEL = "models/gemini-3-pro-image-preview";

async function testModel() {
    const url = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${API_KEY}`;

    const payload = {
        contents: [{
            role: "user",
            parts: [
                { text: "Generate a simple placeholder image of a blue car." }
            ]
        }],
        generationConfig: {
            temperature: 0.4,
            topP: 1,
            topK: 32,
            maxOutputTokens: 2048,
        }
    };

    try {
        console.log(`🚀 Testing ${MODEL} via :generateContent...`);
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log("Status:", response.status);
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error:", err);
    }
}

testModel();
