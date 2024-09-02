# JavaScript and html Utilities for SmartPoi 

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
- currently set to 72px (search and change to 36 in code if needed)
- requires latest [SmartPoi firmware](https://github.com/tomjuggler/SmartPoi-Firmware) running on the SmartPoi hardware. Older firmware versions do not work with some features

### This project is now Electron capable! Turn it into a native app!!
- from the root directory, run on Linux, Windows or Mac with: 
```
npm install
npm start
```
- to create an executable: 
``` 
npm run dist 
```
*Note: currently only Linux is available, as appimage. I will add Windows and Mac soon*