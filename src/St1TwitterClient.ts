import Twit = require("twit");

import { Long } from "mongodb";
import { Observable, Subscriber } from "rxjs/Rx";

export interface ITweetDoc {
    // A twitter id (snowflake) is a 64 bit integer.
    // javascript number is however only 53 bits, so we borrow Long from mongo
    // https://developer.twitter.com/en/docs/basics/twitter-ids
    _id: Long | undefined;
    text: string | undefined;
}

export interface ITwitterCredentials {
    accessToken: string;
    accessTokenSecret: string;
    consumerKey: string;
    consumerSecret: string;
}

export class St1TwitterClient {
    private twit: Twit;

    constructor(twitterCredentials: ITwitterCredentials) {
        this.twit = new Twit({
            access_token:         twitterCredentials.accessToken,
            access_token_secret:  twitterCredentials.accessTokenSecret,
            consumer_key:         twitterCredentials.consumerKey,
            consumer_secret:      twitterCredentials.consumerSecret,
            timeout_ms:           10 * 1000,
        });
    }

    public fetchTweetsNewerThan(fromTweetId: Long): Observable<ITweetDoc> {
        return new Observable((subscriber) => {
            this.doFetchTweets(fromTweetId, subscriber)
                .catch((error) => subscriber.error(error))
                .then((_) => subscriber.complete());
        });
    }

    private async doFetchTweets(fromTweetId: Long, subscriber: Subscriber<ITweetDoc>): Promise<void> {
        let maxId: string | undefined;

        while (true) {
            const response = await this.twit.get("statuses/user_timeline", {
                count: 200,
                max_id: maxId,
                screen_name: "st1sverige",
                since_id: fromTweetId.toJSON(),
            });

            const tweets = response.data as Twit.Twitter.Status[];
            if (tweets.length === 0) {
                // Done...
                return;
            }

            // We might have to fetch even older tweets
            maxId = tweets
                .map((tweet) => tweet.id_str)
                .map((idStr) => Long.fromString(idStr))
                .reduce((a, b) => (a.lessThan(b) ? a : b))
                .subtract(Long.fromNumber(1))
                .toString();

            for (const tweet of tweets) {
                subscriber.next({
                    _id: Long.fromString(tweet.id_str),
                    text: tweet.text,
                });
            }
        }
    }
}
