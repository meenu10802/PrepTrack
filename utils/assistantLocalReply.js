const {
  computeWeakAreasReport,
  getTopicProgressStats,
  getOverallProgressStats,
  countUpcomingReminders,
} = require('./progressInsights');

/** Normalize common typos for matching */
function norm(s) {
  return (s || '')
    .toLowerCase()
    .replace(/remian/g, 'remain')
    .replace(/\bamny\b/g, 'many')
    .replace(/\bques?t?ions?\b/g, 'questions');
}

/**
 * PrepTrack / personal progress → answer from DB, not OpenRouter.
 * Bare "what is / define / explain …" (no "my") stays on the API for definitions.
 */
function shouldAnswerLocally(message) {
  const t = norm(message);

  if (/\b(what is|what are|define|explain)\s+/i.test(message) && !/\bmy\b/i.test(t) && !/\bpreptrack\b/i.test(t)) {
    return false;
  }

  const progressWords =
    /\b(progress|remaining|left|pending|incomplete|unfinished|covered|complete|completed|done|percent|weak|weakest|priority|overall|reminder|upcoming|stats?|summary|dashboard|how many|how much|how amny|questions?\s+left|to\s+go|need\s+to\s+(do|cover)|still\s+have)\b/i;

  const personal = /\b(i|my|me|myself|have i|do i|am i)\b/i;

  const topicInMessage =
    /\b(dbms|networking|computer networks|web\s*dev|web technologies|programming)\b/i.test(message) ||
    /\b(in dbms|in networking|in web|in programming)\b/i.test(t);

  if (progressWords.test(t) && (personal.test(t) || topicInMessage)) {
    return true;
  }

  const patterns = [
    /\bmy\s+(overall\s+)?progress\b/,
    /\b(what'?s|what is)\s+my\s+progress\b/,
    /\bhow\s+much\s+(do\s+i\s+)?(have\s+)?left\b/,
    /\bhow\s+(much|many)\s+questions?\b/i,
    /\bquestions?\s+.*\bneed[s]?\s+o?t\s+(be\s+)?covered\b/i,
    /\bhow\s+many\s+(questions?\s+)?(left|remaining|pending|incomplete|unfinished)\b/,
    /\bhow\s+many\s+more\s+questions?\b/i,
    /\b(total|number)\s+of\s+questions?\b/i,
    /\bhow\s+far\s+(am\s+i|have\s+i|i)\b/,
    /\bweak(est)?\b.*\b(my|me|i)\b|\b(my|me|i)\b.*\bweak(est)?\b/,
    /\bwhich\s+.*\b(topic|area|subject)s?\b.*\bweak\b/,
    /\bwhat\b.*\b(weak|weakest|priority)\b.*\b(topic|area|subject|focus)\b/,
    /\b(priority|focus)\s+(topic|area|subject)s?\b/,
    /\bcompletion\b.*\b(my|this|here)\b/,
    /\bpercent(age)?\b.*\b(done|complete|left|finish)\b/,
    /\boverall\s+progress\b/,
    /\b(progress|left|complete)\b.*\b(all|every|across)\s+(topic|subject)/i,
    /\b(across|all)\s+(topic|subject)s?\b.*\b(progress|complete|left|done)\b/i,
    /\bhow\s+many\s+.*\breminder/i,
    /\b(reminder|scheduled)\b.*\b(how many|do i have|upcoming)\b/i,
    /\bupcoming\s+reminder/i,
    /\bpreptrack\b.*\b(progress|weak|stats|reminder)\b/i,
    /\b(my|i)\b.*\b(stat|dashboard|summary)\b/i,
  ];

  return patterns.some((re) => re.test(t));
}

function topicFromMessage(message, pageTopic) {
  const t = message.toLowerCase();
  if (/\bdbms\b/.test(t)) return 'DBMS';
  if (/\b(networking|computer networks)\b/.test(t)) return 'NETWORKING';
  if (/\b(web\s*dev|web technologies)\b/.test(t)) return 'WEBDEV';
  if (/\bprogramming\b/.test(t)) return 'PROGRAMMING';
  return (pageTopic || 'DBMS').toUpperCase();
}

function topicDisplayName(topic) {
  const u = topic.toUpperCase();
  if (u === 'DBMS') return 'DBMS';
  if (u === 'NETWORKING') return 'Computer Networks';
  if (u === 'WEBDEV') return 'Web Technologies';
  if (u === 'PROGRAMMING') return 'Programming (your language track)';
  return u;
}

async function buildLocalAssistantReply(message, userId, user, pageTopic) {
  const t = norm(message);
  const topic = topicFromMessage(message, pageTopic);
  const blocks = [];

  const askOverall =
    /\boverall\b/.test(t) ||
    /\b(all|every|across)\s+(the\s+)?(four\s+)?(topic|subject)/i.test(t);
  const askWeak =
    /\bweak|weakest|priority|focus\b/i.test(message) && !/\bwhat is\b.*\bweak\b/i.test(t);
  const askReminder = /\breminder|upcoming\s+(email|revision)|scheduled\s+revision/i.test(t);
  const askProgress =
    /\bprogress|how much|how many|left|remaining|pending|percent|completion|covered|\bdone\b|questions?\b/i.test(t);

  if (askReminder) {
    const n = await countUpcomingReminders(userId);
    blocks.push(`Upcoming revision reminders (not sent yet): ${n}.`);
  }

  if (askOverall) {
    const o = await getOverallProgressStats(userId, user);
    blocks.push(
      `Overall across subjects: ${o.completed} of ${o.total} concept questions done (${o.pct}%); ${o.pending} remaining.`
    );
    const line = o.breakdown
      .filter((x) => x.total > 0)
      .map((x) => `${x.topic} ${x.completed}/${x.total} (${x.pct}%)`)
      .join(' · ');
    if (line) blocks.push(line);
  }

  const focusThisTopic =
    !askOverall ||
    /\b(this|current|here|page|open)\b/i.test(t) ||
    askWeak ||
    (askProgress && !askOverall);

  if (focusThisTopic) {
    const p = await getTopicProgressStats(userId, user, topic);
    blocks.push(
      `${topicDisplayName(topic)}: ${p.completed} of ${p.total} questions complete (${p.pct}%). ${p.pending} questions remaining for you in PrepTrack.`
    );
  }

  if (askWeak) {
    const { summary, areas } = await computeWeakAreasReport(userId, user, topic);
    const top = areas
      .slice(0, 6)
      .map((a) => `• ${a.name} (${a.priority}): ${a.pending} pending, ${a.marked} marked weak`)
      .join('\n');
    blocks.push(`${summary}\n${top}`);
  }

  if (blocks.length === 0) {
    const p = await getTopicProgressStats(userId, user, topic);
    const { summary } = await computeWeakAreasReport(userId, user, topic);
    return `${topicDisplayName(topic)}: ${p.completed}/${p.total} (${p.pct}%). ${p.pending} remaining.\n\n${summary}`;
  }

  return blocks.join('\n\n');
}

module.exports = {
  shouldAnswerLocally,
  buildLocalAssistantReply,
  topicFromMessage,
};
