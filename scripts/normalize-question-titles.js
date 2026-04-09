const connectDB = require('../config/db');
const Question = require('../models/question');

function cleanQuestionText(input) {
  let s = String(input || '').trim();

  // Remove auto-generated prefixes like:
  // "DBMS Practice 12: ...", "PROGRAMMING (JAVA) Practice 4: ..."
  s = s.replace(
    /^(dbms|networking|webdev|programming(?:\s*\([^)]+\))?)\s*practice\s*\d+\s*:\s*/i,
    ''
  );

  // Remove an existing leading number if already present.
  s = s.replace(/^\d+\s*[.)-]\s*/, '');

  return s.trim();
}

async function renumberGroup(query) {
  const rows = await Question.find(query).sort({ _id: 1 });
  let changed = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const base = cleanQuestionText(row.question);
    const nextTitle = `${i + 1}. ${base}`;
    if (row.question !== nextTitle) {
      row.question = nextTitle;
      await row.save();
      changed += 1;
    }
  }

  return { total: rows.length, changed };
}

async function main() {
  await connectDB();

  const targets = [
    { label: 'DBMS', query: { topic: 'DBMS', subTopic: 'Concepts' } },
    { label: 'NETWORKING', query: { topic: 'NETWORKING', subTopic: 'Concepts' } },
    { label: 'WEBDEV', query: { topic: 'WEBDEV', subTopic: 'Concepts' } },
    {
      label: 'PROGRAMMING/java',
      query: { topic: 'PROGRAMMING', subTopic: 'Concepts', programmingLanguage: 'java' },
    },
    {
      label: 'PROGRAMMING/python',
      query: { topic: 'PROGRAMMING', subTopic: 'Concepts', programmingLanguage: 'python' },
    },
    {
      label: 'PROGRAMMING/c',
      query: { topic: 'PROGRAMMING', subTopic: 'Concepts', programmingLanguage: 'c' },
    },
    {
      label: 'PROGRAMMING/cpp',
      query: { topic: 'PROGRAMMING', subTopic: 'Concepts', programmingLanguage: 'cpp' },
    },
  ];

  const out = [];
  for (const t of targets) {
    const r = await renumberGroup(t.query);
    out.push({ section: t.label, total: r.total, updated: r.changed });
  }

  console.table(out);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to normalize questions:', err.message);
  process.exit(1);
});

