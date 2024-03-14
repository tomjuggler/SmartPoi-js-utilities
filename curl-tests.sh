# Note: can also work by pasting into a browser url bar (without "curl") and pressing enter

# switch on router mode: 
curl http://192.168.1.1/router?router=0
curl http://192.168.1.78/router?router=0

# switch off router mode: 
curl http://192.168.1.1/router?router=1
curl http://192.168.1.78/router?router=1

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

# list settings (for router mode and more): 
# returns router-name, router-password, WiFi channel, ip address (on router), pattern
curl http://192.168.1.1/returnsettings
curl http://192.168.1.78/returnsettings 

# get file from poi: 
curl http://192.168.1.1/edit?file=/a.bin --output a.bin # saves to a.bin in current directory
curl http://192.168.1.78/edit?file=/a.bin --output a.bin

# delete file from poi: 
curl -X DELETE 'http://192.168.1.1/edit?path=/x.bin' -H 'Content-Type: application/json'
curl -X DELETE 'http://192.168.1.78/edit?path=/x.bin' -H 'Content-Type: application/json' 
