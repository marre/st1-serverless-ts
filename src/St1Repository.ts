import { Collection, Long, MongoClient } from "mongodb";
import { Observable } from "rxjs/Rx";
import { Logger, transports } from "winston";

import { ITweetDoc } from "./St1TwitterClient";

const logger = new Logger({ transports: [ new transports.Console() ] });

export class St1Repository {
    private mongo: Promise<MongoClient>;

    constructor(mongoUrl: string) {
        this.mongo = MongoClient.connect(mongoUrl);
    }

    public async findLatest(): Promise<ITweetDoc> {
        const collection = await this.getCollection();

        const doc = await collection.findOne({}, {sort: {_id: -1}});

        return doc;
    }

    public findAll(): Observable<ITweetDoc> {
        return new Observable((subscriber) => {
            this.getCollection()
                .then((collection) => {
                    const cursor = collection.find({}, {batchSize: 10000, sort: { _id: 1}});
                    cursor.forEach(
                        (doc) => subscriber.next(doc),
                        (err) => {
                            if (err) {
                                subscriber.error(err);
                            } else {
                                subscriber.complete();
                            }
                        });
                    });
        });
    }

    public findNew(lastTweetId: Long): Observable<ITweetDoc> {
        return new Observable((subscriber) => {
            this.getCollection()
                .then((collection) => {
                    // Iternally the tweet id is a string, but stored in mongo
                    // as a long
                    const cursor = collection.find(
                        { _id: { $gt: lastTweetId }},
                        { batchSize: 10000, sort: { _id: 1}});

                    cursor.forEach(
                        (doc) => subscriber.next(doc),
                        (err) => {
                            if (err) {
                                subscriber.error(err);
                            } else {
                                subscriber.complete();
                            }
                        });
                });
        });
    }

    public async insertAll(tweets: ITweetDoc[]): Promise<void> {
        const collection = await this.getCollection();
        const result = await collection.insertMany(tweets);
    }

    private async getCollection(): Promise<Collection> {
        const client = await this.mongo;

        const db = client.db("st1price");
        return db.collection("st1price");
    }

}
