
const express = require("express");
const router = express.Router();
const iwaraClient = require("../services/iwaraClient");

router.get("/user", async (req, res) => {
  const profileSlug = req.query.profileSlug;
  try {
    const user = await iwaraClient.getJSON(`https://api.iwara.tv/profile/${profileSlug}`);
    const idUser = user.user.id;
    const videoDetails = [];
    let page = 0;
    while (true) {
      const videos = await iwaraClient.getJSON(
        `https://api.iwara.tv/videos?sort=date&page=${page}&user=${idUser}`,
      );
      if (videos.results.length === 0) {
        break;
      }
      videos.results.forEach((video) => {
        videoDetails.push({
          id: video.id,
          title: video.title,
        });
      });
      page++;
    }
    res.send(JSON.stringify(videoDetails));
  } catch (error) {
    res.status(500).send(error);
  }
});

router.get("/video", async (req, res) => {
  const videoId = req.query.id;
  const accessToken = req.query.accessToken;
  res.send(
    JSON.stringify({
      url: await iwaraClient.getVideoUrl(
        "https://www.iwara.tv/video/" + videoId,
        accessToken,
      ),
    }),
  );
});

module.exports = router;
