# Simple Git GUI [![Dependencies](https://david-dm.org/jspenguin2017/SimpleGitGUI.svg)](https://david-dm.org/jspenguin2017/SimpleGitGUI)

![Main Window](https://i.imgur.com/VaeQ2Qm.png)

This software aims at doing exactly what you want, even though the user interface looks simple, 
you need some understanding of Git to use it. Make sure that you know what you are clicking, or bad things will happen. 

The window cannot be closed when the renderer is busy, but you can always press `F12` to bring up DevTools to fix it if 
it gets stuck. Also, `F5` can be used to reload the renderer process when it is not busy. 

When there is an error, the raw error message will be shown, there could be times when you need to use the command line tool 
to fix the problem. 

This software will make reasonable effort to validate configuration data that is saved in the LocalStorage, 
but there could be times when you need to use DevTools to fix damaged configuration data. 

All the commands that will be executed in the background are in `renderer-lib/git.js`. 

The launcher for Windows is built with Visual Studio 2017. 

Please open an issue if there is something you want me to know. 

## Installation

1. Install [Git](https://git-scm.com/downloads). 
2. Install [Node.js](https://nodejs.org/en/). 
3. Whitelist `.js` file type in your anti-virus software. 
4. Download all files from this repository to a folder by any convenient method then run `npm install` in it. 

For Linux: 
1. Configure your file explorer to execute scripts when double clicked. 
2. Double click on `Launcher.sh` to start. 

For Windows: 
1. Double click on `Launcher.exe` to start. 

Note: These launchers simply execute `npm start` without showing the terminal window. 

## Credits

Files under `images` are created from [loading.io](https://loading.io/). 

Spellcheck dictionary `renderer-lib/debian.dict-8.7.txt` is extracted from [Debian operating system](https://www.debian.org/). 
