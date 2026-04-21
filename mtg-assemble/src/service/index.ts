import { createId, db, nowIso, type AppEvent } from '@/db';

export async function appendEvent(event: AppEvent): Promise<void> {
  await db.transaction('rw', db.events, db.decks, db.deckCards, db.sources, async () => {
    await db.events.add(event);
    await applyEvent(event);
  });
}

export async function applyEvent(event: AppEvent): Promise<void> {
  switch (event.type) {
    case 'deck_created':
      await db.decks.put({
        id: event.aggregateId,
        name: event.payload.name,
        commanderOracleId: event.payload.commanderOracleId,
        createdAt: event.createdAt,
        updatedAt: event.createdAt
      });
      return;
    case 'source_created':
      await db.sources.put({
        id: event.aggregateId,
        name: event.payload.name,
        createdAt: event.createdAt,
        updatedAt: event.createdAt
      });
      return;

    case 'deck_card_added':
      await db.deckCards.put({
        id: event.aggregateId,
        deckId: event.payload.deckId,
        name: event.payload.name,
        oracleId: event.payload.oracleId,
        quantity: event.payload.quantity,
        sourceId: event.payload.sourceId,
        createdAt: event.createdAt,
        updatedAt: event.createdAt
      });
      return;

    case 'deck_card_bulk_added':
      db.deckCards.bulkPut(
        event.payload.cards.map((card) => ({
          id: card.id,
          deckId: event.payload.deckId,
          name: card.name,
          oracleId: card.oracleId,
          quantity: card.quantity,
          createdAt: event.createdAt,
          updatedAt: event.createdAt
        }))
      );
      return;

    case 'deck_card_quantity_set':
      const existing = await db.deckCards.get(event.aggregateId);

      if (!existing) {
        throw new Error(`Deck card ${event.aggregateId} not found while applying quantity event`);
      }

      if (event.payload.quantity <= 0) {
        await db.deckCards.delete(event.aggregateId);
        return;
      }

      await db.deckCards.put({
        ...existing,
        quantity: event.payload.quantity,
        updatedAt: event.createdAt
      });
      return;
  }
}

export async function rebuildProjections() {
  await Promise.allSettled([db.decks.clear(), db.deckCards.clear(), db.sources.clear()]);

  const events = await db.events.orderBy('id').toArray();

  for (const event of events) {
    await applyEvent(event);
  }
}

export async function createDeck(input: { deckName: string; commanderOracleId: string }) {
  const now = nowIso();
  const deckId = createId();

  appendEvent({
    eventId: createId(),
    type: 'deck_created',
    aggregateId: deckId,
    payload: { name: input.deckName, commanderOracleId: input.commanderOracleId },
    createdAt: now,
    source: 'local',
    syncStatus: 'pending'
  });

  return deckId;
}

export async function bulkAddCardsToDeck(input: { deckId: string; cards: Array<{ name: string; oracleId: string; quantity: number }> }) {
  const now = nowIso();

  await appendEvent({
    eventId: createId(),
    type: 'deck_card_bulk_added',
    aggregateId: '',
    payload: { deckId: input.deckId, cards: input.cards.map((card) => ({ id: createId(), ...card })) },
    createdAt: now,
    source: 'local',
    syncStatus: 'pending'
  });
}
