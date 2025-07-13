process.stdin.resume();
process.stdin.setEncoding("utf8");
const WebSocket = require("ws");
const { WebSocketServer } = require("ws");

const { exec } = require("child_process");
const express = require("express");
const path = require("path");
const async = require("async");
const fs = require("fs");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const port = 9789;
const commandQueue = async.queue((task, callback) => task(callback));
const pathRunningUrls = path.join(__dirname, "running-urls.txt");
const VIDEO_QUEUE_MODE = false;
let isReload = false;
let currentPlayingUrl = "";
let previousUrl = "";
//import config.priv.js file
let envToken = "";
try {
  envToken = require("./config.priv").token;
} catch {}

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
function output(content) {
  process.stdout.write(content);
  if (arguments.length > 1) {
    for (let i = 1; i < arguments.length; i++) {
      process.stdout.write(arguments[i]);
    }
  }
  process.stdout.write("\n");
}

function outputRealtime(content) {
  process.stdout.write("\r" + content);
  if (arguments.length > 1) {
    for (let i = 1; i < arguments.length; i++) {
      process.stdout.write(arguments[i]);
    }
  }
}
function clearPreviousLine(count) {
  for (let i = 0; i < count; i++) {
    process.stdout.write("\r\x1b[k");
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
function convertToSHA1(str) {
  const shasum = crypto.createHash("sha1");
  shasum.update(str);
  return shasum.digest("hex");
}
function getJSON(url, callback, headers) {
  return axios
    .get(url, {
      headers: headers,
    })
    .then((res) => {
      return callback(null, res.data);
    })
    .catch((error) => {
      if (error.response) {
        // If the server responded with an error (e.g., 404, 500)
        // Create a clear error message string
        const errorMessage = `API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
        output(errorMessage);
      } else {
        // For other errors like network issues
        // Pass the general error message string
        output(error.message);
      }
    });
}
async function getVideoUrl(url, accessToken) {
  const getID = (url) => {
    return url.match(/video\/([^\/]*)/)[1];
  };
  const getFileId = (url) => {
    return url.match(/file\/.+\?/g)[0].replace(/file\/|\?/g, "");
  };
  const getExpire = (url) => {
    return url.match("expires=.+&")[0].replace(/expires=|&/g, "");
  };

  const id = getID(url);
  if (!id) return null;
  try {
    return await getJSON(
      `https://api.iwara.tv/video/${id}`,
      async (status, res) => {
        if (status) {
          output("Error: ", status);
          return;
        }
        console.log(res);
        if (
          res.message &&
          (res?.message?.trim()?.toLowerCase()?.includes("notfound") ||
            res?.message?.trim()?.toLowerCase()?.includes("private"))
        ) {
          output(res.message + " for " + id);
          return;
        } else if (res.message) {
          output(res.message);
          return;
        }
        if (res.embedUrl && !res.fileUrl) {
          return res.embedUrl;
        }
        const fileUrl = res.fileUrl;
        const fileId = getFileId(fileUrl);
        if (!fileId || !fileUrl) {
          output("Not found requirement");
          return;
        }
        // const vidResolution = ["Source", "540", "360"];

        // output((fileId + '_' + getExpire(fileUrl) + '_5nFp9kmbNnHdAFhaqMvt'))
        return await getJSON(
          fileUrl,
          (status2, res2) => {
            const json = res2;
            let i = json.length - 1;
            while (
              i >= 0 &&
              !json[i].name.includes("Source") &&
              !json[i].name.includes("540") &&
              !json[i].name.includes("360")
            ) {
              i--;
            }
            const uri = "https:" + json[i].src.download;
            return uri;
          },
          {
            "content-type": "application/json",
            referer: "https://www.iwara.tv/",
            origin: "https://www.iwara.tv",

            "user-agent": `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36`,
            "x-version": convertToSHA1(
              fileId + "_" + getExpire(fileUrl) + "_5nFp9kmbNnHdAFhaqMvt",
            ),
            Authorization: "Bearer " + accessToken,
          },
        );
      },
      {
        "content-type": "application/json",
        referer: "https://www.iwara.tv/",
        origin: "https://www.iwara.tv",

        "user-agent": `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36`,
        Authorization: "Bearer " + accessToken,
      },
    );
  } catch (ex) {
    // output(ex);
    console.log(ex);
  }
}
//WebSocket

const wss = new WebSocketServer({ port: 9790 });

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);

  ws.on("message", function message(data, isBinary) {
    output("Connected to client");
    // wss.clients.forEach(function each(client) {
    //     if (client.readyState === WebSocket.OPEN) {
    //         client.send(isMpvRunning)
    //     }
    // });
  });
  ws.on("close", function close() {
    output("Client closed connection");
  });
});

let isMpvRunning = false;
const greenColor = "\x1b[32m"; // ANSI escape sequence for green color
const blueColor = "\x1b[34m"; // ANSI escape sequence for green color
const resetColor = "\x1b[0m"; // ANSI escape sequence to reset color
let token = "";
let pauseRequest = true;
let urls = [];
(async () => {
  console.log(
    await getVideoUrl("https://www.iwara.tv/video/G2S3aPrkDhC7p0", null),
  );
  // axios.get("https://api.iwara.tv/video/G2S3aPrkDhC7p0").then((res) => {
  //   console.log(res.data);
  // });
})();
