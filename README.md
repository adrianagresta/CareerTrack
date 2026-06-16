# CareerTrack 🚀

**CareerTrack** is a modern, offline-first job application and interview pipeline tracker. Built to keep your job search organized, efficient, and private, it offers a seamless interface that functions completely offline while automatically syncing with a local backend database when online.

---

## 📖 High-Level Overview

CareerTrack operates on a **local-first** architecture. Key features of this architecture include:
- **Instant UI Updates**: All write/edit operations commit immediately to a browser-based **IndexedDB** database, ensuring zero lag.
- **Offline Operations**: You can fully manage applications, log interviews, and update salary information without an active internet connection.
- **Auto-Sync Engine**: A background synchronization loop runs every 30 seconds (with manual overrides) to push offline modifications to a local **SQLite** database via a custom replication protocol.
- **Web Scraping to PDF**: The app includes a built-in headless browser integration (**Puppeteer**) that scrapes job listings and archives them as PDF files directly in your application records.

---

## 🛠️ Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Core** | **React 19 & TypeScript** | Component-driven, typed user interface build. |
| **Build Tooling** | **Vite** | Ultra-fast build tool and local dev server setup. |
| **Styling** | **Tailwind CSS v4** | Clean, responsive styling with native `@tailwindcss/vite` integration. |
| **Animations** | **Framer Motion** | Fluid dashboard transitions and card lists. |
| **Icons** | **Lucide React** | Modern, unified SVG iconography. |
| **Client Database** | **IndexedDB (`idb`)** | Client-side transactional storage enabling offline persistence. |
| **Backend Core** | **Node.js & Express** | RESTful synchronization endpoints. |
| **Backend Database**| **SQLite (`better-sqlite3`)** | Persistent local server-side database. |
| **Scraper / PDF Engine** | **Puppeteer** | Headless Chrome browser to generate job post PDFs dynamically from URLs. |

---

## ✨ Features & Functionality

### 1. Interactive Pipeline Dashboard
- **Live Stats Grid**: Visual summary of total opportunities categorised by status (*Wishlist, Applied, Interviewing, Offer, Rejected, Withdrawn*).
- **Interactive Filtering**: Click any card in the stats grid to instantly filter your board.
- **Dynamic Search**: Instantly query applications by company name, position, or physical location.

### 2. Comprehensive Application Management
- Track crucial role metrics: **Company name**, **Position**, **Status**, **Applied Date**, **Location**, and **Work Location Type** (*On-site, Hybrid, Remote*).
- **Salary Tracking**: Distinguish between the **job listing's range** (Min/Max) and **your desired range** (Min/Max) to stay aligned with financial goals.
- **Attachment Storage**: Save job post PDFs for future reference. Upload local files (up to 5MB) or use the automated PDF generator.

### 3. Automated Web-to-PDF Archiver (Puppeteer)
- Tired of job advertisements disappearing online? Input any job URL and click **Fetch job PDF**.
- The Express backend spins up a headless Puppeteer browser, visits the URL, prints the page to a PDF buffer, and saves it directly to your application record as a Base64-encoded string.

### 4. Detail-Oriented Interview Logging
- Log multiple interviews for each job application.
- Track **Interview Type** (*Phone Screen, Recruiter Screen, Technical, On-Site, Panel, Final*), **Date**, **Time**, **Duration**, and personal **Notes**.

### 5. Offline-First Custom Sync System
- Front-end utilizes dirty-state flags (`dirty: 1`) to mark newly updated records.
- Synchronizes with `/api/sync` on the Express backend using version stamps to resolve updates:
  - Client pushes local changes one-by-one.
  - Server processes, resolves conflict versions, and replies with incoming changes.
  - Server indicates server-side dirty IDs so clients can sync back-end modifications.

---

## 🗄️ Database Architecture

CareerTrack manages data synchronization using three tables. The SQLite backend automatically sets up and performs migrations for:

### `applications`
Stores core job listing information and Base64-encoded PDF data:
- `id` (TEXT PRIMARY KEY) - Generated UUIDs
- `company` & `position` (TEXT)
- `status` (TEXT) - Current application status
- `location` & `location_type` (TEXT) - Location details
- `salary_min`, `salary_max`, `desired_salary_min`, `desired_salary_max` (INTEGER)
- `pdf_data` (TEXT) - Base64 encoded job posting PDF
- `version` (INTEGER) - Sync version stamp
- `dirty` & `is_deleted` (INTEGER) - Sync flags

### `interviews`
Log of interview phases associated with specific applications:
- `id` (TEXT PRIMARY KEY)
- `application_id` (TEXT FOREIGN KEY)
- `date` & `time` & `type` (TEXT)
- `duration` (INTEGER)
- `notes` (TEXT)
- `version` (INTEGER)

### `sync_meta`
Metadata to coordinate sync transactions:
- `key` (TEXT PRIMARY KEY)
- `value` (INTEGER) - Current global database state version

---

## 🚀 Getting Started

### Prerequisites
Ensure you have **Node.js** (v18+) and **npm** installed.

### Installation & Run

1. Clone the repository and install the dependencies:
   ```bash
   npm install
   ```

2. Create a local environment file (optional):
   ```bash
   cp .env.example .env
   ```

3. Start the application in development mode:
   ```bash
   npm run dev
   ```
   *This starts the Express server which binds automatically to `0.0.0.0:3000` and serves the front-end application.*

> [!WARNING]
> By default, the application binds to `0.0.0.0`. This is helpful for accessing your board from other devices on your home network, but it should be restricted to `127.0.0.1` in public networks. Change the `app.listen(...)` call in `server.ts` to `"127.0.0.1"` if you wish to run only on localhost.