// @flow

import { EventEmitter } from 'events';
import fs from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import _ from 'lodash';
import got from 'got';
import { gt as isVersionGreaterThan, valid as parseVersion } from "semver"
import { mkdtemp } from 'fs-extra-p';

const BAD_BINTRAY_CONFIG = 'Bad Bintray Config';
const NO_FEED_URL_MESSAGE = 'No Feed URL defined';
const BAD_JSON_MESSAGE = 'Bad JSON Response';

type BintrayConfig = {
    owner: string,
    repo: string,
    packageName: string
};

const download = (url, filePath) => {
    return got.stream(url)
        .on('response', response => {
            response.pipe(fs.createWriteStream(filePath))
        });
}

const validBintrayConfig = config => config.owner && config.repo && config.packageName;

export class CADUpdater extends EventEmitter {
    feedURL: string;
    constructor(config: BintrayConfig) {
        super();

        if (!validBintrayConfig(config)) {
            throw new Error(BAD_BINTRAY_CONFIG);
        }
        this.app = require('electron').app;
        this.emitError = err => {
            this.emit('error', err, err.message);
        }
        this.config = config;
    }

    getFilesURLForVersion(version) {
        const {
            owner,
            repo,
            packageName
        } = this.config;
        return `https://api.bintray.com/packages/${owner}/${repo}/${packageName}/versions/${version}/files`;
    }

    getDownloadURLForFileName(fileName) {
        const {
            owner,
            repo,
            packageName
        } = this.config;

        return `https://dl.bintray.com/${owner}/${repo}/${fileName}`;
    }

    getFeedURL() {
        const {
            owner,
            repo,
            packageName
        } = this.config;

        return `https://api.bintray.com/packages/${owner}/${repo}/${packageName}/versions/_latest`;
    }

    async getLatestVersion() {
        const self = this;
        return got(this.getFeedURL())
            .then(response => {
                return JSON.parse(response.body);
            }).catch(err => {
                self.emitError(err);
            });
    }

    async getUpdateFile(version) {
        const self = this;

        try {
            const files = await got(self.getFilesURLForVersion(version))
                .then(resp => {
                    return JSON.parse(resp.body);
                });
            const updateFile = _.find(files, file => {
                return _.endsWith(file.name, `${version}.exe`) && _.includes(file.name, 'Setup');
            });

            if (updateFile) {
                return {
                    ...updateFile,
                    url: self.getDownloadURLForFileName(updateFile.name)
                }
            } else {
                const e = new Error('No Valid Update File Found');
                self.emitError(e);
                throw e;
            }
        } catch (e) {
            self.emitError(e);
            throw e;
        }
    }

    async _checkForUpdates() {
        const self = this;
        const versionInfo = await this.getLatestVersion();
        const latestVersion = parseVersion(versionInfo.name);

        if (latestVersion === null) {
            this.emitError(new Error(`Latest version (from update server) is not valid semver version: "${latestVersion}`));
        }

        const currentVersion = parseVersion(this.app.getVersion());
        if (!isVersionGreaterThan(latestVersion, currentVersion)) {
            self.emit('update-not-available', {latestVersion, currentVersion})
            return;
        }
        const fileInfo = await this.getUpdateFile(latestVersion);
        self.emit('update-available', fileInfo);

        const downloadPath = mkdtemp(`${path.join(tmpdir(), "up")}-`);

        return {
            downloadPromise: downloadPath
                .then(it => download(fileInfo.url, path.join(it, fileInfo.name)))
                .then(it => {
                    return new Promise((resolve, reject) => {
                        it.on('response', response => {
                            let totalSize = parseFloat(response.headers['content-length']);
                            let downloaded = 0;

                            self.emit('update-downloaded')

                            response.on('data', chunk => {
                                downloaded += chunk.length;

                                if (downloaded === totalSize) {
                                    self.emit('download-progress', downloaded / totalSize);
                                }
                            });

                            resolve(response);
                        });


                        it.on('error', err => {
                            reject(err);
                        })
                    })
                })
                .catch(e => {
                    console.log(e)
                })
        }
    }

    async checkForUpdates() {
        const self = this;

        this.emit('checking-for-update');

        try {
            return await this._checkForUpdates();
        } catch (e) {
            this.emitError(e);
        }
    }
}