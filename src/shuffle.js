var fs = require("fs");

var text = fs.readFileSync("./running-urls.txt", "utf-8");
var textByLine = text.split("\n");

function shuffle(array) {
  var currentIndex = array.length,
    temporaryValue,
    randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}
// console.log(textByLine);
const arrayShuffled = shuffle(textByLine).join("\n");
fs.writeFileSync("./running-urls-shuffled.txt", arrayShuffled, "utf-8");
