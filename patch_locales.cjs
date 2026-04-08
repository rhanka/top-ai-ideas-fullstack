const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '../../ui/src/locales/en.json');
let enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'));

enContent.settings.providerConnections.google = {
  "accountLabel": "Google Cloud / Workspace account (optional)",
  "accountPlaceholder": "e.g. dev@company.com",
  "startEnrollment": "Connect Google Workspace / Cloud",
  "pendingHint": "Google sign-in started. Please authenticate in the new tab, then copy the error URL starting with 127.0.0.1 and paste it here.",
  "pastedUrlLabel": "Pasted URL (127.0.0.1...)",
  "pastedUrlPlaceholder": "http://127.0.0.1:8709/callback?state=...",
  "completeEnrollment": "Submit URL",
  "regenerateEnrollment": "Restart sign-in",
  "cancelEnrollment": "Cancel",
  "disconnect": "Disconnect Google account",
  "description": "Connect your Google Workspace or Google Cloud account to use Vertex AI and Gemini APIs under your own corporate quota."
};
enContent.settings.providerConnections.toasts = enContent.settings.providerConnections.toasts || {};
enContent.settings.providerConnections.toasts.googleEnrollmentStarted = "Google sign-in started. Please follow the instructions to complete the connection.";
enContent.settings.providerConnections.toasts.googleConnected = "Google Cloud provider connected.";
enContent.settings.providerConnections.toasts.googleDisconnected = "Google Cloud provider disconnected.";

fs.writeFileSync(enPath, JSON.stringify(enContent, null, 2), 'utf8');

const frPath = path.join(__dirname, '../../ui/src/locales/fr.json');
let frContent = JSON.parse(fs.readFileSync(frPath, 'utf8'));

frContent.settings.providerConnections.google = {
  "accountLabel": "Compte Google Cloud / Workspace (optionnel)",
  "accountPlaceholder": "ex: dev@entreprise.com",
  "startEnrollment": "Connecter Google Workspace / Cloud",
  "pendingHint": "Connexion Google démarrée. Veuillez vous authentifier dans le nouvel onglet, puis copiez l'URL d'erreur commençant par 127.0.0.1 et collez-la ici.",
  "pastedUrlLabel": "URL copiée (127.0.0.1...)",
  "pastedUrlPlaceholder": "http://127.0.0.1:8709/callback?state=...",
  "completeEnrollment": "Valider l'URL",
  "regenerateEnrollment": "Recommencer",
  "cancelEnrollment": "Annuler",
  "disconnect": "Déconnecter le compte Google",
  "description": "Connectez votre compte Google Workspace ou Google Cloud pour utiliser les APIs Vertex AI et Gemini via votre propre quota d'entreprise."
};
frContent.settings.providerConnections.toasts = frContent.settings.providerConnections.toasts || {};
frContent.settings.providerConnections.toasts.googleEnrollmentStarted = "Connexion Google démarrée. Suivez les instructions pour finaliser l'association.";
frContent.settings.providerConnections.toasts.googleConnected = "Provider Google Cloud connecté.";
frContent.settings.providerConnections.toasts.googleDisconnected = "Provider Google Cloud déconnecté.";

fs.writeFileSync(frPath, JSON.stringify(frContent, null, 2), 'utf8');

console.log('Locales patched.');
