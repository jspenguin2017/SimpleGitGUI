# Simple Git GUI [![Dependencies](https://david-dm.org/jspenguin2017/SimpleGitGUI.svg)](https://david-dm.org/jspenguin2017/SimpleGitGUI)

[![NPM](https://nodei.co/npm/simple-git-gui.png)](https://nodei.co/npm/simple-git-gui/)

A simple Git GUI, free and open

![Main Window](https://i.imgur.com/xNvBA5b.png)

Please open an issue if there is something you want me to know.

## Install from GitHub

1. Install [Git](https://git-scm.com/downloads)
2. Install [Node.js](https://nodejs.org/en/)
3. Download all files from this repository to a folder by any convenient method
   then run `npm install` in it
4. Use Launcher to start

## Install from NPM

1. Install [Git](https://git-scm.com/downloads)
2. Run `npm install -g simple-git-gui`
3. Run `simple-git-gui` to start

## Other details

You need some understanding of Git before starting. Make sure that you know
what you are clicking, or bad things will happen.

Once every 5 minutes, one repository will be fetched in the background, and the
icon beside the repository's name will reflect the status of the repository
(need pull, need push, etc.). This will be done in order, repositories that are
not active will be fetched as well.

Main window cannot be closed when the renderer is busy. If the renderer gets
stuck, you can press `F12` to bring up DevTools to correct the problem.

If the renderer is not busy, you can press `F5` to reload it.

The renderer is considered busy if it is showing the processing screen or
fetching changes in the background.

If you try to close the window when background fetching is in progress, the
processing screen will show and the window will close as soon as fetching
finishes.

When there is an error, the raw error message will be shown, there could be
times when you need to use the command line tool to correct the problem.

Reasonable effort will be made to validate configuration data that is saved in
the LocalStorage, but there could be times when you need to use DevTools to
correct damaged configuration data.

Do not start more than one instance.

All the commands that will be executed in the background are in
`renderer-lib/git.js`.

The source code for Launcher is available
[here](https://github.com/jspenguin2017/ElectronLauncher).

## Credits

Files under `images` are created from [loading.io](https://loading.io/).

Spellcheck dictionary `vendor/debian.dict-8.7.txt` is extracted from
[Debian operating system](https://www.debian.org/).
