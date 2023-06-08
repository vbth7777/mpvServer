const { exec } = require("child_process");
const express = require('express');
const path = require('path');
const async = require('async');

const app = express();
const port = 3000;
const commandQueue = async.queue((task, callback) => task(callback));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const greenColor = '\x1b[32m'; // ANSI escape sequence for green color
const resetColor = '\x1b[0m'; // ANSI escape sequence to reset color

app.post('/', (req, res) => {
    const url = req.body.url;
    console.log(`${greenColor}Received request to open mpv ${resetColor}(${url})...`);

    commandQueue.push(callback => {
        console.log(`${greenColor}Executing mpv ${resetColor}(${url})...`);
        exec(`mpv "${url}"`, (error, stdout, stderr) => {
            if (error) {
                console.log(`Error: ${error.message}`);
                callback(error);
            } else if (stderr) {
                console.log(`Stderr: ${stderr}`);
                callback(stderr);
            } else {
                console.log(`Stdout: ${stdout}`);
                callback();
            }
        });
    });

    res.sendStatus(200);
});

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));

