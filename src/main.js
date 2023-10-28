import plugin from '../plugin.json';
import style from "./style.css";

import * as git from "isomorphic-git";
import LightningFS from "@isomorphic-git/lightning-fs";
import http from "isomorphic-git/http/web";

const Url = acode.require('Url');
const loader = acode.require("loader");
const cAlert = acode.require("Alert");
const fsOperation = acode.require('fsOperation');

window.fs = new LightningFS("fs", {
  fileDbName: "rootGitDir"
});
window.pfs = fs.promises;
window.dir = ""

class AcodePlugin {

  async init() {
    //this.run = this.run.bind(this);
    editorManager.editor.commands.addCommand({
      name: "clone-repo",
      discription: "clone repository",
      bindKey: {
        win: "Ctrl-h"
      },
      exec: ()=> {
        //this.run()
        let {
          activeFile
        } = editorManager;
        let {
          location
        } = activeFile;
        const path = location;
        cAlert(path)

        cAlert(JSON.stringify(window.addedFolder))
        this.createDir(path+"/", "test-1").
        then(res => {
          this.createDir(path+"/"+res.folderName, "sub")
          .then(name => {
            this.createFile(path+"/"+res.folderName+"/"+name.folderName, "test-file.js", "test")

          })
        })
      }
    });
    editorManager.editor.commands.addCommand({
      name: "clone",
      discription: "clone",
      bindKey: {
        win: "Ctrl-l"
      },
      exec: this.cloneRepo.bind(this)
    });

  }

  async run() {
    this.createFileStructure("/")
    .then(structure => {
      this.getDirToSaveTheFile()
      .then(path => {
        cAlert(path)
        this.createFolderInDevice(structure, path)
      }) .catch(error => cAlert(error))
    }).catch(error => cAlert(error))

  }



  async createFile(location,
    fileName,
    content) {
    const file = await fsOperation(location).createFile(fileName,
      content);
  }


  async createDir(location,
    folderName) {
    if (!(await fsOperation(`${location}${folderName}`).exists())) {
      await fsOperation(location).createDirectory(folderName);
    }
    return {
      folderName
    }
  }

  async getDirToSaveTheFile() {
    const select = acode.require('select');

    const directories = window.addedFolder.map(folder => {
      return [
        folder.url,
        folder.title,
        "icon folder", true
      ]
    })

    const options = directories;
    const opt = {
      onCancel: () => window.toast('Cancel Clicked', 3000),
      hideOnSelect: true,
      textTransform: true,
      default: '',
      };
      const SelectedPath = await select('SELECT DIRECTORY', options, opt);
      return SelectedPath;
    }

    async cloneRepo() {
      this.getURL()
      .then(url => {
        this.clone(url)
        .then(dir => {
          //  this.run();
          window.toast("succesfully cloned", 400)
        })

        .catch(error => cAlert(error))
      }).catch(error => cAlert(error))
    }

    getDirName(url) {
      const pathArry = new URL(url).pathname.split("/");
      return pathArry.slice(-1).toString().replace(".git", "");
    }

    /*async clone(remotURL) {
      try {
        dir = "/" + this.getDirName(remotURL);
        await pfs.mkdir(dir);

        if (remotURL) {
          loader.create("Loading", "Fetching data...");
          const corsProxy = "https://cors.isomorphic-git.org";
          git.clone({
            fs,
            http,
            dir,
            url: remotURL,
            corsProxy,
            onProgress(evt) {
              loader.create("Loading", "Fetching data...");
            },
            onMessage(msg) {
              //  cAlert(msg);
            },
            onAuth(url) {
              cAlert(url);
            },
            onAuthFailure({
              url, auth
            }) {
              cAlert({
                url,
                auth
              });
            }
          }).then(() => {
            window.toast("succesfully Cloned", 4000);
            loader.destroy();
            return dir;
          });
        }
      } catch (e) {
        loader.destroy();
        cAlert(e);
      }

    }*/
    async clone(remotURL) {
      try {
        dir = "/" + this.getDirName(remotURL);
        await pfs.mkdir(dir);

        if (remotURL) {
          loader.create("Loading", "Fetching data...");
          const corsProxy = "https://cors.isomorphic-git.org";

          return new Promise((resolve, reject) => {
            git.clone({
              fs,
              http,
              dir,
              url: remotURL,
              corsProxy,
              onProgress(evt) {
                loader.create("Loading", "Fetching data...");
              },
              onMessage(msg) {
                // cAlert(msg);
              },
              onAuth(url) {
                cAlert(url);
              },
              onAuthFailure({
                url, auth
              }) {
                cAlert({
                  url,
                  auth
                });
              }
            }).then(() => {
              window.toast("Successfully Cloned", 4000);
              loader.destroy();
              resolve(dir); // Resolve the Promise with the directory path
            }).catch((error) => {
              loader.destroy();
              reject(error); // Reject the Promise with an error if the clone fails
            });
          });
        }
      } catch (e) {
        loader.destroy();
        cAlert(e);
      }
    }

    createFolderInDevice(structure, location) {
      for (let key in structure) {
        if (typeof structure[key] === "object") {
          // Create a new folder
          let innerFiles = Object.keys(structure[key]).filter(
            k => typeof structure[key][k] !== "object"
          );
          let newFolder = this.getFolder(key, location, innerFiles)
          newFolder.then(name => {
            // Recursively create nested folders
            this.createFolderInDevice(
              structure[key], location+"/"+name
            );
          })
        }
      }
    }
    async getFolder(name, location, innerFiles) {
      cAlert(location)
      const folder = this.createDir(location, name);

      return folder.then(async result => {
        const structure = await this.createFileStructure("/");

        const filePromises = innerFiles.map(async file => {

          await structure;

          const filepath = this.getPathToRoot(structure, file);

          return this.getFileContent(this.extractPathAndDir(filepath))
          .then(fileContent => this.createFile(location + "/" + name+"/", file, fileContent))
          .catch(error => cAlert(error));
        });

        await Promise.all(filePromises);

        return name;
      }).catch(error => cAlert(error));
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
          const result = this.getPathToRoot(structure[key], fileName, newPath);
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

    getFileContent( {
      dir, filepath, fileName
    }) {

      return git
      .resolveRef({
        fs,
        dir,
        ref: "main"
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
          return new TextDecoder("utf-8").decode(fileContent.blob);
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
      const {
        entries
      } = Object;

      let result = {};
      const files = await pfs.readdir(dir);
      for (let file of files) {
        const filePath = `${dir}/${file}`;
        const stats = await pfs.stat(filePath);

        if (file === '.git') {
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
      const options = {
        required: true,
        placeholder: "URL (start with https://)",
        test: value => (value.startsWith("https://") && value.endsWith(".git"))
      };
      var remoteUrl = await prompt("Enter Remote Url",
        "",
        "search",
        options);
      return remoteUrl;
    }

    async destroy() {
      editorManager.editor.commands.removeCommand("clone-repo")
    }
  }




  if (window.acode) {
    const acodePlugin = new AcodePlugin();
    acode.setPluginInit(plugin.id, async (baseUrl, $page, {
      cacheFileUrl, cacheFile
    }) => {
      if (!baseUrl.endsWith('/')) {
        baseUrl += '/';
      }
      acodePlugin.baseUrl = baseUrl;
      await acodePlugin.init($page, cacheFile, cacheFileUrl);
    });
    acode.setPluginUnmount(plugin.id,
      () => {
        acodePlugin.destroy();
      });
  }