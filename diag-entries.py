import sqlite3, os, json

db_path = os.path.join(os.path.expanduser("~"), "AppData", "Roaming", "flowtask", "flowtask", "flowtask.db")
print("DB:", db_path)
con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
con.row_factory = sqlite3.Row
cur = con.cursor()

print("user_version:", cur.execute("PRAGMA user_version").fetchone()[0])

print("\n--- schema finance_movement_entries ---")
print(", ".join(r["name"] + ":" + r["type"] for r in cur.execute("PRAGMA table_info(finance_movement_entries)").fetchall()))

print("\n--- Jardineria concepts ---")
concepts = cur.execute("SELECT id, name, tracks_multiple_entries FROM finance_concepts WHERE name LIKE '%ardiner%'").fetchall()
for c in concepts:
    print(dict(c))

for c in concepts:
    print(f"\n--- movements for concept {c['name']} ({c['id']}) ---")
    movs = cur.execute("SELECT id, month, year, amount_actual, status, payment_date FROM finance_movements WHERE concept_id = ? ORDER BY year, month", (c["id"],)).fetchall()
    for m in movs:
        print(" ", dict(m))
        entries = cur.execute("SELECT id, amount, entry_date, note, created_at, updated_at FROM finance_movement_entries WHERE movement_id = ?", (m["id"],)).fetchall()
        print("    entries:", [dict(e) for e in entries])

print("\n--- total entries finance_movement_entries ---")
print(dict(cur.execute("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS total FROM finance_movement_entries").fetchone()))

print("\n--- last 10 entries (any concept) ---")
for e in cur.execute("SELECT id, movement_id, amount, entry_date, created_at FROM finance_movement_entries ORDER BY created_at DESC LIMIT 10").fetchall():
    print(" ", dict(e))

con.close()
