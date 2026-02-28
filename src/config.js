const path = require("path");

let envToken = "";
try {
  envToken = require("../../config.priv").token;
} catch { }

let iwaraExecutionMode = "auto";
const modeArg = process.argv.find(arg => arg.startsWith("--iwara-mode="));
if (modeArg) {
  const parsedMode = modeArg.split("=")[1];
  if (["proxy", "direct", "auto"].includes(parsedMode)) {
    iwaraExecutionMode = parsedMode;
  } else {
    console.warn(`Warning: Invalid --iwara-mode '${parsedMode}'. Using default 'auto'. Valid modes: 'proxy', 'direct', 'auto'.`);
  }
}

module.exports = {
  port: 9789,
  pathRunningUrls: path.join(__dirname, "../../running-urls.txt"),
  pathHistoryLog: path.join(__dirname, "../../history.log"),
  VIDEO_QUEUE_MODE: false,
  token: envToken,
  WAIT_FOR_BROWSER_PROXY: false,
  IWARA_EXECUTION_MODE: iwaraExecutionMode,
};
