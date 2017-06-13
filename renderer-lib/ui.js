//The user interface library for the renderer process
//This file should be loaded with script tag
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
//This variable saves the current processing image state, this is used when toggling between the two processing image
let processingImageFlag = false;
//This variable saves the current processing state, it is also used in UI.isProcessing()
let currentProcessingState = null;
UI.processing = function (isProcessing) {
    //Check if the current state is the supplied state
    if (currentProcessingState !== isProcessing) {
        //It is not, proceed
        //Update current state flag
        currentProcessingState = isProcessing;
        //Show modal
        $("#modal-processing-screen").modal(isProcessing ? "show" : "hide");
        //Toggle processing image only when showing the screen, or the user will always see the same one
        if (isProcessing) {
            if (processingImageFlag) {
                $("#modal-processing-screen-img-1").hide();
                $("#modal-processing-screen-img-2").show();
            } else {
                $("#modal-processing-screen-img-1").show();
                $("#modal-processing-screen-img-2").hide();
            }
            //Flip the flag
            processingImageFlag = !processingImageFlag;
        }
    }
    //Ignore if current state is the same as the supplied state
};
/**
 * Get current processing state.
 * @function
 * @returns {boolean} The current processing state, true for processing, false for idle.
 */
UI.isProcessing = function () {
    return currentProcessingState;
};
/**
 * Show a generic dialog box.
 * This will hide processing screen.
 * @function
 * @param {string} title - The title of the dialog box.
 * @param {string} message - The body of the dialog box, must be a safe HTML string.
 * @param {boolean} isError - Set this to true to make the title red.
 */
UI.dialog = function (title, message, isError) {
    //Hide processing screen
    UI.processing(false);
    //Update DOM
    $("#modal-dialog-title").text(title).css("color", isError ? "red" : "#333333");
    $("#modal-dialog-body").html(message);
    //Trigger resize once in case this dialog is used to show code
    $(window).trigger("resize");
    //Show modal
    $("#modal-dialog").modal("show");
};
/**
 * Update button availability, true for active, false for diabled.
 * @function
 * @param {*} action - Supply a boolean to update action buttons availability, supply anything else to keep the availability as-is.
 * @param {*} management - Supply a boolean to update management buttons availability, supply anything else to keep the availability as-is.
 */
UI.buttons = function (action, management) {
    if (typeof action === "boolean") {
        $(".btn-action").prop("disabled", !action);
    }
    if (typeof management === "boolean") {
        $(".btn-management").prop("disabled", !management);
    }
};
/**
 * Redraw repositories list.
 * @function
 * @param {Array.<string>} directories - Directories of repositories.
 * @param {string} active - The directory of the active repository.
 * @param {Function} switchCallback - This function will be called when the user clicks on a repository, the directory of the repository will be supplied.
 */
UI.repos = function (directories, active, switchCallback) {
    //Empty repositories list
    $("#div-repos-list").empty();
    //Add repositories to the list one by one
    for (let i = 0; i < directories.length; i++) {
        //The last folder name will be shown on the button, directory will be saved in jQuery data
        let elem = $(`<button type="button" class="list-group-item repos-list-btn-switch-repo"></button>`).text(directories[i].split(/\/|\\/).pop()).data("directory", directories[i]);
        //Check and set active state
        if (directories[i] === active) {
            elem.addClass("active");
        }
        //Add to list
        $("#div-repos-list").append(elem);
    }
    //Bind click event handler
    $(".repos-list-btn-switch-repo").click(function () {
        switchCallback($(this).data("directory"));
    });
};
/**
 * Redraw branches list.
 * @function
 * @param {Array.<string>} data - Raw branches data from git.branches().
 * @param {Function} switchCallback - This function will be called when the user clicks on a branch, the name of the branch will be supplied.
 */
UI.branches = function (data, switchCallback) {
    //Parse data
    let names = [];
    let active;
    for (let i = 0; i < data.length; i++) {
        //Active branch starts with a star, we want to set the button as active, but not show the star
        if (data[i].startsWith("*")) {
            data[i] = data[i].substring(1);
            active = data[i].trim();
        }
        //Trim off excess white space and add to array
        let temp = data[i].trim();
        temp && names.push(temp);
    }
    //Empty branches list
    $("#div-branches-list").empty();
    //Add branches to the list one by one
    for (let i = 0; i < names.length; i++) {
        //The name will be shown as-is (almost, white space trimmed) on the button, this (trimmed) name will also be saved in jQuery data
        let elem = $(`<button type="button" class="list-group-item btn-action branches-list-btn-switch-branch"></button>`).text(names[i]).data("name", names[i]);
        //Branch containing "/HEAD -> /" is special and is not clickable, the active branch is also not clickable
        if ((/\/HEAD\ \-\>\ .*\//).test(elem.text()) || names[i] === active) {
            elem.removeClass("btn-action branches-list-btn-switch-branch").addClass("disabled");
        }
        //Check and set active state
        if (names[i] === active) {
            elem.addClass("active");
        }
        //Add to list
        $("#div-branches-list").append(elem);
    }
    //Bind click event handler
    $(".branches-list-btn-switch-branch").click(function () {
        switchCallback($(this).data("name"));
    });
};
/**
 * Redraw changed files list.
 * @function
 * @param {Array.<string>} data - Raw branches data from git.diff().
 * @param {Function} rollbackCallback - This function will be called when the user click on the Rollback button of a file, the file name will be supplied.
 * @param {Function} diffCallback - This function will be called when the user click on the Difference button of a file, the file name will be supplied.
 * @param {Function} viewCallback - This function will be called when the user click on the View button of a file, the file name will be supplied.
 */
UI.diffTable = function (data, rollbackCallback, diffCallback, viewCallback) {
    //Parse data
    let changedFiles = [];
    for (let i = 0; i < data.length; i++) {
        //Skip empty lines
        if (!data[i]) {
            continue;
        }
        //Get changed file's name
        let file = data[i].substring(2).trim();
        //In case of rename, the file name would be like `file1 -> file2`
        //In case of file name with space: `"file 1" -> "file 2"`
        //Assuming ">" is not a valid character for file name
        if (file.includes(" -> ")) {
            //Taking the second file to be the shown file name
            file = file.split(" -> ")[1].split("/");
        } else {
            file = file.split("/");
        }
        //Remove redundant double quote
        if ((file[0]).startsWith("\"")) {
            file[0] = (file[0]).substring(1);
        }
        if ((file[file.length - 1]).endsWith("\"")) {
            file[file.length - 1] = (file[file.length - 1]).substring(0, file[file.length - 1].length - 1);
        }
        //Prepare file object
        let File = {
            fullName: file.join("/"), //This is used when calling callback
            name: file.pop(), //This is shown in File Name column
            directory: file.join("/") || "/", //This is shown in Directory column
            state: [] //[Remote, Local] state, will be shown in the appropriate column
        };
        //Add state
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
                    //This should not happen
                    File.state.push(`UNKNOWN: ${files[i].charAt(j)}`);
                    break;
            }
        }
        //Add the file object to the array
        changedFiles.push(File);
    }
    //Empty the changed files list
    $("#tbody-diff-table").empty();
    //Add changed files to the list one by one
    for (let i = 0; i < changedFiles.length; i++) {
        const row = changedFiles[i];
        //Add the entry to the list
        $("#tbody-diff-table").append($("<tr>").append(
            $("<td>").text(row.name), //File Name column
            $("<td>").text(row.directory), //Directory column
            $("<td>").text(row.state[0]), //Remote (state) column
            $("<td>").text(row.state[1]), //Local (state) column
            $("<td>").append( //Actions (buttons) column
                //These buttons will have the full name of the file saved in data
                $(`<button type="button" class="btn btn-danger btn-group1 diff-table-btn-file-rollback"><span class="glyphicon glyphicon-repeat"></span> Rollback</button>`).data("file", row.fullName),
                $(`<button type="button" class="btn btn-primary btn-group1 diff-table-btn-file-diff"><span class="glyphicon glyphicon-list-alt"></span> Difference</button>`).data("file", row.fullName),
                $(`<button type="button" class="btn btn-success btn-group1 diff-table-btn-file-view"><span class="glyphicon glyphicon-folder-open"></span> View</button>`).data("file", row.fullName)
            )
        ));
    }
    //Bind click event handlers
    $(".diff-table-btn-file-rollback").click(function () { //Rollback button
        rollbackCallback($(this).data("file"));
    });
    $(".diff-table-btn-file-diff").click(function () { //Difference button
        diffCallback($(this).data("file"));
    });
    $(".diff-table-btn-file-view").click(function () { //View button
        viewCallback($(this).data("file"));
    });
};
