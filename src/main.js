import plugin from "../plugin.json";

import * as git from "isomorphic-git";
import LightningFS from "@isomorphic-git/lightning-fs";
import http from "isomorphic-git/http/web";

const Url = acode.require("Url");
const loader = acode.require("loader");
const cAlert = acode.require("Alert");
const fsOperation = acode.require("fsOperation");
//const prompt = acode.require("prompt");
const select = acode.require("select");
const multiPrompt = acode.require("multiPrompt");

let fs = new LightningFS("fs", {
    wipe: true,
    fileDbName: "rootGitDir"
});
let pfs = fs.promises;
let dir = "";

class AcodePlugin {
    async init() {
        this.defaultBarnch = "main";
        editorManager.editor.commands.addCommand({
            name: "clone-Repo",
            discription: "clone repository",
            bindKey: {
                win: "Ctrl-h"
            },
            exec: this.cloneRepo.bind(this)
        });
        let command = {
            name: "clone-Repository",
            discription: "clone repository",
            exec: this.cloneRepo.bind(this)
        };
        editorManager.editor.commands.addCommand(command);
    }

    async run() {
        this.createFileStructure("/")
            .then(structure => {
                this.getDirToSaveTheFile()
                    .then(path => {
                        this.createFolderInDevice(structure, path);
                    })
                    .catch(error => cAlert(error));
            })
            .catch(error => cAlert(error));
    }

    async createFile(location, fileName, content) {
        const file = await fsOperation(location).createFile(fileName, content);
    }

    async createDir(location, folderName) {
        if (!(await fsOperation(`${location}${folderName}`).exists())) {
            await fsOperation(location).createDirectory(folderName);
        }
        return {
            folderName
        };
    }

    async getDirToSaveTheFile() {
        const fileBrowser = acode.require("fileBrowser");
        const folder = await fileBrowser("folder", "SELECT DIRECTORY", true);
        let selectedPath = folder.url;
        const options = [folder.url, folder.name];

        const check = selectedPath.includes("::primary:");
        if (!check && !selectedPath.includes("com.termux.documents")) {
            selectedPath = selectedPath + `::primary:${options[1]}`;
        }
        if (
            selectedPath.includes("com.termux.documents") &&
            !selectedPath.includes("::/data/data/com.termux/files/home/")
        ) {
            selectedPath =
                selectedPath + `::${Url.pathname(folder.url).slice(1)}`;
        }

        return selectedPath;
    }

    async cloneRepo() {
        fs = new LightningFS("fs", {
            wipe: true,
            fileDbName: "rootGitDir"
        });
        this.getURL()
            .then(url => {
                this.clone(url)
                    .then(dir => {
                        this.run();
                        window.toast("succesfully cloned", 400);
                    })
                    .catch(error => {
                        cAlert(error);
                    });
                fs = new LightningFS("fs", {
                    wipe: true,
                    fileDbName: "rootGitDir"
                });
            })
            .catch(error => cAlert(error));
    }

    getDirName(url) {
        const pathArry = new URL(url).pathname.split("/");
        return pathArry.slice(-1).toString().replace(".git", "");
    }

    async clone(remotURL) {
        try {
            dir = "/" + this.getDirName(remotURL);
            await pfs.mkdir(dir);

            if (remotURL) {
                const cloneload = loader.create(
                    "CLONE REPOSITORY",
                    "Cloning Remote",
                    {
                        timeout: 5000,
                        callback: () => window.toast("Loading cancelled", 4000)
                    }
                );
                const corsProxy = "https://cors.isomorphic-git.org";
                return new Promise((resolve, reject) => {
                    loader.show();
                    git.clone({
                        fs,
                        http,
                        dir,
                        url: remotURL,
                        corsProxy,
                        onProgress: evt => {
                            cloneload.setMessage(evt.phase);
                        },
                        onMessage: msg => {
                            cloneload.setMessage(msg);
                        },
                        onAuth: url => {
                            return this.fillCredentials(url);
                        },
                        onAuthFailure: ({ url, auth }) => {
                            return this.rejected({
                                url,
                                auth
                            });
                        }
                    })
                        .then(() => {
                            window.toast("Successfully Cloned", 4000);
                            cloneload.destroy();
                            resolve(dir);
                        })
                        .catch(error => {
                            cloneload.destroy();
                            reject(error);
                        });
                });
            }
        } catch (e) {
            loader.destroy();
            cAlert(e);
        }
    }

    async fillCredentials(url) {
        const gitCridentailProm = await multiPrompt(
            "Enter You Cridential",
            [
                {
                    type: "text",
                    id: "username",
                    required: true,
                    placeholder: "Username"
                },
                {
                    type: "password",
                    id: "password",
                    required: true,
                    placeholder: "Token"
                }
            ],
            url
        );

        let username = gitCridentailProm["username"];

        let password = gitCridentailProm["password"];

        return {
            username,
            password
        };
    }
    async rejected({ url, auth }) {
        cAlert("Authentication rejected");
        return;
    }

    createFolderInDevice(structure, location) {
        for (let key in structure) {
            if (typeof structure[key] === "object") {
                // Create a new folder
                let innerFiles = Object.keys(structure[key]).filter(
                    k => typeof structure[key][k] !== "object"
                );
                let newFolder = this.getFolder(key, location, innerFiles);
                newFolder.then(name => {
                    // Recursively create nested folders
                    this.createFolderInDevice(
                        structure[key],
                        location + "/" + name
                    );
                });
            }
        }
    }
    async getFolder(name, location, innerFiles) {
        const folder = this.createDir(location, name);
        return folder
            .then(async result => {
                const structure = await this.createFileStructure("/");

                const filePromises = innerFiles.map(async file => {
                    await structure;

                    const filepath = this.getPathToRoot(structure, file);

                    return this.getFileContent(this.extractPathAndDir(filepath))
                        .then(fileContent =>
                            this.createFile(
                                location + "/" + name + "/",
                                file,
                                fileContent
                            )
                        )
                        .catch(error => cAlert(error));
                });

                await Promise.all(filePromises);
                return name;
            })
            .catch(error => cAlert(error));
    }

    extractPathAndDir(path) {
        return {
            dir: "/" + path.slice(0, path.indexOf("/")),
            filepath: path.slice(path.indexOf("/") + 1),
            fileName: path.slice(path.lastIndexOf("/") + 1)
        };
    }
    getPathToRoot(structure, fileName, currentPath = []) {
        for (const key in structure) {
            if (typeof structure[key] === "object") {
                const newPath = currentPath.concat(key);
                const result = this.getPathToRoot(
                    structure[key],
                    fileName,
                    newPath
                );
                if (result) {
                    return result;
                }
            } else if (structure[key] === "file" && key === fileName) {
                currentPath.push(fileName);
                return currentPath.join("/");
            }
        }
        return null;
    }

    getFileContent({ dir, filepath, fileName }) {
        return git
            .resolveRef({
                fs,
                dir,
                ref: this.defaultBarnch
            })
            .then(commitOid => {
                return git
                    .readBlob({
                        fs,
                        dir,
                        oid: commitOid,
                        filepath // You can replace with 'filepath' if needed
                    })
                    .then(fileContent => {
                        return new TextDecoder("utf-8").decode(
                            fileContent.blob
                        );
                    })
                    .catch(error => {
                        throw error; // Handle readBlob error
                    });
            })
            .catch(error => {
                throw error; // Handle resolveRef error
            });
    }

    async createFileStructure(dir) {
        const { entries } = Object;

        let result = {};
        const files = await pfs.readdir(dir);
        for (let file of files) {
            const filePath = `${dir}/${file}`;
            const stats = await pfs.stat(filePath);

            if (file === ".git") {
                continue; // Skip the ".git" directory
            }

            if (stats.isDirectory()) {
                result[file] = await this.createFileStructure(filePath);
            } else {
                result[file] = "file";
            }
        }
        return Object.fromEntries(entries(result).sort());
    }

    async getURL() {
        try {
            const result = await multiPrompt("enter repository meta", [
                {
                    type: "url",
                    id: "url",
                    required: true,
                    placeholder: "URL (start with https://)",
                    test: value =>
                        value.startsWith("https://") && value.endsWith(".git")
                },
                {
                    type: "text",
                    id: "branch",
                    required: true,
                    placeholder: "ref",
                    value: "main"
                }
            ]);

            if (!result["url"]) throw "please provide url";

            if (result["branch"]) {
                this.defaultBarnch = result["branch"];
                alert(this.defaultBarnch);
            }

            return result["url"];
        } catch (e) {
            throw "please provide url";
        }
    }

    async destroy() {
        editorManager.editor.commands.removeCommand("clone-Repo");
        let command = {
            name: "clone-Repository",
            discription: "clone repository",
            exec: this.cloneRepo.bind(this)
        };
        editorManager.editor.commands.removeCommand(command);
    }
}

if (window.acode) {
    const acodePlugin = new AcodePlugin();
    acode.setPluginInit(
        plugin.id,
        async (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
            if (!baseUrl.endsWith("/")) {
                baseUrl += "/";
            }
            acodePlugin.baseUrl = baseUrl;
            await acodePlugin.init($page, cacheFile, cacheFileUrl);
        }
    );
    acode.setPluginUnmount(plugin.id, () => {
        acodePlugin.destroy();
    });
}
