## Serverless st1 petrol price thingy

St1 petrol stations in Sweden has been tweeting real time price changes since 2014. This project polls twitter and stores all St1 tweets into a mongo database. The project also provides a simple HTTP API that publishes historic prices for any St1 petrol station.

TODO:
 * Setup CI/CD with travis
 * Automate the update of the cachefile
 * A webapp that acutally displays the data
 * Swagger file for the API
 * Visualise test coverage
 * Use cloudflare CDN for caching petrol prices?
 * HTTPS

## Init cachefile

The data is highly cachable as tweets are only added, so the lambda is initialized with data downloaded from a s3 bucket.

The cache can be rebuilt by first dumping all data from the database into a file with st1dump, and then build the cachefile with st1parse.

Example:
```
ts-node src/st1dump.ts > data/dump-2018-05-28.json
cat data/dump-2018-05-28.json | ts-node src/st1parse.ts > data/tweets-2018-05-28.parsed.json
```

The resulting file can then be uploaded to the s3 bucket.
