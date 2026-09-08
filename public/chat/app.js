const history = [];
const messages = document.querySelector('#messages');
const form = document.querySelector('#form');
const input = document.querySelector('#message');
const sendButton = form.querySelector('button');
const emptyState = document.querySelector('#empty-state');

function render(role, content) {
  if (emptyState) emptyState.remove();
  const row = document.createElement('div');
  row.className = `message-row ${role}`;
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = role === 'user' ? '👤' : '✦';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = content;
  row.append(avatar, bubble);
  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;
  return row;
}

function renderTyping() { const row = render('assistant', '•••'); row.classList.add('typing'); return row; }
function resizeInput() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 130)}px`; }
input.addEventListener('input', resizeInput);
input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || sendButton.disabled) return;
  input.value = '';
  resizeInput();
  render('user', message);
  const typing = renderTyping();
  const provider = document.querySelector('#provider').value;
  const model = document.querySelector('#model').value.trim();
  sendButton.disabled = true;
  try {
    const response = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, history, provider, model }) });
    const data = await response.json();
    typing.remove();
    const reply = data.reply || data.error || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    render('assistant', reply);
    history.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
  } catch {
    typing.remove();
    render('assistant', 'เชื่อมต่อ backend ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
});