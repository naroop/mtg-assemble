import type { CardType } from '@/db';
import type { Card, ImageUris } from 'scryfall-api';

const TYPE_MAP: CardType[] = ['creature', 'sorcery', 'artifact', 'instant', 'enchantment', 'planeswalker', 'battle', 'land'];

export function determineCardType(card: Card): CardType {
  const typeLine = card.type_line.toLowerCase();

  if (typeLine.includes('land')) {
    return 'land';
  }

  const type = TYPE_MAP.find((type) => typeLine.includes(type));
  return !type ? 'unknown' : type;
}

export function determineImageUri(card: Card | undefined | null, imageUri: keyof ImageUris = 'art_crop') {
  if (!card) return;

  if (card.card_faces?.length && card.card_faces[0]?.image_uris) {
    return card.card_faces[0].image_uris?.[imageUri]!;
  }

  return card.image_uris?.[imageUri]!;
}

const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatUsd(amount: number): string {
  return usdFormatter.format(amount);
}
