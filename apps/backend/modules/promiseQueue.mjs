export class PromiseQueue {
    constructor(maxConcurrency = 1) {
        this.maxConcurrency = maxConcurrency;
        this.queue = [];
        this.activeCount = 0;
        this.totalTasks = 0;
        this.completedTasks = 0;
        this.allDoneResolve = null;
        this.allDonePromise = new Promise(resolve => {
            this.allDoneResolve = resolve;
        });
    }

    enqueue(task) {
        this.totalTasks++;
        return new Promise((resolve, reject) => {
            this.queue.push({
                task,
                resolve,
                reject
            });

            this.processQueue();
        }).finally(() => {
            this.completedTasks++;
            if (this.completedTasks === this.totalTasks) {
                this.allDoneResolve();
            }
        });
    }

    processQueue() {
        while (this.activeCount < this.maxConcurrency && this.queue.length > 0) {
            const { task, resolve, reject } = this.queue.shift();
            this.activeCount++;

            task()
                .then(result => {
                    this.activeCount--;
                    resolve(result);
                    this.processQueue();
                })
                .catch(error => {
                    this.activeCount--;
                    reject(error);
                    this.processQueue();
                });
        }
    }

    allDone() {
        return this.allDonePromise;
    }
}

// 使用示例
// const queue = new PromiseQueue(3); // 最大并发数为3

// function simulateTask(id, delay) {
//     return new Promise((resolve) => {
//         setTimeout(() => {
//             console.log(`Task ${id} completed`);
//             resolve(`Result of Task ${id}`);
//         }, delay);
//     });
// }

// queue.enqueue(() => simulateTask(1, 1000)).then(console.log);
// queue.enqueue(() => simulateTask(2, 500)).then(console.log);
// queue.enqueue(() => simulateTask(3, 1500)).then(console.log);
// queue.enqueue(() => simulateTask(4, 700)).then(console.log);
// queue.enqueue(() => simulateTask(5, 1200)).then(console.log);

// // 监听所有任务完成
// queue.allDone().then(() => {
//     console.log('All tasks completed!');
// });