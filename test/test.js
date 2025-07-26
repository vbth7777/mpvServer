const axios = require("axios");
console.log(
  axios.get("https://api.iwara.tv/video/qluMEaxHRnBqGm", {
    Authorization:
      "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImYyMjFjOTY1LWEwOWEtNDdmMC1hNjdhLTdkNTdhZjAxZTQxZiIsInR5cGUiOiJyZWZyZXNoX3Rva2VuIiwiaXNzIjoiaXdhcmEiLCJpYXQiOjE3Mjg2ODYwNTUsImV4cCI6MTczMTI3ODA1NX0.yP_t4C6OMfXkH9cCSFVPnStoHxKHvll838A00k9DAUI",
    "Sec-ch-ua-platform": "Linux",
    "Sec-fetch-dest": "empty",
    "Sec-fetch-mode": "cors",
    "Sec-fetch-site": "same-site",
    "User-agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Content-type": "application/json",
    Origin: "https://www.iwara.tv",
    Priority: "u=1, i",
    Referer: "https://www.iwara.tv/",
    "Sec-ch-ua": `"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"`,
    Accept: "application/json",
    "Accept-encoding": "gzip, deflate, br, zstd",
    "Accept-language": "en-US,en;q=0.9",
  }),
);
