import { createId, nowIso } from '@/db';
import { appendEvent } from './eventService';

export async function createSource(input: { deckId: string; sourceName: string }) {
  const now = nowIso();
  const sourceId = createId();

  appendEvent({
    eventId: createId(),
    type: 'source_created',
    aggregateId: sourceId,
    payload: { name: input.sourceName, deckId: input.deckId },
    createdAt: now,
    source: 'local',
    syncStatus: 'pending'
  });

  return sourceId;
}

export async function deleteSource(input: { sourceId: string }) {
  const now = nowIso();

  appendEvent({
    eventId: createId(),
    type: 'source_deleted',
    aggregateId: '',
    payload: { sourceId: input.sourceId },
    createdAt: now,
    source: 'local',
    syncStatus: 'pending'
  });
}
