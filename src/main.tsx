import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/reset.css';
import './styles/layout.css';
import './styles/components/search.css';
import './styles/components/toolbar.css';
import './styles/components/list.css';
import './styles/components/empty.css';
import './styles/components/status.css';
import './styles/components/toast.css';
import './styles/components/grid.css';
import './styles/components/utilities.css';
import './styles/components/login.css';
import './styles/components/theme-picker.css';
import './styles/components/menu.css';
import './styles/components/dialog.css';
import './styles/responsive.css';
import './styles/forced-colors.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
