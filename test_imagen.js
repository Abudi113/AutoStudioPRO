
const { GoogleGenerativeAI } = require("@google/generative-ai");

const API_KEY = "AIzaSyBdECB9kHctHwf7wgzjZU-FYNY5tmXrS_A";
const genAI = new GoogleGenerativeAI(API_KEY);

async function testImagen() {
    const modelName = "imagen-4.0-generate-preview-06-06"; // From debug output
    const model = genAI.getGenerativeModel({ model: modelName });

    try {
        console.log(`Testing ${modelName} with generateContent...`);
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: "A futuristic car in a neon city" }] }],
        });
        console.log("Success!");
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error with generateContent:", error.message);

        // Try predict if available (SDK might not expose it directly via getGenerativeModel?)
        // The Node SDK is mostly for Gemini. 
    }
}

testImagen();
