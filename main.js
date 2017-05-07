//The main process
"use strict";

//=====Load Modules=====
//Load Electron
const {app, BrowserWindow: win, ipcMain: ipc, dialog, shell} = require("electron");
//Load common utilities
const path = require("path");
const url = require("url");
const fs = require("fs");
//Load other utilities
const git = require("./git.js");
const TQ = require("./task-queue.js");
//Configuration
let config; //The config object, will be set when initializing
const configFile = path.join(app.getPath("userData"), "config.json");
const configBlank = { //This default config is used if the config file doesn't exist
    lastPath: app.getPath("home"),
    name: "Alpha",
    email: "alpha@example.com",
    savePW: true,
    active: -1,
    repos: [] //Each entry is an object with properties name and directory
};
console.log("The configuration file is located at: ");
console.log(configFile);

//=====Main=====
//Create window
let main;
app.on("ready", () => {
    //Init window
    main = new win({
        width: 1300,
        height: 700,
        minHeight: 525,
        minWidth: 1050
    });
    //Remove menu
    main.setMenu(null);
    //Set URL
    main.loadURL(url.format({
        pathname: path.join(__dirname, "index.html"),
        protocol: "file",
        slashes: true
    }));
    //Handle exit
    main.on("closed", () => {
        app.quit();
    });
});

//=====Helper Functions=====
//Show beautiful code
const codify = function (sender, code, title, noColor) {
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
    //Display the code
    sender.send("dialog", {
        title: title,
        msg: `<pre>${code}</pre>`
    });
};
//Save the configuration
const configSave = function (callback) {
    fs.writeFile(configFile, JSON.stringify(config), (err) => {
        callback(err);
    });
};
//Load changed files, draw commands will be sent to renderer
const gitRefresh = function (sender, callback) {
    git.getChanged((config.repos[config.active]).directory, (err, stdout) => {
        if (err) {
            //Lock action buttons and show error
            sender.send("draw buttons", {
                group1: false
            });
            sender.send("error", {
                title: "Git Error",
                msg: "Could not read changed files list. ",
                log: err.message
            });
        } else {
            //Parse output
            const files = stdout.split("\n");
            let changedFiles = [];
            for (let i = 0; i < files.length; i++) {
                if (!files[i]) {
                    //Skip empty lines
                    continue;
                }
                //Get changed file name
                let file = (files[i]).substring(2).trim().split("/");
                //Remove redundant double quote
                if ((file[0]).startsWith("\"")) {
                    file[0] = (file[0]).substring(1);
                }
                if ((file[file.length - 1]).endsWith("\"")) {
                    file[file.length - 1] = (file[file.length - 1]).substring(0, (file[file.length - 1]).length - 1);
                }
                let File = {
                    name: file.pop(),
                    directory: "/" + file.join("/"),
                    state: []
                };
                for (let j = 0; j < 2; j++) {
                    switch ((files[i]).charAt(j)) {
                        case " ":
                            File.state.push("Unchanged");
                            break;
                        case "A":
                            File.state.push("Created");
                            break;
                        case "M":
                            File.state.push("Changed");
                            break;
                        case "D":
                            File.state.push("Deleted");
                            break;
                        case "R":
                            File.state.push("Renamed");
                            break;
                        case "C":
                            File.state.push("Copied");
                            break;
                        case "U":
                            File.state.push("Unmerged");
                            break;
                        case "?":
                            File.state.push("Untracked");
                            break;
                        default:
                            sender.send("fatal error", {
                                title: "Git Error",
                                msg: "Could not parse changed file list. ",
                                log: files[i]
                            })
                            callback({
                                message: files[i]
                            });
                            return;
                    }
                }
                //Add file to the list
                changedFiles.push(File);
            }
            //Tell renderer to draw the table
            sender.send("draw diff", {
                data: changedFiles
            });
            //Unlock action buttons
            sender.send("draw buttons", {
                group1: true
            });
        }
        callback(err);
    });
};
//Get branches, draw commands will be sent to renderer
const gitGetBranches = function (sender, callback) {
    git.getBranches((config.repos[config.active]).directory, (err, stdout) => {
        if (err) {
            //Can't get branches
            sender.send("error", {
                title: "Git Error",
                msg: "Could not read branches list. ",
                log: err.message
            });
        } else {
            //Parse branches
            let branches = stdout.split("\n");
            let names = [];
            let active;
            for (let i = 0; i < branches.length; i++) {
                if (branches[i].startsWith("*")) {
                    active = i;
                    branches[i] = (branches[i]).substring(1);
                }
                let temp = (branches[i]).trim();
                temp && names.push(temp);
            }
            //Tell renderer to draw branches and buttons
            sender.send("draw branches", {
                names: names,
                active: active
            });
            sender.send("draw buttons", {
                group1: true
            });
        }
        callback(err);
    });
};
//Send repos list redraw request
const drawRepos = function (sender) {
    //List repositories 
    let reposList = [];
    for (let i = 0; i < config.repos.length; i++) {
        reposList.push((config.repos[i]).name);
    }
    //Ask renderer to draw repos list
    sender.send("draw repos", {
        names: reposList,
        active: config.active
    });
};
//Send ready message, along with some data used to render UI
const sendReady = function (sender) {
    sender.send("ready", {
        lastPath: config.lastPath,
        name: config.name,
        email: config.email,
        savePW: config.savePW
    });
};

//=====Special Events=====
//DevTools shortcut keys
ipc.on("dev-tools", (e) => {
    //Toggle DevTools
    e.sender.toggleDevTools();
});
//Open projct page
ipc.on("open project page", () => {
    shell.openExternal("https://github.com/jspenguin2017/SimpleGitGUI");
});
//Do initialization
ipc.on("ready", (e) => {
    let tq = new TQ();
    //Read config
    tq.push(() => {
        //Check if config exists
        fs.exists(configFile, (exists) => {
            if (exists) {
                //Exists, try to read and parse it
                fs.readFile(configFile, (err, data) => {
                    if (err) {
                        //Can't access the file
                        e.sender.send("fatal error", {
                            title: "Config Error",
                            msg: "Could not read the config file. ",
                            log: err.message
                        });
                        tq.abort();
                    } else {
                        //File read, try to parse it
                        try {
                            config = JSON.parse(data);
                            tq.tick();
                        } catch (err) {
                            e.sender.send("fatal error", {
                                title: "Config Error",
                                msg: "Could not parse the config file. ",
                                log: err.message
                            });
                            tq.abort();
                        }
                    }
                })
            } else {
                //Doesn't exist, use default config
                config = configBlank;
                tq.tick();
            }
        });
    });
    //Connect to Git
    tq.push(() => {
        try {
            git.init(config.name, config.email, config.savePW, (err) => {
                if (err) {
                    e.sender.send("fatal error", {
                        title: "Git Error",
                        msg: "Could not initialize Git. ",
                        log: err.message
                    });
                    tq.abort();
                } else {
                    tq.tick();
                }
            });
        } catch (err) {
            e.sender.send("fatal error", {
                title: "Config Error",
                msg: "The config file is damaged. ",
                log: err.message
            });
            tq.abort();
        }
    });
    //Get all repositories
    tq.push(() => {
        try {
            //Check active index
            let active = parseInt(config.active);
            if (active < -1 || active > (config.repos.length - 1)) {
                throw {
                    message: "Active repository index is not valid. "
                };
            }
            config.active = active; //Sanitize it
            //Draw repos list or place holder
            drawRepos(e.sender);
            //Check if there are any repository
            if (config.repos.length) {
                //Get branches and refresh
                gitGetBranches(e.sender, (err) => {
                    if (!err) {
                        gitRefresh(e.sender, (err) => {
                            if (!err) {
                                sendReady(e.sender);
                            }
                        });
                    }
                });
            } else {
                config.repos = []; //Sanitize it
                //Ask renderer to lock some inputs if there is no repository
                e.sender.send("draw buttons", {
                    group1: false,
                    group2: false
                });
                //We don't have any repository, we don't need to get branches
                sendReady(e.sender);
            }
        } catch (err) {
            e.sender.send("fatal error", {
                title: "Config Error",
                msg: "The config file is damaged. ",
                log: err.message
            });
            tq.abort();
        }
    });
    //Start the queue
    tq.tick();
});

//=====Left Menu Buttons=====
//Pull
ipc.on("pull", (e, data) => {
    let tq = new TQ();
    //Pull
    tq.push(() => {
        const activeDir = (config.repos[config.active]).directory;
        if (data.mode === "merge") {
            git.pull(activeDir, false, (err) => {
                if (err) {
                    e.sender.send("error", {
                        title: "Git Error",
                        msg: "Could not complete merge or merge was not clean, if conflicting files show up, clean them up then push. ",
                        log: err.message
                    });
                    tq.tick(); //We'll refresh even if it fails
                } else {
                    tq.tick();
                }
            });
        } else if (data.mode === "rebase") {
            git.pull(activeDir, true, (err) => {
                if (err) {
                    e.sender.send("error", {
                        title: "Git Error",
                        msg: "Could not complete rebase. If conflicting files show up, clean them up and click Pull-&gt;Rebase Cont. Do not push until conflicting files are cleaned up. ",
                        log: err.message
                    });
                    tq.tick(); //We'll refresh even if it fails
                } else {
                    tq.tick();
                }
            });
        } else {
            e.sender.send("fatal error", {
                title: "Client Error",
                msg: "The renderer process sent an invalid request to the main process. ",
                log: "Unknown pull mode. "
            });
            tq.abort();
        }

    });
    //Refresh, this needs to include branches
    tq.push(() => {
        gitGetBranches(e.sender, (err) => {
            if (!err) {
                gitRefresh(e.sender, (err) => {
                    if (!err) {
                        sendReady(e.sender);
                    }
                });
            }
        });
    });
    //Start the queue
    tq.tick();
});
//Push changes
ipc.on("push", (e, data) => {
    let func; //We'll check if we need to stage and commit, and decide which function to use
    let tq = new TQ();
    //Check if we need to stage
    tq.push(() => {
        git.getChanged((config.repos[config.active]).directory, (err, stdout) => {
            if (err) {
                sender.send("error", {
                    title: "Git Error",
                    msg: "Could not read changed files list. ",
                    log: err.message
                });
                //We haven't pushed, so don't refresh
                tq.abort();
            } else {
                if (stdout.length) {
                    func = git.push;
                } else {
                    func = git.pushOnly;
                }
                tq.tick();
            }
        });
    });
    //Push
    tq.push(() => {
        func((config.repos[config.active]).directory, data.msg, (err) => {
            if (err) {
                e.sender.send("error", {
                    title: "Git Error",
                    msg: "Failed to push, some references were rejected. ",
                    log: err.message
                });
                //We will refresh the repository even if push fails
                tq.tick();
            } else {
                tq.tick();
            }
        });
    });
    //Refresh
    tq.push(() => {
        gitRefresh(e.sender, (err) => {
            if (!err) {
                sendReady(e.sender);
            }
        });
    });
    //Start the queue
    tq.tick();
});
//Refresh
ipc.on("refresh", (e) => {
    gitRefresh(e.sender, (err) => {
        if (!err) {
            sendReady(e.sender);
        }
    });
});
//Status
ipc.on("status", (e) => {
    git.getStatus((config.repos[config.active]).directory, (err, stdout) => {
        if (err) {
            e.sender.send("error", {
                title: "Git Error",
                msg: "Failed to get status. ",
                log: err.message
            });
        } else {
            codify(e.sender, stdout, "Repository Status", true);
        }
    });
});

//=====Right Menu Buttons=====
//Clone a repository
ipc.on("clone", (e, data) => {
    let tq = new TQ();
    //Create the folder
    tq.push(() => {
        fs.exists(data.directory, (exists) => {
            if (exists) {
                //Exists, let's see if it's empty
                fs.readdir(data.directory, function (err, files) {
                    if (err) {
                        //Could not access the directory
                        e.sender.send("error", {
                            title: "IO Error",
                            msg: "Could not access directory. ",
                            log: err.message
                        });
                        tq.abort();
                    } else {
                        if (files.length) {
                            //Directory is used
                            e.sender.send("error", {
                                title: "IO Error",
                                msg: "Directory not empty. ",
                                log: `There are ${files.length} files in this directory. `
                            });
                            tq.abort();
                        } else {
                            //Directory is empty, proceed
                            tq.tick();
                        }
                    }
                });
            } else {
                //Create the directory
                fs.mkdir(data.directory, (err) => {
                    if (err) {
                        //Failed to create directory
                        e.sender.send("error", {
                            title: "IO Error",
                            msg: "Could not create directory. ",
                            log: err.message
                        });
                        tq.abort();
                    } else {
                        //Ready, proceed
                        tq.tick();
                    }
                });
            }
        });
    });
    //Clone the repository
    tq.push(() => {
        git.clone(data.directory, data.address, (err) => {
            if (err) {
                e.sender.send("error", {
                    title: "Git Error",
                    msg: "Could not clone this repository. ",
                    log: err.message
                });
                tq.abort();
            } else {
                //Add this new repository to the config object
                config.repos.push({
                    name: data.directory.split(/\/|\\/).pop(),
                    directory: data.directory
                });
                config.active = config.repos.length - 1;
                //Update UI
                drawRepos(e.sender);
                e.sender.send("draw buttons", {
                    //Group 1 will be handled by refresh
                    group2: true
                });
                tq.tick();
            }
        });
    });
    //Save config
    tq.push(() => {
        //Update last path
        config.lastPath = path.resolve(data.directory, "..");
        configSave((err) => {
            if (err) {
                e.sender.send("fatal error", {
                    title: "Config Error",
                    msg: "Could not save config. ",
                    log: err.message
                });
                tq.abort();
            } else {
                gitRefresh(e.sender, (err) => {
                    if (!err) {
                        sendReady(e.sender);
                    }
                });
            }
        });
    });
    //Start the queue
    tq.tick();
});
//Delete current repository
ipc.on("delete", (e) => {
    let tq = new TQ();
    //Save config
    tq.push(() => {
        config.repos.splice(config.active, 1);
        if (config.active > config.repos.length - 1) {
            config.active = config.repos.length - 1;
        }
        configSave((err) => {
            if (err) {
                e.sender.send("fatal error", {
                    title: "Config Error",
                    msg: "Could not save config. ",
                    log: err.message
                });
                tq.abort();
            } else {
                tq.tick();
            }
        });
    });
    //Update UI
    tq.push(() => {
        drawRepos(e.sender);
        //Check if buttons should be active
        if (config.repos.length) {
            //Refresh the new repository
            gitRefresh(e.sender, (err) => {
                if (err) {
                    e.sender.send("draw buttons", {
                        group1: false
                    });
                    tq.abort();
                } else {
                    sendReady(e.sender);
                }
            });
        } else {
            //Lock buttons and clear branches and table
            e.sender.send("draw buttons", {
                group1: false,
                group2: false
            });
            e.sender.send("draw branches", {
                names: []
            });
            e.sender.send("draw diff", {
                data: []
            });
            //Send ready
            sendReady(e.sender);
        }
    });
    //Start the queue
    tq.tick();
});
//Update Git configuration
ipc.on("config", (e, data) => {
    let tq = new TQ();
    //Update Git config
    tq.push(() => {
        git.config(data.name, data.email, data.savePW, (err) => {
            if (err) {
                e.sender.send("fatal error", {
                    title: "Git Error",
                    msg: "Could not update Git config. ",
                    log: err.message
                });
                tq.abort();
            } else {
                tq.tick();
            }
        });
    });
    //Save config
    tq.push(() => {
        config.name = data.name;
        config.email = data.email;
        config.savePW = data.savePW;
        configSave((err) => {
            if (err) {
                e.sender.send("fatal error", {
                    title: "Config Error",
                    msg: "Could not save config. ",
                    log: err.message
                });
                tq.abort();
            } else {
                sendReady(e.sender);
            }
        });
    });
    //Start the queue
    tq.tick();
});

//=====Main Panel Functionalities=====
//Switch repo
ipc.on("switch repo", (e, data) => {
    let tq = new TQ();
    //Get a valid index
    tq.push(() => {
        const index = parseInt(data.index);
        if (index < 0 || index >= config.repos.length) {
            e.sender.send("fatal error", {
                title: "Client Error",
                msg: "The renderer process sent an invalid request to the main process. ",
                log: "Invalid active repository index. "
            });
        } else {
            //We want to opn the project folder if the repo is already active
            if (config.active === index) {
                shell.openExternal((config.repos[config.active]).directory);
                gitRefresh(e.sender, (err) => {
                    if (!err) {
                        sendReady(e.sender);
                    }
                });
                tq.skip();
            } else {
                config.active = index;
                drawRepos(e.sender);
                //Load the repository
                gitGetBranches(e.sender, (err) => {
                    if (err) {
                        tq.abort();
                    } else {
                        gitRefresh(e.sender, (err) => {
                            if (err) {
                                tq.abort();
                            } else {
                                sendReady(e.sender);
                                tq.tick();
                            }
                        });
                    }
                });
            }
        }
    });
    //Update config
    tq.push(() => {
        //Active index is already set
        configSave((err) => {
            if (err) {
                e.sender.send("fatal error", {
                    title: "Config Error",
                    msg: "Could not save config. ",
                    log: err.message
                });
                tq.abort();
            } else {
                sendReady(e.sender);
            }
        });
    });
    //Start the queue
    tq.tick();
});
//Show file diff
ipc.on("show diff", (e, data) => {
    git.getDiff((config.repos[config.active]).directory, data.file, (err, stdout) => {
        if (err) {
            e.sender.send("error", {
                title: "Git Error",
                msg: "Failed to get file differences. ",
                log: err.message
            });
        } else {
            codify(e.sender, stdout, "File Differences");
        }
    });
});

//TODO: Show log instead of telling user to see console
