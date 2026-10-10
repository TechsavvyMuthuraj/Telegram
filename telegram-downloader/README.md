# Telegram Direct File Downloader (Node.js Service)

> Convert Telegram file and channel post links into direct, high-speed download links so users can download files without manually opening Telegram.

---

## 📌 Overview

This project is a dedicated **backend downloader service** (not a website) built with pure Node.js. It bridges the official Telegram Bot API and client downloads by resolving channel post links, generating secure HMAC download URLs, and **streaming file bytes on-the-fly** directly to users without consuming local disk space.

---

## 🚀 Key Features

- **Link Resolution**: Converts Telegram post links like `https://t.me/channelname/123` or Telegram Bot file IDs into direct download links.
- **Direct HTTP Streaming**: Streams files directly to the client with `Content-Disposition: attachment`. Files are never stored locally on disk.
- **Universal Format Support**:
  - 📱 **APKs**: Android packages
  - 🗜️ **Archives**: ZIP, RAR, 7Z, TAR.GZ
  - 📄 **Documents**: PDF, DOCX, TXT, XLS
  - 🎬 **Media**: MP4, MKV, MP3, WAV, FLAC, JPG, PNG, WEBP
- **Bot Token Security**:
  - The Telegram bot token is **NEVER exposed** in download URLs, client responses, or logs.
  - Download URLs use cryptographically signed HMAC-SHA256 tokens.
- **Telegram Bot Command Engine**:
  - Send `/dl <link>` or any `t.me` link to your bot to receive direct download links with 1-tap copy functionality.
  - Forward files directly to the bot to get instant direct links.
- **Zero Frontend**: Pure headless microservice exposing a REST API and Telegram bot polling listener.

---

## ⚠️ Telegram Bot API Limitations & Security Policies

Understanding these official Telegram Bot API constraints is essential:

### 1. Channel Access Limitations
- Telegram bots **cannot automatically read arbitrary public channel messages** via API unless the bot has been added to the channel as an **Administrator** with *Read/Post Messages* permission.
- If a post link comes from an unjoined or private channel, the bot will return a clear message instructing the channel owner to add the bot, or the user can **forward the file directly to the bot** in private chat.

### 2. File Size Limits (20 MB vs 2,000 MB)
- **Official Cloud Bot API Limit**: Telegram's standard cloud servers (`api.telegram.org`) limit bots to downloading files up to **20 MB** via the `getFile` API.
- **Local Bot API Server (Up to 2 GB)**: For files between 20 MB and 2,000 MB (2 GB), Telegram provides the open-source **Telegram Bot API Local Server** (`telegram-bot-api`). When running a local API server, set `TELEGRAM_API_ROOT=http://localhost:8081` in `.env` to unlock streaming of files up to 2 GB.

### 3. Content Protection Policy
- Channels with "Restrict Saving Content" enabled prevent file forwarding and saving. This service respects Telegram's native privacy protections and will not bypass protected content.

---

## 🛠️ Installation & Setup Instructions

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher.
- A Telegram Bot Token from [@BotFather](https://t.me/BotFather).

### 2. Navigate to Project Directory
```bash
cd telegram-downloader
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
# Telegram Bot Token from @BotFather
TELEGRAM_BOT_TOKEN=8952851770:AAHj4OP5KaCqZbwckQAeOH0jvTw3QstRbYU

# Bot Username
TELEGRAM_BOT_USERNAME=techieverifybot

# HTTP Port and Base URL
PORT=5000
BASE_URL=http://localhost:5000

# Secret Key used to cryptographically sign download URLs
SECRET_KEY=your_secret_hmac_signing_key_here
```

### 5. Start the Service
```bash
npm start
```

Output:
```
=============================================================================
⚡ TELEGRAM DIRECT FILE DOWNLOADER SERVICE (NODE.JS)
=============================================================================
  Service Mode  : REST API & Telegram Bot Command Engine
  HTTP Port     : 5000
  Base URL      : http://localhost:5000
  MIME Support  : APK, ZIP, PDF, Video, Audio, Documents, Images
  Stream Engine : Direct Chunked Streaming (Zero Local Storage)
=============================================================================
[Telegram Bot] Connected successfully: @techieverifybot (Verify)
[API Server] Running at: http://localhost:5000
  • Resolve Post Link : POST http://localhost:5000/api/resolve
  • Direct Stream URL : GET  http://localhost:5000/api/download/:token
  • Health Status     : GET  http://localhost:5000/api/status
-------------------------------------------------------------
[Bot Service] Polling started for @techieverifybot...
```

---

## 📖 API Documentation

### 1. Resolve Link to Direct Download
**`POST /api/resolve`**

Resolves a Telegram post link or bot file ID, extracting file metadata and generating a signed direct download link.

**Request:**
```bash
curl -X POST http://localhost:5000/api/resolve \
  -H "Content-Type: application/json" \
  -d '{"url": "https://t.me/techiestorefiles/3"}'
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "file": {
    "name": "Termux_0.118.0.apk",
    "size_bytes": 10543200,
    "size_formatted": "10.05 MB",
    "mime_type": "application/vnd.android.package-archive",
    "category": "APK",
    "channel": "@techiestorefiles",
    "message_id": 3,
    "channel_title": "TECHIE STORE",
    "status": "ready"
  },
  "download_url": "http://localhost:5000/api/download/eyJhbGciOi...",
  "copy_link": "http://localhost:5000/api/download/eyJhbGciOi...",
  "source_type": "channel_post",
  "is_bot_accessible": true,
  "message": "Direct download link generated for Telegram channel post!"
}
```

---

### 2. Stream Binary Download
**`GET /api/download/:token`**

Initiates binary streaming of the file directly to the client as an attachment.

**Headers Sent:**
```http
HTTP/1.1 200 OK
Content-Type: application/vnd.android.package-archive
Content-Disposition: attachment; filename="Termux_0.118.0.apk"
Content-Length: 10543200
Accept-Ranges: bytes
```

**Usage:**
```bash
curl -O -J "http://localhost:5000/api/download/<token>"
```

---

### 3. Service Status & Health Check
**`GET /api/status`**

```bash
curl http://localhost:5000/api/status
```

**Response:**
```json
{
  "status": "online",
  "service": "Telegram Direct File Downloader",
  "version": "1.0.0",
  "bot_status": "connected",
  "bot": {
    "id": 8952851770,
    "username": "techieverifybot",
    "first_name": "Verify"
  }
}
```

---

## 🤖 Telegram Bot Commands

| Command | Action |
|---|---|
| `/start` | Displays welcome message and usage instructions. |
| `/dl <link>` | Resolves the link and returns direct download link with copy box and download button. |
| Any `t.me` link | Automatically detected and resolved. |
| Forward a file | Extracts file ID and generates an instant direct link. |

---

## 🧪 Testing

Run the automated integration test with sample files from your channel:

```bash
npm test
```

This test validates:
1. Parsing of public and private Telegram links.
2. Connection to the Telegram Bot API (`getMe`).
3. Resolution of channel post `https://t.me/techiestorefiles/3`.
4. Verification of HMAC download token signing.
5. End-to-end streaming download and binary package integrity.
