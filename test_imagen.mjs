
const API_KEY = "AIzaSyBdECB9kHctHwf7wgzjZU-FYNY5tmXrS_A";
const MODEL_NAME = "imagen-4.0-generate-preview-06-06"; // Trying the one found in debug

async function testImagen() {
    console.log(`Testing ${MODEL_NAME}...`);

    // 1. Try generateContent (Gemini method)
    const urlGen = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
    try {
        const response = await fetch(urlGen, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: "A futuristic car" }] }]
            })
        });
        const data = await response.json();
        if (response.ok) {
            console.log("generateContent: SUCCESS");
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log(`generateContent: FAILED (${response.status})`);
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("generateContent Error:", e.message);
    }

    // 2. Try predict (Imagen method)
    const urlPred = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:predict?key=${API_KEY}`;
    try {
        // Predict payload structure is different
        // Usually { instances: [ { prompt: "..." } ], parameters: { ... } }
        const response = await fetch(urlPred, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                instances: [{ prompt: "A futuristic car" }],
                parameters: { sampleCount: 1 }
            })
        });
        const data = await response.json();
        if (response.ok) {
            console.log("predict: SUCCESS");
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log(`predict: FAILED (${response.status})`);
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("predict Error:", e.message);
    }
}

testImagen();
