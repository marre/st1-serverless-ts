import fs = require("fs");
import rp = require("request-promise-native");

// Borrow Long from mongo as a 64 bit integer for tweet ids
import {Long} from "mongodb";
import {map} from 'rxjs/operators';
import {createLogger, format, transports} from "winston";
import {splitStream} from "./splitStream";
import {IStoredTweetDoc, St1Repository} from "./St1Repository";
import {St1Tweet} from "./St1Tweet";
import {Tweet} from "./Tweet";

const logger = createLogger({
    format: format.combine(
        format.splat(),
        format.simple(),
    ),
    transports: [ new transports.Console() ],
  });

const b95 = "b95";
const diesel = "diesel";
const e85 = "e85";

// petrol to epoch + price
interface IPrice {
    [petrol: string]: number[][];
}

interface IPriceByLocation {
    [location: string]: IPrice;
}

/**
 * Defines the cache file format.
 */
interface ISt1Cache {
    // Storing lastTweetId as String to make it possible to quickly load this JSON with JSON.parse
    lastTweetId: string;
    tweetsByLocation: IPriceByLocation;
}

export class St1 {
    public static createEmpty(): St1 {
        return new St1();
    }

    public static createFromCache(cache: ISt1Cache): St1 {
        const lastTweetId: Long = Long.fromString(cache.lastTweetId);
        const tweetsByLocation: IPriceByLocation = cache.tweetsByLocation;

        return new St1(lastTweetId, tweetsByLocation);
    }

    public static async createFromCacheData(cacheData: string): Promise<St1> {
        // TODO: This parse() is slow!
        const parsedData = JSON.parse(cacheData);
        // TODO: Can we verify that it actually is ISt1Cache??
        return St1.createFromCache(parsedData);
    }

    public static async createFromCacheFile(filename: string): Promise<St1> {
        const data = await readFile(filename);
        return St1.createFromCacheData(data);
    }

    public static async createFromCacheURI(uri: string): Promise<St1> {
        const data = await readUri(uri);
        return St1.createFromCacheData(data);
    }

    public static createWithTweetsFromStream(readStream: NodeJS.ReadableStream): Promise<St1> {
        const st1 = new St1();

        return new Promise((resolve, reject) => {
            splitStream(readStream).pipe(
                map((row) => JSON.parse(row)),
                map((parsed) => new Tweet(parsed._id, parsed.text)),
            )
            .subscribe(
                (st1TweetData) => st1.appendTweetFromData(st1TweetData),
                (err) => {
                    logger.error("Failed to create with data from stream, using cached data only. %s", err);
                    resolve(st1);
                },
                () => resolve(st1),
            );
        });
    }

    public static createWithTweetsFromDb(st1repository: St1Repository): Promise<St1> {
        const st1 = new St1();

        return new Promise((resolve, reject) => {
            st1repository.findAll()
                .subscribe(
                    (st1TweetData) => st1.appendTweetFromData(toTweet(st1TweetData)),
                    (err) => {
                        logger.error("Failed to create with data from db, using cached data only. %s", err);
                        resolve(st1);
                    },
                    () => resolve(st1),
                );
        });
    }

    private constructor(
        private lastTweetId: Long = Long.fromInt(0),
        private priceByLocation: IPriceByLocation = {},
    ) {
    }

    // Export as ISt1Cache
    public toJSON(): ISt1Cache {
        return {
            lastTweetId: this.lastTweetId.toString(),
            tweetsByLocation: this.priceByLocation,
        };
    }

    public lookupPrices(location: string, petrol: string): number[][] | null {
        const priceForLocation = this.priceByLocation[location];
        if (priceForLocation === undefined) {
            return null;
        }

        const price = priceForLocation[petrol];
        if (price === undefined) {
            return null;
        }

        return price;
    }

    public updateWithTweetsFromDb(st1repository: St1Repository): Promise<St1> {
        return new Promise((resolve, reject) => {
            st1repository.findNew(this.lastTweetId)
                .subscribe(
                    (st1TweetData) => this.appendTweetFromData(toTweet(st1TweetData)),
                    (err) => {
                        logger.error("Failed to fill with data from db, using cached data only. %s", err);
                        resolve(this);
                    },
                    () => resolve(this),
                );
        });
    }

    public appendTweetFromData(tweet: Tweet) {
        const parsedTweet = parseTweet(tweet);

        if (parsedTweet === null) {
            // Failed to parse tweet. Skip it...
            return;
        }

        if (parsedTweet.location === undefined) {
            // No location. Skip it...
            return;
        }

        const parsedTweetId = Long.fromString(parsedTweet.tweetId);
        if (this.lastTweetId.greaterThanOrEqual(parsedTweetId)) {
            // To old. Skip it...
            return;
        }

        const location = parsedTweet.location;
        let priceForLocation: IPrice = this.priceByLocation[location];
        if (priceForLocation === undefined) {
            this.priceByLocation[location] = {};
            priceForLocation = this.priceByLocation[location];
            priceForLocation[b95] = [];
            priceForLocation[e85] = [];
            priceForLocation[diesel] = [];
        }

        this.lastTweetId = parsedTweetId;

        const epoch = parsedTweet.date.getTime();
        if (parsedTweet.b95 !== undefined) {
            priceForLocation[b95].push([epoch, parsedTweet.b95]);
        }

        if (parsedTweet.diesel !== undefined) {
            priceForLocation[diesel].push([epoch, parsedTweet.diesel]);
        }

        if (parsedTweet.e85 !== undefined) {
            priceForLocation[e85].push([epoch, parsedTweet.e85]);
        }
    }
}

export function toIStoredTweetDoc(tweet: Tweet): IStoredTweetDoc {
    return {
        _id: Long.fromString(tweet.tweetId),
        text: tweet.text,
    };
}

export function toTweet(storedTweetDoc: IStoredTweetDoc): Tweet {
    return new Tweet(
        storedTweetDoc._id.toString(),
        storedTweetDoc.text,
    );
}

async function readUri(uri: string): Promise<string> {
    return rp(uri);
}

function readFile(filename: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        fs.readFile(filename, "utf8", (err, data) => {
            if (err) {
                reject(new Error(err.message));
                return;
            }

            resolve(data);
        });
    });
}

function parseTweet(tweet: Tweet): St1Tweet | null {
    return St1Tweet.parse(
        tweet.tweetId,
        tweet.text);
}
