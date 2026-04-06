const Question = require('../models/question');
const RevisionReminder = require('../models/revisionReminder');
const { inferWeakCategory } = require('./inferWeakCategory');

function conceptsQuery(topic, user) {
  const q = { topic, subTopic: 'Concepts' };
  if (topic === 'PROGRAMMING' && user && user.programmingLanguage) {
    q.programmingLanguage = user.programmingLanguage;
  }
  return q;
}

async function computeWeakAreasReport(userId, user, topic) {
  const t = topic.toUpperCase();
  const q = conceptsQuery(t, user);
  const questions = await Question.find(q).lean();
  const uid = userId.toString();
  const groups = {};
  for (const qu of questions) {
    const cat = inferWeakCategory(t, qu.question, qu.subTopic);
    if (!groups[cat]) groups[cat] = { total: 0, completed: 0, marked: 0 };
    groups[cat].total += 1;
    if ((qu.completedBy || []).some((id) => id.toString() === uid)) groups[cat].completed += 1;
    if ((qu.markedWeakBy || []).some((id) => id.toString() === uid)) groups[cat].marked += 1;
  }
  const rows = Object.entries(groups).map(([name, g]) => {
    const pending = g.total - g.completed;
    const completionPct = g.total ? Math.round((g.completed / g.total) * 100) : 0;
    const pendingRatio = g.total ? pending / g.total : 0;
    const weakRatio = g.total ? g.marked / g.total : 0;
    const score = Math.round(pendingRatio * 70 + (1 - completionPct / 100) * 30 - weakRatio * 25);
    return { name, total: g.total, completed: g.completed, marked: g.marked, pending, completionPct, score };
  });
  rows.sort((a, b) => b.score - a.score);
  const n = rows.length;
  const areas = rows.map((row, i) => {
    let priority = 'Low';
    if (n === 1) priority = 'High';
    else if (i / n < 1 / 3) priority = 'High';
    else if (i / n < 2 / 3) priority = 'Medium';
    let advice = 'Steady progress. Keep a light revision cadence.';
    if (row.pending === 0 && row.marked === 0) advice = 'Strong completion here. Maintain with occasional review.';
    else if (priority === 'High') advice = 'High-priority revision needed. Schedule this area first in your planner.';
    else if (priority === 'Medium') advice = 'Medium priority. Blend this into your weekly revision mix.';
    else advice = 'Lower urgency relative to other topics, or you have already flagged many items here.';
    return { ...row, priority, advice };
  });
  const topWeak = areas[0]?.name || '—';
  const summary = `Top weak area: ${topWeak}. Focus on incomplete and lightly marked questions first.`;
  return { summary, areas };
}

async function getTopicProgressStats(userId, user, topic) {
  const t = topic.toUpperCase();
  const q = conceptsQuery(t, user);
  const total = await Question.countDocuments(q);
  const completed = await Question.countDocuments({ ...q, completedBy: userId });
  const pct = total ? Math.round((completed / total) * 1000) / 10 : 0;
  const pending = Math.max(0, total - completed);
  return { total, completed, pending, pct };
}

async function getOverallProgressStats(userId, user) {
  const topics = ['DBMS', 'NETWORKING', 'WEBDEV', 'PROGRAMMING'];
  let total = 0;
  let completed = 0;
  const breakdown = [];
  for (const tp of topics) {
    const q = conceptsQuery(tp, user);
    const tot = await Question.countDocuments(q);
    const comp = await Question.countDocuments({ ...q, completedBy: userId });
    total += tot;
    completed += comp;
    breakdown.push({
      topic: tp,
      total: tot,
      completed: comp,
      pending: Math.max(0, tot - comp),
      pct: tot ? Math.round((comp / tot) * 1000) / 10 : 0,
    });
  }
  const pct = total ? Math.round((completed / total) * 1000) / 10 : 0;
  return { total, completed, pending: Math.max(0, total - completed), pct, breakdown };
}

async function countUpcomingReminders(userId) {
  const now = new Date();
  return RevisionReminder.countDocuments({
    user: userId,
    sent: false,
    reminderAt: { $gte: now },
  });
}

module.exports = {
  computeWeakAreasReport,
  getTopicProgressStats,
  getOverallProgressStats,
  countUpcomingReminders,
};
