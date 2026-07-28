-- Auto-generated schema + seed file
-- Generated at: 2026-07-28T15:35:10.660Z
-- Source schema: server/db/postgres.js (ensureEventsSchema)
-- Source seed: server/data/users.json and server/data/content-store.json

BEGIN;

-- =========================
-- Schema
-- =========================

CREATE TABLE IF NOT EXISTS events (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      date TIMESTAMPTZ NOT NULL,
      end_date TIMESTAMPTZ NOT NULL,
      location TEXT NOT NULL,
      category TEXT NOT NULL,
      media_url TEXT NOT NULL DEFAULT '',
      capacity INTEGER NOT NULL DEFAULT 0,
      waitlist_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      registrations INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS media_url TEXT NOT NULL DEFAULT '';

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 0;

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS event_registrants (
      id BIGSERIAL PRIMARY KEY,
      event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      contact TEXT,
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

ALTER TABLE event_registrants
    ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';

ALTER TABLE event_registrants
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed';

CREATE INDEX IF NOT EXISTS idx_event_registrants_event_id ON event_registrants(event_id);

CREATE TABLE IF NOT EXISTS app_singletons (
      resource TEXT PRIMARY KEY,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS app_items (
      resource TEXT NOT NULL,
      id TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (resource, id)
    );

CREATE INDEX IF NOT EXISTS idx_app_items_resource ON app_items(resource);

CREATE TABLE IF NOT EXISTS quiz_bank_files (
      file_name TEXT PRIMARY KEY,
      questions JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'Member',
      member_type TEXT NOT NULL DEFAULT 'Member',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      auth_provider TEXT NOT NULL DEFAULT 'LOCAL',
      avatar_url TEXT NOT NULL DEFAULT '',
      registration_complete BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      approval_status TEXT NOT NULL DEFAULT 'pending',
      approval_updated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS cms_pages (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      hero_title TEXT NOT NULL DEFAULT '',
      hero_description TEXT NOT NULL DEFAULT '',
      intro TEXT NOT NULL DEFAULT '',
      media_url TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      map_embed_url TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS cms_page_sections (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      media_url TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_cms_page_sections_page ON cms_page_sections(page_id);

CREATE TABLE IF NOT EXISTS cms_hero_slides (
      id TEXT PRIMARY KEY,
      slide_order INTEGER NOT NULL DEFAULT 1,
      image TEXT NOT NULL DEFAULT '',
      eyebrow TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      primary_cta_label TEXT NOT NULL DEFAULT '',
      primary_cta_path TEXT NOT NULL DEFAULT '',
      secondary_cta_label TEXT NOT NULL DEFAULT '',
      secondary_cta_path TEXT NOT NULL DEFAULT '',
      content_link_label TEXT NOT NULL DEFAULT '',
      content_link_path TEXT NOT NULL DEFAULT '',
      content_link_two_label TEXT NOT NULL DEFAULT '',
      content_link_two_path TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS schedule_days (
      id TEXT PRIMARY KEY,
      date_key TEXT NOT NULL UNIQUE,
      date_label TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      is_special BOOLEAN NOT NULL DEFAULT FALSE,
      highlight_title TEXT NOT NULL DEFAULT '',
      highlight_note_en TEXT NOT NULL DEFAULT '',
      highlight_note_pa TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS schedule_entries (
      id TEXT PRIMARY KEY,
      day_id TEXT NOT NULL REFERENCES schedule_days(id) ON DELETE CASCADE,
      segment TEXT NOT NULL DEFAULT 'morning',
      time_en TEXT NOT NULL DEFAULT '',
      time_pa TEXT NOT NULL DEFAULT '',
      title_en TEXT NOT NULL DEFAULT '',
      title_pa TEXT NOT NULL DEFAULT '',
      note_en TEXT NOT NULL DEFAULT '',
      note_pa TEXT NOT NULL DEFAULT '',
      is_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_schedule_entries_day ON schedule_entries(day_id);

CREATE TABLE IF NOT EXISTS langar_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Grocery',
      added_on DATE,
      expiry_date DATE,
      needed BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS advertisements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      banner_url TEXT NOT NULL DEFAULT '',
      target_link TEXT NOT NULL DEFAULT '',
      placement TEXT NOT NULL DEFAULT 'Homepage Sidebar',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS news_articles (
      id TEXT PRIMARY KEY,
      heading TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      links TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      image_links TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      published_at DATE,
      expiry_date DATE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS gallery_albums (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      cover_url TEXT NOT NULL DEFAULT '',
      event_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS gallery_images (
      id TEXT PRIMARY KEY,
      album_id TEXT NOT NULL REFERENCES gallery_albums(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      caption TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_gallery_images_album ON gallery_images(album_id);

CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      video_url TEXT NOT NULL DEFAULT '',
      platform TEXT NOT NULL DEFAULT 'other',
      category TEXT NOT NULL DEFAULT 'General',
      thumbnail_url TEXT NOT NULL DEFAULT '',
      featured_date DATE,
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      tags TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS streaming_configs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL DEFAULT '',
      stream_url TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT FALSE,
      checked_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS subscribers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL UNIQUE,
      interests TEXT NOT NULL DEFAULT 'Events and updates',
      source TEXT NOT NULL DEFAULT 'Website',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS seva_opportunities (
      id TEXT PRIMARY KEY,
      seva_type TEXT NOT NULL,
      seva_date DATE NOT NULL,
      seva_time TEXT NOT NULL DEFAULT '',
      total_volunteers_required INTEGER NOT NULL DEFAULT 1,
      waitlist_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      expiry_date DATE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

ALTER TABLE seva_opportunities
    ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS volunteer_registrations (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
      opportunity_id TEXT REFERENCES seva_opportunities(id) ON DELETE SET NULL,
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      whatsapp TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT '',
      seva_type TEXT NOT NULL DEFAULT '',
      seva_date DATE,
      seva_time TEXT NOT NULL DEFAULT '',
      contact_preference TEXT NOT NULL DEFAULT 'Email',
      wants_event_emails BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_volunteer_registrations_opportunity ON volunteer_registrations(opportunity_id);

CREATE TABLE IF NOT EXISTS library_physical_books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'General',
      isbn TEXT NOT NULL DEFAULT '',
      total_copies INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS library_issue_records (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL REFERENCES library_physical_books(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
      copy_number INTEGER NOT NULL DEFAULT 1,
      issuer_name TEXT NOT NULL DEFAULT '',
      issuer_phone TEXT NOT NULL DEFAULT '',
      issue_date DATE,
      return_date DATE,
      returned_at DATE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_library_issue_records_book ON library_issue_records(book_id);

CREATE TABLE IF NOT EXISTS library_digital_resources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      file_type TEXT NOT NULL DEFAULT 'PDF',
      description TEXT NOT NULL DEFAULT '',
      download_url TEXT NOT NULL DEFAULT '',
      cover_image_url TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS library_program_updates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      speaker TEXT NOT NULL DEFAULT '',
      audience TEXT NOT NULL DEFAULT '',
      schedule_date DATE,
      schedule_time TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      registration_url TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS library_media_resources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      media_type TEXT NOT NULL DEFAULT 'youtube',
      url TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      thumbnail_url TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS hukamnama_entries (
      id TEXT PRIMARY KEY,
      ang INTEGER NOT NULL,
      entry_date DATE NOT NULL,
      slot TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      audio_url TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(entry_date, slot)
    );

CREATE TABLE IF NOT EXISTS hukamnama_lines (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES hukamnama_entries(id) ON DELETE CASCADE,
      line_no INTEGER NOT NULL DEFAULT 1,
      gurmukhi TEXT NOT NULL DEFAULT '',
      translation_english TEXT NOT NULL DEFAULT '',
      translation_punjabi TEXT NOT NULL DEFAULT '',
      transliteration TEXT NOT NULL DEFAULT ''
    );

CREATE INDEX IF NOT EXISTS idx_hukamnama_lines_entry ON hukamnama_lines(entry_id);

CREATE TABLE IF NOT EXISTS donation_records (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
      donor_name TEXT NOT NULL DEFAULT '',
      donor_email TEXT NOT NULL DEFAULT '',
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'cad',
      purpose TEXT NOT NULL DEFAULT '',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      payment_provider TEXT NOT NULL DEFAULT 'stripe',
      payment_reference TEXT NOT NULL DEFAULT '',
      donated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS analytics_daily_metrics (
      metric_date DATE PRIMARY KEY,
      total_visits INTEGER NOT NULL DEFAULT 0,
      unique_visitors INTEGER NOT NULL DEFAULT 0,
      event_registrations INTEGER NOT NULL DEFAULT 0,
      seva_registrations INTEGER NOT NULL DEFAULT 0,
      donations_count INTEGER NOT NULL DEFAULT 0,
      donations_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS donation_campaigns (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      progress_title TEXT NOT NULL DEFAULT '',
      progress_description TEXT NOT NULL DEFAULT '',
      progress_photos JSONB NOT NULL DEFAULT '[]'::jsonb,
      progress_updates JSONB NOT NULL DEFAULT '[]'::jsonb,
      progress_items JSONB NOT NULL DEFAULT '[]'::jsonb,
      story_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
      raised NUMERIC(12, 2) NOT NULL DEFAULT 0,
      target NUMERIC(12, 2) NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      payment_provider TEXT NOT NULL DEFAULT 'STRIPE',
      payment_link TEXT NOT NULL DEFAULT '',
      stripe_buy_button_id TEXT NOT NULL DEFAULT '',
      stripe_publishable_key TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

ALTER TABLE donation_campaigns
    ADD COLUMN IF NOT EXISTS progress_title TEXT NOT NULL DEFAULT '';

ALTER TABLE donation_campaigns
    ADD COLUMN IF NOT EXISTS progress_description TEXT NOT NULL DEFAULT '';

ALTER TABLE donation_campaigns
    ADD COLUMN IF NOT EXISTS progress_photos JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE donation_campaigns
    ADD COLUMN IF NOT EXISTS progress_updates JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE donation_campaigns
    ADD COLUMN IF NOT EXISTS progress_items JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE donation_campaigns
    ADD COLUMN IF NOT EXISTS story_blocks JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_donation_campaigns_active ON donation_campaigns(is_active);

CREATE TABLE IF NOT EXISTS donation_pending (
      id TEXT PRIMARY KEY,
      campaign_id BIGINT NOT NULL REFERENCES donation_campaigns(id) ON DELETE CASCADE,
      campaign_name TEXT NOT NULL,
      donor_name TEXT NOT NULL DEFAULT 'Anonymous',
      donor_email TEXT NOT NULL DEFAULT '',
      amount NUMERIC(12, 2),
      frequency TEXT NOT NULL DEFAULT 'one-time',
      payment_provider TEXT NOT NULL DEFAULT 'STRIPE',
      checkout_url TEXT NOT NULL DEFAULT '',
      session_id TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_donation_pending_campaign ON donation_pending(campaign_id);

CREATE INDEX IF NOT EXISTS idx_donation_pending_created ON donation_pending(created_at DESC);

CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY,
      receipt_id TEXT NOT NULL,
      source_pending_id TEXT,
      campaign_id BIGINT REFERENCES donation_campaigns(id) ON DELETE SET NULL,
      campaign_name TEXT NOT NULL,
      donor_name TEXT NOT NULL DEFAULT 'Anonymous',
      donor_email TEXT NOT NULL DEFAULT '',
      amount NUMERIC(12, 2) NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'one-time',
      payment_provider TEXT NOT NULL DEFAULT 'STRIPE',
      payment_status TEXT NOT NULL DEFAULT 'PAID',
      gateway_transaction_id TEXT NOT NULL DEFAULT '',
      stripe_session_id TEXT NOT NULL DEFAULT '',
      stripe_event_id TEXT NOT NULL DEFAULT '',
      email_sent BOOLEAN NOT NULL DEFAULT FALSE,
      source TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_donations_receipt_id UNIQUE (receipt_id)
    );

CREATE INDEX IF NOT EXISTS idx_donations_campaign_id ON donations(campaign_id);

CREATE INDEX IF NOT EXISTS idx_donations_created ON donations(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_donations_stripe_session
    ON donations(stripe_session_id)
    WHERE stripe_session_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_donations_gateway_txn
    ON donations(gateway_transaction_id)
    WHERE gateway_transaction_id <> '';

-- =========================
-- Seed: admin_users
-- =========================

INSERT INTO admin_users (id, name, email, role, member_type, phone, address, auth_provider, avatar_url, registration_complete, is_active, approval_status, approval_updated_at, created_at, updated_at) VALUES ('user-1783624963905', 'Steve Evans', 'steve.evans1208@gmail.com', 'Volunteer', 'Member', '09915929494', '#123', 'GOOGLE', 'https://lh3.googleusercontent.com/a/ACg8ocKcVsIBbyx64mA8862KcmV0eJsXsgoLNJNRUYhSRKfa7jnkIw=s96-c', TRUE, TRUE, 'approved', '2026-07-09T19:23:30.367Z', '2026-07-09T19:22:43.905Z'::timestamptz, '2026-07-10T00:59:16.970Z'::timestamptz) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role, member_type = EXCLUDED.member_type, phone = EXCLUDED.phone, address = EXCLUDED.address, auth_provider = EXCLUDED.auth_provider, avatar_url = EXCLUDED.avatar_url, registration_complete = EXCLUDED.registration_complete, is_active = EXCLUDED.is_active, approval_status = EXCLUDED.approval_status, approval_updated_at = EXCLUDED.approval_updated_at, updated_at = NOW();
INSERT INTO admin_users (id, name, email, role, member_type, phone, address, auth_provider, avatar_url, registration_complete, is_active, approval_status, approval_updated_at, created_at, updated_at) VALUES ('user-1783624452454', 'aashoodeep singh thind', 'ashu.thind@gmail.com', 'Super Admin', 'Member', '4379927044', '705, Thompson Road South', 'GOOGLE', 'https://lh3.googleusercontent.com/a/ACg8ocKl_jGeaHjF9CTZuDeDdITa0SxyzAU4PWED26mSAuqpe9cE9R3gsA=s96-c', TRUE, TRUE, 'approved', NULL, '2026-07-09T19:14:12.454Z'::timestamptz, '2026-07-10T00:59:16.970Z'::timestamptz) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role, member_type = EXCLUDED.member_type, phone = EXCLUDED.phone, address = EXCLUDED.address, auth_provider = EXCLUDED.auth_provider, avatar_url = EXCLUDED.avatar_url, registration_complete = EXCLUDED.registration_complete, is_active = EXCLUDED.is_active, approval_status = EXCLUDED.approval_status, approval_updated_at = EXCLUDED.approval_updated_at, updated_at = NOW();
INSERT INTO admin_users (id, name, email, role, member_type, phone, address, auth_provider, avatar_url, registration_complete, is_active, approval_status, approval_updated_at, created_at, updated_at) VALUES ('user-1783624435729', 'Manjot Kaur', 'manjotkaur.asr@googlemail.com', 'Member', 'Member', '6473273108', '6, Blueleaf Trail', 'GOOGLE', 'https://lh3.googleusercontent.com/a/ACg8ocJ05a1Wrq3qOMgcBgkzwnY48_LK4DfW0oJn0D-L6T-TV78oAg=s96-c', TRUE, TRUE, 'approved', NULL, '2026-07-09T19:13:55.729Z'::timestamptz, '2026-07-10T00:59:16.970Z'::timestamptz) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role, member_type = EXCLUDED.member_type, phone = EXCLUDED.phone, address = EXCLUDED.address, auth_provider = EXCLUDED.auth_provider, avatar_url = EXCLUDED.avatar_url, registration_complete = EXCLUDED.registration_complete, is_active = EXCLUDED.is_active, approval_status = EXCLUDED.approval_status, approval_updated_at = EXCLUDED.approval_updated_at, updated_at = NOW();
INSERT INTO admin_users (id, name, email, role, member_type, phone, address, auth_provider, avatar_url, registration_complete, is_active, approval_status, approval_updated_at, created_at, updated_at) VALUES ('user-1', 'Admin Singh', 'admin@singhsabhamilton.org', 'Super Admin', 'Admin', '', '', 'LOCAL', '', TRUE, FALSE, 'approved', NULL, '2026-07-09T19:07:23.202Z'::timestamptz, '2026-07-10T00:59:16.970Z'::timestamptz) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role, member_type = EXCLUDED.member_type, phone = EXCLUDED.phone, address = EXCLUDED.address, auth_provider = EXCLUDED.auth_provider, avatar_url = EXCLUDED.avatar_url, registration_complete = EXCLUDED.registration_complete, is_active = EXCLUDED.is_active, approval_status = EXCLUDED.approval_status, approval_updated_at = EXCLUDED.approval_updated_at, updated_at = NOW();

-- =========================
-- Seed: app_singletons
-- =========================

INSERT INTO app_singletons (resource, payload, updated_at) VALUES ('cms_page_content', '{"about":{"heroTitle":"About Us","heroDescription":"","intro":"Gurdwara Singh Sabha Milton is a welcoming place of worship dedicated to serving the spiritual, cultural, and social needs of the Sikh community in Milton and the surrounding areas. Guided by the teachings of Sri Guru Granth Sahib Ji, our Gurdwara is committed to fostering faith, compassion, equality, and selfless service (Seva).\n\nOur mission is to provide a peaceful environment where individuals and families can strengthen their spiritual connection through daily prayers, Gurbani Kirtan, Katha, and Sangat. We strive to preserve and promote Sikh values while creating opportunities for people of all ages to learn about Sikh history, culture, and traditions.\n\nEvery week, members of the community come together to participate in religious services, celebrate Gurpurabs, and enjoy the tradition of Guru Ka Langar, where everyone is welcomed with love and served equally regardless of background, religion, or ethnicity.\n\nAs our community continues to grow, Gurdwara Singh Sabha Milton remains dedicated to establishing and maintaining a permanent Gurdwara Sahib that will serve future generations as a center for worship, education, community engagement, and charitable initiatives.\n\nWe believe that a Gurdwara is more than a place of prayer—it is a home for the Sangat, where spiritual growth, volunteerism, community service, and unity flourish together.\n\nWe warmly invite everyone to visit, participate in our programs, and become part of our growing community as we work together in the spirit of **Sarbat Da Bhala**—the well-being of all.\n","mediaUrl":"/api/uploads/cms/2026/07/1783711144877-te3vsx-milton_about_us.webp","sections":[],"phone":"","email":"","address":"","mapEmbedUrl":""},"sikhism":{"heroTitle":"Sikhism","heroDescription":"Sikhism is a journey of faith, equality, compassion, and selfless service. Inspired by the teachings of the Ten Sikh Gurus and Sri Guru Granth Sahib Ji,","intro":"Welcome to a community built on the foundations of Sikh values — devotion, equality, kindness, and service. Our Gurdwara is a place where everyone is welcomed with open hearts, where spiritual learning is encouraged, and where the spirit of Sangat brings people together.\n\nExperience Gurbani, Kirtan, Langar, and the teachings of Sri Guru Granth Sahib Ji as we walk together on the path of truth and compassion.","mediaUrl":"/api/uploads/cms/2026/07/1783711465310-zfhxff-milton_about_us.webp","sections":[],"phone":"","email":"","address":"","mapEmbedUrl":""},"events":{"heroTitle":"Events","heroDescription":"This is the events page","intro":"","mediaUrl":"","sections":[],"phone":"","email":"","address":"","mapEmbedUrl":""},"gallery":{"heroTitle":"","heroDescription":"","intro":"","mediaUrl":"","sections":[]},"contact":{"heroTitle":"","heroDescription":"","intro":"","mediaUrl":"","phone":"","email":"","address":"","mapEmbedUrl":"","sections":[]}}'::jsonb, NOW()) ON CONFLICT (resource) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
INSERT INTO app_singletons (resource, payload, updated_at) VALUES ('cms_home_content', '{"hero":{"eyebrow":"Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh","title":"Gurdwara Singh Sabha Milton","description":"Daily hukamnama, Sunday samagams, seva opportunities, and community updates for the sangat in Milton and beyond.","primaryCta":"Donate for Langar","primaryCtaPath":"/donation","secondaryCta":"Join Seva","secondaryCtaPath":"/seva","slides":[{"id":"slide-1783711025492-0","order":1,"image":"https://assets.cdn.filesafe.space/b9aAKZlXnebGhQoRLosa/media/654583d092b8570d5a8c5f1a.png","eyebrow":"Weekly Diwan","title":"Sunday Samagam","description":"Sukhmani Sahib, Kirtan, Katha, and Ardaas with Langar sewa for the full sangat.","primaryCtaLabel":"View Sunday Program","primaryCtaPath":"/events","secondaryCtaLabel":"Register for Seva","secondaryCtaPath":"/seva","contentLinkLabel":"See full weekly schedule","contentLinkPath":"/events","contentLinkTwoLabel":"Support langar","contentLinkTwoPath":"/donation"},{"id":"slide-1783711025492-1","order":2,"image":"https://images.leadconnectorhq.com/image/f_webp/q_80/r_320/u_https://storage.googleapis.com/msgsndr/knES3eSWYIsc5YSZ3YLl/media/62beef4f9f43b0c53e585a8f.jpeg","eyebrow":"Community Life","title":"Sangat and Community","description":"Families, youth, and elders connected through Gurbani, seva, and shared learning.","primaryCtaLabel":"Register for Seva","primaryCtaPath":"/seva","secondaryCtaLabel":"Explore Sikh Education","secondaryCtaPath":"/sikhism","contentLinkLabel":"Read daily hukamnama","contentLinkPath":"/hukamnama","contentLinkTwoLabel":"Browse gallery","contentLinkTwoPath":"/gallery"}]},"schedule":{"morning":[{"id":"morning-1","time":"5:00 AM","label":"Parkash Sri Guru Granth Sahib"},{"id":"morning-2","time":"5:15 AM","label":"5 Baani da Paath"},{"id":"morning-3","time":"6:15 AM - 6:40 AM","label":"Ardaas and Hukamnama"}],"evening":[{"id":"evening-1","time":"7:00 PM","label":"Rehraas Sahib"},{"id":"evening-2","time":"7:30 PM - 7:45 PM","label":"Hukamnama Katha"},{"id":"evening-3","time":"7:45 PM - 8:00 PM","label":"Kirtan Sohila Sahib"},{"id":"evening-4","time":"8:00 PM","label":"Sukh Asan Sri Guru Granth Sahib"}]},"langarItems":[{"id":"langar-1","name":"Ginger","category":"Grocery","addedOn":"2026-07-07","expiryDate":"","needed":true},{"id":"langar-2","name":"Tomato","category":"Grocery","addedOn":"2026-07-07","expiryDate":"","needed":true},{"id":"langar-3","name":"Onions","category":"Grocery","addedOn":"2026-07-06","expiryDate":"","needed":false},{"id":"langar-4","name":"Flour (Atta)","category":"Grocery","addedOn":"2026-07-07","expiryDate":"","needed":true},{"id":"langar-5","name":"Lentils (Daal)","category":"Grocery","addedOn":"2026-07-05","expiryDate":"","needed":false}],"scheduleDays":[{"id":"schedule-default","dateKey":"default","dateLabel":"Daily Default","title":"Standard Daily Maryada","isSpecial":false,"highlightTitle":"","highlightNoteEn":"","highlightNotePa":"","entries":[{"id":"morning-1","segment":"morning","timeEn":"5:00 AM","timePa":"","titleEn":"Parkash Sri Guru Granth Sahib","titlePa":"","noteEn":"","notePa":"","isHighlighted":false,"isActive":true,"sortOrder":1},{"id":"morning-2","segment":"morning","timeEn":"5:15 AM","timePa":"","titleEn":"5 Baani da Paath","titlePa":"","noteEn":"","notePa":"","isHighlighted":false,"isActive":true,"sortOrder":2},{"id":"morning-3","segment":"morning","timeEn":"6:15 AM - 6:40 AM","timePa":"","titleEn":"Ardaas and Hukamnama","titlePa":"","noteEn":"","notePa":"","isHighlighted":false,"isActive":true,"sortOrder":3},{"id":"evening-1","segment":"evening","timeEn":"7:00 PM","timePa":"","titleEn":"Rehraas Sahib","titlePa":"","noteEn":"","notePa":"","isHighlighted":false,"isActive":true,"sortOrder":4},{"id":"evening-2","segment":"evening","timeEn":"7:30 PM - 7:45 PM","timePa":"","titleEn":"Hukamnama Katha","titlePa":"","noteEn":"","notePa":"","isHighlighted":false,"isActive":true,"sortOrder":5},{"id":"evening-3","segment":"evening","timeEn":"7:45 PM - 8:00 PM","timePa":"","titleEn":"Kirtan Sohila Sahib","titlePa":"","noteEn":"","notePa":"","isHighlighted":false,"isActive":true,"sortOrder":6},{"id":"evening-4","segment":"evening","timeEn":"8:00 PM","timePa":"","titleEn":"Sukh Asan Sri Guru Granth Sahib","titlePa":"","noteEn":"","notePa":"","isHighlighted":false,"isActive":true,"sortOrder":7}]}]}'::jsonb, NOW()) ON CONFLICT (resource) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
INSERT INTO app_singletons (resource, payload, updated_at) VALUES ('hukamnama_ssm_hukamnama_cache', '{"1":{"ang":1,"source":"Sri Guru Granth Sahib Ji","metadata":{"source":"Sri Guru Granth Sahib Ji","sourcePunjabi":"ਸ਼੍ਰੀ ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ ਜੀ","raag":"Jap","writer":"Guru Nanak Dev Ji","totalLines":23,"pageName":"Ang"},"updatedAt":"2026-07-10T19:19:13.249Z","audioUrl":"https://hs.sgpc.net/uploadhukamnama/hukamnama.mp3","lines":[{"id":"0NVY","lineNo":1,"gurmukhi":"ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ ॥","translationEnglish":"One Universal Creator God. The Name Is Truth. Creative Being Personified. No Fear. No Hatred. Image Of The Undying, Beyond Birth, Self-Existent. By Guru''s Grace ~","translationPunjabi":"ਅਕਾਲ ਪੁਰਖ ਇੱਕ ਹੈ, ਜਿਸ ਦਾ ਨਾਮ ''ਹੋਂਦ ਵਾਲਾ'' ਹੈ ਜੋ ਸ੍ਰਿਸ਼ਟੀ ਦਾ ਰਚਨਹਾਰ ਹੈ, ਜੋ ਸਭ ਵਿਚ ਵਿਆਪਕ ਹੈ, ਭੈ ਤੋਂ ਰਹਿਤ ਹੈ, ਵੈਰ-ਰਹਿਤ ਹੈ, ਜਿਸ ਦਾ ਸਰੂਪ ਕਾਲ ਤੋਂ ਪਰੇ ਹੈ, (ਭਾਵ, ਜਿਸ ਦਾ ਸਰੀਰ ਨਾਸ-ਰਹਿਤ ਹੈ), ਜੋ ਜੂਨਾਂ ਵਿਚ ਨਹੀਂ ਆਉਂਦਾ, ਜਿਸ ਦਾ ਪ੍ਰਕਾਸ਼ ਆਪਣੇ ਆਪ ਤੋਂ ਹੋਇਆ ਹੈ ਅਤੇ ਜੋ ਸਤਿਗੁਰੂ ਦੀ ਕਿਰਪਾ ਨਾਲ ਮਿਲਦਾ ਹੈ।","transliteration":""},{"id":"RBP6","lineNo":3,"gurmukhi":"॥ ਜਪੁ ॥","translationEnglish":"Chant And Meditate:","translationPunjabi":"''ਜਪੁ'' ਬਾਣੀ ਦਾ ਨਾਮ ਹੈ।","transliteration":""},{"id":"J92N","lineNo":4,"gurmukhi":"ਆਦਿ ਸਚੁ ਜੁਗਾਦਿ ਸਚੁ ॥","translationEnglish":"True In The Primal Beginning. True Throughout The Ages.","translationPunjabi":"ਅਕਾਲ ਪੁਰਖ ਮੁੱਢ ਤੋਂ ਹੋਂਦ ਵਾਲਾ ਹੈ, ਜੁਗਾਂ ਦੇ ਮੁੱਢ ਤੋਂ ਮੌਜੂਦ ਹੈ।","transliteration":""},{"id":"K0U6","lineNo":4,"gurmukhi":"ਹੈ ਭੀ ਸਚੁ ਨਾਨਕ ਹੋਸੀ ਭੀ ਸਚੁ ॥੧॥","translationEnglish":"True Here And Now. O Nanak, Forever And Ever True. ||1||","translationPunjabi":"ਹੇ ਨਾਨਕ! ਇਸ ਵੇਲੇ ਭੀ ਮੌਜੂਦ ਹੈ ਤੇ ਅਗਾਂਹ ਨੂੰ ਭੀ ਹੋਂਦ ਵਾਲਾ ਰਹੇਗਾ ॥੧॥","transliteration":""},{"id":"BL70","lineNo":5,"gurmukhi":"ਸੋਚੈ ਸੋਚਿ ਨ ਹੋਵਈ ਜੇ ਸੋਚੀ ਲਖ ਵਾਰ ॥","translationEnglish":"By thinking, He cannot be reduced to thought, even by thinking hundreds of thousands of times.","translationPunjabi":"ਜੇ ਮੈਂ ਲੱਖ ਵਾਰੀ (ਭੀ) (ਇਸ਼ਨਾਨ ਆਦਿਕ ਨਾਲ ਸਰੀਰ ਦੀ) ਸੁੱਚ ਰੱਖਾਂ, (ਤਾਂ ਭੀ ਇਸ ਤਰ੍ਹਾਂ) ਸੁੱਚ ਰੱਖਣ ਨਾਲ (ਮਨ ਦੀ) ਸੁੱਚ ਨਹੀਂ ਰਹਿ ਸਕਦੀ।","transliteration":""},{"id":"GJW9","lineNo":5,"gurmukhi":"ਚੁਪੈ ਚੁਪ ਨ ਹੋਵਈ ਜੇ ਲਾਇ ਰਹਾ ਲਿਵ ਤਾਰ ॥","translationEnglish":"By remaining silent, inner silence is not obtained, even by remaining lovingly absorbed deep within.","translationPunjabi":"ਜੇ ਮੈਂ (ਸਰੀਰ ਦੀ) ਇਕ-ਤਾਰ ਸਮਾਧੀ ਲਾਈ ਰੱਖਾਂ; (ਤਾਂ ਭੀ ਇਸ ਤਰ੍ਹਾਂ) ਚੁੱਪ ਕਰ ਰਹਿਣ ਨਾਲ ਮਨ ਦੀ ਸ਼ਾਂਤੀ ਨਹੀਂ ਹੋ ਸਕਦੀ।","transliteration":""},{"id":"ZERL","lineNo":5,"gurmukhi":"ਭੁਖਿਆ ਭੁਖ ਨ ਉਤਰੀ ਜੇ ਬੰਨਾ ਪੁਰੀਆ ਭਾਰ ॥","translationEnglish":"The hunger of the hungry is not appeased, even by piling up loads of worldly goods.","translationPunjabi":"ਜੇ ਮੈਂ ਸਾਰੇ ਭਵਣਾਂ ਦੇ ਪਦਾਰਥਾਂ ਦੇ ਢੇਰ (ਭੀ) ਸਾਂਭ ਲਵਾਂ, ਤਾਂ ਭੀ ਤ੍ਰਿਸ਼ਨਾ ਦੇ ਅਧੀਨ ਰਿਹਾਂ ਤ੍ਰਿਸ਼ਨਾ ਦੂਰ ਨਹੀਂ ਹੋ ਸਕਦੀ।","transliteration":""},{"id":"9MN2","lineNo":6,"gurmukhi":"ਸਹਸ ਸਿਆਣਪਾ ਲਖ ਹੋਹਿ ਤ ਇਕ ਨ ਚਲੈ ਨਾਲਿ ॥","translationEnglish":"Hundreds of thousands of clever tricks, but not even one of them will go along with you in the end.","translationPunjabi":"ਜੇ (ਮੇਰੇ ਵਿਚ) ਹਜ਼ਾਰਾਂ ਤੇ ਲੱਖਾਂ ਚਤੁਰਾਈਆਂ ਹੋਵਣ, (ਤਾਂ ਭੀ ਉਹਨਾਂ ਵਿਚੋਂ) ਇਕ ਭੀ ਚਤੁਰਾਈ ਸਾਥ ਨਹੀਂ ਦੇਂਦੀ।","transliteration":""},{"id":"MK1Q","lineNo":6,"gurmukhi":"ਕਿਵ ਸਚਿਆਰਾ ਹੋਈਐ ਕਿਵ ਕੂੜੈ ਤੁਟੈ ਪਾਲਿ ॥","translationEnglish":"So how can you become truthful? And how can the veil of illusion be torn away?","translationPunjabi":"(ਤਾਂ ਫਿਰ) ਅਕਾਲ ਪੁਰਖ ਦਾ ਪਰਕਾਸ਼ ਹੋਣ ਲਈ ਯੋਗ ਕਿਵੇਂ ਬਣ ਸਕੀਦਾ ਹੈ (ਅਤੇ ਸਾਡੇ ਅੰਦਰ ਦਾ) ਕੂੜ ਦਾ ਪਰਦਾ ਕਿਵੇਂ ਟੁੱਟ ਸਕਦਾ ਹੈ?","transliteration":""},{"id":"H0PC","lineNo":7,"gurmukhi":"ਹੁਕਮਿ ਰਜਾਈ ਚਲਣਾ ਨਾਨਕ ਲਿਖਿਆ ਨਾਲਿ ॥੧॥","translationEnglish":"O Nanak, it is written that you shall obey the Hukam of His Command, and walk in the Way of His Will. ||1||","translationPunjabi":"ਰਜ਼ਾ ਦੇ ਮਾਲਕ ਅਕਾਲ ਪੁਰਖ ਦੇ ਹੁਕਮ ਵਿਚ ਤੁਰਨਾ-(ਇਹੀ ਇਕ ਵਿਧੀ ਹੈ)। ਹੇ ਨਾਨਕ! (ਇਹ ਵਿਧੀ) ਧੁਰ ਤੋਂ ਹੀ ਜਦ ਤੋਂ ਜਗਤ ਬਣਿਆ ਹੈ, ਲਿਖੀ ਚਲੀ ਆ ਰਹੀ ਹੈ ॥੧॥","transliteration":""},{"id":"60LK","lineNo":7,"gurmukhi":"ਹੁਕਮੀ ਹੋਵਨਿ ਆਕਾਰ ਹੁਕਮੁ ਨ ਕਹਿਆ ਜਾਈ ॥","translationEnglish":"By His Command, bodies are created; His Command cannot be described.","translationPunjabi":"ਅਕਾਲ ਪੁਰਖ ਦੇ ਹੁਕਮ ਅਨੁਸਾਰ ਸਾਰੇ ਸਰੀਰ ਬਣਦੇ ਹਨ, (ਪਰ ਇਹ) ਹੁਕਮ ਦੱਸਿਆ ਨਹੀਂ ਜਾ ਸਕਦਾ ਕਿ ਕਿਹੋ ਜਿਹਾ ਹੈ।","transliteration":""},{"id":"UVSL","lineNo":8,"gurmukhi":"ਹੁਕਮੀ ਹੋਵਨਿ ਜੀਅ ਹੁਕਮਿ ਮਿਲੈ ਵਡਿਆਈ ॥","translationEnglish":"By His Command, souls come into being; by His Command, glory and greatness are obtained.","translationPunjabi":"ਰੱਬ ਦੇ ਹੁਕਮ ਅਨੁਸਾਰ ਹੀ ਸਾਰੇ ਜੀਵ ਜੰਮ ਪੈਂਦੇ ਹਨ ਅਤੇ ਹੁਕਮ ਅਨੁਸਾਰ ਹੀ (ਰੱਬ ਦੇ ਦਰ ''ਤੇ) ਸ਼ੋਭਾ ਮਿਲਦੀ ਹੈ।","transliteration":""},{"id":"GLXS","lineNo":8,"gurmukhi":"ਹੁਕਮੀ ਉਤਮੁ ਨੀਚੁ ਹੁਕਮਿ ਲਿਖਿ ਦੁਖ ਸੁਖ ਪਾਈਅਹਿ ॥","translationEnglish":"By His Command, some are high and some are low; by His Written Command, pain and pleasure are obtained.","translationPunjabi":"ਰੱਬ ਦੇ ਹੁਕਮ ਵਿਚ ਕੋਈ ਮਨੁੱਖ ਚੰਗਾ (ਬਣ ਜਾਂਦਾ) ਹੈ, ਕੋਈ ਭੈੜਾ। ਉਸ ਦੇ ਹੁਕਮ ਵਿਚ ਹੀ (ਆਪਣੇ ਕੀਤੇ ਹੋਏ ਕਰਮਾਂ ਦੇ) ਲਿਖੇ ਅਨੁਸਾਰ ਦੁੱਖ ਤੇ ਸੁਖ ਭੋਗੀਦੇ ਹਨ।","transliteration":""},{"id":"P2VG","lineNo":9,"gurmukhi":"ਇਕਨਾ ਹੁਕਮੀ ਬਖਸੀਸ ਇਕਿ ਹੁਕਮੀ ਸਦਾ ਭਵਾਈਅਹਿ ॥","translationEnglish":"Some, by His Command, are blessed and forgiven; others, by His Command, wander aimlessly forever.","translationPunjabi":"ਹੁਕਮ ਵਿਚ ਹੀ ਕਦੀ ਮਨੁੱਖਾਂ ਉੱਤੇ (ਅਕਾਲ ਪੁਰਖ ਦੇ ਦਰ ਤੋਂ) ਬਖ਼ਸ਼ਸ਼ ਹੁੰਦੀ ਹੈ, ਅਤੇ ਉਸ ਦੇ ਹੁਕਮ ਵਿਚ ਹੀ ਕਈ ਮਨੁੱਖ ਨਿੱਤ ਜਨਮ ਮਰਨ ਦੇ ਗੇੜ ਵਿਚ ਭਵਾਈਦੇ ਹਨ।","transliteration":""},{"id":"MX4P","lineNo":9,"gurmukhi":"ਹੁਕਮੈ ਅੰਦਰਿ ਸਭੁ ਕੋ ਬਾਹਰਿ ਹੁਕਮ ਨ ਕੋਇ ॥","translationEnglish":"Everyone is subject to His Command; no one is beyond His Command.","translationPunjabi":"ਹਰੇਕ ਜੀਵ ਰੱਬ ਦੇ ਹੁਕਮ ਵਿਚ ਹੀ ਹੈ, ਕੋਈ ਜੀਵ ਹੁਕਮ ਤੋਂ ਬਾਹਰ (ਭਾਵ, ਹੁਕਮ ਤੋ ਆਕੀ) ਨਹੀਂ ਹੋ ਸਕਦਾ।","transliteration":""},{"id":"FKUU","lineNo":10,"gurmukhi":"ਨਾਨਕ ਹੁਕਮੈ ਜੇ ਬੁਝੈ ਤ ਹਉਮੈ ਕਹੈ ਨ ਕੋਇ ॥੨॥","translationEnglish":"O Nanak, one who understands His Command, does not speak in ego. ||2||","translationPunjabi":"ਹੇ ਨਾਨਕ! ਜੇ ਕੋਈ ਮਨੁੱਖ ਅਕਾਲ ਪੁਰਖ ਦੇ ਹੁਕਮ ਨੂੰ ਸਮਝ ਲਏ ਤਾਂ ਫਿਰ ਉਹ ਸੁਆਰਥ ਦੀਆਂ ਗੱਲਾਂ ਨਹੀਂ ਕਰਦਾ (ਭਾਵ, ਫਿਰ ਉਹ ਸੁਆਰਥੀ ਜੀਵਨ ਛੱਡ ਦੇਂਦਾ ਹੈ) ॥੨॥","transliteration":""},{"id":"VUQD","lineNo":10,"gurmukhi":"ਗਾਵੈ ਕੋ ਤਾਣੁ ਹੋਵੈ ਕਿਸੈ ਤਾਣੁ ॥","translationEnglish":"Some sing of His Power-who has that Power?","translationPunjabi":"ਜਿਸ ਕਿਸੇ ਮਨੁੱਖ ਨੂੰ ਸਮਰਥਾ ਹੁੰਦੀ ਹੈ, ਉਹ ਰੱਬ ਦੇ ਤਾਣ ਨੂੰ ਗਾਉਂਦਾ ਹੈ, (ਭਾਵ, ਉਸ ਦੀ ਸਿਫ਼ਤ-ਸਾਲਾਹ ਕਰਦਾ ਹੈ ਤੇ ਉਸ ਦੇ ਉਹ ਕੰਮ ਕਥਨ ਕਰਦਾ ਹੈ, ਜਿਨ੍ਹਾਂ ਤੋਂ ਉਸ ਦੀ ਵੱਡੀ ਤਾਕਤ ਪਰਗਟ ਹੋਵੇ)।","transliteration":""},{"id":"7AC7","lineNo":11,"gurmukhi":"ਗਾਵੈ ਕੋ ਦਾਤਿ ਜਾਣੈ ਨੀਸਾਣੁ ॥","translationEnglish":"Some sing of His Gifts, and know His Sign and Insignia.","translationPunjabi":"ਕੋਈ ਮਨੁੱਖ ਉਸ ਦੀਆਂ ਦਾਤਾਂ ਨੂੰ ਹੀ ਗਾਉਂਦਾ ਹੈ, (ਕਿਉਂਕਿ ਇਹਨਾਂ ਦਾਤਾਂ ਨੂੰ ਉਹ ਰੱਬ ਦੀ ਰਹਿਮਤ ਦਾ) ਨਿਸ਼ਾਨ ਸਮਝਦਾ ਹੈ।","transliteration":""},{"id":"MB8C","lineNo":11,"gurmukhi":"ਗਾਵੈ ਕੋ ਗੁਣ ਵਡਿਆਈਆ ਚਾਰ ॥","translationEnglish":"Some sing of His Glorious Virtues, Greatness and Beauty.","translationPunjabi":"ਕੋਈ ਮਨੁੱਖ ਰੱਬ ਦੇ ਸੋਹਣੇ ਗੁਣ ਤੇ ਸੋਹਣੀਆਂ ਵਡਿਆਈਆਂ ਵਰਣਨ ਕਰਦਾ ਹੈ।","transliteration":""},{"id":"C5NR","lineNo":11,"gurmukhi":"ਗਾਵੈ ਕੋ ਵਿਦਿਆ ਵਿਖਮੁ ਵੀਚਾਰੁ ॥","translationEnglish":"Some sing of knowledge obtained of Him, through difficult philosophical studies.","translationPunjabi":"ਕੋਈ ਮਨੁੱਖ ਵਿੱਦਿਆ ਦੇ ਬਲ ਨਾਲ ਅਕਾਲ ਪੁਰਖ ਦੇ ਕਠਨ ਗਿਆਨ ਨੂੰ ਗਾਉਂਦਾ ਹੈ (ਭਾਵ, ਸ਼ਾਸਤਰ ਆਦਿਕ ਦੁਆਰਾ ਆਤਮਕ ਫ਼ਿਲਾਸਫ਼ੀ ਦੇ ਔਖੇ ਵਿਸ਼ਿਆਂ ''ਤੇ ਵਿਚਾਰ ਕਰਦਾ ਹੈ)।","transliteration":""},{"id":"HZSG","lineNo":12,"gurmukhi":"ਗਾਵੈ ਕੋ ਸਾਜਿ ਕਰੇ ਤਨੁ ਖੇਹ ॥","translationEnglish":"Some sing that He fashions the body, and then again reduces it to dust.","translationPunjabi":"ਕੋਈ ਮਨੁੱਖ ਇਉਂ ਗਾਉਂਦਾ ਹੈ, ''ਅਕਾਲ ਪੁਰਖ ਸਰੀਰ ਨੂੰ ਬਣਾ ਕੇ (ਫਿਰ) ਸੁਆਹ ਕਰ ਦੇਂਦਾ ਹੈ''।","transliteration":""},{"id":"13CH","lineNo":12,"gurmukhi":"ਗਾਵੈ ਕੋ ਜੀਅ ਲੈ ਫਿਰਿ ਦੇਹ ॥","translationEnglish":"Some sing that He takes life away, and then again restores it.","translationPunjabi":"ਕੋਈ ਇਉਂ ਗਾਉਂਦਾ ਹੈ, ''ਹਰੀ (ਸਰੀਰਾਂ ਵਿਚੋਂ) ਜਿੰਦਾਂ ਕੱਢ ਕੇ ਫਿਰ (ਦੂਜੇ ਸਰੀਰਾਂ ਵਿਚ) ਪਾ ਦੇਂਦਾ ਹੈ''।","transliteration":""},{"id":"4SBX","lineNo":12,"gurmukhi":"ਗਾਵੈ ਕੋ ਜਾਪੈ ਦਿਸੈ ਦੂਰਿ ॥","translationEnglish":"Some sing that He seems so very far away.","translationPunjabi":"ਕੋਈ ਮਨੁੱਖ ਆਖਦਾ ਹੈ, ''ਅਕਾਲ ਪੁਰਖ ਦੂਰ ਜਾਪਦਾ ਹੈ, ਦੂਰ ਦਿੱਸਦਾ ਹੈ'';","transliteration":""}]}}'::jsonb, NOW()) ON CONFLICT (resource) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
INSERT INTO app_singletons (resource, payload, updated_at) VALUES ('hukamnama_ssm_hukamnama_settings', '{"ang":1,"source":"Sri Guru Granth Sahib Ji","metadata":{"source":"Sri Guru Granth Sahib Ji","sourcePunjabi":"ਸ਼੍ਰੀ ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ ਜੀ","raag":"Jap","writer":"Guru Nanak Dev Ji","totalLines":23,"pageName":"Ang"},"lines":[{"id":"0NVY","lineNo":1,"gurmukhi":"ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ ॥","translationEnglish":"One Universal Creator God. The Name Is Truth. Creative Being Personified. No Fear. No Hatred. Image Of The Undying, Beyond Birth, Self-Existent. By Guru''s Grace ~","translationPunjabi":"ਅਕਾਲ ਪੁਰਖ ਇੱਕ ਹੈ, ਜਿਸ ਦਾ ਨਾਮ ''ਹੋਂਦ ਵਾਲਾ'' ਹੈ ਜੋ ਸ੍ਰਿਸ਼ਟੀ ਦਾ ਰਚਨਹਾਰ ਹੈ, ਜੋ ਸਭ ਵਿਚ ਵਿਆਪਕ ਹੈ, ਭੈ ਤੋਂ ਰਹਿਤ ਹੈ, ਵੈਰ-ਰਹਿਤ ਹੈ, ਜਿਸ ਦਾ ਸਰੂਪ ਕਾਲ ਤੋਂ ਪਰੇ ਹੈ, (ਭਾਵ, ਜਿਸ ਦਾ ਸਰੀਰ ਨਾਸ-ਰਹਿਤ ਹੈ), ਜੋ ਜੂਨਾਂ ਵਿਚ ਨਹੀਂ ਆਉਂਦਾ, ਜਿਸ ਦਾ ਪ੍ਰਕਾਸ਼ ਆਪਣੇ ਆਪ ਤੋਂ ਹੋਇਆ ਹੈ ਅਤੇ ਜੋ ਸਤਿਗੁਰੂ ਦੀ ਕਿਰਪਾ ਨਾਲ ਮਿਲਦਾ ਹੈ।","transliteration":""},{"id":"RBP6","lineNo":3,"gurmukhi":"॥ ਜਪੁ ॥","translationEnglish":"Chant And Meditate:","translationPunjabi":"''ਜਪੁ'' ਬਾਣੀ ਦਾ ਨਾਮ ਹੈ।","transliteration":""},{"id":"J92N","lineNo":4,"gurmukhi":"ਆਦਿ ਸਚੁ ਜੁਗਾਦਿ ਸਚੁ ॥","translationEnglish":"True In The Primal Beginning. True Throughout The Ages.","translationPunjabi":"ਅਕਾਲ ਪੁਰਖ ਮੁੱਢ ਤੋਂ ਹੋਂਦ ਵਾਲਾ ਹੈ, ਜੁਗਾਂ ਦੇ ਮੁੱਢ ਤੋਂ ਮੌਜੂਦ ਹੈ।","transliteration":""},{"id":"K0U6","lineNo":4,"gurmukhi":"ਹੈ ਭੀ ਸਚੁ ਨਾਨਕ ਹੋਸੀ ਭੀ ਸਚੁ ॥੧॥","translationEnglish":"True Here And Now. O Nanak, Forever And Ever True. ||1||","translationPunjabi":"ਹੇ ਨਾਨਕ! ਇਸ ਵੇਲੇ ਭੀ ਮੌਜੂਦ ਹੈ ਤੇ ਅਗਾਂਹ ਨੂੰ ਭੀ ਹੋਂਦ ਵਾਲਾ ਰਹੇਗਾ ॥੧॥","transliteration":""},{"id":"BL70","lineNo":5,"gurmukhi":"ਸੋਚੈ ਸੋਚਿ ਨ ਹੋਵਈ ਜੇ ਸੋਚੀ ਲਖ ਵਾਰ ॥","translationEnglish":"By thinking, He cannot be reduced to thought, even by thinking hundreds of thousands of times.","translationPunjabi":"ਜੇ ਮੈਂ ਲੱਖ ਵਾਰੀ (ਭੀ) (ਇਸ਼ਨਾਨ ਆਦਿਕ ਨਾਲ ਸਰੀਰ ਦੀ) ਸੁੱਚ ਰੱਖਾਂ, (ਤਾਂ ਭੀ ਇਸ ਤਰ੍ਹਾਂ) ਸੁੱਚ ਰੱਖਣ ਨਾਲ (ਮਨ ਦੀ) ਸੁੱਚ ਨਹੀਂ ਰਹਿ ਸਕਦੀ।","transliteration":""},{"id":"GJW9","lineNo":5,"gurmukhi":"ਚੁਪੈ ਚੁਪ ਨ ਹੋਵਈ ਜੇ ਲਾਇ ਰਹਾ ਲਿਵ ਤਾਰ ॥","translationEnglish":"By remaining silent, inner silence is not obtained, even by remaining lovingly absorbed deep within.","translationPunjabi":"ਜੇ ਮੈਂ (ਸਰੀਰ ਦੀ) ਇਕ-ਤਾਰ ਸਮਾਧੀ ਲਾਈ ਰੱਖਾਂ; (ਤਾਂ ਭੀ ਇਸ ਤਰ੍ਹਾਂ) ਚੁੱਪ ਕਰ ਰਹਿਣ ਨਾਲ ਮਨ ਦੀ ਸ਼ਾਂਤੀ ਨਹੀਂ ਹੋ ਸਕਦੀ।","transliteration":""},{"id":"ZERL","lineNo":5,"gurmukhi":"ਭੁਖਿਆ ਭੁਖ ਨ ਉਤਰੀ ਜੇ ਬੰਨਾ ਪੁਰੀਆ ਭਾਰ ॥","translationEnglish":"The hunger of the hungry is not appeased, even by piling up loads of worldly goods.","translationPunjabi":"ਜੇ ਮੈਂ ਸਾਰੇ ਭਵਣਾਂ ਦੇ ਪਦਾਰਥਾਂ ਦੇ ਢੇਰ (ਭੀ) ਸਾਂਭ ਲਵਾਂ, ਤਾਂ ਭੀ ਤ੍ਰਿਸ਼ਨਾ ਦੇ ਅਧੀਨ ਰਿਹਾਂ ਤ੍ਰਿਸ਼ਨਾ ਦੂਰ ਨਹੀਂ ਹੋ ਸਕਦੀ।","transliteration":""},{"id":"9MN2","lineNo":6,"gurmukhi":"ਸਹਸ ਸਿਆਣਪਾ ਲਖ ਹੋਹਿ ਤ ਇਕ ਨ ਚਲੈ ਨਾਲਿ ॥","translationEnglish":"Hundreds of thousands of clever tricks, but not even one of them will go along with you in the end.","translationPunjabi":"ਜੇ (ਮੇਰੇ ਵਿਚ) ਹਜ਼ਾਰਾਂ ਤੇ ਲੱਖਾਂ ਚਤੁਰਾਈਆਂ ਹੋਵਣ, (ਤਾਂ ਭੀ ਉਹਨਾਂ ਵਿਚੋਂ) ਇਕ ਭੀ ਚਤੁਰਾਈ ਸਾਥ ਨਹੀਂ ਦੇਂਦੀ।","transliteration":""},{"id":"MK1Q","lineNo":6,"gurmukhi":"ਕਿਵ ਸਚਿਆਰਾ ਹੋਈਐ ਕਿਵ ਕੂੜੈ ਤੁਟੈ ਪਾਲਿ ॥","translationEnglish":"So how can you become truthful? And how can the veil of illusion be torn away?","translationPunjabi":"(ਤਾਂ ਫਿਰ) ਅਕਾਲ ਪੁਰਖ ਦਾ ਪਰਕਾਸ਼ ਹੋਣ ਲਈ ਯੋਗ ਕਿਵੇਂ ਬਣ ਸਕੀਦਾ ਹੈ (ਅਤੇ ਸਾਡੇ ਅੰਦਰ ਦਾ) ਕੂੜ ਦਾ ਪਰਦਾ ਕਿਵੇਂ ਟੁੱਟ ਸਕਦਾ ਹੈ?","transliteration":""},{"id":"H0PC","lineNo":7,"gurmukhi":"ਹੁਕਮਿ ਰਜਾਈ ਚਲਣਾ ਨਾਨਕ ਲਿਖਿਆ ਨਾਲਿ ॥੧॥","translationEnglish":"O Nanak, it is written that you shall obey the Hukam of His Command, and walk in the Way of His Will. ||1||","translationPunjabi":"ਰਜ਼ਾ ਦੇ ਮਾਲਕ ਅਕਾਲ ਪੁਰਖ ਦੇ ਹੁਕਮ ਵਿਚ ਤੁਰਨਾ-(ਇਹੀ ਇਕ ਵਿਧੀ ਹੈ)। ਹੇ ਨਾਨਕ! (ਇਹ ਵਿਧੀ) ਧੁਰ ਤੋਂ ਹੀ ਜਦ ਤੋਂ ਜਗਤ ਬਣਿਆ ਹੈ, ਲਿਖੀ ਚਲੀ ਆ ਰਹੀ ਹੈ ॥੧॥","transliteration":""},{"id":"60LK","lineNo":7,"gurmukhi":"ਹੁਕਮੀ ਹੋਵਨਿ ਆਕਾਰ ਹੁਕਮੁ ਨ ਕਹਿਆ ਜਾਈ ॥","translationEnglish":"By His Command, bodies are created; His Command cannot be described.","translationPunjabi":"ਅਕਾਲ ਪੁਰਖ ਦੇ ਹੁਕਮ ਅਨੁਸਾਰ ਸਾਰੇ ਸਰੀਰ ਬਣਦੇ ਹਨ, (ਪਰ ਇਹ) ਹੁਕਮ ਦੱਸਿਆ ਨਹੀਂ ਜਾ ਸਕਦਾ ਕਿ ਕਿਹੋ ਜਿਹਾ ਹੈ।","transliteration":""},{"id":"UVSL","lineNo":8,"gurmukhi":"ਹੁਕਮੀ ਹੋਵਨਿ ਜੀਅ ਹੁਕਮਿ ਮਿਲੈ ਵਡਿਆਈ ॥","translationEnglish":"By His Command, souls come into being; by His Command, glory and greatness are obtained.","translationPunjabi":"ਰੱਬ ਦੇ ਹੁਕਮ ਅਨੁਸਾਰ ਹੀ ਸਾਰੇ ਜੀਵ ਜੰਮ ਪੈਂਦੇ ਹਨ ਅਤੇ ਹੁਕਮ ਅਨੁਸਾਰ ਹੀ (ਰੱਬ ਦੇ ਦਰ ''ਤੇ) ਸ਼ੋਭਾ ਮਿਲਦੀ ਹੈ।","transliteration":""},{"id":"GLXS","lineNo":8,"gurmukhi":"ਹੁਕਮੀ ਉਤਮੁ ਨੀਚੁ ਹੁਕਮਿ ਲਿਖਿ ਦੁਖ ਸੁਖ ਪਾਈਅਹਿ ॥","translationEnglish":"By His Command, some are high and some are low; by His Written Command, pain and pleasure are obtained.","translationPunjabi":"ਰੱਬ ਦੇ ਹੁਕਮ ਵਿਚ ਕੋਈ ਮਨੁੱਖ ਚੰਗਾ (ਬਣ ਜਾਂਦਾ) ਹੈ, ਕੋਈ ਭੈੜਾ। ਉਸ ਦੇ ਹੁਕਮ ਵਿਚ ਹੀ (ਆਪਣੇ ਕੀਤੇ ਹੋਏ ਕਰਮਾਂ ਦੇ) ਲਿਖੇ ਅਨੁਸਾਰ ਦੁੱਖ ਤੇ ਸੁਖ ਭੋਗੀਦੇ ਹਨ।","transliteration":""},{"id":"P2VG","lineNo":9,"gurmukhi":"ਇਕਨਾ ਹੁਕਮੀ ਬਖਸੀਸ ਇਕਿ ਹੁਕਮੀ ਸਦਾ ਭਵਾਈਅਹਿ ॥","translationEnglish":"Some, by His Command, are blessed and forgiven; others, by His Command, wander aimlessly forever.","translationPunjabi":"ਹੁਕਮ ਵਿਚ ਹੀ ਕਦੀ ਮਨੁੱਖਾਂ ਉੱਤੇ (ਅਕਾਲ ਪੁਰਖ ਦੇ ਦਰ ਤੋਂ) ਬਖ਼ਸ਼ਸ਼ ਹੁੰਦੀ ਹੈ, ਅਤੇ ਉਸ ਦੇ ਹੁਕਮ ਵਿਚ ਹੀ ਕਈ ਮਨੁੱਖ ਨਿੱਤ ਜਨਮ ਮਰਨ ਦੇ ਗੇੜ ਵਿਚ ਭਵਾਈਦੇ ਹਨ।","transliteration":""},{"id":"MX4P","lineNo":9,"gurmukhi":"ਹੁਕਮੈ ਅੰਦਰਿ ਸਭੁ ਕੋ ਬਾਹਰਿ ਹੁਕਮ ਨ ਕੋਇ ॥","translationEnglish":"Everyone is subject to His Command; no one is beyond His Command.","translationPunjabi":"ਹਰੇਕ ਜੀਵ ਰੱਬ ਦੇ ਹੁਕਮ ਵਿਚ ਹੀ ਹੈ, ਕੋਈ ਜੀਵ ਹੁਕਮ ਤੋਂ ਬਾਹਰ (ਭਾਵ, ਹੁਕਮ ਤੋ ਆਕੀ) ਨਹੀਂ ਹੋ ਸਕਦਾ।","transliteration":""},{"id":"FKUU","lineNo":10,"gurmukhi":"ਨਾਨਕ ਹੁਕਮੈ ਜੇ ਬੁਝੈ ਤ ਹਉਮੈ ਕਹੈ ਨ ਕੋਇ ॥੨॥","translationEnglish":"O Nanak, one who understands His Command, does not speak in ego. ||2||","translationPunjabi":"ਹੇ ਨਾਨਕ! ਜੇ ਕੋਈ ਮਨੁੱਖ ਅਕਾਲ ਪੁਰਖ ਦੇ ਹੁਕਮ ਨੂੰ ਸਮਝ ਲਏ ਤਾਂ ਫਿਰ ਉਹ ਸੁਆਰਥ ਦੀਆਂ ਗੱਲਾਂ ਨਹੀਂ ਕਰਦਾ (ਭਾਵ, ਫਿਰ ਉਹ ਸੁਆਰਥੀ ਜੀਵਨ ਛੱਡ ਦੇਂਦਾ ਹੈ) ॥੨॥","transliteration":""},{"id":"VUQD","lineNo":10,"gurmukhi":"ਗਾਵੈ ਕੋ ਤਾਣੁ ਹੋਵੈ ਕਿਸੈ ਤਾਣੁ ॥","translationEnglish":"Some sing of His Power-who has that Power?","translationPunjabi":"ਜਿਸ ਕਿਸੇ ਮਨੁੱਖ ਨੂੰ ਸਮਰਥਾ ਹੁੰਦੀ ਹੈ, ਉਹ ਰੱਬ ਦੇ ਤਾਣ ਨੂੰ ਗਾਉਂਦਾ ਹੈ, (ਭਾਵ, ਉਸ ਦੀ ਸਿਫ਼ਤ-ਸਾਲਾਹ ਕਰਦਾ ਹੈ ਤੇ ਉਸ ਦੇ ਉਹ ਕੰਮ ਕਥਨ ਕਰਦਾ ਹੈ, ਜਿਨ੍ਹਾਂ ਤੋਂ ਉਸ ਦੀ ਵੱਡੀ ਤਾਕਤ ਪਰਗਟ ਹੋਵੇ)।","transliteration":""},{"id":"7AC7","lineNo":11,"gurmukhi":"ਗਾਵੈ ਕੋ ਦਾਤਿ ਜਾਣੈ ਨੀਸਾਣੁ ॥","translationEnglish":"Some sing of His Gifts, and know His Sign and Insignia.","translationPunjabi":"ਕੋਈ ਮਨੁੱਖ ਉਸ ਦੀਆਂ ਦਾਤਾਂ ਨੂੰ ਹੀ ਗਾਉਂਦਾ ਹੈ, (ਕਿਉਂਕਿ ਇਹਨਾਂ ਦਾਤਾਂ ਨੂੰ ਉਹ ਰੱਬ ਦੀ ਰਹਿਮਤ ਦਾ) ਨਿਸ਼ਾਨ ਸਮਝਦਾ ਹੈ।","transliteration":""},{"id":"MB8C","lineNo":11,"gurmukhi":"ਗਾਵੈ ਕੋ ਗੁਣ ਵਡਿਆਈਆ ਚਾਰ ॥","translationEnglish":"Some sing of His Glorious Virtues, Greatness and Beauty.","translationPunjabi":"ਕੋਈ ਮਨੁੱਖ ਰੱਬ ਦੇ ਸੋਹਣੇ ਗੁਣ ਤੇ ਸੋਹਣੀਆਂ ਵਡਿਆਈਆਂ ਵਰਣਨ ਕਰਦਾ ਹੈ।","transliteration":""},{"id":"C5NR","lineNo":11,"gurmukhi":"ਗਾਵੈ ਕੋ ਵਿਦਿਆ ਵਿਖਮੁ ਵੀਚਾਰੁ ॥","translationEnglish":"Some sing of knowledge obtained of Him, through difficult philosophical studies.","translationPunjabi":"ਕੋਈ ਮਨੁੱਖ ਵਿੱਦਿਆ ਦੇ ਬਲ ਨਾਲ ਅਕਾਲ ਪੁਰਖ ਦੇ ਕਠਨ ਗਿਆਨ ਨੂੰ ਗਾਉਂਦਾ ਹੈ (ਭਾਵ, ਸ਼ਾਸਤਰ ਆਦਿਕ ਦੁਆਰਾ ਆਤਮਕ ਫ਼ਿਲਾਸਫ਼ੀ ਦੇ ਔਖੇ ਵਿਸ਼ਿਆਂ ''ਤੇ ਵਿਚਾਰ ਕਰਦਾ ਹੈ)।","transliteration":""},{"id":"HZSG","lineNo":12,"gurmukhi":"ਗਾਵੈ ਕੋ ਸਾਜਿ ਕਰੇ ਤਨੁ ਖੇਹ ॥","translationEnglish":"Some sing that He fashions the body, and then again reduces it to dust.","translationPunjabi":"ਕੋਈ ਮਨੁੱਖ ਇਉਂ ਗਾਉਂਦਾ ਹੈ, ''ਅਕਾਲ ਪੁਰਖ ਸਰੀਰ ਨੂੰ ਬਣਾ ਕੇ (ਫਿਰ) ਸੁਆਹ ਕਰ ਦੇਂਦਾ ਹੈ''।","transliteration":""},{"id":"13CH","lineNo":12,"gurmukhi":"ਗਾਵੈ ਕੋ ਜੀਅ ਲੈ ਫਿਰਿ ਦੇਹ ॥","translationEnglish":"Some sing that He takes life away, and then again restores it.","translationPunjabi":"ਕੋਈ ਇਉਂ ਗਾਉਂਦਾ ਹੈ, ''ਹਰੀ (ਸਰੀਰਾਂ ਵਿਚੋਂ) ਜਿੰਦਾਂ ਕੱਢ ਕੇ ਫਿਰ (ਦੂਜੇ ਸਰੀਰਾਂ ਵਿਚ) ਪਾ ਦੇਂਦਾ ਹੈ''।","transliteration":""},{"id":"4SBX","lineNo":12,"gurmukhi":"ਗਾਵੈ ਕੋ ਜਾਪੈ ਦਿਸੈ ਦੂਰਿ ॥","translationEnglish":"Some sing that He seems so very far away.","translationPunjabi":"ਕੋਈ ਮਨੁੱਖ ਆਖਦਾ ਹੈ, ''ਅਕਾਲ ਪੁਰਖ ਦੂਰ ਜਾਪਦਾ ਹੈ, ਦੂਰ ਦਿੱਸਦਾ ਹੈ'';","transliteration":""}],"audioUrl":"https://hs.sgpc.net/uploadhukamnama/hukamnama.mp3","updatedAt":"2026-07-07T00:00:00.000Z"}'::jsonb, NOW()) ON CONFLICT (resource) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();

-- =========================
-- Seed: app_items + mirrored table rows
-- =========================

INSERT INTO app_items (resource, id, payload, created_at, updated_at) VALUES ('streaming_configs', 'stream-1', '{"id":"stream-1","title":"Live Streaming","text":"YouTube live stream for sangat","streamUrl":"https://www.youtube.com/@SinghSabhaMilton","active":true,"updatedAt":"2026-07-10T18:49:41.986Z","checkedAt":"2026-07-10T18:49:41.986Z"}'::jsonb, NOW(), NOW()) ON CONFLICT (resource, id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
INSERT INTO streaming_configs (id, title, text, stream_url, active, checked_at, updated_at) VALUES ('stream-1', 'Live Streaming', 'YouTube live stream for sangat', 'https://www.youtube.com/@SinghSabhaMilton', TRUE, '2026-07-10T18:49:41.986Z', '2026-07-10T18:49:41.986Z'::timestamptz) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, text = EXCLUDED.text, stream_url = EXCLUDED.stream_url, active = EXCLUDED.active, checked_at = EXCLUDED.checked_at, updated_at = NOW();

INSERT INTO app_items (resource, id, payload, created_at, updated_at) VALUES ('videos', 'vid-2', '{"id":"vid-2","title":"Youth Kirtan Darbar - June 2026","description":"Youth sangat performing shabad kirtan at the monthly youth program.","videoUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","platform":"youtube","category":"Youth","thumbnailUrl":"","featuredDate":"2026-06-15","featured":false,"tags":"youth, kirtan","updatedAt":"2026-07-10T19:28:26.017Z"}'::jsonb, NOW(), NOW()) ON CONFLICT (resource, id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
INSERT INTO videos (id, title, description, video_url, platform, category, thumbnail_url, featured_date, featured, tags, updated_at) VALUES ('vid-2', 'Youth Kirtan Darbar - June 2026', 'Youth sangat performing shabad kirtan at the monthly youth program.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'Youth', '', '2026-06-15', FALSE, 'youth, kirtan', '2026-07-10T19:28:26.017Z'::timestamptz) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, video_url = EXCLUDED.video_url, platform = EXCLUDED.platform, category = EXCLUDED.category, thumbnail_url = EXCLUDED.thumbnail_url, featured_date = EXCLUDED.featured_date, featured = EXCLUDED.featured, tags = EXCLUDED.tags, updated_at = NOW();

INSERT INTO app_items (resource, id, payload, created_at, updated_at) VALUES ('videos', 'vid-1', '{"id":"vid-1","title":"Sunday Samagam - July 6, 2026","description":"Full recording of Sukhmani Sahib Paath, Kirtan, Katha, and Ardaas from the Sunday diwan.","videoUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","platform":"youtube","category":"Samagam","thumbnailUrl":"","featuredDate":"2026-07-06","featured":true,"tags":"samagam, sunday, kirtan","updatedAt":"2026-07-10T19:28:26.017Z"}'::jsonb, NOW(), NOW()) ON CONFLICT (resource, id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
INSERT INTO videos (id, title, description, video_url, platform, category, thumbnail_url, featured_date, featured, tags, updated_at) VALUES ('vid-1', 'Sunday Samagam - July 6, 2026', 'Full recording of Sukhmani Sahib Paath, Kirtan, Katha, and Ardaas from the Sunday diwan.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'Samagam', '', '2026-07-06', TRUE, 'samagam, sunday, kirtan', '2026-07-10T19:28:26.017Z'::timestamptz) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, video_url = EXCLUDED.video_url, platform = EXCLUDED.platform, category = EXCLUDED.category, thumbnail_url = EXCLUDED.thumbnail_url, featured_date = EXCLUDED.featured_date, featured = EXCLUDED.featured, tags = EXCLUDED.tags, updated_at = NOW();

COMMIT;
