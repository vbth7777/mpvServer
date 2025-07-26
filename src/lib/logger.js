function output(content) {
  process.stdout.write(content);
  if (arguments.length > 1) {
    for (let i = 1; i < arguments.length; i++) {
      process.stdout.write(arguments[i]);
    }
  }
  process.stdout.write("\n");
}
function outputRealtime(content) {
  process.stdout.write("\r" + content);
  if (arguments.length > 1) {
    for (let i = 1; i < arguments.length; i++) {
      process.stdout.write(arguments[i]);
    }
  }
}
function clearPreviousLine(count) {
  for (let i = 0; i < count; i++) {
    process.stdout.write("\r\x1b[k");
  }
}
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
module.exports = { output, outputRealtime, clearPreviousLine, sleep };
