# Simple Git GUI

![Main Window](http://i.imgur.com/1mn59YC.png)

This software aims at doing exactly what you want, even though the user interface looks simple, you need some understanding of Git to use it. Make sure that you know what you are clicking, or bad things will happen. 

When there is an error, the raw error message will be shown. There could be times when you need to use the command line tool to fix the problem. 

All the commands that will be executed in the background are in `renderer-lib/git.js`. 

Please open an issue if there is something you want me to know. 

## Installation

1. Install [Git](https://git-scm.com/downloads). 
2. Install [Node.js](https://nodejs.org/en/). 
3. Install Electron by running this command: `npm install --global electron`. 
4. Download source code from this repository as `.zip`, extract it, and run `electron .` in the extracted folder. 

Note: A double-click-to-start script is available: `START.BAT` for Windows and `START.SH` for Linux. 

## Credits

Files under `images` are created from [https://loading.io/](https://loading.io/). 


### TODO

1. Change clone auto fill directory to RegExp
2. Test new repo unique id logic
3. Test new git.js output log logic
4. finish commenting other files
