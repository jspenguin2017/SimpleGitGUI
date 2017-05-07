//The UI library for the renderer process
"use strict";

var UI = {};

//Open or hide the load screen
let processingImageFlag = true;
UI.processing = function (isProcessing) {
    $("#modal-processing-screen").modal(isProcessing ? "show" : "hide");
    if (isProcessing) {
        //Toggle loading image
        if (processingImageFlag) {
            $("#modal-processing-screen-img-1").hide();
            $("#modal-processing-screen-img-2").show();
        } else {
            $("#modal-processing-screen-img-1").show();
            $("#modal-processing-screen-img-2").hide();
        }
        processingImageFlag = !processingImageFlag;
    } else {
        //Call processing end callbacks
        let func;
        while (func = processingEndCallback.shift()) {
            func();
        }
    }
};
//These functions will be called once each next time processing ends
let processingEndCallback = [];
UI.onceProcessingEnds = function (func) {
    processingEndCallback.push(func);
};
//Check if processing is not done
UI.isBusy = function () {
    return $("#modal-processing-screen").data("bs.modal").isShown;
};

//Show a modal, can be information or error, message needs to be HTML string
UI.dialog = function (title, message, isError, isFatal) {
    //Update DOM and show modal
    $("#modal-dialog-title").text(title).css("color", isError ? "red" : "#333333");
    $("#modal-dialog-body").html(message);
    $("#modal-dialog-close").one("click", () => {
        if (isFatal) {
            window.close();
        } else {
            $("#modal-dialog").modal("hide");
        }
    });
    $("#modal-dialog").modal("show");
};

//Update buttons disable state, false for disable
UI.buttons = function (state) {
    $(".btn-action").prop("disabled", !state);
};

//Redraw repos list, a "No Repository" place holder will be set if names is empty
UI.repos = function (names, active, clickCallback) {
    if (names.length) {
        //Redraw repos list
        $("#div-repos-list").empty();
        for (let i = 0; i < names.length; i++) {
            let elem = $(`<button type="button" class="list-group-item repos-list-btn-switch-repo" data-index="${i}">${names[i]}</button>`);
            if (i === active) {
                elem.addClass("active");
            }
            $("#div-repos-list").append(elem);
        }
        //Bind event handler
        $(".repos-list-btn-switch-repo").click(function () {
            clickCallback($(this).data("index"));
        });
    } else {
        //Put in place holder
        $("#div-repos-list").html(`<button type="button" class="list-group-item disabled">No Repository</button>`);
    }
};

//Redraw branches list
UI.branches = function (names, active, callback) {
    $("#div-branches-list").empty();
    for (let i = 0; i < names.length; i++) {
        let elem = $(`<button type="button" class="list-group-item branches-list-btn-switch-branch" data-index="${i}">${names[i]}</button>`);
        if (i === active) {
            elem.addClass("active");
        }
        $("#div-branches-list").append(elem);
    }
    //Bind event handler
    $(".branches-list-btn-switch-branch").click(function () {
        callback($(this).data("index"));
    });
};

//Redraw diff table
UI.diffTable = function (data, rollbackCallback, diffCallback) {
    $("#tbody-diff-table").empty();
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        //Get a file name that Git accepts
        let fullFileName;
        if (row.directory === "/") {
            fullFileName = row.name;
        } else {
            fullFileName = row.directory.substring(1) + "/" + row.name;
        }
        $("#tbody-diff-table").append($("<tr>").append(
            $("<td>").html(row.name),
            $("<td>").html(row.directory),
            $("<td>").html(row.state[0]),
            $("<td>").html(row.state[1]),
            $("<td>").append(
                `<button type="button" class="btn btn-danger btn-group1 diff-table-btn-file-rollback" data-file="${fullFileName}"><span class="glyphicon glyphicon-repeat"></span> Rollback</button>`,
                `<button type="button" class="btn btn-primary btn-group1 diff-table-btn-file-diff" data-file="${fullFileName}"><span class="glyphicon glyphicon-list-alt"></span> Difference</button>`
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
};
