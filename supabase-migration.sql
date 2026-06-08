-- ============================================================
-- 迷你兔 v3.5 — 数据库初始化脚本
-- 在 Supabase SQL Editor 中粘贴执行
-- ============================================================

-- 1. 清理旧结构
-- ============================================================
DROP TABLE IF EXISTS note_links CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS collection_resources CASCADE;
DROP TABLE IF EXISTS collections CASCADE;
DROP TABLE IF EXISTS resource_tags CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TYPE IF EXISTS resource_type CASCADE;

-- 2. 枚举
-- ============================================================
CREATE TYPE resource_type AS ENUM (
  'link', 'image', 'book', 'movie', 'tool', 'article', 'other'
);

-- 3. 建表
-- ============================================================

-- profiles（用户资料，由 Supabase Auth 触发器自动创建）
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE,
  display_name TEXT,
  avatar_url  TEXT,
  bio         TEXT,
  website     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- categories（分类）
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  icon        TEXT,
  color       TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- tags（标签）
CREATE TABLE tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  color       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- resources（资源/笔记）
CREATE TABLE resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  resource_type   resource_type DEFAULT 'other',
  url             TEXT,
  cover_image_url TEXT,
  author          TEXT,
  rating          NUMERIC(2,1) CHECK (rating >= 0 AND rating <= 5),
  status          TEXT DEFAULT 'active',
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  metadata        JSONB DEFAULT '{}',
  pinned          BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- resource_tags（资源-标签关联）
CREATE TABLE resource_tags (
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, tag_id)
);

-- collections（合集）
CREATE TABLE collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  cover_image_url TEXT,
  is_public       BOOLEAN DEFAULT false,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- collection_resources（合集-资源关联）
CREATE TABLE collection_resources (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  resource_id   UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  sort_order    INTEGER DEFAULT 0,
  PRIMARY KEY (collection_id, resource_id)
);

-- notes（笔记/时间线备忘）
CREATE TABLE notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  slug         TEXT NOT NULL,
  content      TEXT,
  excerpt      TEXT,
  is_published BOOLEAN DEFAULT true,
  category_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- note_links（笔记间链接）
CREATE TABLE note_links (
  source_note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  target_note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  link_text      TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (source_note_id, target_note_id)
);

-- 4. 索引
-- ============================================================
CREATE INDEX idx_resources_user     ON resources(user_id);
CREATE INDEX idx_resources_category ON resources(category_id);
CREATE INDEX idx_resources_status   ON resources(status);
CREATE INDEX idx_resources_created  ON resources(created_at DESC);
CREATE INDEX idx_resources_type     ON resources(resource_type);
CREATE INDEX idx_notes_user         ON notes(user_id);
CREATE INDEX idx_notes_slug         ON notes(slug);
CREATE INDEX idx_collections_user   ON collections(user_id);
CREATE INDEX idx_tags_slug          ON tags(slug);
CREATE INDEX idx_categories_slug    ON categories(slug);

-- 5. updated_at 自动触发器
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();

-- 6. 新用户自动创建 profile
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 7. RLS 策略（基本安全）
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_links ENABLE ROW LEVEL SECURITY;

-- profiles: 用户可读写自己的
CREATE POLICY "Users own profiles" ON profiles
  FOR ALL USING (auth.uid() = id);

-- categories: 所有人可读
CREATE POLICY "Anyone read categories" ON categories FOR SELECT USING (true);

-- resources: 所有者读写
CREATE POLICY "Users own resources" ON resources
  FOR ALL USING (auth.uid() = user_id);

-- tags: 所有人可读
CREATE POLICY "Anyone read tags" ON tags FOR SELECT USING (true);

-- resource_tags: 关联 resources 的所有者
CREATE POLICY "Users own resource_tags" ON resource_tags
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM resources WHERE id = resource_id)
  );

-- collections: 所有者读写
CREATE POLICY "Users own collections" ON collections
  FOR ALL USING (auth.uid() = user_id);

-- collection_resources: 关联 collections 的所有者
CREATE POLICY "Users own collection_resources" ON collection_resources
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM collections WHERE id = collection_id)
  );

-- notes: 所有者读写
CREATE POLICY "Users own notes" ON notes
  FOR ALL USING (auth.uid() = user_id);

-- note_links: 关联 notes 的所有者
CREATE POLICY "Users own note_links" ON note_links
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM notes WHERE id = source_note_id)
  );
