# Phase 1 MVP Implementation Plan for Claude

This document contains **detailed instructions** for Claude to begin coding the Phase 1 Minimum Viable Product of our AI-First Accounting App. Drop this file into VS Code and follow each section closely.

---

## 1. Overview & Goals

* **No auth system**: Skip authentication for this demo.
* **AI-First UX**: Showcase key AI-powered flows with real-time animations.
* **Duration**: Build core features for an in-meeting demo within \~3 hours.

### 1.1 Key Demo Flows

1. **AI Import Modal**: Full-screen, glassmorphic modal with a typewriter animation showing AI populating fields from an uploaded document (DOCX/PDF/Excel).
2. **Receipt-to-Expense**: Upload a receipt image → OCR → AI parses → populates an expense form with typing effect.
3. **NL Command Parser**: In the AI chat drawer, type a command (e.g., "Add a \$200 software expense for Acme on Aug 5") → AI parses and creates the transaction.
4. **AI Assistant Chat**: Unique overlay drawer with glassmorphic backdrop; user queries like “What’s my profit this month?” and AI replies using data.
5. **Dashboard KPIs**: 3–4 metrics (Revenue, Expenses, Net Profit) with Framer Motion animations and Lottie background effects.

---

## 2. Tech Stack & Libraries

| Layer            | Technology                               |
| ---------------- | ---------------------------------------- |
| **Frontend**     | React (TypeScript) with Vite             |
| **Styling**      | Tailwind CSS + shadcn/ui                 |
| **Animations**   | Framer Motion + Lottie                   |
| **3D Effects**   | Three.js (subtle background)    |
| **Data Viz**     | Recharts (or Visx)                       |
| **State/Cache**  | React Query                              |
| **AI Endpoint**  | Gemini 2.0 Flash via our `/api/ai` proxy |
| **OCR**          | Tesseract.js (or Google Vision API stub) |
| **HTTP Client**  | Axios                                    |
| **Back-End**     | Node.js + Express (single `server.js`)   |
| **Database**     | SQLite (demo mode) with Prisma ORM       |
| **File Storage** | Local `uploads/` folder                  |

---

## 3. Project Structure

```
/phase1-mvp
├─ /src
│  ├─ /components
│  │  ├─ AiImportModal.tsx
│  │  ├─ ReceiptUpload.tsx
│  │  ├─ ExpenseForm.tsx
│  │  ├─ ChatDrawer.tsx
│  │  ├─ Dashboard.tsx
│  ├─ /hooks
│  │  └─ useAi.ts
│  ├─ /pages
│  │  └─ index.tsx
│  ├─ api.ts
│  └─ App.tsx
├─ /server
│  └─ server.js
├─ prisma/schema.prisma
├─ tailwind.config.js
└─ vite.config.ts
```

---

## 4. Backend: `/server/server.js`

1. **Express App** listening on port 4000.
2. **Endpoints**:

   * `POST /api/ai/generate` → proxies to Gemini endpoint using provided API key.
   * `POST /api/ocr` → accepts file upload, runs Tesseract, returns raw text.
   * `POST /api/expenses` → creates expense in SQLite DB.
   * `GET /api/dashboard` → returns aggregated KPI data.
3. **Gemini Proxy**:

   ```js
   app.post('/api/ai/generate', async (req, res) => {
     const { prompt } = req.body;
     const response = await axios.post(
       'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
       { prompt },
       { headers: { 'Authorization': 'Bearer AIzaSyAeYLOEC29HIYE0lu-0yc7zi9BUkXAKOB4' } }
     );
     res.json(response.data);
   });
   ```
4. **DB Setup**:

   * Use Prisma to define models: User (skip), Company (skip), Expense, Invoice, Account, Transaction.
   * SQLite file at `dev.db`.

---

## 5. Frontend Components

### 5.1 AiImportModal.tsx

* Full-screen modal with:

  * **Glassmorphic backdrop** (semi-transparent, blurred).
  * **File input** for DOCX/PDF/Excel.
  * **Lottie animation** centered indicating “AI analyzing…”.
  * On `onUpload`: call `/api/ocr`, then `/api/ai/generate` with OCR text and instructions to extract fields.
  * As fields come back, animate each `<Input>` filling via Framer Motion typewriter effect.
  * Show a “Confirm” button that saves data via `POST /api/expenses`.

### 5.2 ReceiptUpload.tsx + ExpenseForm.tsx

* **ReceiptUpload**: drag-and-drop or click-to-upload; preview image.
* After upload: show loading animation, then render **ExpenseForm**.
* **ExpenseForm** props: pre-filled fields (vendor, date, amount, category).
* Fields animate in one-by-one (use Framer Motion’s stagger). User can edit.

### 5.3 ChatDrawer.tsx

* Icon/button fixed bottom-right with pulse animation (encourage voice).
* On click: render an **overlay glassmorphic drawer** sliding in from right.
* Drawer contains a chat history area and an input bar.
* On form submit: send message to `/api/ai/generate` with context and data payload.
* Display AI responses in typed effect bubbles.
* Parser: if AI response includes `ACTION: createExpense(...)`, trigger relevant API call and show confirmation toast.

### 5.4 Dashboard.tsx

* Fetch `/api/dashboard` on mount; display:

  * **Metric Cards** for Revenue, Expenses, Net Profit.
  * Use Recharts for a sparkline under each card.
  * Background: subtle Three.js animated particles lazered behind cards (optional stub).
* At top: run an AI prompt `"Summarize this month’s finances"`; show result in a motion-faded text box.

---

## 6. Animations & Effects

* **Framer Motion**:

  * `motion.div` with `initial={{ opacity:0, y:20 }}` `animate={{ opacity:1, y:0 }}` for field entry.
  * Typewriter effect: custom hook using `setInterval` to reveal text char-by-char.
  * Staggered children in form with `variants`.
* **Lottie**:

  * Use `react-lottie` to display a loading AI/robot animation in import modal.
* **Kinetic Scrolling**:

  * Apply `overflow-scroll` with `scroll-snap` and momentum settings for lists.

---

## 7. Development Workflow

1. **Setup**: `npm init && npm install` (React, Tailwind, Framer Motion, Axios, Express, Prisma, Tesseract.js, react-lottie, Recharts).
2. **Prisma**: define schema, run `npx prisma migrate dev`.
3. **Backend**: implement `server.js`, test endpoints with Postman.
4. **Frontend**: scaffold `App.tsx` and pages, integrate Tailwind, set up routing to show Dashboard.
5. **Components**: build in order: Dashboard → ChatDrawer → ReceiptUpload/ExpenseForm → AiImportModal.
6. **Animations**: add Framer Motion to each component as it’s built.
7. **Demo Prep**: populate SQLite with sample data, record a quick demo flow.

---

> **Note**: This plan is ambitious for a 3-hour demo. Focus on **ReceiptUpload → ExpenseForm → ChatDrawer** flows first, then visual polish on Dashboard.

---

**Ready, Claude? Let’s code this futuristic AI-First accounting demo!**
