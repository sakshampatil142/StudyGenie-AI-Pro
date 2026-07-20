// ============================================
// StudyGenie AI Pro — config.js
// ============================================

// ⚠️ SECURITY WARNING
// This key is sent to the browser, so anyone who views page source
// can copy it and use your Dify quota. For a real deployment, put
// this key in a small backend/serverless function instead and have
// the frontend call that function, not Dify directly.
const DIFY_API_KEY = "app-isej4Lh1XekP7wq3BhYebFYF";

// Set this to match how your Dify app was built:
//   "completion" -> Text Generation app (no conversation, single prompt in / text out)
//   "chat"       -> Chatbot / Agent / Chatflow app (has a conversation)
// Not sure which one you have? Open your app in the Dify dashboard —
// the app type is shown at the top, and the "Access API" page shows
// the exact endpoint it expects. "query is required in input form"
// is the error you get when this is set wrong, so if it comes back
// after you flip this, that error is telling you your app also
// needs a specific INPUT FIELD name other than "query" — check the
// app's "Input Field" / prompt variables settings for the real name.
const DIFY_APP_TYPE = "chat";

const DIFY_BASE_URL = "https://api.dify.ai/v1";

const DIFY_URL =
    DIFY_APP_TYPE === "chat"
        ? `${DIFY_BASE_URL}/chat-messages`
        : `${DIFY_BASE_URL}/completion-messages`;