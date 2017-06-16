//The main process
"use strict";

/**
 * Load modules.
 * @const {Module}
 */
const { app, BrowserWindow: win, ipcMain: ipc, dialog, shell } = require("electron");
const path = require("path");
const url = require("url");

//=====Special Events=====
//These events needs to be handled by the main process
//Dump executed code and output to the terminal
ipc.on("console log", (e, data) => {
    console.log(data.log);
});
//Shortcut key F12, toggle DevTools
ipc.on("dev-tools", (e) => {
    e.sender.toggleDevTools();
});
//Returns the home directory, this is needed when creating default configuration object
ipc.on("get home", (e) => {
    e.returnValue = app.getPath("home");
});
//These next 3 event handlers will send back a done message so the renderer hides processing screen
//Project page link in Config modal, open the project page in default browser
ipc.on("open project page", (e) => {
    shell.openExternal("https://github.com/jspenguin2017/SimpleGitGUI");
    e.sender.send("open project page done");
});
//Clicking the repository that is already active, open its directory
ipc.on("open folder", (e, data) => {
    shell.openExternal(data.folder);
    e.sender.send("open folder done");
});
//Clicking View button of a changed file, show it in file explorer
//Electron will attempt to select the file in question, but that seem to not work on Windows
ipc.on("show file in folder", (e, data) => {
    shell.showItemInFolder(data.file);
    e.sender.send("show file in folder done");
});

//=====Main=====
/**
 * The main window.
 * @const {BrowserWindow}
 */
let main;
app.on("ready", () => {
    //Create window
    main = new win({
        width: 1300,
        height: 700,
        minHeight: 550,
        minWidth: 1250
    });
    //Remove menu
    main.setMenu(null);
    //Load main window
    main.loadURL(url.format({
        pathname: path.join(__dirname, "index.html"),
        protocol: "file:",
        slashes: true
    }));
    //Handle exit
    main.on("closed", () => {
        app.quit();
    });
    //This will open DevTools when the main window loads, this helps in debugging the renderer when it does not work at all, uncomment as needed
    //main.webContents.openDevTools();
});
