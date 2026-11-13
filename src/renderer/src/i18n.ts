import { AppLanguage } from '../../shared/types';

export interface Translations {
  app: {
    clear: string;
    clearTitle: string;
    settings: string;
    settingsTitle: string;
    saveError: string;
    languageTitle: string;
  };
  chat: {
    welcomeTitle: string;
    welcomeSubtitle: string;
    activeConfig: string;
    edit: string;
    model: string;
    endpoint: string;
    notSet: string;
    instructionsLabel: string;
    noCustomInstructions: string;
    followResponse: string;
    scrollToBottom: string;
    scrollToBottomTitle: string;
    closeError: string;
    inputPlaceholder: string;
    stopTitle: string;
    stopAria: string;
    sendTitle: string;
    sendAria: string;
  };
  message: {
    copyTitle: string;
    copied: string;
    copy: string;
  };
  settingsModal: {
    title: string;
    subtitle: string;
    closeAria: string;
    invalidUrlError: string;
    modelRequiredError: string;
    saveError: string;
    baseUrlLabel: string;
    baseUrlPlaceholder: string;
    modelLabel: string;
    modelPlaceholder: string;
    apiKeyLabel: string;
    apiKeyOptional: string;
    apiKeyPlaceholder: string;
    hideKeyAria: string;
    showKeyAria: string;
    instructionsLabel: string;
    readOnlyBadge: string;
    noCustomInstructions: string;
    instructionsHint: string;
    cancel: string;
    saving: string;
    save: string;
  };
}

export const TRANSLATIONS: Record<AppLanguage, Translations> = {
  fr: {
    app: {
      clear: 'Effacer',
      clearTitle: 'Effacer la conversation actuelle',
      settings: 'Configuration',
      settingsTitle: "Configurer l'API LLM et voir les instructions",
      saveError: 'Échec de la sauvegarde.',
      languageTitle: 'Changer la langue (Français / Anglais)'
    },
    chat: {
      welcomeTitle: 'Prêt pour du Hard',
      welcomeSubtitle: 'Pose ta question de merde au génie',
      activeConfig: 'Configuration active',
      edit: 'Modifier',
      model: 'Modèle',
      endpoint: 'Endpoint',
      notSet: 'Non défini',
      instructionsLabel: 'Instructions :',
      noCustomInstructions: 'Aucune instruction personnalisée (comportement par défaut du modèle).',
      followResponse: 'Suivre la réponse',
      scrollToBottom: 'Tout en bas',
      scrollToBottomTitle: 'Descendre tout en bas et suivre la conversation',
      closeError: "Fermer l'erreur",
      inputPlaceholder:
        'Posez votre question... (Entrée pour envoyer, Maj+Entrée pour saut de ligne)',
      stopTitle: 'Arrêter la génération',
      stopAria: 'Arrêter',
      sendTitle: 'Envoyer le message',
      sendAria: 'Envoyer'
    },
    message: {
      copyTitle: 'Copier la réponse',
      copied: 'Copié',
      copy: 'Copier'
    },
    settingsModal: {
      title: 'Configuration du LLM & Instructions',
      subtitle: 'Paramètres de connexion OpenAI-compatible et comportement du chatbot',
      closeAria: 'Fermer',
      invalidUrlError: "L'URL de base doit commencer par http:// ou https://",
      modelRequiredError: 'Le nom du modèle est requis.',
      saveError: 'Erreur lors de la sauvegarde.',
      baseUrlLabel: 'URL de base (Endpoint API)',
      baseUrlPlaceholder: 'https://api.openai.com/v1 ou http://localhost:11434/v1',
      modelLabel: 'Modèle',
      modelPlaceholder: 'gpt-4o-mini, llama3...',
      apiKeyLabel: 'Clé API',
      apiKeyOptional: '(optionnelle en local)',
      apiKeyPlaceholder: 'sk-...',
      hideKeyAria: 'Masquer la clé',
      showKeyAria: 'Afficher la clé',
      instructionsLabel: 'Instructions de comportement',
      readOnlyBadge: 'Lecture seule',
      noCustomInstructions: 'Aucune instruction personnalisée.',
      instructionsHint:
        'Ces instructions sont envoyées à chaque message pour définir le ton et le rôle du chatbot.',
      cancel: 'Annuler',
      saving: 'Enregistrement...',
      save: 'Enregistrer'
    }
  },
  en: {
    app: {
      clear: 'Clear',
      clearTitle: 'Clear current conversation',
      settings: 'Settings',
      settingsTitle: 'Configure LLM API and view instructions',
      saveError: 'Failed to save settings.',
      languageTitle: 'Switch language (French / English)'
    },
    chat: {
      welcomeTitle: 'Ready to Rock',
      welcomeSubtitle: 'Ask your stupid question to the genius',
      activeConfig: 'Active configuration',
      edit: 'Edit',
      model: 'Model',
      endpoint: 'Endpoint',
      notSet: 'Not set',
      instructionsLabel: 'Instructions:',
      noCustomInstructions: 'No custom instructions (default model behavior).',
      followResponse: 'Follow response',
      scrollToBottom: 'Scroll to bottom',
      scrollToBottomTitle: 'Scroll to bottom and follow the conversation',
      closeError: 'Dismiss error',
      inputPlaceholder: 'Ask a question... (Enter to send, Shift+Enter for new line)',
      stopTitle: 'Stop generating',
      stopAria: 'Stop',
      sendTitle: 'Send message',
      sendAria: 'Send'
    },
    message: {
      copyTitle: 'Copy response',
      copied: 'Copied',
      copy: 'Copy'
    },
    settingsModal: {
      title: 'LLM Configuration & Instructions',
      subtitle: 'OpenAI-compatible connection settings and chatbot behavior',
      closeAria: 'Close',
      invalidUrlError: 'Base URL must start with http:// or https://',
      modelRequiredError: 'Model name is required.',
      saveError: 'Failed to save settings.',
      baseUrlLabel: 'Base URL (API Endpoint)',
      baseUrlPlaceholder: 'https://api.openai.com/v1 or http://localhost:11434/v1',
      modelLabel: 'Model',
      modelPlaceholder: 'gpt-4o-mini, llama3...',
      apiKeyLabel: 'API Key',
      apiKeyOptional: '(optional for local)',
      apiKeyPlaceholder: 'sk-...',
      hideKeyAria: 'Hide API key',
      showKeyAria: 'Show API key',
      instructionsLabel: 'Behavior instructions',
      readOnlyBadge: 'Read-only',
      noCustomInstructions: 'No custom instructions.',
      instructionsHint:
        'These instructions are sent with every message to define the chatbot tone and role.',
      cancel: 'Cancel',
      saving: 'Saving...',
      save: 'Save'
    }
  }
};

