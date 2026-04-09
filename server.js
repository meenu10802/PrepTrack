const mongoose = require('mongoose');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const questionRoutes = require('./routes/questionRoutes');
const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const { initializeDB, resetDB } = require('./config/sqlite');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const RevisionReminder = require('./models/revisionReminder');
const ChatConversation = require('./models/chatConversation');
const { inferWeakCategory } = require('./utils/inferWeakCategory');
const { extractChatContent } = require('./utils/extractChatContent');
const { shouldAnswerLocally, buildLocalAssistantReply } = require('./utils/assistantLocalReply');
const app = express();
const path = require('path');
dotenv.config();
connectDB();
app.set('trust proxy', 1);

const db = initializeDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your_session_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/preptrack',
      collectionName: 'sessions',
      ttl: 14 * 24 * 60 * 60,
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);
//Nodejs uses express to handle this HTTP request
app.get('/', (req, res) => {
  console.log('GET /');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
//Nodejs uses express to handle this HTTP request
app.get('/register', (req, res) => {
  console.log('GET /register');
  res.render('register', { error: null, success: null });
});
//Nodejs uses express to handle this HTTP request
app.get('/login', (req, res) => {
  console.log('GET /login');//route renders an HTML login page
  res.render('login', { error: null, success: null });
});
//Nodejs uses express to handle this HTTP request
app.get('/home', async (req, res) => {
  if (!req.session.userId) {
    console.log('GET /home: No userId in session');
    return res.redirect('/login');
  }
  try {
    const User = require('./models/user');
    const user = await User.findById(req.session.userId);
    if (!user) {
      console.log('GET /home: User not found for ID:', req.session.userId);
      return res.redirect('/login');
    }
    console.log('GET /home: Rendering for user:', user._id);
    res.render('home', {
      programmingLanguage: user.programmingLanguage.charAt(0).toUpperCase() + user.programmingLanguage.slice(1),
      userId: user._id,
      score: user.score // Pass score to home page
    });
  } catch (err) {
    console.error('Home Route Error:', err.message);
    res.redirect('/login');
  }
});
//Nodejs uses express to handle this HTTP request
app.get('/about', (req, res) => {
  res.render('about');
});
//Nodejs uses express to handle this HTTP request
app.get('/about/me', (req, res) => {
  res.render('about-me');
});
//while this return JSON data (a REST API response).
app.get('/concepts/:topic', async (req, res) => {
  if (!req.session.userId) {
    console.log('GET /concepts/:topic: No userId in session');
    return res.redirect('/login');
  }
  try {
    const User = require('./models/user');
    const user = await User.findById(req.session.userId);
    if (!user) {
      console.log('GET /concepts/:topic: User not found for ID:', req.session.userId);
      return res.redirect('/login');
    }
    const rawTopic = req.params.topic.toUpperCase();
    let displayTopic;
    if (rawTopic === 'PROGRAMMING') {
      displayTopic = user.programmingLanguage.charAt(0).toUpperCase() + user.programmingLanguage.slice(1) + ' Programming';
    } else {
      displayTopic = rawTopic === 'DBMS' ? 'DBMS Concepts' :
                     rawTopic === 'NETWORKING' ? 'Computer Networks' :
                     rawTopic === 'WEBDEV' ? 'Web Technologies' : 'Additional Topics';
    }
    console.log('GET /concepts/:topic: Rendering for topic:', rawTopic, 'Display Topic:', displayTopic);
    res.render('concepts', {
      topic: displayTopic,
      userId: user._id,
      rawTopic: rawTopic,
      programmingLanguage: user.programmingLanguage
    });
  } catch (err) {
    console.error('Concepts Route Error:', err.message);
    res.redirect('/login');
  }
});

app.get('/api/:topic/questions', async (req, res) => {
  try {
    const topic = req.params.topic.toUpperCase();
    const userId = req.session.userId;
    if (!userId) {
      console.log('GET /api/:topic/questions: No userId in session');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const User = require('./models/user');
    const user = await User.findById(userId);
    if (!user) {
      console.log('GET /api/:topic/questions: User not found for ID:', userId);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const Question = require('./models/question');
    let query = { topic, subTopic: 'Concepts' };
    if (topic === 'PROGRAMMING') {
      query.programmingLanguage = user.programmingLanguage;
    }
    const questions = await Question.find(query);
    console.log(`API: Found ${questions.length} questions`);
    res.json(questions);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/questions/complete', async (req, res) => {
  try {
    const { questionId, topic, completed } = req.body;
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const Question = require('./models/question');
    const User = require('./models/user');
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (completed) {
      await Question.updateOne(
        { _id: questionId },
        { $addToSet: { completedBy: userId } }
      );
      console.log(`API: Marked question ${questionId} as complete for user ${userId}`);
    } else {
      await Question.updateOne(
        { _id: questionId },
        { $pull: { completedBy: userId } }
      );
      console.log(`API: Unmarked question ${questionId} for user ${userId}`);
    }
    const t = (topic || '').toUpperCase();
    const q = { topic: t, subTopic: 'Concepts' };
    if (t === 'PROGRAMMING') q.programmingLanguage = user.programmingLanguage;
    const total = await Question.countDocuments(q);
    const completedCount = await Question.countDocuments({ ...q, completedBy: userId });
    const progress = total ? (completedCount / total) * 100 : 0;
    console.log(`API: Updated progress for topic=${topic}. Total: ${total}, Completed: ${completedCount}, Progress: ${progress}%`);
    res.status(200).json({ progress });
  } catch (err) {
    console.error('Complete Question Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/questions/save-note', async (req, res) => {
  try {
    const { questionId, content } = req.body;
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const Question = require('./models/question');
    await Question.updateOne(
      { _id: questionId },
      { $push: { notes: { userId, content, createdAt: new Date() } } }
    );
    res.status(200).json({ message: 'Note saved' });
  } catch (err) {
    console.error('Save Note Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/questions/progress/:topic', async (req, res) => {
  try {
    const topic = req.params.topic.toUpperCase();
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const Question = require('./models/question');
    const User = require('./models/user');
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const q = { topic, subTopic: 'Concepts' };
    if (topic === 'PROGRAMMING') q.programmingLanguage = user.programmingLanguage;
    const total = await Question.countDocuments(q);
    const completed = await Question.countDocuments({ ...q, completedBy: userId });
    const progress = total ? (completed / total) * 100 : 0;
    console.log(`API: Progress for topic=${topic}. Total: ${total}, Completed: ${completed}, Progress: ${progress}%`);
    res.json({ progress });
  } catch (err) {
    console.error('Progress Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/questions/mark-weak', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { questionId, weak } = req.body;
    if (!questionId || typeof weak !== 'boolean') {
      return res.status(400).json({ error: 'questionId and weak (boolean) required' });
    }
    const Question = require('./models/question');
    if (weak) {
      await Question.updateOne({ _id: questionId }, { $addToSet: { markedWeakBy: userId } });
    } else {
      await Question.updateOne({ _id: questionId }, { $pull: { markedWeakBy: userId } });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Mark weak error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/questions/weak-areas/:topic', async (req, res) => {
  try {
    const topic = req.params.topic.toUpperCase();
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const User = require('./models/user');
    const Question = require('./models/question');
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const q = { topic, subTopic: 'Concepts' };
    if (topic === 'PROGRAMMING') q.programmingLanguage = user.programmingLanguage;
    const questions = await Question.find(q).lean();
    const uid = userId.toString();
    const groups = {};
    for (const qu of questions) {
      const cat = inferWeakCategory(topic, qu.question, qu.subTopic);
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
    res.json({
      summary: `Top weak area: ${topWeak}. Focus on incomplete and lightly marked questions first.`,
      areas,
    });
  } catch (err) {
    console.error('Weak areas error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/questions/revision-plan/bulk', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { revisionDate, revisionTime, questionIds } = req.body;
    if (!revisionDate || !Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ error: 'revisionDate and questionIds are required' });
    }
    let timePart = '09:00:00';
    if (typeof revisionTime === 'string' && revisionTime.trim()) {
      const t = revisionTime.trim();
      const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t);
      if (m) {
        const hh = String(Math.min(23, parseInt(m[1], 10))).padStart(2, '0');
        const mm = String(Math.min(59, parseInt(m[2], 10))).padStart(2, '0');
        const ss = m[3] != null ? String(Math.min(59, parseInt(m[3], 10))).padStart(2, '0') : '00';
        timePart = `${hh}:${mm}:${ss}`;
      }
    }
    const reminderAt = new Date(`${revisionDate}T${timePart}`);
    if (isNaN(reminderAt.getTime())) {
      return res.status(400).json({ error: 'Invalid revision date or time' });
    }
    const Question = require('./models/question');
    let created = 0;
    for (const qid of questionIds) {
      const question = await Question.findById(qid);
      if (!question) continue;
      await RevisionReminder.create({
        user: userId,
        question: qid,
        topic: question.topic,
        reminderAt,
      });
      created += 1;
    }
    res.json({ message: 'Revision plan saved', count: created });
  } catch (err) {
    console.error('Bulk revision error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const ASSISTANT_SYSTEM_PROMPT =
  'You are PrepTrack Assistant for technical interview prep (DBMS, networking, web dev, programming). Answer clearly and concisely. If asked for a specific line count (e.g. "in 4 lines"), follow it.';

/** Default: widely available on OpenRouter; override with OPENROUTER_MODEL in .env */
const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';

function historyToOpenRouterMessages(convMessages) {
  return (convMessages || [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-24)
    .map((m) => ({ role: m.role, content: m.content || '' }));
}

async function loadOrCreateConversation(userId, topic, conversationId, firstUserText) {
  if (conversationId && mongoose.isValidObjectId(conversationId)) {
    const existing = await ChatConversation.findOne({ _id: conversationId, user: userId });
    if (existing) return existing;
  }
  return ChatConversation.create({
    user: userId,
    topic: topic || 'DBMS',
    title: firstUserText.slice(0, 80),
    messages: [],
  });
}

/**
 * OpenRouter chat completions (OpenAI-compatible). Optional OPENROUTER_FALLBACK_MODEL.
 * Set OPENROUTER_REASONING=true only if your model supports it.
 */
async function openRouterComplete(headers, messages, maxTokens) {
  const primary = (process.env.OPENROUTER_MODEL || '').trim() || DEFAULT_OPENROUTER_MODEL;
  const secondary = (process.env.OPENROUTER_FALLBACK_MODEL || '').trim();
  const models = [...new Set([primary, secondary].filter(Boolean))];
  const useReasoning = process.env.OPENROUTER_REASONING === 'true';
  const maxAttempts = 2;
  const baseDelayMs = 800;
  let lastError = '';

  for (const model of models) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const body = { model, messages, max_tokens: maxTokens };
      if (useReasoning) {
        body.reasoning = { enabled: true };
      }

      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      const errMsg = data?.error?.message || data?.message || r.statusText || '';

      if (r.ok) {
        const rawMessage = data.choices?.[0]?.message;
        const text = extractChatContent(rawMessage);
        if (text) {
          return { ok: true, reply: text, modelUsed: model };
        }
        lastError = 'empty reply from model';
        if (attempt < maxAttempts) {
          await new Promise((res) => setTimeout(res, baseDelayMs * attempt));
          continue;
        }
        break;
      }

      lastError = errMsg || `HTTP ${r.status}`;
      const transient =
        /provider returned error|temporar|rate|overload|timeout|unavailable/i.test(String(lastError)) ||
        r.status === 429 ||
        (r.status >= 500 && r.status < 600);

      if (transient && attempt < maxAttempts) {
        console.warn(`OpenRouter "${model}" (${attempt}/${maxAttempts}): ${lastError}`);
        await new Promise((res) => setTimeout(res, baseDelayMs * attempt));
        continue;
      }

      if (models.length > 1 && model === models[0]) {
        break;
      }
      return { ok: false, error: lastError, data, status: r.status };
    }
  }

  return { ok: false, error: lastError || 'All OpenRouter attempts failed' };
}

app.get('/api/assistant/conversations', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const rows = await ChatConversation.find({ user: userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select('title topic updatedAt createdAt')
      .lean();
    res.json(
      rows.map((r) => ({
        id: r._id.toString(),
        title: r.title || 'Chat',
        topic: r.topic,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt,
      }))
    );
  } catch (err) {
    console.error('Assistant list error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/assistant/conversations/:id', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const doc = await ChatConversation.findOne({ _id: req.params.id, user: userId }).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({
      id: doc._id.toString(),
      title: doc.title,
      topic: doc.topic,
      messages: doc.messages || [],
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    console.error('Assistant get error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/assistant/chat', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const User = require('./models/user');
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { message, topic: topicFromClient, conversationId: convIdFromClient } = req.body;
    const textIn = typeof message === 'string' ? message.trim() : '';
    if (!textIn) return res.status(400).json({ error: 'Message required' });

    const topic =
      typeof topicFromClient === 'string' && topicFromClient.trim()
        ? topicFromClient.trim().toUpperCase()
        : 'DBMS';

    if (shouldAnswerLocally(textIn)) {
      const conv = await loadOrCreateConversation(userId, topic, convIdFromClient, textIn);
      const reply = await buildLocalAssistantReply(textIn, userId, user, topic);
      conv.messages.push({ role: 'user', content: textIn, source: null, createdAt: new Date() });
      conv.messages.push({
        role: 'assistant',
        content: reply,
        source: 'local',
        createdAt: new Date(),
      });
      if (!conv.title || conv.title.length < 3) conv.title = textIn.slice(0, 80);
      conv.topic = topic;
      await conv.save();
      return res.json({ reply, source: 'local', conversationId: conv._id.toString() });
    }

    const orKey = process.env.OPENROUTER_API_KEY;
    const oaiKey = process.env.OPENAI_API_KEY;
    const apiKey = orKey || oaiKey;
    const useOpenRouter = Boolean(orKey) || (Boolean(oaiKey) && String(oaiKey).trim().startsWith('sk-or'));

    if (!apiKey) {
      return res.json({
        reply:
          'Add OPENROUTER_API_KEY (or OPENAI_API_KEY) to your .env in the project root, then restart the server.',
      });
    }

    const conv = await loadOrCreateConversation(userId, topic, convIdFromClient, textIn);

    const history = historyToOpenRouterMessages(conv.messages);

    const apiMessages = [
      { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: textIn },
    ];

    let reply;
    let source = 'openrouter';

    if (useOpenRouter) {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
      const referer = process.env.OPENROUTER_HTTP_REFERER || process.env.APP_PUBLIC_URL;
      if (referer) headers['HTTP-Referer'] = referer;
      if (process.env.OPENROUTER_TITLE) headers['X-Title'] = process.env.OPENROUTER_TITLE;

      const result = await openRouterComplete(headers, apiMessages, 1024);
      if (!result.ok) {
        reply = `Assistant error: ${result.error || 'Request failed'}. Set OPENROUTER_MODEL or OPENROUTER_FALLBACK_MODEL in .env if the default model is unavailable.`;
        source = 'error';
      } else {
        reply = result.reply;
        source = 'openrouter';
      }
    } else {
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: apiMessages,
          max_tokens: 1024,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        reply = `Assistant error: ${data?.error?.message || r.statusText}`;
        source = 'error';
      } else {
        reply =
          extractChatContent(data.choices?.[0]?.message) ||
          'Sorry, I could not generate a reply.';
        source = 'openai';
      }
    }

    conv.messages.push({ role: 'user', content: textIn, source: null, createdAt: new Date() });
    conv.messages.push({
      role: 'assistant',
      content: reply,
      source,
      createdAt: new Date(),
    });
    if (!conv.title || conv.title.length < 3) conv.title = textIn.slice(0, 80);
    conv.topic = topic;
    await conv.save();

    res.json({ reply, source, conversationId: conv._id.toString() });
  } catch (err) {
    console.error('Assistant error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/logout', (req, res) => {
  console.log('GET /logout: Destroying session');
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.get('/challenges/:topic', async (req, res) => {
  if (!req.session.userId) {
    console.log('GET /challenges/:topic: No userId in session');
    return res.redirect('/login');
  }
  try {
    const User = require('./models/user');
    const user = await User.findById(req.session.userId);
    if (!user) {
      console.log('GET /challenges/:topic: User not found for ID:', req.session.userId);
      return res.redirect('/login');
    }
    const rawTopic = req.params.topic.toUpperCase();
    res.render('challenges', {
      topic: rawTopic === 'DBMS' ? 'DBMS Concepts' : rawTopic,
      userId: user._id,
      rawTopic,
      score: user.score // Correctly passing score
    });
  } catch (err) {
    console.error('Challenges Route Error:', err.message);
    res.redirect('/login');
  }
});

app.get('/api/questions/challenges/dbms/:section', async (req, res) => {
  try {
    const section = req.params.section;
    const userId = req.session.userId;
    if (!userId) {
      console.log('GET /api/questions/challenges/dbms/:section: No userId in session');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const Challenge = require('./models/challenge');
    const challenges = await Challenge.find({ topic: 'DBMS', section: section }).limit(10);
    console.log(`API: Found ${challenges.length} challenges for DBMS section=${section}`);
    res.json(challenges);
  } catch (err) {
    console.error('DBMS Challenges Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/questions/challenges/data/:topic', async (req, res) => {
  try {
    const topic = req.params.topic.toUpperCase();
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const Challenge = require('./models/challenge');
    const challenges = await Challenge.find({ topic: topic });
    console.log(`API: Found ${challenges.length} challenges for ${topic}`);
    res.json(challenges);
  } catch (err) {
    console.error('Challenges Data Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/questions/challenges/dbms/validate', async (req, res) => {
  try {
    const { challengeId, userQuery } = req.body;
    const userId = req.session.userId;
    if (!userId) {
      console.log('POST /api/questions/challenges/dbms/validate: No userId in session');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const Challenge = require('./models/challenge');
    const User = require('./models/user');
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      console.log('Challenge not found for ID:', challengeId);
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Reset SQLite database
    await new Promise((resolve) => resetDB(db, resolve));

    // Execute user query
    const userResult = await new Promise((resolve, reject) => {
      db.all(userQuery, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });

    // Execute correct query
    const correctResult = await new Promise((resolve, reject) => {
      db.all(challenge.correctQuery, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });

    // Compare results (deep comparison of rows)
    const isCorrect = JSON.stringify(userResult) === JSON.stringify(correctResult);

    if (isCorrect && !challenge.completedBy.includes(userId)) {
      await Challenge.updateOne(
        { _id: challengeId },
        { $addToSet: { completedBy: userId } }
      );
      await User.updateOne(
        { _id: userId },
        { $inc: { score: 10 } } // Award 10 points per correct query
      );
      console.log(`API: Query correct for challenge ${challengeId}, user ${userId}, score updated`);
    }

    res.json({ isCorrect });
  } catch (err) {
    console.error('Query Validation Error:', err.message);
    res.status(500).json({ error: 'Query execution failed: ' + err.message });
  }
});

app.use('/api/questions', questionRoutes);
app.use('/api/auth', authRoutes);

const mailUser = process.env.EMAIL_USER;
const mailPass = process.env.EMAIL_PASS;
let transporter = null;

if (mailUser && mailPass) {
  const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const emailPort = parseInt(process.env.EMAIL_PORT || '587', 10);
  /** Port 465 = SSL from the start; 587 = STARTTLS (upgrade). Wrong combo → "Unexpected socket close". */
  const secureExplicit = process.env.EMAIL_SECURE;
  const secure =
    secureExplicit === 'true' || (secureExplicit !== 'false' && emailPort === 465);

  transporter = nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure,
    auth: {
      user: mailUser,
      pass: mailPass,
    },
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    ...(process.env.EMAIL_REQUIRE_TLS === 'true' && !secure ? { requireTLS: true } : {}),
    tls: {
      minVersion: 'TLSv1.2',
    },
  });

  transporter.verify((err) => {
    if (err) {
      console.warn(
        'SMTP verify failed (reminders may not send). Check EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, and app password:',
        err.message
      );
    } else {
      console.log('SMTP ready for revision reminder emails.');
    }
  });
} else {
  console.warn('Email credentials not configured. Revision reminder emails will not be sent.');
}

async function processDueReminders() {
  if (!transporter) {
    return;
  }
  const now = new Date();
  try {
    const dueReminders = await RevisionReminder.find({
      sent: false,
      reminderAt: { $lte: now }
    })
      .populate('user')
      .populate('question')
      .limit(50);

    for (const reminder of dueReminders) {
      if (!reminder.user || !reminder.user.email || !reminder.question) {
        continue;
      }

      const subject = `PrepTrack Revision Reminder - ${reminder.topic || 'Interview Prep'}`;
      const text = [
        `Hi ${reminder.user.name || 'there'},`,
        '',
        'This is your scheduled PrepTrack revision reminder.',
        '',
        `Topic: ${reminder.topic || 'General'}`,
        `Question: ${reminder.question.question}`,
        '',
        `Scheduled for: ${reminder.reminderAt.toLocaleString()}`,
        '',
        'Good luck with your preparation!',
        'PrepTrack'
      ].join('\n');

      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || mailUser,
          to: reminder.user.email,
          subject,
          text
        });

        reminder.sent = true;
        await reminder.save();
        console.log('Sent revision reminder email for reminder id:', reminder._id);
      } catch (err) {
        console.error('Error sending reminder email:', err.message);
      }
    }
  } catch (err) {
    console.error('Error processing due reminders:', err.message);
  }
}

// Check for due reminders every minute
setInterval(processDueReminders, 60 * 1000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));