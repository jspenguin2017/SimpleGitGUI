//The renderer process
"use strict";

//=====Variables=====
let lastPath, name, email, savePW;

//=====Initialization=====
//Show load screen
$("#loading-modal").modal("show");
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
    //Resize main container
    $("#main-container").height($(document.body).height() - 90);
    //Make code box scroll
    $("pre").css("max-height", $(document.body).height() - 250);
    //Make push help section scroll
    $("#git-push-help").css("max-height", $(document.body).height() - 200);
});
//Set height for the first time
$(window).trigger("resize");
//Project page
window.openProjectPage = function () {
    ipc.send("open project page");
};

//=====Left Menu Buttons=====
//Pull button
$("#pull").click(() => {
    $("#git-pull-modal").modal("show");
});
//Pull merge button
$("#git-pull-merge").click(() => {
    UI.processing(true);
    ipc.send("pull", {
        mode: "merge"
    });
});
//Pull rebase button
$("#git-pull-rebase").click(() => {
    UI.processing(true);
    ipc.send("pull", {
        mode: "rebase"
    });
});
//Push button
$("#push").click(() => {
    UI.onceProcessingEnd(() => {
        if ($("#diff-table").children().length) {
            $("#git-push-modal").modal("show");
        } else {
            $("#git-push-no-file-modal").modal("show");
        }
    });
    //Make sure no files are changed
    $("#refresh").click();
});
//Auto focus comment box
$("#git-push-modal").on("shown.bs.modal", () => {
    $("#push-comment").focus();
});
//Push confirm button
$("#git-push, #git-push-anyway").click(() => {
    UI.processing(true);
    let msg = $("#push-comment").val().split("\n");
    //Clear the text box for next push
    $("#push-comment").val("");
    //Check if message is not empty
    let msgGood = false;
    for (let i = 0; i > msg.length; i++) {
        if ((msg[i]).length) {
            msgGood = true;
            break;
        }
    }
    if (!msgGood) {
        msg = ["No commit comment. "];
    }
    //Push
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

//=====Main Panel Functionalities=====
//Switching repo, UI.repos will bind this
const switchRepo = function (index) {
    UI.processing(true);
    ipc.send("switch repo", {
        index: index
    });
};
//Rollback a file
const rollback = function (file) {
    //TODO!
    console.log(`Rollback for ${file} clicked. `);
};
//View file diff, UI.diffTable will bind this
const viewDiff = function (file) {
    UI.processing(true);
    ipc.send("show diff", {
        file: file
    });
};

//=====Event Handlers=====
//Draw buttons
ipc.on("draw buttons", (e, data) => {
    UI.buttons(data.group1, data.group2);
});
//Draw repos list
ipc.on("draw repos", (e, data) => {
    UI.repos(data.names, data.active, switchRepo);
});
//Draw branches list
ipc.on("draw branches", (e, data) => {
    UI.branches(data.names, data.active);
});
//Draw diff table
ipc.on("draw diff", (e, data) => {
    UI.diffTable(data.data, rollback, viewDiff);
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

//TODO: push with no file changed should directly trigger push only
