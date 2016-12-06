import { CADUpdater } from '../index';
import nock from 'nock';

jest.mock('../__mocks__/electron');
jest.mock('../__mocks__/superagent');

afterEach(() => {
    nock.cleanAll();
})

describe('initialization', () => {
    it ('should throw an exception if not supplied with a valid BintrayConfig', () => {
        expect(() => new CADUpdater()).toThrow();;
    });

    it('should return a valid CADUpdater', () => {
        const autoUpdater = new CADUpdater({owner: 'mark43', repo: 'mercury-beta', packageName: 'mercury'});
        expect(autoUpdater).toBeDefined();
        expect(autoUpdater.checkForUpdates).toBeDefined();
    })
});

describe('app', () => {
    it('it correctly sets the app', () => {
        const autoUpdater = new CADUpdater({owner: 'mark43', repo: 'mercury-beta', packageName: 'mercury'});
        expect(autoUpdater.app).toBeDefined();
        expect(autoUpdater.app.getVersion).toBeDefined();
        autoUpdater.app.setVersion('0.0.3');
        expect(autoUpdater.app.getVersion()).toBe('0.0.3');
    })
})

describe('getFeedURL', () => {
    it('returns the correct URL with a valid bintray config', () => {
        const autoUpdater = new CADUpdater({owner: 'mark43', repo: 'mercury-beta', packageName: 'mercury'});
        expect(autoUpdater.getFeedURL()).toBe('https://api.bintray.com/packages/mark43/mercury-beta/mercury/versions/_latest');
    })
})

describe('checkForUpdates', () => {
    it('should emit a checking-for-update event', async () => {
        const autoUpdater = new CADUpdater({owner: 'mark43', repo: 'mercury-beta', packageName: 'mercury'});

        var spy = jest.fn();
        autoUpdater.on('checking-for-update', spy);

        var spy2 = jest.fn();
        autoUpdater.on('error', spy2);

        try {
            autoUpdater.checkForUpdates();
        } catch (e) {}
        
        expect(spy).toHaveBeenCalled();
    });

    it('should emit an error if the request fails', async () => {
        const autoUpdater = new CADUpdater({owner: 'mark43', repo: 'mercury-beta', packageName: 'mercury'});
        nock(autoUpdater.getFeedURL())
            .get('')
            .reply(200, 'test');
        
        var spy = jest.fn();

        autoUpdater.on('error', spy);

        try {
            await autoUpdater.checkForUpdates();
        } catch (e) {}

        expect(spy).toHaveBeenCalled();
    });

    it('should emit an error if the version is not valid', async () => {
        const autoUpdater = new CADUpdater({owner: 'mark43', repo: 'mercury-beta', packageName: 'mercury'});
        nock(autoUpdater.getFeedURL())
            .get('')
            .reply(200, {
                name: 'fake'
            });
        
        var spy = jest.fn();
        var spy2 = jest.fn();
        autoUpdater.on('error', spy);

        try {
            await autoUpdater.checkForUpdates();
        } catch (e) {}

        expect(spy).toHaveBeenCalled();
    });
    
    it('should emit update-not-available if the current app version is greater than bintray', async () => {
        const autoUpdater = new CADUpdater({owner: 'mark43', repo: 'mercury-beta', packageName: 'mercury'});

        autoUpdater.app.setVersion('2.0.0');
        nock(autoUpdater.getFeedURL())
            .get('')
            .reply(200, {
                name: '1.2.3'
            });

        var spy = jest.fn();
        autoUpdater.on('update-not-available', spy);

        try {
            await autoUpdater.checkForUpdates();
        } catch (e) {

        }

        expect(spy).toHaveBeenCalled();
    });

    it('should emit update-available if it finds a valid update file', async () => {
        const autoUpdater = new CADUpdater({owner: 'mark43', repo: 'mercury-beta', packageName: 'mercury'});
        autoUpdater.app.setVersion('0.0.1');
        nock(autoUpdater.getFeedURL())
            .get('')
            .reply(200, {
                name: '0.0.3'
            });
        
        nock(autoUpdater.getFilesURLForVersion('0.0.3'))
            .get('')
            .reply(200, [
                {name: "Mercury-Setup-0.0.3.exe", path: "Mercury-Setup-0.0.3.exe"},
                {name: "Mercury-Setup-0.0.3--alpha.exe", path: "Mercury-Setup-0.0.3--alpha.exe"}
            ]);

        var spy = jest.fn();
        autoUpdater.on('update-available', spy);

        try {
            await autoUpdater.checkForUpdates();
        } catch (e) {

        }

        expect(spy).toHaveBeenCalledWith({
            name: "Mercury-Setup-0.0.3.exe",
            path: "Mercury-Setup-0.0.3.exe",
            url: "https://dl.bintray.com/mark43/mercury-beta/Mercury-Setup-0.0.3.exe"
        });
    })

    it('should emit an error if it cant find a valid update file', async () => {
        const autoUpdater = new CADUpdater({owner: 'mark43', repo: 'mercury-beta', packageName: 'mercury'});
        autoUpdater.app.setVersion('0.0.1');
        nock(autoUpdater.getFeedURL())
            .get('')
            .reply(200, {
                name: '0.0.3'
            });
        
        nock(autoUpdater.getFilesURLForVersion('0.0.3'))
            .get('')
            .reply(200, [
                {name: "Mercury-Setup-0.0.2312.exe", path: "Mercury-Setup-0.0.42343.exe"},
                {name: "Mercury-Setup-0.0.424--alpha.exe", path: "Mercury-Setup-0.0.42343--alpha.exe"}
            ]);

        var spy = jest.fn();
        var errorSpy = jest.fn();
        autoUpdater.on('update-available', spy);
        autoUpdater.on('error', errorSpy);

        try {
            await autoUpdater.checkForUpdates();
        } catch (e) {

        }

        expect(spy).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalled();
    })

    it('should emit update-downloaded if it finds a valid update file', async () => {
        const autoUpdater = new CADUpdater({owner: 'mark43', repo: 'mercury-beta', packageName: 'mercury'});
        autoUpdater.app.setVersion('0.0.1');
        nock(autoUpdater.getFeedURL())
            .get('')
            .reply(200, {
                name: '0.0.3'
            });
        
        nock(autoUpdater.getFilesURLForVersion('0.0.3'))
            .get('')
            .reply(200, [
                {name: "Mercury-Setup-0.0.3.exe", path: "Mercury-Setup-0.0.3.exe"},
                {name: "Mercury-Setup-0.0.3--alpha.exe", path: "Mercury-Setup-0.0.3--alpha.exe"}
            ]);

        var downloadedSpy = jest.fn();
        autoUpdater.on('update-downloaded', downloadedSpy);
        try {
            const ret = await autoUpdater.checkForUpdates();
            await ret.downloadPromise;
        } catch (e) {
            console.log('no', e)
        }

        expect(downloadedSpy).toHaveBeenCalled();
    })
});
