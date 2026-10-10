# techiemuthuraj Files - Telegram File Access & Token-Gated Download Management System

A production-grade, secure web application and administrative management system designed to deliver files, APKs, developer tools, software packages, and digital resources published on the **@techiemuthuraj** Telegram channel through cryptographically validated, single-use, or limited-use access tokens.

---

## 🌟 Key Features

### 1. Public Digital Assets Portal
- **Dark-First SaaS Aesthetic**: Obsidian/charcoal design with electric cyan and indigo accents, glass cards, and instant light/dark mode toggling.
- **Dynamic File Catalog**: Fast search with debounce, category filtering (Software, APK, Tools, Scripts), file type badges, sizes, and real-time download counters.
- **Quick-Unlock Modal**: Verify tokens and unlock direct file downloads in seconds without leaving the catalog.
- **Dedicated File Specifications Pages**: Individual file pages (`/file.html?id=TM-APK-901`) with version history, technical specs, and interactive verification cards.

### 2. High-Assurance Token-Gated Security
- **Cryptographic Token Hashing**: Plaintext tokens are **never** stored in the database. Only one-way **SHA-256** hashes are stored.
- **Atomic Concurrency Protection**: Server-side PostgreSQL row-level locks (`FOR UPDATE` / memory mutex) eliminate race conditions, guaranteeing that simultaneous download requests cannot exceed configured limits.
- **Short-Lived Signed Download Tickets**: Upon successful token validation, the backend issues an **HMAC-SHA256 signed download ticket** valid for 5 minutes.
- **Brute-Force Rate Limiting**: Verification attempts are throttled per IP with automatic cooldowns.
- **Zero Token Leakage in Logs**: Security audit logs record only truncated token previews (`TM-DEMO-****-2026`) and anonymized IP hashes.

### 3. Comprehensive Admin Dashboard
- **Executive Overview**: Real-time KPI statistics (Total Files, Active Tokens, Total Downloads, Rejected Attempts, Top Downloaded Resources).
- **File Management**: Create, edit, delete, and archive resources with custom codes, versioning, and download links.
- **Bulk Token Generator**: Issue up to 100 cryptographically random tokens (`TM-XXXX-XXXX-XXXX`) at once with custom limits (single-use, multi-use, unlimited) and expiration dates.
- **One-Click Export**: Copy generated tokens or export them directly as CSV or JSON.
- **User Tracking**: Monitor download allocations and activity per user or channel subscriber.
- **Security Audit Logs**: Real-time log of authorizations, file deliveries, expired tokens, revocations, and rate limit events.

### 4. Telegram Integration & Channel Mirroring
- **Server-Side Bot Proxy**: Proxies Telegram Bot API file streams without exposing your `TELEGRAM_BOT_TOKEN` in client-side code.
- **Channel Post Link Mapper**: Paste any message link (e.g. `https://t.me/techiemuthuraj/412`) to automatically register it in the catalog.
- **Clear Documentation of Telegram Limits**: Built-in guidance explaining the Bot API 20MB limit and cloud storage workarounds for larger files.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript | Responsive, no frameworks (no React/Vue/Angular), Google Fonts (Inter + Outfit). |
| **Backend** | Netlify Functions (Node.js) | Serverless endpoints for verification, downloads, CRUD, and Telegram sync. |
| **Database** | Supabase (PostgreSQL) | Complete SQL migration with Row Level Security (RLS) and atomic RPC functions. |
| **Local Runtime** | Node.js HTTP Server (`server.js`) | Zero-dependency local dev server supporting both mock and live Supabase modes. |
| **Security** | Node.js `crypto` | `crypto.randomBytes`, SHA-256, HMAC-SHA256, constant-time comparisons. |

---

## 📁 Project Directory Structure

```
├── public/
│   ├── index.html                  # Public File Portal (Hero, Catalog, Filters, How it works)
│   ├── file.html                   # Dedicated File Details & Token Verification / Secure Download
│   ├── admin.html                  # Admin Dashboard (Overview, Files, Tokens, Users, Logs, Telegram Sync)
│   ├── css/
│   │   ├── style.css               # Core design system tokens, typography, dark/light mode, utilities
│   │   ├── portal.css              # Public portal styles (Hero, cards, modals, search, badges)
│   │   └── admin.css               # Admin dashboard layout (Sidebar, stats, tables, modals, forms)
│   └── js/
│       ├── config.js               # Frontend API endpoints config & helpers
│       ├── portal.js               # Public portal logic (catalog, search, filters, token modal)
│       ├── file.js                 # Dedicated file page token verification & secure download trigger
│       ├── admin.js                # Full admin dashboard SPA logic (tabs, CRUD, bulk gen, logs, export)
│       └── utils.js                # Toast notifications, formatters, copy-to-clipboard, theme switcher
├── netlify/
│   └── functions/
│       ├── files.js                # GET public files, GET file details, POST/PUT/DELETE admin files
│       ├── verify-token.js         # POST verify token, issue short-lived download authorization ticket
│       ├── download.js             # GET secure download endpoint (validates ticket, streams or redirects)
│       ├── tokens.js               # GET, POST (single/bulk), PUT (revoke) tokens (Admin only)
│       ├── users.js                # GET users, token mapping, revoke (Admin only)
│       ├── logs.js                 # GET activity & download logs (Admin only)
│       ├── overview.js             # GET dashboard KPI metrics & top files (Admin only)
│       ├── telegram-sync.js        # POST sync or map channel posts via Bot API
│       ├── auth.js                 # Admin authentication / login / verify session
│       └── utils/
│           ├── db.js               # Supabase client initialization & local resilient store fallback
│           ├── crypto.js           # Secure token generation, SHA-256 hashing, HMAC signed download tickets
│           ├── auth-middleware.js  # Admin authorization verification & CORS headers
│           ├── rate-limit.js       # IP rate limiting engine
│           └── telegram.js         # Telegram Bot API helper & streaming proxy
├── supabase/
│   ├── schema.sql                  # Complete Supabase SQL migration (tables, indexes, RLS, atomic RPC)
│   └── seed.sql                    # Initial seed data for testing & instant demo setup
├── tests/
│   └── test-suite.js               # Automated integration tests for token validation, limits & concurrency
├── server.js                       # Built-in local development server
├── netlify.toml                    # Netlify deployment configuration with redirects & security headers
├── package.json                    # Project metadata & dependencies
└── .env.example                    # Environment variables documentation
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v18.0.0 or later (v24+ recommended)
- **Git**

### 2. Installation
```bash
git clone <your-repo-url>
cd TELEGRAM
npm install
```

### 3. Start Development Server
```bash
npm start
```
The application will launch at:
- **Public Portal**: [http://localhost:8888/](http://localhost:8888/)
- **File Details Page**: [http://localhost:8888/file.html?id=TM-APK-901](http://localhost:8888/file.html?id=TM-APK-901)
- **Admin Dashboard**: [http://localhost:8888/admin.html](http://localhost:8888/admin.html)

> **Zero-Friction Local Mode**: The application includes a resilient local database engine pre-loaded with sample files and tokens. You can immediately test the complete flow without having to configure external Supabase keys first!

---

## 🧪 Testing Credentials & Demo Tokens

When testing locally or on initial deployment, the following credentials are pre-configured:

| Purpose | Value | Details |
|---|---|---|
| **Admin Secret Key** | `default-admin-password-techiemuthuraj-2026` | Enter into the Admin Login modal or click "Use Default Demo Key". |
| **Demo Token 1** | `TM-DEMO-NETSPEED-2026` | Valid for **TM-APK-901** (NetSpeed Monitor Pro). Allows up to **3 downloads**. |
| **Demo Token 2** | `TM-SINGLE-DEVOPS-9999` | Valid for **TM-TOOL-771** (DevOps Automation Utility). **Single-use only**. |

---

## 🧪 Automated Security Test Suite

Run the full automated test suite verifying all 11 security criteria:

```bash
npm test
```

### Verified Test Cases:
1. `✓ PASS`: Valid token for the correct file succeeds and issues authorization.
2. `✓ PASS`: Token used against wrong file is rejected (`TOKEN_FILE_MISMATCH`).
3. `✓ PASS`: Non-existent invalid token is rejected (`INVALID_TOKEN`).
4. `✓ PASS`: Expired token is rejected (`TOKEN_EXPIRED`).
5. `✓ PASS`: Revoked token is rejected (`TOKEN_REVOKED`).
6. `✓ PASS`: Single-use token exhausts limit after 1 use (`DOWNLOAD_LIMIT_REACHED`).
7. `✓ PASS`: Multi-use token allows exactly configured limit.
8. `✓ PASS`: Concurrent download attempts enforce limit atomically without race condition.
9. `✓ PASS`: Unauthorized admin requests are rejected with `401 Unauthorized`.
10. `✓ PASS`: Authorized admin request succeeds with valid `ADMIN_SECRET_KEY`.
11. `✓ PASS`: Tampered or forged download ticket is rejected with `403 Forbidden`.

---

## 🗄️ Supabase Cloud Database Setup

Follow these steps to connect your project to a live Supabase PostgreSQL database:

1. **Create Supabase Project**:
   - Go to [Supabase](https://supabase.com/) and create a new project.
2. **Execute Database Migration**:
   - In your Supabase Dashboard, navigate to the **SQL Editor**.
   - Open [supabase/schema.sql](file:///c:/Users/Muthuraj/Documents/TELEGRAM/supabase/schema.sql) from this repository, paste the entire content, and click **Run**.
   - (Optional) Open [supabase/seed.sql](file:///c:/Users/Muthuraj/Documents/TELEGRAM/supabase/seed.sql) and run it to populate sample data.
3. **Copy Credentials**:
   - Navigate to **Project Settings** -> **API**.
   - Copy the **Project URL** (e.g. `https://xyzcompany.supabase.co`).
   - Copy the **`service_role` (Secret) Key**.
4. **Configure Environment Variables**:
   - In your `.env` file or Netlify settings, set:
     ```env
     SUPABASE_URL=https://xyzcompany.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=eyJh...your-service-role-key...
     ```
   The backend will automatically detect the credentials and switch to **Live Supabase PostgreSQL** mode!

---

## ✈️ Telegram Bot & Channel Setup

1. **Create Telegram Bot**:
   - Message `@BotFather` on Telegram.
   - Run `/newbot` and follow instructions to get your **Bot API Token** (e.g. `1234567890:ABCdefGHIjkl...`).
2. **Add Bot as Channel Administrator**:
   - Open your Telegram Channel settings.
   - Go to **Administrators** -> **Add Administrator**.
   - Search for your bot username and add it with permissions to **Post Messages** and **Manage Channel**.
3. **Set Environment Variables**:
   ```env
   TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ
   TELEGRAM_CHANNEL_ID=@techiemuthuraj
   ```
4. **Technical Limitations & File Delivery**:
   - **Files <= 20 MB**: Can be streamed directly through the server proxy using Telegram's `getFile` Bot API without exposing the bot token.
   - **Files > 20 MB**: Telegram's Bot API enforces a hard 20 MB download limit. For files larger than 20 MB, store the file in cloud storage (e.g., Cloudflare R2, Supabase Storage, Google Drive, AWS S3) and link the external download URL, or provide the direct channel message link (`https://t.me/techiemuthuraj/123`).

---

## 🌐 Production Deployment (Netlify)

### Option A: Deploy via Netlify CLI
```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

### Option B: Deploy via GitHub / GitLab
1. Push your repository to GitHub.
2. In [Netlify Dashboard](https://app.netlify.com/), click **Add new site** -> **Import an existing project**.
3. Select your repository.
4. Netlify will automatically detect [netlify.toml](file:///c:/Users/Muthuraj/Documents/TELEGRAM/netlify.toml) with:
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`
5. Go to **Site settings** -> **Environment variables** and add:
   - `ADMIN_SECRET_KEY`: Strong password for your admin dashboard.
   - `DOWNLOAD_TICKET_SECRET`: Random 32+ character string for HMAC tickets.
   - `SUPABASE_URL`: Your Supabase Project URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase `service_role` secret key.
   - `TELEGRAM_BOT_TOKEN`: (Optional) Your Telegram bot token.
   - `TELEGRAM_CHANNEL_ID`: (Optional) `@techiemuthuraj`.

---

## 🔒 Security Best Practices & Threat Model

- **No Secrets in Frontend JS**: Frontend code contains only API calls to serverless endpoints. Telegram bot tokens, Supabase service keys, and HMAC secrets never touch the browser.
- **Row-Level Security (RLS)**: Public anonymous users have zero direct read or write access to the `access_tokens` table.
- **Atomic PostgreSQL RPC**: The stored procedure `verify_and_claim_download` uses PostgreSQL `FOR UPDATE` row locks to prevent simultaneous race condition bypasses.
- **SSRF Hardening**: External download URLs are validated against private IP ranges (`127.0.0.1`, `10.x.x.x`, `192.168.x.x`) to prevent Server-Side Request Forgery.
- **Cryptographic Tickets**: Short-lived tickets are signed with HMAC-SHA256 and include an expiration timestamp and nonce, preventing reuse or tampering.

---

## 📄 License
MIT License &copy; 2026 **techiemuthuraj**. Built for production Telegram communities and digital content creators.
