
const API_KEY = "AIzaSyBdECB9kHctHwf7wgzjZU-FYNY5tmXrS_A";

async function debugModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        console.log("🔍 Supported Models & Methods:");
        if (data.models) {
            data.models.forEach(m => {
                if (m.name.includes("imagen")) {
                    console.log(`- ${m.name}`);
                    console.log(`  Methods: ${m.supportedGenerationMethods.join(", ")}`);
                }
            });
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

debugModels();
