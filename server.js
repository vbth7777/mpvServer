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
let currentPlayingUrl = "";
let previousUrl = "";

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
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
    .catch((err) => {
      console.log("error: " + url);
      console.log(err);
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
          console.log("Error: ", status);
          return;
        }
        if (
          res.message &&
          (res?.message?.trim()?.toLowerCase()?.includes("notfound") ||
            res?.message?.trim()?.toLowerCase()?.includes("private"))
        ) {
          console.log(res.message + " for " + id);
          return;
        } else if (res.message) {
          console.log(res.message);
          return;
        }
        if (res.embedUrl && !res.fileUrl) {
          return res.embedUrl;
        }
        const fileUrl = res.fileUrl;
        const fileId = getFileId(fileUrl);
        if (!fileId || !fileUrl) {
          console.log("Not found requirement");
          return;
        }
        // const vidResolution = ["Source", "540", "360"];

        // console.log((fileId + '_' + getExpire(fileUrl) + '_5nFp9kmbNnHdAFhaqMvt'))
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
    );
  } catch (ex) {
    console.log(ex);
  }
}
//WebSocket

const wss = new WebSocketServer({ port: 9790 });

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);

  ws.on("message", function message(data, isBinary) {
    console.log("Connected to client");
    // wss.clients.forEach(function each(client) {
    //     if (client.readyState === WebSocket.OPEN) {
    //         client.send(isMpvRunning)
    //     }
    // });
  });
  ws.on("close", function close() {
    console.log("Client closed connection");
  });
});

let isMpvRunning = false;
const greenColor = "\x1b[32m"; // ANSI escape sequence for green color
const blueColor = "\x1b[34m"; // ANSI escape sequence for green color
const resetColor = "\x1b[0m"; // ANSI escape sequence to reset color
let urls = [];
app.post("/async-run", (req, res) => {
  const url = req.body.url;
  if (url)
    exec(
      `mpv "${url}" --fs --ytdl-format="bestvideo[height<=?2440]+bestaudio/best" --pause`,
    );
  res.sendStatus(200);
});
app.post("/", (req, res) => {
  const url = req.body.url;
  const token = req.body.accessToken;
  let pageUrl = req.body.pageUrl == "null" ? null : req.body.pageUrl;
  if (urls.includes(pageUrl || url)) {
    // console.log('Duplicate url: ', pageUrl || url)
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
  console.log(
    `${greenColor}Received request to open mpv ${resetColor}(${content})...`,
  );
  isMpvRunning = true;

  commandQueue.push((callback) => {
    isMpvRunning = true;
    let countError = 0;
    const execMpv = async function() {
      let execUrl = url;
      currentPlayingUrl = url;
      if (url.match(/https?:\/\/(www)?\.iwara\.tv/)) {
        execUrl = await getVideoUrl(url, token);
      }
      console.log(
        `${greenColor}Executing mpv ${resetColor}(${execUrl}${pageUrl ? " - " + pageUrlColor : ""})...`,
      );
      console.log("Current playing url: ", currentPlayingUrl);
      exec(
        `mpv "${execUrl}" --fs --ytdl-format="bestvideo[height<=?2440]+bestaudio/best" --pause`,
        (error, stdout, stderr) => {
          previousUrl = currentPlayingUrl;
          currentPlayingUrl = "";
          isMpvRunning = false;
          if (error) {
            console.log(`Error: ${error.message}`);
            console.log(`Try requesting again`);
            if (countError++ < 2) {
              execMpv();
            } else {
              callback(error);
            }
          } else if (stderr) {
            console.log(`Stderr: ${stderr}`);
            callback(stderr);
          } else {
            console.log(`Stdout: ${stdout}`);
            callback();
          }
          sendToClient(
            JSON.stringify({ isContinue: true, url: pageUrl || url }),
          );
          urls = urls.filter((item) => item != (pageUrl || url));
          let runningUrls = fs.readFileSync(pathRunningUrls).toString();
          // fs.writeFileSync(pathRunningUrls, runningUrls.replace((pageUrl || url), '').replace(/\n+/, ''));
          fs.writeFileSync(pathRunningUrls, urls.join("\n"));
        },
      );
    };
    execMpv();
  });
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

app.listen(port, () =>
  console.log(`App listening at http://localhost:${port}`),
);
if (!fs.existsSync(pathRunningUrls)) {
  fs.writeFileSync(pathRunningUrls, "");
}
const runningUrls = fs.readFileSync(pathRunningUrls).toString();
if (runningUrls) {
  let urls = runningUrls.split("\n");
  urls = urls.filter((url, index) => urls.indexOf(url) === index);
  for (const url of urls) {
    if (url) {
      console.log(`Resuming ${url}...`);
      fs.writeFileSync(pathRunningUrls, runningUrls.replace(url, ""));
      axios.post("http://localhost:9789/", { url: url });
    }
  }
}
