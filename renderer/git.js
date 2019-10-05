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

// Renderer Git library

// --------------------------------------------------------------------------------------------- //

"use strict";

// --------------------------------------------------------------------------------------------- //

const { exec } = require("child_process");
const fs = require("fs");

// --------------------------------------------------------------------------------------------- //

const escape = (() => {
    const matcher = /("|\\)/g;
    const newLine = /\n/g;

    return (text) => {
        // There should never be new lines, but just in case
        return text.replace(matcher, "\\$1").replace(newLine, "");
    };
})();

const format = (code, err, stdout, stderr) => {
    let out = ">>> " + code + "\n";

    if (err) {
        if (err.code === undefined)
            out += "Error: " + err.message;
        else
            out += "Error code: " + err.code + "\nError: " + stderr;
    } else {
        if (stderr.length)
            out += stderr + "\n";

        if (stdout.length)
            out += stdout + "\n";
    }

    return out;
};

// --------------------------------------------------------------------------------------------- //

// TODO: Should use child_process.spawn

const run = (lines, callback) => {
    if (typeof lines === "string") {
        exec(lines, (err, stdout, stderr) => {
            callback(format(lines, err, stdout, stderr), Boolean(err));
        });
        return;
    }

    let output = "";
    let index = 0;

    const runner = () => {
        exec(lines[index], (err, stdout, stderr) => {
            output += format(lines[index], err, stdout, stderr);

            if (err) {
                callback(output, true);
                return;
            }

            index++;
            if (index === lines.length) {
                callback(output, false);
                return;
            }

            runner();
        });
    };

    runner();
};

const porcelain = (code, callback) => {
    exec(code, (err, stdout, stderr) => {
        if (err) {
            callback(format(code, err, stdout, stderr), true);
            return;
        }

        callback(format(code, err, stdout, stderr), false, stdout);
    });
};

// --------------------------------------------------------------------------------------------- //

(() => {
    let rmCode = "";

    exports.forcePullCmd = (directory) => {
        if (process.platform === "win32") {
            if (directory.length > 3)
                rmCode = `RMDIR /S /Q "${escape(directory)}"`;
            else
                rmCode = "";
        } else {
            if (directory.length > 1)
                rmCode = `rm -rf "${escape(directory)}"`;
            else
                rmCode = "";
        }
        return rmCode;
    };

    exports.forcePull = (directory, address, callback) => {
        if (!rmCode) {
            callback("Local repository removal command is not initialized.", true);
            return;
        }

        const c = rmCode;
        rmCode = "";

        exec(c, (err, stdout, stderr) => {
            const output1 = format(c, err, stdout, stderr);

            fs.mkdir(directory, (err) => {
                if (err) {
                    callback(
                        "Could not create local repository directory:\n" + err.message,
                        true,
                    );
                    return;
                }

                run(
                    `git -C "${escape(directory)}" clone --quiet --verbose --depth 1 --no-single-branch --recurse-submodules --shallow-submodules "${escape(address)}" "${escape(directory)}"`,
                    (output2, hasError) => {
                        callback(output1 + output2, hasError);
                    },
                );
            });
        });
    };
})();

exports.pull = (directory, callback) => {
    run([
        `git -C "${escape(directory)}" remote --verbose prune origin`,
        `git -C "${escape(directory)}" pull --rebase --verbose`,
    ], callback);
};

exports.commit = (directory, messages, callback) => {
    let cmd = `git -C "${escape(directory)}" commit --verbose`;

    for (const line of messages)
        cmd += ` --message="${escape(line)}"`;

    run([
        `git -C "${escape(directory)}" stage --verbose --all`,
        cmd,
    ], callback);
};

exports.push = (directory, callback) => {
    run(`git -C "${escape(directory)}" push --verbose`, callback);
};

exports.revert = (directory, commit, callback) => {
    run(`git -C "${escape(directory)}" revert "${escape(commit)}" --no-edit`, callback);
};

exports.forcePush = (directory, branch, callback) => {
    run(
        `git -C "${escape(directory)}" push origin "${escape(branch)}" --force-with-lease --verbose`,
        callback,
    );
};

exports.status = (directory, callback) => {
    porcelain(`git -C "${escape(directory)}" status --untracked-files=all`, callback);
};

exports.clone = (directory, address, callback) => {
    fs.mkdir(directory, (err) => {
        void err; // Ignore error
        run(
            `git -C "${escape(directory)}" clone --quiet --verbose --depth 5 --no-single-branch --recurse-submodules --shallow-submodules "${escape(address)}" "${escape(directory)}"`,
            callback,
        );
    });
};

exports.config = (name, email, savePW, callback) => {
    const intermediate = (output, hasError) => {
        if (hasError) {
            callback(output, hasError);
            return;
        }

        let code = savePW ? `git config --global credential.helper store` : `git config --global --unset credential.helper`;
        exec(code, (err, stdout, stderr) => {
            output += format(code, err, stdout, stderr);
            callback(output, hasError);
        });
    };

    run([
        `git config --global user.name "${escape(name)}"`,
        `git config --global user.email "${escape(email)}"`,
    ], intermediate);
};

// --------------------------------------------------------------------------------------------- //

exports.branches = (directory, callback) => {
    porcelain(`git -C "${escape(directory)}" branch --list --all`, callback);
};

exports.diff = (directory, callback) => {
    porcelain(`git -C "${escape(directory)}" status --porcelain --untracked-files=all`, callback);
};

exports.switchBranch = (directory, branch, callback) => {
    run(`git -C "${escape(directory)}" checkout "${escape(branch)}" --`, callback);
};

exports.deleteBranch = (directory, branch, callback) => {
    run(`git -C "${escape(directory)}" branch --delete "${escape(branch)}"`, callback);
};

exports.rollback = (directory, file, callback) => {
    run(`git -C "${escape(directory)}" checkout -- "${escape(file)}"`, callback);
};

exports.fileDiff = (directory, file, callback) => {
    porcelain(`git -C "${escape(directory)}" diff -- "${escape(file)}"`, callback);
};

exports.fetch = (directory, callback) => {
    run(`git -C "${escape(directory)}" fetch --verbose`, callback);
};

exports.compare = (directory, callback) => {
    run([
        `git -C "${escape(directory)}" rev-parse @`,
        `git -C "${escape(directory)}" rev-parse @{upstream}`,
        `git -C "${escape(directory)}" merge-base @ @{upstream}`,
    ], (output, hasError) => {
        if (hasError) {
            callback("error", output);
            return;
        }

        const lines = output.split("\n");
        let results = [];
        for (let line of lines) {
            line = line.trim();
            if (line !== "" && !line.startsWith(">>>"))
                results.push(line);
        }

        // 0: local branch hash
        // 1: remote branch hash
        // 2: common ancestor hash

        // C: commit
        // L: local commit
        // R: remote commit
        // A: common ancestor

        if (results[0] === results[1]) {

            // Local is the same as remote, nothing to do

            callback("up to date", output);

        } else if (results[0] === results[2]) {

            // Remote branch is ahead, should pull
            //
            // --C--C--L
            //          \
            //           R--C
            //

            callback("need pull", output);

        } else if (results[1] === results[2]) {

            // Local branch is ahread, should push
            //
            //           L--C
            //          /
            // --C--C--R
            //

            callback("need push", output);

        } else {

            // Diverged, synchronize can fix it if there is no conflict
            //
            //           L--C
            //          /
            // --C--C--A
            //          \
            //           R--C--C
            //

            callback("diverged", output);

        }
    });
};

// --------------------------------------------------------------------------------------------- //
