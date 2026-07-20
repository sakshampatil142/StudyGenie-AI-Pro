// ⚠️ NOTE: This file is never linked in index.html and is not used.
// script.js already defines its own askAI(), which is more complete
// (it handles chatflow/agent/workflow response shapes and shows the
// loading screen). If both files were ever loaded together, this
// askAI() would silently overwrite the one in script.js. Safe to
// delete this file, or keep it only as a minimal reference example.
async function askAI(prompt) {

    try {

        const response = await fetch(DIFY_URL, {

            method: "POST",

            headers: {
                "Authorization": `Bearer ${DIFY_API_KEY}`,
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                query: prompt,

                inputs: {
                    query: prompt
                },

                response_mode: "blocking",

                conversation_id: "",

                user: "studygenie"

            })

        });

        const data = await response.json();

        console.log("Status:", response.status);
        console.log("Response:", data);

        if (!response.ok) {
            return data.message || JSON.stringify(data);
        }

        return data.answer;

    } catch (err) {

        console.error(err);
        return "Error connecting to Dify.";

    }

}
