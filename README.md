# 📚 StudyGenie AI Pro

**AI-powered study assistant — upload a PDF and get instant summaries, interactive flashcards, scored quizzes, formula sheets, and more.**

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Dify](https://img.shields.io/badge/Powered%20by-Dify-E50914?style=flat)

---

## ✨ Features

- 📄 **Summary** — turns your notes into a clean, structured study summary
- 📒 **Formula Sheet** — extracts formulas, equations, and key definitions
- 🧠 **Interactive Flashcards** — real flip cards (not just text), with a shuffle button
- ❓ **Interactive MCQ Quiz** — click an answer, see it scored live, retry anytime
- 📅 **Study Planner** — builds a 7-day study timetable
- 👶 **Explain Like I'm 10** — simplifies dense material into plain English
- 🎯 **Expected Questions** — predicts likely exam questions by mark weight
- 🕘 **History** — every generation is saved locally; revisit it later with zero extra AI calls, with search to filter by title
- 💾 **Session restore** — your uploaded notes survive a page refresh
- 🖨️ **Save as PDF** — clean, print-ready export of any output
- 🔊 Text-to-speech playback of any generated output
- 📊 Live dashboard chart tracking pages/flashcards/MCQs generated
- 🌗 Light/dark mode with saved preference
- 🎉 Confetti on successful uploads and generations
- 📱 Fully responsive, mobile-friendly layout

## 🖥️ Tech Stack

- Vanilla HTML / CSS / JavaScript — no framework, no build step
- [PDF.js](https://mozilla.github.io/pdf.js/) for in-browser PDF text extraction
- [Chart.js](https://www.chartjs.org/) for the progress dashboard
- [Dify](https://dify.ai/) as the AI backend
- `localStorage` for session/history persistence — no database required

## 📁 Project Structure

```
studygenie-ai-pro/
├── index.html      # Page structure and layout
├── style.css        # Styling — dark theme, responsive, animations
├── config.js         # Your Dify API key + app settings
├── script.js       # PDF parsing, Dify calls, all AI features, history
└── README.md
```

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/sakshampatil142/studygenie-ai-pro.git
cd studygenie-ai-pro
```

### 2. Configure your Dify app

Open `config.js` and set:

```js
const DIFY_API_KEY = "your-dify-api-key";
const DIFY_APP_TYPE = "chat"; // or "completion" — see note below
```

- Get your key from Dify → your app → **API Access** → Secret Key.
- `DIFY_APP_TYPE` must match your app type in Dify:
  - `"chat"` for a Chatbot / Chatflow / Agent app
  - `"completion"` for a Text Generation app

  Check the **API Access** page in Dify — the page title tells you which
  one you have ("Chat App API" vs "Text Generation App API").
- Make sure your app is **published** in Dify (not just saved as a draft) —
  unpublished apps return `App unavailable` when called.

### 3. Run it

Don't just double-click `index.html` — some browsers block API requests
from `file://` pages. Serve it locally instead:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## 🔧 Troubleshooting

| Error | Cause |
|---|---|
| `DIFY_APP_TYPE is not defined` | Stale `config.js` — make sure the file actually saved/deployed, then hard-refresh. |
| `query is required in input form` | Wrong `DIFY_APP_TYPE` for your app, or the app's Start node has a required input field. |
| `App unavailable, please check your app configurations` | App isn't published in Dify, key doesn't match the app, or wrong endpoint for the app type. |
| `Could not reach Dify (network/CORS error)` | You're opening via `file://` — serve it locally (see above), or deploy behind a backend proxy. |
| Flashcards/MCQs fall back to plain text | The AI didn't return valid JSON for that request — usually resolves itself on retry. |
| Any other `HTTP 4xx/5xx` | The exact status and Dify's message are shown directly in the output box. |

## ⚠️ Security Note

`DIFY_API_KEY` ships in client-side JS, so it's visible to anyone who views
your page source. That's fine for local development, but **before
deploying this publicly**, route requests through a small backend/serverless
function that holds the key server-side, and call that from the frontend
instead of hitting `api.dify.ai` directly.

## 📄 License

Add a license of your choice (e.g. [MIT](https://choosealicense.com/licenses/mit/)) before publishing publicly.

## 🤝 Contributing

Issues and PRs welcome — open one if you spot a bug or want to add a feature.
