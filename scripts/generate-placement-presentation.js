/**
 * Generates Placement Preparation Tracker project PPT.
 * Run: node scripts/generate-placement-presentation.js
 * Edit GUIDE_NAME and GUIDE_DESIGNATION below if needed.
 */

const pptxgen = require('pptxgenjs');

const STUDENT_NAME = 'Meenakshi Kalimuthu';
const REG_NO = 'RA2432241010288';
const PROJECT_TITLE = 'Placement Preparation Tracker';
/** Replace with your actual guide before submitting */
const GUIDE_NAME = '[Guide Name — please edit]';
const GUIDE_DESIGNATION = '[Designation — e.g., Assistant Professor, CSE]';

const OUT_FILE = 'Placement_Preparation_Tracker_Presentation.pptx';

function titleSlide(pptx) {
  const s = pptx.addSlide();
  s.background = { color: '1a365d' };
  s.addText(PROJECT_TITLE, {
    x: 0.5,
    y: 1.2,
    w: 9,
    h: 1.2,
    fontSize: 32,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    fontFace: 'Calibri',
  });
  s.addText(
    [
      { text: `Presented by\n`, options: { breakLine: true } },
      { text: `${STUDENT_NAME}\n`, options: { breakLine: true, fontSize: 20, bold: true } },
      { text: `Register No.: ${REG_NO}\n\n`, options: { breakLine: true, fontSize: 16 } },
      { text: `Guide: ${GUIDE_NAME}\n`, options: { breakLine: true, fontSize: 16 } },
      { text: `${GUIDE_DESIGNATION}`, options: { fontSize: 16 } },
    ],
    { x: 0.5, y: 3, w: 9, h: 3.5, color: 'E2E8F0', align: 'center', valign: 'middle', fontFace: 'Calibri' }
  );
}

function sectionSlide(pptx, title, bullets, subtitle) {
  const s = pptx.addSlide();
  s.addText(title, {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.65,
    fontSize: 28,
    bold: true,
    color: '1a365d',
    fontFace: 'Calibri',
  });
  if (subtitle) {
    s.addText(subtitle, {
      x: 0.5,
      y: 1,
      w: 9,
      h: 0.4,
      fontSize: 14,
      color: '4A5568',
      fontFace: 'Calibri',
    });
  }
  const lines = bullets.map((b) => ({ text: b, options: { bullet: true, fontSize: 18, breakLine: true } }));
  s.addText(lines, {
    x: 0.6,
    y: subtitle ? 1.5 : 1.2,
    w: 8.8,
    h: 5.5,
    color: '2D3748',
    fontFace: 'Calibri',
    valign: 'top',
  });
}

function abstractSlide(pptx) {
  const s = pptx.addSlide();
  s.addText('Abstract', {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.65,
    fontSize: 28,
    bold: true,
    color: '1a365d',
    fontFace: 'Calibri',
  });
  const body =
    'Placement Preparation Tracker is a web-based application designed to help students systematically prepare for technical interviews. ' +
    'It organizes study material by topics such as DBMS, networking, web technologies, and programming, and lets users track completion of questions, ' +
    'identify weak areas, and plan revision with reminders. The system combines a structured question bank with progress analytics and an integrated ' +
    'assistant to support consistent, measurable placement preparation in one place.';
  s.addText(body, {
    x: 0.5,
    y: 1.2,
    w: 9,
    h: 5.8,
    fontSize: 18,
    color: '2D3748',
    fontFace: 'Calibri',
    align: 'justify',
    valign: 'top',
  });
}

function letterSlide(pptx) {
  const s = pptx.addSlide();
  s.addText('Project Completion Letter', {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.65,
    fontSize: 26,
    bold: true,
    color: '1a365d',
    fontFace: 'Calibri',
  });
  const letter =
    'To Whom It May Concern,\n\n' +
    `This is to certify that ${STUDENT_NAME} (Register Number: ${REG_NO}) has successfully completed the project ` +
    `titled "${PROJECT_TITLE}" in partial fulfilment of the academic requirements.\n\n` +
    'The project demonstrates practical application of web development, database design, and user-centric features for placement preparation.\n\n' +
    'We wish the student success in future endeavours.\n\n' +
    '_________________________\n' +
    'Signature of the Guide\n' +
    `${GUIDE_NAME}\n` +
    `${GUIDE_DESIGNATION}\n\n` +
    '_________________________\n' +
    'Signature of the HOD / Department\n' +
    '(Official seal & date — attach scanned letter if required by your department)';
  s.addText(letter, {
    x: 0.5,
    y: 1.1,
    w: 9,
    h: 5.9,
    fontSize: 14,
    color: '2D3748',
    fontFace: 'Calibri',
    valign: 'top',
  });
}

function thankYouSlide(pptx) {
  const s = pptx.addSlide();
  s.background = { color: '1a365d' };
  s.addText('Thank You', {
    x: 0.5,
    y: 2.2,
    w: 9,
    h: 1,
    fontSize: 44,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    fontFace: 'Calibri',
  });
  s.addText(`${STUDENT_NAME}\nRegister No.: ${REG_NO}`, {
    x: 0.5,
    y: 3.8,
    w: 9,
    h: 1.5,
    fontSize: 22,
    color: 'E2E8F0',
    align: 'center',
    fontFace: 'Calibri',
  });
}

async function main() {
  const pptx = new pptxgen();
  pptx.author = STUDENT_NAME;
  pptx.title = PROJECT_TITLE;
  pptx.subject = 'Project Presentation';

  titleSlide(pptx);
  abstractSlide(pptx);

  sectionSlide(pptx, 'Introduction & Problem Statement', [
    'Campus placement demands structured revision across many technical topics.',
    'Students often lose track of what is covered, weak areas, and revision schedules.',
    'Scattered notes and ad-hoc practice make progress hard to measure.',
    'A single digital tracker reduces friction and improves consistency.',
  ]);

  sectionSlide(pptx, 'Objectives', [
    'Build a web application for topic-wise placement preparation.',
    'Track question completion and overall progress per subject.',
    'Highlight weak areas to focus revision effort.',
    'Support revision planning with reminders and optional assistant help.',
  ]);

  sectionSlide(pptx, 'Scope of the Project', [
    'Multi-topic question banks (e.g., DBMS, networking, web, programming).',
    'User-specific progress, weak-question marking, and bulk revision planning.',
    'Session-based authentication for personal data isolation.',
    'Dashboard-style summaries for quick status checks.',
  ]);

  sectionSlide(pptx, 'System Overview', [
    'Client: browser UI with topic pages, modals, and assistant panel.',
    'Server: Node.js / Express REST APIs and server-rendered views.',
    'Data: relational store for questions/users; document store for chat history.',
    'External services: email for reminders; optional AI APIs for general Q&A.',
  ]);

  sectionSlide(pptx, 'Key Features — Progress & Analytics', [
    'Visual progress indicators (e.g., completion by topic).',
    'Counts of completed vs pending questions.',
    'Filtering and topic-focused views for focused study.',
    'Insights to see where more practice is needed.',
  ]);

  sectionSlide(pptx, 'Key Features — Questions & Weak Areas', [
    'Mark questions complete or weak for follow-up.',
    'Group or analyse weak areas by category.',
    'Row-level actions: notes, plan revision date, reminders.',
    'Keeps preparation data tied to the logged-in user.',
  ]);

  sectionSlide(pptx, 'Key Features — Revision & Reminders', [
    'Schedule revision with date/time-oriented planning.',
    'Bulk planning for multiple questions.',
    'Email-based reminders using configurable SMTP (e.g., Gmail).',
    'Reduces chance of missing planned revision slots.',
  ]);

  sectionSlide(pptx, 'Key Features — Assistant', [
    'In-app assistant for conceptual and general interview questions.',
    'Chat threads saved per user for continuity across sessions.',
    'Local answers for personal progress-style queries when applicable.',
    'Optional cloud LLM integration for broader technical explanations.',
  ]);

  sectionSlide(pptx, 'User Workflow (Summary)', [
    'Register / log in → choose a topic.',
    'Practice questions; mark complete or weak.',
    'Review progress and weak-area summaries.',
    'Plan revision, set reminders, use assistant as needed.',
  ]);

  sectionSlide(
    pptx,
    'Tools & Technologies',
    [
      'Frontend: HTML, CSS, JavaScript, EJS templates.',
      'Backend: Node.js, Express.js, session handling.',
      'Databases: SQLite (or similar) for core app data; MongoDB for assistant conversations.',
      'Other: Nodemailer (email), bcrypt (passwords), dotenv (configuration).',
    ],
    'Crisp stack overview'
  );

  sectionSlide(pptx, 'Benefits & Outcome', [
    'Clear visibility of preparation status across topics.',
    'Data-driven focus on weak areas instead of random revision.',
    'Single platform for questions, planning, and help.',
    'Scalable structure to add topics, questions, or features later.',
  ]);

  sectionSlide(pptx, 'Future Enhancements', [
    'Mobile-friendly UI and push notifications.',
    'Timed mock quizzes and performance reports.',
    'Collaborative study groups or peer leaderboards (optional).',
    'Deeper analytics and export of progress reports.',
  ]);

  sectionSlide(pptx, 'Testing & Validation', [
    'Functional testing of login, topic pages, and API endpoints.',
    'Verification of progress updates and weak-area marking.',
    'Reminder and email flow tested with valid SMTP configuration.',
    'Assistant and chat persistence verified for multi-turn use.',
  ]);

  sectionSlide(pptx, 'Conclusion', [
    'Placement Preparation Tracker turns ad-hoc study into a measurable process.',
    'Integrates content, analytics, planning, and assistance in one system.',
    'Suitable for iterative improvement and real student use during placements.',
    'Meets the goal of structured, trackable placement preparation.',
  ]);

  letterSlide(pptx);
  thankYouSlide(pptx);

  const path = require('path');
  const outPath = path.join(__dirname, '..', OUT_FILE);
  await pptx.writeFile({ fileName: outPath });
  console.log('Created:', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
