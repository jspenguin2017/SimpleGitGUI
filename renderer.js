//The renderer process
"use strict";

//=====Variables=====
//These are used to render the UI, other configurations are handled by the main script
let lastPath, name, email, savePW;

//=====Initialization=====
//Show processing screen
$("#modal-processing-screen").modal("show");
//Load Electron and utilities
const {ipcRenderer: ipc, clipboard} = require("electron");
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
    $("#div-main-container").height($(document.body).height() - 90);
    //Make file table scroll
    $("#tbody-diff-table").css("max-height", $(document.body).height() - 150);
});
//Set height for the first time
$(window).trigger("resize");
//Project page
window.openProjectPage = function () {
    ipc.send("open project page");
};

//=====Left Menu Buttons=====
//===Force Pull===
$("#btn-menu-hard-reset").click(() => {
    $("#modal-hard-reset-input-confirm").val("");
    $("#modal-hard-reset").modal("show");
});
//===Pull===
$("#btn-menu-pull").click(() => {
    //Refresh and see if there are any changed files, they need to be committed before pulling
    UI.onceProcessingEnds(() => {
        if ($("#tbody-diff-table").children().length) {
            $("#modal-pull-need-commit").modal("show");
        } else {
            $("#modal-pull").modal("show");
        }
    });
    $("#btn-menu-refresh").click();
});
//===Sync===
$("#btn-menu-sync").click(() => {
    //We need to check whether we need to show commit message box
    UI.onceProcessingEnds(() => {
        if ($("#tbody-diff-table").children().length) {
            $("#modal-sync-div-need-commit, #modal-sync-commit-sync").show();
            $("#modal-sync-btn-sync").hide();
        } else {
            $("#modal-sync-div-need-commit, #modal-sync-commit-sync").hide();
            $("#modal-sync-btn-sync").show();
        }
        //Show modal
        $("#modal-sync").modal("show");
    });
    //Make sure no files are changed
    $("#btn-menu-refresh").click();
});
//===Push===
$("#btn-menu-push").click(() => {
    UI.onceProcessingEnds(() => {
        if ($("#tbody-diff-table").children().length) {
            $("#modal-push").modal("show");
        } else {
            ipc.send("push only");
        }
    });
    //Make sure no files are changed
    $("#btn-menu-refresh").click();
});
//Auto focus comment box
$("#modal-push").on("shown.bs.modal", () => {
    $("#modal-push-input-commit-message").focus();
});
//Push confirm button
$("#modal-push-btn-push").click(() => {
    UI.processing(true);
    let msg = $("#modal-push-input-commit-message").val().split("\n");
    //Clear the text box for next push
    $("#modal-push-input-commit-message").val("");
    //Check if message is not empty
    let hasMsg = false;
    for (let i = 0; i < msg.length; i++) {
        if ((msg[i]).length) {
            hasMsg = true;
            break;
        }
    }
    if (!hasMsg) {
        msg = ["No commit message. "];
    }
    //Push
    ipc.send("push", {
        msg: msg
    });
});
//===Force Push===
$("#btn-menu-force-push").click(() => {
    //Refresh and see if there are any changed files, they need to be committed before force pushing
    UI.onceProcessingEnds(() => {
        if ($("#tbody-diff-table").children().length) {
            $("#modal-force-push-need-commit").modal("show");
        } else {
            $("#modal-force-push").modal("show");
        }
    });
    $("#btn-menu-refresh").click();
});
//===Refresh===
$("#btn-menu-refresh").click(() => {
    UI.processing(true);
    ipc.send("refresh");
});
//Auto refresh when window focuses
$(window).focus(() => {
    //Don't refresh if anything is open, or if we can't refresh
    if (!($(".modal").is(":visible") || $("#btn-menu-refresh").prop("disabled"))) {
        $("#btn-menu-refresh").click();
    }
});
//===Status===
$("#btn-menu-status").click(() => {
    ipc.send("status");
});

//=====Right Menu Buttons=====
//===Clone===
$("#btn-menu-clone").click(() => {
    //Check clipboard
    const data = clipboard.readText("plain/text");
    if ((/\.git$/).test(data)) {
        $("#modal-clone-input-address").val(data).trigger("keyup");
    }
    //Show modal
    $("#modal-clone").modal("show");
});
//Auto-fill directory
$("#modal-clone-input-address").on("keyup", () => {
    const parts = $("#modal-clone-input-address").val().split("/");
    const match = (parts[parts.length - 1]).split(".");
    if (match.length > 1) {
        try {
            $("#modal-clone-input-directory").val(path.join(lastPath, match[match.length - 2]));
        } catch (err) {
            console.warn("Failed to auto fill directory, error message: ");
            console.log(err.toString());
        }
    }
});
//Clone confirm button
$("#modal-clone-btn-clone").click(() => {
    UI.processing(true);
    ipc.send("clone", {
        address: $("#modal-clone-input-address").val(),
        directory: $("#modal-clone-input-directory").val()
    });
});
//===Delete===
$("#btn-menu-delete-repo").click(() => {
    $("#modal-delete-repo").modal("show");
});
//Delete confirm
$("#modal-delete-repo-btn-confirm").click(() => {
    UI.processing(true);
    ipc.send("delete");
});
//===Config===
$("#btn-menu-config").click(() => {
    $("#modal-config-input-name").val(name);
    $("#modal-config-input-email").val(email);
    $("#modal-config-input-savePW").prop("checked", savePW);
    $("#modal-config").modal("show");
});
//Config save button
$("#modal-config-btn-save").click(() => {
    UI.processing(true);
    ipc.send("config", {
        name: $("#modal-config-input-name").val(),
        email: $("#modal-config-input-email").val(),
        savePW: $("#modal-config-input-savePW").is(":checked")
    })
});

//=====Other=====
//===Switching Repo===
//UI.repos will bind this
const switchRepo = function (index) {
    UI.processing(true);
    ipc.send("switch repo", {
        index: index
    });
};
//===Switch Branch===
const switchBranch = function () {
    //TODO!
    alert("Branch switching is not yet implemented. ");
};
//===Rollback A File===
const rollback = function (file) {
    //TODO!
    alert("File rollback is not yet implemented. ");
};
//===View File Diff===
//UI.diffTable will bind this
const viewDiff = function (file) {
    UI.processing(true);
    ipc.send("show diff", {
        file: file
    });
};
//===Show Conflict Help===
$("#modal-pull-btn-conflict-help, #modal-sync-btn-conflict-help").click(() => {
    $("#modal-conflict-help").modal("show");
});

//=====Event Handlers=====
//===Message Box===
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
//Ready, hide load screen
ipc.on("ready", (e, data) => {
    lastPath = data.lastPath;
    name = data.name;
    email = data.email;
    savePW = data.savePW;
    UI.processing(false);
});
//===Drawing===
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
    UI.branches(data.names, data.active, switchBranch);
});
//Draw diff table
ipc.on("draw diff", (e, data) => {
    UI.diffTable(data.data, rollback, viewDiff);
});

//=====Finalization=====
//Tell main process that we are ready
ipc.send("ready");
