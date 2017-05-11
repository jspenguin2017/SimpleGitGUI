//The renderer process
"use strict";

//Show processing screen
UI.processing(true);

//=====Load Modules=====
//Electron
const {ipcRenderer: ipc, clipboard} = require("electron");
//Utilities and libraries
const path = require("path");
const git = require("./renderer-lib/git.js");

//=====Helper Functions=====
/**
 * Escape and color code.
 * @function
 * @param {string} code - The code to show.
 * @param {bool} [noColor=false] - Set this to true to not color code.
 * @returns {string} The HTML string that is ready to be inserted.
 */
const codify = function (code, noColor) {
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
                //Header
                lines[i] = `<span class="code-area">${lines[i]}</span>`;
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
 * @returns {Array.<string>} Lines of commit message
 */
const getCommitMsg = function () {
    //Get commit message
    let msg = $("#modal-commit-input-commit-message").val().split("\n");
    //Clear the text box for next commit
    $("#modal-commit-input-commit-message").val("");
    //Check if message is not empty
    let hasMsg = false;
    for (let i = 0; i < msg.length; i++) {
        if (msg[i].length) {
            hasMsg = true;
            break;
        }
    }
    //Set in default commit message if the user did not write one
    if (!hasMsg) {
        msg = ["No commit message. "];
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
 * @param {bool} [doRefresh=false] - Set this to true to do a refresh, this will prevent opening the directory if the repository is already active.
 * @listens $(".repos-list-btn-switch-repo").click
 */
const switchRepo = function (directory, doRefresh) {
    //Show processing screen 
    UI.processing(true);
    //Check if the repository is already active, or if we should do a refresh
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
        //Load the repository JSON
        let tempRepo = JSON.parse(localStorage.getItem(directory));
        activeRepo = {
            address: tempRepo.address.toString(),
            directory: tempRepo.directory.toString()
        };
        //Update active repository
        config.active = activeRepo.directory;
        //Save configuration
        localStorage.setItem("config", JSON.stringify(config));
        //Load or refresh everything about this repository
        //Load branches
        git.branches(activeRepo.directory, (output, hasError, data) => {
            //Dump output to the terminal
            ipc.send("console log", { log: output });
            //Check if we succeed
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
                    //Check if we succeed
                    if (hasError) {
                        //There is an error, disable action buttons and show error
                        UI.buttons(false, true);
                        UI.dialog("Something went wrong when loading file changes...", codify(output, true), true);
                    } else {
                        //Succeed, enable all buttons and draw changed files list
                        UI.buttons(true, true);
                        UI.diffTable(data, rollbackCallback, diffCallback, viewCallback);
                        //Redraw repos list to update the active selection
                        UI.repos(config.repos, config.active, switchRepo);
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
const switchBranch = function (name) {
    //Fill in the branch to switch to
    $("#modal-switch-branch-pre-branch").text(name.split("/").pop());
    //Show modal
    $("#modal-switch-branch").modal("show");
};
/**
 * Show file rollback confirm modal.
 * @function
 * @listens $(".diff-table-btn-file-rollback").click
 */
const rollbackCallback = function (file) {
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
const diffCallback = function (file) {
    //This function uses similar logic as switchRepo() refresh part, detailed comments are available there
    UI.processing(true);
    git.fileDiff(activeRepo.directory, file, (output, hasError, data) => {
        ipc.send("console log", { log: output });
        if (hasError) {
            UI.dialog("Something went wrong when loading difference...", codify(output, true), true);
        } else {
            //Show colored file difference modal, we'll just use the general purpose modal
            UI.dialog("File Difference", codify(data.join("\n")));
        }
    });
};
/**
 * Show the file in file explorer.
 * @function
 * @listens $(".diff-table-btn-file-view").click
 */
const viewCallback = function (file) {
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
//This section will only include initializing and showing modal
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
    //Similar to force pull, clear the text box
    $("#modal-force-push-input-confirm").val("");
    $("#modal-force-push").modal("show");
});
//Refresh will not have a modal
//Status will not have a modal
//Clone
$("#btn-menu-clone").click(() => {
    //Auto fill address
    const data = clipboard.readText("plain/text");
    if ((/\.git$/).test(data)) {
        //We'll simply set the address in the address box, then trigger another event handler that will take care of it
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
//Force pull confirmation button
$("#modal-hard-reset-input-confirm").on("keyup", () => {
    //Check if "confirm" is typed
    if ($("#modal-hard-reset-input-confirm").val() === "confirm") {
        //Show processing screen and hide force pull confirmation modal
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
//Commit only confirmation button
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
    //Same as synchronize, we had to copy the code due to not being able to chain button clicks
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
    //This function uses similar logic as force pull confirmation handler, refer back to that for explanations
    if ($("#modal-force-push-input-confirm").val() === "confirm") {
        UI.processing(true);
        $("#modal-force-push-input-confirm").val("");
        $("#modal-force-push").modal("hide");
        //We need the name of the current branch
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
    //Simply call switchRepo with doRefresh flag
    switchRepo(config.active, true);
});
//Auto-refresh when window gain focus while not being busy
$(window).focus(() => {
    //Don't refresh if anything is open, or if there is no repository
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
    //Create a temporary repository profile and see if cloning succeed, we'll save it later
    const address = $("#modal-clone-input-address").val();
    const directory = $("#modal-clone-input-directory").val();
    //This is also what each repository JSON should look like
    let tempRepo = {
        address: address,
        directory: directory
    };
    //Clone the repository
    git.clone(directory, address, (output, hasError) => {
        //Dump output to the terminal
        ipc.send("console log", { log: output });
        //Check if we succeed
        if (hasError) {
            //There is an error, show it
            UI.dialog("Something went wrong when cloning...", codify(output, true), true);
        } else {
            //Succeed, we can now update configuration
            //Update configuration
            config.repos.push(tempRepo.directory);
            //We'll auto-fill using the parent directory of this repository's directory next time
            config.lastPath = path.resolve(directory, "..");
            config.active = tempRepo.directory;
            //Save configuration
            localStorage.setItem(tempRepo.directory, JSON.stringify(tempRepo));
            localStorage.setItem("config", JSON.stringify(config));
            //Enable management buttons, ations buttons will be handled by switchRepo
            UI.buttons(null, true);
            //Redraw repositories list
            UI.repos(config.repos, config.active, switchRepo);
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
    config.repos.splice(index, 1);
    //We now need to check if there are any repositories left
    if (config.repos.length) {
        //We want to switch to the one before, unless we are already the first one
        if (index !== 0) {
            index--;
        }
        //Update configuration
        config.active = config.repos[index];
        //Save configuration
        localStorage.setItem("config", JSON.stringify(config));
        //Redraw repositories list
        UI.repos(config.repos, config.active, switchRepo);
        //Switch to the repository that is active now
        switchRepo(config.active, true);
    } else {
        //We just deleted the last repository, we'll unset active repository
        config.active = undefined;
        //Save configuration
        localStorage.setItem("config", JSON.stringify(config));
        //Redraw repositories list to empty it, same for branches and changed files list
        UI.repos(config.repos, config.active, switchRepo);
        UI.branches([], switchBranch);
        UI.diffTable([], rollbackCallback, diffCallback, viewCallback);
        //We'll lock all buttons (except Clone and Config)
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
        //Check if we succeed
        if (hasError) {
            //There is an error, show it
            //The new configuration will be discarded
            UI.dialog("Something went wrong when applying configuration...", codify(output, true), true);
        } else {
            //There is no error, update and save configuration
            config.name = name;
            config.email = email;
            config.savePW = savePW;
            localStorage.setItem("config", JSON.stringify(config));
            //Hide processing screen
            UI.processing(false);
        }
    });
});
//File rollback confirmation button
$("#modal-rollback-btn-rollback").click(() => {
    //We'll get the file name from DOM, we set it before showing the modal
    if ($("#modal-rollback-pre-file-name").text()) {
        //This part uses similar logic as switchRepo() refresh part, detailed comments are available there
        UI.processing(true);
        git.rollback(activeRepo.directory, $("#modal-rollback-pre-file-name").text(), (output, hasError) => {
            if (hasError) {
                UI.dialog("Something went wrong when rolling back...", codify(output, true), true);
            } else {
                switchRepo(activeRepo.directory, true);
            }
        });
        //We'll clear the file name from DOM, in case it is not properly set next time, it won't cause confusion
        $("#modal-rollback-pre-file-name").text("");
    }
});
//Switch branch confirmation button
$("#modal-switch-branch-btn-switch").click(() => {
    //This function uses similar logic as file rollback confirmation button click event handler, refer back to that for explanations
    if ($("#modal-switch-branch-pre-branch").text()) {
        UI.processing(true);
        git.switchBranch(activeRepo.directory, $("#modal-switch-branch-pre-branch").text(), (output, hasError) => {
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

//=====Initialization=====
//Bind shortcut keys
$(document).on("keyup", (e) => {
    //For some reason, function keys can only be captured on keyup
    if (e.which === 123) {
        //F12, DevTools
        ipc.send("dev-tools");
    } else if (e.which === 116) {
        //F5, Reload if not busy
        //Note that a reload can be forced from DevTools
        if (!UI.isBusy()) {
            location.reload();
        }
    }
});
//Warn the user about the console
console.log("%cPlease be careful of what you execute in the console, this console has access to your local file system. ", "color: red; font-size: large;");
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
window.openProjectPage = function () {
    //This function uses similar logic as switchRepo() open directory part, detailed comments are available there
    UI.processing(true);
    ipc.once("open project page done", () => {
        UI.processing(false);
    });
    ipc.send("open project page");
};
//Load configuration
let config; //View default configuration below for more information
let activeRepo; //This will be an object containing address and directory of the active repository
try {
    //We'll load the configuration and copy it, this is a easy way to make sure it is not corrupted in a way that can crash renderer later
    let tempConfig = JSON.parse(localStorage.getItem("config"));
    //Validate type of a few properties, others will have toString() called on them
    if (typeof tempConfig.savePW !== "boolean") {
        throw "Config Not Valid";
    }
    if (typeof tempConfig.active !== "undefined" && typeof tempConfig.active !== "string") {
        throw "Config Not Valid";
    }
    if (typeof tempConfig.repos !== "object") {
        throw "Config Not Valid";
    }
    //Copy the config
    config = {
        lastPath: tempConfig.lastPath.toString(),
        name: tempConfig.name.toString(),
        email: tempConfig.email.toString(),
        savePW: tempConfig.savePW,
        active: tempConfig.active,
        repos: []
    };
    //Fill in repositories list
    for (let i = 0; i < tempConfig.repos.length; i++) {
        config.repos.push(tempConfig.repos[i]);
    }
} catch (err) {
    //The configuration JSON is not valid, we'll use the default one
    config = {
        lastPath: ipc.sendSync("get home"), //This is the parent directory of the last repository, it will be used when auto-filling clone directory
        name: "Alpha",
        email: "alpha@example.com",
        savePW: true, //Whether or not credential helper should be used
        active: undefined, //This is the directory of the active repository
        repos: [] //This is a list of directories of repositories
    }
}
//Draw repositories list
if (config.repos.length) {
    //We'll validate each repository JSON so we won't run into crashes later
    for (let i = 0; i < config.repos.length; i++) {
        try {
            //Get the JSON
            let repo = JSON.parse(localStorage.getItem(config.repos[i]));
            //Validate it by calling toString() on each property
            let tempRepo = {
                address: repo.address.toString(),
                directory: repo.directory.toString()
            };
            //Copy active one
            if (repo.directory === config.active) {
                //Even though switchRepo will parse this again, we do this to confirm that config.active is valid
                activeRepo = tempRepo;
            }
        } catch (err) {
            //If this is the active one, unset the active repository
            if (config.repos[i] === config.active) {
                config.active = undefined;
            }
            //Remove this repository from the list
            localStorage.removeItem(config.repos[i]);
            config.repos.splice(i, 1);
            i--; //We go back by 1 because we spliced the repositories array
            //Save the new configuration that has broken repository removed
            localStorage.setItem("config", JSON.stringify(config));
        }
    }
    //Draw repositories list
    UI.repos(config.repos, config.active, switchRepo);
    //Check if the active repository is valid, if it is not and there are other repositories, the user can click them from repositories list to set one as active
    if (config.repos.indexOf(config.active) < 0) {
        //The active repository does not exist, we'll unset it
        config.active = undefined;
        //Save configuration
        localStorage.setItem("config", JSON.stringify(config));
        //No active repository, lock both action and management buttons
        UI.buttons(false, false);
    }
} else {
    //There is no repository, lock both action and management buttons
    UI.buttons(false, false);
}
//Apply configuration
//This part uses similar logic as switchRepo() refresh part, detailed comments are available there
git.config(config.name, config.email, config.savePW, (output, hasError) => {
    ipc.send("console log", { log: output });
    if (hasError) {
        UI.dialog("Something went wrong when applying configuration...", codify(output, true), true);
    } else if (activeRepo) {
        //There is an active repository, refresh it for the first time
        switchRepo(config.active, true);
    } else {
        //No active repo, close processing screen
        UI.processing(false);
    }
});
//There some slight issues with modals that we need to duct tape
//This may be a bug in Bootstrap, or just Bootstrap isn't tested for multiple modal
//We need to remove a backdrop that is sometimes not removed
setInterval(() => {
    if (!$(".modal").is(":visible") && $(".modal-backdrop.fade").length) {
        //We are going to check twice to make sure things are right
        setTimeout(() => {
            if (!$(".modal").is(":visible") && $(".modal-backdrop.fade").length) {
                $(".modal-backdrop.fade").each(function () {
                    if ($(this).text() === "") {
                        $(this).remove();
                    }
                });
            }
        }, 250);
    }
}, 750);
