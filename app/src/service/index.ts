import { createId, db, nowIso, type AppEvent, type CardType } from '@/db';
import { CardIdentifierBuilder, Cards, type Card, type CardFace, type ImageUris } from 'scryfall-api';

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

    case 'source_created':
      await db.sources.put({
        id: event.aggregateId,
        name: event.payload.name,
        deckId: event.payload.deckId,
        createdAt: event.createdAt,
        updatedAt: event.createdAt
      });
      return;

    case 'deck_card_added':
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

    case 'deck_card_quantity_set':
      const existingQtySet = await db.deckCards.get(event.aggregateId);

      if (!existingQtySet) {
        throw new Error(`Deck card ${event.aggregateId} not found while applying quantity event`);
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
        throw new Error(`Deck card ${event.aggregateId} not found while applying quantity acquired event`);
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

  const events = await db.events.orderBy('id').toArray();

  for (const event of events) {
    await applyEvent(event);
  }
}

export async function createDeck(input: { deckName: string; commanderOracleId: string }) {
  const now = nowIso();
  const deckId = createId();
  const imageUri = await getImageUriForOracleId(input.commanderOracleId);

  appendEvent({
    eventId: createId(),
    type: 'deck_created',
    aggregateId: deckId,
    payload: { name: input.deckName, commanderOracleId: input.commanderOracleId, commanderImageUri: imageUri ?? '' },
    createdAt: now,
    source: 'local',
    syncStatus: 'pending'
  });

  return deckId;
}

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

export async function assignCardsToSource(input: { sourceId: string; deckCardIds: string[] }) {
  const now = nowIso();
  const deckCardIds = [...input.deckCardIds];

  await appendEvent({
    eventId: createId(),
    type: 'deck_card_bulk_assigned_to_source',
    aggregateId: '',
    payload: { sourceId: input.sourceId, deckCardIds: deckCardIds },
    createdAt: now,
    source: 'local',
    syncStatus: 'pending'
  });
}

export async function setCardQuantityAcquired(input: { deckCardId: string; quantity: number }) {
  const now = nowIso();

  await appendEvent({
    eventId: createId(),
    type: 'deck_card_quantity_acquired_set',
    aggregateId: input.deckCardId,
    payload: { quantity: input.quantity },
    createdAt: now,
    source: 'local',
    syncStatus: 'pending'
  });
}

export async function bulkAddCardsToDeck(input: { deckId: string; cards: Array<{ oracleId: string; quantity: number }> }) {
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

  await ensureCardsCached(input.cards.map((card) => card.oracleId));
}

async function ensureCardsCached(oracleIds: string[]) {
  const uniqueOracleIds = [...new Set(oracleIds.filter(Boolean))];

  if (!uniqueOracleIds.length) return;

  const existingCards = await db.cards.where('oracleId').anyOf(uniqueOracleIds).toArray();
  const existingOracleIds = new Set(existingCards.map((card) => card.oracleId));
  const missingOracleIds = uniqueOracleIds.filter((oracleId) => !existingOracleIds.has(oracleId));

  if (!missingOracleIds.length) return;

  const fetchedCards = await Cards.collection(...missingOracleIds.map((oracleId) => CardIdentifierBuilder.byOracleId(oracleId)));

  const now = new Date().toISOString();

  await db.cards.bulkPut(
    fetchedCards
      .filter((card) => card.oracle_id)
      .map((card) => ({
        oracleId: card.oracle_id!,
        raw: card,
        updatedAt: now
      }))
  );
}

async function getImageUriForOracleId(oracleId: string, imageUri: keyof ImageUris = 'art_crop') {
  if (!oracleId) {
    throw new Error('oracleId must not be undefined.');
  }

  const queryResult = await Cards.search(`oracleId="${oracleId}"`).all();

  if (queryResult.length > 1) {
    throw new Error('oracleId returned multiple cards.');
  } else if (queryResult.length < 1) {
    throw new Error(`Card not found for oracleId="${oracleId}"`);
  }

  const card = queryResult[0]!;

  return determineImageUri(card, imageUri);
}

export function determineImageUri(card: Card | undefined | null, imageUri: keyof ImageUris = 'art_crop') {
  if (!card) return;

  if (card.card_faces?.length && card.card_faces[0]?.image_uris) {
    return card.card_faces[0].image_uris?.[imageUri]!;
  }

  return card.image_uris?.[imageUri]!;
}
