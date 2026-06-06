-- 数字花园 Supabase Schema
-- 在 Supabase SQL Editor 中执行此文件

-- 启用扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 资源类型枚举
DO $$ BEGIN
  CREATE TYPE resource_type AS ENUM (
    'link', 'image', 'book', 'movie', 'tool', 'article', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 用户扩展表 (profiles)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 兴趣分类
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 资源收藏 (核心表)
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  resource_type resource_type NOT NULL DEFAULT 'other',
  url TEXT,
  cover_image_url TEXT,
  author TEXT,
  rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'wishlist')),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 标签
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 资源-标签关联
CREATE TABLE IF NOT EXISTS resource_tags (
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, tag_id)
);

-- 精选合集
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  is_public BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 合集-资源关联
CREATE TABLE IF NOT EXISTS collection_resources (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  PRIMARY KEY (collection_id, resource_id)
);

-- 数字花园笔记 (Phase 2)
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT,
  excerpt TEXT,
  is_published BOOLEAN DEFAULT false,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 笔记双向链接 (Phase 2)
CREATE TABLE IF NOT EXISTS note_links (
  source_note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  target_note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  link_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (source_note_id, target_note_id)
);

-- =====================
-- 索引
-- =====================
CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category_id);
CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_created ON resources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_user ON resources(user_id);
CREATE INDEX IF NOT EXISTS idx_resources_title_trgm ON resources USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- =====================
-- RLS 策略
-- =====================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_links ENABLE ROW LEVEL SECURITY;

-- Profiles: 所有人可读，本人可写
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Categories: 所有人可读，认证用户可写
CREATE POLICY "Categories are viewable by everyone" ON categories
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert categories" ON categories
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update categories" ON categories
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete categories" ON categories
  FOR DELETE USING (auth.role() = 'authenticated');

-- Tags: 所有人可读，认证用户可写
CREATE POLICY "Tags are viewable by everyone" ON tags
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert tags" ON tags
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Resources: 所有人可读 active，本人可写
CREATE POLICY "Active resources are viewable by everyone" ON resources
  FOR SELECT USING (status = 'active' OR auth.uid() = user_id);

CREATE POLICY "Users can insert own resources" ON resources
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resources" ON resources
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own resources" ON resources
  FOR DELETE USING (auth.uid() = user_id);

-- Resource Tags: 公开可读
CREATE POLICY "Resource tags are viewable by everyone" ON resource_tags
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage resource tags" ON resource_tags
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM resources WHERE id = resource_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete own resource tags" ON resource_tags
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM resources WHERE id = resource_id AND user_id = auth.uid())
  );

-- Collections: 公开合集所有人可读
CREATE POLICY "Public collections are viewable by everyone" ON collections
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can manage own collections" ON collections
  FOR ALL USING (auth.uid() = user_id);

-- =====================
-- 存储桶设置 (在 Supabase Dashboard 创建)
-- =====================
-- 1. avatars  - 头像图片，公开读取
-- 2. resources - 资源封面图，公开读取
-- 3. notes     - 笔记内嵌图片，公开读取
-- 4. collections - 合集封面，公开读取

-- =====================
-- 种子数据 (可选)
-- =====================
-- INSERT INTO categories (name, slug, description, icon, color, sort_order) VALUES
--   ('编程', 'coding', '编程语言、框架、工具', '💻', '#3B82F6', 1),
--   ('阅读', 'reading', '书籍、文章、博客', '📚', '#10B981', 2),
--   ('影视', 'movies', '电影、剧集、纪录片', '🎬', '#F59E0B', 3),
--   ('音乐', 'music', '歌曲、专辑、播客', '🎵', '#EF4444', 4),
--   ('摄影', 'photography', '照片、相机、教程', '📷', '#8B5CF6', 5),
--   ('设计', 'design', 'UI、品牌、字体', '🎨', '#EC4899', 6);
