 class Electron {
    constructor() {
        this.app = {
            setVersion: this.setVersion,
            getVersion: this.getVersion
        }
    }

    setVersion(version) {
        this.version = version;
    }

    getVersion() {
        return this.version;
    }
}

export default new Electron();