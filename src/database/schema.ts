export const SCHEMA_VERSION = 1;

export const CREATE_RULES_TABLE = `
CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    embedding BLOB,
    tags TEXT NOT NULL DEFAULT '[]',
    tier INTEGER NOT NULL CHECK (tier >= 1 AND tier <= 5),
    metadata TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

export const CREATE_PROJECT_DOCS_TABLE = `
CREATE TABLE IF NOT EXISTS project_docs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    file_path TEXT,
    embedding BLOB,
    tags TEXT NOT NULL DEFAULT '[]',
    metadata TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

export const CREATE_REFS_TABLE = `
CREATE TABLE IF NOT EXISTS refs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding BLOB,
    channel_id TEXT,
    metadata TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

export const CREATE_SCHEMA_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);`;

export const CREATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_rules_tier ON rules(tier);',
  'CREATE INDEX IF NOT EXISTS idx_rules_created_at ON rules(created_at);',
  'CREATE INDEX IF NOT EXISTS idx_rules_updated_at ON rules(updated_at);',
  
  'CREATE INDEX IF NOT EXISTS idx_project_docs_project_id ON project_docs(project_id);',
  'CREATE INDEX IF NOT EXISTS idx_project_docs_created_at ON project_docs(created_at);',
  'CREATE INDEX IF NOT EXISTS idx_project_docs_updated_at ON project_docs(updated_at);',
  
  'CREATE INDEX IF NOT EXISTS idx_refs_channel_id ON refs(channel_id);',
  'CREATE INDEX IF NOT EXISTS idx_refs_name ON refs(name);',
  'CREATE INDEX IF NOT EXISTS idx_refs_created_at ON refs(created_at);',
  'CREATE INDEX IF NOT EXISTS idx_refs_updated_at ON refs(updated_at);',
];

export const CREATE_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS update_rules_timestamp 
   AFTER UPDATE ON rules
   BEGIN
     UPDATE rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
   END;`,
   
  `CREATE TRIGGER IF NOT EXISTS update_project_docs_timestamp 
   AFTER UPDATE ON project_docs
   BEGIN
     UPDATE project_docs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
   END;`,
   
  `CREATE TRIGGER IF NOT EXISTS update_refs_timestamp 
   AFTER UPDATE ON refs
   BEGIN
     UPDATE refs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
   END;`,
];

export const INITIAL_SCHEMA = [
  CREATE_SCHEMA_MIGRATIONS_TABLE,
  CREATE_RULES_TABLE,
  CREATE_PROJECT_DOCS_TABLE,
  CREATE_REFS_TABLE,
  ...CREATE_INDEXES,
  ...CREATE_TRIGGERS,
];