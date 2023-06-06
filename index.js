const { exec } = require("child_process");
const express = require('express');
const path = require('path')
const app = express();
const port = 3000;
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({
    extended: true
}))
app.use(express.json())

app.post('/', (req, res) => {
    const url = req.body.url;
    console.log(`Opening mpv (${url})...`)
    exec(`mpv "${url}"`, (error, stdout, stderr) => {
        if (error) {
            console.log(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
    });
});
app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));

