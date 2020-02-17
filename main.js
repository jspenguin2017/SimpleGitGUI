// ----------------------------------------------------------------------------------------------------------------- //

// Simple Git GUI - A simple Git GUI, free and open
// Copyright (C) 2017-2019  Hugo Xu
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// ----------------------------------------------------------------------------------------------------------------- //

// Main process entry point

// ----------------------------------------------------------------------------------------------------------------- //

"use strict";

// ----------------------------------------------------------------------------------------------------------------- //

const DEBUG = false;

// ----------------------------------------------------------------------------------------------------------------- //

const { app, BrowserWindow: win, Menu, ipcMain: ipc, shell } = require("electron");
const path = require("path");
const url = require("url");

// ----------------------------------------------------------------------------------------------------------------- //

ipc.on("console log", (e, data) => {
    console.log(data.log);
});

ipc.on("dev-tools", (e) => {
    e.sender.toggleDevTools();
});

ipc.on("get home", (e) => {
    e.returnValue = app.getPath("home");
});

// ----------------------------------------------------------------------------------------------------------------- //

ipc.on("open project page", (e) => {
    shell.openExternal("https://github.com/jspenguin2017/SimpleGitGUI");
    e.sender.send("open project page done");
});

ipc.on("open folder", (e, data) => {
    shell.openExternal(data.folder);
    e.sender.send("open folder done");
});

ipc.on("show file in folder", (e, data) => {
    shell.showItemInFolder(data.file);
    e.sender.send("show file in folder done");
});

// ----------------------------------------------------------------------------------------------------------------- //

let main;

// TODO: https://github.com/electron/electron/issues/18397
app.allowRendererProcessReuse = true;

if (app.requestSingleInstanceLock()) {
    app.on("ready", () => {
        main = new win({
            height: 700,
            minHeight: 550,
            minWidth: 1250,
            show: false,
            width: 1300,
            webPreferences: {
                backgroundThrottling: false,
                nodeIntegration: true,

                // TODO: Is this needed?
                contextIsolation: false,
            },
        });

        // TODO: Bug in Electron? main.removeMenu() does not work
        Menu.setApplicationMenu(null);

        main.loadURL(url.format({
            pathname: path.join(__dirname, "index.html"),
            protocol: "file:",
            slashes: true,
        }));

        main.once("ready-to-show", () => {
            main.show();
        });

        main.webContents.on("new-window", (e) => {
            e.preventDefault();
            console.warn("WARN: New window blocked, there might be a security bug in the renderer process!");
        });

        main.webContents.on("will-navigate", (e) => {
            e.preventDefault();
            console.warn("WARN: Navigation blocked, there might be a security bug in the renderer process!");
        });

        if (DEBUG)
            main.webContents.openDevTools();
    });

    app.on("second-instance", () => {
        if (main)
            main.focus();
    });

    const remoteBlocker = (e) => {
        e.preventDefault();
        console.warn("WARN: Remote request blocked, there might be a security bug in the renderer process!");
    };

    app.on("remote-get-builtin", remoteBlocker);
    app.on("remote-get-current-web-contents", remoteBlocker);
    app.on("remote-get-current-window", remoteBlocker);
    app.on("remote-get-global", remoteBlocker);
    app.on("remote-get-guest-web-contents", remoteBlocker);
    app.on("remote-require", remoteBlocker);
} else {
    app.quit();
}

// ----------------------------------------------------------------------------------------------------------------- //
