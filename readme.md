## Serverless st1 petrol price thingy

St1 petrol stations in Sweden is tweeting petrol price changes in real time since 2014. This project polls these price changes and stores them into a mongo database. The project also provides a simple HTTP API that makes it possible to retrieve historic prices for any St1 petrol station.

This is actually v2 of this project, the original project was written in python and deployed to heroku (https://st1price.herokuapp.com). This remake is my way of learning more about serverless, typescript, mongo and modern web frontends.

TODO:
 * Automate the update of the cachefile
 * A webapp that graphs the data
 * Swagger file for the API
 * Visualise test coverage
 * Use cloudflare CDN for caching petrol prices

## Init cachefile

The data is highly cachable as tweets are only added, so the lambda is initialized with data downloaded from a s3 bucket.

The cache can be rebuilt by first dumping all data from the database into a file with st1dump, and then build the cachefile with st1parse.

Example:
```
ts-node src/st1dump.ts > data/dump-2018-05-28.json
cat data/dump-2018-05-28.json | ts-node src/st1parse.ts > data/tweets-2018-05-28.parsed.json
```

The resulting file can then be uploaded to a s3 bucket.
