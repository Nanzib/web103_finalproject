# Beatdle

CodePath WEB103 Final Project

Designed and developed by: Thomas Huang, Juan Apolo, and Nanzib Chowdhury

🔗 Link to deployed app: 

## About

### Description and Purpose

It is a music guessing game that combines daily Wordle-style challenges with customizable multiplayer sessions. Each day, all users get the same "Song of the Day" where they have 5 attempts to guess the track using progressive audio snippets (starting at 3 seconds, expanding with each attempt) and optional hints like genre, artist clues, or release era, with results shareable as emoji grids and streak tracking for daily players. Users can also create live multiplayer sessions via shareable links where the host customizes the experience by selecting specific genres, artists, and difficulty levels, Easy mode features mainstream hits with 500M+ Spotify listens, Medium includes popular songs with fewer streams, and Hard showcases deep cuts and obscure tracks with minimal plays. Friends join to compete by guessing songs with the same hint system while watching a live leaderboard update based on speed and how many guesses it took for them to get it right. The platform uses real-time gameplay with music APIs like Spotify for metadata and audio previews, and stores user statistics, daily challenges, session configurations, and leaderboards in PostgreSQL.

### Inspiration

This project draws inspiration from several popular games and platforms, blending their best mechanics into a single, music-focused experience:

    Wordle: The core concept for the daily challenge mode is heavily inspired by Wordle. This includes the "one-puzzle-per-day" model, the 5-attempt limit, simple streak tracking, and the iconic shareable emoji grid to show off your results without spoilers.

    Heardle: The most direct predecessor for the daily game. Heardle pioneered the "Wordle-for-music" format, and this project adopts its brilliant mechanic of using progressively longer audio snippets as the primary guessing tool.

    Kahoot!: The entire live multiplayer mode is modeled after Kahoot!'s real-time, social quiz format. The idea of a host creating a custom game, sharing a simple link for friends to join, and competing against a live leaderboard comes directly from this model.

    Jackbox Games: A major influence on the "social party game" feel. The concept of creating a "room" (or session) for friends to join instantly from their own devices (phones, laptops) for a fun, real-time competition is a hallmark of the Jackbox suite.

    SongPop: A classic in the music quiz genre. Its influence is seen in the fast-paced, competitive guessing format and the deep customization of playlists based on specific genres, artists, and decades.

## Tech Stack

### Frontend
* **Core:** React, TypeScript, Vite
* **Styling:** Tailwind CSS
* **Routing:** React Router

### Backend
* **Core:** Node.js, Express, TypeScript
* **Database:** PostgreSQL
* **API:** Spotify Web API (with `spotify-preview-finder` fallback)
* **Real-time:** Socket.IO

### Deployment
* **Platform:** Render

## Features

### Daily Song Challenge ✅ 

A Wordle-style daily game where all users have a limited number of attempts to guess the same "Song of the Day." Players can listen to progressively longer audio snippets with each guess to help them identify the track.

    Sub Feature - Score System ✅ 

    Players see their score based on how accurate they guess. Rewards early correct guesses and encourages careful listening

![Demo of Beatdle Gameplay](https://i.imgur.com/SFp23vn.gif)

### Live Multiplayer Sessions

Users can create or join real-time multiplayer games via a shareable link. The host customizes the game, and all players compete simultaneously to guess songs, with a live leaderboard tracking scores after each round.

[gif goes here]

### Leaderboards ✅

Displays high scores and player rankings. This includes a leaderboard for the Daily Song Challenge (ranking players by speed and attempts) and a separate all-time leaderboard for total points earned in multiplayer games.

![GIF](https://i.imgur.com/VeGlDzJ.gif)

### User Profiles & Stats ✅

Registered users have a personal profile page that tracks their game history, daily challenge streaks, average guess speed, win/loss ratio, and other key statistics.

![GIF](https://i.imgur.com/ml9M3Us.gif)

### Shareable Results ✅

After completing the Daily Song Challenge, users can copy their results to the clipboard as a spoiler-free grid of emojis. This allows them to share their performance on social media without revealing the song title.

![GIF](https://i.imgur.com/TnsED0I.gif)

[instructions go here]
