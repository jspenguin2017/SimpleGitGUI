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

// Renderer user interface library

// --------------------------------------------------------------------------------------------- //

"use strict";

// --------------------------------------------------------------------------------------------- //

var UI = {};

// --------------------------------------------------------------------------------------------- //

(() => {
    // Last shown image
    let processingImageFlag = false;

    UI.isProcessing = null;

    UI.processing = (isProcessing) => {
        if (isProcessing === UI.isProcessing)
            return;

        UI.isProcessing = isProcessing;
        $("#modal-processing-screen").modal(isProcessing ? "show" : "hide");

        if (isProcessing) {
            if (processingImageFlag) {
                $("#modal-processing-screen-img-1").hide();
                $("#modal-processing-screen-img-2").show();
            } else {
                $("#modal-processing-screen-img-1").show();
                $("#modal-processing-screen-img-2").hide();
            }

            processingImageFlag = !processingImageFlag;
        } else {
            window.onProcessingEnds();
        }
    };
})();

// --------------------------------------------------------------------------------------------- //

UI.dialog = (title, message, isError) => {
    UI.processing(false);

    $("#modal-dialog-title").text(title).css("color", isError ? "red" : "#333");
    $("#modal-dialog-body").html(message);

    $("#modal-dialog-pre").css("max-height", $(document.body).height() - 240);

    $("#modal-dialog").modal("show");
};

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

// --------------------------------------------------------------------------------------------- //

UI.repos = (directories, icons, active, switchCallback) => {
    $("#div-repos-list").empty();

    for (const repo of directories) {
        const index = Math.max(repo.lastIndexOf("/"), repo.lastIndexOf("\\"));

        let elem = $(
            '<button type="button" class="list-group-item repos-list-btn-switch-repo"></button>',
        );
        elem = elem.append(icons[repo]).append(
            document.createTextNode(" " + repo.substring(index + 1)),
        );
        elem = elem.data("directory", repo);

        if (repo === active)
            elem.addClass("active");

        $("#div-repos-list").append(elem);
    }

    $(".repos-list-btn-switch-repo").click(function () {
        $(this).addClass("active").siblings().removeClass("active");
        switchCallback($(this).data("directory"));
    });
};

// --------------------------------------------------------------------------------------------- //

UI.branches = (() => {
    const isHead = /\/HEAD -> .*\//;

    return (data, switchCallback) => {
        let names = [];
        let active;

        for (let i = 0; i < data.length; i++) {
            if (data[i].startsWith("*")) {
                data[i] = data[i].substring(1);
                active = data[i].trim();
            }

            let temp = data[i].trim();
            temp && names.push(temp);
        }

        $("#div-branches-list").empty();

        for (const branch of names) {
            let elem = $(`<button type="button" class="list-group-item"></button>`)
                .text(branch)
                .data("name", branch);

            if (isHead.test(elem.text()) || branch === active)
                elem.addClass("disabled");
            else
                elem.addClass("btn-action branches-list-btn-switch-branch");

            if (branch === active)
                elem.addClass("active");

            $("#div-branches-list").append(elem);
        }

        $(".branches-list-btn-switch-branch").click(function () {
            switchCallback($(this).data("name"));
        });
    };
})();

UI.diffTable = (data, rollbackCallback, diffCallback, viewCallback) => {
    let changedFiles = [];

    for (const f of data) {
        if (!f)
            continue;

        let file = f.substring(2).trim();

        // TODO: What happens if " -> " is part of a file name?
        let index = file.indexOf(" -> ");
        if (index > -1)
            file = file.substring(index + 4);

        if (file.startsWith("\""))
            file = file.slice(1, -1);

        index = file.lastIndexOf("/");
        let name, directory;

        if (index === -1) {
            name = file;
            directory = "/";
        } else {
            name = file.slice(index).substring(1);
            directory = file.substring(0, index);
        }

        let filedata = {
            fullName: file,
            name: name,
            directory: directory,
            state: [] // Remote, local
        };

        for (let j = 0; j < 2; j++) {
            switch (f.charAt(j)) {
                case ' ':
                    filedata.state.push("Unchanged");
                    break;
                case 'A':
                    filedata.state.push("Created");
                    break;
                case 'M':
                    filedata.state.push("Changed");
                    break;
                case 'D':
                    filedata.state.push("Deleted");
                    break;
                case 'R':
                    filedata.state.push("Renamed");
                    break;
                case 'C':
                    filedata.state.push("Copied");
                    break;
                case 'U':
                    filedata.state.push("Unmerged");
                    break;
                case '?':
                    filedata.state.push("Untracked");
                    break;
                default:
                    // This should not happen
                    filedata.state.push(`UNKNOWN: ${files[i].charAt(j)}`);
                    break;
            }
        }

        changedFiles.push(filedata);
    }

    $("#tbody-diff-table").empty();

    for (const file of changedFiles) {
        $("#tbody-diff-table").append($("<tr>").append(
            $("<td>").text(file.name),
            $("<td>").text(file.directory),
            $("<td>").text(file.state[0]),
            $("<td>").text(file.state[1]),
            $("<td>").append(
                $(
                    '<button type="button" class="btn btn-danger btn-group1 ' +
                    'diff-table-btn-file-rollback"><span class="glyphicon glyphicon-repeat">' +
                    '</span> Rollback</button>',
                ).data("file", file.fullName),
                $(
                    '<button type="button" class="btn btn-primary btn-group1 ' +
                    'diff-table-btn-file-diff"><span class="glyphicon glyphicon-list-alt">' +
                    '</span> Difference</button>',
                ).data("file", file.fullName),
                $(
                    '<button type="button" class="btn btn-success btn-group1 ' +
                    'diff-table-btn-file-view"><span class="glyphicon glyphicon-folder-open">' +
                    '</span> View</button>',
                ).data("file", file.fullName),
            ),
        ));
    }

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

// --------------------------------------------------------------------------------------------- //
