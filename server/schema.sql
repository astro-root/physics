PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  -- Authoritative role. Never trust a role claim from a token without re-reading this.
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  parent_slug TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS simulations (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  slug                   TEXT NOT NULL UNIQUE,
  title                  TEXT NOT NULL,
  title_en               TEXT NOT NULL DEFAULT '',
  short_description      TEXT NOT NULL DEFAULT '',
  description            TEXT NOT NULL DEFAULT '',
  category_slug          TEXT NOT NULL REFERENCES categories(slug) ON UPDATE CASCADE,
  type                   TEXT NOT NULL DEFAULT 'simulation'
                           CHECK (type IN ('simulation','experiment','visualization','model','calculator')),
  difficulty             INTEGER NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 5),
  target_level           TEXT NOT NULL DEFAULT 'high-school'
                           CHECK (target_level IN ('middle-school','high-school','undergraduate','graduate')),
  physics_topics         TEXT NOT NULL DEFAULT '[]',
  formulas               TEXT NOT NULL DEFAULT '[]',
  simulation_code        TEXT NOT NULL DEFAULT '',
  renderer_code          TEXT NOT NULL DEFAULT '',
  parameter_definitions  TEXT NOT NULL DEFAULT '[]',
  graph_definitions      TEXT NOT NULL DEFAULT '[]',
  display_definitions    TEXT NOT NULL DEFAULT '[]',
  runtime_options        TEXT NOT NULL DEFAULT '{}',
  experiment             TEXT,
  thumbnail              TEXT NOT NULL DEFAULT '',
  status                 TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  sort_order             INTEGER NOT NULL DEFAULT 0,
  author                 TEXT NOT NULL DEFAULT 'るーと',
  version                INTEGER NOT NULL DEFAULT 1,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now')),
  created_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by             INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sim_status ON simulations(status);
CREATE INDEX IF NOT EXISTS idx_sim_category ON simulations(category_slug);
CREATE INDEX IF NOT EXISTS idx_sim_type ON simulations(type);

CREATE TABLE IF NOT EXISTS simulation_tags (
  simulation_id INTEGER NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  tag_id        INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (simulation_id, tag_id)
);

CREATE TABLE IF NOT EXISTS simulation_versions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  simulation_id INTEGER NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  summary       TEXT NOT NULL DEFAULT '',
  snapshot      TEXT NOT NULL,
  changed_at    TEXT NOT NULL DEFAULT (datetime('now')),
  changed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_by_email TEXT NOT NULL DEFAULT '',
  UNIQUE (simulation_id, version)
);

-- Full-text search over the public catalogue.
CREATE VIRTUAL TABLE IF NOT EXISTS simulations_fts USING fts5(
  slug, title, title_en, short_description, description, physics_topics,
  content='', tokenize='unicode61'
);
