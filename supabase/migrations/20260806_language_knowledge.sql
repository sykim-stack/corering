-- supabase/migrations/20260806_language_knowledge.sql
-- Language Knowledge Pipeline v1.0 - Phase 1
-- CoreRing(tb_trans_logs)이 승격시키는 재사용 가능한 언어 지식
-- Ownership: CoreRing (클로5) -- CRUD
-- HajunAI (클로2) -- SELECT only

create table if not exists language_knowledge (
  id                uuid primary key default gen_random_uuid(),
  source_core       text not null default 'CoreRing',
  knowledge_type    text not null check (knowledge_type in (
                       'emotion_pattern', 'cultural_pattern',
                       'translation_pattern', 'dialect_pattern'
                     )),
  pattern_key       text not null,
  source_expression text,
  description       text not null,
  emotion           text,
  intent            text,
  confidence        numeric(4,3) not null check (confidence between 0 and 1),
  consistency       numeric(4,3) not null check (consistency between 0 and 1),
  frequency         integer not null default 0,
  status            text not null default 'candidate' check (status in (
                       'candidate', 'verified', 'deprecated'
                     )),
  metadata          jsonb default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (knowledge_type, pattern_key)
);

create index if not exists idx_language_knowledge_type on language_knowledge(knowledge_type);
create index if not exists idx_language_knowledge_pattern on language_knowledge(pattern_key);
create index if not exists idx_language_knowledge_status on language_knowledge(status);

-- RLS: HajunAI는 SELECT만
alter table language_knowledge enable row level security;

create policy "language_knowledge_select_all"
  on language_knowledge for select
  using (true);

-- INSERT/UPDATE/DELETE는 service_role(=배치 스크립트)만 수행
-- service_role 키는 RLS를 우회하므로 별도 policy 불필요
