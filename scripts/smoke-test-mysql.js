const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((line) => {
    const trimmed = String(line || '').trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separator = trimmed.indexOf('=');
    if (separator < 1) return;
    const key = trimmed.slice(0, separator).trim();
    if (Object.prototype.hasOwnProperty.call(process.env, key)) return;
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  });
};

const workspaceRoot = path.resolve(__dirname, '..');
loadEnvFile(path.join(workspaceRoot, '.env'));
loadEnvFile(path.join(workspaceRoot, '.env.local'));

const db = require('../server/db/mysql');
const marker = `mysql-smoke-${Date.now()}`;
const itemId = `${marker}-news`;
const quizFile = `${marker}.json`;
const donationId = `${marker}-donation`;
const pendingId = `${marker}-pending`;
let eventId = null;
let campaignId = null;

const cleanup = async () => {
  if (!db.pool) return;
  await db.pool.execute('DELETE FROM donations WHERE id = ?', [donationId]);
  await db.pool.execute('DELETE FROM donation_pending WHERE id = ?', [pendingId]);
  if (campaignId != null) await db.pool.execute('DELETE FROM donation_campaigns WHERE id = ?', [campaignId]);
  if (eventId != null) await db.pool.execute('DELETE FROM events WHERE id = ?', [eventId]);
  await db.pool.execute('DELETE FROM quiz_bank_files WHERE file_name = ?', [quizFile]);
  await db.pool.execute('DELETE FROM app_items WHERE resource = ? AND id = ?', ['news_articles', itemId]);
  await db.pool.execute('DELETE FROM app_singletons WHERE resource = ?', [marker]);
};

const run = async () => {
  assert.equal(db.hasDatabaseConnection, true, 'MySQL must be configured');
  await db.ensureEventsSchema();

  await db.setSingleton(marker, { enabled: true });
  assert.deepEqual(await db.getSingleton(marker), { enabled: true });

  await db.createItem('news_articles', { id: itemId, heading: marker, content: 'initial', active: true });
  const updatedItem = await db.updateItem('news_articles', itemId, { content: 'updated' });
  assert.equal(updatedItem.heading, marker, 'partial item updates must preserve existing fields');
  assert.equal(updatedItem.content, 'updated');
  assert.ok((await db.searchPublicContent(marker)).some((entry) => entry.id === `news-${itemId}`));

  const event = await db.createEvent({
    title: marker,
    description: 'MySQL smoke event',
    date: new Date(Date.now() + 86400000).toISOString(),
    endDate: new Date(Date.now() + 90000000).toISOString(),
    location: 'Test',
    category: 'Test',
    capacity: 1,
    waitlistEnabled: true,
    active: true
  });
  eventId = event.id;
  const confirmed = await db.registerForEvent({ eventId, name: 'First', email: `${marker}-first@example.com` });
  const waitlisted = await db.registerForEvent({ eventId, name: 'Second', email: `${marker}-second@example.com` });
  assert.equal(confirmed.registration.status, 'confirmed');
  assert.equal(waitlisted.registration.status, 'waitlisted');
  const afterRemoval = await db.removeEventRegistrant({ eventId, registrantId: confirmed.registration.id });
  assert.equal(afterRemoval.promotedRegistration.status, 'confirmed');

  const campaign = await db.createDonationCampaign({ name: marker, target: 100, raised: 0, paymentProvider: 'ZEFFY', zeffyApiKey: `${marker}-secret`, isActive: true });
  campaignId = campaign.id;
  assert.equal(Object.prototype.hasOwnProperty.call(campaign, 'zeffyApiKey'), false, 'public campaign response must not expose Zeffy API keys');
  assert.equal((await db.getZeffyDonationCampaigns()).find((entry) => entry.id === campaignId)?.zeffyApiKey, `${marker}-secret`);
  const updatedCampaign = await db.updateDonationCampaign(campaignId, { description: 'updated' });
  assert.equal(updatedCampaign.name, marker, 'partial campaign updates must preserve existing fields');
  assert.equal(Object.prototype.hasOwnProperty.call(updatedCampaign, 'zeffyApiKey'), false);
  await db.upsertDonation({ id: donationId, receiptId: marker, campaignId, campaignName: marker, amount: 25, paymentStatus: 'PAID' });
  assert.equal((await db.getDonations()).find((entry) => entry.id === donationId)?.amount, 25);
  assert.equal((await db.summarizeDonationsByCampaign())[`id:${campaignId}`], 25);
  assert.equal((await db.removeDonation(donationId)).id, donationId);

  await db.createPendingDonation({ id: pendingId, campaignId, campaignName: marker, amount: 10 });
  assert.ok((await db.getPendingDonations()).some((entry) => entry.id === pendingId));
  await db.removePendingDonation(pendingId);

  await db.upsertQuizBankFile(quizFile, [{ id: 1, question: marker }]);
  assert.equal((await db.getQuizBankFile(quizFile)).questions.length, 1);

  console.log(JSON.stringify({ ok: true, marker }, null, 2));
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await db.pool?.end();
  });
