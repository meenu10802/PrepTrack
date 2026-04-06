console.log('Concepts script loaded');

let chartInstance = null;
let totalQuestions = 0;
let cachedQuestions = [];
const plannerSelected = new Map();

let assistantConversationId = null;

function assistantConvStorageKey() {
    return `preptrack-assistant-conv-${topic}`;
}

function restoreAssistantConversationId() {
    try {
        const s = sessionStorage.getItem(assistantConvStorageKey());
        assistantConversationId = s || null;
    } catch (_) {
        assistantConversationId = null;
    }
}

function persistAssistantConversationId() {
    try {
        if (assistantConversationId) sessionStorage.setItem(assistantConvStorageKey(), assistantConversationId);
        else sessionStorage.removeItem(assistantConvStorageKey());
    } catch (_) {
        /* ignore */
    }
}

function renderAssistantWelcomeOnly() {
    const chat = document.getElementById('assistant-chat');
    if (!chat) return;
    chat.innerHTML =
        '<div class="assistant-msg assistant-msg-bot" data-welcome="true">Hi, I am your PrepTrack assistant. Ask me about progress, weak areas, or revision planning.</div>';
}

function newAssistantChat() {
    assistantConversationId = null;
    persistAssistantConversationId();
    renderAssistantWelcomeOnly();
    const panel = document.getElementById('assistant-history-panel');
    const btn = document.getElementById('btn-assistant-history');
    if (panel) panel.style.display = 'none';
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

function appendAssistantBubble(role, text) {
    const chat = document.getElementById('assistant-chat');
    if (!chat) return;
    const div = document.createElement('div');
    div.className = role === 'user' ? 'assistant-msg assistant-msg-user' : 'assistant-msg assistant-msg-bot';
    div.textContent = text;
    chat.appendChild(div);
}

async function openAssistantConversation(id) {
    try {
        const r = await fetch(`/api/assistant/conversations/${encodeURIComponent(id)}`, { credentials: 'include' });
        if (!r.ok) throw new Error('fail');
        const data = await r.json();
        assistantConversationId = data.id;
        persistAssistantConversationId();
        const chat = document.getElementById('assistant-chat');
        if (!chat) return;
        chat.innerHTML = '';
        const msgs = data.messages || [];
        if (msgs.length === 0) {
            renderAssistantWelcomeOnly();
        } else {
            msgs.forEach((m) => appendAssistantBubble(m.role, m.content));
        }
        const panel = document.getElementById('assistant-history-panel');
        const btn = document.getElementById('btn-assistant-history');
        if (panel) panel.style.display = 'none';
        if (btn) btn.setAttribute('aria-expanded', 'false');
        chat.scrollTop = chat.scrollHeight;
    } catch {
        assistantConversationId = null;
        persistAssistantConversationId();
        renderAssistantWelcomeOnly();
        alert('Could not open that chat.');
    }
}

async function loadAssistantHistoryList() {
    const list = document.getElementById('assistant-history-list');
    if (!list) return;
    list.innerHTML = '<p class="assistant-history-loading">Loading…</p>';
    try {
        const r = await fetch('/api/assistant/conversations', { credentials: 'include' });
        const data = await r.json();
        if (!Array.isArray(data) || data.length === 0) {
            list.innerHTML = '<p class="assistant-history-empty">No saved chats yet. Send a message to start.</p>';
            return;
        }
        list.innerHTML = '';
        data.forEach((row) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'assistant-history-item';
            const when = row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '';
            btn.innerHTML = `<span class="assistant-history-title">${escapeHtml(row.title)}</span><span class="assistant-history-meta">${escapeHtml(row.topic || '')} · ${escapeHtml(when)}</span>`;
            btn.addEventListener('click', () => openAssistantConversation(row.id));
            list.appendChild(btn);
        });
    } catch {
        list.innerHTML = '<p class="assistant-history-empty">Could not load history.</p>';
    }
}

function uidStr(id) {
    return typeof id === 'string' ? id : id && id.toString();
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close')));
});

document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.style.display = 'none';
    });
});

document.getElementById('btn-weak-analyzer')?.addEventListener('click', () => {
    openModal('modal-weak');
    loadWeakAreas();
});

document.getElementById('btn-refresh-insights')?.addEventListener('click', () => loadWeakAreas());

function ensurePlannerDateTimeDefaults() {
    const dateInput = document.getElementById('revision-date-input');
    const timeInput = document.getElementById('revision-time-input');
    if (dateInput && !dateInput.value) {
        const d = new Date();
        dateInput.value = d.toISOString().slice(0, 10);
    }
    if (timeInput && !timeInput.value) {
        timeInput.value = '09:00';
    }
}

document.getElementById('btn-revision-planner')?.addEventListener('click', () => {
    openModal('modal-planner');
    ensurePlannerDateTimeDefaults();
    renderPlannerBank();
    renderPlannerSelected();
});

document.getElementById('btn-assistant')?.addEventListener('click', async () => {
    openModal('modal-assistant');
    restoreAssistantConversationId();
    if (assistantConversationId) {
        await openAssistantConversation(assistantConversationId);
    } else {
        renderAssistantWelcomeOnly();
    }
});

document.getElementById('btn-assistant-new-chat')?.addEventListener('click', () => newAssistantChat());

document.getElementById('btn-assistant-history')?.addEventListener('click', () => {
    const panel = document.getElementById('assistant-history-panel');
    const btn = document.getElementById('btn-assistant-history');
    if (!panel || !btn) return;
    const isOpen = panel.style.display === 'block';
    if (isOpen) {
        panel.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
    } else {
        panel.style.display = 'block';
        btn.setAttribute('aria-expanded', 'true');
        loadAssistantHistoryList();
    }
});

document.getElementById('btn-assistant-send')?.addEventListener('click', sendAssistantMessage);
document.getElementById('assistant-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendAssistantMessage();
});

document.getElementById('planner-search')?.addEventListener('input', renderPlannerBank);

document.getElementById('btn-save-revision-plan')?.addEventListener('click', saveRevisionPlanBulk);

async function loadWeakAreas() {
    const summaryEl = document.getElementById('weak-summary');
    const listEl = document.getElementById('weak-areas-list');
    if (!summaryEl || !listEl) return;
    summaryEl.textContent = 'Loading insights…';
    listEl.innerHTML = '';
    try {
        const response = await fetch(`/api/questions/weak-areas/${topic}`, {
            credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to load');
        const data = await response.json();
        summaryEl.textContent = data.summary || '';
        listEl.innerHTML = '';
        (data.areas || []).forEach((a) => {
            const card = document.createElement('div');
            card.className = 'weak-area-card';
            card.innerHTML = `
                <div class="weak-area-card-top">
                    <span class="weak-area-name">${escapeHtml(a.name)}</span>
                    <span class="weak-area-score">Score ${a.score}</span>
                </div>
                <div class="weak-area-meta">
                    Pending: ${a.pending} / ${a.total} · Marked: ${a.marked} · Completion: ${a.completionPct}%
                </div>
                <div class="weak-area-priority">${escapeHtml(a.priority)} priority</div>
                <p class="weak-area-advice">${escapeHtml(a.advice)}</p>
            `;
            listEl.appendChild(card);
        });
    } catch (err) {
        console.error(err);
        summaryEl.textContent = 'Could not load insights. Try again.';
    }
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function renderPlannerBank() {
    const bank = document.getElementById('planner-bank');
    if (!bank) return;
    const q = (document.getElementById('planner-search')?.value || '').trim().toLowerCase();
    bank.innerHTML = '';
    cachedQuestions.forEach((item) => {
        const text = item.question || '';
        if (q && !text.toLowerCase().includes(q)) return;
        const id = uidStr(item._id);
        if (plannerSelected.has(id)) return;
        const row = document.createElement('div');
        row.className = 'planner-bank-item';
        row.innerHTML = `
            <span class="planner-qtext">${escapeHtml(text)}</span>
            <button type="button" class="btn-planner-add">Add</button>
        `;
        row.querySelector('.btn-planner-add').addEventListener('click', () => {
            plannerSelected.set(id, text);
            renderPlannerBank();
            renderPlannerSelected();
        });
        bank.appendChild(row);
    });
}

function renderPlannerSelected() {
    const box = document.getElementById('planner-selected');
    const summary = document.getElementById('planner-selected-summary');
    const dateVal = document.getElementById('revision-date-input')?.value || '';
    const timeVal = document.getElementById('revision-time-input')?.value || '';
    if (summary) {
        const when = dateVal
            ? `${dateVal}${timeVal ? ` at ${timeVal}` : ''}`
            : 'selected date & time';
        summary.textContent = `${plannerSelected.size} question(s) selected for ${when}`;
        summary.classList.toggle('planner-selected-summary-active', plannerSelected.size > 0 && dateVal);
    }
    if (!box) return;
    box.innerHTML = '';
    plannerSelected.forEach((text, id) => {
        const row = document.createElement('div');
        row.className = 'planner-selected-item';
        row.innerHTML = `
            <span class="planner-qtext">${escapeHtml(text)}</span>
            <button type="button" class="btn-planner-remove">Remove</button>
        `;
        row.querySelector('.btn-planner-remove').addEventListener('click', () => {
            plannerSelected.delete(id);
            renderPlannerBank();
            renderPlannerSelected();
        });
        box.appendChild(row);
    });
}

document.getElementById('revision-date-input')?.addEventListener('change', renderPlannerSelected);
document.getElementById('revision-time-input')?.addEventListener('change', renderPlannerSelected);

async function saveRevisionPlanBulk() {
    const dateVal = document.getElementById('revision-date-input')?.value;
    const timeVal = document.getElementById('revision-time-input')?.value || '09:00';
    if (!dateVal) {
        alert('Please pick a revision date.');
        return;
    }
    if (plannerSelected.size === 0) {
        alert('Add at least one question to your plan.');
        return;
    }
    try {
        const response = await fetch('/api/questions/revision-plan/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                revisionDate: dateVal,
                revisionTime: timeVal,
                questionIds: Array.from(plannerSelected.keys()),
            }),
        });
        if (!response.ok) {
            const t = await response.text();
            throw new Error(t);
        }
        const data = await response.json();
        alert(data.message || 'Saved.');
        plannerSelected.clear();
        renderPlannerBank();
        renderPlannerSelected();
        closeModal('modal-planner');
    } catch (err) {
        console.error(err);
        alert('Could not save revision plan.');
    }
}

async function sendAssistantMessage() {
    const input = document.getElementById('assistant-input');
    const chat = document.getElementById('assistant-chat');
    if (!input || !chat) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    const userBubble = document.createElement('div');
    userBubble.className = 'assistant-msg assistant-msg-user';
    userBubble.textContent = text;
    chat.appendChild(userBubble);
    try {
        const response = await fetch('/api/assistant/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                message: text,
                topic,
                conversationId: assistantConversationId || undefined,
            }),
        });
        const data = await response.json();
        if (data.conversationId) {
            assistantConversationId = data.conversationId;
            persistAssistantConversationId();
        }
        const botBubble = document.createElement('div');
        botBubble.className = 'assistant-msg assistant-msg-bot';
        botBubble.textContent = data.reply || data.error || 'No response.';
        chat.appendChild(botBubble);
    } catch (err) {
        const botBubble = document.createElement('div');
        botBubble.className = 'assistant-msg assistant-msg-bot';
        botBubble.textContent = 'Something went wrong. Try again.';
        chat.appendChild(botBubble);
    }
    chat.scrollTop = chat.scrollHeight;
}

function openPlannerWithQuestion(questionId) {
    openModal('modal-planner');
    ensurePlannerDateTimeDefaults();
    const q = cachedQuestions.find((x) => uidStr(x._id) === uidStr(questionId));
    if (q) plannerSelected.set(uidStr(q._id), q.question);
    renderPlannerBank();
    renderPlannerSelected();
}

async function toggleMarkWeak(questionId) {
    const q = cachedQuestions.find((x) => uidStr(x._id) === uidStr(questionId));
    const uid = getUserId();
    const isWeak = q && q.markedWeakBy ? q.markedWeakBy.some((x) => uidStr(x) === uidStr(uid)) : false;
    try {
        const response = await fetch('/api/questions/mark-weak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ questionId, weak: !isWeak }),
        });
        if (!response.ok) throw new Error('failed');
        const btn = document.getElementById(`mark-weak-${questionId}`);
        const nowWeak = !isWeak;
        if (btn) {
            btn.classList.toggle('mark-weak-active', nowWeak);
            btn.textContent = nowWeak ? 'Weak ✓' : 'Mark Weak';
        }
        if (q) {
            if (nowWeak) {
                if (!q.markedWeakBy) q.markedWeakBy = [];
                if (!q.markedWeakBy.some((x) => uidStr(x) === uidStr(uid))) q.markedWeakBy.push(uid);
            } else {
                q.markedWeakBy = (q.markedWeakBy || []).filter((id) => uidStr(id) !== uidStr(uid));
            }
        }
    } catch (err) {
        console.error(err);
        alert('Could not update weak mark.');
    }
}

async function loadConcepts() {
    const questionList = document.getElementById('question-list');
    questionList.innerHTML = '<li>Loading...</li>';
    try {
        const response = await fetch(`/api/${topic.toUpperCase()}/questions`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            if (response.status === 401) {
                questionList.innerHTML = '<li>Please log in to view secrets</li>';
                return;
            }
            throw new Error(`HTTP error: ${response.status}`);
        }
        const questions = await response.json();
        questionList.innerHTML = '';
        if (questions.length === 0) {
            questionList.innerHTML = '<li>No questions found for this topic.</li>';
            return;
        }

        cachedQuestions = questions;
        totalQuestions = questions.length;

        questions.forEach((q, index) => {
            const id = uidStr(q._id);
            const isCompleted = q.completedBy ? q.completedBy.some((x) => uidStr(x) === uidStr(getUserId())) : false;
            const isWeak = q.markedWeakBy ? q.markedWeakBy.some((x) => uidStr(x) === uidStr(getUserId())) : false;
            const note =
                q.notes && q.notes.find((n) => uidStr(n.userId) === uidStr(getUserId()))
                    ? q.notes.find((n) => uidStr(n.userId) === uidStr(getUserId())).content
                    : '';

            const li = document.createElement('li');
            li.className = 'question-item';
            li.id = `question-${id}`;
            li.innerHTML = `
                <div class="question-header">
                    <div class="question-left">
                        <input type="checkbox" id="complete-${id}" ${isCompleted ? 'checked' : ''} onchange="markCompleted('${id}', this)">
                        <span class="question-text" onclick="toggleAnswer(${index})">${escapeHtml(q.question)}</span>
                    </div>
                    <div class="question-right">
                        <span id="label-${id}" class="complete-label ${isCompleted ? 'complete-done' : ''}">Complete</span>
                        <button type="button" class="btn-mark-weak ${isWeak ? 'mark-weak-active' : ''}" id="mark-weak-${id}">${isWeak ? 'Weak ✓' : 'Mark Weak'}</button>
                        <button type="button" class="btn-plan" onclick="openPlannerWithQuestion('${id}')">Plan</button>
                        <button type="button" class="note-toggle" onclick="toggleNoteEditor('${id}')">Note</button>
                    </div>
                </div>
                <div class="answer" id="answer-${index}" style="display: none;">${q.answer}</div>
                <div class="note-editor" id="note-editor-${id}" style="display: none;">
                    <textarea id="note-${id}" placeholder="Write your notes...">${escapeHtml(note)}</textarea>
                    <button onclick="saveNote('${id}')">Save Note</button>
                </div>
            `;
            questionList.appendChild(li);

            const mw = document.getElementById(`mark-weak-${id}`);
            if (mw) mw.addEventListener('click', () => toggleMarkWeak(id));
        });

        await updateProgress(totalQuestions);
    } catch (err) {
        console.error('Error loading questions:', err.message, err.stack);
        questionList.innerHTML = '<li>Error: Failed to load questions. ' + err.message + '</li>';
    }
}

function toggleAnswer(index) {
    const answerDiv = document.getElementById(`answer-${index}`);
    if (!answerDiv) return;
    answerDiv.style.display = answerDiv.style.display === 'none' ? 'block' : 'none';
}

function toggleNoteEditor(questionId) {
    const noteEditor = document.getElementById(`note-editor-${questionId}`);
    if (!noteEditor) return;
    noteEditor.style.display = noteEditor.style.display === 'none' ? 'block' : 'none';
    noteEditor.classList.toggle('active', noteEditor.style.display === 'block');
}

async function markCompleted(questionId, checkbox) {
    const label = document.getElementById(`label-${questionId}`);
    try {
        const response = await fetch('/api/questions/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ questionId, topic: topic.toUpperCase(), completed: checkbox.checked }),
        });
        const responseText = await response.text();
        if (!response.ok) throw new Error(responseText);
        const data = JSON.parse(responseText);
        const pct = Math.round(data.progress * 10) / 10;
        document.getElementById('progress-text').textContent = `Progress: ${pct}%`;
        if (label) {
            label.textContent = 'Complete';
            label.classList.toggle('complete-done', checkbox.checked);
        }
        const q = cachedQuestions.find((x) => uidStr(x._id) === uidStr(questionId));
        if (q) {
            const uid = getUserId();
            if (checkbox.checked) {
                if (!q.completedBy) q.completedBy = [];
                if (!q.completedBy.some((x) => uidStr(x) === uidStr(uid))) q.completedBy.push(uid);
            } else {
                q.completedBy = (q.completedBy || []).filter((x) => uidStr(x) !== uidStr(uid));
            }
        }
        updateChart(totalQuestions, data.progress);
    } catch (err) {
        console.error('Error marking completed:', err.message);
        checkbox.checked = !checkbox.checked;
        if (label) label.classList.toggle('complete-done', checkbox.checked);
    }
}

async function saveNote(questionId) {
    try {
        const content = document.getElementById(`note-${questionId}`).value;
        const response = await fetch('/api/questions/save-note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ questionId, content }),
        });
        if (!response.ok) throw new Error('Failed to save note');
    } catch (err) {
        console.error('Error saving note:', err.message);
    }
}

async function updateProgress(tq) {
    try {
        const response = await fetch(`/api/questions/progress/${topic.toUpperCase()}`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch progress');
        const data = await response.json();
        const pct = Math.round(data.progress * 10) / 10;
        document.getElementById('progress-text').textContent = `Progress: ${pct}%`;
        updateChart(tq, data.progress);
    } catch (err) {
        console.error('Error fetching progress:', err.message);
    }
}

function updateChart(tq, progress) {
    if (!tq || tq <= 0) return;
    const progressNum = typeof progress === 'number' && !isNaN(progress) ? progress : 0;
    const completedQuestions = Math.round((progressNum / 100) * tq);
    const remaining = Math.max(0, tq - completedQuestions);

    const canvas = document.getElementById('completion-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (chartInstance) chartInstance.destroy();
    try {
        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Remaining'],
                datasets: [
                    {
                        data: [completedQuestions, remaining],
                        backgroundColor: ['#7dd3fc', '#1e3a5f'],
                        borderColor: ['#ffffff', '#ffffff'],
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '68%',
                plugins: {
                    legend: { display: false },
                },
            },
        });
    } catch (err) {
        console.error('Error creating chart:', err.message);
    }
}

window.markCompleted = markCompleted;
window.toggleAnswer = toggleAnswer;
window.toggleNoteEditor = toggleNoteEditor;
window.saveNote = saveNote;
window.openPlannerWithQuestion = openPlannerWithQuestion;

loadConcepts();
