#!/usr/bin/env node

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

// CLI helper

// --------------------------------------------------------------------------------------------- //

"use strict";

// --------------------------------------------------------------------------------------------- //

const { spawn } = require("child_process");
const { platform } = require("os");

// --------------------------------------------------------------------------------------------- //

if (platform() === "win32") {
    spawn("Launcher.exe", [], {
        detached: true,
    });
} else {
    spawn("bash", ["Launcher.sh"], {
        detached: true,
    });
}

// --------------------------------------------------------------------------------------------- //
