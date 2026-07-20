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

let activeTypeInterval = null;

function typeWriter(text) {
    if (activeTypeInterval) {
        clearInterval(activeTypeInterval);
        activeTypeInterval = null;
    }

    output.innerHTML = "";
    updateOutputMeta("", false);
    let i = 0;
    const speed = 8;

    activeTypeInterval = setInterval(() => {
        output.innerHTML += text.charAt(i);
        i++;
        if (i >= text.length) {
            clearInterval(activeTypeInterval);
            activeTypeInterval = null;
            updateOutputMeta(text, false);
        }
    }, speed);
}

function updateOutputMeta(text, isPreCounted) {
    const meta = document.getElementById("outputMeta");
    if (!meta) return;

    if (!text) {
        meta.innerText = "";
        return;
    }

    if (isPreCounted) {
        meta.innerText = text;
        return;
    }

    const words = text.trim().split(/\s+/).filter(Boolean).length;
    meta.innerText = `${words} words`;
}

function printOutput() {
    window.print();
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
        localStorage.setItem(
            "studygenie_notes",
            JSON.stringify({ notes, pages: topics ? topics.innerText : "" })
        );
    } catch (err) {
        console.warn("Could not save notes locally:", err);
    }
}

function restoreSession() {
    try {
        const raw = localStorage.getItem("studygenie_notes");
        if (!raw) return;

        let savedNotes = "";
        let savedPages = "";

        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && parsed.notes) {
                savedNotes = parsed.notes;
                savedPages = parsed.pages || "";
            } else {
                savedNotes = raw;
            }
        } catch (e) {
            // Older save format was a plain string, not JSON
            savedNotes = raw;
        }

        if (!savedNotes) return;

        notes = savedNotes;
        uploaded = true;
        if (topics && savedPages) topics.innerText = savedPages;

        output.innerHTML = `
            <h2>📂 Restored Previous Notes</h2>
            <br>
            <p>${savedPages ? "Pages : " + savedPages : "Your previously uploaded notes are ready."}</p>
            <br>
            Click any AI feature, or upload a new PDF to replace these notes.
        `;

        updateChart();
    } catch (err) {
        console.warn("Could not restore saved notes:", err);
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
        fireConfetti();
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

let isGenerating = false;

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
}

// AI responses sometimes wrap JSON in ```json fences or add stray text
// around it — pull out the array and parse it, returning null on failure
// so callers can fall back to plain text instead of crashing.
function tryParseJSONArray(text) {
    if (typeof text !== "string") return null;

    let cleaned = text.trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
        cleaned = cleaned.slice(start, end + 1);
    }

    try {
        const parsed = JSON.parse(cleaned);
        return Array.isArray(parsed) ? parsed : null;
    } catch (err) {
        console.warn("Could not parse AI response as JSON:", err);
        return null;
    }
}

// Like runAI, but expects a JSON array back and hands it to renderFn to
// build interactive UI. If parsing fails, or renderFn rejects the shape
// (returns false), it falls back to showing the raw text so nothing breaks.
async function runAIStructured(title, instruction, renderFn, featureName, historyType) {
    if (!checkPDF()) return;

    if (isGenerating) {
        alert("Please wait for the current request to finish.");
        return;
    }

    isGenerating = true;
    loading(title);

    const prompt = `
${instruction}

-----------------------

Study Notes:

${notes}
`;

    try {
        const answer = await askAI(prompt);
        stopLoading();

        if (typeof answer === "string" && answer.startsWith("❌")) {
            typeWriter(answer);
            return;
        }

        const parsed = tryParseJSONArray(answer);
        const rendered = parsed ? renderFn(parsed) : false;

        if (!rendered) {
            // Fallback: AI didn't return valid/expected JSON — show as text
            typeWriter(answer);
        } else {
            fireConfetti();
            saveHistoryEntry({ type: historyType, title: featureName || title, data: parsed });
        }

        updateChart();
    } finally {
        isGenerating = false;
    }
}

async function runAI(title, instruction, featureName) {
    if (!checkPDF()) return;

    if (isGenerating) {
        alert("Please wait for the current request to finish.");
        return;
    }

    isGenerating = true;
    loading(title);

    const prompt = `
${instruction}

-----------------------

Study Notes:

${notes}
`;

    try {
        const answer = await askAI(prompt);
        showResult(answer);
        updateChart();

        if (typeof answer === "string" && !answer.startsWith("❌")) {
            fireConfetti();
            saveHistoryEntry({ type: "text", title: featureName || title, data: answer });
        }
    } finally {
        isGenerating = false;
    }
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

Keep it easy to revise.`,
        "Summary"
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

Do NOT summarize. Arrange neatly.`,
        "Formula Sheet"
    );
}

function renderFlashcards(data) {
    const valid = data.filter(
        (item) => item && typeof item.q === "string" && typeof item.a === "string"
    );
    if (valid.length === 0) return false;

    let html = `
    <div class="flashcard-toolbar">
        <span class="flashcard-hint">💡 Click a card to flip it</span>
        <button id="flashcardShuffleBtn" class="flashcard-shuffle-btn">🔀 Shuffle</button>
    </div>
    <div class="flashcard-grid">`;

    valid.forEach((item, i) => {
        html += `
        <div class="flashcard" data-index="${i}">
            <div class="flashcard-inner">
                <div class="flashcard-face flashcard-front">
                    <span class="flashcard-label">Q${i + 1}</span>
                    <p>${escapeHtml(item.q)}</p>
                </div>
                <div class="flashcard-face flashcard-back">
                    <span class="flashcard-label">A${i + 1}</span>
                    <p>${escapeHtml(item.a)}</p>
                </div>
            </div>
        </div>`;
    });

    html += `</div>`;
    output.innerHTML = html;

    output.querySelectorAll(".flashcard").forEach((card) => {
        card.addEventListener("click", () => card.classList.toggle("flipped"));
    });

    const shuffleBtn = document.getElementById("flashcardShuffleBtn");
    if (shuffleBtn) {
        shuffleBtn.addEventListener("click", () => {
            const shuffled = [...valid].sort(() => Math.random() - 0.5);
            renderFlashcards(shuffled);
        });
    }

    if (flashCount) flashCount.innerText = String(valid.length);
    updateOutputMeta(`${valid.length} flashcards`, true);

    return true;
}

function renderMCQQuiz(data) {
    const valid = data.filter(
        (item) =>
            item &&
            typeof item.q === "string" &&
            Array.isArray(item.options) &&
            item.options.length >= 2 &&
            Number.isInteger(item.correct) &&
            item.correct >= 0 &&
            item.correct < item.options.length
    );
    if (valid.length === 0) return false;

    let html = `
        <div class="quiz-header">
            <span>Score: <span id="quizScore">0</span> / ${valid.length}</span>
            <button id="quizRetryBtn" class="quiz-retry-btn">🔄 Retry</button>
        </div>
        <div class="quiz-list">
    `;

    valid.forEach((item, i) => {
        html += `<div class="quiz-question" data-correct="${item.correct}">
            <p class="quiz-q-text">${i + 1}. ${escapeHtml(item.q)}</p>
            <div class="quiz-options">`;

        item.options.forEach((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            html += `<button class="quiz-option" data-idx="${idx}">${letter}) ${escapeHtml(opt)}</button>`;
        });

        html += `</div></div>`;
    });

    html += `</div>`;
    output.innerHTML = html;

    let score = 0;
    const scoreEl = document.getElementById("quizScore");

    output.querySelectorAll(".quiz-question").forEach((qEl) => {
        const correctIdx = parseInt(qEl.dataset.correct, 10);
        const buttons = qEl.querySelectorAll(".quiz-option");

        buttons.forEach((btn) => {
            btn.addEventListener("click", () => {
                if (qEl.dataset.answered) return;
                qEl.dataset.answered = "true";

                const chosenIdx = parseInt(btn.dataset.idx, 10);
                buttons.forEach((b) => (b.disabled = true));
                buttons[correctIdx].classList.add("quiz-correct");

                if (chosenIdx === correctIdx) {
                    score++;
                } else {
                    btn.classList.add("quiz-wrong");
                }

                if (scoreEl) scoreEl.innerText = String(score);
            });
        });
    });

    const retryBtn = document.getElementById("quizRetryBtn");
    if (retryBtn) {
        retryBtn.addEventListener("click", () => renderMCQQuiz(valid));
    }

    if (mcqCount) mcqCount.innerText = String(valid.length);
    updateOutputMeta(`${valid.length} questions`, true);

    return true;
}

async function generateFlashcards() {
    await runAIStructured(
        "🧠 Creating Flashcards...",
        `Respond with ONLY a valid JSON array — no markdown code fences, no commentary, nothing before or after it.

Format exactly like this:
[{"q":"question text","a":"concise answer text"}, ...]

Generate exactly 10 flashcards based on the study notes below.`,
        renderFlashcards,
        "Flashcards",
        "flashcards"
    );
}

async function generateQuiz() {
    await runAIStructured(
        "❓ Generating MCQs...",
        `Respond with ONLY a valid JSON array — no markdown code fences, no commentary, nothing before or after it.

Format exactly like this:
[{"q":"question text","options":["option A","option B","option C","option D"],"correct":0}, ...]

"correct" is the zero-based index of the right option in "options".
Generate exactly 10 multiple choice questions, easy to medium difficulty, based on the study notes below.`,
        renderMCQQuiz,
        "MCQ Quiz",
        "quiz"
    );
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
Estimated Study Hours.`,
        "Study Planner"
    );
}

async function explainSimple() {
    await runAI(
        "👶 Simplifying Notes...",
        `Explain these notes like I'm 10 years old.

Use simple English, examples, and daily-life analogies.
Avoid technical words.`,
        "Explain Simply"
    );
}

async function expectedQuestions() {
    await runAI(
        "🎯 Predicting Questions...",
        `Generate 10 Expected University Questions.

Mix: 2 Marks, 5 Marks, 10 Marks.
Also mention which topics are most important.`,
        "Expected Questions"
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
                    backgroundColor: "#e50914",
                    borderColor: "#e50914",
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
    const color = isLight ? "#b20710" : "#e50914";
    progressChart.data.datasets[0].backgroundColor = color;
    progressChart.data.datasets[0].borderColor = color;

    progressChart.update();
}

// ----------------------------
// Scroll Reveal
// ----------------------------

{
    const revealTargets = document.querySelectorAll(
        ".card, .feature, .testimonial, .dash-card"
    );

    if (revealTargets.length && "IntersectionObserver" in window) {
        const revealObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("reveal");
                        revealObserver.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15 }
        );

        revealTargets.forEach((el) => revealObserver.observe(el));
    } else {
        // Fallback: just show everything if IntersectionObserver isn't supported
        revealTargets.forEach((el) => el.classList.add("reveal"));
    }
}

// ----------------------------
// Confetti
// ----------------------------

function fireConfetti() {
    const container = document.getElementById("confetti");
    if (!container) return;

    const colors = ["#e50914", "#b20710", "#ffffff", "#ffd166", "#3a3a3a"];
    const pieceCount = 60;

    for (let i = 0; i < pieceCount; i++) {
        const piece = document.createElement("div");
        piece.className = "confetti-piece";
        piece.style.left = Math.random() * 100 + "vw";
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = 2 + Math.random() * 1.5 + "s";
        piece.style.animationDelay = Math.random() * 0.3 + "s";
        container.appendChild(piece);

        // Clean up after the animation finishes so the DOM doesn't grow forever
        piece.addEventListener("animationend", () => piece.remove());
    }
}

// ----------------------------
// Sidebar / Footer Navigation
// ----------------------------

{
    const sidebarItems = document.querySelectorAll("#sidebarNav li[data-target]");
    const footerItems = document.querySelectorAll(".footer-nav li[data-target]");

    function scrollToTarget(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    sidebarItems.forEach((item) => {
        item.addEventListener("click", () => {
            sidebarItems.forEach((li) => li.classList.remove("active"));
            item.classList.add("active");
            scrollToTarget(item.dataset.target);
        });
    });

    footerItems.forEach((item) => {
        item.addEventListener("click", () => {
            scrollToTarget(item.dataset.target);
        });
    });

    // Keep the sidebar's "active" state in sync with whichever section
    // is actually in view as the user scrolls, not just the last click
    const sectionIds = [...new Set(
        [...sidebarItems].map((li) => li.dataset.target)
    )];

    const sections = sectionIds
        .map((id) => document.getElementById(id))
        .filter(Boolean);

    if (sections.length && "IntersectionObserver" in window) {
        const navObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        sidebarItems.forEach((li) => {
                            li.classList.toggle(
                                "active",
                                li.dataset.target === entry.target.id
                            );
                        });
                    }
                });
            },
            { rootMargin: "-40% 0px -50% 0px" }
        );

        sections.forEach((el) => navObserver.observe(el));
    }
}

// ----------------------------
// History
// ----------------------------

const HISTORY_KEY = "studygenie_history";
const HISTORY_LIMIT = 20;

function loadHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (err) {
        console.warn("Could not read history:", err);
        return [];
    }
}

function saveHistoryEntry(entry) {
    try {
        const history = loadHistory();
        history.unshift({
            id: Date.now(),
            savedAt: new Date().toISOString(),
            ...entry
        });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
        renderHistoryList();
    } catch (err) {
        console.warn("Could not save history entry:", err);
    }
}

function renderHistoryList(filter) {
    const container = document.getElementById("historyList");
    if (!container) return;

    let history = loadHistory();

    if (filter) {
        const q = filter.trim().toLowerCase();
        history = history.filter((entry) => entry.title.toLowerCase().includes(q));
    }

    if (history.length === 0) {
        container.innerHTML = filter
            ? `<p class="history-empty">No matching history items.</p>`
            : `<p class="history-empty">Nothing here yet — generate something and it'll show up in History.</p>`;
        return;
    }

    container.innerHTML = history
        .map((entry) => {
            const date = new Date(entry.savedAt);
            const label =
                date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
                " · " +
                date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

            return `
            <div class="history-item">
                <div class="history-item-info">
                    <span class="history-item-title">${escapeHtml(entry.title)}</span>
                    <span class="history-item-date">${label}</span>
                </div>
                <div class="history-item-actions">
                    <button onclick="viewHistoryEntry(${entry.id})">View</button>
                    <button onclick="deleteHistoryEntry(${entry.id})">Delete</button>
                </div>
            </div>`;
        })
        .join("");
}

function viewHistoryEntry(id) {
    const entry = loadHistory().find((e) => e.id === id);
    if (!entry) return;

    if (entry.type === "flashcards") {
        renderFlashcards(entry.data);
    } else if (entry.type === "quiz") {
        renderMCQQuiz(entry.data);
    } else {
        typeWriter(entry.data);
    }

    const outputSection = document.querySelector(".output-section");
    if (outputSection) outputSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteHistoryEntry(id) {
    const history = loadHistory().filter((e) => e.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistoryList();
}

function clearHistory() {
    if (!confirm("Clear all saved history? This can't be undone.")) return;
    localStorage.removeItem(HISTORY_KEY);
    renderHistoryList();
}

const historySearchInput = document.getElementById("historySearch");
if (historySearchInput) {
    historySearchInput.addEventListener("input", () => {
        renderHistoryList(historySearchInput.value);
    });
}

renderHistoryList();
restoreSession();