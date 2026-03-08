import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from './authConfig';
import { setMsalInstance } from './services/api';
import './index.css';
import App from './App.tsx';

// Create MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL and render app
msalInstance.initialize().then(() => {
  // Handle redirect promise (returns from Microsoft login)
  msalInstance.handleRedirectPromise().then((response) => {
    if (response) {
      msalInstance.setActiveAccount(response.account);
    } else {
      // Set active account if one exists
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0]);
      }
    }
  });

  // Set MSAL instance for API service
  setMsalInstance(msalInstance);

  // Listen for login events to update active account
  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const payload = event.payload as { account: { homeAccountId: string } };
      const account = payload.account;
      msalInstance.setActiveAccount(msalInstance.getAccountByHomeId(account.homeAccountId));
    }
  });

  // Render app
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </StrictMode>
  );
});
