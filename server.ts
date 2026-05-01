import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import * as path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs";

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
          salary TEXT,
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
        INSERT INTO applications (id, company, position, status, applied_date, url, location, salary, notes, pdf_data, version, is_deleted, updated_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          row.salary, 
          row.notes, 
          row.pdf_data, 
          row.version || 0, 
          row.is_deleted || 0, 
          row.updated_at || Date.now(),
          row.created_at
        );
      }
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
        salary TEXT,
        notes TEXT,
        pdf_data TEXT,
        version INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        updated_at INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    const { last_sync_version, changes } = req.body;
    const syncVer = Number(last_sync_version) || 0;

    // 1. Process incoming changes from client
    if (changes && Array.isArray(changes)) {
      const insertOrUpdate = db.prepare(`
        INSERT INTO applications (id, company, position, status, applied_date, url, location, salary, notes, pdf_data, version, is_deleted, updated_at)
        VALUES (@id, @company, @position, @status, @applied_date, @url, @location, @salary, @notes, @pdf_data, @version, @is_deleted, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          company = excluded.company,
          position = excluded.position,
          status = excluded.status,
          applied_date = excluded.applied_date,
          url = excluded.url,
          location = excluded.location,
          salary = excluded.salary,
          notes = excluded.notes,
          pdf_data = excluded.pdf_data,
          version = excluded.version,
          is_deleted = excluded.is_deleted,
          updated_at = excluded.updated_at
        WHERE excluded.updated_at > applications.updated_at OR applications.updated_at IS NULL
      `);

      const transaction = db.transaction((items) => {
        const metaRow = db.prepare("SELECT value FROM sync_meta WHERE key = 'table_version'").get() as { value: number } | undefined;
        let maxVer = metaRow?.value ?? 0;
        
        for (const item of items) {
          const serverItem = db.prepare("SELECT updated_at, version FROM applications WHERE id = ?").get(item.id) as { updated_at: number, version: number } | undefined;
          
          if (!serverItem || (item.updated_at && (!serverItem.updated_at || item.updated_at > serverItem.updated_at))) {
            maxVer++;
            insertOrUpdate.run({ 
              ...item, 
              version: maxVer,
              is_deleted: item.is_deleted ? 1 : 0,
              updated_at: item.updated_at || Date.now()
            });
          }
        }
        db.prepare("UPDATE sync_meta SET value = ? WHERE key = 'table_version'").run(maxVer);
      });

      transaction(changes);
    }

    // 2. Get changes for client
    const metaRow = db.prepare("SELECT value FROM sync_meta WHERE key = 'table_version'").get() as { value: number } | undefined;
    const serverVersion = metaRow?.value ?? 0;
    const serverChanges = db.prepare("SELECT * FROM applications WHERE version > ?").all(syncVer);

    res.json({
      server_version: serverVersion,
      changes: serverChanges
    });
  });

  // Legacy API Routes
  app.get("/api/applications", (req, res) => {
    const apps = db.prepare("SELECT * FROM applications WHERE is_deleted = 0 ORDER BY created_at DESC").all();
    res.json(apps);
  });

  app.post("/api/applications", (req, res) => {
    const { id, company, position, status, applied_date, url, location, salary, notes, pdf_data } = req.body;
    const version = getNextVersion();
    const now = Date.now();
    const appId = id || Math.random().toString(36).substring(2, 15);
    
    db.prepare(`
      INSERT INTO applications (id, company, position, status, applied_date, url, location, salary, notes, pdf_data, version, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(appId, company, position, status || 'Applied', applied_date, url, location, salary, notes, pdf_data, version, now);
    
    const newApp = db.prepare("SELECT * FROM applications WHERE id = ?").get(appId);
    res.status(201).json(newApp);
  });

  app.put("/api/applications/:id", (req, res) => {
    const { id } = req.params;
    const { company, position, status, applied_date, url, location, salary, notes, pdf_data } = req.body;
    const version = getNextVersion();
    const now = Date.now();
    
    db.prepare(`
      UPDATE applications 
      SET company = ?, position = ?, status = ?, applied_date = ?, url = ?, location = ?, salary = ?, notes = ?, pdf_data = ?, version = ?, updated_at = ?
      WHERE id = ?
    `).run(company, position, status, applied_date, url, location, salary, notes, pdf_data, version, now, id);
    
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
