
const crypto = require("crypto");
const proxy = require("./browserRequestProxy");
const { output } = require("../lib/logger");

function convertToSHA1(str) {
  const shasum = crypto.createHash("sha1");
  shasum.update(str);
  return shasum.digest("hex");
}

async function getJSON(url, headers = {}) {
    return proxy.fetch(url, headers);
}

async function getVideoUrl(url, accessToken) {
  const getID = (url) => {
    return url.match(/video\/([^\/]*)/)[1];
  };
  const getFileId = (url) => {
    if (!url) return null;
    const match = url.match(/file\/.+\?/g);
    return match ? match[0].replace(/file\/|\?/g, "") : null;
  };
  const getExpire = (url) => {
    if (!url) return null;
    const match = url.match("expires=.+&");
    return match ? match[0].replace(/expires=|&/g, "") : null;
  };

  const id = getID(url);
  if (!id) return null;

  try {
    const videoInfo = await getJSON(`https://api.iwara.tv/video/${id}`, {
      "content-type": "application/json",
      referer: "https://www.iwara.tv/",
      origin: "https://www.iwara.tv",
      "user-agent": `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36`,
      Authorization: "Bearer " + accessToken,
    });

    if (
      videoInfo.message &&
      (videoInfo?.message?.trim()?.toLowerCase()?.includes("notfound") ||
        videoInfo?.message?.trim()?.toLowerCase()?.includes("private"))
    ) {
      output(videoInfo.message + " for " + id);
      return null;
    } else if (videoInfo.message) {
      output(videoInfo.message);
      return null;
    }

    if (videoInfo.embedUrl && !videoInfo.fileUrl) {
      return videoInfo.embedUrl;
    }

    const fileUrl = videoInfo.fileUrl;
    const fileId = getFileId(fileUrl);
    const expire = getExpire(fileUrl);

    if (!fileId || !fileUrl || !expire) {
      output("Not found requirement: fileId, fileUrl or expire");
      return null;
    }

    const fileData = await getJSON(fileUrl, {
      "x-version": convertToSHA1(fileId + "_" + expire + "_5nFp9kmbNnHdAFhaqMvt"),
      Authorization: "Bearer " + accessToken,
    });

    if (!fileData || !Array.isArray(fileData) || fileData.length === 0) {
        output("Could not retrieve file data or file data is empty.");
        return null;
    }

    let bestVideo = fileData.find(f => f.name === "Source");
    if (!bestVideo) {
        bestVideo = fileData.find(f => f.name === "540");
    }
    if (!bestVideo) {
        bestVideo = fileData.sort((a, b) => parseInt(b.name, 10) - parseInt(a.name, 10))[0];
    }

    const uri = "https:" + bestVideo.src.download;
    return uri;

  } catch (ex) {
    console.log("Error in getVideoUrl:", ex);
    return null;
  }
}

module.exports = {
  getVideoUrl,
  getJSON,
};
