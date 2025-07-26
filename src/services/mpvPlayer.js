

const async = require("async");
const { exec } = require("child_process");
const fs = require("fs");
const { getVideoUrl } = require("./iwaraClient");
const { output, outputRealtime, clearPreviousLine, sleep } = require("../lib/logger");
const { pathRunningUrls, VIDEO_QUEUE_MODE, pathHistoryLog } = require("../config");
const { sendToClient } = require("./websocketManager");

const commandQueue = async.queue((task, callback) => task(callback));

let isMpvRunning = false;
let currentPlayingUrl = "";
let previousUrl = "";
let isReload = false;
let urls = [];

const greenColor = "\x1b[32m";
const blueColor = "\x1b[34m";
const resetColor = "\x1b[0m";

function play(url, pageUrl, token, isLoadFromHistory) {
  if (urls.includes(pageUrl || url)) {
    output("Duplicated Url: " + (pageUrl || url));
    return;
  }
  urls.push(pageUrl || url);
  fs.writeFileSync(pathRunningUrls, urls.join("\n"));
  sendToClient(JSON.stringify({ url: pageUrl || url }));

  const content = `${url}${pageUrl ? ` - ${blueColor}${pageUrl}${resetColor}` : ""}`;
  output(`${greenColor}Received request to open mpv ${resetColor}(${content})...`);

  const command = (callback) => {
    isMpvRunning = true;
    let countError = 0;

    const execMpv = async (autoReloadMode = true) => {
      let execUrl = url;
      currentPlayingUrl = url;
      if (url.match(/https?:\/\/(www)?\.iwara\.tv/)) {
        execUrl = await getVideoUrl(url, token);
        if (!execUrl) {
            output("Could not get video URL. Aborting playback.");
            urls = urls.filter((item) => item !== (pageUrl || url));
            fs.writeFileSync(pathRunningUrls, urls.join("\n"));
            isMpvRunning = false;
            callback();
            return;
        }
      } else {
        autoReloadMode = false;
      }

      output(`${greenColor}Executing mpv ${resetColor}(${execUrl}${pageUrl ? ` - ${blueColor}${pageUrl}${resetColor}` : ""})...`);
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
            execMpv();
            return;
          }
          
          urls = urls.filter((item) => item !== (pageUrl || url));
          fs.writeFileSync(pathRunningUrls, urls.join("\n"));
          sendToClient(JSON.stringify({ isContinue: true, url: pageUrl || url }));

          if (error) {
            if (!process.killed) {
              output(`Error: ${error.message.split("\n")[0]}`);
              output(`Try requesting again`);
              if (countError++ < 2) {
                execMpv();
              } else {
                callback(error);
              }
            } else {
              output("Auto reloading...");
              execMpv();
            }
          } else if (stderr) {
            callback(stderr);
          } else {
            const historyUrl = pageUrl || url;
            fs.appendFile(pathHistoryLog, historyUrl + '\n', (err) => {
              if (err) {
                output("Error writing to history log:", err);
              }
            });
            callback();
          }
        }
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

