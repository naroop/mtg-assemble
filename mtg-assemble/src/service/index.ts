import { createId, db, nowIso, type AppEvent } from '@/db';

export async function appendEvent(event: AppEvent): Promise<void> {
  await db.transaction('rw', db.events, db.decks, db.deckCards, db.sources, async () => {
    await db.events.add(event);
    await applyEvent(event);
  });
}

export async function applyEvent(event: AppEvent): Promise<void> {
  switch (event.type) {
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
  }
}

export async function addBulkCardsToDeck(input: { deckId: string; cards: Array<{ name: string; oracleId: string; quantity: number }> }) {
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
