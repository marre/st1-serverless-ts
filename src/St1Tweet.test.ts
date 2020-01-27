import { Long } from "mongodb";
import { IStoredTweetDoc } from "./St1Repository";
import { St1Tweet } from "./St1Tweet";

test("parse() should ignore tweet without date", () => {
    const tweet = St1Tweet.parse(
        "987654321987654321",
        "Prisändring:\nE85: 9,19\nB95: 14,88\nDiesel: 14,42\n#St1DrWest");
    expect(tweet).toBe(null);
});

test("parse() should ignore non price tweets", () => {
    const tweet = St1Tweet.parse("987654321987654321", "Bla bla bla");
    expect(tweet).toBe(null);
});

test("parse() should parse tweet #1", () => {
    const tweet = St1Tweet.parse(
        "987654321987654321",
        "Prisändring:\nE85: 9,19\nB95: 14,88\nDiesel: 14,42\n#St1DrWest\n\n2014-06-27 10:29:07");

    if (tweet === null) {
        fail("tweet is null");
    }

    expect(tweet.tweetId).toBe("987654321987654321");

    expect(tweet.e85).toBe(9.19);
    expect(tweet.b95).toBe(14.88);
    expect(tweet.diesel).toBe(14.42);

    expect(tweet.location).toBe("DrWest");
    expect(tweet.date.toISOString()).toBe("2014-06-27T08:29:07.000Z");
});

test("Serialized IStoredTweetDoc should have _id stored as string", () => {
   const storedTweet: IStoredTweetDoc = {
       _id: Long.fromString("987654321987654321"),
       text: "Text",
   };

   const jsonStoredTweet = JSON.stringify(storedTweet);

   const parsedStoredTweet = JSON.parse(jsonStoredTweet);
   expect(parsedStoredTweet._id).toBe("987654321987654321");
});

test("Serialized should have _id stored as string", () => {
    const tweet: IStoredTweetDoc = {
        _id: Long.fromString("987654321987654321"),
        text: "Tweet",
    };

    const json = JSON.stringify(tweet);
    const parsedTweet = JSON.parse(json);

    expect(parsedTweet._id.toString()).toBe(tweet._id.toString());
});
