# JavaScript and html Utilities for SmartPoi 
### quick start: 
- open index.html and choose one of the options
- For development/testing of smart-magic-bridge.html, use Chrome insecure mode:
```bash
chromium --disable-web-security --user-data-dir=/tmp/chrome-test
```

### New! smart-magic-bridge.html
- **Cloud-to-POI Bridge** - Connects circuscientist.com cloud services directly to POI devices
- Features:
  - Secure JWT authentication
  - Timeline-based image selection
  - Dual POI upload (main+aux) with progress tracking
  - LED configuration (type/count) presets
  - Automatic .bin file conversion
- Requires Chrome insecure mode for local CORS testing (see command above)
- *Known Issues (v1.0):*
  - Some .bin files may fail upload with connection reset errors (fix in progress)
  - Requires latest firmware on both POI units
  - Router mode not yet supported

### upload_bin.html usage: 
- for uploading multiple backup images to SmartPoi for offline display
- Requires jimp.min.js to be in the same folder
- requires latest [SmartPoi firmware](https://github.com/tomjuggler/SmartPoi-Firmware) with CORS upgrade running on the SmartPoi hardware. Older firmware versions will trigger an error. 
- set for 72px poi currently, to change to 36px just change the variable number_of_pixels to be equal to 36 instead of 72: 
```
const number_of_pixels = 72;
```

1. connect to SmartPoi AP
2. open upload_bin.html in a browser on connected device (desktop is best)
3. select multiple images to upload (up to 52, old images are replaced) 
4. images should be close to the correct size (eg height 36px), they are re-sized by the JavaScript before uploading
5. images are rotated by the JavaScript and converted to .bin format, then re-named and uploaded to the two poi sequentially

### controls.html usage: 
- requires latest [SmartPoi firmware](https://github.com/tomjuggler/SmartPoi-Firmware) running on the SmartPoi hardware. Older firmware versions do not work with some features eg. Brightness change.
- options: Pattern, Speed, Brightness change: just follow the instructions on the page. Speed is how long each image is displayed, can be 0-1800 seconds. 0 is converted up to 0.5 seconds on the poi. 1800 is 30 minutes. 
- router option: not recommended, see here: [https://www.circusscientist.com/2023/11/20/smartpoi-have-a-hidden-feature-i-didnt-tell-anyone-about-yet/](https://www.circusscientist.com/2023/11/20/smartpoi-have-a-hidden-feature-i-didnt-tell-anyone-about-yet/) - for this to work I will need to change a lot more code, including the Android app and all of the web apps here! You have been warned.

### list.html usage: 
Files on the poi can be checked by opening list.html while connected to the poi (AP), and clicking on "Get File List". 

### *curl examples for all poi http request end-points are provided in curl-tests.sh*

### fetch_and_display.html usage:
- fetches binary data from poi and displays as de-compressed images in the browser (actual images from poi!). Now included drag and drop to upload an image!!! 
- usage click on "Fetch and Display your poi images" button. Be patient while the images load. 
- click on an image to see filename
- drag and drop image from file manager to the specific image  to replace on the poi
- currently set to 72px (you can change this on the top right)
- requires latest [SmartPoi firmware](https://github.com/tomjuggler/SmartPoi-Firmware) running on the SmartPoi hardware. Older firmware versions do not work with some features

### This project is now Electron capable? 
- from the root directory, run on Linux, Windows or Mac with: 
```
npm installn
npm start
```
- to create an executable: 
``` 
npm run dist 
```
*Note: anyone who can help me with Arch linux let me know*

### documentation
- available for selected functions in documentation folder, can be opened as links in the main index.html
