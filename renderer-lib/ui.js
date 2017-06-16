//The user interface library for the renderer process
//This file should be loaded with script tag
"use strict";

/**
 * The user interface library main namespace.
 * @var {Object}
 */
var UI = {};

//UI.processing() and UI.isProcessing
(() => {
    //This variable saves the current processing image state, this is used when toggling between the two processing image
    let processingImageFlag = false;
    /**
     * The current processing state, true for busy and false for idle.
     * @var {boolean}
     */
    UI.isProcessing = null;
    /**
     * Show or hide processing screen.
     * window.onProcessingEnds() will be called when hidding the processing screen.
     * @function
     * @param {boolean} isProcessing - True to show the processing screen, false to hide.
     */
    UI.processing = (isProcessing) => {
        //Check if the current state is the supplied state
        if (isProcessing !== UI.isProcessing) {
            //It is not, proceed
            //Update current state flag
            UI.isProcessing = isProcessing;
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
            //When processing ends, refresh the icon of current repository
            if (!isProcessing) {
                window.onProcessingEnds();
            }
        }
        //Ignore if current state is the same as the supplied state
    };
})();
/**
 * Show a generic dialog box.
 * This will hide processing screen.
 * @function
 * @param {string} title - The title of the dialog box.
 * @param {string} message - The body of the dialog box, must be a safe HTML string.
 * @param {boolean} isError - Set this to true to make the title red.
 */
UI.dialog = (title, message, isError) => {
    //Hide processing screen
    UI.processing(false);
    //Update DOM
    $("#modal-dialog-title").text(title).css("color", isError ? "red" : "#333");
    $("#modal-dialog-body").html(message);
    //Set size of code
    $("#modal-dialog-pre").css("max-height", $(document.body).height() - 240);
    //Show modal
    $("#modal-dialog").modal("show");
};
/**
 * Update button availability, true for disable, false for active.
 * @function
 * @param {Any} action - Supply a boolean to update action buttons availability, supply anything else to keep the availability as-is.
 * @param {Any} management - Supply a boolean to update management buttons availability, supply anything else to keep the availability as-is.
 */
UI.buttons = (() => {
    let currentAction = null;
    let currentManagement = null;
    return (action, management) => {
        if (typeof action === "boolean" && action !== currentAction) {
            currentAction = action;
            $(".btn-action").prop("disabled", action);
        }
        if (typeof management === "boolean" && management !== currentManagement) {
            currentManagement = management;
            $(".btn-management").prop("disabled", management);
        }
    };
})();
/**
 * Redraw repositories list.
 * @function
 * @param {Array.<string>} directories - Directories of repositories.
 * @param {DOMSpan} - A dictionary containing icons where the keys are directories of matching repository.
 * @param {string} active - The directory of the active repository.
 * @param {Function} switchCallback - This function will be called when the user clicks on a repository, the directory of the repository will be supplied.
 */
UI.repos = (directories, icons, active, switchCallback) => {
    //Empty repositories list
    $("#div-repos-list").empty();
    //Add repositories to the list one by one
    for (let i = 0; i < directories.length; i++) {
        const index = Math.max(directories[i].lastIndexOf("/"), directories[i].lastIndexOf("\\"));
        //The last folder name will be shown on the button, directory will be saved in jQuery data
        let elem = $(`<button type="button" class="list-group-item repos-list-btn-switch-repo"></button>`)
            .append(icons[directories[i]])
            .append(document.createTextNode(" " + directories[i].substring(index + 1)))
            .data("directory", directories[i]);
        //Check and set active state
        if (directories[i] === active) {
            elem.addClass("active");
        }
        //Add to list
        $("#div-repos-list").append(elem);
    }
    //Bind click event handler
    $(".repos-list-btn-switch-repo").click(function () {
        //Update active selection
        $(this).addClass("active").siblings().removeClass("active");
        switchCallback($(this).data("directory"));
    });
};
/**
 * Redraw branches list.
 * @function
 * @param {Array.<string>} data - Raw branches data from git.branches().
 * @param {Function} switchCallback - This function will be called when the user clicks on a branch, the name of the branch will be supplied.
 */
UI.branches = (() => {
    const isHead = /\/HEAD -> .*\//;
    return (data, switchCallback) => {
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
            let elem = $(`<button type="button" class="list-group-item"></button>`).text(names[i]).data("name", names[i]);
            //Branch containing "/HEAD -> /" is special and is not clickable, the active branch is also not clickable
            if (isHead.test(elem.text()) || names[i] === active) {
                elem.addClass("disabled");
            } else {
                elem.addClass("btn-action branches-list-btn-switch-branch");
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
})();
/**
 * Redraw changed files list.
 * @function
 * @param {Array.<string>} data - Raw branches data from git.diff().
 * @param {Function} rollbackCallback - This function will be called when the user click on the Rollback button of a file, the file name will be supplied.
 * @param {Function} diffCallback - This function will be called when the user click on the Difference button of a file, the file name will be supplied.
 * @param {Function} viewCallback - This function will be called when the user click on the View button of a file, the file name will be supplied.
 */
UI.diffTable = (data, rollbackCallback, diffCallback, viewCallback) => {
    //Parse data
    let changedFiles = [];
    for (let i = 0; i < data.length; i++) {
        //Skip empty lines
        if (!data[i]) {
            continue;
        }
        //Get changed file's name
        let file = data[i].substring(2).trim();
        //In case of rename, the file name would be like `file1 -> file2` or `"file 1" -> "file 2"` if the file name contains space
        //Assuming ">" is not a valid character for file name, even though ">" along with new line and backspace are allowed on Linux
        //Hopefully everyone will follow the best practice
        let index = file.indexOf(" -> ");
        if (index > -1) {
            //Taking the second file to be the shown file name
            file = file.substring(index + 4);
        }
        //Remove redundant double quote
        if (file.startsWith("\"")) {
            file = file.slice(1, -1);
        }
        //Prepare file object, Git will always use "/"
        index = file.lastIndexOf("/");
        let name, directory;
        if (index === -1) {
            name = file;
            directory = "/";
        } else {
            name = file.slice(index).substring(1);
            directory = file.substring(0, index);
        }
        let File = {
            fullName: file, //This is used when calling callback
            name: name, //This is shown in File Name column
            directory: directory, //This is shown in Directory column
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
