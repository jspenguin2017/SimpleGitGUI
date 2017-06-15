//The renderer process
"use strict";

//Show processing screen
UI.processing(true);

//=====Load Modules=====
//Electron
const { ipcRenderer: ipc, clipboard, webFrame } = require("electron");
//Utilities and libraries
const path = require("path");
const git = require("./renderer-lib/git.js");

//=====Helper Functions=====
/**
 * Do binary search on an array.
 * This is significantly faster than Array.prototype.indexOf() for large sorted arrays.
 * @function
 * @param {Array} array - The array to search from, it needs to be sorted.
 * @param {string} key - The item we are looking for.
 * @returns {integer} The index of the element, or -1 if it is not in the array.
 */
const binSearch = (array, key) => {
    //Initialize variables
    let lower = 0; //Lower bound
    let upper = array.length - 1; //Upper bound
    let i; //Current index, this will be set later
    let elem; //Current element
    //Start binary search
    while (lower <= upper) {
        //Set current index to be the middle between lower and upper bound, floored
        i = (lower + upper) / 2 | 0;
        //Get current element
        elem = array[i];
        //Compare the element and update bound
        if (elem < key) {
            //Element is in the second half
            lower = i + 1;
        } else if (elem > key) {
            //Element is in the first half
            upper = i - 1;
        } else {
            //We found it
            return i;
        }
    }
    //Lower bond passed upper bond, meaning the element is not in the array
    return -1;
};
/**
 * Escape and colorize code.
 * @function
 * @param {string} code - The code to show.
 * @param {bool} [noColor=false] - Set this to true to not colorize code.
 * @returns {string} The HTML string that is ready to be inserted to DOM.
 */
const codify = (code, noColor) => {
    //Escape HTML, & and < are the only ones we need to worry about since it will be wrapped in <pre>
    code = code.replace(/\&/g, "&amp;").replace(/\</g, "&lt;");
    //Color each line
    if (!noColor) {
        let lines = code.split("\n");
        for (let i = 0; i < lines.length; i++) {
            if ((lines[i]).startsWith("+")) {
                //Addition
                lines[i] = `<span class="code-add">${lines[i]}</span>`;
            } else if ((lines[i]).startsWith("-")) {
                //Removal
                lines[i] = `<span class="code-remove">${lines[i]}</span>`;
            } else if ((lines[i]).startsWith("@")) {
                //Section header
                lines[i] = `<span class="code-section">${lines[i]}</span>`;
            }
        }
        code = lines.join("\n");
    }
    //Return the code
    return `<pre>${code}</pre>`;
};
/**
 * Get commit message.
 * @function
 * @returns {Array.<string>} Lines of commit message, a default message will be returned if the user has not enter any message.
 */
const getCommitMsg = () => {
    //Read commit message
    let msg = $("#modal-commit-input-commit-message").val().split("\n");
    //Clear the text box for next commit
    $("#modal-commit-input-commit-message").val("");
    //Check if message empty
    let hasMsg = false;
    for (let i = 0; i < msg.length; i++) {
        if (msg[i].trim().length) {
            hasMsg = true;
            break;
        }
    }
    //Set in default commit message if the user did not write one
    if (!hasMsg) {
        msg = ["No commit message"];
    }
    //Return the message
    return msg;
};
/**
 * Switch to or refresh a repository.
 * Will open the directory of the repository if the repository is already active.
 * This function can be an event handler or can be called directly.
 * @function
 * @param {string} directory - The directory of the repository, there must be a valid JSON string stored in LocalStorage with this directory being the key.
 * @param {bool} [doRefresh=false] - Set this to true to do a refresh regardless whether or not the repository is already active, this will also prevent the directory from opening.
 * @listens $(".repos-list-btn-switch-repo").click
 */
const switchRepo = (directory, doRefresh) => {
    //Show processing screen 
    UI.processing(true);
    //Check what should we do
    if (directory === config.active && !doRefresh) {
        //Open the directory of the repository
        ipc.once("open folder done", () => {
            //Hide processing screen once the directory is opened
            UI.processing(false);
        })
        //Ask main process to open the directory
        ipc.send("open folder", {
            folder: activeRepo.directory
        });
    } else {
        //Load or refresh the repository
        //Load the repository JSON
        let tempRepo = JSON.parse(localStorage.getItem(directory));
        activeRepo = {
            address: tempRepo.address.toString(),
            directory: tempRepo.directory.toString()
        };
        //Update configuration
        config.active = activeRepo.directory;
        //Save configuration
        localStorage.setItem("config", JSON.stringify(config));
        //Update screen
        //Redraw repos list to update the active selection
        UI.repos(config.repos, icons, config.active, switchRepo);
        //Clear branches list and changed files list
        UI.branches([], switchBranch);
        UI.diffTable([], rollbackCallback, diffCallback, viewCallback);
        //Load or refresh branches and changed files list for this repository
        //Branches
        git.branches(activeRepo.directory, (output, hasError, data) => {
            //Dump output to the terminal
            ipc.send("console log", { log: output });
            //Check if it succeeded
            if (hasError) {
                //There is an error, disable action buttons and show error
                UI.buttons(false, true);
                UI.dialog("Something went wrong when loading branches...", codify(output, true), true);
            } else {
                //Succeed, draw branches
                UI.branches(data, switchBranch);
                //Load changed files
                git.diff(activeRepo.directory, (output, hasError, data) => {
                    //Dump output to the terminal
                    ipc.send("console log", { log: output });
                    //Check if it succeeded
                    if (hasError) {
                        //There is an error, disable action buttons and show error
                        UI.buttons(false, true);
                        UI.dialog("Something went wrong when loading file changes...", codify(output, true), true);
                    } else {
                        //Succeed, enable all buttons and draw changed files list
                        UI.buttons(true, true);
                        UI.diffTable(data, rollbackCallback, diffCallback, viewCallback);
                        //Hide processing screen
                        UI.processing(false);
                    }
                });
            }
        });
    }
};
/**
 * Show switch branch confirm modal.
 * @function
 * @listens $(".branches-list-btn-switch-branch").click
 */
const switchBranch = (name) => {
    //Fill in the branch to switch to
    $("#modal-switch-branch-pre-branch").text(name.split("/").pop());
    //Set delete button visibility, only show for local branches
    if (name.includes("/")) {
        //Remote branch
        $("#modal-switch-branch-btn-delete").hide();
    } else {
        $("#modal-switch-branch-btn-delete").show();
    }
    //Show modal
    $("#modal-switch-branch").modal("show");
};
/**
 * Show file rollback confirm modal.
 * @function
 * @listens $(".diff-table-btn-file-rollback").click
 */
const rollbackCallback = (file) => {
    //Fill in the file to rollback
    $("#modal-rollback-pre-file-name").text(file);
    //Show modal
    $("#modal-rollback").modal("show");
};
/**
 * Show file difference.
 * @function
 * @listens $(".diff-table-btn-file-diff").click
 */
const diffCallback = (file) => {
    //This function uses similar logic as switchRepo() refresh part, detailed comments are available there
    UI.processing(true);
    git.fileDiff(activeRepo.directory, file, (output, hasError, data) => {
        ipc.send("console log", { log: output });
        if (hasError) {
            UI.dialog("Something went wrong when loading difference...", codify(output, true), true);
        } else {
            //Show colored file difference using the general purpose modal
            UI.dialog("File Difference", codify(data.join("\n")));
        }
    });
};
/**
 * Show the file in file explorer.
 * @function
 * @listens $(".diff-table-btn-file-view").click
 */
const viewCallback = (file) => {
    //This function uses similar logic as switchRepo() open directory part, detailed comments are available there
    UI.processing(true);
    ipc.once("show file in folder done", () => {
        UI.processing(false);
    });
    ipc.send("show file in folder", {
        file: (activeRepo.directory + "/" + file)
    });
};

//=====Menu Buttons=====
//This section will only include initializing and showing modals
//Force pull (hard reset)
$("#btn-menu-hard-reset").click(() => {
    //To make sure this will not be triggered accidentally, the input box will be cleared
    $("#modal-hard-reset-input-confirm").val("");
    //Generate and show directory removal command
    $("#modal-hard-reset-pre-rm-code").text(git.forcePullCmd(activeRepo.directory));
    //Show the modal
    $("#modal-hard-reset").modal("show");
});
//Pull
$("#btn-menu-pull").click(() => {
    $("#modal-pull").modal("show");
});
//Synchronize
$("#btn-menu-sync").click(() => {
    $("#modal-sync").modal("show");
});
//Commit
$("#btn-menu-commit").click(() => {
    $("#modal-commit").modal("show");
});
//Push will not have a modal
//Force Push
$("#btn-menu-force-push").click(() => {
    //Similar to force pull (hard reset), clear the text box
    $("#modal-force-push-input-confirm").val("");
    $("#modal-force-push").modal("show");
});
//Refresh will not have a modal
//Status will not have a modal
//Import
$("#btn-menu-import").click(() => {
    $("#modal-import").modal("show");
});
//Clone
$("#btn-menu-clone").click(() => {
    //Auto fill address
    const data = clipboard.readText("plain/text");
    if ((/\.git$/).test(data)) {
        //Simply set the address in the address box, then trigger another event handler that will take care of it
        $("#modal-clone-input-address").val(data).trigger("keyup");
    }
    $("#modal-clone").modal("show");
});
//Delete
$("#btn-menu-delete-repo").click(() => {
    $("#modal-delete-repo").modal("show");
});
//Configuration
$("#btn-menu-config").click(() => {
    //Fill in current configuration, this will rollback changes the user made before clicking Cancel
    $("#modal-config-input-name").val(config.name);
    $("#modal-config-input-email").val(config.email);
    $("#modal-config-input-savePW").prop("checked", config.savePW);
    $("#modal-config").modal("show");
});

//=====Other Events=====
//Force pull (hard reset) confirmation button
$("#modal-hard-reset-input-confirm").on("keyup", () => {
    //Check if "confirm" is typed
    if ($("#modal-hard-reset-input-confirm").val() === "confirm") {
        //Show processing screen and hide force pull (hard reset) confirmation modal
        UI.processing(true);
        $("#modal-hard-reset-input-confirm").val("");
        $("#modal-hard-reset").modal("hide");
        //This part uses similar logic as switchRepo() refresh part, detailed comments are available there
        git.forcePull(activeRepo.directory, activeRepo.address, (output, hasError) => {
            ipc.send("console log", { log: output });
            if (hasError) {
                UI.dialog("Something went wrong when force pulling...", codify(output, true), true);
            } else {
                switchRepo(config.active, true);
            }
        });
    }
});
//Pull confirmation button
$("#modal-pull-btn-pull").click(() => {
    //This function uses similar logic as switchRepo() refresh part, detailed comments are available there
    UI.processing(true);
    git.pull(activeRepo.directory, (output, hasError) => {
        ipc.send("console log", { log: output });
        if (hasError) {
            UI.dialog("Something went wrong when pulling...", codify(output, true), true);
        } else {
            switchRepo(config.active, true);
        }
    });
});
//Synchronize confirmation button
$("#modal-sync-btn-sync").click(() => {
    //This function uses similar logic as switchRepo() refresh part, detailed comments are available there
    //We had to copy this since we cannot chain button clicks
    UI.processing(true);
    git.pull(activeRepo.directory, (output, hasError) => {
        ipc.send("console log", { log: output });
        if (hasError) {
            UI.dialog("Something went wrong when pulling...", codify(output, true), true);
        } else {
            git.push(activeRepo.directory, (output, hasError) => {
                ipc.send("console log", { log: output });
                if (hasError) {
                    UI.dialog("Something went wrong when pushing...", codify(output, true), true);
                } else {
                    switchRepo(config.active, true);
                }
            });
        }
    });
});
//Commit only (no push) confirmation button
$("#modal-commit-btn-commit").click(() => {
    //This function uses similar logic as switchRepo() refresh part, detailed comments are available there
    UI.processing(true);
    git.commit(activeRepo.directory, getCommitMsg(), (output, hasError) => {
        ipc.send("console log", { log: output });
        if (hasError) {
            UI.dialog("Something went wrong when committing...", codify(output, true), true);
        } else {
            switchRepo(config.active, true);
        }
    });
});
//Commit then push confirmation button
$("#modal-commit-btn-commit-push").click(() => {
    //This function uses similar logic as switchRepo() refresh part, detailed comments are available there
    //Same as synchronize confirmation button click event handler, we had to copy the code due to not being able to chain button clicks
    UI.processing(true);
    git.commit(activeRepo.directory, getCommitMsg(), (output, hasError) => {
        ipc.send("console log", { log: output });
        if (hasError) {
            UI.dialog("Something went wrong when committing...", codify(output, true), true);
        } else {
            git.push(activeRepo.directory, (output, hasError) => {
                ipc.send("console log", { log: output });
                if (hasError) {
                    UI.dialog("Something went wrong when pushing...", codify(output, true), true);
                } else {
                    switchRepo(config.active, true);
                }
            });
        }
    });
});
//Commit modal text box auto-focus
$("#modal-commit").on("shown.bs.modal", () => {
    $("#modal-commit-input-commit-message").focus();
});
//Push confirmation
$("#btn-menu-push").click(() => {
    //This function uses similar logic as switchRepo() refresh part, detailed comments are available there
    UI.processing(true);
    git.push(activeRepo.directory, (output, hasError) => {
        ipc.send("console log", { log: output });
        if (hasError) {
            UI.dialog("Something went wrong when pushing...", codify(output, true), true);
        } else {
            UI.processing(false);
        }
    });
});
//Force push confirmation textbox
$("#modal-force-push-input-confirm").on("keyup", () => {
    //This function uses similar logic as force pull (hard reset) confirmation handler, detailed comments are available there
    if ($("#modal-force-push-input-confirm").val() === "confirm") {
        UI.processing(true);
        $("#modal-force-push-input-confirm").val("");
        $("#modal-force-push").modal("hide");
        //We need the name of the current branch, just find it from branches list
        //Force push button should be disabled if branches list did not load
        git.forcePush(activeRepo.directory, $("#div-branches-list").find(".active").text(), (output, hasError) => {
            ipc.send("console log", { log: output });
            if (hasError) {
                UI.dialog("Something went wrong when force pushing...", codify(output, true), true);
            } else {
                UI.processing(false);
            }
        });
    }
});
//Refresh button
$("#btn-menu-refresh").click(() => {
    //Simply call switchRepo() with doRefresh flag
    switchRepo(config.active, true);
});
//Auto-refresh when window gain focus
$(window).focus(() => {
    //Do not refresh if we are busy, or if there is no repository
    if (!$(".modal").is(":visible") && !$("#btn-menu-refresh").prop("disabled")) {
        switchRepo(config.active, true);
    }
});
//Status button
$("#btn-menu-repo-status").click(() => {
    //This function uses similar logic as switchRepo() refresh part, detailed comments are available there
    UI.processing(true);
    git.status(activeRepo.directory, (output, hasError, data) => {
        ipc.send("console log", { log: output });
        if (hasError) {
            UI.dialog("Something went wrong when loading status...", codify(output, true), true);
        } else {
            UI.dialog("Repository Status", codify(data.join("\n"), true));
        }
    });
});
//Import confirmation button
$("#modal-import-btn-import").click(() => {
    //Show processing screen
    UI.processing(true);
    //Create a temporary repository profile so we can call JSON.stringify on it
    let tempRepo = {
        address: $("#modal-import-input-address").val(),
        directory: $("#modal-import-input-directory").val()
    };
    //Update configuration
    config.repos.push(tempRepo.directory);
    //Add icon
    icons[tempRepo.directory] = $(`<span>`).addClass("glyphicon glyphicon-refresh");
    //Keep repositories in order
    config.repos.sort();
    config.active = tempRepo.directory;
    //Save configuration
    localStorage.setItem(tempRepo.directory, JSON.stringify(tempRepo));
    localStorage.setItem("config", JSON.stringify(config));
    //Enable management buttons, ations buttons will be handled by switchRepo
    UI.buttons(null, true);
    //Redraw repositories list
    UI.repos(config.repos, icons, config.active, switchRepo);
    //Switch to the new repository
    switchRepo(tempRepo.directory, true);
    //Clear inputs
    $("#modal-import-input-address").val("");
    $("#modal-import-input-directory").val("");
});
//Auto-fill clone directory
$("#modal-clone-input-address").on("keyup", () => {
    //The name of the directory would be the text between the last / and .git
    const match = $("#modal-clone-input-address").val().match(/([^/]*)\.git$/);
    if (match) {
        $("#modal-clone-input-directory").val(path.join(config.lastPath, match.pop()));
    }
});
//Clone confirmation button
$("#modal-clone-btn-clone").click(() => {
    //Show processing screen
    UI.processing(true);
    //Create a temporary repository profile and see if cloning succeed, it will be saved it later if cloning succeed
    //Every repository will look like this, and saved in LocalStorage with directory being the key
    let tempRepo = {
        address: $("#modal-clone-input-address").val(),
        directory: $("#modal-clone-input-directory").val()
    };
    //Clone the repository
    git.clone(tempRepo.directory, tempRepo.address, (output, hasError) => {
        //Dump output to the terminal
        ipc.send("console log", { log: output });
        //Check if it succeeded
        if (hasError) {
            //There is an error, show it
            UI.dialog("Something went wrong when cloning...", codify(output, true), true);
        } else {
            //Succeed, update configuration
            config.repos.push(tempRepo.directory);
            //Add icon
            icons[tempRepo.directory] = $(`<span>`).addClass("glyphicon glyphicon-refresh");
            //Keep repositories in order
            config.repos.sort();
            //Clone directory auto-fill will be done using the parent directory of this repository next time
            config.lastPath = path.resolve(tempRepo.directory, "..");
            config.active = tempRepo.directory;
            //Save configuration
            localStorage.setItem(tempRepo.directory, JSON.stringify(tempRepo));
            localStorage.setItem("config", JSON.stringify(config));
            //Enable management buttons, ations buttons will be handled by switchRepo
            UI.buttons(null, true);
            //Redraw repositories list
            UI.repos(config.repos, icons, config.active, switchRepo);
            //Switch to the new repository
            switchRepo(tempRepo.directory, true);
        }
    });
});
//Delete repository confirmation button
$("#modal-delete-repo-btn-confirm").click(() => {
    //Show processing screen
    UI.processing(true);
    //Delete the repository JSON from LocalStorage
    localStorage.removeItem(config.active);
    //Get the index then splice the entry out
    let index = config.repos.indexOf(config.active);
    const deleted = config.repos.splice(index, 1);
    //Delete icon
    delete icons[deleted[0]];
    //Check if there are repositories left
    if (config.repos.length) {
        //There are repositories left, we want to switch to the one before, unless we are already the first one
        if (index !== 0) {
            index--;
        }
        //Update configuration
        config.active = config.repos[index];
        //Save configuration
        localStorage.setItem("config", JSON.stringify(config));
        //Redraw repositories list
        UI.repos(config.repos, icons, config.active, switchRepo);
        //Switch to the repository that is active now, this will redraw branches and changed files list
        switchRepo(config.active, true);
    } else {
        //We just deleted the last repository, unset active repository
        config.active = undefined;
        //Save configuration
        localStorage.setItem("config", JSON.stringify(config));
        //Redraw repositories list to empty it, same for branches and changed files list
        UI.repos(config.repos, icons, config.active, switchRepo);
        UI.branches([], switchBranch);
        UI.diffTable([], rollbackCallback, diffCallback, viewCallback);
        //Lock all buttons (except Clone and Config)
        UI.buttons(false, false);
        //Hide processing screen
        UI.processing(false);
    }
});
//Configuration save button
$("#modal-config-btn-save").click(() => {
    //Show processing screen
    UI.processing(true);
    //Update config
    const name = $("#modal-config-input-name").val();
    const email = $("#modal-config-input-email").val();
    const savePW = $("#modal-config-input-savePW").is(":checked");
    //Apply configuration
    git.config(name, email, savePW, (output, hasError) => {
        //Dump output to the terminal
        ipc.send("console log", { log: output });
        //Check if it succeeded
        if (hasError) {
            //There is an error, show it
            UI.dialog("Something went wrong when applying configuration...", codify(output, true), true);
            //The new configuration will be discarded
        } else {
            //There is no error, update configuration
            config.name = name;
            config.email = email;
            config.savePW = savePW;
            //Save configuration
            localStorage.setItem("config", JSON.stringify(config));
            //Hide processing screen
            UI.processing(false);
        }
    });
});
//File rollback confirmation button
$("#modal-rollback-btn-rollback").click(() => {
    //Get the file name from DOM, we set it before showing the modal
    const name = $("#modal-rollback-pre-file-name").text().trim();
    if (name) {
        //This part uses similar logic as switchRepo() refresh part, detailed comments are available there
        UI.processing(true);
        git.rollback(activeRepo.directory, name, (output, hasError) => {
            if (hasError) {
                UI.dialog("Something went wrong when rolling back...", codify(output, true), true);
            } else {
                switchRepo(activeRepo.directory, true);
            }
        });
        //Clear the file name from DOM, so it will not cause confusion in case it is not properly set next time
        $("#modal-rollback-pre-file-name").text("");
    }
    //If the user interface worked properly, name would not be blank
});
//Switch branch confirmation button
$("#modal-switch-branch-btn-switch").click(() => {
    //This function uses similar logic as file rollback confirmation button click event handler, detailed comments are available there
    const name = $("#modal-switch-branch-pre-branch").text().trim();
    if (name) {
        UI.processing(true);
        git.switchBranch(activeRepo.directory, name, (output, hasError) => {
            ipc.send("console log", { log: output });
            if (hasError) {
                UI.dialog("Something went wrong when switching branch...", codify(output, true), true);
            } else {
                switchRepo(activeRepo.directory, true);
            }
        });
        $("#modal-switch-branch-pre-branch").text("");
    }
});
//Delete branch button
$("#modal-switch-branch-btn-delete").click(() => {
    //Move the name over and show delete confirm modal
    const name = $("#modal-switch-branch-pre-branch").text().trim();
    if (name) {
        $("#modal-delete-branch-pre-branch").text(name);
        $("#modal-switch-branch-pre-branch").text("");
        $("#modal-delete-branch").modal("show");
    }
    //If the user interface worked properly, name would not be blank
});
//Delete branch confirmation button
$("#modal-delete-branch-btn-confirm").click(() => {
    //This function uses similar logic as file rollback confirmation button click event handler, detailed comments are available there
    const name = $("#modal-delete-branch-pre-branch").text().trim();
    if (name) {
        UI.processing(true);
        git.deleteBranch(activeRepo.directory, name, (output, hasError) => {
            ipc.send("console log", { log: output });
            if (hasError) {
                UI.dialog("Something went wrong when deleting branch...", codify(output, true), true);
            } else {
                switchRepo(activeRepo.directory, true);
            }
        });
        $("#modal-delete-branch-pre-branch").text("");
    }
});

//=====Initialization=====
//Bind shortcut keys
$(document).on("keyup", (e) => {
    //For some reason, function keys can only be captured on keyup
    if (e.which === 123) {
        //F12, DevTools
        ipc.send("dev-tools");
    } else if (e.which === 116) {
        //F5, Reload if not busy
        if (!UI.isProcessing() && !isFetching) {
            location.reload();
        }
    }
});
//Warn the user about the console
console.log("%cPlease be careful of what you execute in this console, it has access to your local file system.", "color:red; font-size:large;");
//Prevent the window from reloading or closing when we are busy
window.onbeforeunload = (e) => {
    if (UI.isProcessing()) {
        //Busy screen open
        e.returnValue = false;
    } else if (isFetching) {
        //Fetching, close the window as soon as fetching finishes
        UI.processing(true);
        window.onceFetchingDone = () => {
            UI.processing(false);
            window.close();
        };
        e.returnValue = false;
    }
};
//Update height of some elements on window resize
$(window).resize(() => {
    //Main container
    $("#div-main-container").height($(document.body).height() - 90);
    //Code section (to make it scroll)
    $("pre").css("max-height", $(document.body).height() - 240);
    //Changed files list (to make it scroll)
    $("#tbody-diff-table").css("max-height", $(document.body).height() - 150);
});
//Update height for the first time
$(window).trigger("resize");
//Project page event handler, this will be called from inline code
window.openProjectPage = () => {
    //This function uses similar logic as switchRepo() open directory part, detailed comments are available there
    UI.processing(true);
    ipc.once("open project page done", () => {
        UI.processing(false);
    });
    ipc.send("open project page");
};
//Load configuration
let config; //Chech the default configuration object below for more information
let icons = {}; //Icons indicating the status of the repository
let activeRepo; //This will be a repository object which has properties address and directory, it will be the repository object of the active repository
try {
    //Load the configuration and copy it, hopefully we will not run into craches after this validation
    let tempConfig = JSON.parse(localStorage.getItem("config"));
    //Validate type of a few properties, others will have toString() called on them
    if (typeof tempConfig.savePW !== "boolean") {
        throw "Configuration Not Valid";
    }
    if (typeof tempConfig.active !== "undefined" && typeof tempConfig.active !== "string") {
        throw "Configuration Not Valid";
    }
    if (typeof tempConfig.repos !== "object") {
        throw "Configuration Not Valid";
    }
    //Copy the configuration object, check the default configuration object below for more information
    config = {
        lastPath: tempConfig.lastPath.toString(),
        name: tempConfig.name.toString(),
        email: tempConfig.email.toString(),
        savePW: tempConfig.savePW,
        active: tempConfig.active,
        repos: []
    };
    //Copy repositories directories array
    for (let i = 0; i < tempConfig.repos.length; i++) {
        config.repos.push(tempConfig.repos[i].toString());
        //Add icon
        icons[config.repos[i]] = $(`<span>`).addClass("glyphicon glyphicon-refresh");
    }
    //Keep repositories in order, it should be already in order, sort again to make sure
    config.repos.sort();
} catch (err) {
    //The configuration JSON is not valid, use the default one
    config = {
        lastPath: ipc.sendSync("get home"), //This is the parent directory of the last repository, it will be used when auto-filling clone directory
        name: "Alpha",
        email: "alpha@example.com",
        savePW: true, //Whether or not credential helper should be used
        active: undefined, //This is the directory of the active repository
        repos: [] //This is an array of directories of repositories
    }
}
//Draw repositories list
if (config.repos.length) {
    //Validate each repository JSON, hopefully we will not run into crashes later
    //This can be slow if there are a lot of repository, but this is only done once when loading, so it should be fine
    for (let i = 0; i < config.repos.length; i++) {
        try {
            //Get the JSON
            let repo = JSON.parse(localStorage.getItem(config.repos[i]));
            //Validate it by calling toString() on each property
            let tempRepo = {
                address: repo.address.toString(),
                directory: repo.directory.toString()
            };
            //Check if the key matches directory
            if (config.repos[i] !== tempRepo.directory) {
                throw "Repository Not Valid";
            }
            //Copy active one
            if (repo.directory === config.active) {
                //Even though switchRepo() will parse this again, we do this to confirm that config.active is valid
                activeRepo = tempRepo;
            }
        } catch (err) {
            //Remove this repository from the array
            //If it is active, config.active will be unset later, simply removing it from the array is enough
            localStorage.removeItem(config.repos[i]);
            const deleted = config.repos.splice(i, 1);
            //Remove icon
            delete icons[deleted[0]];
            i--; //Go back by 1 because we spliced the repository out
            //Save the new configuration that has broken repository removed
            localStorage.setItem("config", JSON.stringify(config));
        }
    }
    //Check if the active repository is valid, if it is not and there are other repositories, the user can click them from repositories list to set one as active
    if (config.repos.indexOf(config.active) < 0) {
        //The active repository does not exist, unset it
        config.active = undefined;
        //Save configuration
        localStorage.setItem("config", JSON.stringify(config));
        //No active repository, lock both action and management buttons
        UI.buttons(false, false);
    }
    //Draw repositories list
    UI.repos(config.repos, icons, config.active, switchRepo);
} else {
    //There is no repository, lock both action and management buttons
    UI.buttons(false, false);
}
//The dictionary array, will be loaded later
let spellcheckDict = [];
//Initialize spellcheck
webFrame.setSpellCheckProvider("en-CA", false, {
    spellCheck(word) {
        if (spellcheckDict.length) {
            return binSearch(spellcheckDict, word) > -1;
        } else {
            //Dictonary is not loaded, return true so words will not all be underlined
            return true;
        }
    }
});
//Load spellcheck dictionary, fs will be required inline since it is only used once
require("fs").readFile(path.join(__dirname, "renderer-lib/debian.dict-8.7.txt"), (err, data) => {
    //Check if it succeed
    if (err) {
        //There is an error, update DOM and log it
        $("#modal-commit-spellcheck-load-state").html("Could not load spellcheck dictionary, error logged to console.");
        console.error(err);
    } else {
        //There is no error, parse the dictionary then update DOM
        spellcheckDict = data.toString().split("\r\n");
        $("#modal-commit-spellcheck-load-state").remove();
    }
});
//Apply configuration
//This part uses similar logic as switchRepo() refresh part, detailed comments are available there
git.config(config.name, config.email, config.savePW, (output, hasError) => {
    ipc.send("console log", { log: output });
    if (hasError) {
        UI.dialog("Something went wrong when applying configuration...", codify(output, true), true);
    } else if (activeRepo) {
        //There is an active repository, load it
        switchRepo(config.active, true);
    } else {
        //No active repository, hide processing screen
        UI.processing(false);
    }
});

//=====Remote Status Watcher=====
/**
 * Whether or not we are fetching remote changes. Define window.onceFetchingDone() will cause it being called as soon as the next fetching finishes.
 * @var {boolean}
 */
let isFetching = false;
//Helper functions
/**
 * Update icon for a repository.
 * @function
 * @param {string} directory - The directory of the repository.
 * @param {string} status - A valid status returned from git.compare().
 */
const updateIcons = (directory, status) => {
    switch (status) {
        case "up to date":
            icons[directory].removeClass().addClass("glyphicon glyphicon-ok");
            break;
        case "need pull":
            icons[directory].removeClass().addClass("glyphicon glyphicon-chevron-down");
            break;
        case "need push":
            icons[directory].removeClass().addClass("glyphicon glyphicon-chevron-up");
            break;
        case "diverged":
            icons[directory].removeClass().addClass("glyphicon glyphicon-remove-circle");
            break;
        case "error":
            icons[directory].removeClass().addClass("glyphicon glyphicon-remove");
            break;
    }
};
/**
 * Get a icon refresh job runner.
 * @function
 * @param {string} directory - The directory to check.
 * @return {Promise} A promise of the job.
 */
const getRunner = (directory) => {
    return new Promise((resolve) => {
        git.compare(directory, (result, output) => {
            //Dump output to the terminal
            ipc.send("console log", { log: output });
            //Update the icon if possible, need to check the icons dictionary as it may change
            if (icons[directory]) {
                updateIcons(directory, result);
            }
            resolve();
        });
    });
};
/**
 * Start refresh task schedule, one tick is done every 5 minutes.
 * This function should only be called once.
 * @function
 */
const scheduleIconRefresh = (() => {
    let i = 0;
    const delay = 5 * 60 * 1000;
    return () => {
        const runTask = () => {
            //Check if there are repositories at all
            if (config.repos.length === 0) {
                setTimeout(runTask, delay);
            } else {
                //Check if we need to reset i to 0
                if (i >= config.repos.length) {
                    i = 0;
                }
                //The directory exists, cache it and increment the counter, in case the array changed when we come back
                const directory = config.repos[i++];
                isFetching = true;
                git.fetch(directory, (output, hasError) => {
                    //Dump output to the terminal
                    ipc.send("console log", { log: output });
                    //Update icon if there is no error
                    if (!hasError) {
                        getRunner(directory).then(() => {
                            //Schedule next tick
                            setTimeout(runTask, delay);
                        });
                    } else {
                        //Update the icon to be error (will be the same icon as diverged)
                        if (icons[directory]) {
                            updateIcons(directory, "diverged");
                        }
                    }
                    //Update flag and run scheduled runner
                    isFetching = false;
                    if (typeof window.onceFetchingDone === "function") {
                        //Swap it like this in case this event handler synchronously updated the handler
                        const func = window.onceFetchingDone;
                        window.onceFetchingDone = null;
                        func();
                    }
                });
            }
        };
        //Start the timer for the first time
        setTimeout(runTask, delay);
    };
})();
//When processing ends, refresh the icon of current repository
window.onProcessingEnds = () => {
    if (config.active) {
        getRunner(config.active);
    }
};
//Initialization
(() => {
    //Initialize icons with what we know so far
    let tasks = [];
    for (let i = 0; i < config.repos.length; i++) {
        tasks.push(getRunner(config.repos[i]));
    }
    Promise.all(tasks).then(() => { scheduleIconRefresh(); });
})();

//=====Duct Tape=====
//There some issues with modals and we need to duct tape them
//This may be a bug in Bootstrap, or Bootstrap is not designed to handle multiple modals
//We need to remove a backdrop that is sometimes not removed, it blocks mouse clicks
setInterval(() => {
    //This is pretty light, when this software is in the background, CPU usage stays at 0%
    if (!$(".modal").is(":visible") && $(".modal-backdrop.fade").length) {
        //We are going to check twice to make sure things are taped right
        setTimeout(() => {
            if (!$(".modal").is(":visible") && $(".modal-backdrop.fade").length) {
                //Remove the extra backdrop
                $(".modal-backdrop.fade").each(function () {
                    if ($(this).text() === "") {
                        $(this).remove();
                        //Make sure all modals are hidden properly, so they can be shown again later
                        $(".modal").modal("hide");
                    }
                });
            }
        }, 250);
    }
}, 750);
