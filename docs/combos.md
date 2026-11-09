# Combos: the `mtg-combo` block

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

## The smallest combo

A list of cards joined by `+` is already a combo. Lines that come before any zone go to the battlefield:

````markdown
```mtg-combo
Kiki-Jiki, Mirror Breaker + Zealous Conscripts
```
````

## Zones

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

## Cards

Each piece between operators is a card, looked up on Scryfall. Any of these work:

- **A name:** `Sol Ring`. Capitalisation doesn't matter.
- **A link:** `[[Sol Ring]]`, or `[[Sol Ring|the ring]]` (the alias is ignored).
- **A Moxfield line:** `1 Reassembling Skeleton (M19) 116` shows that edition.
- **A name in another language:** `Anel Solar`.

Click a card to open its primer in the side panel, like in a decklist. If a card can't be found, the block still shows the others and lists the missing names under the cards (*Not found on Scryfall*).

Lines that start with `//` are comments and are not shown.

## Operators

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

## Targets

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

## Tokens

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

## Fields

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

## Note format

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

## Examples

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

---

[← Back to the README](../README.md)
