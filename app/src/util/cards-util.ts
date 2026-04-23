import type { CardType } from '@/db';
import type { Card } from 'scryfall-api';

const TYPE_MAP: CardType[] = ['creature', 'sorcery', 'artifact', 'instant', 'enchantment', 'planeswalker', 'battle', 'land'];

export function determineCardType(card: Card): CardType {
  const typeLine = card.type_line.toLowerCase();

  const type = TYPE_MAP.find((type) => typeLine.includes(type));
  return !type ? 'unknown' : type;
}
