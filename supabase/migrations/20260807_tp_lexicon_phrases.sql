-- supabase/migrations/20260807_tp_lexicon_phrases.sql
-- 언어중립 어휘/구문 자동 추출 테이블
-- Ownership: CoreRing (클로5)

create table if not exists tp_lexicon (
  id                    uuid primary key default gen_random_uuid(),
  translation_group_id  uuid not null,
  language              text not null,        -- 'ko', 'vi', 'vi-south', 'vi-north' 등
  lemma                 text not null,
  normalized_lemma      text not null,
  frequency             integer not null default 1,
  status                text not null default 'auto' check (status in ('auto', 'verified', 'deprecated')),
  source                text not null check (source in ('chat', 'translator')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique(language, normalized_lemma)
);

create index if not exists idx_tp_lexicon_normalized on tp_lexicon(normalized_lemma);
create index if not exists idx_tp_lexicon_group on tp_lexicon(translation_group_id);

create table if not exists tp_phrases (
  id                  uuid primary key default gen_random_uuid(),
  phrase_hash         text not null unique,
  source_language     text not null,
  target_language     text not null,
  source_text         text not null,
  target_text         text not null,
  context_type        text,   -- greeting|question|emotion|request|gratitude|complaint|neutral
  source              text not null check (source in ('chat', 'translator')),
  source_message_id   uuid,
  tb_trans_log_id      uuid,
  frequency           integer not null default 1,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_tp_phrases_source_text on tp_phrases(source_text);
create index if not exists idx_tp_phrases_hash on tp_phrases(phrase_hash);

alter table tp_lexicon enable row level security;
alter table tp_phrases enable row level security;

create policy "tp_lexicon_select_all" on tp_lexicon for select using (true);
create policy "tp_phrases_select_all" on tp_phrases for select using (true);
-- INSERT/UPDATE는 service_role(배치/서버)만 -- RLS 우회되므로 별도 policy 불필요
