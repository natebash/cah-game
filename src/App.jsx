
import React from 'react';
import { GameProvider, useGame } from './GameProvider';
import IndexPage from './pages/IndexPage';
import PlayerPage from './pages/PlayerPage';
import BoardPage from './pages/BoardPage';
import Notification from './components/Notification';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Modal from './components/Modal';
import Card from './components/Card';

function AppContent() {
  const { notification, modal, closeModal } = useGame();

  return (
    <div className="container">
      {notification.message && (
        <Notification
          message={notification.message}
          type={notification.type}
          duration={notification.duration}
        />
      )}
      <Modal show={modal.show} title={modal.title} onClose={closeModal}>
        {modal.content && (
          <div>
            <p><strong>{modal.content.name}</strong> won the round!</p>
            <Card text={modal.content.sentence} type="black" />
          </div>
        )}
      </Modal>
      <Routes>
        <Route path="/" element={<IndexPage />} />
        <Route path="/player" element={<PlayerPage />} />
        <Route path="/board" element={<BoardPage />} />
      </Routes>
      {/* Centralized Footer */}
      <footer className="site-footer">
        <p>
          This is an unofficial fan project and is not affiliated with Cards Against Humanity, LLC. &middot; Card content is based on <a href="https://www.cardsagainsthumanity.com/" target="_blank" rel="noopener noreferrer">Cards Against Humanity</a> and is licensed under a
          <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer" className="cc-license">
            Creative Commons BY-NC-SA 4.0
            <img alt="Creative Commons License" src="https://mirrors.creativecommons.org/presskit/icons/cc.svg" />
            <img alt="Attribution" src="https://mirrors.creativecommons.org/presskit/icons/by.svg" />
            <img alt="NonCommercial" src="https://mirrors.creativecommons.org/presskit/icons/nc.svg" />
            <img alt="ShareAlike" src="https://mirrors.creativecommons.org/presskit/icons/sa.svg" />
          </a>.
        </p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <GameProvider>
        <AppContent />
      </GameProvider>
    </Router>
  );
}

export default App;
