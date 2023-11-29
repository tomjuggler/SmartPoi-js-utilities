# JavaScript and html Utilities for SmartPoi 

### upload_bin.html usage: 
- for uploading backup images to SmartPoi for offline display
- Requires jimp.min.js to be in the same folder
- requires latest [SmartPoi firmware](https://github.com/tomjuggler/SmartPoi-Firmware) with CORS upgrade running on the SmartPoi hardware. Older firmware versions will trigger an error. 
- set for 36px poi currently, to change to 72px just change this line to read 72 instead of 36: 
```
const resizedImage = rotatedImage.resize(36, Jimp.AUTO);
```

1. connect to SmartPoi AP
2. open upload_bin.html in a browser on connected device (desktop is best)
3. select multiple images to upload (up to 50, old images are replaced) 
4. images should be close to the correct size (eg height 36px), they are re-sized by the JavaScript before uploading
5. images are rotated by the JavaScript and converted to .bin format, then re-named and uploaded to the two poi sequentially

### controls.html usage: 
- requires latest [SmartPoi firmware](https://github.com/tomjuggler/SmartPoi-Firmware) running on the SmartPoi hardware. Older firmware versions do not work with some features eg. Brightness change.
- options: Pattern, Speed, Brightness change: just follow the instructions on the page. Speed is how long each image is displayed, can be 0-1800 seconds. 0 is converted up to 0.5 seconds on the poi. 1800 is 30 minutes. 

### list.html usage: 
Files on the poi can be checked by opening list.html while connected to the poi (AP), and clicking on "Get File List". Currently checking main poi only. change this line: 
```
fetch('http://192.168.1.1/list?dir=/')
```
to: 
```
fetch('http://192.168.1.78/list?dir=/')
```
and reload to check the auxillary poi files. 

### *curl examples for all poi http request end-points are provided in curl-tests.sh*
