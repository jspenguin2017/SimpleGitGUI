# Simple Git GUI

[![Dependencies](https://david-dm.org/jspenguin2017/SimpleGitGUI.svg)](https://david-dm.org/jspenguin2017/SimpleGitGUI)

![Main Window](http://i.imgur.com/fqhp5IG.png)

This software aims at doing exactly what you want, even though the user interface looks simple, 
you need some understanding of Git to use it. Make sure that you know what you are clicking, or bad things will happen. 

`F5` can be used to reload the renderer process when it is not busy, and `F12` to open DevTools. 

When there is an error, the raw error message will be shown, there could be times when you need to use the command line tool 
to fix the problem. 

This software will make reasonable effort to validate configuration data that is saved in the LocalStorage, 
but there could be times when you need to use DevTools to fix damaged configuration data. 

All the commands that will be executed in the background are in `renderer-lib/git.js`. 

Please open an issue if there is something you want me to know. 

## Installation

1. Install [Git](https://git-scm.com/downloads). 
2. Install [Node.js](https://nodejs.org/en/). 
3. Install Electron by running this command: `npm install --global electron`. 
4. Download source code from this repository as `.zip`, extract it, and run `electron .` in the extracted folder. 

Note: Double-click-to-start scripts are available: `START.BAT` for Windows and `START.SH` for Linux. 

## Credits

Files under `images` are created from [loading.io](https://loading.io/). 

Spellcheck dictionary `renderer-lib/debian.dict-8.7.txt` is extracted from [Debian operating system](https://www.debian.org/). 
