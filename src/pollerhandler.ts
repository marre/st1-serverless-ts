import { Callback, Context, ScheduledEvent, ScheduledHandler } from "aws-lambda";
// Borrow Long from mongo as a 64 bit integer for tweet ids
import { Long } from "mongodb";
import { Observable, Subscriber } from "rxjs/Rx";
import { Logger, transports  } from "winston";
import { St1Repository } from "./St1Repository";
import { ITweetDoc, St1TwitterClient } from "./St1TwitterClient";

const logger = new Logger({ transports: [ new transports.Console() ] });

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
        tweetStream.toArray().subscribe(
            (tweets) => {
                if (tweets.length === 0) {
                    logger.info("No new tweets");
                    process.exit();
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
    logger.info("Find latest tweet id");

    findLatestTweetId()
        .then((id) => {
            const idStr = id.toString();
            logger.info("Latest tweet id is %s", idStr);

            // Should probably stream the tweets to mongo with backpressure and what not...
            logger.info("Fetching tweets newer than %s", idStr);

            const newestTweets = st1Twitter.fetchTweetsNewerThan(id);
            storeTweets(newestTweets)
                .then((_) => {
                    logger.info("Tweets stored successfully");
                    context.succeed("Tweets stored successfully");
                })
                .catch((err) => {
                    logger.info("Error storing tweets : %s", err);
                    context.fail(err);
                });
        });
}

export const poller: ScheduledHandler = (
    event: ScheduledEvent,
    context: Context,
    callback: Callback<void>,
): void => {
  pollerHandler(event, context)
    .then((result) => callback(null, result))
    .catch((err) => {
        logger.info("Error %s", err);
        callback(err);
    });
};
