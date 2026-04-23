import type { Card } from 'scryfall-api';

export type CardType = 'creature' | 'sorcery' | 'artifact' | 'instant' | 'enchantment' | 'planeswalker' | 'battle' | 'land';

const TYPE_MAP: CardType[] = ['creature', 'sorcery', 'artifact', 'instant', 'enchantment', 'planeswalker', 'battle', 'land'];

export function determineCardType(card: Card): CardType | undefined {
  const typeLine = card.type_line.toLowerCase();

  return TYPE_MAP.find((type) => typeLine.includes(type));
}
