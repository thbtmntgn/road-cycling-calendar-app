# Cycling Race Calendar App

A mobile application for tracking professional cycling races.

## Features

- View upcoming UCI races
- Filter races by gender (Men/Women)
- Mark races as favorites
- Dark mode UI

## Technology Stack

- React Native with Expo
- TypeScript
- Zustand for state management

## Setup Instructions

1. Clone the repository
2. Run `npm install`
3. Run `npm run fetch-races`
4. Run `npm start`

Do not launch the app with `npx expo start` directly. The npm scripts run a pre-check that ensures your local PCS data file exists first.

## Local Data Workflow

- PCS data is fetched only on your computer
- The scraper writes a local generated file used by the app
- That generated file is ignored by Git and never needs to be pushed
- Re-run `npm run fetch-races` whenever you want fresher data, then reload the app

## Screenshots

[Add screenshots of your app here]
