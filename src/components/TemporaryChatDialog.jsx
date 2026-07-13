import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, IconButton } from './ui.jsx';

function formatMessageAge(createdAt) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(createdAt)) / 1000));
  if (elapsedSeconds < 45) return 'now';
  const minutes = Math.floor(elapsedSeconds / 60);
  return `${minutes}m`;
}

function ChatStatus({ status, error }) {
  if (status === 'connected') return null;

  const copy = {
    loading: 'Connecting to the workshop…',
    unconfigured: 'Supabase environment variables are missing.',
    'setup-required': error || 'Temporary chat needs its Supabase setup script.',
    unavailable: error || 'Temporary chat is unavailable right now.',
  }[status] || error;

  return (
    <div className={`temporary-chat__notice is-${status}`} role="status">
      <span aria-hidden="true" />
      <p>{copy}</p>
    </div>
  );
}

export default function TemporaryChatDialog({ chat, onClose }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const inputRef = useRef(null);
  const closeButtonRef = useRef(null);
  const messageListRef = useRef(null);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) return;
    messageList.scrollTop = messageList.scrollHeight;
  }, [chat.messages.length]);

  const handleSubmit = async event => {
    event.preventDefault();
    if (sending) return;

    setSending(true);
    setFormError('');
    try {
      await chat.sendMessage(draft);
      setDraft('');
      inputRef.current?.focus();
    } catch (sendError) {
      setFormError(sendError instanceof Error ? sendError.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      onClose={onClose}
      className="temporary-chat"
      overlayClassName="temporary-chat-overlay"
      labelledBy="temporary-chat-title"
      describedBy="temporary-chat-description"
      initialFocusRef={chat.status === 'connected' ? inputRef : closeButtonRef}
    >
      <header className="temporary-chat__header">
        <div className="temporary-chat__title-lockup">
          <span className="temporary-chat__eyebrow">Workshop channel · temporary</span>
          <div className="temporary-chat__title-row">
            <h2 id="temporary-chat-title">Editor chat</h2>
            <span className={`temporary-chat__connection is-${chat.status}`}>
              <span aria-hidden="true" />
              {chat.status === 'connected' ? 'Live' : 'Offline'}
            </span>
          </div>
          <p id="temporary-chat-description">Plain-text notes for people currently using BAR Editor.</p>
        </div>
        <IconButton ref={closeButtonRef} variant="quiet" className="temporary-chat__close" onClick={onClose} label="Close editor chat">
          <svg viewBox="0 0 16 16"><path d="m4 4 8 8M12 4l-8 8" /></svg>
        </IconButton>
      </header>

      <div className="temporary-chat__policy" aria-label="Chat rules">
        <span>Signed as <strong>{chat.identity.name}</strong></span>
        <span>No links</span>
        <span>Clears after {chat.retentionMinutes} minutes</span>
      </div>

      <div className="temporary-chat__feed">
        <ChatStatus status={chat.status} error={chat.error} />
        <div
          ref={messageListRef}
          className="temporary-chat__messages"
          role="log"
          aria-label="Temporary editor chat messages"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {chat.messages.length === 0 ? (
            <div className="temporary-chat__empty">
              <span aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M5 5.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7l-4.5 3v-3H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" /><path d="M7.5 9.5h9M7.5 12.5h6" /></svg>
              </span>
              <strong>The workshop is quiet.</strong>
              <p>Leave a short note for anyone currently editing.</p>
            </div>
          ) : (
            chat.messages.map(message => {
              const isOwn = message.sender_id === chat.identity.id;
              return (
                <article key={message.id} className={`temporary-chat__message ${isOwn ? 'is-own' : ''}`}>
                  <div className="temporary-chat__message-meta">
                    <strong>{isOwn ? 'You' : message.sender_name}</strong>
                    <time dateTime={message.created_at}>{formatMessageAge(message.created_at)}</time>
                  </div>
                  <p>{message.body}</p>
                </article>
              );
            })
          )}
        </div>
      </div>

      <form className="temporary-chat__composer" onSubmit={handleSubmit}>
        <label htmlFor="temporary-chat-message">Message</label>
        <div className="temporary-chat__input-shell">
          <textarea
            ref={inputRef}
            id="temporary-chat-message"
            value={draft}
            onChange={event => {
              setDraft(event.target.value.slice(0, chat.maxLength));
              if (formError) setFormError('');
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Write a temporary note…"
            maxLength={chat.maxLength}
            rows={2}
            disabled={chat.status !== 'connected' || sending}
          />
          <span className="temporary-chat__count">{draft.length}/{chat.maxLength}</span>
        </div>
        <div className="temporary-chat__composer-footer">
          <p className={formError ? 'is-error' : ''} role={formError ? 'alert' : undefined}>
            {formError || 'Enter to send · Shift + Enter for a new line'}
          </p>
          <Button type="submit" loading={sending} disabled={chat.status !== 'connected' || !draft.trim()}>
            Send note
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
