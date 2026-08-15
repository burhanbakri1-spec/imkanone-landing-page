-- Migration 019: entity-owned media fields + direct category->brand ownership.
--
-- Media ownership rule:
--   Brand  -> logo_url, hero_video, hero_poster        (Add/Edit Brand)
--   Category -> brand_id, image_url, hero_video         (Add/Edit Category; Main Category direct child of Brand)
--   Product -> image, hover_image_url, gallery, video_url, usage_video, usage_video_poster (Add/Edit Product)
--   Website Media -> only site/home/about/news/contact global media.
--
-- The legacy website_media keys `brand.*`, `category.*.heroVideo`, and
-- `product.*.usageVideo(/Poster)` are migration-compatibility only. This migration
-- copies their values into the owning entities but does NOT delete the source rows
-- (rollback safety). Deletion/archival of legacy rows happens in a later,
-- validated step and never in this migration.
--
-- Kids Velvet only. Guarded to never touch iCare or any other tenant.
begin;

-- Brand hero media (entity-owned).
alter table public.company_brands add column if not exists hero_video text;
alter table public.company_brands add column if not exists hero_poster text;

-- Category brand ownership + hero video (entity-owned).
alter table public.company_categories add column if not exists brand_id text;
alter table public.company_categories add column if not exists hero_video text;

-- Product usage media (entity-owned).
alter table public.products add column if not exists usage_video text;
alter table public.products add column if not exists usage_video_poster text;

-- Tenant-scoped FK for category->brand, following the existing
-- company_categories.parent FK convention ((company_id, id) composite).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_company_categories_brand') then
    alter table public.company_categories
      add constraint fk_company_categories_brand
      foreign key (company_id, brand_id)
      references public.company_brands(company_id, id)
      on delete restrict not valid;
  end if;
end $$;

create index if not exists idx_company_categories_brand
  on public.company_categories(company_id, brand_id)
  where brand_id is not null;

-- ---------------------------------------------------------------------------
-- Guarded backfill: Kids Velvet legacy website_media -> entity fields.
-- Source rows are preserved (no delete) so the migration can be rolled back
-- safely before archival/validation completes.
-- ---------------------------------------------------------------------------
do $$
declare
  item record;
  brand_key text;
  brand_media text;
  cat_slug text;
  cat_media text;
  prod_slug text;
  prod_media text;
begin
  if not exists (select 1 from public.companies where id = 'kids-velvet') then
    raise notice 'kids-velvet tenant absent; skipping legacy media backfill.';
    return;
  end if;

  -- brand.{slug}.logo | .video | .poster -> company_brands
  for item in
    select
      section_key,
      coalesce(
        nullif(image_url, ''),
        nullif(data ->> 'imageUrl', ''),
        nullif(data ->> 'image_url', '')
      ) as image_url,
      coalesce(
        nullif(data ->> 'videoUrl', ''),
        nullif(data ->> 'video_url', '')
      ) as video_url,
      coalesce(
        nullif(data ->> 'fallbackImageUrl', ''),
        nullif(data ->> 'fallback_image_url', '')
      ) as fallback_image_url,
      is_active
    from public.website_media
    where company_id = 'kids-velvet' and section_key like 'brand.%.%'
  loop
    if coalesce(item.is_active, true) is false then continue; end if;
    brand_key := substring(item.section_key from '^brand\.([^.]+)\.');
    if brand_key is null or brand_key = '' then continue; end if;

    if item.section_key like 'brand.%.logo' or item.section_key like 'brand.%.poster' then
      brand_media := coalesce(nullif(item.image_url, ''), nullif(item.fallback_image_url, ''));
    else
      brand_media := coalesce(nullif(item.video_url, ''), nullif(item.image_url, ''));
    end if;
    if brand_media is null then continue; end if;

    if item.section_key like 'brand.%.logo' then
      update public.company_brands
         set logo_url = coalesce(logo_url, brand_media), updated_at = now()
       where company_id = 'kids-velvet' and slug = brand_key and logo_url is null;
    elsif item.section_key like 'brand.%.video' then
      update public.company_brands
         set hero_video = coalesce(hero_video, brand_media), updated_at = now()
       where company_id = 'kids-velvet' and slug = brand_key and hero_video is null;
    elsif item.section_key like 'brand.%.poster' then
      update public.company_brands
         set hero_poster = coalesce(hero_poster, brand_media), updated_at = now()
       where company_id = 'kids-velvet' and slug = brand_key and hero_poster is null;
    end if;
  end loop;

  -- category.{slug}.heroVideo -> company_categories (Main Category only)
  for item in
    select
      section_key,
      coalesce(
        nullif(image_url, ''),
        nullif(data ->> 'imageUrl', ''),
        nullif(data ->> 'image_url', '')
      ) as image_url,
      coalesce(
        nullif(data ->> 'videoUrl', ''),
        nullif(data ->> 'video_url', '')
      ) as video_url,
      is_active
    from public.website_media
    where company_id = 'kids-velvet' and section_key like 'category.%.heroVideo'
  loop
    if coalesce(item.is_active, true) is false then continue; end if;
    cat_slug := substring(item.section_key from '^category\.([^.]+)\.');
    if cat_slug is null or cat_slug = '' then continue; end if;
    cat_media := coalesce(nullif(item.video_url, ''), nullif(item.image_url, ''));
    if cat_media is null then continue; end if;

    update public.company_categories
       set hero_video = coalesce(hero_video, cat_media), updated_at = now()
     where company_id = 'kids-velvet' and slug = cat_slug and parent_id is null and hero_video is null;
  end loop;

  -- product.{slug}.usageVideo / usageVideoPoster -> products
  for item in
    select
      section_key,
      coalesce(
        nullif(image_url, ''),
        nullif(data ->> 'imageUrl', ''),
        nullif(data ->> 'image_url', '')
      ) as image_url,
      coalesce(
        nullif(data ->> 'videoUrl', ''),
        nullif(data ->> 'video_url', '')
      ) as video_url,
      coalesce(
        nullif(data ->> 'fallbackImageUrl', ''),
        nullif(data ->> 'fallback_image_url', '')
      ) as fallback_image_url,
      is_active
    from public.website_media
    where company_id = 'kids-velvet'
      and (section_key like 'product.%.usageVideo' or section_key like 'product.%.usageVideoPoster')
  loop
    if coalesce(item.is_active, true) is false then continue; end if;
    prod_slug := substring(item.section_key from '^product\.([^.]+)\.');
    if prod_slug is null or prod_slug = '' then continue; end if;

    if item.section_key like 'product.%.usageVideo' then
      prod_media := coalesce(nullif(item.video_url, ''), nullif(item.image_url, ''));
      if prod_media is not null then
        update public.products
           set usage_video = coalesce(usage_video, prod_media), updated_at = now()
         where company_id = 'kids-velvet' and slug = prod_slug and usage_video is null;
      end if;
    else
      prod_media := coalesce(nullif(item.image_url, ''), nullif(item.fallback_image_url, ''));
      if prod_media is not null then
        update public.products
           set usage_video_poster = coalesce(usage_video_poster, prod_media), updated_at = now()
         where company_id = 'kids-velvet' and slug = prod_slug and usage_video_poster is null;
      end if;
    end if;
  end loop;
end $$;

commit;
