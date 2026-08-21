import { useAuth } from '@/composables/useAuth';
import { db, type AppEvent } from '@/db';
import { supabase } from '@/util/supabase';
import { applyEvent } from './eventService';
import { ensureCardsCached } from './deckCardService';

interface EventRow {
  event_id: string;
  user_id: string;
  aggregate_id: string;
  type: string;
  payload: unknown;
  created_at: string;
  server_sequence: number;
}

async function getUserId(): Promise<string> {
  const { user } = useAuth();

  if (!user.value) {
    throw new Error('User must be signed in to sync events.');
  }

  return user.value.id;
}

async function getLastServerSequence(): Promise<number> {
  const lastSyncedEvent = await db.events.orderBy('serverSequence').reverse().first();

  return lastSyncedEvent?.serverSequence ?? 0;
}

/**
 * Pushes all locally pending events up to Supabase, then updates the local
 * events with the server-assigned sequence and marks them as acked.
 *
 * Safe to call multiple times: events that were already pushed in a previous
 * call (e.g. the push succeeded but the local ack failed) are detected via
 * their eventId and simply reconciled rather than re-inserted.
 */
export async function pushEvents(): Promise<number> {
  const userId = await getUserId();

  const pendingEvents = await db.events.where('syncStatus').equals('pending').sortBy('id');

  if (!pendingEvents.length) {
    return 0;
  }

  const eventIds = pendingEvents.map((event) => event.eventId);

  const { data: existingRows, error: existingError } = await supabase
    .from('events')
    .select('event_id, server_sequence')
    .eq('user_id', userId)
    .in('event_id', eventIds);

  if (existingError) {
    throw existingError;
  }

  const existingSequenceByEventId = new Map<string, number>(
    ((existingRows ?? []) as Pick<EventRow, 'event_id' | 'server_sequence'>[]).map((row) => [row.event_id, row.server_sequence])
  );

  const eventsToInsert = pendingEvents.filter((event) => !existingSequenceByEventId.has(event.eventId));

  if (eventsToInsert.length) {
    const rows = eventsToInsert.map((event) => ({
      event_id: event.eventId,
      user_id: userId,
      aggregate_id: event.aggregateId,
      type: event.type,
      payload: event.payload,
      created_at: event.createdAt
    }));

    const { data: insertedRows, error: insertError } = await supabase.from('events').insert(rows).select('event_id, server_sequence');

    if (insertError) {
      throw insertError;
    }

    for (const row of (insertedRows ?? []) as Pick<EventRow, 'event_id' | 'server_sequence'>[]) {
      existingSequenceByEventId.set(row.event_id, row.server_sequence);
    }
  }

  let syncedCount = 0;

  await db.transaction('rw', db.events, async () => {
    for (const event of pendingEvents) {
      const serverSequence = existingSequenceByEventId.get(event.eventId);

      if (serverSequence === undefined || event.id === undefined) {
        continue;
      }

      await db.events.update(event.id, { syncStatus: 'acked', serverSequence });
      syncedCount++;
    }
  });

  return syncedCount;
}

/**
 * Pulls any events created since the last known server sequence and applies
 * them to the local projections. Events that already exist locally (e.g.
 * events this client pushed itself) are reconciled but not re-applied.
 */
export async function pullEvents(): Promise<number> {
  const userId = await getUserId();
  const lastServerSequence = await getLastServerSequence();

  const { data, error } = await supabase
    .from('events')
    .select('event_id, user_id, aggregate_id, type, payload, created_at, server_sequence')
    .eq('user_id', userId)
    .gt('server_sequence', lastServerSequence)
    .order('server_sequence', { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as EventRow[];

  if (!rows.length) {
    return 0;
  }

  let appliedCount = 0;

  await db.transaction('rw', db.events, db.decks, db.deckCards, db.sources, async () => {
    for (const row of rows) {
      const existingEvent = await db.events.where('eventId').equals(row.event_id).first();

      if (existingEvent) {
        if (existingEvent.id !== undefined && (existingEvent.syncStatus !== 'acked' || existingEvent.serverSequence !== row.server_sequence)) {
          await db.events.update(existingEvent.id, { syncStatus: 'acked', serverSequence: row.server_sequence });
        }
        continue;
      }

      const event = {
        eventId: row.event_id,
        aggregateId: row.aggregate_id,
        type: row.type,
        payload: row.payload,
        createdAt: row.created_at,
        source: 'remote',
        syncStatus: 'acked',
        serverSequence: row.server_sequence
      } as AppEvent;

      await db.events.add(event);
      await applyEvent(event);
      appliedCount++;
    }
  });

  return appliedCount;
}

/**
 * Pushes pending local events, then pulls any new events from the server.
 */
export async function syncEvents(): Promise<{ pushed: number; pulled: number }> {
  const pushed = await pushEvents();
  const pulled = await pullEvents();

  await ensureCardsCached(await db.deckCards.toArray().then((deckCards) => deckCards.map((deckCard) => deckCard.oracleId)));

  return { pushed, pulled };
}
