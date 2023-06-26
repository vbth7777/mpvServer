const { exec } = require("child_process");
const express = require('express');
const path = require('path');
const async = require('async');

const app = express();
const port = 9789;
const commandQueue = async.queue((task, callback) => task(callback));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const greenColor = '\x1b[32m'; // ANSI escape sequence for green color
const blueColor = '\x1b[34m'; // ANSI escape sequence for green color
const resetColor = '\x1b[0m'; // ANSI escape sequence to reset color

app.post('/', (req, res) => {
    const url = req.body.url;
    const pageUrl = req.body.pageUrl;
    let content = '';
    if (pageUrl != 'null') {
        content = `${url} - ${blueColor}${pageUrl}${resetColor}`
    }
    else {
        content = `${url}`
    }
    console.log(`${greenColor}Received request to open mpv ${resetColor}(${content})...`);

    commandQueue.push(callback => {
        console.log(`${greenColor}Executing mpv ${resetColor}(${content})...`);
        let countError = 0;
        const execMpv = function() {
            exec(`mpv "${url}" --fs`, (error, stdout, stderr) => {
                if (error) {
                    console.log(`Error: ${error.message}`);
                    console.log(`Try requesting again`);
                    if (countError++ < 5) {
                        execMpv();
                    }
                    else {
                        callback(error);
                    }
                } else if (stderr) {
                    console.log(`Stderr: ${stderr}`);
                    callback(stderr);
                } else {
                    console.log(`Stdout: ${stdout}`);
                    callback();
                }
            });
        }
        execMpv();
    });

    res.sendStatus(200);
});

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));

