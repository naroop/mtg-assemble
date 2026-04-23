import { bulkAddCardsToDeck } from '@/service';
import { CardIdentifierBuilder, Cards, type Card as ScryfallCard } from 'scryfall-api';

function normalizeCardName(name: string): string {
  return name.replace(/\s*\/\s*/g, ' // ');
}

function getFrontFaceName(name: string): string {
  return name.split('//')[0]!.trim();
}

function createCanonicalName(name: string): string {
  return normalizeCardName(name).trim().toLowerCase();
}

function isSplitStyleName(name: string): boolean {
  return name.includes('//');
}

async function importDeck(deckId: string, text: string) {
  const parsedDeck: { quantity: number; name: string }[] = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [quantityStr, ...nameParts] = line.split(' ');
      const rawName = nameParts.join(' ');
      const normalizedName = normalizeCardName(rawName);

      return {
        quantity: Number(quantityStr),
        name: normalizedName
      };
    });

  const identifiers = parsedDeck.map((card) => {
    if (isSplitStyleName(card.name)) {
      return CardIdentifierBuilder.byName(getFrontFaceName(card.name));
    }

    return CardIdentifierBuilder.byName(card.name);
  });

  const fetchedCards = await Cards.collection(...identifiers);

  const fetchedByName = new Map<string, ScryfallCard>();

  for (const fetchedCard of fetchedCards) {
    const fetchedNameKey = createCanonicalName(fetchedCard.name);
    fetchedByName.set(fetchedNameKey, fetchedCard);

    if (fetchedCard.card_faces?.length) {
      const frontFaceName = fetchedCard.card_faces[0]?.name;
      if (frontFaceName) {
        fetchedByName.set(createCanonicalName(frontFaceName), fetchedCard);
      }
    }
  }

  const cardsPayload = parsedDeck.map((card) => {
    const fullNameKey = createCanonicalName(card.name);
    const frontFaceKey = createCanonicalName(getFrontFaceName(card.name));

    const scryfallCard = fetchedByName.get(fullNameKey) ?? fetchedByName.get(frontFaceKey);

    const oracleId = scryfallCard?.oracle_id;

    if (!oracleId) {
      console.error('oracleId not found', {
        parsedCard: card,
        fetchedCards
      });
    }

    return {
      name: card.name,
      oracleId: oracleId ?? 'N/A',
      quantity: card.quantity
    };
  });

  await bulkAddCardsToDeck({
    deckId,
    cards: cardsPayload
  });
}

export default importDeck;
