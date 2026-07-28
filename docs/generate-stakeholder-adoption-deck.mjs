import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PptxGenJS from 'pptxgenjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const outPptx = path.join(__dirname, 'SSM_Stakeholder_Adoption_Deck.pptx');
const outMd = path.join(__dirname, 'SSM_Stakeholder_Adoption_Deck.md');
const shotsDir = path.join(__dirname, 'screenshots_fresh');
const logoPath = path.join(shotsDir, 'gurdwara-logo-large.png');

const BRAND = {
  navy: '0A1A33',
  blue: '0A4D9F',
  saffron: 'F5A623',
  slate: '1F2937',
  muted: '4B5563',
  page: 'F3F7FC',
  line: 'D9E5F5',
  watermark: 'DDE8F7'
};

const read = (filePath) => fs.readFileSync(filePath, 'utf8');

const countNavItems = (source, exportName) => {
  const blockRegex = new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*\\[([\\s\\S]*?)\\];`, 'm');
  const match = source.match(blockRegex);
  if (!match) return 0;
  return (match[1].match(/\{\s*label\s*:/g) || []).length;
};

const getMetrics = () => {
  const navigationSource = read(path.join(root, 'src', 'constants', 'navigation.js'));
  const publicNavCount = countNavItems(navigationSource, 'publicNav');
  const adminNavCount = countNavItems(navigationSource, 'adminNav');
  const adminDirectoryCount = fs.readdirSync(path.join(root, 'src', 'admin')).filter((name) => fs.statSync(path.join(root, 'src', 'admin', name)).isDirectory()).length;
  const quizBankCount = fs.readdirSync(path.join(root, 'public', 'quiz')).filter((name) => name.endsWith('.json')).length;
  const uploadBucketCount = fs.readdirSync(path.join(root, 'server', 'uploads')).filter((name) => fs.statSync(path.join(root, 'server', 'uploads', name)).isDirectory()).length;
  const serverSource = read(path.join(root, 'server', 'index.js'));
  const volunteerReminderDaysMatch = serverSource.match(/const volunteerReminderDays = \[(.*?)\]/);
  const volunteerReminderDays = volunteerReminderDaysMatch ? volunteerReminderDaysMatch[1].replace(/\s+/g, '') : '10,5,2,1';
  const eventReminderDaysMatch = serverSource.match(/EVENT_REMINDER_DAYS\s*\|\|\s*'([^']+)'/);
  const eventReminderDays = eventReminderDaysMatch ? eventReminderDaysMatch[1] : '7,3,1';
  return {
    publicNavCount,
    adminNavCount,
    adminDirectoryCount,
    quizBankCount,
    uploadBucketCount,
    volunteerReminderDays,
    eventReminderDays
  };
};

const m = getMetrics();

const shotFor = (fileName) => {
  if (!fileName) return '';
  const filePath = path.join(shotsDir, fileName);
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : '';
};

const desktopScreenshotByTitle = {
  'Current State Baseline (Existing Site)': 'current-site-desktop.png',
  'New Platform Snapshot (Desktop Web)': 'home-desktop.png',
  'Business Value Delivered': 'events-desktop.png',
  'Community Action Flows': 'seva-desktop.png',
  'Operations and Communications': 'news-desktop.png',
  'KPI and Adoption Model': 'donation-desktop.png'
};

const slides = [
  {
    title: 'Executive Summary',
    subtitle: 'Adoption business case for Singh Sabha Milton digital platform',
    bullets: [
      'Goal: approve the platform as the primary digital operating channel.',
      'Approach: compare current-site experience to new platform capabilities.',
      'Audience: non-technical stakeholders across committee and operations.',
      'Method: use observable facts, measurable KPIs, and a clear 90-day plan.',
      'Result: faster participation, fewer manual loops, and stronger visibility.'
    ]
  },
  {
    title: 'Current State Baseline (Existing Site)',
    subtitle: 'Observed snapshot from singhsabhamilton.com',
    bullets: [
      'Strong informational presence with schedule, Sunday details, and contact.',
      'Main actions are membership application and newsletter signup links.',
      'Event visibility exists through calendar embed and social channels.',
      'Most workflows still require off-platform follow-up and coordination.',
      'Leadership reporting requires manual interpretation and consolidation.',
      'This model informs the community well, but scales operations slowly.'
    ]
  },
  {
    title: 'New Platform Snapshot (Desktop Web)',
    subtitle: 'Full web experience as primary showcase',
    bullets: [
      `${m.publicNavCount} public sections organized for discover-to-action journeys.`,
      `${m.adminNavCount} admin modules accessible via role-aware controls.`,
      'Integrated flows for events, seva, donation, videos, news, and contact.',
      'Single destination reduces dependence on disconnected external links.',
      'Navigation, content, and calls-to-action are designed for conversion.',
      'Desktop version is optimized for committee demos and stakeholder reviews.'
    ]
  },
  {
    title: 'Business Value Delivered',
    subtitle: 'What changes for the organization',
    bullets: [
      'Participation value: more users can complete actions in-platform.',
      'Operational value: fewer manual corrections and follow-up messages.',
      'Governance value: role-based access reduces accidental changes.',
      'Communication value: updates can be published and discovered faster.',
      'Experience value: clearer action states increase user confidence.',
      'Leadership value: stronger clarity on what is working each month.'
    ]
  },
  {
    title: 'Community Action Flows',
    subtitle: 'Event, seva, and donation actions are now direct',
    bullets: [
      'Events flow supports registration with clean identity handoff.',
      'Seva flow blocks duplicates and communicates status clearly.',
      'Donation flow supports secure checkout with webhook reliability.',
      'Action pages are designed to remove uncertainty at click time.',
      'Users spend less time searching and more time participating.',
      'This directly supports attendance, seva coverage, and campaign goals.'
    ]
  },
  {
    title: 'Operations and Communications',
    subtitle: 'Admin-side capability in one platform',
    bullets: [
      `${m.adminDirectoryCount} admin module areas support content and operations.`,
      `${m.uploadBucketCount} upload buckets support media workflows across modules.`,
      'News, videos, and CMS updates can be managed centrally.',
      'Roles and access controls support safer delegation.',
      `Reminders are configured for volunteer (${m.volunteerReminderDays}) and event (${m.eventReminderDays}) cadences.`,
      'This reduces dependence on ad-hoc communication channels.'
    ]
  },
  {
    title: 'Responsive Assurance: Home Page',
    subtitle: 'Desktop, iPad, and mobile proof on the same platform',
    visual: 'home',
    bullets: [
      'Desktop presents full-context navigation and discovery.',
      'Tablet keeps interaction balanced with touch-first behavior.',
      'Mobile preserves key actions with simplified layout.',
      'Assurance: one platform is usable across all major device formats.',
      'Outcome: accessibility and confidence for wider audience adoption.'
    ]
  },
  {
    title: 'Responsive Assurance: Seva Flow',
    subtitle: 'Action journey consistency across device sizes',
    visual: 'seva',
    bullets: [
      'Desktop shows broader seva context and status visibility.',
      'Tablet keeps action controls readable and scannable.',
      'Mobile retains the complete registration journey.',
      'Design keeps the same task outcomes, regardless of screen width.',
      'Outcome: volunteer conversion is not device-dependent.'
    ]
  },
  {
    title: 'KPI and Adoption Model',
    subtitle: 'Simple scorecard for non-technical governance',
    bullets: [
      'Activation KPI: signed-in users completing at least one action.',
      'Events KPI: event-page visitors converted to registrations.',
      'Seva KPI: opportunity views converted to volunteer signups.',
      'Donation KPI: intent-to-completed successful donation rate.',
      'Communication KPI: update-page view-to-action click-through.',
      'Service KPI: manual follow-up time reduction percentage.'
    ]
  },
  {
    title: '90-Day Adoption Plan',
    subtitle: 'Phased plan for sustained rollout',
    bullets: [
      'Weeks 1-2: baseline data setup, owners assigned, demo readiness.',
      'Weeks 3-6: campaign-led adoption for events, seva, and donation.',
      'Weeks 7-10: optimize pages with highest drop-off rates.',
      'Weeks 11-13: leadership review and next-quarter scaling decisions.',
      'Cadence: weekly KPI pulse and quick corrective iterations.',
      'Output: measurable adoption, not just feature completion.'
    ]
  },
  {
    title: 'Decision and Ask',
    subtitle: 'Approvals required from business stakeholders',
    bullets: [
      'Approve this platform as the primary digital service channel.',
      'Approve KPI scorecard and monthly governance review.',
      'Nominate module owners for operations continuity.',
      'Approve 90-day rollout communication and training plan.',
      'Authorize periodic stakeholder review using agreed business metrics.'
    ]
  }
];

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Singh Sabha Milton';
pptx.company = 'Singh Sabha Milton';
pptx.subject = 'Stakeholder Adoption Deck';
pptx.title = 'SSM Stakeholder Adoption Deck';
pptx.lang = 'en-CA';

const addWatermark = (slide) => {
  slide.addText('SINGH SABHA MILTON', {
    x: 1.4,
    y: 3.2,
    w: 10.8,
    h: 0.8,
    fontFace: 'Aptos Display',
    fontSize: 44,
    bold: true,
    color: BRAND.watermark,
    angle: 330,
    align: 'center'
  });
};

const addThemeFrame = (slide, title, subtitle) => {
  slide.background = { color: BRAND.page };
  addWatermark(slide);

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.78,
    fill: { color: BRAND.navy },
    line: { color: BRAND.navy }
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0.78,
    w: 13.33,
    h: 0.05,
    fill: { color: BRAND.saffron },
    line: { color: BRAND.saffron }
  });

  if (fs.existsSync(logoPath)) {
    slide.addImage({ path: logoPath, x: 0.34, y: 0.1, w: 0.57, h: 0.57 });
  }

  slide.addText('Singh Sabha Milton', {
    x: 1.02,
    y: 0.2,
    w: 4.4,
    h: 0.3,
    fontFace: 'Aptos',
    fontSize: 11,
    bold: true,
    color: 'FFFFFF'
  });

  slide.addText(title, {
    x: 0.72,
    y: 1.03,
    w: 11.9,
    h: 0.55,
    fontFace: 'Aptos Display',
    fontSize: 28,
    bold: true,
    color: BRAND.navy
  });

  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.72,
      y: 1.56,
      w: 11.9,
      h: 0.35,
      fontFace: 'Aptos',
      fontSize: 12,
      color: BRAND.muted
    });
  }
};

const addFooter = (slide, pageNo) => {
  slide.addShape(pptx.ShapeType.line, {
    x: 0.7,
    y: 6.9,
    w: 11.95,
    h: 0,
    line: { color: BRAND.line, pt: 1 }
  });
  slide.addText('Stakeholder Adoption Deck', {
    x: 0.72,
    y: 6.97,
    w: 4.0,
    h: 0.2,
    fontFace: 'Aptos',
    fontSize: 9,
    color: '64748B'
  });
  slide.addText(String(pageNo), {
    x: 12.2,
    y: 6.97,
    w: 0.35,
    h: 0.2,
    fontFace: 'Aptos',
    fontSize: 9,
    color: '64748B',
    align: 'right'
  });
};

const addCover = () => {
  const slide = pptx.addSlide();
  slide.background = { color: BRAND.page };
  addWatermark(slide);

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 1.52,
    fill: { color: BRAND.navy },
    line: { color: BRAND.navy }
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 1.52,
    w: 13.33,
    h: 0.07,
    fill: { color: BRAND.saffron },
    line: { color: BRAND.saffron }
  });

  if (fs.existsSync(logoPath)) {
    slide.addImage({ path: logoPath, x: 0.75, y: 0.28, w: 1.0, h: 1.0 });
  }

  slide.addText('Singh Sabha Milton', {
    x: 1.95,
    y: 0.45,
    w: 5.4,
    h: 0.35,
    fontFace: 'Aptos Display',
    fontSize: 21,
    bold: true,
    color: 'FFFFFF'
  });

  slide.addText('Stakeholder Adoption Presentation', {
    x: 1.95,
    y: 0.86,
    w: 6.5,
    h: 0.28,
    fontFace: 'Aptos',
    fontSize: 13,
    color: 'E5E7EB'
  });

  slide.addText('From information website to action-driven community platform', {
    x: 0.75,
    y: 1.94,
    w: 11.8,
    h: 0.55,
    fontFace: 'Aptos Display',
    fontSize: 25,
    bold: true,
    color: BRAND.navy
  });

  const bullets = [
    'Clear case for business adoption and governance approval.',
    'Measured improvements in engagement, participation, and efficiency.',
    'Device-ready platform assurance for desktop, iPad, and mobile.',
    'Practical 90-day execution model with KPI accountability.'
  ].map((item) => ({ text: item, options: { bullet: { indent: 16 } } }));

  slide.addText(bullets, {
    x: 0.85,
    y: 2.62,
    w: 6.3,
    h: 2.2,
    fontFace: 'Aptos',
    fontSize: 13,
    color: BRAND.slate,
    paraSpaceAfterPt: 8,
    breakLine: true
  });

  const coverShot = shotFor('home-desktop.png');
  if (coverShot) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 7.2,
      y: 2.36,
      w: 5.45,
      h: 3.45,
      fill: { color: 'FFFFFF' },
      line: { color: 'C7D6EA', pt: 1.2 },
      radius: 0.06,
      shadow: { type: 'outer', color: '94A3B8', blur: 2, angle: 45, distance: 1, opacity: 0.14 }
    });
    slide.addImage({ path: coverShot, x: 7.4, y: 2.53, w: 5.03, h: 3.08 });
  }

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.75,
    y: 6.15,
    w: 11.95,
    h: 0.52,
    fill: { color: 'E4EFFC' },
    line: { color: 'C7DDF9' },
    radius: 0.05
  });

  slide.addText('Introduction line: This platform helps sangat members move from interest to participation in a few trusted clicks.', {
    x: 0.96,
    y: 6.31,
    w: 11.5,
    h: 0.2,
    fontFace: 'Aptos',
    fontSize: 11,
    bold: true,
    color: BRAND.blue
  });
};

const addResponsiveShowcase = (entry, pageNo) => {
  const slide = pptx.addSlide();
  addThemeFrame(slide, entry.title, entry.subtitle);

  const bullets = entry.bullets.map((item) => ({ text: item, options: { bullet: { indent: 16 } } }));
  slide.addText(bullets, {
    x: 0.83,
    y: 2.04,
    w: 12.0,
    h: 1.45,
    fontFace: 'Aptos',
    fontSize: 12,
    color: BRAND.slate,
    paraSpaceAfterPt: 7,
    breakLine: true
  });

  const desktop = shotFor(`${entry.visual}-desktop.png`);
  const tablet = shotFor(`${entry.visual}-tablet.png`);
  const mobile = shotFor(`${entry.visual}-mobile.png`);

  const columns = [
    { label: 'Desktop', x: 0.83, image: desktop },
    { label: 'Tablet (iPad)', x: 4.91, image: tablet },
    { label: 'Mobile', x: 8.99, image: mobile }
  ];

  columns.forEach((column) => {
    slide.addText(column.label, {
      x: column.x,
      y: 3.62,
      w: 3.7,
      h: 0.22,
      fontFace: 'Aptos',
      fontSize: 10,
      bold: true,
      color: BRAND.navy,
      align: 'center'
    });
    slide.addShape(pptx.ShapeType.roundRect, {
      x: column.x,
      y: 3.88,
      w: 3.7,
      h: 2.72,
      fill: { color: 'FFFFFF' },
      line: { color: 'C7D6EA', pt: 1 },
      radius: 0.05
    });
    if (column.image) {
      slide.addImage({ path: column.image, x: column.x + 0.15, y: 4.03, w: 3.4, h: 2.4 });
    }
  });

  addFooter(slide, pageNo);
};

const addStandardSlide = (entry, pageNo) => {
  const slide = pptx.addSlide();
  addThemeFrame(slide, entry.title, entry.subtitle);

  const screenshot = shotFor(desktopScreenshotByTitle[entry.title] || '');
  const bullets = entry.bullets.map((item) => ({ text: item, options: { bullet: { indent: 16 } } }));

  slide.addText(bullets, {
    x: 0.84,
    y: 2.05,
    w: screenshot ? 6.95 : 11.85,
    h: 4.65,
    fontFace: 'Aptos',
    fontSize: 12,
    color: BRAND.slate,
    paraSpaceAfterPt: 8,
    breakLine: true,
    valign: 'top'
  });

  if (screenshot) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 7.75,
      y: 2.0,
      w: 4.86,
      h: 4.25,
      fill: { color: 'FFFFFF' },
      line: { color: 'C7D6EA', pt: 1.1 },
      radius: 0.05,
      shadow: { type: 'outer', color: '94A3B8', blur: 2, angle: 45, distance: 1, opacity: 0.12 }
    });
    slide.addImage({ path: screenshot, x: 7.96, y: 2.18, w: 4.44, h: 3.88 });
  }

  addFooter(slide, pageNo);
};

addCover();

let pageNo = 2;
slides.forEach((entry) => {
  if (entry.visual) {
    addResponsiveShowcase(entry, pageNo);
  } else {
    addStandardSlide(entry, pageNo);
  }
  pageNo += 1;
});

await pptx.writeFile({ fileName: outPptx });

const mdSections = slides.map((slide, index) => {
  const lines = [];
  lines.push(`## Slide ${index + 2}: ${slide.title}`);
  lines.push(`**Subtitle:** ${slide.subtitle}`);
  lines.push('');
  slide.bullets.forEach((bullet) => lines.push(`- ${bullet}`));
  lines.push('');
  return lines.join('\n');
}).join('\n');

const md = `# SSM Stakeholder Adoption Deck\n\nGenerated: 2026-07-28\n\nCover slide includes branded introduction line, logo, and desktop platform snapshot.\n\n## Slide 1: Cover\n**Title:** Singh Sabha Milton Stakeholder Adoption Presentation\n\n- From information website to action-driven community platform\n- Includes logo, watermark, and brand palette\n- Designed for non-technical stakeholder readability\n\n${mdSections}`;

fs.writeFileSync(outMd, md, 'utf8');

console.log('Generated:');
console.log(`- ${outPptx}`);
console.log(`- ${outMd}`);
