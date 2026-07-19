// ============================================
// StudyGenie AI Pro — script.js
// ============================================

// ----------------------------
// Global State
// ----------------------------

let notes = "";
let uploaded = false;

// ----------------------------
// DOM References
// ----------------------------

const output = document.getElementById("output");
const topics = document.getElementById("topics");
const flashCount = document.getElementById("flashCount");
const mcqCount = document.getElementById("mcqCount");
const loadingScreen = document.getElementById("loadingScreen");

// ----------------------------
// Loading Overlay
// ----------------------------

function loading(message = "🤖 AI is thinking...") {
    if (!loadingScreen) return;
    loadingScreen.style.display = "flex";
    loadingScreen.querySelector("h2").innerText = message;
}

function stopLoading() {
    if (!loadingScreen) return;
    loadingScreen.style.display = "none";
}

// ----------------------------
// Typing Effect + Result Display
// ----------------------------

function typeWriter(text) {
    output.innerHTML = "";
    let i = 0;
    const speed = 8;
    const timer = setInterval(() => {
        output.innerHTML += text.charAt(i);
        i++;
        if (i >= text.length) clearInterval(timer);
    }, speed);
}

function showResult(text) {
    stopLoading();
    typeWriter(text);
}

// ----------------------------
// Save Notes Locally
// ----------------------------

function saveToLocal() {
    try {
        localStorage.setItem("studygenie_notes", notes);
    } catch (err) {
        console.warn("Could not save notes locally:", err);
    }
}

// ----------------------------
// PDF Upload
// ----------------------------

async function uploadFile() {
    const fileInput = document.getElementById("file");

    if (fileInput.files.length === 0) {
        alert("Please upload a PDF.");
        return;
    }

    const file = fileInput.files[0];

    if (file.type !== "application/pdf") {
        alert("Only PDF files supported.");
        return;
    }

    loading("📖 Reading PDF...");

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        notes = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const text = await page.getTextContent();
            const pageText = text.items.map((item) => item.str).join(" ");
            notes += pageText + "\n\n";
        }

        uploaded = true;

        if (topics) topics.innerText = pdf.numPages;

        stopLoading();

        output.innerHTML = `
            <h2>✅ PDF Uploaded Successfully</h2>
            <br>
            <p>Pages : ${pdf.numPages}</p>
            <br>
            Click any AI feature.
        `;

        saveToLocal();
    } catch (err) {
        console.error(err);
        stopLoading();
        output.innerHTML = "❌ Failed to read PDF.";
    }
}

function checkPDF() {
    if (!uploaded) {
        alert("Upload PDF first.");
        return false;
    }
    return true;
}

// ============================================
// DIFY AI
// ============================================

function buildDifyBody(prompt) {
    if (DIFY_APP_TYPE === "chat") {
        return {
            inputs: { query: prompt },
            query: prompt,
            response_mode: "blocking",
            conversation_id: "",
            user: "studygenie"
        };
    }

    // completion-type app
    return {
        inputs: { query: prompt },
        response_mode: "blocking",
        user: "studygenie"
    };
}

async function askAI(prompt) {
    loading("🤖 Thinking...");

    try {
        const response = await fetch(DIFY_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${DIFY_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(buildDifyBody(prompt))
        });

        let data;
        try {
            data = await response.json();
        } catch (parseErr) {
            stopLoading();
            return `❌ Server returned an invalid response (HTTP ${response.status}). Check DIFY_URL and the API key in config.js.`;
        }

        console.log("Dify Response:", data);

        if (!response.ok) {
            stopLoading();
            const detail = data && (data.message || data.error || JSON.stringify(data));
            return `❌ Dify API error (HTTP ${response.status}): ${detail || "unknown error"}`;
        }

        stopLoading();

        // Chat / Agent apps
        if (data.answer) return data.answer;
        if (data.data && data.data.answer) return data.data.answer;

        // Workflow-style outputs
        if (data.data && data.data.outputs) {
            const outputs = data.data.outputs;
            const key = Object.keys(outputs)[0];
            return outputs[key];
        }
        if (data.outputs) {
            const key = Object.keys(data.outputs)[0];
            return data.outputs[key];
        }

        return "No AI response received.";
    } catch (error) {
        console.error(error);
        stopLoading();

        if (error instanceof TypeError) {
            return "❌ Could not reach Dify (network/CORS error). Calling api.dify.ai directly from a browser is often blocked — see the console, and consider a backend proxy.";
        }

        return `❌ Error connecting to Dify AI: ${error.message}`;
    }
}

// ----------------------------
// Run AI Helper
// ----------------------------

async function runAI(title, instruction) {
    if (!checkPDF()) return;

    loading(title);

    const prompt = `
${instruction}

-----------------------

Study Notes:

${notes}
`;

    const answer = await askAI(prompt);
    showResult(answer);
    updateChart();
}

// ============================================
// AI FEATURES
// ============================================

async function generateSummary() {
    await runAI(
        "📄 Generating Summary...",
        `You are an expert teacher.

Create a beautiful study summary.

Requirements:
• Proper Headings
• Bullet Points
• Key Concepts
• Important Definitions
• Exam Tips

Keep it easy to revise.`
    );
}

async function generateFormula() {
    await runAI(
        "📒 Extracting Formula Sheet...",
        `Extract ONLY
• Formula
• Equation
• Definitions
• Keywords
• Important Syntax

Do NOT summarize. Arrange neatly.`
    );
}

async function generateFlashcards() {
    await runAI(
        "🧠 Creating Flashcards...",
        `Generate exactly 10 flashcards.

Format:
Question:
Answer:

Use concise answers.`
    );

    if (flashCount) {
        flashCount.innerText = "10";
        updateChart();
    }
}

async function generateQuiz() {
    await runAI(
        "❓ Generating MCQs...",
        `Generate exactly 10 multiple choice questions.

Each should contain:
Question
A)
B)
C)
D)
Correct Answer

Difficulty: Easy to Medium.`
    );

    if (mcqCount) {
        mcqCount.innerText = "10";
        updateChart();
    }
}

async function generateStudyPlan() {
    await runAI(
        "📅 Creating Study Plan...",
        `Create a smart 7-day study timetable.

For each day include:
Topics
Revision
Practice Questions
Break Time
Estimated Study Hours.`
    );
}

async function explainSimple() {
    await runAI(
        "👶 Simplifying Notes...",
        `Explain these notes like I'm 10 years old.

Use simple English, examples, and daily-life analogies.
Avoid technical words.`
    );
}

async function expectedQuestions() {
    await runAI(
        "🎯 Predicting Questions...",
        `Generate 10 Expected University Questions.

Mix: 2 Marks, 5 Marks, 10 Marks.
Also mention which topics are most important.`
    );
}

// ============================================
// OUTPUT ACTIONS
// ============================================

function copyOutput() {
    const text = output.innerText;
    navigator.clipboard.writeText(text);
    alert("✅ Copied Successfully");
}

function downloadOutput() {
    const text = output.innerText;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "StudyGenie_Output.txt";
    a.click();
    URL.revokeObjectURL(url);
}

function clearOutput() {
    output.innerHTML = "Upload another PDF to continue.";
}

function speakOutput() {
    const speech = new SpeechSynthesisUtterance(output.innerText);
    speech.rate = 1;
    speech.pitch = 1;
    speech.volume = 1;
    speech.lang = "en-US";
    speechSynthesis.cancel();
    speechSynthesis.speak(speech);
}

const voiceBtn = document.getElementById("voiceBtn");
if (voiceBtn) voiceBtn.addEventListener("click", speakOutput);

// ----------------------------
// Scroll To Top
// ----------------------------

const scrollBtn = document.getElementById("scrollTop");

if (scrollBtn) {
    window.addEventListener("scroll", () => {
        scrollBtn.style.display = window.scrollY > 300 ? "block" : "none";
    });

    scrollBtn.onclick = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
}

// ----------------------------
// Dark / Light Mode
// ----------------------------

{
    const themeBtn = document.querySelector(".theme");
    let lightMode = false;

    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            lightMode = !lightMode;
            document.body.classList.toggle("light");

            if (lightMode) {
                themeBtn.innerHTML = `<i class="fa-solid fa-moon"></i> Dark Mode`;
                localStorage.setItem("theme", "light");
            } else {
                themeBtn.innerHTML = `<i class="fa-solid fa-sun"></i> Light Mode`;
                localStorage.setItem("theme", "dark");
            }

            updateChart();
        });

        window.addEventListener("load", () => {
            const saved = localStorage.getItem("theme");
            if (saved === "light") {
                lightMode = true;
                document.body.classList.add("light");
                themeBtn.innerHTML = `<i class="fa-solid fa-moon"></i> Dark Mode`;
            }
        });
    }
}

// ----------------------------
// Chart.js Dashboard
// ----------------------------

const chartCanvas = document.getElementById("progressChart");
let progressChart = null;

if (chartCanvas) {
    progressChart = new Chart(chartCanvas, {
        type: "bar",
        data: {
            labels: ["Pages", "Flashcards", "MCQs"],
            datasets: [
                {
                    label: "Study Progress",
                    data: [0, 0, 0],
                    backgroundColor: "#06b6d4",
                    borderColor: "#06b6d4",
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function updateChart() {
    if (!progressChart) return;

    progressChart.data.datasets[0].data = [
        parseInt(topics.innerText || 0),
        parseInt(flashCount.innerText || 0),
        parseInt(mcqCount.innerText || 0)
    ];

    const isLight = document.body.classList.contains("light");
    const color = isLight ? "#2563eb" : "#06b6d4";
    progressChart.data.datasets[0].backgroundColor = color;
    progressChart.data.datasets[0].borderColor = color;

    progressChart.update();
}
