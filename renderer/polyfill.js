if (!Promise.try) {
    Promise.try = function (fn) {
        return new Promise((resolve, reject) => {
            try {
                resolve(fn());
            } catch (err) {
                reject(err);
            }
        });
    };
}
if (!Promise.withResolvers) {
    Promise.withResolvers = function () {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}
