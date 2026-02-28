const async = require("async");
const { exec } = require("child_process");
const fs = require("fs");
const { getVideoUrl } = require("./iwaraClient");
const {
  output,
  outputRealtime,
  clearPreviousLine,
  sleep,
} = require("../lib/logger");
const {
  pathRunningUrls,
  VIDEO_QUEUE_MODE,
  pathHistoryLog,
  IWARA_EXECUTION_MODE,
} = require("../config");
const { sendToClient } = require("./websocketManager");
const { socketServer, waitForConnection } = require("./browserRequestProxy");

const commandQueue = async.queue((task, callback) => task(callback));

let isMpvRunning = false;
let currentPlayingUrl = "";
let previousUrl = "";
let isReload = false;
let urls = [];

const greenColor = "\x1b[32m";
const blueColor = "\x1b[34m";
const resetColor = "\x1b[0m";
function filterUrl(url) {
  if (url?.match(/https?:\/\/(www)?\.youtube\.com/)) {
    const id = url.match(
      /https?:\/\/(www)?\.youtube\.com\/watch\?v=([a-zA-Z0-9-_]+)/,
    )[2];
    return `https://www.youtube.com/watch?v=${id}`;
  }
  return url;
}
function play(url, pageUrl, token, isLoadFromHistory) {
  url = filterUrl(url);
  pageUrl = filterUrl(pageUrl);
  if (urls.includes(pageUrl || url)) {
    output("Duplicated Url: " + (pageUrl || url));
    return;
  }
  urls.push(pageUrl || url);
  fs.writeFileSync(pathRunningUrls, urls.join("\n"));
  sendToClient(JSON.stringify({ url: pageUrl || url }));

  const content = `${url}${pageUrl ? ` - ${blueColor}${pageUrl}${resetColor}` : ""}`;
  output(
    `${greenColor}Received request to open mpv ${resetColor}(${content})...`,
  );

  const command = (callback) => {
    isMpvRunning = true;
    let countError = 0;

    const execMpv = async (autoReloadMode = false) => {
      let execUrl = url;
      currentPlayingUrl = url;
      if (url && url.match(/https?:\/\/(www)?\.iwara\.tv/)) {
        if (IWARA_EXECUTION_MODE === "direct") {
          output(`[Mode: direct] Bypassing proxy. Running mpv directly...`);
          autoReloadMode = false;
        } else if (IWARA_EXECUTION_MODE === "proxy") {
          output(`[Mode: proxy] Checking for browser proxy connection...`);
          if (socketServer.clients.size === 0) {
            output(`No browser client connected. Waiting for a connection...`);
          }
          await waitForConnection(socketServer);
          output(`Browser client connected. Proceeding with proxy...`);

          let retries = 3;
          while (retries > 0) {
            execUrl = await getVideoUrl(url, token);
            if (execUrl) break;
            output(
              `[Attempt ${4 - retries}] Failed to get video URL for: ${url}`,
            );
            retries--;
            await sleep(1000); // Wait a bit before retrying
          }

          if (!execUrl) {
            output(
              `Failed to get video URL for ${url} after multiple attempts using proxy mode. Falling back to ytdl.`,
            );
            execUrl = url; // Fallback to original URL
            autoReloadMode = false;
          }
        } else {
          // IWARA_EXECUTION_MODE === "auto" (default)
          output(`[Mode: auto] Checking for browser proxy connection...`);
          if (socketServer.clients.size > 0) {
            let retries = 3;
            while (retries > 0) {
              execUrl = await getVideoUrl(url, token);
              if (execUrl) break;
              output(
                `[Attempt ${4 - retries}] Failed to get video URL for: ${url}`,
              );
              retries--;
              await sleep(1000); // Wait a bit before retrying
            }

            if (!execUrl) {
              output(
                `Failed to get video URL for ${url} after multiple attempts. Falling back to ytdl.`,
              );
              execUrl = url; // Fallback to original URL
              autoReloadMode = false;
            }
          } else {
            output("No client connected, running mpv directly with ytdl...");
            autoReloadMode = false;
          }
        }
      } else {
        autoReloadMode = false;
      }

      output(
        `${greenColor}Executing mpv ${resetColor}(${execUrl}${pageUrl ? ` - ${blueColor}${pageUrl}${resetColor}` : ""})...`,
      );
      output("Current playing url: ", currentPlayingUrl);

      let timeCount = 0;
      const process = exec(
        `mpv "${execUrl}" --fs --ytdl-format="bestvideo[height<=?2440]+bestaudio/best" --pause`,
        async (error, stdout, stderr) => {
          previousUrl = currentPlayingUrl;
          currentPlayingUrl = "";
          isMpvRunning = false;

          if (isReload) {
            isReload = false;
            await execMpv();
            return;
          }

          urls = urls.filter((item) => item !== (pageUrl || url));
          fs.writeFileSync(pathRunningUrls, urls.join("\n"));
          sendToClient(
            JSON.stringify({ isContinue: true, url: pageUrl || url }),
          );

          if (error) {
            if (!process.killed) {
              output(`Error: ${error.message.split("\n")[0]}`);
              output(`Try requesting again`);
              if (countError++ < 2) {
                await execMpv();
              } else {
                callback(error);
              }
            } else {
              output("Auto reloading...");
              await execMpv();
            }
          } else if (stderr) {
            callback(stderr);
          } else {
            const historyUrl = pageUrl || url;
            fs.appendFile(pathHistoryLog, historyUrl + "\n", (err) => {
              if (err) {
                output("Error writing to history log:", err);
              }
            });
            callback();
          }
        },
      );

      let timeReloaded = 7;
      let isSmooth = false;
      process.stdout.on("data", (data) => {
        if (data.includes("[gpu]")) isSmooth = true;
        else if (data) timeReloaded = 15;
      });

      while (timeCount < timeReloaded && !isSmooth) {
        await sleep(1000);
        timeCount++;
        outputRealtime(`Elapsed: ${timeCount} Secs`);
      }
      outputRealtime("");
      clearPreviousLine();
      if (!isSmooth && autoReloadMode) {
        process.kill();
      }
    };
    execMpv();
  };

  if (isLoadFromHistory) {
    commandQueue.push(command);
    process.stdout.write("\r\x1b[k---From History---\r\n");
  } else {
    if (VIDEO_QUEUE_MODE) {
      commandQueue.push(command);
    } else {
      commandQueue.unshift(command);
    }
  }
}

function getStatus() {
  return isMpvRunning ? "running" : "not running";
}

function getRunningUrls() {
  return urls;
}

function getPlayingUrl() {
  return currentPlayingUrl;
}

function getPreviousUrl() {
  return previousUrl;
}

function setReload() {
  isReload = true;
  output("Reloading...");
}

module.exports = {
  play,
  getStatus,
  getRunningUrls,
  getPlayingUrl,
  getPreviousUrl,
  setReload,
};
