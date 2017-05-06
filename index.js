//The renderer process
"use strict";

//=====Variables=====
let lastPath, name, email, savePW;

//=====Initialization=====
//Load Electron
const {ipcRenderer: ipc, clipboard} = require("electron");
//Load utilities
const path = require("path");
//Shortcut keys
$(document).on("keyup", (e) => {
    //For some reason, function keys can only be captured on keyup
    if (e.which === 123) {
        //F12: DevTools
        ipc.send("dev-tools");
    } else if (e.which === 116) {
        //F5: Reload if not busy
        if (!UI.isBusy()) {
            location.reload();
        }
    }
});
//Warn the user about the console
console.log("%cPlease be careful of what you execute in the console, this console has access to your local file system. ", "color: red; font-size: large;");
//Change the height of main container to be an offset of body height on resize
$(window).resize(() => {
    $("#main-container").height($(document.body).height() - 90);
});
//Set height for the first time
$(window).trigger("resize");

//=====Left Menu Buttons=====
//Push button
$("#push").click(() => {
    UI.onceProcessingEnd(() => {
        if ($("#changes-table").children().length) {
            $("#git-push-modal").modal("show");
        } else {
            $("#git-push-no-file-modal").modal("show");
        }
    });
    //Make sure no files are changed
    $("#refresh").click();
});
//Push confirm button
$("#git-push, #git-push-anyway").click(() => {
    UI.processing(true);
    let msg = $("#push-comment").val().split("\n");
    if (!msg.length) {
        msg = ["No commit comment. "];
    }
    ipc.send("push", {
        msg: msg
    });
});
//Refresh button
$("#refresh").click(() => {
    UI.processing(true);
    ipc.send("refresh");
});
//Auto refresh when window focuses
$(window).focus(() => {
    //Don't refresh if anything is open, or if we can't refresh
    if (!($(".modal").is(":visible") || $("#refresh").prop("disabled"))) {
        $("#refresh").click();
    }
});
//Status button
$("#status").click(() => {
    ipc.send("status");
});

//=====Right Menu Buttons=====
//Clone button
$("#clone").click(() => {
    //Check clipboard
    const data = clipboard.readText("plain/text");
    if ((/\.git$/).test(data)) {
        $("#git-clone-address").val(data).trigger("keyup");
    }
    //Show modal
    $("#git-clone-modal").modal("show");
});
//Auto-fill directory
$("#git-clone-address").on("keyup", () => {
    const parts = $("#git-clone-address").val().split("/");
    const match = (parts[parts.length - 1]).split(".");
    if (match.length > 1) {
        try {
            $("#git-clone-directory").val(path.join(lastPath, match[match.length - 2]));
        } catch (err) {
            console.warn("Failed to auto fill directory, error message: ");
            console.log(err.toString());
        }
    }
});
//The other clone button
$("#git-clone").click(() => {
    UI.processing(true);
    ipc.send("clone", {
        address: $("#git-clone-address").val(),
        directory: $("#git-clone-directory").val()
    });
});
//Delete button
$("#delete").click(() => {
    $("#delete-modal").modal("show");
});
//Delete confirm
$("#delete-yes").click(() => {
    UI.processing(true);
    ipc.send("delete");
});
//Config button
$("#config").click(() => {
    $("#config-name").val(name);
    $("#config-email").val(email);
    $("#config-savePW").prop("checked", savePW);
    $("#config-modal").modal("show");
});
//Config save button
$("#config-save").click(() => {
    UI.processing(true);
    ipc.send("config", {
        name: $("#config-name").val(),
        email: $("#config-email").val(),
        savePW: $("#config-savePW").is(":checked")
    })
});

//=====Event Handlers=====
//Draw buttons
ipc.on("draw buttons", (e, data) => {
    UI.buttons(data.group1, data.group2);
});
//Draw repos list
ipc.on("draw repos", (e, data) => {
    UI.repos(data.names, data.active, (index) => {
        UI.processing(true);
        //Repo click, switch to it
        ipc.send("switch repo", {
            index: index
        });
    });
});
//Draw branches list
ipc.on("draw branches", (e, data) => {
    UI.branches(data.names, data.active);
});
//Draw changed file list
ipc.on("draw changes", (e, data) => {
    UI.changes(data.data);
});
//Dialog handler
ipc.on("dialog", (e, data) => {
    UI.processing(false);
    UI.dialog(data.title, data.msg);
});
//Error handler
ipc.on("error", (e, data) => {
    UI.processing(false);
    console.warn("Error message: ");
    console.log(data.log);
    UI.dialog(data.title, data.msg, true);
});
//Fatal error handler
ipc.on("fatal error", (e, data) => {
    console.warn("Error message: ");
    console.log(data.log);
    UI.dialog(data.title, data.msg, true, true);
});
//Hide load screen
ipc.on("ready", (e, data) => {
    lastPath = data.lastPath;
    name = data.name;
    email = data.email;
    savePW = data.savePW;
    UI.processing(false);
});

//=====Finalization=====
//Tell main process that we are ready
ipc.send("ready");
