# webserver2srcp
A utility for creating a local SRCP UDP server for connecting StationList to the FMDX Webserver.

### Pre-requisites:
* Node.js. This was chosen because the FMDX Webserver is also running with this environment.
* StationList Software

### Usage:

```
node webserver2srcp.js webserver_address:port [options]
```

```
Options:
  -u <port>      Set the UDP port (default: 8430)
  -r <type>      Set the receiver type (default is TEF but enter -r x for XDR)
  -d             Enable debug mode
  -? or /?       Show this help message and exit
```

Webserver's address and port are the same that you're using for connecting to the selected FMDX Webserver. For all of the available public FMDX Webservers, see [servers.fmdx.org](https://servers.fmdx.org/). If the port info is omitted, you can try for the commonly used ports 8080 or 80.

In case, you're using your own FMDX Webserver with the default settings running locally on the same machine, you do not need to enter the webserver_address:port part of the command. The script is using 127.0.0.1:8080 as default.

> [!NOTE]
> If you're using Webserver2srcp locally for your own FMDX Webserver and the machine running the FMDX Webserver is the same, please use 127.0.0.1:<your webserver port&gt; for accessing the websocket data endpoint instead of localhost:<your webserver port&gt; or any other possible ip-address because **this way your use of the StationList and Webserver2srcp isn't counted as an additional user for your own Webserver**.

> [!TIP]
> The default UDP Port to be created for StationList is 8430. If you want to have it on other port, you need to define it manually with the -u switch. If you want it to be running on port 8555 for example, please add `-u 8555` option to your command.

> [!CAUTION]
> Bandwidth handlind is implemented in a different way for TEF and XDR receivers. If you're using Webserver2srcp with a Sony XDR receiver unit, be sure to set also the receiver type with the `-r x` option. For a TEF receiver you don't need to add anything - it is a default.

### Short instructions for downloading and setting up StationList

Download [StationList](https://zeiterfassung.3sdesign.de/station_list.htm#download) software from it's provider's web site. You can run StationList.exe without any separate installation procedure. However this software supports multiple instances, each of them having it's own configuration without interfering the others.

Configuring these separate instances may sound troublesome especially if you want to use many of them, each one separately for different FMDX Webservers. Each instance is defined by a command line parameter for starting up StationList (`instance=n`). Each instance has it's own settings.

From the StationList's menu select: Edit -> Edit Settings

![StationList's basic settings.](/images/stationlist_settings.png)

For basic usage, you should define the following settings:

* My QTH Geo-Coordinates: set your latitude (the north–south position) and longitude (the east–west position)
* Visual Logbook: set your myFM OMID and email address
* SRCP Radio Adr:Port
* Program Title
> [!IMPORTANT]
> Your SRCP Radio Adr:Port is `127.0.0.1:8430` if your're running Webserver2srcp and Stationlist on the same machine and using Webserver2srcp's default UDP port 8430. If you have something different then make changes accordingly. You can use `localhost`in place of `127.0.0.1` if you want to.

It is good to write a program title that describes well the receiver you're using with this configuration.

### First steps of using StationList

Take a look at StationList's user manual from the program's main menu: ? - > Help. However, this help file is an old style .CHM file. If you can't get it open right away, you'll need to search for the instructions elsewhere how to open the file (StationList.chm).

When the settings are ready, you can start using StationList. Now together with Webserver2srcp and the selected FMDX Webserver this is done by these steps:

1. **Open the selected FMDX Webserver**
2. **Put the Webserver2srcp.js script running.** Remember to enter the same webserver_address:port parameters as with the chosen FMDX Webserver.
  It should state that the SRCP UDP Server is ready on port 8430 (or another one if you defined it differently). It should also say that the WebSocket connection is established.
3. Open the StationList software if it isn't running already.
  **Now it is the right time to turn the receiver control and tracking on.** This is done by selecting the corresponding line in the File menu: File -> Control via SRCP

You can open the Kanal-Selector and RDS windows either from the Edit menu or by hotkeys, Ctrl+K for the Kanal selector and Ctrl+D for the RDS window.

If everything's OK, you should see the received RDS in the RDS window and StationList is also tracking down the tuned frequency. You can also change the frequency using the Kanal-Selektor. If the remote receiver supports bandwidth setting and you've chosen the correct receiver type for the Webserver2srcp script, it is also possible to change the bandwidth setting with the bandwidth slider.

> [!IMPORTANT]
> Before making any logs to FMLIST, please remember to select the propagation type correctly Edit -> Edit Logs -> Rcv-Mode -> (make your selection). Logging is done by selecting the desired station entry from the list by Ctrl+right mouse button clicking and selecting "Post this log to Visual Logbook" from the opened additional menu.

At the time when you're done, you can stop the Webserver2srcp.js script by pressing CTRL+C.
