//The Git library for the main process
"use strict";

//Load utilities
const {exec} = require("child_process");
const TQ = require("./task-queue.js");

//Run a command
const execute = function (code, callback) {
    //Log the command to run
    console.log();
    console.log(code);
    //Execute the command
    exec(code, (err, stdout, stderr) => {
        //Log the output
        err && console.log(err.message);
        err && console.log(`Exit code: ${err.code}`);
        stderr && console.log(stderr);
        stdout && console.log(stdout);
        //Call callback
        callback(err, stdout, stderr);
    });
};

//Escape input
const escape = function (arg) {
    return arg.replace(/("|\\)/g, "\\$1");
};

//For all these functions, callback will be supplied the error object and/or the standard output stream if applies
//Initialize Git
exports.init = function (name, email, savePW, callback) {
    name = escape(name);
    email = escape(email);
    let tq = new TQ();
    //Connect
    tq.push(() => {
        execute("git --version", (err) => {
            if (err) {
                callback(err);
                tq.abort();
            } else {
                tq.tick();
            }
        });
    });
    //Set name and email
    tq.push(() => {
        exports.config(name, email, savePW, (err) => {
            if (err) {
                callback(err);
                tq.abort();
            } else {
                callback();
            }
        });
    });
    //Start the queue
    tq.tick();
};

//Pull, set mode to true for rebase
exports.pull = function (directory, mode, callback) {
    directory = escape(directory);
    if (mode) {
        mode = " --rebase=true";
    } else {
        mode = "";
    }
    //Execute
    execute(`git -C "${directory}" pull${mode}`, (err) => {
        callback(err);
    });
};

//Push a change
exports.push = function (directory, msgArray, callback) {
    directory = escape(directory);
    //We'll escape message later
    let tq = new TQ();
    //Stage
    tq.push(() => {
        execute(`git -C "${directory}" stage --verbose --all`, (err) => {
            if (err) {
                callback(err);
                tq.abort();
            } else {
                tq.tick();
            }
        });
    });
    //Commit
    tq.push(() => {
        let cmd = `git -C "${directory}" commit --verbose`;
        //Put in commit comments
        for (let i = 0; i < msgArray.length; i++) {
            cmd += ` --message="${escape(msgArray[i])}"`;
        }
        execute(cmd, (err) => {
            if (err) {
                callback(err);
                tq.abort();
            } else {
                tq.tick();
            }
        });
    });
    //Push
    tq.push(() => {
        execute(`git -C "${directory}" push --verbose`, (err) => {
            //Can't use --quiet because it will block more than just progress
            callback(err);
        });
    });
    //Start the queue
    tq.tick();
};
//Only push, no staging and committing
exports.pushOnly = function (directory, placeholder, callback) {
    directory = escape(directory);
    execute(`git -C "${directory}" push --verbose`, (err) => {
        //Can't use --quiet because it will block more than just progress
        callback(err);
    });
};

//Get the raw status
exports.getStatus = function (directory, callback) {
    directory = escape(directory);
    execute(`git -C "${directory}" status --untracked-files=all`, (err, stdout) => {
        callback(err, stdout);
    });
};

//Clone a repository
exports.clone = function (directory, address, callback) {
    directory = escape(directory);
    address = escape(address);
    execute(`git -C "${directory}" clone --quiet --verbose --depth 5 --no-single-branch --recurse-submodules --shallow-submodules "${address}" "${directory}"`, (err) => {
        //--quiet will only block progress, since output is shown at the end at once, progress doesn't help
        callback(err);
    });
};

//Update name, email, and password config
exports.config = function (name, email, savePW, callback) {
    name = escape(name);
    email = escape(email);
    let tq = new TQ();
    //Update name
    tq.push(() => {
        execute(`git config --global user.name "${name}"`, (err) => {
            if (err) {
                callback(err);
                tq.abort();
            } else {
                tq.tick();
            }
        });
    });
    //Update email
    tq.push(() => {
        execute(`git config --global user.email "${email}"`, (err) => {
            if (err) {
                callback(err);
                tq.abort();
            } else {
                tq.tick();
            }
        });
    });
    //Update credential helper
    tq.push(() => {
        const cmd = savePW ? `git config --global credential.helper store` : `git config --global --unset credential.helper`;
        execute(cmd, (err) => {
            if (savePW) {
                callback(err);
            } else {
                //Can't unset if it's not set, just ignore
                callback();
            }
        });
    });
    //Start the queue
    tq.tick();
};

//Get all branches
exports.getBranches = function (directory, callback) {
    directory = escape(directory);
    execute(`git -C "${directory}" branch --list --all`, (err, stdout) => {
        callback(err, stdout);
    });
};

//Get changed files
exports.getChanged = function (directory, callback) {
    directory = escape(directory);
    execute(`git -C "${directory}" status --porcelain --untracked-files=all`, (err, stdout) => {
        callback(err, stdout);
    });
};

//Get diff for one file
exports.getDiff = function (directory, file, callback) {
    directory = escape(directory);
    file = escape(file);
    execute(`git -C "${directory}" diff "${file}"`, (err, stdout) => {
        callback(err, stdout);
    });
};
