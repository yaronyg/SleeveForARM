import * as fs from "fs-extra-promise";
declare module "fs-extra-promise" {
    export function emptyDirAsync(dir: string): Promise<void>;
    // tslint:disable-next-line:max-line-length
    export function writeAsync(fd: number, buffer: NodeBuffer, offset?: number, length?: number, position?: number): Promise<[number, NodeBuffer]>;
    export function writeAsync(fd: number, data: string, position?: number, encoding?: string): Promise<[number, string]>;
}
// The call to readlink is just to avoid a compile error complaining we
// don't ever use fs.
// tslint:disable-next-line:no-unused-expression
fs.readlink;
