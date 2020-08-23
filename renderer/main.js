// --------------------------------------------------------------------------------------------- //

// Simple Git GUI - A simple Git GUI, free and open
// Copyright (C) 2017-2018  Hugo Xu
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// --------------------------------------------------------------------------------------------- //

// Renderer entry point

// --------------------------------------------------------------------------------------------- //

"use strict";

// --------------------------------------------------------------------------------------------- //

UI.processing(true);

// --------------------------------------------------------------------------------------------- //

const { ipcRenderer: ipc, clipboard, webFrame } = require("electron");
const fs = require("fs");
const path = require("path");

const git = require("./git.js");

// --------------------------------------------------------------------------------------------- //

const reAllDigits = /^\d+$/;

// --------------------------------------------------------------------------------------------- //

let config;

let icons = {};

let activeRepo;

let drawCache = {
    branches: "",
    diffs: "",
};

let spellcheckDict;

let isFocused = true;

let isFetching = false;

// --------------------------------------------------------------------------------------------- //

const binSearch = (array, key) => {
    let lower = 0;
    let upper = array.length - 1;
    let i;
    let elem;

    while (lower <= upper) {
        i = Math.floor((lower + upper) / 2);
        elem = array[i];

        if (elem < key)
            lower = i + 1;
        else if (elem > key)
            upper = i - 1;
        else
            return i;
    }

    return -1;
};

const codify = (() => {
    const amp = /\&/g;
    const lt = /\</g;

    return (code, noColor) => {
        // It will be wrapped in <pre>, so this is enough
        code = code.replace(amp, "&amp;").replace(lt, "&lt;");

        if (!noColor) {
            let lines = code.split("\n");

            for (let i = 0; i < lines.length; i++) {
                switch (lines[i].charAt(0)) {
                    case "+":
                        lines[i] = '<span class="code-add">' + lines[i] + "</span>";
                        break;
                    case "-":
                        lines[i] = '<span class="code-remove">' + lines[i] + "</span>";
                        break;
                    case "@":
                        lines[i] = '<span class="code-section">' + lines[i] + "</span>";
                }
            }

            code = lines.join("\n");
        }

        return '<pre id="modal-dialog-pre">' + code + "</pre>";
    };
})();

// --------------------------------------------------------------------------------------------- //

const getCommitMsg = () => {
    let msg = $("#modal-commit-input-commit-message").val().split("\n");
    $("#modal-commit-input-commit-message").val("");

    let noMsg = true;
    for (const m of msg) {
        if (m.trim().length > 0) {
            noMsg = false;
            break;
        }
    }

    if (noMsg)
        msg = ["No commit message"];

    return msg;
};

// --------------------------------------------------------------------------------------------- //

const switchRepo = (directory, doRefresh = false, forceReload = false) => {

    // ----------------------------------------------------------------------------------------- //

    UI.processing(true);

    // ----------------------------------------------------------------------------------------- //

    // Case 1: Click active repository, open the repository folder

    if (directory === config.active && !doRefresh) {
        ipc.once("open folder done", () => {
            UI.processing(false);
        });

        ipc.send("open folder", {
            folder: config.active,
        });

        return;
    }

    // ----------------------------------------------------------------------------------------- //

    // Case 2: Click other repository
    // Case 3: Caller wish to force reload

    if (directory !== config.active || forceReload) {
        config.active = directory;
        localStorage.setItem("config", JSON.stringify(config));

        try {
            const tempRepo = JSON.parse(localStorage.getItem(directory));

            activeRepo = {
                address: tempRepo.address.toString(),
                directory: tempRepo.directory.toString(),
            };

            if (activeRepo.directory !== directory)
                throw "Configuration Data Not Valid";
        } catch (err) {
            activeRepo = null;

            UI.buttons(true, false);

            $("#div-branches-list, #tbody-diff-table").empty();
            drawCache.branches = "";
            drawCache.diffs = "";

            UI.dialog(
                "Something went wrong when loading configuration...",
                codify(err.message, true),
                true,
            );

            return;
        }
    }

    // Case 2 and 3 continued
    // Case 4: Refresh active repository

    if (activeRepo === null) {
        UI.dialog(
            "Configuration file damaged",
            "<p>Delete this repository or use DevTools to fix damaged configuration data.</p>",
            true,
        );

        return;
    }

    git.branches(config.active, (output, hasError, data) => {
        ipc.send("console log", { log: output });

        if (hasError) {
            UI.buttons(true, false);

            $("#div-branches-list, #tbody-diff-table").empty();
            drawCache.branches = "";
            drawCache.diffs = "";

            UI.dialog(
                "Something went wrong when loading branches...",
                codify(output, true),
                true,
            );

            return;
        }

        if (data !== drawCache.branches) {
            drawCache.branches = data;
            data = data.split("\n");
            UI.branches(data, switchBranch);
        }

        git.diff(config.active, (output, hasError, data) => {
            ipc.send("console log", { log: output });

            if (hasError) {
                UI.buttons(true, false);

                $("#div-branches-list, #tbody-diff-table").empty();
                drawCache.branches = "";
                drawCache.diffs = "";

                UI.dialog(
                    "Something went wrong when loading file changes...",
                    codify(output, true),
                    true,
                );

                return;
            }

            UI.buttons(false, false);

            if (data !== drawCache.diffs) {
                drawCache.diffs = data;
                data = data.split("\n");
                UI.diffTable(data, rollbackCallback, diffCallback, viewCallback);
            }

            UI.processing(false);
        });
    });

    // ----------------------------------------------------------------------------------------- //

};

// --------------------------------------------------------------------------------------------- //

const switchBranch = (name) => {
    let i = name.lastIndexOf("/");

    $("#modal-switch-branch-pre-branch").text(i > -1 ? name.substring(i + 1) : name);

    // Delete button only available for local branch
    if (name.includes("/"))
        $("#modal-switch-branch-btn-delete").hide();
    else
        $("#modal-switch-branch-btn-delete").show();

    $("#modal-switch-branch").modal("show");
};

// --------------------------------------------------------------------------------------------- //

const rollbackCallback = (file) => {
    $("#modal-rollback-pre-file-name").text(file);
    $("#modal-rollback").modal("show");
};

const diffCallback = (file) => {
    UI.processing(true);

    git.fileDiff(config.active, file, (output, hasError, data) => {
        ipc.send("console log", { log: output });

        if (hasError) {
            UI.dialog(
                "Something went wrong when loading difference...",
                codify(output, true),
                true,
            );
            return;
        }

        UI.dialog("File Difference", codify(data));
    });
};

const viewCallback = (file) => {
    UI.processing(true);

    ipc.once("show file in folder done", () => {
        UI.processing(false);
    });

    ipc.send("show file in folder", {
        file: path.join(config.active, file)
    });
};

// --------------------------------------------------------------------------------------------- //

$("#btn-menu-hard-reset").click(() => { // Force pull
    $("#modal-hard-reset-input-confirm").val("");

    if (activeRepo === null) {
        UI.dialog(
            "Configuration file damaged",
            "<p>Delete this repository or use DevTools to fix damaged configuration data.</p>",
            true,
        );
        return;
    }

    $("#modal-hard-reset-pre-rm-code").text(git.hardResetCmd(config.active));
    $("#modal-hard-reset").modal("show");
});

$("#btn-menu-pull").click(() => {
    $("#modal-pull").modal("show");
});

$("#btn-menu-sync").click(() => {
    $("#modal-sync").modal("show");
});

$("#btn-menu-commit").click(() => {
    $("#modal-commit").modal("show");
});

// Push does not have a modal

$("#btn-menu-revert").click(() => {
    $("#modal-revert").modal("show");
});

$("#btn-menu-force-push").click(() => {
    $("#modal-force-push-input-confirm").val("");
    $("#modal-force-push").modal("show");
});

// Refresh does not have a modal

// Status does not have a modal

$("#btn-menu-import").click(() => {
    $("#modal-import").modal("show");
});

$("#btn-menu-clone").click(() => {
    const data = clipboard.readText("plain/text");

    if (data.endsWith(".git")) {
        // See also keyup handler
        $("#modal-clone-input-address").val(data).trigger("keyup");
    }

    $("#modal-clone").modal("show");
});

$("#btn-menu-delete-repo").click(() => {
    $("#modal-delete-repo").modal("show");
});

$("#btn-menu-config").click(() => {
    $("#modal-config-input-name").val(config.name);
    $("#modal-config-input-email").val(config.email);
    $("#modal-config-input-savePW").prop("checked", config.savePW);
    $("#modal-config").modal("show");
});

// --------------------------------------------------------------------------------------------- //

$("#modal-hard-reset-input-confirm").on("keyup", () => { // Force pull confirmation button
    if ($("#modal-hard-reset-input-confirm").val() !== "confirm")
        return;

    UI.processing(true);

    $("#modal-hard-reset-input-confirm").val("");
    $("#modal-hard-reset").modal("hide");

    git.hardReset(activeRepo.directory, activeRepo.address, (output, hasError) => {
        ipc.send("console log", { log: output });

        if (hasError) {
            UI.dialog(
                "Something went wrong when force pulling...",
                codify(output, true),
                true,
            );
            return;
        }

        switchRepo(config.active, true);
    });
});

$("#modal-pull-btn-pull").click(() => {
    UI.processing(true);

    git.pull(config.active, (output, hasError) => {
        ipc.send("console log", { log: output });

        if (hasError) {
            UI.dialog("Something went wrong when pulling...", codify(output, true), true);
            return;
        }

        switchRepo(config.active, true);
    });
});

$("#modal-sync-btn-sync").click(() => {
    UI.processing(true);

    git.pull(config.active, (output, hasError) => {
        ipc.send("console log", { log: output });

        if (hasError) {
            UI.dialog("Something went wrong when pulling...", codify(output, true), true);
            return;
        }

        git.push(config.active, (output, hasError) => {
            ipc.send("console log", { log: output });

            if (hasError) {
                UI.dialog("Something went wrong when pushing...", codify(output, true), true);
                return;
            }

            switchRepo(config.active, true);
        });
    });
});

$("#modal-commit-btn-commit").click(() => {
    UI.processing(true);

    git.commit(config.active, getCommitMsg(), (output, hasError) => {
        ipc.send("console log", { log: output });

        if (hasError) {
            UI.dialog("Something went wrong when committing...", codify(output, true), true);
            return;
        }

        switchRepo(config.active, true);
    });
});

$("#modal-commit-btn-commit-push").click(() => {
    UI.processing(true);

    git.commit(config.active, getCommitMsg(), (output, hasError) => {
        ipc.send("console log", { log: output });

        if (hasError) {
            UI.dialog("Something went wrong when committing...", codify(output, true), true);
            return;
        }

        git.push(config.active, (output, hasError) => {
            ipc.send("console log", { log: output });

            if (hasError) {
                UI.dialog("Something went wrong when pushing...", codify(output, true), true);
                return;
            }

            switchRepo(config.active, true);
        });
    });
});

$("#modal-commit").on("shown.bs.modal", () => {
    $("#modal-commit-input-commit-message").focus();
});

$("#btn-menu-push").click(() => {
    UI.processing(true);

    git.push(config.active, (output, hasError) => {
        ipc.send("console log", { log: output });

        if (hasError) {
            UI.dialog("Something went wrong when pushing...", codify(output, true), true);
            return;
        }

        UI.processing(false);
    });
});

$("#modal-revert-btn-revert").click(() => {
    const commit = $("#modal-revert-input-commit").val();
    $("#modal-revert-input-commit").val("");

    UI.processing(true);

    git.revert(config.active, commit, (output, hasError) => {
        ipc.send("console log", { log: output });

        if (hasError) {
            UI.dialog("Something went wrong when reverting...", codify(output, true), true);
            return;
        }

        UI.processing(false);
    });
});

$("#modal-force-push-input-confirm").on("keyup", () => {
    if ($("#modal-force-push-input-confirm").val() !== "confirm")
        return;

    UI.processing(true);

    $("#modal-force-push-input-confirm").val("");
    $("#modal-force-push").modal("hide");

    git.forcePush(
        config.active,
        $("#div-branches-list").find(".active").text(),
        (output, hasError) => {
            ipc.send("console log", { log: output });

            if (hasError) {
                UI.dialog(
                    "Something went wrong when force pushing...",
                    codify(output, true),
                    true,
                );
                return;
            }

            UI.processing(false);
        },
    );
});

$("#btn-menu-refresh").click(() => {
    switchRepo(config.active, true);
});

$("#btn-menu-repo-status").click(() => {
    UI.processing(true);

    git.status(config.active, (output, hasError, data) => {
        ipc.send("console log", { log: output });

        if (hasError) {
            UI.dialog("Something went wrong when loading status...", codify(output, true), true);
            return;
        }

        UI.dialog("Repository Status", codify(data, true));
    });
});

$("#modal-import-btn-import").click(() => {
    UI.processing(true);

    let tempRepo = {
        address: $("#modal-import-input-address").val(),
        directory: $("#modal-import-input-directory").val()
    };

    $("#modal-import-input-address").val("");
    $("#modal-import-input-directory").val("");

    config.repos.push(tempRepo.directory);
    icons[tempRepo.directory] = $("<span>").addClass("glyphicon glyphicon-refresh");

    config.repos.sort();
    config.active = tempRepo.directory;

    localStorage.setItem(tempRepo.directory, JSON.stringify(tempRepo));
    localStorage.setItem("config", JSON.stringify(config));

    UI.buttons(null, false);
    UI.repos(config.repos, icons, config.active, switchRepo);

    switchRepo(config.active, true, true);
});

// Auto-fill clone directory
$("#modal-clone-input-address").on("keyup", (() => {
    const matcher = /([^/]*)\.git$/;
    return () => {
        const match = matcher.exec($("#modal-clone-input-address").val());
        if (match) {
            $("#modal-clone-input-directory").val(
                path.join(config.lastPath, match[match.length - 1]),
            );
        }
    };
})());

$("#modal-clone-btn-clone").click(() => {
    UI.processing(true);

    let tempRepo = {
        address: $("#modal-clone-input-address").val(),
        directory: $("#modal-clone-input-directory").val()
    };

    git.clone(tempRepo.directory, tempRepo.address, (output, hasError) => {
        ipc.send("console log", { log: output });

        if (hasError) {
            UI.dialog("Something went wrong when cloning...", codify(output, true), true);
            return;
        }

        config.repos.push(tempRepo.directory);
        icons[tempRepo.directory] = $("<span>").addClass("glyphicon glyphicon-refresh");

        config.repos.sort();
        config.lastPath = path.resolve(tempRepo.directory, "..");
        config.active = tempRepo.directory;

        localStorage.setItem(tempRepo.directory, JSON.stringify(tempRepo));
        localStorage.setItem("config", JSON.stringify(config));

        UI.buttons(null, false);
        UI.repos(config.repos, icons, config.active, switchRepo);

        switchRepo(config.active, true, true);
    });
});

$("#modal-delete-repo-btn-confirm").click(() => {
    UI.processing(true);

    localStorage.removeItem(config.active);

    let index = config.repos.indexOf(config.active);
    const deleted = config.repos.splice(index, 1);

    delete icons[deleted[0]];

    if (config.repos.length) {
        if (index !== 0)
            index--;

        config.active = config.repos[index];
        localStorage.setItem("config", JSON.stringify(config));

        UI.repos(config.repos, icons, config.active, switchRepo);
        switchRepo(config.active, true, true);
    } else {
        config.active = undefined;
        localStorage.setItem("config", JSON.stringify(config));

        $("#div-repos-list, #div-branches-list, #tbody-diff-table").empty();
        drawCache.branches = "";
        drawCache.diffs = "";

        UI.buttons(true, true);
        UI.processing(false);
    }
});

$("#modal-config-btn-save").click(() => {
    UI.processing(true);

    const name = $("#modal-config-input-name").val();
    const email = $("#modal-config-input-email").val();
    const savePW = $("#modal-config-input-savePW").is(":checked");

    git.config(name, email, savePW, (output, hasError) => {
        ipc.send("console log", { log: output });

        if (hasError) {
            // New configuration will be discarded
            UI.dialog(
                "Something went wrong when applying configuration...",
                codify(output, true),
                true,
            );
            return;
        }

        config.name = name;
        config.email = email;
        config.savePW = savePW;

        localStorage.setItem("config", JSON.stringify(config));

        UI.processing(false);
    });
});

// --------------------------------------------------------------------------------------------- //

$("#modal-rollback-btn-rollback").click(() => {
    const name = $("#modal-rollback-pre-file-name").text().trim();
    $("#modal-rollback-pre-file-name").text("");

    if (!name)
        return void console.assert(false);

    UI.processing(true);

    git.rollback(config.active, name, (output, hasError) => {
        if (hasError) {
            UI.dialog("Something went wrong when rolling back...", codify(output, true), true);
            return;
        }

        switchRepo(config.active, true);
    });
});

$("#modal-switch-branch-btn-switch").click(() => {
    const name = $("#modal-switch-branch-pre-branch").text().trim();
    $("#modal-switch-branch-pre-branch").text("");

    if (!name)
        return void console.assert(false);

    UI.processing(true);

    git.switchBranch(config.active, name, (output, hasError) => {
        ipc.send("console log", { log: output });

        if (hasError) {
            UI.dialog(
                "Something went wrong when switching branch...",
                codify(output, true),
                true,
            );
            return;
        }

        switchRepo(config.active, true);
    });
});

$("#modal-switch-branch-btn-delete").click(() => {
    const name = $("#modal-switch-branch-pre-branch").text().trim();
    $("#modal-switch-branch-pre-branch").text("");

    if (!name)
        return void console.assert(false);

    $("#modal-delete-branch-pre-branch").text(name);
    $("#modal-delete-branch").modal("show");
});

$("#modal-delete-branch-btn-confirm").click(() => {
    const name = $("#modal-delete-branch-pre-branch").text().trim();
    $("#modal-delete-branch-pre-branch").text("");

    if (!name)
        return void console.assert(false);

    UI.processing(true);

    git.deleteBranch(config.active, name, (output, hasError) => {
        ipc.send("console log", { log: output });

        if (hasError) {
            UI.dialog(
                "Something went wrong when deleting branch...",
                codify(output, true),
                true,
            );
            return;
        }

        switchRepo(config.active, true);
    });
});

// --------------------------------------------------------------------------------------------- //

$(document).on("keyup", (e) => {
    if (e.which === 123) { // F12
        ipc.send("dev-tools");
    } else if (e.which === 116) { // F5
        if (!UI.isProcessing && !isFetching)
            location.reload();
    }
});

$(document).on("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
}).on("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
});

// --------------------------------------------------------------------------------------------- //

console.log(
    "%cPlease be careful of what you execute in this console, it has access to your local file " +
    "system.",
    "color:red; font-size:large;",
);

// --------------------------------------------------------------------------------------------- //

window.onbeforeunload = (e) => {
    if (UI.isProcessing) {
        e.returnValue = false;
        return false;
    }

    if (isFetching) {
        UI.processing(true);
        window.onceFetchingDone = () => {
            UI.processing(false);
            window.close();
        };

        e.returnValue = false;
        return false;
    }
};

// --------------------------------------------------------------------------------------------- //

$(window).resize(() => {
    $("#div-main-container").height($(document.body).height() - 90);
    $("#modal-dialog-pre").css("max-height", $(document.body).height() - 240);
    $("#tbody-diff-table").css("max-height", $(document.body).height() - 150);
}).trigger("resize");

$(window).focus(() => {
    if (config.active && !$(".modal").is(":visible"))
        switchRepo(config.active, true);
    isFocused = true;
}).blur(() => {
    isFocused = false;
});

// --------------------------------------------------------------------------------------------- //

// Called from inline script
window.openProjectPage = () => {
    UI.processing(true);

    ipc.once("open project page done", () => {
        UI.processing(false);
    });

    ipc.send("open project page");
};

// --------------------------------------------------------------------------------------------- //

try {
    let tempConfig = JSON.parse(localStorage.getItem("config"));

    if (typeof tempConfig.savePW !== "boolean")
        throw new Error("Configuration Not Valid");

    if (typeof tempConfig.active !== "undefined" && typeof tempConfig.active !== "string")
        throw new Error("Configuration Not Valid");

    if (typeof tempConfig.repos !== "object")
        throw new Error("Configuration Not Valid");

    config = {
        lastPath: tempConfig.lastPath.toString(),
        name: tempConfig.name.toString(),
        email: tempConfig.email.toString(),
        savePW: tempConfig.savePW,
        active: tempConfig.active,
        repos: []
    };

    for (const repo of tempConfig.repos)
        config.repos.push(repo.toString());

    config.repos.sort();
} catch (err) {
    console.log(err);

    // Default configuration
    config = {
        lastPath: ipc.sendSync("get home"),
        name: "Alpha",
        email: "alpha@example.com",
        savePW: true,
        active: undefined,
        repos: [],
    };
}

if (config.repos.length) {
    if (config.repos.indexOf(config.active) < 0) {
        config.active = undefined;
        localStorage.setItem("config", JSON.stringify(config));
        UI.buttons(true, true);
    }

    for (const repo of config.repos)
        icons[repo] = $("<span>").addClass("glyphicon glyphicon-refresh");

    UI.repos(config.repos, icons, config.active, switchRepo);
} else {
    config.active = undefined;
    UI.buttons(true, true);
}

webFrame.setSpellCheckProvider("en", {
    spellCheck(words, callback) {
        const misspelled = [];

        if (spellcheckDict) {
            for (const word of words) {
                if (reAllDigits.test(word))
                    continue;

                if (binSearch(spellcheckDict, word.toLowerCase()) === -1)
                    misspelled.push(word);
            }
        }

        process.nextTick(callback, misspelled);
    },
});

fs.readFile(
    path.resolve(__dirname, "../vendor/debian.dict-8.7.txt"),
    "utf8",
    (err, data) => {
        if (err) {
            console.error(err);

            $("#modal-commit-spellcheck-load-state").html(
                "Could not load spellcheck dictionary, error logged to console.",
            );
            return;
        }

        spellcheckDict = data.split(/\r?\n/);
        $("#modal-commit-spellcheck-load-state").remove();
    },
);

git.config(config.name, config.email, config.savePW, (output, hasError) => {
    ipc.send("console log", { log: output });

    if (hasError) {
        UI.dialog(
            "Something went wrong when applying configuration...",
            codify(output, true),
            true,
        );
        return;
    }

    if (config.active)
        switchRepo(config.active, true, true);
    else
        UI.processing(false);
});

// --------------------------------------------------------------------------------------------- //

const updateIcon = (directory, status) => {
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
            icons[directory].removeClass().addClass("glyphicon glyphicon-remove");
            break;
        case "error":
            icons[directory].removeClass().addClass("glyphicon glyphicon-remove-circle");
            break;
    }
};

const refreshIcon = (directory) => {
    return new Promise((resolve) => {
        if (directory === config.active && activeRepo === null) {
            updateIcon(directory, "error");
            process.nextTick(resolve);
            return;
        }

        git.compare(directory, (result, output) => {
            ipc.send("console log", { log: output });

            if (directory === config.active && activeRepo === null)
                result = "error";

            if (icons[directory])
                updateIcon(directory, result);

            resolve();
        });
    });
};

const scheduleIconRefresh = (() => {
    let i = 0;
    const delay = 5 * 60 * 1000;

    return () => {
        const runTask = () => {
            if (config.repos.length === 0) {
                setTimeout(runTask, delay);
                return;
            }

            if (i >= config.repos.length)
                i = 0;

            let directory = config.repos[i];
            i++;

            if (directory === config.active && activeRepo === null) {
                updateIcon(directory, "error");
                process.nextTick(runTask);
                return;
            }

            isFetching = true;
            git.fetch(directory, (output, hasError) => {
                ipc.send("console log", { log: output });

                const cleanup = () => {
                    isFetching = false;

                    if (window.onceFetchingDone) {
                        const func = window.onceFetchingDone;
                        window.onceFetchingDone = null;
                        func();
                    }
                };

                if (hasError) {
                    if (icons[directory])
                        updateIcon(directory, "error");
                    cleanup();
                    return;
                }

                refreshIcon(directory).then(() => {
                    setTimeout(runTask, delay);
                });
                cleanup();
            });
        };

        setTimeout(runTask, delay);
    };
})();

// --------------------------------------------------------------------------------------------- //

window.onProcessingEnds = () => {
    if (config.active)
        refreshIcon(config.active);
};

(() => {
    let tasks = [];

    for (const repo of config.repos)
        tasks.push(refreshIcon(repo));

    Promise.all(tasks).then(() => {
        scheduleIconRefresh();
    });
})();

// --------------------------------------------------------------------------------------------- //

// jQuery and Bootstrap can sometimes be buggy, duct tape with setInterval for now

// Modal backdrops are not always removed
setInterval(() => {
    if (!isFocused)
        return;

    if ($(".modal").is(":visible") || $(".modal-backdrop.fade").length === 0)
        return;

    setTimeout(() => {
        if ($(".modal").is(":visible") || $(".modal-backdrop.fade").length === 0)
            return;

        $(".modal-backdrop.fade").each(function () {
            if ($(this).text().trim() !== "")
                return;

            $(this).remove();
            $(".modal").modal("hide");
        });
    }, 250);
}, 750);

// Modal can sometimes get stuck due to keyboard events
setInterval(() => {
    if (!UI.isProcessing && $("#modal-processing-screen").is(":visible")) {
        $("#modal-processing-screen").modal("hide");
    }
}, 1000);

// --------------------------------------------------------------------------------------------- //
