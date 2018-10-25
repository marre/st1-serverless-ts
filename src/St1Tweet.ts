// Borrow Long from mongo as a 64 bit integer for tweet ids
import { Long } from "mongodb";

// Represents a parsed St1 tweet, with petrol prices, location etc
export class St1Tweet {
    public static parse(tweetId: Long, tweetText: string): St1Tweet | null {
        if (! St1Tweet.maybePriceTweet(tweetText)) {
            return null;
        }

        let priceDate: Date | undefined;
        let location: string | undefined;

        let priceE85: number | undefined;
        let priceB95: number | undefined;
        let priceDiesel: number | undefined;

        tweetText.split("\n").forEach((row) => {
            if (row.startsWith("E85")) {
                priceE85 = St1Tweet.parseTweetPrice(row.substring(5));
            } else if (row.startsWith("B95")) {
                priceB95 = St1Tweet.parseTweetPrice(row.substring(5));
            } else if (row.startsWith("Diesel")) {
                priceDiesel = St1Tweet.parseTweetPrice(row.substring(8));
            } else if (row.startsWith("#")) {
                if (row.length > 4) {
                    location = row.substring(4);
                }
            } else if (row.startsWith("20")) {
                priceDate = St1Tweet.parseTweetDate(row);
            }
        });

        if (priceDate === undefined) {
            return null;
        }

        if (location === undefined) {
            return null;
        }

        const st1Tweet = new St1Tweet(
            tweetId,
            location,
            priceDate,
            priceE85,
            priceB95,
            priceDiesel,
        );

        return st1Tweet;
    }

    private static maybePriceTweet(tweet: string): boolean {
        return tweet.startsWith("Just nu:") ||
               tweet.startsWith("Kolla!") ||
               tweet.startsWith("Nu har vi ändrat priset igen:") ||
               tweet.startsWith("Nytt pris:") ||
               tweet.startsWith("Prisuppdatering:") ||
               tweet.startsWith("Senaste nytt:") ||
               tweet.startsWith("Prisändring:");
    }

    private static parseTweetDate(str: string): Date {
        return new Date(str);
    }

    private static parseTweetPrice(str: string): number {
        const priceStr = str.replace(",", ".");
        return parseFloat(priceStr);
    }

    private constructor(
        public readonly tweetId: Long,
        public readonly location: string,
        public readonly date: Date,
        public readonly e85?: number,
        public readonly b95?: number,
        public readonly diesel?: number,
    ) {}
}
