# Cards Against All Sanity

A web-based, real-time multiplayer card game inspired by the classic party game, Cards Against Humanity. This project allows users to create and join game rooms, play with friends, and display the game on a central screen for a party setting.

## ✨ Features

-   **Real-time Multiplayer:** Gameplay is synchronized for all players using WebSockets (Socket.IO).
-   **Game Rooms:** Create a game and invite friends with a unique 4-letter game code.
-   **Dedicated Score Board View:** A special view designed for a central TV or shared screen, showing the black card, submissions, and scoreboard. You can now easily access this view by clicking "Create Score Board" on the main menu.
-   **Player & Host Roles:** The first player to create a game is the host and can start the game and kick players from the lobby.
-   **Card Czar Rotation:** The role of the judge (Card Czar) automatically rotates to the next player each round.
-   **Score Tracking:** The game automatically keeps score and declares a winner at the end.
-   **Two Game Modes:**
    -   **Score Limit:** The game ends when a player reaches a predefined score.
    -   **Endless Mode:** The game continues until a vote is initiated and all active players unanimously agree to end it.
-   **Democratic Mode:** Players vote on submissions instead of a single Card Czar choosing the winner.
-   **Player Reconnection:** If a player's connection drops, they have a 2-minute window to rejoin the game with their score and cards intact.
-   **Kicking Players:** The host can remove players from the lobby before the game begins.
-   **Custom Cards:** Players can submit their own white cards during gameplay.

## 🚀 Setup and Installation

To run this project, you will need [Node.js](https://nodejs.org/) and npm installed on your machine.

1.  **Clone the repository (or download the files):**
    ```bash
    git clone https://github.com/natebash/cah-game.git
    cd cah-game
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the application:**
    There are two ways to run the application:

    -   **Development Mode:**
        ```bash
        npm run dev
        ```
        This starts both the backend server and the frontend development server. The frontend will be available at `http://localhost:5173`. This mode is recommended for development as it provides hot module replacement.

    -   **Production Mode:**
        ```bash
        npm run build
        npm start
        ```
        This will first build the frontend application and then start the backend server. The application will be available at `http://localhost:3001`.

## 🎲 How to Play

1.  **Start a New Game:**
    - Open your browser and navigate to the appropriate address for the mode you are using (`http://localhost:5173` for development, `http://localhost:3001` for production).
    - Click "Create Game".
    - Enter your name and choose the game settings (winning score, endless mode, or democratic mode).
    - You'll be taken to the game lobby, where you'll see your unique 4-letter game code.

2.  **Join a Game:**
    - Other players can join by navigating to the same address.
    - Click "Join Game".
    - Enter their name and the 4-letter game code.

3.  **Set up a Score Board:**
    - For a party setting, you can use a separate screen as a dedicated scoreboard.
    - On the device connected to the shared screen, navigate to the game's address.
    - Click "Create Score Board" and enter the game code.

4.  **Game Flow:**
    - The game follows the standard rules of Cards Against Humanity.
    - In **Standard Mode**, a Card Czar chooses the winning card.
    - In **Democratic Mode**, all players vote for their favorite submission.

## 🛠️ Development

The project is divided into a backend server and a frontend client.

-   **Backend:** The backend is an Express server that handles game logic and communication using Socket.IO. It runs on port `3001`.
-   **Frontend:** The frontend is a React application built with Vite. The development server runs on port `5173` and proxies API and socket requests to the backend server. In production, the frontend is built and served by the backend server.

The `npm run dev` command uses `npm-run-all` to start both servers concurrently.

## 💻 Technology Stack

-   **Backend:** Node.js, Express
-   **Frontend:** React.js, Vite
-   **Real-time Communication:** Socket.IO, Socket.IO Client
-   **Routing:** React Router
-   **Utilities:** npm-run-all, QR Code React

## ⚖️ Disclaimer

This is an unofficial fan project and is not affiliated with, sponsored, or endorsed by Cards Against Humanity, LLC.

The card content used in this project is based on the game *Cards Against Humanity*, which is distributed under a Creative Commons BY-NC-SA 4.0 license. This project adheres to the terms of that license.

The JSON card data was compiled by Chris Hallberg and is available at [crhallberg.com](https://www.crhallberg.com/).