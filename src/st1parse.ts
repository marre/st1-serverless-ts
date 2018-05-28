import { St1 } from "./St1";

St1.createWithTweetsFromStream(process.stdin)
    .then((st1) => {
        process.stdout.write(JSON.stringify(st1));
        process.exit();
    })
    .catch(() => {
        process.exit(1);
    });
