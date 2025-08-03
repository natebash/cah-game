# Cards Against All Sanity

A web-based, real-time multiplayer card game inspired by the classic party game, Cards Against Humanity. This project allows users to create and join game rooms, play with friends, and display the game on a central screen for a party setting.

 

## ✨ Features

- **Real-time Multiplayer:** Gameplay is synchronized for all players using WebSockets (Socket.IO).
- **Game Rooms:** Create a game and invite friends with a unique 4-letter game code.
- **Dedicated Board View:** A special view designed for a central TV or shared screen, showing the black card, submissions, and scoreboard.
- **Player & Host Roles:** The first player to create a game is the host and can start the game and kick players from the lobby.
- **Card Czar Rotation:** The role of the judge (Card Czar) automatically rotates to the next player each round.
- **Score Tracking:** The game automatically keeps score and declares a winner at the end.
- **Two Game Modes:**
  - **Score Limit:** The game ends when a player reaches a predefined score.
  - **Endless Mode:** The game continues until a vote is initiated and all active players unanimously agree to end it.
- **Player Reconnection:** If a player's connection drops, they have a 2-minute window to rejoin the game with their score and cards intact.
- **Kicking Players:** The host can remove players from the lobby before the game begins.

## 🚀 Setup and Installation

To run this project locally, you will need [Node.js](https://nodejs.org/) and npm installed on your machine.

1.  **Clone the repository (or download the files):**
    ```bash
    git clone https://github.com/natebash/cah-game.git
    cd cah-game
    ```

2.  **Install dependencies:**
    This project uses `express` and `socket.io`. Install them by running:
    ```bash
    npm install
    ```

3.  **Start the server:**
    ```bash
    node server.js
    ```

4.  **Play the game:**
    Open your web browser and navigate to `http://localhost:3000`.

## 룰 How to Play

1.  **Create or Join:**
    - One player selects "Create Game" to start a new lobby and becomes the host.
    - Other players select "Join Game," enter their name, and input the 4-letter game code provided by the host.
    - Optionally, one person can "Join as Board" on a laptop connected to a TV to display the main game board for everyone to see.

2.  **The Goal:**
    - The goal is to create the funniest or most fitting combination of white answer cards for the black question card.

3.  **Game Flow:**
    - Each round, one player is designated the **Card Czar**. They do not play any white cards.
    - The other players choose the required number of white cards from their hand to answer the prompt on the black card.
    - The submissions are shown anonymously to the Card Czar.
    - The Card Czar reads the combinations aloud and picks their favorite.
    - The player who submitted the winning card(s) receives one point.
    - The role of Card Czar rotates, and a new round begins.

4.  **Winning the Game:**
    - If playing to a score limit, the first player to reach that score wins.
    - In Endless Mode, the game continues until players unanimously vote to end it. The player with the highest score at that time is the winner.

## 🛠️ Technology Stack

- **Backend:** Node.js, Express
- **Real-time Communication:** Socket.IO
- **Frontend:** HTML5, CSS3, Vanilla JavaScript

## ⚖️ Disclaimer

This is an unofficial fan project and is not affiliated with, sponsored, or endorsed by Cards Against Humanity, LLC.

The card content used in this project is based on the game *Cards Against Humanity*, which is distributed under a Creative Commons BY-NC-SA 4.0 license. This project adheres to the terms of that license.

The JSON card data was compiled by Chris Hallberg and is available at [crhallberg.com](https://www.crhallberg.com/).