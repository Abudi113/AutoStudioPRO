
const API_KEY = "AIzaSyBdECB9kHctHwf7wgzjZU-FYNY5tmXrS_A";
const MODEL_NAME = "imagen-4.0-generate-preview-06-06";

// Small 1x1 red pixel for testing
const B64_IMAGE = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function testMultimodal() {
    console.log(`Testing ${MODEL_NAME} with image input...`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:predict?key=${API_KEY}`;

    // Attempt 1: Standard Imagen "image" field
    const payload1 = {
        instances: [
            {
                prompt: "Describe this image",
                image: { bytesBase64Encoded: B64_IMAGE }
            }
        ],
        parameters: { sampleCount: 1 }
    };

    try {
        console.log("Attempt 1 (Standard Imagen Payload)...");
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload1)
        });
        const data = await response.json();
        if (response.ok) {
            console.log("SUCCESS");
            console.log(JSON.stringify(data, null, 2));
            return;
        } else {
            console.log(`FAILED (${response.status})`);
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

testMultimodal();
