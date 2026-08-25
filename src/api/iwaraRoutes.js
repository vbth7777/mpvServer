const express = require("express");
const router = express.Router();
const iwaraClient = require("../services/iwaraClient");

router.get("/user", async (req, res) => {
  const profileSlug = req.query.profileSlug;
  try {
    const user = await iwaraClient.getJSON(
      `https://apiq.iwara.tv/profile/${profileSlug}`,
    );

    // Kiểm tra nếu user không tồn tại, private hoặc bị xóa trên Iwara
    if (
      !user ||
      user.error ||
      (user.message &&
        (user.message.toLowerCase().includes("notfound") ||
          user.message.toLowerCase().includes("private"))) ||
      !user.user ||
      !user.user.id
    ) {
      console.log(
        `[IWARA] Không tìm thấy tác giạ hoặc tài khoản không khả ndụng: ${profileSlug}`,
      );
      return res.status(200).json([]);
    }

    const idUser = user.user.id;
    const videoDetails = [];
    let page = 0;
    while (true) {
      const videos = await iwaraClient.getJSON(
        `https://apiq.iwara.tv/videos?sort=date&page=${page}&user=${idUser}`,
      );
      if (!videos || !videos.results || videos.results.length === 0) {
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
    res.json(videoDetails);
  } catch (error) {
    console.error(
      `[IWARA ERROR] Lỗi khi xù lý tác giả ${profileSlug}:`,
      error.message || error,
    );
    // Trả về mảng rỗng [] với HTTP 200 để script cào dữ liệu tự động bỏ qua user này
    res.status(200).json([]);
  }
});

router.get("/video", async (req, res) => {
  const videoId = req.query.id;
  const accessToken = req.query.accessToken;
  try {
    const url = await iwaraClient.getVideoUrl(
      "https://www.iwara.tv/video/" + videoId,
      accessToken,
    );
    res.json({ url });
  } catch (error) {
    console.error(`[IWARA VIDEO ERROR] ${videoId}:`, error.message || error);
    res.json({ url: null });
  }
});

module.exports = router;