# Symbols and hover previews

Mana, loyalty, level, set and bracket symbols in any note, and card previews when you hover a link.

## Cheat sheet

| Write | Shows |
|---|---|
| `{1}{B}{G}`, `{W/U}`, `{G/P}`, `{X}`, `{C}` | mana symbols |
| `{T}`, `{Q}`, `{E}`, `{PW}` | tap, untap, energy, planeswalker |
| `[+1]`, `[−2]` / `[-2]`, `[0]`, `[+X]` | loyalty shields |
| `[LEVEL 1-4]`, `[LEVEL 5+]` | level bands |
| `{set:dsc}`, `{set:dsc:m}` | set symbol (optionally in a rarity colour) |
| `[BRACKET 3]` / `[B3]`, `[BRACKET 2-3]` / `[B2-3]` | Commander bracket badge |
| `[[Sol Ring]]`, `[[Anel Solar]]` | link with a card hover popup |
| ` ```mtg-deck ` with a decklist inside | decklist viewer (text, images or grid) |
| ` ```mtg-combo ` with zones and cards | combo with card images, operators, targets and tokens |
| ` ```mtg-sideboard ` / ` ```mtg-changes ` with `Out -> In` lines | what comes out of the deck and what goes in |
| ` ```mtg-hand ` with seven cards and `keep` or `mulligan` | an opening hand, fanned out, with the decision |
| ` ```mtg-shared ` with a card and `- [x]` / `- [ ]` decks | a card shared by several decks, and where it is now |

## Hover popup

Hover over a link such as `[[Phyrexian Altar]]` (reading view or Live Preview) and the card image appears.

- **Link to a primer** (a note with `mtg_oracle_id`): shows the card from the frontmatter. Offline, it shows the saved text.
- **Link with no note:** looks up the **exact** name on Scryfall, in English or any other language (`[[Anel Solar]]`, `[[Sonnenring]]`). If it is not a card, nothing appears.
- **Link to a regular note:** nothing appears, and Obsidian's native preview works as usual.
- **Native preview on card links:** the "… is not created yet. Click to create." popover is hidden. Clicking the link still works as usual.
- `[[Card|alias]]` and `[[Card#heading]]` work too. The popup can be turned off in the settings.

## Mana symbols

Write `{1}{B}`, `{G}`, `{W/U}`, `{G/P}`, `{C}`, `{X}`, `{T}` and so on in any note and the text turns into the symbol
(an image linked from `svgs.scryfall.io`), in reading view and in Live Preview. In Live Preview, a symbol turns back
into text when the cursor touches it, so you can edit it. This also applies to the cost and oracle text in the
`mtg-card` block and the popup.

The plugin also draws these symbols itself. Scryfall does not have them, so they work offline:

| Write | Result |
|---|---|
| `[+1]`, `[−2]` or `[-2]`, `[0]`, `[+X]` | planeswalker loyalty shield (pointing up, down or flat) |
| `[LEVEL 1-4]`, `[LEVEL 5+]` | level band badge (Level up cards such as Joraga Treespeaker) |

In the `mtg-card` block and the popup, oracle lines that start with `+1:` / `−2:` / `0:` and `LEVEL 1-4` lines
get these symbols automatically. `{T}` (tap), `{Q}` (untap) and `{PW}` (planeswalker) come from Scryfall.

- **Ignored:** frontmatter, code blocks, `inline code` and math (`$...$`, `$$...$$`).
- **Left as text:** link brackets (`[[+1]]`, `[+1](url)`) and things like `array[0]`.
- **Supported symbols:** only Scryfall's 72 official symbols (no Un-set symbols). `{name}` and similar stay as text.
- **Offline:** symbols from Scryfall appear as text. Loyalty shields, level bands and bracket badges still render.

## Set symbols

`{set:CODE}` or `{set:CODE:RARITY}` shows a set symbol. The code is Scryfall's set code, the one in parentheses in Moxfield lines.

| Write | Rarity / colour |
|---|---|
| `{set:lea}` or `{set:lea:c}` | common (text colour, follows the theme) |
| `{set:roe:u}` | uncommon (silver) |
| `{set:c21:r}` | rare (gold) |
| `{set:dsc:m}` | mythic (orange) |
| `{set:sld:s}` / `:b` | special / bonus (purple) |

The icon comes from Scryfall's set list, fetched once per session. When offline or with an unknown code, the code is shown as text (`DSC`).
You don't need to look up codes by hand: **Insert set symbol** inserts the right token for the edition you pick.

## Commander brackets

Mark the Commander bracket (1–5) of a card, combo or deck anywhere in a note:

| Write | Result |
|---|---|
| `[BRACKET 1]` or `[B1]` | BRACKET 1 · Exhibition |
| `[BRACKET 2]` or `[B2]` | BRACKET 2 · Core |
| `[BRACKET 3]` or `[B3]` | BRACKET 3 · Upgraded |
| `[BRACKET 4]` or `[B4]` | BRACKET 4 · Optimized |
| `[BRACKET 5]` or `[B5]` | BRACKET 5 · cEDH |
| `[BRACKET 2-3]` or `[B2-3]` | BRACKET 2–3 (a range) |

Each bracket has its own colour, from blue (1) to red (5), and works in light and dark themes and offline.
The short form needs an uppercase `B` (`[b3]` stays as text). Links and code are ignored, the same as for the other symbols.

---

[← Back to the README](../README.md)
