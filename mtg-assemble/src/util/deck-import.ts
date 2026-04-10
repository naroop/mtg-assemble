import { createId, db } from '@/db';
import { addBulkCardsToDeck } from '@/service';
import { Cards } from 'scryfall-api';

async function importDeck(text: string) {
  const split = text.split('\n');

  const parsedDeck: { quantity: number; name: string }[] = split
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [quantityStr, ...nameParts] = line.trim().split(' ');
      return {
        quantity: Number(quantityStr),
        name: nameParts.join(' ')
      };
    });

  const cards = await Cards.collection(...parsedDeck.map((card) => ({ name: card.name })));

  const cardsPayload = parsedDeck.map((card) => {
    const scryfallCard = cards.find((c) => c.name === card.name);

    const oracleId = scryfallCard && scryfallCard.oracle_id ? scryfallCard.oracle_id : 'N/A';

    return {
      name: card.name,
      oracleId: oracleId,
      quantity: card.quantity
    };
  });

  await addBulkCardsToDeck({ deckId: createId(), cards: cardsPayload });
  console.log(await db.deckCards.toArray());
}

export default importDeck;
