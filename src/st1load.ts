import { createLogger, format, transports } from "winston";
import { St1 } from "./St1";
import { St1Repository } from "./St1Repository";

const logger = createLogger({
    format: format.combine(
        format.splat(),
        format.simple(),
    ),
    transports: [ new transports.Console() ],
});

const atlasUri: string = process.env.MONGODB_ATLAS_CLUSTER_URI_R || "";
const st1Repo = new St1Repository(atlasUri);

logger.info("Parse cache file");
St1.createFromCacheFile("data/tweets-2020-01-23.parsed.json")
    .then((st1: St1) => {
        logger.info("Load newer tweets from db");
        return st1.updateWithTweetsFromDb(st1Repo);
    })
    .then((st1: St1) => {
        logger.info("Repository initialized");
        const dieselPrices = st1.lookupPrices("Vallentuna", "diesel");
        logger.info("Vallentuna diesel. %j", dieselPrices);
        process.exit();
    })
    .catch((err) => {
        logger.error("Fail");
        logger.error(err);
        process.exit(1);
    });
