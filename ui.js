//The UI library for the renderer process
"use strict";

var UI = {};

//Open or hide the load screen
let processingImageFlag = true;
UI.processing = function (isProcessing) {
    $("#loading-modal").modal(isProcessing ? "show" : "hide");
    if (isProcessing) {
        //Toggle loading image
        if (processingImageFlag) {
            $("#processing-1").hide();
            $("#processing-2").show();
        } else {
            $("#processing-1").show();
            $("#processing-2").hide();
        }
        processingImageFlag = !processingImageFlag;
    } else {
        //Call callbacks
        let func;
        while (func = processingEndCallback.shift()) {
            func();
        }
    }
};

//These functions will be called once each next time processing ends
let processingEndCallback = [];
UI.onceProcessingEnd = function (func) {
    processingEndCallback.push(func);
};

//Check if is busy
UI.isBusy = function () {
    return $("#loading-modal").data("bs.modal").isShown;
};

//Show a modal, can be information or error
UI.dialog = function (title, message, isError, isFatal) {
    if (isFatal) {
        message += "<br>More information is logged to the console, please open it now if you wish to debug it, or click OK to exit this software. ";
    } else if (isError) {
        message += "<br>More information is logged to the console. Please try again later. ";
    }
    //Update DOM and show modal
    $("#message-title").text(title).css("color", isError ? "red" : "#333333");
    $("#message-body").html(`<p>${message}</p>`);
    $("#message-btn-ok").one("click", () => {
        if (isFatal) {
            window.close();
        } else {
            $("#message-modal").modal("hide");
        }
    });
    //Make code block scroll
    $(window).trigger("resize");
    $("#message-modal").modal("show");
};

//Update buttons disable state, false for disable
//Group 1 is push, pull, and other action buttons, they should be locked when there is an error
//Group 2 is refresh delete, they should only be locked when there is no more repository
UI.buttons = function (group1, group2) {
    if (typeof group1 === "boolean") {
        $(".git-group1-btn").prop("disabled", !group1);
        if (group1) {
            $(".list-group-item.branches-list-btn").removeClass("disabled");
        } else {
            $(".list-group-item.branches-list-btn").addClass("disabled");
        }
    }
    if (typeof group2 === "boolean") {
        $(".git-group2-btn").prop("disabled", !group1);
    }
};

//Redraw repos list, a "No Repository" place holder will be set if names is empty
UI.repos = function (names, active, clickCallback) {
    if (names.length) {
        //Redraw repos list
        $("#repos-list").empty();
        for (let i = 0; i < names.length; i++) {
            let elem = $(`<button type="button" class="list-group-item repos-list-btn" data-index="${i}">${names[i]}</button>`);
            if (i === active) {
                elem.addClass("active");
            }
            $("#repos-list").append(elem);
        }
        //Bind event handler
        $(".repos-list-btn").click(function () {
            clickCallback($(this).data("index"));
        });
    } else {
        //Put in place holder
        $("#repos-list").html(`<button type="button" class="list-group-item disabled">No Repository</button>`);
    }
};

//Redraw branches list
UI.branches = function (names, active) {
    $("#branches-list").empty();
    for (let i = 0; i < names.length; i++) {
        let elem = $(`<button type="button" class="list-group-item branches-list-btn" data-index="${i}">${names[i]}</button>`);
        if (i === active) {
            elem.addClass("active");
        }
        $("#branches-list").append(elem);
    }
    //Bind event handler
    $(".branches-list-btn").click(function () {
        //TODO!
        //console.log($(this).data("index"));
    });
};

//Redraw diff table
UI.diffTable = function (data, rollbackCallback, diffCallback) {
    $("#diff-table").empty();
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        //Get a file name that Git accepts
        let fullFileName;
        if (row.directory === "/") {
            fullFileName = row.name;
        } else {
            fullFileName = row.directory.substring(1) + "/" + row.name;
        }
        $("#diff-table").append($("<tr>").append(
            $("<td>").html(row.name),
            $("<td>").html(row.directory),
            $("<td>").html(row.state[0]),
            $("<td>").html(row.state[1]),
            $("<td>").append(
                `<button type="button" class="btn btn-danger git-group1-btn file-rollback-btn" data-file="${fullFileName}"><span class="glyphicon glyphicon-repeat"></span> Rollback</button>`,
                `<button type="button" class="btn btn-primary git-group1-btn file-diff-btn" data-file="${fullFileName}"><span class="glyphicon glyphicon-list-alt"></span> View Difference</button>`
            )
        ));
    }
    //Bind event handlers
    $(".file-rollback-btn").click(function () {
        //TODO!
        //console.log($(this).data("file"));
    });
    $(".file-diff-btn").click(function () {
        diffCallback($(this).data("file"));
    });
};
