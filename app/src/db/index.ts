import Dexie, { type Table } from 'dexie';
import type { Card } from 'scryfall-api';

export type CardType = 'creature' | 'sorcery' | 'artifact' | 'instant' | 'enchantment' | 'planeswalker' | 'battle' | 'land' | 'unknown';

export interface Deck {
  id: string;
  name: string;
  commanderOracleId: string;
  commanderImageUri: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeckCard {
  id: string;
  deckId: string;
  oracleId: string;
  quantity: number;
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CachedCard {
  oracleId: string;
  raw: Card;
  updatedAt: string;
}

export interface Source {
  id: string;
  deckId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type EventSource = 'local' | 'remote';
export type EventSyncStatus = 'pending' | 'acked';

export interface EventMetadata {
  id?: number;
  eventId: string;
  aggregateId: string;
  createdAt: string;
  source: EventSource;
  syncStatus: EventSyncStatus;
  serverSequence?: number;
}

export interface EventPayloadMap {
  deck_created: {
    name: string;
    commanderOracleId: string;
    commanderImageUri: string;
  };
  source_created: {
    name: string;
    deckId: string;
  };
  deck_card_added: {
    deckId: string;
    oracleId: string;
    sourceId?: string;
    quantity: number;
  };
  deck_card_bulk_added: {
    deckId: string;
    cards: Array<{ id: string; oracleId: string; quantity: number }>;
  };
  deck_card_quantity_set: {
    quantity: number;
  };
}

export type AppEvent = {
  [K in keyof EventPayloadMap]: EventMetadata & {
    type: K;
    payload: EventPayloadMap[K];
  };
}[keyof EventPayloadMap];

export class AppDatabase extends Dexie {
  decks!: Table<Deck, string>;
  deckCards!: Table<DeckCard, string>;
  cards!: Table<CachedCard, string>;
  sources!: Table<Source, string>;
  events!: Table<AppEvent, number>;

  constructor() {
    super('mtgAssembleDb');

    this.version(1).stores({
      decks: 'id, name, updatedAt',
      deckCards: 'id, deckId, sourceId, oracleId, [deckId+oracleId], [deckId+sourceId], updatedAt',
      cards: 'oracleId',
      sources: 'id, deckId, name, type, updatedAt',
      events: '++id, eventId, type, aggregateId, syncStatus, serverSequence, createdAt'
    });
  }
}

export const db = new AppDatabase();

export function createId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
