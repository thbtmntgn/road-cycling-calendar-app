# Cycling Race Calendar App

A mobile application for tracking professional cycling races.

## Features

- View upcoming UCI races
- Filter races by gender (Men/Women)
- Browse startlists and stage details
- Dark mode UI

## Technology Stack

- React Native 0.83 / Expo 55
- TypeScript
- React Navigation v7
- dayjs

## Setup Instructions

1. Clone the repository
2. Run `npm install`
3. Run `npm run fetch-races`
4. Run `npm start`

Do not launch the app with `npx expo start` directly. The npm scripts run a pre-check that ensures your local PCS data file exists first.

## Local Data Workflow

- PCS data is fetched only on your computer
- The scraper generates `src/generated/pcsData.ts` locally — that file is ignored by Git and never committed
- `npm run fetch-races` uses a rolling 2-month window centered on today
- `npm run fetch-races-full` fetches the full season when you need a complete rebuild
- Startlists are refreshed for completed races plus upcoming races within the next 7 days; stage details are still fetched for all multi-day races in the selected window
- The scraper uses limited parallelism plus a local team-country cache at `scripts/.cache/team_country_cache.json`
- Re-run `npm run fetch-races` whenever you want fresher data, then reload the app

## Screenshots

| | | |
| --- | --- | --- |
| ![Home](docs/home.png) | ![Home 1](docs/home1.png) | ![Startlist](docs/startlist.png) |
