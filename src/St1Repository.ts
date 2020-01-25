import { Collection, Long, MongoClient } from "mongodb";
import { Subscriber, Observable, identity } from "rxjs";
import { createLogger, format, transports } from "winston";

/**
 * A tweet as stored in Mongo.
 */
export interface IStoredTweetDoc {
    // A twitter id is 64 bits so we cannot use number as that only has a
    // 53 bit integer part.
    readonly _id: Long;
    readonly text: string;
}

export function isIStoredTweetDoc(x: any): x is IStoredTweetDoc {
    if (x._id === undefined || x._id == null) {
        return false;
    }

    if (! (x._id instanceof Long)) {
        return false;
    }

    if (x.text === undefined || x.text == null) {
        return false;
    }

    if (typeof x.text !== "string") {
        return false;
    }

    // Seems to be a correct IStoredTweetDoc
    return true;
}

const logger = createLogger({
    format: format.combine(
        format.splat(),
        format.simple()
      ),
      transports: [ new transports.Console() ]
  });

export class St1Repository {
    private mongo: Promise<MongoClient>;

    constructor(mongoUrl: string) {
        // Connect here in constructor to make sure that we only
        // initiate a single connection
        this.mongo = MongoClient.connect(mongoUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
    }

    public async findLatest(): Promise<IStoredTweetDoc | null> {
        const collection = await this.getCollection();

        const doc = await collection.findOne({}, {sort: {_id: -1}});
        if (doc === undefined) {
            return null;
        }

        if (! isIStoredTweetDoc(doc)) {
            return null;
        }

        return doc;
    }

    public findAll(): Observable<IStoredTweetDoc> {
        return new Observable((subscriber : Subscriber<IStoredTweetDoc>) => {
            this.getCollection()
                .then((collection) => {
                    const cursor = collection.find({}, {batchSize: 10000, sort: { _id: 1}});
                    cursor.forEach(
                        (doc: IStoredTweetDoc) => subscriber.next(doc),
                        (err) => {
                            if (err) {
                                subscriber.error(err);
                            } else {
                                subscriber.complete();
                            }
                        });
                    })
                .catch((err) => subscriber.error(err))
        });
    }

    public findNew(lastTweetId: Long): Observable<IStoredTweetDoc> {
        return new Observable((subscriber : Subscriber<IStoredTweetDoc> ) => {
            this.getCollection()
                .then((collection) => {
                    // Iternally the tweet id is a string, but stored in mongo
                    // as a long
                    const cursor = collection.find(
                        { _id: { $gt: lastTweetId }},
                        { batchSize: 10000, sort: { _id: 1}});

                    cursor.forEach(
                        (doc: IStoredTweetDoc) => subscriber.next(doc),
                        (err) => {
                            if (err) {
                                subscriber.error(err);
                            } else {
                                subscriber.complete();
                            }
                        });
                })
                .catch((err) => subscriber.error(err));
        });
    }

    public async insertAll(tweets: IStoredTweetDoc[]): Promise<void> {
        const collection = await this.getCollection();
        const result = await collection.insertMany(tweets);
    }

    private async getCollection(): Promise<Collection<IStoredTweetDoc>> {
        const client = await this.mongo;

        const db = client.db("st1price");
        return db.collection("st1price");
    }
}
