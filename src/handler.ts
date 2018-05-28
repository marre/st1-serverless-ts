import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult, Callback, Context} from "aws-lambda";
import { Logger, transports  } from "winston";
import { St1 } from "./St1";
import { St1Repository } from "./St1Repository";

const logger = new Logger({ transports: [ new transports.Console() ] });

let cachedSt1: St1;

async function getSt1(): Promise<St1> {
  if (cachedSt1 === undefined) {
    logger.info("No cached st1 handle");

    // Load into cache
    const cacheUri = process.env.ST1_CACHE_URI;
    if (! cacheUri) {
      logger.info("No cache-uri specified, returning an empty st1 handle");
      return St1.createEmpty();
    }

    logger.info("Load from cache uri '%s'", cacheUri);
    cachedSt1 = await St1.createFromCacheURI(cacheUri);

    const atlasUri = process.env.MONGODB_ATLAS_CLUSTER_URI_R;
    if (! atlasUri) {
      // No DB URI defined. Go with the cached data only then
      logger.info("No db-uri specified, returning cached st1 handle");
      return cachedSt1;
    }

    // Fill in with later tweets
    logger.info("Fill in st1 with latest tweets");
    const st1Repo = new St1Repository(atlasUri);
    await cachedSt1.updateWithTweetsFromDb(st1Repo);
    logger.info("St1 handle created");
  }

  return cachedSt1;
}

async function priceHandler(
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> {
  const station = (event && event.pathParameters && event.pathParameters.station) || "";
  const petrol = (event && event.pathParameters && event.pathParameters.petrol) || "";

  // the following line is critical for performance reasons to allow re-use of
  // database connections across calls to this Lambda function and avoid closing
  // the database connection. The first call to this lambda function takes about
  // 5 seconds to complete, while subsequent, close calls will only take a few
  // hundred milliseconds.
  context.callbackWaitsForEmptyEventLoop = false;

  const st1 = await getSt1();
  const prices = await st1.lookupPrices(station, petrol);

  // TODO: Cache the JSON data instead of serializing to json every invocation
  const json = JSON.stringify(prices);

  return {
    body: json,
    headers: {
      "Access-Control-Allow-Credentials": true,
      "Access-Control-Allow-Origin": "*",
    },
    statusCode: 200,
  };
}

export const price: APIGatewayProxyHandler = (
  event: APIGatewayProxyEvent,
  context: Context,
  callback: Callback<APIGatewayProxyResult>,
): void => {
  priceHandler(event, context)
    .then((result) => callback(null, result));
};
