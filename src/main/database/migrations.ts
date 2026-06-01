import type Database from 'better-sqlite3'

const MIGRATIONS: Array<{ version: number; up: (db: Database.Database) => void }> = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          color       TEXT NOT NULL DEFAULT '#6366f1',
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id            TEXT PRIMARY KEY,
          project_id    TEXT REFERENCES projects(id) ON DELETE SET NULL,
          title         TEXT NOT NULL,
          description   TEXT NOT NULL DEFAULT '',
          status        TEXT NOT NULL DEFAULT 'pending',
          priority      INTEGER NOT NULL DEFAULT 3,
          due_date      INTEGER,
          due_time      TEXT,
          completed_at  INTEGER,
          created_at    INTEGER NOT NULL,
          updated_at    INTEGER NOT NULL,
          synced_at     INTEGER,
          drive_file_id TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_status   ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
        CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

        CREATE TABLE IF NOT EXISTS task_dependencies (
          id            TEXT PRIMARY KEY,
          task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          created_at    INTEGER NOT NULL,
          UNIQUE(task_id, depends_on_id)
        );

        CREATE INDEX IF NOT EXISTS idx_deps_task_id ON task_dependencies(task_id);

        CREATE TABLE IF NOT EXISTS attachments (
          id            TEXT PRIMARY KEY,
          task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          original_name TEXT NOT NULL,
          stored_name   TEXT NOT NULL,
          mime_type     TEXT NOT NULL,
          size_bytes    INTEGER NOT NULL,
          drive_file_id TEXT,
          synced_at     INTEGER,
          created_at    INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_attach_task_id ON attachments(task_id);

        CREATE TABLE IF NOT EXISTS reminders (
          id           TEXT PRIMARY KEY,
          task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          remind_at    INTEGER NOT NULL,
          phone_number TEXT NOT NULL,
          message      TEXT NOT NULL,
          sent         INTEGER NOT NULL DEFAULT 0,
          sent_at      INTEGER,
          created_at   INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
        CREATE INDEX IF NOT EXISTS idx_reminders_sent      ON reminders(sent);
      `)
    }
  },
  {
    version: 2,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS contacts (
          id         TEXT PRIMARY KEY,
          name       TEXT NOT NULL,
          phone      TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `)
    }
  },
  {
    version: 3,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS delegated_tasks (
          id           TEXT PRIMARY KEY,
          contact_id   TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
          title        TEXT NOT NULL,
          description  TEXT NOT NULL DEFAULT '',
          status       TEXT NOT NULL DEFAULT 'pending',
          priority     INTEGER NOT NULL DEFAULT 3,
          due_date     INTEGER,
          completed_at INTEGER,
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_delegated_contact ON delegated_tasks(contact_id);
        CREATE INDEX IF NOT EXISTS idx_delegated_status  ON delegated_tasks(status);
      `)
    }
  },
  {
    version: 4,
    up: (db) => {
      db.exec(`
        ALTER TABLE contacts ADD COLUMN type         TEXT NOT NULL DEFAULT 'other';
        ALTER TABLE contacts ADD COLUMN email        TEXT NOT NULL DEFAULT '';
        ALTER TABLE contacts ADD COLUMN notes        TEXT NOT NULL DEFAULT '';
        ALTER TABLE contacts ADD COLUMN avatar_color TEXT NOT NULL DEFAULT '#6366f1';
      `)
    }
  },
  {
    version: 5,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS message_templates (
          id         TEXT PRIMARY KEY,
          name       TEXT NOT NULL,
          body       TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS scheduled_messages (
          id          TEXT PRIMARY KEY,
          contact_ids TEXT NOT NULL DEFAULT '[]',
          template_id TEXT REFERENCES message_templates(id) ON DELETE SET NULL,
          message     TEXT NOT NULL,
          send_at     INTEGER NOT NULL,
          recurrence  TEXT NOT NULL DEFAULT 'none',
          status      TEXT NOT NULL DEFAULT 'pending',
          sent_at     INTEGER,
          error       TEXT,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sched_msg_status  ON scheduled_messages(status);
        CREATE INDEX IF NOT EXISTS idx_sched_msg_send_at ON scheduled_messages(send_at);
      `)
    }
  },
  {
    version: 6,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS task_questions (
          id           TEXT PRIMARY KEY,
          task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          phone        TEXT NOT NULL,
          question     TEXT NOT NULL,
          options      TEXT NOT NULL,
          ref_code     TEXT NOT NULL,
          status       TEXT NOT NULL DEFAULT 'pending',
          answer       TEXT,
          action_taken TEXT,
          answered_at  INTEGER,
          expires_at   INTEGER NOT NULL,
          created_at   INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_questions_task_id ON task_questions(task_id);
        CREATE INDEX IF NOT EXISTS idx_questions_phone   ON task_questions(phone);
        CREATE INDEX IF NOT EXISTS idx_questions_status  ON task_questions(status);
      `)
    }
  },
  {
    version: 7,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS comex_suppliers (
          id            TEXT PRIMARY KEY,
          name          TEXT NOT NULL,
          country       TEXT NOT NULL DEFAULT '',
          contact_name  TEXT NOT NULL DEFAULT '',
          contact_email TEXT NOT NULL DEFAULT '',
          contact_phone TEXT NOT NULL DEFAULT '',
          website       TEXT NOT NULL DEFAULT '',
          payment_terms TEXT NOT NULL DEFAULT '',
          notes         TEXT NOT NULL DEFAULT '',
          created_at    INTEGER NOT NULL,
          updated_at    INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS comex_imports (
          id                  TEXT PRIMARY KEY,
          title               TEXT NOT NULL,
          supplier_id         TEXT REFERENCES comex_suppliers(id) ON DELETE SET NULL,
          status              TEXT NOT NULL DEFAULT 'planning',
          incoterm            TEXT NOT NULL DEFAULT 'FOB',
          origin_country      TEXT NOT NULL DEFAULT '',
          currency            TEXT NOT NULL DEFAULT 'USD',
          estimated_value     REAL,
          actual_value        REAL,
          order_date          INTEGER,
          payment_date        INTEGER,
          ship_date           INTEGER,
          arrival_date        INTEGER,
          actual_ship_date    INTEGER,
          actual_arrival_date INTEGER,
          tracking_number     TEXT NOT NULL DEFAULT '',
          customs_agent       TEXT NOT NULL DEFAULT '',
          drive_folder_id     TEXT,
          notes               TEXT NOT NULL DEFAULT '',
          created_at          INTEGER NOT NULL,
          updated_at          INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_comex_imports_status      ON comex_imports(status);
        CREATE INDEX IF NOT EXISTS idx_comex_imports_arrival     ON comex_imports(arrival_date);
        CREATE INDEX IF NOT EXISTS idx_comex_imports_supplier    ON comex_imports(supplier_id);

        CREATE TABLE IF NOT EXISTS comex_import_items (
          id          TEXT PRIMARY KEY,
          import_id   TEXT NOT NULL REFERENCES comex_imports(id) ON DELETE CASCADE,
          description TEXT NOT NULL,
          hs_code     TEXT NOT NULL DEFAULT '',
          quantity    REAL NOT NULL DEFAULT 0,
          unit        TEXT NOT NULL DEFAULT 'u',
          unit_price  REAL NOT NULL DEFAULT 0,
          currency    TEXT NOT NULL DEFAULT 'USD',
          created_at  INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_comex_items_import ON comex_import_items(import_id);

        CREATE TABLE IF NOT EXISTS comex_documents (
          id            TEXT PRIMARY KEY,
          import_id     TEXT NOT NULL REFERENCES comex_imports(id) ON DELETE CASCADE,
          type          TEXT NOT NULL DEFAULT 'other',
          name          TEXT NOT NULL,
          drive_file_id TEXT,
          status        TEXT NOT NULL DEFAULT 'pending',
          notes         TEXT NOT NULL DEFAULT '',
          received_at   INTEGER,
          created_at    INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_comex_docs_import ON comex_documents(import_id);

        CREATE TABLE IF NOT EXISTS comex_logistics_quotes (
          id                 TEXT PRIMARY KEY,
          import_id          TEXT NOT NULL REFERENCES comex_imports(id) ON DELETE CASCADE,
          operator_name      TEXT NOT NULL,
          contact            TEXT NOT NULL DEFAULT '',
          quote_amount       REAL,
          currency           TEXT NOT NULL DEFAULT 'USD',
          services_included  TEXT NOT NULL DEFAULT '',
          valid_until        INTEGER,
          status             TEXT NOT NULL DEFAULT 'quoted',
          notes              TEXT NOT NULL DEFAULT '',
          created_at         INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_comex_quotes_import ON comex_logistics_quotes(import_id);

        CREATE TABLE IF NOT EXISTS comex_payments (
          id            TEXT PRIMARY KEY,
          import_id     TEXT NOT NULL REFERENCES comex_imports(id) ON DELETE CASCADE,
          amount        REAL NOT NULL,
          currency      TEXT NOT NULL DEFAULT 'USD',
          exchange_rate REAL,
          payment_date  INTEGER,
          method        TEXT NOT NULL DEFAULT 'wire',
          bank          TEXT NOT NULL DEFAULT '',
          reference     TEXT NOT NULL DEFAULT '',
          status        TEXT NOT NULL DEFAULT 'pending',
          notes         TEXT NOT NULL DEFAULT '',
          created_at    INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_comex_payments_import ON comex_payments(import_id);
      `)
    }
  },
  {
    version: 8,
    up: (db) => {
      db.exec(`
        -- Customs declaration: 1:1 with comex_imports
        CREATE TABLE IF NOT EXISTS comex_import_customs (
          id                       TEXT PRIMARY KEY,
          import_id                TEXT NOT NULL UNIQUE REFERENCES comex_imports(id) ON DELETE CASCADE,
          fob_currency             TEXT NOT NULL DEFAULT 'USD',
          fob_invoice              REAL,
          fob_declared             REAL,
          dolar_aduana             REAL,
          dolar_naviera            REAL,
          paridad_usd_eur          REAL,
          despacho_number          TEXT NOT NULL DEFAULT '',
          despachante              TEXT NOT NULL DEFAULT '',
          oficializacion_date      INTEGER,
          sepaimpo_vencimiento     INTEGER,
          bl_number                TEXT NOT NULL DEFAULT '',
          naviera_ref              TEXT NOT NULL DEFAULT '',
          carrier                  TEXT NOT NULL DEFAULT '',
          etd                      INTEGER,
          peso_bruto_kg            REAL,
          volumen_m3               REAL,
          cant_pallets             INTEGER,
          mulc_date                INTEGER,
          fecha_pago_banco         INTEGER,
          cierre_banco_date        INTEGER,
          listas_despachante_date  INTEGER,
          listas_oscar_andrea_date INTEGER,
          created_at               INTEGER NOT NULL,
          updated_at               INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_comex_customs_import ON comex_import_customs(import_id);

        -- Detailed cost line items
        CREATE TABLE IF NOT EXISTS comex_import_costs (
          id           TEXT PRIMARY KEY,
          import_id    TEXT NOT NULL REFERENCES comex_imports(id) ON DELETE CASCADE,
          category     TEXT NOT NULL DEFAULT 'otros',
          concept      TEXT NOT NULL,
          amount_pesos REAL NOT NULL DEFAULT 0,
          amount_usd   REAL,
          sort_order   INTEGER NOT NULL DEFAULT 0,
          created_at   INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_comex_costs_import ON comex_import_costs(import_id);
      `)
    }
  },
  {
    version: 9,
    up: (db) => {
      // Extend comex_suppliers with new fields
      const newCols = [
        "ALTER TABLE comex_suppliers ADD COLUMN address TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE comex_suppliers ADD COLUMN city TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE comex_suppliers ADD COLUMN zip_code TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE comex_suppliers ADD COLUMN tax_id TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE comex_suppliers ADD COLUMN rex_number TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE comex_suppliers ADD COLUMN wechat TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE comex_suppliers ADD COLUMN product_categories TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE comex_suppliers ADD COLUMN incoterms_preferred TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE comex_suppliers ADD COLUMN port_of_origin TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE comex_suppliers ADD COLUMN lead_time_days INTEGER",
        "ALTER TABLE comex_suppliers ADD COLUMN pickup_address TEXT NOT NULL DEFAULT ''",
      ]
      for (const sql of newCols) {
        try { db.exec(sql) } catch { /* column may already exist */ }
      }

      db.exec(`
        -- Multiple contacts per supplier
        CREATE TABLE IF NOT EXISTS comex_supplier_contacts (
          id          TEXT PRIMARY KEY,
          supplier_id TEXT NOT NULL REFERENCES comex_suppliers(id) ON DELETE CASCADE,
          role        TEXT NOT NULL DEFAULT 'commercial',
          name        TEXT NOT NULL DEFAULT '',
          position    TEXT NOT NULL DEFAULT '',
          email       TEXT NOT NULL DEFAULT '',
          phone       TEXT NOT NULL DEFAULT '',
          whatsapp    TEXT NOT NULL DEFAULT '',
          notes       TEXT NOT NULL DEFAULT '',
          sort_order  INTEGER NOT NULL DEFAULT 0,
          created_at  INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sup_contacts_supplier ON comex_supplier_contacts(supplier_id);

        -- Bank accounts per supplier
        CREATE TABLE IF NOT EXISTS comex_supplier_bank_accounts (
          id               TEXT PRIMARY KEY,
          supplier_id      TEXT NOT NULL REFERENCES comex_suppliers(id) ON DELETE CASCADE,
          bank_name        TEXT NOT NULL DEFAULT '',
          beneficiary_name TEXT NOT NULL DEFAULT '',
          account_number   TEXT NOT NULL DEFAULT '',
          swift_bic        TEXT NOT NULL DEFAULT '',
          iban             TEXT NOT NULL DEFAULT '',
          routing_number   TEXT NOT NULL DEFAULT '',
          currency         TEXT NOT NULL DEFAULT 'USD',
          bank_address     TEXT NOT NULL DEFAULT '',
          notes            TEXT NOT NULL DEFAULT '',
          created_at       INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sup_banks_supplier ON comex_supplier_bank_accounts(supplier_id);
      `)
    }
  },
  {
    version: 10,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS comex_freight_operators (
          id           TEXT PRIMARY KEY,
          name         TEXT NOT NULL,
          company_type TEXT NOT NULL DEFAULT 'agente',
          contact_name TEXT NOT NULL DEFAULT '',
          email        TEXT NOT NULL DEFAULT '',
          phone        TEXT NOT NULL DEFAULT '',
          whatsapp     TEXT NOT NULL DEFAULT '',
          services     TEXT NOT NULL DEFAULT '',
          notes        TEXT NOT NULL DEFAULT '',
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_freight_ops_name ON comex_freight_operators(name);
      `)
      const newCols = [
        "ALTER TABLE comex_logistics_quotes ADD COLUMN operator_id TEXT REFERENCES comex_freight_operators(id) ON DELETE SET NULL",
        "ALTER TABLE comex_logistics_quotes ADD COLUMN cargo_type TEXT NOT NULL DEFAULT 'LCL'",
        "ALTER TABLE comex_logistics_quotes ADD COLUMN rfq_sent_at INTEGER",
        "ALTER TABLE comex_logistics_quotes ADD COLUMN rfq_email_text TEXT NOT NULL DEFAULT ''"
      ]
      for (const sql of newCols) {
        try { db.exec(sql) } catch { /* already exists */ }
      }
    }
  },
  {
    version: 11,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS task_status_log (
          id          TEXT PRIMARY KEY,
          task_id     TEXT NOT NULL,
          task_type   TEXT NOT NULL DEFAULT 'personal',
          from_status TEXT,
          to_status   TEXT NOT NULL,
          changed_at  INTEGER NOT NULL,
          note        TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_status_log_task ON task_status_log(task_id, task_type);
      `)
    }
  },
  {
    version: 12,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS delegated_reminders (
          id           TEXT PRIMARY KEY,
          task_id      TEXT NOT NULL REFERENCES delegated_tasks(id) ON DELETE CASCADE,
          remind_at    INTEGER NOT NULL,
          phone_number TEXT NOT NULL,
          message      TEXT NOT NULL,
          sent         INTEGER NOT NULL DEFAULT 0,
          sent_at      INTEGER,
          created_at   INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_del_reminders_task ON delegated_reminders(task_id);
        CREATE INDEX IF NOT EXISTS idx_del_reminders_sent ON delegated_reminders(sent, remind_at);

        CREATE TABLE IF NOT EXISTS delegated_attachments (
          id            TEXT PRIMARY KEY,
          task_id       TEXT NOT NULL REFERENCES delegated_tasks(id) ON DELETE CASCADE,
          original_name TEXT NOT NULL,
          stored_name   TEXT NOT NULL,
          mime_type     TEXT NOT NULL,
          size_bytes    INTEGER NOT NULL,
          drive_file_id TEXT,
          synced_at     INTEGER,
          created_at    INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_del_attachments_task ON delegated_attachments(task_id);
      `)
    }
  },
  {
    version: 13,
    up: (db) => {
      const newCols = [
        "ALTER TABLE comex_documents ADD COLUMN local_stored_name TEXT",
        "ALTER TABLE comex_documents ADD COLUMN size_bytes INTEGER",
        "ALTER TABLE comex_documents ADD COLUMN mime_type TEXT",
        "ALTER TABLE comex_documents ADD COLUMN drive_status TEXT NOT NULL DEFAULT 'none'"
      ]
      for (const sql of newCols) {
        try { db.exec(sql) } catch { /* already exists */ }
      }
    }
  },
  {
    version: 14,
    up: (db) => {
      try {
        db.exec("ALTER TABLE comex_imports ADD COLUMN origin_port TEXT NOT NULL DEFAULT ''")
      } catch { /* already exists */ }
    }
  },
  {
    version: 15,
    up: (db) => {
      const stmts = [
        "ALTER TABLE comex_suppliers ADD COLUMN brand TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE comex_imports ADD COLUMN eta_2 INTEGER",
        "ALTER TABLE comex_imports ADD COLUMN eta_3 INTEGER",
        "ALTER TABLE comex_imports ADD COLUMN eta_4 INTEGER"
      ]
      for (const sql of stmts) {
        try { db.exec(sql) } catch { /* already exists */ }
      }
    }
  },
  {
    version: 16,
    up: (db) => {
      // INAL fields on imports
      const alters = [
        "ALTER TABLE comex_imports ADD COLUMN inal_required INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE comex_imports ADD COLUMN inal_lc_status TEXT NOT NULL DEFAULT 'pendiente'",
        "ALTER TABLE comex_imports ADD COLUMN inal_lc_task_scheduled INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE comex_imports ADD COLUMN inal_lc_cert_folder_id TEXT"
      ]
      for (const sql of alters) {
        try { db.exec(sql) } catch { /* already exists */ }
      }
      // Certificates table
      db.exec(`
        CREATE TABLE IF NOT EXISTS comex_inal_certs (
          id                TEXT PRIMARY KEY,
          import_id         TEXT NOT NULL REFERENCES comex_imports(id) ON DELETE CASCADE,
          original_name     TEXT NOT NULL,
          local_stored_name TEXT,
          size_bytes        INTEGER,
          mime_type         TEXT,
          drive_file_id     TEXT,
          drive_status      TEXT NOT NULL DEFAULT 'none',
          created_at        INTEGER NOT NULL
        )
      `)
    }
  },
  {
    version: 17,
    up: (db) => {
      try {
        db.exec("ALTER TABLE comex_imports ADD COLUMN inal_lc_task_id TEXT")
      } catch { /* already exists */ }
    }
  },
  {
    version: 18,
    up: (db) => {
      // Recreate task_questions without FK constraint on task_id so delegated
      // tasks can also have WhatsApp questions. Adds task_type column.
      db.exec(`
        CREATE TABLE IF NOT EXISTS task_questions_v2 (
          id           TEXT PRIMARY KEY,
          task_id      TEXT NOT NULL,
          task_type    TEXT NOT NULL DEFAULT 'personal',
          phone        TEXT NOT NULL,
          question     TEXT NOT NULL,
          options      TEXT NOT NULL,
          ref_code     TEXT NOT NULL,
          status       TEXT NOT NULL DEFAULT 'pending',
          answer       TEXT,
          action_taken TEXT,
          answered_at  INTEGER,
          expires_at   INTEGER NOT NULL,
          created_at   INTEGER NOT NULL
        );

        INSERT INTO task_questions_v2
          (id, task_id, task_type, phone, question, options, ref_code, status, answer, action_taken, answered_at, expires_at, created_at)
        SELECT
          id, task_id, 'personal', phone, question, options, ref_code, status, answer, action_taken, answered_at, expires_at, created_at
        FROM task_questions;

        DROP TABLE task_questions;
        ALTER TABLE task_questions_v2 RENAME TO task_questions;

        CREATE INDEX IF NOT EXISTS idx_questions_task_id ON task_questions(task_id);
        CREATE INDEX IF NOT EXISTS idx_questions_phone   ON task_questions(phone);
        CREATE INDEX IF NOT EXISTS idx_questions_status  ON task_questions(status);
      `)
    }
  },
  {
    version: 19,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS comex_freight_operator_contacts (
          id          TEXT PRIMARY KEY,
          operator_id TEXT NOT NULL REFERENCES comex_freight_operators(id) ON DELETE CASCADE,
          name        TEXT NOT NULL DEFAULT '',
          role        TEXT NOT NULL DEFAULT '',
          email       TEXT NOT NULL DEFAULT '',
          phone       TEXT NOT NULL DEFAULT '',
          sort_order  INTEGER NOT NULL DEFAULT 0,
          created_at  INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_op_contacts_operator ON comex_freight_operator_contacts(operator_id);
      `)
    }
  },
  {
    version: 20,
    up: (db) => {
      db.exec(`ALTER TABLE comex_freight_operator_contacts ADD COLUMN nickname TEXT NOT NULL DEFAULT ''`)
    }
  },
  {
    version: 21,
    up: (db) => {
      db.exec(`
        ALTER TABLE comex_suppliers          ADD COLUMN logo_stored_name TEXT;
        ALTER TABLE comex_freight_operators  ADD COLUMN logo_stored_name TEXT;
      `)
    }
  },
  {
    version: 22,
    up: (db) => {
      db.exec(`
        ALTER TABLE comex_imports ADD COLUMN despacho_folder_id       TEXT;
        ALTER TABLE comex_imports ADD COLUMN despacho_stored_name     TEXT;
        ALTER TABLE comex_imports ADD COLUMN despacho_original_name   TEXT;
        ALTER TABLE comex_imports ADD COLUMN despacho_drive_file_id   TEXT;
        ALTER TABLE comex_imports ADD COLUMN despacho_drive_status    TEXT NOT NULL DEFAULT 'none';
      `)
    }
  },
  {
    version: 23,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS comex_import_tributos (
          id          TEXT PRIMARY KEY,
          import_id   TEXT NOT NULL REFERENCES comex_imports(id) ON DELETE CASCADE,
          codigo      TEXT NOT NULL DEFAULT '',
          concepto    TEXT NOT NULL DEFAULT '',
          porcentaje  REAL,
          importe_usd REAL NOT NULL DEFAULT 0,
          sort_order  INTEGER NOT NULL DEFAULT 0,
          created_at  INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tributos_import ON comex_import_tributos(import_id);
      `)
    }
  },
  {
    version: 24,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS comex_import_extra_costs (
          id              TEXT PRIMARY KEY,
          import_id       TEXT NOT NULL REFERENCES comex_imports(id) ON DELETE CASCADE,
          categoria       TEXT NOT NULL DEFAULT 'otro',
          concepto        TEXT NOT NULL DEFAULT '',
          proveedor       TEXT NOT NULL DEFAULT '',
          nro_factura     TEXT NOT NULL DEFAULT '',
          fecha_factura   INTEGER,
          importe         REAL NOT NULL DEFAULT 0,
          moneda          TEXT NOT NULL DEFAULT 'ARS',
          stored_name     TEXT,
          original_name   TEXT,
          drive_file_id   TEXT,
          drive_folder_id TEXT,
          drive_status    TEXT NOT NULL DEFAULT 'none',
          sort_order      INTEGER NOT NULL DEFAULT 0,
          created_at      INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_extra_costs_import ON comex_import_extra_costs(import_id);
      `)
    }
  },
  {
    version: 25,
    up: (db) => {
      db.exec(`
        ALTER TABLE comex_import_extra_costs ADD COLUMN cae                TEXT;
        ALTER TABLE comex_import_extra_costs ADD COLUMN referencia_despacho TEXT;
        ALTER TABLE comex_import_extra_costs ADD COLUMN importe_iva        REAL;
        ALTER TABLE comex_import_extra_costs ADD COLUMN importe_total      REAL;
        ALTER TABLE comex_import_extra_costs ADD COLUMN items_json         TEXT;
      `)
    }
  },
  {
    version: 26,
    up: (db) => {
      db.exec(`
        ALTER TABLE comex_import_extra_costs ADD COLUMN tipo_cambio        REAL;
        ALTER TABLE comex_import_extra_costs ADD COLUMN bl_referencia      TEXT;
        ALTER TABLE comex_import_extra_costs ADD COLUMN importe_ars        REAL;
      `)
    }
  },
  {
    version: 27,
    up: (db) => {
      // Renombrar el flete internacional (mal llamado "flete_local") al nombre correcto
      db.exec(`
        UPDATE comex_import_extra_costs
        SET categoria = 'flete_internacional', concepto = 'Flete internacional'
        WHERE categoria = 'flete_local' AND concepto IN ('Flete', 'Flete 1', 'Flete 2', 'Flete 3', 'Flete local')
      `)
      // Los que tengan concepto personalizado también se renombran en categoría
      db.exec(`
        UPDATE comex_import_extra_costs
        SET categoria = 'flete_internacional'
        WHERE categoria = 'flete_local'
      `)
    }
  },
  {
    version: 28,
    up: (db) => {
      db.exec(`
        ALTER TABLE comex_import_extra_costs ADD COLUMN percepciones   REAL;
        ALTER TABLE comex_import_extra_costs ADD COLUMN fecha_ingreso  TEXT;
        ALTER TABLE comex_import_extra_costs ADD COLUMN fecha_egreso   TEXT;
        ALTER TABLE comex_import_extra_costs ADD COLUMN nro_contenedor TEXT;
        ALTER TABLE comex_import_extra_costs ADD COLUMN canal_deposito TEXT;
      `)
    }
  },
  {
    version: 29,
    up: (db) => {
      db.exec(`
        ALTER TABLE comex_import_extra_costs ADD COLUMN percepcion_caba REAL;
        ALTER TABLE comex_import_extra_costs ADD COLUMN percepcion_bsas REAL;
      `)
    }
  },
  {
    version: 30,
    up: (db) => {
      db.exec(`
        ALTER TABLE comex_imports ADD COLUMN tc_eur_usd REAL;
      `)
    }
  },
  {
    version: 31,
    up: (db) => {
      db.exec(`ALTER TABLE comex_import_customs ADD COLUMN canal TEXT`)
    }
  },
  {
    version: 32,
    up: (db) => {
      db.exec(`ALTER TABLE comex_imports ADD COLUMN cost_pct REAL`)
    }
  }
]

export function runMigrations(db: Database.Database): void {
  const currentVersion = (db.pragma('user_version', { simple: true }) as number) || 0
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion)

  if (pending.length === 0) return

  for (const migration of pending) {
    const tx = db.transaction(() => {
      migration.up(db)
      db.pragma(`user_version = ${migration.version}`)
    })
    tx()
    console.log(`[DB] Migration ${migration.version} applied`)
  }
}
