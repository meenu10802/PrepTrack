const connectDB = require('../config/db');
const Question = require('../models/question');

const MIN_PER_TOPIC = 120;
const TOPICS = ['DBMS', 'NETWORKING', 'WEBDEV'];
const PROGRAMMING_LANGS = ['java', 'python', 'c', 'cpp'];

function buildTopicQuestion(topic, i) {
  const skillMap = {
    DBMS: [
      'normalization',
      'indexing',
      'joins',
      'transactions',
      'ACID',
      'query optimization',
      'stored procedures',
      'views',
      'constraints',
      'partitioning',
    ],
    NETWORKING: [
      'OSI model',
      'TCP vs UDP',
      'subnetting',
      'DNS',
      'HTTP/HTTPS',
      'routing',
      'switching',
      'NAT',
      'firewalls',
      'TLS handshake',
    ],
    WEBDEV: [
      'HTML semantics',
      'CSS box model',
      'Flexbox/Grid',
      'JavaScript closures',
      'async/await',
      'REST APIs',
      'authentication',
      'caching',
      'CORS',
      'performance optimization',
    ],
  };

  const skill = skillMap[topic][i % skillMap[topic].length];
  const n = i + 1;
  return {
    question: `${topic} Practice ${n}: Explain ${skill} with one real-world example.`,
    answer: `In ${topic}, ${skill} is important for building reliable systems. Explain the concept, mention where it is used in production, and include one practical example with trade-offs.`,
  };
}

function buildProgrammingQuestion(lang, i) {
  const skills = [
    'time complexity',
    'space complexity',
    'arrays',
    'strings',
    'hash maps',
    'stacks',
    'queues',
    'trees',
    'graphs',
    'dynamic programming',
  ];
  const skill = skills[i % skills.length];
  const n = i + 1;
  return {
    question: `PROGRAMMING (${lang.toUpperCase()}) Practice ${n}: Solve a ${skill} interview question and explain your approach.`,
    answer: `Start with a brute-force approach, then optimize it. Share the ${lang} implementation idea, complexity analysis, and edge cases.`,
  };
}

async function ensureTopic(topic) {
  const count = await Question.countDocuments({ topic, subTopic: 'Concepts' });
  if (count >= MIN_PER_TOPIC) return { topic, inserted: 0, total: count };

  const needed = MIN_PER_TOPIC - count;
  const docs = [];
  for (let i = 0; i < needed; i += 1) {
    const qa = buildTopicQuestion(topic, i);
    docs.push({
      topic,
      subTopic: 'Concepts',
      question: qa.question,
      answer: qa.answer,
    });
  }
  const inserted = (await Question.insertMany(docs, { ordered: false })).length;
  const total = await Question.countDocuments({ topic, subTopic: 'Concepts' });
  return { topic, inserted, total };
}

async function ensureProgramming(lang) {
  const query = { topic: 'PROGRAMMING', subTopic: 'Concepts', programmingLanguage: lang };
  const count = await Question.countDocuments(query);
  if (count >= MIN_PER_TOPIC) return { topic: `PROGRAMMING/${lang}`, inserted: 0, total: count };

  const needed = MIN_PER_TOPIC - count;
  const docs = [];
  for (let i = 0; i < needed; i += 1) {
    const qa = buildProgrammingQuestion(lang, i);
    docs.push({
      topic: 'PROGRAMMING',
      subTopic: 'Concepts',
      programmingLanguage: lang,
      question: qa.question,
      answer: qa.answer,
    });
  }
  const inserted = (await Question.insertMany(docs, { ordered: false })).length;
  const total = await Question.countDocuments(query);
  return { topic: `PROGRAMMING/${lang}`, inserted, total };
}

async function main() {
  await connectDB();
  const results = [];
  for (const topic of TOPICS) {
    results.push(await ensureTopic(topic));
  }
  for (const lang of PROGRAMMING_LANGS) {
    results.push(await ensureProgramming(lang));
  }

  console.table(results);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to seed question bank:', err.message);
  process.exit(1);
});
