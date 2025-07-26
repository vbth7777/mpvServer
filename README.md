# mpvServer

A powerful Node.js server to remotely control the [MPV](https://mpv.io/) media player. It features a robust video queue, session recovery, and a unique browser-based proxy system to bypass bot detection on video streaming sites.

## Key Features

- **Remote Control MPV**: Play, queue, and manage videos via a simple REST API.
- **Browser-Based Proxy**: Intelligently uses a browser tab as a proxy to make requests to sites like Iwara, bypassing bot detection.
- **Video Queue**: Queue multiple videos for continuous playback.
- **Session Recovery**: Automatically resumes the video queue from its last state when the server restarts.
- **Playback History**: Keeps a log of all successfully played videos in `history.log`.
- **Real-time UI**: A modern, web-based UI shows the status of the browser proxy.

## How It Works

The server is composed of three main parts:
1.  **Main API Server (Port 9789)**: The primary Express server that you interact with. It handles all API requests for controlling MPV and fetching video information.
2.  **UI WebSocket (Port 9790)**: A WebSocket that provides real-time status updates to connected clients (not currently used by the main UI, but available for extensions).
3.  **Browser Proxy WebSocket (Port 9791)**: The core of the proxy system. The web UI served on port 9789 opens a connection to this WebSocket, allowing the Node.js server to channel its HTTP requests through the browser.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [mpv](https://mpv.io/installation/)
- A modern web browser (e.g., Chrome, Firefox)

## Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/vbth7777/mpvServer.git
    cd mpvServer
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create the private configuration file:**
    Copy the example config file. This file is ignored by Git and is safe for your private tokens.
    ```bash
    cp config.priv.example.js config.priv.js
    ```
    Edit `config.priv.js` to add your Iwara access token if you have one.

## Usage

1.  **Start the server:**
    ```bash
    npm start
    ```

2.  **Open the Browser Proxy:**
    Open your web browser and navigate to:
    ```
    http://localhost:9789
    ```
    You should see a "Browser Proxy" page with a status indicator. **You must keep this page open in the background** for the server to work correctly.

3.  **Send API Requests:**
    You can now send requests to the server using a tool like `curl` or Postman.

    **Example:** Play a video using `curl`.
    ```bash
    curl -X POST -H "Content-Type: application/json" \
      -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}' \
      http://localhost:9789/api/
    ```

## API Endpoints

All endpoints are prefixed with `/api`.

| Method | Path                | Body / Query Params                                     | Description                                             |
| :----- | :------------------ | :------------------------------------------------------ | :------------------------------------------------------ |
| `POST` | `/`                 | **Body**: `url`, `accessToken`, `pageUrl`               | Plays or queues a video URL.                            |
| `GET`  | `/mpv-status`       |                                                         | Returns `running` or `not running`.                     |
| `GET`  | `/running-urls`     |                                                         | Returns a list of URLs currently in the queue.          |
| `GET`  | `/playing-url`      |                                                         | Returns the URL of the video currently playing.         |
| `GET`  | `/previous-url`     |                                                         | Returns the URL of the last video that played.          |
| `POST` | `/reload`           |                                                         | Reloads the currently playing video.                    |
| `GET`  | `/history`          |                                                         | Returns a list of all successfully played video URLs.   |
| `GET`  | `/iwara/user`       | **Query**: `profileSlug`                                | Fetches all video details for an Iwara user.            |
| `GET`  | `/iwara/video`      | **Query**: `id`, `accessToken`                          | Fetches the direct video URL for an Iwara video ID.     |
| `POST` | `/async-run`        | **Body**: `url`                                         | (Legacy) Directly executes mpv without queueing.        |