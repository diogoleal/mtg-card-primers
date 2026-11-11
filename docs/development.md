# Development

Building from source, tests, releases, and how the plugin talks to Scryfall.

## Build from source

```bash
npm install
npm run build
```

Copy these files to `<your vault>/.obsidian/plugins/mtg-card-primers/`:

- `main.js`
- `manifest.json`
- `styles.css`

```bash
VAULT=~/path/to/vault
mkdir -p "$VAULT/.obsidian/plugins/mtg-card-primers"
cp main.js manifest.json styles.css "$VAULT/.obsidian/plugins/mtg-card-primers/"
```

Then, in Obsidian, go to **Settings → Community plugins**, reload the list, and enable **MTG Card Primers**.

For development, `npm run dev` rebuilds on every change. You can pair it with the *Hot Reload* plugin.

## How the plugin uses Scryfall

- Every request goes through Obsidian's `requestUrl` with `User-Agent: MtgCardPrimers/<version>` and `Accept: application/json`.
- One request at a time, spaced per endpoint:
  - 500 ms after `/cards/named`, `/cards/search` and `/cards/collection`.
  - 100 ms after all other endpoints.
  - An HTTP 429 pauses all requests for 30 s.
- Results are cached in memory for the session. Failed requests are not cached, except "not found" answers.
- The set list (`/sets`, for set symbols) is fetched at most once per session.
- Decklists are fetched with `/cards/collection`: one request per 75 cards. Only lines it can't match exactly (typos, names in other languages) are looked up one by one.
- Tokens in `mtg-combo` blocks are looked up with `/cards/search` (`t:token`, name, power/toughness, colours), once per token per session.
- Only card lookups are sent to Scryfall: what you type in the search, the names of links you hover, card and token names in `mtg-card`, `mtg-deck`, `mtg-combo`, `mtg-hand`, `mtg-sideboard` and `mtg-changes` blocks, set codes and card ids. Note contents are never sent.

## Tests

```bash
npm test
```

Unit tests (`node:test`, no dependencies) cover:

- the Moxfield line parser
- the decklist parser and its options
- the `mtg-combo` parser (zones, operators, targets, tokens, fields)
- the `mtg-sideboard` / `mtg-changes` parser (arrows, quantities, lists, groups, reasons)
- the `mtg-hand` parser (cards, keep or mulligan, play or draw, notes)
- matching card names in other languages
- file name sanitization
- link path cleanup
- the symbol scanner (mana, loyalty, level, set and bracket symbols)
- the Markdown built by the insert commands

## Releasing

1. Bump the version: `npm version patch` (or `minor`). This updates `manifest.json`, `package.json` and `versions.json`.
2. Push the commit and the tag: `git push && git push --tags`. The tag must equal the version, with no `v` prefix (`0.8.1`).
3. The **Release** workflow builds the plugin and creates a draft GitHub release with `main.js`, `manifest.json` and `styles.css`. Review it and publish.

---

[← Back to the README](../README.md)
