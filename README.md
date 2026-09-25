# anime-ascii

Convert images to ASCII art (Node.js).

```bash
cd js && npm install
npx anime-ascii photo.png -w 72 --style fill -r classic --quality high
npx anime-ascii photo.png -w 64 --quality high --color
```

## Design cards (10 characters × 4 styles · colored)

```bash
# from repo root
npx --yes serve . -p 5173
# open http://localhost:5173/gallery/
```

Pick a character card, then a design card. Preview shows **colored** ASCII from the sprite.

Characters: Bulbasaur, Charmander, Squirtle, Pikachu, Charizard, Jigglypuff, Meowth, Gengar, Eevee, Mewtwo.

## Sample — Pikachu

See [`samples/pikachu.txt`](samples/pikachu.txt) and [`samples/characters/`](samples/characters/).

## Tests

```bash
cd js && npm test
```

## License

MIT
