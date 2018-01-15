# Simple Git GUI [![Dependencies](https://david-dm.org/jspenguin2017/SimpleGitGUI.svg)](https://david-dm.org/jspenguin2017/SimpleGitGUI)

A simple Git GUI, free and open

![Main Window](https://i.imgur.com/xNvBA5b.png)

This software aims at doing exactly what you want, even though the user interface looks simple, 
you need some understanding of Git to use it. Make sure that you know what you are clicking, or bad things will happen. 

Once every 5 minutes, one repository will be fetched in the background, and the icon beside the repository's name will reflect 
the status of the repository. This will be done in order, repositories that are not active will be fetched as well. 

The window cannot be closed when the renderer is busy, but you can always press `F12` to bring up DevTools to fix it if 
it gets stuck. Also, `F5` can be used to reload the renderer when it is not busy. The renderer is considered busy if it 
is showing the processing screen or fetching changes in the background. If you try to close the window when background fetching 
is in progress, then the window will close as soon as fetching finishes. 

When there is an error, the raw error message will be shown, there could be times when you need to use the command line tool 
to fix the problem. 

Reasonable effort will be made to validate configuration data that is saved in the LocalStorage, but there could be times 
when you need to use DevTools to fix damaged configuration data. Do not start more than one instance of this software. 

All the commands that will be executed in the background are in `renderer-lib/git.js`. 

The source code for Launcher is available [here](https://github.com/jspenguin2017/ElectronLauncher). 

Please open an issue if there is something you want me to know. 

## Install from GitHub

1. Install [Git](https://git-scm.com/downloads). 
2. Install [Node.js](https://nodejs.org/en/). 
3. Download all files from this repository to a folder by any convenient method then run `npm install` in it. 
4. Use Launcher to start this software. 

## Install from NPM

1. Run `npm install -g simple-git-gui`. 
2. Run `simple-git-gui` to start this software. 

## Credits

Files under `images` are created from [loading.io](https://loading.io/). 

Spellcheck dictionary `renderer-lib/debian.dict-8.7.txt` is extracted from [Debian operating system](https://www.debian.org/). 
