import { createId, db, nowIso, type CachedCard } from '@/db';
import { CardIdentifierBuilder, Cards } from 'scryfall-api';
import { appendEvent } from './eventService';

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

  await ensureCardsCached(input.cards.map((card) => card.oracleId));

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

export async function bulkRemoveCardsFromDeck(input: { deckCardIds: string[] }) {
  const now = nowIso();

  await appendEvent({
    eventId: createId(),
    type: 'deck_card_bulk_removed',
    aggregateId: '',
    payload: { deckCardIds: input.deckCardIds },
    createdAt: now,
    source: 'local',
    syncStatus: 'pending'
  });
}

export async function ensureCardsCached(oracleIds: string[]) {
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

export async function getCachedCardsByOracleIds(oracleIds: string[]): Promise<Map<string, CachedCard>> {
  const uniqueOracleIds = [...new Set(oracleIds)];
  if (!uniqueOracleIds.length) return new Map<string, CachedCard>();

  const cachedCards = await db.cards.where('oracleId').anyOf(uniqueOracleIds).toArray();
  return new Map<string, CachedCard>(cachedCards.map((card) => [card.oracleId, card]));
}
