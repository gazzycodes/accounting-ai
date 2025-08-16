Phase 1 MVP Implementation Plan for Claude

App Name (Placeholder): EZE Ledger

A working prototype of EZE Ledger, our AI‑First accounting web app. In this MVP, focus on showcasing cutting‑edge AI automation and a futuristic UX to impress stakeholders in a 3‑hour demo. No authentication; data is demo‑only.

1. High‑Level Vision & Context

EZE Ledger is designed as the next‑gen QuickBooks alternative: a B2B & accountant‑friendly cloud platform that:

Automates bookkeeping via AI (Gemini 2.0 Flash).

Presents a Dopamine UI: electric purple accents, glassmorphic overlays, kinetic scrolling, rich animations.

Feels futuristic: live typing animations, interactive flows, voice‑encouraging prompts.

Supports core accounting: invoices, expenses, reports—simplified, every step AI‑assisted.

Phase 1 Goals:

Demo Key AI‑First Flows: Receipt‑to‑expense, natural‑language commands, AI chat insights, and document import.

Showcase Futuristic UI: Full‑screen AI import modal, animated forms, chat drawer overlay, animated KPI dashboard.

Tech Stub Implementation: Skip auth; use in‑memory or SQLite database for demo data; proxy Gemini & OCR endpoints.

2. Core Demo Flows & Descriptions

2.1 AI Import Modal

Trigger: "AI Import" button in header.

Behavior: Opens a full‑screen glassmorphic modal.

Upload: Accept DOCX, PDF, XLSX. User selects file.

Animation: Central Lottie AI‑brain animation.

Process:

POST /api/ocr → extract text.

POST /api/ai/generate with OCR text + prompt: “Extract vendor, date, amount, line items, categories, due date.”

Field Population: For each returned field, animate a typewriter effect into corresponding <Input> using Framer Motion.

Custom Fields: Show an “Add Field” button; new field integrates into form schema.

Save: “Confirm” button → POST /api/expenses (for expense import) or invoices accordingly.

2.2 Receipt‑to‑Expense Flow

Upload Widget: In Dashboard, select “Add Expense” → displays ReceiptUpload component.

Drag & Drop: User drops image; preview shown.

Processing Animation: Pulse/loader + Lottie.

AI Actions: OCR → AI extracts vendor, date, amount → pre‑fill ExpenseForm.

Form Animation: Staggered inputs animate in; each field types in.

User Edit & Submit: Edit if needed → click “Save” → expense stored.

2.3 Natural‑Language Command Parser

Chat Drawer: Fixed chat bubble bottom‑right with pulse (encourages voice mode).

Open Drawer: Glassmorphic overlay slides in from right (push vs overlay, choose overlay).

Input: User types text command.

API Call: POST /api/ai/generate with context + "Parse this into an expense/invoice creation."

Action Execution: If AI response contains structured action directive, app triggers corresponding API (e.g. POST /api/expenses).

Feedback: Show toast or inline confirmation in chat.

2.4 AI Assistant Chat Insights

Use Case: Ask “What’s my profit this month?” or “Show me total expenses by category.”

Mechanics: Text query → AI call → response rendered with typed‑out animation.

Data Integration: The AI prompt includes current KPI data fetched from /api/dashboard to generate accurate answers.

2.5 Animated KPI Dashboard

Metrics: Total Revenue, Total Expenses, Net Profit, and one sparkline each.

Data: Fetch /api/dashboard.

UI: Card grid; each card animates into view (spring‑based).

Background: Optional Three.js particle animation under cards.

Summary: On load, trigger AI prompt "Summarize these metrics in a sentence"; display result in a motion‑faded text banner.

3. UX & Animation Guidelines

Dopamine UI: Electric purple accents, glass blur backdrops, subtle gradients.

Kinetic Scrolling: Use scroll-snap and momentum for lists.

Framer Motion Patterns:

Modal & Drawer: initial={{opacity:0,y:50}} animate={{opacity:1,y:0}}.

Field Stagger: Use variants with staggerChildren.

Typewriter: Custom hook to incrementally reveal text.

Lottie Assets: Use AI/robot brain animations for loading states.

Glassmorphism:

backdrop-filter: blur(20px); background: rgba(255,255,255,0.1);

Voice Mode Prompt: Pulse effect on chat bubble; clicking toggles (not required in demo but hint!).

4. Tech Stack & Quick Setup

Front-End: React + Vite + TypeScript.

Styling: Tailwind CSS + shadcn/ui.

Animations: Framer Motion + react-lottie + Three.js (optional).

Charts: Recharts.

State: React Query + Axios.

Back-End: Express (single server.js) on port 4000.

DB: SQLite via Prisma ORM (demo dev.db).

OCR: Tesseract.js stub or Google Vision API.

AI: Proxy at /api/ai/generate to Gemini endpoint.

Environment Variables:

GEMINI_API_KEY=AIzaSyAeYLOEC29HIYE0lu-0yc7zi9BUkXAKOB4

5. Recommended Directory Structure

/phase1-mvp
├─ /src
│  ├─ /components
│  │  ├─ AiImportModal.tsx
│  │  ├─ ReceiptUpload.tsx
│  │  ├─ ExpenseForm.tsx
│  │  ├─ ChatDrawer.tsx
│  │  ├─ Dashboard.tsx
│  ├─ /hooks
│  │  └─ useTypewriter.ts
│  ├─ /pages
│  │  └─ index.tsx
│  ├─ api.ts
│  └─ App.tsx
├─ /server
│  └─ server.js
├─ prisma/schema.prisma
├─ tailwind.config.js
└─ vite.config.ts

Claude: Let’s turn this into code. Prioritize the flows in Section 2 in the order listed. Focus on functionality first, then visuals. Good luck!

