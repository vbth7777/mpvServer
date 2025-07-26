
const path = require("path");

let envToken = "";
try {
  envToken = require("../../config.priv").token;
} catch {}

module.exports = {
  port: 9789,
  pathRunningUrls: path.join(__dirname, "../../running-urls.txt"),
  pathHistoryLog: path.join(__dirname, "../../history.log"),
  VIDEO_QUEUE_MODE: false,
  token: envToken,
};
