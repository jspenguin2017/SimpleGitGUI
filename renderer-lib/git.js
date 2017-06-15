//The Git library for the renderer process
//This file should be loaded with require()
"use strict";

//=====Load Utility Modules=====
const { exec } = require("child_process");
const fs = require("fs");

//=====Helper Functions=====
/**
 * Escape text to make it safe to be passed to exec (of child_process).
 * @function
 * @param {string} text - The text to escape.
 * @returns {string} The escaped text.
 */
const escape = (() => {
    const matcher = /("|\\)/g;
    const newLine = /\n/g;
    return (text) => {
        //Replace " and \ by \" and \\, and remove new lines
        //There should never be new lines if the user interface worked properly
        return text.replace(matcher, "\\$1").replace(newLine, "");
    };
})();
/**
 * Combine and format output.
 * @function
 * @param {string} code - The code that ran.
 * The next 3 arguments should be supplied by exec (of child_process).
 * @param {Error} err - The error object.
 * @param {string} stdout - The standard output.
 * @param {string} stderr - The standard error output.
 * @returns {string} The combined and formatted output.
 */
const format = (code, err, stdout, stderr) => {
    //Add what just ran
    let out = `>>> ${code}\n`;
    //Check if there is an error
    if (err) {
        if (err.code === undefined) {
            //JavaScript error
            out += `Error: ${err.message}`;
        } else {
            //Git error, add error code and standard error output
            out += `Error code: ${err.code}\nError: ${stderr}`;
        }
    } else {
        //There is no error, add standard error output and standard output if they are not empty
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
};
/**
 * Run code line by line, abort remaining lines if there is an error.
 * @function
 * @param {string|Array.<string>} lines - Line or lines of code to run.
 * @param {Function} callback - This function will be called once everything is done, formatted output and an error flag will be supplied.
 */
const run = (lines, callback) => {
    if (typeof lines === "string") {
        //One line, fast mode
        exec(lines, (err, stdout, stderr) => {
            callback(format(lines, err, stdout, stderr), Boolean(err));
        });
    } else {
        //Many lines, slow mode
        //Presistent variables (until all the lines of code are processed)
        let output = "";
        let index = 0;
        //Line runner
        const runner = () => {
            exec(lines[index], (err, stdout, stderr) => {
                //Format output, then run the next line
                output += format(lines[index], err, stdout, stderr);
                //Check if there is an error
                if (err) {
                    //Call callback with current output
                    callback(output, true);
                    return;
                } else {
                    //Increment counter
                    index++;
                    //Check if we are done
                    if (index === lines.length) {
                        callback(output, false);
                        return;
                    }
                }
                runner();
            });
        }
        //Start the line runner
        runner();
    }
};
/**
 * Run a line of code and send standard output as an array of lines (if there is no error) to the callback function.
 * @function
 * @param {string} code - The line of code to run.
 * @param {Function} callback - This function will be called once the execution ends, it will be supplied the formatted output and an error flag, also the lines of standard output if there is no error.
 */
const porcelain = (code, callback) => {
    //Run the code
    exec(code, (err, stdout, stderr) => {
        //See if there is an error, and call callback accordingly
        if (err) {
            callback(format(code, err, stdout, stderr), true);
        } else {
            callback(format(code, err, stdout, stderr), false, stdout);
        }
    });
};

//=====Exports Functions=====
//exports.forcePullCmd() and exports.forcePull()
(() => {
    /**
     * Prepare for force pull (hard reset), generate and save the command that will be used to remove the local repository.
     * @function
     * @param {string} directory - The directory of the active repository.
     * @returns {string} The generated command.
     */
    let rmCode = "";
    exports.forcePullCmd = (directory) => {
        //The command is different on Windows
        if (process.platform === "win32") {
            //Windows
            //This is an safety check to make sure the directory is not obviously bad
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
     * @param {Function} callback - This function will be called once everything is done, formatted output and an error flag will be supplied.
     */
    exports.forcePull = (directory, address, callback) => {
        //Check if the local repository removal command is initialized
        if (rmCode) {
            //It is initialized, remove the local directory using it
            exec(rmCode, (err, stdout, stderr) => {
                //Log the formatted output
                const output1 = format(rmCode, err, stdout, stderr);
                //Clear the saved command for safety
                rmCode = "";
                //We will not abort even if there is an error, since we want force pull (hard reset) to be able to handle cases where the local directory is gone
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
            //It is not initialized, this should not happen if the user interface worked properly
            callback("Local repository removal command is not initialized.", true);
        }
    };
})();
/**
 * Prune branches then pull.
 * @function
 * @param {string} directory - The directory of the active repository.
 * @param {Function} callback - This function will be called once everything is done, formatted output and an error flag will be supplied.
 */
exports.pull = (directory, callback) => {
    //Run the command
    run([
        `git -C "${escape(directory)}" remote --verbose prune origin`,
        `git -C "${escape(directory)}" pull --verbose`,
    ], callback);
};
/**
 * Do stage then commit.
 * @function
 * @param {string} directory - The directory of the active repository.
 * @param {Array.<string>} - The commit messages, one paragraph per element.
 * @param {Function} callback - This function will be called once everything is done, formatted output and an error flag will be supplied.
 */
exports.commit = (directory, messages, callback) => {
    //Prepare the commit command
    let cmd = `git -C "${escape(directory)}" commit --verbose`;
    //Put in commit comments
    for (let i = 0; i < messages.length; i++) {
        cmd += ` --message="${escape(messages[i])}"`;
    }
    //Run the commands
    run([
        `git -C "${escape(directory)}" stage --verbose --all`,
        cmd,
    ], callback);
};
/**
 * Do push.
 * @function
 * @param {string} directory - The directory of the active repository.
 * @param {Function} callback - This function will be called once everything is done, formatted output and an error flag will be supplied.
 */
exports.push = (directory, callback) => {
    //Run the command
    run(`git -C "${escape(directory)}" push --verbose`, callback);
};
/**
 * Do force push.
 * @function
 * @param {string} directory - The directory of the active repository.
 * @param {string} branch - The current branch.
 * @param {Function} callback - This function will be called once everything is done, formatted output and an error flag will be supplied.
 */
exports.forcePush = (directory, branch, callback) => {
    //Run the command
    run(`git -C "${escape(directory)}" push origin "${escape(branch)}" --force --verbose`, callback);
};
/**
 * Get repository status.
 * @function
 * @param {string} directory - The directory of the active repository.
 * @param {Function} callback - This function will be called once the execution ends, it will be supplied the formatted output and an error flag, also the standard output if there is no error.
 */
exports.status = (directory, callback) => {
    //Run the command
    porcelain(`git -C "${escape(directory)}" status --untracked-files=all`, callback);
};
/**
 * Do clone.
 * @function
 * @param {string} directory - The directory to clone into.
 * @param {string} address - The remote repository address.
 * @param {Function} callback - This function will be called once everything is done, formatted output and an error flag will be supplied.
 */
exports.clone = (directory, address, callback) => {
    //Create the directory
    fs.mkdir(directory, (err) => {
        //Try to clone even if there is an error, Git will not proceed unless the directory is empty, we do not need to check it
        run(`git -C "${escape(directory)}" clone --quiet --verbose --depth 5 --no-single-branch --recurse-submodules --shallow-submodules "${escape(address)}" "${escape(directory)}"`, callback);
    });
};
/**
 * Set configuration.
 * @function
 * @param {string} name - Name of the user.
 * @param {string} email - Email of the user.
 * @param {boolean} savePW - Whether or not credential helper should be used.
 * @param {Function} callback - This function will be called once everything is done, formatted output and an error flag will be supplied.
 */
exports.config = (name, email, savePW, callback) => {
    //Intermediate callback to handle credential helper
    const intermediate = (output, hasError) => {
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
                //Unsetting a configuration that is not set before results in an error, we do not want to show the error even if there is one
                callback(output, hasError);
            });
        }
    }
    //Run the commands
    run([
        `git config --global user.name "${escape(name)}"`,
        `git config --global user.email "${escape(email)}"`,
    ], intermediate);
};
/**
 * Get branches list.
 * @function
 * @param {string} directory - The directory of the active repository.
 * @param {Function} callback - This function will be called once the execution ends, it will be supplied the formatted output and an error flag, also the standard output if there is no error.
 */
exports.branches = (directory, callback) => {
    //Run the command
    porcelain(`git -C "${escape(directory)}" branch --list --all`, callback);
};
/**
 * Refresh changed files list
 * @function
 * @param {string} directory - The directory of the active repository.
 * @param {Function} callback - This function will be called once the execution ends, it will be supplied the formatted output and an error flag, also the standard output if there is no error.
 */
exports.diff = (directory, callback) => {
    //Run the command
    porcelain(`git -C "${escape(directory)}" status --porcelain --untracked-files=all`, callback);
};
/**
 * Switch branch.
 * @function
 * @param {string} directory - The directory of the active repository.
 * @param {string} branch - The branch to switch to.
 * @param {Function} callback - This function will be called once everything is done, formatted output and an error flag will be supplied.
 */
exports.switchBranch = (directory, branch, callback) => {
    //Run the command
    run(`git -C "${escape(directory)}" checkout "${escape(branch)}" --`, callback);
};
/**
 * Delete a local branch.
 * @function
 * @param {string} directory - The directory of the active repository.
 * @param {string} branch - The branch to delete.
 * @param {Function} callback - This function will be called once everything is done, formatted output and an error flag will be supplied.
 */
exports.deleteBranch = (directory, branch, callback) => {
    //Run the command
    run(`git -C "${escape(directory)}" branch --delete "${escape(branch)}"`, callback);
};
/**
 * Rollback a file.
 * @function
 * @param {string} directory - The directory of the active repository.
 * @param {string} file - The file to rollback.
 * @param {Function} callback - This function will be called once everything is done, formatted output and an error flag will be supplied.
 */
exports.rollback = (directory, file, callback) => {
    //Run the command
    run(`git -C "${escape(directory)}" checkout -- "${escape(file)}"`, callback);
};
/**
 * Get difference of one file as a patch.
 * @function
 * @param {string} directory - The directory of the active repository.
 * @param {string} file - The file in question.
 * @param {Function} callback - This function will be called once the execution ends, it will be supplied the formatted output and an error flag, also the standard output if there is no error.
 */
exports.fileDiff = (directory, file, callback) => {
    //Run the command
    porcelain(`git -C "${escape(directory)}" diff "${escape(file)}"`, callback);
};
/**
 * Fetch the remote directory.
 * @function
 * @param {string} directory - The directory of the repository to fetch.
 * @param {Function} callback - This function will be called once the execution ends, it will be supplied the formatted output and an error flag.
 */
exports.fetch = (directory, callback) => {
    run(`git -C "${escape(directory)}" fetch --verbose`, callback);
};
/**
 * Compare hashes of recent commits to see what is the status of the repository.
 * @function
 * @param {string} directory - The directory of the repository to compare.
 * @param {Function} callback - This function will be called once the execution ends, it will be supplied the formatted output and status.
 ** Status can be "up to date", "need pull", "need push", "diverged", or "error".
 */
exports.compare = (directory, callback) => {
    run([
        `git -C "${escape(directory)}" rev-parse @`,
        `git -C "${escape(directory)}" rev-parse @{upstream}`,
        `git -C "${escape(directory)}" merge-base @ @{upstream}`,
    ], (output, hasError) => {
        if (hasError) {
            callback("error", output);
        } else {
            //Extract hashes
            const lines = output.split("\n");
            let results = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line !== "" && !line.startsWith(">>>")) {
                    results.push(line);
                }
            }
            //Parse status, index 0 is local branch, 1 is remote branch, 2 is common ancestor
            if (results[0] === results[1]) {
                //Local is the same as remote, nothing to do
                callback("up to date", output);
            } else if (results[0] === results[2]) {
                //Remote branch is ahead, looks like this:
                //C for commit, L for last commit of local branch, R for last commit of remote branch
                // --C--C--L
                //          \
                //           R--C
                callback("need pull", output);
            } else if (results[1] === results[2]) {
                //Local branch is ahread, looks like this:
                //           L--C
                //          /
                // --C--C--R
                callback("need push", output);
            } else {
                //All three are different, looks like this:
                //A for common ancestor
                //           L--C
                //          /
                // --C--C--A
                //          \
                //           R--C--C
                //This can be fixed with synchronize if there is no conflict
                callback("diverged", output);
            }
        }
    });
};
