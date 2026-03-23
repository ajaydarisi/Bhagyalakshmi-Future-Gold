-- Generic catalog retrieval foundation for semantic search and future chatbot grounding

create extension if not exists vector;

create table if not exists public.catalog_retrieval_documents (
  id uuid primary key default uuid_generate_v4(),
  source_type text not null check (source_type in ('product', 'store_info', 'faq', 'legal')),
  source_key text not null unique,
  product_id uuid references public.products(id) on delete cascade,
  locale text not null default 'multi',
  title text not null,
  content text not null,
  fts tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) stored,
  embedding vector(768),
  metadata jsonb not null default '{}'::jsonb,
  content_hash text not null,
  index_status text not null check (index_status in ('pending', 'ready', 'failed')) default 'pending',
  last_indexed_at timestamptz,
  last_index_error text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_catalog_retrieval_documents_source_type
  on public.catalog_retrieval_documents(source_type);

create index if not exists idx_catalog_retrieval_documents_product_id
  on public.catalog_retrieval_documents(product_id);

create index if not exists idx_catalog_retrieval_documents_fts
  on public.catalog_retrieval_documents using gin(fts);

create index if not exists idx_catalog_retrieval_documents_embedding_hnsw
  on public.catalog_retrieval_documents
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

drop function if exists public.hybrid_search_products(
  text,
  text,
  integer,
  integer,
  uuid[],
  text[],
  text[],
  text,
  numeric,
  numeric
);

create or replace function public.hybrid_search_products(
  query_text text,
  query_embedding_text text default null,
  match_limit integer default 12,
  match_offset integer default 0,
  category_ids uuid[] default '{}'::uuid[],
  materials text[] default '{}'::text[],
  product_tags text[] default '{}'::text[],
  product_type text default '',
  min_price numeric default 0,
  max_price numeric default 0
)
returns table (
  id uuid,
  name text,
  name_telugu text,
  slug text,
  description text,
  description_telugu text,
  price numeric,
  discount_price numeric,
  category_id uuid,
  stock integer,
  material text,
  tags text[],
  images text[],
  is_active boolean,
  featured boolean,
  is_sale boolean,
  is_rental boolean,
  rental_price numeric,
  rental_discount_price numeric,
  rental_deposit numeric,
  max_rental_days integer,
  set_number integer,
  created_at timestamptz,
  updated_at timestamptz,
  category_name text,
  category_name_telugu text,
  category_slug text,
  source_key text,
  index_status text,
  score double precision,
  keyword_rank integer,
  semantic_rank integer,
  estimated_total bigint
)
language sql
stable
as $$
with filtered_products as (
  select
    p.id,
    p.name,
    p.name_telugu,
    p.slug,
    p.description,
    p.description_telugu,
    p.price,
    p.discount_price,
    p.category_id,
    p.stock,
    p.material,
    p.tags,
    p.images,
    p.is_active,
    p.featured,
    p.is_sale,
    p.is_rental,
    p.rental_price,
    p.rental_discount_price,
    p.rental_deposit,
    p.max_rental_days,
    p.set_number,
    p.created_at,
    p.updated_at,
    c.name as category_name,
    c.name_telugu as category_name_telugu,
    c.slug as category_slug,
    d.source_key,
    d.index_status,
    d.fts,
    d.embedding
  from public.catalog_retrieval_documents d
  join public.products p
    on p.id = d.product_id
  left join public.categories c
    on c.id = p.category_id
  where d.source_type = 'product'
    and p.is_active = true
    and (coalesce(array_length(category_ids, 1), 0) = 0 or p.category_id = any(category_ids))
    and (coalesce(array_length(materials, 1), 0) = 0 or p.material = any(materials))
    and (coalesce(array_length(product_tags, 1), 0) = 0 or p.tags && product_tags)
    and (
      product_type = ''
      or product_type = 'all'
      or (product_type = 'sale' and p.is_sale = true)
      or (product_type = 'rental' and p.is_rental = true)
    )
    and (
      min_price <= 0
      or (
        case
          when product_type = 'rental' then coalesce(p.rental_discount_price, p.rental_price, 0)
          when product_type = 'sale' then coalesce(p.discount_price, p.price, 0)
          when p.is_rental = true and p.is_sale = false then coalesce(p.rental_discount_price, p.rental_price, 0)
          else coalesce(p.discount_price, p.price, 0)
        end
      ) >= min_price
    )
    and (
      max_price <= 0
      or (
        case
          when product_type = 'rental' then coalesce(p.rental_discount_price, p.rental_price, 0)
          when product_type = 'sale' then coalesce(p.discount_price, p.price, 0)
          when p.is_rental = true and p.is_sale = false then coalesce(p.rental_discount_price, p.rental_price, 0)
          else coalesce(p.discount_price, p.price, 0)
        end
      ) <= max_price
    )
),
keyword_candidates as (
  select
    fp.id,
    row_number() over (
      order by
        case
          when lower(fp.name) = lower(trim(query_text))
            or lower(coalesce(fp.name_telugu, '')) = lower(trim(query_text))
          then 0
          else 1
        end,
        ts_rank_cd(fp.fts, websearch_to_tsquery('simple', query_text)) desc,
        fp.featured desc,
        fp.stock desc,
        fp.updated_at desc
    )::integer as keyword_rank
  from filtered_products fp
  where fp.fts @@ websearch_to_tsquery('simple', query_text)
  limit 80
),
semantic_candidates as (
  select
    fp.id,
    row_number() over (
      order by
        fp.embedding <=> query_embedding_text::vector,
        fp.featured desc,
        fp.stock desc,
        fp.updated_at desc
    )::integer as semantic_rank
  from filtered_products fp
  where query_embedding_text is not null
    and query_embedding_text <> ''
    and fp.embedding is not null
    and fp.index_status = 'ready'
  limit 80
),
fused as (
  select
    coalesce(k.id, s.id) as id,
    k.keyword_rank,
    s.semantic_rank,
    coalesce(1.0 / (60 + k.keyword_rank), 0.0)
      + coalesce(1.0 / (60 + s.semantic_rank), 0.0) as score
  from keyword_candidates k
  full outer join semantic_candidates s
    on s.id = k.id
),
ranked as (
  select
    fp.*,
    f.keyword_rank,
    f.semantic_rank,
    f.score,
    count(*) over() as estimated_total
  from fused f
  join filtered_products fp
    on fp.id = f.id
  order by
    case
      when lower(fp.name) = lower(trim(query_text))
        or lower(coalesce(fp.name_telugu, '')) = lower(trim(query_text))
      then 0
      else 1
    end,
    f.score desc,
    fp.featured desc,
    fp.stock desc,
    fp.updated_at desc
  offset greatest(match_offset, 0)
  limit greatest(match_limit, 1)
)
select
  id,
  name,
  name_telugu,
  slug,
  description,
  description_telugu,
  price,
  discount_price,
  category_id,
  stock,
  material,
  tags,
  images,
  is_active,
  featured,
  is_sale,
  is_rental,
  rental_price,
  rental_discount_price,
  rental_deposit,
  max_rental_days,
  set_number,
  created_at,
  updated_at,
  category_name,
  category_name_telugu,
  category_slug,
  source_key,
  index_status,
  score,
  keyword_rank,
  semantic_rank,
  estimated_total
from ranked;
$$;
