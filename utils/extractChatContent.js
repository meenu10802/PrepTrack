/**
 * Normalizes assistant text from OpenAI / OpenRouter responses.
 * Reasoning models may use array content, nested text objects, or alternate fields.
 */
function extractChatContent(message) {
  if (!message || typeof message !== 'object') return '';

  let c = message.content;
  if (typeof c === 'string' && c.trim()) return c.trim();

  if (Array.isArray(c)) {
    const parts = [];
    for (const part of c) {
      if (typeof part === 'string') parts.push(part);
      else if (part && typeof part === 'object') {
        if (part.type === 'text') {
          if (typeof part.text === 'string') parts.push(part.text);
          else if (part.text && typeof part.text.value === 'string') parts.push(part.text.value);
        }
      }
    }
    const joined = parts.join('').trim();
    if (joined) return joined;
  }

  const altKeys = ['reasoning', 'reasoning_content', 'thinking', 'output_text'];
  for (const k of altKeys) {
    const v = message[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }

  if (message.reasoning_details && Array.isArray(message.reasoning_details)) {
    const text = message.reasoning_details
      .map((d) => (typeof d === 'string' ? d : d?.text || d?.content || ''))
      .filter(Boolean)
      .join('\n')
      .trim();
    if (text) return text;
  }

  return '';
}

module.exports = { extractChatContent };
