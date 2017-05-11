//The Git library for the renderer process
"use strict";

//=====Load Utility Modules=====
const {exec} = require("child_process");
const fs = require("fs");

//=====Helper Functions=====
/**
 * Escape text to make it safe to be passed to exec (of child_process).
 * @function
 * @param {string} text - The text to escape.
 * @returns {string} The escaped text.
 */
const escape = function (text) {
    //Replace " and \ by \" and \\, and remove new lines
    return text.replace(/("|\\)/g, "\\$1").replace(/\n/g, "");
};
/**
 * Combine and format output.
 * @function
 * @param {string} code - The code that ran.
 * The next 3 arguments are supplied by exec (of child_process).
 * @param {*} err - The error object.
 * @param {string} stdout - The standard output.
 * @param {string} stderr - The standard error output.
 * @returns {string} The combined and formatted output.
 */
const format = function (code, err, stdout, stderr) {
    //Add what just ran
    let out = `>>> ${code}\n`;
    //Check if there is an error
    if (err) {
        //It has an error, add error code and standard error output.
        out += `Error code: ${err.code}\n${stderr}`;
    } else {
        //There is no error, add standard output and standard error output if they are not empty
        //We need to add standard error output since Git sends some information there
        if (stderr.length) {
            out += `${stderr}\n`;
        }
        if (stdout.length) {
            out += `${stdout}\n`;
        }
    }
    //Return the processed output
    return out;
}
/**
 * Run code line by line, abort remaining lines if there is an error.
 * @function
 * @param {Array.<string>} lines - Lines of code to run.
 * @param {Function} callback - This function to call once everything is done, it will be supplied a formatted output and an error flag.
 */
const run = function (lines, callback) {
    //Presistent variables (until all the lines of code are processed)
    let output = "";
    let hasError = false;
    //Line runner
    const runner = function () {
        //Get a line
        let line = lines.shift();
        //Check if we have any lines left
        if (line) {
            //We still have code to run
            exec(line, (err, stdout, stderr) => {
                //Check if there is an error
                if (err) {
                    //Update flag
                    hasError = true;
                    //Abort other lines
                    lines = [];
                    //Line runner will be called again later to send information back to callback
                }
                //Format output, then run the next line
                output += format(line, err, stdout, stderr);
                runner();
            });
        } else {
            //No more line to run, call callback
            callback(output, hasError);
        }
    }
    //Start the line runner
    runner();
};
/**
 * Run a line of code and return standard output as an array of lines if there is no error.
 * @function
 * @param {string} code - The line of code to run.
 * @param {Function} callback - The function to call once the execution ends, it will be supplied the formatted output, an error flag, and the lines of standard output if there is no error.
 */
const porcelain = function (code, callback) {
    //Run the code
    exec(code, (err, stdout, stderr) => {
        //See if there is an error, and call callback accordingly
        if (err) {
            callback(format(code, err, stdout, stderr), true);
        } else {
            callback(format(code, err, stdout, stderr), false, stdout.split("\n"));
        }
    });
};

//=====Exports Functions=====
/**
 * Prepare for force pull (hard reset), generate and save the command that will be used to remove the local repository.
 * @function
 * @param {string} directory - The directory of the active repository.
 * @returns {string} The generated command.
 */
let rmCode = "";
exports.forcePullCmd = function (directory) {
    //The command is different on Windows
    if (process.platform === "win32") {
        //Windows
        //This is an safety check to make sure directory is not obviously bad
        if (directory.length > 3) {
            rmCode = `RMDIR /S /Q "${escape(directory)}"`;
        } else {
            rmCode = "";
        }
    } else {
        //Linux and Mac
        //This is an safety check to make sure directory is not obviously bad
        if (directory.length > 1) {
            rmCode = `rm -rf "${escape(directory)}"`;
        } else {
            rmCode = "";
        }
    }
    return rmCode;
};
/**
 * Do force pull (hard reset).
 * @function
 * @param {string} directory - The directory of the active repository.
 * @param {string} address - The adress of the active repository.
 * @param {Function} callback - The function to call once everything is done, it will be supplied a formatted output and an error flag.
 */
exports.forcePull = function (directory, address, callback) {
    //Check if the local repository removal command is initialized
    if (rmCode) {
        //It is initialized, start by remove the local directory
        exec(rmCode, (err, stdout, stderr) => {
            //Log the formatted output
            const output1 = format(rmCode, err, stdout, stderr);
            //Clear the saved command for safety
            rmCode = "";
            //We will not abort even if there is an error, since we want force pull (hard reset) to be able to handle cases where the local repository is gone
            //Whether or not the local repository is successfully removed will be checked when we create the directory
            fs.mkdir(directory, (err) => {
                //Check if we were able to create the directory
                if (err) {
                    //Could not create directory, show error message then abort
                    callback(`Could not create local repository directory: \n${err.message}\n`, true);
                } else {
                    //Clone the repository again
                    run([`git -C "${escape(directory)}" clone --quiet --verbose --depth 1 --no-single-branch --recurse-submodules --shallow-submodules "${escape(address)}" "${escape(directory)}"`], (output2, hasError) => {
                        callback(output1 + output2, hasError);
                    });
                }
            });
        });
    } else {
        //It is not initialized, this should not happen unless there is a bug in the user interface
        callback("Local repository removal command is not initialized. ", true);
    }
};
/**
 * Do pull.
 * @function
 * @param {string} directory - The directory of the active repository.
 * @param {Function} callback - The function to call once everything is done, it will be supplied a formatted output and an error flag.
 */
exports.pull = function (directory, callback) {
    //Run the command
    run([`git -C "${escape(directory)}" pull --verbose`], callback);
};
/**
 * Do commit.
 * @function
 * @param {string} directory - The directory of the active repository.
 * @param {Array.<string>} - The commit messages, one paragraph per element.
 * @param {Function} callback - The function to call once everything is done, it will be supplied a formatted output and an error flag.
 */
exports.commit = function (directory, messages, callback) {
    let cmd = `git -C "${escape(directory)}" commit --verbose`;
    //Put in commit comments
    for (let i = 0; i < messages.length; i++) {
        cmd += ` --message="${escape(messages[i])}"`;
    }
    //Run the command
    run([`git -C "${escape(directory)}" stage --verbose --all`, cmd], callback);
};
/**
 * Do push.
 * @function
 * @param {string} directory - The directory of the active repository.
 * @param {Function} callback - The function to call once everything is done, it will be supplied a formatted output and an error flag.
 */
exports.push = function (directory, callback) {
    //Run the command
    run([`git -C "${escape(directory)}" push --verbose`], callback);
};
/**
 * Do force push.
 * @function
 * @param {string} directory - The directory of the active repository.
 * @param {string} branch - The current branch.
 * @param {Function} callback - The function to call once everything is done, it will be supplied a formatted output and an error flag.
 */
exports.forcePush = function (directory, branch, callback) {
    //Run the command
    run([`git -C "${escape(directory)}" push origin "${escape(branch)}" --force --verbose`], callback);
};
/**
 * Get repository status.
 * @function
 * @param {string} directory - The directory of the active repository.
 * @param {Function} callback - The function to call once everything is done, it will be supplied the formatted output, an error flag, and the lines of standard output if there is no error.
 */
exports.status = function (directory, callback) {
    //Run the command
    porcelain(`git -C "${escape(directory)}" status --untracked-files=all`, callback);
};
/**
 * Do clone.
 * @function
 * @param {string} directory - The directory to clone into.
 * @param {string} address - The remote repository address.
 * @param {Function} callback - The function to call once everything is done, it will be supplied a formatted output and an error flag.
 */
exports.clone = function (directory, address, callback) {
    //Create the directory
    fs.mkdir(directory, (err) => {
        //Try to clone even if there is an error, Git will not proceed unless the directory is empty
        run([`git -C "${escape(directory)}" clone --quiet --verbose --depth 5 --no-single-branch --recurse-submodules --shallow-submodules "${escape(address)}" "${escape(directory)}"`], callback);
    });
};
/**
 * Set configuration
 * @function
 * @param {string} name - Name of the user.
 * @param {string} email - Email of the user.
 * @param {boolean} savePW - Whether or not credential helper should be used.
 * @param {Function} callback - The function to call once everything is done, it will be supplied a formatted output and an error flag.
 */
exports.config = function (name, email, savePW, callback) {
    //Intermediate callback to handle credential helper
    const intermediate = function (output, hasError) {
        //Check if there is already an error
        if (hasError) {
            //There is, return error message and abort
            callback(output, hasError);
        } else {
            //There isn not, run the command
            let code = savePW ? `git config --global credential.helper store` : `git config --global --unset credential.helper`;
            exec(code, (err, stdout, stderr) => {
                //Format the output
                output += format(code, err, stdout, stderr);
                //Unsetting without being set before results in an error, we do not want to show it
                callback(output, hasError);
            });
        }
    }
    //Run the commands
    run([
        `git config --global user.name "${escape(name)}"`,
        `git config --global user.email "${escape(email)}"`
    ], intermediate);
};
/**
 * Get branches list.
 * @function
 * @param {string} directory - The directory to clone into.
 * @param {Function} callback - The function to call once everything is done, it will be supplied the formatted output, an error flag, and the lines of standard output if there is no error.
 */
exports.branches = function (directory, callback) {
    //Run the command
    porcelain(`git -C "${escape(directory)}" branch --list --all`, callback);
};
/**
 * Refresh changed files list
 * @function
 * @param {string} directory - The directory to clone into.
 * @param {Function} callback - The function to call once everything is done, it will be supplied the formatted output, an error flag, and the lines of standard output if there is no error.
 */
exports.diff = function (directory, callback) {
    porcelain(`git -C "${escape(directory)}" status --porcelain --untracked-files=all`, callback);
};
/**
 * Switch branch.
 * @function
 * @param {string} directory - The directory to clone into.
 * @param {string} branch - The branch to switch to.
 * @param {Function} callback - The function to call once everything is done, it will be supplied a formatted output and an error flag.
 */
exports.switchBranch = function (directory, branch, callback) {
    run([`git -C "${escape(directory)}" checkout ${escape(branch)} --`], callback);
};
/**
 * Rollback a file.
 * @function
 * @param {string} directory - The directory to clone into.
 * @param {string} file - The file to rollback.
 * @param {Function} callback - The function to call once everything is done, it will be supplied a formatted output and an error flag.
 */
exports.rollback = function (directory, file, callback) {
    run([`git -C "${escape(directory)}" checkout -- ${escape(file)}`], callback);
};
/**
 * Get difference of one file as a patch.
 * @function
 * @param {string} directory - The directory to clone into.
 * @param {string} file - The file in question.
 * @param {Function} callback - The function to call once everything is done, it will be supplied the formatted output, an error flag, and the lines of standard output if there is no error.
 */
exports.fileDiff = function (directory, file, callback) {
    porcelain(`git -C "${escape(directory)}" diff "${escape(file)}"`, callback);
};
