const { WebSocketServer, WebSocket } = require("ws");
const { output } = require("../lib/logger");

const socketServer = new WebSocketServer({ port: 9791 }); // Or get port from config

function waitForConnection(server) {
  if (server.clients.size > 0) {
    const existingClient = server.clients.values().next().value;
    return Promise.resolve(existingClient);
  } else {
    console.log("No clients found. Waiting for a connection...");

    return new Promise((resolve) => {
      server.once("connection", (ws) => {
        resolve(ws);
      });
    });
  }
}

function askClientAndWaitForReply(ws, messageToSend, headers = {}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      output("Waiting for client reply");
    }, 5000);

    const messageListener = (message) => {
      clearTimeout(timeout); // ✅ Client replied, so cancel the timeout.
      ws.removeListener("message", messageListener); // Clean up the listener.
      resolve(message.toString()); // Resolve the promise with the reply.
    };

    ws.on("message", messageListener);

    ws.send(JSON.stringify({ url: messageToSend, headers: headers }));
  });
}

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
    throw new Error(
      `Request failed with status ${reply.status}: ${reply.error}`,
    );
  }

  return reply;
}

module.exports = { fetch };
