# MTG Card Primers

Keep your Magic: The Gathering knowledge in Obsidian. Write a study note ("primer") for each card or deck, paste your decklists and see them as cards, document sideboard plans and deck changes, draw your combos with the cards in their zones, and use mana, loyalty and set symbols anywhere in your notes. Card data and images come from [Scryfall](https://scryfall.com).

![A card primer with the card, its symbols and a hover preview](https://raw.githubusercontent.com/diogoleal/mtg-card-primers/main/docs/images/primer.png)

## Features

**Card primers**
- **One note per card**, created from your template, with the card data saved in the frontmatter. Every printing of a card shares the same primer (it is keyed by `oracle_id`), and opening a card that already has one opens it instead of making a duplicate.
- **Find any card:** by name with autocomplete, by pasting a Moxfield line (`1 Sol Ring (C21) 263 *F*`), or by its name in any language (`Anel Solar`, `Sonnenring`).
- **Deck primers:** pick a commander and get a note with its decklist, combos, tutors and what shuts the deck down, from your own template.
- **Hover previews:** hovering a `[[Card name]]` link shows the card.

**Decklists**
- **`mtg-deck` block:** paste a list from Moxfield, Arena or MTGO and switch between a text list, stacks of cards or a grid of whole cards, sorted by type, name, mana value or colour, with colour identity and mana curve.
- **Your editions and foils:** pick the edition of each card and mark foils (`*F*`) and etched foils (`*E*`); the choice is saved in the note.
- **Edit primers beside the deck:** click a card to open its primer in the side panel (created on the spot if it doesn't exist yet), with the deck still in view.
- **Sideboard and deck changes:** `mtg-sideboard` and `mtg-changes` blocks show what comes out of the deck and what goes in, with an arrow between the cards, the totals and the reason for each change.

![A decklist shown as stacks of cards](https://raw.githubusercontent.com/diogoleal/mtg-card-primers/main/docs/images/deck-images.png)

| Sideboard guide | Deck changes |
|---|---|
| ![A sideboard guide: the cards that come out, an arrow, and the cards that go in](https://raw.githubusercontent.com/diogoleal/mtg-card-primers/main/docs/images/sideboard.png) | ![A log of deck changes in the text view](https://raw.githubusercontent.com/diogoleal/mtg-card-primers/main/docs/images/deck-changes.png) |

**Combos**
- **`mtg-combo` block:** the combo's cards as images in the zones where they need to be (battlefield, graveyard, stack…), joined by `+`, with sacrificed, tapped and on-the-stack cards marked, targets (`> each opponent`) and tokens (`[Zombie 2/2]`).
- **Explain it:** keywords at the top (`infinite mana`, `win the game`), result chips, a *How it works* section and a *Weak points* section, all in Markdown with links and mana symbols.

**In any note**
- **Symbols:** mana `{1}{B}`, tap `{T}`, loyalty `[+1]`, level `[LEVEL 1-4]`, set symbols `{set:dsc:m}` and Commander brackets `[BRACKET 3]`.
- **Insert commands:** a card's text, its art, the full card image of any edition, or its set symbol.
- **`mtg-card` block:** a card with image, cost, type and text inside a note; works offline from the primer's saved data.

| Grid view | Text view | Edition picker |
|---|---|---|
| ![Grid view](https://raw.githubusercontent.com/diogoleal/mtg-card-primers/main/docs/images/deck-grid.png) | ![Text view](https://raw.githubusercontent.com/diogoleal/mtg-card-primers/main/docs/images/deck-text.png) | ![Edition picker](https://raw.githubusercontent.com/diogoleal/mtg-card-primers/main/docs/images/picker.png) |

### Syntax cheat sheet

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

## Installation

In Obsidian, open **Settings → Community plugins → Browse**, search for **MTG Card Primers**, then install and enable it.

### Manual installation

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

## Usage

### Commands

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

### Card search

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

### Insert into the note (at the cursor)

Each command inserts plain Markdown, so the result stays readable even without the plugin.

| Command | What it inserts |
|---|---|
| **Insert card text** | A blockquote with name, cost, type line, oracle text and power/toughness, loyalty or defense (one blockquote per face). Planeswalker abilities and level bands are written as `[+1]:` and `[LEVEL 1-4]`, so they render as symbols. |
| **Insert card art (illustration only)** | `![Name · SET #no.](…/art_crop/…)`: only the illustration, at the full note width. |
| **Insert full card image (choose edition)** | `![Name · SET #no.\|250](…/normal/…)`: the whole card, 250 px wide. Double-faced cards insert both faces. |
| **Insert set symbol** | `{set:dsc:m}`: the set symbol of the chosen edition, in its rarity colour. |

After you choose the card, the last three commands show a list of editions with thumbnail, set symbol, set name, collector number, year and rarity. Type to filter it. The first entry is the reference printing from the settings. If you paste a Moxfield line that includes the set (`Sol Ring (C21) 263`), that edition is used directly and the list is skipped.

Images are links to Scryfall. Nothing is downloaded into the vault.

### Note format

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

The Combos section has an `mtg-combo` block with the card on the battlefield and the other fields empty, ready to fill in (see [`mtg-combo` block](#mtg-combo-block-combos)). In a custom template, put `{{combo}}` where you want it.

The Decklist section has an `mtg-deck` block that starts with the card. A card that can be your commander (a legendary creature, or one whose text says so) goes under `Commander` with an empty `Deck` below it; any other card goes under `Deck`:

````markdown
```mtg-deck
Commander
1 Grist, the Hunger Tide (MH2) 202

Deck
```
````

Turn off **Decklist in new primers** in the settings to leave it out. In a custom template, put `{{decklist}}` where you want the block.

### Deck primers

**New deck primer** asks for a commander and creates `MTG/Decks/<Commander> Primer.md`. Its frontmatter names the commander (`mtg_commander`, `mtg_color_identity`, tag `mtg/deck-primer`) but has no `mtg_oracle_id`, so it never replaces the commander's card primer.

The default deck template has: a summary quote, Decklist (the commander under `Commander`, an empty `Deck` to paste the 99 into), How the deck wins, Combos (a starting `mtg-combo` block), Tutors, Mulligan and opening hand, What shuts the deck down (a table to fill), and Deck changes (an empty [`mtg-changes`](#mtg-sideboard-and-mtg-changes-blocks-what-comes-in-and-out) block). Set your own in **Deck primer template**; it takes the same placeholders as the card template.

### `mtg-card` block

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

### `mtg-deck` block (decklists)

Paste a decklist exported from Moxfield, Arena or MTGO inside an `mtg-deck` block:

````markdown
```mtg-deck
title: Hunger Tide Aristocrats
view: images

Commander
1 Grist, the Hunger Tide (DSC) 220 *F*

Deck
1 Sol Ring (C21) 263
1 Anel Solar
4 Swamp
4 Forest

Sideboard
1 Imperial Seal
```
````

The block has three views, chosen with the **Text | Images | Grid** buttons in its header:

- **Text:** cards in columns by type (Commander, Creatures, Instants…, Lands, Sideboard), sorted by mana value, with their mana cost. Hovering a name shows the card.
- **Images:** one stack per type; the cards overlap so only their name bars show. Hover a card to see it whole.
- **Grid:** every card whole, one grid per type.

**Sorting**

The **Sort** menu next to the view buttons groups the deck in one of four ways:

| Sort | Groups | Inside each group |
|---|---|---|
| **Type** (default) | Creatures, Planeswalkers, Instants, Sorceries, Artifacts, Enchantments, Lands | by mana value, then name |
| **Name** | one A–Z list | by name |
| **Mana value** | Mana value 0, 1, 2… 7+, then Lands | by name |
| **Color** | White, Blue, Black, Red, Green, Multicolor, Colorless, Lands | by mana value, then name |

The commander (and companion) always comes first. Sideboard and maybeboard stay separate, sorted the same way. Colour means the card's colours, not its colour identity (front face for double-faced cards).

**Opening primers from the deck**

- **Click** a card (its name in Text, the card in Images or Grid): its primer opens in a tab in the right sidebar, so you can edit it and keep looking at the deck. The sidebar opens if it was closed.
- **The panel is reused:** clicking another card shows that card's primer in the same tab. If you close the tab or move it out of the sidebar, the next click makes a new one.
- **No primer yet?** It is created with the card's data (your folder and template), like *New card primer*.
- **Ctrl/Cmd-click** opens the primer in a new tab instead.
- Cards that Scryfall couldn't find behave like a plain `[[link]]`.
- **Mobile:** the primer opens in the right drawer.

The header shows the deck's colour identity and card count; the footer shows the mana curve (lands not counted).

**List format**

- **Options** (optional, before the first card): `title:` (defaults to the commander's name), `view:` (`text`, `images` or `grid`) and `sort:` (`type`, `name`, `cmc` or `color`).
- **Sections:** `Commander`, `Companion`, `Deck`, `Sideboard`, `Maybeboard`, `Tokens`… also written `// Sideboard`, `SIDEBOARD:` or `Sideboard (15)`. Without headers, every card is in the deck, and cards after a blank line are the sideboard (Arena export). After the commander, a blank line starts the deck, so a `Deck` header is not needed (`Commander` / `1 Grist, the Hunger Tide` / blank line / the 99).
- **Card lines:** the same as the card search: `4 Name`, `4x Name`, `(SET) 123` for an exact edition, names in any language, typos.
- **Repeated lines** for the same card are added together. Lines that Scryfall can't find are listed in a warning.

**Changing the note from the block**

Two actions write into the block's text, so the note opens the same way next time:

- **Choosing a view or a sort** sets the `view:` or `sort:` line.
- **Choosing an edition:** in Images or Grid, hover a card and click its edition button (or right-click the card; long-press on mobile). The edition list is the same as in *Insert full card image*, and it says which editions exist in foil. The choice is written into the card's line as `(SET) 123`; quantity, name and markers are kept.

If the block can't be located safely (for example inside a callout, or the note was edited meanwhile), the view changes only on screen, and a notice shows the line to change by hand.

**Foils**

Add Moxfield's markers to the end of a card line: `*F*` for foil, `*E*` for etched foil. Images and Grid show a moving foil sheen on the card (still when the system reduces motion); Text shows a `foil` or `etched` tag. The same card in foil and non-foil stays on two lines.

### `mtg-combo` block (combos)

The `mtg-combo` block draws a combo the way it sits on the table: each card as an image, in the zone where it has to be, joined by the operators that say what happens to it. Above the cards go the combo's name and keywords; below them, the results, an explanation and its weak points.

````markdown
```mtg-combo
title: Gravecrawler loop
keyword: infinite mana, win the game
battlefield:
~Phyrexian Altar - Gravecrawler + Grave Titan + Blood Artist > each opponent
graveyard:
Reassembling Skeleton
how:
Grave Titan keeps a Zombie around, so Gravecrawler can always be cast from the graveyard.

1. Sacrifice Gravecrawler to [[Phyrexian Altar]] for {B}.
2. Cast it again from the graveyard with that {B}.
weak:
- [[Rest in Peace]] and [[Grafdigger's Cage]] stop it.
result: infinite death triggers, infinite drain
```
````

Read the example line by line:

- `title:` is the name shown at the top, and `keyword:` adds the coloured badges next to it.
- `battlefield:` starts a zone. The line under it holds four cards:
  - `~Phyrexian Altar`: the Altar, tapped.
  - `- Gravecrawler`: Gravecrawler, sacrificed.
  - `+ Grave Titan`: Grave Titan, working with the cards before it.
  - `+ Blood Artist > each opponent`: Blood Artist, pointing at each opponent.
- `graveyard:` starts a second zone with one card.
- `how:` and `weak:` are free Markdown text. They become two collapsible sections, *How it works* and *Weak points*.
- `result:` lists what the combo produces, shown as chips under the cards.

Only the cards are required. Everything else is optional.

#### The smallest combo

A list of cards joined by `+` is already a combo. Lines that come before any zone go to the battlefield:

````markdown
```mtg-combo
Kiki-Jiki, Mirror Breaker + Zealous Conscripts
```
````

#### Zones

A zone is its name followed by `:`. The cards go on the lines below it, one line per group. A blank line or the next zone ends it.

| Zone | Also accepted |
|---|---|
| `battlefield:` | `field:`, `bf:`, `board:`, `campo:` |
| `hand:` | `mão:` |
| `stack:` | `pilha:` |
| `graveyard:` | `gy:`, `yard:`, `cemitério:` |
| `exile:` | `exílio:` |
| `library:` | `grimório:` |
| `command zone:` | `command:`, `commander:`, `zona de comando:`, `comando:` |

Zone names ignore case and accents (`Cemiterio:` works).

- **Cards on the same line** as the zone also work: `graveyard: Reassembling Skeleton`.
- **Each line is a row.** Use several lines to group the cards, for example the engine on one line and the payoff on the next.
- **The order you write is the order shown.** Writing the same zone twice adds to the first one.
- **Layout:** battlefield, hand, stack and command zone fill the main column. Graveyard, exile and library sit in a narrower column at the side, like on a playmat. On a narrow screen the side column moves below.

````markdown
```mtg-combo
command zone: Grist, the Hunger Tide
battlefield:
Phyrexian Altar + Pitiless Plunderer
Blood Artist
hand: Entomb
graveyard: Reassembling Skeleton
```
````

#### Cards

Each piece between operators is a card, looked up on Scryfall. Any of these work:

- **A name:** `Sol Ring`. Capitalisation doesn't matter.
- **A link:** `[[Sol Ring]]`, or `[[Sol Ring|the ring]]` (the alias is ignored).
- **A Moxfield line:** `1 Reassembling Skeleton (M19) 116` shows that edition.
- **A name in another language:** `Anel Solar`.

Click a card to open its primer in the side panel, like in a decklist. If a card can't be found, the block still shows the others and lists the missing names under the cards (*Not found on Scryfall*).

Lines that start with `//` are comments and are not shown.

#### Operators

The operators go **before** a card. They say how that card relates to the one before it and what state it is in.

| Write | Meaning | Shows |
|---|---|---|
| `A + B` | B works with, or depends on, A | `+` between the cards |
| `A - B`, `-B` | B is sacrificed, removed or destroyed | red `−`, card greyed out with ✕ |
| `*B` | B is on the stack | card tilted, orange border |
| `~B` | B is tapped | card turned sideways, with {T} |
| `A or B`, `A \| B` | any one of these cards | the options in a dashed box |
| `A > target` (also `->`, `→`) | A targets a player, an object or a card | yellow arrow, then the target |
| `[Zombie 2/2]` | a token | the token's image |

**`+` depends on.** The cards work together. A card with no operator after the first one also gets a `+`, so `A + B + C` is the usual way to list the pieces:

```
Isochron Scepter + Dramatic Reversal + Sol Ring
```

**`-` sacrificed or removed.** Use it for what the loop throws away: the creature you sacrifice, the Treasure you crack, the permanent that leaves. It can come between two cards or at the start of the line:

```
Phyrexian Altar - Reassembling Skeleton
-Gravecrawler + Carrion Feeder
```

**`*` on the stack.** For a spell or ability waiting to resolve. It works best in a `stack:` zone:

```
stack:
*Dramatic Reversal
```

**`~` tapped.** For a permanent that must already be tapped, or that taps as the cost:

```
~Basalt Monolith + Rings of Brighthearth
```

**Several operators at once.** Write them together in front of the card. `-~[Treasure]` is a tapped Treasure that gets sacrificed:

```
Pitiless Plunderer + -~[Treasure]
```

**`or` alternatives.** For "any of these does the job". The options go in a dashed box with "or" between them. `ou` (Portuguese) and `|` also work:

```
Ashnod's Altar or Phyrexian Altar - Gravecrawler
Carrion Feeder | Viscera Seer | Woe Strider
```

**Names with symbols in them.**

- **Hyphens:** a hyphen inside a name is not an operator, because `-` only counts at the start of a piece or after a space. `Mind-Bomb` and `Kiki-Jiki, Mirror Breaker` stay whole.
- **The word "or" or other symbols:** quote the name (`"Fight or Flight"`) or use a link (`[[Fight or Flight]]`). The parser doesn't look inside quotes or links.

#### Targets

`>` (or `->`, `→`) after a card says what it points at. What comes after the arrow decides how the target is shown.

**Players.** Shown as a labelled box with an icon:

| Write | Shows |
|---|---|
| `me`, `you`, `eu`, `mim` | You |
| `target opponent`, `an opponent`, `oponente alvo` | Target opponent |
| `each opponent`, `all opponents`, `todos os oponentes`, `cada oponente` | Each opponent |
| `target player`, `a player`, `jogador alvo` | Target player |
| `each player`, `everyone`, `todos os jogadores`, `todos` | Each player |
| `any target`, `qualquer alvo` | Any target |

**Kinds of objects.** Words like `target creature`, `a land`, `another artifact`, `two artifacts`, `up to one nonland permanent`, `criatura alvo` or `uma criatura` are shown as written, in a box. The object words are:

- creature, artifact, enchantment, land, planeswalker, permanent;
- spell, ability, token, battle, card;
- their Portuguese forms: criatura, artefato, encantamento, terreno…

**Cards.** Anything else is taken as a card and shown with its image and a crosshair. Quote it to force a card when the name looks like one of the words above. A token in brackets also works as a target.

**Several targets.** Repeat the arrow:

```
Sanguine Bond > target opponent
Blood Artist > each opponent > me
Kiki-Jiki, Mirror Breaker > Zealous Conscripts
Zealous Conscripts > Kiki-Jiki, Mirror Breaker
Walking Ballista > any target
Swords to Plowshares > "Grave Titan"
```

An operator after the arrow marks the target: `Fling > -Grave Titan` shows Grave Titan being sacrificed. A target with no card before it (a line that starts with `>`) is ignored.

#### Tokens

A token goes in square brackets. Inside the brackets, all in any order except that the quantity comes first or last:

| Part | Examples | Notes |
|---|---|---|
| quantity | `3`, `3x`, `x3` | optional; shows a ×3 badge and a stack |
| name | `Zombie`, `Eldrazi Spawn`, `Treasure` | in English, as Scryfall names it; `token` / `ficha` is skipped |
| power/toughness | `2/2`, `1/1`, `0/1`, `*/*`, `X/X` | optional; narrows the search |
| colour | `black`, `preto`, `B`, `BG`, `colorless`, `incolor` | optional; narrows the search |

```
[Zombie 2/2]
[Zombie 2/2 black]
[3x Insect 1/1 BG]
[Treasure]
[Eldrazi Spawn 0/1 colorless x2]
[ficha Zumbi 2/2 preto]
```

- **Image:** it comes from Scryfall's tokens. A token with no rules text is preferred, so `[Insect 1/1]` finds the vanilla Insect and not one with flying.
- **Drawn tokens:** a token Scryfall doesn't know, like `[ficha Zumbi 2/2 preto]` with its name in Portuguese, is drawn as a card with its name, colour and power/toughness.
- **Operators and targets** work on tokens too: `-[Eldrazi Spawn]`, `~[Treasure]`, `Fling > -[Zombie 2/2]`.

#### Fields

Each field starts its own line.

| Field | Also | Shows |
|---|---|---|
| `title:` | `título:` | the combo's name |
| `keyword:` | `keywords:`, `tags:`, `destaque:`, `palavra-chave:` | coloured badges next to the title; the first one also colours the block's top edge |
| `result:` | `results:`, `resultado:` | result chips under the cards |
| `how:` | `how it works:`, `explanation:`, `como funciona:`, `explicação:` | a collapsible *How it works* section |
| `weak:` | `weak points:`, `weaknesses:`, `problems:`, `downsides:`, `pontos fracos:`, `problemas:`, `fraquezas:` | a collapsible *Weak points* section |

**`keyword:` and `result:`** take a list separated by commas or semicolons. The list can be on the same line, or on the lines below the field (one per line, with or without `- `) until a blank line or another field:

````markdown
```mtg-combo
keyword: infinite mana; win the game
battlefield:
Basalt Monolith + Rings of Brighthearth
result:
- infinite colourless mana
- infinite untap triggers
```
````

**Colours and icons** come from the words in each keyword or result. The first rule that matches wins:

| Words | Icon | Colour |
|---|---|---|
| win, wins, victory, vitória, vence | trophy | gold |
| kill, damage, drain, ping, burn, lose life, mata, dano, dreno | swords | red |
| mana | gem | blue |
| life, lifegain, lifelink, vida | heart | green |
| death, dies, sacrifice, morte, morre | skull | purple |
| token, tokens, ficha, fichas | copies | orange |
| draw, cards, mill, compra, cartas, moer | book / arrow | cyan |
| storm, cast, ETB, enters, turns, counters, tutor, search… | own icon | neutral |
| anything else | ∞ | neutral |

So `drain each opponent` is red (damage comes before life), and `ganho de vida infinito` is green.

**`how:` and `weak:`** are Markdown, like the rest of the note:

- **Content:** they can span many lines and paragraphs, with lists, numbered steps, `[[links]]` (with hover previews), bold text and mana symbols (`{B}`, `{T}`, `{E}`).
- **Where they end:** at a `title:`, `keyword:` or `result:` line, at the other text field, or at a zone name alone on its line. A blank line does **not** end them, so you can write several paragraphs.
- **Order:** put them after the zones (or put the zones first). A line like `graveyard:` inside the text starts the zone, and the text ends there.

If there is no `result:` line, the **bold** text in the numbered steps becomes the results.

#### Note format

A combo can also be written the way it reads in a note: a Markdown heading with the title and the pieces, numbered steps and remarks. This is useful to turn an existing note into a block without rewriting it:

````markdown
```mtg-combo
### Combo 1 — [[Reassembling Skeleton]] + [[Phyrexian Altar]] + [[Pitiless Plunderer]]
1. Sacrifice the Skeleton to the Altar → one mana of any colour.
2. The Plunderer creates a Treasure.
3. Pay {1}{B} and return the Skeleton. **Infinite death triggers.**

The Skeleton works from the graveyard: [[Entomb]] already sets it up.
```
````

- **Heading:** the text before ` — ` (or ` – `, or `: `) is the title, and the cards after it appear under *Pieces*. A heading with no cards (`### Combo 1`) is only the title.
- **Numbered steps** (`1.` or `1)`) go to *How it works*. An indented line continues the step above it.
- **Remaining text** after the cards is shown as a note below the block.
- **Mixing:** both formats can be mixed. Add zones, `keyword:` or `weak:` to a combo written as a note.

#### Examples

**Kiki-Jiki + Zealous Conscripts.** Infinite hasty copies. Each creature targets the other:

````markdown
```mtg-combo
title: Kiki-Jiki + Conscripts
keyword: infinite tokens, win the game
battlefield:
Kiki-Jiki, Mirror Breaker or Splinter Twin + Zealous Conscripts
how:
1. Tap [[Kiki-Jiki, Mirror Breaker]] to copy [[Zealous Conscripts]].
2. The copy enters with haste and untaps Kiki-Jiki.
3. Repeat, then attack with all the copies.
weak:
- Instant-speed removal in response to the first activation.
- [[Torpor Orb]] stops the Conscripts' trigger.
result: infinite hasty Conscripts
```
````

**Isochron Scepter + Dramatic Reversal.** A spell on the stack and tapped mana rocks:

````markdown
```mtg-combo
title: Dramatic Scepter
keyword: infinite mana
battlefield:
~Isochron Scepter + ~Sol Ring + ~Arcane Signet
stack:
*Dramatic Reversal
how:
With [[Dramatic Reversal]] imprinted on the Scepter and nonland mana sources that make {3} or more:

1. Tap the rocks for mana.
2. Pay {2} and tap the Scepter to cast a copy of Reversal: everything untaps.
3. Repeat. Each loop leaves you with the extra mana.
weak:
- [[Stony Silence]], [[Collector Ouphe]] and [[Null Rod]] stop the rocks and the Scepter.
- Artifact removal before the Scepter has imprinted.
result: infinite colourless mana, infinite storm count
```
````

**Thassa's Oracle + Demonic Consultation.** A win with an empty library:

````markdown
```mtg-combo
title: Thoracle
keyword: win the game
hand:
Thassa's Oracle
stack:
*Demonic Consultation or Tainted Pact
how:
Cast [[Demonic Consultation]] naming a card that isn't in the deck: it exiles the whole library. Then cast [[Thassa's Oracle]] with no cards left.
weak:
- A counterspell on the Oracle with the library already exiled loses the game.
- [[Torpor Orb]] or [[Hushbringer]] stop the Oracle's trigger.
result: win the game
```
````

**Sanguine Bond + Exquisite Blood.** Targets and a two-sided loop:

````markdown
```mtg-combo
title: Bond + Blood
keyword: drain each opponent, life
battlefield:
Sanguine Bond > target opponent
Exquisite Blood > me
how:
Gaining life makes an opponent lose life, and an opponent losing life makes you gain life. Any life gain or loss starts the loop.
weak:
- Enchantment removal, or an opponent who can't lose life ([[Platinum Angel]]).
result: drain target opponent, infinite lifegain
```
````

**Walking Ballista + Heliod.** Any target, counters and a wincon:

````markdown
```mtg-combo
title: Heliod Ballista
keyword: kills all opponents
battlefield:
Heliod, Sun-Crowned + Walking Ballista > any target
how:
Give [[Walking Ballista]] lifelink with Heliod ({1}{W}). Each ping gains 1 life, which puts a +1/+1 counter on Ballista. Remove that counter to ping again.
result: infinite damage, infinite counters
```
````

**Gravecrawler with Zombie tokens.** Alternatives, a token and the graveyard:

````markdown
```mtg-combo
title: Gravecrawler + Altar
keyword: mortes infinitas
battlefield:
Phyrexian Altar - Gravecrawler
[Zombie 2/2] or Carrion Feeder or Grim Servant
graveyard:
Gravecrawler
how:
1. Sacrifice Gravecrawler to the Altar for {B}.
2. Cast it from the graveyard with that {B}. It needs **another** Zombie.
3. Repeat. Mana neutral.
weak:
- Doesn't win alone: needs [[Blood Artist]] or [[Zulaport Cutthroat]].
- [[Grafdigger's Cage]], [[Rest in Peace]] and [[Leyline of the Void]].
result: infinite death triggers, infinite ETB, infinite casts
```
````

**In Portuguese.** Zones, fields, targets and colours are also accepted in Portuguese:

````markdown
```mtg-combo
título: Grist + Plunderer
palavra-chave: mana infinita, vitória
campo:
Ashnod's Altar - Reassembling Skeleton + Pitiless Plunderer + Zulaport Cutthroat > todos os oponentes
-[Treasure]
cemitério: Reassembling Skeleton
como funciona:
1. Sacrifique o Skeleton no Altar → {C}{C}. O Plunderer cria um Tesouro.
2. Pague {1}{B} com {C} + o Tesouro e devolva o Skeleton.
3. **Sobra {C} por volta.**
pontos fracos:
- [[Stony Silence]] desliga o Altar e os Tesouros.
resultado: mana incolor infinita, dreno infinito
```
````

### `mtg-sideboard` and `mtg-changes` blocks (what comes in and out)

Shows what leaves the deck and what takes its place, with an arrow between them. Use `mtg-sideboard` for a sideboard guide (what to bring in for each matchup) and `mtg-changes` to log the changes you make to a deck. They work the same; only the default title differs (*Sideboard* or *Deck changes*).

````markdown
```mtg-sideboard
Fabled Passage -> Verdant Catacombs
```
````

![A sideboard guide in the images view](https://raw.githubusercontent.com/diogoleal/mtg-card-primers/main/docs/images/sideboard.png)

The cards that come out are on the left, with a red border and `−1`; the ones that go in are on the right, with a green border and `+1`. The header adds them up (`−5 +5`) and warns when the deck ends bigger or smaller (`deck −1`). A block with only cuts, or only additions, shows just that side's total. Click a card to open its primer, like in a decklist. **Images** / **Text** switches to a compact list with mana costs and hover previews, and is saved in the block as `view: text`.

**One change per line**, with the arrow between what comes out and what goes in:

| Write | Means |
|---|---|
| `Fabled Passage -> Verdant Catacombs` | one out, one in (`→`, `=>` and ` > ` work too) |
| `Fabled Passage: -> Verdant Catacombs` | the same; a colon before the arrow is ignored |
| `2 Shock -> 2 Duress`, `2x Shock`, `Shock x2` | quantities |
| `Shock + Lightning Bolt -> Duress` | several cards on a side, joined by ` + ` or `;` |
| `Sol Ring ->` | only comes out |
| `-> Rest in Peace` | only goes in |
| `Shock -> Duress — the combo matchup` | the reason, after ` — `, ` – ` or ` -- `, shown under the change |

Cards can be names, `[[links]]` or Moxfield lines (`1 Thoughtseize (2XM) 107` shows that edition). Commas, hyphens and `//` stay in the name: `Kiki-Jiki, Mirror Breaker`, `Fire // Ice`. Lines starting with `//` are comments.

The reason belongs to the whole change, so `Chrome Mox + Mox Diamond -> — too slow` explains both cards at once. It is Markdown: `[[links]]` show the card on hover and `{1}{B}` becomes mana symbols.

**Moxfield-style lines.** `-1 Card` comes out and `+1 Card` goes in. Lines in a row make one change, until a blank line or a new `-` after the `+`:

````markdown
```mtg-changes
-1 Fabled Passage
-1 Evolving Wilds
+2 Verdant Catacombs
```
````

**`out:` / `in:` lists**, one card per line (or on the same line), until a blank line. Also accepted: `cut:`, `remove:` / `add:`, and in Portuguese `sai:`, `saem:`, `tira:` / `entra:`, `entram:`, `coloca:`.

````markdown
```mtg-sideboard
out:
2 Thoughtseize
Counterspell
in:
2 Kozilek's Return
Fire // Ice — kills mana dorks
```
````

**Groups.** A line ending with `:` (`vs. Aggro:`) or a Markdown heading (`## vs. Control`) starts a group with its own totals. Other lines become notes under the group, in Markdown with links and mana symbols. Leave a blank line before a note that follows an `out:`/`in:` list, or it is read as a card.

````markdown
```mtg-sideboard
title: Sideboard guide
vs. Aggro:
out: 2 Thoughtseize
Counterspell
in: 2 Kozilek's Return
Fire // Ice — kills mana dorks

vs. Control:
-2 Swords to Plowshares
+2 Mana Drain

Keep [[Teferi, Time Raveler]] in: it stops their instant-speed answers.
```
````

**Options:** `title:` (or `título:`) replaces the default title; `view: images` or `view: text` picks the view.

**Candidates.** Changes you are still weighing work the same way, as additions or cuts with no other side. Each list shows only its own total:

````markdown
```mtg-changes
title: Candidates to add
-> Demonic Tutor — any card to hand for {1}{B}
-> Witherbloom Apprentice + Chain of Smog — a two-card combo that graveyard hate doesn't stop
-> Chrome Mox + Mana Vault + Mox Diamond — fast mana
```
````

````markdown
```mtg-changes
title: Candidates to cut
Morbid Opportunist -> — draws one card a turn and is in no combo
Soul Shatter + Sheoldred's Edict -> — the deck has better removal
```
````

**A deck log.** In a deck primer, one group per update keeps the history of the list. In the text view it reads like a changelog:

![A deck log in the text view](https://raw.githubusercontent.com/diogoleal/mtg-card-primers/main/docs/images/deck-changes.png)

````markdown
```mtg-changes
## 2026-11-08
Fabled Passage -> Verdant Catacombs — enters untapped sooner
Sol Ring ->
-> Rest in Peace — too many graveyard decks at the table

## 2026-10-20
-1 Swamp
+1 Bojuka Bog
```
````

**Good to know**

- **`-` and `+` at the start of a line are cards.** A Markdown list like `- keep the counters` is read as a card coming out. Write notes as plain lines, or after ` — ` on the change itself.
- **The tally doesn't read your decklist.** It counts only what is written in the block, so a list of 18 candidates to add and 6 to cut shows `deck +12`, a reminder of how many cuts are still missing.
- **Cards not found** on Scryfall are drawn with their name and listed under the block.

### Hover popup

Hover over a link such as `[[Phyrexian Altar]]` (reading view or Live Preview) and the card image appears.

- **Link to a primer** (a note with `mtg_oracle_id`): shows the card from the frontmatter. Offline, it shows the saved text.
- **Link with no note:** looks up the **exact** name on Scryfall, in English or any other language (`[[Anel Solar]]`, `[[Sonnenring]]`). If it is not a card, nothing appears.
- **Link to a regular note:** nothing appears, and Obsidian's native preview works as usual.
- **Native preview on card links:** the "… is not created yet. Click to create." popover is hidden. Clicking the link still works as usual.
- `[[Card|alias]]` and `[[Card#heading]]` work too. The popup can be turned off in the settings.

### Mana symbols

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

### Set symbols

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

### Commander brackets

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

### Settings

- **Primers folder** (default `MTG/Primers`).
- **Template:** path of a note. Supports `{{name}}`, `{{front_name}}`, `{{oracle_id}}`, `{{decklist}}` (the starting `mtg-deck` block) and `{{combo}}` (the starting `mtg-combo` block). The template's own frontmatter is dropped.
- **Decklist in new primers** (on by default): adds the Decklist section to the default template.
- **Deck primers folder** (default `MTG/Decks`) and **Deck primer template**: where *New deck primer* creates notes and which template it uses (empty = the default deck template).
- **Hover popup** (on by default).
- **Mana symbols** (on by default): turns all the symbols above on or off (mana, loyalty, level, set and bracket). Notes already open in reading view update when reopened.
- **Reference printing:** the printing saved in new primers and listed first in the edition picker.
  - *As given:* the set/number from the line, or Scryfall's default printing when only a name is given.
  - *Latest:* the most recent paper printing. Costs one extra request.

## Scryfall

- Every request goes through Obsidian's `requestUrl` with `User-Agent: MtgCardPrimers/<version>` and `Accept: application/json`.
- One request at a time, spaced per endpoint:
  - 500 ms after `/cards/named`, `/cards/search` and `/cards/collection`.
  - 100 ms after all other endpoints.
  - An HTTP 429 pauses all requests for 30 s.
- Results are cached in memory for the session. Failed requests are not cached, except "not found" answers.
- The set list (`/sets`, for set symbols) is fetched at most once per session.
- Decklists are fetched with `/cards/collection`: one request per 75 cards. Only lines it can't match exactly (typos, names in other languages) are looked up one by one.
- Tokens in `mtg-combo` blocks are looked up with `/cards/search` (`t:token`, name, power/toughness, colours), once per token per session.
- Only card lookups are sent to Scryfall: what you type in the search, the names of links you hover, card and token names in `mtg-card`, `mtg-deck`, `mtg-combo`, `mtg-sideboard` and `mtg-changes` blocks, set codes and card ids. Note contents are never sent.

## Tests

```bash
npm test
```

Unit tests (`node:test`, no dependencies) cover:

- the Moxfield line parser
- the decklist parser and its options
- the `mtg-combo` parser (zones, operators, targets, tokens, fields)
- the `mtg-sideboard` / `mtg-changes` parser (arrows, quantities, lists, groups, reasons)
- matching card names in other languages
- file name sanitization
- link path cleanup
- the symbol scanner (mana, loyalty, level, set and bracket symbols)
- the Markdown built by the insert commands

## Releasing

1. Bump the version: `npm version patch` (or `minor`). This updates `manifest.json`, `package.json` and `versions.json`.
2. Push the commit and the tag: `git push && git push --tags`. The tag must equal the version, with no `v` prefix (`0.8.1`).
3. The **Release** workflow builds the plugin and creates a draft GitHub release with `main.js`, `manifest.json` and `styles.css`. Review it and publish.

## License

[MIT](LICENSE)
