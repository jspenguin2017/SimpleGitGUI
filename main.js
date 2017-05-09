//The main process
"use strict";

//=====Load Modules=====
//Load Electron
const {app, BrowserWindow: win, ipcMain: ipc, dialog, shell} = require("electron");
//Load utilities
const path = require("path");
const url = require("url");

//=====Some events that needs main process=====
//Dump executed code onto the terminal
ipc.on("console log", (e, data) => {
    console.log(data.log);
});
//DevTools shortcut keys
ipc.on("dev-tools", (e) => {
    //Toggle DevTools
    e.sender.toggleDevTools();
});
//Get home address
ipc.on("get home", (e) => {
    e.returnValue = app.getPath("home");
});
//Open projct page
ipc.on("open project page", (e) => {
    shell.openExternal("https://github.com/jspenguin2017/SimpleGitGUI");
    e.sender.send("open project page done");
});
//Open folder
ipc.on("open folder", (e, data) => {
    shell.openExternal(data.folder);
    e.sender.send("open folder done");
});
//Show file in folder
ipc.on("show file in folder", (e, data) => {
    shell.showItemInFolder(data.file);
    e.sender.send("show file in folder done");
});

//=====Main=====
//Create window
let main;
app.on("ready", () => {
    //Init window
    main = new win({
        width: 1300,
        height: 700,
        minHeight: 525,
        minWidth: 1050
    });
    //Remove menu
    main.setMenu(null);
    //Set URL
    main.loadURL(url.format({
        pathname: path.join(__dirname, "index.html"),
        protocol: "file",
        slashes: true
    }));
    //Handle exit
    main.on("closed", () => {
        app.quit();
    });
    //Debug only
    //main.webContents.openDevTools();
});
