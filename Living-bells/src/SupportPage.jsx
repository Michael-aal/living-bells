import { useEffect, useState } from 'react'
import { api } from './api'
import './SupportPage.css'

function date(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SupportPage() {
  const [tickets, setTickets] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [form, setForm] = useState({ title: '', category: 'BUG', description: '' })
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadTickets() {
    setLoading(true)
    setError('')
    try {
      const data = await api.supportTickets()
      setTickets(data || [])
      if (selected) {
        const updated = (data || []).find(item => item.id === selected.id)
        if (updated) setSelected(updated)
      }
    } catch (err) {
      setError(err.message || 'Could not load support tickets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTickets() }, [])

  async function openTicket(ticket) {
    setSelected(ticket)
    setError('')
    try {
      setMessages(await api.supportTicketMessages(ticket.id))
    } catch (err) {
      setError(err.message || 'Could not load the ticket conversation')
    }
  }

  async function createTicket(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const created = await api.createSupportTicket(form)
      setForm({ title: '', category: 'BUG', description: '' })
      setNotice('Support ticket submitted. The Living Bells developer team has been notified.')
      await loadTickets()
      await openTicket(created)
    } catch (err) {
      setError(err.message || 'Could not submit the support ticket')
    } finally {
      setSaving(false)
    }
  }

  async function sendReply(event) {
    event.preventDefault()
    if (!selected || !reply.trim()) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.addSupportTicketMessage(selected.id, { body: reply.trim() })
      setReply('')
      setMessages(await api.supportTicketMessages(selected.id))
      setNotice('Your reply was sent.')
      await loadTickets()
    } catch (err) {
      setError(err.message || 'Could not send your reply')
    } finally {
      setSaving(false)
    }
  }

  return <div className="support-page">
    <section className="support-intro">
      <span className="eyebrow">Help and support</span>
      <h2>Contact Living Bells support</h2>
      <p>Report a bug, explain a problem, or ask for help. Your ticket is linked to your church workspace so the developer team can investigate it.</p>
    </section>

    {error && <div className="support-alert error" role="alert">{error}</div>}
    {notice && <div className="support-alert" role="status">{notice}</div>}

    <div className="support-layout">
      <section className="support-card">
        <h3>Open a support ticket</h3>
        <form onSubmit={createTicket} className="support-form">
          <label>Short title<input value={form.title} onChange={e => setForm(current => ({ ...current, title: e.target.value }))} minLength="4" maxLength="120" required placeholder="e.g. Weekly report will not save" /></label>
          <label>Category<select value={form.category} onChange={e => setForm(current => ({ ...current, category: e.target.value }))}><option value="BUG">Bug or error</option><option value="QUESTION">How-to question</option><option value="ACCESS">Account or access</option><option value="DATA">Data issue</option><option value="OTHER">Other</option></select></label>
          <label>Details<textarea value={form.description} onChange={e => setForm(current => ({ ...current, description: e.target.value }))} minLength="10" maxLength="8000" rows="5" required placeholder="What happened? Include the page and steps to reproduce it. Do not include passwords." /></label>
          <button className="support-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit ticket'}</button>
        </form>
      </section>

      <section className="support-card">
        <div className="support-card-head"><h3>Your church tickets</h3><button type="button" onClick={loadTickets}>Refresh</button></div>
        {loading ? <p>Loading tickets…</p> : <div className="support-ticket-list">
          {tickets.map(ticket => <button type="button" key={ticket.id} className={selected?.id === ticket.id ? 'support-ticket active' : 'support-ticket'} onClick={() => openTicket(ticket)}>
            <strong>#{ticket.id} · {ticket.title}</strong><span>{ticket.status.replaceAll('_', ' ')} · {ticket.category}</span><small>Updated {date(ticket.updatedAt)}</small>
          </button>)}
          {!tickets.length && <p>No support tickets yet. If something goes wrong, you can report it here.</p>}
        </div>}
      </section>
    </div>

    {selected && <section className="support-card support-conversation">
      <div className="support-card-head"><div><h3>Ticket #{selected.id}: {selected.title}</h3><p>{selected.status.replaceAll('_', ' ')} · Opened {date(selected.createdAt)}</p></div></div>
      <p className="support-description">{selected.description}</p>
      <div className="support-messages">
        {messages.map(message => <article key={message.id} className="support-message"><div><strong>{message.author?.name || 'Support'}</strong><small>{date(message.createdAt)}</small></div><p>{message.body}</p></article>)}
        {!messages.length && <p>No replies yet. The developer team has been notified.</p>}
      </div>
      <form className="support-form" onSubmit={sendReply}>
        <label>Reply to support<textarea value={reply} onChange={e => setReply(e.target.value)} rows="3" maxLength="8000" required placeholder="Add more details or reply to the developer…" /></label>
        <button className="support-primary" disabled={saving || !reply.trim()}>{saving ? 'Sending…' : 'Send reply'}</button>
      </form>
    </section>}
  </div>
}
