/**
 * MSAL Configuration for Entra ID Authentication
 * 
 * Environment variables are injected at build time via Vite.
 */
import type { Configuration } from '@azure/msal-browser';
import { LogLevel } from '@azure/msal-browser';

// Azure AD / Entra ID Configuration
const clientId = import.meta.env.VITE_AZURE_CLIENT_ID || '';
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID || '';

export const msalConfig: Configuration = {
  auth: {
    clientId: clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin + '/',
    postLogoutRedirectUri: window.location.origin + '/',
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
    },
  },
};

// Scopes for login request
export const loginRequest = {
  scopes: ['User.Read', 'openid', 'profile', 'email'],
};

// Scopes for API access (using the client ID as the audience)
export const apiTokenRequest = {
  scopes: [`${clientId}/.default`],
};
