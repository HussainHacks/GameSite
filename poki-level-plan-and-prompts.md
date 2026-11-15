# Neon Arcade to Poki Level: Plan and Agent Prompts

Prepared 2026-11-14. Repo: HussainHacks/GameSite.
Working loop: Jarvis writes the prompts, Jeff pastes them into Antigravity, the agent builds and pushes, Jarvis reviews the push on GitHub and writes the next prompt. One stage at a time. Never start the next stage until the current one is pushed and reviewed.

## Where Neon Arcade stands now (verified on GitHub, 2026-11-14)

- One initial commit, public repo, description set.
- Catalog data file (public/js/games-data.js, about 75 KB) with about 110 open source game entries across 6 categories, with author and license attribution per game.
- 12 games actually built in and playable offline under public/games: 2048, Snake, Neon Tetris, Space Invaders, Breakout, Pong, Flappy, Hextris, Minesweeper, Memory Matrix, Tic Tac Toe, Cyber Runner.
- Zero dependency Node server (server.js), PWA manifest and service worker, virtual touch gamepad, search, filters, favorites.
- netlify.toml already publishes the public folder with sensible cache and header rules.
- Gaps: no LICENSE file in the root, no repo topics, no live site URL yet, no real thumbnails, no per game pages, no ratings or play counts, no category pages.

## What Poki level means (checked on poki.com, 2026-11-14)

- About 1,500 games, all instant play in the browser, on mobile, tablet, and desktop.
- A trending rail driven by live play stats, and a star rating on every game card.
- Category pages with game counts: Puzzle 250+, Car 150+, Sports 150+, Multiplayer 150+, 2 Player 130+, Shooting 110+, Dress Up 65+, IO 35+, Cooking 30+, Drawing 30+.
- An exclusives section for original games, with an editorial score.
- Every game is tested by their team before it is featured. Curation and QA are the product.
- Scale honesty: Poki is a 65 person team building since 2014 with over 100 million players a month. The goal here is the same experience pattern at indie scale: instant play, real thumbnails, ratings, trending, category pages, fast loads, and a catalog where every single game actually works. Not the traffic and not 1,500 games on day one.

## The gap, in priority order

1. Presentation: Poki cards use real game thumbnails. Neon Arcade uses generated canvas art. Real thumbnails are the single biggest visual jump.
2. A real player page per game: its own URL, instant play, fullscreen, related games, recently played.
3. Social proof numbers: rating and play count on every card, and a trending rail computed from plays.
4. Discovery depth: category pages with their own URLs and counts, tag pages, search with suggestions.
5. Performance discipline: lazy loading, compressed thumbnails, caching, a Lighthouse mobile score of 90 or better.
6. Catalog growth with QA: grow from 110 entries toward 300 or more, in batches, where every game is load tested and has a thumbnail, a license, and attribution.
7. SEO basics: per game titles and descriptions, sitemap, OpenGraph cards. This is how Poki gets found.

## Standing rules block (paste this at the top of every Antigravity session)

You are working on Neon Arcade (repo GameSite), a cyberpunk mobile first web gaming portal. Stack rules: keep the zero dependency Node server (server.js) and the static public folder deployable to Netlify with the existing netlify.toml. No frameworks, no build step, no new npm dependencies unless I approve them in this chat first. Every game in the catalog must keep its author credit, its open source license, and a link to its source repo. Work in small commits with clear messages and push when the stage is done. At the end of every task, give me a short report: what changed, what you tested, and anything that is still broken or untested. Do not claim a game works unless you actually loaded it.

## Stage 0 prompt: audit first, no code changes

Read this whole repo and produce a file called AUDIT.md in the repo root. Cover: (1) how the catalog data in public/js/games-data.js is structured, field by field; (2) how many catalog entries point to games that are actually playable inside this site versus entries that link out, and how the player currently opens a game; (3) what thumbnails or images each game currently uses; (4) the current home page sections, in order; (5) current performance risks you can see in the code, such as uncompressed assets or render blocking files; (6) a checklist of what is missing compared to a Poki style portal: real thumbnails, per game pages, ratings, play counts, trending, category pages, search suggestions, sitemap. Do not change any code in this stage. Commit AUDIT.md only.

## Stage 1 prompt: data model v2 and real thumbnails

Upgrade the catalog data model. Every game entry in public/js/games-data.js must have: slug (unique, URL safe), title, category, tags (array), thumbnail (path to a local image file), rating (number from 0 to 5, one decimal), plays (number), featured (boolean), controls (short text, for example "Arrow keys or swipe"), license, author, sourceUrl, and playUrl or a local path for built in games. Migrate all existing entries and keep every author, license, and source link intact. For the 12 built in games under public/games, create real thumbnail images from actual gameplay screenshots, saved under public/assets/thumbs with consistent dimensions, and point their thumbnail fields at those files. For catalog entries without a local thumbnail, add a field thumbnailStatus set to missing so we can track them. Update the home grid to render the thumbnail image on every card that has one, lazy loaded. Report counts at the end: entries migrated, thumbnails present, thumbnails missing.

## Stage 2 prompt: Poki style home page

Rebuild the home page sections in this order: (1) a Trending Now rail showing the 10 games with the highest plays value, with the rating shown on each card as stars and a number; (2) Top Rated rail, highest rating first; (3) New Games rail, most recently added first, which needs an addedAt date field, so add it to the data model and backfill; (4) category tiles for every category, each showing the live count of games in that category, linking to a category view filtered to it; (5) the full grid below with sort controls (Most Played, Top Rated, A to Z) and the existing search and favorites working exactly as before. Every card shows thumbnail, title, rating, and plays formatted compactly (for example 12.4K). Keep the cyberpunk design system and the mobile bottom navigation. Nothing may regress on mobile: test at a phone width and say so in your report.

## Stage 3 prompt: a real player page per game

Give every game its own URL in the form /game/<slug> served by the existing server and static structure. The player page must: load the game instantly in a large player area, offer a fullscreen button, show title, rating, plays, controls text, author, license badge, and source link, show a Related Games rail of 8 games from the same category, and record the visit in a Recently Played list kept in localStorage and shown on the home page. Opening a game increments its local play count for this browser. Favorites must work from the player page too. Built in games under public/games must play fully offline as they do today. External catalog games must open inside the player frame when their license and source allow embedding, and otherwise show a clear Play on Source button instead of a broken frame. Report any game where embedding failed.

## Stage 4 prompt: discovery depth

Add category pages at /category/<name> with the category game count, the same sort controls as home, and a one paragraph description per category stored in the data file. Add tag filtering: clicking a tag on a card or player page filters the grid to that tag. Upgrade search to show live suggestions as the user types, matching titles and tags, with keyboard navigation. Keep URLs shareable: category, tag, sort, and search state must be reflected in the URL query or path so a link can be pasted and land on the same view.

## Stage 5 prompt: performance pass

Make the site fast and prove it. Convert all thumbnails to WebP at sensible quality, lazy load every image below the first viewport, defer non critical scripts, and make sure the service worker caches the shell and thumbnails with a versioned cache name. The home page must not load the full games data file twice. Give me before and after numbers: total home page transfer size and the number of requests, measured locally. Target: home page under 1.5 MB total on first load with an empty cache, and no layout shift from thumbnails (reserve their aspect ratio in CSS).

## Stage 6 prompt: catalog growth with QA, batches of 25

Add the next 25 open source HTML5 games to the catalog. Rules for every added game: a real open source license (MIT, CC0, BSD, Apache 2.0, or GPL), a working play source, a real thumbnail, author credit, license, source repo link, correct category and tags, and a controls note. Prefer games that can be embedded or self hosted legally. After adding them, produce QA.md with one row per new game: title, did it load, did it accept input, mobile usable yes or no, thumbnail present yes or no. Remove or fix any game that fails. I will approve each batch before you start the next one. The long term target is 300 or more verified games, reached batch by batch, never by dumping untested entries.

## Stage 7 prompt: SEO and sharing basics

Add a unique title and meta description per game player page and per category page, OpenGraph tags with the game thumbnail as the share image, a sitemap.xml listing home, every category page, and every game page, and a robots.txt that allows crawling. Add a short About section to the home page explaining that every game is open source with its license and author credited. Update README.md with the live site URL field ready to fill, the architecture, and how to add a new game to the catalog in five steps.

## Not yet, on purpose

- No ads and no monetization until the experience is right and there is real traffic.
- No user accounts. Favorites and recently played in localStorage are enough.
- No multiplayer or original exclusive games until the catalog and player are solid. The 12 built in games are the seed of an originals section later.
- No chasing the 1,500 games number. 300 verified, working, well presented games beat 1,500 untested links.
