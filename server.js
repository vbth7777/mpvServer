const WebSocket = require('ws');
const { WebSocketServer } = require('ws');



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
//WebSocket

const wss = new WebSocketServer({ port: 9790 });

wss.on('connection', function connection(ws) {
    ws.on('error', console.error);

    ws.on('message', function message(data, isBinary) {
        console.log('Connected to client')
        // wss.clients.forEach(function each(client) {
        //     if (client.readyState === WebSocket.OPEN) {
        //         client.send(isMpvRunning)
        //     }
        // });
    });
    ws.on('close', function close() {
        console.log('Client closed connection')
    })
});

let isMpvRunning = false;
const greenColor = '\x1b[32m'; // ANSI escape sequence for green color
const blueColor = '\x1b[34m'; // ANSI escape sequence for green color
const resetColor = '\x1b[0m'; // ANSI escape sequence to reset color
let urls = [];

app.post('/', (req, res) => {
    const url = req.body.url;
    const pageUrl = req.body.pageUrl;
    if (urls.includes(pageUrl) && pageUrl != 'null') {
        return;
    }
    urls.push(pageUrl);
    let content = '';
    if (pageUrl != 'null') {
        content = `${url} - ${blueColor}${pageUrl}${resetColor}`
    }
    else {
        content = `${url}`
    }
    console.log(`${greenColor}Received request to open mpv ${resetColor}(${content})...`);
    isMpvRunning = true

    commandQueue.push(callback => {
        isMpvRunning = true;
        console.log(`${greenColor}Executing mpv ${resetColor}(${content})...`);
        let countError = 0;
        const execMpv = function() {
            exec(`mpv "${url}" --fs`, (error, stdout, stderr) => {
                isMpvRunning = false;
                if (error) {
                    console.log(`Error: ${error.message}`);
                    console.log(`Try requesting again`);
                    if (countError++ < 2) {
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
                urls = urls.filter(item => item !== pageUrl);
                wss.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(null);
                    }
                });
            });
        }
        execMpv();
    });
    res.sendStatus(200);
});
app.get('/mpv-status', (req, res) => {
    res.send(isMpvRunning ? 'running' : 'not running');
})

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));

