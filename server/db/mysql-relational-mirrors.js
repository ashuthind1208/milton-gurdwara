const toDateValue = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const toDatabaseValue = (value) => {
  if (value == null || value instanceof Date || Buffer.isBuffer(value)) return value;
  return typeof value === 'object' ? JSON.stringify(value) : value;
};

const upsertRow = async (db, table, row, keyColumns = ['id']) => {
  const columns = Object.keys(row);
  const identifiers = columns.map((column) => `\`${column}\``).join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const updates = columns
    .filter((column) => !keyColumns.includes(column))
    .map((column) => `\`${column}\` = VALUES(\`${column}\`)`)
    .join(', ');
  await db.execute(
    `INSERT INTO \`${table}\` (${identifiers}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`,
    columns.map((column) => toDatabaseValue(row[column]))
  );
};

const existingIdOrNull = async (db, table, id) => {
  if (!id) return null;
  const [rows] = await db.execute(`SELECT id FROM \`${table}\` WHERE id = ? LIMIT 1`, [id]);
  return rows.length > 0 ? id : null;
};

const mirrorItemResource = async (db, resource, payload = {}) => {
  const item = payload || {};
  if (resource === 'users') {
    await upsertRow(db, 'admin_users', {
      id: item.id,
      name: item.name || '',
      email: String(item.email || '').toLowerCase(),
      role: item.role || 'Member',
      member_type: item.memberType || 'Member',
      phone: item.phone || '',
      address: item.address || '',
      auth_provider: item.authProvider || 'LOCAL',
      avatar_url: item.avatarUrl || '',
      registration_complete: Boolean(item.registrationComplete),
      is_active: item.isActive !== false,
      approval_status: item.approvalStatus || 'pending',
      approval_updated_at: item.approvalUpdatedAt ? new Date(item.approvalUpdatedAt) : null,
      created_at: item.createdAt ? new Date(item.createdAt) : new Date(),
      updated_at: item.updatedAt ? new Date(item.updatedAt) : new Date()
    });
    return true;
  }
  if (resource === 'advertisements') {
    await upsertRow(db, 'advertisements', {
      id: item.id, title: item.title || '', content: item.content || '', website: item.website || '',
      image_url: item.imageUrl || '', banner_url: item.bannerUrl || '', target_link: item.targetLink || '',
      placement: item.placement || 'Homepage Sidebar', active: item.active !== false,
      updated_at: item.updatedAt ? new Date(item.updatedAt) : new Date()
    });
    return true;
  }
  if (resource === 'news_articles') {
    await upsertRow(db, 'news_articles', {
      id: item.id, heading: item.heading || item.title || '', content: item.content || '',
      links: Array.isArray(item.links) ? item.links : [], image_links: Array.isArray(item.imageLinks) ? item.imageLinks : [],
      published_at: toDateValue(item.publishedAt), expiry_date: toDateValue(item.expiryDate),
      active: item.active !== false, updated_at: item.updatedAt ? new Date(item.updatedAt) : new Date()
    });
    return true;
  }
  if (resource === 'gallery_albums') {
    await upsertRow(db, 'gallery_albums', {
      id: item.id, title: item.title || '', description: item.description || '', cover_url: item.coverUrl || '',
      event_date: toDateValue(item.eventDate), created_at: item.createdAt ? new Date(item.createdAt) : new Date(),
      updated_at: item.updatedAt ? new Date(item.updatedAt) : new Date()
    });
    await db.execute('DELETE FROM gallery_images WHERE album_id = ?', [item.id]);
    for (const image of Array.isArray(item.images) ? item.images : []) {
      await upsertRow(db, 'gallery_images', {
        id: image.id, album_id: item.id, title: image.title || '', caption: image.caption || '', url: image.url || '',
        created_at: image.createdAt ? new Date(image.createdAt) : new Date()
      });
    }
    return true;
  }
  if (resource === 'videos') {
    await upsertRow(db, 'videos', {
      id: item.id, title: item.title || '', description: item.description || '', video_url: item.videoUrl || '',
      platform: item.platform || 'other', category: item.category || 'General', thumbnail_url: item.thumbnailUrl || '',
      featured_date: toDateValue(item.featuredDate), featured: Boolean(item.featured), tags: item.tags || '',
      updated_at: item.updatedAt ? new Date(item.updatedAt) : new Date()
    });
    return true;
  }
  if (resource === 'streaming_configs') {
    await upsertRow(db, 'streaming_configs', {
      id: item.id, title: item.title || '', text: item.text || '', stream_url: item.streamUrl || '',
      active: Boolean(item.active), checked_at: item.checkedAt ? new Date(item.checkedAt) : null,
      updated_at: item.updatedAt ? new Date(item.updatedAt) : new Date()
    });
    return true;
  }
  if (resource === 'subscribers') {
    await upsertRow(db, 'subscribers', {
      id: item.id, name: item.name || '', email: String(item.email || '').toLowerCase(),
      interests: item.interests || 'Events and updates', source: item.source || 'Website',
      active: item.active !== false, created_at: item.createdAt ? new Date(item.createdAt) : new Date()
    });
    return true;
  }
  if (resource === 'seva_opportunities') {
    await upsertRow(db, 'seva_opportunities', {
      id: item.id, seva_type: item.sevaType || '', seva_date: toDateValue(item.date), seva_time: item.time || '',
      total_volunteers_required: Math.max(1, Number(item.totalVolunteersRequired) || 1),
      waitlist_enabled: item.waitlistEnabled !== false, expiry_date: toDateValue(item.expiryDate),
      active: item.active !== false, updated_at: item.updatedAt ? new Date(item.updatedAt) : new Date()
    });
    return true;
  }
  if (resource === 'volunteer_registrations') {
    const userId = await existingIdOrNull(db, 'admin_users', item.userId);
    const opportunityId = await existingIdOrNull(db, 'seva_opportunities', item.opportunityId);
    await upsertRow(db, 'volunteer_registrations', {
      id: item.id, user_id: userId, opportunity_id: opportunityId,
      name: item.name || '', email: item.email || '', phone: item.phone || '', whatsapp: item.whatsapp || '',
      area: item.area || '', seva_type: item.sevaType || '', seva_date: toDateValue(item.sevaDate || item.date),
      seva_time: item.sevaTime || '', contact_preference: item.contactPreference || 'Email',
      wants_event_emails: Boolean(item.wantsEventEmails), notes: item.notes || '', status: item.status || 'Pending',
      created_at: item.createdAt ? new Date(item.createdAt) : new Date()
    });
    return true;
  }
  if (resource === 'donation_records' || resource === 'donations') {
    const userId = await existingIdOrNull(db, 'admin_users', item.userId);
    await upsertRow(db, 'donation_records', {
      id: item.id, user_id: userId, donor_name: item.donorName || item.name || '',
      donor_email: String(item.donorEmail || item.email || '').toLowerCase(), amount: Number(item.amount || 0),
      currency: item.currency || 'cad', purpose: item.purpose || '', payment_status: item.paymentStatus || item.status || 'pending',
      payment_provider: item.paymentProvider || 'stripe', payment_reference: item.paymentReference || item.reference || '',
      donated_at: item.donatedAt ? new Date(item.donatedAt) : null,
      created_at: item.createdAt ? new Date(item.createdAt) : new Date(),
      updated_at: item.updatedAt ? new Date(item.updatedAt) : new Date()
    });
    return true;
  }
  if (resource === 'analytics_daily_metrics' || resource === 'analytics') {
    await upsertRow(db, 'analytics_daily_metrics', {
      metric_date: toDateValue(item.metricDate || item.date || new Date()), total_visits: Number(item.totalVisits || 0),
      unique_visitors: Number(item.uniqueVisitors || 0), event_registrations: Number(item.eventRegistrations || 0),
      seva_registrations: Number(item.sevaRegistrations || 0), donations_count: Number(item.donationsCount || 0),
      donations_amount: Number(item.donationsAmount || 0),
      created_at: item.createdAt ? new Date(item.createdAt) : new Date(),
      updated_at: item.updatedAt ? new Date(item.updatedAt) : new Date()
    }, ['metric_date']);
    return true;
  }
  return false;
};

const deleteItemMirror = async (db, resource, id) => {
  const tableMap = {
    users: 'admin_users', advertisements: 'advertisements', news_articles: 'news_articles',
    gallery_albums: 'gallery_albums', videos: 'videos', streaming_configs: 'streaming_configs',
    subscribers: 'subscribers', seva_opportunities: 'seva_opportunities',
    volunteer_registrations: 'volunteer_registrations', donations: 'donation_records', donation_records: 'donation_records'
  };
  const table = tableMap[resource];
  if (!table) return false;
  await db.execute(`DELETE FROM \`${table}\` WHERE id = ?`, [String(id || '').trim()]);
  return true;
};

const mirrorSingletonResource = async (db, resource, payload = {}) => {
  const value = payload || {};
  if (resource === 'cms_home_content') {
    await db.query('DELETE FROM cms_hero_slides');
    for (const slide of Array.isArray(value.hero?.slides) ? value.hero.slides : []) {
      await upsertRow(db, 'cms_hero_slides', {
        id: slide.id, slide_order: Number(slide.order || 1), image: slide.image || '', eyebrow: slide.eyebrow || '',
        title: slide.title || '', description: slide.description || '', primary_cta_label: slide.primaryCtaLabel || '',
        primary_cta_path: slide.primaryCtaPath || '', secondary_cta_label: slide.secondaryCtaLabel || '',
        secondary_cta_path: slide.secondaryCtaPath || '', content_link_label: slide.contentLinkLabel || '',
        content_link_path: slide.contentLinkPath || '', content_link_two_label: slide.contentLinkTwoLabel || '',
        content_link_two_path: slide.contentLinkTwoPath || '', updated_at: slide.updatedAt ? new Date(slide.updatedAt) : new Date()
      });
    }
    await db.query('DELETE FROM schedule_entries');
    await db.query('DELETE FROM schedule_days');
    for (const day of Array.isArray(value.scheduleDays) ? value.scheduleDays : []) {
      await upsertRow(db, 'schedule_days', {
        id: day.id, date_key: day.dateKey || 'default', date_label: day.dateLabel || '', title: day.title || '',
        is_special: Boolean(day.isSpecial), highlight_title: day.highlightTitle || '',
        highlight_note_en: day.highlightNoteEn || '', highlight_note_pa: day.highlightNotePa || '', updated_at: new Date()
      });
      for (const entry of Array.isArray(day.entries) ? day.entries : []) {
        await upsertRow(db, 'schedule_entries', {
          id: entry.id, day_id: day.id, segment: entry.segment || 'morning', time_en: entry.timeEn || '',
          time_pa: entry.timePa || '', title_en: entry.titleEn || '', title_pa: entry.titlePa || '',
          note_en: entry.noteEn || '', note_pa: entry.notePa || '', is_highlighted: Boolean(entry.isHighlighted),
          is_active: entry.isActive !== false, sort_order: Number(entry.sortOrder || 1), updated_at: new Date()
        });
      }
    }
    await db.query('DELETE FROM langar_items');
    for (const item of Array.isArray(value.langarItems) ? value.langarItems : []) {
      await upsertRow(db, 'langar_items', {
        id: item.id, name: item.name || '', category: item.category || 'Grocery', added_on: toDateValue(item.addedOn),
        expiry_date: toDateValue(item.expiryDate), needed: item.needed !== false, updated_at: new Date()
      });
    }
    return true;
  }
  if (resource === 'cms_page_content') {
    await db.query('DELETE FROM cms_page_sections');
    await db.query('DELETE FROM cms_pages');
    for (const [slug, page] of Object.entries(value)) {
      const pageId = page.id || `page-${slug}`;
      await upsertRow(db, 'cms_pages', {
        id: pageId, slug, hero_title: page.heroTitle || '', hero_description: page.heroDescription || '',
        intro: page.intro || '', media_url: page.mediaUrl || '', phone: page.phone || '', email: page.email || '',
        address: page.address || '', map_embed_url: page.mapEmbedUrl || '', updated_at: new Date()
      });
      for (const section of Array.isArray(page.sections) ? page.sections : []) {
        await upsertRow(db, 'cms_page_sections', {
          id: section.id, page_id: pageId, title: section.title || '', body: section.body || '',
          media_url: section.mediaUrl || '', sort_order: Number(section.sortOrder || 1), updated_at: new Date()
        });
      }
    }
    return true;
  }
  if (resource === 'library_content') {
    await db.query('DELETE FROM library_issue_records');
    await db.query('DELETE FROM library_physical_books');
    for (const book of Array.isArray(value.physicalBooks) ? value.physicalBooks : []) {
      await upsertRow(db, 'library_physical_books', {
        id: book.id, title: book.title || '', author: book.author || '', category: book.category || 'General',
        isbn: book.isbn || '', total_copies: Number(book.totalCopies || 0), notes: book.notes || '',
        updated_at: book.updatedAt ? new Date(book.updatedAt) : new Date()
      });
      for (const issue of Array.isArray(book.issueRecords) ? book.issueRecords : []) {
        const userId = await existingIdOrNull(db, 'admin_users', issue.userId);
        await upsertRow(db, 'library_issue_records', {
          id: issue.id, book_id: book.id, user_id: userId, copy_number: Number(issue.copyNumber || 1),
          issuer_name: issue.issuerName || '', issuer_phone: issue.issuerPhone || '', issue_date: toDateValue(issue.issueDate),
          return_date: toDateValue(issue.returnDate), returned_at: toDateValue(issue.returnedAt), updated_at: new Date()
        });
      }
    }
    const collectionMap = [
      ['digitalResources', 'library_digital_resources', (item) => ({ id: item.id, title: item.title || '', file_type: item.fileType || 'PDF', description: item.description || '', download_url: item.downloadUrl || '', cover_image_url: item.coverImageUrl || '', tags: item.tags || '', updated_at: item.updatedAt ? new Date(item.updatedAt) : new Date() })],
      ['programUpdates', 'library_program_updates', (item) => ({ id: item.id, title: item.title || '', speaker: item.speaker || '', audience: item.audience || '', schedule_date: toDateValue(item.scheduleDate), schedule_time: item.scheduleTime || '', location: item.location || '', summary: item.summary || '', image_url: item.imageUrl || '', registration_url: item.registrationUrl || '', updated_at: item.updatedAt ? new Date(item.updatedAt) : new Date() })],
      ['mediaResources', 'library_media_resources', (item) => ({ id: item.id, title: item.title || '', media_type: item.mediaType || 'youtube', url: item.url || '', description: item.description || '', thumbnail_url: item.thumbnailUrl || '', tags: item.tags || '', updated_at: item.updatedAt ? new Date(item.updatedAt) : new Date() })]
    ];
    for (const [key, table, mapRow] of collectionMap) {
      await db.query(`DELETE FROM \`${table}\``);
      for (const item of Array.isArray(value[key]) ? value[key] : []) await upsertRow(db, table, mapRow(item));
    }
    return true;
  }
  if (resource === 'hukamnama_ssm_hukamnama_entries') {
    await db.query('DELETE FROM hukamnama_lines');
    await db.query('DELETE FROM hukamnama_entries');
    for (const [dateKey, slots] of Object.entries(value)) {
      for (const slotName of ['morning', 'evening']) {
        const entry = slots?.[slotName];
        if (!entry) continue;
        const entryId = entry.id || `hukamnama-${dateKey}-${slotName}`;
        await upsertRow(db, 'hukamnama_entries', {
          id: entryId, ang: Math.max(1, Number(entry.ang || 1)), entry_date: toDateValue(entry.date || dateKey),
          slot: entry.slot || slotName, source: entry.source || '', metadata: entry.metadata || {}, audio_url: entry.audioUrl || '',
          updated_at: entry.updatedAt ? new Date(entry.updatedAt) : new Date()
        });
        const lines = Array.isArray(entry.lines) ? entry.lines : [];
        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index] || {};
          await upsertRow(db, 'hukamnama_lines', {
            id: line.id || `${entryId}-line-${index + 1}`, entry_id: entryId, line_no: Number(line.lineNo || index + 1),
            gurmukhi: line.gurmukhi || '', translation_english: line.translationEnglish || '',
            translation_punjabi: line.translationPunjabi || '', transliteration: line.transliteration || ''
          });
        }
      }
    }
    return true;
  }
  return false;
};

module.exports = {
  deleteItemMirror,
  mirrorItemResource,
  mirrorSingletonResource
};