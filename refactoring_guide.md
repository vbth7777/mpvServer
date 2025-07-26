# Project Restructuring Guide

This guide provides a step-by-step approach to restructuring the mpvServer project for better organization, maintainability, and scalability.

## Part 1: General Project Structure

A common and effective way to structure a Node.js project is to separate source code, tests, public assets, and scripts into their own directories.

### Proposed Project Structure

```
mpvServer/
├── .gitignore
├── config.priv.example.js
├── config.priv.js
├── package.json
├── package-lock.json
├── README.md
├── running-urls.txt
├── running-urls58.txt
├── public/
│   └── index.html
├── scripts/
│   └── start.sh
├── src/
│   ├── index.js
│   ├── server.js
│   └── shuffle.js
└── test/
    └── test.js
```

### Restructuring Steps

1.  **Create new directories:**
    *   Create a `src` directory for your main application source code.
    *   Create a `test` directory for your test files.
    *   Create a `scripts` directory for your shell scripts.

2.  **Move existing files:**
    *   Move `index.js`, `server.js`, and `shuffle.js` into the `src/` directory.
    *   Move `test.js` into the `test/` directory.
    *   Move `start.sh` into the `scripts/` directory.

3.  **Update `package.json`:**
    *   You may need to update the `"main"` field in `package.json` to point to the new location of your main entry file (e.g., `"main": "src/index.js"`).
    *   Update the `"scripts"` section to reflect the new paths. For example, if you have a start script, it might change from `"start": "node index.js"` to `"start": "node src/index.js"`.

4.  **Update `require` paths:**
    *   After moving files, you will need to update any relative `require` paths within your JavaScript files to reflect the new file locations.

---

## Part 2: Refactoring the Monolithic `server.js`

The `server.js` file is doing too many things at once. The key to improving it is **Separation of Concerns**. We'll break it down into smaller, focused modules.

### The Goal

Our goal is to transform the single `server.js` file into a set of modules, where each module has a single responsibility.

*   **`api/`**: Will handle all incoming HTTP requests and routing.
*   **`services/`**: Will contain the core business logic (e.g., how to play a video, how to get a URL from a third-party service).
*   **`lib/` or `utils/`**: Will hold reusable helper functions (e.g., custom logging).
*   **`config.js`**: A central place for all configuration.
*   **`server.js`**: The main entry point, responsible only for initializing and connecting all the pieces.

### Proposed New Structure (within `src/`)

```
src/
├── api/
│   ├── mpvRoutes.js       # Routes for controlling MPV (/, /reload, /mpv-status, etc.)
│   └── iwaraRoutes.js     # Routes for iwara specific things (/user, /video)
├── services/
│   ├── mpvPlayer.js       # All logic for managing the MPV child process and queue
│   ├── iwaraClient.js     # All logic for fetching data from the iwara.tv API
│   └── websocketManager.js # Logic for both WebSocket servers
├── lib/
│   └── logger.js          # Your custom output, outputRealtime functions
├── config.js              # Centralized configuration
└── server.js              # The main application entry point
```

### Refactoring Steps

1.  **Create `src/config.js`:**
    *   Move all configuration variables into this file: `port`, `pathRunningUrls`, `VIDEO_QUEUE_MODE`, and the logic for loading `config.priv.js`.
    *   Export these values so other modules can use them.

2.  **Create `src/lib/logger.js`:**
    *   Move the utility functions `output`, `outputRealtime`, `clearPreviousLine`, and `sleep` into this file. Export them.

3.  **Create the "Services" (The Core Logic):**
    *   **`src/services/iwaraClient.js`**:
        *   This is for all communication with the iwara.tv API.
        *   Move the `getVideoUrl`, `getJSON`, `askClientAndWaitForReply`, and `convertToSHA1` functions here.
    *   **`src/services/websocketManager.js`**:
        *   Move all WebSocket server setup code (`wss` on 9790 and `socketServer` on 9791) into this file.
        *   Create and export functions like `sendToAllClients(message)` and `waitForClientConnection()`.
    *   **`src/services/mpvPlayer.js`**:
        *   This module will be responsible for playing videos.
        *   Move the `commandQueue`, the `execMpv` function, and all related state variables (`isMpvRunning`, `currentPlayingUrl`, etc.) into this file.
        *   Create and export a simple function like `play(url, pageUrl)`.

4.  **Create the "API Routes":**
    *   Use `express.Router()` to create modular route files.
    *   **`src/api/mpvRoutes.js`**:
        *   Define all the routes that control the player: `POST /`, `GET /mpv-status`, `GET /running-urls`, `POST /reload`, etc.
        *   The route handlers here will call functions from your services.
    *   **`src/api/iwaraRoutes.js`**:
        *   Define the `/user` and `/video` routes. These will call functions from `iwaraClient.js`.

5.  **Clean Up `src/server.js` (The Final Step):**
    *   Your main `server.js` file will become very simple. Its only jobs are to initialize the Express app, set up middleware, tell Express to use your routers, initialize your WebSocket manager, start the app, and resume from `running-urls.txt`.

---

## Part 3: Refactoring the Browser-Based WebSocket Proxy

This is a clever solution to iwara's bot detection. The goal is to **isolate this proxy mechanism** so that the rest of your application doesn't need to know *how* the requests are made.

### The Core Idea: A "Browser-Proxy" Service

We will create a dedicated module whose only job is to manage the communication with the browser client: `browserRequestProxy.js`. The rest of your application will use this proxy to make HTTP requests, without ever touching a WebSocket directly.

### Proposed Structure for the Proxy

This builds upon the previous guide.

```
src/
├── api/
│   └── ...
├── services/
│   ├── browserRequestProxy.js # <-- NEW: Manages the browser WebSocket connection
│   ├── iwaraClient.js         # Uses the proxy to get iwara data
│   ├── mpvPlayer.js           # Plays videos
│   └── websocketManager.js    # Manages the UI WebSocket (port 9790)
├── lib/
│   └── ...
├── config.js
└── server.js
```

### Refactoring Steps for the Proxy

1.  **Create `src/services/browserRequestProxy.js`:**
    *   This file will be the heart of your fetching logic.
    *   Move the `socketServer` (the one on port 9791) from `server.js` into this new file.
    *   Move the helper functions `waitForConnection` and `askClientAndWaitForReply` into this file.
    *   Create and export a new function that mimics a standard `fetch` or `axios.get` call. It will hide all the WebSocket complexity.

    ```javascript
    // src/services/browserRequestProxy.js

    const { WebSocketServer } = require("ws");
    const WebSocket = require("ws");

    const socketServer = new WebSocketServer({ port: 9791 }); // Or get port from config

    // ... (waitForConnection and askClientAndWaitForReply functions go here) ...

    console.log("Browser-Proxy WebSocket server listening on port 9791");

    /**
     * Makes an HTTP GET request through a connected browser client.
     * @param {string} url The URL to fetch.
     * @param {object} headers Optional headers.
     * @returns {Promise<object>} A promise that resolves with the parsed JSON response.
     */
    async function fetch(url, headers = {}) {
      const client = await waitForConnection(socketServer);
      if (client.readyState !== WebSocket.OPEN) {
        throw new Error("Browser client is not connected.");
      }

      const replyString = await askClientAndWaitForReply(client, url, headers);
      const reply = JSON.parse(replyString);

      if (reply.error) {
        throw new Error(`Request failed with status ${reply.status}: ${reply.error}`);
      }

      return reply;
    }

    module.exports = { fetch };
    ```

2.  **Refactor `src/services/iwaraClient.js`:**
    *   This module should no longer know anything about WebSockets. Its only job is to know the iwara API endpoints and process the data.
    *   Import the new proxy: `const proxy = require('./browserRequestProxy');`
    *   Rewrite `getVideoUrl` and `getJSON` to use the proxy.

    ```javascript
    // src/services/iwaraClient.js (New Version)

    const proxy = require('./browserRequestProxy');
    const crypto = require('crypto');

    // ... (convertToSHA1, getID, getFileId, etc. can stay here) ...

    async function getVideoUrl(url, accessToken) {
      try {
        const id = getID(url);
        const videoInfo = await proxy.fetch(`https://api.iwara.tv/video/${id}`, {
            // ... headers
        });

        // ... (rest of your logic to parse videoInfo and get the final file URL) ...

        const fileData = await proxy.fetch(fileUrl, {
            // ... x-version header etc.
        });

        // ... (logic to find the best resolution and return the URI) ...
        return uri;
      } catch (ex) {
        console.log(ex);
        return null;
      }
    }

    module.exports = { getVideoUrl };
    ```

3.  **Update `public/index.html`'s JavaScript:**
    *   Your client-side code is already doing its job, but ensure it properly handles the `JSON.stringify({url, headers})` format and sends back a JSON string with either a `data` or `error` key. The current implementation seems to do this already, so you may not need to change anything here.

### Why This is a Better Structure

*   **Abstraction:** Your `iwaraClient` can now be read as "get video info, then get file data". It's no longer mixed with WebSocket connection logic.
*   **Isolation:** The entire browser-as-a-proxy trick is contained in **one file**. If you ever find a better way to bypass the bot detection, you only need to change `browserRequestProxy.js`.
*   **Readability:** The code becomes much easier to follow. Each module has a clear, single purpose.
