const CALENDAR_EVENTS_URL =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all';

export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const TIME_ZONE = 'America/Sao_Paulo';
const EVENT_HOURS = 2;

export type ResenhaCalendarInput = {
  name: string;
  occursAt: Date;
  latitude: number;
  longitude: number;
  placeLabel?: string | null;
  guestEmails: string[];
  organizerEmail?: string | null;
};

export type ResenhaCalendarResult = {
  htmlLink?: string;
  invitedCount: number;
  skippedWithoutEmail: number;
};

function formatInSaoPaulo(date: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  let hour = parts.hour ?? '00';
  if (hour === '24') hour = '00';
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}`;
}

export function guestEmailsFromProfiles(
  profiles: { id: string; email?: string | null }[],
  selectedIds: Iterable<string>,
  organizerEmail?: string | null,
): { emails: string[]; skipped: number } {
  const selected = new Set(selectedIds);
  const organizer = organizerEmail?.trim().toLowerCase() ?? '';
  const emails: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const profile of profiles) {
    if (!selected.has(profile.id)) continue;
    const email = profile.email?.trim().toLowerCase() ?? '';
    if (!email || email === organizer) {
      skipped += 1;
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return { emails, skipped };
}

export function isGoogleCalendarAuthError(status: number): boolean {
  return status === 401 || status === 403;
}

export function friendlyCalendarError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/401|403|insufficient|invalid_grant|invalid authentication/i.test(message)) {
    return 'O Google recusou o acesso à agenda. Autorize o Agenda e tente de novo. Veja docs/google-credentials.md.';
  }
  if (/Calendar API has not been used|accessNotConfigured|not been enabled/i.test(message)) {
    return 'Ative a Google Calendar API no Google Cloud (docs/google-credentials.md).';
  }
  if (/cancelado/i.test(message)) {
    return 'Autorização do Google Agenda cancelada.';
  }
  return message.replace(/^.*error:\s*/i, '') || 'Não foi possível criar o evento no Google Agenda.';
}

export async function createResenhaCalendarEvent(
  accessToken: string,
  input: ResenhaCalendarInput,
): Promise<ResenhaCalendarResult> {
  const token = accessToken.trim();
  if (!token) {
    throw new Error('Token do Google Agenda ausente.');
  }

  const end = new Date(input.occursAt.getTime() + EVENT_HOURS * 60 * 60 * 1000);
  const mapsUrl = `https://maps.google.com/?q=${input.latitude},${input.longitude}`;
  const when = input.occursAt.toLocaleString('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
  });
  const attendees = input.guestEmails.map((email) => ({ email }));

  const body = {
    summary: input.name.trim() || 'Resenha',
    description: [`Resenha marcada no app.`, `Quando: ${when}`, `Mapa: ${mapsUrl}`].join('\n'),
    location: input.placeLabel?.trim() || mapsUrl,
    start: { dateTime: formatInSaoPaulo(input.occursAt), timeZone: TIME_ZONE },
    end: { dateTime: formatInSaoPaulo(end), timeZone: TIME_ZONE },
    attendees,
    guestsCanModify: false,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'email', minutes: 60 },
      ],
    },
  };

  const response = await fetch(CALENDAR_EVENTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  if (!response.ok) {
    let detail = raw.slice(0, 400);
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // keep detail
    }
    const error = new Error(`Google Agenda (${response.status}): ${detail}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  let htmlLink: string | undefined;
  try {
    const parsed = JSON.parse(raw) as { htmlLink?: string };
    htmlLink = parsed.htmlLink;
  } catch {
    // ignore
  }

  return {
    htmlLink,
    invitedCount: attendees.length,
    skippedWithoutEmail: 0,
  };
}
