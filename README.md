# Turing — NSW Advanced & Extension Mathematics

AI-powered maths platform. PWA — access in browser, install to device. Limited offline access; core features need a connection.

---

## Prerequisites

- Node.js 18+
- Python 3.11+
- Gemini API key (optional — falls back to rubric marker)

---

## Install & Run

### 1. Frontend

```
npm install
npm run dev
```

Runs on http://localhost:5173

Create `.env` in project root if using Google Sign-In:

```
VITE_GOOGLE_CLIENT_ID=your-client-id
```

### 2. Backend

```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```
GEMINI_API_KEY=your-key
```

```
python app.py
```

Runs on http://localhost:5000

### 3. Seed question bank (optional)

```
cd backend
python seed_question_bank.py
```

### 4. Ingest PDF worksheets (optional)

Drop PDFs into `backend/pdf_input/` then:

```
run_ingestion.bat
```

---

## Verify

Visit http://localhost:5000/api/health → `{"status": "ok"}`
