var fs = require("fs");

var text = fs.readFileSync("./running-urls.txt", "utf-8");
var textByLine = text.split("\n");

function shuffle(array) {
  var currentIndex = array.length,
    temporaryValue,
    randomIndex;

  while (0 !== currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}
const arrayShuffled = shuffle(textByLine).join("\n");
fs.writeFileSync("./running-urls.txt", arrayShuffled, "utf-8");
