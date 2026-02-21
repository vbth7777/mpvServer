const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { output } = require("./lib/logger");
const mpvRoutes = require("./api/mpvRoutes");
const iwaraRoutes = require("./api/iwaraRoutes");
const { socketServer } = require("./services/browserRequestProxy");
const { port, pathRunningUrls, VIDEO_QUEUE_MODE, token, WAIT_FOR_BROWSER_PROXY } = require("./config");
require("./services/websocketManager");
require("./services/browserRequestProxy"); // This require is for side effects, so it's fine to keep it here.

const app = express();

app.use(express.static(path.join(__dirname, "../../public")));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use("/api", mpvRoutes);
app.use("/api/iwara", iwaraRoutes);

app.listen(port, () => output(`App listening at http://localhost:${port}`));

function resumeRunningUrls() {
  if (!fs.existsSync(pathRunningUrls)) {
    fs.writeFileSync(pathRunningUrls, "");
  }
  const runningUrls = fs.readFileSync(pathRunningUrls).toString();
  if (runningUrls) {
    let urls = runningUrls.split("\n");
    urls = urls.filter((url, index) => urls.indexOf(url) === index);
    for (const url of urls) {
      if (url) {
        output(`Resuming ${url}...`);
        fs.writeFileSync(pathRunningUrls, runningUrls.replace(url, ""));
        axios.post(`http://localhost:${port}/api/`, {
          url: url,
          accessToken: token,
          isLoadFromHistory: !VIDEO_QUEUE_MODE,
        });
      }
    }
  }
}

if (WAIT_FOR_BROWSER_PROXY) {
  output("Waiting for browser proxy connection before resuming URLs...");
  socketServer.once("connection", () => {
    output("Browser proxy connected. Resuming URLs...");
    resumeRunningUrls();
  });
} else {
  resumeRunningUrls();
}