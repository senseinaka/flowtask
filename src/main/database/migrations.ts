import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

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
  },
  {
    version: 33,
    up: (db) => {
      db.exec(`
        ALTER TABLE comex_imports ADD COLUMN proformas_folder_id TEXT;

        CREATE TABLE IF NOT EXISTS comex_proformas (
          id               TEXT PRIMARY KEY,
          import_id        TEXT NOT NULL REFERENCES comex_imports(id) ON DELETE CASCADE,
          numero           INTEGER NOT NULL DEFAULT 1,
          fecha_proforma   TEXT,
          importe          REAL,
          moneda           TEXT NOT NULL DEFAULT 'USD',
          nro_proforma     TEXT NOT NULL DEFAULT '',
          descripcion      TEXT NOT NULL DEFAULT '',
          incluir_en_total INTEGER NOT NULL DEFAULT 1,
          stored_name      TEXT,
          original_name    TEXT,
          drive_file_id    TEXT,
          drive_folder_id  TEXT,
          drive_status     TEXT NOT NULL DEFAULT 'none',
          created_at       INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_proformas_import ON comex_proformas(import_id);
      `)
    }
  },
  {
    version: 34,
    up: (db) => {
      db.exec(`
        ALTER TABLE comex_proformas ADD COLUMN tipo TEXT NOT NULL DEFAULT 'proforma';
        ALTER TABLE comex_imports   ADD COLUMN facturas_folder_id TEXT;
      `)
    }
  },
  {
    version: 35,
    up: (db) => {
      // Renombrar tc_eur_usd → tc_eur_ars (la tasa correcta es EUR/ARS directa del BNA)
      db.exec(`ALTER TABLE comex_imports RENAME COLUMN tc_eur_usd TO tc_eur_ars`)
    }
  },
  {
    version: 36,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ai_chat_messages (
          id          TEXT PRIMARY KEY,
          session_id  TEXT NOT NULL DEFAULT 'default',
          role        TEXT NOT NULL,
          content     TEXT NOT NULL,
          created_at  INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chat_session ON ai_chat_messages(session_id, created_at);
      `)
    }
  },
  {
    version: 37,
    up: (db) => {
      // Cantidad de bultos/cajas del despacho (extraído por IA, equivalente a Total Bultos del OM-1993)
      db.exec(`ALTER TABLE comex_import_customs ADD COLUMN cant_bultos INTEGER`)
    }
  },
  {
    version: 38,
    up: (db) => {
      // Campos operativos visibles en Datos Generales (forwarder, despachante, BL, ref. mail)
      db.exec(`
        ALTER TABLE comex_imports ADD COLUMN freight_operator_id TEXT REFERENCES comex_freight_operators(id) ON DELETE SET NULL;
        ALTER TABLE comex_imports ADD COLUMN despachante          TEXT NOT NULL DEFAULT '';
        ALTER TABLE comex_imports ADD COLUMN forwarder_ref_mail   TEXT NOT NULL DEFAULT '';
        ALTER TABLE comex_imports ADD COLUMN bl_number            TEXT NOT NULL DEFAULT '';
      `)
    }
  },
  {
    version: 39,
    up: (db) => {
      // Sección BL - Bill of Lading (archivo adjunto + Drive)
      db.exec(`
        ALTER TABLE comex_imports ADD COLUMN bl_folder_id       TEXT;
        ALTER TABLE comex_imports ADD COLUMN bl_stored_name     TEXT;
        ALTER TABLE comex_imports ADD COLUMN bl_original_name   TEXT;
        ALTER TABLE comex_imports ADD COLUMN bl_drive_file_id   TEXT;
        ALTER TABLE comex_imports ADD COLUMN bl_drive_status    TEXT NOT NULL DEFAULT 'none';
      `)
    }
  },
  {
    version: 40,
    up: (db) => {
      // Editor de prompts: overrides por operación
      db.exec(`
        CREATE TABLE IF NOT EXISTS ai_prompt_overrides (
          operation     TEXT PRIMARY KEY,
          system_prompt TEXT NOT NULL,
          notes         TEXT NOT NULL DEFAULT '',
          updated_at    INTEGER NOT NULL
        )
      `)
    }
  },
  {
    version: 41,
    up: (db) => {
      // Cantidad de cajas/cartones (separado de pallets)
      db.exec(`ALTER TABLE comex_import_customs ADD COLUMN cant_cartons INTEGER`)
    }
  },
  {
    version: 42,
    up: (db) => {
      // JSON con todos los datos extraídos del BL (para mostrarlos en la sección)
      db.exec(`ALTER TABLE comex_imports ADD COLUMN bl_extracted_json TEXT`)
    }
  },
  {
    version: 43,
    up: (db) => {
      // Carpeta INAL en Drive + documentos PL y Xls resumen INAL
      db.exec(`
        ALTER TABLE comex_imports ADD COLUMN inal_drive_folder_id  TEXT;
        ALTER TABLE comex_imports ADD COLUMN inal_pl_ok            INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE comex_imports ADD COLUMN inal_pl_stored_name   TEXT;
        ALTER TABLE comex_imports ADD COLUMN inal_pl_original_name TEXT;
        ALTER TABLE comex_imports ADD COLUMN inal_pl_drive_file_id TEXT;
        ALTER TABLE comex_imports ADD COLUMN inal_pl_drive_status  TEXT NOT NULL DEFAULT 'none';
        ALTER TABLE comex_imports ADD COLUMN inal_xls_ok           INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE comex_imports ADD COLUMN inal_xls_stored_name  TEXT;
        ALTER TABLE comex_imports ADD COLUMN inal_xls_original_name TEXT;
        ALTER TABLE comex_imports ADD COLUMN inal_xls_drive_file_id TEXT;
        ALTER TABLE comex_imports ADD COLUMN inal_xls_drive_status TEXT NOT NULL DEFAULT 'none';
      `)
    }
  },
  {
    version: 44,
    up: (db) => {
      // Copias propias de Factura y BL para la carpeta INAL
      db.exec(`
        ALTER TABLE comex_imports ADD COLUMN inal_factura_stored_name   TEXT;
        ALTER TABLE comex_imports ADD COLUMN inal_factura_original_name TEXT;
        ALTER TABLE comex_imports ADD COLUMN inal_factura_drive_file_id TEXT;
        ALTER TABLE comex_imports ADD COLUMN inal_factura_drive_status  TEXT NOT NULL DEFAULT 'none';
        ALTER TABLE comex_imports ADD COLUMN inal_bl_stored_name        TEXT;
        ALTER TABLE comex_imports ADD COLUMN inal_bl_original_name      TEXT;
        ALTER TABLE comex_imports ADD COLUMN inal_bl_drive_file_id      TEXT;
        ALTER TABLE comex_imports ADD COLUMN inal_bl_drive_status       TEXT NOT NULL DEFAULT 'none';
      `)
    }
  },
  {
    version: 45,
    up: (db) => {
      // Gestores INAL y Despachantes como entidades propias
      db.exec(`
        CREATE TABLE IF NOT EXISTS comex_gestores (
          id           TEXT PRIMARY KEY,
          name         TEXT NOT NULL,
          estudio      TEXT NOT NULL DEFAULT '',
          cuit         TEXT NOT NULL DEFAULT '',
          email        TEXT NOT NULL DEFAULT '',
          phone        TEXT NOT NULL DEFAULT '',
          whatsapp     TEXT NOT NULL DEFAULT '',
          especialidades TEXT NOT NULL DEFAULT '',
          notas        TEXT NOT NULL DEFAULT '',
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS comex_gestor_contacts (
          id         TEXT PRIMARY KEY,
          gestor_id  TEXT NOT NULL REFERENCES comex_gestores(id) ON DELETE CASCADE,
          name       TEXT NOT NULL DEFAULT '',
          role       TEXT NOT NULL DEFAULT '',
          email      TEXT NOT NULL DEFAULT '',
          phone      TEXT NOT NULL DEFAULT '',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS comex_despachantes (
          id         TEXT PRIMARY KEY,
          name       TEXT NOT NULL,
          matricula  TEXT NOT NULL DEFAULT '',
          empresa    TEXT NOT NULL DEFAULT '',
          cuit       TEXT NOT NULL DEFAULT '',
          email      TEXT NOT NULL DEFAULT '',
          phone      TEXT NOT NULL DEFAULT '',
          whatsapp   TEXT NOT NULL DEFAULT '',
          notas      TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        ALTER TABLE comex_imports ADD COLUMN gestor_id TEXT REFERENCES comex_gestores(id) ON DELETE SET NULL;
      `)
    }
  },
  {
    version: 46,
    up: (db) => {
      // Nuevos estados: Arribado, Traslado a depósito fiscal, Oficializado
      // + fechas que disparan transiciones automáticas
      db.exec(`
        ALTER TABLE comex_imports ADD COLUMN aviso_arribo_date       INTEGER;
        ALTER TABLE comex_imports ADD COLUMN traslado_deposito_date  INTEGER;
        ALTER TABLE comex_imports ADD COLUMN oficializacion_import_date INTEGER;
      `)
    }
  },
  {
    version: 47,
    up: (db) => {
      db.exec(`
        ALTER TABLE comex_gestores ADD COLUMN website        TEXT NOT NULL DEFAULT '';
        ALTER TABLE comex_gestores ADD COLUMN direccion      TEXT NOT NULL DEFAULT '';
        ALTER TABLE comex_gestores ADD COLUMN phone_empresa  TEXT NOT NULL DEFAULT '';
        ALTER TABLE comex_gestores ADD COLUMN logo_stored_name TEXT;

        ALTER TABLE comex_despachantes ADD COLUMN website          TEXT NOT NULL DEFAULT '';
        ALTER TABLE comex_despachantes ADD COLUMN direccion        TEXT NOT NULL DEFAULT '';
        ALTER TABLE comex_despachantes ADD COLUMN phone_empresa    TEXT NOT NULL DEFAULT '';
        ALTER TABLE comex_despachantes ADD COLUMN logo_stored_name TEXT;

        CREATE TABLE IF NOT EXISTS comex_despachante_contacts (
          id               TEXT PRIMARY KEY,
          despachante_id   TEXT NOT NULL REFERENCES comex_despachantes(id) ON DELETE CASCADE,
          name             TEXT NOT NULL DEFAULT '',
          role             TEXT NOT NULL DEFAULT '',
          email            TEXT NOT NULL DEFAULT '',
          phone            TEXT NOT NULL DEFAULT '',
          sort_order       INTEGER NOT NULL DEFAULT 0,
          created_at       INTEGER NOT NULL
        );
      `)
    }
  },
  {
    version: 48,
    up: (db) => {
      // Turno de carga en depósito fiscal (paso previo a Entregado)
      db.exec(`
        ALTER TABLE comex_imports ADD COLUMN carga_deposito_date INTEGER;
        ALTER TABLE comex_imports ADD COLUMN carga_deposito_time TEXT;
      `)
    }
  },
  {
    version: 50,
    up: (db) => {
      db.exec(`
        ALTER TABLE comex_imports ADD COLUMN pl_folder_id       TEXT;
        ALTER TABLE comex_imports ADD COLUMN pl_stored_name     TEXT;
        ALTER TABLE comex_imports ADD COLUMN pl_original_name   TEXT;
        ALTER TABLE comex_imports ADD COLUMN pl_drive_file_id   TEXT;
        ALTER TABLE comex_imports ADD COLUMN pl_drive_status    TEXT NOT NULL DEFAULT 'none';
        ALTER TABLE comex_imports ADD COLUMN pl_extracted_json  TEXT;
      `)
    }
  },
  {
    version: 49,
    up: (db) => {
      // Grupos de WhatsApp favoritos + templates de mensajes
      db.exec(`
        CREATE TABLE IF NOT EXISTS whatsapp_groups (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          jid         TEXT NOT NULL UNIQUE,
          description TEXT NOT NULL DEFAULT '',
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS whatsapp_templates (
          id          TEXT PRIMARY KEY,
          key         TEXT NOT NULL UNIQUE,
          name        TEXT NOT NULL,
          body        TEXT NOT NULL,
          updated_at  INTEGER NOT NULL
        );

        INSERT OR IGNORE INTO whatsapp_templates (id, key, name, body, updated_at)
        VALUES (
          'tpl_carga_deposito',
          'carga_deposito',
          'Aviso de turno de carga',
          '¡Hola chicos!\n\nLes comunico que está disponible la carga de {marca}\n\nTurno de carga: {dia_turno_texto} a las {hora_turno} hs\nEstimamos que el camión llegará a nuestro depósito poco después del turno.\n\nImportación: {titulo}\nPeso bruto: {peso}\nVolumen: {volumen}\nPallets: {pallets}\n{cajas_linea}\n{link_pl}Cualquier cosa me cuentan, por favor',
          ${Date.now()}
        );
      `)
    }
  },
  {
    version: 51,
    up: (db) => {
      db.exec(`
        ALTER TABLE comex_imports ADD COLUMN carga_armada_date        INTEGER;
        ALTER TABLE comex_imports ADD COLUMN esperando_embarcar_date  INTEGER;
      `)
    }
  },
  {
    version: 52,
    up: (db) => {
      const now = Date.now()
      db.exec(`
        CREATE TABLE IF NOT EXISTS expiry_categories (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          icon        TEXT NOT NULL DEFAULT '📄',
          color       TEXT NOT NULL DEFAULT '#6366f1',
          is_default  INTEGER NOT NULL DEFAULT 0,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS expiry_items (
          id                    TEXT PRIMARY KEY,
          category_id           TEXT NOT NULL REFERENCES expiry_categories(id) ON DELETE CASCADE,
          title                 TEXT NOT NULL,
          description           TEXT NOT NULL DEFAULT '',
          holder                TEXT NOT NULL DEFAULT '',
          expiry_date           INTEGER NOT NULL,
          frequency             TEXT NOT NULL DEFAULT 'annual',
          frequency_custom_days INTEGER,
          is_renewed            INTEGER NOT NULL DEFAULT 0,
          renewed_date          INTEGER,
          next_expiry_date      INTEGER,
          notes                 TEXT NOT NULL DEFAULT '',
          created_at            INTEGER NOT NULL,
          updated_at            INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS expiry_alerts (
          id               TEXT PRIMARY KEY,
          item_id          TEXT NOT NULL REFERENCES expiry_items(id) ON DELETE CASCADE,
          days_before      INTEGER NOT NULL,
          channel          TEXT NOT NULL DEFAULT 'both',
          whatsapp_number  TEXT NOT NULL DEFAULT '',
          last_sent_at     INTEGER,
          created_at       INTEGER NOT NULL
        );
      `)

      // Seed categorías por defecto
      const categories = [
        { name: 'Documentos personales',  icon: '🪪', color: '#3b82f6' },
        { name: 'Documentos societarios', icon: '🏢', color: '#8b5cf6' },
        { name: 'Dominios web',           icon: '🌐', color: '#06b6d4' },
        { name: 'Seguros',                icon: '🛡️', color: '#10b981' },
        { name: 'Contratos',              icon: '📋', color: '#f59e0b' },
        { name: 'Legales / Registros',    icon: '⚖️', color: '#f97316' },
        { name: 'Membresías',             icon: '🎫', color: '#ec4899' },
      ]
      const insert = db.prepare(`
        INSERT INTO expiry_categories (id, name, icon, color, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `)
      const { v4: uuidv4 } = require('uuid')
      for (const cat of categories) {
        insert.run(uuidv4(), cat.name, cat.icon, cat.color, now, now)
      }
    }
  },
  {
    version: 53,
    up: (db) => {
      const now = Date.now()
      db.exec(`
        CREATE TABLE IF NOT EXISTS finance_accounts (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          icon        TEXT NOT NULL DEFAULT '💰',
          color       TEXT NOT NULL DEFAULT '#10b981',
          is_default  INTEGER NOT NULL DEFAULT 0,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS finance_categories (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          icon        TEXT NOT NULL DEFAULT '📁',
          color       TEXT NOT NULL DEFAULT '#6366f1',
          is_default  INTEGER NOT NULL DEFAULT 0,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS finance_concepts (
          id              TEXT PRIMARY KEY,
          category_id     TEXT NOT NULL REFERENCES finance_categories(id) ON DELETE CASCADE,
          account_id      TEXT NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
          name            TEXT NOT NULL,
          default_amount  REAL NOT NULL DEFAULT 0,
          expense_type    TEXT NOT NULL DEFAULT 'fixed',
          payment_method  TEXT NOT NULL DEFAULT 'transfer',
          recurrence      TEXT NOT NULL DEFAULT 'monthly',
          is_active       INTEGER NOT NULL DEFAULT 1,
          notes           TEXT NOT NULL DEFAULT '',
          created_at      INTEGER NOT NULL,
          updated_at      INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS finance_movements (
          id                TEXT PRIMARY KEY,
          concept_id        TEXT NOT NULL REFERENCES finance_concepts(id) ON DELETE CASCADE,
          month             INTEGER NOT NULL,
          year              INTEGER NOT NULL,
          amount_estimated  REAL NOT NULL DEFAULT 0,
          amount_actual     REAL,
          status            TEXT NOT NULL DEFAULT 'pending',
          payment_method    TEXT NOT NULL DEFAULT 'transfer',
          payment_date      INTEGER,
          due_date          INTEGER,
          notes             TEXT NOT NULL DEFAULT '',
          created_at        INTEGER NOT NULL,
          updated_at        INTEGER NOT NULL,
          UNIQUE(concept_id, month, year)
        );

        CREATE INDEX IF NOT EXISTS idx_finance_movements_period ON finance_movements(year, month);
      `)

      const { v4: uuidv4 } = require('uuid')

      // ── Cuenta por defecto ────────────────────────────────────────────────
      const accountId = uuidv4()
      db.prepare(`
        INSERT INTO finance_accounts (id, name, icon, color, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `).run(accountId, 'Personal', '👤', '#10b981', now, now)

      // ── Categorías por defecto ────────────────────────────────────────────
      const categoriesData = [
        { key: 'hogar',       name: 'Hogar fijo mensual',  icon: '🏠', color: '#3b82f6' },
        { key: 'hijos',       name: 'Ciro Jano Maia',      icon: '👨‍👩‍👧‍👦', color: '#ec4899' },
        { key: 'personal',    name: 'Personal',            icon: '🙋', color: '#8b5cf6' },
        { key: 'salidas',     name: 'Salidas',             icon: '🍽️', color: '#f97316' },
        { key: 'tarjetas',    name: 'Tarjetas',            icon: '💳', color: '#ef4444' },
        { key: 'auto',        name: 'Auto Lancha',         icon: '🚤', color: '#06b6d4' },
        { key: 'varios',      name: 'Varios',              icon: '📦', color: '#64748b' },
        { key: 'refacciones', name: 'Refacciones hogar',   icon: '🔨', color: '#f59e0b' },
      ]
      const insertCategory = db.prepare(`
        INSERT INTO finance_categories (id, name, icon, color, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `)
      const categoryIds: Record<string, string> = {}
      for (const cat of categoriesData) {
        const id = uuidv4()
        categoryIds[cat.key] = id
        insertCategory.run(id, cat.name, cat.icon, cat.color, now, now)
      }

      // ── Conceptos de prueba (con nombres reales del usuario) ──────────────
      const conceptsData = [
        // Hogar fijo mensual
        { name: 'ABL',                            cat: 'hogar',       amount: 18500,  type: 'fixed',    method: 'debit_auto',  rec: 'monthly'  },
        { name: 'Cablevisión internet',           cat: 'hogar',       amount: 32000,  type: 'fixed',    method: 'debit_auto',  rec: 'monthly'  },
        { name: 'Edenor',                         cat: 'hogar',       amount: 27000,  type: 'variable', method: 'debit_auto',  rec: 'monthly'  },
        { name: 'Seguridad',                      cat: 'hogar',       amount: 45000,  type: 'fixed',    method: 'transfer',    rec: 'monthly'  },
        { name: 'Limpieza',                       cat: 'hogar',       amount: 60000,  type: 'fixed',    method: 'cash',        rec: 'monthly'  },
        { name: 'Jardinero',                      cat: 'hogar',       amount: 35000,  type: 'fixed',    method: 'cash',        rec: 'monthly'  },
        { name: 'Expensas',                       cat: 'hogar',       amount: 52000,  type: 'fixed',    method: 'transfer',    rec: 'monthly'  },
        // Ciro Jano Maia
        { name: 'Colegio',                        cat: 'hijos',       amount: 180000, type: 'fixed',    method: 'debit_auto',  rec: 'monthly'  },
        { name: 'Uniformes',                      cat: 'hijos',       amount: 25000,  type: 'variable', method: 'transfer',    rec: 'one_time' },
        { name: 'Actividades extracurriculares',  cat: 'hijos',       amount: 40000,  type: 'fixed',    method: 'transfer',    rec: 'monthly'  },
        { name: 'Pediatra',                       cat: 'hijos',       amount: 15000,  type: 'variable', method: 'cash',        rec: 'monthly'  },
        // Personal
        { name: 'Gimnasio',                       cat: 'personal',    amount: 22000,  type: 'fixed',    method: 'debit_auto',  rec: 'monthly'  },
        { name: 'Obra social / Prepaga',          cat: 'personal',    amount: 95000,  type: 'fixed',    method: 'debit_auto',  rec: 'monthly'  },
        { name: 'Peluquería',                     cat: 'personal',    amount: 18000,  type: 'variable', method: 'cash',        rec: 'monthly'  },
        // Salidas
        { name: 'Restaurantes',                   cat: 'salidas',     amount: 60000,  type: 'variable', method: 'credit_card', rec: 'monthly'  },
        { name: 'Cine',                           cat: 'salidas',     amount: 15000,  type: 'variable', method: 'credit_card', rec: 'monthly'  },
        { name: 'Entretenimiento',                cat: 'salidas',     amount: 20000,  type: 'variable', method: 'credit_card', rec: 'monthly'  },
        // Tarjetas
        { name: 'Visa',                           cat: 'tarjetas',    amount: 220000, type: 'variable', method: 'credit_card', rec: 'monthly'  },
        { name: 'Mastercard',                     cat: 'tarjetas',    amount: 140000, type: 'variable', method: 'credit_card', rec: 'monthly'  },
        { name: 'American Express',               cat: 'tarjetas',    amount: 80000,  type: 'variable', method: 'credit_card', rec: 'monthly'  },
        // Auto Lancha
        { name: 'Nafta',                          cat: 'auto',        amount: 50000,  type: 'variable', method: 'cash',        rec: 'monthly'  },
        { name: 'Seguro auto',                    cat: 'auto',        amount: 38000,  type: 'fixed',    method: 'debit_auto',  rec: 'monthly'  },
        { name: 'Service',                        cat: 'auto',        amount: 45000,  type: 'variable', method: 'transfer',    rec: 'one_time' },
        { name: 'Amarra / Guardería náutica',     cat: 'auto',        amount: 60000,  type: 'fixed',    method: 'transfer',    rec: 'monthly'  },
        // Varios
        { name: 'Regalos',                        cat: 'varios',      amount: 25000,  type: 'variable', method: 'credit_card', rec: 'monthly'  },
        { name: 'Imprevistos',                    cat: 'varios',      amount: 30000,  type: 'variable', method: 'cash',        rec: 'monthly'  },
        { name: 'Donaciones',                     cat: 'varios',      amount: 10000,  type: 'fixed',    method: 'transfer',    rec: 'monthly'  },
        // Refacciones hogar
        { name: 'Plomería',                       cat: 'refacciones', amount: 35000,  type: 'variable', method: 'transfer',    rec: 'one_time' },
        { name: 'Pintura',                        cat: 'refacciones', amount: 50000,  type: 'variable', method: 'transfer',    rec: 'one_time' },
        { name: 'Electricidad',                   cat: 'refacciones', amount: 28000,  type: 'variable', method: 'transfer',    rec: 'one_time' },
      ]
      const insertConcept = db.prepare(`
        INSERT INTO finance_concepts
          (id, category_id, account_id, name, default_amount, expense_type, payment_method, recurrence, is_active, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, '', ?, ?)
      `)
      const concepts: { id: string; cat: string; amount: number; method: string }[] = []
      for (const c of conceptsData) {
        const id = uuidv4()
        concepts.push({ id, cat: c.cat, amount: c.amount, method: c.method })
        insertConcept.run(id, categoryIds[c.cat], accountId, c.name, c.amount, c.type, c.method, c.rec, now, now)
      }

      // ── Movimientos de prueba: mes actual + 2 anteriores ─────────────────
      const insertMovement = db.prepare(`
        INSERT INTO finance_movements
          (id, concept_id, month, year, amount_estimated, amount_actual, status, payment_method, payment_date, due_date, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)
      `)

      const today = new Date(now)
      const periods: { month: number; year: number; offset: number }[] = []
      for (let i = 2; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
        periods.push({ month: d.getMonth() + 1, year: d.getFullYear(), offset: i })
      }

      // Generador determinístico simple (evita Math.random para datos reproducibles)
      let seed = 42
      const rand = (): number => {
        seed = (seed * 9301 + 49297) % 233280
        return seed / 233280
      }

      for (const period of periods) {
        for (const concept of concepts) {
          // El monto real varía un poco respecto al estimado (entre -8% y +18%)
          const variation    = 1 + (rand() * 0.26 - 0.08)
          const amountActual = Math.round(concept.amount * variation)
          const dueDate      = new Date(period.year, period.month - 1, 10).getTime()

          let status: string
          let paymentDate: number | null
          let actualToStore: number | null

          if (period.offset === 0) {
            // Mes actual: mezcla realista de pagados / pendientes / vencidos
            const r = rand()
            if (r < 0.45) {
              status        = 'paid'
              paymentDate   = new Date(period.year, period.month - 1, Math.min(8, today.getDate())).getTime()
              actualToStore = amountActual
            } else if (r < 0.8) {
              status        = 'pending'
              paymentDate   = null
              actualToStore = null
            } else {
              status        = 'overdue'
              paymentDate   = null
              actualToStore = null
            }
          } else {
            // Meses anteriores: todo ya pagado (para alimentar la comparación mes a mes)
            status        = 'paid'
            paymentDate   = new Date(period.year, period.month - 1, 5 + Math.floor(rand() * 15)).getTime()
            actualToStore = amountActual
          }

          insertMovement.run(
            uuidv4(), concept.id, period.month, period.year,
            concept.amount, actualToStore, status, concept.method,
            paymentDate, dueDate, now, now
          )
        }
      }
    }
  },
  {
    version: 54,
    up: (db) => {
      // Fase 4 — Recurrencia y meses: los conceptos "anuales" necesitan saber
      // en qué mes del año corresponde generar su movimiento (ej: un seguro
      // que se paga cada marzo). Nullable porque solo aplica a recurrence='annual'.
      db.exec(`
        ALTER TABLE finance_concepts ADD COLUMN recurrence_month INTEGER;
      `)
    }
  },
  {
    version: 55,
    up: (db) => {
      // Reinicio del módulo Finanzas — migración de un solo uso.
      //
      // Diego venía trabajando con conceptos duplicados ("Nafta 1", "Nafta 2",
      // "Supermercado 1", "Supermercado 2"...) como workaround a la restricción
      // UNIQUE(concept_id, month, year): no había forma de cargar varias
      // ocurrencias del mismo gasto en un mes bajo un solo concepto.
      //
      // Se decidió rediseñar esto con un "registro de cargas" (sub-entradas que
      // suman al total de un único movimiento por concepto/mes — Opción C del
      // plan maestro) y arrancar de cero: se eliminan conceptos y movimientos
      // existentes para no migrar la data duplicada.
      //
      // Cuentas y categorías NO se tocan (siguen siendo válidas en el nuevo
      // esquema). Los datos previos quedan respaldados automáticamente por el
      // sistema de backups locales (carpeta "FlowTask Backups") antes de correr
      // esta migración — no se pierde nada irreversiblemente.
      db.exec(`
        DELETE FROM finance_movements;
        DELETE FROM finance_concepts;
      `)
    }
  },
  {
    version: 56,
    up: (db) => {
      // Opción C del plan maestro de "conceptos multi-carga": Nafta, Supermercado
      // y similares dejan de necesitar duplicados ("Nafta 1", "Nafta 2"...). Un
      // concepto marcado con tracks_multiple_entries=1 sigue teniendo un único
      // movimiento por mes (no se toca el UNIQUE(concept_id, month, year)), pero
      // ese movimiento acumula un "registro de cargas" — cada carga con su monto,
      // fecha y nota — y `amount_actual` se recalcula como la suma automáticamente.
      db.exec(`
        ALTER TABLE finance_concepts ADD COLUMN tracks_multiple_entries INTEGER NOT NULL DEFAULT 0;

        CREATE TABLE IF NOT EXISTS finance_movement_entries (
          id           TEXT PRIMARY KEY,
          movement_id  TEXT NOT NULL REFERENCES finance_movements(id) ON DELETE CASCADE,
          amount       REAL NOT NULL,
          entry_date   INTEGER,
          note         TEXT NOT NULL DEFAULT '',
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_finance_movement_entries_movement
          ON finance_movement_entries(movement_id);
      `)
    }
  },
  {
    version: 57,
    up: (db) => {
      // "Métodos de pago" pasa de ser un union type fijo (6 valores hardcodeados
      // en types.ts) a una entidad gestionable por el usuario — mismo patrón que
      // `finance_categories` / `finance_accounts` (alta, edición, borrado desde
      // la UI, con un set de métodos "de fábrica" protegidos).
      //
      // Sembramos los 6 métodos originales reusando EXACTAMENTE los mismos ids
      // de texto que ya estaban guardados en `finance_concepts.payment_method` y
      // `finance_movements.payment_method` ('cash', 'transfer', 'debit_auto',
      // 'debit_card', 'credit_card', 'other') — así no hace falta migrar ni un
      // solo registro existente: los valores ya guardados siguen resolviendo
      // correctamente contra la nueva tabla.
      db.exec(`
        CREATE TABLE IF NOT EXISTS finance_payment_methods (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          icon        TEXT NOT NULL DEFAULT '💳',
          color       TEXT NOT NULL DEFAULT '#64748b',
          is_default  INTEGER NOT NULL DEFAULT 0,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );
      `)

      const now = Date.now()
      const methodsData = [
        { id: 'cash',        name: 'Efectivo',           icon: '💵', color: '#22c55e' },
        { id: 'transfer',    name: 'Transferencia',      icon: '🏦', color: '#3b82f6' },
        { id: 'debit_auto',  name: 'Débito automático',  icon: '🔄', color: '#8b5cf6' },
        { id: 'debit_card',  name: 'Tarjeta de débito',  icon: '💳', color: '#06b6d4' },
        { id: 'credit_card', name: 'Tarjeta de crédito', icon: '💳', color: '#ef4444' },
        { id: 'other',       name: 'Otro',               icon: '🔖', color: '#64748b' },
      ]
      const insertMethod = db.prepare(`
        INSERT INTO finance_payment_methods (id, name, icon, color, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `)
      for (const m of methodsData) {
        insertMethod.run(m.id, m.name, m.icon, m.color, now, now)
      }
    }
  },
  {
    version: 58,
    up: (db) => {
      // Dashboard mensual — dos campos nuevos que el usuario pidió agregar justo
      // debajo de las tarjetas de resumen: notas libres (para anotar el "por qué"
      // de las variaciones del gasto) y un análisis comparativo generado por IA.
      // A diferencia de summary/breakdown/etc. (todo "al vuelo", nada persiste),
      // ACÁ SÍ se persiste — son contenido del usuario / resultado guardado a
      // pedido, no un cómputo derivable de los movimientos. Una fila por
      // (month, year): UNIQUE garantiza upsert limpio vía ON CONFLICT.
      db.exec(`
        CREATE TABLE IF NOT EXISTS finance_month_insights (
          id              TEXT PRIMARY KEY,
          month           INTEGER NOT NULL,
          year            INTEGER NOT NULL,
          notes           TEXT NOT NULL DEFAULT '',
          ai_analysis     TEXT,
          ai_generated_at INTEGER,
          created_at      INTEGER NOT NULL,
          updated_at      INTEGER NOT NULL,
          UNIQUE(month, year)
        );
      `)
    }
  },
  {
    version: 59,
    up: (db) => {
      // Finanzas Empresa — módulo completamente separado de Finanzas Personales,
      // mismo esquema que finance_* (ya consolidado con recurrence_month y
      // tracks_multiple_entries desde el inicio, sin necesidad de migraciones
      // incrementales) pero en tablas company_finance_* propias, para llevar
      // los gastos de Naka Outdoors sin mezclarlos con los personales.
      const now = Date.now()
      db.exec(`
        CREATE TABLE IF NOT EXISTS company_finance_accounts (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          icon        TEXT NOT NULL DEFAULT '💰',
          color       TEXT NOT NULL DEFAULT '#10b981',
          is_default  INTEGER NOT NULL DEFAULT 0,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS company_finance_categories (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          icon        TEXT NOT NULL DEFAULT '📁',
          color       TEXT NOT NULL DEFAULT '#6366f1',
          is_default  INTEGER NOT NULL DEFAULT 0,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS company_finance_payment_methods (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          icon        TEXT NOT NULL DEFAULT '💳',
          color       TEXT NOT NULL DEFAULT '#64748b',
          is_default  INTEGER NOT NULL DEFAULT 0,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS company_finance_concepts (
          id                       TEXT PRIMARY KEY,
          category_id              TEXT NOT NULL REFERENCES company_finance_categories(id) ON DELETE CASCADE,
          account_id               TEXT NOT NULL REFERENCES company_finance_accounts(id) ON DELETE CASCADE,
          name                     TEXT NOT NULL,
          default_amount           REAL NOT NULL DEFAULT 0,
          expense_type             TEXT NOT NULL DEFAULT 'fixed',
          payment_method           TEXT NOT NULL DEFAULT 'transfer',
          recurrence               TEXT NOT NULL DEFAULT 'monthly',
          recurrence_month         INTEGER,
          tracks_multiple_entries  INTEGER NOT NULL DEFAULT 0,
          is_active                INTEGER NOT NULL DEFAULT 1,
          notes                    TEXT NOT NULL DEFAULT '',
          created_at               INTEGER NOT NULL,
          updated_at               INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS company_finance_movements (
          id                TEXT PRIMARY KEY,
          concept_id        TEXT NOT NULL REFERENCES company_finance_concepts(id) ON DELETE CASCADE,
          month             INTEGER NOT NULL,
          year              INTEGER NOT NULL,
          amount_estimated  REAL NOT NULL DEFAULT 0,
          amount_actual     REAL,
          status            TEXT NOT NULL DEFAULT 'pending',
          payment_method    TEXT NOT NULL DEFAULT 'transfer',
          payment_date      INTEGER,
          due_date          INTEGER,
          notes             TEXT NOT NULL DEFAULT '',
          created_at        INTEGER NOT NULL,
          updated_at        INTEGER NOT NULL,
          UNIQUE(concept_id, month, year)
        );

        CREATE INDEX IF NOT EXISTS idx_company_finance_movements_period ON company_finance_movements(year, month);

        CREATE TABLE IF NOT EXISTS company_finance_movement_entries (
          id           TEXT PRIMARY KEY,
          movement_id  TEXT NOT NULL REFERENCES company_finance_movements(id) ON DELETE CASCADE,
          amount       REAL NOT NULL,
          entry_date   INTEGER,
          note         TEXT NOT NULL DEFAULT '',
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_company_finance_movement_entries_movement
          ON company_finance_movement_entries(movement_id);

        CREATE TABLE IF NOT EXISTS company_finance_month_insights (
          id              TEXT PRIMARY KEY,
          month           INTEGER NOT NULL,
          year            INTEGER NOT NULL,
          notes           TEXT NOT NULL DEFAULT '',
          ai_analysis     TEXT,
          ai_generated_at INTEGER,
          created_at      INTEGER NOT NULL,
          updated_at      INTEGER NOT NULL,
          UNIQUE(month, year)
        );
      `)

      const { v4: uuidv4 } = require('uuid')

      // ── Métodos de pago (mismos ids que finance_payment_methods) ──────────
      const methodsData = [
        { id: 'cash',        name: 'Efectivo',           icon: '💵', color: '#22c55e' },
        { id: 'transfer',    name: 'Transferencia',      icon: '🏦', color: '#3b82f6' },
        { id: 'debit_auto',  name: 'Débito automático',  icon: '🔄', color: '#8b5cf6' },
        { id: 'debit_card',  name: 'Tarjeta de débito',  icon: '💳', color: '#06b6d4' },
        { id: 'credit_card', name: 'Tarjeta de crédito', icon: '💳', color: '#ef4444' },
        { id: 'other',       name: 'Otro',               icon: '🔖', color: '#64748b' },
      ]
      const insertMethod = db.prepare(`
        INSERT INTO company_finance_payment_methods (id, name, icon, color, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `)
      for (const m of methodsData) {
        insertMethod.run(m.id, m.name, m.icon, m.color, now, now)
      }

      // ── Cuenta por defecto ──────────────────────────────────────────────────
      const accountId = uuidv4()
      db.prepare(`
        INSERT INTO company_finance_accounts (id, name, icon, color, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `).run(accountId, 'Cuenta Empresa', '🏢', '#10b981', now, now)

      // ── Categorías ────────────────────────────────────────────────────────
      const categoriesData = [
        { key: 'alquileres',      name: 'Alquileres',                              icon: '🏢', color: '#3b82f6' },
        { key: 'abl',             name: 'Impuestos inmobiliarios (ABL)',           icon: '🏛️', color: '#f59e0b' },
        { key: 'expensas',        name: 'Expensas (X28)',                          icon: '🏘️', color: '#06b6d4' },
        { key: 'internet',        name: 'Servicios - Internet/Telefonía',          icon: '📡', color: '#8b5cf6' },
        { key: 'electricidad',    name: 'Servicios - Electricidad',                icon: '💡', color: '#eab308' },
        { key: 'agua',            name: 'Servicios - Agua',                        icon: '💧', color: '#0ea5e9' },
        { key: 'gas',             name: 'Servicios - Gas',                         icon: '🔥', color: '#f97316' },
        { key: 'seguros',         name: 'Seguros y patentes',                      icon: '🛡️', color: '#10b981' },
        { key: 'hosting',         name: 'Hosting y software',                      icon: '💻', color: '#6366f1' },
        { key: 'marketing',       name: 'Publicidad y marketing',                  icon: '📣', color: '#ec4899' },
        { key: 'honorarios',      name: 'Honorarios profesionales',                icon: '👔', color: '#64748b' },
        { key: 'impuestos',       name: 'Impuestos y cargas fiscales',             icon: '🧾', color: '#ef4444' },
        { key: 'sueldos',         name: 'Sueldos y honorarios de personal',        icon: '👥', color: '#14b8a6' },
        { key: 'cargas_sociales', name: 'Cargas sociales y sindicales',            icon: '🤝', color: '#a855f7' },
        { key: 'insumos',         name: 'Insumos y papelería',                     icon: '📎', color: '#84cc16' },
        { key: 'it_servicios',    name: 'Servicios informáticos / tecnología',     icon: '🖥️', color: '#0891b2' },
      ]
      const insertCategory = db.prepare(`
        INSERT INTO company_finance_categories (id, name, icon, color, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `)
      const categoryIds: Record<string, string> = {}
      for (const cat of categoriesData) {
        const id = uuidv4()
        categoryIds[cat.key] = id
        insertCategory.run(id, cat.name, cat.icon, cat.color, now, now)
      }

      // ── Conceptos (gastos recurrentes mensuales de la empresa) ─────────────
      const conceptsData = [
        // Alquileres
        { name: 'Alquiler Local Gral Paz',                   cat: 'alquileres' },
        { name: 'Alquiler Oficinas Arias',                   cat: 'alquileres' },
        { name: 'Alquiler Oficinas Arcos',                   cat: 'alquileres' },
        // Impuestos inmobiliarios (ABL)
        { name: 'ABL Arias',                                 cat: 'abl' },
        { name: 'ABL Cuba',                                  cat: 'abl' },
        { name: 'ABL Arcos - Gral Paz 750',                  cat: 'abl' },
        { name: 'ABL Gral Paz UF1',                          cat: 'abl' },
        { name: 'ABL Gral Paz UF2',                          cat: 'abl' },
        { name: 'ABL Gral Paz UF3',                          cat: 'abl' },
        { name: 'ABL Gral Paz UF4',                          cat: 'abl' },
        // Expensas (X28)
        { name: 'X28 Gral Paz 898 - Contrato 10143316',      cat: 'expensas' },
        { name: 'X28 Arias 2421 - Contrato 10158891',        cat: 'expensas' },
        { name: 'X28 Gral Paz 750 - Contrato 10164220',      cat: 'expensas' },
        { name: 'X28 Cuba Contrato 10165936',                cat: 'expensas' },
        // Servicios - Internet/Telefonía
        { name: 'Telecentro Arias',                          cat: 'internet' },
        { name: 'Telecom Cuba',                              cat: 'internet' },
        { name: 'Telecom Gral Paz',                          cat: 'internet' },
        { name: 'Movistar Gral Paz',                         cat: 'internet' },
        // Servicios - Electricidad
        { name: 'Edenor Arias',                              cat: 'electricidad' },
        { name: 'Edenor Gral Paz 898',                       cat: 'electricidad' },
        { name: 'Edenor Gral Paz 750',                       cat: 'electricidad' },
        { name: 'Edenor Cuba',                               cat: 'electricidad' },
        // Servicios - Agua
        { name: 'Aysa Arias',                                cat: 'agua' },
        { name: 'Aysa Gral Paz 898',                         cat: 'agua' },
        { name: 'Aysa Gral Paz 750',                         cat: 'agua' },
        { name: 'Aysa Cuba',                                 cat: 'agua' },
        // Servicios - Gas
        { name: 'Metrogas Arias',                            cat: 'gas' },
        { name: 'Metrogas Cuba',                             cat: 'gas' },
        { name: 'Metrogas Gral Paz 750',                     cat: 'gas' },
        { name: 'Metrogas Arcos',                            cat: 'gas' },
        // Seguros y patentes
        { name: 'Seguro Sura integral de comercio',          cat: 'seguros' },
        { name: 'Seguro ATM Trimoto',                        cat: 'seguros' },
        { name: 'Patente Trimoto',                           cat: 'seguros' },
        // Hosting y software
        { name: 'Hosting Mesi',                              cat: 'hosting' },
        { name: 'Hosting NatureHike',                        cat: 'hosting' },
        { name: 'Hosting Aonijie',                           cat: 'hosting' },
        { name: 'Sendingblue',                               cat: 'hosting' },
        { name: 'Dominio Nakaoutdoors.com',                  cat: 'hosting' },
        // Publicidad y marketing
        { name: 'Publicidad Vertical',                       cat: 'marketing' },
        { name: 'Publicidad Vía Pública',                    cat: 'marketing' },
        { name: 'Publicidad Envialosimple',                  cat: 'marketing' },
        { name: 'Publicidad Facebook',                       cat: 'marketing' },
        { name: 'Google Adwords',                            cat: 'marketing' },
        // Honorarios profesionales
        { name: 'Contador',                                  cat: 'honorarios' },
        { name: 'Sociedades Outdoor y Green',                cat: 'honorarios' },
        { name: 'Honorarios estudio por extras',             cat: 'honorarios' },
        { name: 'Honorarios Abogado',                        cat: 'honorarios' },
        { name: 'Honorarios Cecilia obra',                   cat: 'honorarios' },
        { name: 'Honorarios Carballeiro estudio',            cat: 'honorarios' },
        { name: 'Honorarios ATL comex',                      cat: 'honorarios' },
        { name: 'Honorarios Agus Diseño marca',              cat: 'honorarios' },
        // Impuestos y cargas fiscales
        { name: 'Galicia Mant. SRL 1',                       cat: 'impuestos' },
        { name: 'Galicia Mant. SRL 2',                       cat: 'impuestos' },
        { name: 'IVA SRL',                                   cat: 'impuestos' },
        { name: 'Iva Diego Nakamura',                        cat: 'impuestos' },
        { name: 'IIBB SRL',                                  cat: 'impuestos' },
        { name: 'IIBB Diego Nakamura',                       cat: 'impuestos' },
        { name: 'Autónomos Diego Nakamura',                  cat: 'impuestos' },
        { name: 'Ganancias pers saldo',                      cat: 'impuestos' },
        { name: 'Ganancias pers Anticipo 5/5',               cat: 'impuestos' },
        { name: 'Bienes personales (Diego/Ana)',             cat: 'impuestos' },
        { name: 'Bienes pers Anticipo',                      cat: 'impuestos' },
        { name: 'Bienes sociedad 899A',                      cat: 'impuestos' },
        { name: 'Ganancias Sociedades',                      cat: 'impuestos' },
        { name: 'Pago balance',                              cat: 'impuestos' },
        { name: 'Pago ganancias y bienes personales',        cat: 'impuestos' },
        { name: 'Sicore',                                    cat: 'impuestos' },
        // Sueldos y honorarios de personal
        { name: 'Sueldo Naka',                               cat: 'sueldos' },
        { name: 'Sueldo Hernán Perez Erramouspe',            cat: 'sueldos' },
        { name: 'Sueldo Gabriela Rolón',                     cat: 'sueldos' },
        { name: 'Sueldo Juan Manuel Siris',                  cat: 'sueldos' },
        { name: 'Sueldo Karla Palacio Monsalve',             cat: 'sueldos' },
        { name: 'Sueldo Ramiro Furcenko',                    cat: 'sueldos' },
        { name: 'Sueldo Graciela Ledesma',                   cat: 'sueldos' },
        { name: 'Sueldo Gonzalo Vieta',                      cat: 'sueldos' },
        { name: 'Sueldo Reyes Caraccio Joaquin',             cat: 'sueldos' },
        { name: 'Sueldo Fernando David Tornielli',           cat: 'sueldos' },
        { name: 'Sueldo Matías Rosales',                     cat: 'sueldos' },
        { name: 'Sueldo Elena Noemi Ledesma',                cat: 'sueldos' },
        { name: 'Sueldo Braian Benitez Formeliano',          cat: 'sueldos' },
        { name: 'Sueldo Ezquerra Fernando Joaquin',          cat: 'sueldos' },
        { name: 'Sueldo Roman Leandro Facundo',              cat: 'sueldos' },
        { name: 'Sueldo Catalina Ariana Lucero',             cat: 'sueldos' },
        { name: 'Sueldo Oscar Lovarvo',                      cat: 'sueldos' },
        { name: 'Sueldo Andrea Basualdo Williams',           cat: 'sueldos' },
        { name: 'Sueldo Ezequiel Alberto Di Fabio',          cat: 'sueldos' },
        { name: 'Sueldo Franco Ivan Caccetta',               cat: 'sueldos' },
        { name: 'Sueldo Leonor Marin',                       cat: 'sueldos' },
        { name: 'Sueldo Tomás Navarro Santiago',             cat: 'sueldos' },
        { name: 'Sueldo Ruben Vivas Angel',                  cat: 'sueldos' },
        { name: 'Sueldo Mercedez Figueredo',                 cat: 'sueldos' },
        { name: 'Sueldo Martina Lucero',                     cat: 'sueldos' },
        { name: 'Sueldo Emanuel Alejandro Ríos',             cat: 'sueldos' },
        { name: 'Sueldo Mercedes Dibernardi',                cat: 'sueldos' },
        { name: 'Sueldo Jimenez Ghione Nicolás',             cat: 'sueldos' },
        { name: 'Sueldo Ariana Ayelen Salas Llorente',       cat: 'sueldos' },
        { name: 'Sueldo Patricio Nahuel Martyniuk',          cat: 'sueldos' },
        { name: 'Sueldo Esteban Firbeda Szuhi',              cat: 'sueldos' },
        { name: 'Sueldo Malena Martinez',                    cat: 'sueldos' },
        { name: 'Sueldo Fernanda María Escobar',             cat: 'sueldos' },
        { name: 'Sueldo Juan Cruz Gonzalez Furrer',          cat: 'sueldos' },
        { name: 'Sueldo Cristiam Daniel Muñoz Albornoz',     cat: 'sueldos' },
        { name: 'Sueldo Sofía Jara',                         cat: 'sueldos' },
        { name: 'Sueldo Alexandra Bercovich',                cat: 'sueldos' },
        { name: 'Sueldo Cruz Lautaro Alexis',                cat: 'sueldos' },
        { name: 'Sueldo Martín Tro Gamboa',                  cat: 'sueldos' },
        { name: 'Sueldo Lucía Rodriguez',                    cat: 'sueldos' },
        { name: 'Sueldo Joaquín García',                     cat: 'sueldos' },
        { name: 'Sueldo José Peralta Dalla Fontana',         cat: 'sueldos' },
        { name: 'Sueldo Gabriel Fernando Delucia',           cat: 'sueldos' },
        { name: 'Sueldo Agustina Ayelen Gomez',              cat: 'sueldos' },
        { name: 'Sueldo Mariela Cecilia Perona',             cat: 'sueldos' },
        // Cargas sociales y sindicales
        { name: 'Cargas Sociales',                           cat: 'cargas_sociales' },
        { name: 'Sindicato de Comercio SEC',                 cat: 'cargas_sociales' },
        { name: 'Faecys',                                    cat: 'cargas_sociales' },
        { name: 'OSECAC',                                    cat: 'cargas_sociales' },
        { name: 'Bonos suma fija',                           cat: 'cargas_sociales' },
        // Insumos y papelería
        { name: 'Papelera',                                  cat: 'insumos' },
        { name: 'Librería',                                  cat: 'insumos' },
        { name: 'Bolsas papel',                              cat: 'insumos' },
        { name: 'Cintas embalaje',                           cat: 'insumos' },
        // Servicios informáticos / tecnología
        { name: 'Nubix integración API',                     cat: 'it_servicios' },
        { name: 'Nubix Martín programación',                 cat: 'it_servicios' },
        { name: 'Nubix campañas digitales',                  cat: 'it_servicios' },
        { name: 'Servicio Nubix abono NH',                   cat: 'it_servicios' },
        { name: 'Servicio Nubix abono Aonijie',              cat: 'it_servicios' },
        { name: 'Flexxus soft',                              cat: 'it_servicios' },
        { name: 'Flexxus servicio atención',                 cat: 'it_servicios' },
        { name: 'Flexxus otros API',                         cat: 'it_servicios' },
        { name: 'Mantenimiento informático Prodrive',        cat: 'it_servicios' },
        { name: 'Extras Prodrive/Flexxus',                   cat: 'it_servicios' },
      ]
      const insertConcept = db.prepare(`
        INSERT INTO company_finance_concepts
          (id, category_id, account_id, name, default_amount, expense_type, payment_method, recurrence, recurrence_month, tracks_multiple_entries, is_active, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, 'fixed', 'transfer', 'monthly', NULL, 0, 1, '', ?, ?)
      `)
      for (const concept of conceptsData) {
        insertConcept.run(uuidv4(), categoryIds[concept.cat], accountId, concept.name, now, now)
      }
    }
  },
  {
    version: 60,
    up: (db) => {
      // "Programación Pedidos" — planificador de fechas de pedidos de importación
      // dentro de Comex. "Marca" pasa a ser una entidad propia (comex_brands),
      // separada del proveedor (hoy `comex_suppliers.brand` es solo texto libre),
      // porque la marca tiene su propia demanda/estacionalidad/stock, mientras
      // que el proveedor aporta los tiempos logísticos. Cada marca puede tener
      // un proveedor "principal" precargado, pero la programación permite elegir
      // cualquier proveedor.
      const newSupplierCols = [
        "ALTER TABLE comex_suppliers ADD COLUMN production_days INTEGER",
        "ALTER TABLE comex_suppliers ADD COLUMN preparation_days INTEGER",
        "ALTER TABLE comex_suppliers ADD COLUMN transit_days INTEGER",
        "ALTER TABLE comex_suppliers ADD COLUMN customs_days INTEGER",
        "ALTER TABLE comex_suppliers ADD COLUMN local_delivery_days INTEGER",
        "ALTER TABLE comex_suppliers ADD COLUMN moq INTEGER",
        "ALTER TABLE comex_suppliers ADD COLUMN non_operational_periods_json TEXT NOT NULL DEFAULT '[]'",
        "ALTER TABLE comex_suppliers ADD COLUMN reliability_notes TEXT NOT NULL DEFAULT ''",
      ]
      for (const sql of newSupplierCols) {
        try { db.exec(sql) } catch { /* column may already exist */ }
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS comex_brands (
          id                       TEXT PRIMARY KEY,
          name                     TEXT NOT NULL,
          category                 TEXT NOT NULL DEFAULT '',
          primary_supplier_id      TEXT REFERENCES comex_suppliers(id) ON DELETE SET NULL,
          demand_annual            INTEGER,
          demand_monthly_json      TEXT NOT NULL DEFAULT '{}',
          current_stock            INTEGER,
          safety_stock             INTEGER,
          purchase_frequency_days  INTEGER,
          notes                    TEXT NOT NULL DEFAULT '',
          logo_stored_name         TEXT,
          created_at               INTEGER NOT NULL,
          updated_at               INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_comex_brands_supplier ON comex_brands(primary_supplier_id);

        CREATE TABLE IF NOT EXISTS import_order_plannings (
          id                                    TEXT PRIMARY KEY,
          brand_id                              TEXT NOT NULL REFERENCES comex_brands(id) ON DELETE CASCADE,
          supplier_id                           TEXT REFERENCES comex_suppliers(id) ON DELETE SET NULL,
          country                               TEXT NOT NULL DEFAULT '',
          responsible_user_id                   TEXT NOT NULL DEFAULT '',
          planning_type                         TEXT NOT NULL DEFAULT 'single',
          status                                TEXT NOT NULL DEFAULT 'draft',
          risk_status                           TEXT NOT NULL DEFAULT 'on_time',
          priority                              TEXT NOT NULL DEFAULT 'medium',
          target_coverage_start_date            INTEGER,
          target_coverage_end_date              INTEGER,
          target_commercial_availability_date   INTEGER,
          recommended_order_date                INTEGER,
          approval_deadline_date                INTEGER,
          estimated_reception_date              INTEGER,
          demand_annual_estimated               INTEGER,
          demand_monthly_estimated              INTEGER,
          demand_for_period                     INTEGER,
          current_stock                         INTEGER,
          safety_stock                          INTEGER,
          desired_coverage_months               REAL,
          internal_approval_days                INTEGER NOT NULL DEFAULT 0,
          supplier_preparation_days             INTEGER NOT NULL DEFAULT 0,
          production_days                       INTEGER NOT NULL DEFAULT 0,
          inspection_days                       INTEGER NOT NULL DEFAULT 0,
          shipping_days                         INTEGER NOT NULL DEFAULT 0,
          customs_days                          INTEGER NOT NULL DEFAULT 0,
          local_delivery_days                   INTEGER NOT NULL DEFAULT 0,
          safety_days                           INTEGER NOT NULL DEFAULT 0,
          total_lead_time_days                  INTEGER NOT NULL DEFAULT 0,
          ai_recommendation_summary             TEXT,
          ai_risk_explanation                   TEXT,
          notes                                 TEXT NOT NULL DEFAULT '',
          linked_import_id                      TEXT REFERENCES comex_imports(id) ON DELETE SET NULL,
          created_at                            INTEGER NOT NULL,
          updated_at                            INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_import_order_plannings_brand    ON import_order_plannings(brand_id);
        CREATE INDEX IF NOT EXISTS idx_import_order_plannings_supplier ON import_order_plannings(supplier_id);
        CREATE INDEX IF NOT EXISTS idx_import_order_plannings_status   ON import_order_plannings(status);

        CREATE TABLE IF NOT EXISTS import_order_planning_milestones (
          id              TEXT PRIMARY KEY,
          planning_id     TEXT NOT NULL REFERENCES import_order_plannings(id) ON DELETE CASCADE,
          milestone_type  TEXT NOT NULL,
          estimated_date  INTEGER,
          calculated_date INTEGER,
          real_date       INTEGER,
          status          TEXT NOT NULL DEFAULT 'pending',
          notes           TEXT NOT NULL DEFAULT '',
          sort_order      INTEGER NOT NULL DEFAULT 0,
          created_at      INTEGER NOT NULL,
          updated_at      INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_import_order_planning_milestones_planning
          ON import_order_planning_milestones(planning_id);

        CREATE TABLE IF NOT EXISTS import_order_planning_ai_reports (
          id                TEXT PRIMARY KEY,
          report_type       TEXT NOT NULL,
          brand_id          TEXT REFERENCES comex_brands(id) ON DELETE CASCADE,
          supplier_id       TEXT REFERENCES comex_suppliers(id) ON DELETE SET NULL,
          period_start_date INTEGER,
          period_end_date   INTEGER,
          summary           TEXT NOT NULL DEFAULT '',
          findings          TEXT NOT NULL DEFAULT '',
          recommendations   TEXT NOT NULL DEFAULT '',
          risks             TEXT NOT NULL DEFAULT '',
          generated_by      TEXT NOT NULL DEFAULT 'ai',
          created_at        INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_import_order_planning_ai_reports_brand
          ON import_order_planning_ai_reports(brand_id);
      `)

      // ── Seed: una marca por cada proveedor que ya tenga `brand` cargado ────
      const { v4: uuidv4 } = require('uuid')
      const now = Date.now()
      const suppliersWithBrand = db.prepare(
        `SELECT id, brand FROM comex_suppliers WHERE brand IS NOT NULL AND TRIM(brand) != ''`
      ).all() as { id: string; brand: string }[]
      const insertBrand = db.prepare(`
        INSERT INTO comex_brands (id, name, category, primary_supplier_id, demand_monthly_json, notes, created_at, updated_at)
        VALUES (?, ?, '', ?, '{}', '', ?, ?)
      `)
      for (const s of suppliersWithBrand) {
        insertBrand.run(uuidv4(), s.brand, s.id, now, now)
      }
    }
  },
  {
    version: 61,
    up: (db) => {
      // Preparación para sync multi-dispositivo (PowerSync + Supabase):
      // se agrega workspace_id a todas las tablas sincronizables, con un
      // valor fijo (un solo workspace) hasta que se implemente multi-usuario.
      const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
      const TABLES = [
        'projects',
        'tasks',
        'task_dependencies',
        'attachments',
        'reminders',
        'contacts',
        'delegated_tasks',
        'message_templates',
        'scheduled_messages',
        'task_questions',
        'comex_suppliers',
        'comex_imports',
        'comex_import_items',
        'comex_documents',
        'comex_logistics_quotes',
        'comex_payments',
        'comex_import_customs',
        'comex_import_costs',
        'comex_supplier_contacts',
        'comex_supplier_bank_accounts',
        'comex_freight_operators',
        'task_status_log',
        'delegated_reminders',
        'delegated_attachments',
        'comex_inal_certs',
        'comex_freight_operator_contacts',
        'comex_import_tributos',
        'comex_import_extra_costs',
        'comex_proformas',
        'ai_chat_messages',
        'ai_prompt_overrides',
        'comex_gestores',
        'comex_gestor_contacts',
        'comex_despachantes',
        'comex_despachante_contacts',
        'whatsapp_groups',
        'whatsapp_templates',
        'expiry_categories',
        'expiry_items',
        'expiry_alerts',
        'finance_accounts',
        'finance_categories',
        'finance_concepts',
        'finance_movements',
        'finance_movement_entries',
        'finance_payment_methods',
        'finance_month_insights',
        'company_finance_accounts',
        'company_finance_categories',
        'company_finance_payment_methods',
        'company_finance_concepts',
        'company_finance_movements',
        'company_finance_movement_entries',
        'company_finance_month_insights',
        'comex_brands',
        'import_order_plannings',
        'import_order_planning_milestones',
        'import_order_planning_ai_reports'
      ]

      for (const table of TABLES) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN workspace_id TEXT NOT NULL DEFAULT '${WORKSPACE_ID}'`)
      }
    }
  },
  {
    version: 62,
    up: (db) => {
      // Fase 1 (sync multi-dispositivo): task_dependencies necesita updated_at
      // para la estrategia de resolución de conflictos last-write-wins.
      const now = Date.now()
      db.exec(`ALTER TABLE task_dependencies ADD COLUMN updated_at INTEGER NOT NULL DEFAULT ${now}`)
    }
  },
  {
    version: 63,
    up: (db) => {
      // Fase 1 (sync multi-dispositivo): se quita la FK a tasks(id) en
      // attachments y reminders. Cuando tasks pase a vivir en la base
      // separada que gestiona PowerSync, esa FK rompería la creación de
      // adjuntos/recordatorios para tareas nuevas (con foreign_keys = ON).
      // El borrado en cascada pasa a hacerse a mano en deleteTask().
      const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
      db.exec(`
        CREATE TABLE attachments_v2 (
          id            TEXT PRIMARY KEY,
          task_id       TEXT NOT NULL,
          original_name TEXT NOT NULL,
          stored_name   TEXT NOT NULL,
          mime_type     TEXT NOT NULL,
          size_bytes    INTEGER NOT NULL,
          drive_file_id TEXT,
          synced_at     INTEGER,
          created_at    INTEGER NOT NULL,
          workspace_id  TEXT NOT NULL DEFAULT '${WORKSPACE_ID}'
        );

        INSERT INTO attachments_v2
          (id, task_id, original_name, stored_name, mime_type, size_bytes, drive_file_id, synced_at, created_at, workspace_id)
        SELECT
          id, task_id, original_name, stored_name, mime_type, size_bytes, drive_file_id, synced_at, created_at, workspace_id
        FROM attachments;

        DROP TABLE attachments;
        ALTER TABLE attachments_v2 RENAME TO attachments;

        CREATE INDEX IF NOT EXISTS idx_attach_task_id ON attachments(task_id);

        CREATE TABLE reminders_v2 (
          id           TEXT PRIMARY KEY,
          task_id      TEXT NOT NULL,
          remind_at    INTEGER NOT NULL,
          phone_number TEXT NOT NULL,
          message      TEXT NOT NULL,
          sent         INTEGER NOT NULL DEFAULT 0,
          sent_at      INTEGER,
          created_at   INTEGER NOT NULL,
          workspace_id TEXT NOT NULL DEFAULT '${WORKSPACE_ID}'
        );

        INSERT INTO reminders_v2
          (id, task_id, remind_at, phone_number, message, sent, sent_at, created_at, workspace_id)
        SELECT
          id, task_id, remind_at, phone_number, message, sent, sent_at, created_at, workspace_id
        FROM reminders;

        DROP TABLE reminders;
        ALTER TABLE reminders_v2 RENAME TO reminders;

        CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
        CREATE INDEX IF NOT EXISTS idx_reminders_sent      ON reminders(sent);
      `)
    }
  },
  {
    version: 64,
    up: (db) => {
      // Fase 6 (auth + permisos): tabla de permisos por usuario/módulo,
      // sincronizada vía PowerSync para que cada dispositivo conozca los
      // permisos del usuario logueado. submodule_key NULL = permiso a
      // nivel de módulo completo. level: 'none' | 'read' | 'write'.
      const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
      const DIEGO_USER_ID = 'ac2b1796-0571-43d2-b645-c72ba939824f'

      db.exec(`
        CREATE TABLE IF NOT EXISTS user_permissions (
          id            TEXT PRIMARY KEY,
          user_id       TEXT NOT NULL,
          module_key    TEXT NOT NULL,
          submodule_key TEXT,
          level         TEXT NOT NULL DEFAULT 'none',
          created_at    INTEGER NOT NULL,
          updated_at    INTEGER NOT NULL,
          workspace_id  TEXT NOT NULL DEFAULT '${WORKSPACE_ID}'
        );

        CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
      `)

      // Seed: Diego (admin) tiene acceso total (lectura y edición) a todos
      // los módulos de nivel superior.
      const MODULE_KEYS = [
        'tasks', 'contacts', 'team', 'messages', 'comex',
        'expiry', 'finance', 'company_finance', 'settings'
      ]
      const now = Date.now()
      const insert = db.prepare(`
        INSERT INTO user_permissions (id, user_id, module_key, submodule_key, level, created_at, updated_at, workspace_id)
        VALUES (?, ?, ?, NULL, 'write', ?, ?, ?)
      `)
      for (const moduleKey of MODULE_KEYS) {
        insert.run(randomUUID(), DIEGO_USER_ID, moduleKey, now, now, WORKSPACE_ID)
      }
    }
  },
  {
    version: 65,
    up: (db) => {
      // Fase 4 (sync multi-dispositivo, Comex): se agrega updated_at a las
      // tablas de Comex que todavía no lo tenían, necesario para la
      // estrategia de resolución de conflictos last-write-wins. El valor
      // inicial se toma de created_at cuando existe.
      const now = Date.now()
      const TABLES = [
        'comex_import_items',
        'comex_documents',
        'comex_logistics_quotes',
        'comex_payments',
        'comex_import_costs',
        'comex_supplier_contacts',
        'comex_supplier_bank_accounts',
        'comex_inal_certs',
        'comex_freight_operator_contacts',
        'comex_import_tributos',
        'comex_import_extra_costs',
        'comex_proformas',
        'comex_gestor_contacts',
        'comex_despachante_contacts',
        'import_order_planning_ai_reports'
      ]
      for (const table of TABLES) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN updated_at INTEGER NOT NULL DEFAULT ${now}`)
        db.exec(`UPDATE ${table} SET updated_at = created_at`)
      }
    }
  },
  {
    version: 66,
    up: (db) => {
      // Los logos se guardaban solo como archivo local (logo_stored_name),
      // que no viaja entre dispositivos. Se agrega logo_data (base64) para
      // que el logo sincronice junto con el resto de los datos.
      const TABLES = [
        'comex_suppliers',
        'comex_freight_operators',
        'comex_gestores',
        'comex_despachantes',
        'comex_brands'
      ]
      for (const table of TABLES) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN logo_data TEXT`)
      }
    }
  },
  {
    version: 67,
    up: (db) => {
      // Calendario / Agenda (Fase 1): tablas LOCAL-ONLY (no viajan por
      // PowerSync) — cache de eventos de Google Calendar y configuración de
      // la conexión OAuth por usuario.
      db.exec(`
        CREATE TABLE IF NOT EXISTS calendar_events_cache (
          id                TEXT PRIMARY KEY,
          google_event_id   TEXT NOT NULL,
          google_calendar_id TEXT NOT NULL,
          summary           TEXT NOT NULL DEFAULT '',
          description       TEXT,
          location          TEXT,
          start_at          INTEGER NOT NULL,
          end_at            INTEGER,
          all_day           INTEGER NOT NULL DEFAULT 0,
          status            TEXT,
          color_id          TEXT,
          updated_at        INTEGER NOT NULL,
          fetched_at        INTEGER NOT NULL,
          UNIQUE(google_calendar_id, google_event_id)
        );

        CREATE INDEX IF NOT EXISTS idx_calendar_events_cache_range
          ON calendar_events_cache(start_at, end_at);
        CREATE INDEX IF NOT EXISTS idx_calendar_events_cache_calendar
          ON calendar_events_cache(google_calendar_id);

        CREATE TABLE IF NOT EXISTS calendar_connections (
          user_id              TEXT PRIMARY KEY,
          google_email         TEXT NOT NULL,
          connected_at         INTEGER NOT NULL,
          last_sync_at         INTEGER,
          enabled_calendar_ids TEXT NOT NULL DEFAULT '[]'
        );
      `)

      // Seed: Diego (admin) tiene acceso de lectura al nuevo módulo Calendario.
      const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
      const DIEGO_USER_ID = 'ac2b1796-0571-43d2-b645-c72ba939824f'
      const now = Date.now()
      db.prepare(`
        INSERT INTO user_permissions (id, user_id, module_key, submodule_key, level, created_at, updated_at, workspace_id)
        VALUES (?, ?, 'calendar', NULL, 'write', ?, ?, ?)
      `).run(randomUUID(), DIEGO_USER_ID, now, now, WORKSPACE_ID)
    }
  },
  {
    version: 68,
    up: (db) => {
      // Calendario / Agenda (Fase 2): tabla de "links" entre vencimientos de
      // Finanzas/Comex y eventos de Google Calendar. Viaja por PowerSync
      // (workspace_id) para que ambos dispositivos vean qué ítems ya están
      // agendados y de qué cuenta de Google son (owner_user_id).
      db.exec(`
        CREATE TABLE IF NOT EXISTS calendar_event_links (
          id                 TEXT PRIMARY KEY,
          workspace_id       TEXT NOT NULL,
          owner_user_id      TEXT NOT NULL,
          source_module      TEXT NOT NULL,
          source_type        TEXT NOT NULL,
          source_event_id    TEXT NOT NULL,
          google_calendar_id TEXT NOT NULL,
          google_event_id    TEXT NOT NULL,
          title              TEXT NOT NULL,
          created_at         INTEGER NOT NULL,
          updated_at         INTEGER NOT NULL,
          UNIQUE(source_module, source_event_id)
        );

        CREATE INDEX IF NOT EXISTS idx_calendar_event_links_source
          ON calendar_event_links(source_module, source_event_id);
      `)
    }
  },
  {
    version: 69,
    up: (db) => {
      // Módulo Presupuestos: 4 tablas para gestión del pipeline de cotizaciones.
      // Sincronizadas vía PowerSync (workspace_id en todas).
      db.exec(`
        CREATE TABLE IF NOT EXISTS quote_companies (
          id           TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          name         TEXT NOT NULL DEFAULT '',
          industry     TEXT NOT NULL DEFAULT '',
          website      TEXT NOT NULL DEFAULT '',
          notes        TEXT NOT NULL DEFAULT '',
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_quote_companies_workspace
          ON quote_companies(workspace_id);

        CREATE TABLE IF NOT EXISTS quote_contacts (
          id           TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          company_id   TEXT NOT NULL DEFAULT '',
          name         TEXT NOT NULL DEFAULT '',
          email        TEXT NOT NULL DEFAULT '',
          phone        TEXT NOT NULL DEFAULT '',
          role         TEXT NOT NULL DEFAULT '',
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_quote_contacts_workspace
          ON quote_contacts(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_quote_contacts_company
          ON quote_contacts(company_id);

        CREATE TABLE IF NOT EXISTS quotes (
          id                 TEXT PRIMARY KEY,
          workspace_id       TEXT NOT NULL,
          title              TEXT NOT NULL DEFAULT '',
          status             TEXT NOT NULL DEFAULT 'new',
          priority           TEXT NOT NULL DEFAULT 'p3',
          channel            TEXT NOT NULL DEFAULT 'email',
          assigned_to        TEXT NOT NULL DEFAULT '',
          company_id         TEXT NOT NULL DEFAULT '',
          contact_id         TEXT NOT NULL DEFAULT '',
          estimated_value    REAL,
          won_value          REAL,
          lost_reason        TEXT NOT NULL DEFAULT '',
          next_follow_up_at  INTEGER,
          sla_due_at         INTEGER,
          notes              TEXT NOT NULL DEFAULT '',
          created_at         INTEGER NOT NULL,
          updated_at         INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_quotes_workspace
          ON quotes(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_quotes_status
          ON quotes(status);
        CREATE INDEX IF NOT EXISTS idx_quotes_assigned_to
          ON quotes(assigned_to);
        CREATE INDEX IF NOT EXISTS idx_quotes_company
          ON quotes(company_id);
        CREATE INDEX IF NOT EXISTS idx_quotes_follow_up
          ON quotes(next_follow_up_at);

        CREATE TABLE IF NOT EXISTS quote_activities (
          id           TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          quote_id     TEXT NOT NULL,
          user_id      TEXT NOT NULL DEFAULT '',
          type         TEXT NOT NULL DEFAULT 'system',
          payload      TEXT NOT NULL DEFAULT '{}',
          created_at   INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_quote_activities_workspace
          ON quote_activities(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_quote_activities_quote
          ON quote_activities(quote_id);
      `)
    }
  },
  {
    version: 70,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS email_accounts (
          id            TEXT PRIMARY KEY,
          workspace_id  TEXT NOT NULL,
          email         TEXT NOT NULL,
          display_name  TEXT NOT NULL DEFAULT '',
          imap_host     TEXT NOT NULL DEFAULT '',
          imap_port     INTEGER NOT NULL DEFAULT 993,
          imap_secure   INTEGER NOT NULL DEFAULT 1,
          smtp_host     TEXT NOT NULL DEFAULT '',
          smtp_port     INTEGER NOT NULL DEFAULT 465,
          smtp_secure   INTEGER NOT NULL DEFAULT 1,
          username      TEXT NOT NULL DEFAULT '',
          password      TEXT NOT NULL DEFAULT '',
          is_active     INTEGER NOT NULL DEFAULT 1,
          last_uid_inbox INTEGER NOT NULL DEFAULT 0,
          created_at    INTEGER NOT NULL,
          updated_at    INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_email_accounts_workspace
          ON email_accounts(workspace_id);

        CREATE TABLE IF NOT EXISTS email_messages (
          id              TEXT PRIMARY KEY,
          account_id      TEXT NOT NULL,
          workspace_id    TEXT NOT NULL,
          uid             INTEGER NOT NULL,
          folder          TEXT NOT NULL DEFAULT 'INBOX',
          message_id      TEXT NOT NULL DEFAULT '',
          in_reply_to     TEXT NOT NULL DEFAULT '',
          thread_refs     TEXT NOT NULL DEFAULT '',
          subject         TEXT NOT NULL DEFAULT '',
          from_address    TEXT NOT NULL DEFAULT '',
          from_name       TEXT NOT NULL DEFAULT '',
          to_addresses    TEXT NOT NULL DEFAULT '[]',
          cc_addresses    TEXT NOT NULL DEFAULT '[]',
          sent_at         INTEGER NOT NULL,
          body_text       TEXT NOT NULL DEFAULT '',
          body_html       TEXT NOT NULL DEFAULT '',
          has_attachments INTEGER NOT NULL DEFAULT 0,
          is_read         INTEGER NOT NULL DEFAULT 0,
          is_starred      INTEGER NOT NULL DEFAULT 0,
          ai_category     TEXT NOT NULL DEFAULT '',
          ai_summary      TEXT NOT NULL DEFAULT '',
          linked_quote_id   TEXT NOT NULL DEFAULT '',
          linked_import_id  TEXT NOT NULL DEFAULT '',
          created_at      INTEGER NOT NULL,
          updated_at      INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_email_messages_account_folder
          ON email_messages(account_id, folder);
        CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at
          ON email_messages(sent_at DESC);
        CREATE INDEX IF NOT EXISTS idx_email_messages_message_id
          ON email_messages(message_id);
        CREATE INDEX IF NOT EXISTS idx_email_messages_uid
          ON email_messages(account_id, uid);

        CREATE TABLE IF NOT EXISTS email_attachments (
          id          TEXT PRIMARY KEY,
          message_id  TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          filename    TEXT NOT NULL DEFAULT '',
          mime_type   TEXT NOT NULL DEFAULT '',
          size_bytes  INTEGER NOT NULL DEFAULT 0,
          local_path  TEXT NOT NULL DEFAULT '',
          ai_category TEXT NOT NULL DEFAULT '',
          created_at  INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_email_attachments_message
          ON email_attachments(message_id);
      `)
    }
  },
  {
    version: 71,
    up: (db) => {
      type ColInfo = { name: string }
      const hasFMEWorkspace = (db.prepare('PRAGMA table_info(finance_movement_entries)').all() as ColInfo[]).some(c => c.name === 'workspace_id')
      const hasCFMEWorkspace = (db.prepare('PRAGMA table_info(company_finance_movement_entries)').all() as ColInfo[]).some(c => c.name === 'workspace_id')
      if (!hasFMEWorkspace) db.exec(`ALTER TABLE finance_movement_entries ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'd61a4071-1557-4f32-be5e-6443fb336bf5'`)
      if (!hasCFMEWorkspace) db.exec(`ALTER TABLE company_finance_movement_entries ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'd61a4071-1557-4f32-be5e-6443fb336bf5'`)
    }
  },
  {
    version: 72,
    up: (db) => {
      // Las cargas (movement_entries) viven en flowtask.db, pero su movimiento
      // padre (finance_movements / company_finance_movements) ahora vive en la
      // base separada que gestiona PowerSync. La FK movement_id → finance_movements(id),
      // con foreign_keys = ON, rompe el alta de cargas para movimientos que solo
      // existen en PowerSync (generados/sincronizados por ese camino):
      // SQLITE_CONSTRAINT_FOREIGNKEY. Se recrea cada tabla sin esa FK — mismo
      // criterio que la migración 63 para attachments/reminders cuando tasks
      // pasó a PowerSync. La integridad referencial se maneja a nivel app
      // (recalc por movement_id; borrado de cargas a mano en deleteMovement).
      const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
      db.exec(`
        CREATE TABLE finance_movement_entries_v2 (
          id           TEXT PRIMARY KEY,
          movement_id  TEXT NOT NULL,
          amount       REAL NOT NULL,
          entry_date   INTEGER,
          note         TEXT NOT NULL DEFAULT '',
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL,
          workspace_id TEXT NOT NULL DEFAULT '${WORKSPACE_ID}'
        );
        INSERT INTO finance_movement_entries_v2
          (id, movement_id, amount, entry_date, note, created_at, updated_at, workspace_id)
        SELECT id, movement_id, amount, entry_date, note, created_at, updated_at, workspace_id
        FROM finance_movement_entries;
        DROP TABLE finance_movement_entries;
        ALTER TABLE finance_movement_entries_v2 RENAME TO finance_movement_entries;
        CREATE INDEX IF NOT EXISTS idx_finance_movement_entries_movement
          ON finance_movement_entries(movement_id);

        CREATE TABLE company_finance_movement_entries_v2 (
          id           TEXT PRIMARY KEY,
          movement_id  TEXT NOT NULL,
          amount       REAL NOT NULL,
          entry_date   INTEGER,
          note         TEXT NOT NULL DEFAULT '',
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL,
          workspace_id TEXT NOT NULL DEFAULT '${WORKSPACE_ID}'
        );
        INSERT INTO company_finance_movement_entries_v2
          (id, movement_id, amount, entry_date, note, created_at, updated_at, workspace_id)
        SELECT id, movement_id, amount, entry_date, note, created_at, updated_at, workspace_id
        FROM company_finance_movement_entries;
        DROP TABLE company_finance_movement_entries;
        ALTER TABLE company_finance_movement_entries_v2 RENAME TO company_finance_movement_entries;
        CREATE INDEX IF NOT EXISTS idx_company_finance_movement_entries_movement
          ON company_finance_movement_entries(movement_id);
      `)
    }
  },
  {
    version: 73,
    up: (db) => {
      const cols = [
        "ALTER TABLE comex_logistics_quotes ADD COLUMN quote_html TEXT NOT NULL DEFAULT ''",
        'ALTER TABLE comex_logistics_quotes ADD COLUMN quote_received_at INTEGER',
      ]
      for (const sql of cols) {
        try { db.exec(sql) } catch { /* already exists */ }
      }
      db.exec(`
        CREATE TABLE IF NOT EXISTS comex_quote_files (
          id              TEXT PRIMARY KEY,
          quote_id        TEXT NOT NULL,
          import_id       TEXT NOT NULL,
          file_name       TEXT NOT NULL,
          file_size       INTEGER,
          drive_file_id   TEXT NOT NULL DEFAULT '',
          drive_folder_id TEXT,
          mime_type       TEXT NOT NULL DEFAULT '',
          workspace_id    TEXT,
          created_at      INTEGER NOT NULL,
          updated_at      INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_quote_files_quote ON comex_quote_files(quote_id);
        CREATE INDEX IF NOT EXISTS idx_quote_files_import ON comex_quote_files(import_id);
      `)
    }
  },
  {
    version: 74,
    up: (db) => {
      const cols = [
        'ALTER TABLE comex_imports ADD COLUMN docs_to_despachante      INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE comex_imports ADD COLUMN docs_to_despachante_date INTEGER',
        'ALTER TABLE comex_imports ADD COLUMN docs_to_compras          INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE comex_imports ADD COLUMN docs_to_compras_date     INTEGER',
      ]
      for (const sql of cols) {
        try { db.exec(sql) } catch { /* already exists */ }
      }
    }
  },
  {
    version: 75,
    up: (db) => {
      const cols = [
        'ALTER TABLE comex_imports ADD COLUMN payment_terms TEXT',
        'ALTER TABLE comex_imports ADD COLUMN payment_due_date INTEGER',
        "ALTER TABLE comex_imports ADD COLUMN payment_notes TEXT NOT NULL DEFAULT ''",
      ]
      for (const sql of cols) {
        try { db.exec(sql) } catch { /* already exists */ }
      }
    }
  },
  {
    version: 76,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS calendar_wa_reminders (
          id         TEXT PRIMARY KEY,
          event_id   TEXT NOT NULL,
          phone      TEXT NOT NULL,
          message    TEXT NOT NULL,
          send_at    INTEGER NOT NULL,
          sent_at    INTEGER,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_wa_reminders_event_id ON calendar_wa_reminders(event_id);
        CREATE INDEX IF NOT EXISTS idx_wa_reminders_send_at  ON calendar_wa_reminders(send_at);
      `)
    }
  },
  {
    version: 77,
    up: (db) => {
      try { db.exec('ALTER TABLE calendar_wa_reminders ADD COLUMN success INTEGER') } catch { /* ya existe */ }
    }
  },
  {
    version: 78,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS recon_periods (
          id           TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          period_month INTEGER NOT NULL,
          period_year  INTEGER NOT NULL,
          status       TEXT NOT NULL DEFAULT 'draft',
          notes        TEXT NOT NULL DEFAULT '',
          created_by   TEXT NOT NULL DEFAULT '',
          closed_by    TEXT NOT NULL DEFAULT '',
          created_at   INTEGER NOT NULL,
          closed_at    INTEGER,
          UNIQUE(workspace_id, period_month, period_year)
        );

        CREATE TABLE IF NOT EXISTS recon_imports (
          id           TEXT PRIMARY KEY,
          period_id    TEXT NOT NULL REFERENCES recon_periods(id) ON DELETE CASCADE,
          source       TEXT NOT NULL,
          filename     TEXT NOT NULL DEFAULT '',
          row_count    INTEGER NOT NULL DEFAULT 0,
          status       TEXT NOT NULL DEFAULT 'pending',
          error_msg    TEXT NOT NULL DEFAULT '',
          imported_at  INTEGER NOT NULL,
          imported_by  TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_recon_imports_period ON recon_imports(period_id);

        CREATE TABLE IF NOT EXISTS recon_invoices (
          id                    TEXT PRIMARY KEY,
          period_id             TEXT NOT NULL REFERENCES recon_periods(id) ON DELETE CASCADE,
          comprobante           TEXT NOT NULL,
          tipo                  TEXT NOT NULL DEFAULT '',
          concepto              TEXT NOT NULL DEFAULT '',
          total                 REAL NOT NULL DEFAULT 0,
          importe_tarjetas      REAL NOT NULL DEFAULT 0,
          importe_efectivo      REAL NOT NULL DEFAULT 0,
          importe_transferencia REAL NOT NULL DEFAULT 0,
          importe_cta_cte       REAL NOT NULL DEFAULT 0,
          importe_otros         REAL NOT NULL DEFAULT 0,
          source                TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_recon_invoices_period ON recon_invoices(period_id);

        CREATE TABLE IF NOT EXISTS recon_cupones (
          id            TEXT PRIMARY KEY,
          period_id     TEXT NOT NULL REFERENCES recon_periods(id) ON DELETE CASCADE,
          cupon         TEXT NOT NULL DEFAULT '',
          plan          TEXT NOT NULL DEFAULT '',
          total         REAL NOT NULL DEFAULT 0,
          nombre        TEXT NOT NULL DEFAULT '',
          condicion     TEXT NOT NULL DEFAULT '',
          fecha_ingreso TEXT NOT NULL DEFAULT '',
          cuotas        INTEGER NOT NULL DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS idx_recon_cupones_period ON recon_cupones(period_id);

        CREATE TABLE IF NOT EXISTS recon_ml_ops (
          id                 TEXT PRIMARY KEY,
          period_id          TEXT NOT NULL REFERENCES recon_periods(id) ON DELETE CASCADE,
          operation_id       TEXT NOT NULL DEFAULT '',
          status             TEXT NOT NULL DEFAULT '',
          status_detail      TEXT NOT NULL DEFAULT '',
          transaction_amount REAL NOT NULL DEFAULT 0,
          mp_fee             REAL NOT NULL DEFAULT 0,
          shipping_cost      REAL NOT NULL DEFAULT 0,
          counterpart_name   TEXT NOT NULL DEFAULT '',
          external_reference TEXT NOT NULL DEFAULT '',
          reason             TEXT NOT NULL DEFAULT '',
          date_created       INTEGER,
          date_approved      INTEGER,
          cuenta             TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_recon_ml_ops_period ON recon_ml_ops(period_id);

        CREATE TABLE IF NOT EXISTS recon_results (
          id               TEXT PRIMARY KEY,
          period_id        TEXT NOT NULL REFERENCES recon_periods(id) ON DELETE CASCADE,
          invoice_id       TEXT REFERENCES recon_invoices(id) ON DELETE SET NULL,
          cupon_id         TEXT REFERENCES recon_cupones(id) ON DELETE SET NULL,
          ml_op_id         TEXT REFERENCES recon_ml_ops(id) ON DELETE SET NULL,
          estado           TEXT NOT NULL DEFAULT 'pendiente',
          diferencia       REAL NOT NULL DEFAULT 0,
          match_score      REAL NOT NULL DEFAULT 0,
          match_method     TEXT NOT NULL DEFAULT '',
          no_cobrado_razon TEXT NOT NULL DEFAULT '',
          override_by      TEXT NOT NULL DEFAULT '',
          override_at      INTEGER,
          notes            TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_recon_results_period ON recon_results(period_id);
        CREATE INDEX IF NOT EXISTS idx_recon_results_estado ON recon_results(estado);

        CREATE TABLE IF NOT EXISTS recon_audit (
          id         TEXT PRIMARY KEY,
          period_id  TEXT NOT NULL REFERENCES recon_periods(id) ON DELETE CASCADE,
          user_id    TEXT NOT NULL DEFAULT '',
          action     TEXT NOT NULL DEFAULT '',
          payload    TEXT NOT NULL DEFAULT '{}',
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_recon_audit_period ON recon_audit(period_id);
      `)
    }
  },

  // v79 — Consolidar comex_brands en comex_suppliers
  // El concepto "marca" se unifica con "proveedor": cada proveedor ES una marca.
  // Se agregan los campos de demanda/stock de comex_brands a comex_suppliers
  // y se migran los datos existentes usando primary_supplier_id.
  {
    version: 79,
    up: (db) => {
      const cols = (db.prepare("PRAGMA table_info(comex_suppliers)").all() as { name: string }[]).map(c => c.name)
      if (!cols.includes('category'))               db.exec("ALTER TABLE comex_suppliers ADD COLUMN category TEXT NOT NULL DEFAULT ''")
      if (!cols.includes('demand_annual'))           db.exec('ALTER TABLE comex_suppliers ADD COLUMN demand_annual REAL')
      if (!cols.includes('demand_monthly_json'))     db.exec("ALTER TABLE comex_suppliers ADD COLUMN demand_monthly_json TEXT NOT NULL DEFAULT '{}'")
      if (!cols.includes('current_stock'))           db.exec('ALTER TABLE comex_suppliers ADD COLUMN current_stock REAL')
      if (!cols.includes('safety_stock'))            db.exec('ALTER TABLE comex_suppliers ADD COLUMN safety_stock REAL')
      if (!cols.includes('purchase_frequency_days')) db.exec('ALTER TABLE comex_suppliers ADD COLUMN purchase_frequency_days INTEGER')

      // Migrar datos existentes de comex_brands al supplier primario
      const brands = db.prepare('SELECT * FROM comex_brands WHERE primary_supplier_id IS NOT NULL').all() as {
        primary_supplier_id: string; name: string; category: string;
        demand_annual: number | null; demand_monthly_json: string;
        current_stock: number | null; safety_stock: number | null;
        purchase_frequency_days: number | null;
      }[]

      const updateStmt = db.prepare(`
        UPDATE comex_suppliers SET
          brand = CASE WHEN brand IS NULL OR brand = '' THEN ? ELSE brand END,
          category               = ?,
          demand_annual          = ?,
          demand_monthly_json    = ?,
          current_stock          = ?,
          safety_stock           = ?,
          purchase_frequency_days = ?
        WHERE id = ?
      `)

      for (const b of brands) {
        updateStmt.run(
          b.name,
          b.category ?? '',
          b.demand_annual ?? null,
          b.demand_monthly_json ?? '{}',
          b.current_stock ?? null,
          b.safety_stock ?? null,
          b.purchase_frequency_days ?? null,
          b.primary_supplier_id
        )
      }
    }
  },
  {
    version: 80,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS knowledge_entries (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL DEFAULT '',
          title TEXT NOT NULL DEFAULT '',
          content_type TEXT NOT NULL DEFAULT 'text',
          body TEXT NOT NULL DEFAULT '',
          topic TEXT NOT NULL DEFAULT '',
          tags TEXT NOT NULL DEFAULT '[]',
          source TEXT NOT NULL DEFAULT '',
          ai_summary TEXT NOT NULL DEFAULT '',
          drive_file_id TEXT,
          drive_folder_id TEXT,
          drive_status TEXT NOT NULL DEFAULT 'none',
          file_name TEXT,
          file_size INTEGER,
          file_mime_type TEXT,
          local_path TEXT,
          created_by TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_ke_workspace ON knowledge_entries(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_ke_topic ON knowledge_entries(topic)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_ke_type ON knowledge_entries(content_type)`)
      db.exec(`
        CREATE TABLE IF NOT EXISTS knowledge_global_summaries (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL DEFAULT '',
          topic TEXT NOT NULL DEFAULT '__all__',
          summary TEXT NOT NULL DEFAULT '',
          entry_count INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          generated_by TEXT NOT NULL DEFAULT ''
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_kgs_workspace ON knowledge_global_summaries(workspace_id)`)
    }
  },
  {
    version: 81,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_profiles (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL DEFAULT '',
          email TEXT NOT NULL DEFAULT '',
          display_name TEXT NOT NULL DEFAULT '',
          last_seen_at INTEGER NOT NULL
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_up_workspace ON user_profiles(workspace_id)`)
    }
  },
  {
    version: 82,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS knowledge_sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          icon TEXT NOT NULL DEFAULT 'Tag',
          color TEXT NOT NULL DEFAULT '#64748b',
          sort_order INTEGER NOT NULL DEFAULT 0
        )
      `)
      const ins = db.prepare(
        'INSERT OR IGNORE INTO knowledge_sources (id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)'
      )
      const defaults: [string, string, string, string, number][] = [
        ['src-email',     'Email',         'Mail',          '#3b82f6',  10],
        ['src-reunion',   'Reunión',       'Users',         '#8b5cf6',  20],
        ['src-web',       'Web',           'Globe',         '#10b981',  30],
        ['src-documento', 'Documento',     'FileText',      '#f59e0b',  40],
        ['src-whatsapp',  'WhatsApp',      'MessageCircle', '#22c55e',  50],
        ['src-video',     'Video',         'Video',         '#ef4444',  60],
        ['src-imagen',    'Imagen',        'Image',         '#ec4899',  70],
        ['src-pdf',       'PDF',           'File',          '#f97316',  80],
        ['src-nota',      'Nota interna',  'StickyNote',    '#a78bfa',  90],
        ['src-otro',      'Otro',          'Tag',           '#64748b', 100],
      ]
      for (const row of defaults) ins.run(...row)
    }
  },
  {
    version: 83,
    up: (db) => {
      try { db.exec(`ALTER TABLE knowledge_entries ADD COLUMN entry_date INTEGER`) } catch {}
      try { db.exec(`ALTER TABLE knowledge_entries ADD COLUMN parent_id TEXT`) } catch {}
      db.exec(`CREATE INDEX IF NOT EXISTS idx_ke_parent ON knowledge_entries(parent_id)`)
    }
  },
  {
    version: 84,
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS knowledge_entry_files (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        file_name TEXT NOT NULL DEFAULT '',
        file_size INTEGER NOT NULL DEFAULT 0,
        file_mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
        local_path TEXT NOT NULL DEFAULT '',
        drive_file_id TEXT,
        drive_folder_id TEXT,
        drive_status TEXT NOT NULL DEFAULT 'none',
        created_at INTEGER NOT NULL
      )`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_kef_entry ON knowledge_entry_files(entry_id)`)
    }
  },
  {
    version: 85,
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS knowledge_thread_docs (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL UNIQUE,
        synthesis TEXT NOT NULL DEFAULT '',
        key_data TEXT NOT NULL DEFAULT '[]',
        next_steps TEXT NOT NULL DEFAULT '[]',
        checks TEXT NOT NULL DEFAULT '[]',
        generated_at INTEGER NOT NULL,
        entry_count INTEGER NOT NULL DEFAULT 1
      )`)
    }
  },
  {
    version: 86,
    up: (db) => {
      try { db.exec(`ALTER TABLE knowledge_entries ADD COLUMN quote_id TEXT`) } catch {}
      db.exec(`CREATE INDEX IF NOT EXISTS idx_ke_quote ON knowledge_entries(quote_id)`)
    }
  }
]

export function runMigrations(db: Database.Database): void {
  const currentVersion = (db.pragma('user_version', { simple: true }) as number) || 0
  const pending = MIGRATIONS
    .slice()
    .sort((a, b) => a.version - b.version)
    .filter((m) => m.version > currentVersion)

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
