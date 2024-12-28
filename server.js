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
    .catch((err, data) => {
      output("error: " + url);
      output(err);
      return null;
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
app.post("/async-run", (req, res) => {
  const url = req.body.url;
  if (url) {
    exec(
      `mpv "${url}" --fs --ytdl-format="bestvideo[height<=?2440]+bestaudio/best" --pause`,
    );
  }
  res.sendStatus(200);
});
app.post("/", (req, res) => {
  const url = req.body.url;
  token = req.body.accessToken;
  const isLoadFromHistory = req.body.isLoadFromHistory;
  let pageUrl = req.body.pageUrl == "null" ? null : req.body.pageUrl;
  if (urls.includes(pageUrl || url)) {
    // output('Duplicate url: ', pageUrl || url)
    res.send("Duplicated Url: " + pageUrl || url);
    return;
  }
  if (url.match(/https?:\/\/(www)?\.iwara\.tv/)) {
    pageUrl = url;
  }
  urls.push(pageUrl || url);
  if (!fs.existsSync(pathRunningUrls)) {
    fs.writeFileSync(pathRunningUrls, "");
  }

  const runningUrls = fs.readFileSync(pathRunningUrls).toString();
  fs.writeFileSync(pathRunningUrls, urls.join("\n"));
  sendToClient(JSON.stringify({ url: pageUrl || url }));
  // fs.writeFileSync(pathRunningUrls, runningUrls + '\n' + (pageUrl || url).toString());
  let content = "";
  let pageUrlColor = `${blueColor}${pageUrl}${resetColor}`;
  content = `${url}${pageUrl ? " - " + pageUrlColor : ""}`;
  output(
    `${greenColor}Received request to open mpv ${resetColor}(${content})...`,
  );
  isMpvRunning = true;

  const command = (callback) => {
    isMpvRunning = true;
    let countError = 0;
    const execMpv = async function (autoReloadMode = true) {
      let execUrl = url;
      currentPlayingUrl = url;
      if (url.match(/https?:\/\/(www)?\.iwara\.tv/)) {
        execUrl = await getVideoUrl(url, token);
      } else {
        autoReloadMode = false;
      }
      output(
        `${greenColor}Executing mpv ${resetColor}(${execUrl}${pageUrl ? " - " + pageUrlColor : ""})...`,
      );
      output("Current playing url: ", currentPlayingUrl);
      let timeCount = 0;
      const process = exec(
        `mpv "${execUrl}" --fs --ytdl-format="bestvideo[height<=?2440]+bestaudio/best" --pause`,
        async (error, stdout, stderr) => {
          previousUrl = currentPlayingUrl;
          currentPlayingUrl = "";
          isMpvRunning = false;
          let isAutoReload = false;
          if (isReload) {
            isReload = false;
            execMpv();
          } else if (error) {
            // if (isReload) {
            //   output(`Reloading...`);
            // } else {
            if (!process.killed) {
              output(`Error: ${error.message.split("\n")[0]}`);
              output(`Try requesting again`);
              if (countError++ < 2) {
                // if (isReload) {
                //   countError = 0;
                //   isReload = false;
                // }
                execMpv();
              } else {
                callback(error);
              }
            } else {
              output("Auto reloading...");
              isAutoReload = true;
              execMpv();
            }
            // }
          } else if (stderr) {
            // output(`Stderr: ${stderr}`);
            callback(stderr);
          } else {
            // output(`Stdout: ${stdout}`);
            callback();
          }
          if (isAutoReload) return;
          urls = urls.filter((item) => item != (pageUrl || url));
          sendToClient(
            JSON.stringify({ isContinue: true, url: pageUrl || url }),
          );
          let runningUrls = fs.readFileSync(pathRunningUrls).toString();
          // fs.writeFileSync(pathRunningUrls, runningUrls.replace((pageUrl || url), '').replace(/\n+/, ''));
          fs.writeFileSync(pathRunningUrls, urls.join("\n"));
        },
      );
      let timeReloaded = 7;
      let isSmooth = false;
      process.stdout.on("data", (data) => {
        if (data.includes("[gpu]")) {
          isSmooth = true;
        } else if (data) {
          timeReloaded = 15;
        }
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
        //   execMpv();
      }
    };
    execMpv();
  };
  // Prority new request
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
  // Prority by queue
  // commandQueue.push(command);
  res.sendStatus(200);
});
function sendToClient(content) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(content);
    }
  });
}
app.get("/mpv-status", (req, res) => {
  res.send(isMpvRunning ? "running" : "not running");
});
app.get("/running-urls", (req, res) => {
  res.send(urls);
});
app.get("/playing-url", (req, res) => {
  res.send(currentPlayingUrl);
});
app.get("/previous-url", (req, res) => {
  res.send(previousUrl);
});
app.post("/reload", (req, res) => {
  isReload = true;
  output("Reloading...");
});

app.listen(port, () => output(`App listening at http://localhost:${port}`));
if (!fs.existsSync(pathRunningUrls)) {
  fs.writeFileSync(pathRunningUrls, "");
}
const runningUrls = fs.readFileSync(pathRunningUrls).toString();
if (runningUrls) {
  let urls = runningUrls.split("\n");
  urls = urls.filter((url, index) => urls.indexOf(url) === index);
  const token = envToken || "";
  for (const url of urls) {
    if (url) {
      output(`Resuming ${url}...`);
      fs.writeFileSync(pathRunningUrls, runningUrls.replace(url, ""));
      axios.post("http://localhost:9789/", {
        url: url,
        accessToken: token,
        isLoadFromHistory: !VIDEO_QUEUE_MODE,
      });
    }
  }
}
