# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start              # Start development server (runs local PCS data check first)
npm run ios            # Launch iOS simulator (runs local PCS data check first)
npm run android        # Launch Android emulator (runs local PCS data check first)
npm run web            # Open in browser (runs local PCS data check first)
npm run fetch-races     # Scrape PCS for Q1 2026 only (--date-from 2026-01-01 --date-to 2026-03-31)
npm run fetch-races-full # Scrape PCS for the full season
npm run lint            # Run ESLint
npm run format          # Run Prettier
```

## Architecture

React Native + Expo app for tracking professional cycling races. Uses stack navigation with a Calendar screen and race detail screen.

**Data flow:** `scripts/fetch_races.py` generates `src/generated/pcsData.ts` locally → `racesApi.ts` loads it → CalendarScreen and RaceDetailScreen filter/display it.

**Key patterns:**

- PCS data is local-only. Run `npm run fetch-races` or `npm run fetch-races-full` to generate `src/generated/pcsData.ts` on your machine. That file is ignored by Git and should never be committed.
- Date logic uses `dayjs`. The `DateSelector` component generates a range of dates and `dateUtils.ts` handles relative labels ("Today", "Tomorrow").
- `RacesList` groups races by `RaceCategory` with collapsible sections. Categories are defined in `src/types/index.ts`.
- Network connectivity is monitored via `@react-native-community/netinfo`; `NoConnection` component is shown when offline.
- Accent color: `#4CAF50` (green). Dark theme throughout.

**Tech stack:** React Native 0.83 / Expo 55, TypeScript strict mode, React Navigation v7, Zustand 5, dayjs.

**PCS scraper notes (`scripts/fetch_races.py`):**

- `Race.category()` returns `'Men Elite'` or `'Woman Elite'` (singular) for gender detection
- WWT races are always Women regardless of `category()` return value
- Included: WorldTour (UWT/WWT), WorldChampionship (WC), ProSeries (Pro), NationalChampionship (NC), Continental (1.1/2.1); excluded: 1.2/2.2
- NC and WC are filtered to senior road races only — slugs with `-itt`, `u23`, `-mj`, `-wj`, `-jr`, `junior`, `-crit` are skipped
- Date pre-filtering happens in `fetch_race_slugs` by parsing the date from the races.php table (avoids HTTP requests for out-of-range races)
- One-day race distance: `Stage(f"{slug}/result").distance()` — `Race.stages()` returns empty for one-day races
- The scraper always performs a full pass and writes a single local runtime file
- Developers should use the npm scripts, not `expo start` directly, so the local-data check always runs
