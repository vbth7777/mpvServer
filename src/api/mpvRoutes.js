

const express = require("express");
const router = express.Router();
const { exec } = require("child_process");
const fs = require("fs");
const mpvPlayer = require("../services/mpvPlayer");
const { pathHistoryLog } = require("../config");

router.post("/async-run", (req, res) => {
  const url = req.body.url;
  if (url) {
    console.log(url);
    exec(
      `mpv "${url}" --fs --ytdl-format="bestvideo[height<=?2440]+bestaudio/best" --pause `,
    );
  }
  res.sendStatus(200);
});

router.post("/", async (req, res) => {
  const { url, accessToken, isLoadFromHistory, pageUrl } = req.body;
  mpvPlayer.play(url, pageUrl == "null" ? null : pageUrl, accessToken, isLoadFromHistory);
  res.sendStatus(200);
});

router.get("/mpv-status", (req, res) => {
  res.send(mpvPlayer.getStatus());
});

router.get("/running-urls", (req, res) => {
  res.send(mpvPlayer.getRunningUrls());
});

router.get("/playing-url", (req, res) => {
  res.send(mpvPlayer.getPlayingUrl());
});

router.get("/previous-url", (req, res) => {
  res.send(mpvPlayer.getPreviousUrl());
});

router.post("/reload", (req, res) => {
  mpvPlayer.setReload();
  res.sendStatus(200);
});

router.get("/history", (req, res) => {
  fs.readFile(pathHistoryLog, "utf8", (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return res.json([]);
      }
      return res.status(500).send("Error reading history log.");
    }
    const urls = data.split("\n").filter(line => line.trim() !== "");
    res.json(urls);
  });
});

module.exports = router;

