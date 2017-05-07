//Taks queue manager for main process
"use strict";

//Constructor
module.exports = function () {
    this.queue = [];
};

//Add new taks
module.exports.prototype.push = function () {
    for (let i = 0; i < arguments.length; i++) {
        this.queue.push(arguments[i]);
    }
};

//Abort the rest of the tasks
module.exports.prototype.abort = function () {
    this.queue = [];
};

//Skip the next task
module.exports.prototype.skip = function () {
    this.queue.shift();
};

//Run next task
module.exports.prototype.tick = function () {
    (this.queue.shift())();
};
