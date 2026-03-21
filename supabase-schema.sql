-- PromptVault — Schema SQL pour Supabase
-- À exécuter dans l'éditeur SQL de Supabase (Dashboard > SQL Editor)

-- ════════════════════════════════════════════════════════════════
-- 1. TABLES
-- ════════════════════════════════════════════════════════════════

-- Catégories
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  color       VARCHAR(7) DEFAULT '#6C5CE7',
  icon        VARCHAR(50) DEFAULT 'folder',
  parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name, parent_id)
);

-- Prompts
CREATE TABLE IF NOT EXISTS prompts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  title         VARCHAR(200) NOT NULL,
  content       TEXT NOT NULL,
  description   TEXT,
  target_model  VARCHAR(20),
  is_favorite   BOOLEAN DEFAULT FALSE,
  use_count     INTEGER DEFAULT 0,
  is_deleted    BOOLEAN DEFAULT FALSE,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name     VARCHAR(50) NOT NULL,
  UNIQUE(user_id, name)
);

-- Relation prompts ↔ tags
CREATE TABLE IF NOT EXISTS prompt_tags (
  prompt_id  UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (prompt_id, tag_id)
);

-- Historique de versions
CREATE TABLE IF NOT EXISTS prompt_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id       UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  content         TEXT NOT NULL,
  description     TEXT,
  version_number  INTEGER NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════
-- 2. INDEX
-- ════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_prompts_user ON prompts(user_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_prompts_updated ON prompts(updated_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_tags_prompt ON prompt_tags(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt ON prompt_versions(prompt_id);

-- ════════════════════════════════════════════════════════════════
-- 3. ROW LEVEL SECURITY (RLS)
-- ════════════════════════════════════════════════════════════════

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

-- Categories : chaque user ne voit que les siennes
CREATE POLICY "Users can manage their own categories"
  ON categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Prompts : chaque user ne voit que les siens
CREATE POLICY "Users can manage their own prompts"
  ON prompts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tags : chaque user ne voit que les siens
CREATE POLICY "Users can manage their own tags"
  ON tags FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Prompt_tags : accès si le prompt appartient à l'user
CREATE POLICY "Users can manage their own prompt_tags"
  ON prompt_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM prompts WHERE prompts.id = prompt_tags.prompt_id AND prompts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM prompts WHERE prompts.id = prompt_tags.prompt_id AND prompts.user_id = auth.uid()
    )
  );

-- Prompt_versions : accès si le prompt appartient à l'user
CREATE POLICY "Users can manage their own prompt_versions"
  ON prompt_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM prompts WHERE prompts.id = prompt_versions.prompt_id AND prompts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM prompts WHERE prompts.id = prompt_versions.prompt_id AND prompts.user_id = auth.uid()
    )
  );

-- ════════════════════════════════════════════════════════════════
-- 4. FONCTION : auto-création des catégories par défaut
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO categories (user_id, name, color, icon, sort_order) VALUES
    (NEW.id, 'Rédaction',  '#6C5CE7', 'pen-tool',        1),
    (NEW.id, 'Code',       '#00D2FF', 'code',             2),
    (NEW.id, 'Analyse',    '#00E676', 'bar-chart-2',      3),
    (NEW.id, 'Créatif',    '#FF6B6B', 'sparkles',         4),
    (NEW.id, 'Éducation',  '#FFD700', 'graduation-cap',   5),
    (NEW.id, 'Business',   '#FF9F43', 'briefcase',        6),
    (NEW.id, 'Système',    '#A29BFE', 'settings',         7),
    (NEW.id, 'Autre',      '#8888A0', 'folder',           8);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger : quand un utilisateur s'inscrit, créer les catégories par défaut
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_categories();
