import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import PptxGenJS from 'pptxgenjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mdPath = path.join(__dirname, 'SSM_Handbook_Runbook.md');
const htmlPath = path.join(__dirname, 'SSM_Handbook_Runbook.html');
const pptxPath = path.join(__dirname, 'SSM_Executive_Overview.pptx');
const screenshotsDir = path.join(__dirname, 'screenshots');

const markdown = fs.readFileSync(mdPath, 'utf8');
const bodyHtml = marked.parse(markdown);

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SSM Handbook Runbook</title>
  <style>
    :root {
      --bg: #f8f7f3;
      --ink: #1f1d1a;
      --brand: #c45200;
      --brand-dark: #8b3500;
      --muted: #6a625b;
      --card: #fffdf8;
      --line: #e9decf;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: radial-gradient(circle at top left, #fff4df 0%, var(--bg) 42%, #f1eee7 100%);
      color: var(--ink);
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      line-height: 1.5;
    }
    .wrap {
      max-width: 980px;
      margin: 0 auto;
      padding: 40px 28px 64px;
    }
    h1, h2, h3 {
      letter-spacing: 0.2px;
      line-height: 1.2;
      margin-top: 1.2em;
      margin-bottom: 0.5em;
    }
    h1 { color: var(--brand-dark); font-size: 38px; }
    h2 {
      color: var(--brand-dark);
      font-size: 28px;
      border-bottom: 2px solid var(--line);
      padding-bottom: 8px;
    }
    h3 { color: var(--brand); font-size: 22px; }
    p, li { font-size: 16px; }
    ul, ol { padding-left: 22px; }
    hr { border: none; border-top: 1px solid var(--line); margin: 24px 0; }
    img {
      width: 100%;
      border-radius: 12px;
      border: 1px solid var(--line);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.08);
      margin: 10px 0 26px;
      break-inside: avoid;
    }
    code {
      background: #f5ebdf;
      border: 1px solid #ead3ba;
      border-radius: 5px;
      padding: 2px 6px;
      font-size: 90%;
    }
    pre code {
      display: block;
      overflow-x: auto;
      padding: 14px;
      background: #f5ebdf;
    }
    blockquote {
      margin: 18px 0;
      padding: 10px 14px;
      border-left: 4px solid var(--brand);
      background: #fff4e8;
    }
    @media print {
      body { background: #fff; }
      .wrap { max-width: 100%; padding: 0; }
      img { box-shadow: none; }
      h2, h3, img { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="wrap">${bodyHtml}</main>
</body>
</html>`;

fs.writeFileSync(htmlPath, html, 'utf8');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Singh Sabha Milton';
pptx.subject = 'Platform Executive Overview';
pptx.title = 'SSM Executive Overview';
pptx.company = 'Singh Sabha Milton';
pptx.lang = 'en-CA';

const addTitle = (slide, title, subtitle) => {
  slide.background = { color: 'F7F3EC' };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.8, fill: { color: 'C45200' }, line: { color: 'C45200' } });
  slide.addText(title, { x: 0.6, y: 1.0, w: 12.1, h: 0.8, fontFace: 'Aptos Display', fontSize: 34, bold: true, color: '8B3500' });
  if (subtitle) {
    slide.addText(subtitle, { x: 0.6, y: 1.8, w: 12.1, h: 0.6, fontFace: 'Aptos', fontSize: 16, color: '5D544D' });
  }
};

const cover = pptx.addSlide();
addTitle(cover, 'Singh Sabha Milton Platform', 'Why People Use It | Who It Serves | What We Gain');
cover.addText(
  [
    { text: 'This platform is the digital front door of the sangat. It helps people find events, offer seva, donate with confidence, and stay connected without friction.' }
  ],
  { x: 0.8, y: 3.0, w: 11.8, h: 1.6, fontFace: 'Aptos', fontSize: 19, color: '2D2926' }
);
cover.addText('Prepared: 2026-07-17', { x: 0.8, y: 6.7, w: 5.6, h: 0.4, fontFace: 'Aptos', fontSize: 12, color: '6A625B' });

const platform = pptx.addSlide();
addTitle(platform, 'Who Uses This Website', 'From first-time visitors to full operations teams');
platform.addText([
  { text: 'Public Visitors\n', options: { bold: true } },
  { text: '- Explore the Gurdwara, programs, media, and updates\n' },
  { text: 'Participants\n', options: { bold: true } },
  { text: '- Register for events, sign up for seva, and donate\n' },
  { text: 'Families and Members\n', options: { bold: true } },
  { text: '- Track participation and manage profile details\n' },
  { text: 'Admins and Leadership\n', options: { bold: true } },
  { text: '- Run content, approvals, campaigns, and operations in one place' }
], { x: 0.8, y: 2.3, w: 6.2, h: 3.6, fontFace: 'Aptos', fontSize: 16, color: '2D2926' });
if (fs.existsSync(path.join(screenshotsDir, 'home.png'))) {
  platform.addImage({ path: path.join(screenshotsDir, 'home.png'), x: 7.1, y: 2.3, w: 5.7, h: 4.0 });
}

const auth = pptx.addSlide();
addTitle(auth, 'Why People Keep Using It', 'Clear journeys, less confusion, better trust');
auth.addText([
  { text: '- The site is simple to navigate from any starting point\n' },
  { text: '- Event and seva registration flows are straightforward\n' },
  { text: '- Already-registered users get clear messages instead of error loops\n' },
  { text: '- Families see relevant actions, admins see admin actions\n' },
  { text: '- The platform feels predictable, which builds confidence' }
], { x: 0.8, y: 2.5, w: 12.0, h: 3.0, fontFace: 'Aptos', fontSize: 18, color: '2D2926' });

const ops = pptx.addSlide();
addTitle(ops, 'What We Gain', 'Real outcomes for community and operations');
const moduleRows = [
  'Community Gain: More participation in events, seva, and learning',
  'Operational Gain: Less manual follow-up and fewer duplicate records',
  'Governance Gain: Role-aware access and cleaner approval flow',
  'Communication Gain: Faster publishing across pages and channels'
];
ops.addText(moduleRows.map((t) => ({ text: `- ${t}\n` })), {
  x: 0.8, y: 2.3, w: 6.6, h: 2.8, fontFace: 'Aptos', fontSize: 15, color: '2D2926'
});
if (fs.existsSync(path.join(screenshotsDir, 'admin-dashboard.png'))) {
  ops.addImage({ path: path.join(screenshotsDir, 'admin-dashboard.png'), x: 7.1, y: 2.2, w: 5.7, h: 4.1 });
}

const rules = pptx.addSlide();
addTitle(rules, 'Trust and Data Integrity', 'Where user experience and admin reliability meet');
rules.addText([
  { text: '- Duplicate registration is blocked for the same user and opportunity\n' },
  { text: '- Already registered users see disabled submit states with clear wording\n' },
  { text: '- This prevents accidental double entries and reporting noise\n' },
  { text: '- Teams spend less time fixing records and more time serving people' }
], { x: 0.8, y: 2.4, w: 12.0, h: 3.2, fontFace: 'Aptos', fontSize: 17, color: '2D2926' });

const value = pptx.addSlide();
addTitle(value, 'Why This Is Worth Investing In', 'The value is felt by families, sevadars, and leadership');
value.addShape(pptx.ShapeType.roundRect, { x: 0.9, y: 2.2, w: 3.9, h: 2.3, fill: { color: 'FFF1E0' }, line: { color: 'E4C4A0' }, radius: 0.12 });
value.addShape(pptx.ShapeType.roundRect, { x: 4.9, y: 2.2, w: 3.9, h: 2.3, fill: { color: 'FFF1E0' }, line: { color: 'E4C4A0' }, radius: 0.12 });
value.addShape(pptx.ShapeType.roundRect, { x: 8.9, y: 2.2, w: 3.4, h: 2.3, fill: { color: 'FFF1E0' }, line: { color: 'E4C4A0' }, radius: 0.12 });
value.addText('Efficiency', { x: 1.2, y: 2.6, w: 3.2, h: 0.5, fontFace: 'Aptos Display', bold: true, fontSize: 22, color: '8B3500' });
value.addText('Operations teams can run updates and campaigns without scattered tools.', { x: 1.2, y: 3.2, w: 3.2, h: 1.0, fontFace: 'Aptos', fontSize: 13, color: '2D2926' });
value.addText('Engagement', { x: 5.2, y: 2.6, w: 3.2, h: 0.5, fontFace: 'Aptos Display', bold: true, fontSize: 22, color: '8B3500' });
value.addText('Sangat members can discover, join, and contribute with less effort.', { x: 5.2, y: 3.2, w: 3.2, h: 1.0, fontFace: 'Aptos', fontSize: 13, color: '2D2926' });
value.addText('Governance', { x: 9.2, y: 2.6, w: 2.8, h: 0.5, fontFace: 'Aptos Display', bold: true, fontSize: 22, color: '8B3500' });
value.addText('Leadership gets clearer visibility with safer role and approval controls.', { x: 9.2, y: 3.2, w: 2.8, h: 1.0, fontFace: 'Aptos', fontSize: 13, color: '2D2926' });

const highlights = [
  ['Public Journeys', 'events.png'],
  ['Seva Journeys', 'seva.png'],
  ['Donations', 'donation.png'],
  ['Users and Access', 'admin-users.png'],
  ['Operations', 'admin-seva-opportunities.png']
];

for (const [title, imageName] of highlights) {
  const slide = pptx.addSlide();
  addTitle(slide, title, 'Representative platform screen');
  const imagePath = path.join(screenshotsDir, imageName);
  if (fs.existsSync(imagePath)) {
    slide.addImage({ path: imagePath, x: 0.8, y: 2.0, w: 11.8, h: 4.8 });
  } else {
    slide.addText('Screenshot unavailable in docs/screenshots.', {
      x: 0.8,
      y: 2.8,
      w: 11.8,
      h: 1,
      fontFace: 'Aptos',
      fontSize: 18,
      color: '7A2219'
    });
  }
}

const close = pptx.addSlide();
addTitle(close, 'What To Do Next', 'Make the value visible in every rollout and demo');
close.addText([
  { text: '1. Keep demos people-first: start with who uses each page and why\n' },
  { text: '2. Publish this runbook where admins can access it quickly\n' },
  { text: '3. Train module owners with live flows (Users, Events, Seva, Donations)\n' },
  { text: '4. Track KPIs: registrations, donation conversion, volunteer participation' }
], { x: 0.8, y: 2.4, w: 12.0, h: 3.0, fontFace: 'Aptos', fontSize: 18, color: '2D2926' });

await pptx.writeFile({ fileName: pptxPath });

console.log('Generated:');
console.log(`- ${htmlPath}`);
console.log(`- ${pptxPath}`);
