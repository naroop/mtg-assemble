import { db, type AppEvent } from '@/db';

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
        commanderImageUri: event.payload.commanderImageUri,
        createdAt: event.createdAt,
        updatedAt: event.createdAt
      });
      return;

    case 'deck_deleted':
      await db.deckCards.where('deckId').equals(event.payload.deckId).delete();
      await db.decks.delete(event.payload.deckId);
      return;

    case 'source_created':
      if (!(await db.decks.get(event.payload.deckId))) {
        // The deck may have already been deleted by another event (e.g. a
        // concurrent deletion that synced first). Nothing to create the source for.
        return;
      }

      await db.sources.put({
        id: event.aggregateId,
        name: event.payload.name,
        deckId: event.payload.deckId,
        createdAt: event.createdAt,
        updatedAt: event.createdAt
      });
      return;

    case 'source_deleted':
      await db.deckCards.where('sourceId').equals(event.payload.sourceId).modify({ sourceId: '', updatedAt: event.createdAt });
      await db.sources.delete(event.payload.sourceId);
      return;

    case 'deck_card_added':
      if (!(await db.decks.get(event.payload.deckId))) {
        // The deck may have already been deleted by another event (e.g. a
        // concurrent deletion that synced first). Nothing to add it to.
        return;
      }

      await db.deckCards.put({
        id: event.aggregateId,
        deckId: event.payload.deckId,
        oracleId: event.payload.oracleId,
        quantity: event.payload.quantity,
        quantityAcquired: 0,
        sourceId: event.payload.sourceId,
        createdAt: event.createdAt,
        updatedAt: event.createdAt
      });
      return;

    case 'deck_card_bulk_added':
      if (!(await db.decks.get(event.payload.deckId))) {
        // The deck may have already been deleted by another event (e.g. a
        // concurrent deletion that synced first). Nothing to add these to.
        return;
      }

      db.deckCards.bulkPut(
        event.payload.cards.map((card) => ({
          id: card.id,
          deckId: event.payload.deckId,
          oracleId: card.oracleId,
          quantity: card.quantity,
          quantityAcquired: 0,
          createdAt: event.createdAt,
          updatedAt: event.createdAt
        }))
      );
      return;

    case 'deck_card_bulk_removed':
      db.deckCards.bulkDelete(event.payload.deckCardIds);
      return;

    case 'deck_card_quantity_set':
      const existingQtySet = await db.deckCards.get(event.aggregateId);

      if (!existingQtySet) {
        // The deck card may have already been deleted by another event (e.g. a
        // concurrent removal that synced first). Nothing to update in that case.
        return;
      }

      if (event.payload.quantity <= 0) {
        await db.deckCards.delete(event.aggregateId);
        return;
      }

      await db.deckCards.put({
        ...existingQtySet,
        quantity: event.payload.quantity,
        updatedAt: event.createdAt
      });
      return;

    case 'deck_card_bulk_assigned_to_source':
      await db.deckCards.bulkUpdate(
        event.payload.deckCardIds.map((deckCardId) => ({
          key: deckCardId,
          changes: { sourceId: event.payload.sourceId, updatedAt: event.createdAt }
        }))
      );
      return;

    case 'deck_card_quantity_acquired_set':
      const existingQtyAcquired = await db.deckCards.get(event.aggregateId);

      if (!existingQtyAcquired) {
        // The deck card may have already been deleted by another event (e.g. a
        // concurrent removal that synced first). Nothing to update in that case.
        return;
      }

      if (event.payload.quantity > existingQtyAcquired.quantity) {
        event.payload.quantity = existingQtyAcquired.quantity; // if we go over just set it to max
      }

      await db.deckCards.put({
        ...existingQtyAcquired,
        quantityAcquired: event.payload.quantity,
        updatedAt: event.createdAt
      });
      return;
  }
}

export async function rebuildProjections() {
  await Promise.allSettled([db.decks.clear(), db.deckCards.clear(), db.sources.clear()]);

  // Replay in server sync order rather than local insertion order, since a
  // client's local event ids don't necessarily reflect the true order events
  // were synced to (and applied against) the server. Events not yet synced
  // (no serverSequence) are assumed to be the most recent and are replayed
  // last, in their local order.
  const events = await db.events.orderBy('id').toArray();

  events.sort((a, b) => {
    if (a.serverSequence !== undefined && b.serverSequence !== undefined) {
      return a.serverSequence - b.serverSequence;
    }

    if (a.serverSequence !== undefined) {
      return -1;
    }

    if (b.serverSequence !== undefined) {
      return 1;
    }

    return (a.id ?? 0) - (b.id ?? 0);
  });

  for (const event of events) {
    await applyEvent(event);
  }
}
