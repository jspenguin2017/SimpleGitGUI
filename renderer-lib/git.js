//The Git library for the renderer process
"use strict";

const {exec} = require("child_process");
const fs = require("fs");

//Escape argument
const escape = function (text) {
    return text.replace(/("|\\)/g, "\\$1");
};

const format = function (code, err, stdout, stderr) {
    let out = `>>> ${code}\n`;
    if (err) {
        out += `Error code: ${err.code}\n${stderr}`;
    } else if (stdout.length) {
        //Git sometimes send output to standard error stream
        let temp = "";
        if (stderr.length) {
            temp = `${stderr}\n`;
        }
        out += `${temp}${stdout}\n`;
    }
    return out;
}

//Run code line by line
const run = function (lines, callback) {
    let output = "";
    let hasError = false;
    //Line runner
    const runner = function () {
        let line;
        if (line = lines.shift()) {
            //We still have code to run
            exec(line, (err, stdout, stderr) => {
                if (err) {
                    hasError = true;
                    //Abort other commands
                    lines = [];
                }
                output += format(line, err, stdout, stderr);
                runner();
            });
        } else {
            callback(output, hasError);
        }
    }
    runner();
};

//Run code and return lines of standard output stream as an array
const porcelain = function (code, callback) {
    exec(code, (err, stdout, stderr) => {
        if (err) {
            callback(format(code, err, stdout, stderr), true);
        } else {
            callback(format(code, err, stdout, stderr), false, stdout.split("\n"));
        }
    });
};

//Force pull, prepare local repo remove command
let rmCode = "";
exports.forcePullCmd = function (directory) {
    //We'll check if directory is obviously bad
    if (process.platform === "win32") {
        //Windows
        if (directory.length > 3) {
            rmCode = `RMDIR /S /Q "${escape(directory)}"`;
        } else {
            rmCode = "";
        }
    } else {
        //Linux and Mac
        if (directory.length > 1) {
            rmCode = `rm -rf "${escape(directory)}"`;
        } else {
            rmCode = "";
        }
    }
    return rmCode;
};
//Force pull
exports.forcePull = function (directory, address, callback) {
    if (rmCode) {
        exec(rmCode, (err, stdout, stderr) => {
            const output1 = format(rmCode, err, stdout, stderr);
            rmCode = "";
            //We'll try to clone even if the command above failed
            fs.mkdir(directory, (err) => {
                //We'll still try to clone even if creating directory failed
                run([`git -C "${escape(directory)}" clone --quiet --verbose --depth 1 --no-single-branch --recurse-submodules --shallow-submodules "${escape(address)}" "${escape(directory)}"`], (output2, hasError) => {
                    callback(output1 + output2, hasError);
                });
            });
        });
    } else {
        callback("Local repository removal command is not initialized. ", true);
    }
};

//Pull
exports.pull = function (directory, callback) {
    run([`git -C "${escape(directory)}" pull --verbose`], callback);
};

//Commit
exports.commit = function (directory, messages, callback) {
    let cmd = `git -C "${escape(directory)}" commit --verbose`;
    //Put in commit comments
    for (let i = 0; i < messages.length; i++) {
        cmd += ` --message="${escape(messages[i])}"`;
    }
    //Run the command
    run([`git -C "${escape(directory)}" stage --verbose --all`, cmd], callback);
};

//Push
exports.push = function (directory, callback) {
    run([`git -C "${escape(directory)}" push --verbose`], callback);
};

//Force push
exports.forcePush = function (directory, branch, callback) {
    run([`git -C "${escape(directory)}" push origin "${escape(branch)}" --force --verbose`], callback);
};

//Status
exports.status = function (directory, callback) {
    porcelain(`git -C "${escape(directory)}" status --untracked-files=all`, callback);
};

//Clone
exports.clone = function (directory,address, callback) {
    fs.mkdir(directory, (err) => {
        //We'll ignore error and try to clone anyway, Git won't proceed unless the directory is empty
        run([`git -C "${escape(directory)}" clone --quiet --verbose --depth 5 --no-single-branch --recurse-submodules --shallow-submodules "${escape(address)}" "${escape(directory)}"`], callback);
    });
};

//Set config
exports.config = function (name, email, savePW, callback) {
    //Intermediate callback to handle savePW config
    const intermediate = function (output, hasError) {
        if (hasError) {
            callback(output, hasError);
        } else {
            let code = savePW ? `git config --global credential.helper store` : `git config --global --unset credential.helper`;
            exec(code, (err, stdout, stderr) => {
                output += format(code, err, stdout, stderr);
                callback(output, hasError);
            });
        }
    }
    //Run code
    run([
        `git config --global user.name "${escape(name)}"`,
        `git config --global user.email "${escape(email)}"`
    ], intermediate);
};

//Refresh branches list
exports.branches = function (directory, callback) {
    porcelain(`git -C "${escape(directory)}" branch --list --all`, callback);
};

//Refresh changed files list
exports.diff = function (directory, callback) {
    porcelain(`git -C "${escape(directory)}" status --porcelain --untracked-files=all`, callback);
};

//Rollback a file
exports.rollback = function (directory, file, callback) {
    run([`git -C "${escape(directory)}" checkout -- ${escape(file)}`], callback);
};

//Get diff of one file
exports.fileDiff = function (directory, file, callback) {
    porcelain(`git -C "${escape(directory)}" diff "${escape(file)}"`, callback);
};
