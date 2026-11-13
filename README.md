# Copain

[English](#english) | [Français](#français)

---

## English

Cross-platform desktop application (**macOS**, **Windows**, **Linux**) built with **Electron**, **React**, **TypeScript**, and **Tailwind CSS**, allowing you to chat with an OpenAI-compatible LLM (`/v1/chat/completions`) in a clean, modern, and strictly ephemeral interface.

### Features

- **Single ephemeral conversation**: no chat history saved to disk and no multi-chat management. Closing the app or clicking **Clear** starts a blank session.
- **OpenAI-compatible API (`/v1/chat/completions`)**: works with OpenAI, Ollama, LM Studio, `mlx-lm`, vLLM, etc.
- **Real-time SSE streaming**: progressive token rendering with a **Stop** button to cancel generation, plus automatic fallback to non-streaming JSON responses.
- **Full Markdown rendering (GFM)**: headings, lists, tables, blockquotes, links (opened in the OS default browser), inline code, and code blocks.
- **Smart auto-scroll**: automatically follows the generated response and pauses as soon as you scroll up to read, with a floating button (**Follow response** / **Scroll to bottom**) to resume following.
- **Bilingual UI (`FR | EN`)**: instant French / English switcher in the header, persisted in settings.
- **LLM Configuration**:
  - API Base URL (e.g., `http://127.0.0.1:8000/v1`, `https://api.openai.com/v1`)
  - Model (e.g., `LiquidAI/LFM3-1.7B-MLX-8bit`, `gpt-4o-mini`)
  - API Key (optional for local servers)
  - Read-only display of **Behavior instructions** sent as `role: "system"` (`messages[0]`) on every exchange.

### Default Configuration & Customizing Instructions

Default values are defined in `src/shared/types.ts` (`DEFAULT_LLM_CONFIG`):

- `baseUrl`: `http://127.0.0.1:8000/v1`
- `apiKey`: `""` (empty)
- `model`: `LiquidAI/LFM3-1.7B-MLX-8bit`
- `language`: `fr`
- `systemPrompt`: behavior instructions sent with each request

In the UI, the URL, model, API key, and language can be changed from **Settings** or the header toggle (and saved in `settings.json` inside the app's `userData` folder, without ever storing messages). **Behavior instructions** are read-only in the app and can be edited in `src/shared/types.ts`.

### Prerequisites

- **Node.js** (v20+ recommended) and **npm**

### Installation & Development

```bash
# Install dependencies
npm install

# Run in development mode (HMR)
npm run dev

# Typecheck TypeScript
npm run typecheck

# Build production bundle (out/)
npm run build
```

### Automated Tests

The project includes unit/integration tests (Vitest) and an E2E test suite (Node test runner) backed by a local OpenAI-compatible mock server (`test/mocks/mock-openai-server.ts`):

```bash
# Unit & integration tests (API client, settings service, contracts)
npm test

# E2E test suite (Tiers 1 to 4)
npm run test:e2e
```

### Multiplatform Packaging (`electron-builder`)

Installers and binaries are generated in `dist/` with the `build/icon.png` icon:

```bash
# macOS (.dmg and .zip for x64 and arm64)
npm run build:mac

# Windows (.exe NSIS and portable x64)
npm run build:win

# Linux (.AppImage and .tar.gz x64)
npm run build:linux
```

### Project Structure

```text
├── build/                          # Packaging resources (icon.svg, icon.png)
├── src/
│   ├── main/
│   │   ├── index.ts                # Main Electron window & lifecycle
│   │   ├── ipc/register-handlers.ts# IPC channels (streaming, abort, settings)
│   │   └── services/
│   │       ├── openai-client.ts    # /v1/chat/completions client (SSE + JSON fallback)
│   │       └── settings-service.ts # settings.json persistence (no chat history)
│   ├── preload/
│   │   ├── index.ts                # contextIsolation bridge (window.electronAPI)
│   │   └── index.d.ts
│   ├── renderer/
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx             # Copain header, language switcher, settings & session
│   │       ├── i18n.ts             # FR / EN translations
│   │       ├── components/
│   │       │   ├── ChatView.tsx    # Chat view, input bar, smart auto-scroll
│   │       │   ├── MessageBubble.tsx # Message bubbles + GFM Markdown rendering
│   │       │   └── SettingsModal.tsx # Settings modal (read-only instructions)
│   │       ├── hooks/useChat.ts    # Ephemeral in-memory state & IPC streaming
│   │       └── styles/index.css    # Tailwind CSS + custom scrollbar
│   └── shared/
│       ├── ipc-channels.ts         # IPC channel constants
│       └── types.ts                # Shared types & DEFAULT_LLM_CONFIG
├── test/
│   ├── mocks/mock-openai-server.ts # Local HTTP mock server for /v1/chat/completions
│   ├── unit/                       # Vitest unit tests
│   └── e2e/                        # E2E tests (Tiers 1 to 4)
├── electron.vite.config.ts         # Vite config (CJS main/preload, renderer)
├── package.json                    # Scripts & electron-builder config
└── tailwind.config.js
```

---

## Français

Application desktop multiplateforme (**macOS**, **Windows**, **Linux**) construite avec **Electron**, **React**, **TypeScript** et **Tailwind CSS**, permettant de discuter avec un LLM compatible OpenAI (`/v1/chat/completions`) dans une interface moderne, simple et strictement éphémère.

### Fonctionnalités

- **Conversation unique et éphémère** : aucune sauvegarde de l'historique sur le disque et aucune gestion de conversations multiples. La fermeture ou le bouton **Effacer** repart sur une session vierge.
- **Compatible toute API OpenAI** (`/v1/chat/completions`) : OpenAI, Ollama, LM Studio, `mlx-lm`, vLLM, etc.
- **Streaming SSE en temps réel** : affichage progressif des réponses avec bouton **Stop** pour interrompre la génération, et repli automatique sur les réponses JSON non-streamées.
- **Rendu Markdown complet (GFM)** : titres, listes, tableaux, citations, liens (ouverts dans le navigateur système), code en ligne et blocs de code.
- **Suivi intelligent du défilement** : suit automatiquement la réponse en cours de génération et se met en pause dès que vous remontez pour lire, avec un bouton flottant (**Suivre la réponse** / **Tout en bas**) pour reprendre le suivi.
- **Interface bilingue (`FR | EN`)** : sélecteur instantané Français / Anglais dans l'en-tête, mémorisé dans les paramètres.
- **Configuration LLM** :
  - URL de base de l'API (ex. `http://127.0.0.1:8000/v1`, `https://api.openai.com/v1`)
  - Modèle (ex. `LiquidAI/LFM3-1.7B-MLX-8bit`, `gpt-4o-mini`)
  - Clé API (optionnelle pour les serveurs locaux)
  - Affichage en lecture seule des **Instructions de comportement** envoyées en `role: "system"` (`messages[0]`) à chaque échange.

### Configuration par défaut et personnalisation des instructions

Les valeurs par défaut sont définies dans `src/shared/types.ts` (`DEFAULT_LLM_CONFIG`) :

- `baseUrl` : `http://127.0.0.1:8000/v1`
- `apiKey` : `""` (vide)
- `model` : `LiquidAI/LFM3-1.7B-MLX-8bit`
- `language` : `fr`
- `systemPrompt` : instructions de comportement envoyées à chaque requête

Dans l'interface, l'URL, le modèle, la clé API et la langue sont modifiables depuis **Configuration** ou le sélecteur d'en-tête (et enregistrés dans `settings.json` du dossier `userData` de l'application, sans jamais stocker de messages). Les **Instructions de comportement** sont affichées en lecture seule dans l'application et se modifient dans `src/shared/types.ts`.

### Prérequis

- **Node.js** (v20+ recommandé) et **npm**

### Installation & Développement

```bash
# Installer les dépendances
npm install

# Lancer l'application en mode développement (HMR)
npm run dev

# Vérifier les types TypeScript
npm run typecheck

# Compiler le bundle de production (out/)
npm run build
```

### Tests automatisés

Le projet inclut des tests unitaires/d'intégration (Vitest) et une suite de tests E2E (Node test runner) s'appuyant sur un serveur mock local compatible OpenAI (`test/mocks/mock-openai-server.ts`) :

```bash
# Tests unitaires et d'intégration (client API, service de configuration, contrats)
npm test

# Suite de tests E2E (Tiers 1 à 4)
npm run test:e2e
```

### Packaging multiplateforme (`electron-builder`)

Les installeurs et binaires sont générés dans le dossier `dist/` avec l'icône `build/icon.png` :

```bash
# macOS (.dmg et .zip pour x64 et arm64)
npm run build:mac

# Windows (.exe NSIS et portable x64)
npm run build:win

# Linux (.AppImage et .tar.gz x64)
npm run build:linux
```

### Architecture du projet

```text
├── build/                          # Ressources de packaging (icon.svg, icon.png)
├── src/
│   ├── main/
│   │   ├── index.ts                # Fenêtre Electron principale et cycle de vie
│   │   ├── ipc/register-handlers.ts# Canaux IPC (streaming, annulation, config)
│   │   └── services/
│   │       ├── openai-client.ts    # Client /v1/chat/completions (SSE + JSON fallback)
│   │       └── settings-service.ts # Lecture/écriture de settings.json (sans historique)
│   ├── preload/
│   │   ├── index.ts                # Bridge contextIsolation (window.electronAPI)
│   │   └── index.d.ts
│   ├── renderer/
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx             # En-tête Copain, sélecteur de langue, config et session
│   │       ├── i18n.ts             # Traductions FR / EN
│   │       ├── components/
│   │       │   ├── ChatView.tsx    # Zone de chat, saisie, suivi intelligent du scroll
│   │       │   ├── MessageBubble.tsx # Bulles de messages + rendu Markdown GFM
│   │       │   └── SettingsModal.tsx # Modale Configuration (instructions en lecture seule)
│   │       ├── hooks/useChat.ts    # État éphémère en mémoire et streaming IPC
│   │       └── styles/index.css    # Tailwind CSS + scrollbar personnalisée
│   └── shared/
│       ├── ipc-channels.ts         # Constantes des canaux IPC
│       └── types.ts                # Types partagés et DEFAULT_LLM_CONFIG
├── test/
│   ├── mocks/mock-openai-server.ts # Serveur HTTP local simulant /v1/chat/completions
│   ├── unit/                       # Tests unitaires Vitest
│   └── e2e/                        # Tests E2E (Tiers 1 à 4)
├── electron.vite.config.ts         # Configuration Vite (main/preload en CJS, renderer)
├── package.json                    # Scripts et configuration electron-builder
└── tailwind.config.js
```
