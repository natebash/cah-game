
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/_base.css';
import './styles/components.module.css';
import './styles/_utilities.css';
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
