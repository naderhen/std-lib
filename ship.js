const inquirer = require('inquirer');
const axios = require('axios');
const semver = require('semver');
const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const ora = require('ora');
const execa = require('execa');
const logSymbols = require('log-symbols');

const basePath = path.resolve('..', 'Developer', 'mark43', 'mark43', 'cad-client');
const electronPackagePath = path.join(basePath, 'electron', 'package.json');
const electronPackage = require(electronPackagePath);

const INCREMENTS = {
    PATCH: 'patch',
    MINOR: 'minor',
    MAJOR: 'major'
}

const getRepo = () => inquirer.prompt([
    {
        type: 'list',
        name: 'repo',
        message: 'Which repo would you like to publish?',
        choices: [
            'mercury-beta',
            'mercury-training'
        ]
    }
]).then(({repo}) => repo);

const getIncrement = (repo, latestVersion) => inquirer.prompt([
    {
        type: 'list',
        name: 'increment',
        message: `${repo}'s latest version is ${latestVersion}. What type of version change is this?`,
        choices: [
            INCREMENTS.PATCH,
            INCREMENTS.MINOR,
            INCREMENTS.MAJOR
        ]
    }
]).then(({increment}) => increment);

const confirmNextVersion = nextVersion => inquirer.prompt([
    {
        type: 'confirm',
        name: 'confirmNextVersion',
        message: `Build v${nextVersion}?`
    }
]).then(({confirmNextVersion}) => confirmNextVersion);

const getLatestVersion = repo => axios.get(`https://api.bintray.com/packages/mark43/${repo}/mercury/versions/_latest`)
                                    .then(({data}) => data.name);

async function start () {
    const repo = await getRepo();
    console.log(`Checking ${repo}'s latest version...`);
    const latestVersion = await getLatestVersion(repo);

    const increment = await getIncrement(repo, latestVersion);
    const nextVersion = semver.inc(latestVersion, increment);

    const confirmed = await confirmNextVersion(nextVersion);
    if (confirmed) {
        const spinner = ora('Checking Working Directory').start();

        const gitClean = await execa.stdout('git', ['status', '--porcelain'], {cwd: basePath});
        if (gitClean !== '') {
            spinner.text = 'Your working directory is not clean. Please make sure you\'ve checked out the latest master';
            spinner.fail();
        }
        spinner.text = 'Working Directory Clean';
        spinner.stopAndPersist(logSymbols.success);

        console.log(`Updating ${electronPackagePath}: Setting Version ${electronPackage.version} => ${nextVersion}`);
        const newElectronPackage = _.assign({}, electronPackage, {version: nextVersion});
        const updated = fs.writeFileSync(electronPackagePath, JSON.stringify(newElectronPackage, null, 2));

        console.log(`${logSymbols.info} Removing Node Modules`);
        execa('rm', ['-rf', 'node_modules'], {cwd: basePath}).stdout.pipe(process.stdout);

        console.log(`${logSymbols.info} Re-Installing Node Modules`);
        execa('npm', ['install'], {cwd: basePath}).stdout.pipe(process.stdout);
    }
}

async function checkGitBranch () {
    return execa.stdout('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {cwd: basePath})
        .then(data => {
            return data;
        })
}

async function fetchRemotes() {
    return execa.stdout('git', ['fetch', '--all', '--prune'], {cwd: basePath});
}

async function checkGitRemotes() {
    return execa.stdout('git', ['status', '-s', '-uno'], {cwd: basePath})
        .then(data => {
            return data === '';
        });
}

async function checkEnv() {
    if (electronPackage.version !== '0.0.0') {
        console.log(`Your electron/package.json already has a version set. This must be set to 0.0.0`);
        return;
    }

    const gitBranch = await checkGitBranch();

    if (gitBranch !== 'master' && gitBranch !== 'ship-script') {
        console.log(`Please make sure you've checked out the latest master`);
        return;
    }

    console.log(`${logSymbols.info} Fetching Git Remotes`);
    const remotesFetched = await fetchRemotes();

    console.log(`${logSymbols.info} Checking if your Git is up to date`);
    const gitUpToDate = await checkGitRemotes();

    if (!gitUpToDate) {
        console.log(`Please make sure you've checked out the latest master`);
        return;
    }

    start();
}


checkEnv();