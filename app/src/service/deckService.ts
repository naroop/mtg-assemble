import { createId, nowIso } from '@/db';
import { Cards, type Card, type ImageUris } from 'scryfall-api';
import { appendEvent } from './eventService';
import { determineImageUri } from '@/util/cards-util';

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

export async function deleteDeck(input: { deckId: string }) {
  const now = nowIso();

  appendEvent({
    eventId: createId(),
    type: 'deck_deleted',
    aggregateId: '',
    payload: { deckId: input.deckId },
    createdAt: now,
    source: 'local',
    syncStatus: 'pending'
  });
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
