// Borrow Long from mongo as a 64 bit integer for tweet ids
import { Long } from "mongodb";
import { St1Tweet } from "./St1Tweet";

test("parse() should ignore tweet without date", () => {
    const tweet = St1Tweet.parse(Long.fromInt(123), "Prisändring:\nE85: 9,19\nB95: 14,88\nDiesel: 14,42\n#St1DrWest");
    expect(tweet).toBe(null);
});

test("parse() should ignore non price tweets", () => {
    const tweet = St1Tweet.parse(Long.fromInt(123), "Bla bla bla");
    expect(tweet).toBe(null);
});

test("parse() should parse tweet #1", () => {
    const tweet = St1Tweet.parse(
        Long.fromInt(123),
        "Prisändring:\nE85: 9,19\nB95: 14,88\nDiesel: 14,42\n#St1DrWest\n\n2014-06-27 10:29:07") as St1Tweet;

    expect(tweet.e85).toBe(9.19);
    expect(tweet.b95).toBe(14.88);
    expect(tweet.diesel).toBe(14.42);

    expect(tweet.location).toBe("DrWest");
    expect(tweet.date.toISOString()).toBe("2014-06-27T08:29:07.000Z");
});
