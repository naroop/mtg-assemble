import Dexie, { type Table } from 'dexie';

export interface Deck {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeckCard {
  id: string;
  deckId: string;
  name: string;
  oracleId: string;
  quantity: number;
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Source {
  id: string;
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
  };
  source_created: {
    name: string;
  };
  deck_card_added: {
    deckId: string;
    name: string;
    oracleId: string;
    quantity: number;
  };
  deck_card_bulk_added: {
    deckId: string;
    cards: Array<{ id: string; name: string; oracleId: string; quantity: number }>;
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
  sources!: Table<Source, string>;
  events!: Table<AppEvent, number>;

  constructor() {
    super('mtgAssembleDb');

    this.version(1).stores({
      decks: 'id, name, updatedAt',
      deckCards: 'id, deckId, sourceId, oracleId, [deckId+oracleId], [deckId+sourceId], updatedAt',
      sources: 'id, name, type, updatedAt',
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
