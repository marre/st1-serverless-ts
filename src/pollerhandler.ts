import { Callback, Context, ScheduledEvent, ScheduledHandler } from "aws-lambda";
import { Observable, Subscriber } from "rxjs";
import { map, toArray } from "rxjs/operators";
import { createLogger, format, transports  } from "winston";
import { St1Repository } from "./St1Repository";
import { Tweet } from "./Tweet";
import { TwitterClient } from "./TwitterClient";
import { toIStoredTweetDoc } from "./St1";

const logger = createLogger({
    format: format.combine(
        format.splat(),
        format.simple(),
    ),
    transports: [ new transports.Console() ],
  });

const st1Repo = new St1Repository(process.env.MONGODB_ATLAS_CLUSTER_URI_RW || "");
const st1Twitter = new TwitterClient({
    accessToken: process.env.TWITTER_ACCESS_TOKEN || "",
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || "",
    consumerKey: process.env.TWITTER_CONSUMER_KEY || "",
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET || "",
});

async function findLatestTweetId(): Promise<string> {
    const latestTweet = await st1Repo.findLatest();
    if (latestTweet === null) {
        throw new Error("Latest tweet not found");
    }

    const sinceId = latestTweet._id;

    return sinceId.toString();
}

function storeTweets(tweetStream: Observable<Tweet>): Promise<void> {
    return new Promise((resolve, reject) => {
        tweetStream.pipe(
            map((tweet) => toIStoredTweetDoc(tweet)),
            toArray(),
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

    const id: string = await findLatestTweetId();
    logger.info("Latest tweet id is %s", id);

    // Should probably stream the tweets to mongo with backpressure and what not...
    logger.info("Fetching and storing tweets newer than %s", id);
    const newestTweets = st1Twitter.fetchTweetsNewerThan(id, "st1sverige");
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
