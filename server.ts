import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import * as path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs";
import puppeteer from "puppeteer";
import * as os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function logError(err: any) {
  const msg = `${new Date().toISOString()} - ${err.stack || err}\n`;
  fs.appendFileSync(path.join(__dirname, "error.log"), msg);
  console.error(err);
}

let db: Database.Database;
try {
  db = new Database("career_track.db");

  // Initialize database and handle migrations
  const tableInfo = db.prepare("PRAGMA table_info(applications)").all() as any[];

  if (tableInfo.length > 0) {
    const idColumn = tableInfo.find(c => c.name === 'id');
    if (idColumn && idColumn.type === 'INTEGER') {
      console.log("Migrating database: Changing ID from INTEGER to TEXT");
      // Backup data
      const data = db.prepare("SELECT * FROM applications").all();
      // Drop and recreate
      db.exec("DROP TABLE applications");
      db.exec(`
        CREATE TABLE applications (
          id TEXT PRIMARY KEY,
          company TEXT NOT NULL,
          position TEXT NOT NULL,
          status TEXT DEFAULT 'Applied',
          applied_date TEXT,
          url TEXT,
          location TEXT,
          location_type TEXT,
          salary TEXT,
          salary_min INTEGER,
          salary_max INTEGER,
          desired_salary_min INTEGER,
          desired_salary_max INTEGER,
          notes TEXT,
          pdf_data TEXT,
          version INTEGER DEFAULT 0,
          is_deleted INTEGER DEFAULT 0,
          updated_at INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // Restore data with string IDs
      const insert = db.prepare(`
        INSERT INTO applications (id, company, position, status, applied_date, url, location, location_type, salary, salary_min, salary_max, desired_salary_min, desired_salary_max, notes, pdf_data, version, is_deleted, updated_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const row of data) {
        insert.run(
          String(row.id),
          row.company,
          row.position,
          row.status,
          row.applied_date,
          row.url,
          row.location,
          row.location_type || 'OnSite',
          row.salary,
          row.salary_min || null,
          row.salary_max || null,
          row.desired_salary_min || null,
          row.desired_salary_max || null,
          row.notes,
          row.pdf_data,
          row.version || 0,
          row.is_deleted || 0,
          row.updated_at || Date.now(),
          row.created_at
        );
      }
    } else {
      // Check for new columns and add them if they don't exist
      const columns = tableInfo.map(c => c.name);
      if (!columns.includes('location_type')) db.exec("ALTER TABLE applications ADD COLUMN location_type TEXT");
      if (!columns.includes('salary_min')) db.exec("ALTER TABLE applications ADD COLUMN salary_min INTEGER");
      if (!columns.includes('salary_max')) db.exec("ALTER TABLE applications ADD COLUMN salary_max INTEGER");
      if (!columns.includes('desired_salary_min')) db.exec("ALTER TABLE applications ADD COLUMN desired_salary_min INTEGER");
      if (!columns.includes('desired_salary_max')) db.exec("ALTER TABLE applications ADD COLUMN desired_salary_max INTEGER");
      if (!columns.includes('dirty')) db.exec("ALTER TABLE applications ADD COLUMN dirty INTEGER DEFAULT 0");
    }

    // Check for interviews table
    const interviewTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='interviews'").get();
    if (!interviewTable) {
      db.exec(`
        CREATE TABLE interviews (
          id TEXT PRIMARY KEY,
          application_id TEXT,
          date TEXT,
          time TEXT,
          type TEXT,
          duration INTEGER,
          notes TEXT,
          version INTEGER DEFAULT 0,
          updated_at INTEGER,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )
      `);
    }
  } else {
    // Fresh install
    db.exec(`
      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        company TEXT NOT NULL,
        position TEXT NOT NULL,
        status TEXT DEFAULT 'Applied',
        applied_date TEXT,
        url TEXT,
        location TEXT,
        location_type TEXT,
        salary TEXT,
        salary_min INTEGER,
        salary_max INTEGER,
        desired_salary_min INTEGER,
        desired_salary_max INTEGER,
        notes TEXT,
        pdf_data TEXT,
        version INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        dirty INTEGER DEFAULT 0,
        updated_at INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS interviews (
        id TEXT PRIMARY KEY,
        application_id TEXT,
        date TEXT,
        time TEXT,
        type TEXT,
        duration INTEGER,
        notes TEXT,
        version INTEGER DEFAULT 0,
        updated_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value INTEGER
    );
  
    INSERT OR IGNORE INTO sync_meta (key, value) VALUES ('table_version', 0);
  `);
} catch (err) {
  logError(err);
  process.exit(1);
}

function getNextVersion() {
  db.prepare("UPDATE sync_meta SET value = value + 1 WHERE key = 'table_version'").run();
  const row = db.prepare("SELECT value FROM sync_meta WHERE key = 'table_version'").get() as { value: number } | undefined;
  return row?.value ?? 1;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Sync Endpoint
  app.post("/api/sync", (req, res) => {
    const { last_sync_version, changes, interview_changes } = req.body;
    const syncVer = Number(last_sync_version) || 0;

    // 1. Process incoming changes from client
    if (changes && Array.isArray(changes)) {
      const insertOrUpdate = db.prepare(`
        INSERT INTO applications (id, company, position, status, applied_date, url, location, location_type, salary, salary_min, salary_max, desired_salary_min, desired_salary_max, notes, pdf_data, version, is_deleted, dirty, updated_at)
        VALUES (@id, @company, @position, @status, @applied_date, @url, @location, @location_type, @salary, @salary_min, @salary_max, @desired_salary_min, @desired_salary_max, @notes, @pdf_data, @version, @is_deleted, @dirty, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          company = excluded.company,
          position = excluded.position,
          status = excluded.status,
          applied_date = excluded.applied_date,
          url = excluded.url,
          location = excluded.location,
          location_type = excluded.location_type,
          salary = excluded.salary,
          salary_min = excluded.salary_min,
          salary_max = excluded.salary_max,
          desired_salary_min = excluded.desired_salary_min,
          desired_salary_max = excluded.desired_salary_max,
          notes = excluded.notes,
          pdf_data = excluded.pdf_data,
          version = excluded.version,
          is_deleted = excluded.is_deleted,
          dirty = 0,
          updated_at = excluded.updated_at
        WHERE excluded.updated_at > applications.updated_at OR applications.updated_at IS NULL
      `);

      const transaction = db.transaction((items) => {
        const metaRow = db.prepare("SELECT value FROM sync_meta WHERE key = 'table_version'").get() as { value: number } | undefined;
        let maxVer = metaRow?.value ?? 0;

        for (const item of items) {
          const serverItem = db.prepare("SELECT updated_at FROM applications WHERE id = ?").get(item.id) as { updated_at: number } | undefined;

          if (!serverItem || (item.updated_at && (!serverItem.updated_at || item.updated_at > serverItem.updated_at))) {
            maxVer++;
            insertOrUpdate.run({
              id: item.id,
              company: item.company,
              position: item.position,
              status: item.status || 'Applied',
              applied_date: item.applied_date || null,
              url: item.url || null,
              location: item.location || null,
              location_type: item.location_type || 'OnSite',
              salary: item.salary || null,
              salary_min: item.salary_min ?? null,
              salary_max: item.salary_max ?? null,
              desired_salary_min: item.desired_salary_min ?? null,
              desired_salary_max: item.desired_salary_max ?? null,
              notes: item.notes || null,
              pdf_data: item.pdf_data || null,
              version: maxVer,
              is_deleted: item.is_deleted ? 1 : 0,
              dirty: 0,
              updated_at: item.updated_at || Date.now()
            });
          }
        }
        db.prepare("UPDATE sync_meta SET value = ? WHERE key = 'table_version'").run(maxVer);
      });

      transaction(changes);
    }

    if (interview_changes && Array.isArray(interview_changes)) {
      const insertOrUpdateInterview = db.prepare(`
        INSERT INTO interviews (id, application_id, date, time, type, duration, notes, version, updated_at)
        VALUES (@id, @application_id, @date, @time, @type, @duration, @notes, @version, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          application_id = excluded.application_id,
          date = excluded.date,
          time = excluded.time,
          type = excluded.type,
          duration = excluded.duration,
          notes = excluded.notes,
          version = excluded.version,
          updated_at = excluded.updated_at
        WHERE excluded.updated_at > interviews.updated_at OR interviews.updated_at IS NULL
      `);

      const transaction = db.transaction((items) => {
        const metaRow = db.prepare("SELECT value FROM sync_meta WHERE key = 'table_version'").get() as { value: number } | undefined;
        let maxVer = metaRow?.value ?? 0;

        for (const item of items) {
          const serverItem = db.prepare("SELECT updated_at FROM interviews WHERE id = ?").get(item.id) as { updated_at: number } | undefined;

          if (!serverItem || (item.updated_at && (!serverItem.updated_at || item.updated_at > serverItem.updated_at))) {
            maxVer++;
            insertOrUpdateInterview.run({
              id: item.id,
              application_id: item.application_id,
              date: item.date,
              time: item.time,
              type: item.type,
              duration: item.duration ?? 0,
              notes: item.notes || null,
              version: maxVer,
              updated_at: item.updated_at || Date.now()
            });
          }
        }
        db.prepare("UPDATE sync_meta SET value = ? WHERE key = 'table_version'").run(maxVer);
      });

      transaction(interview_changes);
    }

    // 2. Get changes for client
    const metaRow = db.prepare("SELECT value FROM sync_meta WHERE key = 'table_version'").get() as { value: number } | undefined;
    const serverVersion = metaRow?.value ?? 0;
    const serverChanges = db.prepare("SELECT * FROM applications WHERE version > ?").all(syncVer);
    const serverInterviewChanges = db.prepare("SELECT * FROM interviews WHERE version > ?").all(syncVer);
    const dirtyIds = db.prepare("SELECT id FROM applications WHERE dirty = 1 AND is_deleted = 0").all() as { id: string }[];

    res.json({
      server_version: serverVersion,
      changes: serverChanges,
      interview_changes: serverInterviewChanges,
      dirty_ids: dirtyIds.map(row => row.id)
    });
  });

  // Fetch job description PDF endpoint using puppeteer
  app.post("/api/fetch-pdf", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    let browser;
    let tempFilePath = "";

    try {
      const tempDir = os.tmpdir();
      const uniqueName = `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.pdf`;
      tempFilePath = path.join(tempDir, uniqueName);

      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      
      // Navigate to the job URL
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

      // Generate PDF
      await page.pdf({
        path: tempFilePath,
        format: "A4",
        printBackground: true,
        margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
      });

      await browser.close();
      browser = null;

      // Read the generated PDF from the temp file
      const pdfBuffer = fs.readFileSync(tempFilePath);

      // Send PDF to the client
      res.contentType("application/pdf");
      res.send(pdfBuffer);
    } catch (err: any) {
      logError(err);
      res.status(500).json({ error: err.message || "Failed to generate PDF from URL" });
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          logError(e);
        }
      }
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {
          logError(e);
        }
      }
    }
  });

  // Push individual application endpoint
  app.post("/api/applications/:id/push", (req, res) => {
    const { id } = req.params;
    const app = req.body;
    const version = getNextVersion();
    const now = Date.now();

    db.prepare(`
      INSERT INTO applications (id, company, position, status, applied_date, url, location, location_type, salary, salary_min, salary_max, desired_salary_min, desired_salary_max, notes, pdf_data, version, is_deleted, dirty, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        company = excluded.company,
        position = excluded.position,
        status = excluded.status,
        applied_date = excluded.applied_date,
        url = excluded.url,
        location = excluded.location,
        location_type = excluded.location_type,
        salary = excluded.salary,
        salary_min = excluded.salary_min,
        salary_max = excluded.salary_max,
        desired_salary_min = excluded.desired_salary_min,
        desired_salary_max = excluded.desired_salary_max,
        notes = excluded.notes,
        pdf_data = excluded.pdf_data,
        version = excluded.version,
        is_deleted = excluded.is_deleted,
        dirty = 0,
        updated_at = excluded.updated_at
    `).run(
      id,
      app.company,
      app.position,
      app.status || 'Applied',
      app.applied_date || null,
      app.url || null,
      app.location || null,
      app.location_type || 'OnSite',
      app.salary || null,
      app.salary_min ?? null,
      app.salary_max ?? null,
      app.desired_salary_min ?? null,
      app.desired_salary_max ?? null,
      app.notes || null,
      app.pdf_data || null,
      version,
      app.is_deleted ? 1 : 0,
      0,
      now
    );

    res.json({ success: true, id });
  });

  // Get individual application endpoint
  app.get("/api/applications/:id/get", (req, res) => {
    const { id } = req.params;
    const app = db.prepare("SELECT * FROM applications WHERE id = ?").get(id) as any;
    if (!app) {
      return res.status(404).json({ error: 'Application not found' });
    }
    const interviews = db.prepare("SELECT * FROM interviews WHERE application_id = ? ORDER BY date ASC, time ASC").all(id);
    res.json({ ...app, interviews });
  });

  // Legacy API Routes
  app.get("/api/applications", (req, res) => {
    const apps = db.prepare("SELECT * FROM applications WHERE is_deleted = 0 ORDER BY created_at DESC").all() as any[];
    // Include interviews for each application
    const appsWithInterviews = apps.map(app => ({
      ...app,
      interviews: db.prepare("SELECT * FROM interviews WHERE application_id = ? ORDER BY date ASC, time ASC").all(app.id)
    }));
    res.json(appsWithInterviews);
  });

  app.post("/api/applications", (req, res) => {
    const {
      id, company, position, status, applied_date, url, location, location_type,
      salary, salary_min, salary_max, desired_salary_min, desired_salary_max,
      notes, pdf_data
    } = req.body;
    const version = getNextVersion();
    const now = Date.now();
    const appId = id || Math.random().toString(36).substring(2, 15);

    db.prepare(`
      INSERT INTO applications (
        id, company, position, status, applied_date, url, location, location_type, 
        salary, salary_min, salary_max, desired_salary_min, desired_salary_max, 
        notes, pdf_data, version, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      appId, company, position, status || 'Applied', applied_date, url, location, location_type || 'OnSite',
      salary, salary_min || null, salary_max || null, desired_salary_min || null, desired_salary_max || null,
      notes, pdf_data, version, now
    );

    const newApp = db.prepare("SELECT * FROM applications WHERE id = ?").get(appId);
    res.status(201).json(newApp);
  });

  app.put("/api/applications/:id", (req, res) => {
    const { id } = req.params;
    const {
      company, position, status, applied_date, url, location, location_type,
      salary, salary_min, salary_max, desired_salary_min, desired_salary_max,
      notes, pdf_data
    } = req.body;
    const version = getNextVersion();
    const now = Date.now();

    db.prepare(`
      UPDATE applications 
      SET company = ?, position = ?, status = ?, applied_date = ?, url = ?, location = ?, location_type = ?, 
          salary = ?, salary_min = ?, salary_max = ?, desired_salary_min = ?, desired_salary_max = ?, 
          notes = ?, pdf_data = ?, version = ?, updated_at = ?
      WHERE id = ?
    `).run(
      company, position, status, applied_date, url, location, location_type || 'OnSite',
      salary, salary_min || null, salary_max || null, desired_salary_min || null, desired_salary_max || null,
      notes, pdf_data, version, now, id
    );

    const updatedApp = db.prepare("SELECT * FROM applications WHERE id = ?").get(id);
    res.json(updatedApp);
  });

  app.delete("/api/applications/:id", (req, res) => {
    const { id } = req.params;
    const version = getNextVersion();
    const now = Date.now();

    db.prepare("UPDATE applications SET is_deleted = 1, version = ?, updated_at = ? WHERE id = ?").run(version, now, id);
    res.status(204).send();
  });

  // Interview routes
  app.post("/api/interviews", (req, res) => {
    const { id, application_id, date, time, type, duration, notes } = req.body;
    const version = getNextVersion();
    const now = Date.now();
    const interviewId = id || Math.random().toString(36).substring(2, 15);

    db.prepare(`
      INSERT INTO interviews (id, application_id, date, time, type, duration, notes, version, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(interviewId, application_id, date, time, type, duration, notes, version, now);

    const newInterview = db.prepare("SELECT * FROM interviews WHERE id = ?").get(interviewId);
    res.status(201).json(newInterview);
  });

  app.put("/api/interviews/:id", (req, res) => {
    const { id } = req.params;
    const { date, time, type, duration, notes } = req.body;
    const version = getNextVersion();
    const now = Date.now();

    db.prepare(`
      UPDATE interviews 
      SET date = ?, time = ?, type = ?, duration = ?, notes = ?, version = ?, updated_at = ?
      WHERE id = ?
    `).run(date, time, type, duration, notes, version, now, id);

    const updatedInterview = db.prepare("SELECT * FROM interviews WHERE id = ?").get(id);
    res.json(updatedInterview);
  });

  app.delete("/api/interviews/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM interviews WHERE id = ?").run(id);
    res.status(204).send();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
