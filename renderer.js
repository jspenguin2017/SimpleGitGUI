//The renderer process
"use strict";

//=====Load Modules=====
//Show processing screen
UI.processing(true);
//Load Electron and utilities
const {ipcRenderer: ipc, clipboard} = require("electron");
const path = require("path");
const fs = require("fs");
const git = require("./renderer-lib/git.js");

//=====Helper function=====
//Escape and format to code
const codify = function (code, noColor) {
    //Escape HTML, & and < are the only ones we need to worry about since it will be wrapped in <pre>
    code = code.replace(/\&/g, "&amp;").replace(/\</g, "&lt;");
    //Color each line
    if (!noColor) {
        let lines = code.split("\n");
        for (let i = 0; i < lines.length; i++) {
            if ((lines[i]).startsWith("+")) {
                lines[i] = `<span class="code-add">${lines[i]}</span>`;
            } else if ((lines[i]).startsWith("-")) {
                lines[i] = `<span class="code-remove">${lines[i]}</span>`;
            } else if ((lines[i]).startsWith("@")) {
                lines[i] = `<span class="code-area">${lines[i]}</span>`;
            }
        }
        code = lines.join("\n");
    }
    //Return the code
    return `<pre>${code}</pre>`;
};
//Get commit message
const getCommitMsg = function () {
    //Get commit message
    let msg = $("#modal-commit-input-commit-message").val().split("\n");
    //Clear the text box for next commit sync
    $("#modal-commit-input-commit-message").val("");
    //Check if message is not empty
    let hasMsg = false;
    for (let i = 0; i < msg.length; i++) {
        if (msg[i].length) {
            hasMsg = true;
            break;
        }
    }
    if (!hasMsg) {
        msg = ["No commit message. "];
    }
    return msg;
};
//Repo switch callback
const switchRepo = function (name, doRefresh) {
    UI.processing(true);
    if (name === config.active && !doRefresh) {
        //Launch the project directory
        ipc.once("open folder done", () => {
            UI.processing(false);
        })
        ipc.send("open folder", {
            folder: activeRepo.directory
        });
    } else {
        //This is validated before, just copy it
        let tempRepo = JSON.parse(localStorage.getItem(name));
        activeRepo = {
            name: tempRepo.name.toString(),
            address: tempRepo.address.toString(),
            directory: tempRepo.directory.toString()
        };
        config.active = activeRepo.name;
        localStorage.setItem("config", JSON.stringify(config));
        git.branches(activeRepo.directory, (output, hasError, data) => {
            ipc.send("console log", { log: output });
            if (hasError) {
                UI.buttons(false, true);
                UI.dialog("Something went wrong when loading branches...", codify(output, true), true);
            } else {
                UI.branches(data, switchBranch);
                git.diff(activeRepo.directory, (output, hasError, data) => {
                    ipc.send("console log", { log: output });
                    if (hasError) {
                        UI.buttons(false, true);
                        UI.dialog("Something went wrong when loading file changes...", codify(output, true), true);
                    } else {
                        UI.buttons(true, true);
                        UI.diffTable(data, rollbackCallback, diffCallback, viewCallback);
                        //Redraw repos list
                        UI.repos(config.repos, config.active, switchRepo);
                        UI.processing(false);
                    }
                });
            }
        });
    }
};
//Branch switch callback
const switchBranch = function (name) {
    UI.processing(true);
    //TODO
    console.log(`Branch ${name} clicked`);
    UI.processing(false);
};
//Diff table rollback callback
const rollbackCallback = function (file) {
    UI.processing(true);
    //TODO
    console.log(`Rollback of ${file} clicked`);
    UI.processing(false);
};
//Diff table diff callback
const diffCallback = function (file) {
    UI.processing(true);
    git.fileDiff(activeRepo.directory, file, (output, hasError, data) => {
        ipc.send("console log", { log: output });
        if (hasError) {
            UI.dialog("Something went wrong when loading difference...", codify(output, true), true);
        } else {
            UI.dialog("Difference", codify(data.join("\n")));
        }
    });
};
//Diff table view callback
const viewCallback = function (file) {
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
    $("#modal-hard-reset-input-confirm").val("");
    $("#modal-hard-reset").modal("show");
});
//Pull
$("#btn-menu-pull").click(() => {
    $("#modal-pull").modal("show");
});
//Pull
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
        $("#modal-clone-input-address").val(data).trigger("keyup");
    }
    $("#modal-clone").modal("show");
});
//Delete
$("#btn-menu-delete-repo").click(() => {
    $("#modal-delete-repo").modal("show");
});
//Config
$("#btn-menu-config").click(() => {
    //Fill in config
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
        //TODO
        console.log("Force pull triggered");
        UI.processing(false);
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
        //TODO
        console.log("Force push triggered");
        UI.processing(false);
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
            UI.dialog("Status", codify(data.join("\n"), true));
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
    //We'll make the directory, and ignore error, Git will take care of the rest, it won't proceed unless the directory is empty
    fs.mkdir(directory, () => {
        git.clone(address, directory, (output, hasError) => {
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
