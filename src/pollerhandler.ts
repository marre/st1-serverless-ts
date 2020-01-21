import { Callback, Context, ScheduledEvent, ScheduledHandler } from "aws-lambda";
// Borrow Long from mongo as a 64 bit integer for tweet ids
import { Long } from "mongodb";
import { Observable, Subscriber } from "rxjs";
import { toArray } from 'rxjs/operators';
import { createLogger, format, transports  } from "winston";
import { St1Repository } from "./St1Repository";
import { ITweetDoc, St1TwitterClient } from "./St1TwitterClient";

const logger = createLogger({ 
    format: format.combine(
        format.splat(),
        format.simple()
      ),
        transports: [ new transports.Console() ] 
  });
  
const st1Repo = new St1Repository(process.env.MONGODB_ATLAS_CLUSTER_URI_RW || "");
const st1Twitter = new St1TwitterClient({
    accessToken: process.env.TWITTER_ACCESS_TOKEN || "",
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || "",
    consumerKey: process.env.TWITTER_CONSUMER_KEY || "",
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET || "",
});

async function findLatestTweetId(): Promise<Long> {
    const latestTweet = await st1Repo.findLatest();
    if (latestTweet === undefined) {
        throw new Error("Latest tweet not found");
    }

    const sinceId = latestTweet._id;
    if (sinceId === undefined) {
        throw new Error("Id not found");
    }

    return sinceId;
}

function storeTweets(tweetStream: Observable<ITweetDoc>): Promise<void> {
    return new Promise((resolve, reject) => {
        tweetStream.pipe(
            toArray()
        ).subscribe(
            (tweets) => {
                if (tweets.length === 0) {
                    logger.info("No new tweets. Nothing to store.");
                    resolve();
                    return;
                }

                // Log each new tweet
                tweets.forEach((tweet) => logger.info("%j", tweet));

                logger.info("Storing tweets");
                st1Repo.insertAll(tweets)
                    .catch((error) => reject(error))
                    .then((_) => resolve());
            },
            (error) => reject(error));
    });
}

async function pollerHandler(
    event: ScheduledEvent,
    context: Context,
  ): Promise<void> {
    // Allow exit even if we have some unfinished work waiting
    context.callbackWaitsForEmptyEventLoop = false;

    logger.info("Find latest tweet id");

    const id: Long = await findLatestTweetId();
    const idStr = id.toString();
    logger.info("Latest tweet id is %s", idStr);

    // Should probably stream the tweets to mongo with backpressure and what not...
    logger.info("Fetching and storing tweets newer than %s", idStr);
    const newestTweets = st1Twitter.fetchTweetsNewerThan(id);
    await storeTweets(newestTweets);
    logger.info("Tweets stored successfully");
}

export const poller: ScheduledHandler = (
    event: ScheduledEvent,
    context: Context,
    callback: Callback<void>,
): void => {
    pollerHandler(event, context)
        .then((result) => {
            logger.info("Callback");
            callback(null, result);
        })
        .catch((err) => {
            logger.info("Error %s", err);
            callback(err);
        });
};
