const inquirer = require('inquirer');
const axios = require('axios');
const semver = require('semver');
const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const ora = require('ora');
const execa = require('execa');

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
    
    if (false && electronPackage.version !== latestVersion) {
        console.log(`There's a discrepancy between your local version and the latest for ${repo}. Please make sure you've checked out the latest master.`)
        console.log(`Local: ${electronPackage.version}.  Remote: ${latestVersion}`);
    } else {
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
            spinner.stopAndPersist('🦄');
            console.log(`Updating ${electronPackagePath}: Setting Version ${electronPackage.version} => ${nextVersion}`);
            const newElectronPackage = _.assign({}, electronPackage, {version: nextVersion});
            const updated = fs.writeFileSync(electronPackagePath, JSON.stringify(newElectronPackage, null, 2));
        }
    }
}

start();