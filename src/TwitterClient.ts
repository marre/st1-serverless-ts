import Twit = require("twit");

import { Long } from "mongodb";
import { Observable, Subscriber } from "rxjs";

import { Tweet } from "./Tweet";

export interface ITwitterCredentials {
    accessToken: string;
    accessTokenSecret: string;
    consumerKey: string;
    consumerSecret: string;
}

export class TwitterClient {
    private readonly twit: Twit;

    constructor(twitterCredentials: ITwitterCredentials) {
        this.twit = new Twit({
            access_token:         twitterCredentials.accessToken,
            access_token_secret:  twitterCredentials.accessTokenSecret,
            consumer_key:         twitterCredentials.consumerKey,
            consumer_secret:      twitterCredentials.consumerSecret,
            timeout_ms:           10 * 1000,
        });
    }

    public fetchTweetsNewerThan(fromTweetId: string, screenName: string): Observable<Tweet> {
        return new Observable<Tweet>((subscriber) => {
            this.doFetchTweets(fromTweetId, screenName, subscriber)
                .catch((error) => subscriber.error(error))
                .then((_) => subscriber.complete());
        });
    }

    private async doFetchTweets(fromTweetId: string, screenName: string, subscriber: Subscriber<Tweet>): Promise<void> {
        let maxId: string | undefined;

        while (true) {
            const response = await this.twit.get("statuses/user_timeline", {
                count: 200,
                max_id: maxId,
                screen_name: screenName,
                since_id: fromTweetId,
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
                if (tweet.text === undefined) {
                    // Tweet without text, skip it...
                    continue;
                }

                subscriber.next(new Tweet(tweet.id_str, tweet.text));
            }
        }
    }
}
