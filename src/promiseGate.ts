export default class PromiseGate {
    private resolve: (...args: any[]) => void;
    private reject: (...args: any[]) => void;
    private gatePromise = new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
    });
    private gateOpen = false;
    public get promise() {
        return this.gatePromise;
    }

    public get isGateOpen() {
        return this.gateOpen;
    }

    public openGateSuccess(...theArgs: any[]) {
        this.openGateInfra();
        this.resolve(...theArgs);
    }

    public openGateError(...theErrors: any[]) {
        this.openGateInfra();
        this.reject(...theErrors);
    }

    private openGateInfra() {
        if (this.gateOpen) {
            throw new Error("Gate was already opened!");
        }
        this.gateOpen = true;
    }
}
