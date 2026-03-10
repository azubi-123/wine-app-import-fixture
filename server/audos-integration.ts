// server/audos-integration.ts
// Fire-and-forget CRM tracking — never blocks user requests

const AUDOS_API_BASE = process.env.AUDOS_API_BASE || 'https://audos.com/api';
const AUDOS_WORKSPACE_ID = process.env.AUDOS_WORKSPACE_ID || 'b36129b4-8275-44f6-8365-31a1640bd1ba';

interface AudosContact {
  email: string;
  name?: string;
  phone?: string;
  source?: string;
  tags?: string[];
}

export function trackContact(contact: AudosContact): void {
  fetch(`${AUDOS_API_BASE}/crm/contacts/${AUDOS_WORKSPACE_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: contact.email,
      name: contact.name || '',
      phone: contact.phone || '',
      source: contact.source || 'kyg-app',
      tags: contact.tags || ['kyg-user']
    })
  })
  .then(res => {
    if (!res.ok) console.error('[Audos] Tracking failed:', res.status);
  })
  .catch(err => {
    console.error('[Audos] Tracking error:', err.message);
  });
}

export function trackHostSignup(email: string, name?: string): void {
  trackContact({ email, name, tags: ['kyg-user', 'host'] });
}

export function trackGuestJoined(email: string, name?: string, sessionCode?: string): void {
  trackContact({
    email,
    name,
    tags: ['kyg-user', 'guest', sessionCode ? `session-${sessionCode}` : ''].filter(Boolean) as string[]
  });
}

export function trackTastingCompleted(email: string, name?: string): void {
  trackContact({ email, name, tags: ['kyg-user', 'tasting-completed'] });
}
