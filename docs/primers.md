# Card and deck primers

Commands, the card search, the insert commands, the format of the notes the plugin creates, the `mtg-card` block and the settings.

## Commands

All commands are in the command palette (`Ctrl/Cmd+P`):

| Command | What it does |
|---|---|
| **New card primer** | Opens the card search. If the card already has a primer (same `oracle_id`, any printing), that primer opens. Otherwise a new note is created in the configured folder and opened. |
| **New deck primer** | Same search, for a commander. Creates "*Commander* Primer" in the deck primers folder from the deck template, with the decklist and a combo block that start with the commander, and opens it. |
| **Open card primer** | Same search. Opens the existing primer, or asks whether to create one. |
| **Insert card text** | Inserts the card's text as a blockquote. |
| **Insert card art (illustration only)** | Inserts the illustration of the edition you pick. |
| **Insert full card image (choose edition)** | Inserts the whole card image of the edition you pick. |
| **Insert set symbol** | Inserts the set symbol of the edition you pick. |

The insert commands only appear while a note is open in the editor. Details in [Insert into the note](#insert-into-the-note-at-the-cursor).

## Card search

Every command starts with the same card search. It accepts:

| Input | How it is resolved |
|---|---|
| `Sol Ring` (or type with autocomplete) | `GET /cards/named?fuzzy=` |
| `1 Sol Ring` | same |
| `1 Sol Ring (C21) 263` | `GET /cards/c21/263` |
| `1 Sol Ring (C21) 263 *F*` | same (`*F*`, `*E*` and `#tags` are ignored) |
| `Delver of Secrets // Insectile Aberration` | only the front face is searched |
| `Anel Solar`, `Sonnenring`, `anneau sol`, `Солнечное` (name in another language, or part of it) | `GET /cards/search?q=lang:any "anel" "solar"`, shown as "Anel Solar · Sol Ring · Portuguese" |

If the set/number does not exist, it falls back to the name search.

Names in other languages work for every language Scryfall has (Portuguese, Spanish, French, German, Italian, Japanese, Korean, Russian, Chinese…). They are only used to find the card. The primer, frontmatter and images always use the English card and an English printing.

- **One suggestion per card:** each card is suggested once, under the translated name that best matches what you typed.
- **Accents:** Scryfall does not ignore accents in translated names, so type them with accents (`Laboratório`, not `Laboratorio`).
- **Short searches:** a very short search may only list cards from the start of the alphabet. Type more of the name to narrow it down.

## Insert into the note (at the cursor)

Each command inserts plain Markdown, so the result stays readable even without the plugin.

| Command | What it inserts |
|---|---|
| **Insert card text** | A blockquote with name, cost, type line, oracle text and power/toughness, loyalty or defense (one blockquote per face). Planeswalker abilities and level bands are written as `[+1]:` and `[LEVEL 1-4]`, so they render as symbols. |
| **Insert card art (illustration only)** | `![Name · SET #no.](…/art_crop/…)`: only the illustration, at the full note width. |
| **Insert full card image (choose edition)** | `![Name · SET #no.\|250](…/normal/…)`: the whole card, 250 px wide. Double-faced cards insert both faces. |
| **Insert set symbol** | `{set:dsc:m}`: the set symbol of the chosen edition, in its rarity colour. |

After you choose the card, the last three commands show a list of editions with thumbnail, set symbol, set name, collector number, year and rarity. Type to filter it. The first entry is the reference printing from the settings. If you paste a Moxfield line that includes the set (`Sol Ring (C21) 263`), that edition is used directly and the list is skipped.

Images are links to Scryfall. Nothing is downloaded into the vault.

## Note format

The file name is the front face, sanitized (`Circle of Protection: Red` becomes `Circle of Protection - Red.md`).
If a file with that name already belongs to a **different** card, the new file is named `Name (SET).md`.

```yaml
---
mtg_oracle_id: <uuid>
mtg_name: Delver of Secrets // Insectile Aberration
mtg_scryfall_id: <printing uuid>
mtg_set: inr
mtg_collector_number: "60"
mtg_type_line: Creature — Human Wizard // Creature — Human Insect
mtg_mana_cost: "{U}"
mtg_color_identity: [U]
mtg_oracle_text: ...
tags: [mtg/primer]
---
```

The body comes from the template. The default template has these sections: Summary, How to play, Synergies, Combos, Pitfalls / interactions, Decks I use it in, and Decklist.

The Combos section has an `mtg-combo` block with the card on the battlefield and the other fields empty, ready to fill in (see [`mtg-combo` block](combos.md)). In a custom template, put `{{combo}}` where you want it.

The Decklist section has an `mtg-deck` block that starts with the card. A card that can be your commander (a legendary creature, or one whose text says so) goes under `Commander` with an empty `Deck` below it; any other card goes under `Deck`:

````markdown
```mtg-deck
Commander
1 Grist, the Hunger Tide (MH2) 202

Deck
```
````

Turn off **Decklist in new primers** in the settings to leave it out. In a custom template, put `{{decklist}}` where you want the block.

## Deck primers

**New deck primer** asks for a commander and creates `MTG/Decks/<Commander> Primer.md`. Its frontmatter names the commander (`mtg_commander`, `mtg_color_identity`, tag `mtg/deck-primer`) but has no `mtg_oracle_id`, so it never replaces the commander's card primer.

The default deck template has: a summary quote, Decklist (the commander under `Commander`, an empty `Deck` to paste the 99 into), How the deck wins, Combos (a starting `mtg-combo` block), Tutors, Mulligan and opening hand, What shuts the deck down (a table to fill), and Deck changes (an empty [`mtg-changes`](sideboard.md) block). Set your own in **Deck primer template**; it takes the same placeholders as the card template.

## `mtg-card` block

````markdown
```mtg-card
```
````

An empty block shows the card from the note's frontmatter. With a line (a name or a Moxfield line), it shows that card:

````markdown
```mtg-card
1 Fire // Ice (MH2) 290
```
````

The block renders the image (linked from Scryfall, not downloaded), cost, type line, oracle text with symbols, and the set symbol with the set code and collector number.
The card line can also be a name in another language (`Anel Solar`).
**Offline or Scryfall down:** it shows the data saved in the frontmatter, with a warning. That is the note's own primer for an empty block, or the named card's primer if one exists in the vault.

## Settings

- **Primers folder** (default `MTG/Primers`).
- **Template:** path of a note. Supports `{{name}}`, `{{front_name}}`, `{{oracle_id}}`, `{{decklist}}` (the starting `mtg-deck` block) and `{{combo}}` (the starting `mtg-combo` block). The template's own frontmatter is dropped.
- **Decklist in new primers** (on by default): adds the Decklist section to the default template.
- **Deck primers folder** (default `MTG/Decks`) and **Deck primer template**: where *New deck primer* creates notes and which template it uses (empty = the default deck template).
- **Hover popup** (on by default).
- **Mana symbols** (on by default): turns all the symbols above on or off (mana, loyalty, level, set and bracket). Notes already open in reading view update when reopened.
- **Reference printing:** the printing saved in new primers and listed first in the edition picker.
  - *As given:* the set/number from the line, or Scryfall's default printing when only a name is given.
  - *Latest:* the most recent paper printing. Costs one extra request.

---

[← Back to the README](../README.md)
