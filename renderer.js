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
            name: tempRepo.name.toString(),
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
    //This function uses similar logic as switchRepo() refresh, detailed comments are available there
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

//=====Modals=====
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

//=====Events=====
//Force pull, remove local repository and clone again
$("#modal-hard-reset-input-confirm").on("keyup", () => {
    if ($("#modal-hard-reset-input-confirm").val() === "confirm") {
        UI.processing(true);
        $("#modal-hard-reset-input-confirm").val("");
        $("#modal-hard-reset").modal("hide");
        //Start
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
//Pull, pull and merge changes
$("#modal-pull-btn-pull").click(() => {
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
//Sync, pull then push
$("#modal-sync-btn-sync").click(() => {
    UI.processing(true);
    //This is pretty much just pull button then push button, but we need to copy them because it is just slightly different
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
//Commit, commit changes
$("#modal-commit-btn-commit").click(() => {
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
//Commit, commit then push
$("#modal-commit-btn-commit-push").click(() => {
    UI.processing(true);
    //This is pretty much just commit button then push button, but we need to copy them because it is just slightly different
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
//Commit, auto focus text box
$("#modal-commit").on("shown.bs.modal", () => {
    $("#modal-commit-input-commit-message").focus();
});
//Push, push committed changes
$("#btn-menu-push").click(() => {
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
//Force push, force push changes
$("#modal-force-push-input-confirm").on("keyup", () => {
    if ($("#modal-force-push-input-confirm").val() === "confirm") {
        UI.processing(true);
        $("#modal-force-push-input-confirm").val("");
        $("#modal-force-push").modal("hide");
        //We need the name of current branch
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
//Refresh, do refresh
$("#btn-menu-refresh").click(() => {
    switchRepo(config.active, true);
});
//Refresh, auto refresh when window focus
$(window).focus(() => {
    //Don't refresh if anything is open, or if we can't refresh
    if (!$(".modal").is(":visible") && !$("#btn-menu-refresh").prop("disabled")) {
        switchRepo(config.active, true);
    }
});
//Status, show status
$("#btn-menu-repo-status").click(() => {
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
//Clone, auto fill directory
$("#modal-clone-input-address").on("keyup", () => {
    const parts = $("#modal-clone-input-address").val().split("/");
    const match = parts[parts.length - 1].split(".");
    if (match.length > 1) {
        try {
            $("#modal-clone-input-directory").val(path.join(config.lastPath, match[match.length - 2]));
        } catch (err) {
            console.warn("Failed to auto fill directory, error message: ");
            console.log(err.toString());
        }
    }
});
//Clone, confirm
$("#modal-clone-btn-clone").click(() => {
    UI.processing(true);
    const address = $("#modal-clone-input-address").val();
    const directory = $("#modal-clone-input-directory").val();
    let tempRepo = {
        name: directory.split(/\/|\\/).pop(),
        address: address,
        directory: directory
    };
    git.clone(directory, address, (output, hasError) => {
        ipc.send("console log", { log: output });
        if (hasError) {
            UI.dialog("Something went wrong when cloning...", codify(output, true), true);
        } else {
            //Update config
            config.repos.push(tempRepo.name);
            config.lastPath = path.resolve(directory, "..");
            config.active = tempRepo.name;
            //Save config
            localStorage.setItem(tempRepo.name, JSON.stringify(tempRepo));
            localStorage.setItem("config", JSON.stringify(config));
            //Switch to it
            UI.buttons(null, true); //Actions buttons will be handled by switchRepo
            UI.repos(config.repos, config.active, switchRepo);
            switchRepo(tempRepo.name, true);
        }
    });
});
//Delete, delete repo
$("#modal-delete-repo-btn-confirm").click(() => {
    UI.processing(true);
    //Update config
    localStorage.removeItem(config.active);
    let index = config.repos.indexOf(config.active);
    config.repos.splice(index, 1);
    if (config.repos.length) {
        //We still have repos, switch to the one above (or the one below if we are the first one)
        if (index !== 0) {
            index--;
        }
        config.active = config.repos[index];
        //Save the config
        localStorage.setItem("config", JSON.stringify(config));
        //Redraw repos list
        UI.repos(config.repos, config.active, switchRepo);
        switchRepo(config.active, true);
    } else {
        config.active = undefined;
        //Save the config
        localStorage.setItem("config", JSON.stringify(config));
        //Update UI
        UI.repos(config.repos, config.active, switchRepo);
        UI.branches([], switchBranch);
        UI.diffTable([], rollbackCallback, diffCallback, viewCallback);
        UI.buttons(false, false);
        UI.processing(false);
    }
});
//Config, save config
$("#modal-config-btn-save").click(() => {
    UI.processing(true);
    //Update config
    config.name = $("#modal-config-input-name").val();
    config.email = $("#modal-config-input-email").val();
    config.savePW = $("#modal-config-input-savePW").is(":checked");
    //Save and apply config
    localStorage.setItem("config", JSON.stringify(config));
    git.config(config.name, config.email, config.savePW, (output, hasError) => {
        ipc.send("console log", { log: output });
        if (hasError) {
            UI.dialog("Something went wrong when applying configuration...", codify(output, true), true);
        } else {
            UI.processing(false);
        }
    });
});
//Rollback, revert a file
$("#modal-rollback-btn-rollback").click(() => {
    if ($("#modal-rollback-pre-file-name").text()) {
        UI.processing(true);
        git.rollback(activeRepo.directory, $("#modal-rollback-pre-file-name").text(), (output, hasError) => {
            if (hasError) {
                UI.dialog("Something went wrong when rolling back...", codify(output, true), true);
            } else {
                switchRepo(activeRepo.name, true);
            }
        });
        $("#modal-rollback-pre-file-name").text("");
    }
});
//Switch branch, revert a file
$("#modal-switch-branch-btn-switch").click(() => {
    if ($("#modal-switch-branch-pre-branch").text()) {
        UI.processing(true);
        git.switchBranch(activeRepo.directory, $("#modal-switch-branch-pre-branch").text(), (output, hasError) => {
            if (hasError) {
                UI.dialog("Something went wrong when switching branch...", codify(output, true), true);
            } else {
                switchRepo(activeRepo.name, true);
            }
        });
        $("#modal-switch-branch-pre-branch").text("");
    }
});

//=====Initialization=====
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
//Update height of some element on resize
$(window).resize(() => {
    //Resize main container
    $("#div-main-container").height($(document.body).height() - 90);
    //Make code section scroll
    $("pre").css("max-height", $(document.body).height() - 240);
    //Make file table scroll
    $("#tbody-diff-table").css("max-height", $(document.body).height() - 150);
});
//Set height for the first time
$(window).trigger("resize");
//Project page
window.openProjectPage = function () {
    UI.processing(true);
    ipc.once("open project page done", () => {
        UI.processing(false);
    });
    ipc.send("open project page");
};
//Load config
let config;
let activeRepo;
try {
    let tempConfig = JSON.parse(localStorage.getItem("config"));
    //Validate it
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
    for (let i = 0; i < tempConfig.repos.length; i++) {
        config.repos.push(tempConfig.repos[i]);
    }
} catch (err) {
    config = {
        lastPath: ipc.sendSync("get home"),
        name: "Alpha",
        email: "alpha@example.com",
        savePW: true,
        active: undefined,
        repos: []
        //Each repo will be a different entry in LocalStorage
        //It will be an object with properties name, address, and directory
    }
}
//Draw repos list
if (config.repos.length) {
    let names = [];
    for (let i = 0; i < config.repos.length; i++) {
        try {
            let repo = JSON.parse(localStorage.getItem(config.repos[i]));
            names.push(repo.name);
            //Validate it
            let tempRepo = {
                name: repo.name.toString(),
                address: repo.address.toString(),
                directory: repo.directory.toString()
            };
            //Copy active one
            if (repo.name === config.active) {
                //Even though switchRepo will parse this again, we do this to confirm that config.active is valid
                activeRepo = tempRepo;
            }
        } catch (err) {
            //If this is the active one, remove it
            if (config.repos[i] === config.active) {
                config.active = undefined;
            }
            //Remove this repository
            localStorage.removeItem(config.repos[i]);
            config.repos.splice(i, 1);
            i--;
            localStorage.setItem("config", JSON.stringify(config));
        }
    }
    UI.repos(names, config.active, switchRepo);
    //Check if active is valid
    if (config.repos.indexOf(config.active) < 0) {
        config.active = undefined;
        localStorage.setItem("config", JSON.stringify(config));
        UI.buttons(false, false); //Click on another repo to continue
    }
} else {
    //Lock active repo related buttons
    UI.buttons(false, false);
}
//Connect to Git
git.config(config.name, config.email, config.savePW, (output, hasError) => {
    ipc.send("console log", { log: output });
    if (hasError) {
        UI.dialog("Something went wrong when applying configuration...", codify(output, true), true);
    } else if (activeRepo) {
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
        //We are going to check twice
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
