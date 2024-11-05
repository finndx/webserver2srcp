///////////////////////////////////////////////////////////////////
///                                                             ///
///  WEBSERVER2SRCP v1.0.1                                      ///
///  by M.Weck                          Release date: 06.11.24  ///
///                                                             ///
///  StationList can now be used together with FMDX Webservers  ///
///                                                             ///
///  https://github.com/finndx/webserver2srcp                   ///
///                                                             ///
///////////////////////////////////////////////////////////////////

const dgram = require('dgram');
const WebSocket = require('ws');

const DEFAULT_UDP_PORT = 8430; // Default UDP port
const UDP_SERVER_ADDRESS = '127.0.0.1'; // Change to your UDP server address
const DEFAULTWEBSOCKET_URL = '127.0.0.1:8080'; // Default WebSocket server URL

let UDP_PORT = DEFAULT_UDP_PORT; // Initialize UDP_PORT with default value
let WEBSOCKET_URL = `ws://${DEFAULTWEBSOCKET_URL}/text`;
let RECEIVER_TYPE = 'TEF'; // Default receiver type
let DEBUG_MODE = false; // Debug mode flag

// Function to print help instructions
function printHelp() {
    console.log(`WEBSERVER2SRCP v1.0 (c) M.Weck
Usage: node webserver2srcp.js webserver_address:port [options]
Options:
  -u <port>      Set the UDP port (default: ${DEFAULT_UDP_PORT})
  -r <type>      Set the receiver type (default is TEF but enter -r x for XDR)
  -d             Enable debug mode
  -? or /?       Show this help message and exit
`);
}

// Iterate over command line arguments to find the WebSocket URL and receiver type etc.
for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    // Check for help flag
    if (arg === '-?' || arg === '/?') {
        printHelp();
        process.exit(0); // Exit after showing help
    }

    // Check if the argument contains a colon indicating it's a WebSocket URL
    if (arg.includes(':')) {
        WEBSOCKET_URL = `ws://${arg}/text`; // Rebuild the WebSocket URL
    }

    // Check for the receiver type
    if (arg === '-r' && process.argv[i + 1] === 'x') {
        RECEIVER_TYPE = 'XDR';
        i++; // Move to the next argument to skip the 'x'
    }
    // Check for the debug flag
    if (arg === '-d') {
        DEBUG_MODE = true; // Enable debug mode
    }
    // Check for the UDP port
    if (arg === '-u' && process.argv[i + 1]) {
        const udpPortValue = parseInt(process.argv[i + 1], 10); // Read the next argument and parse it as an integer
        if (!isNaN(udpPortValue) && udpPortValue > 0 && udpPortValue <= 65535) {
            UDP_PORT = udpPortValue; // Update UDP_PORT if valid
        } else {
            console.error(`Invalid UDP port value: ${process.argv[i + 1]}. Using default: ${DEFAULT_UDP_PORT}`);
        }
        i++; // Move to the next argument to skip the port value
    }
}

if (DEBUG_MODE) {
    console.log(`WebSocket URL: ${WEBSOCKET_URL}`);
    console.log(`Receiver Type: ${RECEIVER_TYPE}`);
    console.log(`UDP Port: ${UDP_PORT}`);
    console.log(`Debug mode: ${DEBUG_MODE}`);
}

class WebserverSRCP {
    constructor() {
        this.lastCommand = '';
        this.currentFreq = 0;
        this.currentBandwidth = 0;
        this.lastFreq = null; // Track the last sent frequency
        this.lastBandwidth = null; // Track the last sent bandwidth
        this.lastHexPi = '';
        this.lastHexPs = '';
        this.lastRt0 = '';
        this.lastRt1 = '';
        this.lastPty = '';
        this.lastEcc = '';
        this.lastAFString = '';
        this.lastReceivedMessage = '';

        this.websocket = new WebSocket(WEBSOCKET_URL);
        this.udpServer = dgram.createSocket('udp4');

        this.setupWebSocket();
        this.setupUDPServer();

        // Define valid bandwidths based on receiver type
        this.validBandwidths = this.getValidBandwidths();
    }

    getValidBandwidths() {
        if (RECEIVER_TYPE === 'TEF') {
            return [0, 56000, 64000, 72000, 84000, 97000, 114000, 133000, 151000, 184000, 200000, 217000, 236000, 254000, 287000, 311000];
        } else if (RECEIVER_TYPE === 'XDR') {
            return [0, 55000, 73000, 90000, 108000, 125000, 142000, 159000, 177000, 194000, 211000, 229000, 246000, 263000, 281000, 298000, 309000];
        }
        return [];
    }

    setupWebSocket() {
        this.websocket.on('open', () => {
            console.log('WebSocket connection established.\nPress CTRL+C to stop the server.');
        });

        this.websocket.on('message', (message) => {
            this.receiveMessage(message);
        });

        this.websocket.on('close', () => {
            console.log('WebSocket connection closed.');
        });
    }

    setupUDPServer() {
        this.udpServer.on('message', (msg, rinfo) => {
            if (DEBUG_MODE) {
                console.log(`Received UDP message: ${msg}`);
            }
            this.handleIncomingUDPMessage(msg.toString(), rinfo);
        });

        this.udpServer.bind(UDP_PORT, () => {
            console.log(`SRCP UDP Server is ready on port ${UDP_PORT}`);
        });
    }

    receiveMessage(message) {
        if (message !== this.lastReceivedMessage) {
            this.lastReceivedMessage = message;
            if (DEBUG_MODE) {
                console.log(`Received WebSocket message: ${this.lastReceivedMessage}`);
            }
            this.sendUDPMessage(this.lastReceivedMessage);
        }
    }

    sendUDPMessage(msg) {
        const jsonData = JSON.parse(msg);
        const udpMessage = this.constructUDPMessage(jsonData);

        if (udpMessage) {
            const messageBuffer = Buffer.from(udpMessage);
            this.udpServer.send(messageBuffer, UDP_PORT - 1, UDP_SERVER_ADDRESS, (err) => {
                if (err) {
                    console.error(`Failed to send UDP message: ${err.message}`);
                } else {
                    if (DEBUG_MODE) {
                        console.log(`UDP message sent: ${udpMessage}`);
                    }
                }
            });
        }
    }

    // Construct the UDP message based on the JSON data received
    constructUDPMessage(jsonData) {
        let udpMessage = 'from=FMDX-Webserver;';

        // Handle frequency
        if (jsonData.freq) {
            this.currentFreq = Math.round(parseFloat(jsonData.freq) * 1000000);
            if (this.lastFreq !== this.currentFreq) {
                udpMessage += `Freq=${this.currentFreq};`;
                this.lastFreq = this.currentFreq; // Update last sent frequency
                this.lastHexPi = ''; //PI reset for every frequency change
                this.lastPty = ''; //PTY reset for every frequency change
                this.lastEcc = ''; //ECC reset for every frequency change
            }
        }

        // Handle bandwidth
        if (jsonData.bw) {
            this.currentBandwidth = parseInt(jsonData.bw);

            //Bandwidth information for XDR is not in kHz. It requires change first.
            if (RECEIVER_TYPE === 'XDR' && this.currentBandwidth < 16) {
				this.currentBandwidth = this.validBandwidths[this.currentBandwidth + 1];
            }

            if (this.lastBandwidth !== this.currentBandwidth) {
                udpMessage += `bandwidth=${this.currentBandwidth};`;
                this.lastBandwidth = this.currentBandwidth; // Update last sent bandwidth
            }
        }

        // Handle signal strength
        let Sig = 0; // Initialize Sig variable
        if (jsonData.sig !== undefined) {
            Sig = Math.round(parseFloat(jsonData.sig)); // Use 'sig' if it exists
        } else if (jsonData.signal !== undefined) {
            Sig = Math.round(parseFloat(jsonData.signal)); // Use 'signal' if 'sig' does not exist
        }
        udpMessage += `RcvLevel=${Sig};`;

        // Handle RDS PI and PS, add to UDP message if changed
        let hexPi = jsonData.pi || '';
        if (hexPi !== this.lastHexPi && hexPi !== '?') {
            udpMessage += `pi=${hexPi.toUpperCase()};`;
            this.lastHexPi = hexPi;
        }

        let hexPs = this.stringToHex(jsonData.ps || ''); // Convert string to hex
        if (hexPs !== this.lastHexPs) {
            udpMessage += `ps=${hexPs};`;
            this.lastHexPs = hexPs;
        }

        // Handle RDS AF array
        if (Array.isArray(jsonData.af)) {
            let afString = '';
            for (let i = 0; i < jsonData.af.length; i++) {
                const afValue = jsonData.af[i];
                afString += this.intToHex((afValue / 100) - 875, 1);
                if (afString.length >= 50) break; // Limit to 50 characters
            }
            while (afString.length < 50) {
                afString += '00'; // Fill with '00' if less than 50 characters
            }

            // Add to UDP message if changed
            if (afString !== this.lastAFString) {
                udpMessage += `af=${afString.toUpperCase()};`;
                this.lastAFString = afString;
            }
        }

        // Handle RDS PTY and RT
        let hexPty = this.intToHex(jsonData.pty || 0, 1); // Convert pty to hex
        if (hexPty !== this.lastPty) {
            udpMessage += `pty=${hexPty};`;
            this.lastPty = hexPty;
        }

        let hexRt0 = this.stringToHex(this.replaceCharacters(jsonData.rt0 || ''));
        if (hexRt0 !== this.lastRt0) {
            udpMessage += `rt1=${hexRt0};`;
            this.lastRt0 = hexRt0;
        }

        let hexRt1 = this.stringToHex(this.replaceCharacters(jsonData.rt1 || ''));
        if (hexRt1 !== this.lastRt1) {
            udpMessage += `rt2=${hexRt1};`;
            this.lastRt1 = hexRt1;
        }

        // Handle ECC
        if (jsonData.ecc) {
            let hexEcc = this.intToHex(jsonData.ecc || 0, 1); // Convert ecc to hex
            if (hexEcc !== this.lastEcc) {
                udpMessage += `ecc=${hexEcc};`;
                this.lastEcc = hexEcc;
            }
        }

        // Remove semicolon at the end of the string, if it exists
        if (udpMessage.endsWith(';')) {
            udpMessage = udpMessage.slice(0, -1);
        }

        return udpMessage !== 'from=FMDX-Webserver' ? udpMessage : null;
    }

    // Convert a string to its hexadecimal representation
    stringToHex(str) {
        return str.split('').map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    }

    // Convert an integer to its hexadecimal representation with a specified length
    intToHex(value, length) {
        return value.toString(16).padStart(length * 2, '0');
    }

    replaceCharacters(str) {
        // Create a new array to hold the result
        let result = [];

        // Iterate over each character in the string
        for (let i = 0; i < str.length; i++) {
            const charCode = str.charCodeAt(i); // Get the character code

            // Check the character code and replace accordingly
            if (charCode === 0xF6) { // ö
                result.push(String.fromCharCode(0x97)); // Replace with 0x97
            } else if (charCode === 0xE4) { // ä
                result.push(String.fromCharCode(0x91)); // Replace with 0x91
            } else if (charCode === 0xE5) { // å
                result.push(String.fromCharCode(0xF1)); // Replace with 0xF1
            } else if (charCode === 0xD6) { // Ö
                result.push(String.fromCharCode(0xD7)); // Replace with 0xD7
            } else if (charCode === 0xC4) { // Ä
                result.push(String.fromCharCode(0xD1)); // Replace with 0xD1
            } else if (charCode === 0xC5) { // Å
                result.push(String.fromCharCode(0xE1)); // Replace with 0xE1
            } else if (charCode === 0xFC) { // ü
                result.push(String.fromCharCode(0x99)); // Replace with 0x99
            } else if (charCode === 0xDC) { // Ü
                result.push(String.fromCharCode(0xD9)); // Replace with 0xD9
            } else if (charCode === 0xF5) { // õ
                result.push(String.fromCharCode(0x96)); // Replace with 0x96
            } else if (charCode === 0xD5) { // Õ
                result.push(String.fromCharCode(0xE6)); // Replace with 0xE6
            } else if (charCode === 0xE6) { // æ
                result.push(String.fromCharCode(0xF2)); // Replace with 0xF2
            } else if (charCode === 0xC6) { // Æ
                result.push(String.fromCharCode(0xE2)); // Replace with 0xE2
            } else if (charCode === 0xF8) { // ø
                result.push(String.fromCharCode(0xE7)); // Replace with 0xE7
            } else {
                // If no replacement is needed, keep the original character
                result.push(str[i]);
            }
        }

        // Join the result array back into a string
        return result.join('');
    }


    handleIncomingUDPMessage(msg, sender) {
        const queries = msg.split(';').map(query => query.trim()).filter(query => query);
        const responseMessages = [];

        queries.forEach(query => {
            if (query === 'freq=?') {
                responseMessages.push(`freq=${this.currentFreq}`);
            } else if (query === 'bandwidth=?') {
                responseMessages.push(`bandwidth=${this.currentBandwidth}`);
            } else if (query.startsWith('freq=')) {
                const newFreq = parseInt(query.split('=')[1]);
                this.currentFreq = newFreq;
                responseMessages.push(query);
                this.forwardToWebSocket(`T${this.currentFreq / 1000}`);
            } else if (query.startsWith('bandwidth=')) {
                const requestedBandwidth = parseInt(query.split('=')[1]);
                const closestBandwidth = this.getClosestBandwidth(requestedBandwidth);
                if (closestBandwidth !== null) {
                    if (closestBandwidth !== this.currentBandwidth) {
                        this.lastBandwidth = this.currentBandwidth;
                        this.currentBandwidth = closestBandwidth;
                        this.sendBandwidthChangeCommand(closestBandwidth);
                    }
                } else {
                    console.error(`Requested bandwidth ${requestedBandwidth} is not valid for receiver type ${RECEIVER_TYPE}.`);
                }
            }
        });

        if (responseMessages.length > 0) {
            const responseMessage = responseMessages.join(';');
            const messageBuffer = Buffer.from(responseMessage);
            this.udpServer.send(messageBuffer, sender.port, sender.address, (err) => {
                if (err) {
                    console.error(`Failed to send UDP response: ${err.message}`);
                } else {
                    if (DEBUG_MODE) {
                        console.log(`UDP response sent successfully: ${responseMessage}`);
                    }
                }
            });
        }
    }

    getClosestBandwidth(requestedBandwidth) {
        // Find the closest valid bandwidth
        let closest = null;
        let closestDiff = Infinity;

        for (const validBandwidth of this.validBandwidths) {
            const diff = Math.abs(validBandwidth - requestedBandwidth);
            if (diff < closestDiff) {
                closestDiff = diff;
                closest = validBandwidth;
            }
        }

        return closest;
    }

    sendBandwidthChangeCommand(bandwidth) {
        if (RECEIVER_TYPE === 'XDR') {
            // Send command for XDR receiver type
            const index = this.validBandwidths.indexOf(bandwidth) -1;
            this.forwardToWebSocket(`F${index}`); 
        } else if (RECEIVER_TYPE === 'TEF') {
            // Send command for TEF receiver type
            this.forwardToWebSocket(`W${bandwidth}`);
        }
    }

    forwardToWebSocket(command) {
        if (this.websocket.readyState === WebSocket.OPEN) {
            if (command !== this.lastCommand) {
                this.websocket.send(command);
                this.lastCommand = command;
                if (DEBUG_MODE) {
                    console.log(`Forwarded to WebSocket: ${command}`);
                }
            }
        } else {
            console.error('WebSocket communicator not initialized.');
        }
    }
}

// Start the WebserverSRCP
new WebserverSRCP();
