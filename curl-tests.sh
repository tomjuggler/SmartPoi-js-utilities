# Note: can also work by pasting into a browser url bar (without "curl") and pressing enter

# change pattern: 
# pattern options: 
# 1. on-device computer generated patterns
# 2. images 1-5
# 3. images 1-10
# 4. images 11-20
# 5. images 1-50 (52?)
curl http://192.168.1.1/pattern?patternChooserChange=1
curl http://192.168.1.78/pattern?patternChooserChange=1

# change speed (integer): 
# the time between image changes
# interval is set to 2 seconds by default
# minimum is 0 - converts to half second interval
# maximum is 1800 (half an hour) - any more and re-set to 30min 
curl http://192.168.1.1/intervalChange?interval=2
curl http://192.168.1.78/intervalChange?interval=2

# change brightness (integer): 
# change brightness on the poi
# minimum is 20 - default low brightness
# maximum is 255 
curl http://192.168.1.1/brightness?brt=100
curl http://192.168.1.78/brightness?brt=100


# list all files on device: 
curl http://192.168.1.1/list?dir=/
curl http://192.168.1.78/list?dir=/

# fetch the settings currently on the poi:
# returns in format {RouterName, RouterPassword, APChannel, address1, address2, address3, address4, currentPattern}
# address is for static IP (unused)
# APChannel 1-13
# CurrentPattern: 1-6 (see poi controls)
curl http://192.168.1.1/returnsettings
curl http://192.168.1.78/returnsettings

# get number of pixels (NUM_PX) from poi: 
curl http://192.168.1.1/get-pixels
curl http://192.168.1.78/get-pixels

# get file from poi: 
curl http://192.168.1.1/edit?file=/a.bin --output a.bin # saves to a.bin in current directory
curl http://192.168.1.78/edit?file=/a.bin --output a.bin

# delete file from poi: 
curl -X DELETE 'http://192.168.1.1/edit?path=/x.bin' -H 'Content-Type: application/json'
curl -X DELETE 'http://192.168.1.78/edit?path=/x.bin' -H 'Content-Type: application/json' 

# change the WiFi Channel for AP (1-13, depending on your country. In US don't use 12 or 13!):
# todo: currently this overwrites the Router and Password! 
curl -X POST "http://192.168.1.1/setting" \
-H "Content-Type: application/x-www-form-urlencoded" \
--data-urlencode "channel=6"

# update router settings: 
curl -X POST "http://<ESP8266_IP>/setting" \
-H "Content-Type: application/x-www-form-urlencoded" \
--data-urlencode "ssid=<your_ssid>" \
--data-urlencode "pwd=<your_password>" 

# switch on router mode - do the Auxillary poi first! (only after setting password!): 
curl http://192.168.1.1/router?router=1
curl http://192.168.1.78/router?router=1

# switch off router mode - need to find the poi IP address on the network first: 
curl http://<ESP8266_IP>/router?router=0
curl http://<ESP8266_IP>/router?router=0




