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
}

export default importDeck;
