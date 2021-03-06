/* tslint:disable:no-require-imports */
import Client = require("github");
/* tslint:enable:no-require-imports */

export interface PRInfo {
    pr: PullRequest;
    files: PullRequestFile[] | null;
    contents: { [path: string]: string; };
    baseContents: { [path: string]: string; };
}

export interface PRInfoRequest {
    owner?: string;
    repo?: string;
    number: number;
}

export interface PullRequest {
    base: {
        ref: string;
    };
    user: {
        html_url: string;
    };
}

export interface PullRequestFile {
    sha: string;
    filename: string;
    status: string;
}

export function getPRInfo(req: PRInfoRequest): Promise<PRInfo> {
    let github = new Client({
        version: "3.0.0",
        // debug: true
    });
    github.authenticate({
        type: "oauth",
        key: "6dfc3629feef934dadd0",
        secret: "7524eed1afd84b09f08f1439e7e08860add37c09",
    });

    return new Promise<PRInfo>((resolve, reject) => {
        github.pullRequests.get({
            owner: req.owner || "DefinitelyTyped",
            repo: req.repo || "DefinitelyTyped",
            number: req.number,
        }, (err: any, res: any) => {
            if (err) {
                reject(err);
            } else {
                resolve({
                    pr: res.data,
                    files: null,
                    contents: {},
                    baseContents: {},
                });
            }
        });
    })
        .then(info => {
            return new Promise<PRInfo>((resolve, reject) => {
                github.pullRequests.getFiles({
                    owner: req.owner || "DefinitelyTyped",
                    repo: req.repo || "DefinitelyTyped",
                    number: req.number,
                }, (err: any, res: any) => {
                    if (err) {
                        reject(err);
                    } else {
                        info.files = res.data;
                        resolve(info);
                    }
                });
            });
        }).then(info => {
            let promises = info.files!.map(file => {
                return new Promise<PRInfo>((resolve, reject) => {
                    github.gitdata.getBlob({
                        owner: req.owner || "DefinitelyTyped",
                        repo: req.repo || "DefinitelyTyped",
                        sha: file.sha,
                    }, (err: any, res: any) => {
                        if (err) {
                            reject(err);
                        } else if (res.data.encoding === "utf-8") {
                            info.contents[file.filename] = res.data.content;
                            resolve(info);
                        } else {
                            let b = new Buffer(res.data.content, "base64");
                            info.contents[file.filename] = b.toString();
                            resolve(info);
                        }
                    });
                });
            });
            return Promise.all(promises).then(() => info);
        }).then(info => {
            let promises = info.files!.filter(file => file.status === "modified").map(file => {
                return new Promise<PRInfo>((resolve, reject) => {
                    github.repos.getContent({
                        owner: "DefinitelyTyped",
                        repo: "DefinitelyTyped",
                        path: file.filename,
                        ref: info.pr.base.ref,
                    }, (err: any, res: any) => {
                        if (err) {
                            reject(err);
                        } else if (res.data.encoding === "utf-8") {
                            info.baseContents[file.filename] = res.data.content;
                            resolve(info);
                        } else {
                            let b = new Buffer(res.data.content, "base64");
                            info.baseContents[file.filename] = b.toString();
                            resolve(info);
                        }
                    });
                });
            });
            return Promise.all(promises).then(() => info);
        });
}
