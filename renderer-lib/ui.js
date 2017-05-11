//The user interface library for the renderer process
"use strict";

/**
 * The user interface library main namespace.
 * @var {Object}
 */
var UI = {};

/**
 * Show or hide processing screen.
 * @function
 * @param {boolean} isProcessing - True to show the processing screen, false to hide.
 */
let processingImageFlag = false; //This is used to toggle between two processing image
let currentProcessingState = null; //Sometimes this function can be called twice with the same processing state, we do not want to toggle processing image in this case
UI.processing = function (isProcessing) {
    //Check if the current state is the supplied state
    if (currentProcessingState !== isProcessing) {
        //It is not, proceed
        //Update current state flag
        currentProcessingState = isProcessing;
        //Show modal
        $("#modal-processing-screen").modal(isProcessing ? "show" : "hide");
        //Toggle processing image
        if (isProcessing) {
            //Toggle visibility
            if (processingImageFlag) {
                $("#modal-processing-screen-img-1").hide();
                $("#modal-processing-screen-img-2").show();
            } else {
                $("#modal-processing-screen-img-1").show();
                $("#modal-processing-screen-img-2").hide();
            }
            //Flip flag
            processingImageFlag = !processingImageFlag;
        }
    }
};
/**
 * Get current processing state.
 * @function
 * @returns {boolean} The current processing state, true for processing, false for idle.
 */
UI.isBusy = function () {
    return currentProcessingState;
};
/**
 * Show a generic dialog box.
 * This will hide processing screen.
 * @function
 * @param {string} title - The title of the dialog box.
 * @param {string} message - The body of the dialog box.
 * @param {boolean} isError - Set this to true to make the title red.
 */
UI.dialog = function (title, message, isError) {
    //Hide processing screen
    UI.processing(false);
    //Update DOM and show modal
    $("#modal-dialog-title").text(title).css("color", isError ? "red" : "#333333");
    $("#modal-dialog-body").html(message);
    $("#modal-dialog").modal("show");
    //Trigger resize once in case this dialog is used to show code
    $(window).trigger("resize");
};

//Update buttons disable state, false for disable
UI.buttons = function (action, management) {
    if (typeof action === "boolean") {
        $(".btn-action").prop("disabled", !action);
    }
    if (typeof management === "boolean") {
        $(".btn-management").prop("disabled", !management);
    }
};

//Redraw repos list, a "No Repository" place holder will be set if names is empty
UI.repos = function (directories, active, switchCallback) {
    //Redraw repos list
    $("#div-repos-list").empty();
    for (let i = 0; i < directories.length; i++) {
        let elem = $(`<button type="button" class="list-group-item repos-list-btn-switch-repo"></button>`).text(directories[i].split(/\/|\\/).pop()).data("name", directories[i]);
        if (directories[i] === active) {
            elem.addClass("active");
        }
        $("#div-repos-list").append(elem);
    }
    //Bind event handler
    $(".repos-list-btn-switch-repo").click(function () {
        switchCallback($(this).data("name"));
    });
};

//Redraw branches list
UI.branches = function (data, switchCallback) {
    //Parse data
    let active;
    let names = [];
    for (let i = 0; i < data.length; i++) {
        if (data[i].startsWith("*")) {
            data[i] = data[i].substring(1);
            active = data[i].trim();
        }
        let temp = data[i].trim();
        temp && names.push(temp);
    }
    //Draw branches list
    $("#div-branches-list").empty();
    for (let i = 0; i < names.length; i++) {
        let elem = $(`<button type="button" class="list-group-item btn-action branches-list-btn-switch-branch"></button>`).text(names[i]).data("name", names[i]);
        if ((/\/HEAD\ \-\>\ .*\//).test(elem.text()) || names[i] === active) {
            elem.removeClass("btn-action branches-list-btn-switch-branch").addClass("disabled");
        }
        if (names[i] === active) {
            elem.addClass("active");
        }
        $("#div-branches-list").append(elem);
    }
    //Bind event handler
    $(".branches-list-btn-switch-branch").click(function () {
        switchCallback($(this).data("name"));
    });
};

//Redraw diff table
UI.diffTable = function (data, rollbackCallback, diffCallback, viewCallback) {
    //Parse it
    let changedFiles = [];
    for (let i = 0; i < data.length; i++) {
        if (!data[i]) {
            //Skip empty lines
            continue;
        }
        //Get changed file name
        let file = data[i].substring(2).trim().split("/");
        //Remove redundant double quote
        if ((file[0]).startsWith("\"")) {
            file[0] = (file[0]).substring(1);
        }
        if ((file[file.length - 1]).endsWith("\"")) {
            file[file.length - 1] = (file[file.length - 1]).substring(0, file[file.length - 1].length - 1);
        }
        let File = {
            fullName: file.join("/"),
            name: file.pop(),
            directory: "/" + file.join("/"),
            state: []
        };
        for (let j = 0; j < 2; j++) {
            switch (data[i].charAt(j)) {
                case " ":
                    File.state.push("Unchanged");
                    break;
                case "A":
                    File.state.push("Created");
                    break;
                case "M":
                    File.state.push("Changed");
                    break;
                case "D":
                    File.state.push("Deleted");
                    break;
                case "R":
                    File.state.push("Renamed");
                    break;
                case "C":
                    File.state.push("Copied");
                    break;
                case "U":
                    File.state.push("Unmerged");
                    break;
                case "?":
                    File.state.push("Untracked");
                    break;
                default:
                    File.state.push(`UNKNOWN: ${files[i].charAt(j)}`);
                    break;
            }
        }
        changedFiles.push(File);
    }
    //Redraw the table
    $("#tbody-diff-table").empty();
    for (let i = 0; i < changedFiles.length; i++) {
        const row = changedFiles[i];
        $("#tbody-diff-table").append($("<tr>").append(
            $("<td>").text(row.name),
            $("<td>").text(row.directory),
            $("<td>").text(row.state[0]),
            $("<td>").text(row.state[1]),
            $("<td>").append(
                $(`<button type="button" class="btn btn-danger btn-group1 diff-table-btn-file-rollback"><span class="glyphicon glyphicon-repeat"></span> Rollback</button>`).data("file", row.fullName),
                $(`<button type="button" class="btn btn-primary btn-group1 diff-table-btn-file-diff"><span class="glyphicon glyphicon-list-alt"></span> Difference</button>`).data("file", row.fullName),
                $(`<button type="button" class="btn btn-success btn-group1 diff-table-btn-file-view"><span class="glyphicon glyphicon-folder-open"></span> View</button>`).data("file", row.fullName)
            )
        ));
    }
    //Bind event handlers
    $(".diff-table-btn-file-rollback").click(function () {
        rollbackCallback($(this).data("file"));
    });
    $(".diff-table-btn-file-diff").click(function () {
        diffCallback($(this).data("file"));
    });
    $(".diff-table-btn-file-view").click(function () {
        viewCallback($(this).data("file"));
    });
};
