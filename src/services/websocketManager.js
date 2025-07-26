
const WebSocket = require("ws");
const { WebSocketServer } = require("ws");
const { output } = require("../lib/logger");

const wss = new WebSocketServer({ port: 9790 });

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);

  ws.on("message", function message(data, isBinary) {
    output("Connected to client");
  });
  ws.on("close", function close() {
    output("Client closed connection");
  });
});

function sendToClient(content) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(content);
    }
  });
}

module.exports = {
  wss,
  sendToClient,
};
